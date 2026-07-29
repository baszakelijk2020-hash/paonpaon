-- PAON Intelligence Platform Stage 5.1.
-- Private offers and seven-day wardrobe campaigns (CAMP-001, CAMP-002,
-- MR-003, MILE-002; ADR-061). Audiences require personalization consent;
-- marketing consent is never reused for campaign eligibility.

-- ---------------------------------------------------------------------------
-- retailer_campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.retailer_campaigns (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in ('private_offer', 'seven_day_wardrobe')
  ),
  title text not null,
  description text,
  active boolean not null default true,
  paused boolean not null default false,
  schedule_frequency text not null default 'weekly' check (
    schedule_frequency in ('daily', 'weekly')
  ),
  timezone text not null default 'UTC',
  starts_at timestamptz,
  ends_at timestamptz,
  reward_kind text check (
    reward_kind is null
    or reward_kind in ('tie', 'shirt', 'short_lived_offer')
  ),
  reward_cap_per_customer integer not null default 1 check (
    reward_cap_per_customer between 1 and 3
  ),
  reward_expires_days integer check (
    reward_expires_days is null
    or (reward_expires_days >= 1 and reward_expires_days <= 30)
  ),
  requires_personalization_consent boolean not null default true,
  minimum_loyalty_tier text check (
    minimum_loyalty_tier is null
    or minimum_loyalty_tier in ('member', 'silver', 'gold', 'platinum')
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_campaigns_seven_day_reward_chk check (
    kind <> 'seven_day_wardrobe' or reward_kind is not null
  ),
  constraint retailer_campaigns_short_lived_expiry_chk check (
    reward_kind is distinct from 'short_lived_offer'
    or reward_expires_days is not null
  )
);

create trigger set_retailer_campaigns_updated_at
  before update on public.retailer_campaigns
  for each row execute function public.set_updated_at();

create index if not exists retailer_campaigns_retailer_active_idx
  on public.retailer_campaigns (retailer_id, active, kind);

comment on table public.retailer_campaigns is
  'Consent-aware private offers and seven-day wardrobe campaigns (PHASE 5.1).';

alter table public.retailer_campaigns enable row level security;
revoke all on table public.retailer_campaigns from anon;

create policy "retailer staff manage tenant campaigns"
  on public.retailer_campaigns for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff read tenant campaigns"
  on public.retailer_campaigns for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read active campaigns for their retailer"
  on public.retailer_campaigns for select to authenticated
  using (
    active = true
    and paused = false
    and exists (
      select 1 from public.customers c
      where c.retailer_id = retailer_campaigns.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read retailer campaigns"
  on public.retailer_campaigns for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.retailer_campaigns to authenticated, service_role;
grant insert, update, delete on table public.retailer_campaigns to authenticated;
grant all on table public.retailer_campaigns to service_role;

-- ---------------------------------------------------------------------------
-- retailer_campaign_targets
-- ---------------------------------------------------------------------------

create table if not exists public.retailer_campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.retailer_campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  target_type text not null check (
    target_type in (
      'fabric_concept',
      'category_concept',
      'product',
      'collection'
    )
  ),
  target_id uuid not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint retailer_campaign_targets_unique
    unique (campaign_id, target_type, target_id)
);

create index if not exists retailer_campaign_targets_campaign_idx
  on public.retailer_campaign_targets (campaign_id);

alter table public.retailer_campaign_targets enable row level security;
revoke all on table public.retailer_campaign_targets from anon;

create policy "retailer staff manage campaign targets"
  on public.retailer_campaign_targets for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  );

create policy "customers read campaign targets for their retailer"
  on public.retailer_campaign_targets for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.retailer_id = retailer_campaign_targets.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read campaign targets"
  on public.retailer_campaign_targets for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.retailer_campaign_targets to authenticated, service_role;
grant insert, update, delete on table public.retailer_campaign_targets to authenticated;
grant all on table public.retailer_campaign_targets to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_challenge_enrollments
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  campaign_id uuid not null references public.retailer_campaigns (id) on delete cascade,
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'expired')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_challenge_enrollments_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_challenge_enrollments_customer_campaign_unique
    unique (customer_id, campaign_id)
);

create trigger set_wardrobe_challenge_enrollments_updated_at
  before update on public.wardrobe_challenge_enrollments
  for each row execute function public.set_updated_at();

alter table public.wardrobe_challenge_enrollments enable row level security;
revoke all on table public.wardrobe_challenge_enrollments from anon;

create policy "customers read own wardrobe challenge enrollments"
  on public.wardrobe_challenge_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_challenge_enrollments.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe challenge enrollments"
  on public.wardrobe_challenge_enrollments for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe challenge enrollments"
  on public.wardrobe_challenge_enrollments for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_challenge_enrollments
  to authenticated, service_role;
grant all on table public.wardrobe_challenge_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- wardrobe_challenge_day_looks
-- ---------------------------------------------------------------------------

create table if not exists public.wardrobe_challenge_day_looks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.wardrobe_challenge_enrollments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  day_index integer not null check (day_index between 1 and 7),
  jacket_product_id uuid references public.products (id) on delete set null,
  trousers_product_id uuid references public.products (id) on delete set null,
  shirt_product_id uuid references public.products (id) on delete set null,
  shoes_product_id uuid references public.products (id) on delete set null,
  accessories_product_id uuid references public.products (id) on delete set null,
  pocket_square_product_id uuid references public.products (id) on delete set null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobe_challenge_day_looks_enrollment_day_unique
    unique (enrollment_id, day_index),
  constraint wardrobe_challenge_day_looks_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create trigger set_wardrobe_challenge_day_looks_updated_at
  before update on public.wardrobe_challenge_day_looks
  for each row execute function public.set_updated_at();

alter table public.wardrobe_challenge_day_looks enable row level security;
revoke all on table public.wardrobe_challenge_day_looks from anon;

create policy "customers read own wardrobe challenge day looks"
  on public.wardrobe_challenge_day_looks for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_challenge_day_looks.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant wardrobe challenge day looks"
  on public.wardrobe_challenge_day_looks for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read wardrobe challenge day looks"
  on public.wardrobe_challenge_day_looks for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.wardrobe_challenge_day_looks
  to authenticated, service_role;
grant all on table public.wardrobe_challenge_day_looks to service_role;

-- ---------------------------------------------------------------------------
-- campaign_reward_grants
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_reward_grants (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  campaign_id uuid not null references public.retailer_campaigns (id) on delete cascade,
  enrollment_id uuid references public.wardrobe_challenge_enrollments (id) on delete set null,
  reward_kind text not null check (
    reward_kind in ('tie', 'shirt', 'short_lived_offer')
  ),
  status text not null default 'issued' check (
    status in ('issued', 'redeemed', 'expired', 'cancelled')
  ),
  code text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint campaign_reward_grants_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint campaign_reward_grants_customer_campaign_unique
    unique (customer_id, campaign_id)
);

alter table public.campaign_reward_grants enable row level security;
revoke all on table public.campaign_reward_grants from anon;

create policy "customers read own campaign reward grants"
  on public.campaign_reward_grants for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = campaign_reward_grants.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant campaign reward grants"
  on public.campaign_reward_grants for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read campaign reward grants"
  on public.campaign_reward_grants for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_reward_grants to authenticated, service_role;
grant all on table public.campaign_reward_grants to service_role;

-- ---------------------------------------------------------------------------
-- campaign_delivery_audits — append-only
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_delivery_audits (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  campaign_id uuid not null references public.retailer_campaigns (id) on delete cascade,
  for_date date not null,
  outcome text not null check (
    outcome in (
      'delivered',
      'suppressed',
      'skipped_not_in_audience',
      'skipped_withdrawn_consent',
      'skipped_schedule',
      'skipped_duplicate',
      'skipped_campaign_inactive',
      'skipped_retailer_paused',
      'failed'
    )
  ),
  suppression_reason text check (
    suppression_reason is null
    or suppression_reason in (
      'personalization_withdrawn',
      'not_in_audience',
      'product_not_targeted',
      'duplicate_for_date',
      'campaign_inactive',
      'retailer_paused',
      'unrelated_promotion_blocked',
      'manual'
    )
  ),
  notification_id uuid references public.notifications (id) on delete set null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  constraint campaign_delivery_audits_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create unique index if not exists campaign_delivery_audits_success_day_uidx
  on public.campaign_delivery_audits (customer_id, campaign_id, for_date)
  where outcome = 'delivered';

create index if not exists campaign_delivery_audits_customer_day_idx
  on public.campaign_delivery_audits (customer_id, for_date desc);

comment on table public.campaign_delivery_audits is
  'Append-only private-offer delivery/suppression audit (PHASE 5.1).';

alter table public.campaign_delivery_audits enable row level security;
revoke all on table public.campaign_delivery_audits from anon;

create policy "customers read own campaign delivery audits"
  on public.campaign_delivery_audits for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = campaign_delivery_audits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant campaign delivery audits"
  on public.campaign_delivery_audits for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read campaign delivery audits"
  on public.campaign_delivery_audits for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_delivery_audits
  to authenticated, service_role;
grant all on table public.campaign_delivery_audits to service_role;

-- ---------------------------------------------------------------------------
-- RPC: upsert_retailer_campaign (manager+)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_retailer_campaign(
  p_retailer_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_active boolean default true,
  p_paused boolean default false,
  p_schedule_frequency text default 'weekly',
  p_timezone text default 'UTC',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_reward_kind text default null,
  p_reward_cap_per_customer integer default 1,
  p_reward_expires_days integer default null,
  p_requires_personalization_consent boolean default true,
  p_minimum_loyalty_tier text default null,
  p_campaign_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_staff uuid;
begin
  if p_retailer_id is distinct from (select public.current_retailer_id()) then
    raise exception 'Not authorized to manage campaigns for this retailer';
  end if;
  if (select public.current_retailer_role()) not in (
    'manager', 'admin', 'owner'
  ) then
    raise exception 'Not authorized to manage campaigns';
  end if;

  select id into v_staff
  from public.retailer_staff_members
  where retailer_id = p_retailer_id
    and user_id = (select auth.uid())
    and deleted_at is null
  limit 1;

  if p_campaign_id is null then
    insert into public.retailer_campaigns (
      retailer_id,
      kind,
      title,
      description,
      active,
      paused,
      schedule_frequency,
      timezone,
      starts_at,
      ends_at,
      reward_kind,
      reward_cap_per_customer,
      reward_expires_days,
      requires_personalization_consent,
      minimum_loyalty_tier,
      created_by_staff_id
    ) values (
      p_retailer_id,
      p_kind,
      p_title,
      p_description,
      p_active,
      p_paused,
      p_schedule_frequency,
      p_timezone,
      p_starts_at,
      p_ends_at,
      p_reward_kind,
      p_reward_cap_per_customer,
      p_reward_expires_days,
      p_requires_personalization_consent,
      p_minimum_loyalty_tier,
      v_staff
    )
    returning id into v_id;
  else
    update public.retailer_campaigns
    set
      kind = p_kind,
      title = p_title,
      description = p_description,
      active = p_active,
      paused = p_paused,
      schedule_frequency = p_schedule_frequency,
      timezone = p_timezone,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      reward_kind = p_reward_kind,
      reward_cap_per_customer = p_reward_cap_per_customer,
      reward_expires_days = p_reward_expires_days,
      requires_personalization_consent = p_requires_personalization_consent,
      minimum_loyalty_tier = p_minimum_loyalty_tier,
      updated_at = now()
    where id = p_campaign_id
      and retailer_id = p_retailer_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Campaign not found for retailer';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.upsert_retailer_campaign(
  uuid, text, text, text, boolean, boolean, text, text, timestamptz, timestamptz,
  text, integer, integer, boolean, text, uuid
) from public;
grant execute on function public.upsert_retailer_campaign(
  uuid, text, text, text, boolean, boolean, text, text, timestamptz, timestamptz,
  text, integer, integer, boolean, text, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: set_campaign_target (manager+)
-- ---------------------------------------------------------------------------

create or replace function public.set_campaign_target(
  p_retailer_id uuid,
  p_campaign_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_label text,
  p_remove boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_retailer_id is distinct from (select public.current_retailer_id()) then
    raise exception 'Not authorized to manage campaign targets';
  end if;
  if (select public.current_retailer_role()) not in (
    'manager', 'admin', 'owner'
  ) then
    raise exception 'Not authorized to manage campaign targets';
  end if;

  if p_remove then
    delete from public.retailer_campaign_targets
    where campaign_id = p_campaign_id
      and retailer_id = p_retailer_id
      and target_type = p_target_type
      and target_id = p_target_id;
    return null;
  end if;

  insert into public.retailer_campaign_targets (
    campaign_id,
    retailer_id,
    target_type,
    target_id,
    label
  ) values (
    p_campaign_id,
    p_retailer_id,
    p_target_type,
    p_target_id,
    p_label
  )
  on conflict (campaign_id, target_type, target_id) do update set
    label = excluded.label
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_campaign_target(
  uuid, uuid, text, uuid, text, boolean
) from public;
grant execute on function public.set_campaign_target(
  uuid, uuid, text, uuid, text, boolean
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: start_wardrobe_challenge (customer)
-- ---------------------------------------------------------------------------

create or replace function public.start_wardrobe_challenge(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_campaign_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_campaign public.retailer_campaigns%rowtype;
  v_id uuid;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found for retailer';
  end if;
  if v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to start wardrobe challenge';
  end if;

  select * into v_campaign
  from public.retailer_campaigns
  where id = p_campaign_id
    and retailer_id = p_retailer_id
    and kind = 'seven_day_wardrobe'
    and active = true
    and paused = false;
  if not found then
    raise exception 'Wardrobe challenge campaign not available';
  end if;

  insert into public.wardrobe_challenge_enrollments (
    retailer_id,
    customer_id,
    campaign_id,
    status
  ) values (
    p_retailer_id,
    p_customer_id,
    p_campaign_id,
    'in_progress'
  )
  on conflict (customer_id, campaign_id) do update set
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.start_wardrobe_challenge(uuid, uuid, uuid)
  from public;
grant execute on function public.start_wardrobe_challenge(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: save_wardrobe_challenge_day_look (customer)
-- ---------------------------------------------------------------------------

create or replace function public.save_wardrobe_challenge_day_look(
  p_enrollment_id uuid,
  p_day_index integer,
  p_jacket_product_id uuid default null,
  p_trousers_product_id uuid default null,
  p_shirt_product_id uuid default null,
  p_shoes_product_id uuid default null,
  p_accessories_product_id uuid default null,
  p_pocket_square_product_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.wardrobe_challenge_enrollments%rowtype;
  v_id uuid;
begin
  select * into v_enrollment
  from public.wardrobe_challenge_enrollments
  where id = p_enrollment_id;
  if not found then
    raise exception 'Enrollment not found';
  end if;
  if v_enrollment.status <> 'in_progress' then
    raise exception 'Challenge is not in progress';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_enrollment.customer_id
      and c.user_id = (select auth.uid())
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized to save wardrobe challenge day look';
  end if;

  insert into public.wardrobe_challenge_day_looks (
    enrollment_id,
    retailer_id,
    customer_id,
    day_index,
    jacket_product_id,
    trousers_product_id,
    shirt_product_id,
    shoes_product_id,
    accessories_product_id,
    pocket_square_product_id,
    saved_at
  ) values (
    p_enrollment_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    p_day_index,
    p_jacket_product_id,
    p_trousers_product_id,
    p_shirt_product_id,
    p_shoes_product_id,
    p_accessories_product_id,
    p_pocket_square_product_id,
    now()
  )
  on conflict (enrollment_id, day_index) do update set
    jacket_product_id = excluded.jacket_product_id,
    trousers_product_id = excluded.trousers_product_id,
    shirt_product_id = excluded.shirt_product_id,
    shoes_product_id = excluded.shoes_product_id,
    accessories_product_id = excluded.accessories_product_id,
    pocket_square_product_id = excluded.pocket_square_product_id,
    saved_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_wardrobe_challenge_day_look(
  uuid, integer, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.save_wardrobe_challenge_day_look(
  uuid, integer, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: complete_wardrobe_challenge (customer, idempotent reward)
-- ---------------------------------------------------------------------------

create or replace function public.complete_wardrobe_challenge(
  p_enrollment_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.wardrobe_challenge_enrollments%rowtype;
  v_campaign public.retailer_campaigns%rowtype;
  v_day_count integer;
  v_complete_days integer;
  v_grant_id uuid;
  v_code text;
  v_expires timestamptz;
begin
  select * into v_enrollment
  from public.wardrobe_challenge_enrollments
  where id = p_enrollment_id;
  if not found then
    raise exception 'Enrollment not found';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_enrollment.customer_id
      and c.user_id = (select auth.uid())
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized to complete wardrobe challenge';
  end if;

  select * into v_campaign
  from public.retailer_campaigns
  where id = v_enrollment.campaign_id;

  select count(*) into v_day_count
  from public.wardrobe_challenge_day_looks
  where enrollment_id = p_enrollment_id;

  select count(*) into v_complete_days
  from public.wardrobe_challenge_day_looks
  where enrollment_id = p_enrollment_id
    and jacket_product_id is not null
    and trousers_product_id is not null
    and shirt_product_id is not null
    and shoes_product_id is not null;

  if v_day_count < 7 or v_complete_days < 7 then
    raise exception 'All seven complete catalogue looks are required';
  end if;

  select id into v_grant_id
  from public.campaign_reward_grants
  where customer_id = v_enrollment.customer_id
    and campaign_id = v_enrollment.campaign_id;

  if v_grant_id is not null then
    update public.wardrobe_challenge_enrollments
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = p_enrollment_id;
    return v_grant_id;
  end if;

  if v_campaign.reward_kind is null then
    raise exception 'Campaign has no configured reward';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  if v_campaign.reward_kind = 'short_lived_offer'
    and v_campaign.reward_expires_days is not null then
    v_expires := now() + make_interval(days => v_campaign.reward_expires_days);
  end if;

  insert into public.campaign_reward_grants (
    retailer_id,
    customer_id,
    campaign_id,
    enrollment_id,
    reward_kind,
    status,
    code,
    expires_at
  ) values (
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    v_enrollment.campaign_id,
    p_enrollment_id,
    v_campaign.reward_kind,
    'issued',
    v_code,
    v_expires
  )
  returning id into v_grant_id;

  update public.wardrobe_challenge_enrollments
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_enrollment_id;

  return v_grant_id;
end;
$$;

revoke all on function public.complete_wardrobe_challenge(uuid) from public;
grant execute on function public.complete_wardrobe_challenge(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_campaign_delivery_audit (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.record_campaign_delivery_audit(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_campaign_id uuid,
  p_for_date date,
  p_outcome text,
  p_scheduled_for timestamptz,
  p_suppression_reason text default null,
  p_notification_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.campaign_delivery_audits (
    retailer_id,
    customer_id,
    campaign_id,
    for_date,
    outcome,
    suppression_reason,
    notification_id,
    scheduled_for
  ) values (
    p_retailer_id,
    p_customer_id,
    p_campaign_id,
    p_for_date,
    p_outcome,
    p_suppression_reason,
    p_notification_id,
    p_scheduled_for
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_campaign_delivery_audit(
  uuid, uuid, uuid, date, text, timestamptz, text, uuid
) from public;
grant execute on function public.record_campaign_delivery_audit(
  uuid, uuid, uuid, date, text, timestamptz, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: enqueue_campaign_offer_notification (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_campaign_offer_notification(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_campaign_id uuid,
  p_title text,
  p_body text,
  p_action_href text default '/private-offers'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_notification_id uuid;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found for retailer';
  end if;

  insert into public.notifications (
    retailer_id,
    recipient_user_id,
    customer_id,
    channel,
    category,
    title,
    body,
    action_href
  ) values (
    p_retailer_id,
    v_customer.user_id,
    p_customer_id,
    'in_app'::public.notification_channel,
    'system',
    btrim(p_title),
    btrim(p_body),
    p_action_href
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.enqueue_campaign_offer_notification(
  uuid, uuid, uuid, text, text, text
) from public;
grant execute on function public.enqueue_campaign_offer_notification(
  uuid, uuid, uuid, text, text, text
) to service_role;
