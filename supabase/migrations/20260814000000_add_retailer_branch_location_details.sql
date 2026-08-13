-- FT-11 Location Finder: extend retailer_branches with the public-facing
-- location facts a retailer maintains (address, coordinates, hours,
-- contact, imagery, services, filter categories) and the retailer's own
-- presentation choice (2D map vs globe). Publishing is opt-in per branch —
-- unpublished branches must never be visible to a customer/anon reader.

alter table public.retailer_branches
  add column if not exists store_type text
    check (store_type is null or char_length(btrim(store_type)) between 1 and 80),
  add column if not exists address_line1 text
    check (address_line1 is null or char_length(btrim(address_line1)) between 1 and 200),
  add column if not exists address_line2 text
    check (address_line2 is null or char_length(btrim(address_line2)) between 1 and 200),
  add column if not exists city text
    check (city is null or char_length(btrim(city)) between 1 and 120),
  add column if not exists region text
    check (region is null or char_length(btrim(region)) between 1 and 120),
  add column if not exists postal_code text
    check (postal_code is null or char_length(btrim(postal_code)) between 1 and 32),
  add column if not exists country text
    check (country is null or char_length(btrim(country)) between 1 and 120),
  add column if not exists latitude numeric(9, 6)
    check (latitude is null or (latitude between -90 and 90)),
  add column if not exists longitude numeric(9, 6)
    check (longitude is null or (longitude between -180 and 180)),
  add column if not exists phone text
    check (phone is null or char_length(btrim(phone)) between 1 and 40),
  add column if not exists contact_email text
    check (contact_email is null or char_length(btrim(contact_email)) between 3 and 200),
  add column if not exists opening_hours jsonb not null default '[]'::jsonb
    check (jsonb_typeof(opening_hours) = 'array'),
  add column if not exists services text[] not null default '{}',
  add column if not exists contact_actions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(contact_actions) = 'array'),
  add column if not exists filter_categories text[] not null default '{}',
  add column if not exists imagery jsonb not null default '[]'::jsonb
    check (jsonb_typeof(imagery) = 'array'),
  add column if not exists presentation_mode text not null default 'map'
    check (presentation_mode in ('map', 'globe')),
  add column if not exists published boolean not null default false;

create index if not exists retailer_branches_published_idx
  on public.retailer_branches (retailer_id)
  where published and deleted_at is null;

-- Public/customer-facing read: only published, non-deleted branches of an
-- active retailer — matching ADR-014's "anyone can read active products
-- from active retailers" pattern used for micro_capsule_drops. RLS here
-- only gates row visibility, not column visibility; the finder's query
-- layer is expected to select only the public-safe columns it needs.
grant select on table public.retailer_branches to anon;

create policy "anyone can read published branches from active retailers"
  on public.retailer_branches for select
  to anon, authenticated
  using (
    published
    and deleted_at is null
    and exists (
      select 1 from public.retailers r
      where r.id = retailer_branches.retailer_id
        and r.status = 'active'
    )
  );

comment on column public.retailer_branches.published is
  'Opt-in publish flag (FT-11) — unpublished branches are never visible to the public/customer finder.';
comment on column public.retailer_branches.presentation_mode is
  'Retailer''s own choice of 2D map or globe presentation for the public location finder (FT-11). Applies per branch; a retailer publishing multiple branches is expected to keep this consistent across them.';
