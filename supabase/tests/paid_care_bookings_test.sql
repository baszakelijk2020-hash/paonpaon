begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd8000000-0000-0000-0000-000000000001', 'Paid Care Test Ltd',
  'Paid Care Test', 'paid-care-test', 'active'
), (
  'd8000000-0000-0000-0000-000000000009', 'Paid Care Other Ltd',
  'Paid Care Other', 'paid-care-other', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd8000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'paid-care-owner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd8000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'paid-care-other-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd8000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
  'paid-care-staff@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd8000000-0000-0000-0000-000000000003', 'd8000000-0000-0000-0000-000000000001',
  'd8000000-0000-0000-0000-000000000002', 'Owner Customer', 'paid-care-owner@example.test'
), (
  'd8000000-0000-0000-0000-000000000007', 'd8000000-0000-0000-0000-000000000009',
  'd8000000-0000-0000-0000-000000000005', 'Other Retailer Customer', 'paid-care-other-customer@example.test'
);

-- Real, seeded going-rate prices exist for the retailer (never invented
-- client-side).
select cmp_ok(
  (
    select amount_minor_units from public.paid_care_service_prices
    where retailer_id = 'd8000000-0000-0000-0000-000000000001'
      and service_kind = 'dry_cleaning' and operation_code = 'suit_two_piece'
  ),
  '=', 1800,
  'a real seeded dry-cleaning price exists for a suit'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d8000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

-- The owning customer can create a real priced booking for themselves.
select lives_ok(
  $$
    insert into public.paid_care_bookings (
      retailer_id, customer_id, service_kind, garment_description, operation_code,
      operation_label, unit_amount_minor_units, total_amount_minor_units, currency,
      pickup_method, return_method, payment_choice
    ) values (
      'd8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000003',
      'dry_cleaning', 'Navy suit', 'suit_two_piece', 'Suit (2-piece)', 1800, 1800, 'EUR',
      'home', 'home', 'pay_at_pickup'
    )
  $$,
  'the owning customer can create a real priced booking for themselves'
);

select is(
  (
    select count(*)::int from public.paid_care_bookings
    where customer_id = 'd8000000-0000-0000-0000-000000000003'
  ),
  1,
  'exactly one booking is persisted'
);

select is(
  (
    select count(*)::int from public.notifications
    where customer_id = 'd8000000-0000-0000-0000-000000000003'
      and category = 'paid_care_booking'
  ),
  1,
  'booking creation triggers a real confirmation notification'
);

select isnt(
  (
    select id::text from public.paid_care_bookings
    where customer_id = 'd8000000-0000-0000-0000-000000000003'
    limit 1
  ),
  null,
  'the owning customer can read back their own booking'
);

-- A different customer cannot create a booking under someone else's
-- customer_id.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d8000000-0000-0000-0000-000000000005",
  "role": "authenticated"
}';

select throws_ok(
  $$
    insert into public.paid_care_bookings (
      retailer_id, customer_id, service_kind, garment_description,
      pickup_method, return_method, payment_choice, pricing_status
    ) values (
      'd8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000003',
      'shoe_repair', 'Impersonated booking', 'store', 'store', 'pay_at_pickup', 'confirmed_by_advisor'
    )
  $$,
  '42501',
  null,
  'a different authenticated customer cannot insert a booking against another customer_id'
);

-- Cross-customer read is denied (same session as above).
select is(
  (
    select count(*)::int from public.paid_care_bookings
    where customer_id = 'd8000000-0000-0000-0000-000000000003'
  ),
  0,
  'a different retailer''s customer cannot read another customer''s booking'
);

-- Anonymous cannot read or insert — no grant exists at all for anon, so
-- the attempt itself is refused, not merely filtered to zero rows.
set local role none;
set local role anon;

select throws_ok(
  $$ select count(*)::int from public.paid_care_bookings $$,
  '42501',
  null,
  'anonymous cannot read any paid-care booking'
);

select throws_ok(
  $$
    insert into public.paid_care_bookings (
      retailer_id, customer_id, service_kind, garment_description,
      pickup_method, return_method, payment_choice, pricing_status
    ) values (
      'd8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000003',
      'shoe_repair', 'Anonymous booking', 'store', 'store', 'pay_at_pickup', 'confirmed_by_advisor'
    )
  $$,
  '42501',
  null,
  'anonymous cannot insert a paid-care booking'
);

select * from finish();
rollback;
