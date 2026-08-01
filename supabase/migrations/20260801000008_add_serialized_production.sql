-- PHASE 12.2 (INV-103): garment production specs, serialized pieces,
-- stages, work tickets, BOM/materials, QC and outworker access.
--
-- Why a `production_pieces` table exists at all rather than a status column
-- on the order: a two-piece suit whose trousers are finished while the
-- jacket is in rework is a real and common state, and an order-level status
-- cannot represent it without lying about one of the two. The item's own
-- acceptance criterion is "jacket/trousers scan independently".
--
-- A spec pins `measurement_version_id` from Stage 12.1, which has no UPDATE
-- grant. That is what makes "what was this cut to" answerable a year later.
-- The spec itself is immutable once cutting starts; a later change is an
-- amendment row naming a reason and a cost decision, never an edit.

create table if not exists public.production_specs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- Stage 12.1's append-only measurement version. RESTRICT, not SET NULL:
  -- losing the pointer would make the garment's provenance unanswerable.
  measurement_version_id uuid not null
    references public.customer_measurement_versions (id) on delete restrict,
  version integer not null default 1 check (version >= 1),
  -- Pattern, cloth, construction choices. Authored and versioned as a
  -- whole; splitting into rows would let a detail change without the
  -- version moving.
  spec jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_specs_unique unique (order_id, version),
  constraint production_specs_is_object check (jsonb_typeof(spec) = 'object')
);

create table if not exists public.production_spec_amendments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  spec_id uuid not null references public.production_specs (id) on delete cascade,
  -- An amendment must say why and who pays. A post-cut change with neither
  -- leaves the cut cloth and the record disagreeing, with nothing showing
  -- that anyone knew.
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  cost_decision text not null check (
    cost_decision in ('retailer_absorbs', 'customer_pays', 'supplier_credit')
  ),
  amended_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_spec_amendments_spec_idx
  on public.production_spec_amendments (spec_id, created_at);

create table if not exists public.production_pieces (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  spec_id uuid not null references public.production_specs (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  piece_kind text not null check (
    piece_kind in ('jacket', 'trousers', 'waistcoat', 'shirt', 'overcoat')
  ),
  piece_sequence smallint not null check (piece_sequence between 1 and 99),
  -- Derived from the piece, not from a second counter: a separate sequence
  -- is a second truth, and a mislabelled jacket is very hard to detect
  -- downstream.
  barcode text not null,
  stage text not null default 'spec_locked' check (
    stage in (
      'spec_locked', 'cutting', 'assembly', 'fitting_basted', 'finishing',
      'quality_control', 'rework', 'ready', 'dispatched'
    )
  ),
  maker_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  promised_on date,
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint production_pieces_barcode_unique unique (retailer_id, barcode),
  constraint production_pieces_sequence_unique unique (order_id, piece_sequence)
);

create index if not exists production_pieces_stage_idx
  on public.production_pieces (retailer_id, stage)
  where deleted_at is null;

-- Append-only stage history. The current stage on the piece is a
-- convenience; this is the record. Without it, "when did it fail QC and who
-- said so" is unanswerable after the next transition overwrites the column.
create table if not exists public.production_stage_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  piece_id uuid not null references public.production_pieces (id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  defect_note text check (
    defect_note is null or char_length(btrim(defect_note)) between 1 and 2000
  ),
  inspector_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  recorded_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now(),
  -- Rework must state a defect. A rework nobody described cannot be
  -- learned from, and the workroom conversation later has nothing to point
  -- at.
  constraint production_rework_has_defect check (
    to_stage <> 'rework' or defect_note is not null
  ),
  -- Separation of duties: inspecting your own piece is self-assessment.
  constraint production_inspector_not_maker check (
    inspector_staff_id is null
    or recorded_by_staff_id is null
    or inspector_staff_id <> recorded_by_staff_id
    or from_stage <> 'quality_control'
  )
);

create index if not exists production_stage_events_piece_idx
  on public.production_stage_events (piece_id, occurred_at);

create table if not exists public.production_material_lines (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  spec_id uuid not null references public.production_specs (id) on delete cascade,
  piece_id uuid references public.production_pieces (id) on delete cascade,
  material_key text not null check (char_length(material_key) between 1 and 120),
  planned_units numeric(10, 4) not null check (planned_units >= 0),
  consumed_units numeric(10, 4) check (consumed_units is null or consumed_units >= 0),
  unit text not null check (unit in ('metre', 'piece')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_material_lines_spec_idx
  on public.production_material_lines (spec_id);

-- Outworkers are external. They get a work ticket keyed by barcode and see
-- initials, never a customer name — the projection is built in
-- packages/domain (buildOutworkerTicket) as a whitelist, so adding a field
-- to the piece does not silently widen what leaves the building.
create table if not exists public.production_work_tickets (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  piece_id uuid not null references public.production_pieces (id) on delete cascade,
  assigned_outworker_reference text
    check (assigned_outworker_reference is null
           or char_length(assigned_outworker_reference) <= 200),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 8000),
  due_on date not null,
  issued_at timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_production_specs_updated_at
  before update on public.production_specs
  for each row execute function public.set_updated_at();
create trigger set_production_pieces_updated_at
  before update on public.production_pieces
  for each row execute function public.set_updated_at();
create trigger set_production_material_lines_updated_at
  before update on public.production_material_lines
  for each row execute function public.set_updated_at();
create trigger set_production_work_tickets_updated_at
  before update on public.production_work_tickets
  for each row execute function public.set_updated_at();

alter table public.production_specs enable row level security;
alter table public.production_spec_amendments enable row level security;
alter table public.production_pieces enable row level security;
alter table public.production_stage_events enable row level security;
alter table public.production_material_lines enable row level security;
alter table public.production_work_tickets enable row level security;

revoke all on table public.production_specs from public, anon;
revoke all on table public.production_spec_amendments from public, anon;
revoke all on table public.production_pieces from public, anon;
revoke all on table public.production_stage_events from public, anon;
revoke all on table public.production_material_lines from public, anon;
revoke all on table public.production_work_tickets from public, anon;

grant select, insert, update on table public.production_specs
  to authenticated, service_role;
-- Amendments and stage events are append-only: the history is the point.
grant select, insert on table public.production_spec_amendments
  to authenticated, service_role;
grant select, insert on table public.production_stage_events
  to authenticated, service_role;
grant select, insert, update on table public.production_pieces
  to authenticated, service_role;
grant select, insert, update on table public.production_material_lines
  to authenticated, service_role;
grant select, insert, update on table public.production_work_tickets
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'production_specs', 'production_spec_amendments', 'production_pieces',
    'production_stage_events', 'production_material_lines',
    'production_work_tickets'
  ] loop
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

do $$
declare
  t text;
begin
  foreach t in array array[
    'production_specs', 'production_pieces', 'production_material_lines',
    'production_work_tickets'
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

comment on table public.production_pieces is
  'PHASE 12.2 / INV-103 serialized pieces. Exists rather than an '
  'order-level status because a suit with finished trousers and a jacket '
  'in rework is a real state an order status cannot represent honestly.';
comment on table public.production_stage_events is
  'PHASE 12.2 append-only stage history. The stage column on the piece is '
  'a convenience; this table is the record.';
