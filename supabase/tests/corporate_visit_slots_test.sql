begin;
select plan(10);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  '18400000-0000-0000-0000-000000000001', 'Visit Slot Test A Ltd',
  'Visit Slot Test A', 'visit-slot-a', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '18400000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'visit-slot-owner-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '18400000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'visit-slot-associate-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  '18400000-0000-0000-0000-000000000004', '18400000-0000-0000-0000-000000000001',
  '18400000-0000-0000-0000-000000000002', 'Visit Slot Owner A',
  'visit-slot-owner-a@example.test', 'owner', now()
), (
  '18400000-0000-0000-0000-000000000005', '18400000-0000-0000-0000-000000000001',
  '18400000-0000-0000-0000-000000000003', 'Visit Slot Associate A',
  'visit-slot-associate-a@example.test', 'sales_associate', now()
);

insert into public.corporate_accounts (id, retailer_id, legal_name, account_reference)
values (
  '18400000-0000-0000-0000-000000000006', '18400000-0000-0000-0000-000000000001',
  'Visit Slot Test Corp', 'VST-001'
);

insert into public.corporate_programmes (id, retailer_id, account_id, name, active)
values (
  '18400000-0000-0000-0000-000000000007', '18400000-0000-0000-0000-000000000001',
  '18400000-0000-0000-0000-000000000006', 'Visit Slot Test Programme', true
);

-- A slot with capacity 1, starting comfortably in the future, seeded at
-- the pgTAP session's own default (bypasses RLS the way a real migration
-- insert would).
insert into public.corporate_visit_slots (id, retailer_id, programme_id, starts_at, ends_at, capacity)
values (
  '18400000-0000-0000-0000-000000000008', '18400000-0000-0000-0000-000000000001',
  '18400000-0000-0000-0000-000000000007', now() + interval '7 days', now() + interval '7 days 30 minutes',
  1
);

-- Test 1: an anonymous visitor (no auth session at all) can list open
-- slots for the programme.
set local role anon;

select is(
  (select count(*)::int from public.list_open_corporate_visit_slots('18400000-0000-0000-0000-000000000007')),
  1,
  'anonymous visitor can list the one open slot for the programme'
);

-- Test 2: an anonymous visitor can claim the slot — this is the whole
-- point of self-service booking, no staff step.
select isnt(
  (
    select public.claim_corporate_visit_slot(
      '18400000-0000-0000-0000-000000000008',
      'Visitor One', null, 'visitor-one@example.test', null
    )
  ),
  null,
  'anonymous visitor can claim an open slot'
);

reset role;

-- Test 3: the claim really incremented booked_count on the slot row.
select is(
  (select booked_count from public.corporate_visit_slots where id = '18400000-0000-0000-0000-000000000008'),
  1,
  'claiming the slot really incremented booked_count'
);

-- Test 4: the claim really created a scheduled, resolved
-- corporate_office_visit_requests row (not just a status label).
select is(
  (
    select count(*)::int from public.corporate_office_visit_requests
    where programme_id = '18400000-0000-0000-0000-000000000007'
      and status = 'scheduled'
      and resolved_at is not null
  ),
  1,
  'the claim produced a real scheduled+resolved office visit request row'
);

-- Test 5: the now-full slot (capacity 1, booked_count 1) no longer
-- appears in the open-slots list.
set local role anon;

select is(
  (select count(*)::int from public.list_open_corporate_visit_slots('18400000-0000-0000-0000-000000000007')),
  0,
  'a fully-booked slot no longer appears in the open-slots list'
);

-- Test 6: a SECOND anonymous visitor trying to claim the SAME now-full
-- slot is refused — this is the actual double-booking prevention, not
-- just the listing filter above.
select throws_ok(
  $$
    select public.claim_corporate_visit_slot(
      '18400000-0000-0000-0000-000000000008',
      'Visitor Two', null, 'visitor-two@example.test', null
    )
  $$,
  'This time slot is fully booked',
  'a second visitor claiming an already-full slot is refused'
);

reset role;

-- Test 7: booked_count did NOT change after the refused second claim —
-- confirms the refusal happened before any mutation, not a rollback of
-- a partial write.
select is(
  (select booked_count from public.corporate_visit_slots where id = '18400000-0000-0000-0000-000000000008'),
  1,
  'a refused claim leaves booked_count unchanged (no partial write)'
);

-- Test 8: claiming a canceled slot is refused even with spare capacity.
insert into public.corporate_visit_slots (
  id, retailer_id, programme_id, starts_at, ends_at, capacity, canceled_at
) values (
  '18400000-0000-0000-0000-000000000009', '18400000-0000-0000-0000-000000000001',
  '18400000-0000-0000-0000-000000000007', now() + interval '8 days', now() + interval '8 days 30 minutes',
  5, now()
);

set local role anon;

select throws_ok(
  $$
    select public.claim_corporate_visit_slot(
      '18400000-0000-0000-0000-000000000009',
      'Visitor Three', null, 'visitor-three@example.test', null
    )
  $$,
  'This time slot is no longer available',
  'claiming a canceled slot is refused even with spare capacity'
);

reset role;

-- Test 9: retailer management (owner) can create a new visit slot.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "18400000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "18400000-0000-0000-0000-000000000001",
    "retailer_role": "owner"
  }
}';

select lives_ok(
  $$
    insert into public.corporate_visit_slots (retailer_id, programme_id, starts_at, ends_at, capacity)
    values (
      '18400000-0000-0000-0000-000000000001', '18400000-0000-0000-0000-000000000007',
      now() + interval '9 days', now() + interval '9 days 30 minutes', 2
    )
  $$,
  'retailer owner can create a new corporate visit slot'
);

-- Test 10: sales_associate (non-management) is refused creating a slot —
-- matches the mtm_price_components management-only write gate.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "18400000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "18400000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    insert into public.corporate_visit_slots (retailer_id, programme_id, starts_at, ends_at, capacity)
    values (
      '18400000-0000-0000-0000-000000000001', '18400000-0000-0000-0000-000000000007',
      now() + interval '10 days', now() + interval '10 days 30 minutes', 1
    )
  $$,
  '42501',
  null,
  'sales_associate is refused creating a corporate visit slot (management-only write)'
);

select * from finish();
rollback;
