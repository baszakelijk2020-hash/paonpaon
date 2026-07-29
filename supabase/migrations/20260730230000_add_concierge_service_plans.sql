-- PAON Intelligence Platform Stage 5.3.
-- Preferred Tailoring and HighMaintenance operations (SERV-001, SERV-002,
-- LONG-001; ADR-062). Service plans, entitlements, bookings, and fulfilment
-- are separate from payments and compose appointments/alterations/wardrobe.

create type public.concierge_service_kind as enum (
  'preferred_tailoring',
  'high_maintenance'
);

create type public.concierge_enrollment_status as enum (
  'draft',
  'active',
  'paused',
  'ended'
);

create type public.concierge_booking_status as enum (
  'requested',
  'scheduled',
  'in_progress',
  'fulfilled',
  'completed',
  'canceled'
);

create type public.concierge_operation_kind as enum (
  'planning_session',
  'pressing',
  'cleaning',
  'repair',
  'collection',
  'delivery',
  'size_check'
);

create type public.concierge_entitlement_kind as enum (
  'planning_sessions',
  'pressing_visits',
  'collection_trips',
  'repair_credits'
);

-- ---------------------------------------------------------------------------
-- plan definitions
-- ---------------------------------------------------------------------------

create table if not exists public.concierge_service_plan_definitions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  service_kind public.concierge_service_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_plan_definitions_retailer_kind_uidx
    unique (retailer_id, service_kind)
);

create trigger set_concierge_service_plan_definitions_updated_at
  before update on public.concierge_service_plan_definitions
  for each row execute function public.set_updated_at();

comment on table public.concierge_service_plan_definitions is
  'Retailer concierge service templates for Preferred Tailoring and HighMaintenance (PHASE 5.3).';

alter table public.concierge_service_plan_definitions enable row level security;
revoke all on table public.concierge_service_plan_definitions from anon;

create policy "retailer staff read concierge plan definitions"
  on public.concierge_service_plan_definitions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "retailer managers manage concierge plan definitions"
  on public.concierge_service_plan_definitions for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

create policy "customers read active concierge plan definitions"
  on public.concierge_service_plan_definitions for select to authenticated
  using (
    active
    and exists (
      select 1 from public.customers c
      where c.retailer_id = concierge_service_plan_definitions.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read concierge plan definitions"
  on public.concierge_service_plan_definitions for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.concierge_service_plan_definitions
  to authenticated, service_role;
grant insert, update, delete on table public.concierge_service_plan_definitions
  to authenticated;
grant all on table public.concierge_service_plan_definitions to service_role;

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------

create table if not exists public.concierge_service_enrollments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  plan_definition_id uuid not null
    references public.concierge_service_plan_definitions (id) on delete restrict,
  service_kind public.concierge_service_kind not null,
  status public.concierge_enrollment_status not null default 'active',
  advisor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  commitment_note text check (
    commitment_note is null
    or char_length(btrim(commitment_note)) between 1 and 500
  ),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_enrollments_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint concierge_enrollments_active_uidx
    unique (customer_id, service_kind)
    deferrable initially immediate
);

create trigger set_concierge_service_enrollments_updated_at
  before update on public.concierge_service_enrollments
  for each row execute function public.set_updated_at();

create index concierge_service_enrollments_retailer_idx
  on public.concierge_service_enrollments (retailer_id, status);

comment on table public.concierge_service_enrollments is
  'Customer concierge enrollments with advisor ownership (PHASE 5.3).';

alter table public.concierge_service_enrollments enable row level security;
revoke all on table public.concierge_service_enrollments from anon;

create policy "retailer staff read concierge enrollments"
  on public.concierge_service_enrollments for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "retailer staff manage concierge enrollments"
  on public.concierge_service_enrollments for all to authenticated
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

create policy "customers read own concierge enrollments"
  on public.concierge_service_enrollments for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = concierge_service_enrollments.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read concierge enrollments"
  on public.concierge_service_enrollments for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.concierge_service_enrollments
  to authenticated, service_role;
grant insert, update, delete on table public.concierge_service_enrollments
  to authenticated;
grant all on table public.concierge_service_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- entitlements
-- ---------------------------------------------------------------------------

create table if not exists public.concierge_service_entitlements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.concierge_service_enrollments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  kind public.concierge_entitlement_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  allowance integer not null check (allowance > 0 and allowance <= 1000),
  consumed integer not null default 0 check (consumed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_entitlements_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint concierge_entitlements_consumed_ck check (consumed <= allowance),
  constraint concierge_entitlements_enrollment_kind_uidx
    unique (enrollment_id, kind)
);

create trigger set_concierge_service_entitlements_updated_at
  before update on public.concierge_service_entitlements
  for each row execute function public.set_updated_at();

comment on table public.concierge_service_entitlements is
  'Non-monetary concierge credits per enrollment (PHASE 5.3).';

alter table public.concierge_service_entitlements enable row level security;
revoke all on table public.concierge_service_entitlements from anon;

create policy "retailer staff read concierge entitlements"
  on public.concierge_service_entitlements for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge entitlements"
  on public.concierge_service_entitlements for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = concierge_service_entitlements.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read concierge entitlements"
  on public.concierge_service_entitlements for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.concierge_service_entitlements
  to authenticated, service_role;
grant all on table public.concierge_service_entitlements to service_role;

-- ---------------------------------------------------------------------------
-- entitlement consumptions (idempotent audit)
-- ---------------------------------------------------------------------------

create table if not exists public.concierge_entitlement_consumptions (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null
    references public.concierge_service_entitlements (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  booking_id uuid not null,
  idempotency_key text not null check (
    char_length(btrim(idempotency_key)) between 1 and 200
  ),
  units integer not null default 1 check (units > 0 and units <= 10),
  consumed_at timestamptz not null default now(),
  constraint concierge_entitlement_consumptions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint concierge_entitlement_consumptions_uidx
    unique (entitlement_id, idempotency_key)
);

comment on table public.concierge_entitlement_consumptions is
  'Idempotent entitlement consumption audit for concierge bookings (PHASE 5.3).';

alter table public.concierge_entitlement_consumptions enable row level security;
revoke all on table public.concierge_entitlement_consumptions from anon;

create policy "retailer staff read concierge entitlement consumptions"
  on public.concierge_entitlement_consumptions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge entitlement consumptions"
  on public.concierge_entitlement_consumptions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = concierge_entitlement_consumptions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

grant select on table public.concierge_entitlement_consumptions
  to authenticated, service_role;
grant all on table public.concierge_entitlement_consumptions to service_role;

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create table if not exists public.concierge_service_bookings (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.concierge_service_enrollments (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_kind public.concierge_service_kind not null,
  status public.concierge_booking_status not null default 'requested',
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 500
  ),
  scheduled_at timestamptz,
  advisor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  alteration_id uuid references public.alteration_work_orders (id)
    on delete set null,
  physical_garment_id uuid references public.physical_garments (id)
    on delete set null,
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_bookings_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create trigger set_concierge_service_bookings_updated_at
  before update on public.concierge_service_bookings
  for each row execute function public.set_updated_at();

create index concierge_service_bookings_customer_idx
  on public.concierge_service_bookings (customer_id, status, created_at desc);

create index concierge_service_bookings_retailer_idx
  on public.concierge_service_bookings (retailer_id, status, scheduled_at);

comment on table public.concierge_service_bookings is
  'Concierge operational bookings composing appointments/alterations (PHASE 5.3).';

alter table public.concierge_service_bookings enable row level security;
revoke all on table public.concierge_service_bookings from anon;

create policy "retailer staff read concierge bookings"
  on public.concierge_service_bookings for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge bookings"
  on public.concierge_service_bookings for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = concierge_service_bookings.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read concierge bookings"
  on public.concierge_service_bookings for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.concierge_service_bookings
  to authenticated, service_role;
grant all on table public.concierge_service_bookings to service_role;

-- booking items
create table if not exists public.concierge_service_booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.concierge_service_bookings (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  operation_kind public.concierge_operation_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  notes text check (
    notes is null or char_length(btrim(notes)) between 1 and 300
  ),
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  physical_garment_id uuid references public.physical_garments (id)
    on delete set null,
  created_at timestamptz not null default now()
);

create index concierge_service_booking_items_booking_idx
  on public.concierge_service_booking_items (booking_id);

comment on table public.concierge_service_booking_items is
  'Per-operation concierge booking line items (PHASE 5.3).';

alter table public.concierge_service_booking_items enable row level security;
revoke all on table public.concierge_service_booking_items from anon;

create policy "retailer staff read concierge booking items"
  on public.concierge_service_booking_items for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge booking items"
  on public.concierge_service_booking_items for select to authenticated
  using (
    exists (
      select 1
      from public.concierge_service_bookings b
      join public.customers c on c.id = b.customer_id
      where b.id = concierge_service_booking_items.booking_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

grant select on table public.concierge_service_booking_items
  to authenticated, service_role;
grant all on table public.concierge_service_booking_items to service_role;

-- FK booking_id on consumptions now that bookings exist
alter table public.concierge_entitlement_consumptions
  add constraint concierge_entitlement_consumptions_booking_fk
  foreign key (booking_id)
  references public.concierge_service_bookings (id) on delete cascade;

-- status history
create table if not exists public.concierge_service_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.concierge_service_bookings (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  from_status public.concierge_booking_status,
  to_status public.concierge_booking_status not null,
  actor_kind text not null check (actor_kind in ('customer', 'advisor', 'system')),
  actor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  note text check (note is null or char_length(btrim(note)) between 1 and 300),
  recorded_at timestamptz not null default now()
);

create index concierge_service_status_history_booking_idx
  on public.concierge_service_status_history (booking_id, recorded_at desc);

comment on table public.concierge_service_status_history is
  'Append-only concierge booking status audit (PHASE 5.3).';

alter table public.concierge_service_status_history enable row level security;
revoke all on table public.concierge_service_status_history from anon;

create policy "retailer staff read concierge status history"
  on public.concierge_service_status_history for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge status history"
  on public.concierge_service_status_history for select to authenticated
  using (
    exists (
      select 1
      from public.concierge_service_bookings b
      join public.customers c on c.id = b.customer_id
      where b.id = concierge_service_status_history.booking_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

grant select on table public.concierge_service_status_history
  to authenticated, service_role;
grant all on table public.concierge_service_status_history to service_role;

-- cost records (recorded, not charged)
create table if not exists public.concierge_service_cost_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null
    references public.concierge_service_bookings (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount_minor integer not null check (amount_minor >= 0 and amount_minor <= 10000000),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(btrim(description)) between 1 and 300),
  recorded_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  recorded_at timestamptz not null default now(),
  constraint concierge_cost_records_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index concierge_service_cost_records_booking_idx
  on public.concierge_service_cost_records (booking_id, recorded_at desc);

comment on table public.concierge_service_cost_records is
  'Operational concierge cost recording without payment collection (PHASE 5.3).';

alter table public.concierge_service_cost_records enable row level security;
revoke all on table public.concierge_service_cost_records from anon;

create policy "retailer staff read concierge cost records"
  on public.concierge_service_cost_records for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner', 'read_only',
      'production_staff'
    )
  );

create policy "customers read own concierge cost records"
  on public.concierge_service_cost_records for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = concierge_service_cost_records.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

grant select on table public.concierge_service_cost_records
  to authenticated, service_role;
grant all on table public.concierge_service_cost_records to service_role;

-- ---------------------------------------------------------------------------
-- RPC: ensure default plan definitions
-- ---------------------------------------------------------------------------

create or replace function public.ensure_concierge_service_plan_definitions(
  p_retailer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.concierge_service_plan_definitions (
    retailer_id, service_kind, label, summary
  )
  select p_retailer_id, v.service_kind::public.concierge_service_kind, v.label, v.summary
  from (
    values
      (
        'preferred_tailoring',
        'Preferred Tailoring',
        'Executive Style Director wardrobe planning with advisor ownership and planning sessions.'
      ),
      (
        'high_maintenance',
        'HighMaintenance',
        'Ongoing pressing, cleaning, repair, collection, and delivery with operational commitments.'
      )
  ) as v(service_kind, label, summary)
  where not exists (
    select 1
    from public.concierge_service_plan_definitions existing
    where existing.retailer_id = p_retailer_id
      and existing.service_kind = v.service_kind::public.concierge_service_kind
  );
end;
$$;

revoke all on function public.ensure_concierge_service_plan_definitions(uuid) from public;
grant execute on function public.ensure_concierge_service_plan_definitions(uuid)
  to authenticated, service_role;

insert into public.concierge_service_plan_definitions (
  retailer_id, service_kind, label, summary
)
select
  r.id,
  v.service_kind::public.concierge_service_kind,
  v.label,
  v.summary
from public.retailers r
cross join (
  values
    (
      'preferred_tailoring',
      'Preferred Tailoring',
      'Executive Style Director wardrobe planning with advisor ownership and planning sessions.'
    ),
    (
      'high_maintenance',
      'HighMaintenance',
      'Ongoing pressing, cleaning, repair, collection, and delivery with operational commitments.'
    )
) as v(service_kind, label, summary)
where r.deleted_at is null
  and not exists (
    select 1
    from public.concierge_service_plan_definitions existing
    where existing.retailer_id = r.id
      and existing.service_kind = v.service_kind::public.concierge_service_kind
  );

-- ---------------------------------------------------------------------------
-- RPC: enroll customer on concierge service
-- ---------------------------------------------------------------------------

create or replace function public.enroll_concierge_service(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_plan_definition_id uuid,
  p_advisor_staff_id uuid default null,
  p_commitment_note text default null,
  p_status public.concierge_enrollment_status default 'active'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.concierge_service_plan_definitions%rowtype;
  v_enrollment_id uuid;
  v_ent record;
begin
  if (select public.current_retailer_id()) is distinct from p_retailer_id
     and not (select public.is_platform_staff()) then
    raise exception 'Not authorized to enroll concierge service';
  end if;

  if (select public.current_retailer_role()) not in (
    'sales_associate', 'manager', 'admin', 'owner'
  ) and not (select public.is_platform_staff()) then
    raise exception 'Not authorized to enroll concierge service';
  end if;

  select * into v_plan
  from public.concierge_service_plan_definitions
  where id = p_plan_definition_id
    and retailer_id = p_retailer_id
    and active;
  if not found then
    raise exception 'Active concierge plan definition not found';
  end if;

  insert into public.concierge_service_enrollments (
    retailer_id,
    customer_id,
    plan_definition_id,
    service_kind,
    status,
    advisor_staff_id,
    commitment_note,
    started_at
  ) values (
    p_retailer_id,
    p_customer_id,
    p_plan_definition_id,
    v_plan.service_kind,
    p_status,
    p_advisor_staff_id,
    p_commitment_note,
    case when p_status = 'active' then now() else null end
  )
  on conflict (customer_id, service_kind) do update set
    plan_definition_id = excluded.plan_definition_id,
    status = excluded.status,
    advisor_staff_id = coalesce(excluded.advisor_staff_id, concierge_service_enrollments.advisor_staff_id),
    commitment_note = coalesce(excluded.commitment_note, concierge_service_enrollments.commitment_note),
    started_at = coalesce(concierge_service_enrollments.started_at, excluded.started_at),
    ended_at = case when excluded.status = 'ended' then now() else null end,
    updated_at = now()
  returning id into v_enrollment_id;

  for v_ent in
    select *
    from (
      values
        ('preferred_tailoring'::text, 'planning_sessions'::text, 'Executive planning sessions per year', 4),
        ('high_maintenance'::text, 'pressing_visits'::text, 'Weekly pressing visits', 52),
        ('high_maintenance'::text, 'collection_trips'::text, 'Collection and delivery trips', 26),
        ('high_maintenance'::text, 'repair_credits'::text, 'Repair credits', 6)
    ) as defaults(service_kind, kind, label, allowance)
    where defaults.service_kind = v_plan.service_kind::text
  loop
    insert into public.concierge_service_entitlements (
      enrollment_id,
      retailer_id,
      customer_id,
      kind,
      label,
      allowance
    )
    select
      v_enrollment_id,
      p_retailer_id,
      p_customer_id,
      v_ent.kind::public.concierge_entitlement_kind,
      v_ent.label,
      v_ent.allowance
    where not exists (
      select 1
      from public.concierge_service_entitlements existing
      where existing.enrollment_id = v_enrollment_id
        and existing.kind = v_ent.kind::public.concierge_entitlement_kind
    );
  end loop;

  return v_enrollment_id;
end;
$$;

revoke all on function public.enroll_concierge_service(uuid, uuid, uuid, uuid, text, public.concierge_enrollment_status) from public;
grant execute on function public.enroll_concierge_service(uuid, uuid, uuid, uuid, text, public.concierge_enrollment_status)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: request concierge booking (customer)
-- ---------------------------------------------------------------------------

create or replace function public.request_concierge_service_booking(
  p_enrollment_id uuid,
  p_title text,
  p_notes text default null,
  p_wardrobe_item_id uuid default null,
  p_physical_garment_id uuid default null,
  p_operations jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.concierge_service_enrollments%rowtype;
  v_customer public.customers%rowtype;
  v_booking_id uuid;
  v_op jsonb;
  v_kind public.concierge_operation_kind;
  v_label text;
begin
  select * into v_enrollment
  from public.concierge_service_enrollments
  where id = p_enrollment_id;
  if not found then
    raise exception 'Concierge enrollment not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_enrollment.customer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found';
  end if;

  if v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to request concierge booking';
  end if;

  if v_enrollment.status <> 'active' then
    raise exception 'Concierge enrollment is not active';
  end if;

  if jsonb_array_length(p_operations) < 1 then
    raise exception 'At least one operation is required';
  end if;

  insert into public.concierge_service_bookings (
    enrollment_id,
    retailer_id,
    customer_id,
    service_kind,
    status,
    title,
    notes,
    wardrobe_item_id,
    physical_garment_id,
    advisor_staff_id
  ) values (
    p_enrollment_id,
    v_enrollment.retailer_id,
    v_enrollment.customer_id,
    v_enrollment.service_kind,
    'requested',
    btrim(p_title),
    p_notes,
    p_wardrobe_item_id,
    p_physical_garment_id,
    v_enrollment.advisor_staff_id
  )
  returning id into v_booking_id;

  insert into public.concierge_service_status_history (
    booking_id,
    retailer_id,
    from_status,
    to_status,
    actor_kind
  ) values (
    v_booking_id,
    v_enrollment.retailer_id,
    null,
    'requested',
    'customer'
  );

  for v_op in select * from jsonb_array_elements(p_operations)
  loop
    v_kind := (v_op ->> 'operationKind')::public.concierge_operation_kind;
    v_label := coalesce(nullif(btrim(v_op ->> 'label'), ''), v_kind::text);
    insert into public.concierge_service_booking_items (
      booking_id,
      retailer_id,
      operation_kind,
      label,
      notes,
      wardrobe_item_id,
      physical_garment_id
    ) values (
      v_booking_id,
      v_enrollment.retailer_id,
      v_kind,
      v_label,
      nullif(btrim(v_op ->> 'notes'), ''),
      (v_op ->> 'wardrobeItemId')::uuid,
      (v_op ->> 'physicalGarmentId')::uuid
    );
  end loop;

  return v_booking_id;
end;
$$;

revoke all on function public.request_concierge_service_booking(uuid, text, text, uuid, uuid, jsonb) from public;
grant execute on function public.request_concierge_service_booking(uuid, text, text, uuid, uuid, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: transition booking status
-- ---------------------------------------------------------------------------

create or replace function public.transition_concierge_service_booking(
  p_booking_id uuid,
  p_transition text,
  p_scheduled_at timestamptz default null,
  p_note text default null
) returns public.concierge_booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.concierge_service_bookings%rowtype;
  v_enrollment public.concierge_service_enrollments%rowtype;
  v_customer public.customers%rowtype;
  v_from public.concierge_booking_status;
  v_to public.concierge_booking_status;
  v_actor_kind text;
  v_is_customer boolean := false;
begin
  select * into v_booking
  from public.concierge_service_bookings
  where id = p_booking_id;
  if not found then
    raise exception 'Concierge booking not found';
  end if;

  select * into v_enrollment
  from public.concierge_service_enrollments
  where id = v_booking.enrollment_id;

  select * into v_customer
  from public.customers
  where id = v_booking.customer_id
    and deleted_at is null;

  v_is_customer := v_customer.user_id = (select auth.uid());

  if v_is_customer then
    v_actor_kind := 'customer';
    if p_transition not in ('cancel', 'complete') then
      raise exception 'Not authorized to transition concierge booking';
    end if;
  elsif (select public.current_retailer_id()) = v_booking.retailer_id
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    ) then
    v_actor_kind := 'advisor';
  elsif (select public.is_platform_staff()) then
    v_actor_kind := 'system';
  else
    raise exception 'Not authorized to transition concierge booking';
  end if;

  v_from := v_booking.status;

  v_to := case p_transition
    when 'schedule' then 'scheduled'::public.concierge_booking_status
    when 'start' then 'in_progress'::public.concierge_booking_status
    when 'fulfill' then 'fulfilled'::public.concierge_booking_status
    when 'complete' then 'completed'::public.concierge_booking_status
    when 'cancel' then 'canceled'::public.concierge_booking_status
    else null
  end;

  if v_to is null then
    raise exception 'Unknown concierge booking transition';
  end if;

  if p_transition = 'schedule' and p_scheduled_at is null then
    raise exception 'Scheduled time is required';
  end if;

  if v_enrollment.status <> 'active' and p_transition <> 'cancel' then
    raise exception 'Concierge enrollment is not active';
  end if;

  if not (
    (p_transition = 'schedule' and v_from = 'requested')
    or (p_transition = 'start' and v_from = 'scheduled')
    or (p_transition = 'fulfill' and v_from = 'in_progress')
    or (p_transition = 'complete' and v_from = 'fulfilled')
    or (p_transition = 'cancel' and v_from in (
      'requested', 'scheduled', 'in_progress', 'fulfilled'
    ))
  ) then
    raise exception 'Invalid concierge booking transition from %', v_from;
  end if;

  update public.concierge_service_bookings
  set
    status = v_to,
    scheduled_at = coalesce(p_scheduled_at, scheduled_at),
    updated_at = now()
  where id = p_booking_id;

  insert into public.concierge_service_status_history (
    booking_id,
    retailer_id,
    from_status,
    to_status,
    actor_kind,
    actor_staff_id,
    note
  ) values (
    p_booking_id,
    v_booking.retailer_id,
    v_from,
    v_to,
    v_actor_kind,
    case when v_actor_kind = 'advisor'
      then (select public.current_staff_id())
      else null
    end,
    p_note
  );

  if p_transition = 'fulfill' then
    perform public.consume_concierge_entitlements_for_booking(p_booking_id);
  end if;

  return v_to;
end;
$$;

revoke all on function public.transition_concierge_service_booking(uuid, text, timestamptz, text) from public;
grant execute on function public.transition_concierge_service_booking(uuid, text, timestamptz, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: consume entitlements idempotently on fulfilment
-- ---------------------------------------------------------------------------

create or replace function public.consume_concierge_entitlements_for_booking(
  p_booking_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.concierge_service_bookings%rowtype;
  v_item record;
  v_entitlement public.concierge_service_entitlements%rowtype;
  v_kind public.concierge_entitlement_kind;
  v_consumed integer := 0;
  v_consumption_id uuid;
begin
  select * into v_booking
  from public.concierge_service_bookings
  where id = p_booking_id;
  if not found then
    raise exception 'Concierge booking not found';
  end if;

  for v_item in
    select *
    from public.concierge_service_booking_items
    where booking_id = p_booking_id
  loop
    v_kind := case v_item.operation_kind
      when 'planning_session' then 'planning_sessions'::public.concierge_entitlement_kind
      when 'pressing' then 'pressing_visits'::public.concierge_entitlement_kind
      when 'cleaning' then 'pressing_visits'::public.concierge_entitlement_kind
      when 'collection' then 'collection_trips'::public.concierge_entitlement_kind
      when 'delivery' then 'collection_trips'::public.concierge_entitlement_kind
      when 'repair' then 'repair_credits'::public.concierge_entitlement_kind
      else null
    end;

    if v_kind is null then
      continue;
    end if;

    select * into v_entitlement
    from public.concierge_service_entitlements
    where enrollment_id = v_booking.enrollment_id
      and kind = v_kind
    for update;

    if not found then
      continue;
    end if;

    if v_entitlement.consumed >= v_entitlement.allowance then
      raise exception 'Concierge entitlement exhausted for %', v_kind;
    end if;

    insert into public.concierge_entitlement_consumptions (
      entitlement_id,
      retailer_id,
      customer_id,
      booking_id,
      idempotency_key,
      units
    ) values (
      v_entitlement.id,
      v_booking.retailer_id,
      v_booking.customer_id,
      p_booking_id,
      v_item.id::text,
      1
    )
    on conflict (entitlement_id, idempotency_key) do nothing
    returning id into v_consumption_id;

    if v_consumption_id is not null then
      update public.concierge_service_entitlements
      set consumed = consumed + 1, updated_at = now()
      where id = v_entitlement.id
        and consumed < allowance;
      v_consumed := v_consumed + 1;
    end if;
  end loop;

  return v_consumed;
end;
$$;

revoke all on function public.consume_concierge_entitlements_for_booking(uuid) from public;
grant execute on function public.consume_concierge_entitlements_for_booking(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record operational cost (no payment)
-- ---------------------------------------------------------------------------

create or replace function public.record_concierge_service_cost(
  p_booking_id uuid,
  p_amount_minor integer,
  p_currency text,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.concierge_service_bookings%rowtype;
  v_id uuid;
begin
  select * into v_booking
  from public.concierge_service_bookings
  where id = p_booking_id;
  if not found then
    raise exception 'Concierge booking not found';
  end if;

  if (select public.current_retailer_id()) is distinct from v_booking.retailer_id
     and not (select public.is_platform_staff()) then
    raise exception 'Not authorized to record concierge cost';
  end if;

  if (select public.current_retailer_role()) not in (
    'sales_associate', 'manager', 'admin', 'owner'
  ) and not (select public.is_platform_staff()) then
    raise exception 'Not authorized to record concierge cost';
  end if;

  insert into public.concierge_service_cost_records (
    booking_id,
    retailer_id,
    customer_id,
    amount_minor,
    currency,
    description,
    recorded_by_staff_id
  ) values (
    p_booking_id,
    v_booking.retailer_id,
    v_booking.customer_id,
    p_amount_minor,
    upper(btrim(p_currency)),
    btrim(p_description),
    (select public.current_staff_id())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_concierge_service_cost(uuid, integer, text, text) from public;
grant execute on function public.record_concierge_service_cost(uuid, integer, text, text)
  to authenticated, service_role;
