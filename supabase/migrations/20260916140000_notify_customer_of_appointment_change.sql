-- Telling the customer when staff move, confirm or cancel their appointment.
--
-- Staff could already create, reassign, re-status and cancel an appointment,
-- and the customer would see it — but only if they happened to open the app.
-- Nothing was ever written to `notifications` in that direction. The only
-- appointment notification in the codebase ran the other way (a guest request
-- notifying staff), so the side that is waiting on an answer was the side that
-- never got told.
--
-- SECURITY DEFINER because `notifications` is insert-locked to the recipient's
-- own session; the tenant and the caller's right to act on this appointment are
-- both re-derived here rather than trusted from the caller.

create or replace function public.notify_customer_of_appointment_change(
  p_appointment_id uuid,
  p_title text,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
  v_user_id uuid;
begin
  select * into v_appt
    from public.appointments
    where id = p_appointment_id and deleted_at is null;
  if not found then
    raise exception 'Appointment not found';
  end if;

  -- The caller must be staff of the appointment's own retailer. current_
  -- retailer_id() reads the caller's session, so a staff member of another
  -- tenant cannot reach this row even with a correct id.
  if v_appt.retailer_id is distinct from public.current_retailer_id()
     or public.current_retailer_role() not in
        ('sales_associate', 'manager', 'admin', 'owner') then
    raise exception 'Not authorised for this appointment';
  end if;

  select c.user_id into v_user_id
    from public.customers c
    where c.id = v_appt.customer_id and c.deleted_at is null;

  -- A walk-in or guest booking has no account to notify. That is ordinary, not
  -- an error: the row simply has nowhere to go.
  if v_user_id is null then
    return;
  end if;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body,
    action_href, sent_at
  )
  values (
    v_appt.retailer_id,
    v_user_id,
    v_appt.customer_id,
    'appointment_reminder',
    left(btrim(p_title), 120),
    left(coalesce(btrim(p_body), ''), 240),
    '/appointments/' || p_appointment_id::text,
    now()
  );
end;
$$;

revoke all on function public.notify_customer_of_appointment_change(uuid, text, text)
  from public;
grant execute on function public.notify_customer_of_appointment_change(uuid, text, text)
  to authenticated, service_role;

comment on function public.notify_customer_of_appointment_change(uuid, text, text) is
  'Retailer Portal: tell the customer their appointment changed. Re-derives the tenant and the caller''s staff role from the session; silently does nothing for a guest booking with no account.';
