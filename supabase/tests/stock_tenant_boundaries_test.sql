begin;
select plan(11);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    '91000000-0000-0000-0000-000000000001',
    'Stock Boundary A Ltd',
    'Stock Boundary A',
    'stock-boundary-a',
    'active'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'Stock Boundary B Ltd',
    'Stock Boundary B',
    'stock-boundary-b',
    'active'
  );

insert into public.products (
  id, retailer_id, name, slug, status
) values
  (
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'Boundary A jacket',
    'boundary-a-jacket',
    'active'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'Boundary B jacket',
    'boundary-b-jacket',
    'active'
  );

insert into public.product_variants (
  id, product_id, sku, price_amount_minor_units, price_currency
) values
  (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    'BOUNDARY-A',
    10000,
    'EUR'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    'BOUNDARY-B',
    10000,
    'EUR'
  );

insert into public.stock_locations (
  id, retailer_id, code, name
) values
  (
    '94000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'BOUNDARY-A',
    'Boundary A location'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'BOUNDARY-B',
    'Boundary B location'
  );

select lives_ok(
  $$
    insert into public.stock_ledger_entries (
      retailer_id, location_id, variant_id, kind, quantity
    ) values (
      '91000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000001',
      'receipt',
      1
    )
  $$,
  'same-retailer stock movement is accepted'
);

select throws_ok(
  $$
    insert into public.stock_ledger_entries (
      retailer_id, location_id, variant_id, kind, quantity
    ) values (
      '91000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000002',
      '93000000-0000-0000-0000-000000000001',
      'receipt',
      1
    )
  $$,
  '23503',
  null,
  'a ledger row cannot cite another retailer location'
);

select throws_ok(
  $$
    insert into public.stock_ledger_entries (
      retailer_id, location_id, variant_id, kind, quantity
    ) values (
      '91000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      '93000000-0000-0000-0000-000000000002',
      'receipt',
      1
    )
  $$,
  '23503',
  'variant_id must belong to the row retailer_id',
  'a ledger row cannot cite another retailer variant'
);

select throws_ok(
  $$
    insert into public.pos_transactions (
      retailer_id, location_id
    ) values (
      '91000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000002'
    )
  $$,
  '23503',
  null,
  'a POS transaction cannot cite another retailer location'
);

set local role anon;

select throws_ok(
  $$
    select public.retailer_online_location(
      '91000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot create an arbitrary retailer location'
);

select throws_ok(
  $$ select public.count_inventory_disagreements() $$,
  '42501',
  null,
  'anonymous callers cannot inspect cross-tenant inventory drift'
);

select throws_ok(
  $$
    select public.record_pos_payment_atomic(
      '91000000-0000-0000-0000-000000000001',
      '95000000-0000-0000-0000-000000000001',
      'cash',
      'cash:boundary',
      100,
      'EUR'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot invoke the atomic payment operation'
);

reset role;

select ok(
  not has_table_privilege(
    'authenticated', 'public.pos_payments', 'INSERT'
  ),
  'authenticated callers cannot insert payments outside the atomic RPC'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.pos_transaction_lines', 'INSERT'
  ),
  'authenticated callers cannot insert POS lines outside the atomic RPC'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.pos_transaction_lines', 'UPDATE'
  ),
  'authenticated callers cannot update POS lines outside the atomic RPC'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and p.prosecdef
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no public SECURITY DEFINER function is executable by PUBLIC'
);

select * from finish();
rollback;
