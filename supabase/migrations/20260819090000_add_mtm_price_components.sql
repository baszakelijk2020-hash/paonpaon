-- MTM pricing engine (PHASE 17.7) — infrastructure only. One flexible,
-- retailer-editable component table serves five priceable dimensions
-- (fabric tier, make method, design option, garment scope, rush fee)
-- instead of five rigid enums, so a retailer can rename/reprice/add an
-- option without a migration. No real price content is seeded here —
-- that comes later — only the category system and the tables it needs.

create table public.mtm_price_components (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  category text not null check (
    category in ('fabric_tier', 'make_method', 'design_option', 'garment_scope', 'rush_fee')
  ),
  slug text not null check (slug ~ '^[a-z0-9_]+$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  price_impact_minor_units integer not null,
  currency text not null check (char_length(currency) = 3),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A slug is the stable reference a quote/order points at; it must stay
  -- unique per retailer within its own category (two categories may
  -- reuse the same slug, e.g. a fabric_tier "aa" and a design_option
  -- named differently never collide, but two fabric_tier rows named "aa"
  -- would make quote resolution ambiguous).
  unique (retailer_id, category, slug)
);

create trigger set_mtm_price_components_updated_at
  before update on public.mtm_price_components
  for each row execute function public.set_updated_at();

alter table public.mtm_price_components enable row level security;
revoke all on table public.mtm_price_components from public, anon;

-- Every retailer role can read the price list (a sales associate quoting
-- a customer needs it as much as an owner editing it).
create policy "retailer staff read their retailer's mtm price components"
  on public.mtm_price_components for select
  to authenticated
  using (retailer_id = public.current_retailer_id());

-- Only management roles can create/edit/retire a price component —
-- matches this codebase's established pattern (alteration price lists:
-- 20260719000103) of gating pricing writes above line-staff level.
create policy "retailer management writes their retailer's mtm price components"
  on public.mtm_price_components for insert
  to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  );

create policy "retailer management updates their retailer's mtm price components"
  on public.mtm_price_components for update
  to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  );

create policy "platform staff read all mtm price components"
  on public.mtm_price_components for select
  to authenticated
  using (public.is_platform_staff());

grant select, insert, update on table public.mtm_price_components to authenticated;

comment on table public.mtm_price_components is
  'PHASE 17.7 MTM pricing engine. One retailer-editable component per priceable dimension (fabric_tier, make_method, design_option, garment_scope, rush_fee) — no fixed enum of tier names/prices, so a retailer can rename or reprice without a migration. Real price content is deliberately not seeded by this migration.';
comment on column public.mtm_price_components.slug is
  'Stable identifier a quote references. Renaming display_name never changes this, so historical quotes keep resolving to the same component even after a rename.';
