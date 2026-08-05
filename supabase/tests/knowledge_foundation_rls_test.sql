begin;
select plan(18);

insert into public.retailers (
  id,
  legal_name,
  display_name,
  slug,
  status
) values
  (
    '11000000-0000-0000-0000-000000000001',
    'Knowledge Tenant A Ltd',
    'Knowledge Tenant A',
    'knowledge-test-a',
    'active'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
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
) values
  (
    '61000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'knowledge-manager-a@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'knowledge-manager-b@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'knowledge-readonly-a@example.test',
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
) values
  (
    '31000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    'Knowledge Manager A',
    'knowledge-manager-a@example.test',
    'manager',
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    'Knowledge Manager B',
    'knowledge-manager-b@example.test',
    'manager',
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '11000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000003',
    'Knowledge Read Only A',
    'knowledge-readonly-a@example.test',
    'read_only',
    now()
  );

-- Tenant B's row is deliberately `active = false`: PHASE 2.3/EDU-003
-- later added a public "anyone can read active storefront knowledge
-- objects" policy (OR'd with the staff-scoped policy below, so any
-- active row on an active retailer is visible to every role regardless
-- of tenant). Keeping this fixture inactive isolates the cross-tenant
-- isolation assertions below from that public policy — otherwise tenant
-- A's manager would see tenant B's row via the storefront path and the
-- tenancy checks would prove nothing. Tenant A's own row stays active
-- since later assertions in this file need it readable by its own
-- tenant regardless of which policy grants that.
insert into public.knowledge_objects (
  id,
  retailer_id,
  topic,
  title,
  slug,
  summary,
  display_types,
  commercial_intent,
  priority,
  active
) values
  (
    '41000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'styling',
    'Tenant A styling note',
    'tenant-a-styling-note',
    'Local styling education for tenant A.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    1,
    true
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'styling',
    'Tenant B styling note',
    'tenant-b-styling-note',
    'Local styling education for tenant B.',
    array['information_card']::public.knowledge_display_type[],
    'educate',
    1,
    false
  );

insert into public.metadata_concepts (
  id,
  retailer_id,
  kind,
  slug,
  canonical_name
) values (
  '51000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'style',
  'tenant-a-knowledge-style',
  'Tenant A knowledge style'
);

-- PHASE 2.3/EDU-003 deliberately made this table anon-readable for
-- active storefront rows (see migration
-- 20260730020000_add_public_storefront_knowledge_reads.sql); RLS still
-- restricts which *rows* anon actually sees — this table-level grant
-- check only proves the grant exists, not row visibility.
select is(
  has_table_privilege('anon', 'public.knowledge_objects', 'SELECT'),
  true,
  'anonymous callers can attempt to read knowledge objects (row visibility is RLS-scoped to active storefront rows)'
);

select is(
  (
    select count(distinct topic)::integer
    from public.knowledge_objects
    where retailer_id is null
      and deleted_at is null
  ),
  12,
  'canonical fixtures cover every founder education topic'
);

select is(
  (
    select active
    from public.knowledge_objects
    where slug = 'unapproved-mill-editorial-placeholder'
  ),
  false,
  'unapproved editorial fixture remains inactive'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "61000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select ok(
  (
    select count(*)::integer
    from public.knowledge_objects
    where deleted_at is null
  ) >= 13,
  'tenant manager sees canonical knowledge plus own rows'
);

select is(
  (
    select count(*)::integer
    from public.knowledge_objects
    where retailer_id = '11000000-0000-0000-0000-000000000002'
  ),
  0,
  'tenant manager cannot see another retailer knowledge object'
);

select throws_ok(
  $$
    insert into public.knowledge_objects (
      retailer_id,
      topic,
      title,
      slug,
      summary,
      display_types,
      commercial_intent
    ) values (
      null,
      'mill',
      'Retailer forged canonical',
      'retailer-forged-canonical',
      'Retailers must not create canonical knowledge.',
      array['information_card']::public.knowledge_display_type[],
      'educate'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "knowledge_objects"',
  'retailer cannot create canonical knowledge objects'
);

update public.knowledge_objects
set title = 'Mutated canonical'
where id = 'a1000000-0000-4000-8000-000000000001';

select is(
  (
    select title
    from public.knowledge_objects
    where id = 'a1000000-0000-4000-8000-000000000001'
  ),
  'What a mill signals',
  'retailer update against canonical knowledge is a no-op under RLS'
);

select lives_ok(
  $$
    insert into public.retailer_knowledge_overrides (
      retailer_id,
      knowledge_object_id,
      display_title,
      is_hidden,
      is_pinned,
      priority_override
    ) values (
      '11000000-0000-0000-0000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      'Local mill title',
      false,
      true,
      55
    )
  $$,
  'retailer may hide/rename/prioritize/pin without mutating canonical copy'
);

select throws_ok(
  $$
    insert into public.retailer_knowledge_overrides (
      retailer_id,
      knowledge_object_id,
      is_hidden
    ) values (
      '11000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000002',
      true
    )
  $$,
  'P0001',
  'Knowledge object is unavailable',
  'override tenancy rejects another retailer knowledge object'
);

select throws_ok(
  $$
    insert into public.knowledge_object_concepts (
      knowledge_object_id,
      concept_id,
      match_strength
    ) values (
      'a1000000-0000-4000-8000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      1
    )
  $$,
  'P0001',
  'Canonical knowledge may join canonical concepts only',
  'retailer cannot attach retailer concepts to canonical knowledge'
);

reset role;
select throws_ok(
  $$
    insert into public.knowledge_object_concepts (
      knowledge_object_id,
      concept_id,
      match_strength
    ) values (
      'a1000000-0000-4000-8000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      1
    )
  $$,
  'P0001',
  'Canonical knowledge may join canonical concepts only',
  'database tenancy rejects retailer concepts on canonical knowledge'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "61000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select lives_ok(
  $$
    insert into public.knowledge_object_concepts (
      knowledge_object_id,
      concept_id,
      match_strength
    ) values (
      '41000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      1
    )
  $$,
  'retailer knowledge may join same-tenant concepts'
);

select throws_ok(
  $$
    insert into public.knowledge_object_relations (
      source_knowledge_object_id,
      target_knowledge_object_id
    ) values (
      '41000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'Target knowledge object is unavailable',
  'cross-tenant knowledge relations are denied while target stays invisible'
);

reset role;
select throws_ok(
  $$
    insert into public.knowledge_object_relations (
      source_knowledge_object_id,
      target_knowledge_object_id
    ) values (
      '41000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'Knowledge relation crosses retailer boundaries',
  'database tenancy rejects cross-tenant knowledge relations'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "61000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select lives_ok(
  $$
    insert into public.knowledge_object_relations (
      source_knowledge_object_id,
      target_knowledge_object_id
    ) values (
      '41000000-0000-0000-0000-000000000001',
      'a1000000-0000-4000-8000-000000000007'
    )
  $$,
  'retailer may relate own knowledge to readable canonical knowledge'
);

set local request.jwt.claims = '{
  "sub": "61000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

-- Not a privacy boundary any more: "anyone can read knowledge overrides
-- for active retailers" (PHASE 2.3/EDU-003) grants read access based
-- solely on the override's own retailer being active — there is no
-- per-row active/inactive flag on this table to isolate against, unlike
-- knowledge_objects above. A hide/rename/pin override is deliberately
-- public storefront-presentation data (how a retailer presents shared
-- canonical knowledge), not private tenant data, so tenant B correctly
-- seeing tenant A's override here is the intended design, not a leak.
-- The real remaining boundary — tenant B cannot *write* tenant A's
-- override — is unchanged and still enforced by the staff-scoped
-- insert/update/delete policies (untouched by this later read policy).
select is(
  (
    select count(*)::integer
    from public.retailer_knowledge_overrides
    where retailer_id = '11000000-0000-0000-0000-000000000001'
  ),
  1,
  'cross-tenant knowledge overrides are publicly readable by design (storefront presentation data), not private'
);

-- Not a privacy boundary either, for the same reason as the override
-- check above: object 001 is active on an active retailer, so "anyone
-- can read active storefront knowledge objects" (PHASE 2.3/EDU-003)
-- deliberately makes it publicly visible — active knowledge content is
-- retailer marketing/education copy, not private tenant data. The
-- earlier tenant-isolation checks in this file (e.g. "tenant manager
-- cannot see another retailer knowledge object") use an *inactive*
-- fixture specifically to still exercise the staff-only boundary in
-- isolation from this public policy.
select is(
  (
    select count(*)::integer
    from public.knowledge_objects
    where id = '41000000-0000-0000-0000-000000000001'
  ),
  1,
  'active cross-tenant knowledge rows are publicly readable by design (storefront content), not private'
);

set local request.jwt.claims = '{
  "sub": "61000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "read_only"
  }
}';

select throws_ok(
  $$
    insert into public.retailer_knowledge_overrides (
      retailer_id,
      knowledge_object_id,
      is_hidden
    ) values (
      '11000000-0000-0000-0000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
      true
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "retailer_knowledge_overrides"',
  'read-only staff cannot write knowledge overrides'
);

select * from finish();
rollback;
