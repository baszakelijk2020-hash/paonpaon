begin;
select plan(16);

insert into public.retailers (
  id,
  legal_name,
  display_name,
  slug,
  status
) values
  (
    '71000000-0000-0000-0000-000000000001',
    'Review Tenant A Ltd',
    'Review Tenant A',
    'metadata-review-a',
    'active'
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'Review Tenant B Ltd',
    'Review Tenant B',
    'metadata-review-b',
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
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'Review Tenant A jacket',
    'review-tenant-a-jacket',
    '',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'Review Tenant B jacket',
    'review-tenant-b-jacket',
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
) values
  (
    '73000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'review-manager@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '73000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'review-worker@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.workshops (
  id,
  retailer_id,
  name,
  status
) values (
  '73500000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'Review Workshop',
  'active'
);

insert into public.retailer_staff_members (
  id,
  retailer_id,
  user_id,
  full_name,
  email,
  role,
  workshop_id,
  accepted_at
) values
  (
    '74000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'Review Manager',
    'review-manager@example.test',
    'manager',
    null,
    now()
  ),
  (
    '74000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002',
    'Review Worker',
    'review-worker@example.test',
    'worker',
    '73500000-0000-0000-0000-000000000001',
    now()
  );

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name
) values (
  '75000000-0000-0000-0000-000000000001',
  null,
  'construction',
  'half-canvas-review-fixture',
  'Half canvas'
);

insert into public.entity_metadata_assignments (
  id,
  retailer_id,
  target_type,
  target_id,
  concept_id,
  source
) values (
  '76000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000002',
  'product',
  '72000000-0000-0000-0000-000000000002',
  '75000000-0000-0000-0000-000000000001',
  'retailer'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.entity_metadata_assignments',
    'UPDATE'
  ),
  false,
  'authenticated callers cannot rewrite assignment review fields'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.entity_metadata_assignments',
    'DELETE'
  ),
  false,
  'authenticated callers cannot hard-delete assignment history'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "73000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "71000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    insert into public.entity_metadata_assignments (
      retailer_id,
      target_type,
      target_id,
      concept_id,
      source,
      review_status,
      reviewed_by_staff_id,
      reviewed_at
    ) values (
      '71000000-0000-0000-0000-000000000001',
      'product',
      '72000000-0000-0000-0000-000000000001',
      '75000000-0000-0000-0000-000000000001',
      'retailer',
      'accepted',
      '74000000-0000-0000-0000-000000000001',
      now()
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "entity_metadata_assignments"',
  'a proposal cannot assert terminal review provenance'
);

select lives_ok(
  $$
    insert into public.entity_metadata_assignments (
      id,
      retailer_id,
      target_type,
      target_id,
      concept_id,
      source
    ) values (
      '76000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000001',
      'product',
      '72000000-0000-0000-0000-000000000001',
      '75000000-0000-0000-0000-000000000001',
      'retailer'
    )
  $$,
  'a manager can create a pending proposal'
);

select throws_ok(
  $$
    update public.entity_metadata_assignments
    set review_status = 'accepted'
    where id = '76000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'permission denied for table entity_metadata_assignments',
  'review fields cannot be changed outside the review RPC'
);

select lives_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000001',
      'accepted'
    )
  $$,
  'a manager can accept a pending proposal'
);

select is(
  (
    select review_status::text || ':' || reviewed_by_staff_id::text
    from public.entity_metadata_assignments
    where id = '76000000-0000-0000-0000-000000000001'
  ),
  'accepted:74000000-0000-0000-0000-000000000001',
  'the RPC derives review status and actor from the session'
);

select is(
  (
    select count(*)
    from public.metadata_assignment_reviews
    where assignment_id = '76000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'the first decision records one review event'
);

select lives_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000001',
      'accepted'
    )
  $$,
  'repeating the same decision is idempotent'
);

select is(
  (
    select count(*)
    from public.metadata_assignment_reviews
    where assignment_id = '76000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'an idempotent repeat does not duplicate audit history'
);

select lives_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000001',
      'rejected'
    )
  $$,
  'a changed decision remains possible and auditable'
);

select is(
  (
    select count(*)
    from public.metadata_assignment_reviews
    where assignment_id = '76000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'a changed decision appends a second review event'
);

select is(
  (
    select previous_status::text
    from public.metadata_assignment_reviews
    where assignment_id = '76000000-0000-0000-0000-000000000001'
    order by created_at desc
    limit 1
  ),
  'accepted',
  'the changed decision preserves its previous terminal state'
);

select throws_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000001',
      'pending'
    )
  $$,
  'P0001',
  'Review decision must be accepted or rejected',
  'the review RPC rejects a pending decision'
);

select throws_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000002',
      'accepted'
    )
  $$,
  'P0001',
  'Metadata assignment is unavailable',
  'a manager cannot review another tenant assignment'
);

set local request.jwt.claims = '{
  "sub": "73000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "71000000-0000-0000-0000-000000000001",
    "retailer_role": "worker"
  }
}';

select throws_ok(
  $$
    select public.review_metadata_assignment(
      '76000000-0000-0000-0000-000000000001',
      'accepted'
    )
  $$,
  'P0001',
  'Not authorized to review metadata assignments',
  'workshop roles cannot review metadata assignments'
);

select * from finish();
rollback;
