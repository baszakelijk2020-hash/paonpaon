-- See docs/DOMAIN_MODEL.md "Customer" and "Why a Customer is scoped to
-- one Retailer". A Customer is a per-retailer CRM record, created by
-- retailer staff (Retailer Portal "Customers" — this migration) and
-- optionally linked, later, to a Customer Portal login by email — see
-- 20260719000008_create_customer_account_links.sql.

create type public.customer_lifecycle_stage as enum (
  'prospect',
  'first_purchase',
  'returning',
  'vip',
  'lapsed'
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  lifecycle_stage public.customer_lifecycle_stage not null default 'prospect',
  assigned_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  shipping_addresses jsonb not null default '[]'::jsonb,
  acquisition_source text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index customers_retailer_id_idx on public.customers (retailer_id);
create index customers_user_id_idx on public.customers (user_id) where user_id is not null;
-- Case-insensitive email lookup, scoped per retailer — matches how a
-- retailer's own staff would search for a client, and is what
-- link_my_customer_accounts (next migration) matches against.
create index customers_retailer_email_idx
  on public.customers (retailer_id, lower(email))
  where email is not null and deleted_at is null;

create trigger set_customers_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "platform staff can read all customers"
  on public.customers for select
  using (public.is_platform_staff());

create policy "platform staff can manage all customers"
  on public.customers for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- Matches the worked example in docs/DATABASE.md "Row Level Security"
-- verbatim: every retailer staff role, including read_only, can read
-- their retailer's customers.
create policy "retailer staff can read their retailer's customers"
  on public.customers for select
  using (retailer_id = public.current_retailer_id());

-- CRM data entry is a frontline task, not admin-only — sales_associate
-- and above (production_staff and read_only are excluded; see
-- @paon/domain RETAILER_ROLE_HIERARCHY for the ordering this mirrors).
create policy "sales staff and above can manage their retailer's customers"
  on public.customers for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

-- A Customer Portal user reading their own linked record(s) — direct
-- auth.uid() comparison, not a JWT claim, because one Customer Portal
-- login may link to many Customer rows (one per retailer relationship,
-- see docs/DOMAIN_MODEL.md), unlike retailer/platform staff who belong
-- to exactly one tenant per session.
create policy "a customer can read their own linked record"
  on public.customers for select
  using (user_id = auth.uid());

comment on table public.customers is
  'Per-retailer CRM record. user_id is set once (and never by the client directly — see link_my_customer_accounts) the same email signs into Customer Portal.';
