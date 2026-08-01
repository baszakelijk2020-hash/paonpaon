-- PHASE 14.1 (CORP-101..106) and 14.2: corporate programmes, wearers,
-- versioned entitlements, issue records, leaver exceptions, and cited
-- recommendations.
--
-- Two absences define 14.1.
--
-- First, PAON is not an HR system. `corporate_wearers` has no salary, no
-- manager, no employment status beyond active/inactive, no termination
-- reason and no notice period. A leaver is an *entitlement* event that
-- produces garment-return exceptions. A test asserts those columns do not
-- exist.
--
-- Second, no unrestricted health or accommodation data. A garment
-- adaptation is stored as a garment fact ("left sleeve +40mm"), the reason
-- is never asked for, and there is no diagnosis, condition or medical
-- column anywhere. The domain layer additionally refuses adaptation text
-- that reads like a diagnosis, because a free-text field beside a fitting
-- is where health data ends up by accident.
--
-- For 14.2, `cited_recommendations` cannot hold an uncited row: sources
-- and projector version are NOT NULL and the sources array is CHECKed
-- non-empty. "No black-box owner dashboard" is a constraint, not a review
-- convention.

create table if not exists public.corporate_accounts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 300),
  account_reference text not null
    check (char_length(btrim(account_reference)) between 1 and 64),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint corporate_accounts_reference_unique
    unique (retailer_id, account_reference)
);

create table if not exists public.corporate_programmes (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  account_id uuid not null references public.corporate_accounts (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 200),
  -- Employer sites. A programme runs across locations, and readiness is
  -- reported per programme, not per shop.
  site_keys text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Versioned and immutable once effective, for the same reason as every
-- other versioned thing here: an employer widening policy next year must
-- not retroactively make last year's issues over-quota, and narrowing it
-- must not retroactively make an issued garment a breach.
create table if not exists public.corporate_entitlement_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  version integer not null check (version >= 1),
  effective_from date not null,
  -- [{ roleKey, garmentKey, quantity, period }]
  rules jsonb not null,
  created_at timestamptz not null default now(),
  constraint corporate_entitlement_version_unique unique (programme_id, version),
  constraint corporate_entitlement_rules_non_empty check (
    jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) > 0
  )
);

create table if not exists public.corporate_wearers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  -- Optional link to a PAON customer record when the wearer also shops as
  -- an individual. Nullable: most wearers never become retail customers,
  -- and forcing one would create a shadow customer per employee.
  customer_id uuid references public.customers (id) on delete set null,
  employee_reference text not null
    check (char_length(btrim(employee_reference)) between 1 and 64),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 200),
  role_key text not null check (char_length(role_key) between 1 and 64),
  site_key text check (site_key is null or char_length(site_key) <= 64),
  joined_on date not null,
  active boolean not null default true,
  -- Garment adaptation only. "Left sleeve +40mm", "magnetic fastening".
  -- Never a reason, never a diagnosis - see the header note.
  garment_adaptation_note text check (
    garment_adaptation_note is null
    or char_length(btrim(garment_adaptation_note)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint corporate_wearer_reference_unique
    unique (programme_id, employee_reference)
);

create index if not exists corporate_wearers_active_idx
  on public.corporate_wearers (programme_id, active)
  where deleted_at is null;

create table if not exists public.corporate_issue_records (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  wearer_id uuid not null references public.corporate_wearers (id) on delete cascade,
  entitlement_version_id uuid not null
    references public.corporate_entitlement_versions (id) on delete restrict,
  garment_key text not null check (char_length(garment_key) between 1 and 120),
  quantity integer not null check (quantity > 0),
  order_id uuid references public.orders (id) on delete set null,
  issued_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists corporate_issue_wearer_idx
  on public.corporate_issue_records (wearer_id, issued_on desc);

create table if not exists public.corporate_exceptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  wearer_id uuid references public.corporate_wearers (id) on delete cascade,
  kind text not null check (
    kind in ('leaver_return', 'service_required', 'fit_issue', 'entitlement_dispute')
  ),
  garment_key text check (garment_key is null or char_length(garment_key) <= 120),
  quantity integer check (quantity is null or quantity > 0),
  action text check (
    action is null
    or action in ('return_requested', 'returned', 'retained_by_agreement', 'written_off')
  ),
  detail text not null check (char_length(btrim(detail)) between 5 and 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_exceptions_open_idx
  on public.corporate_exceptions (retailer_id, created_at)
  where resolved_at is null;

-- 14.2
create table if not exists public.cited_recommendations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in (
      'temporal_hotspot', 'interest_progression', 'complete_look',
      'fit_risk', 'production_risk', 'stock_risk', 'staffing_risk'
    )
  ),
  statement text not null check (char_length(btrim(statement)) between 5 and 2000),
  -- [{ sourceRef, projectorVersion, observedRows }]. Non-empty by CHECK:
  -- an uncited recommendation cannot be stored at all.
  sources jsonb not null,
  window_from timestamptz not null,
  window_to timestamptz not null,
  sample_size integer not null check (sample_size > 0),
  confidence text not null check (
    confidence in ('insufficient_sample', 'indicative', 'supported')
  ),
  -- So a corrected customer fact can find what to recompute. Without it a
  -- correction leaves a stale card on a dashboard with no way to locate it.
  derived_from_fact_ids text[] not null default '{}',
  withdrawn_at timestamptz,
  withdrawn_reason text check (
    withdrawn_reason is null or char_length(btrim(withdrawn_reason)) <= 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cited_recommendation_has_sources check (
    jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0
  ),
  constraint cited_recommendation_window_ordered check (window_to > window_from),
  constraint cited_recommendation_withdrawal_explained check (
    (withdrawn_at is null) = (withdrawn_reason is null)
  )
);

create index if not exists cited_recommendations_live_idx
  on public.cited_recommendations (retailer_id, kind, created_at desc)
  where withdrawn_at is null;

create trigger set_corporate_accounts_updated_at
  before update on public.corporate_accounts
  for each row execute function public.set_updated_at();
create trigger set_corporate_programmes_updated_at
  before update on public.corporate_programmes
  for each row execute function public.set_updated_at();
create trigger set_corporate_wearers_updated_at
  before update on public.corporate_wearers
  for each row execute function public.set_updated_at();
create trigger set_corporate_exceptions_updated_at
  before update on public.corporate_exceptions
  for each row execute function public.set_updated_at();
create trigger set_cited_recommendations_updated_at
  before update on public.cited_recommendations
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_accounts', 'corporate_programmes',
    'corporate_entitlement_versions', 'corporate_wearers',
    'corporate_issue_records', 'corporate_exceptions',
    'cited_recommendations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
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
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

-- Entitlement versions and issue records are append-only: an issue that
-- can be edited is an entitlement balance that can be quietly restated.
grant insert on table public.corporate_entitlement_versions
  to authenticated, service_role;
grant insert on table public.corporate_issue_records
  to authenticated, service_role;

grant insert, update on table public.corporate_accounts
  to authenticated, service_role;
grant insert, update on table public.corporate_programmes
  to authenticated, service_role;
grant insert, update on table public.corporate_wearers
  to authenticated, service_role;
grant insert, update on table public.corporate_exceptions
  to authenticated, service_role;
-- A recommendation is withdrawn, not edited: restating a past claim in
-- place hides that it was ever made.
grant insert, update on table public.cited_recommendations
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_accounts', 'corporate_programmes', 'corporate_wearers',
    'corporate_exceptions', 'cited_recommendations'
  ] loop
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate'')) '
      || 'with check (retailer_id = public.current_retailer_id())',
      t || '_staff_update', t
    );
  end loop;
end $$;

comment on table public.corporate_wearers is
  'PHASE 14.1 / CORP-102. Deliberately has no salary, manager, termination '
  'reason or notice period: PAON is not the employment record. The '
  'adaptation note holds a garment fact, never a reason or a diagnosis.';
comment on table public.cited_recommendations is
  'PHASE 14.2. sources is CHECKed non-empty, so an uncited recommendation '
  'cannot be stored. "No black-box owner dashboard" is a constraint here, '
  'not a review convention.';
