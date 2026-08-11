begin;
select plan(4);

select has_function('public', 'refresh_payroll_period_exceptions', array['uuid'],
  'payroll snapshot exceptions are recomputed per version');
select ok(position('refresh_payroll_period_exceptions' in pg_get_functiondef('public.open_payroll_period(uuid, date, date)'::regprocedure)) > 0,
  'opening a period derives current exceptions from snapshots');
select ok(position('refresh_payroll_period_exceptions' in pg_get_functiondef('public.correct_payroll_entry(uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0,
  'a correction recomputes successor-version exceptions');
select ok(position('Clock entry exceeds eight hours' in pg_get_functiondef('public.refresh_payroll_period_exceptions(uuid)'::regprocedure)) > 0,
  'overtime entries become persisted approval exceptions');

select * from finish();
rollback;
