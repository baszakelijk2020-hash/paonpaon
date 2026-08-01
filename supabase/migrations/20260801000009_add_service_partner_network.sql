-- PHASE 12.3 (SRV-101..103): Preferred Tailoring partner network.
--
-- What this migration deliberately does NOT create, because it already
-- exists and stays canonical:
--   * bookings           -> public.service_bookings   (2026-07-30)
--   * plans/entitlements -> public.service_plans      (2026-07-30)
--   * operational cost   -> public.service_cost_records (2026-07-30)
--   * alteration custody -> public.chain_of_custody_events (2026-07-19)
--
-- `service_partner_custody_events` is a second TABLE but not a second
-- TRUTH. `chain_of_custody_events` is bound to alteration_work_orders by a
-- status-machine trigger; a wardrobe garment sent for dry cleaning has no
-- work order, so widening that table would mean rewriting a proven flow
-- for no benefit to it. Each table records a different fact. An engagement
-- that belongs to an alteration carries `alteration_id` and its custody
-- belongs in the older table — enforced in the repository, since a CHECK
-- cannot reach across tables.
--
-- Invoices reconcile AGAINST service_cost_records. No amount here is a
-- second source of what something cost, and nothing pays anything: ADR-062
-- has not decided a payout design, so there is no payout column, provider
-- reference or link to public.payments.

create table if not exists public.service_partners (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  -- Per location. A courier round-trip to another city is a different
  -- service with different economics, so a partner may be pinned to one
  -- branch; null means available to every location.
  branch_id uuid references public.retailer_branches (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  capabilities text[] not null default '{}',
  turnaround_days smallint not null check (turnaround_days between 0 and 365),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 64),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint service_partners_has_capability check (
    array_length(capabilities, 1) is not null
  )
);

create index if not exists service_partners_active_idx
  on public.service_partners (retailer_id, active)
  where deleted_at is null;

create table if not exists public.service_partner_engagements (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  partner_id uuid not null references public.service_partners (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- Reuse: the booking this engagement fulfils, when there is one.
  booking_id uuid references public.service_bookings (id) on delete set null,
  -- When set, custody belongs in chain_of_custody_events, not here.
  alteration_id uuid
    references public.alteration_work_orders (id) on delete set null,
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  physical_garment_id uuid
    references public.physical_garments (id) on delete set null,
  job_reference text not null check (char_length(btrim(job_reference)) between 1 and 64),
  capability text not null,
  instructions text not null check (char_length(btrim(instructions)) between 1 and 4000),
  sent_on date,
  due_on date not null,
  returned_on date,
  custody_state text not null default 'with_retailer' check (
    custody_state in (
      'with_retailer', 'in_transit_to_partner', 'with_partner',
      'in_transit_to_retailer', 'returned_to_retailer', 'released_to_customer'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint service_partner_engagement_reference_unique
    unique (retailer_id, job_reference),
  -- An engagement must be about a specific garment; "a bag of stuff" is
  -- how items go missing with nobody able to say which.
  constraint service_partner_engagement_has_garment check (
    wardrobe_item_id is not null
    or physical_garment_id is not null
    or alteration_id is not null
  )
);

create index if not exists service_partner_engagements_open_idx
  on public.service_partner_engagements (retailer_id, due_on)
  where custody_state <> 'released_to_customer' and deleted_at is null;

-- Append-only custody log for partner engagements. See the header note on
-- why this is not chain_of_custody_events.
create table if not exists public.service_partner_custody_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  engagement_id uuid not null
    references public.service_partner_engagements (id) on delete cascade,
  from_state text not null,
  to_state text not null,
  -- Required on the return leg by the domain layer: the moment a garment
  -- comes back is the only moment damage can be attributed.
  condition_note text check (
    condition_note is null or char_length(btrim(condition_note)) between 1 and 2000
  ),
  actor_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now(),
  constraint partner_custody_return_has_condition check (
    to_state <> 'returned_to_retailer' or condition_note is not null
  )
);

create index if not exists service_partner_custody_engagement_idx
  on public.service_partner_custody_events (engagement_id, occurred_at);

create table if not exists public.service_partner_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  engagement_id uuid not null
    references public.service_partner_engagements (id) on delete cascade,
  partner_id uuid not null references public.service_partners (id) on delete cascade,
  -- Retailer's own assessment and, separately, what the customer said.
  -- Collapsing them would let a retailer's opinion be reported as the
  -- customer's.
  retailer_rating smallint check (retailer_rating between 1 and 5),
  retailer_note text check (
    retailer_note is null or char_length(btrim(retailer_note)) <= 2000
  ),
  customer_rating smallint check (customer_rating between 1 and 5),
  customer_note text check (
    customer_note is null or char_length(btrim(customer_note)) <= 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_quality_has_content check (
    retailer_rating is not null or customer_rating is not null
  )
);

create table if not exists public.service_partner_invoices (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  partner_id uuid not null references public.service_partners (id) on delete restrict,
  partner_invoice_reference text not null
    check (char_length(btrim(partner_invoice_reference)) between 1 and 120),
  period_start date not null,
  period_end date not null,
  currency text not null check (char_length(currency) = 3),
  submitted_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  state text not null default 'submitted' check (
    state in ('submitted', 'reconciled', 'approved', 'disputed')
  ),
  approved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  approved_at timestamptz,
  reconciliation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_invoice_period check (period_end >= period_start),
  constraint partner_invoice_reference_unique
    unique (retailer_id, partner_id, partner_invoice_reference),
  -- Nobody approves their own submission.
  constraint partner_invoice_no_self_approval check (
    approved_by_staff_id is null
    or submitted_by_staff_id is null
    or approved_by_staff_id <> submitted_by_staff_id
  ),
  constraint partner_invoice_approval_complete check (
    (state = 'approved') = (approved_by_staff_id is not null and approved_at is not null)
  )
);

create table if not exists public.service_partner_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  invoice_id uuid not null
    references public.service_partner_invoices (id) on delete cascade,
  job_reference text not null check (char_length(btrim(job_reference)) between 1 and 64),
  amount_minor_units integer not null check (amount_minor_units >= 0),
  -- The cost record this line is claimed to correspond to. Nullable
  -- precisely so an unmatched line is visible as unmatched rather than
  -- being impossible to insert and therefore never surfaced.
  matched_cost_record_id uuid
    references public.service_cost_records (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_invoice_line_unique unique (invoice_id, job_reference)
);

create trigger set_service_partners_updated_at
  before update on public.service_partners
  for each row execute function public.set_updated_at();
create trigger set_service_partner_engagements_updated_at
  before update on public.service_partner_engagements
  for each row execute function public.set_updated_at();
create trigger set_service_partner_quality_reviews_updated_at
  before update on public.service_partner_quality_reviews
  for each row execute function public.set_updated_at();
create trigger set_service_partner_invoices_updated_at
  before update on public.service_partner_invoices
  for each row execute function public.set_updated_at();

alter table public.service_partners enable row level security;
alter table public.service_partner_engagements enable row level security;
alter table public.service_partner_custody_events enable row level security;
alter table public.service_partner_quality_reviews enable row level security;
alter table public.service_partner_invoices enable row level security;
alter table public.service_partner_invoice_lines enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'service_partners', 'service_partner_engagements',
    'service_partner_custody_events', 'service_partner_quality_reviews',
    'service_partner_invoices', 'service_partner_invoice_lines'
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

-- Custody events and invoice lines are append-only; the history is the
-- point, and an editable custody log cannot settle a damage dispute.
grant insert on table public.service_partner_custody_events
  to authenticated, service_role;
grant insert on table public.service_partner_invoice_lines
  to authenticated, service_role;
grant insert, update on table public.service_partners
  to authenticated, service_role;
grant insert, update on table public.service_partner_engagements
  to authenticated, service_role;
grant insert, update on table public.service_partner_quality_reviews
  to authenticated, service_role;
grant insert, update on table public.service_partner_invoices
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'service_partners', 'service_partner_engagements',
    'service_partner_quality_reviews', 'service_partner_invoices'
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

comment on table public.service_partner_custody_events is
  'PHASE 12.3 partner custody. NOT a duplicate of chain_of_custody_events: '
  'that table is bound to alteration_work_orders by a status trigger and '
  'covers a different fact. One garment movement is never in both.';
comment on table public.service_partner_invoices is
  'PHASE 12.3 partner invoicing. Reconciles against service_cost_records '
  'and pays nothing - ADR-062 has not decided a payout design.';
