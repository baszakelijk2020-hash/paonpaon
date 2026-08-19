-- FT-13 Moonstruck — wedding_guest_vouchers holds real monetary value
-- (value_minor_units) but had zero pgTAP coverage since it was wired
-- (20260802000013): only the RLS shape was reasoned about in prose.
--
-- Writing this test found a real cross-tenant integrity bug: a voucher's
-- own `retailer_id` was never checked against the `retailer_id` of the
-- `wedding_party_id` it was attached to, so a staff member could reference
-- a DIFFERENT retailer's wedding party while supplying their own
-- retailer_id. is_wedding_party_organizer_or_member(wedding_party_id) does
-- not check retailer_id either, so that other retailer's organizer could
-- then read the injected row. Fixed by migration 20260806000004 (composite
-- FK on (wedding_party_id, retailer_id) referencing wedding_parties).
-- Proves both the fix (the cross-tenant insert now fails outright) and the
-- ordinary cross-House staff/organizer read isolation.

begin;
select plan(6);

select is(
  has_table_privilege('anon', 'public.wedding_guest_vouchers', 'SELECT'),
  false,
  'anonymous callers cannot read wedding guest vouchers'
);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    '94000000-0000-0000-0000-000000000001',
    'Voucher House A Ltd', 'Voucher House A', 'voucher-house-a', 'active'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    'Voucher House B Ltd', 'Voucher House B', 'voucher-house-b', 'active'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '95000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'voucher-organizer-a@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'voucher-house-a-manager@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '95000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'voucher-house-b-manager@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customers (
  id, retailer_id, user_id, full_name, email, lifecycle_stage
) values
  (
    '96000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    'House A Organizer', 'voucher-organizer-a@example.test', 'prospect'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000002',
    null,
    'House B Organizer', 'voucher-organizer-b@example.test', 'prospect'
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    '97000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000002',
    'House A Manager', 'voucher-house-a-manager@example.test', 'manager', now()
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000003',
    'House B Manager', 'voucher-house-b-manager@example.test', 'manager', now()
  );

insert into public.wedding_parties (
  id, retailer_id, organizer_customer_id, invite_token, status
) values
  (
    '98000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000099',
    'planning'
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000002',
    '96000000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000098',
    'planning'
  );

insert into public.wedding_guest_vouchers (
  id, retailer_id, wedding_party_id, guest_label, value_minor_units,
  currency, funding_source, expires_on
) values
  (
    '99000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000001',
    'House A best man', 5000, 'EUR', 'couple', current_date + 30
  ),
  (
    '99000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000002',
    'House B best man', 7500, 'EUR', 'couple', current_date + 30
  );

-- The bug this migration fixed: House B's own retailer_id paired with
-- House A's wedding_party_id must now fail outright at the database
-- level, not merely be discouraged by the app.
select throws_ok(
  $$
    insert into public.wedding_guest_vouchers (
      retailer_id, wedding_party_id, guest_label, value_minor_units,
      currency, funding_source, expires_on
    ) values (
      '94000000-0000-0000-0000-000000000002',
      '98000000-0000-0000-0000-000000000001',
      'Injected cross-tenant voucher', 999999, 'EUR', 'couple', current_date + 30
    )
  $$,
  '23503',
  null,
  'a voucher cannot pair one retailer''s id with another retailer''s wedding party'
);

-- Cross-House staff isolation: the money-adjacent proof that matters most.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "95000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "94000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*) from public.wedding_guest_vouchers),
  1::bigint,
  'House A staff see exactly their own retailer''s voucher'
);

select is(
  (select guest_label from public.wedding_guest_vouchers limit 1),
  'House A best man',
  'the one voucher House A staff can see is House A''s own'
);

reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "95000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "94000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select is(
  (select guest_label from public.wedding_guest_vouchers limit 1),
  'House B best man',
  'symmetrically, House B staff see only House B''s own voucher'
);

-- The organizer reads their own party's voucher (customer-facing side),
-- scoped by is_wedding_party_organizer_or_member, never House B's.
reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "95000000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select is(
  (
    select array_agg(guest_label order by guest_label)
    from public.wedding_guest_vouchers
  ),
  array['House A best man'],
  'the organizer sees only their own party''s voucher, never House B''s'
);

select * from finish();
rollback;
