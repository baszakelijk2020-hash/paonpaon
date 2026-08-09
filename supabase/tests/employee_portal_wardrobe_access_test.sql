begin;
select plan(3);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd4000000-0000-0000-0000-000000000001', 'Wearer Wardrobe Test Ltd',
  'Wearer Wardrobe Test', 'wearer-wardrobe-test', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'wearer-wardrobe-wearer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd4000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'wearer-wardrobe-other@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd4000000-0000-0000-0000-000000000004', 'd4000000-0000-0000-0000-000000000001',
  null, 'Wearer Wardrobe Customer', 'wearer-wardrobe-customer@example.test'
);

insert into public.corporate_accounts (id, retailer_id, legal_name, account_reference)
values ('d4000000-0000-0000-0000-000000000005', 'd4000000-0000-0000-0000-000000000001', 'Wearer Wardrobe Account', 'WWA-1');

insert into public.corporate_programmes (id, retailer_id, account_id, name)
values ('d4000000-0000-0000-0000-000000000006', 'd4000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000005', 'Wearer Wardrobe Programme');

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id, customer_id)
values (
  'd4000000-0000-0000-0000-000000000007', 'd4000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000006', 'WW-REF-1', 'Wearer Wardrobe Wearer', 'associate',
  '2025-01-01', 'd4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000004'
);

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd4000000-0000-0000-0000-000000000008', 'd4000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000006', 'WW-REF-2', 'Wearer Wardrobe Other', 'associate',
  '2025-01-01', 'd4000000-0000-0000-0000-000000000003'
);

insert into public.wardrobe_items (
  id, retailer_id, customer_id, ownership_kind, provenance_source,
  category_code, display_name, condition, created_by_actor
) values (
  'd4000000-0000-0000-0000-000000000009', 'd4000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000004', 'external', 'customer_added',
  'jacket', 'Navy Blazer', 'good', 'customer'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d4000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.wardrobe_items
   where id = 'd4000000-0000-0000-0000-000000000009'),
  1,
  'the linked wearer can read their own customer''s wardrobe item'
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d4000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.wardrobe_items
   where id = 'd4000000-0000-0000-0000-000000000009'),
  0,
  'an unlinked colleague wearer cannot read it'
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d4000000-0000-0000-0000-000000000099",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.wardrobe_items
   where id = 'd4000000-0000-0000-0000-000000000009'),
  0,
  'an entirely unrelated authenticated user cannot read it'
);

select * from finish();
rollback;
