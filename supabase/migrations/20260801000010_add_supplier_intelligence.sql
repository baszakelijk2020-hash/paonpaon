-- PHASE 12.4 (MTM-101): supplier/atelier facts, pairing rules, supply
-- exceptions and complaint cases.
--
-- Every supplier fact carries the authority that asserted it, the version
-- of the feed it came from and when it was observed. That triple is what
-- makes "why does the system think this cloth is in stock" answerable, and
-- it is why there is no plain `materials` table with a bare availability
-- column: a value with no source is the invented supplier data this item's
-- non-goal forbids.
--
-- Note the absence of any factory write-back queue. The non-goal says no
-- undocumented factory write-back, so submission stays a recorded outbound
-- task on the exception, not an automated push. See
-- describeFactoryWriteBack in packages/domain.

create table if not exists public.supplier_facts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  supplier_key text not null check (char_length(supplier_key) between 1 and 120),
  material_key text not null check (char_length(material_key) between 1 and 120),
  kind text not null check (
    kind in (
      'material_availability', 'trim_availability', 'lead_time_days',
      'minimum_order_quantity', 'price_minor_units', 'discontinued'
    )
  ),
  value text not null check (char_length(value) between 1 and 500),
  -- Reuses Stage 8's registry concept rather than inventing a second
  -- notion of "who is allowed to say this".
  source_authority_key text not null
    check (char_length(source_authority_key) between 1 and 120),
  source_version text not null check (char_length(source_version) between 1 and 200),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- One assertion per authority per fact per observation moment. A second
  -- row with the same triple is the same statement recorded twice, which
  -- would read as corroboration.
  constraint supplier_facts_unique
    unique (retailer_id, supplier_key, material_key, kind, source_authority_key, observed_at)
);

create index if not exists supplier_facts_lookup_idx
  on public.supplier_facts (retailer_id, material_key, kind, observed_at desc);

create table if not exists public.fabric_button_rules (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  fabric_key text not null check (char_length(fabric_key) between 1 and 120),
  allowed_button_keys text[] not null,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fabric_button_rules_unique unique (retailer_id, fabric_key),
  -- An empty allow-list is a decision to allow nothing, which is almost
  -- certainly a mistake rather than an intent. Absence of a ROW is how a
  -- fabric is marked undecided.
  constraint fabric_button_rules_non_empty check (
    array_length(allowed_button_keys, 1) is not null
  )
);

create table if not exists public.supply_exceptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in (
      'order_overdue', 'material_shortage', 'material_discontinued',
      'lead_time_increased'
    )
  ),
  material_key text not null check (char_length(material_key) between 1 and 120),
  -- NOT NULL: an exception nobody owns is a notification.
  owner_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  detail text not null check (char_length(btrim(detail)) between 10 and 4000),
  -- [{ sourceAuthorityKey, sourceVersion, observedAt }]. Non-empty by
  -- CHECK: an uncited exception is the black box this item forbids.
  citations jsonb not null,
  state text not null default 'open' check (
    state in ('open', 'acknowledged', 'resolved')
  ),
  resolved_at timestamptz,
  resolution_note text check (
    resolution_note is null or char_length(btrim(resolution_note)) between 1 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_exceptions_cited check (
    jsonb_typeof(citations) = 'array' and jsonb_array_length(citations) > 0
  ),
  constraint supply_exceptions_resolution_complete check (
    (state = 'resolved') = (resolved_at is not null and resolution_note is not null)
  )
);

create index if not exists supply_exceptions_open_idx
  on public.supply_exceptions (retailer_id, created_at)
  where state <> 'resolved';

create table if not exists public.supply_complaint_cases (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  piece_id uuid references public.production_pieces (id) on delete set null,
  supplier_key text check (supplier_key is null or char_length(supplier_key) <= 120),
  summary text not null check (char_length(btrim(summary)) between 10 and 4000),
  state text not null default 'raised' check (
    state in (
      'raised', 'investigating', 'supplier_notified', 'customer_recovered',
      'closed'
    )
  ),
  -- Photos, QC event ids, fitting observations. Required before a supplier
  -- is notified: telling a supplier their work was defective with nothing
  -- attached is a claim, not a case.
  evidence_refs text[] not null default '{}',
  customer_recovery_note text check (
    customer_recovery_note is null
    or char_length(btrim(customer_recovery_note)) between 1 and 2000
  ),
  supplier_action_note text check (
    supplier_action_note is null
    or char_length(btrim(supplier_action_note)) between 1 and 2000
  ),
  outcome_note text check (
    outcome_note is null or char_length(btrim(outcome_note)) between 1 and 2000
  ),
  owner_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_supplier_notified_has_evidence check (
    state <> 'supplier_notified' or array_length(evidence_refs, 1) is not null
  ),
  -- A case closes only with a stated outcome AND a recorded customer
  -- recovery. A supplier credit is not a resolution for the customer.
  constraint complaint_close_complete check (
    state <> 'closed'
    or (outcome_note is not null and customer_recovery_note is not null)
  )
);

create index if not exists supply_complaint_open_idx
  on public.supply_complaint_cases (retailer_id, created_at)
  where state <> 'closed';

create trigger set_fabric_button_rules_updated_at
  before update on public.fabric_button_rules
  for each row execute function public.set_updated_at();
create trigger set_supply_exceptions_updated_at
  before update on public.supply_exceptions
  for each row execute function public.set_updated_at();
create trigger set_supply_complaint_cases_updated_at
  before update on public.supply_complaint_cases
  for each row execute function public.set_updated_at();

alter table public.supplier_facts enable row level security;
alter table public.fabric_button_rules enable row level security;
alter table public.supply_exceptions enable row level security;
alter table public.supply_complaint_cases enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'supplier_facts', 'fabric_button_rules', 'supply_exceptions',
    'supply_complaint_cases'
  ] loop
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

-- supplier_facts is append-only: an observation is a historical statement,
-- and editing one rewrites what a supplier told us. A correction is a new
-- observation with a later observed_at.
grant insert on table public.supplier_facts to authenticated, service_role;
grant insert, update on table public.fabric_button_rules
  to authenticated, service_role;
grant insert, update on table public.supply_exceptions
  to authenticated, service_role;
grant insert, update on table public.supply_complaint_cases
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fabric_button_rules', 'supply_exceptions', 'supply_complaint_cases'
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

comment on table public.supplier_facts is
  'PHASE 12.4 / MTM-101 append-only supplier assertions. Every row names '
  'its authority, feed version and observation time; there is no bare '
  'availability column anywhere, because a value with no source is '
  'invented supplier data.';
