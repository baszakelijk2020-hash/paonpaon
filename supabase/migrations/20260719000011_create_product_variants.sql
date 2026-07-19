-- See docs/DOMAIN_MODEL.md "Catalog" and product.ts "ProductVariant" —
-- price, SKU, size and stock live here, not on the parent product.
-- Money is never a float (shared/money.ts) — stored as an integer
-- minor-unit amount + currency code, split across two columns each for
-- price and compareAtPrice, matching the `Money` value object shape.

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null,
  size text,
  color text,
  price_amount_minor_units integer not null check (price_amount_minor_units >= 0),
  price_currency text not null,
  compare_at_price_amount_minor_units integer check (compare_at_price_amount_minor_units >= 0),
  compare_at_price_currency text,
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  lead_time_days integer check (lead_time_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (product_id, sku)
);

create index product_variants_product_id_idx on public.product_variants (product_id);

create trigger set_product_variants_updated_at
  before update on public.product_variants
  for each row
  execute function public.set_updated_at();

alter table public.product_variants enable row level security;

-- Scoped through products, same reasoning as product_collections in
-- the previous migration — ProductVariant carries no retailerId in
-- @paon/domain, only productId.
create policy "platform staff can manage all product variants"
  on public.product_variants for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's product variants"
  on public.product_variants for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.retailer_id = public.current_retailer_id()
    )
  );

create policy "managers and above can manage their retailer's product variants"
  on public.product_variants for all
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  );

comment on table public.product_variants is
  'Price, SKU, size and stock for one sellable variant of a product. See docs/DOMAIN_MODEL.md "Catalog".';
