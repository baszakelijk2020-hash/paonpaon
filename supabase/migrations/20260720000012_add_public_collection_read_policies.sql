-- Storefront collection browsing (docs/PROJECT_STATE.md's "assigning a
-- product to a collection from the storefront" gap, closed by this
-- slice). Same "anyone can read the publicly showable subset" shape as
-- 20260719000013_add_public_storefront_read_policies.sql (ADR-014) —
-- extended here to collections and the product_collections join table,
-- neither of which had a public policy yet because nothing on the
-- storefront read them before now.

create policy "anyone can read collections of active retailers"
  on public.collections for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.retailers r
      where r.id = collections.retailer_id
        and r.status = 'active'
    )
  );

create policy "anyone can read product collection links for public products"
  on public.product_collections for select
  using (
    exists (
      select 1 from public.products p
      join public.retailers r on r.id = p.retailer_id
      where p.id = product_collections.product_id
        and p.status = 'active'
        and r.status = 'active'
    )
  );
