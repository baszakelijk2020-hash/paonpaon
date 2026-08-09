begin;
select plan(16);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd3000000-0000-0000-0000-000000000001', 'Wearer Access Test Ltd',
  'Wearer Access Test', 'wearer-access-test', 'active'
), (
  'd3000000-0000-0000-0000-00000000000b', 'Other Wearer Access House Ltd',
  'Other Wearer Access House', 'other-wearer-access-house', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd3000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'wearer-access-wearer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd3000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'wearer-access-customer-login@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd3000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'wearer-access-other-wearer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd3000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'wearer-access-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

-- The customer row uses a DIFFERENT auth user than the wearer — this is
-- the exact scenario the migration exists for: login_email (employee
-- portal) is deliberately separate from a linked customer's own login.
insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd3000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000003', 'Wearer Access Customer',
  'wearer-access-customer-login@example.test'
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd3000000-0000-0000-0000-00000000000c', 'd3000000-0000-0000-0000-00000000000b',
  null, 'Other House Customer', 'other-house-customer@example.test'
);

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  'd3000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000005', 'Wearer Access Manager',
  'wearer-access-manager@example.test', 'manager', now()
);

insert into public.corporate_accounts (id, retailer_id, legal_name, account_reference)
values ('d3000000-0000-0000-0000-000000000008', 'd3000000-0000-0000-0000-000000000001', 'Wearer Access Account', 'WAA-1');

insert into public.corporate_programmes (id, retailer_id, account_id, name)
values ('d3000000-0000-0000-0000-000000000009', 'd3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000008', 'Wearer Access Programme');

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd3000000-0000-0000-0000-00000000000a', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000009', 'WA-REF-1', 'Wearer Access Wearer', 'associate',
  '2025-01-01', 'd3000000-0000-0000-0000-000000000002'
);

-- A second wearer, no customer link, never used to read the first wearer's
-- linked customer's data.
insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd3000000-0000-0000-0000-00000000000d', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000009', 'WA-REF-2', 'Other Wearer', 'associate',
  '2025-01-01', 'd3000000-0000-0000-0000-000000000004'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d3000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

-- Cross-tenant link attempt is refused by the trigger.
select throws_ok(
  $$
    update public.corporate_wearers
    set customer_id = 'd3000000-0000-0000-0000-00000000000c'
    where id = 'd3000000-0000-0000-0000-00000000000a'
  $$,
  'P0001',
  'customer_id must belong to the same retailer as the wearer',
  'linking a wearer to a cross-tenant customer is refused'
);

-- Real same-tenant link, performed the way the staff Server Action does.
select lives_ok(
  $$
    update public.corporate_wearers
    set customer_id = 'd3000000-0000-0000-0000-000000000006'
    where id = 'd3000000-0000-0000-0000-00000000000a'
  $$,
  'staff can link a wearer to a same-tenant customer'
);

set local role none;

insert into public.appointments (id, retailer_id, customer_id, type, status, starts_at, ends_at)
values (
  'd3000000-0000-0000-0000-00000000000e', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000006', 'fitting', 'confirmed',
  now() + interval '1 day', now() + interval '1 day 1 hour'
);

insert into public.orders (
  id, retailer_id, customer_id, order_number, status, channel, currency,
  subtotal_amount_minor_units, total_amount_minor_units
) values (
  'd3000000-0000-0000-0000-00000000000f', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000006', 'WEARER-ACCESS-ORDER-1', 'placed', 'online',
  'USD', 10000, 10000
);

insert into public.customer_measurement_versions (
  id, retailer_id, customer_id, version, values, approved_by_staff_id
) values (
  'd3000000-0000-0000-0000-000000000010', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000006', 1,
  '[{"key":"chest","millimetres":1020,"capturedBy":"advisor_manual"}]'::jsonb,
  'd3000000-0000-0000-0000-000000000007'
);

insert into public.physical_garments (
  id, retailer_id, customer_id, source_kind, category_code, garment_type,
  description, intake_condition
) values (
  'd3000000-0000-0000-0000-000000000011', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000006', 'external', 'jacket', 'suit_jacket',
  'Navy suit jacket', 'good'
);

insert into public.alteration_work_orders (
  id, retailer_id, customer_id, physical_garment_id, status, original_quote_currency
) values (
  'd3000000-0000-0000-0000-000000000012', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000006', 'd3000000-0000-0000-0000-000000000011',
  'approved', 'USD'
);

-- The linked wearer can read the appointment, order, measurement version
-- and alteration.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.appointments
   where id = 'd3000000-0000-0000-0000-00000000000e'),
  1,
  'the linked wearer can read their own customer''s appointment'
);

select is(
  (select count(*)::int from public.orders
   where id = 'd3000000-0000-0000-0000-00000000000f'),
  1,
  'the linked wearer can read their own customer''s order'
);

select is(
  (select count(*)::int from public.customer_measurement_versions
   where id = 'd3000000-0000-0000-0000-000000000010'),
  1,
  'the linked wearer can read their own customer''s measurement version'
);

select is(
  (select count(*)::int from public.customer_alteration_work_orders
   where id = 'd3000000-0000-0000-0000-000000000012'),
  1,
  'the linked wearer can read their own customer''s alteration through the customer-facing view'
);

-- The un-linked second wearer cannot read any of it.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000004",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.appointments
   where id = 'd3000000-0000-0000-0000-00000000000e'),
  0,
  'an unlinked wearer cannot read a colleague''s linked appointment'
);

select is(
  (select count(*)::int from public.orders
   where id = 'd3000000-0000-0000-0000-00000000000f'),
  0,
  'an unlinked wearer cannot read a colleague''s linked order'
);

select is(
  (select count(*)::int from public.customer_measurement_versions
   where id = 'd3000000-0000-0000-0000-000000000010'),
  0,
  'an unlinked wearer cannot read a colleague''s linked measurement version'
);

select is(
  (select count(*)::int from public.customer_alteration_work_orders
   where id = 'd3000000-0000-0000-0000-000000000012'),
  0,
  'an unlinked wearer cannot read a colleague''s linked alteration'
);

-- The customer's own login (a different auth user than the wearer) still
-- reads their own data unchanged — the new policies are additive, not a
-- replacement.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.appointments
   where id = 'd3000000-0000-0000-0000-00000000000e'),
  1,
  'the customer''s own login still reads their own appointment unchanged'
);

select is(
  (select count(*)::int from public.customer_alteration_work_orders
   where id = 'd3000000-0000-0000-0000-000000000012'),
  1,
  'the customer''s own login still reads their own alteration unchanged'
);

-- A cross-House manager cannot link a wearer they do not staff.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d3000000-0000-0000-0000-00000000000b",
    "retailer_role": "manager"
  }
}';

select is(
  (
    select count(*)::int from public.corporate_wearers
    where id = 'd3000000-0000-0000-0000-00000000000a'
      and customer_id = 'd3000000-0000-0000-0000-000000000006'
  ),
  0,
  'a cross-House manager cannot see (or therefore relink) another House''s wearer row'
);

select results_eq(
  $$
    update public.corporate_wearers
    set customer_id = null
    where id = 'd3000000-0000-0000-0000-00000000000a'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'a cross-House manager''s update touches zero rows (RLS-invisible row, not merely refused)'
);

-- Silent auto-link on login: a wearer whose own auth user already owns a
-- same-retailer customer row gets linked automatically, with no staff
-- action and no new customer row created.
set local role none;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd3000000-0000-0000-0000-000000000016', 'authenticated', 'authenticated',
  'wearer-access-shared-login@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd3000000-0000-0000-0000-000000000017', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000016', 'Shared Login Customer',
  'wearer-access-shared-login@example.test'
);

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd3000000-0000-0000-0000-000000000018', 'd3000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000009', 'WA-REF-3', 'Shared Login Wearer', 'associate',
  '2025-01-01', 'd3000000-0000-0000-0000-000000000016'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d3000000-0000-0000-0000-000000000016",
  "email": "wearer-access-shared-login@example.test",
  "role": "authenticated"
}';

select lives_ok(
  $$ select public.link_my_wearer_account() $$,
  'link_my_wearer_account runs without error for a wearer with a same-login customer match'
);

select is(
  (select customer_id from public.corporate_wearers
   where id = 'd3000000-0000-0000-0000-000000000018'),
  'd3000000-0000-0000-0000-000000000017'::uuid,
  'the same-login customer match is auto-linked, no staff action required'
);

select * from finish();
rollback;
