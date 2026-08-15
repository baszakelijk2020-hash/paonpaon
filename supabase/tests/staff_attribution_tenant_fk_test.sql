-- Proof for 20260815000050 (tranche 4b slice 3): staff attribution cannot
-- cross a tenant boundary.
--
-- This class is about accountability rather than data ownership. Before this
-- migration a row created in House B could name a House A staff member as its
-- author, actor, approver or reviewer: the row's own retailer_id satisfied
-- RLS, and nothing checked whose employee was being named. An attribution
-- that can point across a tenant boundary is not an audit trail.
--
-- The negative case runs as a real authenticated House B manager, writing a
-- row RLS fully permits, and expects 23503.

begin;
select plan(5);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    '01000000-0000-0000-0000-000000000001',
    'Staff House A Ltd', 'Staff House A', 'staff-house-a', 'active'
  ),
  (
    '01000000-0000-0000-0000-000000000002',
    'Staff House B Ltd', 'Staff House B', 'staff-house-b', 'active'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '04000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'staff.housea@example.test', '{}', '{}', now(), now()
  ),
  (
    '04000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'staff.houseb@example.test', '{}', '{}', now(), now()
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    '05000000-0000-0000-0000-000000000001',
    '01000000-0000-0000-0000-000000000001',
    '04000000-0000-0000-0000-000000000001',
    'House A Manager', 'staff.housea@example.test', 'manager', now()
  ),
  (
    '05000000-0000-0000-0000-000000000002',
    '01000000-0000-0000-0000-000000000002',
    '04000000-0000-0000-0000-000000000002',
    'House B Manager', 'staff.houseb@example.test', 'manager', now()
  );

insert into public.retailer_branches (id, retailer_id, name, timezone)
values (
  '02000000-0000-0000-0000-000000000002',
  '01000000-0000-0000-0000-000000000002', 'House B Branch', 'Europe/Amsterdam'
);

select is(
  (
    select count(*)::int
    from pg_constraint k
    join pg_class pa on pa.oid = k.confrelid
    where k.contype = 'f'
      and array_length(k.conkey, 1) = 2
      and pa.relname = 'retailer_staff_members'
      and k.conname like '%\_ret\_fkey'
  ),
  66,
  'all 66 staff-attribution edges carry a composite tenant foreign key'
);

select is(
  (
    select count(*)::int
    from pg_constraint comp
    join pg_class pa on pa.oid = comp.confrelid
    join pg_constraint single
      on single.conrelid = comp.conrelid
     and single.confrelid = comp.confrelid
     and single.contype = 'f'
     and array_length(single.conkey, 1) = 1
     and single.conkey[1] = comp.conkey[1]
    where comp.contype = 'f'
      and comp.conname like '%\_ret\_fkey'
      and array_length(comp.conkey, 1) = 2
      and pa.relname = 'retailer_staff_members'
      and comp.confdeltype <> single.confdeltype
      and single.confdeltype <> 'n'
  ),
  0,
  'every staff-attribution key mirrors its single-column ON DELETE action'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "04000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "01000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

-- The accountability case: a House B announcement cannot be attributed to a
-- House A employee.
select throws_ok(
  $$
    insert into public.staff_announcements (
      retailer_id, branch_id, title, body, authored_by_staff_id
    ) values (
      '01000000-0000-0000-0000-000000000002',
      '02000000-0000-0000-0000-000000000002',
      'Injected', 'Attributed to another house''s employee',
      '05000000-0000-0000-0000-000000000001'
    )
  $$,
  '23503',
  null,
  'a House B announcement cannot be attributed to a House A staff member'
);

select lives_ok(
  $$
    insert into public.staff_announcements (
      id, retailer_id, branch_id, title, body, authored_by_staff_id
    ) values (
      '06000000-0000-0000-0000-000000000002',
      '01000000-0000-0000-0000-000000000002',
      '02000000-0000-0000-0000-000000000002',
      'Legitimate', 'Attributed to their own employee',
      '05000000-0000-0000-0000-000000000002'
    )
  $$,
  'the same manager can still attribute an announcement to their own staff'
);

select throws_ok(
  $$
    update public.staff_announcements
    set authored_by_staff_id = '05000000-0000-0000-0000-000000000001'
    where id = '06000000-0000-0000-0000-000000000002'
  $$,
  '23503',
  null,
  'authorship cannot be re-assigned to another house''s staff member afterwards'
);

reset request.jwt.claims;
set local role none;

select * from finish();
rollback;
