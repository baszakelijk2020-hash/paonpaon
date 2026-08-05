begin;
select plan(23);

insert into public.retailers (
  id,
  legal_name,
  display_name,
  slug,
  status
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Tenant A Ltd',
    'Tenant A',
    'metadata-test-a',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Tenant B Ltd',
    'Tenant B',
    'metadata-test-b',
    'active'
  );

insert into public.products (
  id,
  retailer_id,
  name,
  slug,
  description,
  status
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Tenant A suit',
    'tenant-a-suit',
    '',
    'active'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Tenant B suit',
    'tenant-b-suit',
    '',
    'active'
  );

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '60000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'metadata-manager-a@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.retailer_staff_members (
  id,
  retailer_id,
  user_id,
  full_name,
  email,
  role,
  accepted_at
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'Tenant A Manager',
  'metadata-manager-a@example.test',
  'manager',
  now()
);

-- `active = false` deliberately: PHASE 2.4/SRCH-001 later added a public
-- "anyone can read active storefront metadata concepts" policy (OR'd with
-- the staff-scoped policy below, so any active row is visible to every
-- role regardless of tenant). Keeping these test fixtures inactive
-- isolates the staff-tenancy assertions below from that public policy —
-- otherwise every role, including 'worker' and anonymous, would see them
-- via the storefront path and the tenant-scoping checks would prove
-- nothing.
insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name,
  active
) values
  (
    '40000000-0000-0000-0000-000000000001',
    null,
    'fibre',
    'canonical-wool',
    'Canonical wool',
    false
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'fibre',
    'tenant-a-fibre',
    'Tenant A fibre',
    false
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'fibre',
    'tenant-b-fibre',
    'Tenant B fibre',
    false
  );

-- PHASE 2.4/SRCH-001 deliberately made this table anon-readable for
-- active storefront rows (see migration
-- 20260730030000_add_catalogue_query_indexes.sql); RLS still restricts
-- which *rows* anon actually sees (only active, non-deleted, canonical or
-- active-retailer concepts) — this table-level grant check only proves
-- the grant exists, not row visibility.
select is(
  has_table_privilege('anon', 'public.metadata_concepts', 'SELECT'),
  true,
  'anonymous callers can attempt to read metadata concepts (row visibility is RLS-scoped to active storefront rows, proven separately)'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.product_fabric_profiles',
    'INSERT'
  ),
  false,
  'authenticated callers cannot partially write fabric profiles'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.product_fabric_composition',
    'INSERT'
  ),
  false,
  'authenticated callers cannot partially write fabric composition'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "60000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "10000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

-- Scoped to this test's own three concept ids rather than a table-wide
-- count: the shared local database also carries a large amount of real
-- seed/feature metadata unrelated to this test, so an unscoped count is
-- not a stable assertion.
select is(
  (
    select count(*) from public.metadata_concepts
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000003'
    )
  ),
  2::bigint,
  'a retailer manager sees canonical plus own concepts only, not the other tenant''s'
);

select lives_ok(
  $$
    insert into public.metadata_concepts (
      id,
      retailer_id,
      kind,
      slug,
      canonical_name,
      active
    ) values (
      '40000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001',
      'weave',
      'tenant-a-twill',
      'Tenant A twill',
      false
    )
  $$,
  'a retailer manager can create a local concept'
);

select throws_ok(
  $$
    insert into public.metadata_concepts (
      retailer_id,
      kind,
      slug,
      canonical_name
    ) values (
      null,
      'fibre',
      'manager-canonical-fibre',
      'Manager canonical fibre'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "metadata_concepts"',
  'a retailer manager cannot create canonical concepts'
);

select throws_ok(
  $$
    insert into public.entity_metadata_assignments (
      retailer_id,
      target_type,
      target_id,
      concept_id,
      source
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'product',
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003',
      'retailer'
    )
  $$,
  -- The referenced concept (tenant B's) is inactive in this fixture, so
  -- it is invisible under RLS to the trigger's own lookup (running as
  -- invoker = the calling manager role) before the cross-tenant check
  -- ever runs — "unavailable", not "wrong tenant". A stronger isolation
  -- property than the reverse: tenant A can't even discover tenant B's
  -- private concept exists to attempt referencing it.
  'P0001',
  'Metadata concept is unavailable',
  'a local assignment cannot reference another retailer concept'
);

select throws_ok(
  $$
    insert into public.entity_metadata_assignments (
      retailer_id,
      target_type,
      target_id,
      concept_id,
      source
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'product',
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001',
      'retailer'
    )
  $$,
  'P0001',
  'Metadata target does not belong to the retailer',
  'a local assignment cannot target another retailer product'
);

select throws_ok(
  $$
    insert into public.metadata_concept_edges (
      retailer_id,
      source_concept_id,
      target_concept_id,
      kind
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000003',
      'related'
    )
  $$,
  -- Same RLS-invisibility reasoning as the assignment test above.
  'P0001',
  'Target metadata concept is unavailable',
  'a local edge cannot reference another retailer concept'
);

select throws_ok(
  $$
    insert into public.retailer_concept_overrides (
      retailer_id,
      concept_id,
      display_name
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000003',
      'Hidden foreign concept'
    )
  $$,
  -- Same RLS-invisibility reasoning as the assignment test above.
  'P0001',
  'Metadata concept is unavailable',
  'an override cannot reference another retailer concept'
);

select lives_ok(
  $$
    insert into public.retailer_concept_overrides (
      retailer_id,
      concept_id,
      display_name
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'Tenant A wool'
    )
    on conflict (retailer_id, concept_id)
    do update set display_name = excluded.display_name
  $$,
  'the repository override conflict target is backed by a unique index'
);

select lives_ok(
  $$
    insert into public.entity_metadata_assignments (
      id,
      retailer_id,
      target_type,
      target_id,
      concept_id,
      source,
      review_status,
      reviewed_by_staff_id
    ) values (
      '50000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'product',
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'retailer',
      'pending',
      null
    )
  $$,
  'a manager can propose a valid tenant assignment'
);

select lives_ok(
  $$
    select public.review_metadata_assignment(
      '50000000-0000-0000-0000-000000000001',
      'accepted'
    )
  $$,
  'a manager can accept a valid tenant assignment'
);

select is(
  (
    select count(*)
    from public.metadata_assignment_reviews
    where assignment_id = '50000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'an accepted assignment records one immutable review event'
);

select throws_ok(
  $$
    insert into public.metadata_assignment_reviews (
      retailer_id,
      assignment_id,
      review_status,
      reviewed_by_staff_id,
      source
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      'accepted',
      '30000000-0000-0000-0000-000000000001',
      'retailer'
    )
  $$,
  '42501',
  'permission denied for table metadata_assignment_reviews',
  'review history cannot be inserted directly'
);

select lives_ok(
  $$
    select public.set_product_fabric_profile(
      '20000000-0000-0000-0000-000000000001',
      null,
      285,
      'MILL-TEST-42',
      '[{
        "fibreConceptId": "40000000-0000-0000-0000-000000000001",
        "percentage": 100
      }]'::jsonb
    )
  $$,
  'a manager can atomically set an own-product fabric profile'
);

select is(
  (
    select fabric_weight_grams_per_square_metre
    from public.product_fabric_profiles
    where product_id = '20000000-0000-0000-0000-000000000001'
  ),
  285::numeric,
  'the fabric profile preserves exact fabric weight'
);

select is(
  (
    select sum(composition.percentage)
    from public.product_fabric_composition as composition
    join public.product_fabric_profiles as profile
      on profile.id = composition.profile_id
    where profile.product_id = '20000000-0000-0000-0000-000000000001'
  ),
  100::numeric,
  'the fabric profile preserves an exact 100 percent composition'
);

select throws_ok(
  $$
    select public.set_product_fabric_profile(
      '20000000-0000-0000-0000-000000000001',
      null,
      285,
      null,
      '[{
        "fibreConceptId": "40000000-0000-0000-0000-000000000001",
        "percentage": 90
      }]'::jsonb
    )
  $$,
  'P0001',
  'Fabric composition percentages must total exactly 100',
  'the atomic fabric path rejects incomplete composition'
);

select throws_ok(
  $$
    select public.set_product_fabric_profile(
      '20000000-0000-0000-0000-000000000002',
      null,
      285,
      null,
      '[{
        "fibreConceptId": "40000000-0000-0000-0000-000000000001",
        "percentage": 100
      }]'::jsonb
    )
  $$,
  'P0001',
  'Not authorized to set product fabric profile',
  'a manager cannot set another retailer fabric profile'
);

set local request.jwt.claims = '{
  "app_metadata": {
    "retailer_id": "10000000-0000-0000-0000-000000000001",
    "retailer_role": "worker"
  }
}';

select is(
  (
    select count(*) from public.metadata_concepts
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000004'
    )
  ),
  0::bigint,
  'workshop identities receive no metadata access'
);

set local request.jwt.claims = '{
  "app_metadata": {
    "platform_role": "super_admin"
  }
}';

select is(
  (
    select count(*) from public.metadata_concepts
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000004'
    )
  ),
  4::bigint,
  'platform staff can see canonical and all tenant concepts'
);

select lives_ok(
  $$
    insert into public.metadata_concepts (
      retailer_id,
      kind,
      slug,
      canonical_name
    ) values (
      null,
      'weave',
      'canonical-twill',
      'Canonical twill'
    )
  $$,
  'platform staff can create canonical concepts'
);

select * from finish();
rollback;
