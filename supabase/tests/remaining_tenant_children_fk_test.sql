-- Proof for 20260815000040 (tranche 4b slice 2).
--
-- Two jobs. First, the ordinary one: prove a child row cannot be attached to
-- another retailer's parent, as a real authenticated principal.
--
-- Second, and more important for anyone who touches this later: prove the
-- SHARED-REFERENCE PARENTS ARE STILL UNBOUND. A first cut of slice 2 bound
-- every parent that merely had a retailer_id column and broke four suites,
-- because `metadata_concepts` and `knowledge_objects` are platform-global
-- vocabulary with a NULLABLE retailer_id that tenants reference across the
-- boundary by design. Assertion 2 exists so that mistake cannot be made
-- again silently.

begin;
select plan(6);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'Branch House A Ltd', 'Branch House A', 'branch-house-a', 'active'
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'Branch House B Ltd', 'Branch House B', 'branch-house-b', 'active'
  );

insert into public.retailer_branches (id, retailer_id, name, timezone)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001', 'House A Flagship', 'Europe/Amsterdam'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000002', 'House B Flagship', 'Europe/Amsterdam'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'f4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'branch.houseb@example.test', '{}', '{}', now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'f5000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000002',
  'f4000000-0000-0000-0000-000000000002',
  'House B Manager', 'branch.houseb@example.test', 'manager', now()
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where contype = 'f'
      and conname like '%\_ret\_fkey'
      and array_length(conkey, 1) = 2
  ),
  133,
  'slice 2 added 133 composite tenant foreign keys'
);

-- The regression guard. Platform-global vocabulary must stay unbound.
select is(
  (
    select count(*)::int
    from pg_constraint k
    join pg_class pa on pa.oid = k.confrelid
    where k.contype = 'f'
      and array_length(k.conkey, 1) = 2
      and pa.relname in ('metadata_concepts', 'knowledge_objects')
  ),
  0,
  'shared platform-global parents are NOT tenant-bound — retailers reference them across the boundary by design'
);

-- Every composite key must mirror the ON DELETE action of the single-column
-- key it parallels, or deletion behaviour has silently changed.
select is(
  (
    select count(*)::int
    from pg_constraint comp
    join pg_attribute ca
      on ca.attrelid = comp.conrelid and ca.attnum = comp.conkey[1]
    join pg_constraint single
      on single.conrelid = comp.conrelid
     and single.confrelid = comp.confrelid
     and single.contype = 'f'
     and array_length(single.conkey, 1) = 1
     and single.conkey[1] = comp.conkey[1]
    where comp.contype = 'f'
      and comp.conname like '%\_ret\_fkey'
      and array_length(comp.conkey, 1) = 2
      and comp.confdeltype <> single.confdeltype
      and single.confdeltype <> 'n'
  ),
  0,
  'every composite key mirrors its single-column ON DELETE action (SET NULL becomes NO ACTION by necessity)'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "f4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "f1000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    insert into public.stock_locations (retailer_id, branch_id, code, name)
    values (
      'f1000000-0000-0000-0000-000000000002',
      'f2000000-0000-0000-0000-000000000001',
      'INJECT-1', 'Injected cross-tenant location'
    )
  $$,
  '23503',
  null,
  'an authenticated House B manager cannot attach a stock location to House A''s branch'
);

select lives_ok(
  $$
    insert into public.stock_locations (id, retailer_id, branch_id, code, name)
    values (
      'f6000000-0000-0000-0000-000000000002',
      'f1000000-0000-0000-0000-000000000002',
      'f2000000-0000-0000-0000-000000000002',
      'LEGIT-1', 'Legitimate House B location'
    )
  $$,
  'the same manager can still attach a stock location to their own branch'
);

select throws_ok(
  $$
    update public.stock_locations
    set branch_id = 'f2000000-0000-0000-0000-000000000001'
    where id = 'f6000000-0000-0000-0000-000000000002'
  $$,
  '23503',
  null,
  'an existing House B stock location cannot be re-pointed at House A''s branch'
);

reset request.jwt.claims;
set local role none;

select * from finish();
rollback;
