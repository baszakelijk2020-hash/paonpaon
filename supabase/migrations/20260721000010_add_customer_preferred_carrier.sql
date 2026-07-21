-- "Retailers can order shipping and/or pick up from their favorite
-- carriers... for a customer in the customer's address card" — a
-- retailer-staff-set preference, not a customer self-service one
-- (unlike CustomerPreferences, which only the customer themselves can
-- write). customers already has a staff-writable "for all" RLS policy
-- (sales_associate+, 20260719000007_*), so this is a plain column, no
-- new RPC needed.

alter table public.customers
  add column preferred_carrier text
  check (preferred_carrier is null or preferred_carrier in (
    'dhl', 'postnl', 'ups', 'fedex', 'local_courier', 'customer_pickup'
  ));
