-- PHASE 2.4 / SRCH-001: indexed catalogue query support plus anonymous
-- storefront reads for active concepts and fabric weight facts needed by
-- founder filter enrichment. Writes remain staff-only; pending/rejected
-- assignments stay invisible via the existing accepted-assignment policy.

-- Variant price range scans for active catalogue products.
create index if not exists product_variants_price_minor_idx
  on public.product_variants (price_amount_minor_units)
  where deleted_at is null;

-- Covering index for retailer-scoped price filters via product join.
create index if not exists products_retailer_status_created_idx
  on public.products (retailer_id, status, created_at desc)
  where deleted_at is null;

-- Exact fabric weight range scans for active profiles.
create index if not exists product_fabric_profiles_weight_idx
  on public.product_fabric_profiles (
    retailer_id,
    fabric_weight_grams_per_square_metre
  )
  where deleted_at is null
    and fabric_weight_grams_per_square_metre is not null;

grant select on table public.metadata_concepts to anon;
grant select on table public.product_fabric_profiles to anon;

create policy "anyone can read active storefront metadata concepts"
  on public.metadata_concepts for select
  using (
    active = true
    and deleted_at is null
    and (
      retailer_id is null
      or exists (
        select 1
        from public.retailers as retailer
        where retailer.id = metadata_concepts.retailer_id
          and retailer.status = 'active'
      )
    )
  );

create policy "anyone can read fabric profiles for active catalogue"
  on public.product_fabric_profiles for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.products as product
      join public.retailers as retailer
        on retailer.id = product.retailer_id
      where product.id = product_fabric_profiles.product_id
        and product.retailer_id = product_fabric_profiles.retailer_id
        and product.status = 'active'
        and product.deleted_at is null
        and retailer.status = 'active'
    )
  );

comment on index public.product_variants_price_minor_idx is
  'SRCH-001: support catalogue price-range filters';
comment on index public.products_retailer_status_created_idx is
  'SRCH-001: retailer active catalogue newest sort / pagination';
comment on index public.product_fabric_profiles_weight_idx is
  'SRCH-001: support fabric weight-range filters';
