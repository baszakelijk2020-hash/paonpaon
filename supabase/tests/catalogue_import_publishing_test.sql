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
    '81000000-0000-0000-0000-000000000001',
    'Import Publish Tenant A Ltd',
    'Import Publish A',
    'import-publish-a',
    'active'
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'Import Publish Tenant B Ltd',
    'Import Publish B',
    'import-publish-b',
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
    '83000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'import-manager@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'import-worker@example.test',
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
  '83500000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'Import Workshop',
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
    '84000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'Import Manager',
    'import-manager@example.test',
    'manager',
    null,
    now()
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000002',
    'Import Worker',
    'import-worker@example.test',
    'worker',
    '83500000-0000-0000-0000-000000000001',
    now()
  );

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name
) values (
  '85000000-0000-0000-0000-000000000001',
  null,
  'garment_type',
  'jacket',
  'Jacket'
);

insert into public.catalogue_imports (
  id,
  retailer_id,
  status,
  uploaded_by_staff_id,
  source_filename,
  source_type,
  row_count,
  contract_version
) values (
  '86000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'ready',
  '84000000-0000-0000-0000-000000000001',
  'supplier.csv',
  'csv',
  2,
  'v1'
);

insert into public.catalogue_import_rows (
  id,
  import_id,
  retailer_id,
  row_number,
  external_sku,
  raw_payload,
  proposed_product,
  validation_errors,
  status
) values
  (
    '87000000-0000-0000-0000-000000000001',
    '86000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    1,
    'IMP-PUB-001',
    '{"external_sku":"IMP-PUB-001"}'::jsonb,
    jsonb_build_object(
      'externalSku', 'IMP-PUB-001',
      'name', 'Publishable hopsack jacket',
      'description', 'A reviewed import row',
      'priceAmountMinorUnits', 45000,
      'currency', 'EUR',
      'primaryImageUrl', 'https://cdn.example.test/jacket.jpg',
      'swatchImageUrl', 'https://cdn.example.test/swatch.jpg',
      'weightGsm', 250,
      'supplierReference', 'LoroPiana-001',
      'proposedSlug', 'publishable-hopsack-jacket',
      'assetMatches', '[]'::jsonb,
      'categoryMappings', jsonb_build_array(
        jsonb_build_object(
          'rawValue', 'Jacket',
          'mappedConceptSlug', 'jacket',
          'mappedConceptId', '85000000-0000-0000-0000-000000000001',
          'status', 'mapped',
          'explanation', 'Mapped to jacket'
        )
      )
    ),
    '[]'::jsonb,
    'valid'
  ),
  (
    '87000000-0000-0000-0000-000000000002',
    '86000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    2,
    'IMP-PUB-002',
    '{"external_sku":"IMP-PUB-002"}'::jsonb,
    jsonb_build_object(
      'externalSku', 'IMP-PUB-002',
      'name', 'Pending review coat',
      'priceAmountMinorUnits', 50000,
      'currency', 'EUR',
      'proposedSlug', 'pending-review-coat',
      'assetMatches', '[]'::jsonb,
      'categoryMappings', '[]'::jsonb
    ),
    '[]'::jsonb,
    'valid'
  ),
  (
    '87000000-0000-0000-0000-000000000003',
    '86000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    3,
    'IMP-PUB-003',
    '{"external_sku":"IMP-PUB-003"}'::jsonb,
    jsonb_build_object(
      'externalSku', 'IMP-PUB-003',
      'name', 'Bad mapping coat',
      'priceAmountMinorUnits', 52000,
      'currency', 'EUR',
      'proposedSlug', 'bad-mapping-coat',
      'assetMatches', '[]'::jsonb,
      'categoryMappings', jsonb_build_array(
        jsonb_build_object(
          'rawValue', 'Ghost',
          'mappedConceptSlug', 'ghost',
          'mappedConceptId', '85000000-0000-0000-0000-000000000099',
          'status', 'mapped',
          'explanation', 'Deliberately unavailable concept for rollback'
        )
      )
    ),
    '[]'::jsonb,
    'valid'
  );

insert into public.metadata_review_tasks (
  id,
  retailer_id,
  import_row_id,
  proposed_value,
  source,
  status
) values (
  '88000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '87000000-0000-0000-0000-000000000002',
  'garment_type: overcoat',
  'supplier',
  'pending'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "83000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "81000000-0000-0000-0000-000000000001",
    "retailer_role": "worker"
  }
}';

select throws_ok(
  $$
    select public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001',
  'Not authorized to publish catalogue import rows',
  'workers cannot publish import rows'
);

set local request.jwt.claims = '{
  "sub": "83000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "81000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (
    select public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000002'
    ) ->> 'code'
  ),
  'not_reviewed',
  'pending review tasks block publishing'
);

select lives_ok(
  $$
    select public.review_catalogue_import_task(
      '88000000-0000-0000-0000-000000000001',
      'dismissed'
    )
  $$,
  'managers can dismiss import review tasks'
);

select is(
  (
    select reviewed_by_staff_id::text
    from public.metadata_review_tasks
    where id = '88000000-0000-0000-0000-000000000001'
  ),
  '84000000-0000-0000-0000-000000000001',
  'review decisions attribute the current staff actor'
);

select ok(
  (
    select (public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000001'
    ) ->> 'ok')::boolean
  ),
  'a reviewed valid row publishes successfully'
);

select is(
  (
    select status::text
    from public.catalogue_import_rows
    where id = '87000000-0000-0000-0000-000000000001'
  ),
  'published',
  'successful publish marks the import row published'
);

select ok(
  exists(
    select 1
    from public.products as product
    inner join public.catalogue_import_rows as import_row
      on import_row.published_product_id = product.id
    where import_row.id = '87000000-0000-0000-0000-000000000001'
      and product.primary_image_url = 'https://cdn.example.test/jacket.jpg'
      and product.swatch_image_url = 'https://cdn.example.test/swatch.jpg'
  ),
  'publish creates product assets from matched URLs'
);

select ok(
  exists(
    select 1
    from public.product_variants as variant
    inner join public.catalogue_import_rows as import_row
      on import_row.published_variant_id = variant.id
    where import_row.id = '87000000-0000-0000-0000-000000000001'
      and variant.sku = 'IMP-PUB-001'
      and variant.price_amount_minor_units = 45000
  ),
  'publish creates the sellable variant'
);

select ok(
  exists(
    select 1
    from public.product_fabric_profiles as profile
    inner join public.catalogue_import_rows as import_row
      on import_row.published_product_id = profile.product_id
    where import_row.id = '87000000-0000-0000-0000-000000000001'
      and profile.fabric_weight_grams_per_square_metre = 250
      and profile.supplier_reference = 'LoroPiana-001'
  ),
  'publish writes exact fabric facts'
);

select ok(
  exists(
    select 1
    from public.entity_metadata_assignments as assignment
    inner join public.catalogue_import_rows as import_row
      on import_row.published_product_id = assignment.target_id
    where import_row.id = '87000000-0000-0000-0000-000000000001'
      and assignment.concept_id = '85000000-0000-0000-0000-000000000001'
      and assignment.review_status = 'accepted'
      and assignment.reviewed_by_staff_id = '84000000-0000-0000-0000-000000000001'
      and assignment.source = 'supplier'
  ),
  'publish creates accepted assignments with audit attribution'
);

select ok(
  exists(
    select 1
    from public.metadata_assignment_reviews as review
    inner join public.entity_metadata_assignments as assignment
      on assignment.id = review.assignment_id
    inner join public.catalogue_import_rows as import_row
      on import_row.published_product_id = assignment.target_id
    where import_row.id = '87000000-0000-0000-0000-000000000001'
      and review.review_status = 'accepted'
      and review.reviewed_by_staff_id = '84000000-0000-0000-0000-000000000001'
  ),
  'accepted assignment audit evidence is append-only recorded'
);

select is(
  (
    select public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000001'
    ) ->> 'outcome'
  ),
  'already_published',
  'retrying a published row is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.products
    where retailer_id = '81000000-0000-0000-0000-000000000001'
      and deleted_at is null
  ),
  1,
  'idempotent retry does not create a second product'
);

select is(
  (
    select public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000003'
    ) ->> 'code'
  ),
  'publish_failed',
  'unavailable mapped concepts fail inside the publish transaction'
);

select ok(
  (
    select status = 'valid'
      and publish_error is not null
      and published_product_id is null
    from public.catalogue_import_rows
    where id = '87000000-0000-0000-0000-000000000003'
  ),
  'failed publish retains source/error state without a product'
);

set local request.jwt.claims = '{
  "sub": "83000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "81000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    select public.publish_catalogue_import_row(
      '87000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'Catalogue import row is unavailable',
  'cross-tenant publish is denied'
);

select * from finish();
rollback;
