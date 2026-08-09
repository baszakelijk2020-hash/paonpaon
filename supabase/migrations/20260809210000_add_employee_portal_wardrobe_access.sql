-- Employee Portal — linked-customer wardrobe access (PHASE 18.5 / BD-105).
--
-- Continues 20260809200000's pattern (appointments/orders/alterations/
-- measurements) for the wardrobe owner-boundary item named but not yet
-- built. Same additive, never-replacing SELECT policy keyed off the
-- wearer's own `corporate_wearers` row, for the same reason: a wearer's
-- Employee Portal login and their linked customer's login can legitimately
-- be two different auth users for the same real person.

create policy "a linked wearer can read their own customer's wardrobe items"
  on public.wardrobe_items for select to authenticated
  using (
    exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = wardrobe_items.customer_id
        and cw.user_id = (select auth.uid())
        and cw.deleted_at is null
    )
  );
