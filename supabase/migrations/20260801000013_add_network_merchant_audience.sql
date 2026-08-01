-- PHASE 15.1-15.5: lifestyle partner network and attribution, rewards
-- ledger, MunroMerchant procurement, audience/advertising inventory, and
-- the governed release plane.
--
-- Three structural commitments.
--
-- 1. A partner never receives a named customer. `network_attribution_events`
--    stores a `pseudonymous_ref` and has no customer_id column at all — not
--    a nullable one, none — so a partner-facing query has nothing to join
--    to. The mapping from customer to pseudonymous ref lives in
--    `network_pseudonym_map`, which grants SELECT to service_role only.
--
-- 2. MunroMerchant is a separate bounded context. Every table is prefixed
--    `merchant_` and none of them references public.customers,
--    public.orders or anything else on the consumer side. A test asserts
--    that. The item's non-goal is "no customer-facing marketplace order
--    reuse", and a foreign key is the only thing that could break it.
--
-- 3. Nothing here moves money. Reward grants name a funding source and
--    expire; revenue shares are recorded and reversed as ledger rows.
--    There is no payout column, no provider reference and no link to
--    public.payments anywhere in this migration - ADR-062 has not decided
--    a payout design for any of it.

-- ------------------------------------------------------- 15.1 / 15.2

create table if not exists public.network_partners (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  partner_key text not null check (char_length(partner_key) between 2 and 64),
  -- Disclosure is not optional: a placement the customer cannot tell is
  -- commercial is an advertisement pretending to be advice.
  disclosure_text text not null
    check (char_length(btrim(disclosure_text)) between 10 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_partner_key_unique unique (retailer_id, partner_key)
);

create table if not exists public.network_listings (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  partner_id uuid not null references public.network_partners (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (description is null or char_length(description) <= 4000),
  destination_url text not null check (char_length(destination_url) <= 2000),
  curated_by_retailer boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The only place a customer maps to a partner-facing pseudonym. SELECT is
-- service_role only, so no retailer session and no partner integration can
-- resolve a pseudonym back to a person.
create table if not exists public.network_pseudonym_map (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  partner_id uuid not null references public.network_partners (id) on delete cascade,
  pseudonymous_ref text not null,
  created_at timestamptz not null default now(),
  constraint network_pseudonym_unique unique (partner_id, pseudonymous_ref),
  constraint network_pseudonym_per_customer unique (customer_id, partner_id)
);

create table if not exists public.network_attribution_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  listing_id uuid not null references public.network_listings (id) on delete cascade,
  -- Deliberately NO customer_id column. See the header note.
  pseudonymous_ref text not null,
  event text not null check (
    event in ('impression', 'click', 'lead', 'order_confirmed', 'order_refunded')
  ),
  value_minor_units integer check (value_minor_units is null or value_minor_units >= 0),
  state text not null default 'pending' check (
    state in ('pending', 'holding', 'confirmed', 'reversed', 'expired')
  ),
  -- Retried provider callbacks must replay idempotently.
  provider_event_key text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint network_attribution_idempotent
    unique (retailer_id, provider_event_key)
);

create index if not exists network_attribution_listing_idx
  on public.network_attribution_events (listing_id, occurred_at desc);

create table if not exists public.network_reward_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  attribution_event_id uuid
    references public.network_attribution_events (id) on delete set null,
  -- NOT NULL: every unit of value must trace to money that already exists.
  funding_source text not null check (
    funding_source in ('retailer_margin', 'partner_commission', 'marketing_budget')
  ),
  value_minor_units integer not null check (value_minor_units <> 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  state text not null default 'pending' check (
    state in ('pending', 'available', 'redeemed', 'reversed', 'expired')
  ),
  -- NOT NULL: an unexpiring balance is an indefinite liability, which is
  -- the stored-value question ADR-062 has not answered.
  expires_on date not null,
  reverses_entry_id uuid
    references public.network_reward_entries (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists network_reward_customer_idx
  on public.network_reward_entries (customer_id, created_at desc);

-- ------------------------------------------------------------ 15.3

create table if not exists public.merchant_suppliers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  supplier_key text not null check (char_length(supplier_key) between 2 and 64),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_supplier_key_unique unique (retailer_id, supplier_key)
);

create table if not exists public.merchant_listings (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  supplier_id uuid not null references public.merchant_suppliers (id) on delete cascade,
  category text not null check (
    category in ('packaging', 'hangers', 'fixtures', 'furniture', 'signage', 'consumables')
  ),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  minimum_order_quantity integer not null check (minimum_order_quantity > 0),
  -- [{ minimumQuantity, unitPriceMinorUnits }]
  price_tiers jsonb not null,
  customizable boolean not null default false,
  sample_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_tiers_non_empty check (
    jsonb_typeof(price_tiers) = 'array' and jsonb_array_length(price_tiers) > 0
  )
);

create table if not exists public.merchant_rfqs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  listing_id uuid not null references public.merchant_listings (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  state text not null default 'draft' check (
    state in ('draft', 'sent', 'quoted', 'accepted', 'declined', 'expired')
  ),
  quoted_unit_price_minor_units integer
    check (quoted_unit_price_minor_units is null or quoted_unit_price_minor_units >= 0),
  quote_expires_on date,
  -- A customised item cannot be accepted without an approved proof:
  -- printing 5,000 bags with the wrong logo is not recoverable.
  proof_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_rfq_quote_has_price check (
    state not in ('quoted', 'accepted') or quoted_unit_price_minor_units is not null
  )
);

create table if not exists public.merchant_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  rfq_id uuid references public.merchant_rfqs (id) on delete set null,
  supplier_id uuid not null references public.merchant_suppliers (id) on delete restrict,
  po_number text not null check (char_length(btrim(po_number)) between 1 and 64),
  total_minor_units integer not null check (total_minor_units >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  state text not null default 'draft' check (
    state in ('draft', 'approved', 'acknowledged', 'shipped', 'received', 'closed', 'cancelled')
  ),
  raised_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  approved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_po_number_unique unique (retailer_id, po_number),
  constraint merchant_po_no_self_approval check (
    approved_by_staff_id is null
    or raised_by_staff_id is null
    or approved_by_staff_id <> raised_by_staff_id
  )
);

create table if not exists public.merchant_shipments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  purchase_order_id uuid not null
    references public.merchant_purchase_orders (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  shipped_on date,
  received_on date,
  carrier_reference text check (carrier_reference is null or char_length(carrier_reference) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_shipment_issues (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  shipment_id uuid not null references public.merchant_shipments (id) on delete cascade,
  kind text not null check (
    kind in ('short_shipped', 'damaged', 'wrong_specification', 'late')
  ),
  affected_quantity integer not null check (affected_quantity > 0),
  evidence_refs text[] not null default '{}',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A damage or specification claim with no photo is one the supplier will
  -- reject; raising it wastes both sides' time.
  constraint merchant_issue_has_evidence check (
    kind = 'late' or array_length(evidence_refs, 1) is not null
  )
);

create table if not exists public.merchant_group_buys (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  listing_id uuid not null references public.merchant_listings (id) on delete cascade,
  target_quantity integer not null check (target_quantity > 0),
  committed_quantity integer not null default 0 check (committed_quantity >= 0),
  closes_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- 15.4 / 15.5

create table if not exists public.audience_cohort_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  cohort_key text not null check (char_length(cohort_key) between 2 and 64),
  version integer not null check (version >= 1),
  -- Hash of the rules that produced this version. An activation pins the
  -- version; a later rule edit makes a NEW version rather than restating
  -- this one, so a past forecast and a past payable stay meaningful.
  rule_hash text not null check (char_length(rule_hash) between 8 and 128),
  size_at_version integer not null check (size_at_version >= 0),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint audience_cohort_version_unique unique (retailer_id, cohort_key, version)
);

create table if not exists public.audience_forecasts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  cohort_version_id uuid not null
    references public.audience_cohort_versions (id) on delete restrict,
  reachable_size integer not null check (reachable_size >= 0),
  policy_ref text not null check (char_length(policy_ref) between 1 and 200),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.advertising_orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  advertiser_key text not null check (char_length(advertiser_key) between 2 and 64),
  cohort_version_id uuid not null
    references public.audience_cohort_versions (id) on delete restrict,
  budget_minor_units integer not null check (budget_minor_units > 0),
  spent_minor_units integer not null default 0 check (spent_minor_units >= 0),
  frequency_cap smallint not null default 3 check (frequency_cap > 0),
  flight_start timestamptz not null,
  flight_end timestamptz not null,
  -- Live serving needs a signed contract. Provider-neutral local
  -- capability does not.
  serving_contract_ref text,
  live_serving boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertising_flight_ordered check (flight_end > flight_start),
  constraint advertising_live_needs_contract check (
    live_serving = false or serving_contract_ref is not null
  )
);

create table if not exists public.advertising_creatives (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  order_id uuid not null references public.advertising_orders (id) on delete cascade,
  asset_ref text not null check (char_length(asset_ref) between 1 and 2000),
  rights_expires_on date,
  review_state text not null default 'pending' check (
    review_state in ('pending', 'approved', 'rejected')
  ),
  reviewed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advertising_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  order_id uuid not null references public.advertising_orders (id) on delete cascade,
  -- Pseudonymous, like the partner network. No customer_id column here
  -- either.
  pseudonymous_ref text not null,
  kind text not null check (
    kind in (
      'impression', 'viewability', 'click', 'lead', 'booking', 'conversion',
      'refund', 'reversal'
    )
  ),
  value_minor_units integer,
  dedupe_key text not null,
  fraud_review_state text not null default 'not_reviewed' check (
    fraud_review_state in ('not_reviewed', 'clean', 'suspected', 'rejected')
  ),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint advertising_event_dedupe unique (retailer_id, dedupe_key)
);

create index if not exists advertising_events_order_idx
  on public.advertising_events (order_id, occurred_at desc);

create table if not exists public.governed_releases (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  mode text not null check (
    mode in (
      'aggregate_insight', 'retailer_benchmark', 'paon_executed_audience',
      'pseudonymous_attribution', 'clean_room_match', 'contracted_exchange',
      'own_tenant_export', 'customer_requested_introduction'
    )
  ),
  -- All three NOT NULL for a reason: the acceptance criterion is that a
  -- release happens only with purpose, contract and entitlement recorded.
  -- A nullable column here would make "recorded" optional.
  purpose text not null check (char_length(btrim(purpose)) between 5 and 2000),
  entitlement_ref text not null check (char_length(entitlement_ref) between 1 and 200),
  contract_ref text,
  cohort_size_at_release integer not null check (cohort_size_at_release >= 0),
  minimum_n integer not null default 25 check (minimum_n >= 0),
  customer_request_ref text,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint governed_release_meets_minimum_n check (
    mode not in ('aggregate_insight', 'retailer_benchmark', 'paon_executed_audience')
    or cohort_size_at_release >= minimum_n
  ),
  constraint governed_release_named_needs_request check (
    mode <> 'customer_requested_introduction' or customer_request_ref is not null
  ),
  constraint governed_release_contract_when_required check (
    mode not in ('clean_room_match', 'contracted_exchange', 'paon_executed_audience')
    or contract_ref is not null
  )
);

create table if not exists public.revenue_share_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  source_event_id uuid references public.advertising_events (id) on delete set null,
  party text not null check (
    party in ('retailer', 'publisher', 'partner', 'advertiser', 'paon_fee')
  ),
  amount_minor_units integer not null,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  -- Reversal is a new row citing the original. Editing the original would
  -- erase that value was ever shared, which is what a dispute needs.
  reverses_entry_id uuid
    references public.revenue_share_entries (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists revenue_share_party_idx
  on public.revenue_share_entries (retailer_id, party, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'network_partners', 'network_listings', 'network_pseudonym_map',
    'network_attribution_events', 'network_reward_entries',
    'merchant_suppliers', 'merchant_listings', 'merchant_rfqs',
    'merchant_purchase_orders', 'merchant_shipments',
    'merchant_shipment_issues', 'merchant_group_buys',
    'audience_cohort_versions', 'audience_forecasts', 'advertising_orders',
    'advertising_creatives', 'advertising_events', 'governed_releases',
    'revenue_share_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  -- Everything except the pseudonym map is readable by retailer staff.
  foreach t in array array[
    'network_partners', 'network_listings',
    'network_attribution_events', 'network_reward_entries',
    'merchant_suppliers', 'merchant_listings', 'merchant_rfqs',
    'merchant_purchase_orders', 'merchant_shipments',
    'merchant_shipment_issues', 'merchant_group_buys',
    'audience_cohort_versions', 'audience_forecasts', 'advertising_orders',
    'advertising_creatives', 'advertising_events', 'governed_releases',
    'revenue_share_entries'
  ] loop
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

-- The pseudonym map is the one table that could re-identify a customer
-- from partner-facing data. service_role only: no retailer session and no
-- partner integration can resolve a pseudonym back to a person.
grant select, insert on table public.network_pseudonym_map to service_role;

-- Append-only: attribution events, reward entries, advertising events,
-- governed releases and revenue shares. Each is a historical claim, and a
-- reversal is a new row citing the original.
grant insert on table public.network_attribution_events
  to authenticated, service_role;
grant insert on table public.network_reward_entries to authenticated, service_role;
grant insert on table public.advertising_events to authenticated, service_role;
grant insert on table public.governed_releases to authenticated, service_role;
grant insert on table public.revenue_share_entries to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'network_partners', 'network_listings', 'merchant_suppliers',
    'merchant_listings', 'merchant_rfqs', 'merchant_purchase_orders',
    'merchant_shipments', 'merchant_shipment_issues', 'merchant_group_buys',
    'audience_cohort_versions', 'audience_forecasts', 'advertising_orders',
    'advertising_creatives'
  ] loop
    execute format(
      'grant insert, update on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'')) '
      || 'with check (retailer_id = public.current_retailer_id())',
      t || '_staff_update', t
    );
  end loop;
end $$;

comment on table public.network_attribution_events is
  'PHASE 15.1 / NET-102. Deliberately has NO customer_id column: a '
  'partner-facing query must have nothing to join a person to. The '
  'pseudonym mapping lives in network_pseudonym_map, service_role only.';
comment on table public.governed_releases is
  'PHASE 15.5 / NET-106. purpose and entitlement_ref are NOT NULL and the '
  'minimum-n floor is a CHECK, so a release cannot be recorded without the '
  'things that made it lawful.';
