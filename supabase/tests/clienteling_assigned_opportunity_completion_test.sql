begin;
select plan(5);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  ('c1030000-0000-0000-0000-000000000001', 'Assigned Work A Ltd', 'Assigned Work A', 'assigned-work-a', 'active'),
  ('c1030000-0000-0000-0000-000000000002', 'Assigned Work B Ltd', 'Assigned Work B', 'assigned-work-b', 'active');

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c1030000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'assigned-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c1030000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'assigned-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c1030000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'assigned-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c1030000-0000-0000-0000-000000000014', 'authenticated', 'authenticated', 'assigned-other@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  ('c1030000-0000-0000-0000-000000000021', 'c1030000-0000-0000-0000-000000000001', 'c1030000-0000-0000-0000-000000000011', 'Assigned A', 'assigned-a@example.test', 'sales_associate', now()),
  ('c1030000-0000-0000-0000-000000000022', 'c1030000-0000-0000-0000-000000000001', 'c1030000-0000-0000-0000-000000000012', 'Assigned B', 'assigned-b@example.test', 'sales_associate', now()),
  ('c1030000-0000-0000-0000-000000000023', 'c1030000-0000-0000-0000-000000000001', 'c1030000-0000-0000-0000-000000000013', 'Assigned Manager', 'assigned-manager@example.test', 'manager', now()),
  ('c1030000-0000-0000-0000-000000000024', 'c1030000-0000-0000-0000-000000000002', 'c1030000-0000-0000-0000-000000000014', 'Assigned Other', 'assigned-other@example.test', 'sales_associate', now());

insert into public.customers (id, retailer_id, full_name, email)
values
  ('c1030000-0000-0000-0000-000000000031', 'c1030000-0000-0000-0000-000000000001', 'Customer A', 'customer-a@example.test'),
  ('c1030000-0000-0000-0000-000000000032', 'c1030000-0000-0000-0000-000000000002', 'Customer B', 'customer-b@example.test');

insert into public.clienteling_opportunities (
  id, retailer_id, customer_id, opportunity_type, why_now, suggested_action,
  channel, assigned_staff_id, projector_version
) values
  ('c1030000-0000-0000-0000-000000000041', 'c1030000-0000-0000-0000-000000000001', 'c1030000-0000-0000-0000-000000000031', 'interest_follow_up', 'Customer A needs a fitting follow-up', 'Call to arrange a fitting', 'phone', 'c1030000-0000-0000-0000-000000000021', 'test'),
  ('c1030000-0000-0000-0000-000000000042', 'c1030000-0000-0000-0000-000000000001', 'c1030000-0000-0000-0000-000000000031', 'interest_follow_up', 'Customer A needs a fabric follow-up', 'Send fabric options', 'message', 'c1030000-0000-0000-0000-000000000022', 'test'),
  ('c1030000-0000-0000-0000-000000000043', 'c1030000-0000-0000-0000-000000000002', 'c1030000-0000-0000-0000-000000000032', 'interest_follow_up', 'Customer B needs a fitting follow-up', 'Call to arrange a fitting', 'phone', 'c1030000-0000-0000-0000-000000000024', 'test');

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c1030000-0000-0000-0000-000000000011",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1030000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select lives_ok(
  $$ update public.clienteling_opportunities set status = 'completed'
     where id = 'c1030000-0000-0000-0000-000000000041' $$,
  'a sales associate can complete their own assigned opportunity'
);

select is(
  (select status from public.clienteling_opportunities where id = 'c1030000-0000-0000-0000-000000000041'),
  'completed',
  'self-assigned completion persists'
);

update public.clienteling_opportunities
set status = 'completed'
where id = 'c1030000-0000-0000-0000-000000000042';

select is(
  (select status from public.clienteling_opportunities where id = 'c1030000-0000-0000-0000-000000000042'),
  'draft',
  'a sales associate cannot complete a colleague''s assigned opportunity'
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c1030000-0000-0000-0000-000000000013",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1030000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select lives_ok(
  $$ update public.clienteling_opportunities set status = 'completed'
     where id = 'c1030000-0000-0000-0000-000000000042' $$,
  'a manager can update an assigned opportunity in their retailer'
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c1030000-0000-0000-0000-000000000011",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1030000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

update public.clienteling_opportunities
set status = 'completed'
where id = 'c1030000-0000-0000-0000-000000000043';

select is(
  (select status from public.clienteling_opportunities where id = 'c1030000-0000-0000-0000-000000000043'),
  null,
  'a sales associate cannot update an assigned opportunity across retailers'
);

select * from finish();
rollback;
