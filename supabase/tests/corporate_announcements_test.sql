begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd5000000-0000-0000-0000-000000000001', 'Announcements Test Ltd',
  'Announcements Test', 'announcements-test', 'active'
), (
  'd5000000-0000-0000-0000-00000000000f', 'Other Announcements House Ltd',
  'Other Announcements House', 'other-announcements-house', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'announcements-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd5000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'announcements-wearer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd5000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'announcements-other-programme-wearer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  'd5000000-0000-0000-0000-000000000005', 'd5000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000002', 'Announcements Manager',
  'announcements-manager@example.test', 'manager', now()
);

insert into public.corporate_accounts (id, retailer_id, legal_name, account_reference)
values ('d5000000-0000-0000-0000-000000000006', 'd5000000-0000-0000-0000-000000000001', 'Announcements Account', 'ANN-1');

insert into public.corporate_programmes (id, retailer_id, account_id, name)
values (
  'd5000000-0000-0000-0000-000000000007', 'd5000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000006', 'Announcements Programme'
), (
  'd5000000-0000-0000-0000-00000000000c', 'd5000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000006', 'Other Announcements Programme'
);

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd5000000-0000-0000-0000-000000000008', 'd5000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-000000000007', 'ANN-REF-1', 'Announcements Wearer', 'associate',
  '2025-01-01', 'd5000000-0000-0000-0000-000000000003'
), (
  'd5000000-0000-0000-0000-00000000000d', 'd5000000-0000-0000-0000-000000000001',
  'd5000000-0000-0000-0000-00000000000c', 'ANN-REF-2', 'Other Programme Wearer', 'associate',
  '2025-01-01', 'd5000000-0000-0000-0000-000000000004'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

-- A manager can insert a draft.
select lives_ok(
  $$
    insert into public.corporate_announcements (
      id, retailer_id, programme_id, title, body, authored_by_staff_id
    ) values (
      'd5000000-0000-0000-0000-000000000009', 'd5000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000007', 'Fitting week reminder',
      'Fitting days are next Monday through Wednesday this cycle.',
      'd5000000-0000-0000-0000-000000000005'
    )
  $$,
  'a manager can create a draft announcement'
);

-- A sales_associate (below manager) cannot insert.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    insert into public.corporate_announcements (
      retailer_id, programme_id, title, body, authored_by_staff_id
    ) values (
      'd5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000007',
      'Unauthorized post', 'A sales associate should not be able to do this.',
      'd5000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  'a sales_associate cannot create an announcement'
);

-- Staff (any role) can read it while it's still a draft.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.corporate_announcements
   where id = 'd5000000-0000-0000-0000-000000000009'),
  1,
  'retailer staff can read the draft'
);

-- The wearer cannot see it while it's a draft.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.corporate_announcements
   where id = 'd5000000-0000-0000-0000-000000000009'),
  0,
  'the wearer cannot see the announcement while it is a draft'
);

-- Publish it.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select lives_ok(
  $$
    update public.corporate_announcements
    set published_at = now()
    where id = 'd5000000-0000-0000-0000-000000000009'
  $$,
  'a manager can publish the announcement'
);

-- Now the wearer in the SAME programme sees it.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.corporate_announcements
   where id = 'd5000000-0000-0000-0000-000000000009'),
  1,
  'the wearer sees the published announcement for their own programme'
);

-- A wearer in a DIFFERENT programme (same retailer) never sees it.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000004",
  "role": "authenticated"
}';

select is(
  (select count(*)::int from public.corporate_announcements
   where id = 'd5000000-0000-0000-0000-000000000009'),
  0,
  'a wearer in a different programme never sees it'
);

-- Cross-tenant staff cannot read it at all.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-00000000000f",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.corporate_announcements
   where id = 'd5000000-0000-0000-0000-000000000009'),
  0,
  'staff at a different retailer cannot read it'
);

-- Same-retailer-shaped insert (RLS would allow it) whose programme_id
-- actually belongs to a DIFFERENT retailer — the trigger, not RLS, must
-- catch this.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d5000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d5000000-0000-0000-0000-00000000000f",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    insert into public.corporate_announcements (
      retailer_id, programme_id, title, body, authored_by_staff_id
    ) values (
      'd5000000-0000-0000-0000-00000000000f', 'd5000000-0000-0000-0000-000000000007',
      'Cross tenant post', 'programme_id belongs to a different retailer.',
      'd5000000-0000-0000-0000-000000000005'
    )
  $$,
  'P0001',
  'programme_id must belong to the same retailer as the announcement',
  'a programme_id belonging to a different retailer is refused even when retailer_id matches the caller''s own'
);

select * from finish();
rollback;
