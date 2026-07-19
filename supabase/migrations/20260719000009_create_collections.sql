-- See docs/DOMAIN_MODEL.md "Catalog". Collections group products
-- (e.g. a season); a product may belong to several.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null,
  slug text not null,
  season text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, slug)
);

create index collections_retailer_id_idx on public.collections (retailer_id);

create trigger set_collections_updated_at
  before update on public.collections
  for each row
  execute function public.set_updated_at();

alter table public.collections enable row level security;

create policy "platform staff can read all collections"
  on public.collections for select
  using (public.is_platform_staff());

create policy "platform staff can manage all collections"
  on public.collections for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's collections"
  on public.collections for select
  using (retailer_id = public.current_retailer_id());

-- Catalog authoring is a managerial task, distinct from the
-- sales_associate+ CRM write gate on `customers` — see
-- docs/PROJECT_STATE.md.
create policy "managers and above can manage their retailer's collections"
  on public.collections for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

comment on table public.collections is
  'Groups products for a retailer (e.g. a season). See docs/DOMAIN_MODEL.md "Catalog".';
