-- ADR-074 Slice 1 — customer relationship-intelligence access boundary.
-- Proves `clienteling_notes`' need-to-know visibility tiers (author/
-- assigned-advisor/management/retailer-shared), that an unassigned
-- non-management staff member is refused a narrow note while the assigned
-- advisor and management still see it, cross-tenant refusal, and that the
-- sensitive-access ledger RPC records metadata only for an authenticated
-- retailer staff session and refuses an unauthenticated one.

begin;
select plan(12);

insert into public.retailers (id, legal_name, display_name, slug, status) values
  ('ab000000-0000-4000-8000-000000000001', 'Access House A Ltd', 'Access House A', 'access-house-a', 'active'),
  ('ab000000-0000-4000-8000-000000000002', 'Access House B Ltd', 'Access House B', 'access-house-b', 'active');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('ac000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'access-assigned@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('ac000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'access-unassigned@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('ac000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'access-manager@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('ac000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'access-house-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.retailer_staff_members (id, retailer_id, user_id, full_name, email, role, accepted_at) values
  ('ad000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 'Assigned Advisor', 'access-assigned@example.test', 'sales_associate', now()),
  ('ad000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000002', 'Unassigned Associate', 'access-unassigned@example.test', 'sales_associate', now()),
  ('ad000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000003', 'House A Manager', 'access-manager@example.test', 'manager', now()),
  ('ad000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000004', 'House B Staff', 'access-house-b@example.test', 'sales_associate', now());

insert into public.customers (id, retailer_id, full_name, email, phone, lifecycle_stage, assigned_staff_id) values
  ('ae000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'Assigned Client', 'assigned-client@example.test', '+84 91 234 5238', 'prospect', 'ad000000-0000-4000-8000-000000000001');

-- Seed one note per visibility tier, all authored by the assigned advisor.
insert into public.clienteling_notes (id, retailer_id, customer_id, author_staff_id, body, visibility) values
  ('af000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Author-only note', 'author_only'),
  ('af000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Assigned-advisor note', 'assigned_advisor'),
  ('af000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Management note', 'management'),
  ('af000000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Retailer-shared note', 'retailer_shared');

set local role authenticated;

-- The assigned advisor (also the author here) sees all four tiers.
set local request.jwt.claims = '{
  "sub": "ac000000-0000-4000-8000-000000000001",
  "role": "authenticated",
  "app_metadata": {"retailer_id": "ab000000-0000-4000-8000-000000000001", "retailer_role": "sales_associate"}
}';
select is(
  (select count(*)::integer from public.clienteling_notes where customer_id = 'ae000000-0000-4000-8000-000000000001'),
  4,
  'the author, who is also the assigned advisor, sees all four tiers'
);

-- An unassigned, non-management associate sees only retailer_shared —
-- author_only, assigned_advisor and management are all refused.
set local request.jwt.claims = '{
  "sub": "ac000000-0000-4000-8000-000000000002",
  "role": "authenticated",
  "app_metadata": {"retailer_id": "ab000000-0000-4000-8000-000000000001", "retailer_role": "sales_associate"}
}';
select is(
  (select count(*)::integer from public.clienteling_notes where customer_id = 'ae000000-0000-4000-8000-000000000001'),
  1,
  'an unassigned non-management associate sees only the retailer_shared note'
);
select ok(
  (select bool_and(visibility = 'retailer_shared') from public.clienteling_notes where customer_id = 'ae000000-0000-4000-8000-000000000001'),
  'every note visible to the unassigned associate is retailer_shared'
);
select ok(
  not exists (select 1 from public.clienteling_notes where id = 'af000000-0000-4000-8000-000000000001'),
  'the unassigned associate cannot see the author_only note'
);
select ok(
  not exists (select 1 from public.clienteling_notes where id = 'af000000-0000-4000-8000-000000000003'),
  'the unassigned associate cannot see the management note'
);

-- A manager (management override) sees all four tiers despite not being
-- the author or the assigned advisor.
set local request.jwt.claims = '{
  "sub": "ac000000-0000-4000-8000-000000000003",
  "role": "authenticated",
  "app_metadata": {"retailer_id": "ab000000-0000-4000-8000-000000000001", "retailer_role": "manager"}
}';
select is(
  (select count(*)::integer from public.clienteling_notes where customer_id = 'ae000000-0000-4000-8000-000000000001'),
  4,
  'a manager sees all four tiers via the management override, despite not authoring or being assigned'
);

-- Cross-tenant refusal: House B staff see none of House A's notes.
set local request.jwt.claims = '{
  "sub": "ac000000-0000-4000-8000-000000000004",
  "role": "authenticated",
  "app_metadata": {"retailer_id": "ab000000-0000-4000-8000-000000000002", "retailer_role": "sales_associate"}
}';
select is(
  (select count(*)::integer from public.clienteling_notes where customer_id = 'ae000000-0000-4000-8000-000000000001'),
  0,
  'House B staff see none of House A''s notes regardless of visibility tier'
);

-- Sensitive-access ledger: an authenticated retailer staff session can
-- record an event, and it lands with metadata only — never a sensitive
-- payload column.
set local request.jwt.claims = '{
  "sub": "ac000000-0000-4000-8000-000000000002",
  "role": "authenticated",
  "app_metadata": {"retailer_id": "ab000000-0000-4000-8000-000000000001", "retailer_role": "sales_associate"}
}';
select lives_ok(
  $$ select public.record_customer_access_event('customer_protected_open', 'customer', 'ae000000-0000-4000-8000-000000000001', 'coverage handoff', 'minimal_identity_only') $$,
  'an authenticated retailer staff session can record a sensitive-access event'
);
select throws_ok(
  $$ select public.record_customer_access_event('not_a_real_action', 'customer', 'ae000000-0000-4000-8000-000000000001') $$,
  'P0001',
  'record_customer_access_event: unrecognized action not_a_real_action',
  'an unrecognized action is refused rather than silently logged'
);

reset role;
select is(
  (select count(*)::integer from public.audit_log_entries where entity_id = 'ae000000-0000-4000-8000-000000000001' and action = 'customer_protected_open'),
  1,
  'exactly one ledger entry was written for the recognized action'
);
select ok(
  (
    select after_state ? 'reason' and after_state ? 'outcome' and after_state ? 'actor_role'
      and not (after_state::text ilike '%example.test%')
    from public.audit_log_entries
    where entity_id = 'ae000000-0000-4000-8000-000000000001' and action = 'customer_protected_open'
  ),
  'the ledger entry carries reason/outcome/actor_role metadata only, never a customer contact value'
);

-- record_customer_access_event requires an authenticated retailer staff
-- session — it must not silently no-op or attribute the event to nobody.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}';
select throws_ok(
  $$ select public.record_customer_access_event('customer_protected_open', 'customer', 'ae000000-0000-4000-8000-000000000001') $$,
  'P0001',
  'record_customer_access_event requires an authenticated retailer staff session',
  'a session with no resolvable retailer staff membership cannot write a ledger entry'
);

select * from finish();
rollback;
