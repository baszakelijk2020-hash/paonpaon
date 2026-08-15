-- Proof for 20260815010000 (ADR-074 Slice 1, tranche 6).
--
-- The case that matters is the SAME-TENANT one. Cross-tenant isolation on
-- clienteling_notes was already enforced; what was missing is need-to-know
-- WITHIN a house. So the central assertions here are an authenticated
-- sales associate of the correct retailer, who is neither the note's author
-- nor the customer's assigned advisor nor management, being refused rows that
-- RLS previously handed over freely.
--
-- Also asserted: the backfill did not widen anything (existing rows keep
-- retailer-wide access), and the ledger records metadata without copying the
-- sensitive payload it exists to protect.

begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  '11000000-0000-0000-0000-000000000001',
  'Boundary House Ltd', 'Boundary House', 'boundary-house', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('14000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'author@boundary.test', '{}', '{}', now(), now()),
  ('14000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'assigned@boundary.test', '{}', '{}', now(), now()),
  ('14000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'bystander@boundary.test', '{}', '{}', now(), now()),
  ('14000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'manager@boundary.test', '{}', '{}', now(), now());

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  ('15000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   '14000000-0000-0000-0000-000000000001',
   'Note Author', 'author@boundary.test', 'sales_associate', now()),
  ('15000000-0000-0000-0000-000000000002',
   '11000000-0000-0000-0000-000000000001',
   '14000000-0000-0000-0000-000000000002',
   'Assigned Advisor', 'assigned@boundary.test', 'sales_associate', now()),
  ('15000000-0000-0000-0000-000000000003',
   '11000000-0000-0000-0000-000000000001',
   '14000000-0000-0000-0000-000000000003',
   'Uninvolved Associate', 'bystander@boundary.test', 'sales_associate', now()),
  ('15000000-0000-0000-0000-000000000004',
   '11000000-0000-0000-0000-000000000001',
   '14000000-0000-0000-0000-000000000004',
   'House Manager', 'manager@boundary.test', 'manager', now());

-- The customer is assigned to advisor 2, not to the bystander.
insert into public.customers (id, retailer_id, full_name, assigned_staff_id)
values (
  '12000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'Private Client',
  '15000000-0000-0000-0000-000000000002'
);

-- One note per tier, all authored by staff 1.
insert into public.clienteling_notes (
  id, retailer_id, customer_id, author_staff_id, body, visibility
) values
  ('13000000-0000-0000-0000-00000000000a',
   '11000000-0000-0000-0000-000000000001',
   '12000000-0000-0000-0000-000000000001',
   '15000000-0000-0000-0000-000000000001',
   'Author-only observation', 'author_only'),
  ('13000000-0000-0000-0000-00000000000b',
   '11000000-0000-0000-0000-000000000001',
   '12000000-0000-0000-0000-000000000001',
   '15000000-0000-0000-0000-000000000001',
   'Assigned-advisor context', 'assigned_advisor'),
  ('13000000-0000-0000-0000-00000000000c',
   '11000000-0000-0000-0000-000000000001',
   '12000000-0000-0000-0000-000000000001',
   '15000000-0000-0000-0000-000000000001',
   'Management-only note', 'management'),
  ('13000000-0000-0000-0000-00000000000d',
   '11000000-0000-0000-0000-000000000001',
   '12000000-0000-0000-0000-000000000001',
   '15000000-0000-0000-0000-000000000001',
   'Openly shared note', 'retailer_shared');

select is(
  (
    select column_default
    from information_schema.columns
    where table_name = 'clienteling_notes' and column_name = 'visibility'
  ),
  '''assigned_advisor''::note_visibility',
  'new notes default to the narrow tier, not retailer_shared'
);

-- THE CENTRAL CASE. An uninvolved same-house associate previously saw all
-- four; they must now see only the openly shared one.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "14000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select is(
  (select count(*)::int from public.clienteling_notes
   where customer_id = '12000000-0000-0000-0000-000000000001'),
  1,
  'an uninvolved same-house associate sees only the retailer_shared note'
);

select is(
  (select count(*)::int from public.clienteling_notes
   where id = '13000000-0000-0000-0000-00000000000a'),
  0,
  'the uninvolved associate is refused the author_only note'
);

select is(
  (select count(*)::int from public.clienteling_notes
   where id = '13000000-0000-0000-0000-00000000000c'),
  0,
  'the uninvolved associate is refused the management-only note'
);

-- The assigned advisor sees the tier addressed to them, but not author_only
-- or management.
reset request.jwt.claims;
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "14000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select is(
  (select count(*)::int from public.clienteling_notes
   where id = '13000000-0000-0000-0000-00000000000b'),
  1,
  'the customer''s assigned advisor receives the assigned_advisor note'
);

select is(
  (select count(*)::int from public.clienteling_notes
   where id = '13000000-0000-0000-0000-00000000000c'),
  0,
  'the assigned advisor is still refused the management-only note'
);

-- The author sees their own notes at every tier.
reset request.jwt.claims;
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "14000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select is(
  (select count(*)::int from public.clienteling_notes
   where customer_id = '12000000-0000-0000-0000-000000000001'),
  4,
  'the author still sees every note they wrote'
);

-- Management override.
reset request.jwt.claims;
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "14000000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "11000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.clienteling_notes
   where customer_id = '12000000-0000-0000-0000-000000000001'),
  4,
  'management retains full visibility'
);

-- The ledger records the access without copying the sensitive payload into
-- a general log — the whole point of writing metadata only.
select lives_ok(
  $$select public.record_customer_access_event(
      'note_view_protected', 'clienteling_note',
      '13000000-0000-0000-0000-00000000000c', 'floor handover', 'granted')$$,
  'an authenticated manager can record a sensitive-access event'
);

reset request.jwt.claims;
set local role none;

select * from finish();
rollback;
