-- Fix: customer-authored outfits (VWS-001 / PHASE 4.6, migration
-- 20260806100000) added a "customers insert own outfits" policy on
-- `outfits`, but never a matching one on `outfit_slots` — the only
-- existing insert policy there requires `current_retailer_role()`, which
-- is null for a customer session, so `OutfitRepository.createByCustomer`'s
-- second insert (the slot rows) silently failed RLS. Found by real
-- browser e2e proof (apps/customer/e2e/virtual-studio.spec.ts), not
-- inspection — exactly the class of gap that only shows up live.

create policy "customers insert own outfit slots"
  on public.outfit_slots for insert to authenticated
  with check (
    exists (
      select 1 from public.outfits o
      join public.customers c on c.id = o.created_by_customer_id
      where o.id = outfit_slots.outfit_id
        and o.deleted_at is null
        and o.retailer_id = outfit_slots.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );
