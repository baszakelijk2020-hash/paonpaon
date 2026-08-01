-- PHASE 13.1 / 13.2 / 13.3: append-only stock ledger, count sessions, risk
-- approvals, RFID observations, POS transactions and returns.
--
-- The central decision: there is no balance column anywhere. A balance is
-- a projection over `stock_ledger_entries`, which has no UPDATE and no
-- DELETE grant to any role. "Without silent balance edits" is therefore a
-- property of the grants, not of the application. Undoing an entry is a
-- `reversal` row citing the original; a mistake and its correction both
-- stay visible.
--
-- Second: an RFID sweep never posts stock. `rfid_sweep_observations` is
-- append-only and has no path to the ledger. The only thing that moves
-- stock after a sweep is a human count adjustment, which already requires
-- an open count session and a stated reason.
--
-- Third: nothing here stores a card. `pos_payments` holds a provider name
-- and an opaque provider reference, and there is deliberately no column a
-- PAN, CVC or track-2 blob could be put in.

create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid references public.retailer_branches (id) on delete set null,
  code text not null check (char_length(btrim(code)) between 1 and 32),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_locations_code_unique unique (retailer_id, code)
);

create table if not exists public.stock_count_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  -- Blind means the counter is not shown the expected figure. Recorded so
  -- a variance from a non-blind count is not read as equally meaningful.
  blind boolean not null default true,
  state text not null default 'open' check (
    state in ('open', 'counted', 'recount_required', 'reconciled', 'abandoned')
  ),
  opened_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_count_sessions_open_idx
  on public.stock_count_sessions (retailer_id, location_id)
  where state in ('open', 'counted', 'recount_required');

create table if not exists public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  session_id uuid not null
    references public.stock_count_sessions (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  counted_quantity integer not null check (counted_quantity >= 0),
  counted_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  counted_at timestamptz not null default now(),
  -- One line per variant per session. A second scan of the same variant is
  -- a correction, made by updating this row inside the session, not by
  -- adding a row that would double the count.
  constraint stock_count_line_unique unique (session_id, variant_id)
);

-- The ledger. Append-only, and the only source of a balance.
create table if not exists public.stock_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  kind text not null check (
    kind in (
      'receipt', 'sale', 'reservation', 'reservation_release',
      'transfer_out', 'transfer_in', 'count_adjustment', 'reversal'
    )
  ),
  quantity integer not null check (quantity > 0),
  -- Set on 'reversal'. The sign is derived from the entry being undone, so
  -- a caller cannot mis-sign a reversal.
  reverses_entry_id uuid references public.stock_ledger_entries (id) on delete restrict,
  count_session_id uuid
    references public.stock_count_sessions (id) on delete set null,
  reason text check (reason is null or char_length(btrim(reason)) between 5 and 1000),
  recorded_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  -- Two entries with the same key are the same event delivered twice.
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint stock_ledger_idempotency_unique
    unique (retailer_id, idempotency_key),
  constraint stock_ledger_reversal_cites_entry check (
    (kind = 'reversal') = (reverses_entry_id is not null)
  ),
  -- An adjustment must come from a count session and say why. This is what
  -- keeps shrinkage analysable instead of being a pile of unexplained
  -- corrections.
  constraint stock_ledger_adjustment_is_reasoned check (
    kind <> 'count_adjustment'
    or (count_session_id is not null and reason is not null)
  )
);

create index if not exists stock_ledger_projection_idx
  on public.stock_ledger_entries (retailer_id, variant_id, location_id, occurred_at);

create table if not exists public.stock_risk_flags (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  ledger_entry_id uuid
    references public.stock_ledger_entries (id) on delete cascade,
  triggered_rules text[] not null,
  requested_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  approved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Independent approval: a different person, and (enforced by policy) a
  -- manager. A peer approving a peer is not independence.
  constraint stock_risk_no_self_approval check (
    approved_by_staff_id is null
    or approved_by_staff_id <> requested_by_staff_id
  ),
  constraint stock_risk_rules_non_empty check (
    array_length(triggered_rules, 1) is not null
  )
);

create index if not exists stock_risk_open_idx
  on public.stock_risk_flags (retailer_id, created_at)
  where approved_at is null;

-- RFID pilot. Observations only; there is no foreign key or trigger from
-- here into stock_ledger_entries, by design.
create table if not exists public.rfid_sweep_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete cascade,
  sweep_id uuid not null,
  epc text not null check (char_length(epc) between 1 and 128),
  zone_key text not null check (char_length(zone_key) between 1 and 64),
  read_confidence numeric(3, 2) not null check (read_confidence between 0 and 1),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rfid_sweep_idx
  on public.rfid_sweep_observations (retailer_id, sweep_id, epc);

create table if not exists public.rfid_sweep_discrepancies (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  sweep_id uuid not null,
  epc text not null,
  -- "unobserved", not "missing": a tag can be unread for a dozen mundane
  -- reasons, and calling it missing invites a write-off.
  kind text not null check (kind in ('unobserved', 'unexpected')),
  resolved_at timestamptz,
  resolution_note text check (
    resolution_note is null or char_length(btrim(resolution_note)) between 5 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Resolved with no explanation is indistinguishable from ignored, and a
  -- pilot judged on unexplained resolutions looks far better than it is.
  constraint rfid_discrepancy_resolution_explained check (
    (resolved_at is null) = (resolution_note is null)
  )
);

-- POS
create table if not exists public.pos_transactions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete set null,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  state text not null default 'open' check (
    state in ('open', 'suspended', 'quoted', 'awaiting_payment', 'completed', 'voided')
  ),
  -- A return is a NEW transaction linked to the original, never an edit of
  -- it. Editing would erase the fact that a sale happened, which both the
  -- ledger and the accounts need.
  returns_transaction_id uuid references public.pos_transactions (id) on delete restrict,
  void_reason text check (
    void_reason is null or char_length(btrim(void_reason)) between 5 and 1000
  ),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_void_has_reason check (state <> 'voided' or void_reason is not null),
  constraint pos_completed_has_time check ((state = 'completed') = (completed_at is not null)),
  constraint pos_return_not_self check (
    returns_transaction_id is null or returns_transaction_id <> id
  )
);

create index if not exists pos_transactions_open_idx
  on public.pos_transactions (retailer_id, state, created_at);

create table if not exists public.pos_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  transaction_id uuid not null
    references public.pos_transactions (id) on delete cascade,
  kind text not null check (kind in ('rtw', 'alteration_service', 'mtm')),
  variant_id uuid references public.product_variants (id) on delete restrict,
  alteration_id uuid references public.alteration_work_orders (id) on delete set null,
  production_spec_id uuid references public.production_specs (id) on delete set null,
  quantity integer not null check (quantity <> 0),
  unit_price_minor_units integer not null check (unit_price_minor_units >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  -- The reservation this line holds, so releasing on void is mechanical
  -- rather than remembered.
  reservation_entry_id uuid
    references public.stock_ledger_entries (id) on delete set null,
  returned_quantity integer not null default 0 check (returned_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only RTW is stock. A service or an MTM commission is not a shelf item.
  constraint pos_line_rtw_has_variant check (kind <> 'rtw' or variant_id is not null),
  constraint pos_line_return_within_sold check (returned_quantity <= abs(quantity))
);

create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  transaction_id uuid not null
    references public.pos_transactions (id) on delete cascade,
  -- Provider name plus an opaque reference. There is deliberately no
  -- column here that a PAN, CVC or track-2 blob could be written into.
  provider text not null check (char_length(provider) between 1 and 64),
  provider_reference text not null
    check (char_length(btrim(provider_reference)) between 1 and 200),
  amount_minor_units integer not null,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Retries reconcile rather than double-charge.
  constraint pos_payment_reference_unique
    unique (retailer_id, provider, provider_reference)
);

create trigger set_stock_locations_updated_at
  before update on public.stock_locations
  for each row execute function public.set_updated_at();
create trigger set_stock_count_sessions_updated_at
  before update on public.stock_count_sessions
  for each row execute function public.set_updated_at();
create trigger set_stock_risk_flags_updated_at
  before update on public.stock_risk_flags
  for each row execute function public.set_updated_at();
create trigger set_rfid_sweep_discrepancies_updated_at
  before update on public.rfid_sweep_discrepancies
  for each row execute function public.set_updated_at();
create trigger set_pos_transactions_updated_at
  before update on public.pos_transactions
  for each row execute function public.set_updated_at();
create trigger set_pos_transaction_lines_updated_at
  before update on public.pos_transaction_lines
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'stock_locations', 'stock_count_sessions', 'stock_count_lines',
    'stock_ledger_entries', 'stock_risk_flags', 'rfid_sweep_observations',
    'rfid_sweep_discrepancies', 'pos_transactions', 'pos_transaction_lines',
    'pos_payments'
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

-- Append-only: the ledger, RFID observations and payments. No UPDATE and
-- no DELETE grant exists for these on ANY role, service_role included.
-- This is the schema-level form of "no silent balance edits".
grant insert on table public.stock_ledger_entries to authenticated, service_role;
grant insert on table public.rfid_sweep_observations to authenticated, service_role;
grant insert on table public.pos_payments to authenticated, service_role;

grant insert, update on table public.stock_locations to authenticated, service_role;
grant insert, update on table public.stock_count_sessions
  to authenticated, service_role;
grant insert, update on table public.stock_count_lines to authenticated, service_role;
grant insert, update on table public.stock_risk_flags to authenticated, service_role;
grant insert, update on table public.rfid_sweep_discrepancies
  to authenticated, service_role;
grant insert, update on table public.pos_transactions to authenticated, service_role;
grant insert, update on table public.pos_transaction_lines
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'stock_locations', 'stock_count_sessions', 'stock_count_lines',
    'rfid_sweep_discrepancies', 'pos_transactions', 'pos_transaction_lines'
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

-- Only a manager may sign off a risk flag, and the CHECK above already
-- refuses the requester. Together that is a different person AND
-- sufficient authority.
create policy stock_risk_flags_manager_update
  on public.stock_risk_flags for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

comment on table public.stock_ledger_entries is
  'PHASE 13.1 / INV-101 append-only stock ledger. No UPDATE or DELETE '
  'grant exists on any role: a balance is a projection over this table, '
  'and the only way to undo an entry is a reversal citing it.';
comment on table public.rfid_sweep_observations is
  'PHASE 13.2 / INV-105 RFID observations. Deliberately has no link to '
  'stock_ledger_entries: a sweep never posts a balance. Only a human '
  'count adjustment moves stock.';
comment on table public.pos_payments is
  'PHASE 13.3 provider reference only. There is no column here that a PAN, '
  'CVC or track-2 blob could be written into.';
