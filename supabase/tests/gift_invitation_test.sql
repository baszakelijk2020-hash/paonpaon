begin;
select plan(6);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'c1000000-0000-0000-0000-000000000001',
  'Gift Test Ltd', 'Gift Test', 'gift-pgtap-test', 'active'
);
insert into public.products (
  id, retailer_id, name, slug, status, is_made_to_order, is_alterable
) values (
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000001',
  'Test Scarf', 'gift-pgtap-scarf', 'active', false, false
);
insert into public.product_variants (
  id, product_id, sku, size, color,
  price_amount_minor_units, price_currency, inventory_quantity
) values (
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000002',
  'GIFT-PGTAP-1', 'OS', 'Navy', 15000, 'USD', 5
);
insert into public.gift_experiences (
  id, retailer_id, title, intro_message, status, expires_at
) values (
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000001',
  'A little something', 'Thought of you', 'active', now() + interval '30 days'
);
insert into public.gift_curated_items (
  id, gift_experience_id, product_variant_id, note
) values (
  'c1000000-0000-0000-0000-000000000005',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000003',
  'Pairs well with everything'
);
insert into public.gift_invitations (
  id, gift_experience_id, invite_token, recipient_name, recipient_email
) values (
  'c1000000-0000-0000-0000-000000000006',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-00000000000a',
  'Alex', 'alex@gift-pgtap.test'
);

-- Customer-app entry points have no retailer/staff session, so both RPCs
-- must stay callable anonymously.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('role', 'anon', true);

select is(
  (resolve_gift_invitation('c1000000-0000-0000-0000-00000000000a')->>'status'),
  'opened',
  'an anonymous resolve opens a pending invitation and returns its curated items'
);

select is(
  jsonb_array_length(
    resolve_gift_invitation('c1000000-0000-0000-0000-00000000000a')->'items'
  ),
  1,
  'the reveal includes exactly the curated items for this experience'
);

select throws_ok(
  $$select resolve_gift_invitation('00000000-0000-0000-0000-000000000000')$$,
  'P0001',
  'This gift link is no longer valid',
  'an unknown token is rejected rather than leaking another gift''s data'
);

select throws_ok(
  $$select redeem_gift_invitation(
    'c1000000-0000-0000-0000-00000000000a',
    gen_random_uuid(),
    'Alex',
    'alex@gift-pgtap.test'
  )$$,
  'P0001',
  'Choose one of the curated pieces',
  'redemption rejects a curated item id that does not belong to this experience'
);

select lives_ok(
  $$select redeem_gift_invitation(
    'c1000000-0000-0000-0000-00000000000a',
    'c1000000-0000-0000-0000-000000000005',
    'Alex',
    'alex@gift-pgtap.test'
  )$$,
  'redeeming the correct curated item succeeds'
);

select throws_ok(
  $$select redeem_gift_invitation(
    'c1000000-0000-0000-0000-00000000000a',
    'c1000000-0000-0000-0000-000000000005',
    'Alex',
    'alex@gift-pgtap.test'
  )$$,
  'P0001',
  'This gift has already been redeemed',
  'a second redemption of the same invitation is rejected — no double-spend'
);

select set_config('role', 'none', true);

select * from finish();
rollback;
