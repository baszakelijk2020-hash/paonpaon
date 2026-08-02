begin;
select plan(3);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'b1000000-0000-0000-0000-000000000001',
  'WP Test Ltd', 'WP Test', 'wp-invite-lookup-test', 'active'
);
insert into public.customers (id, retailer_id, full_name, email, lifecycle_stage)
values (
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000001',
  'Organizer', 'wp-invite-lookup-organizer@example.test', 'prospect'
);
insert into public.wedding_parties (
  id, retailer_id, organizer_customer_id, invite_token, status
) values (
  'b1000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000004',
  'planning'
);

-- Customer-app entry points have no retailer/staff session, so this narrow
-- RPC must stay callable anonymously — it must resolve the correct retailer
-- for a valid invite without requiring one.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);

select is(
  public.wedding_party_retailer_for_invite(
    'b1000000-0000-0000-0000-000000000004'
  ),
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'a valid invite token resolves its owning retailer anonymously'
);

select is(
  public.wedding_party_retailer_for_invite(
    'b1000000-0000-0000-0000-000000000005'
  ),
  null,
  'an unknown invite token resolves to null rather than erroring'
);

select set_config('role', 'service_role', true);
update public.wedding_parties
  set status = 'cancelled'
  where id = 'b1000000-0000-0000-0000-000000000003';
select set_config('role', 'anon', true);

select is(
  public.wedding_party_retailer_for_invite(
    'b1000000-0000-0000-0000-000000000004'
  ),
  null,
  'a cancelled party''s invite token no longer resolves, matching join_wedding_party''s own validity check'
);

select set_config('role', 'none', true);

select * from finish();
rollback;
