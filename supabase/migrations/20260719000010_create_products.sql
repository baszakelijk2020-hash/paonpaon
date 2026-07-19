-- See docs/DOMAIN_MODEL.md "Catalog" and product.ts: a Product is the
-- sellable concept; it never carries a price itself (see
-- create_product_variants.sql, next migration). product_collections is
-- the many-to-many join backing Product.collectionIds.

create type public.product_status as enum ('draft', 'active', 'archived');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  status public.product_status not null default 'draft',
  is_made_to_order boolean not null default false,
  is_alterable boolean not null default false,
  primary_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, slug)
);

create index products_retailer_id_idx on public.products (retailer_id);

create trigger set_products_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "platform staff can read all products"
  on public.products for select
  using (public.is_platform_staff());

create policy "platform staff can manage all products"
  on public.products for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's products"
  on public.products for select
  using (retailer_id = public.current_retailer_id());

create policy "managers and above can manage their retailer's products"
  on public.products for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

comment on table public.products is
  'The sellable concept. Price/SKU/stock live on product_variants — see docs/DOMAIN_MODEL.md "Catalog".';

create table public.product_collections (
  product_id uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  primary key (product_id, collection_id)
);

alter table public.product_collections enable row level security;

-- Scoped through products, not a denormalized retailer_id — the join
-- table has no tenant column of its own, matching Product.collectionIds
-- having no retailerId in @paon/domain (only Product itself is
-- tenant-scoped there).
create policy "platform staff can manage all product collections"
  on public.product_collections for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's product collections"
  on public.product_collections for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_collections.product_id
        and p.retailer_id = public.current_retailer_id()
    )
  );

create policy "managers and above can manage their retailer's product collections"
  on public.product_collections for all
  using (
    exists (
      select 1 from public.products p
      where p.id = product_collections.product_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_collections.product_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  );

comment on table public.product_collections is
  'Many-to-many join backing Product.collectionIds — see docs/DOMAIN_MODEL.md "Catalog".';
