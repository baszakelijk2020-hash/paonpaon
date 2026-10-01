begin;
select plan(4);

insert into public.retailers (id, legal_name, display_name, slug, status)
values ('c2000000-0000-0000-0000-000000000001', 'Attend Ltd', 'Attend', 'wp-attendance-test', 'active');
insert into auth.users (id, email) values
  ('c2000000-0000-0000-0000-0000000000a1', 'wp-att-org@example.test'),
  ('c2000000-0000-0000-0000-0000000000a2', 'wp-att-member@example.test');
insert into public.customers (id, retailer_id, full_name, email, lifecycle_stage, user_id) values
  ('c2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Org', 'wp-att-org@example.test', 'prospect', 'c2000000-0000-0000-0000-0000000000a1'),
  ('c2000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', 'Member', 'wp-att-member@example.test', 'prospect', 'c2000000-0000-0000-0000-0000000000a2'),
  ('c2000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000001', 'Guest', 'wp-att-guest@example.test', 'prospect', null);
insert into public.wedding_parties (id, retailer_id, organizer_customer_id, invite_token, status)
values ('c2000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000006', 'planning');
insert into public.wedding_party_members (id, wedding_party_id, customer_id, name) values
  ('c2000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003', 'Member'),
  ('c2000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000004', 'Guest');

-- Signed in as the member: may not change the guest's attendance.
set local role authenticated;
set local request.jwt.claims = '{"sub": "c2000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok(
  $$ select public.set_wedding_party_member_attendance('c2000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000008', 'declined') $$,
  'P0001', 'You are not in this party',
  'a member cannot change another member''s attendance'
);
select lives_ok(
  $$ select public.set_wedding_party_member_attendance('c2000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000007', 'attending') $$,
  'a member can set their own attendance'
);

-- Without a session: only a fresh, unlinked member.
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select public.set_wedding_party_member_attendance('c2000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000007', 'declined') $$,
  'P0001', 'Sign in to change your attendance',
  'a link holder cannot change an account holder''s attendance'
);
select lives_ok(
  $$ select public.set_wedding_party_member_attendance('c2000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000008', 'attending') $$,
  'a guest who just joined can set their own attendance'
);

select * from finish();
rollback;
