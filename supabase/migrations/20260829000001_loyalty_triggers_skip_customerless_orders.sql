-- PHASE 14.1 companion to 20260829000000_add_corporate_order_wiring.sql.
--
-- That migration drops `orders.customer_id NOT NULL` and `place_corporate_order`
-- inserts corporate orders with `customer_id = NULL` (the counterparty is the
-- employer, not an individual loyalty member). Two existing status-change
-- triggers on `public.orders` unconditionally
--   insert into public.loyalty_accounts (retailer_id, customer_id)
--   values (..., <order>.customer_id)
-- and `public.loyalty_accounts.customer_id` is `NOT NULL`. Without this guard,
-- at any retailer with an enabled `loyalty_programs` row, the first status
-- transition on a corporate order raises a not-null violation from inside a
-- SECURITY DEFINER trigger and the order can never be advanced.
--
-- A customer-less order has no personal loyalty account by definition, so the
-- correct behaviour is simply not to run the personal-loyalty triggers for it.
-- Adding a `WHEN (new.customer_id IS NOT NULL)` clause keeps the trigger bodies
-- untouched and is a no-op for every existing (customer-backed) order.

drop trigger if exists sync_loyalty_milestones_after_order_status on public.orders;
create trigger sync_loyalty_milestones_after_order_status
  after update of status on public.orders
  for each row
  when (new.customer_id is not null)
  execute function public.sync_loyalty_milestones_after_order_status();

drop trigger if exists accrue_loyalty_after_delivery on public.orders;
create trigger accrue_loyalty_after_delivery
  after update of status on public.orders
  for each row
  when (new.customer_id is not null)
  execute function public.accrue_loyalty_on_delivered_order();

-- Follow-up from the 14.1 security review: 20260829000000 pinned
-- `place_corporate_order`'s search_path to `public` only; the codebase
-- convention for SECURITY DEFINER functions (current_corporate_manager_id,
-- check_corporate_manager_account_tenant, …) also appends `pg_temp` so a
-- caller cannot shadow a built-in via a temp schema. Align it.
alter function public.place_corporate_order(uuid, uuid, jsonb, public.order_channel, text)
  set search_path = public, pg_temp;
