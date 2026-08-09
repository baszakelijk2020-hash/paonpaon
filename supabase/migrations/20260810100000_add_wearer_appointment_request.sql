-- Employee Portal write-capable self-service: a wearer requests an
-- appointment (PHASE 18.5 / BD-105) — the last named owner-boundary gap.
--
-- Deliberately NOT a reuse of `request_appointment` (20260719000015): that
-- RPC auto-creates a `customers` row keyed on `customers.user_id =
-- auth.uid()` when none exists yet. A wearer's own auth.uid() legitimately
-- may not match ANY customer row even when they DO have a linked
-- customer_id (the whole reason 20260809200000 exists: Employee Portal
-- login and linked-customer login can be two different auth users for the
-- same real person). Calling request_appointment as-is from a wearer
-- session would either silently fail to find their real linked customer,
-- or worse, fabricate a brand-new shadow customer row — exactly the
-- "shadow customer per wearer" pattern PHASE 18.6 already explicitly
-- prohibited. This RPC never creates a customer row: it only books
-- through an EXISTING link, re-derived server-side from the wearer's own
-- session, same "identity re-derived, never client-trusted" posture as
-- every other write RPC in this codebase.

create or replace function public.request_appointment_as_wearer(
  p_wearer_id uuid,
  p_type public.appointment_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wearer public.corporate_wearers%rowtype;
  v_retailer public.retailers%rowtype;
  v_appointment_id uuid;
begin
  if p_starts_at >= p_ends_at then
    raise exception 'starts_at must be before ends_at';
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_wearer
    from public.corporate_wearers
    where id = p_wearer_id
      and user_id = auth.uid()
      and deleted_at is null;
  if not found then
    raise exception 'Not authorized to request an appointment for this wearer';
  end if;

  if v_wearer.customer_id is null then
    raise exception 'Link your Employee Portal account with a manager before requesting an appointment';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_wearer.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for appointments';
  end if;

  insert into public.appointments (
    retailer_id, customer_id, type, status, starts_at, ends_at, notes
  )
  values (
    v_wearer.retailer_id, v_wearer.customer_id, p_type, 'requested',
    p_starts_at, p_ends_at, p_notes
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.request_appointment_as_wearer(
  uuid, public.appointment_type, timestamptz, timestamptz, text
) from public;
grant execute on function public.request_appointment_as_wearer(
  uuid, public.appointment_type, timestamptz, timestamptz, text
) to authenticated;
