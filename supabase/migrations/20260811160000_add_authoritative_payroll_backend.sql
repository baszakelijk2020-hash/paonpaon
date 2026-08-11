-- PHASE 11.1: provider-neutral payroll periods.  Clock rows remain the
-- authoritative fact; payroll stores immutable, version-local snapshots.

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid not null references public.retailer_branches (id),
  period_start date not null,
  period_end date not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  unique (retailer_id, period_start, period_end),
  check (period_end >= period_start)
);

create table public.payroll_period_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  period_id uuid not null references public.payroll_periods (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  predecessor_version_id uuid references public.payroll_period_versions (id),
  timezone text not null check (char_length(btrim(timezone)) between 3 and 64),
  state text not null default 'draft' check (state in ('draft', 'approved')),
  prepared_by_staff_id uuid not null references public.retailer_staff_members (id),
  approved_by_staff_id uuid references public.retailer_staff_members (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_id, version_number),
  check (
    (state = 'approved') = (approved_by_staff_id is not null and approved_at is not null)
  ),
  check (approved_by_staff_id is null or approved_by_staff_id <> prepared_by_staff_id)
);

alter table public.payroll_periods
  add constraint payroll_periods_current_version_fkey
  foreign key (current_version_id) references public.payroll_period_versions (id);

create table public.payroll_period_entry_snapshots (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  version_id uuid not null references public.payroll_period_versions (id) on delete cascade,
  source_time_entry_id uuid not null references public.staff_time_entries (id),
  staff_id uuid not null references public.retailer_staff_members (id),
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (version_id, source_time_entry_id),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);

create table public.payroll_period_entry_adjustments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  version_id uuid not null references public.payroll_period_versions (id) on delete cascade,
  source_time_entry_id uuid not null references public.staff_time_entries (id),
  adjusted_by_staff_id uuid not null references public.retailer_staff_members (id),
  prior_clock_in_at timestamptz not null,
  prior_clock_out_at timestamptz,
  corrected_clock_in_at timestamptz not null,
  corrected_clock_out_at timestamptz,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (corrected_clock_out_at is null or corrected_clock_out_at > corrected_clock_in_at)
);

create table public.payroll_period_exceptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  version_id uuid not null references public.payroll_period_versions (id) on delete cascade,
  source_time_entry_id uuid references public.staff_time_entries (id),
  kind text not null check (kind in ('missing_clock_out', 'overtime', 'unscheduled_shift', 'missed_shift')),
  detail text not null check (char_length(btrim(detail)) between 1 and 1000),
  resolved_at timestamptz,
  resolved_by_staff_id uuid references public.retailer_staff_members (id),
  created_at timestamptz not null default now(),
  check ((resolved_at is null) = (resolved_by_staff_id is null))
);

create table public.payroll_period_exports (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  version_id uuid not null references public.payroll_period_versions (id) on delete restrict,
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  row_count integer not null check (row_count >= 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{8}$'),
  created_by_staff_id uuid not null references public.retailer_staff_members (id),
  created_at timestamptz not null default now()
);

create index payroll_period_versions_current_idx on public.payroll_period_versions (retailer_id, period_id, version_number desc);
create index payroll_period_exceptions_open_idx on public.payroll_period_exceptions (version_id) where resolved_at is null;

-- A caller never writes these lifecycle tables directly.  Security-definer
-- RPCs below bind staff identity to auth.uid(), enforce tenant role and make
-- the current-draft compare-and-swap authoritative.
alter table public.payroll_periods enable row level security;
alter table public.payroll_period_versions enable row level security;
alter table public.payroll_period_entry_snapshots enable row level security;
alter table public.payroll_period_entry_adjustments enable row level security;
alter table public.payroll_period_exceptions enable row level security;
alter table public.payroll_period_exports enable row level security;

revoke all on public.payroll_periods, public.payroll_period_versions,
  public.payroll_period_entry_snapshots, public.payroll_period_entry_adjustments,
  public.payroll_period_exceptions, public.payroll_period_exports from public, anon, authenticated;
grant select on public.payroll_periods, public.payroll_period_versions,
  public.payroll_period_entry_snapshots, public.payroll_period_entry_adjustments,
  public.payroll_period_exceptions, public.payroll_period_exports to authenticated, service_role;

create policy payroll_periods_manager_read on public.payroll_periods for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);
create policy payroll_versions_manager_read on public.payroll_period_versions for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);
create policy payroll_snapshots_manager_read on public.payroll_period_entry_snapshots for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);
create policy payroll_adjustments_manager_read on public.payroll_period_entry_adjustments for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);
create policy payroll_exceptions_manager_read on public.payroll_period_exceptions for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);
create policy payroll_exports_manager_read on public.payroll_period_exports for select to authenticated using (
  retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('owner', 'manager', 'admin')
);

create or replace function public.payroll_current_staff(p_retailer_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_staff_id uuid;
begin
  if p_retailer_id is distinct from public.current_retailer_id()
     or coalesce(public.current_retailer_role(), '') not in ('owner', 'manager', 'admin') then
    raise exception 'Payroll manager access required' using errcode = '42501';
  end if;
  select id into v_staff_id from public.retailer_staff_members
    where retailer_id = p_retailer_id and user_id = (select auth.uid())
      and accepted_at is not null and deleted_at is null;
  if v_staff_id is null then raise exception 'No active staff membership' using errcode = '42501'; end if;
  return v_staff_id;
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
  insert into public.payroll_period_exceptions (retailer_id, version_id, source_time_entry_id, kind, detail)
    select p_retailer_id, v_version, e.id, 'missing_clock_out', 'Clock entry has no clock-out'
    from public.staff_time_entries e where e.retailer_id = p_retailer_id and e.clock_out_at is null
      and e.clock_in_at >= (p_period_start::timestamp at time zone v_branch.timezone)
      and e.clock_in_at < ((p_period_end + 1)::timestamp at time zone v_branch.timezone);
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
  -- Resolutions are version-local too; old exceptions remain an audit record.
  insert into public.payroll_period_exceptions (retailer_id, version_id, source_time_entry_id, kind, detail, resolved_at, resolved_by_staff_id)
    select retailer_id, v_version, source_time_entry_id, kind, detail, resolved_at, resolved_by_staff_id
    from public.payroll_period_exceptions where version_id = v_previous.id;
  update public.payroll_periods set current_version_id = v_version where id = v_period.id and current_version_id = v_previous.id;
  if not found then raise exception 'Payroll period changed concurrently'; end if;
  return v_version;
end; $$;

create or replace function public.resolve_payroll_exception(p_exception_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_exception public.payroll_period_exceptions%rowtype; v_staff uuid;
begin
  select * into v_exception from public.payroll_period_exceptions where id = p_exception_id for update;
  if not found then raise exception 'Payroll exception not found'; end if;
  v_staff := public.payroll_current_staff(v_exception.retailer_id);
  update public.payroll_period_exceptions set resolved_at = now(), resolved_by_staff_id = v_staff where id = v_exception.id and resolved_at is null;
end; $$;

create or replace function public.approve_payroll_period(p_period_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_period public.payroll_periods%rowtype; v_staff uuid; v_version uuid;
begin
  select * into v_period from public.payroll_periods where id = p_period_id for update;
  if not found then raise exception 'Payroll period not found'; end if;
  v_staff := public.payroll_current_staff(v_period.retailer_id);
  update public.payroll_period_versions v set state = 'approved', approved_by_staff_id = v_staff, approved_at = now()
    where v.id = v_period.current_version_id and v.state = 'draft' and v.prepared_by_staff_id <> v_staff
      and not exists (select 1 from public.payroll_period_exceptions e where e.version_id = v.id and e.resolved_at is null)
    returning v.id into v_version;
  if v_version is null then raise exception 'Payroll approval requires a different approver, a current draft, and no unresolved exceptions'; end if;
  return v_version;
end; $$;

-- FNV-1a over the same primitive, sorted representation used by
-- buildChecksummedPayrollExport in @paon/domain.  Keeping it here makes a
-- direct RPC caller unable to substitute a plausible checksum for altered
-- rows.
create or replace function public.payroll_export_checksum(p_content text)
returns text language plpgsql immutable strict set search_path = '' as $$
declare v_hash bit(32) := x'811c9dc5'; v_index integer;
begin
  for v_index in 1..char_length(p_content) loop
    v_hash := v_hash # lpad(to_hex(ascii(substr(p_content, v_index, 1))), 8, '0')::bit(32);
    v_hash := ((v_hash::bigint * 16777619) % 4294967296)::bit(32);
  end loop;
  return lpad(to_hex(v_hash::bigint), 8, '0');
end; $$;

create or replace function public.record_payroll_export(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_version public.payroll_period_versions%rowtype; v_staff uuid; v_export uuid;
  v_rows jsonb; v_row_count integer; v_content text; v_checksum text;
begin
  select * into v_version from public.payroll_period_versions where id = p_version_id;
  if not found then raise exception 'Payroll version not found'; end if;
  v_staff := public.payroll_current_staff(v_version.retailer_id);
  if v_version.state <> 'approved' then raise exception 'Only approved payroll can be exported'; end if;
  -- Both payload and checksum are reconstructed exclusively from the current
  -- approved version. The RPC accepts no caller-controlled payroll values.
  with entry_hours as (
    select staff_id,
      round(extract(epoch from (clock_out_at - clock_in_at)) / 3600.0, 2) as hours
    from public.payroll_period_entry_snapshots
    where version_id = v_version.id and clock_out_at is not null
  ), totals as (
    select staff_id,
      round(sum(least(hours, 8)), 2) as regular_hours,
      round(sum(greatest(hours - 8, 0)), 2) as overtime_hours
    from entry_hours group by staff_id
  ), rows as (
    select staff_id, 'regular'::text as earning_code, regular_hours as hours from totals where regular_hours > 0
    union all
    select staff_id, 'overtime'::text, overtime_hours from totals where overtime_hours > 0
  ), ordered as (
    select * from rows order by staff_id, earning_code
  )
  select coalesce(jsonb_agg(jsonb_build_object('staffId', staff_id, 'earningCode', earning_code, 'hours', hours) order by staff_id, earning_code), '[]'::jsonb),
    count(*)::integer,
    coalesce(string_agg(staff_id || '|' || earning_code || '|' || trim(trailing '.' from trim(trailing '0' from hours::text)), E'\n' order by staff_id, earning_code), '')
  into v_rows, v_row_count, v_content from ordered;
  v_checksum := public.payroll_export_checksum(v_content);
  insert into public.payroll_period_exports (retailer_id, version_id, rows, row_count, checksum, created_by_staff_id)
    values (v_version.retailer_id, p_version_id, v_rows, v_row_count, v_checksum, v_staff) returning id into v_export;
  return v_export;
end; $$;

revoke all on function public.payroll_current_staff(uuid), public.open_payroll_period(uuid, date, date), public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text), public.resolve_payroll_exception(uuid), public.approve_payroll_period(uuid), public.payroll_export_checksum(text), public.record_payroll_export(uuid) from public;
grant execute on function public.open_payroll_period(uuid, date, date), public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text), public.resolve_payroll_exception(uuid), public.approve_payroll_period(uuid), public.record_payroll_export(uuid) to authenticated, service_role;
