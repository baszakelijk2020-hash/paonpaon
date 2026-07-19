-- Founder clarification superseding ADR-015: PAON owns in-store fitting
-- observations tied to physical garments and alteration operations. It does
-- not own generic customer measurements or manufacturing specifications.
-- The foundation tables are retained read-only for audit/migration safety;
-- all active writes use the garment-first model below.

drop trigger if exists enforce_alteration_status_via_updates_only_on_update on public.alterations;
drop trigger if exists sync_alteration_status_on_update_insert on public.alteration_updates;

alter table public.customer_fit_profile_entries rename to legacy_customer_fit_profile_entries;
alter table public.alterations rename to legacy_alterations;
alter table public.alteration_updates rename to legacy_alteration_updates;

drop policy if exists "retailer staff can read their retailer's fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "sales staff and above can record fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "a customer can read their own fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "retailer staff can read their retailer's alterations" on public.legacy_alterations;
drop policy if exists "sales staff and above can create and edit alterations" on public.legacy_alterations;
drop policy if exists "a customer can read their own alterations" on public.legacy_alterations;
drop policy if exists "retailer staff can read their retailer's alteration updates" on public.legacy_alteration_updates;
drop policy if exists "production staff and above can add alteration updates" on public.legacy_alteration_updates;
drop policy if exists "a customer can read their own alteration updates" on public.legacy_alteration_updates;

comment on table public.legacy_customer_fit_profile_entries is
  'Read-only archive from ADR-015. Not an active PAON domain model: fitting observations must identify a physical garment.';
comment on table public.legacy_alterations is
  'Read-only archive of the Phase 3 alteration foundation, migrated into garment-first alteration_work_orders.';
comment on table public.legacy_alteration_updates is
  'Read-only archive of the Phase 3 alteration update foundation, migrated into alteration_status_history.';

create type public.garment_source_kind as enum ('external', 'finished_mtm');
create type public.garment_identification_state as enum ('verified', 'needs_verification');
create type public.work_classification as enum ('work_now', 'future_order_note');
create type public.workshop_status as enum ('active', 'inactive');
create type public.alteration_price_list_kind as enum ('retailer', 'workshop');
create type public.alteration_work_order_status as enum (
  'intake',
  'quoted',
  'awaiting_approval',
  'approved',
  'assigned',
  'in_progress',
  'completion_review',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'canceled'
);
create type public.alteration_task_status as enum (
  'proposed',
  'approved',
  'assigned',
  'in_progress',
  'review_ready',
  'completed',
  'canceled'
);
create type public.price_change_proposal_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.alteration_attachment_kind as enum ('intake', 'label', 'evidence', 'progress', 'completion');
create type public.custody_event_type as enum (
  'received',
  'handed_to_workshop',
  'returned_to_retailer',
  'released_to_customer',
  'delivery_dispatch',
  'delivery_complete'
);
create type public.completion_review_status as enum ('pending', 'approved', 'changes_requested');
create type public.alteration_fulfillment_method as enum ('pickup', 'delivery');
create type public.alteration_fulfillment_status as enum ('scheduled', 'ready', 'dispatched', 'completed', 'canceled');

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null,
  status public.workshop_status not null default 'active',
  email text,
  phone text,
  address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, name)
);

alter table public.retailer_staff_members
  add column workshop_id uuid references public.workshops (id) on delete set null;

alter table public.retailer_staff_members
  add constraint retailer_staff_workshop_role_check check (
    (role in ('workshop_manager', 'worker') and workshop_id is not null)
    or (role not in ('workshop_manager', 'worker') and workshop_id is null)
  ) not valid;

alter table public.retailer_staff_members
  validate constraint retailer_staff_workshop_role_check;

create unique index one_active_retailer_staff_membership_per_user_idx
  on public.retailer_staff_members (user_id)
  where user_id is not null and deleted_at is null;

create table public.alteration_catalogue_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alteration_operations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.alteration_catalogue_categories (id) on delete restrict,
  code text not null unique,
  name text not null,
  description text not null default '',
  default_duration_minutes integer,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retailer_alteration_category_settings (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  category_id uuid not null references public.alteration_catalogue_categories (id) on delete cascade,
  enabled boolean not null default true,
  updated_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (retailer_id, category_id)
);

create table public.retailer_alteration_operation_settings (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  operation_id uuid not null references public.alteration_operations (id) on delete cascade,
  enabled boolean not null default true,
  updated_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (retailer_id, operation_id)
);

create table public.alteration_price_lists (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  workshop_id uuid references public.workshops (id) on delete cascade,
  kind public.alteration_price_list_kind not null,
  name text not null,
  currency text not null,
  effective_from date not null default current_date,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (kind = 'retailer' and workshop_id is null)
    or (kind = 'workshop' and workshop_id is not null)
  ),
  check (effective_until is null or effective_until >= effective_from)
);

create table public.alteration_price_list_items (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  price_list_id uuid not null references public.alteration_price_lists (id) on delete cascade,
  operation_id uuid not null references public.alteration_operations (id) on delete restrict,
  amount_minor_units integer not null check (amount_minor_units between 0 and 100000000),
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_list_id, operation_id)
);

create unique index one_alteration_price_list_per_scope_and_start_idx
  on public.alteration_price_lists (
    retailer_id,
    kind,
    coalesce(workshop_id, '00000000-0000-0000-0000-000000000000'::uuid),
    effective_from
  )
  where deleted_at is null;

create table public.physical_garments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  source_kind public.garment_source_kind not null,
  category_code text not null,
  garment_type text not null,
  brand text,
  description text not null,
  identifying_photo_url text,
  label_metadata jsonb not null default '{}'::jsonb,
  intake_condition text not null,
  external_reference text,
  order_line_id uuid references public.order_lines (id) on delete set null,
  supplier_order_reference text,
  identification_state public.garment_identification_state not null default 'verified',
  legacy_alteration_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    source_kind = 'external'
    or order_line_id is not null
    or supplier_order_reference is not null
  )
);

create table public.fitting_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  fitted_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.fitting_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  fitting_session_id uuid not null references public.fitting_sessions (id) on delete restrict,
  physical_garment_id uuid not null references public.physical_garments (id) on delete restrict,
  classification public.work_classification not null,
  area text not null,
  observation text not null,
  recorded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create sequence public.alteration_work_order_number_seq;

create or replace function public.next_alteration_work_order_number()
returns text
language sql
volatile
as $$
  select 'ALT-' || to_char(nextval('public.alteration_work_order_number_seq'), 'FM000000')
$$;

create table public.alteration_work_orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  physical_garment_id uuid not null references public.physical_garments (id) on delete restrict,
  fitting_session_id uuid references public.fitting_sessions (id) on delete set null,
  work_order_number text not null default public.next_alteration_work_order_number(),
  status public.alteration_work_order_status not null default 'intake',
  original_quote_amount_minor_units integer not null default 0 check (original_quote_amount_minor_units >= 0),
  original_quote_currency text not null,
  agreed_total_amount_minor_units integer check (agreed_total_amount_minor_units >= 0),
  agreed_total_currency text,
  due_date date,
  customer_notification_ready_at timestamptz,
  customer_notified_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, work_order_number),
  check (
    (agreed_total_amount_minor_units is null and agreed_total_currency is null)
    or (agreed_total_amount_minor_units is not null and agreed_total_currency is not null)
  ),
  check (
    (status = 'canceled' and canceled_at is not null and cancellation_reason is not null)
    or status <> 'canceled'
  )
);

create table public.alteration_tasks (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  operation_id uuid references public.alteration_operations (id) on delete restrict,
  title text not null,
  instructions text,
  classification public.work_classification not null,
  status public.alteration_task_status not null default 'proposed',
  original_quote_amount_minor_units integer not null default 0 check (original_quote_amount_minor_units >= 0),
  original_quote_currency text not null,
  agreed_price_amount_minor_units integer check (agreed_price_amount_minor_units >= 0),
  agreed_price_currency text,
  assigned_worker_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (classification = 'work_now' or assigned_worker_id is null),
  check (
    (agreed_price_amount_minor_units is null and agreed_price_currency is null)
    or (agreed_price_amount_minor_units is not null and agreed_price_currency is not null)
  )
);

create table public.work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  assigned_worker_id uuid references public.retailer_staff_members (id) on delete set null,
  assigned_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  target_completion_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alteration_task_notes (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid not null references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 2000),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index one_active_work_order_assignment_idx
  on public.work_order_assignments (alteration_id) where active;

create table public.alteration_status_history (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  from_status public.alteration_work_order_status,
  to_status public.alteration_work_order_status not null,
  note text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.alteration_pricing_history (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  event_type text not null check (event_type in ('original_quote', 'proposal', 'approval', 'rejection', 'withdrawal', 'price_list_change')),
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency text not null,
  reason text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.price_change_proposals (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  original_amount_minor_units integer not null check (original_amount_minor_units between 0 and 100000000),
  proposed_amount_minor_units integer not null check (proposed_amount_minor_units between 0 and 100000000),
  currency text not null,
  explanation text not null check (length(trim(explanation)) >= 10),
  status public.price_change_proposal_status not null default 'pending',
  proposed_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  decided_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (status in ('approved', 'rejected') and decided_by_staff_id is not null and decided_at is not null and decision_reason is not null)
    or status in ('pending', 'withdrawn')
  )
);

create table public.alteration_attachments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  alteration_id uuid references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  observation_id uuid references public.fitting_observations (id) on delete restrict,
  proposal_id uuid references public.price_change_proposals (id) on delete restrict,
  physical_garment_id uuid references public.physical_garments (id) on delete restrict,
  kind public.alteration_attachment_kind not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(alteration_id, task_id, observation_id, proposal_id, physical_garment_id) >= 1),
  unique (storage_bucket, storage_path)
);

alter table public.price_change_proposals
  add column evidence_attachment_id uuid references public.alteration_attachments (id) on delete set null;

create table public.chain_of_custody_events (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  event_type public.custody_event_type not null,
  from_party text,
  to_party text,
  condition_note text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create table public.completion_reviews (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status public.completion_review_status not null default 'pending',
  notes text,
  reviewed_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.alteration_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  method public.alteration_fulfillment_method not null,
  status public.alteration_fulfillment_status not null,
  scheduled_at timestamptz,
  completed_at timestamptz,
  delivery_address jsonb,
  released_to_name text,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default now()
);

create index physical_garments_customer_idx on public.physical_garments (customer_id, created_at desc);
create index fitting_observations_garment_idx on public.fitting_observations (physical_garment_id, created_at);
create index alteration_work_orders_retailer_idx on public.alteration_work_orders (retailer_id, created_at desc);
create index alteration_work_orders_customer_idx on public.alteration_work_orders (customer_id, created_at desc);
create index alteration_tasks_work_order_idx on public.alteration_tasks (alteration_id, created_at);
create index alteration_task_notes_task_idx on public.alteration_task_notes (task_id, created_at);
create index alteration_status_history_work_order_idx on public.alteration_status_history (alteration_id, created_at);
create index alteration_pricing_history_work_order_idx on public.alteration_pricing_history (alteration_id, created_at);
create index chain_of_custody_work_order_idx on public.chain_of_custody_events (alteration_id, occurred_at);
create index price_change_proposals_work_order_idx on public.price_change_proposals (alteration_id, created_at);

create trigger set_workshops_updated_at before update on public.workshops for each row execute function public.set_updated_at();
create trigger set_alteration_catalogue_categories_updated_at before update on public.alteration_catalogue_categories for each row execute function public.set_updated_at();
create trigger set_alteration_operations_updated_at before update on public.alteration_operations for each row execute function public.set_updated_at();
create trigger set_alteration_price_lists_updated_at before update on public.alteration_price_lists for each row execute function public.set_updated_at();
create trigger set_alteration_price_list_items_updated_at before update on public.alteration_price_list_items for each row execute function public.set_updated_at();
create trigger set_physical_garments_updated_at before update on public.physical_garments for each row execute function public.set_updated_at();
create trigger set_fitting_sessions_updated_at before update on public.fitting_sessions for each row execute function public.set_updated_at();
create trigger set_alteration_work_orders_updated_at before update on public.alteration_work_orders for each row execute function public.set_updated_at();
create trigger set_alteration_tasks_updated_at before update on public.alteration_tasks for each row execute function public.set_updated_at();
create trigger set_work_order_assignments_updated_at before update on public.work_order_assignments for each row execute function public.set_updated_at();
create trigger set_price_change_proposals_updated_at before update on public.price_change_proposals for each row execute function public.set_updated_at();
create trigger set_completion_reviews_updated_at before update on public.completion_reviews for each row execute function public.set_updated_at();
create trigger set_alteration_fulfillment_events_updated_at before update on public.alteration_fulfillment_events for each row execute function public.set_updated_at();

-- Preserve every legacy alteration as a garment-backed work order. The
-- garment is explicitly marked needs_verification because the old model did
-- not capture enough identifying information to assert more.
insert into public.physical_garments (
  retailer_id, customer_id, source_kind, category_code, garment_type,
  description, intake_condition, identification_state, legacy_alteration_id,
  order_line_id, external_reference, created_at, updated_at, deleted_at
)
select
  retailer_id, customer_id, 'external', 'other', 'Unspecified garment',
  'Migrated from the Phase 3 alteration foundation; identify at the next fitting.',
  'Condition was not recorded in the legacy intake.', 'needs_verification', id,
  order_line_id, tailor_reference, created_at, updated_at, deleted_at
from public.legacy_alterations;

insert into public.alteration_work_orders (
  id, retailer_id, customer_id, physical_garment_id, work_order_number,
  status, original_quote_amount_minor_units, original_quote_currency,
  due_date, created_at, updated_at, deleted_at
)
select
  a.id, a.retailer_id, a.customer_id, g.id,
  public.next_alteration_work_order_number(),
  case a.status
    when 'requested' then 'intake'::public.alteration_work_order_status
    when 'measured' then 'quoted'::public.alteration_work_order_status
    when 'in_progress' then 'in_progress'::public.alteration_work_order_status
    when 'ready_for_fitting' then 'completion_review'::public.alteration_work_order_status
    when 'ready_for_pickup' then 'ready_for_pickup'::public.alteration_work_order_status
    when 'complete' then 'completed'::public.alteration_work_order_status
  end,
  0, r.default_currency, a.due_date, a.created_at, a.updated_at, a.deleted_at
from public.legacy_alterations a
join public.physical_garments g on g.legacy_alteration_id = a.id
join public.retailers r on r.id = a.retailer_id;

insert into public.alteration_tasks (
  alteration_id, retailer_id, title, instructions, classification, status,
  original_quote_amount_minor_units, original_quote_currency, created_at, updated_at
)
select
  a.id, a.retailer_id, 'Legacy alteration instructions', a.instructions,
  'work_now',
  case when a.status = 'complete' then 'completed'::public.alteration_task_status
       when a.status = 'in_progress' then 'in_progress'::public.alteration_task_status
       else 'proposed'::public.alteration_task_status end,
  0, r.default_currency, a.created_at, a.updated_at
from public.legacy_alterations a
join public.retailers r on r.id = a.retailer_id;

insert into public.alteration_status_history (
  alteration_id, retailer_id, from_status, to_status, note,
  actor_staff_id, customer_visible, created_at
)
select
  u.alteration_id, u.retailer_id, null,
  case u.status
    when 'requested' then 'intake'::public.alteration_work_order_status
    when 'measured' then 'quoted'::public.alteration_work_order_status
    when 'in_progress' then 'in_progress'::public.alteration_work_order_status
    when 'ready_for_fitting' then 'completion_review'::public.alteration_work_order_status
    when 'ready_for_pickup' then 'ready_for_pickup'::public.alteration_work_order_status
    when 'complete' then 'completed'::public.alteration_work_order_status
  end,
  u.note, u.staff_id, true, u.created_at
from public.legacy_alteration_updates u;

insert into public.alteration_status_history (
  alteration_id, retailer_id, to_status, note, customer_visible, created_at
)
select w.id, w.retailer_id, w.status, 'Migrated from Phase 3 foundation', true, w.created_at
from public.alteration_work_orders w
where not exists (
  select 1 from public.alteration_status_history h where h.alteration_id = w.id
);

comment on table public.physical_garments is 'A specific physical garment in PAON custody or fitting. Manufacturing specifications remain authoritative in GoCreate/supplier systems.';
comment on table public.fitting_observations is 'Append-only garment-specific fit observations, explicitly classified as work_now or future_order_note.';
comment on table public.alteration_work_orders is 'The in-store alteration aggregate. Status changes only through append-only alteration_status_history and validated transition RPCs.';
comment on table public.alteration_tasks is 'Proposed alteration operations. future_order_note tasks are retained for manual future GoCreate entry and are never assigned as current work.';
comment on table public.alteration_pricing_history is 'Immutable original quote and every proposed/decided price event.';
comment on table public.audit_log_entries is 'Immutable audit history for sensitive alteration pricing, task, handoff, release, completion and cancellation changes.';
