-- Commercial plan catalogue and server-enforced entitlements for the PAON
-- Commercialisation and Retailer Demo System. Subscription revenue,
-- implementation work and optional managed services remain distinct concepts.

alter table public.subscription_plans
  add column positioning text not null default '',
  add column description text not null default '',
  add column implementation_fee_amount_minor_units integer not null default 0
    check (implementation_fee_amount_minor_units >= 0),
  add column implementation_fee_currency text not null default 'EUR',
  add column price_is_from boolean not null default false,
  add column is_public boolean not null default true,
  add column display_order integer not null default 0;

create table public.commercial_features (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  category text not null check (
    category in ('foundation', 'commerce', 'engagement', 'operations', 'intelligence', 'service')
  ),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_commercial_features_updated_at
  before update on public.commercial_features
  for each row execute function public.set_updated_at();

create table public.subscription_plan_entitlements (
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  feature_key text not null references public.commercial_features (key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (plan_id, feature_key)
);

create table public.retailer_entitlement_overrides (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  feature_key text not null references public.commercial_features (key) on delete restrict,
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (retailer_id, feature_key)
);

create trigger set_retailer_entitlement_overrides_updated_at
  before update on public.retailer_entitlement_overrides
  for each row execute function public.set_updated_at();

create table public.managed_service_offerings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  price_amount_minor_units integer check (price_amount_minor_units >= 0),
  price_currency text,
  billing_interval text check (
    billing_interval is null or billing_interval in ('one_time', 'monthly', 'quarterly')
  ),
  price_is_from boolean not null default false,
  is_public boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (price_amount_minor_units is null and price_currency is null and billing_interval is null)
    or
    (price_amount_minor_units is not null and price_currency is not null and billing_interval is not null)
  )
);

create trigger set_managed_service_offerings_updated_at
  before update on public.managed_service_offerings
  for each row execute function public.set_updated_at();

alter table public.commercial_features enable row level security;
alter table public.subscription_plan_entitlements enable row level security;
alter table public.retailer_entitlement_overrides enable row level security;
alter table public.managed_service_offerings enable row level security;

create policy "public can read commercial features"
  on public.commercial_features for select using (true);
create policy "platform staff manage commercial features"
  on public.commercial_features for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "public can read public plan entitlements"
  on public.subscription_plan_entitlements for select
  using (
    exists (
      select 1 from public.subscription_plans p
      where p.id = plan_id and p.is_public
    )
  );
create policy "platform staff manage plan entitlements"
  on public.subscription_plan_entitlements for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "platform staff manage retailer entitlement overrides"
  on public.retailer_entitlement_overrides for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer owners read entitlement overrides"
  on public.retailer_entitlement_overrides for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

create policy "public can read public managed services"
  on public.managed_service_offerings for select using (is_public);
create policy "platform staff manage managed services"
  on public.managed_service_offerings for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy "authenticated users can read subscription plans"
  on public.subscription_plans;
create policy "public reads public subscription plans"
  on public.subscription_plans for select using (is_public);
create policy "authenticated users read subscription plans"
  on public.subscription_plans for select to authenticated using (true);

grant select on public.subscription_plans, public.commercial_features,
  public.subscription_plan_entitlements, public.managed_service_offerings
  to anon;
grant select, insert, update, delete on public.commercial_features,
  public.subscription_plan_entitlements, public.retailer_entitlement_overrides,
  public.managed_service_offerings to authenticated, service_role;

insert into public.commercial_features (key, name, category, display_order) values
  ('branded_website', 'Branded website template', 'foundation', 10),
  ('customer_accounts', 'Customer accounts', 'foundation', 20),
  ('crm', 'CRM and client records', 'foundation', 30),
  ('catalogue', 'Product catalogue', 'foundation', 40),
  ('appointments', 'Appointments', 'foundation', 50),
  ('order_tracking', 'Order tracking', 'foundation', 60),
  ('alterations_core', 'Core alteration workflow', 'operations', 70),
  ('analytics_basic', 'Basic analytics', 'intelligence', 80),
  ('ecommerce', 'Ecommerce', 'commerce', 90),
  ('loyalty', 'Loyalty and rewards', 'engagement', 100),
  ('referrals', 'Referrals', 'engagement', 110),
  ('vouchers', 'Vouchers', 'engagement', 120),
  ('events', 'Events', 'engagement', 130),
  ('wedding_planning', 'Wedding planning', 'engagement', 140),
  ('clienteling', 'Clienteling', 'engagement', 150),
  ('messaging', 'Messaging', 'engagement', 160),
  ('alterations_advanced', 'Advanced alteration workflows', 'operations', 170),
  ('analytics_expanded', 'Expanded analytics', 'intelligence', 180),
  ('multi_user', 'Multiple operational users', 'operations', 190),
  ('multi_location', 'Multiple locations', 'operations', 200),
  ('bespoke_implementation', 'Bespoke implementation', 'service', 210),
  ('analytics_advanced', 'Advanced analytics', 'intelligence', 220),
  ('ai_personalisation', 'AI personalisation', 'intelligence', 230),
  ('custom_integrations', 'Custom integrations', 'service', 240),
  ('campaign_support', 'Campaign support', 'service', 250),
  ('lead_generation', 'Lead-generation support', 'service', 260),
  ('management_consulting', 'Management consulting', 'service', 270),
  ('priority_support', 'Priority support', 'service', 280),
  ('quarterly_growth_planning', 'Quarterly growth planning', 'service', 290);

update public.subscription_plans set
  key = 'fused_monthly',
  name = 'PAON Fused',
  positioning = 'A professional digital customer foundation.',
  description = 'The essential branded customer and operating foundation for a premium retailer.',
  price_amount_minor_units = 34900,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 150000,
  implementation_fee_currency = 'EUR',
  price_is_from = false,
  display_order = 10,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic'
  ]
where key = 'boutique_monthly';

update public.subscription_plans set
  key = 'half_canvas_monthly',
  name = 'PAON Half Canvas',
  positioning = 'Customer growth, service and retention.',
  description = 'A connected growth and service platform for retailers ready to deepen every customer relationship.',
  price_amount_minor_units = 74900,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 350000,
  implementation_fee_currency = 'EUR',
  price_is_from = false,
  display_order = 20,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic',
    'ecommerce', 'loyalty', 'referrals', 'vouchers', 'events',
    'wedding_planning', 'clienteling', 'messaging', 'alterations_advanced',
    'analytics_expanded', 'multi_user', 'multi_location'
  ]
where key = 'house_monthly';

update public.subscription_plans set
  key = 'full_canvas_monthly',
  name = 'PAON Full Canvas',
  positioning = 'Complete platform with managed growth.',
  description = 'A bespoke platform and growth partnership for ambitious premium retail houses.',
  price_amount_minor_units = 175000,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 750000,
  implementation_fee_currency = 'EUR',
  price_is_from = true,
  display_order = 30,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic',
    'ecommerce', 'loyalty', 'referrals', 'vouchers', 'events',
    'wedding_planning', 'clienteling', 'messaging', 'alterations_advanced',
    'analytics_expanded', 'multi_user', 'multi_location',
    'bespoke_implementation', 'analytics_advanced', 'ai_personalisation',
    'custom_integrations', 'campaign_support', 'lead_generation',
    'management_consulting', 'priority_support', 'quarterly_growth_planning'
  ]
where key = 'maison_monthly';

insert into public.subscription_plan_entitlements (plan_id, feature_key)
select p.id, unnest(p.included_feature_keys)
from public.subscription_plans p
on conflict do nothing;

insert into public.managed_service_offerings (
  key, name, description, price_amount_minor_units, price_currency,
  billing_interval, price_is_from, display_order
) values
  ('campaign_partnership', 'Campaign partnership',
    'Ongoing campaign planning, execution support and reporting.',
    null, null, null, true, 10),
  ('lead_generation_retainer', 'Lead-generation retainer',
    'Targeted acquisition support aligned to the retailer growth plan.',
    null, null, null, true, 20),
  ('management_advisory', 'Management advisory',
    'Structured commercial and operating guidance for the leadership team.',
    null, null, null, true, 30);

create or replace function public.retailer_has_entitlement(
  p_retailer_id uuid,
  p_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when not (
        public.is_platform_staff()
        or p_retailer_id = public.current_retailer_id()
      ) then false
      when exists (
        select 1
        from public.retailer_entitlement_overrides o
        where o.retailer_id = p_retailer_id
          and o.feature_key = p_feature_key
          and (o.expires_at is null or o.expires_at > now())
      ) then (
        select o.enabled
        from public.retailer_entitlement_overrides o
        where o.retailer_id = p_retailer_id
          and o.feature_key = p_feature_key
          and (o.expires_at is null or o.expires_at > now())
      )
      else exists (
        select 1
        from public.retailer_subscriptions s
        join public.subscription_plan_entitlements e on e.plan_id = s.plan_id
        where s.retailer_id = p_retailer_id
          and s.status in ('trialing', 'active')
          and e.feature_key = p_feature_key
      )
    end;
$$;

revoke all on function public.retailer_has_entitlement(uuid, text) from public;
grant execute on function public.retailer_has_entitlement(uuid, text)
  to authenticated, service_role;
