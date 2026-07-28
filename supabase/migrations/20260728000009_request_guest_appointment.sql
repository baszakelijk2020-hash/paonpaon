-- Guest Book Appointment from the storefront HTML chrome (ADR-034 shape).
-- Anonymous visitors can request a fitting without a session; creates or
-- reuses a prospect Customer by email, same pattern as
-- submit_table_service_inquiry. Authenticated customers still use
-- request_appointment.

create or replace function public.request_guest_appointment(
  p_retailer_id uuid,
  p_name text,
  p_email text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_phone text default null,
  p_notes text default null,
  p_type public.appointment_type default 'fitting'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_customer_id uuid;
  v_appointment_id uuid;
  v_recent_count int;
  v_composed_notes text;
begin
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if p_starts_at >= p_ends_at then
    raise exception 'starts_at must be before ends_at';
  end if;
  if p_starts_at < now() - interval '5 minutes' then
    raise exception 'Choose a future appointment time';
  end if;
  if p_type is distinct from 'fitting'
     and p_type is distinct from 'styling_consultation'
     and p_type is distinct from 'personal_shopping'
     and p_type is distinct from 'alteration_fitting'
     and p_type is distinct from 'event'
  then
    raise exception 'Unrecognized appointment type';
  end if;
  if v_phone is not null and char_length(v_phone) > 50 then
    raise exception 'Phone is too long';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'Message must be at most 2000 characters';
  end if;
  if not exists (
    select 1 from public.retailers
    where id = p_retailer_id and deleted_at is null and status = 'active'
  ) then
    raise exception 'Retailer is not open for appointments';
  end if;

  select id into v_customer_id
  from public.customers
  where retailer_id = p_retailer_id
    and lower(email) = v_email
    and deleted_at is null
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      retailer_id, full_name, email, phone, lifecycle_stage, acquisition_source
    )
    values (
      p_retailer_id, v_name, v_email, v_phone, 'prospect', 'storefront_appointment'
    )
    returning id into v_customer_id;
  elsif v_phone is not null then
    update public.customers
    set phone = coalesce(nullif(phone, ''), v_phone),
        full_name = case
          when full_name is null or full_name = '' then v_name
          else full_name
        end
    where id = v_customer_id;
  end if;

  select count(*) into v_recent_count
  from public.appointments
  where retailer_id = p_retailer_id
    and customer_id = v_customer_id
    and deleted_at is null
    and created_at > now() - interval '10 minutes';
  if v_recent_count >= 3 then
    raise exception 'Please wait a moment before requesting another appointment.';
  end if;

  v_composed_notes := nullif(
    trim(both E'\n' from concat_ws(
      E'\n',
      case when v_phone is not null then 'Phone: ' || v_phone else null end,
      v_notes
    )),
    ''
  );

  insert into public.appointments (
    retailer_id, customer_id, type, status, starts_at, ends_at, notes
  )
  values (
    p_retailer_id,
    v_customer_id,
    coalesce(p_type, 'fitting'::public.appointment_type),
    'requested',
    p_starts_at,
    p_ends_at,
    v_composed_notes
  )
  returning id into v_appointment_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
  select
    p_retailer_id,
    s.user_id,
    v_customer_id,
    'appointment_reminder',
    'New fitting request',
    left(coalesce(v_composed_notes, v_name || ' requested a fitting'), 240),
    '/appointments',
    now()
  from public.retailer_staff_members s
  where s.retailer_id = p_retailer_id
    and s.user_id is not null
    and s.accepted_at is not null
    and s.deleted_at is null
    and s.role in ('sales_associate', 'manager', 'admin', 'owner');

  return v_appointment_id;
end;
$$;

revoke all on function public.request_guest_appointment(
  uuid, text, text, timestamptz, timestamptz, text, text, public.appointment_type
) from public;
grant execute on function public.request_guest_appointment(
  uuid, text, text, timestamptz, timestamptz, text, text, public.appointment_type
) to anon, authenticated, service_role;
