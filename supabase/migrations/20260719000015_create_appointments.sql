-- See docs/DOMAIN_MODEL.md "Appointments". `location_id` stays a loose
-- unconstrained column (no FK, no Location table) — multi-location is
-- explicitly deferred (docs/PROJECT_STATE.md, carried forward from
-- Phase 1); "select retailer/location" in this slice means selecting
-- the retailer, via the existing `/r/[slug]` storefront routing.

create type public.appointment_type as enum (
  'styling_consultation',
  'fitting',
  'alteration_fitting',
  'personal_shopping',
  'event'
);

create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'checked_in',
  'completed',
  'canceled',
  'no_show'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  type public.appointment_type not null,
  status public.appointment_status not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint appointments_starts_before_ends check (starts_at < ends_at)
);

create index appointments_retailer_id_idx on public.appointments (retailer_id);
create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_staff_id_idx on public.appointments (staff_id) where staff_id is not null;

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

alter table public.appointments enable row level security;

create policy "platform staff can manage all appointments"
  on public.appointments for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's appointments"
  on public.appointments for select
  using (retailer_id = public.current_retailer_id());

-- Booking/calendar management is frontline client-service work, same
-- crowd as customers' sales_associate+ CRM gate — not admin-only.
create policy "sales staff and above can manage their retailer's appointments"
  on public.appointments for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "a customer can read their own appointments"
  on public.appointments for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = appointments.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.appointments is
  'See docs/DOMAIN_MODEL.md "Appointments". Customer-initiated appointments are created only by request_appointment() below — retailer staff may also insert directly (e.g. booking a walk-in) under the sales_associate+ policy above.';

-- Mirrors place_order (docs/DECISIONS.md ADR-014): a customer may
-- request an appointment with a retailer they have never bought from,
-- so this creates their Customer record on the spot if needed, the
-- same "narrow security definer RPC, re-derive everything server-side"
-- shape as ADR-012/013/014. See ADR-015 for why this one isn't also
-- transactional over inventory/pricing the way place_order is — there
-- is nothing here to decrement or re-price.
create or replace function public.request_appointment(
  p_retailer_id uuid,
  p_type public.appointment_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer public.retailers;
  v_customer_id uuid;
  v_appointment_id uuid;
begin
  if p_starts_at >= p_ends_at then
    raise exception 'starts_at must be before ends_at';
  end if;

  select * into v_retailer
    from public.retailers
    where id = p_retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for appointments';
  end if;

  select id into v_customer_id
    from public.customers
    where retailer_id = p_retailer_id
      and user_id = auth.uid()
      and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (
      p_retailer_id,
      auth.uid(),
      coalesce(auth.jwt() ->> 'email', 'Customer'),
      auth.jwt() ->> 'email',
      'prospect'
    )
    returning id into v_customer_id;

    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.appointments (
    retailer_id, customer_id, type, status, starts_at, ends_at, notes
  )
  values (
    p_retailer_id, v_customer_id, p_type, 'requested', p_starts_at, p_ends_at, p_notes
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) from public;
grant execute on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) to service_role;

comment on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) is
  'Customer Portal appointment request. Creates the caller''s Customer record on the spot if this is their first interaction with the retailer, same as place_order.';
