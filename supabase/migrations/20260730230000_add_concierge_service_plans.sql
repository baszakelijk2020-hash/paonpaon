-- PHASE 5.3 — Preferred Tailoring and HighMaintenance operations
-- (SERV-001, SERV-002, LONG-001; ADR-062).
-- Dedicated concierge service plans, non-monetary entitlements/credits,
-- bookings, fulfilment, care/repair, collection/delivery, operational cost
-- recording, and advisor ownership. Compose appointments/alterations —
-- never overload Order or invent payment/stored value.

-- ---------------------------------------------------------------------------
-- service_plans
-- ---------------------------------------------------------------------------

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in ('preferred_tailoring', 'high_maintenance')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'archived')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  explanation text not null check (
    char_length(btrim(explanation)) between 1 and 500
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_plans_id_retailer_uidx unique (id, retailer_id)
);

create trigger set_service_plans_updated_at
  before update on public.service_plans
  for each row execute function public.set_updated_at();

create index if not exists service_plans_retailer_status_idx
  on public.service_plans (retailer_id, status, kind);

comment on table public.service_plans is
  'Preferred Tailoring / HighMaintenance plan templates (PHASE 5.3). Operational state only — billing is ADR-062.';

alter table public.service_plans enable row level security;
revoke all on table public.service_plans from anon;

create policy "retailer staff read tenant service plans"
  on public.service_plans for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer managers write tenant service plans"
  on public.service_plans for all to authenticated
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

create policy "customers read active tenant service plans"
  on public.service_plans for select to authenticated
  using (
    status = 'active'
    and exists (
      select 1 from public.customers c
      where c.retailer_id = service_plans.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service plans"
  on public.service_plans for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_plans to authenticated, service_role;
grant insert, update, delete on table public.service_plans to authenticated;
grant all on table public.service_plans to service_role;

-- ---------------------------------------------------------------------------
-- service_memberships
-- ---------------------------------------------------------------------------

create table if not exists public.service_memberships (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  advisor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  status text not null default 'active' check (
    status in ('active', 'paused', 'ended')
  ),
  commitment_notes text check (
    commitment_notes is null
    or char_length(btrim(commitment_notes)) between 1 and 1000
  ),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_memberships_plan_fk
    foreign key (plan_id, retailer_id)
    references public.service_plans (id, retailer_id)
    on delete cascade,
  constraint service_memberships_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_memberships_ended_ck check (
    (status = 'ended' and ended_at is not null)
    or (status <> 'ended' and ended_at is null)
  ),
  constraint service_memberships_id_retailer_uidx unique (id, retailer_id),
  constraint service_memberships_active_uidx
    unique (plan_id, customer_id)
);

create trigger set_service_memberships_updated_at
  before update on public.service_memberships
  for each row execute function public.set_updated_at();

create index if not exists service_memberships_customer_idx
  on public.service_memberships (customer_id, status);

create index if not exists service_memberships_advisor_idx
  on public.service_memberships (advisor_staff_id)
  where advisor_staff_id is not null;

comment on table public.service_memberships is
  'Customer enrollment on a Preferred Tailoring or HighMaintenance plan with advisor ownership (PHASE 5.3).';

alter table public.service_memberships enable row level security;
revoke all on table public.service_memberships from anon;

create policy "retailer staff read tenant service memberships"
  on public.service_memberships for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service memberships"
  on public.service_memberships for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service memberships"
  on public.service_memberships for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_memberships.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service memberships"
  on public.service_memberships for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_memberships to authenticated, service_role;
grant insert, update, delete on table public.service_memberships to authenticated;
grant all on table public.service_memberships to service_role;

-- ---------------------------------------------------------------------------
-- service_entitlements (non-monetary remaining credits)
-- ---------------------------------------------------------------------------

create table if not exists public.service_entitlements (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind text not null check (
    kind in (
      'planning_session',
      'wardrobe_review',
      'pressing_visit',
      'cleaning_visit',
      'repair_visit',
      'collection_delivery',
      'size_check',
      'button_pleat_check',
      'general_care'
    )
  ),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_entitlements_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_entitlements_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_entitlements_kind_uidx
    unique (membership_id, kind),
  constraint service_entitlements_id_retailer_uidx unique (id, retailer_id)
);

create trigger set_service_entitlements_updated_at
  before update on public.service_entitlements
  for each row execute function public.set_updated_at();

comment on table public.service_entitlements is
  'Non-monetary concierge credits — never stored value or tender (PHASE 5.3 / ADR-062).';

alter table public.service_entitlements enable row level security;
revoke all on table public.service_entitlements from anon;

create policy "retailer staff read tenant service entitlements"
  on public.service_entitlements for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service entitlements"
  on public.service_entitlements for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_entitlements.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service entitlements"
  on public.service_entitlements for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_entitlements to authenticated, service_role;
grant all on table public.service_entitlements to service_role;

-- ---------------------------------------------------------------------------
-- service_entitlement_entries (append-only grant/consume ledger)
-- ---------------------------------------------------------------------------

create table if not exists public.service_entitlement_entries (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null,
  membership_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  entry_kind text not null check (entry_kind in ('grant', 'consume', 'adjust')),
  quantity integer not null check (quantity > 0 and quantity <= 100),
  idempotency_key text not null check (
    char_length(btrim(idempotency_key)) between 1 and 200
  ),
  booking_id uuid,
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 500
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint service_entitlement_entries_entitlement_fk
    foreign key (entitlement_id, retailer_id)
    references public.service_entitlements (id, retailer_id)
    on delete cascade,
  constraint service_entitlement_entries_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_entitlement_entries_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_entitlement_entries_idempotency_uidx
    unique (membership_id, entry_kind, idempotency_key)
);

create index if not exists service_entitlement_entries_membership_idx
  on public.service_entitlement_entries (membership_id, created_at desc);

comment on table public.service_entitlement_entries is
  'Append-only non-monetary entitlement grant/consume audit with idempotency (PHASE 5.3).';

alter table public.service_entitlement_entries enable row level security;
revoke all on table public.service_entitlement_entries from anon;

create policy "retailer staff read tenant entitlement entries"
  on public.service_entitlement_entries for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own entitlement entries"
  on public.service_entitlement_entries for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_entitlement_entries.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read entitlement entries"
  on public.service_entitlement_entries for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_entitlement_entries
  to authenticated, service_role;
grant all on table public.service_entitlement_entries to service_role;

-- ---------------------------------------------------------------------------
-- service_bookings
-- ---------------------------------------------------------------------------

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  plan_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  advisor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  kind text not null check (
    kind in (
      'planning',
      'wardrobe_review',
      'pressing',
      'cleaning',
      'repair',
      'collection',
      'delivery',
      'size_check',
      'button_check',
      'care'
    )
  ),
  status text not null default 'requested' check (
    status in (
      'requested',
      'confirmed',
      'in_progress',
      'fulfilled',
      'canceled'
    )
  ),
  requested_for timestamptz,
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 1000
  ),
  commitment_notes text check (
    commitment_notes is null
    or char_length(btrim(commitment_notes)) between 1 and 1000
  ),
  appointment_id uuid references public.appointments (id) on delete set null,
  entitlement_entry_id uuid,
  request_idempotency_key text not null check (
    char_length(btrim(request_idempotency_key)) between 1 and 200
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_bookings_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_bookings_plan_fk
    foreign key (plan_id, retailer_id)
    references public.service_plans (id, retailer_id)
    on delete cascade,
  constraint service_bookings_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_bookings_id_retailer_uidx unique (id, retailer_id),
  constraint service_bookings_request_idempotency_uidx
    unique (membership_id, request_idempotency_key)
);

create trigger set_service_bookings_updated_at
  before update on public.service_bookings
  for each row execute function public.set_updated_at();

create index if not exists service_bookings_customer_idx
  on public.service_bookings (customer_id, created_at desc);

create index if not exists service_bookings_status_idx
  on public.service_bookings (retailer_id, status, kind);

create index if not exists service_bookings_appointment_idx
  on public.service_bookings (appointment_id)
  where appointment_id is not null;

comment on table public.service_bookings is
  'Concierge service bookings composing optional appointments — not order statuses (PHASE 5.3).';

alter table public.service_bookings enable row level security;
revoke all on table public.service_bookings from anon;

create policy "retailer staff read tenant service bookings"
  on public.service_bookings for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service bookings"
  on public.service_bookings for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service bookings"
  on public.service_bookings for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_bookings.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service bookings"
  on public.service_bookings for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_bookings to authenticated, service_role;
grant insert, update, delete on table public.service_bookings to authenticated;
grant all on table public.service_bookings to service_role;

-- Late FK for entitlement_entry_id (bookings <-> entries)
alter table public.service_entitlement_entries
  drop constraint if exists service_entitlement_entries_booking_fk;
alter table public.service_entitlement_entries
  add constraint service_entitlement_entries_booking_fk
  foreign key (booking_id)
  references public.service_bookings (id)
  on delete set null;

alter table public.service_bookings
  drop constraint if exists service_bookings_entitlement_entry_fk;
alter table public.service_bookings
  add constraint service_bookings_entitlement_entry_fk
  foreign key (entitlement_entry_id)
  references public.service_entitlement_entries (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- service_fulfilment_events
-- ---------------------------------------------------------------------------

create table if not exists public.service_fulfilment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  method text not null check (
    method in ('in_store', 'pickup', 'collection', 'delivery')
  ),
  status text not null default 'scheduled' check (
    status in (
      'scheduled',
      'in_transit',
      'received',
      'returned',
      'completed',
      'canceled'
    )
  ),
  scheduled_for timestamptz,
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 1000
  ),
  recorded_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint service_fulfilment_events_booking_fk
    foreign key (booking_id, retailer_id)
    references public.service_bookings (id, retailer_id)
    on delete cascade,
  constraint service_fulfilment_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists service_fulfilment_events_booking_idx
  on public.service_fulfilment_events (booking_id, created_at desc);

comment on table public.service_fulfilment_events is
  'Collection/delivery/fulfilment commitments for concierge bookings (PHASE 5.3). No automatic routing.';

alter table public.service_fulfilment_events enable row level security;
revoke all on table public.service_fulfilment_events from anon;

create policy "retailer staff read tenant service fulfilment"
  on public.service_fulfilment_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service fulfilment"
  on public.service_fulfilment_events for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service fulfilment"
  on public.service_fulfilment_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_fulfilment_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service fulfilment"
  on public.service_fulfilment_events for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_fulfilment_events
  to authenticated, service_role;
grant insert on table public.service_fulfilment_events to authenticated;
grant all on table public.service_fulfilment_events to service_role;

-- ---------------------------------------------------------------------------
-- service_care_records
-- ---------------------------------------------------------------------------

create table if not exists public.service_care_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  membership_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  care_kind text not null check (
    care_kind in (
      'pressing',
      'cleaning',
      'repair',
      'button_check',
      'pleat_maintenance',
      'size_check',
      'care_note'
    )
  ),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  physical_garment_id uuid references public.physical_garments (id)
    on delete set null,
  alteration_id uuid references public.alteration_work_orders (id)
    on delete set null,
  recorded_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint service_care_records_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_care_records_booking_fk
    foreign key (booking_id, retailer_id)
    references public.service_bookings (id, retailer_id)
    on delete set null,
  constraint service_care_records_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists service_care_records_membership_idx
  on public.service_care_records (membership_id, created_at desc);

create index if not exists service_care_records_alteration_idx
  on public.service_care_records (alteration_id)
  where alteration_id is not null;

comment on table public.service_care_records is
  'Care/repair records composing wardrobe items and optional alterations (PHASE 5.3 / LONG-001).';

alter table public.service_care_records enable row level security;
revoke all on table public.service_care_records from anon;

create policy "retailer staff read tenant service care"
  on public.service_care_records for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service care"
  on public.service_care_records for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service care"
  on public.service_care_records for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_care_records.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service care"
  on public.service_care_records for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_care_records to authenticated, service_role;
grant insert on table public.service_care_records to authenticated;
grant all on table public.service_care_records to service_role;

-- ---------------------------------------------------------------------------
-- service_cost_records (operational cost recording — not payment collection)
-- ---------------------------------------------------------------------------

create table if not exists public.service_cost_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  membership_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  amount_minor_units integer not null check (
    amount_minor_units >= 0 and amount_minor_units <= 100000000
  ),
  currency text not null check (
    currency in ('USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AED', 'HKD', 'SGD')
  ),
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 500
  ),
  recorded_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint service_cost_records_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_cost_records_booking_fk
    foreign key (booking_id, retailer_id)
    references public.service_bookings (id, retailer_id)
    on delete set null,
  constraint service_cost_records_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists service_cost_records_membership_idx
  on public.service_cost_records (membership_id, created_at desc);

comment on table public.service_cost_records is
  'Operational service cost recording only — not payment, custody, or stored value (PHASE 5.3 / ADR-062).';

alter table public.service_cost_records enable row level security;
revoke all on table public.service_cost_records from anon;

create policy "retailer staff read tenant service costs"
  on public.service_cost_records for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service costs"
  on public.service_cost_records for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service costs"
  on public.service_cost_records for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_cost_records.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service costs"
  on public.service_cost_records for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_cost_records to authenticated, service_role;
grant insert on table public.service_cost_records to authenticated;
grant all on table public.service_cost_records to service_role;

-- ---------------------------------------------------------------------------
-- service_history_events (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.service_history_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  membership_id uuid,
  booking_id uuid,
  kind text not null check (
    kind in (
      'plan_created',
      'membership_opened',
      'membership_paused',
      'membership_ended',
      'entitlement_granted',
      'entitlement_consumed',
      'booking_requested',
      'booking_confirmed',
      'booking_fulfilled',
      'booking_canceled',
      'fulfilment_recorded',
      'care_recorded',
      'cost_recorded',
      'appointment_linked',
      'alteration_linked',
      'advisor_assigned'
    )
  ),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  recorded_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint service_history_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists service_history_events_customer_idx
  on public.service_history_events (customer_id, created_at desc);

create index if not exists service_history_events_membership_idx
  on public.service_history_events (membership_id, created_at desc)
  where membership_id is not null;

comment on table public.service_history_events is
  'Append-only concierge service history audit (PHASE 5.3).';

alter table public.service_history_events enable row level security;
revoke all on table public.service_history_events from anon;

create policy "retailer staff read tenant service history"
  on public.service_history_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service history"
  on public.service_history_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_history_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service history"
  on public.service_history_events for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_history_events
  to authenticated, service_role;
grant all on table public.service_history_events to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._service_history_insert(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_membership_id uuid,
  p_booking_id uuid,
  p_kind text,
  p_summary text,
  p_staff_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.service_history_events (
    retailer_id,
    customer_id,
    membership_id,
    booking_id,
    kind,
    summary,
    recorded_by_staff_id
  ) values (
    p_retailer_id,
    p_customer_id,
    p_membership_id,
    p_booking_id,
    p_kind,
    p_summary,
    p_staff_id
  );
end;
$$;

revoke all on function public._service_history_insert(
  uuid, uuid, uuid, uuid, text, text, uuid
) from public;

create or replace function public._service_assert_staff_retailer(
  p_retailer_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  if (select public.current_retailer_id()) is distinct from p_retailer_id then
    raise exception 'Not authorized for retailer';
  end if;
  if (select public.current_retailer_role()) not in (
    'sales_associate', 'manager', 'admin', 'owner'
  ) then
    raise exception 'Staff role required';
  end if;
  select id into v_staff_id
  from public.retailer_staff_members
  where user_id = (select auth.uid())
    and retailer_id = p_retailer_id
    and deleted_at is null
  limit 1;
  return v_staff_id;
end;
$$;

revoke all on function public._service_assert_staff_retailer(uuid) from public;

create or replace function public._service_booking_kind_allowed(
  p_plan_kind text,
  p_booking_kind text
) returns boolean
language sql
immutable
as $$
  select case p_plan_kind
    when 'preferred_tailoring' then p_booking_kind in (
      'planning', 'wardrobe_review'
    )
    when 'high_maintenance' then p_booking_kind in (
      'pressing',
      'cleaning',
      'repair',
      'collection',
      'delivery',
      'size_check',
      'button_check',
      'care'
    )
    else false
  end;
$$;

create or replace function public._service_entitlement_for_booking(
  p_booking_kind text
) returns text
language sql
immutable
as $$
  select case p_booking_kind
    when 'planning' then 'planning_session'
    when 'wardrobe_review' then 'wardrobe_review'
    when 'pressing' then 'pressing_visit'
    when 'cleaning' then 'cleaning_visit'
    when 'repair' then 'repair_visit'
    when 'collection' then 'collection_delivery'
    when 'delivery' then 'collection_delivery'
    when 'size_check' then 'size_check'
    when 'button_check' then 'button_pleat_check'
    when 'care' then 'general_care'
    else null
  end;
$$;

create or replace function public._service_can_transition_booking(
  p_from text,
  p_to text
) returns boolean
language sql
immutable
as $$
  select case p_from
    when 'requested' then p_to in ('confirmed', 'canceled')
    when 'confirmed' then p_to in ('in_progress', 'canceled')
    when 'in_progress' then p_to in ('fulfilled', 'canceled')
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: enroll_service_membership (staff)
-- ---------------------------------------------------------------------------

create or replace function public.enroll_service_membership(
  p_plan_id uuid,
  p_customer_id uuid,
  p_advisor_staff_id uuid default null,
  p_commitment_notes text default null,
  p_seed_default_entitlements boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.service_plans%rowtype;
  v_staff_id uuid;
  v_membership_id uuid;
  v_defaults jsonb;
  v_item jsonb;
  v_entitlement_id uuid;
begin
  select * into v_plan from public.service_plans where id = p_plan_id;
  if not found then
    raise exception 'Service plan not found';
  end if;
  if v_plan.status <> 'active' then
    raise exception 'Service plan is not active';
  end if;

  v_staff_id := public._service_assert_staff_retailer(v_plan.retailer_id);

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = v_plan.retailer_id
      and c.deleted_at is null
  ) then
    raise exception 'Customer not found for retailer';
  end if;

  insert into public.service_memberships (
    plan_id,
    retailer_id,
    customer_id,
    advisor_staff_id,
    status,
    commitment_notes
  ) values (
    p_plan_id,
    v_plan.retailer_id,
    p_customer_id,
    coalesce(p_advisor_staff_id, v_staff_id),
    'active',
    p_commitment_notes
  )
  on conflict (plan_id, customer_id) do update set
    status = 'active',
    ended_at = null,
    advisor_staff_id = coalesce(
      excluded.advisor_staff_id,
      service_memberships.advisor_staff_id
    ),
    commitment_notes = coalesce(
      excluded.commitment_notes,
      service_memberships.commitment_notes
    ),
    updated_at = now()
  returning id into v_membership_id;

  perform public._service_history_insert(
    v_plan.retailer_id,
    p_customer_id,
    v_membership_id,
    null,
    'membership_opened',
    'Membership opened on ' || v_plan.title,
    v_staff_id
  );

  if p_seed_default_entitlements then
    v_defaults := case v_plan.kind
      when 'preferred_tailoring' then
        '[{"kind":"planning_session","quantity":4},{"kind":"wardrobe_review","quantity":2}]'::jsonb
      when 'high_maintenance' then
        '[{"kind":"pressing_visit","quantity":8},{"kind":"cleaning_visit","quantity":4},{"kind":"repair_visit","quantity":2},{"kind":"collection_delivery","quantity":8},{"kind":"size_check","quantity":2},{"kind":"button_pleat_check","quantity":4}]'::jsonb
      else '[]'::jsonb
    end;

    for v_item in select * from jsonb_array_elements(v_defaults)
    loop
      if exists (
        select 1
        from public.service_entitlement_entries e
        where e.membership_id = v_membership_id
          and e.entry_kind = 'grant'
          and e.idempotency_key =
            'seed:' || v_membership_id::text || ':' || (v_item->>'kind')
      ) then
        continue;
      end if;

      insert into public.service_entitlements (
        membership_id,
        retailer_id,
        customer_id,
        kind,
        remaining_quantity
      ) values (
        v_membership_id,
        v_plan.retailer_id,
        p_customer_id,
        v_item->>'kind',
        (v_item->>'quantity')::integer
      )
      on conflict (membership_id, kind) do update set
        remaining_quantity = service_entitlements.remaining_quantity
          + excluded.remaining_quantity,
        updated_at = now()
      returning id into v_entitlement_id;

      insert into public.service_entitlement_entries (
        entitlement_id,
        membership_id,
        retailer_id,
        customer_id,
        entry_kind,
        quantity,
        idempotency_key,
        notes,
        created_by_staff_id
      ) values (
        v_entitlement_id,
        v_membership_id,
        v_plan.retailer_id,
        p_customer_id,
        'grant',
        (v_item->>'quantity')::integer,
        'seed:' || v_membership_id::text || ':' || (v_item->>'kind'),
        'Default plan entitlement grant',
        v_staff_id
      );

      perform public._service_history_insert(
        v_plan.retailer_id,
        p_customer_id,
        v_membership_id,
        null,
        'entitlement_granted',
        'Granted ' || (v_item->>'quantity') || ' ' || (v_item->>'kind'),
        v_staff_id
      );
    end loop;
  end if;

  return v_membership_id;
end;
$$;

revoke all on function public.enroll_service_membership(
  uuid, uuid, uuid, text, boolean
) from public;
grant execute on function public.enroll_service_membership(
  uuid, uuid, uuid, text, boolean
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: grant_service_entitlement (staff)
-- ---------------------------------------------------------------------------

create or replace function public.grant_service_entitlement(
  p_membership_id uuid,
  p_kind text,
  p_quantity integer,
  p_idempotency_key text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
  v_entitlement_id uuid;
  v_entry_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'Invalid entitlement quantity';
  end if;

  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;

  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  select id into v_entry_id
  from public.service_entitlement_entries
  where membership_id = p_membership_id
    and entry_kind = 'grant'
    and idempotency_key = p_idempotency_key;
  if found then
    return v_entry_id;
  end if;

  insert into public.service_entitlements (
    membership_id,
    retailer_id,
    customer_id,
    kind,
    remaining_quantity
  ) values (
    p_membership_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    p_kind,
    p_quantity
  )
  on conflict (membership_id, kind) do update set
    remaining_quantity = service_entitlements.remaining_quantity + p_quantity,
    updated_at = now()
  returning id into v_entitlement_id;

  insert into public.service_entitlement_entries (
    entitlement_id,
    membership_id,
    retailer_id,
    customer_id,
    entry_kind,
    quantity,
    idempotency_key,
    notes,
    created_by_staff_id
  ) values (
    v_entitlement_id,
    p_membership_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    'grant',
    p_quantity,
    p_idempotency_key,
    p_notes,
    v_staff_id
  )
  returning id into v_entry_id;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    null,
    'entitlement_granted',
    'Granted ' || p_quantity::text || ' ' || p_kind,
    v_staff_id
  );

  return v_entry_id;
end;
$$;

revoke all on function public.grant_service_entitlement(
  uuid, text, integer, text, text
) from public;
grant execute on function public.grant_service_entitlement(
  uuid, text, integer, text, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: request_service_booking (customer or staff)
-- ---------------------------------------------------------------------------

create or replace function public.request_service_booking(
  p_membership_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_requested_for timestamptz default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_plan public.service_plans%rowtype;
  v_customer public.customers%rowtype;
  v_staff_id uuid;
  v_booking_id uuid;
  v_is_staff boolean := false;
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  if v_membership.status <> 'active' then
    raise exception 'Membership is not active';
  end if;

  select * into v_plan from public.service_plans where id = v_membership.plan_id;
  if not found or v_plan.status <> 'active' then
    raise exception 'Service plan is not active';
  end if;

  if not public._service_booking_kind_allowed(v_plan.kind, p_kind) then
    raise exception 'Booking kind not allowed for this service';
  end if;

  select * into v_customer
  from public.customers
  where id = v_membership.customer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found';
  end if;

  if (select public.current_retailer_id()) is not distinct from v_membership.retailer_id
     and (select public.current_retailer_role()) in (
       'sales_associate', 'manager', 'admin', 'owner'
     )
  then
    v_is_staff := true;
    v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);
  elsif v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to request service booking';
  end if;

  select id into v_booking_id
  from public.service_bookings
  where membership_id = p_membership_id
    and request_idempotency_key = p_idempotency_key;
  if found then
    return v_booking_id;
  end if;

  insert into public.service_bookings (
    membership_id,
    plan_id,
    retailer_id,
    customer_id,
    advisor_staff_id,
    kind,
    status,
    requested_for,
    notes,
    request_idempotency_key
  ) values (
    p_membership_id,
    v_membership.plan_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    coalesce(v_membership.advisor_staff_id, v_staff_id),
    p_kind,
    'requested',
    p_requested_for,
    p_notes,
    p_idempotency_key
  )
  returning id into v_booking_id;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    v_booking_id,
    'booking_requested',
    'Booking requested: ' || p_kind,
    v_staff_id
  );

  return v_booking_id;
end;
$$;

revoke all on function public.request_service_booking(
  uuid, text, text, timestamptz, text
) from public;
grant execute on function public.request_service_booking(
  uuid, text, text, timestamptz, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: transition_service_booking (staff; consumes entitlement on confirm)
-- ---------------------------------------------------------------------------

create or replace function public.transition_service_booking(
  p_booking_id uuid,
  p_status text,
  p_commitment_notes text default null,
  p_consume_entitlement boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.service_bookings%rowtype;
  v_staff_id uuid;
  v_entitlement_kind text;
  v_entitlement public.service_entitlements%rowtype;
  v_entry_id uuid;
  v_history_kind text;
begin
  select * into v_booking from public.service_bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  v_staff_id := public._service_assert_staff_retailer(v_booking.retailer_id);

  if not public._service_can_transition_booking(v_booking.status, p_status) then
    raise exception 'Invalid booking status transition';
  end if;

  if p_status = 'confirmed'
     and p_consume_entitlement
     and v_booking.entitlement_entry_id is null
  then
    v_entitlement_kind := public._service_entitlement_for_booking(v_booking.kind);
    if v_entitlement_kind is not null then
      select id into v_entry_id
      from public.service_entitlement_entries
      where membership_id = v_booking.membership_id
        and entry_kind = 'consume'
        and idempotency_key = 'consume:booking:' || p_booking_id::text;
      if not found then
        select * into v_entitlement
        from public.service_entitlements
        where membership_id = v_booking.membership_id
          and kind = v_entitlement_kind
        for update;
        if not found or v_entitlement.remaining_quantity < 1 then
          raise exception 'Insufficient entitlement for booking';
        end if;

        update public.service_entitlements
        set remaining_quantity = remaining_quantity - 1,
            updated_at = now()
        where id = v_entitlement.id;

        insert into public.service_entitlement_entries (
          entitlement_id,
          membership_id,
          retailer_id,
          customer_id,
          entry_kind,
          quantity,
          idempotency_key,
          booking_id,
          notes,
          created_by_staff_id
        ) values (
          v_entitlement.id,
          v_booking.membership_id,
          v_booking.retailer_id,
          v_booking.customer_id,
          'consume',
          1,
          'consume:booking:' || p_booking_id::text,
          p_booking_id,
          'Consumed on booking confirmation',
          v_staff_id
        )
        returning id into v_entry_id;

        perform public._service_history_insert(
          v_booking.retailer_id,
          v_booking.customer_id,
          v_booking.membership_id,
          p_booking_id,
          'entitlement_consumed',
          'Consumed 1 ' || v_entitlement_kind,
          v_staff_id
        );
      end if;
    end if;
  end if;

  update public.service_bookings
  set status = p_status,
      commitment_notes = coalesce(p_commitment_notes, commitment_notes),
      entitlement_entry_id = coalesce(entitlement_entry_id, v_entry_id),
      updated_at = now()
  where id = p_booking_id;

  v_history_kind := case p_status
    when 'confirmed' then 'booking_confirmed'
    when 'fulfilled' then 'booking_fulfilled'
    when 'canceled' then 'booking_canceled'
    else 'booking_confirmed'
  end;

  perform public._service_history_insert(
    v_booking.retailer_id,
    v_booking.customer_id,
    v_booking.membership_id,
    p_booking_id,
    v_history_kind,
    'Booking ' || p_status,
    v_staff_id
  );

  return p_booking_id;
end;
$$;

revoke all on function public.transition_service_booking(
  uuid, text, text, boolean
) from public;
grant execute on function public.transition_service_booking(
  uuid, text, text, boolean
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: link_service_booking_appointment (staff)
-- ---------------------------------------------------------------------------

create or replace function public.link_service_booking_appointment(
  p_booking_id uuid,
  p_appointment_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.service_bookings%rowtype;
  v_appointment public.appointments%rowtype;
  v_staff_id uuid;
begin
  select * into v_booking from public.service_bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_booking.retailer_id);

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_appointment.retailer_id is distinct from v_booking.retailer_id
     or v_appointment.customer_id is distinct from v_booking.customer_id
  then
    raise exception 'Appointment must match booking retailer and customer';
  end if;

  update public.service_bookings
  set appointment_id = p_appointment_id,
      updated_at = now()
  where id = p_booking_id;

  perform public._service_history_insert(
    v_booking.retailer_id,
    v_booking.customer_id,
    v_booking.membership_id,
    p_booking_id,
    'appointment_linked',
    'Linked appointment ' || p_appointment_id::text,
    v_staff_id
  );

  return p_booking_id;
end;
$$;

revoke all on function public.link_service_booking_appointment(uuid, uuid)
  from public;
grant execute on function public.link_service_booking_appointment(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_service_fulfilment (staff)
-- ---------------------------------------------------------------------------

create or replace function public.record_service_fulfilment(
  p_booking_id uuid,
  p_method text,
  p_status text default 'scheduled',
  p_scheduled_for timestamptz default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.service_bookings%rowtype;
  v_staff_id uuid;
  v_id uuid;
begin
  select * into v_booking from public.service_bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_booking.retailer_id);

  insert into public.service_fulfilment_events (
    booking_id,
    retailer_id,
    customer_id,
    method,
    status,
    scheduled_for,
    notes,
    recorded_by_staff_id
  ) values (
    p_booking_id,
    v_booking.retailer_id,
    v_booking.customer_id,
    p_method,
    p_status,
    p_scheduled_for,
    p_notes,
    v_staff_id
  )
  returning id into v_id;

  perform public._service_history_insert(
    v_booking.retailer_id,
    v_booking.customer_id,
    v_booking.membership_id,
    p_booking_id,
    'fulfilment_recorded',
    'Fulfilment ' || p_method || ' / ' || p_status,
    v_staff_id
  );

  return v_id;
end;
$$;

revoke all on function public.record_service_fulfilment(
  uuid, text, text, timestamptz, text
) from public;
grant execute on function public.record_service_fulfilment(
  uuid, text, text, timestamptz, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_service_care (staff)
-- ---------------------------------------------------------------------------

create or replace function public.record_service_care(
  p_membership_id uuid,
  p_care_kind text,
  p_summary text,
  p_booking_id uuid default null,
  p_wardrobe_item_id uuid default null,
  p_physical_garment_id uuid default null,
  p_alteration_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
  v_id uuid;
  v_history_kind text := 'care_recorded';
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  if p_alteration_id is not null then
    if not exists (
      select 1 from public.alteration_work_orders a
      where a.id = p_alteration_id
        and a.retailer_id = v_membership.retailer_id
    ) then
      raise exception 'Alteration must belong to the same retailer';
    end if;
    v_history_kind := 'alteration_linked';
  end if;

  if p_wardrobe_item_id is not null then
    if not exists (
      select 1 from public.wardrobe_items w
      where w.id = p_wardrobe_item_id
        and w.retailer_id = v_membership.retailer_id
        and w.customer_id = v_membership.customer_id
    ) then
      raise exception 'Wardrobe item must match membership relationship';
    end if;
  end if;

  insert into public.service_care_records (
    booking_id,
    membership_id,
    retailer_id,
    customer_id,
    care_kind,
    summary,
    wardrobe_item_id,
    physical_garment_id,
    alteration_id,
    recorded_by_staff_id
  ) values (
    p_booking_id,
    p_membership_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    p_care_kind,
    p_summary,
    p_wardrobe_item_id,
    p_physical_garment_id,
    p_alteration_id,
    v_staff_id
  )
  returning id into v_id;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    p_booking_id,
    v_history_kind,
    p_summary,
    v_staff_id
  );

  return v_id;
end;
$$;

revoke all on function public.record_service_care(
  uuid, text, text, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.record_service_care(
  uuid, text, text, uuid, uuid, uuid, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_service_cost (staff) — operational recording only
-- ---------------------------------------------------------------------------

create or replace function public.record_service_cost(
  p_membership_id uuid,
  p_label text,
  p_amount_minor_units integer,
  p_currency text,
  p_booking_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
  v_id uuid;
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  insert into public.service_cost_records (
    booking_id,
    membership_id,
    retailer_id,
    customer_id,
    label,
    amount_minor_units,
    currency,
    notes,
    recorded_by_staff_id
  ) values (
    p_booking_id,
    p_membership_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    p_label,
    p_amount_minor_units,
    p_currency,
    p_notes,
    v_staff_id
  )
  returning id into v_id;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    p_booking_id,
    'cost_recorded',
    'Cost recorded: ' || p_label,
    v_staff_id
  );

  return v_id;
end;
$$;

revoke all on function public.record_service_cost(
  uuid, text, integer, text, uuid, text
) from public;
grant execute on function public.record_service_cost(
  uuid, text, integer, text, uuid, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: set_service_membership_status / assign_service_advisor
-- ---------------------------------------------------------------------------

create or replace function public.set_service_membership_status(
  p_membership_id uuid,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
  v_history_kind text;
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  update public.service_memberships
  set status = p_status,
      ended_at = case when p_status = 'ended' then now() else null end,
      updated_at = now()
  where id = p_membership_id;

  v_history_kind := case p_status
    when 'paused' then 'membership_paused'
    when 'ended' then 'membership_ended'
    else 'membership_opened'
  end;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    null,
    v_history_kind,
    'Membership status: ' || p_status,
    v_staff_id
  );

  return p_membership_id;
end;
$$;

revoke all on function public.set_service_membership_status(uuid, text)
  from public;
grant execute on function public.set_service_membership_status(uuid, text)
  to authenticated, service_role;

create or replace function public.assign_service_advisor(
  p_membership_id uuid,
  p_advisor_staff_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  if not exists (
    select 1 from public.retailer_staff_members s
    where s.id = p_advisor_staff_id
      and s.retailer_id = v_membership.retailer_id
      and s.deleted_at is null
  ) then
    raise exception 'Advisor must belong to the same retailer';
  end if;

  update public.service_memberships
  set advisor_staff_id = p_advisor_staff_id,
      updated_at = now()
  where id = p_membership_id;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    null,
    'advisor_assigned',
    'Advisor assigned',
    v_staff_id
  );

  return p_membership_id;
end;
$$;

revoke all on function public.assign_service_advisor(uuid, uuid) from public;
grant execute on function public.assign_service_advisor(uuid, uuid)
  to authenticated, service_role;
