-- FT-10 Inspiration Box: per-invitation expiry, revocation and refund
-- state (docs/PHASE.md FT-10 gap). Complements the existing
-- experience-level expires_at/revoked status (20260802000006), which
-- still bulk-covers "shut the whole gift down"; this adds the narrower
-- "this one recipient's link" cases a manager needs day to day:
--   * a single invitation should lapse on its own schedule
--     (expires_at), independent of the experience's own expiry;
--   * a single invitation should be pulled without revoking every other
--     invitation on the same experience (revoked_at);
--   * a redeemed invitation turns out to need money back — no payment
--     capture/refund processing exists yet (giver payment is a separate,
--     unbuilt FT-10 slice), so refund_amount_minor_units/refund_reason
--     are a record of a refund decision made and executed elsewhere, not
--     a payment instruction this migration issues.
--
-- gift_invitation_state_history is deliberately append-only: it has no
-- update/delete policy for any role (not even platform staff), and no
-- role is granted table-level insert/update/delete privileges at all —
-- rows can only be created by the SECURITY DEFINER functions below,
-- which run as the function owner and write exactly one history row per
-- transition. If a correction is ever needed, the fix is a new
-- compensating row, never an edit to history.

alter type public.gift_invitation_status add value if not exists 'refunded';

alter table public.gift_invitations
  add column expires_at timestamptz,
  add column revoked_at timestamptz,
  add column refund_amount_minor_units integer,
  add column refund_reason text;

alter table public.gift_invitations
  add constraint gift_invitations_refund_amount_check
    check (refund_amount_minor_units is null or refund_amount_minor_units >= 0),
  add constraint gift_invitations_refund_reason_length_check
    check (refund_reason is null or char_length(refund_reason) <= 500);

create table public.gift_invitation_state_history (
  id uuid primary key default gen_random_uuid(),
  gift_invitation_id uuid not null references public.gift_invitations (id) on delete cascade,
  from_status public.gift_invitation_status,
  to_status public.gift_invitation_status not null,
  reason text check (reason is null or char_length(reason) <= 500),
  refund_amount_minor_units integer check (refund_amount_minor_units is null or refund_amount_minor_units >= 0),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_invitation_state_history_invitation_idx
  on public.gift_invitation_state_history (gift_invitation_id, created_at);

alter table public.gift_invitation_state_history enable row level security;

create policy "platform reads gift invitation state history"
  on public.gift_invitation_state_history for select
  using (public.is_platform_staff());
create policy "retailer staff read gift invitation state history"
  on public.gift_invitation_state_history for select
  using (
    exists (
      select 1 from public.gift_invitations gi
      join public.gift_experiences e on e.id = gi.gift_experience_id
      where gi.id = gift_invitation_state_history.gift_invitation_id
        and e.retailer_id = public.current_retailer_id()
    )
  );

-- Select only — see the header comment. No insert/update/delete grant to
-- any client role; every row is written by a SECURITY DEFINER function.
grant select on public.gift_invitation_state_history to authenticated, service_role;

-- Idempotent lazy-expiry, mirroring the pending->opened lazy write
-- resolve_gift_invitation already does. Folds in both the invitation's
-- own expires_at and the experience's expires_at, so either one lapsing
-- persists 'expired' onto the invitation. No-ops on any invitation that
-- has already left the pending/opened window (redeemed/revoked/refunded/
-- already-expired invitations are left untouched).
create or replace function public.expire_gift_invitation(
  p_invitation_id uuid
)
returns public.gift_invitation_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
begin
  select * into v_invitation
    from public.gift_invitations
    where id = p_invitation_id
    for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invitation.status not in ('pending', 'opened') then
    return v_invitation.status;
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id;

  if not (
    (v_invitation.expires_at is not null and v_invitation.expires_at < now())
    or (v_experience.expires_at is not null and v_experience.expires_at < now())
  ) then
    return v_invitation.status;
  end if;

  update public.gift_invitations
    set status = 'expired'
    where id = v_invitation.id;

  insert into public.gift_invitation_state_history (
    gift_invitation_id, from_status, to_status, reason
  ) values (
    v_invitation.id, v_invitation.status, 'expired', null
  );

  return 'expired'::public.gift_invitation_status;
end;
$$;

revoke all on function public.expire_gift_invitation(uuid) from public;
grant execute on function public.expire_gift_invitation(uuid)
  to anon, authenticated, service_role;

-- Manager-only: revoke a single invitation without touching its
-- siblings or the parent experience. Only a still-live invitation
-- (pending/opened) can be revoked — once redeemed the recipient has
-- already chosen (use mark_gift_invitation_refunded instead), and an
-- already-revoked/expired/refunded invitation has nothing left to
-- revoke.
create or replace function public.revoke_gift_invitation(
  p_invitation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v_invitation
    from public.gift_invitations
    where id = p_invitation_id
    for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id;
  if not found then
    raise exception 'Invitation not found';
  end if;

  if auth.role() <> 'service_role' and (
    v_experience.retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner')
  ) then
    raise exception 'Only retailer managers may revoke a gift invitation';
  end if;

  if v_invitation.status not in ('pending', 'opened') then
    raise exception 'This invitation is % and can no longer be revoked', v_invitation.status;
  end if;

  update public.gift_invitations
    set status = 'revoked', revoked_at = now()
    where id = v_invitation.id;

  insert into public.gift_invitation_state_history (
    gift_invitation_id, from_status, to_status, reason, actor_staff_id
  ) values (
    v_invitation.id, v_invitation.status, 'revoked', v_reason, public.current_staff_id()
  );
end;
$$;

revoke all on function public.revoke_gift_invitation(uuid, text) from public;
grant execute on function public.revoke_gift_invitation(uuid, text)
  to authenticated, service_role;

-- Manager-only: record that a redeemed invitation's gift was refunded.
-- This is a state/audit record, not a payment instruction — no payment
-- processor is called here (see the migration header). Guarded so a
-- refund can only be recorded once per invitation: the row lock plus the
-- 'redeemed' -> 'refunded' transition means a second call sees status =
-- 'refunded' and is rejected before any write.
create or replace function public.mark_gift_invitation_refunded(
  p_invitation_id uuid,
  p_refund_amount_minor_units integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  if p_refund_amount_minor_units is null or p_refund_amount_minor_units < 0 then
    raise exception 'Refund amount must be zero or greater';
  end if;

  select * into v_invitation
    from public.gift_invitations
    where id = p_invitation_id
    for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id;
  if not found then
    raise exception 'Invitation not found';
  end if;

  if auth.role() <> 'service_role' and (
    v_experience.retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner')
  ) then
    raise exception 'Only retailer managers may refund a gift invitation';
  end if;

  -- Checked in this order so a *second* refund attempt on an
  -- already-refunded invitation reports the specific "already refunded"
  -- reason rather than the generic "must be redeemed first" one (by the
  -- time it's refunded, status has already moved off 'redeemed').
  if v_invitation.refund_amount_minor_units is not null then
    raise exception 'This invitation has already been refunded';
  end if;
  if v_invitation.status <> 'redeemed' then
    raise exception 'Only a redeemed invitation can be marked refunded';
  end if;

  update public.gift_invitations
    set status = 'refunded',
        refund_amount_minor_units = p_refund_amount_minor_units,
        refund_reason = v_reason
    where id = v_invitation.id;

  insert into public.gift_invitation_state_history (
    gift_invitation_id, from_status, to_status, reason,
    refund_amount_minor_units, actor_staff_id
  ) values (
    v_invitation.id, v_invitation.status, 'refunded', v_reason,
    p_refund_amount_minor_units, public.current_staff_id()
  );
end;
$$;

revoke all on function public.mark_gift_invitation_refunded(uuid, integer, text) from public;
grant execute on function public.mark_gift_invitation_refunded(uuid, integer, text)
  to authenticated, service_role;

-- Re-point resolve_gift_invitation at the now-persisted expiry instead
-- of only ever computing it on the fly, and let an invitation-level
-- revoke (revoked_at/status='revoked') surface the same as the existing
-- experience-level bulk revoke already did. Never returns
-- refund_amount_minor_units/refund_reason to the anonymous recipient —
-- those stay retailer-internal; the recipient only learns the gift was
-- refunded, not why or how much.
create or replace function public.resolve_gift_invitation(
  p_invite_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
  v_retailer public.retailers%rowtype;
  v_effective_status text;
begin
  select * into v_invitation
    from public.gift_invitations
    where invite_token = p_invite_token;
  if not found then
    raise exception 'This gift link is no longer valid';
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id and deleted_at is null;
  if not found then
    raise exception 'This gift link is no longer valid';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_experience.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'This gift link is no longer valid';
  end if;

  perform public.expire_gift_invitation(v_invitation.id);
  select * into v_invitation
    from public.gift_invitations
    where id = v_invitation.id;

  v_effective_status := v_invitation.status::text;
  if v_effective_status in ('pending', 'opened') and v_experience.status = 'revoked' then
    v_effective_status := 'revoked';
  end if;

  if v_invitation.status = 'pending' and v_effective_status = 'pending' then
    update public.gift_invitations
      set status = 'opened', opened_at = now()
      where id = v_invitation.id;
    v_effective_status := 'opened';
  end if;

  return jsonb_build_object(
    'retailerDisplayName', v_retailer.display_name,
    'retailerSlug', v_retailer.slug,
    'title', v_experience.title,
    'introMessage', v_experience.intro_message,
    'status', v_effective_status,
    'redeemedCuratedItemId', v_invitation.redeemed_curated_item_id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'curatedItemId', ci.id,
        'productVariantId', pv.id,
        'productName', p.name,
        'variantLabel', concat_ws(' · ', pv.size, pv.color),
        'priceAmountMinorUnits', pv.price_amount_minor_units,
        'priceCurrency', pv.price_currency,
        'primaryImageUrl', p.primary_image_url,
        'note', ci.note
      ) order by ci.sort_order, ci.created_at)
      from public.gift_curated_items ci
      join public.product_variants pv on pv.id = ci.product_variant_id
      join public.products p on p.id = pv.product_id
      where ci.gift_experience_id = v_experience.id
        and pv.deleted_at is null
        and p.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Enforces invitation-level expiry/revocation/refund in the redeem path
-- itself (not just the reveal path), so a stale client can never redeem
-- past a state the database has already settled.
create or replace function public.redeem_gift_invitation(
  p_invite_token uuid,
  p_curated_item_id uuid,
  p_recipient_name text,
  p_recipient_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.gift_invitations%rowtype;
  v_experience public.gift_experiences%rowtype;
  v_item public.gift_curated_items%rowtype;
  v_name text := trim(p_recipient_name);
  v_email text := lower(trim(p_recipient_email));
begin
  if v_name = '' or v_name is null or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;

  select * into v_invitation
    from public.gift_invitations
    where invite_token = p_invite_token
    for update;
  if not found then
    raise exception 'This gift link is no longer valid';
  end if;

  if v_invitation.status in ('redeemed', 'refunded') then
    raise exception 'This gift has already been redeemed';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'This gift link is no longer valid';
  end if;
  if v_invitation.status = 'expired' then
    raise exception 'This gift link has expired';
  end if;

  -- A live check, not a call to expire_gift_invitation(): this branch
  -- always ends in a raise, and a raise unwinds every effect of this
  -- statement (including a nested function's own writes) back to
  -- before the call — so persisting 'expired' here would just be
  -- rolled back with it. The next resolve_gift_invitation call on this
  -- invitation (which does not raise on the expired path) is what
  -- actually persists the transition; this only has to block the
  -- redemption itself.
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    raise exception 'This gift link has expired';
  end if;

  select * into v_experience
    from public.gift_experiences
    where id = v_invitation.gift_experience_id and deleted_at is null
    for update;
  if not found or v_experience.status not in ('draft', 'active') then
    raise exception 'This gift link is no longer valid';
  end if;
  if v_experience.expires_at is not null and v_experience.expires_at < now() then
    raise exception 'This gift link has expired';
  end if;

  select * into v_item
    from public.gift_curated_items
    where id = p_curated_item_id
      and gift_experience_id = v_experience.id;
  if not found then
    raise exception 'Choose one of the curated pieces';
  end if;

  update public.gift_invitations
    set status = 'redeemed',
        redeemed_at = now(),
        redeemed_curated_item_id = v_item.id,
        redeemed_recipient_name = v_name,
        redeemed_recipient_email = v_email
    where id = v_invitation.id;

  -- Invitation-purpose only: creates no consent, and reuses an existing
  -- guest customer by email rather than duplicating one, the same
  -- find-or-create shape as join_wedding_party/submit_table_service_inquiry.
  if not exists (
    select 1 from public.customers
    where retailer_id = v_experience.retailer_id
      and lower(email) = v_email
      and deleted_at is null
  ) then
    insert into public.customers (
      retailer_id, full_name, email, lifecycle_stage, acquisition_source
    ) values (
      v_experience.retailer_id, v_name, v_email, 'prospect', 'gift_invitation'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'curatedItemId', v_item.id
  );
end;
$$;
