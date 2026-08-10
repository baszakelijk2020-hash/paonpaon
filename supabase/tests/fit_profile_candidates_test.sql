begin;
select plan(20);

-- Create two retailers
insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'fc000000-0000-0000-0000-000000000001', 'Fit Profile Test A Ltd',
  'Fit Profile Test A', 'fit-profile-a', 'active'
), (
  'fc000000-0000-0000-0000-000000000002', 'Fit Profile Test B Ltd',
  'Fit Profile Test B', 'fit-profile-b', 'active'
);

-- Create auth users
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'fc000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'fit-profile-staff-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'fc000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'fit-profile-staff-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'fc000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'fit-profile-customer-1@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'fc000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
  'fit-profile-customer-2@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

-- Create customers for retailer A
insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'fc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000005', 'Fit Profile Customer 1',
  'fit-profile-customer-1@example.test'
), (
  'fc000000-0000-0000-0000-000000000008', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000006', 'Fit Profile Customer 2',
  'fit-profile-customer-2@example.test'
);

-- Create a customer for retailer B for cross-retailer testing
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'fc000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated',
  'fit-profile-customer-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'fc000000-0000-0000-0000-000000000022', 'fc000000-0000-0000-0000-000000000002',
  'fc000000-0000-0000-0000-000000000021', 'Fit Profile Customer B',
  'fit-profile-customer-b@example.test'
);

-- Create staff members
insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  'fc000000-0000-0000-0000-000000000009', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000003', 'Fit Profile Staff A',
  'fit-profile-staff-a@example.test', 'sales_associate', now()
), (
  'fc000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000002',
  'fc000000-0000-0000-0000-000000000004', 'Fit Profile Staff B',
  'fit-profile-staff-b@example.test', 'sales_associate', now()
);

-- Create physical garments
insert into public.physical_garments (id, retailer_id, customer_id, source_kind, category_code, garment_type, description, intake_condition)
values (
  'fc000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000007', 'external', 'jacket', 'suit_jacket',
  'Navy suit jacket', 'good'
), (
  'fc000000-0000-0000-0000-000000000012', 'fc000000-0000-0000-0000-000000000002',
  'fc000000-0000-0000-0000-000000000022', 'external', 'jacket', 'suit_jacket',
  'Black suit jacket', 'good'
);

-- Create fitting sessions
insert into public.fitting_sessions (id, retailer_id, customer_id, fitted_by_staff_id)
values (
  'fc000000-0000-0000-0000-000000000013', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000009'
), (
  'fc000000-0000-0000-0000-000000000014', 'fc000000-0000-0000-0000-000000000002',
  'fc000000-0000-0000-0000-000000000022', 'fc000000-0000-0000-0000-000000000010'
);

-- Create fitting observations for retailer A
insert into public.fitting_observations (id, retailer_id, fitting_session_id, physical_garment_id, classification, area, observation, recorded_by_staff_id)
values (
  'fc000000-0000-0000-0000-000000000015', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000013', 'fc000000-0000-0000-0000-000000000011',
  'work_now', 'shoulders', 'Shoulders need tapering', 'fc000000-0000-0000-0000-000000000009'
), (
  'fc000000-0000-0000-0000-000000000016', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000013', 'fc000000-0000-0000-0000-000000000011',
  'work_now', 'sleeves', 'Sleeves too long', 'fc000000-0000-0000-0000-000000000009'
);

-- Create fitting observations for retailer B
insert into public.fitting_observations (id, retailer_id, fitting_session_id, physical_garment_id, classification, area, observation, recorded_by_staff_id)
values (
  'fc000000-0000-0000-0000-000000000017', 'fc000000-0000-0000-0000-000000000002',
  'fc000000-0000-0000-0000-000000000014', 'fc000000-0000-0000-0000-000000000012',
  'work_now', 'waist', 'Waist needs adjusting', 'fc000000-0000-0000-0000-000000000010'
);

-- Test 1: Retailer-A staff (advisor role) can propose_fit_profile_candidate for their own retailer's observations
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select isnt(
  (
    select public.propose_fit_profile_candidate(
      ARRAY['fc000000-0000-0000-0000-000000000015'::uuid, 'fc000000-0000-0000-0000-000000000016'::uuid],
      '{"chest": 1020}'::jsonb,
      'idempotency-key-1'
    )
  ),
  null,
  'Retailer-A staff (advisor role) can propose_fit_profile_candidate for their own retailer''s observations'
);

-- Test 2: Calling propose with SAME idempotency key returns SAME candidate id (idempotency)
select is(
  (
    select public.propose_fit_profile_candidate(
      ARRAY['fc000000-0000-0000-0000-000000000015'::uuid, 'fc000000-0000-0000-0000-000000000016'::uuid],
      '{"chest": 1020}'::jsonb,
      'idempotency-key-1'
    )
  ),
  (
    select public.propose_fit_profile_candidate(
      ARRAY['fc000000-0000-0000-0000-000000000015'::uuid, 'fc000000-0000-0000-0000-000000000016'::uuid],
      '{"chest": 1020}'::jsonb,
      'idempotency-key-1'
    )
  ),
  'calling propose_fit_profile_candidate again with same idempotency key returns same candidate id'
);

-- Test 3: Retailer-A staff cannot propose using an observation belonging to retailer B
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    select public.propose_fit_profile_candidate(
      ARRAY['fc000000-0000-0000-0000-000000000017'::uuid],
      '{"chest": 1000}'::jsonb,
      'idempotency-key-cross-tenant'
    )
  $$,
  'P0001',
  'Not authorized to access this observation',
  'Retailer-A staff cannot propose using an observation belonging to retailer B'
);

-- Test 4: RLS on fit_profile_candidates - retailer-A staff can read their own retailer's candidate
select is(
  (
    select count(*)::int from public.fit_profile_candidates
    where retailer_id = 'fc000000-0000-0000-0000-000000000001'
  ),
  1,
  'Retailer-A staff can read their own retailer''s fit_profile_candidates via RLS'
);

-- Test 4b: RLS on fit_profile_candidates - retailer-B staff cannot read retailer-A's candidate
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000002",
    "retailer_role": "sales_associate"
  }
}';

select is(
  (
    select count(*)::int from public.fit_profile_candidates
    where retailer_id = 'fc000000-0000-0000-0000-000000000001'
  ),
  0,
  'Retailer-B staff cannot read Retailer-A''s fit_profile_candidates (RLS silent filter)'
);

-- Test 5: The owning customer can read their own candidate
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000005",
  "role": "authenticated"
}';

select is(
  (
    select count(*)::int from public.fit_profile_candidates
    where customer_id = 'fc000000-0000-0000-0000-000000000007'
  ),
  1,
  'owning customer can read their own fit_profile_candidates via RLS'
);

-- Test 5b: A different customer cannot read the candidate
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000006",
  "role": "authenticated"
}';

select is(
  (
    select count(*)::int from public.fit_profile_candidates
    where customer_id = 'fc000000-0000-0000-0000-000000000007'
  ),
  0,
  'different customer cannot read the candidate (RLS silent filter)'
);

-- Test 6: Retailer-A staff (advisor) can approve proposed candidate → status becomes advisor_approved and action row exists
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

-- Get the candidate id
with candidate as (
  select id from public.fit_profile_candidates
  where retailer_id = 'fc000000-0000-0000-0000-000000000001'
  limit 1
)
select lives_ok(
  (select 'select public.approve_fit_profile_candidate(' || quote_literal(id) || ', ' || quote_literal('Looks good') || ')' from candidate),
  'Retailer-A staff can approve their own retailer''s proposed candidate'
);

-- Verify status changed to advisor_approved
select is(
  (
    select status from public.fit_profile_candidates
    where retailer_id = 'fc000000-0000-0000-0000-000000000001'
    limit 1
  ),
  'advisor_approved',
  'after approval, candidate status becomes advisor_approved'
);

-- Verify action row was created with action='approved'
select is(
  (
    select count(*)::int from public.fit_profile_candidate_actions
    where action = 'approved'
  ),
  1,
  'a fit_profile_candidate_actions row with action=''approved'' was created'
);

-- Test 7: Retailer-B staff attempting to approve retailer-A's candidate raises
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000002",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    select public.approve_fit_profile_candidate(
      (select id from public.fit_profile_candidates where retailer_id = 'fc000000-0000-0000-0000-000000000001' limit 1),
      'Not my retailer'
    )
  $$,
  'P0001',
  'Candidate not found',
  'Retailer-B staff attempting to approve Retailer-A''s candidate raises'
);

-- Test 8: Approving a candidate that is not in status=''proposed'' raises
-- First create a new proposed candidate for this test
set local role none;

insert into public.fit_profile_candidates (
  id, retailer_id, customer_id, fitting_session_id, status,
  proposed_measurements, idempotency_key
) values (
  'fc000000-0000-0000-0000-000000000018', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000013',
  'advisor_rejected', '{}'::jsonb, 'already-rejected-candidate'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    select public.approve_fit_profile_candidate(
      'fc000000-0000-0000-0000-000000000018'::uuid,
      'Already rejected'
    )
  $$,
  'P0001',
  'Candidate is not awaiting review',
  'approving a non-proposed candidate raises'
);

-- Test 9: reject_fit_profile_candidate mirrors approve
-- Create another candidate to test reject
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select public.propose_fit_profile_candidate(
  ARRAY['fc000000-0000-0000-0000-000000000015'::uuid],
  '{"waist": 900}'::jsonb,
  'idempotency-key-for-reject'
);

-- Reject it
with to_reject as (
  select id from public.fit_profile_candidates
  where idempotency_key = 'idempotency-key-for-reject'
  limit 1
)
select lives_ok(
  (select 'select public.reject_fit_profile_candidate(' || quote_literal(id) || ', ' || quote_literal('Not approved') || ')' from to_reject),
  'reject_fit_profile_candidate succeeds'
);

-- Verify status changed to advisor_rejected and action was recorded
select is(
  (
    select status from public.fit_profile_candidates
    where idempotency_key = 'idempotency-key-for-reject'
    limit 1
  ),
  'advisor_rejected',
  'after rejection, candidate status becomes advisor_rejected'
);

select is(
  (
    select count(*)::int from public.fit_profile_candidate_actions
    where action = 'rejected'
  ),
  1,
  'a fit_profile_candidate_actions row with action=''rejected'' was created'
);

-- Test 10: Customer can confirm only after advisor approval
-- Create another candidate and approve it first
set local role none;

insert into public.fit_profile_candidates (
  id, retailer_id, customer_id, fitting_session_id, status,
  proposed_measurements, idempotency_key
) values (
  'fc000000-0000-0000-0000-000000000019', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000013',
  'proposed', '{}'::jsonb, 'candidate-for-confirm-test'
);

-- Customer tries to confirm before approval (should fail)
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000005",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.confirm_fit_profile_candidate(
      'fc000000-0000-0000-0000-000000000019'::uuid
    )
  $$,
  'P0001',
  'Candidate is not awaiting customer confirmation',
  'confirming before approval raises'
);

-- Approve as staff
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fc000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select lives_ok(
  $$
    select public.approve_fit_profile_candidate(
      'fc000000-0000-0000-0000-000000000019'::uuid,
      'Ready for customer confirmation'
    )
  $$,
  'staff approves the candidate'
);

-- Now customer can confirm
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000005",
  "role": "authenticated"
}';

select lives_ok(
  $$
    select public.confirm_fit_profile_candidate(
      'fc000000-0000-0000-0000-000000000019'::uuid
    )
  $$,
  'customer can confirm their candidate after staff approval'
);

-- Verify status changed to customer_confirmed
select is(
  (
    select status from public.fit_profile_candidates
    where id = 'fc000000-0000-0000-0000-000000000019'
  ),
  'customer_confirmed',
  'after customer confirmation, status becomes customer_confirmed'
);

-- Test 11: Different customer cannot confirm
-- Create another candidate for customer 1, approve it, then try to confirm as customer 2
set local role none;

insert into public.fit_profile_candidates (
  id, retailer_id, customer_id, fitting_session_id, status,
  proposed_measurements, idempotency_key
) values (
  'fc000000-0000-0000-0000-000000000020', 'fc000000-0000-0000-0000-000000000001',
  'fc000000-0000-0000-0000-000000000007', 'fc000000-0000-0000-0000-000000000013',
  'advisor_approved', '{}'::jsonb, 'candidate-for-other-customer-test'
);

-- Customer 2 tries to confirm customer 1's candidate
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fc000000-0000-0000-0000-000000000006",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.confirm_fit_profile_candidate(
      'fc000000-0000-0000-0000-000000000020'::uuid
    )
  $$,
  'P0001',
  'Candidate not found',
  'a different (non-owning) customer cannot confirm the candidate'
);

select * from finish();
rollback;
