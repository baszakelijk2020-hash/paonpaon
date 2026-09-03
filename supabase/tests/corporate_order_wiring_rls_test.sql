-- Proof for 20260829000000: Corporate order wiring and tenant isolation
-- Tests:
-- (a) retailer staff of retailer A cannot call place_corporate_order for wearer of retailer B
-- (b) corporate manager can SELECT an order for wearer in their own account but NOT other account
-- (c) customer_id IS NULL AND corporate_wearer_id IS NOT NULL round-trips correctly
-- (d) CHECK constraint rejects row with both customer_id and corporate_wearer_id null
-- (e) a corporate (customer_id NULL) order's status can be advanced with loyalty
--     enabled — the personal-loyalty triggers must skip customer-less orders
--     (regression guard for 20260829000001)

begin;
select plan(9);

-- Set up two retailers A and B, each with account/programme/wearer/products
insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'Retailer A', 'Retailer A', 'retailer-a', 'active'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Retailer B', 'Retailer B', 'retailer-b', 'active'
  );

insert into public.retailer_branches (id, retailer_id, name, address_line1, city, postal_code, country, timezone)
values
  (
    'c1100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Branch A', '123 Main St', 'City A', '12345', 'Country', 'UTC'
  ),
  (
    'c1100000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'Branch B', '456 Oak St', 'City B', '67890', 'Country', 'UTC'
  );

-- Create product/variant for ordering
insert into public.products (
  id, retailer_id, name, slug, status, is_made_to_order, is_alterable
) values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Test Product A', 'test-product-a', 'active', false, false
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'Test Product B', 'test-product-b', 'active', false, false
  );

insert into public.product_variants (
  id, product_id, sku, price_amount_minor_units, price_currency,
  inventory_quantity
) values
  (
    'c2100000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'SKU-A-1', 5000, 'GBP', 100
  ),
  (
    'c2100000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'SKU-B-1', 5000, 'GBP', 100
  );

-- Corporate accounts, programmes, wearers
insert into public.corporate_accounts (
  id, retailer_id, legal_name, account_reference
) values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Account A', 'ACC-A-1'
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'Account B', 'ACC-B-1'
  );

insert into public.corporate_programmes (
  id, retailer_id, account_id, name
) values
  (
    'c3100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'Programme A'
  ),
  (
    'c3100000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'c3000000-0000-0000-0000-000000000002',
    'Programme B'
  );

insert into public.corporate_wearers (
  id, retailer_id, programme_id, employee_reference, display_name,
  role_key, joined_on
) values
  (
    'c3200000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c3100000-0000-0000-0000-000000000001',
    'EMP-A-1', 'Wearer A', 'staff', current_date
  ),
  (
    'c3200000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'c3100000-0000-0000-0000-000000000002',
    'EMP-B-1', 'Wearer B', 'staff', current_date
  );

-- Create entitlement versions
insert into public.corporate_entitlement_versions (
  id, retailer_id, programme_id, version, effective_from, rules
) values
  (
    'c3300000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c3100000-0000-0000-0000-000000000001',
    1, current_date,
    '[{"roleKey":"staff","garmentKey":"uniform","quantity":2,"period":"annual"}]'::jsonb
  ),
  (
    'c3300000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'c3100000-0000-0000-0000-000000000002',
    1, current_date,
    '[{"roleKey":"staff","garmentKey":"uniform","quantity":2,"period":"annual"}]'::jsonb
  );

-- Set up staff users
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    'c4000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'staff-a@example.test', '{}', '{}', now(), now()
  ),
  (
    'c4000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'staff-b@example.test', '{}', '{}', now(), now()
  ),
  (
    'c4000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'manager-a@example.test', '{}', '{}', now(), now()
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    'c4100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c4000000-0000-0000-0000-000000000001',
    'Staff A', 'staff-a@example.test', 'admin', now()
  ),
  (
    'c4100000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'c4000000-0000-0000-0000-000000000002',
    'Staff B', 'staff-b@example.test', 'admin', now()
  );

insert into public.corporate_managers (
  id, retailer_id, account_id, contact_name, login_email, user_id
) values
  (
    'c4200000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'Manager A', 'manager-a@example.test',
    'c4000000-0000-0000-0000-000000000003'
  );

-- Test (a): Staff A cannot place order for Wearer B (different retailer)
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000001",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1000000-0000-0000-0000-000000000001",
    "retailer_role": "admin"
  }
}';

select throws_ok(
  $$
    select public.place_corporate_order(
      'c1000000-0000-0000-0000-000000000001',
      'c3200000-0000-0000-0000-000000000002',
      '[{"productVariantId":"c2100000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'in_store'::public.order_channel,
      'GBP'
    )
  $$,
  'P0001',
  null,
  'retailer staff of A cannot place order for wearer of retailer B'
);

-- Test (a cont): Staff A can place order for Wearer A (same retailer)
select lives_ok(
  $$
    select public.place_corporate_order(
      'c1000000-0000-0000-0000-000000000001',
      'c3200000-0000-0000-0000-000000000001',
      '[{"productVariantId":"c2100000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'in_store'::public.order_channel,
      'GBP'
    )
  $$,
  'retailer staff of A can place order for wearer of retailer A'
);

reset request.jwt.claims;
set local role none;

-- Test (a cont 2): an authenticated non-staff caller (a corporate manager, no retailer-staff
-- claim at all) cannot call place_corporate_order for a wearer in their own account. This is
-- the exact caller population the NULL-vs-FALSE authorization bug silently let through.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.place_corporate_order(
      'c1000000-0000-0000-0000-000000000001',
      'c3200000-0000-0000-0000-000000000001',
      '[{"productVariantId":"c2100000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'in_store'::public.order_channel,
      'GBP'
    )
  $$,
  'P0001',
  null,
  'a non-staff authenticated caller (corporate manager) cannot place a corporate order'
);

reset request.jwt.claims;
set local role none;

-- Retrieve the order just created to test (c) and manager visibility
with v_order_data as (
  select id
    from public.orders
    where corporate_wearer_id = 'c3200000-0000-0000-0000-000000000001'
    order by created_at desc
    limit 1
)
select id::text as v_order_id from v_order_data \gset

-- Test (c): customer_id IS NULL AND corporate_wearer_id IS NOT NULL
select is(
  (select customer_id from public.orders where id = :'v_order_id'::uuid),
  null,
  'customer_id is null for corporate order'
);

select is(
  (select corporate_wearer_id from public.orders where id = :'v_order_id'::uuid),
  'c3200000-0000-0000-0000-000000000001'::uuid,
  'corporate_wearer_id is set to the wearer'
);

-- Test (b): Manager A can see order for their own account's wearer
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (
    select count(*)::int
    from public.orders
    where id = :'v_order_id'::uuid
  ),
  1,
  'manager A can SELECT the order for wearer in their account'
);

reset request.jwt.claims;
set local role none;

-- Test (b cont): Manager A cannot see order for wearer of a different account
-- (Create another order for Wearer B as retailer B's own staff — a genuine authorized
-- caller for retailer B — then test manager A cannot see it)
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1000000-0000-0000-0000-000000000002",
    "retailer_role": "admin"
  }
}';

with v_order_b_data as (
  select public.place_corporate_order(
    'c1000000-0000-0000-0000-000000000002',
    'c3200000-0000-0000-0000-000000000002',
    '[{"productVariantId":"c2100000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
    'in_store'::public.order_channel,
    'GBP'
  ) as id
)
select id::text as v_order_b_id from v_order_b_data \gset

reset request.jwt.claims;
set local role none;

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select is(
  (
    select count(*)::int
    from public.orders
    where id = :'v_order_b_id'::uuid
  ),
  0,
  'manager A cannot SELECT order for wearer in a different account'
);

reset request.jwt.claims;
set local role none;

-- Test (d): CHECK constraint rejects both null
-- Run as service_role to bypass RLS and hit the CHECK constraint directly
set local role service_role;

select throws_ok(
  $$
    insert into public.orders (
      retailer_id, order_number, status, channel,
      currency, subtotal_amount_minor_units, total_amount_minor_units
    ) values (
      'c1000000-0000-0000-0000-000000000001',
      'BAD-ORDER-001', 'pending_payment', 'online',
      'GBP', 0, 0
    )
  $$,
  '23514',
  null,
  'CHECK constraint rejects order with both customer_id and corporate_wearer_id null'
);

-- Test (e): with loyalty enabled for retailer A, advancing a corporate
-- (customer_id NULL) order's status must not raise. The personal-loyalty
-- status triggers unconditionally insert `orders.customer_id` into
-- `loyalty_accounts.customer_id` (NOT NULL); 20260829000001 makes them skip
-- customer-less orders. Runs as service_role: RLS is not what is under test.
insert into public.loyalty_programs (retailer_id, enabled)
values ('c1000000-0000-0000-0000-000000000001', true);

with corp_order as (
  insert into public.orders (
    retailer_id, corporate_wearer_id, order_number, status, channel,
    currency, subtotal_amount_minor_units, total_amount_minor_units
  ) values (
    'c1000000-0000-0000-0000-000000000001',
    'c3200000-0000-0000-0000-000000000001',
    'CORP-LOYALTY-E-1', 'pending_payment', 'in_store',
    'GBP', 5000, 5000
  )
  returning id
)
select id::text as v_corp_order_id from corp_order \gset

select lives_ok(
  $$
    update public.orders
      set status = 'in_production'
      where id = '$$ || :'v_corp_order_id' || $$'::uuid
  $$,
  'advancing a customer-less corporate order does not trip the personal-loyalty triggers'
);

reset role;

select * from finish();
rollback;
