begin;
select plan(4);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd1120000-0000-0000-0000-000000000001',
  'Payroll Approval Contract Ltd',
  'Payroll Approval Contract',
  'payroll-approval-contract',
  'active'
);

insert into public.retailer_branches (id, retailer_id, name, timezone, is_default)
values (
  'd1120000-0000-0000-0000-000000000002',
  'd1120000-0000-0000-0000-000000000001',
  'Contract Branch',
  'UTC',
  true
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1120000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'payroll-preparer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d1120000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'payroll-approver@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  ('d1120000-0000-0000-0000-000000000005', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000003', 'Payroll Preparer', 'payroll-preparer@example.test', 'manager', now()),
  ('d1120000-0000-0000-0000-000000000006', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000004', 'Payroll Approver', 'payroll-approver@example.test', 'manager', now());

insert into public.payroll_periods (id, retailer_id, branch_id, period_start, period_end)
values
  ('d1120000-0000-0000-0000-000000000011', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000002', '2026-08-01', '2026-08-01'),
  ('d1120000-0000-0000-0000-000000000012', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000002', '2026-08-02', '2026-08-02'),
  ('d1120000-0000-0000-0000-000000000013', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000002', '2026-08-03', '2026-08-03'),
  ('d1120000-0000-0000-0000-000000000014', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000002', '2026-08-04', '2026-08-04');

insert into public.payroll_period_versions (
  id, retailer_id, period_id, version_number, timezone, state, prepared_by_staff_id,
  approved_by_staff_id, approved_at
) values
  ('d1120000-0000-0000-0000-000000000021', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000011', 1, 'UTC', 'draft', 'd1120000-0000-0000-0000-000000000005', null, null),
  ('d1120000-0000-0000-0000-000000000022', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000012', 1, 'UTC', 'draft', 'd1120000-0000-0000-0000-000000000005', null, null),
  ('d1120000-0000-0000-0000-000000000023', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000013', 1, 'UTC', 'approved', 'd1120000-0000-0000-0000-000000000005', 'd1120000-0000-0000-0000-000000000006', now()),
  ('d1120000-0000-0000-0000-000000000024', 'd1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000014', 1, 'UTC', 'draft', 'd1120000-0000-0000-0000-000000000005', null, null);

update public.payroll_periods set current_version_id = case id
  when 'd1120000-0000-0000-0000-000000000011'::uuid then 'd1120000-0000-0000-0000-000000000021'::uuid
  when 'd1120000-0000-0000-0000-000000000012'::uuid then 'd1120000-0000-0000-0000-000000000022'::uuid
  when 'd1120000-0000-0000-0000-000000000013'::uuid then 'd1120000-0000-0000-0000-000000000023'::uuid
  when 'd1120000-0000-0000-0000-000000000014'::uuid then 'd1120000-0000-0000-0000-000000000024'::uuid
end
where retailer_id = 'd1120000-0000-0000-0000-000000000001';

insert into public.payroll_period_exceptions (retailer_id, version_id, kind, detail)
values ('d1120000-0000-0000-0000-000000000001', 'd1120000-0000-0000-0000-000000000022', 'overtime', 'Approval must wait for resolution');

set local role authenticated;
set local request.jwt.claim.sub = 'd1120000-0000-0000-0000-000000000003';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{"sub":"d1120000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"retailer_id":"d1120000-0000-0000-0000-000000000001","retailer_role":"manager"}}';

select throws_ok(
  $$select public.approve_payroll_period('d1120000-0000-0000-0000-000000000011')$$,
  'PPA01',
  'PAYROLL_APPROVAL_SELF_APPROVAL',
  'a preparer receives the stable self-approval denial'
);

set local request.jwt.claim.sub = 'd1120000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub":"d1120000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"retailer_id":"d1120000-0000-0000-0000-000000000001","retailer_role":"manager"}}';

select throws_ok(
  $$select public.approve_payroll_period('d1120000-0000-0000-0000-000000000012')$$,
  'PPA02',
  'PAYROLL_APPROVAL_UNRESOLVED_EXCEPTIONS',
  'an unresolved exception receives its stable denial'
);

select throws_ok(
  $$select public.approve_payroll_period('d1120000-0000-0000-0000-000000000013')$$,
  'PPA03',
  'PAYROLL_APPROVAL_NOT_CURRENT_DRAFT',
  'a non-draft current version receives its stable denial'
);

select is(
  public.approve_payroll_period('d1120000-0000-0000-0000-000000000014'),
  'd1120000-0000-0000-0000-000000000024'::uuid,
  'a different manager can approve a current exception-free draft'
);

select * from finish();
rollback;
