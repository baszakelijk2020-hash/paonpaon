begin;
select plan(9);

-- Retailer A hosts the wedding party under test; retailer B exists purely
-- to prove a cross-retailer customer cannot redeem retailer A's voucher.
insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd9000000-0000-0000-0000-00000000a001',
  'Voucher Redemption Test Ltd', 'Voucher Redemption Test',
  'voucher-redemption-pgtap-test', 'active'
), (
  'd9000000-0000-0000-0000-00000000a002',
  'Other Retailer Ltd', 'Other Retailer',
  'voucher-redemption-pgtap-other', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d9000000-0000-0000-0000-00000000b001', 'authenticated', 'authenticated', 'organizer@voucher-pgtap.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d9000000-0000-0000-0000-00000000b002', 'authenticated', 'authenticated', 'member@voucher-pgtap.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d9000000-0000-0000-0000-00000000b003', 'authenticated', 'authenticated', 'outsider@voucher-pgtap.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d9000000-0000-0000-0000-00000000b004', 'authenticated', 'authenticated', 'other-retailer@voucher-pgtap.test', '{}'::jsonb, '{}'::jsonb, now(), now());

-- c1 organizes the party, c2 is an invited member, c3 is a same-retailer
-- customer who is neither, c4 belongs to the other retailer entirely.
insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd9000000-0000-0000-0000-00000000c001', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000b001', 'Party Organizer', 'organizer@voucher-pgtap.test'
), (
  'd9000000-0000-0000-0000-00000000c002', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000b002', 'Party Member', 'member@voucher-pgtap.test'
), (
  'd9000000-0000-0000-0000-00000000c003', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000b003', 'Same Retailer Outsider', 'outsider@voucher-pgtap.test'
), (
  'd9000000-0000-0000-0000-00000000c004', 'd9000000-0000-0000-0000-00000000a002',
  'd9000000-0000-0000-0000-00000000b004', 'Other Retailer Customer', 'other-retailer@voucher-pgtap.test'
);

insert into public.wedding_parties (id, retailer_id, organizer_customer_id, venue_name, status)
values (
  'd9000000-0000-0000-0000-00000000d001', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000c001', 'The Voucher Hall', 'planning'
);

insert into public.wedding_party_members (wedding_party_id, customer_id, name, role)
values (
  'd9000000-0000-0000-0000-00000000d001', 'd9000000-0000-0000-0000-00000000c002',
  'Party Member', 'groomsman'
);

-- v1: active, unredeemed voucher used for the outsider/cross-retailer/
-- member-redeems-successfully/double-redeem chain.
-- v2: already-expired voucher, used only for the expiry check.
-- v3: a second active voucher, used only for the "authentication required"
-- (anon) check, so it is never consumed by an earlier test case.
insert into public.wedding_guest_vouchers (
  id, retailer_id, wedding_party_id, guest_label, value_minor_units,
  currency, funding_source, expires_on
) values (
  'd9000000-0000-0000-0000-00000000e001', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000d001', 'Uncle Robert', 15000, 'EUR',
  'Couple''s gift fund', (current_date + interval '30 days')::date
), (
  'd9000000-0000-0000-0000-00000000e002', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000d001', 'Late Aunt Carol', 5000, 'EUR',
  'Couple''s gift fund', (current_date - interval '1 day')::date
), (
  'd9000000-0000-0000-0000-00000000e003', 'd9000000-0000-0000-0000-00000000a001',
  'd9000000-0000-0000-0000-00000000d001', 'Cousin Dana', 5000, 'EUR',
  'Couple''s gift fund', (current_date + interval '30 days')::date
);

-- 1. A same-retailer customer who is neither organizer nor member is
--    refused — proves "wrong customer cannot redeem somebody else's
--    voucher" even within the same retailer.
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b003", "role": "authenticated"}';
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e001')$$,
  'P0001',
  'You are not part of this wedding party',
  'a same-retailer customer outside the party cannot redeem its voucher'
);

-- 2. A customer belonging to an entirely different retailer is refused —
--    proves cross-retailer redemption is impossible.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b004", "role": "authenticated"}';
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e001')$$,
  'P0001',
  'You are not part of this wedding party',
  'a customer from a different retailer cannot redeem this voucher'
);

-- 3. No session at all is refused before any membership check runs.
set local role anon;
reset request.jwt.claims;
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e003')$$,
  'P0001',
  'Authentication required',
  'an anonymous caller cannot redeem a guest voucher'
);

-- 4. An expired voucher is refused even for the party's own organizer.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b001", "role": "authenticated"}';
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e002')$$,
  'P0001',
  'This voucher has expired',
  'an expired voucher cannot be redeemed regardless of membership'
);

-- 5. The invited member (not the organizer) successfully redeems the
--    voucher meant for the party.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b002", "role": "authenticated"}';
select lives_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e001')$$,
  'a party member can redeem the guest voucher'
);

-- 6. The same voucher cannot be redeemed a second time, including by the
--    organizer — no double-spend.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b001", "role": "authenticated"}';
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('d9000000-0000-0000-0000-00000000e001')$$,
  'P0001',
  'This voucher has already been redeemed',
  'a second redemption attempt of the same voucher is rejected'
);

-- 7. Retailer staff visibility reflects the customer redemption — the
--    existing staff SELECT policy sees the same redeemed_at the customer
--    RPC just set.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d9000000-0000-0000-0000-00000000f001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d9000000-0000-0000-0000-00000000a001",
    "retailer_role": "manager"
  }
}';
select isnt(
  (select redeemed_at from public.wedding_guest_vouchers
    where id = 'd9000000-0000-0000-0000-00000000e001'),
  null,
  'retailer staff see the voucher as redeemed after the customer RPC ran'
);

-- 8. The existing staff manual mark-redeemed path is not regressed by this
--    change — the plain update the retailer app performs still succeeds
--    under the unchanged staff RLS policy.
update public.wedding_guest_vouchers
  set redeemed_at = now()
  where id = 'd9000000-0000-0000-0000-00000000e003'
  and redeemed_at is null;
select isnt(
  (select redeemed_at from public.wedding_guest_vouchers
    where id = 'd9000000-0000-0000-0000-00000000e003'),
  null,
  'the existing staff plain-update redemption path still works unchanged'
);

-- 9. A never-created voucher id is refused before any membership check
--    can leak whether it exists.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{"sub": "d9000000-0000-0000-0000-00000000b001", "role": "authenticated"}';
select throws_ok(
  $$select public.redeem_wedding_guest_voucher('00000000-0000-0000-0000-000000000000')$$,
  'P0001',
  'Voucher not found',
  'an unknown voucher id is rejected rather than leaking another party''s data'
);

select set_config('role', 'none', true);

select * from finish();
rollback;
