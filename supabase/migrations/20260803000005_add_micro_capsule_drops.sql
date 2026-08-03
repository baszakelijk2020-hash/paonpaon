-- Weekly micro-capsule drops: a small, staff-curated, ordered set of
-- products shown to customers as "this week's capsule". Deliberately its
-- own table rather than overloading `collections` (a static, general
-- catalogue grouping with no rotation/freshness concept) with week-scoped
-- fields it has no other use for.

create table public.micro_capsule_drops (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  theme text check (theme is null or char_length(btrim(theme)) <= 300),
  week_start date not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint micro_capsule_drops_retailer_week_unique
    unique (retailer_id, week_start)
);

create index micro_capsule_drops_retailer_published_idx
  on public.micro_capsule_drops (retailer_id, published, week_start desc)
  where deleted_at is null;

create trigger set_micro_capsule_drops_updated_at
  before update on public.micro_capsule_drops
  for each row execute function public.set_updated_at();

create table public.micro_capsule_drop_products (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.micro_capsule_drops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  rank integer not null check (rank >= 1),
  created_at timestamptz not null default now(),
  constraint micro_capsule_drop_products_drop_product_unique
    unique (drop_id, product_id),
  constraint micro_capsule_drop_products_drop_rank_unique
    unique (drop_id, rank)
);

create index micro_capsule_drop_products_drop_id_idx
  on public.micro_capsule_drop_products (drop_id);

alter table public.micro_capsule_drops enable row level security;
alter table public.micro_capsule_drop_products enable row level security;

revoke all on table public.micro_capsule_drops from public, anon;
revoke all on table public.micro_capsule_drop_products from public, anon;
grant select on table public.micro_capsule_drops to authenticated, anon, service_role;
grant insert, update, delete on table public.micro_capsule_drops to authenticated, service_role;
grant select on table public.micro_capsule_drop_products to authenticated, anon, service_role;
grant insert, delete on table public.micro_capsule_drop_products to authenticated, service_role;

create policy "retailer staff can read their retailer's capsule drops"
  on public.micro_capsule_drops for select
  to authenticated
  using (retailer_id = public.current_retailer_id());

create policy "managers and above can manage their retailer's capsule drops"
  on public.micro_capsule_drops for all
  to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

-- Public storefront read, matching ADR-014's "anyone can read active
-- products from active retailers": a published capsule from an active
-- retailer is showable with no sign-in required.
create policy "anyone can read published capsule drops from active retailers"
  on public.micro_capsule_drops for select
  to anon, authenticated
  using (
    published = true
    and deleted_at is null
    and exists (
      select 1 from public.retailers r
      where r.id = micro_capsule_drops.retailer_id
        and r.status = 'active'
    )
  );

create policy "retailer staff can read their retailer's capsule drop products"
  on public.micro_capsule_drop_products for select
  to authenticated
  using (
    exists (
      select 1 from public.micro_capsule_drops d
      where d.id = micro_capsule_drop_products.drop_id
        and d.retailer_id = public.current_retailer_id()
    )
  );

create policy "managers and above can manage their retailer's capsule drop products"
  on public.micro_capsule_drop_products for all
  to authenticated
  using (
    exists (
      select 1 from public.micro_capsule_drops d
      where d.id = micro_capsule_drop_products.drop_id
        and d.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.micro_capsule_drops d
      where d.id = micro_capsule_drop_products.drop_id
        and d.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
    )
  );

create policy "anyone can read products of published capsule drops"
  on public.micro_capsule_drop_products for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.micro_capsule_drops d
      join public.retailers r on r.id = d.retailer_id
      where d.id = micro_capsule_drop_products.drop_id
        and d.published = true
        and d.deleted_at is null
        and r.status = 'active'
    )
  );

comment on table public.micro_capsule_drops is
  'A staff-curated weekly capsule of products, published when ready. See docs/DOMAIN_MODEL.md "Catalog".';
comment on table public.micro_capsule_drop_products is
  'Ordered product membership of a micro_capsule_drops row, rank is display order.';
