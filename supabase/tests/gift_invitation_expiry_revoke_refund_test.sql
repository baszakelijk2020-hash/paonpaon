begin;
select plan(16);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'Gift Lifecycle A Ltd', 'Gift Lifecycle A', 'gift-lifecycle-a', 'active'
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'Gift Lifecycle B Ltd', 'Gift Lifecycle B', 'gift-lifecycle-b', 'active'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'd2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'gift-manager-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'gift-sales-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
    'gift-manager-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    'd3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001', 'Gift Manager A', 'gift-manager-a@example.test',
    'manager', now()
  ),
  (
    'd3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002', 'Gift Sales A', 'gift-sales-a@example.test',
    'sales_associate', now()
  ),
  (
    'd3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000003', 'Gift Manager B', 'gift-manager-b@example.test',
    'manager', now()
  );

insert into public.products (
  id, retailer_id, name, slug, status, is_made_to_order, is_alterable
) values (
  'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
  'Lifecycle Scarf', 'gift-lifecycle-scarf', 'active', false, false
);
insert into public.product_variants (
  id, product_id, sku, size, color,
  price_amount_minor_units, price_currency, inventory_quantity
) values (
  'd4000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000001',
  'GIFT-LIFECYCLE-1', 'OS', 'Ivory', 20000, 'USD', 5
);

insert into public.gift_experiences (
  id, retailer_id, title, intro_message, status
) values (
  'd5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
  'A little something', 'Thought of you', 'active'
);
insert into public.gift_curated_items (
  id, gift_experience_id, product_variant_id
) values (
  'd5000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000001',
  'd4000000-0000-0000-0000-000000000002'
);

-- One invitation whose own expires_at is already in the past, one to
-- revoke, one to redeem-then-refund, and one left pending for the
-- "cannot refund a non-redeemed invitation" case.
insert into public.gift_invitations (
  id, gift_experience_id, invite_token, recipient_name, recipient_email, expires_at
) values (
  'd6000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
  'd7000000-0000-0000-0000-000000000001', 'Expiring Recipient', 'expiring@gift-lifecycle.test',
  now() - interval '1 hour'
);
insert into public.gift_invitations (
  id, gift_experience_id, invite_token, recipient_name, recipient_email
) values
  (
    'd6000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000002', 'Revoke Recipient', 'revoke@gift-lifecycle.test'
  ),
  (
    'd6000000-0000-0000-0000-000000000003', 'd5000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000003', 'Refund Recipient', 'refund@gift-lifecycle.test'
  ),
  (
    'd6000000-0000-0000-0000-000000000004', 'd5000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000004', 'Pending Recipient', 'pending@gift-lifecycle.test'
  );

select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);

-- 1. Anonymous redemption on a link whose own expires_at has already
-- passed, and which nobody has touched yet, is rejected by the redeem
-- path's own live expiry check — checkInvitationExpiry enforced in the
-- redeem path itself, not just the reveal path.
select throws_ok(
  $$
    select redeem_gift_invitation(
      'd7000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000002',
      'Expiring Recipient',
      'expiring@gift-lifecycle.test'
    )
  $$,
  'P0001',
  'This gift link has expired',
  'redeeming an untouched invitation past its own expires_at is rejected'
);

-- 2. Resolving (reveal path) the same link succeeds — unlike redeem, it
-- doesn't end in a raise — and reports it as expired.
select is(
  (resolve_gift_invitation('d7000000-0000-0000-0000-000000000001') ->> 'status'),
  'expired',
  'resolving an invitation past its own expires_at reports it as expired'
);

select set_config('role', 'none', true);

-- 3. ...and because resolve_gift_invitation completes successfully, its
-- lazy expiry write survives — persisted onto the invitation row, not
-- just computed on the fly. Verified from the retailer manager's view
-- of the raw table.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select status::text from public.gift_invitations
    where id = 'd6000000-0000-0000-0000-000000000001'),
  'expired',
  'the expiry is persisted onto the invitation row, not just computed'
);

-- 4. With the expiry now persisted, a further redemption attempt is
-- rejected via the already-persisted-status branch too.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);
select throws_ok(
  $$
    select redeem_gift_invitation(
      'd7000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000002',
      'Expiring Recipient',
      'expiring@gift-lifecycle.test'
    )
  $$,
  'P0001',
  'This gift link has expired',
  'redeeming an already-persisted-expired invitation is rejected'
);
select set_config('role', 'none', true);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

-- 5. A retailer manager can revoke a single still-pending invitation.
select lives_ok(
  $$select revoke_gift_invitation('d6000000-0000-0000-0000-000000000002', 'sent to the wrong address')$$,
  'a manager can revoke a pending invitation'
);
select is(
  (select status::text from public.gift_invitations
    where id = 'd6000000-0000-0000-0000-000000000002'),
  'revoked',
  'the revoked invitation status is persisted'
);

-- 6. Revoking an already-revoked invitation is rejected (no re-revoking
-- a terminal invitation).
select throws_ok(
  $$select revoke_gift_invitation('d6000000-0000-0000-0000-000000000002', 'second attempt')$$,
  'P0001',
  'This invitation is revoked and can no longer be revoked',
  'an already-revoked invitation cannot be revoked again'
);

-- 7. A non-manager retailer staff member cannot revoke.
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';
select throws_ok(
  $$select revoke_gift_invitation('d6000000-0000-0000-0000-000000000004', 'not my call')$$,
  'P0001',
  'Only retailer managers may revoke a gift invitation',
  'a non-manager cannot revoke a gift invitation'
);

-- 8. A manager from a different retailer cannot revoke this retailer's
-- invitation — tenant isolation, not just a role check.
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';
select throws_ok(
  $$select revoke_gift_invitation('d6000000-0000-0000-0000-000000000004', 'cross-tenant attempt')$$,
  'P0001',
  'Only retailer managers may revoke a gift invitation',
  'a manager from a different retailer cannot revoke this retailer''s invitation'
);

-- Redeem invitation 3 anonymously so it can be refunded.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);
select redeem_gift_invitation(
  'd7000000-0000-0000-0000-000000000003',
  'd5000000-0000-0000-0000-000000000002',
  'Refund Recipient',
  'refund@gift-lifecycle.test'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

-- 9. Refunding a redeemed invitation succeeds and persists the amount.
select lives_ok(
  $$select mark_gift_invitation_refunded('d6000000-0000-0000-0000-000000000003', 20000, 'item unavailable')$$,
  'a manager can mark a redeemed invitation refunded'
);
select is(
  (select refund_amount_minor_units from public.gift_invitations
    where id = 'd6000000-0000-0000-0000-000000000003'),
  20000,
  'the refund amount is persisted on the invitation'
);

-- 10. Refunding the same invitation a second time is rejected — no
-- double-refund, whether by accident or replay.
select throws_ok(
  $$select mark_gift_invitation_refunded('d6000000-0000-0000-0000-000000000003', 20000, 'second attempt')$$,
  'P0001',
  'This invitation has already been refunded',
  'a second refund of the same invitation is rejected'
);

-- 11. A pending (never-redeemed) invitation cannot be marked refunded.
select throws_ok(
  $$select mark_gift_invitation_refunded('d6000000-0000-0000-0000-000000000004', 5000, 'not redeemed yet')$$,
  'P0001',
  'Only a redeemed invitation can be marked refunded',
  'a non-redeemed invitation cannot be marked refunded'
);

-- 12. The owning retailer's manager can read the audit trail for their
-- own invitations.
select ok(
  (select count(*) from public.gift_invitation_state_history
    where gift_invitation_id = 'd6000000-0000-0000-0000-000000000003') > 0,
  'the retailer manager can read the refund history for their own invitation'
);

-- 13. A manager from a different retailer cannot read this retailer's
-- history rows — tenant isolation on the audit table itself.
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';
select is(
  (select count(*) from public.gift_invitation_state_history
    where gift_invitation_id = 'd6000000-0000-0000-0000-000000000003')::int,
  0,
  'a manager from a different retailer cannot read this retailer''s state history'
);

-- 14. Append-only: even a retailer manager cannot write a history row
-- directly — every row must come from the SECURITY DEFINER functions.
set local request.jwt.claims = '{
  "sub": "d2000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "d1000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';
select throws_ok(
  $$
    insert into public.gift_invitation_state_history (gift_invitation_id, to_status)
    values ('d6000000-0000-0000-0000-000000000003', 'revoked')
  $$,
  '42501',
  'permission denied for table gift_invitation_state_history',
  'no role may insert directly into the append-only state history table'
);

select * from finish();
rollback;
