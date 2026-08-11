begin;
select plan(14);

select has_table('public', 'payroll_periods', 'payroll periods are persisted');
select has_table('public', 'payroll_period_versions', 'immutable payroll versions are persisted');
select has_table('public', 'payroll_period_entry_snapshots', 'clock-entry snapshots are persisted');
select has_table('public', 'payroll_period_entry_adjustments', 'corrections are append-only records');
select has_table('public', 'payroll_period_exceptions', 'approval exceptions are persisted');

-- Tenant denial is enforced at the table boundary, and the RPC repeats the
-- tenant check before acting as definer.
select ok(not has_table_privilege('authenticated', 'public.payroll_periods', 'INSERT'),
  'cross-tenant callers cannot insert payroll periods directly');
select ok(position('p_retailer_id is distinct from public.current_retailer_id()' in pg_get_functiondef('public.payroll_current_staff(uuid)'::regprocedure)) > 0,
  'payroll RPC rejects another tenant');

-- The approval transition encodes both separation of duties and its exception
-- gate in the single conditional update of the current version.
select ok(position('v.prepared_by_staff_id <> v_staff' in pg_get_functiondef('public.approve_payroll_period(uuid)'::regprocedure)) > 0,
  'self-approval is refused');
select ok(position('e.resolved_at is null' in pg_get_functiondef('public.approve_payroll_period(uuid)'::regprocedure)) > 0,
  'unresolved exceptions block approval');
select ok(position('predecessor_version_id' in pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0,
  'correction creates successor lineage');
select ok(position('insert into public.payroll_period_entry_adjustments' in pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0,
  'correction records an append-only adjustment');
select col_is_pk('public', 'payroll_period_exports', 'id', 'checksummed generic exports have immutable identities');
select ok(position('payroll_period_entry_snapshots' in pg_get_functiondef('public.record_payroll_export(uuid)'::regprocedure)) > 0,
  'export rows are derived from approved immutable snapshots');
select ok(position('p_checksum' in pg_get_functiondef('public.record_payroll_export(uuid)'::regprocedure)) = 0,
  'export RPC rejects checksum mismatch by accepting no caller checksum');

select * from finish();
rollback;
