-- Appointment slot integrity, closures, and customer-initiated change.
--
-- Three holes this closes, all found by tracing the booking path end to end:
--
-- 1. DOUBLE BOOKING. The only overlap guard on `appointments` is
--    `appointments_no_overlap_per_staff_excl`, whose WHERE clause is
--    `staff_id is not null`. `request_appointment` never sets `staff_id` — it
--    takes no such parameter — so the constraint has never applied to a single
--    customer self-booking. Two customers could take the same slot and both
--    succeed. Capacity is now checked inside the booking function itself.
--
-- 2. NO CLOSURES. `availability_windows` is recurring weekly per staff member
--    and `retailer_branches.opening_hours` is a static JSON week. Neither can
--    say "closed on the 26th" or "blocked 14:00-16:00 for a private fitting".
--    `appointment_closures` is that missing date-specific layer.
--
-- 3. NO CUSTOMER CANCEL OR RESCHEDULE. Customers hold SELECT-only RLS on
--    `appointments`, and `appointment_action_tokens` was added for exactly this
--    but its redeeming RPCs were never written (that migration's own comment
--    calls them stubs). Both paths are real functions here, and both notify the
--    staff who need to know.

-- ── Capacity ──────────────────────────────────────────────────────────────
-- How many appointments a branch can run at once. Defaults to 1 so the
-- double-booking hole closes on deploy rather than on configuration; a branch
-- that really does seat several customers at once raises its own number.
alter table public.retailer_branches
  add column if not exists concurrent_appointment_capacity integer not null default 1;

alter table public.retailer_branches
  drop constraint if exists retailer_branches_capacity_positive_chk;
alter table public.retailer_branches
  add constraint retailer_branches_capacity_positive_chk
  check (concurrent_appointment_capacity between 1 and 200);

comment on column public.retailer_branches.concurrent_appointment_capacity is
  'Concurrent appointments this branch can host. Enforced by appointment_slot_conflict().';

-- ── Closures ──────────────────────────────────────────────────────────────
create table if not exists public.appointment_closures (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  -- null means every branch of this retailer is closed for the window.
  branch_id uuid references public.retailer_branches (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint appointment_closures_range_chk check (starts_at < ends_at)
);

create index if not exists appointment_closures_lookup_idx
  on public.appointment_closures (retailer_id, starts_at, ends_at)
  where deleted_at is null;

alter table public.appointment_closures enable row level security;

revoke all on table public.appointment_closures from public, anon;
grant select on table public.appointment_closures to anon, authenticated, service_role;
grant insert, update on table public.appointment_closures to authenticated, service_role;

create policy "platform staff can manage all closures"
  on public.appointment_closures for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- A closure is published trading information, the same as opening hours: the
-- booking UI has to be able to grey out a closed day before anyone signs in.
create policy "anyone can read closures"
  on public.appointment_closures for select
  using (deleted_at is null);

create policy "sales staff and above can manage their retailer's closures"
  on public.appointment_closures for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

-- ── The shared availability check ─────────────────────────────────────────
/**
 * Returns the reason a slot cannot be taken, or null when it is free.
 *
 * Both the booking path and the reschedule path run through this, so a slot
 * can never be validated one way on the way in and another way on the way
 * across. `p_exclude_appointment_id` lets a reschedule ignore the row it is
 * moving, which would otherwise always collide with itself.
 *
 * Branch is compared with `is not distinct from` on purpose: an appointment
 * with no branch is its own capacity bucket rather than one that collides
 * with every branch at once.
 */
create or replace function public.appointment_slot_conflict(
  p_retailer_id uuid,
  p_branch_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_appointment_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  if p_starts_at >= p_ends_at then
    return 'starts_at must be before ends_at';
  end if;

  if exists (
    select 1
      from public.appointment_closures c
      where c.retailer_id = p_retailer_id
        and c.deleted_at is null
        and (c.branch_id is null or c.branch_id = p_branch_id)
        and tstzrange(c.starts_at, c.ends_at, '[)')
            && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    return 'That time falls inside a closure';
  end if;

  select coalesce(b.concurrent_appointment_capacity, 1)
    into v_capacity
    from public.retailer_branches b
    where b.id = p_branch_id and b.deleted_at is null;
  v_capacity := coalesce(v_capacity, 1);

  select count(*)
    into v_taken
    from public.appointments a
    where a.retailer_id = p_retailer_id
      and a.branch_id is not distinct from p_branch_id
      and a.deleted_at is null
      and a.status not in ('canceled', 'no_show')
      and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
      and tstzrange(a.starts_at, a.ends_at, '[)')
          && tstzrange(p_starts_at, p_ends_at, '[)');

  if v_taken >= v_capacity then
    return 'That time has just been taken';
  end if;

  return null;
end;
$$;

revoke all on function public.appointment_slot_conflict(uuid, uuid, timestamptz, timestamptz, uuid) from public;
grant execute on function public.appointment_slot_conflict(uuid, uuid, timestamptz, timestamptz, uuid)
  to anon, authenticated, service_role;

comment on function public.appointment_slot_conflict(uuid, uuid, timestamptz, timestamptz, uuid) is
  'Null when the slot is bookable, otherwise the human-readable reason it is not. Shared by request_appointment and reschedule_my_appointment so both agree.';

-- ── Booking now refuses a taken or closed slot ────────────────────────────
create or replace function public.request_appointment(
  p_retailer_id uuid,
  p_type public.appointment_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null,
  p_branch_id uuid default null
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
  v_branch_retailer_id uuid;
  v_conflict text;
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

  if p_branch_id is not null then
    select retailer_id into v_branch_retailer_id
      from public.retailer_branches
      where id = p_branch_id and deleted_at is null;
    if v_branch_retailer_id is null or v_branch_retailer_id <> p_retailer_id then
      raise exception 'Branch does not belong to this retailer';
    end if;
  end if;

  -- The whole point of this migration: two customers racing for one slot now
  -- means the second one is told, rather than both being confirmed.
  v_conflict := public.appointment_slot_conflict(
    p_retailer_id, p_branch_id, p_starts_at, p_ends_at, null
  );
  if v_conflict is not null then
    raise exception '%', v_conflict;
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
    retailer_id, customer_id, type, status, starts_at, ends_at, notes, branch_id
  )
  values (
    p_retailer_id, v_customer_id, p_type, 'requested', p_starts_at, p_ends_at, p_notes, p_branch_id
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

comment on function public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) is
  'Customer Portal appointment request. Creates the caller''s Customer record on the spot if this is their first interaction with the retailer, and refuses a slot that is closed or already at branch capacity.';

-- ── Customer-initiated cancel ─────────────────────────────────────────────
create or replace function public.cancel_my_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  -- Ownership is re-derived from auth.uid() here rather than trusted from the
  -- caller: this function is SECURITY DEFINER and therefore bypasses the
  -- customer's SELECT-only RLS on appointments.
  select a.* into v_appt
    from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.id = p_appointment_id
      and a.deleted_at is null
      and c.user_id = auth.uid()
      and c.deleted_at is null;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status in ('canceled', 'completed', 'no_show') then
    raise exception 'That appointment can no longer be changed';
  end if;

  update public.appointments
    set status = 'canceled',
        notes = trim(both E'\n' from concat_ws(
          E'\n', notes,
          case when p_reason is null then 'Canceled by the customer.'
               else 'Canceled by the customer: ' || left(btrim(p_reason), 240) end
        )),
        updated_at = now()
    where id = p_appointment_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
  select
    v_appt.retailer_id,
    s.user_id,
    v_appt.customer_id,
    'appointment_reminder',
    'Appointment canceled by the customer',
    left(coalesce(btrim(p_reason), 'No reason given.'), 240),
    '/appointments/' || p_appointment_id::text,
    now()
  from public.retailer_staff_members s
  where s.retailer_id = v_appt.retailer_id
    and s.user_id is not null
    and s.accepted_at is not null
    and s.deleted_at is null
    and s.role in ('sales_associate', 'manager', 'admin', 'owner');
end;
$$;

revoke all on function public.cancel_my_appointment(uuid, text) from public;
grant execute on function public.cancel_my_appointment(uuid, text) to authenticated, service_role;

comment on function public.cancel_my_appointment(uuid, text) is
  'Customer Portal: cancel one''s own appointment. Re-derives ownership from auth.uid() and notifies the retailer''s booking staff.';

-- ── Customer-initiated reschedule ─────────────────────────────────────────
create or replace function public.reschedule_my_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
  v_conflict text;
begin
  select a.* into v_appt
    from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.id = p_appointment_id
      and a.deleted_at is null
      and c.user_id = auth.uid()
      and c.deleted_at is null;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status in ('canceled', 'completed', 'no_show') then
    raise exception 'That appointment can no longer be changed';
  end if;

  v_conflict := public.appointment_slot_conflict(
    v_appt.retailer_id, v_appt.branch_id, p_starts_at, p_ends_at, p_appointment_id
  );
  if v_conflict is not null then
    raise exception '%', v_conflict;
  end if;

  -- Back to 'requested': a moved appointment is not a confirmed one until the
  -- retailer has seen the new time.
  update public.appointments
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        status = case when status = 'confirmed' then 'requested' else status end,
        updated_at = now()
    where id = p_appointment_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
  select
    v_appt.retailer_id,
    s.user_id,
    v_appt.customer_id,
    'appointment_reminder',
    'Appointment moved by the customer',
    'Now ' || to_char(p_starts_at at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.',
    '/appointments/' || p_appointment_id::text,
    now()
  from public.retailer_staff_members s
  where s.retailer_id = v_appt.retailer_id
    and s.user_id is not null
    and s.accepted_at is not null
    and s.deleted_at is null
    and s.role in ('sales_associate', 'manager', 'admin', 'owner');
end;
$$;

revoke all on function public.reschedule_my_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function public.reschedule_my_appointment(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

comment on function public.reschedule_my_appointment(uuid, timestamptz, timestamptz) is
  'Customer Portal: move one''s own appointment. Re-derives ownership from auth.uid(), refuses a closed or full slot, drops a confirmed booking back to requested, and notifies the retailer''s booking staff.';
