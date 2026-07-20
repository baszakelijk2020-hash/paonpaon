-- Stripe Billing for retailer subscriptions (founder decision,
-- docs/DECISIONS.md ADR-031). PAON's own platform Stripe account —
-- the reverse money direction from 20260720000015_*'s Connect payments
-- (a retailer paying PAON, not a customer paying the retailer).

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  price_amount_minor_units integer not null check (price_amount_minor_units >= 0),
  price_currency text not null,
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  included_feature_keys text[] not null default '{}',
  seat_limit integer,
  -- Absent until a platform operator creates the real Stripe Price in
  -- the dashboard and records its id here — a retailer cannot be
  -- subscribed to a plan with no price yet (see
  -- docs/PROJECT_STATE.md "Credentials needed").
  provider_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_subscription_plans_updated_at
  before update on public.subscription_plans
  for each row
  execute function public.set_updated_at();

alter table public.subscription_plans enable row level security;

create policy "platform staff can manage all subscription plans"
  on public.subscription_plans for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- Not tenant-scoped data — PAON's own product catalog, the same way
-- any retailer knowing PAON's pricing tiers exist isn't sensitive. No
-- `anon` access: nothing public-facing shows this yet (no storefront
-- pricing page), so keep it authenticated-only until something needs more.
create policy "authenticated users can read subscription plans"
  on public.subscription_plans for select
  to authenticated
  using (true);

grant select, insert, update, delete on public.subscription_plans
  to authenticated, service_role;

insert into public.subscription_plans (
  key, name, price_amount_minor_units, price_currency, billing_interval, included_feature_keys, seat_limit
)
values
  ('boutique_monthly', 'Boutique', 29900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments'], 5),
  ('house_monthly', 'House', 79900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments', 'alterations', 'loyalty'], 20),
  ('maison_monthly', 'Maison', 199900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments', 'alterations', 'loyalty', 'analytics', 'messaging'], null);

create table public.retailer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null unique references public.retailers (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_customer_id text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_retailer_subscriptions_updated_at
  before update on public.retailer_subscriptions
  for each row
  execute function public.set_updated_at();

alter table public.retailer_subscriptions enable row level security;

-- No narrow RPC needed here, unlike payments (20260720000015_*):
-- assignment is platform-staff-initiated (already fully covered by the
-- "manage all" policy below) and the webhook sync is a single-table,
-- no-business-validation update, the same shape as
-- retailer_stripe_accounts.syncCapabilities — neither needs the
-- "two tables, one client call" transactional guarantee an RPC exists for.
create policy "platform staff can manage all retailer subscriptions"
  on public.retailer_subscriptions for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "owner or admin can read their retailer's subscription"
  on public.retailer_subscriptions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_subscriptions
  to authenticated, service_role;
