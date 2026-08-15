-- Proof for 20260815000030: no child row can be attached to another
-- retailer's customer.
--
-- Same attack shape as tranche 4, one parent wider. An authenticated House B
-- associate writes a row whose own retailer_id genuinely is House B's — the
-- INSERT policy on appointments checks exactly that and the caller's role,
-- and nothing else — while pointing customer_id at House A's customer. RLS
-- passes. Only the composite foreign key stops it, so 23503 is expected; a
-- 42501 would mean RLS blocked the write first and proved nothing.

begin;
select plan(8);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'Cust House A Ltd', 'Cust House A', 'cust-house-a', 'active'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'Cust House B Ltd', 'Cust House B', 'cust-house-b', 'active'
  );

insert into public.customers (id, retailer_id, full_name)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001', 'House A Client'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000002', 'House B Client'
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'e1000000-0000-0000-0000-000000000002', 'House B Disposable Client'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'e4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'cust.houseb@example.test', '{}', '{}', now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'e5000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000002',
  'e4000000-0000-0000-0000-000000000002',
  'House B Associate', 'cust.houseb@example.test', 'sales_associate', now()
);

-- Scoped to the 26 constraints THIS migration adds. `customers` already had
-- 15 composite keys from an earlier convention, so counting every composite
-- key pointing at customers would silently pass on the wrong number.
create temporary table t4b1_expected (name text, want_del "char") on commit drop;
insert into t4b1_expected values
  ('ai_generations_customer_retailer_fkey', 'c'),
  ('appointment_closeouts_customer_retailer_fkey', 'c'),
  ('appointments_customer_retailer_fkey', 'c'),
  ('clienteling_opportunities_customer_retailer_fkey', 'c'),
  ('customer_fact_corrections_customer_retailer_fkey', 'c'),
  ('customer_facts_customer_retailer_fkey', 'c'),
  ('customer_measurement_candidates_customer_retailer_fkey', 'c'),
  ('customer_measurement_versions_customer_retailer_fkey', 'c'),
  ('customer_moments_customer_retailer_fkey', 'c'),
  ('network_reward_entries_customer_retailer_fkey', 'c'),
  ('outfits_created_by_customer_retailer_fkey', 'c'),
  ('wedding_parties_organizer_customer_retailer_fkey', 'c'),
  ('fitting_sessions_customer_retailer_fkey', 'r'),
  ('physical_garments_customer_retailer_fkey', 'r'),
  ('production_specs_customer_retailer_fkey', 'r'),
  ('service_partner_engagements_customer_retailer_fkey', 'r'),
  ('advisor_capture_sessions_customer_retailer_fkey', 'a'),
  ('corporate_wearers_customer_retailer_fkey', 'a'),
  ('customer_fact_corrections_actor_customer_retailer_fkey', 'a'),
  ('customer_facts_author_customer_retailer_fkey', 'a'),
  ('pos_transactions_customer_retailer_fkey', 'a'),
  ('service_recovery_budget_requests_customer_retailer_fkey', 'a'),
  ('staff_recognition_acts_customer_retailer_fkey', 'a'),
  ('store_sessions_customer_retailer_fkey', 'a'),
  ('supply_complaint_cases_customer_retailer_fkey', 'a'),
  ('wedding_inspiration_items_added_by_customer_retailer_fkey', 'a');

select is(
  (
    select count(*)::int
    from t4b1_expected e
    join pg_constraint k on k.conname = e.name
    where k.contype = 'f'
      and k.confrelid = 'public.customers'::regclass
      and array_length(k.conkey, 1) = 2
  ),
  26,
  'all 26 customer-referencing edges carry a composite tenant foreign key'
);

-- Deletion protection preserved exactly, not widened. Every one of the 26
-- must match the action of the single-column key it parallels.
select is(
  (
    select count(*)::int
    from t4b1_expected e
    join pg_constraint k on k.conname = e.name
    where k.confdeltype <> e.want_del
  ),
  0,
  'every one of the 26 composite keys mirrors its single-column ON DELETE action'
);

select is(
  (
    select count(*)::int
    from t4b1_expected e
    join pg_constraint k on k.conname = e.name
    where k.confdeltype = 'r'
  ),
  4,
  'the four RESTRICT customer keys stay RESTRICT'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "e4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "e1000000-0000-0000-0000-000000000002",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    insert into public.appointments (
      retailer_id, customer_id, type, starts_at, ends_at
    ) values (
      'e1000000-0000-0000-0000-000000000002',
      'e2000000-0000-0000-0000-000000000001',
      'fitting', now() + interval '2 days', now() + interval '2 days 1 hour'
    )
  $$,
  '23503',
  null,
  'an authenticated House B associate cannot book an appointment against House A''s customer'
);

select lives_ok(
  $$
    insert into public.appointments (
      id, retailer_id, customer_id, type, starts_at, ends_at
    ) values (
      'e6000000-0000-0000-0000-000000000002',
      'e1000000-0000-0000-0000-000000000002',
      'e2000000-0000-0000-0000-000000000002',
      'fitting', now() + interval '3 days', now() + interval '3 days 1 hour'
    )
  $$,
  'the same associate can still book against their own customer'
);

-- Re-parenting an existing legitimate row is the same attack one step later.
select throws_ok(
  $$
    update public.appointments
    set customer_id = 'e2000000-0000-0000-0000-000000000001'
    where id = 'e6000000-0000-0000-0000-000000000002'
  $$,
  '23503',
  null,
  'an existing House B appointment cannot be re-pointed at House A''s customer'
);

reset request.jwt.claims;
set local role none;

-- Behavioural proof of the SET NULL / NO ACTION interaction on this parent.
insert into public.advisor_capture_sessions (
  id, retailer_id, staff_id, customer_id, raw_text
) values (
  'e7000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000002',
  'e5000000-0000-0000-0000-000000000002',
  'e2000000-0000-0000-0000-000000000003',
  'Session about the disposable client'
);

delete from public.customers
where id = 'e2000000-0000-0000-0000-000000000003';

select is(
  (
    select customer_id
    from public.advisor_capture_sessions
    where id = 'e7000000-0000-0000-0000-000000000002'
  ),
  null,
  'deleting a customer nulls the capture-session link and does not raise'
);

select is(
  (
    select count(*)::int
    from public.appointments
    where customer_id = 'e2000000-0000-0000-0000-000000000001'
  ),
  0,
  'House A''s customer holds no appointment after every cross-tenant attempt'
);

select * from finish();
rollback;
