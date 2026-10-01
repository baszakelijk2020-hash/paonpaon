begin;
select plan(9);

-- Fixture: one retailer, a manager, a worker, a client, a garment, a work
-- order, a priced operation and a locked grid snapshot.
insert into public.retailers (id, legal_name, display_name, slug, status)
values ('e1000000-0000-0000-0000-000000000001', 'FT04 Ltd', 'FT04', 'ft04-dispatch-test', 'active');
insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-0000000000a1', 'ft04-manager@example.test'),
  ('e1000000-0000-0000-0000-0000000000a2', 'ft04-worker@example.test');
insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at) values
  ('e1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a1', 'Manager', 'ft04-manager@example.test', 'manager', now()),
  ('e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000a2', 'Advisor', 'ft04-worker@example.test', 'sales_associate', now());
insert into public.customers (id, retailer_id, full_name, email, lifecycle_stage)
values ('e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'Client', 'ft04-client@example.test', 'prospect');
insert into public.physical_garments (id, retailer_id, customer_id, source_kind, category_code, garment_type, description, intake_condition)
values ('e1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 'external', 'jacket', 'Jacket', 'Navy jacket', 'Good');
insert into public.alteration_work_orders (id, retailer_id, customer_id, physical_garment_id, original_quote_currency)
values ('e1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000005', 'EUR');
insert into public.alteration_operations (id, category_id, code, name)
values ('e1000000-0000-0000-0000-000000000007', (select id from public.alteration_catalogue_categories limit 1), 'ft04-test-sleeve', 'Shorten sleeves');
insert into public.alteration_price_lists (id, retailer_id, kind, name, currency)
values ('e1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000001', 'retailer', 'House', 'EUR');
insert into public.alteration_price_list_items (retailer_id, price_list_id, operation_id, amount_minor_units, currency)
values ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000007', 4500, 'EUR');
insert into public.alteration_grid_snapshots (id, retailer_id, customer_id, alteration_id, version, values)
values ('e1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000006', 1,
  '[{"operation_id": "e1000000-0000-0000-0000-000000000007", "value": 1.5}]');

-- A sales advisor cannot dispatch.
set local role authenticated;
set local request.jwt.claims = '{"sub": "e1000000-0000-0000-0000-0000000000a2", "role": "authenticated", "app_metadata": {"retailer_id": "e1000000-0000-0000-0000-000000000001", "retailer_role": "sales_associate"}}';
select throws_ok(
  $$ select public.dispatch_alteration_grid_snapshot('e1000000-0000-0000-0000-000000000009', array['e1000000-0000-0000-0000-000000000007']::uuid[], null, 'PO-1') $$,
  'P0001', 'Alterations management permission is required',
  'a sales advisor cannot dispatch the grid'
);

-- The manager dispatches with an order number.
set local request.jwt.claims = '{"sub": "e1000000-0000-0000-0000-0000000000a1", "role": "authenticated", "app_metadata": {"retailer_id": "e1000000-0000-0000-0000-000000000001", "retailer_role": "manager"}}';
select throws_like(
  $$ select public.dispatch_alteration_grid_snapshot('e1000000-0000-0000-0000-000000000009', array['e1000000-0000-0000-0000-000000000007']::uuid[], null, null, array['e1000000-0000-0000-0000-0000000000ff']::uuid[]) $$,
  '%Photos must belong to this work order%',
  'photos from elsewhere are refused'
);
select lives_ok(
  $$ select public.dispatch_alteration_grid_snapshot('e1000000-0000-0000-0000-000000000009', array['e1000000-0000-0000-0000-000000000007']::uuid[], 'Pin at the cuff', 'PO-1') $$,
  'the manager can dispatch with an order number'
);
reset role;

select is(
  (select count(*) from public.alteration_tasks where origin_grid_snapshot_id = 'e1000000-0000-0000-0000-000000000009'),
  1::bigint, 'the selected alteration becomes a proposed task'
);
select ok(
  (select instructions like '%Order: PO-1%' and instructions like '%Pin at the cuff%'
     from public.alteration_tasks where origin_grid_snapshot_id = 'e1000000-0000-0000-0000-000000000009'),
  'the task carries the order number and the workshop comments'
);
select is(
  (select order_number from public.alteration_grid_dispatches where snapshot_id = 'e1000000-0000-0000-0000-000000000009'),
  'PO-1', 'the dispatch is recorded with its order number'
);
select is(
  (select opportunity_type from public.clienteling_opportunities where source_alteration_id = 'e1000000-0000-0000-0000-000000000006'),
  'fit_profile_update', 'dispatch creates the fit-profile follow-up'
);
select is(
  (select customer_id from public.clienteling_opportunities where source_alteration_id = 'e1000000-0000-0000-0000-000000000006'),
  'e1000000-0000-0000-0000-000000000004'::uuid, 'the follow-up is for the work order''s client'
);
select is(
  (select assigned_staff_id from public.clienteling_opportunities where source_alteration_id = 'e1000000-0000-0000-0000-000000000006'),
  'e1000000-0000-0000-0000-000000000002'::uuid, 'the follow-up is assigned to whoever dispatched'
);

select * from finish();
rollback;
