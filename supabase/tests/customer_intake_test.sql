begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  '17110000-0000-0000-0000-000000000001', 'Intake Test A Ltd',
  'Intake Test A', 'intake-test-a', 'active'
), (
  '17110000-0000-0000-0000-000000000002', 'Intake Test B Ltd',
  'Intake Test B', 'intake-test-b', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '17110000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'intake-customer-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '17110000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'intake-staff-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '17110000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
  'intake-owner-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  '17110000-0000-0000-0000-000000000006', '17110000-0000-0000-0000-000000000001',
  '17110000-0000-0000-0000-000000000003', 'Intake Customer A', 'intake-customer-a@example.test'
);

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at)
values (
  '17110000-0000-0000-0000-000000000007', '17110000-0000-0000-0000-000000000001',
  '17110000-0000-0000-0000-000000000004', 'Intake Staff A',
  'intake-staff-a@example.test', 'sales_associate', now()
), (
  '17110000-0000-0000-0000-000000000008', '17110000-0000-0000-0000-000000000002',
  '17110000-0000-0000-0000-000000000005', 'Intake Owner B',
  'intake-owner-b@example.test', 'owner', now()
);

-- Test 1: the customer can create their OWN intake session.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17110000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17110000-0000-0000-0000-000000000001"
  }
}';

select lives_ok(
  $$
    insert into public.customer_intake_sessions (retailer_id, customer_id, raw_text)
    values (
      '17110000-0000-0000-0000-000000000001', '17110000-0000-0000-0000-000000000006',
      'I love navy blazers. Our anniversary is June 12th.'
    )
  $$,
  'a customer can create their own intake session'
);

reset role;

-- Seed the session id for later tests (the pgTAP session's own default,
-- bypassing RLS, to grab the id the authenticated insert above created).
select id as session_id
  from public.customer_intake_sessions
  where customer_id = '17110000-0000-0000-0000-000000000006'
\gset

-- Test 2: a DIFFERENT customer (retailer B's, none seeded here — using
-- the retailer B owner's own identity, which has no matching customers
-- row at all) is refused creating a session under retailer A's customer.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17110000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17110000-0000-0000-0000-000000000002"
  }
}';

select throws_ok(
  $$
    insert into public.customer_intake_sessions (retailer_id, customer_id, raw_text)
    values (
      '17110000-0000-0000-0000-000000000001', '17110000-0000-0000-0000-000000000006',
      'Impersonating another retailer''s customer.'
    )
  $$,
  '42501',
  null,
  'a caller cannot create an intake session as a customer that is not their own'
);

reset role;

-- Test 3: service_role (the AI-extraction pass) can write a proposal
-- against the session.
set local role service_role;

select lives_ok(
  format(
    $$
      insert into public.customer_intake_proposals (
        retailer_id, intake_session_id, fact_type, value_label, source_excerpt, confidence
      ) values (
        '17110000-0000-0000-0000-000000000001', %L,
        'colour_interest', 'Navy', 'navy blazers', 0.9
      )
    $$,
    :'session_id'
  ),
  'service_role (the AI extraction pass) can write a proposal against a real session'
);

reset role;

select id as proposal_id
  from public.customer_intake_proposals
  where intake_session_id = :'session_id'
\gset

-- Test 4: the CUSTOMER cannot write a proposal directly (no authenticated
-- insert policy on customer_intake_proposals at all) — the whole point
-- is that a customer's own raw text is never itself an unreviewed fact.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17110000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17110000-0000-0000-0000-000000000001"
  }
}';

select throws_ok(
  format(
    $$
      insert into public.customer_intake_proposals (
        retailer_id, intake_session_id, fact_type, value_label, source_excerpt, confidence
      ) values (
        '17110000-0000-0000-0000-000000000001', %L,
        'other', 'Self-written fact', 'anything', 1.0
      )
    $$,
    :'session_id'
  ),
  '42501',
  null,
  'a customer cannot write a proposal directly — only service_role (the AI pass) can'
);

reset role;

-- Test 5: retailer A staff can read the proposal.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17110000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17110000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select is(
  (
    select count(*)::int from public.customer_intake_proposals
    where intake_session_id = :'session_id'
  ),
  1,
  'retailer A staff can read the proposal from their own retailer'
);

-- Test 6: retailer A staff can confirm the proposal (status update).
select lives_ok(
  format(
    $$
      update public.customer_intake_proposals
      set status = 'confirmed', confirmed_by_staff_id = '17110000-0000-0000-0000-000000000007', confirmed_at = now()
      where id = %L
    $$,
    :'proposal_id'
  ),
  'retailer A staff can confirm a proposal'
);

reset role;

-- Test 7: retailer B owner (different tenant) cannot read retailer A's
-- intake sessions at all.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "17110000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "17110000-0000-0000-0000-000000000002",
    "retailer_role": "owner"
  }
}';

select is(
  (
    select count(*)::int from public.customer_intake_sessions
    where retailer_id = '17110000-0000-0000-0000-000000000001'
  ),
  0,
  'retailer B cannot read retailer A''s intake sessions (tenant isolation)'
);

-- Test 8: retailer B owner cannot read retailer A's proposals either.
select is(
  (
    select count(*)::int from public.customer_intake_proposals
    where retailer_id = '17110000-0000-0000-0000-000000000001'
  ),
  0,
  'retailer B cannot read retailer A''s intake proposals (tenant isolation)'
);

reset role;

-- Test 9: the resolution CHECK constraint is real — a status flip to
-- 'confirmed' without confirmed_at/confirmed_by_staff_id is refused, not
-- silently accepted with nulls.
select throws_ok(
  $$
    insert into public.customer_intake_proposals (
      retailer_id, intake_session_id, fact_type, value_label, source_excerpt, confidence, status
    ) values (
      '17110000-0000-0000-0000-000000000001',
      (select id from public.customer_intake_sessions where customer_id = '17110000-0000-0000-0000-000000000006' limit 1),
      'other', 'Bad row', 'anything', 0.5, 'confirmed'
    )
  $$,
  '23514',
  null,
  'a proposal cannot be inserted already-confirmed without confirmed_at/confirmed_by_staff_id'
);

select * from finish();
rollback;
