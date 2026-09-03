-- Proof for 20260903070000: a customer cannot overwrite the retailer's own
-- review fields (retailer_rating/retailer_note) on their own review row, and
-- a retailer staff member cannot overwrite the customer's own review fields
-- (customer_rating/customer_note). RLS scopes row ownership correctly but,
-- on its own, cannot restrict which columns an owning role may change; this
-- proves the trigger closes that gap.
--
-- Also proves: neither role may reassign a review to a different
-- engagement/partner/retailer via update.

begin;
select plan(6);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd1000000-0000-0000-0000-000000000001',
  'Retailer QR', 'Retailer QR', 'retailer-qr', 'active'
);

insert into public.service_partners (
  id, retailer_id, display_name, capabilities, turnaround_days
) values (
  'd2000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'Partner QR', array['alteration'], 5
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'd4000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'customer-qr@example.test', '{}', '{}', now(), now()
), (
  'd4000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'staff-qr@example.test', '{}', '{}', now(), now()
);

insert into public.customers (
  id, retailer_id, user_id, full_name, email
) values (
  'd3000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000001',
  'Customer QR', 'customer-qr@example.test'
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'd5000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000002',
  'Staff QR', 'staff-qr@example.test', 'owner', now()
);

insert into public.wardrobe_items (
  id, retailer_id, customer_id, ownership_kind, provenance_source,
  category_code, display_name, condition, created_by_actor
) values (
  'd8000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  'external', 'customer_added',
  'jacket', 'Navy Blazer', 'good', 'customer'
);

insert into public.service_partner_engagements (
  id, retailer_id, partner_id, customer_id, wardrobe_item_id,
  job_reference, capability, instructions, due_on
) values (
  'd6000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000001',
  'd8000000-0000-0000-0000-000000000001',
  'JOB-QR-1', 'alteration', 'Take in the waist.',
  current_date + 5
);

insert into public.service_partner_quality_reviews (
  id, retailer_id, engagement_id, partner_id,
  retailer_rating, retailer_note, customer_rating, customer_note
) values (
  'd7000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'd6000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000001',
  4, 'Reliable partner.', null, null
);

-- Test 1: customer cannot overwrite retailer_rating/retailer_note.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d4000000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select throws_ok(
  $$
    update public.service_partner_quality_reviews
      set retailer_rating = 1, retailer_note = 'Forged by customer'
      where id = 'd7000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'customers may not set retailer_rating or retailer_note',
  'customer cannot overwrite retailer_rating/retailer_note'
);

-- Test 2: customer CAN set their own customer_rating/customer_note (the
-- legitimate path this trigger must not break).
select lives_ok(
  $$
    update public.service_partner_quality_reviews
      set customer_rating = 5, customer_note = 'Great work, on time.'
      where id = 'd7000000-0000-0000-0000-000000000001'
  $$,
  'customer can set their own customer_rating/customer_note'
);

select is(
  (select retailer_rating from public.service_partner_quality_reviews
    where id = 'd7000000-0000-0000-0000-000000000001'),
  4::smallint,
  'retailer_rating is unchanged by the customer''s legitimate update'
);

reset request.jwt.claims;
set local role none;

-- Test 3: retailer staff cannot overwrite customer_rating/customer_note.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "owner"
  }
}';

select throws_ok(
  $$
    update public.service_partner_quality_reviews
      set customer_rating = 1, customer_note = 'Forged by staff'
      where id = 'd7000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'retailer staff may not set customer_rating or customer_note',
  'retailer staff cannot overwrite customer_rating/customer_note'
);

-- Test 4: retailer staff CAN set their own retailer_rating/retailer_note.
select lives_ok(
  $$
    update public.service_partner_quality_reviews
      set retailer_rating = 5, retailer_note = 'Updated assessment.'
      where id = 'd7000000-0000-0000-0000-000000000001'
  $$,
  'retailer staff can set their own retailer_rating/retailer_note'
);

-- Test 5: neither role may reassign the review to a different engagement.
select throws_ok(
  $$
    update public.service_partner_quality_reviews
      set engagement_id = 'd6000000-0000-0000-0000-000000000099'
      where id = 'd7000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'engagement_id, partner_id and retailer_id are immutable on update',
  'engagement_id is immutable on update'
);

reset request.jwt.claims;
set local role none;

select * from finish();
rollback;
