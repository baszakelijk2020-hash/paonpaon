-- My Appointments booking flow (Customer Environment Rebuild V3 §6):
-- customers now choose a real branch as part of booking. Extends
-- request_appointment() with an optional p_branch_id rather than a new
-- RPC, since every other invariant (tenant re-derivation, customer
-- self-creation) stays identical. The branch is validated to belong to
-- the same retailer before being trusted.

drop function if exists public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text
);

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

revoke all on function public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) from public;
grant execute on function public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) to authenticated;
grant execute on function public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) to service_role;

comment on function public.request_appointment(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) is
  'Customer Portal appointment request, now with an optional real branch. Creates the caller''s Customer record on the spot if this is their first interaction with the retailer, same as place_order.';
