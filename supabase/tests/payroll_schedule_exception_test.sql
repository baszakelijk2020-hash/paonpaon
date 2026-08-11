begin;
select plan(14);

select has_table('public', 'payroll_period_schedule_snapshots',
  'payroll versions retain immutable schedule snapshots');
select col_is_pk('public', 'payroll_period_schedule_snapshots', 'id',
  'schedule snapshots have immutable identities');
select ok(not has_table_privilege('authenticated', 'public.payroll_period_schedule_snapshots', 'INSERT'),
  'authenticated callers cannot write schedule snapshots directly');
select ok(position('payroll_period_schedule_snapshots' in pg_get_functiondef('public.open_payroll_period(uuid, date, date)'::regprocedure)) > 0,
  'opening a period captures schedule snapshots before refreshing exceptions');
select ok(position('from public.staff_shifts' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) = 0,
  'exception refresh never reads mutable current shifts');
select ok(position('tstzrange(entry_snapshot.clock_in_at, entry_snapshot.clock_out_at, ''[)'')' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) > 0,
  'schedule checks use half-open timestamp ranges');
select ok(position('''missed_shift''' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) > 0,
  'unattended snapshot shifts become missed-shift exceptions');
select ok(position('''unscheduled_shift''' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) > 0,
  'completed entries without snapshot overlap become unscheduled-shift exceptions');
select ok(position('source_shift_id' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) > 0,
  'missed-shift detail retains the immutable source-shift identity');
select ok(position('from public.payroll_period_schedule_snapshots where version_id = v_previous.id' in pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0,
  'successor payroll versions copy schedule snapshots instead of rereading the roster');

insert into public.retailers (id, legal_name, display_name, slug, status)
values ('d2300000-0000-0000-0000-000000000001', 'Payroll Schedule Test Ltd', 'Payroll Schedule Test', 'payroll-schedule-test', 'active');
insert into public.retailer_branches (id, retailer_id, name, timezone, is_default)
values ('d2300000-0000-0000-0000-000000000002', 'd2300000-0000-0000-0000-000000000001', 'UTC Branch', 'UTC', true);
insert into public.retailer_staff_members (id, retailer_id, full_name, email, role, accepted_at)
values ('d2300000-0000-0000-0000-000000000003', 'd2300000-0000-0000-0000-000000000001', 'Scheduled Staff', 'payroll-schedule@example.test', 'manager', now());
insert into public.payroll_periods (id, retailer_id, branch_id, period_start, period_end)
values ('d2300000-0000-0000-0000-000000000004', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000002', '2026-08-01', '2026-08-03');
insert into public.payroll_period_versions (id, retailer_id, period_id, version_number, timezone, prepared_by_staff_id)
values ('d2300000-0000-0000-0000-000000000005', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000004', 1, 'UTC', 'd2300000-0000-0000-0000-000000000003');
update public.payroll_periods set current_version_id = 'd2300000-0000-0000-0000-000000000005'
where id = 'd2300000-0000-0000-0000-000000000004';
insert into public.staff_shifts (id, retailer_id, staff_id, shift_date, start_time, end_time) values
  ('d2300000-0000-0000-0000-000000000011', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000003', '2026-08-01', '09:00', '17:00'),
  ('d2300000-0000-0000-0000-000000000012', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000003', '2026-08-02', '09:00', '17:00'),
  ('d2300000-0000-0000-0000-000000000013', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000003', '2026-08-03', '09:00', '17:00');
insert into public.payroll_period_schedule_snapshots (retailer_id, version_id, source_shift_id, staff_id, shift_date, start_time, end_time)
select retailer_id, 'd2300000-0000-0000-0000-000000000005', id, staff_id, shift_date, start_time, end_time
from public.staff_shifts where retailer_id = 'd2300000-0000-0000-0000-000000000001';
insert into public.staff_time_entries (id, retailer_id, staff_id, clock_in_at, clock_out_at) values
  ('d2300000-0000-0000-0000-000000000021', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000003', '2026-08-01 16:59:00+00', '2026-08-01 18:00:00+00'),
  ('d2300000-0000-0000-0000-000000000022', 'd2300000-0000-0000-0000-000000000001', 'd2300000-0000-0000-0000-000000000003', '2026-08-03 17:00:00+00', '2026-08-03 18:00:00+00');
insert into public.payroll_period_entry_snapshots (retailer_id, version_id, source_time_entry_id, staff_id, clock_in_at, clock_out_at)
select retailer_id, 'd2300000-0000-0000-0000-000000000005', id, staff_id, clock_in_at, clock_out_at
from public.staff_time_entries where retailer_id = 'd2300000-0000-0000-0000-000000000001';
select public.refresh_payroll_period_exceptions('d2300000-0000-0000-0000-000000000005');

select is((select count(*)::integer from public.payroll_period_exceptions where version_id = 'd2300000-0000-0000-0000-000000000005' and kind = 'missed_shift'), 2,
  'a no-show and an exactly-adjacent entry both produce missed-shift exceptions');
select is((select count(*)::integer from public.payroll_period_exceptions where version_id = 'd2300000-0000-0000-0000-000000000005' and kind = 'unscheduled_shift'), 1,
  'only the exactly-adjacent completed entry is unscheduled');
select is((select count(*)::integer from public.payroll_period_exceptions where version_id = 'd2300000-0000-0000-0000-000000000005' and detail like '%d2300000-0000-0000-0000-000000000011%'), 0,
  'a partial completed-entry overlap is not a schedule exception');
update public.staff_shifts set start_time = '08:00' where id = 'd2300000-0000-0000-0000-000000000012';
select public.refresh_payroll_period_exceptions('d2300000-0000-0000-0000-000000000005');
select ok(exists (
  select 1 from public.payroll_period_exceptions
  where version_id = 'd2300000-0000-0000-0000-000000000005'
    and kind = 'missed_shift'
    and detail like '%d2300000-0000-0000-0000-000000000012 (2026-08-02 09:00:00-17:00:00 UTC)%'
), 'editing the raw roster after period open cannot rewrite the snapshot exception window');

select * from finish();
rollback;
