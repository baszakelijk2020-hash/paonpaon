-- PHASE 11.1: exceptions belong to an immutable payroll-version snapshot.
-- Recompute them whenever a new version is created, so an overtime correction
-- cannot inherit stale resolution state from the version it supersedes.

create or replace function public.refresh_payroll_period_exceptions(p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_version public.payroll_period_versions%rowtype;
begin
  select * into v_version from public.payroll_period_versions where id = p_version_id;
  if not found then raise exception 'Payroll version not found'; end if;

  delete from public.payroll_period_exceptions where version_id = p_version_id;

  insert into public.payroll_period_exceptions (
    retailer_id, version_id, source_time_entry_id, kind, detail
  )
  select v_version.retailer_id, v_version.id, snapshot.source_time_entry_id,
    case when snapshot.clock_out_at is null then 'missing_clock_out' else 'overtime' end,
    case when snapshot.clock_out_at is null then 'Clock entry has no clock-out'
      else 'Clock entry exceeds eight hours' end
  from public.payroll_period_entry_snapshots snapshot
  where snapshot.version_id = v_version.id
    and (
      snapshot.clock_out_at is null
      or extract(epoch from (snapshot.clock_out_at - snapshot.clock_in_at)) / 3600.0 > 8
    );
end; $$;

create or replace function public.open_payroll_period(p_retailer_id uuid, p_period_start date, p_period_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_staff uuid; v_branch public.retailer_branches%rowtype; v_period uuid; v_version uuid;
begin
  v_staff := public.payroll_current_staff(p_retailer_id);
  select * into v_branch from public.retailer_branches where retailer_id = p_retailer_id and is_default and deleted_at is null;
  if not found then raise exception 'A default branch is required before opening payroll'; end if;
  insert into public.payroll_periods (retailer_id, branch_id, period_start, period_end) values (p_retailer_id, v_branch.id, p_period_start, p_period_end) returning id into v_period;
  insert into public.payroll_period_versions (retailer_id, period_id, version_number, timezone, prepared_by_staff_id)
    values (p_retailer_id, v_period, 1, v_branch.timezone, v_staff) returning id into v_version;
  update public.payroll_periods set current_version_id = v_version where id = v_period;
  insert into public.payroll_period_entry_snapshots (retailer_id, version_id, source_time_entry_id, staff_id, clock_in_at, clock_out_at)
    select p_retailer_id, v_version, e.id, e.staff_id, e.clock_in_at, e.clock_out_at
    from public.staff_time_entries e where e.retailer_id = p_retailer_id
      and e.clock_in_at >= (p_period_start::timestamp at time zone v_branch.timezone)
      and e.clock_in_at < ((p_period_end + 1)::timestamp at time zone v_branch.timezone);
  perform public.refresh_payroll_period_exceptions(v_version);
  return v_period;
end; $$;

create or replace function public.correct_payroll_entry(p_period_id uuid, p_source_time_entry_id uuid, p_clock_in_at timestamptz, p_clock_out_at timestamptz, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_period public.payroll_periods%rowtype; v_previous public.payroll_period_versions%rowtype; v_staff uuid; v_version uuid; v_snapshot public.payroll_period_entry_snapshots%rowtype;
begin
  select * into v_period from public.payroll_periods where id = p_period_id for update;
  if not found then raise exception 'Payroll period not found'; end if;
  v_staff := public.payroll_current_staff(v_period.retailer_id);
  select * into v_previous from public.payroll_period_versions where id = v_period.current_version_id;
  if v_previous.state <> 'draft' then raise exception 'Approved payroll must be reopened as a new period'; end if;
  select * into v_snapshot from public.payroll_period_entry_snapshots where version_id = v_previous.id and source_time_entry_id = p_source_time_entry_id;
  if not found then raise exception 'Time entry is not in the current payroll version'; end if;
  if p_clock_out_at is not null and p_clock_out_at <= p_clock_in_at then raise exception 'Clock-out must be after clock-in'; end if;
  insert into public.payroll_period_versions (retailer_id, period_id, version_number, predecessor_version_id, timezone, prepared_by_staff_id)
    values (v_period.retailer_id, v_period.id, v_previous.version_number + 1, v_previous.id, v_previous.timezone, v_staff) returning id into v_version;
  insert into public.payroll_period_entry_snapshots (retailer_id, version_id, source_time_entry_id, staff_id, clock_in_at, clock_out_at)
    select retailer_id, v_version, source_time_entry_id, staff_id,
      case when source_time_entry_id = p_source_time_entry_id then p_clock_in_at else clock_in_at end,
      case when source_time_entry_id = p_source_time_entry_id then p_clock_out_at else clock_out_at end
    from public.payroll_period_entry_snapshots where version_id = v_previous.id;
  insert into public.payroll_period_entry_adjustments (retailer_id, version_id, source_time_entry_id, adjusted_by_staff_id, prior_clock_in_at, prior_clock_out_at, corrected_clock_in_at, corrected_clock_out_at, reason)
    values (v_period.retailer_id, v_version, p_source_time_entry_id, v_staff, v_snapshot.clock_in_at, v_snapshot.clock_out_at, p_clock_in_at, p_clock_out_at, p_reason);
  perform public.refresh_payroll_period_exceptions(v_version);
  update public.payroll_periods set current_version_id = v_version where id = v_period.id and current_version_id = v_previous.id;
  if not found then raise exception 'Payroll period changed concurrently'; end if;
  return v_version;
end; $$;

revoke all on function public.refresh_payroll_period_exceptions(uuid) from public, anon, authenticated;
