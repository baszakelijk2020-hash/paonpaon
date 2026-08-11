-- PHASE 12.1 follow-up: the guided self-measurement capture surface is
-- customer-initiated by definition ("private guided capture" in the item's
-- own owner boundary), but 20260801000007_add_measurement_monitor_gate.sql
-- only granted INSERT on customer_measurement_candidates to staff roles
-- (customer_measurement_candidates_staff_insert). A customer submitting
-- their own guided capture had no policy permitting the write at all.
--
-- Mirrors customer_measurement_candidates_own_select's customer_account_links
-- join, plus an explicit retailer_id cross-check so a customer cannot tag a
-- self-insert candidate row to a retailer_id other than the one their own
-- customer record actually belongs to.
create policy customer_measurement_candidates_customer_insert
  on public.customer_measurement_candidates for insert to authenticated
  with check (
    exists (
      select 1 from public.customer_account_links link
      where link.customer_id = customer_measurement_candidates.customer_id
        and link.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.customers c
      where c.id = customer_measurement_candidates.customer_id
        and c.retailer_id = customer_measurement_candidates.retailer_id
    )
  );
