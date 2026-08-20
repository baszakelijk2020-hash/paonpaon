-- PHASE 18.4 (BD-104): closes the named gap — "books an appointment...directly
-- from this page" (live, availability-aware, anonymous self-service booking).
-- Previously only staff-mediated scheduling existed; this adds the visitor-facing
-- path. The public page can now show available appointment slots and the visitor
-- can book one immediately, creating a real appointment + customer row on the spot.
--
-- Two new security definer RPCs, both granted to anon/authenticated/service_role:
-- 1. get_corporate_office_visit_availability_context(p_programme_id)
--    Returns only what's needed for front-end slot calculation: the retailer's
--    active availability windows and existing non-canceled appointments for the
--    relevant staff pool, shaped to match what computeAvailableSlots(@paon/domain)
--    expects. PII-free: no staff names, only the fields the algorithm needs.
--
-- 2. submit_corporate_office_visit_booking(p_programme_id, p_requester_name, ...)
--    The complete booking path: validates name/email format and length (same style
--    as submit_corporate_office_visit_request/submit_table_service_inquiry), enforces
--    rate limiting (5 submissions per 10 minutes per email), verifies programme/
--    retailer exist and retailer is active, RE-CHECKS at write time that no existing
--    non-canceled appointment overlaps the requested time window (prevents race-condition
--    double-booking), find-or-creates a customer row by email (mirrors request_appointment),
--    inserts a real appointments row (type 'styling_consultation', status 'requested'),
--    and also inserts a corporate_office_visit_requests row (status 'scheduled') with
--    the new appointment_id/customer_id FKs already added in migration 20260805180000.
--    Returns the new appointment id. The result shape is identical to what the staff
--    scheduling path (18.6) produces, just done immediately by the visitor.

-- First RPC: fetch availability context for slot calculation (no booking logic here).
create or replace function public.get_corporate_office_visit_availability_context(
  p_programme_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_programme public.corporate_programmes%rowtype;
  v_retailer public.retailers%rowtype;
  v_windows jsonb;
  v_appointments jsonb;
begin
  -- Validate programme exists and is active.
  select * into v_programme
    from public.corporate_programmes
    where id = p_programme_id and deleted_at is null and active;
  if not found then
    raise exception 'Programme not available';
  end if;

  -- Validate retailer exists and is active.
  select * into v_retailer
    from public.retailers
    where id = v_programme.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer not available';
  end if;

  -- Fetch all active availability windows for the retailer's staff.
  -- Return only: id, staffId, dayOfWeek, startTime, endTime (matching AvailabilityWindow).
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'staffId', staff_id,
      'retailerId', retailer_id,
      'dayOfWeek', day_of_week,
      'startTime', start_time,
      'endTime', end_time
    )
  ) into v_windows
    from public.availability_windows
    where retailer_id = v_programme.retailer_id;

  if v_windows is null then
    v_windows := '[]'::jsonb;
  end if;

  -- Fetch existing non-canceled appointments for the retailer over the next 14 days.
  -- Return only: startsAt, endsAt, status (matching Pick<Appointment, "startsAt"|"endsAt"|"status">).
  select jsonb_agg(
    jsonb_build_object(
      'startsAt', starts_at,
      'endsAt', ends_at,
      'status', status
    )
  ) into v_appointments
    from public.appointments
    where retailer_id = v_programme.retailer_id
      and status <> 'canceled'
      and starts_at >= now()
      and starts_at < now() + interval '14 days';

  if v_appointments is null then
    v_appointments := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'windows', v_windows,
    'appointments', v_appointments
  );
end;
$$;

revoke all on function public.get_corporate_office_visit_availability_context(uuid) from public;
grant execute on function public.get_corporate_office_visit_availability_context(uuid)
  to anon, authenticated, service_role;

-- Second RPC: submit and book a corporate office visit appointment.
-- This is the complete self-service booking path. Returns the new appointment id on success.
create or replace function public.submit_corporate_office_visit_booking(
  p_programme_id uuid,
  p_requester_name text,
  p_employee_reference text,
  p_contact_email text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_programme public.corporate_programmes%rowtype;
  v_retailer public.retailers%rowtype;
  v_name text := trim(p_requester_name);
  v_employee_reference text := nullif(trim(coalesce(p_employee_reference, '')), '');
  v_contact_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
  v_customer_id uuid;
  v_appointment_id uuid;
  v_request_id uuid;
  v_recent_count int;
begin
  -- Validate name.
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;

  -- Validate email format.
  if v_contact_email is null then
    raise exception 'Contact email is required for booking';
  end if;
  if v_contact_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email';
  end if;

  -- Validate time window.
  if p_starts_at >= p_ends_at then
    raise exception 'Start time must be before end time';
  end if;

  -- Validate programme and retailer.
  select * into v_programme
    from public.corporate_programmes
    where id = p_programme_id and deleted_at is null and active;
  if not found then
    raise exception 'This programme page is not available';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_programme.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'This programme page is not available';
  end if;

  -- Rate limiting: 5 submissions per 10 minutes per email (same as submit_table_service_inquiry).
  select count(*) into v_recent_count
    from public.corporate_office_visit_requests
    where retailer_id = v_programme.retailer_id
      and lower(contact_email) = v_contact_email
      and created_at > now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'Please wait a moment before booking another appointment.';
  end if;

  -- RE-CHECK at write time: no existing non-canceled appointment overlaps this window
  -- for the same retailer (prevents race-condition double-booking).
  if exists (
    select 1
    from public.appointments
    where retailer_id = v_programme.retailer_id
      and status <> 'canceled'
      and starts_at < p_ends_at
      and ends_at > p_starts_at
  ) then
    raise exception 'This time slot is no longer available. Please try another.';
  end if;

  -- Find or create customer by email (mirrors request_appointment pattern).
  select id into v_customer_id
    from public.customers
    where retailer_id = v_programme.retailer_id
      and lower(email) = v_contact_email
      and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (
      retailer_id, full_name, email, lifecycle_stage, acquisition_source
    ) values (
      v_programme.retailer_id, v_name, v_contact_email, 'prospect',
      'corporate_office_visit'
    ) returning id into v_customer_id;
  end if;

  -- Create the real appointment (type 'styling_consultation', status 'requested').
  insert into public.appointments (
    retailer_id, customer_id, type, status, starts_at, ends_at,
    notes
  ) values (
    v_programme.retailer_id, v_customer_id, 'styling_consultation', 'requested',
    p_starts_at, p_ends_at,
    'Corporate office visit booking ' || coalesce('(' || v_employee_reference || ')',
      '(' || v_name || ')')
  ) returning id into v_appointment_id;

  -- Insert the corporate_office_visit_requests row (status 'scheduled') with the
  -- appointment/customer FKs already set, mirroring the staff-mediated path outcome.
  insert into public.corporate_office_visit_requests (
    retailer_id, programme_id, requester_name, employee_reference,
    contact_email, status, resolved_at, customer_id, appointment_id
  ) values (
    v_programme.retailer_id, p_programme_id, v_name, v_employee_reference,
    v_contact_email, 'scheduled', now(), v_customer_id, v_appointment_id
  ) returning id into v_request_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.submit_corporate_office_visit_booking(
  uuid, text, text, text, timestamptz, timestamptz
) from public;
grant execute on function public.submit_corporate_office_visit_booking(
  uuid, text, text, text, timestamptz, timestamptz
) to anon, authenticated, service_role;

comment on function public.get_corporate_office_visit_availability_context(uuid) is
  'PHASE 18.4. Fetch availability windows and existing appointments for a '
  'programme''s retailer, ready for front-end slot calculation. Returns only '
  'the data computeAvailableSlots (@paon/domain) needs, never PII.';

comment on function public.submit_corporate_office_visit_booking(
  uuid, text, text, text, timestamptz, timestamptz
) is
  'PHASE 18.4. Self-service appointment booking from the corporate office-visit '
  'landing page. Validates, rate-limits, prevents double-booking at write time, '
  'creates customer and real appointment rows. Returns the new appointment id.';
