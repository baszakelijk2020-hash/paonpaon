begin;
select plan(12);

insert into public.retailers (
  id,
  legal_name,
  display_name,
  slug,
  status
) values
  (
    '10000000-0000-0000-0000-000000000011',
    'Knowledge Tenant A Ltd',
    'Knowledge Tenant A',
    'knowledge-test-a',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    'Knowledge Tenant B Ltd',
    'Knowledge Tenant B',
    'knowledge-test-b',
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
  '60000000-0000-0000-0000-000000000011',
  'authenticated',
  'authenticated',
  'knowledge-manager-a@example.test',
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
  '30000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000011',
  '60000000-0000-0000-0000-000000000011',
  'Knowledge Tenant A Manager',
  'knowledge-manager-a@example.test',
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
    '40000000-0000-0000-0000-000000000011',
    null,
    'weave',
    'knowledge-canonical-weave',
    'Knowledge canonical weave'
  ),
  (
    '40000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000012',
    'weave',
    'knowledge-tenant-b-weave',
    'Knowledge tenant B weave'
  );

insert into public.knowledge_objects (
  id,
  retailer_id,
  title,
  slug,
  summary,
  display_types,
  commercial_intent,
  education_topic
) values
  (
    '51000000-0000-0000-0000-000000000101',
    null,
    'Canonical knowledge card',
    'canonical-knowledge-card',
    'Canonical knowledge summary for RLS tests.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'weaves'
  ),
  (
    '51000000-0000-0000-0000-000000000102',
    '10000000-0000-0000-0000-000000000012',
    'Tenant B knowledge card',
    'tenant-b-knowledge-card',
    'Tenant B local knowledge summary.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    'weaves'
  );

select is(
  has_table_privilege('anon', 'public.knowledge_objects', 'SELECT'),
  false,
  'anonymous callers cannot read knowledge objects'
);

select is(
  has_table_privilege('anon', 'public.retailer_knowledge_overrides', 'SELECT'),
  false,
  'anonymous callers cannot read knowledge overrides'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '60000000-0000-0000-0000-000000000011',
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'retailer_id', '10000000-0000-0000-0000-000000000011',
      'staff_role', 'manager'
    )
  )::text,
  true
);

select is(
  (
    select count(*)
    from public.knowledge_objects
    where id = '51000000-0000-0000-0000-000000000101'
  )::integer,
  1,
  'tenant A manager can read canonical knowledge'
);

select is(
  (
    select count(*)
    from public.knowledge_objects
    where id = '51000000-0000-0000-0000-000000000102'
  )::integer,
  0,
  'tenant A manager cannot read tenant B knowledge'
);

select lives_ok(
  $$
    insert into public.retailer_knowledge_overrides (
      retailer_id,
      knowledge_object_id,
      title_override,
      is_pinned
    ) values (
      '10000000-0000-0000-0000-000000000011',
      '51000000-0000-0000-0000-000000000101',
      'Tenant A local title',
      true
    )
  $$,
  'tenant A manager can override canonical knowledge presentation'
);

select throws_ok(
  $$
    insert into public.retailer_knowledge_overrides (
      retailer_id,
      knowledge_object_id,
      title_override
    ) values (
      '10000000-0000-0000-0000-000000000011',
      '51000000-0000-0000-0000-000000000102',
      'Illegal cross-tenant override'
    )
  $$,
  'Knowledge override object does not belong to the retailer',
  'tenant A cannot override tenant B knowledge'
);

select throws_ok(
  $$
    insert into public.knowledge_object_concepts (
      knowledge_object_id,
      concept_id,
      match_strength
    ) values (
      '51000000-0000-0000-0000-000000000101',
      '40000000-0000-0000-0000-000000000012',
      1
    )
  $$,
  'Canonical knowledge may link canonical concepts only',
  'canonical knowledge cannot link tenant B concepts'
);

select lives_ok(
  $$
    insert into public.knowledge_objects (
      retailer_id,
      title,
      slug,
      summary,
      display_types,
      commercial_intent,
      education_topic
    ) values (
      '10000000-0000-0000-0000-000000000011',
      'Tenant A local knowledge',
      'tenant-a-local-knowledge',
      'Tenant A local knowledge summary.',
      array['information_card']::public.knowledge_display_type[],
      'educate',
      'styling'
    )
  $$,
  'tenant A manager can create retailer-owned knowledge'
);

select throws_ok(
  $$
    insert into public.knowledge_objects (
      retailer_id,
      title,
      slug,
      summary,
      display_types,
      commercial_intent,
      education_topic
    ) values (
      '10000000-0000-0000-0000-000000000012',
      'Cross-tenant knowledge',
      'cross-tenant-knowledge',
      'Should fail RLS.',
      array['information_card']::public.knowledge_display_type[],
      'educate',
      'styling'
    )
  $$,
  'new row violates row-level security policy for table "knowledge_objects"',
  'tenant A manager cannot create tenant B knowledge'
);

select is(
  (
    select count(*)
    from public.knowledge_object_concepts as link
    join public.knowledge_objects as object
      on object.id = link.knowledge_object_id
    where object.retailer_id = '10000000-0000-0000-0000-000000000012'
  )::integer,
  0,
  'tenant A cannot read tenant B concept links through joined knowledge'
);

select is(
  (
    select count(*)
    from public.retailer_knowledge_overrides
    where retailer_id = '10000000-0000-0000-0000-000000000012'
  )::integer,
  0,
  'tenant A cannot read tenant B knowledge overrides'
);

select finish();
rollback;
