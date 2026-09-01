-- Phase 20.17 — customer removal of an advisor selection from the wardrobe
-- plan (public.wardrobe_roadmap_gap_dispositions).
--
-- Proves: the owning customer can create a removal on their own approved
-- roadmap's gap; it persists; the advisor-authored roadmap/gap/stage rows
-- and audit state are untouched; cross-customer, cross-retailer, anonymous,
-- and wrong-role callers are all isolated; identity columns are immutable;
-- the disposition table has no UPDATE/DELETE grant or policy for anyone; and
-- the migration introduces no SECURITY DEFINER and no grant on
-- retailer_staff_members.

begin;
select plan(24);

-- ---------------------------------------------------------------------------
-- Fixtures.
--   House A: retailer a1, advisor a3/a4, customer a5 (user a2),
--            a second customer c5 (user c2) of the SAME retailer.
--   House B: retailer b1, advisor b3/b4, customer b5 (user b2).
--   House A has an APPROVED roadmap a6 with one unfilled gap a8 + stage a9.
-- ---------------------------------------------------------------------------
insert into public.retailers (id, legal_name, display_name, slug, status)
values
  ('d0000000-0000-0000-0000-0000000000a1',
   'Removal House A Ltd', 'Removal House A', 'removal-house-a', 'active'),
  ('d0000000-0000-0000-0000-0000000000b1',
   'Removal House B Ltd', 'Removal House B', 'removal-house-b', 'active');

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('d0000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
   'removal-customer-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d0000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated',
   'removal-customer-a-other@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d0000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'removal-customer-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d0000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated',
   'removal-staff-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d0000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated',
   'removal-staff-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  ('d0000000-0000-0000-0000-0000000000a4',
   'd0000000-0000-0000-0000-0000000000a1',
   'd0000000-0000-0000-0000-0000000000a3',
   'House A Advisor', 'removal-staff-a@example.test', 'sales_associate', now()),
  ('d0000000-0000-0000-0000-0000000000b4',
   'd0000000-0000-0000-0000-0000000000b1',
   'd0000000-0000-0000-0000-0000000000b3',
   'House B Advisor', 'removal-staff-b@example.test', 'sales_associate', now());

insert into public.customers (id, retailer_id, user_id, full_name, email)
values
  ('d0000000-0000-0000-0000-0000000000a5',
   'd0000000-0000-0000-0000-0000000000a1',
   'd0000000-0000-0000-0000-0000000000a2',
   'House A Client', 'removal-customer-a@example.test'),
  ('d0000000-0000-0000-0000-0000000000c5',
   'd0000000-0000-0000-0000-0000000000a1',
   'd0000000-0000-0000-0000-0000000000c2',
   'House A Other Client', 'removal-customer-a-other@example.test'),
  ('d0000000-0000-0000-0000-0000000000b5',
   'd0000000-0000-0000-0000-0000000000b1',
   'd0000000-0000-0000-0000-0000000000b2',
   'House B Client', 'removal-customer-b@example.test');

insert into public.wardrobe_roadmaps (
  id, retailer_id, customer_id, title, status,
  authored_by_staff_id, submitted_at, decided_at, decided_by_actor
) values (
  'd0000000-0000-0000-0000-0000000000a6',
  'd0000000-0000-0000-0000-0000000000a1',
  'd0000000-0000-0000-0000-0000000000a5',
  'House A approved wardrobe plan',
  'approved',
  'd0000000-0000-0000-0000-0000000000a4',
  now(), now(), 'customer'
);

insert into public.wardrobe_roadmap_gaps (
  id, roadmap_id, retailer_id, title, rank, slot_kind, category_code,
  how_purchase_fills_gap
) values (
  'd0000000-0000-0000-0000-0000000000a8',
  'd0000000-0000-0000-0000-0000000000a6',
  'd0000000-0000-0000-0000-0000000000a1',
  'Missing jacket', 1, 'jacket', 'jacket',
  'Anchors client-facing looks.'
);

insert into public.wardrobe_roadmap_stages (
  id, roadmap_id, retailer_id, title, stage_order, gap_id, explanation,
  rule_citations, fact_citations
) values (
  'd0000000-0000-0000-0000-0000000000a9',
  'd0000000-0000-0000-0000-0000000000a6',
  'd0000000-0000-0000-0000-0000000000a1',
  'Stage 1 — jacket', 1, 'd0000000-0000-0000-0000-0000000000a8',
  'Prioritise a jacket to fill the gap.',
  '[{"ruleId":"r","ruleTitle":"t","relation":"pairs_with","explanation":"e"}]'::jsonb,
  '[{"sourceKind":"catalogue_product","sourceId":"p","label":"l","detail":"d"}]'::jsonb
);

-- ---------------------------------------------------------------------------
-- 1-3. Owning customer removes an advisor selection from their own plan.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select lives_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000a5'
    )$$,
  '1. owning customer removes an advisor selection from their own approved plan'
);

select is(
  (select disposition from public.wardrobe_roadmap_gap_dispositions
   where roadmap_gap_id = 'd0000000-0000-0000-0000-0000000000a8'
     and customer_id = 'd0000000-0000-0000-0000-0000000000a5'),
  'removed_from_plan',
  '2. the disposition persists as removed_from_plan'
);

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions
   where customer_id = 'd0000000-0000-0000-0000-0000000000a5'),
  1,
  '3. the owning customer can read their own disposition'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 4-6. The advisor-authored roadmap / gap / stage rows are untouched
--      (no hard delete, no filled_by write).
-- ---------------------------------------------------------------------------
select is(
  (select status from public.wardrobe_roadmaps
   where id = 'd0000000-0000-0000-0000-0000000000a6'),
  'approved',
  '4. the roadmap row is unchanged (still approved)'
);

select ok(
  (select filled_by_product_id is null and filled_by_wardrobe_item_id is null
   from public.wardrobe_roadmap_gaps
   where id = 'd0000000-0000-0000-0000-0000000000a8'),
  '5. the gap row is unchanged — still unfilled, no hard delete, no filled_by write'
);

select is(
  (select count(*)::int from public.wardrobe_roadmap_stages
   where id = 'd0000000-0000-0000-0000-0000000000a9'),
  1,
  '6. the stage row still exists'
);

-- ---------------------------------------------------------------------------
-- 7. Idempotency: a duplicate removal by the same customer is rejected by
--    the unique constraint (application uses on-conflict-do-nothing).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000a5'
    )$$,
  '23505',
  NULL,
  '7. a duplicate removal by the same customer is rejected (unique gap+customer)'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 8-10. Cross-customer — another customer of the SAME retailer. That
--       customer cannot even see House A's gap (gap RLS), and both the
--       INSERT trigger and the INSERT policy independently reject the write.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions),
  0,
  '8. a different customer of the same retailer sees zero dispositions'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000c5'
    )$$,
  NULL,
  '9. a different customer cannot remove a selection off a roadmap that is not theirs'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000a5'
    )$$,
  NULL,
  '10. a customer cannot forge a disposition as another customer'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 11-13. Cross-retailer customer (House B).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions),
  0,
  '11. a customer of another retailer sees zero dispositions'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000b1',
      'd0000000-0000-0000-0000-0000000000b5'
    )$$,
  NULL,
  '12. a cross-retailer customer cannot remove a House A selection'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000b5'
    )$$,
  NULL,
  '13. mixing a House B customer with House A''s roadmap is rejected'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 14-15. Anonymous cannot read or create.
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$select count(*) from public.wardrobe_roadmap_gap_dispositions$$,
  '42501',
  NULL,
  '14. anonymous cannot read the disposition table (no grant to anon)'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000a5'
    )$$,
  '42501',
  NULL,
  '15. anonymous cannot create a disposition (no grant to anon)'
);

reset role;

-- ---------------------------------------------------------------------------
-- 16-18. Retailer staff — read tenant dispositions, but no write path.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub":"d0000000-0000-0000-0000-0000000000a3",
  "role":"authenticated",
  "app_metadata":{
    "retailer_id":"d0000000-0000-0000-0000-0000000000a1",
    "retailer_role":"sales_associate"
  }
}';

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions
   where retailer_id = 'd0000000-0000-0000-0000-0000000000a1'),
  1,
  '16. same-tenant staff can read their tenant''s dispositions'
);

select throws_ok(
  $$insert into public.wardrobe_roadmap_gap_dispositions (
      roadmap_gap_id, roadmap_id, retailer_id, customer_id
    ) values (
      'd0000000-0000-0000-0000-0000000000a8',
      'd0000000-0000-0000-0000-0000000000a6',
      'd0000000-0000-0000-0000-0000000000a1',
      'd0000000-0000-0000-0000-0000000000a5'
    )$$,
  '42501',
  NULL,
  '17. staff have no INSERT policy — they cannot create a customer disposition'
);

reset request.jwt.claims;
reset role;

set local role authenticated;
set local request.jwt.claims = '{
  "sub":"d0000000-0000-0000-0000-0000000000b3",
  "role":"authenticated",
  "app_metadata":{
    "retailer_id":"d0000000-0000-0000-0000-0000000000b1",
    "retailer_role":"sales_associate"
  }
}';

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions),
  0,
  '18. cross-tenant staff cannot read House A''s dispositions'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 19-21. No UPDATE / DELETE grant or policy for the owning customer — the
--        removal is one-way and durable.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$update public.wardrobe_roadmap_gap_dispositions
      set disposition = 'removed_from_plan'
    where customer_id = 'd0000000-0000-0000-0000-0000000000a5'$$,
  '42501',
  NULL,
  '19. the owning customer cannot UPDATE the disposition (no grant, no policy)'
);

select throws_ok(
  $$delete from public.wardrobe_roadmap_gap_dispositions
    where customer_id = 'd0000000-0000-0000-0000-0000000000a5'$$,
  '42501',
  NULL,
  '20. the owning customer cannot DELETE the disposition (no grant, no policy)'
);

reset request.jwt.claims;
reset role;

select is(
  (select count(*)::int from public.wardrobe_roadmap_gap_dispositions
   where customer_id = 'd0000000-0000-0000-0000-0000000000a5'),
  1,
  '21. the disposition is durable — the customer cannot delete it'
);

-- ---------------------------------------------------------------------------
-- 22. Identity columns are immutable (BEFORE UPDATE trigger fires even for
--     the table owner / service tooling).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.wardrobe_roadmap_gap_dispositions
      set customer_id = 'd0000000-0000-0000-0000-0000000000b5'
    where customer_id = 'd0000000-0000-0000-0000-0000000000a5'$$,
  'Wardrobe roadmap gap disposition identity fields are immutable',
  '22. disposition identity columns cannot be repointed'
);

-- ---------------------------------------------------------------------------
-- 23. Migration adds no SECURITY DEFINER — both new functions are invoker.
-- ---------------------------------------------------------------------------
select is(
  (select bool_or(prosecdef) from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in (
       'enforce_wardrobe_roadmap_gap_disposition_tenancy',
       'protect_wardrobe_roadmap_gap_disposition_identity'
     )),
  false,
  '23. both new trigger functions are SECURITY INVOKER (no SECURITY DEFINER)'
);

-- ---------------------------------------------------------------------------
-- 24. This migration does not open retailer_staff_members to customers.
--     Unlike enforce_wardrobe_roadmap_tenancy, the new disposition triggers
--     never read that table; a customer session still sees zero rows of it.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is(
  (select count(*)::int from public.retailer_staff_members),
  0,
  '24. a customer session still reads zero rows of retailer_staff_members'
);

reset request.jwt.claims;
reset role;

select * from finish();
rollback;
