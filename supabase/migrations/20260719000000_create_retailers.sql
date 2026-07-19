-- Tenant root. See docs/DOMAIN_MODEL.md "Retailer" and docs/DATABASE.md
-- "Row Level Security" for the conventions this migration establishes
-- and every future tenant-scoped table must follow.

create extension if not exists "pgcrypto";

-- Reusable trigger function: every table with `updated_at` attaches this.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.retailer_status as enum (
  'pending_onboarding',
  'active',
  'suspended',
  'churned'
);

create type public.retailer_tier as enum (
  'boutique',
  'house',
  'maison'
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  slug text not null unique,
  status public.retailer_status not null default 'pending_onboarding',
  tier public.retailer_tier not null default 'boutique',
  primary_domain text,
  billing_address jsonb not null default '{}'::jsonb,
  default_currency text not null default 'USD',
  default_locale text not null default 'en-US',
  brand_theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_retailers_updated_at
  before update on public.retailers
  for each row
  execute function public.set_updated_at();

alter table public.retailers enable row level security;

-- Platform staff (PAON Admin) operate across every tenant. The
-- `platform_role` claim is set in auth JWT app_metadata when a
-- PlatformStaffMember is created — see docs/DATABASE.md.
create policy "platform staff can read all retailers"
  on public.retailers for select
  using ((auth.jwt() -> 'app_metadata' ->> 'platform_role') is not null);

create policy "platform staff can manage all retailers"
  on public.retailers for all
  using ((auth.jwt() -> 'app_metadata' ->> 'platform_role') is not null)
  with check ((auth.jwt() -> 'app_metadata' ->> 'platform_role') is not null);

-- Retailer staff can read their own retailer's record.
create policy "retailer staff can read their own retailer"
  on public.retailers for select
  using (
    id = ((auth.jwt() -> 'app_metadata' ->> 'retailer_id')::uuid)
  );

comment on table public.retailers is
  'Tenant root. Every tenant-scoped table carries retailer_id and a matching RLS policy shaped like the ones on this table.';
