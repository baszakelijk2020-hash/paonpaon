-- FT-14 Preferred Tailoring — first connected slice. Proves:
--   1. anonymous callers cannot read weekly plans or their days;
--   2. an advisor can propose a weekly plan (propose_service_weekly_plan)
--      and it lands with the right membership/retailer/customer and days;
--   3. staff from a different retailer cannot propose against another
--      House's membership (the same _service_assert_staff_retailer guard
--      every other concierge RPC already uses);
--   4. the owning customer can read and accept/decline their own plan via
--      decide_service_weekly_plan, which re-derives the caller server-side
--      (mirrors complete_wedding_aftercare_plan, 20260802000007);
--   5. a different customer cannot decide someone else's plan;
--   6. deciding twice with the same decision is idempotent; deciding twice
--      with a different decision after the first raises.

begin;
select plan(12);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    '93000000-0000-0000-0000-000000000001',
    'Weekly Plan House A Ltd', 'Weekly Plan House A', 'weekly-plan-house-a',
    'active'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    'Weekly Plan House B Ltd', 'Weekly Plan House B', 'weekly-plan-house-b',
    'active'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '93100000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'weekly-plan-customer-a@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '93100000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'weekly-plan-customer-b@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '93100000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'weekly-plan-manager-a@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '93100000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'weekly-plan-manager-b@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.customers (
  id, retailer_id, user_id, full_name, email, lifecycle_stage
) values
  (
    '93200000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    '93100000-0000-0000-0000-000000000001',
    'House A Customer', 'weekly-plan-customer-a@example.test', 'first_purchase'
  ),
  (
    '93200000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    '93100000-0000-0000-0000-000000000002',
    'House B Customer', 'weekly-plan-customer-b@example.test', 'first_purchase'
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    '93300000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    '93100000-0000-0000-0000-000000000003',
    'House A Manager', 'weekly-plan-manager-a@example.test', 'manager', now()
  ),
  (
    '93300000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    '93100000-0000-0000-0000-000000000004',
    'House B Manager', 'weekly-plan-manager-b@example.test', 'manager', now()
  );

insert into public.service_plans (
  id, retailer_id, kind, status, title, summary, explanation
) values (
  '93400000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'preferred_tailoring', 'active',
  'Preferred Tailoring', 'Weekly wardrobe orchestration', 'Advisor-led planning'
);

insert into public.service_memberships (
  id, plan_id, retailer_id, customer_id, status
) values (
  '93400000-0000-0000-0000-000000000002',
  '93400000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '93200000-0000-0000-0000-000000000001',
  'active'
);

select is(
  has_table_privilege('anon', 'public.service_weekly_plans', 'SELECT'),
  false,
  'anonymous callers cannot read weekly plans'
);

select is(
  has_table_privilege('anon', 'public.service_weekly_plan_days', 'SELECT'),
  false,
  'anonymous callers cannot read weekly plan days'
);

-- A different-House staff member cannot propose against House A's
-- membership — the same _service_assert_staff_retailer guard every other
-- concierge RPC already relies on.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "93100000-0000-0000-0000-000000000004",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "93000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    select public.propose_service_weekly_plan(
      '93400000-0000-0000-0000-000000000002'::uuid,
      (date_trunc('week', current_date) + interval '7 days')::date,
      '[{"dayOfWeek":0,"occasionTag":"refined","outfitNotes":"Navy suit"}]'::jsonb,
      null
    )
  $$,
  'P0001',
  'Not authorized for retailer',
  'a different House''s staff cannot propose a weekly plan on this membership'
);

-- House A's own manager proposes the real plan.
reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "93100000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "93000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select public.propose_service_weekly_plan(
  '93400000-0000-0000-0000-000000000002'::uuid,
  (date_trunc('week', current_date) + interval '7 days')::date,
  '[
    {"dayOfWeek":0,"occasionTag":"refined","outfitNotes":"Navy suit, silk tie"},
    {"dayOfWeek":1,"occasionTag":"neutral","outfitNotes":"Chinos and knit"}
  ]'::jsonb,
  'Board week ahead'
) as weekly_plan_id \gset

select is(
  (select status from public.service_weekly_plans where id = :'weekly_plan_id'),
  'proposed',
  'a proposed weekly plan starts in the proposed state'
);

select is(
  (select count(*) from public.service_weekly_plan_days
    where weekly_plan_id = :'weekly_plan_id'),
  2::bigint,
  'both day entries were inserted with the plan'
);

select is(
  (select count(*) from public.service_history_events
    where kind = 'weekly_plan_proposed'
      and membership_id = '93400000-0000-0000-0000-000000000002'),
  1::bigint,
  'proposing a weekly plan records a weekly_plan_proposed history event'
);

-- House B's customer cannot decide House A's plan — the RPC re-derives the
-- caller's own customer row server-side rather than trusting a client id.
reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "93100000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select throws_ok(
  format(
    $$select public.decide_service_weekly_plan('%s'::uuid, 'accepted', null)$$,
    :'weekly_plan_id'
  ),
  'P0001',
  'Not authorized for this weekly plan',
  'a different customer cannot decide someone else''s weekly plan'
);

-- The owning customer reads and accepts their own plan.
reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "93100000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select is(
  (select count(*) from public.service_weekly_plans
    where id = :'weekly_plan_id'),
  1::bigint,
  'the owning customer can read their own weekly plan'
);

select public.decide_service_weekly_plan(
  :'weekly_plan_id'::uuid, 'accepted', null
);

select is(
  (select status from public.service_weekly_plans where id = :'weekly_plan_id'),
  'customer_accepted',
  'the owning customer''s acceptance updates the plan status'
);

select isnt(
  (select decided_at from public.service_weekly_plans
    where id = :'weekly_plan_id'),
  null,
  'accepting a plan stamps decided_at'
);

-- Idempotent: deciding "accepted" again on an already-accepted plan is a
-- no-op, not an error (matches complete_wedding_aftercare_plan's pattern).
select lives_ok(
  format(
    $$select public.decide_service_weekly_plan('%s'::uuid, 'accepted', null)$$,
    :'weekly_plan_id'
  ),
  'deciding "accepted" again on an already-accepted plan is idempotent'
);

-- Flipping the decision after it has already been made is rejected.
select throws_ok(
  format(
    $$select public.decide_service_weekly_plan('%s'::uuid, 'declined', 'changed my mind')$$,
    :'weekly_plan_id'
  ),
  'P0001',
  'This weekly plan has already been decided',
  'a decided weekly plan cannot be flipped to the opposite decision'
);

select * from finish();
rollback;
