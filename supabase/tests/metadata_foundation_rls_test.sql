begin;
select plan(22);

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

insert into public.retailer_staff_members (
  id,
  retailer_id,
  full_name,
  email,
  role,
  accepted_at
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Tenant A Manager',
  'metadata-manager-a@example.test',
  'manager',
  now()
);

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name
) values
  (
    '40000000-0000-0000-0000-000000000001',
    null,
    'fibre',
    'canonical-wool',
    'Canonical wool'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'fibre',
    'tenant-a-fibre',
    'Tenant A fibre'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'fibre',
    'tenant-b-fibre',
    'Tenant B fibre'
  );

select is(
  has_table_privilege('anon', 'public.metadata_concepts', 'SELECT'),
  false,
  'anonymous callers have no metadata table access'
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
  "app_metadata": {
    "retailer_id": "10000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*) from public.metadata_concepts),
  2::bigint,
  'a retailer manager sees canonical plus own concepts only'
);

select lives_ok(
  $$
    insert into public.metadata_concepts (
      retailer_id,
      kind,
      slug,
      canonical_name
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'weave',
      'tenant-a-twill',
      'Tenant A twill'
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
      reviewed_by_staff_id,
      reviewed_at
    ) values (
      '50000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'product',
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'retailer',
      'accepted',
      '30000000-0000-0000-0000-000000000001',
      now()
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
  (select count(*) from public.metadata_concepts),
  0::bigint,
  'workshop identities receive no metadata access'
);

set local request.jwt.claims = '{
  "app_metadata": {
    "platform_role": "super_admin"
  }
}';

select is(
  (select count(*) from public.metadata_concepts),
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
