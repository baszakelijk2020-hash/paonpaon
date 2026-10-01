begin;
select plan(10);

insert into public.retailers (id, legal_name, display_name, slug, status)
values ('c1000000-0000-0000-0000-000000000001', 'Invite Test Ltd', 'Invite Test', 'wp-email-invite-test', 'active');
insert into public.customers (id, retailer_id, full_name, email, lifecycle_stage)
values
  ('c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Organizer', 'wp-email-organizer@example.test', 'prospect'),
  ('c1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Not Organizer', 'wp-email-other@example.test', 'prospect');
insert into public.wedding_parties (id, retailer_id, organizer_customer_id, invite_token, status)
values ('c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004', 'planning');

select ok(
  not has_function_privilege('anon', 'public.invite_wedding_party_guest(uuid,uuid,text,text,text,text)', 'EXECUTE'),
  'logged-out callers cannot send party invitations'
);
select ok(
  not has_function_privilege('authenticated', 'public.invite_wedding_party_guest(uuid,uuid,text,text,text,text)', 'EXECUTE'),
  'a browser session cannot supply invitation email content'
);
select ok(
  not has_table_privilege('authenticated', 'public.wedding_party_invitations', 'INSERT'),
  'invitations are only recorded by the invite command'
);

select throws_ok(
  $$ select public.invite_wedding_party_guest(
       'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000005',
       'Guest', 'guest-one@example.test', 'Join', '<p>hi</p>') $$,
  'P0001', 'Only the organizer can invite to this party',
  'only the party organizer can invite'
);

select lives_ok(
  $$ select public.invite_wedding_party_guest(
       'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002',
       'Guest One', 'Guest-One@example.test', 'Join my party', '<p>hi</p>') $$,
  'the organizer can invite a guest'
);
select is(
  (select count(*) from public.email_outbox where recipient_email = 'guest-one@example.test' and subject = 'Join my party'),
  1::bigint, 'the invitation email is queued in the outbox'
);
select is(
  (select count(*) from public.customers where email = 'guest-one@example.test'),
  0::bigint, 'an invitation creates no customer: the guest joins only through the link'
);
select is(
  (select retailer_id from public.wedding_party_invitations where email = 'guest-one@example.test'),
  'c1000000-0000-0000-0000-000000000001'::uuid, 'the invitation is recorded under the party''s retailer'
);
select throws_like(
  $$ select public.invite_wedding_party_guest(
       'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002',
       'Guest One', 'guest-one@example.test', 'Join my party', '<p>hi</p>') $$,
  '%invited recently',
  'the same address cannot be invited twice within an hour'
);

-- An opted-out customer is never mailed.
insert into public.customer_preferences (customer_id, communication_channels)
values ('c1000000-0000-0000-0000-000000000005', '{}');
select throws_like(
  $$ select public.invite_wedding_party_guest(
       'c1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002',
       'Other', 'wp-email-other@example.test', 'Join my party', '<p>hi</p>') $$,
  '%cannot be invited',
  'an address whose customer opted out of email is not invited'
);

select * from finish();
rollback;
