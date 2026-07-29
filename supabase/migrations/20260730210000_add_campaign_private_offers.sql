-- PAON Intelligence Platform Stage 5.1.
-- Private offers and seven-day wardrobe campaigns (CAMP-001, CAMP-002,
-- MR-003, MILE-002; ADR-061). Audiences are consent-aware and explainable;
-- marketing consent is never inferred as personalization targeting.
-- Completion rewards are deterministic, capped, and auditable.

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (kind in ('private_offer', 'wardrobe_challenge')),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'ended')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  explanation text not null check (
    char_length(btrim(explanation)) between 1 and 500
  ),
  frequency text not null default 'weekly' check (
    frequency in ('daily', 'weekdays', 'weekly')
  ),
  timezone text not null default 'UTC',
  preferred_local_hour integer not null default 9 check (
    preferred_local_hour >= 0 and preferred_local_hour <= 23
  ),
  quiet_start_minute integer check (
    quiet_start_minute is null
    or (quiet_start_minute >= 0 and quiet_start_minute <= 1439)
  ),
  quiet_end_minute integer check (
    quiet_end_minute is null
    or (quiet_end_minute >= 0 and quiet_end_minute <= 1439)
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  reward_kind text check (
    reward_kind is null
    or reward_kind in (
      'personalized_tie',
      'personalized_shirt',
      'short_lived_offer'
    )
  ),
  reward_label text check (
    reward_label is null
    or char_length(btrim(reward_label)) between 1 and 120
  ),
  reward_cap_per_customer integer not null default 1 check (
    reward_cap_per_customer between 1 and 3
  ),
  short_lived_offer_hours integer not null default 72 check (
    short_lived_offer_hours between 1 and 168
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_quiet_pair_chk check (
    (
      quiet_start_minute is null
      and quiet_end_minute is null
    )
    or (
      quiet_start_minute is not null
      and quiet_end_minute is not null
    )
  ),
  constraint campaigns_window_chk check (
    starts_at is null
    or ends_at is null
    or ends_at > starts_at
  ),
  constraint campaigns_challenge_reward_chk check (
    kind <> 'wardrobe_challenge'
    or reward_kind is not null
  ),
  constraint campaigns_id_retailer_uidx unique (id, retailer_id)
);

create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create index if not exists campaigns_retailer_status_idx
  on public.campaigns (retailer_id, status, kind);

comment on table public.campaigns is
  'Retailer private offers and seven-day wardrobe challenges (PHASE 5.1).';

alter table public.campaigns enable row level security;
revoke all on table public.campaigns from anon;

create policy "retailer staff read tenant campaigns"
  on public.campaigns for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer managers write tenant campaigns"
  on public.campaigns for all to authenticated
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

create policy "customers read active tenant campaigns"
  on public.campaigns for select to authenticated
  using (
    status = 'active'
    and exists (
      select 1 from public.customers c
      where c.retailer_id = campaigns.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read campaigns"
  on public.campaigns for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaigns to authenticated, service_role;
grant insert, update, delete on table public.campaigns to authenticated;
grant all on table public.campaigns to service_role;

-- ---------------------------------------------------------------------------
-- campaign_audience_rules
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_audience_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  rule_kind text not null check (
    rule_kind in (
      'personalization_consent',
      'fabric_concept',
      'category_concept',
      'product',
      'loyalty_tier',
      'style_preference'
    )
  ),
  concept_id uuid references public.metadata_concepts (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  loyalty_tier text check (
    loyalty_tier is null
    or loyalty_tier in ('member', 'silver', 'gold', 'platinum')
  ),
  require_personalization_consent boolean not null default true,
  explanation text not null check (
    char_length(btrim(explanation)) between 1 and 300
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_audience_rules_campaign_retailer_fk
    foreign key (campaign_id, retailer_id)
    references public.campaigns (id, retailer_id)
    deferrable initially immediate,
  constraint campaign_audience_rules_concept_chk check (
    rule_kind not in ('fabric_concept', 'category_concept', 'style_preference')
    or concept_id is not null
  ),
  constraint campaign_audience_rules_product_chk check (
    rule_kind <> 'product' or product_id is not null
  ),
  constraint campaign_audience_rules_tier_chk check (
    rule_kind <> 'loyalty_tier' or loyalty_tier is not null
  )
);

create trigger set_campaign_audience_rules_updated_at
  before update on public.campaign_audience_rules
  for each row execute function public.set_updated_at();

create index if not exists campaign_audience_rules_campaign_idx
  on public.campaign_audience_rules (campaign_id) where active;

comment on table public.campaign_audience_rules is
  'Explainable consent-aware audience predicates for campaigns (PHASE 5.1).';

alter table public.campaign_audience_rules enable row level security;
revoke all on table public.campaign_audience_rules from anon;

create policy "retailer staff read tenant campaign audience rules"
  on public.campaign_audience_rules for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer managers write campaign audience rules"
  on public.campaign_audience_rules for all to authenticated
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

create policy "customers read active campaign audience rules"
  on public.campaign_audience_rules for select to authenticated
  using (
    active
    and exists (
      select 1
      from public.campaigns camp
      join public.customers c
        on c.retailer_id = camp.retailer_id
      where camp.id = campaign_audience_rules.campaign_id
        and camp.status = 'active'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read campaign audience rules"
  on public.campaign_audience_rules for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_audience_rules
  to authenticated, service_role;
grant insert, update, delete on table public.campaign_audience_rules
  to authenticated;
grant all on table public.campaign_audience_rules to service_role;

-- ---------------------------------------------------------------------------
-- campaign_target_products
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_target_products (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, product_id),
  constraint campaign_target_products_campaign_retailer_fk
    foreign key (campaign_id, retailer_id)
    references public.campaigns (id, retailer_id)
    deferrable initially immediate
);

create trigger set_campaign_target_products_updated_at
  before update on public.campaign_target_products
  for each row execute function public.set_updated_at();

comment on table public.campaign_target_products is
  'Retailer product targeting for private offers / challenges (PHASE 5.1).';

alter table public.campaign_target_products enable row level security;
revoke all on table public.campaign_target_products from anon;

create policy "retailer staff manage campaign target products"
  on public.campaign_target_products for all to authenticated
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

create policy "retailer staff read campaign target products"
  on public.campaign_target_products for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read active campaign target products"
  on public.campaign_target_products for select to authenticated
  using (
    active
    and exists (
      select 1
      from public.campaigns camp
      join public.customers c
        on c.retailer_id = camp.retailer_id
      where camp.id = campaign_target_products.campaign_id
        and camp.status = 'active'
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read campaign target products"
  on public.campaign_target_products for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_target_products
  to authenticated, service_role;
grant insert, update, delete on table public.campaign_target_products
  to authenticated;
grant all on table public.campaign_target_products to service_role;

-- ---------------------------------------------------------------------------
-- campaign_challenge_enrollments
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'withdrawn')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_challenge_enrollments_campaign_retailer_fk
    foreign key (campaign_id, retailer_id)
    references public.campaigns (id, retailer_id)
    deferrable initially immediate,
  constraint campaign_challenge_enrollments_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint campaign_challenge_enrollments_unique
    unique (campaign_id, customer_id)
);

create trigger set_campaign_challenge_enrollments_updated_at
  before update on public.campaign_challenge_enrollments
  for each row execute function public.set_updated_at();

create index if not exists campaign_challenge_enrollments_customer_idx
  on public.campaign_challenge_enrollments (customer_id, status);

comment on table public.campaign_challenge_enrollments is
  'Authenticated customer enrollment in seven-day wardrobe challenges (PHASE 5.1).';

alter table public.campaign_challenge_enrollments enable row level security;
revoke all on table public.campaign_challenge_enrollments from anon;

create policy "customers read own campaign enrollments"
  on public.campaign_challenge_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = campaign_challenge_enrollments.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant campaign enrollments"
  on public.campaign_challenge_enrollments for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read campaign enrollments"
  on public.campaign_challenge_enrollments for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_challenge_enrollments
  to authenticated, service_role;
grant all on table public.campaign_challenge_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- campaign_challenge_looks + slots
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_challenge_looks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.campaign_challenge_enrollments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  day_index integer not null check (day_index between 1 and 7),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_challenge_looks_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint campaign_challenge_looks_day_uidx unique (enrollment_id, day_index)
);

create trigger set_campaign_challenge_looks_updated_at
  before update on public.campaign_challenge_looks
  for each row execute function public.set_updated_at();

create table if not exists public.campaign_challenge_look_slots (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null
    references public.campaign_challenge_looks (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  slot_kind text not null check (
    slot_kind in (
      'jacket',
      'trousers',
      'shirt',
      'shoes',
      'accessories',
      'pocket_square'
    )
  ),
  product_id uuid not null references public.products (id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint campaign_challenge_look_slots_look_slot_uidx
    unique (look_id, slot_kind)
);

comment on table public.campaign_challenge_looks is
  'Seven catalogue looks for a wardrobe challenge enrollment (PHASE 5.1).';

alter table public.campaign_challenge_looks enable row level security;
alter table public.campaign_challenge_look_slots enable row level security;
revoke all on table public.campaign_challenge_looks from anon;
revoke all on table public.campaign_challenge_look_slots from anon;

create policy "customers read own challenge looks"
  on public.campaign_challenge_looks for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = campaign_challenge_looks.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant challenge looks"
  on public.campaign_challenge_looks for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read challenge looks"
  on public.campaign_challenge_looks for select to authenticated
  using ((select public.is_platform_staff()));

create policy "customers read own challenge look slots"
  on public.campaign_challenge_look_slots for select to authenticated
  using (
    exists (
      select 1
      from public.campaign_challenge_looks look
      join public.customers c on c.id = look.customer_id
      where look.id = campaign_challenge_look_slots.look_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant challenge look slots"
  on public.campaign_challenge_look_slots for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read challenge look slots"
  on public.campaign_challenge_look_slots for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_challenge_looks
  to authenticated, service_role;
grant select on table public.campaign_challenge_look_slots
  to authenticated, service_role;
grant all on table public.campaign_challenge_looks to service_role;
grant all on table public.campaign_challenge_look_slots to service_role;

-- ---------------------------------------------------------------------------
-- campaign_reward_grants + completions
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_reward_grants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  enrollment_id uuid not null
    references public.campaign_challenge_enrollments (id) on delete cascade,
  reward_kind text not null check (
    reward_kind in (
      'personalized_tie',
      'personalized_shirt',
      'short_lived_offer'
    )
  ),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  expires_at timestamptz,
  loyalty_ledger_entry_id uuid
    references public.loyalty_ledger_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint campaign_reward_grants_enrollment_uidx unique (enrollment_id),
  constraint campaign_reward_grants_customer_campaign_uidx
    unique (customer_id, campaign_id),
  constraint campaign_reward_grants_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create table if not exists public.campaign_completions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.campaign_challenge_enrollments (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  reward_grant_id uuid references public.campaign_reward_grants (id)
    on delete set null,
  completed_at timestamptz not null default now(),
  constraint campaign_completions_enrollment_uidx unique (enrollment_id),
  constraint campaign_completions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

comment on table public.campaign_reward_grants is
  'Deterministic capped campaign rewards — never chance-based (PHASE 5.1).';

alter table public.campaign_reward_grants enable row level security;
alter table public.campaign_completions enable row level security;
revoke all on table public.campaign_reward_grants from anon;
revoke all on table public.campaign_completions from anon;

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

create policy "customers read own campaign completions"
  on public.campaign_completions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = campaign_completions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant campaign completions"
  on public.campaign_completions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read campaign completions"
  on public.campaign_completions for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.campaign_reward_grants
  to authenticated, service_role;
grant select on table public.campaign_completions
  to authenticated, service_role;
grant all on table public.campaign_reward_grants to service_role;
grant all on table public.campaign_completions to service_role;

-- ---------------------------------------------------------------------------
-- campaign_delivery_audits — append-only
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_delivery_audits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  for_date date not null,
  outcome text not null check (
    outcome in (
      'queued_in_app',
      'queued_email',
      'suppressed',
      'skipped_schedule',
      'skipped_audience',
      'skipped_quiet_hours',
      'skipped_duplicate',
      'skipped_campaign_inactive',
      'skipped_consent_withdrawn',
      'failed'
    )
  ),
  suppression_reason text check (
    suppression_reason is null
    or suppression_reason in (
      'no_personalization_consent',
      'audience_mismatch',
      'schedule_outside_window',
      'duplicate_for_date',
      'campaign_paused',
      'campaign_ended',
      'customer_withdrawn',
      'product_not_eligible',
      'manual'
    )
  ),
  explanation text,
  personalization_consent text check (
    personalization_consent is null
    or personalization_consent in ('granted', 'denied', 'withdrawn')
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
  on public.campaign_delivery_audits (campaign_id, customer_id, for_date)
  where outcome in ('queued_in_app', 'queued_email');

create index if not exists campaign_delivery_audits_customer_day_idx
  on public.campaign_delivery_audits (customer_id, for_date desc);

comment on table public.campaign_delivery_audits is
  'Append-only campaign delivery/suppression audit (PHASE 5.1).';

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
-- RPC: enroll_campaign_challenge (customer only)
-- ---------------------------------------------------------------------------

create or replace function public.enroll_campaign_challenge(
  p_campaign_id uuid,
  p_retailer_id uuid,
  p_customer_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_campaign public.campaigns%rowtype;
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
    raise exception 'Not authorized to enroll in campaign challenge';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
    and retailer_id = p_retailer_id
    and kind = 'wardrobe_challenge'
    and status = 'active';
  if not found then
    raise exception 'Active wardrobe challenge not found';
  end if;

  insert into public.campaign_challenge_enrollments (
    campaign_id,
    retailer_id,
    customer_id,
    status
  ) values (
    p_campaign_id,
    p_retailer_id,
    p_customer_id,
    'in_progress'
  )
  on conflict (campaign_id, customer_id) do update set
    status = case
      when campaign_challenge_enrollments.status = 'withdrawn'
        then 'in_progress'
      else campaign_challenge_enrollments.status
    end,
    withdrawn_at = case
      when campaign_challenge_enrollments.status = 'withdrawn'
        then null
      else campaign_challenge_enrollments.withdrawn_at
    end,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enroll_campaign_challenge(uuid, uuid, uuid)
  from public;
grant execute on function public.enroll_campaign_challenge(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: upsert_campaign_challenge_look (customer only)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_campaign_challenge_look(
  p_enrollment_id uuid,
  p_day_index integer,
  p_title text,
  p_slots jsonb
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
begin
  if p_day_index < 1 or p_day_index > 7 then
    raise exception 'day_index must be between 1 and 7';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) < 1 then
    raise exception 'At least one catalogue slot is required';
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
    title
  ) values (
    p_enrollment_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    p_day_index,
    btrim(p_title)
  )
  on conflict (enrollment_id, day_index) do update set
    title = excluded.title,
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
    if coalesce(v_slot->>'product_id', '') = '' then
      raise exception 'Each slot requires a catalogue product_id';
    end if;
    if not exists (
      select 1 from public.products p
      where p.id = (v_slot->>'product_id')::uuid
        and p.retailer_id = v_enrollment.retailer_id
        and p.deleted_at is null
    ) then
      raise exception 'Product not in retailer catalogue';
    end if;

    insert into public.campaign_challenge_look_slots (
      look_id,
      retailer_id,
      slot_kind,
      product_id,
      display_order
    ) values (
      v_look_id,
      v_enrollment.retailer_id,
      v_slot->>'slot_kind',
      (v_slot->>'product_id')::uuid,
      v_order
    );
    v_order := v_order + 1;
  end loop;

  return v_look_id;
end;
$$;

revoke all on function public.upsert_campaign_challenge_look(
  uuid, integer, text, jsonb
) from public;
grant execute on function public.upsert_campaign_challenge_look(
  uuid, integer, text, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: complete_campaign_challenge (customer only, idempotent)
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
          and s.product_id is not null
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
      v_expires_at := now()
        + make_interval(hours => v_campaign.short_lived_offer_hours);
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
    on conflict (enrollment_id) do update set
      label = excluded.label
    returning id into v_grant_id;
  end if;

  insert into public.campaign_completions (
    enrollment_id,
    campaign_id,
    retailer_id,
    customer_id,
    reward_grant_id
  ) values (
    p_enrollment_id,
    v_enrollment.campaign_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    v_grant_id
  )
  on conflict (enrollment_id) do update set
    reward_grant_id = coalesce(
      campaign_completions.reward_grant_id,
      excluded.reward_grant_id
    )
  returning id into v_completion_id;

  update public.campaign_challenge_enrollments
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_enrollment_id;

  return v_completion_id;
end;
$$;

revoke all on function public.complete_campaign_challenge(uuid) from public;
grant execute on function public.complete_campaign_challenge(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_campaign_delivery_audit (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.record_campaign_delivery_audit(
  p_campaign_id uuid,
  p_retailer_id uuid,
  p_customer_id uuid,
  p_for_date date,
  p_outcome text,
  p_scheduled_for timestamptz,
  p_suppression_reason text default null,
  p_explanation text default null,
  p_personalization_consent text default null,
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
    campaign_id,
    retailer_id,
    customer_id,
    for_date,
    outcome,
    suppression_reason,
    explanation,
    personalization_consent,
    notification_id,
    scheduled_for
  ) values (
    p_campaign_id,
    p_retailer_id,
    p_customer_id,
    p_for_date,
    p_outcome,
    p_suppression_reason,
    p_explanation,
    p_personalization_consent,
    p_notification_id,
    p_scheduled_for
  )
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Campaign already delivered for this customer/day';
end;
$$;

revoke all on function public.record_campaign_delivery_audit(
  uuid, uuid, uuid, date, text, timestamptz, text, text, text, uuid
) from public;
grant execute on function public.record_campaign_delivery_audit(
  uuid, uuid, uuid, date, text, timestamptz, text, text, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: enqueue_campaign_delivery_notification (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_campaign_delivery_notification(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_title text,
  p_body text,
  p_action_href text default '/private-offers',
  p_channel text default 'in_app'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_notification_id uuid;
begin
  if p_channel not in ('in_app', 'email') then
    raise exception 'Campaign delivery channel must be in_app or email';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found or v_customer.user_id is null then
    raise exception 'Customer not linked for campaign delivery';
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
    p_channel::public.notification_channel,
    'system',
    btrim(p_title),
    btrim(p_body),
    p_action_href
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.enqueue_campaign_delivery_notification(
  uuid, uuid, text, text, text, text
) from public;
grant execute on function public.enqueue_campaign_delivery_notification(
  uuid, uuid, text, text, text, text
) to service_role;
