-- PHASE 10.2 / CMP-105, CMP-106, WRD-104: owned-first seven-day looks + honeymoon tracker.

-- ---------------------------------------------------------------------------
-- Campaign library keys
-- ---------------------------------------------------------------------------

alter table public.campaign_library_entries
  drop constraint if exists campaign_library_entries_key_check;

alter table public.campaign_library_entries
  add constraint campaign_library_entries_key_check check (
    key in (
      'private_offer_member_fabric',
      'seven_day_wardrobe_v1',
      'honeymoon_phase_v1'
    )
  );

insert into public.campaign_library_entries (key, display_name)
values
  ('seven_day_wardrobe_v1', 'Seven-Day Wardrobe'),
  ('honeymoon_phase_v1', 'Honeymoon Phase')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Campaign kind for order journey packages
-- ---------------------------------------------------------------------------

alter table public.campaigns
  drop constraint if exists campaigns_kind_check;

alter table public.campaigns
  add constraint campaigns_kind_check check (
    kind in ('private_offer', 'wardrobe_challenge', 'order_journey')
  );

-- ---------------------------------------------------------------------------
-- Seven-day look slots: owned wardrobe OR catalogue (XOR)
-- ---------------------------------------------------------------------------

alter table public.campaign_challenge_looks
  add column if not exists occasion_label text,
  add column if not exists gap_citations jsonb not null default '[]'::jsonb;

alter table public.campaign_challenge_look_slots
  add column if not exists wardrobe_item_id uuid
    references public.wardrobe_items (id) on delete restrict,
  add column if not exists source_kind text not null default 'catalogue_suggested'
    check (source_kind in ('owned', 'catalogue_suggested'));

alter table public.campaign_challenge_look_slots
  alter column product_id drop not null;

alter table public.campaign_challenge_look_slots
  drop constraint if exists campaign_challenge_look_slots_reference_chk;

alter table public.campaign_challenge_look_slots
  add constraint campaign_challenge_look_slots_reference_chk check (
    (
      wardrobe_item_id is not null
      and product_id is null
      and source_kind = 'owned'
    )
    or (
      wardrobe_item_id is null
      and product_id is not null
      and source_kind = 'catalogue_suggested'
    )
  );

comment on column public.campaign_challenge_look_slots.wardrobe_item_id is
  'Owned wardrobe piece for owned-first seven-day looks (PHASE 10.2).';
comment on column public.campaign_challenge_looks.gap_citations is
  'Cited gaps when catalogue suggestions fill missing owned slots.';

-- ---------------------------------------------------------------------------
-- Honeymoon order journey
-- ---------------------------------------------------------------------------

create table if not exists public.order_honeymoon_enrollments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  library_version_id uuid references public.campaign_library_versions (id),
  status text not null default 'active' check (
    status in ('active', 'completed', 'withdrawn')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_honeymoon_enrollments_order_uidx unique (order_id),
  constraint order_honeymoon_enrollments_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create trigger set_order_honeymoon_enrollments_updated_at
  before update on public.order_honeymoon_enrollments
  for each row execute function public.set_updated_at();

create table if not exists public.order_honeymoon_milestones (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.order_honeymoon_enrollments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in ('preparation', 'collection', 'aftercare')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'available', 'completed', 'dismissed', 'suppressed')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 1000),
  action_kind text not null check (
    action_kind in (
      'book_appointment',
      'view_care',
      'prepare_wardrobe',
      'collection_plan',
      'review_fit'
    )
  ),
  action_href text,
  due_at timestamptz,
  stock_truth text,
  lead_time_truth text,
  suppress_reason text,
  display_order integer not null default 0,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_honeymoon_milestones_enrollment_title_uidx
    unique (enrollment_id, title)
);

create trigger set_order_honeymoon_milestones_updated_at
  before update on public.order_honeymoon_milestones
  for each row execute function public.set_updated_at();

create index if not exists order_honeymoon_enrollments_customer_idx
  on public.order_honeymoon_enrollments (customer_id, status);

alter table public.order_honeymoon_enrollments enable row level security;
alter table public.order_honeymoon_milestones enable row level security;
revoke all on table public.order_honeymoon_enrollments from anon;
revoke all on table public.order_honeymoon_milestones from anon;

create policy "customers read own honeymoon enrollments"
  on public.order_honeymoon_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = order_honeymoon_enrollments.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant honeymoon enrollments"
  on public.order_honeymoon_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.retailer_staff rs
      where rs.retailer_id = order_honeymoon_enrollments.retailer_id
        and rs.user_id = (select auth.uid())
        and rs.deleted_at is null
    )
  );

create policy "customers read own honeymoon milestones"
  on public.order_honeymoon_milestones for select to authenticated
  using (
    exists (
      select 1
      from public.order_honeymoon_enrollments e
      join public.customers c on c.id = e.customer_id
      where e.id = order_honeymoon_milestones.enrollment_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant honeymoon milestones"
  on public.order_honeymoon_milestones for select to authenticated
  using (
    exists (
      select 1 from public.retailer_staff rs
      where rs.retailer_id = order_honeymoon_milestones.retailer_id
        and rs.user_id = (select auth.uid())
        and rs.deleted_at is null
    )
  );

grant select on table public.order_honeymoon_enrollments to authenticated, service_role;
grant select on table public.order_honeymoon_milestones to authenticated, service_role;
grant all on table public.order_honeymoon_enrollments to service_role;
grant all on table public.order_honeymoon_milestones to service_role;

comment on table public.order_honeymoon_enrollments is
  'Honeymoon Phase order journey enrollments (PHASE 10.2 / CMP-106).';
comment on table public.order_honeymoon_milestones is
  'Preparation/collection/aftercare milestones with stock/lead-time truth.';

-- ---------------------------------------------------------------------------
-- RPC: upsert_campaign_challenge_look (owned-first slots)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_campaign_challenge_look(
  p_enrollment_id uuid,
  p_day_index integer,
  p_title text,
  p_slots jsonb,
  p_occasion_label text default null,
  p_gap_citations jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.campaign_challenge_enrollments%rowtype;
  v_customer public.customers%rowtype;
  v_look_id uuid;
  v_slot jsonb;
  v_order integer := 0;
  v_source text;
  v_product_id uuid;
  v_wardrobe_id uuid;
begin
  if p_day_index < 1 or p_day_index > 7 then
    raise exception 'day_index must be between 1 and 7';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) < 1 then
    raise exception 'At least one slot is required';
  end if;

  select * into v_enrollment
  from public.campaign_challenge_enrollments
  where id = p_enrollment_id;
  if not found then
    raise exception 'Enrollment not found';
  end if;
  if v_enrollment.status <> 'in_progress' then
    raise exception 'Enrollment is not in progress';
  end if;

  select * into v_customer
  from public.customers
  where id = v_enrollment.customer_id
    and deleted_at is null;
  if not found or v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to update campaign challenge look';
  end if;

  insert into public.campaign_challenge_looks (
    enrollment_id,
    retailer_id,
    customer_id,
    day_index,
    title,
    occasion_label,
    gap_citations
  ) values (
    p_enrollment_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    p_day_index,
    btrim(p_title),
    nullif(btrim(coalesce(p_occasion_label, '')), ''),
    coalesce(p_gap_citations, '[]'::jsonb)
  )
  on conflict (enrollment_id, day_index) do update set
    title = excluded.title,
    occasion_label = excluded.occasion_label,
    gap_citations = excluded.gap_citations,
    updated_at = now()
  returning id into v_look_id;

  delete from public.campaign_challenge_look_slots
  where look_id = v_look_id;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    if coalesce(v_slot->>'slot_kind', '') not in (
      'jacket', 'trousers', 'shirt', 'shoes', 'accessories', 'pocket_square'
    ) then
      raise exception 'Invalid slot_kind';
    end if;

    v_source := coalesce(v_slot->>'source_kind', 'catalogue_suggested');
    v_product_id := nullif(v_slot->>'product_id', '')::uuid;
    v_wardrobe_id := nullif(v_slot->>'wardrobe_item_id', '')::uuid;

    if (v_product_id is null) = (v_wardrobe_id is null) then
      raise exception 'Each slot requires exactly one of product_id or wardrobe_item_id';
    end if;

    if v_source = 'owned' and v_wardrobe_id is null then
      raise exception 'Owned slots require wardrobe_item_id';
    end if;

    if v_product_id is not null then
      if not exists (
        select 1 from public.products p
        where p.id = v_product_id
          and p.retailer_id = v_enrollment.retailer_id
          and p.deleted_at is null
      ) then
        raise exception 'Product not in retailer catalogue';
      end if;
    end if;

    if v_wardrobe_id is not null then
      if not exists (
        select 1 from public.wardrobe_items w
        where w.id = v_wardrobe_id
          and w.customer_id = v_enrollment.customer_id
          and w.retailer_id = v_enrollment.retailer_id
          and w.deleted_at is null
      ) then
        raise exception 'Wardrobe item not owned by customer';
      end if;
    end if;

    insert into public.campaign_challenge_look_slots (
      look_id,
      retailer_id,
      slot_kind,
      product_id,
      wardrobe_item_id,
      source_kind,
      display_order
    ) values (
      v_look_id,
      v_enrollment.retailer_id,
      v_slot->>'slot_kind',
      v_product_id,
      v_wardrobe_id,
      v_source,
      v_order
    );
    v_order := v_order + 1;
  end loop;

  return v_look_id;
end;
$$;

revoke all on function public.upsert_campaign_challenge_look(
  uuid, integer, text, jsonb, text, jsonb
) from public;
grant execute on function public.upsert_campaign_challenge_look(
  uuid, integer, text, jsonb, text, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: complete_campaign_challenge (wardrobe OR product slots)
-- ---------------------------------------------------------------------------

create or replace function public.complete_campaign_challenge(
  p_enrollment_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.campaign_challenge_enrollments%rowtype;
  v_customer public.customers%rowtype;
  v_campaign public.campaigns%rowtype;
  v_existing public.campaign_completions%rowtype;
  v_day integer;
  v_look public.campaign_challenge_looks%rowtype;
  v_required text[] := array['jacket', 'trousers', 'shirt', 'shoes'];
  v_slot text;
  v_grant_id uuid;
  v_completion_id uuid;
  v_label text;
  v_expires_at timestamptz;
  v_grant_count integer;
begin
  select * into v_enrollment
  from public.campaign_challenge_enrollments
  where id = p_enrollment_id
  for update;
  if not found then
    raise exception 'Enrollment not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_enrollment.customer_id
    and deleted_at is null;
  if not found or v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to complete campaign challenge';
  end if;

  select * into v_existing
  from public.campaign_completions
  where enrollment_id = p_enrollment_id;
  if found then
    return v_existing.id;
  end if;

  if v_enrollment.status = 'withdrawn' then
    raise exception 'Enrollment was withdrawn';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = v_enrollment.campaign_id;
  if not found or v_campaign.kind <> 'wardrobe_challenge' then
    raise exception 'Wardrobe challenge not found';
  end if;

  for v_day in 1..7 loop
    select * into v_look
    from public.campaign_challenge_looks
    where enrollment_id = p_enrollment_id
      and day_index = v_day;
    if not found then
      raise exception 'Challenge incomplete: missing day %', v_day;
    end if;
    foreach v_slot in array v_required loop
      if not exists (
        select 1 from public.campaign_challenge_look_slots s
        where s.look_id = v_look.id
          and s.slot_kind = v_slot
          and (
            s.product_id is not null
            or s.wardrobe_item_id is not null
          )
      ) then
        raise exception
          'Challenge incomplete: day % missing %', v_day, v_slot;
      end if;
    end loop;
  end loop;

  select count(*)::integer into v_grant_count
  from public.campaign_reward_grants
  where customer_id = v_enrollment.customer_id
    and campaign_id = v_enrollment.campaign_id;

  if v_campaign.reward_kind is not null
    and v_grant_count < v_campaign.reward_cap_per_customer
  then
    v_label := coalesce(
      nullif(btrim(v_campaign.reward_label), ''),
      case v_campaign.reward_kind
        when 'personalized_tie' then 'A personalised tie'
        when 'personalized_shirt' then 'A personalised shirt'
        else 'A short-lived member offer'
      end
    );
    if v_campaign.reward_kind = 'short_lived_offer' then
      v_expires_at := now() + (
        coalesce(v_campaign.short_lived_offer_hours, 72) || ' hours'
      )::interval;
    end if;

    insert into public.campaign_reward_grants (
      campaign_id,
      retailer_id,
      customer_id,
      enrollment_id,
      reward_kind,
      label,
      expires_at
    ) values (
      v_enrollment.campaign_id,
      v_enrollment.retailer_id,
      v_enrollment.customer_id,
      p_enrollment_id,
      v_campaign.reward_kind,
      v_label,
      v_expires_at
    )
    returning id into v_grant_id;
  end if;

  insert into public.campaign_completions (
    enrollment_id,
    campaign_id,
    retailer_id,
    customer_id,
    reward_grant_id,
    completed_at
  ) values (
    p_enrollment_id,
    v_enrollment.campaign_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    v_grant_id,
    now()
  )
  returning id into v_completion_id;

  update public.campaign_challenge_enrollments
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_enrollment_id;

  return v_completion_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: sync_order_honeymoon_milestones (idempotent replace)
-- ---------------------------------------------------------------------------

create or replace function public.sync_order_honeymoon_milestones(
  p_order_id uuid,
  p_milestones jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_enrollment_id uuid;
  v_milestone jsonb;
  v_order_idx integer := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_order.customer_id
    and deleted_at is null;
  if not found or v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to sync honeymoon milestones';
  end if;

  insert into public.order_honeymoon_enrollments (
    order_id,
    retailer_id,
    customer_id,
    status
  ) values (
    p_order_id,
    v_order.retailer_id,
    v_order.customer_id,
    'active'
  )
  on conflict (order_id) do update set
    updated_at = now()
  returning id into v_enrollment_id;

  delete from public.order_honeymoon_milestones
  where enrollment_id = v_enrollment_id
    and status not in ('completed', 'dismissed');

  for v_milestone in select * from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb))
  loop
    insert into public.order_honeymoon_milestones (
      enrollment_id,
      retailer_id,
      kind,
      status,
      title,
      explanation,
      action_kind,
      action_href,
      due_at,
      stock_truth,
      lead_time_truth,
      suppress_reason,
      display_order
    ) values (
      v_enrollment_id,
      v_order.retailer_id,
      v_milestone->>'kind',
      coalesce(v_milestone->>'status', 'pending'),
      v_milestone->>'title',
      v_milestone->>'explanation',
      v_milestone->>'action_kind',
      nullif(v_milestone->>'action_href', ''),
      nullif(v_milestone->>'due_at', '')::timestamptz,
      nullif(v_milestone->>'stock_truth', ''),
      nullif(v_milestone->>'lead_time_truth', ''),
      nullif(v_milestone->>'suppress_reason', ''),
      coalesce((v_milestone->>'display_order')::integer, v_order_idx)
    )
    on conflict (enrollment_id, title) do update set
      kind = excluded.kind,
      status = excluded.status,
      explanation = excluded.explanation,
      action_kind = excluded.action_kind,
      action_href = excluded.action_href,
      due_at = excluded.due_at,
      stock_truth = excluded.stock_truth,
      lead_time_truth = excluded.lead_time_truth,
      suppress_reason = excluded.suppress_reason,
      display_order = excluded.display_order,
      updated_at = now()
    where order_honeymoon_milestones.status not in ('completed', 'dismissed');

    v_order_idx := v_order_idx + 1;
  end loop;

  return v_enrollment_id;
end;
$$;

create or replace function public.complete_honeymoon_milestone(
  p_milestone_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_milestone public.order_honeymoon_milestones%rowtype;
  v_customer public.customers%rowtype;
begin
  select m.* into v_milestone
  from public.order_honeymoon_milestones m
  join public.order_honeymoon_enrollments e on e.id = m.enrollment_id
  where m.id = p_milestone_id;

  if not found then
    raise exception 'Milestone not found';
  end if;

  select * into v_customer
  from public.customers c
  join public.order_honeymoon_enrollments e on e.customer_id = c.id
  where e.id = v_milestone.enrollment_id
    and c.deleted_at is null;
  if not found or v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.order_honeymoon_milestones
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = p_milestone_id;
end;
$$;

revoke all on function public.sync_order_honeymoon_milestones(uuid, jsonb) from public;
grant execute on function public.sync_order_honeymoon_milestones(uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.complete_honeymoon_milestone(uuid) from public;
grant execute on function public.complete_honeymoon_milestone(uuid)
  to authenticated, service_role;
