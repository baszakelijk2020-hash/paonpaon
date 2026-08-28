-- Customer wardrobe-roadmap approval authorization path.
--
-- Regression + guard for migration
-- 20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql.
--
-- The defect: `enforce_wardrobe_roadmap_tenancy()` (BEFORE INSERT OR
-- UPDATE, security invoker) re-ran a `retailer_staff_members` author
-- lookup on every UPDATE. Under a customer session that table is
-- unreadable, so the lookup returned nothing and the trigger raised
-- 'Roadmap author does not belong to the retailer' — the customer
-- approve/reject buttons on /wardrobe always failed with
-- "Could not update roadmap."
--
-- The fix runs that lookup only on INSERT. This test proves the fix
-- restores the legitimate customer approve/reject path WITHOUT weakening
-- tenancy, customer ownership, staff authorization, RLS, or creation-time
-- author validation.

begin;
select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures: two retailers. House A has two advisors + one linked customer;
-- House B has one advisor + one linked customer (the cross-tenant actor).
-- Two independent pending roadmaps in House A: one for the approve
-- scenario, one for the reject/request-changes scenario.
-- ---------------------------------------------------------------------------

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  ('c2000000-0000-0000-0000-0000000000a1',
   'Roadmap Approval House A Ltd', 'Roadmap Approval House A',
   'roadmap-approval-house-a', 'active'),
  ('c2000000-0000-0000-0000-0000000000b1',
   'Roadmap Approval House B Ltd', 'Roadmap Approval House B',
   'roadmap-approval-house-b', 'active');

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('c2000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
   'roadmap-approval-customer-a@example.test', '{}'::jsonb, '{}'::jsonb,
   now(), now()),
  ('c2000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'roadmap-approval-customer-b@example.test', '{}'::jsonb, '{}'::jsonb,
   now(), now()),
  ('c2000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated',
   'roadmap-approval-staff-a@example.test', '{}'::jsonb, '{}'::jsonb,
   now(), now()),
  ('c2000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated',
   'roadmap-approval-staff-b@example.test', '{}'::jsonb, '{}'::jsonb,
   now(), now());

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  ('c2000000-0000-0000-0000-0000000000a4',
   'c2000000-0000-0000-0000-0000000000a1',
   'c2000000-0000-0000-0000-0000000000a3',
   'House A Advisor One', 'roadmap-approval-staff-a@example.test',
   'sales_associate', now()),
  ('c2000000-0000-0000-0000-0000000000a7',
   'c2000000-0000-0000-0000-0000000000a1',
   null,
   'House A Advisor Two', 'roadmap-approval-staff-a2@example.test',
   'sales_associate', now()),
  ('c2000000-0000-0000-0000-0000000000b4',
   'c2000000-0000-0000-0000-0000000000b1',
   'c2000000-0000-0000-0000-0000000000b3',
   'House B Advisor', 'roadmap-approval-staff-b@example.test',
   'sales_associate', now());

insert into public.customers (id, retailer_id, user_id, full_name, email)
values
  ('c2000000-0000-0000-0000-0000000000a5',
   'c2000000-0000-0000-0000-0000000000a1',
   'c2000000-0000-0000-0000-0000000000a2',
   'House A Client', 'roadmap-approval-customer-a@example.test'),
  ('c2000000-0000-0000-0000-0000000000b5',
   'c2000000-0000-0000-0000-0000000000b1',
   'c2000000-0000-0000-0000-0000000000b2',
   'House B Client', 'roadmap-approval-customer-b@example.test');

insert into public.wardrobe_roadmaps (
  id, retailer_id, customer_id, title, status,
  authored_by_staff_id, submitted_at
) values
  ('c2000000-0000-0000-0000-0000000000a6',
   'c2000000-0000-0000-0000-0000000000a1',
   'c2000000-0000-0000-0000-0000000000a5',
   'House A wardrobe roadmap — approve scenario',
   'pending_approval',
   'c2000000-0000-0000-0000-0000000000a4',
   now()),
  ('c2000000-0000-0000-0000-0000000000a8',
   'c2000000-0000-0000-0000-0000000000a1',
   'c2000000-0000-0000-0000-0000000000a5',
   'House A wardrobe roadmap — reject scenario',
   'pending_approval',
   'c2000000-0000-0000-0000-0000000000a4',
   now()),
  ('c2000000-0000-0000-0000-0000000000a9',
   'c2000000-0000-0000-0000-0000000000a1',
   'c2000000-0000-0000-0000-0000000000a5',
   'House A wardrobe roadmap — identity-immutability scenario',
   'pending_approval',
   'c2000000-0000-0000-0000-0000000000a4',
   now());

-- ---------------------------------------------------------------------------
-- 1-2. Owning customer approves their own pending roadmap; approval records
--      decided_by_actor and decided_at.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select lives_ok(
  $$update public.wardrobe_roadmaps
      set status = 'approved',
          decided_at = now(),
          decided_by_actor = 'customer'
    where id = 'c2000000-0000-0000-0000-0000000000a6'$$,
  '1. owning customer approves their own pending roadmap'
);

select is(
  (select decided_by_actor from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a6'),
  'customer',
  '2a. approval records decided_by_actor = customer'
);

select isnt(
  (select decided_at from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a6'),
  null,
  '2b. approval records a non-null decided_at'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 3-4. Owning customer requests changes/rejects with a real note; the
--      rejection state and note persist.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select lives_ok(
  $$update public.wardrobe_roadmaps
      set status = 'rejected',
          decided_at = now(),
          decided_by_actor = 'customer',
          customer_decision_note = 'Please swap the jacket for something warmer.'
    where id = 'c2000000-0000-0000-0000-0000000000a8'$$,
  '3. owning customer requests changes/rejects with a real note'
);

select is(
  (select status from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a8'),
  'rejected',
  '4a. the rejection status persists'
);

select is(
  (select customer_decision_note from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a8'),
  'Please swap the jacket for something warmer.',
  '4b. the real customer note persists'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 5. Cross-tenant customer reads and updates zero rows.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select is(
  (select count(*)::int from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a6'),
  0,
  '5a. cross-tenant customer reads zero rows'
);

with u as (
  update public.wardrobe_roadmaps
     set status = 'approved', decided_by_actor = 'customer', decided_at = now()
   where id = 'c2000000-0000-0000-0000-0000000000a6'
   returning 1
)
select count(*)::int as n from u \gset

select is(:n, 0, '5b. cross-tenant customer updates zero rows');

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 6. Anonymous user reads and updates zero rows.
--    `wardrobe_roadmaps` is granted only to authenticated + service_role
--    (no grant to anon at all — stricter than RLS alone), so an anon
--    session is denied at the privilege level before RLS is even
--    evaluated: both read and update raise "permission denied", which is
--    the zero-rows guarantee expressed as an outright refusal.
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$select count(*) from public.wardrobe_roadmaps
    where id = 'c2000000-0000-0000-0000-0000000000a6'$$,
  '42501',
  NULL,
  '6a. anonymous user cannot read (permission denied — no grant to anon)'
);

select throws_ok(
  $$update public.wardrobe_roadmaps
      set status = 'approved', decided_by_actor = 'customer'
    where id = 'c2000000-0000-0000-0000-0000000000a6'$$,
  '42501',
  NULL,
  '6b. anonymous user cannot update (permission denied — no grant to anon)'
);

reset role;

-- ---------------------------------------------------------------------------
-- 7. Cross-tenant staff reads and updates zero rows.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub":"c2000000-0000-0000-0000-0000000000b3",
  "role":"authenticated",
  "app_metadata":{
    "retailer_id":"c2000000-0000-0000-0000-0000000000b1",
    "retailer_role":"sales_associate"
  }
}';

select is(
  (select count(*)::int from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a6'),
  0,
  '7a. cross-tenant staff reads zero rows'
);

with u as (
  update public.wardrobe_roadmaps
     set status = 'approved', decided_by_actor = 'customer'
   where id = 'c2000000-0000-0000-0000-0000000000a6'
   returning 1
)
select count(*)::int as n from u \gset

select is(:n, 0, '7b. cross-tenant staff updates zero rows');

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 8. INSERT with an author from another retailer throws (creation-time
--    author validation preserved).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.wardrobe_roadmaps (
      id, retailer_id, customer_id, title, status, authored_by_staff_id
    ) values (
      'c2000000-0000-0000-0000-0000000000c9',
      'c2000000-0000-0000-0000-0000000000a1',
      'c2000000-0000-0000-0000-0000000000a5',
      'Roadmap authored by the wrong house',
      'draft',
      'c2000000-0000-0000-0000-0000000000b4'
    )$$,
  'Roadmap author does not belong to the retailer',
  '8. INSERT with an author from another retailer throws'
);

-- ---------------------------------------------------------------------------
-- 9. Legitimate same-retailer staff draft INSERT succeeds.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub":"c2000000-0000-0000-0000-0000000000a3",
  "role":"authenticated",
  "app_metadata":{
    "retailer_id":"c2000000-0000-0000-0000-0000000000a1",
    "retailer_role":"sales_associate"
  }
}';

select lives_ok(
  $$insert into public.wardrobe_roadmaps (
      id, retailer_id, customer_id, title, status, authored_by_staff_id
    ) values (
      'c2000000-0000-0000-0000-0000000000d9',
      'c2000000-0000-0000-0000-0000000000a1',
      'c2000000-0000-0000-0000-0000000000a5',
      'A fresh draft roadmap',
      'draft',
      'c2000000-0000-0000-0000-0000000000a4'
    )$$,
  '9. legitimate same-retailer staff draft INSERT succeeds'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 10-12. UPDATE changing retailer_id / customer_id / authored_by_staff_id
--        throws the immutable identity error (protect_wardrobe_roadmap_
--        identity_on_update, untouched by this migration). Uses the
--        dedicated a9 fixture (still pending_approval) — a6/a8 already
--        left pending_approval in tests 1-4, and the customer UPDATE
--        policy's USING clause requires status = 'pending_approval', so
--        reusing them here would silently match zero rows and prove
--        nothing.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$update public.wardrobe_roadmaps
      set status = 'approved', decided_by_actor = 'customer',
          retailer_id = 'c2000000-0000-0000-0000-0000000000b1'
    where id = 'c2000000-0000-0000-0000-0000000000a9'$$,
  'Wardrobe roadmap identity fields are immutable',
  '10. UPDATE changing retailer_id throws the immutable identity error'
);

select throws_ok(
  $$update public.wardrobe_roadmaps
      set status = 'approved', decided_by_actor = 'customer',
          customer_id = 'c2000000-0000-0000-0000-0000000000b5'
    where id = 'c2000000-0000-0000-0000-0000000000a9'$$,
  'Wardrobe roadmap identity fields are immutable',
  '11. UPDATE changing customer_id throws the immutable identity error'
);

-- Reassigning to another advisor OF THE SAME HOUSE isolates the identity
-- guard from the tenancy trigger: the tenancy check (INSERT-only now) would
-- not fire at all, so only protect_wardrobe_roadmap_identity can reject
-- this — proving that trigger, not a side effect of the fix, is what still
-- protects authorship.
select throws_ok(
  $$update public.wardrobe_roadmaps
      set status = 'approved', decided_by_actor = 'customer',
          authored_by_staff_id = 'c2000000-0000-0000-0000-0000000000a7'
    where id = 'c2000000-0000-0000-0000-0000000000a9'$$,
  'Wardrobe roadmap identity fields are immutable',
  '12. UPDATE changing authored_by_staff_id throws the immutable identity error'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 13. Rejected identity changes leave the row unchanged.
-- ---------------------------------------------------------------------------
select is(
  (select status || '|' || retailer_id::text || '|' || customer_id::text
     || '|' || authored_by_staff_id::text
   from public.wardrobe_roadmaps
   where id = 'c2000000-0000-0000-0000-0000000000a9'),
  'pending_approval'
    || '|c2000000-0000-0000-0000-0000000000a1'
    || '|c2000000-0000-0000-0000-0000000000a5'
    || '|c2000000-0000-0000-0000-0000000000a4',
  '13. the three rejected identity-change attempts left the row completely unchanged'
);

-- ---------------------------------------------------------------------------
-- 14. The migration adds no grant on retailer_staff_members, and a customer
--     session cannot read any of its rows.
--
--     `retailer_staff_members` is (pre-existing, unrelated to this fix)
--     table-level GRANTed to `authenticated`, because retailer staff use
--     the same `authenticated` role to read their own colleagues — that
--     grant is not something this migration touches or could remove
--     without breaking staff-facing features. The actual security boundary
--     customers rely on is row-level: RLS returns zero rows for a customer
--     session, exactly why the pre-fix trigger's lookup returned nothing
--     for a customer and raised its exception. This migration does not
--     add any new grant on the table (checked statically against the
--     migration source in wardrobe-roadmap-security.test.ts), and does not
--     touch retailer_staff_members' RLS policies — a customer session
--     still sees zero rows.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is(
  (select count(*)::int from public.retailer_staff_members),
  0,
  '14. a customer session reads zero rows of retailer_staff_members (RLS-scoped, not newly granted)'
);

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- 15. The function is SECURITY INVOKER and not SECURITY DEFINER.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
   where proname = 'enforce_wardrobe_roadmap_tenancy'
     and pronamespace = 'public'::regnamespace),
  false,
  '15. enforce_wardrobe_roadmap_tenancy is security invoker (prosecdef = false), not security definer'
);

select * from finish();
rollback;
