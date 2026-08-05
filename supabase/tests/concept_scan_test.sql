begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd1000000-0000-0000-0000-000000000001',
  'Concept Test Ltd', 'Concept Test', 'concept-pgtap-test', 'active'
);
insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd1000000-0000-0000-0000-000000000009',
  'Other House Ltd', 'Other House', 'concept-pgtap-other', 'active'
);
insert into public.products (
  id, retailer_id, name, slug, status, is_made_to_order, is_alterable
) values (
  'd1000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000001',
  'Test Jacket', 'concept-pgtap-jacket', 'active', false, false
);
insert into public.product_variants (
  id, product_id, sku, size, color,
  price_amount_minor_units, price_currency, inventory_quantity
) values (
  'd1000000-0000-0000-0000-000000000003',
  'd1000000-0000-0000-0000-000000000002',
  'CONCEPT-PGTAP-1', '40R', 'Charcoal', 89000, 'USD', 3
);
insert into public.concept_scan_codes (
  id, retailer_id, product_variant_id, kind, code, status
) values (
  'd1000000-0000-0000-0000-000000000004',
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'try_on', 'ACTIVE001', 'active'
);
insert into public.concept_scan_codes (
  id, retailer_id, product_variant_id, kind, code, status
) values (
  'd1000000-0000-0000-0000-000000000005',
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'try_on', 'RECALLED1', 'recalled'
);
insert into public.concept_scan_codes (
  id, retailer_id, product_variant_id, kind, code, status, expires_at
) values (
  'd1000000-0000-0000-0000-000000000006',
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'fabric_swatch', 'EXPIRED01', 'active', now() - interval '1 day'
);

-- Customer-app entry points have no retailer/staff session, so the
-- resolve RPC must stay callable anonymously.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);

select is(
  (resolve_concept_scan_code('active001')->>'status'),
  'active',
  'an anonymous resolve is case-insensitive and returns the active status'
);
select is(
  (resolve_concept_scan_code('RECALLED1')->>'status'),
  'recalled',
  'a recalled code resolves to the recalled status, not a hard error'
);
select is(
  (resolve_concept_scan_code('EXPIRED01')->>'status'),
  'expired',
  'a code past its expires_at resolves to expired even though its stored status is still active'
);
select is(
  (resolve_concept_scan_code('NOSUCHCOD')->>'status'),
  'unknown',
  'an unknown code resolves to unknown rather than throwing'
);

select set_config('role', 'none', true);

-- add_concept_scan_selection requires an authenticated caller.
select throws_ok(
  $$select add_concept_scan_selection(
    'd1000000-0000-0000-0000-000000000001', 'ACTIVE001'
  )$$,
  'P0001',
  'Authentication required',
  'add_concept_scan_selection refuses an unauthenticated caller'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd1000000-0000-0000-0000-0000000000a1',
  'authenticated', 'authenticated', 'concept-pgtap-customer@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d1000000-0000-0000-0000-0000000000a1",
  "role": "authenticated"
}';

select throws_ok(
  $$select add_concept_scan_selection(
    'd1000000-0000-0000-0000-000000000009', 'ACTIVE001'
  )$$,
  'P0001',
  'This code belongs to a different House',
  'a code cannot be added under a different retailer than the one it was issued for'
);

select throws_ok(
  $$select add_concept_scan_selection(
    'd1000000-0000-0000-0000-000000000001', 'RECALLED1'
  )$$,
  'P0001',
  'This code has been recalled',
  'a recalled code is refused at write time, not just shown as recalled'
);

select lives_ok(
  $$select add_concept_scan_selection(
    'd1000000-0000-0000-0000-000000000001', 'active001'
  )$$,
  'adding a valid code to the selection succeeds and self-derives the caller''s customer row'
);

select is(
  (
    select count(*) from public.concept_order_selections s
    join public.customers c on c.id = s.customer_id
    where c.user_id = 'd1000000-0000-0000-0000-0000000000a1'
      and s.retailer_id = 'd1000000-0000-0000-0000-000000000001'
      and s.status = 'draft'
  ),
  1::bigint,
  'exactly one draft selection was created for this customer/retailer pair'
);

select set_config('role', 'none', true);

select * from finish();
rollback;
