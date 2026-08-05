-- Representative populated state immediately before migration 18 turns the
-- catalogue quantity into a ledger projection. This file is local-test data
-- only; every UUID is synthetic and belongs to the disposable stack.

insert into public.retailers
  (id, legal_name, display_name, slug, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Upgrade House A Ltd', 'Upgrade House A', 'upgrade-house-a', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Upgrade House B Ltd', 'Upgrade House B', 'upgrade-house-b', 'active');

insert into public.products (id, retailer_id, name, slug, status)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'House A Jacket', 'house-a-jacket', 'active'),
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'House A Trouser', 'house-a-trouser', 'active'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'House B Coat', 'house-b-coat', 'active');

insert into public.product_variants
  (id, product_id, sku, price_amount_minor_units, price_currency, inventory_quantity)
values
  ('11100000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'UP-A-JACKET', 125000, 'EUR', 7),
  ('12100000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'UP-A-TROUSER', 45000, 'EUR', 2),
  ('21100000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'UP-B-COAT', 155000, 'EUR', 3);

-- One variant already has matching ledger history. Migration 18 must leave
-- that history intact rather than inventing an opening receipt beside it.
insert into public.stock_locations
  (id, retailer_id, code, name, active)
values
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'FLOOR', 'Shop floor', true);

insert into public.stock_ledger_entries
  (id, retailer_id, location_id, variant_id, kind, quantity, reason)
values
  ('13100000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', '12100000-0000-0000-0000-000000000001', 'receipt', 2, 'Existing ledger balance before single-truth upgrade.');
