begin;
select plan(7);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_wishlist_item(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot invoke the wishlist save command'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_wishlist_item(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated customers can invoke the wishlist save command'
);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    'b1000000-0000-0000-0000-000000000001',
    'Wishlist House A Ltd', 'Wishlist House A', 'wishlist-house-a', 'active'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Wishlist House B Ltd', 'Wishlist House B', 'wishlist-house-b', 'active'
  );

insert into public.products (
  id, retailer_id, name, slug, status
) values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'Wishlist A jacket', 'wishlist-a-jacket', 'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002',
    'Wishlist B jacket', 'wishlist-b-jacket', 'active'
  );

insert into public.product_variants (
  id, product_id, sku, price_amount_minor_units, price_currency
) values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'WISHLIST-A', 10000, 'EUR'
  ),
  (
    'b3000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'WISHLIST-B', 10000, 'EUR'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b4000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'wishlist-customer@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "b4000000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select lives_ok(
  $$
    select public.save_wishlist_item(
      'b1000000-0000-0000-0000-000000000001',
      'b3000000-0000-0000-0000-000000000001'
    )
  $$,
  'the customer can save a same-retailer variant'
);

select lives_ok(
  $$
    select public.save_wishlist_item(
      'b1000000-0000-0000-0000-000000000001',
      'b3000000-0000-0000-0000-000000000001'
    )
  $$,
  'replaying the same save command succeeds'
);

select is(
  (
    select count(*)
    from public.wishlist_items item
    join public.wishlists wishlist on wishlist.id = item.wishlist_id
    join public.customers customer on customer.id = wishlist.customer_id
    where customer.user_id = auth.uid()
      and item.product_variant_id = 'b3000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'replaying a save creates exactly one wishlist item'
);

select throws_ok(
  $$
    select public.save_wishlist_item(
      'b1000000-0000-0000-0000-000000000001',
      'b3000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'Product is not available from this retailer',
  'a customer cannot save another retailer variant through a false retailer id'
);

select is(
  (
    select count(*)
    from public.customers
    where user_id = auth.uid()
      and retailer_id = 'b1000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'the command creates exactly one tenant-scoped customer relationship'
);

select * from finish();
rollback;
