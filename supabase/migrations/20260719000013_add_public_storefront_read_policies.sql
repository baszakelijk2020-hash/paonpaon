-- Storefront browsing (Customer Portal /r/[slug]/...) is public — a
-- shopper is never required to sign in until checkout — so these are
-- the first policies in the schema with no `to` clause restricting the
-- role: they apply to `anon` as well as `authenticated`, scoped to only
-- the "publicly showable" subset of each table (active retailer,
-- active product). See docs/DECISIONS.md ADR-014.

create policy "anyone can read active retailers"
  on public.retailers for select
  using (status = 'active');

create policy "anyone can read active products from active retailers"
  on public.products for select
  using (
    status = 'active'
    and exists (
      select 1 from public.retailers r
      where r.id = products.retailer_id
        and r.status = 'active'
    )
  );

create policy "anyone can read variants of publicly visible products"
  on public.product_variants for select
  using (
    exists (
      select 1 from public.products p
      join public.retailers r on r.id = p.retailer_id
      where p.id = product_variants.product_id
        and p.status = 'active'
        and r.status = 'active'
    )
  );
