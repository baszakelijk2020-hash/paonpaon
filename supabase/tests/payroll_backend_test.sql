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
select like(pg_get_functiondef('public.payroll_current_staff(uuid)'::regprocedure),
  '%p_retailer_id <> public.current_retailer_id()%','payroll RPC rejects another tenant');

-- The approval transition encodes both separation of duties and its exception
-- gate in the single conditional update of the current version.
select like(pg_get_functiondef('public.approve_payroll_period(uuid)'::regprocedure),
  '%v.prepared_by_staff_id <> v_staff%','self-approval is refused');
select like(pg_get_functiondef('public.approve_payroll_period(uuid)'::regprocedure),
  '%e.resolved_at is null%','unresolved exceptions block approval');
select like(pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure),
  '%predecessor_version_id%','correction creates successor lineage');
select like(pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure),
  '%insert into public.payroll_period_entry_adjustments%','correction records an append-only adjustment');
select col_is_pk('public', 'payroll_period_exports', 'id', 'checksummed generic exports have immutable identities');
select like(pg_get_functiondef('public.record_payroll_export(uuid)'::regprocedure),
  '%payroll_period_entry_snapshots%', 'export rows are derived from approved immutable snapshots');
select unlike(pg_get_functiondef('public.record_payroll_export(uuid)'::regprocedure),
  '%p_checksum%', 'export RPC rejects checksum mismatch by accepting no caller checksum');

select * from finish();
rollback;
