-- PHASE 11.1: approval failures are a stable, caller-safe contract.
-- Keep the existing SECURITY DEFINER boundary and auth-derived staff lookup;
-- only the formerly ambiguous denial is separated into distinct SQLSTATEs.

create or replace function public.approve_payroll_period(p_period_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_period public.payroll_periods%rowtype;
  v_current_version public.payroll_period_versions%rowtype;
  v_staff uuid;
  v_approved_version uuid;
begin
  select * into v_period
    from public.payroll_periods
    where id = p_period_id
    for update;
  if not found then
    raise exception 'Payroll period not found';
  end if;

  v_staff := public.payroll_current_staff(v_period.retailer_id);

  select * into v_current_version
    from public.payroll_period_versions
    where id = v_period.current_version_id
    for update;
  if not found or v_current_version.state <> 'draft' then
    raise exception using
      errcode = 'PPA03',
      message = 'PAYROLL_APPROVAL_NOT_CURRENT_DRAFT';
  end if;

  if v_current_version.prepared_by_staff_id = v_staff then
    raise exception using
      errcode = 'PPA01',
      message = 'PAYROLL_APPROVAL_SELF_APPROVAL';
  end if;

  if exists (
    select 1
    from public.payroll_period_exceptions
    where version_id = v_current_version.id
      and resolved_at is null
  ) then
    raise exception using
      errcode = 'PPA02',
      message = 'PAYROLL_APPROVAL_UNRESOLVED_EXCEPTIONS';
  end if;

  update public.payroll_period_versions
    set state = 'approved', approved_by_staff_id = v_staff, approved_at = now()
    where id = v_current_version.id
      and state = 'draft'
    returning id into v_approved_version;
  if v_approved_version is null then
    raise exception using
      errcode = 'PPA03',
      message = 'PAYROLL_APPROVAL_NOT_CURRENT_DRAFT';
  end if;

  return v_approved_version;
end;
$$;
