begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  '17700000-0000-0000-0000-000000000001', 'MTM Price Test A Ltd',
  'MTM Price Test A', 'mtm-price-a', 'active'
), (
  '17700000-0000-0000-0000-000000000002', 'MTM Price Test B Ltd',
  'MTM Price Test B', 'mtm-price-b', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '17700000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'mtm-price-owner-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '17700000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'mtm-price-associate-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '17700000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'mtm-price-owner-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  '17700000-0000-0000-0000-000000000006', '17700000-0000-0000-0000-000000000001',
  '17700000-0000-0000-0000-000000000003', 'MTM Price Owner A',
  'mtm-price-owner-a@example.test', 'owner', now()
), (
  '17700000-0000-0000-0000-000000000007', '17700000-0000-0000-0000-000000000001',
  '17700000-0000-0000-0000-000000000004', 'MTM Price Associate A',
  'mtm-price-associate-a@example.test', 'sales_associate', now()
), (
  '17700000-0000-0000-0000-000000000008', '17700000-0000-0000-0000-000000000002',
  '17700000-0000-0000-0000-000000000005', 'MTM Price Owner B',
  'mtm-price-owner-b@example.test', 'owner', now()
);

-- A real, pre-existing fabric_tier component for retailer A, inserted at
-- the pgTAP session's own default (superuser, bypasses RLS the way a seed
-- migration would) so tests 3-9 have something real to read/update/be-
-- refused-against.
insert into public.mtm_price_components (
  id, retailer_id, category, slug, display_name, price_impact_minor_units, currency
) values (
  '17700000-0000-0000-0000-000000000009', '17700000-0000-0000-0000-000000000001',
  'fabric_tier', 'aa', 'AA', 40000, 'GBP'
);

-- Test 1: owner (management role) can insert a new price component for
-- their own retailer.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17700000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17700000-0000-0000-0000-000000000001",
    "retailer_role": "owner"
  }
}';

select lives_ok(
  $$
    insert into public.mtm_price_components (
      retailer_id, category, slug, display_name, price_impact_minor_units, currency
    ) values (
      '17700000-0000-0000-0000-000000000001', 'garment_scope', 'two_piece', 'Two-Piece Suit', 0, 'GBP'
    )
  $$,
  'owner can insert a new mtm price component for their own retailer'
);

-- Test 2: sales_associate (non-management) is REFUSED an insert — pricing
-- writes are management-gated, matching the alteration price list precedent.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17700000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17700000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    insert into public.mtm_price_components (
      retailer_id, category, slug, display_name, price_impact_minor_units, currency
    ) values (
      '17700000-0000-0000-0000-000000000001', 'make_method', 'full_canvas', 'Full Canvas', 20000, 'GBP'
    )
  $$,
  '42501',
  null,
  'sales_associate is refused inserting a mtm price component (management-only write)'
);

-- Test 3: sales_associate CAN read their own retailer's price components
-- (pricing is retailer-wide readable, only writes are management-gated).
-- 2 rows by this point: the seeded fabric_tier "aa" plus test 1's own
-- garment_scope "two_piece" insert.
select is(
  (
    select count(*)::int from public.mtm_price_components
    where retailer_id = '17700000-0000-0000-0000-000000000001'
  ),
  2,
  'sales_associate can read their own retailer''s mtm price components'
);

-- Test 4: owner of retailer B cannot see retailer A's price components at all.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17700000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17700000-0000-0000-0000-000000000002",
    "retailer_role": "owner"
  }
}';

select is(
  (
    select count(*)::int from public.mtm_price_components
    where retailer_id = '17700000-0000-0000-0000-000000000001'
  ),
  0,
  'retailer B owner cannot read retailer A''s mtm price components (tenant isolation)'
);

-- Test 5: retailer B owner is refused inserting a component tagged with
-- retailer A's id (cross-tenant write attempt).
select throws_ok(
  $$
    insert into public.mtm_price_components (
      retailer_id, category, slug, display_name, price_impact_minor_units, currency
    ) values (
      '17700000-0000-0000-0000-000000000001', 'rush_fee', 'urgent', 'Urgent', 30000, 'GBP'
    )
  $$,
  '42501',
  null,
  'retailer B owner is refused inserting a component tagged with retailer A''s id'
);

-- Test 6: retailer A owner CAN update their own retailer's component
-- (e.g. renaming/repricing the seeded "AA" tier).
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17700000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17700000-0000-0000-0000-000000000001",
    "retailer_role": "owner"
  }
}';

select lives_ok(
  $$
    update public.mtm_price_components
    set display_name = 'Signature', price_impact_minor_units = 42000
    where id = '17700000-0000-0000-0000-000000000009'
  $$,
  'owner can update their own retailer''s mtm price component (rename/reprice)'
);

select is(
  (select display_name from public.mtm_price_components where id = '17700000-0000-0000-0000-000000000009'),
  'Signature',
  'the rename actually persisted'
);

-- Test 7: slug uniqueness is enforced per (retailer, category) — inserting
-- a second "aa" fabric_tier for the same retailer is refused.
select throws_ok(
  $$
    insert into public.mtm_price_components (
      retailer_id, category, slug, display_name, price_impact_minor_units, currency
    ) values (
      '17700000-0000-0000-0000-000000000001', 'fabric_tier', 'aa', 'Duplicate AA', 1, 'GBP'
    )
  $$,
  '23505',
  null,
  'a duplicate slug within the same retailer+category is refused (unique constraint)'
);

-- Test 8: the same slug IS allowed across two different retailers (no
-- global uniqueness, only per-retailer).
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17700000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17700000-0000-0000-0000-000000000002",
    "retailer_role": "owner"
  }
}';

select lives_ok(
  $$
    insert into public.mtm_price_components (
      retailer_id, category, slug, display_name, price_impact_minor_units, currency
    ) values (
      '17700000-0000-0000-0000-000000000002', 'fabric_tier', 'aa', 'AA', 40000, 'GBP'
    )
  $$,
  'the same slug is allowed for a different retailer (no global uniqueness)'
);

select * from finish();
rollback;
