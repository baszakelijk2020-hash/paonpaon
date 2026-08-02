-- FT-10 Inspiration Box / gift booklet — first connected slice
-- (docs/FOUNDER_TOOL_BLUEPRINTS.md). No interactive source fragment exists
-- to port (reconfirmed against downloaded_pages/pag1.html), so this is
-- built with PAON's own primitives against the blueprint's PAON-job/state
-- description rather than a pixel port.
--
-- Redemption deliberately does not create an Order or touch stock: R0.2
-- already established a narrow, atomic, advisory-locked money/stock write
-- surface (place_order / add_to_cart / POS RPCs), and "further generic
-- stock write-surface consolidation is a hardening follow-up" per PHASE.md
-- — a fresh ad-hoc order-creation path here would be exactly that
-- uncoordinated surface. Instead, redemption records a selection outcome;
-- the retailer's advisor converts it into a real order/appointment through
-- the existing, already-atomic flows. This matches the blueprint's "do not
-- invent a stored-value liability... operate as a proposal" instruction.

create type public.gift_experience_status as enum (
  'draft', 'active', 'expired', 'revoked'
);

create type public.gift_invitation_status as enum (
  'pending', 'opened', 'redeemed', 'expired', 'revoked'
);

create table public.gift_experiences (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  intro_message text not null check (char_length(intro_message) between 1 and 2000),
  status public.gift_experience_status not null default 'draft',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index gift_experiences_retailer_idx on public.gift_experiences (retailer_id);
create trigger set_gift_experiences_updated_at
  before update on public.gift_experiences
  for each row execute function public.set_updated_at();

create table public.gift_curated_items (
  id uuid primary key default gen_random_uuid(),
  gift_experience_id uuid not null references public.gift_experiences (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index gift_curated_items_experience_idx
  on public.gift_curated_items (gift_experience_id);

create table public.gift_invitations (
  id uuid primary key default gen_random_uuid(),
  gift_experience_id uuid not null references public.gift_experiences (id) on delete cascade,
  invite_token uuid not null default gen_random_uuid() unique,
  recipient_name text check (recipient_name is null or char_length(recipient_name) <= 200),
  recipient_email text check (recipient_email is null or char_length(recipient_email) <= 320),
  status public.gift_invitation_status not null default 'pending',
  opened_at timestamptz,
  redeemed_at timestamptz,
  redeemed_curated_item_id uuid references public.gift_curated_items (id) on delete set null,
  redeemed_recipient_name text,
  redeemed_recipient_email text,
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_invitations_experience_idx
  on public.gift_invitations (gift_experience_id);

alter table public.gift_experiences enable row level security;
alter table public.gift_curated_items enable row level security;
alter table public.gift_invitations enable row level security;

create policy "platform manages gift experiences"
  on public.gift_experiences for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());
create policy "retailer staff read gift experiences"
  on public.gift_experiences for select
  using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage gift experiences"
  on public.gift_experiences for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy "platform manages gift curated items"
  on public.gift_curated_items for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());
create policy "retailer staff read gift curated items"
  on public.gift_curated_items for select
  using (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_curated_items.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
    )
  );
create policy "retailer managers manage gift curated items"
  on public.gift_curated_items for all
  using (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_curated_items.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_curated_items.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  );

-- No anonymous/customer select policy — ADR-034's "no new anonymous
-- RLS read/insert policy, narrow RPC only". A recipient never reads this
-- table directly; resolve_gift_invitation() is the only surface.
create policy "platform manages gift invitations"
  on public.gift_invitations for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());
create policy "retailer staff read gift invitations"
  on public.gift_invitations for select
  using (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_invitations.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
    )
  );
create policy "retailer managers manage gift invitations"
  on public.gift_invitations for all
  using (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_invitations.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.gift_experiences e
      where e.id = gift_invitations.gift_experience_id
        and e.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  );

-- Anonymous, opaque-token reveal. Opens the invitation once (pending ->
-- opened) and returns only what the recipient needs to see — never the
-- giver's identity beyond what the retailer chose to put in the message,
-- and never any other recipient's activity (ADR-034 "minimum data").
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

  v_effective_status := v_invitation.status::text;
  if v_effective_status in ('pending', 'opened') then
    if v_experience.status = 'revoked' then
      v_effective_status := 'revoked';
    elsif v_experience.expires_at is not null and v_experience.expires_at < now() then
      v_effective_status := 'expired';
    end if;
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

-- Anonymous, opaque-token redemption. Deliberately narrow: records which
-- curated item the recipient chose and captures invitation-purpose-only
-- contact details, but never creates marketing consent, an Order or a
-- stock movement — see the migration header comment for why.
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
  if v_invitation.status = 'redeemed' then
    raise exception 'This gift has already been redeemed';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'This gift link is no longer valid';
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

revoke all on function public.resolve_gift_invitation(uuid) from public;
revoke all on function public.redeem_gift_invitation(uuid, uuid, text, text) from public;
grant execute on function public.resolve_gift_invitation(uuid)
  to anon, authenticated, service_role;
grant execute on function public.redeem_gift_invitation(uuid, uuid, text, text)
  to anon, authenticated, service_role;

grant select, insert, update, delete
  on public.gift_experiences, public.gift_curated_items, public.gift_invitations
  to authenticated, service_role;
