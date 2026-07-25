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
-- Reusable JWT claim readers for RLS policies. Every table's policy from
-- this point forward reads the caller's identity through these
-- functions rather than inlining `auth.jwt() -> ...` — one place to
-- fix if the claim shape ever changes. See docs/DATABASE.md
-- "Row Level Security".

create or replace function public.current_platform_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'platform_role', '')
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
as $$
  select public.current_platform_role() is not null
$$;

create or replace function public.current_retailer_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'retailer_id', '')::uuid
$$;

create or replace function public.current_retailer_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'retailer_role', '')
$$;
-- PAON's own staff (PAON Admin). See docs/DOMAIN_MODEL.md "Identity".

create type public.platform_role as enum (
  'platform_owner',
  'platform_admin',
  'support_agent',
  'platform_analyst'
);

create table public.platform_staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_platform_staff_members_updated_at
  before update on public.platform_staff_members
  for each row
  execute function public.set_updated_at();

-- Mirrors role (or its removal) onto the auth.users JWT app_metadata
-- claim that every RLS policy in the platform reads via
-- current_platform_role(). security definer because auth.users is not
-- writable by the anon/authenticated roles that fire this trigger.
create or replace function public.sync_platform_role_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.deleted_at is not null then
    update auth.users
      set raw_app_meta_data = raw_app_meta_data - 'platform_role'
      where id = coalesce(new.user_id, old.user_id);
    return coalesce(new, old);
  end if;

  update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('platform_role', new.role)
    where id = new.user_id;

  return new;
end;
$$;

create trigger sync_platform_role_claim_on_write
  after insert or update or delete on public.platform_staff_members
  for each row
  execute function public.sync_platform_role_claim();

alter table public.platform_staff_members enable row level security;

create policy "platform staff can read platform staff"
  on public.platform_staff_members for select
  using (public.is_platform_staff());

create policy "platform owners and admins can manage platform staff"
  on public.platform_staff_members for all
  using (public.current_platform_role() in ('platform_owner', 'platform_admin'))
  with check (public.current_platform_role() in ('platform_owner', 'platform_admin'));

comment on table public.platform_staff_members is
  'PAON Admin users. role is mirrored to auth.users.app_metadata.platform_role by trigger for RLS/session use.';
-- A retailer's own staff (Retailer Portal). See docs/DOMAIN_MODEL.md
-- "Identity" and docs/PRODUCT.md "Order vs. Production" for why this
-- is a separate table from platform_staff_members: a person's platform
-- access and their retailer access are never the same identity role.

create type public.retailer_role as enum (
  'read_only',
  'production_staff',
  'sales_associate',
  'manager',
  'admin',
  'owner'
);

create table public.retailer_staff_members (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  role public.retailer_role not null default 'read_only',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, email)
);

create trigger set_retailer_staff_members_updated_at
  before update on public.retailer_staff_members
  for each row
  execute function public.set_updated_at();

-- Mirrors retailer_id/role onto the invited auth.users row's
-- app_metadata claims, the same pattern as sync_platform_role_claim.
-- Fires again when the invite is accepted (user_id transitions from
-- null to set) and whenever role changes for an already-linked staff
-- member.
create or replace function public.sync_retailer_staff_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.deleted_at is not null or new.user_id is null then
    if old.user_id is not null then
      update auth.users
        set raw_app_meta_data = (raw_app_meta_data - 'retailer_id') - 'retailer_role'
        where id = old.user_id;
    end if;
    return coalesce(new, old);
  end if;

  update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('retailer_id', new.retailer_id, 'retailer_role', new.role)
    where id = new.user_id;

  return new;
end;
$$;

create trigger sync_retailer_staff_claim_on_write
  after insert or update or delete on public.retailer_staff_members
  for each row
  execute function public.sync_retailer_staff_claim();

alter table public.retailer_staff_members enable row level security;

create policy "platform staff can read all retailer staff"
  on public.retailer_staff_members for select
  using (public.is_platform_staff());

create policy "platform staff can manage all retailer staff"
  on public.retailer_staff_members for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their own retailer's staff"
  on public.retailer_staff_members for select
  using (retailer_id = public.current_retailer_id());

create policy "a user can read their own staff record"
  on public.retailer_staff_members for select
  using (user_id = auth.uid());

create policy "retailer owners and admins can manage their retailer's staff"
  on public.retailer_staff_members for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

comment on table public.retailer_staff_members is
  'A retailer''s staff. role is mirrored to auth.users.app_metadata (retailer_id, retailer_role) once user_id is linked.';
-- The retailer-side half of onboarding (docs/PRODUCT.md "PAON Admin"
-- creates the tenant and invites the owner; docs/DECISIONS.md ADR-009
-- covers why the auth user is provisioned before the staff row). This
-- function runs once, right after an invited retailer staff member
-- sets their password, for any role — not just the owner — because
-- the same accept-invite step is reused by in-portal staff invites
-- (RetailerStaffRepository.create called from the Retailer Portal
-- itself, not just PAON Admin). A narrow security definer function,
-- not a broadened RLS policy on `retailer_staff_members`/`retailers`,
-- because "a staff member may accept their own invite, once" is a much
-- smaller grant of trust than "a staff member may update their own
-- staff row" or "a retailer owner may update their own retailer row"
-- — see docs/DECISIONS.md ADR-012.

create or replace function public.accept_retailer_staff_invite(
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.retailer_staff_members;
begin
  select * into v_staff
  from public.retailer_staff_members
  where id = p_staff_id
    and deleted_at is null;

  if not found then
    raise exception 'Staff record % not found', p_staff_id;
  end if;

  if v_staff.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to accept invite for staff record %', p_staff_id;
  end if;

  update public.retailer_staff_members
    set accepted_at = coalesce(accepted_at, now())
    where id = p_staff_id;

  -- Only the first accepted owner activates a still-pending tenant —
  -- a later staff member accepting an invite never regresses or
  -- re-triggers this transition.
  if v_staff.role = 'owner' then
    update public.retailers
      set status = 'active'
      where id = v_staff.retailer_id
        and status = 'pending_onboarding';
  end if;
end;
$$;

revoke all on function public.accept_retailer_staff_invite(uuid) from public;
grant execute on function public.accept_retailer_staff_invite(uuid) to authenticated;

comment on function public.accept_retailer_staff_invite(uuid) is
  'Called once by an invited retailer staff member right after they set their password. Marks their staff record accepted; if they are the retailer owner and the retailer is still pending onboarding, activates the retailer.';
-- Lets a retailer's own owner/admin edit their tenant's business
-- profile from Retailer Portal settings (docs/PRODUCT.md "Retailer
-- Portal" > Settings), without granting them write access to the
-- platform-controlled columns (`status`, `tier`, `slug`,
-- `default_currency`) that PAON Admin and internal flows (e.g.
-- `accept_retailer_staff_invite`) own. RLS alone can't express
-- "this column may not change" — WITH CHECK only sees the candidate
-- new row, not the old one — so a BEFORE UPDATE trigger enforces it,
-- the same reasoning as the claim-sync triggers in
-- create_platform_staff_members / create_retailer_staff_members.

create policy "retailer owners and admins can update their own retailer"
  on public.retailers for update
  using (
    id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  )
  with check (
    id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

create or replace function public.enforce_retailer_staff_editable_columns()
returns trigger
language plpgsql
as $$
begin
  -- Three privileged paths, none of which is "a retailer staff member
  -- updating their own tenant directly":
  --   1. auth.role() = 'service_role' — the admin/service-role client
  --      (bootstrap scripts, future cron/internal jobs). Triggers
  --      always fire regardless of RLS, so service_role's RLS bypass
  --      (BYPASSRLS) does not, by itself, exempt it here.
  --   2. current_user <> session_user — a security definer function
  --      (e.g. accept_retailer_staff_invite) runs with current_user
  --      switched to its owner while session_user stays the connecting
  --      role for the whole session; auth.role() still reports the
  --      original caller's JWT role in this case, so this check is the
  --      one that catches it.
  --   3. public.is_platform_staff() — a PAON Admin operator's own
  --      RLS-enforced session.
  if auth.role() = 'service_role'
    or current_user <> session_user
    or public.is_platform_staff()
  then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.tier is distinct from old.tier
    or new.slug is distinct from old.slug
    or new.default_currency is distinct from old.default_currency
  then
    raise exception
      'Retailer staff may only update business profile fields — status, tier, slug and default_currency are platform-controlled';
  end if;

  return new;
end;
$$;

create trigger enforce_retailer_staff_editable_columns_on_update
  before update on public.retailers
  for each row
  execute function public.enforce_retailer_staff_editable_columns();
-- Closes a privilege-escalation gap the existing "retailer owners and
-- admins can manage their retailer's staff" policy
-- (create_retailer_staff_members migration) leaves open now that
-- in-portal staff invites exist: that policy's WITH CHECK only
-- verifies the caller is an owner/admin of the target retailer, not
-- that the role they're granting is one they're allowed to grant — an
-- "admin" could otherwise insert a new row with role = 'owner' and
-- hand themselves (or anyone) ownership. Provisioning the sole owner
-- is exclusively a PAON Admin action folded into retailer creation —
-- see docs/DECISIONS.md ADR-009 — and Retailer Portal's own invite
-- form/Server Action already enforces this at the application layer
-- via `INVITABLE_RETAILER_ROLES` (@paon/domain). This restrictive
-- policy is the matching database-layer enforcement docs/DATABASE.md
-- requires ("the application-layer guard ... and the database policy
-- must enforce the same rule") — a RESTRICTIVE policy, not a change to
-- the existing permissive one, so it narrows only INSERT and leaves
-- every other permission that policy grants untouched.

create policy "retailer staff invites may not grant owner role"
  on public.retailer_staff_members
  as restrictive
  for insert
  with check (
    public.is_platform_staff()
    or role <> 'owner'
  );
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
-- See docs/DOMAIN_MODEL.md "Why a Customer is scoped to one Retailer":
-- the login is shared across retailers, the Customer record is not.
-- This table is the auditable record of each link event; `customers.user_id`
-- (previous migration) is the denormalized column RLS/queries actually
-- filter on. Both are written together, only by
-- link_my_customer_accounts — never directly by a client, hence no
-- insert/update/delete policy for any non-platform role below.

create table public.customer_account_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (user_id, customer_id)
);

create index customer_account_links_user_id_idx
  on public.customer_account_links (user_id);

alter table public.customer_account_links enable row level security;

create policy "platform staff can read all customer account links"
  on public.customer_account_links for select
  using (public.is_platform_staff());

create policy "a user can read their own customer account links"
  on public.customer_account_links for select
  using (user_id = auth.uid());

create policy "retailer staff can read their retailer's customer account links"
  on public.customer_account_links for select
  using (retailer_id = public.current_retailer_id());

comment on table public.customer_account_links is
  'Audit record of each Customer Portal login linking to a per-retailer Customer row. Written only by link_my_customer_accounts().';

-- The Customer Portal dashboard shows which retailer each linked
-- relationship belongs to (display name, tier) — without this, a
-- customer session has no policy on `retailers` that applies to them
-- at all (the existing policies key off a platform-role or
-- current_retailer_id() claim, neither of which a customer session
-- carries — see docs/DECISIONS.md ADR-013).
create policy "a customer can read retailers they have a relationship with"
  on public.retailers for select
  using (
    exists (
      select 1
      from public.customer_account_links link
      where link.retailer_id = retailers.id
        and link.user_id = auth.uid()
    )
  );

-- Called once per Customer Portal session establishment (see
-- apps/customer/app/auth/confirm/route.ts) — idempotent, links every
-- still-unlinked `customers` row whose email matches the caller's own
-- verified email to auth.uid(). A security definer function, not a
-- broadened customers/customer_account_links policy, for the same
-- reason as accept_retailer_staff_invite (docs/DECISIONS.md ADR-012):
-- this is a narrow, self-only state transition the caller re-derives
-- from auth.uid()/auth.jwt(), never from a client-supplied id.
create or replace function public.link_my_customer_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then
    return;
  end if;

  update public.customers
    set user_id = auth.uid()
    where lower(email) = lower(v_email)
      and user_id is null
      and deleted_at is null;

  insert into public.customer_account_links (user_id, customer_id, retailer_id)
  select auth.uid(), c.id, c.retailer_id
  from public.customers c
  where c.user_id = auth.uid()
  on conflict (user_id, customer_id) do nothing;
end;
$$;

revoke all on function public.link_my_customer_accounts() from public;
grant execute on function public.link_my_customer_accounts() to authenticated;

comment on function public.link_my_customer_accounts() is
  'Links every still-unlinked customers row matching the caller''s own verified email to their Customer Portal login. Idempotent; safe to call on every session.';
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
-- See docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration" and
-- docs/DECISIONS.md ADR-014. Orders are only ever created by
-- `place_order` (end of this migration) — never inserted directly by a
-- client — so there is no client-facing insert policy on either table.

create type public.order_status as enum (
  'draft',
  'pending_payment',
  'placed',
  'in_production',
  'ready_for_fulfillment',
  'shipped',
  'delivered',
  'completed',
  'canceled',
  'refunded'
);

create type public.order_channel as enum (
  'online',
  'in_store',
  'clienteling',
  'phone'
);

create sequence public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_number text not null unique,
  status public.order_status not null default 'pending_payment',
  channel public.order_channel not null default 'online',
  currency text not null,
  subtotal_amount_minor_units integer not null check (subtotal_amount_minor_units >= 0),
  total_amount_minor_units integer not null check (total_amount_minor_units >= 0),
  shipping_address jsonb,
  placed_at timestamptz,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index orders_retailer_id_idx on public.orders (retailer_id);
create index orders_customer_id_idx on public.orders (customer_id);

create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy "platform staff can manage all orders"
  on public.orders for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's orders"
  on public.orders for select
  using (retailer_id = public.current_retailer_id());

-- Fulfillment/status updates — production_staff and above, not
-- read_only. A stricter-than-customers, looser-than-products gate:
-- order handling is closer to production_staff's job than to catalog
-- authoring.
create policy "production staff and above can update their retailer's orders"
  on public.orders for update
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  );

create policy "a customer can read their own orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.orders is
  'The commercial record — see docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration". Created only by place_order().';

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id),
  quantity integer not null check (quantity > 0),
  unit_price_amount_minor_units integer not null check (unit_price_amount_minor_units >= 0),
  unit_price_currency text not null,
  requires_production boolean not null default false,
  requires_alteration boolean not null default false,
  created_at timestamptz not null default now()
);

create index order_lines_order_id_idx on public.order_lines (order_id);

alter table public.order_lines enable row level security;

create policy "platform staff can read all order lines"
  on public.order_lines for select
  using (public.is_platform_staff());

create policy "retailer staff can read their retailer's order lines"
  on public.order_lines for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.retailer_id = public.current_retailer_id()
    )
  );

create policy "a customer can read their own order lines"
  on public.order_lines for select
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_lines.order_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.order_lines is
  'Snapshots productVariantId/unitPrice at order time — a later price/product change never rewrites a past order. Written only by place_order().';

-- The one write path for both tables above. See docs/DECISIONS.md
-- ADR-014 for why this is a security definer RPC (same "narrow RPC
-- over broadened policy" reasoning as accept_retailer_staff_invite /
-- link_my_customer_accounts, ADR-012/013) rather than insert policies
-- that would let a client assert its own price/inventory/customer_id.
create or replace function public.place_order(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer public.retailers;
  v_variant public.product_variants;
  v_product public.products;
  v_customer_id uuid;
  v_order_id uuid;
  v_line_total integer;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into v_retailer
    from public.retailers
    where id = p_retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for orders';
  end if;

  select * into v_variant
    from public.product_variants
    where id = p_variant_id and deleted_at is null;
  if not found then
    raise exception 'Product variant % not found', p_variant_id;
  end if;

  select * into v_product
    from public.products
    where id = v_variant.product_id and deleted_at is null;
  if not found or v_product.retailer_id <> p_retailer_id or v_product.status <> 'active' then
    raise exception 'Product is not available from this retailer';
  end if;

  -- Made-to-order variants have no stock to check or decrement.
  if not v_product.is_made_to_order then
    if v_variant.inventory_quantity < p_quantity then
      raise exception 'Not enough stock for %', v_variant.sku;
    end if;

    update public.product_variants
      set inventory_quantity = inventory_quantity - p_quantity
      where id = v_variant.id;
  end if;

  select id into v_customer_id
    from public.customers
    where retailer_id = p_retailer_id
      and user_id = auth.uid()
      and deleted_at is null
    limit 1;

  -- First purchase from this retailer: create the Customer record now,
  -- already linked (we already have both retailer_id and auth.uid()) —
  -- see docs/DECISIONS.md ADR-013 for why linking is otherwise a
  -- separate step (link_my_customer_accounts, email-matched).
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (
      p_retailer_id,
      auth.uid(),
      coalesce(auth.jwt() ->> 'email', 'Customer'),
      auth.jwt() ->> 'email',
      'first_purchase'
    )
    returning id into v_customer_id;

    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  v_line_total := v_variant.price_amount_minor_units * p_quantity;

  insert into public.orders (
    retailer_id, customer_id, order_number, status, channel,
    currency, subtotal_amount_minor_units, total_amount_minor_units, placed_at
  )
  values (
    p_retailer_id, v_customer_id, public.next_order_number(), 'pending_payment', 'online',
    v_variant.price_currency, v_line_total, v_line_total, now()
  )
  returning id into v_order_id;

  insert into public.order_lines (
    order_id, product_variant_id, quantity,
    unit_price_amount_minor_units, unit_price_currency,
    requires_production, requires_alteration
  )
  values (
    v_order_id, v_variant.id, p_quantity,
    v_variant.price_amount_minor_units, v_variant.price_currency,
    v_product.is_made_to_order, v_product.is_alterable
  );

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, uuid, integer) from public;
grant execute on function public.place_order(uuid, uuid, integer) to authenticated;
-- service_role too: not for browser-reachable use (it bypasses the
-- "is this caller authenticated" question place_order otherwise relies
-- on, same caution as every other admin-client use — see
-- docs/DATABASE.md "Row Level Security"), but e2e fixtures and any
-- future internal/support tooling need to seed orders without a real
-- customer session.
grant execute on function public.place_order(uuid, uuid, integer) to service_role;

comment on function public.place_order(uuid, uuid, integer) is
  'The only way an Order/OrderLine is created. Re-derives price, inventory and the caller''s Customer record server-side — never trusts client-supplied values for any of them. No payment capture yet (docs/DECISIONS.md ADR-014) — orders start "pending_payment".';
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
-- See docs/DOMAIN_MODEL.md "Appointments". A staff member's recurring
-- bookable hours — `computeAvailableSlots` (@paon/domain) turns these
-- into actual bookable start times for a given date. `start_time`/
-- `end_time` are `text`, not the native Postgres `time` type,
-- specifically so the wire format matches the "HH:MM" the zod schema
-- (createAvailabilityWindowInputSchema) validates exactly — `time`
-- round-trips as "HH:MM:SS" through the client, which would force a
-- format-translation layer in the repository for no benefit.

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_windows_start_before_end check (start_time < end_time)
);

create index availability_windows_retailer_id_idx on public.availability_windows (retailer_id);
create index availability_windows_staff_id_idx on public.availability_windows (staff_id);

create trigger set_availability_windows_updated_at
  before update on public.availability_windows
  for each row
  execute function public.set_updated_at();

alter table public.availability_windows enable row level security;

create policy "platform staff can manage all availability windows"
  on public.availability_windows for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's availability windows"
  on public.availability_windows for select
  using (retailer_id = public.current_retailer_id());

-- A staff member manages their own schedule; manager+ can manage
-- anyone's (covering shift changes, onboarding a new hire's schedule,
-- etc.) — the same "self, or a more senior role" shape used nowhere
-- else yet in this schema, so it's spelled out with an `exists` against
-- retailer_staff_members rather than a JWT claim (there is no
-- `current_staff_id()` — see docs/DECISIONS.md ADR-015).
create policy "staff manage their own availability, managers manage any"
  on public.availability_windows for all
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('manager', 'admin', 'owner')
      or exists (
        select 1 from public.retailer_staff_members rsm
        where rsm.id = availability_windows.staff_id
          and rsm.user_id = auth.uid()
      )
    )
  )
  with check (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('manager', 'admin', 'owner')
      or exists (
        select 1 from public.retailer_staff_members rsm
        where rsm.id = availability_windows.staff_id
          and rsm.user_id = auth.uid()
      )
    )
  );

comment on table public.availability_windows is
  'A staff member''s recurring bookable hours. See docs/DOMAIN_MODEL.md "Appointments" and computeAvailableSlots in @paon/domain.';
-- See docs/DOMAIN_MODEL.md "Appointments". `location_id` stays a loose
-- unconstrained column (no FK, no Location table) — multi-location is
-- explicitly deferred (docs/PROJECT_STATE.md, carried forward from
-- Phase 1); "select retailer/location" in this slice means selecting
-- the retailer, via the existing `/r/[slug]` storefront routing.

create type public.appointment_type as enum (
  'styling_consultation',
  'fitting',
  'alteration_fitting',
  'personal_shopping',
  'event'
);

create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'checked_in',
  'completed',
  'canceled',
  'no_show'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  type public.appointment_type not null,
  status public.appointment_status not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint appointments_starts_before_ends check (starts_at < ends_at)
);

create index appointments_retailer_id_idx on public.appointments (retailer_id);
create index appointments_customer_id_idx on public.appointments (customer_id);
create index appointments_staff_id_idx on public.appointments (staff_id) where staff_id is not null;

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

alter table public.appointments enable row level security;

create policy "platform staff can manage all appointments"
  on public.appointments for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's appointments"
  on public.appointments for select
  using (retailer_id = public.current_retailer_id());

-- Booking/calendar management is frontline client-service work, same
-- crowd as customers' sales_associate+ CRM gate — not admin-only.
create policy "sales staff and above can manage their retailer's appointments"
  on public.appointments for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "a customer can read their own appointments"
  on public.appointments for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = appointments.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.appointments is
  'See docs/DOMAIN_MODEL.md "Appointments". Customer-initiated appointments are created only by request_appointment() below — retailer staff may also insert directly (e.g. booking a walk-in) under the sales_associate+ policy above.';

-- Mirrors place_order (docs/DECISIONS.md ADR-014): a customer may
-- request an appointment with a retailer they have never bought from,
-- so this creates their Customer record on the spot if needed, the
-- same "narrow security definer RPC, re-derive everything server-side"
-- shape as ADR-012/013/014. See ADR-015 for why this one isn't also
-- transactional over inventory/pricing the way place_order is — there
-- is nothing here to decrement or re-price.
create or replace function public.request_appointment(
  p_retailer_id uuid,
  p_type public.appointment_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer public.retailers;
  v_customer_id uuid;
  v_appointment_id uuid;
begin
  if p_starts_at >= p_ends_at then
    raise exception 'starts_at must be before ends_at';
  end if;

  select * into v_retailer
    from public.retailers
    where id = p_retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for appointments';
  end if;

  select id into v_customer_id
    from public.customers
    where retailer_id = p_retailer_id
      and user_id = auth.uid()
      and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (
      p_retailer_id,
      auth.uid(),
      coalesce(auth.jwt() ->> 'email', 'Customer'),
      auth.jwt() ->> 'email',
      'prospect'
    )
    returning id into v_customer_id;

    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.appointments (
    retailer_id, customer_id, type, status, starts_at, ends_at, notes
  )
  values (
    p_retailer_id, v_customer_id, p_type, 'requested', p_starts_at, p_ends_at, p_notes
  )
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) from public;
grant execute on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) to service_role;

comment on function public.request_appointment(uuid, public.appointment_type, timestamptz, timestamptz, text) is
  'Customer Portal appointment request. Creates the caller''s Customer record on the spot if this is their first interaction with the retailer, same as place_order.';
-- See docs/DOMAIN_MODEL.md "Customer" and
-- packages/domain/src/customer/customer.ts "CustomerFitProfileEntry".
-- Deliberately append-only (insert-only policies below, no update/
-- delete for any non-platform role) — "current" is simply the most
-- recent row per customer, so sizing history is the data model, not a
-- bolted-on audit trail of a separately-mutable "profile" row.

create table public.customer_fit_profile_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  measurements jsonb not null default '{}'::jsonb,
  fit_preferences text,
  style_notes text,
  recorded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index customer_fit_profile_entries_customer_id_idx
  on public.customer_fit_profile_entries (customer_id, recorded_at desc);

alter table public.customer_fit_profile_entries enable row level security;

create policy "platform staff can manage all fit profile entries"
  on public.customer_fit_profile_entries for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's fit profile entries"
  on public.customer_fit_profile_entries for select
  using (retailer_id = public.current_retailer_id());

-- Same crowd as customers' sales_associate+ CRM gate — taking
-- measurements after a consultation is frontline client-service work.
create policy "sales staff and above can record fit profile entries"
  on public.customer_fit_profile_entries for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "a customer can read their own fit profile entries"
  on public.customer_fit_profile_entries for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_fit_profile_entries.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.customer_fit_profile_entries is
  'Append-only measurement/fit/style snapshots. "Current" = most recent row per customer_id. See @paon/domain CustomerFitProfileEntry.';
-- See docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration" and
-- packages/domain/src/production/production.ts. `status` here is
-- denormalized — kept in sync by a trigger from `alteration_updates`
-- (next migration), never written directly by application code, so it
-- can be queried/filtered without a correlated subquery while still
-- being fully derived from the append-only update log.

create type public.alteration_status as enum (
  'requested',
  'measured',
  'in_progress',
  'ready_for_fitting',
  'ready_for_pickup',
  'complete'
);

create table public.alterations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_line_id uuid references public.order_lines (id) on delete set null,
  status public.alteration_status not null default 'requested',
  tailor_reference text,
  instructions text not null,
  appointment_id_for_fitting uuid references public.appointments (id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index alterations_retailer_id_idx on public.alterations (retailer_id);
create index alterations_customer_id_idx on public.alterations (customer_id);

create trigger set_alterations_updated_at
  before update on public.alterations
  for each row
  execute function public.set_updated_at();

alter table public.alterations enable row level security;

create policy "platform staff can manage all alterations"
  on public.alterations for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's alterations"
  on public.alterations for select
  using (retailer_id = public.current_retailer_id());

-- Creating/editing the request itself (instructions, due date, which
-- order line) is frontline client-service work — same gate as
-- customers' CRM and appointments' booking. Status changes happen only
-- through alteration_updates (next migration), which is gated to
-- production_staff+ instead — see that migration.
create policy "sales staff and above can create and edit alterations"
  on public.alterations for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "a customer can read their own alterations"
  on public.alterations for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = alterations.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.alterations is
  'Tracks a fit alteration, on a new OrderLine or a past purchase (order_line_id is optional). status is denormalized from alteration_updates — see that migration.';

-- The "sales staff and above can create and edit alterations" policy
-- above is `for all`, which includes UPDATE — without this trigger, a
-- sales_associate could set `status` directly, bypassing the
-- alteration_updates log entirely and breaking the "status is always
-- derived from the update history" invariant this table's comment
-- promises. Same `current_user <> session_user` / `auth.role() =
-- 'service_role'` shape as `enforce_retailer_staff_editable_columns`
-- (20260719000005_*) — the sync trigger in the next migration runs as
-- security definer, so it passes this check; a direct client UPDATE
-- does not. See docs/DECISIONS.md ADR-015.
create or replace function public.enforce_alteration_status_via_updates_only()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role'
    or current_user <> session_user
    or public.is_platform_staff()
  then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'Alteration status may only change via alteration_updates — see docs/DECISIONS.md ADR-015';
  end if;

  return new;
end;
$$;

create trigger enforce_alteration_status_via_updates_only_on_update
  before update on public.alterations
  for each row
  execute function public.enforce_alteration_status_via_updates_only();
-- See packages/domain/src/production/production.ts "AlterationUpdate"
-- and docs/DECISIONS.md ADR-015. Append-only — the trigger at the
-- bottom of this file is what keeps `alterations.status` in sync,
-- never application code, so the two can never drift apart regardless
-- of which future code path inserts an update.

create table public.alteration_updates (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alterations (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status public.alteration_status not null,
  note text,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index alteration_updates_alteration_id_idx
  on public.alteration_updates (alteration_id, created_at);

alter table public.alteration_updates enable row level security;

create policy "platform staff can manage all alteration updates"
  on public.alteration_updates for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's alteration updates"
  on public.alteration_updates for select
  using (retailer_id = public.current_retailer_id());

-- Status/progress tracking is the actual alteration work — same gate
-- as orders' fulfillment-status policy (production_staff+), distinct
-- from the sales_associate+ gate that creates/edits the request itself
-- (previous migration).
create policy "production staff and above can add alteration updates"
  on public.alteration_updates for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  );

create policy "a customer can read their own alteration updates"
  on public.alteration_updates for select
  using (
    exists (
      select 1 from public.alterations a
      join public.customers c on c.id = a.customer_id
      where a.id = alteration_updates.alteration_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.alteration_updates is
  'Append-only status/note timeline for an Alteration — how a customer "sees updates" and how alterations.status stays in sync (see the trigger below).';

create or replace function public.sync_alteration_status_from_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alterations
    set status = new.status
    where id = new.alteration_id;
  return new;
end;
$$;

create trigger sync_alteration_status_on_update_insert
  after insert on public.alteration_updates
  for each row
  execute function public.sync_alteration_status_from_update();
-- Separate migration because PostgreSQL enum values cannot be referenced by
-- another statement until the ALTER TYPE transaction has committed.
alter type public.retailer_role add value if not exists 'workshop_manager';
alter type public.retailer_role add value if not exists 'worker';
-- Founder clarification superseding ADR-015: PAON owns in-store fitting
-- observations tied to physical garments and alteration operations. It does
-- not own generic customer measurements or manufacturing specifications.
-- The foundation tables are retained read-only for audit/migration safety;
-- all active writes use the garment-first model below.

drop trigger if exists enforce_alteration_status_via_updates_only_on_update on public.alterations;
drop trigger if exists sync_alteration_status_on_update_insert on public.alteration_updates;

alter table public.customer_fit_profile_entries rename to legacy_customer_fit_profile_entries;
alter table public.alterations rename to legacy_alterations;
alter table public.alteration_updates rename to legacy_alteration_updates;

drop policy if exists "retailer staff can read their retailer's fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "sales staff and above can record fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "a customer can read their own fit profile entries" on public.legacy_customer_fit_profile_entries;
drop policy if exists "retailer staff can read their retailer's alterations" on public.legacy_alterations;
drop policy if exists "sales staff and above can create and edit alterations" on public.legacy_alterations;
drop policy if exists "a customer can read their own alterations" on public.legacy_alterations;
drop policy if exists "retailer staff can read their retailer's alteration updates" on public.legacy_alteration_updates;
drop policy if exists "production staff and above can add alteration updates" on public.legacy_alteration_updates;
drop policy if exists "a customer can read their own alteration updates" on public.legacy_alteration_updates;

comment on table public.legacy_customer_fit_profile_entries is
  'Read-only archive from ADR-015. Not an active PAON domain model: fitting observations must identify a physical garment.';
comment on table public.legacy_alterations is
  'Read-only archive of the Phase 3 alteration foundation, migrated into garment-first alteration_work_orders.';
comment on table public.legacy_alteration_updates is
  'Read-only archive of the Phase 3 alteration update foundation, migrated into alteration_status_history.';

create type public.garment_source_kind as enum ('external', 'finished_mtm');
create type public.garment_identification_state as enum ('verified', 'needs_verification');
create type public.work_classification as enum ('work_now', 'future_order_note');
create type public.workshop_status as enum ('active', 'inactive');
create type public.alteration_price_list_kind as enum ('retailer', 'workshop');
create type public.alteration_work_order_status as enum (
  'intake',
  'quoted',
  'awaiting_approval',
  'approved',
  'assigned',
  'in_progress',
  'completion_review',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'canceled'
);
create type public.alteration_task_status as enum (
  'proposed',
  'approved',
  'assigned',
  'in_progress',
  'review_ready',
  'completed',
  'canceled'
);
create type public.price_change_proposal_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.alteration_attachment_kind as enum ('intake', 'label', 'evidence', 'progress', 'completion');
create type public.custody_event_type as enum (
  'received',
  'handed_to_workshop',
  'returned_to_retailer',
  'released_to_customer',
  'delivery_dispatch',
  'delivery_complete'
);
create type public.completion_review_status as enum ('pending', 'approved', 'changes_requested');
create type public.alteration_fulfillment_method as enum ('pickup', 'delivery');
create type public.alteration_fulfillment_status as enum ('scheduled', 'ready', 'dispatched', 'completed', 'canceled');

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null,
  status public.workshop_status not null default 'active',
  email text,
  phone text,
  address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, name)
);

alter table public.retailer_staff_members
  add column workshop_id uuid references public.workshops (id) on delete set null;

alter table public.retailer_staff_members
  add constraint retailer_staff_workshop_role_check check (
    (role in ('workshop_manager', 'worker') and workshop_id is not null)
    or (role not in ('workshop_manager', 'worker') and workshop_id is null)
  ) not valid;

alter table public.retailer_staff_members
  validate constraint retailer_staff_workshop_role_check;

create unique index one_active_retailer_staff_membership_per_user_idx
  on public.retailer_staff_members (user_id)
  where user_id is not null and deleted_at is null;

create table public.alteration_catalogue_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alteration_operations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.alteration_catalogue_categories (id) on delete restrict,
  code text not null unique,
  name text not null,
  description text not null default '',
  default_duration_minutes integer,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.retailer_alteration_category_settings (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  category_id uuid not null references public.alteration_catalogue_categories (id) on delete cascade,
  enabled boolean not null default true,
  updated_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (retailer_id, category_id)
);

create table public.retailer_alteration_operation_settings (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  operation_id uuid not null references public.alteration_operations (id) on delete cascade,
  enabled boolean not null default true,
  updated_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (retailer_id, operation_id)
);

create table public.alteration_price_lists (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  workshop_id uuid references public.workshops (id) on delete cascade,
  kind public.alteration_price_list_kind not null,
  name text not null,
  currency text not null,
  effective_from date not null default current_date,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (kind = 'retailer' and workshop_id is null)
    or (kind = 'workshop' and workshop_id is not null)
  ),
  check (effective_until is null or effective_until >= effective_from)
);

create table public.alteration_price_list_items (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  price_list_id uuid not null references public.alteration_price_lists (id) on delete cascade,
  operation_id uuid not null references public.alteration_operations (id) on delete restrict,
  amount_minor_units integer not null check (amount_minor_units between 0 and 100000000),
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_list_id, operation_id)
);

create unique index one_alteration_price_list_per_scope_and_start_idx
  on public.alteration_price_lists (
    retailer_id,
    kind,
    coalesce(workshop_id, '00000000-0000-0000-0000-000000000000'::uuid),
    effective_from
  )
  where deleted_at is null;

create table public.physical_garments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  source_kind public.garment_source_kind not null,
  category_code text not null,
  garment_type text not null,
  brand text,
  description text not null,
  identifying_photo_url text,
  label_metadata jsonb not null default '{}'::jsonb,
  intake_condition text not null,
  external_reference text,
  order_line_id uuid references public.order_lines (id) on delete set null,
  supplier_order_reference text,
  identification_state public.garment_identification_state not null default 'verified',
  legacy_alteration_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    source_kind = 'external'
    or order_line_id is not null
    or supplier_order_reference is not null
  )
);

create table public.fitting_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  fitted_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.fitting_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  fitting_session_id uuid not null references public.fitting_sessions (id) on delete restrict,
  physical_garment_id uuid not null references public.physical_garments (id) on delete restrict,
  classification public.work_classification not null,
  area text not null,
  observation text not null,
  recorded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create sequence public.alteration_work_order_number_seq;

create or replace function public.next_alteration_work_order_number()
returns text
language sql
volatile
as $$
  select 'ALT-' || to_char(nextval('public.alteration_work_order_number_seq'), 'FM000000')
$$;

create table public.alteration_work_orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  physical_garment_id uuid not null references public.physical_garments (id) on delete restrict,
  fitting_session_id uuid references public.fitting_sessions (id) on delete set null,
  work_order_number text not null default public.next_alteration_work_order_number(),
  status public.alteration_work_order_status not null default 'intake',
  original_quote_amount_minor_units integer not null default 0 check (original_quote_amount_minor_units >= 0),
  original_quote_currency text not null,
  agreed_total_amount_minor_units integer check (agreed_total_amount_minor_units >= 0),
  agreed_total_currency text,
  due_date date,
  customer_notification_ready_at timestamptz,
  customer_notified_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, work_order_number),
  check (
    (agreed_total_amount_minor_units is null and agreed_total_currency is null)
    or (agreed_total_amount_minor_units is not null and agreed_total_currency is not null)
  ),
  check (
    (status = 'canceled' and canceled_at is not null and cancellation_reason is not null)
    or status <> 'canceled'
  )
);

create table public.alteration_tasks (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  operation_id uuid references public.alteration_operations (id) on delete restrict,
  title text not null,
  instructions text,
  classification public.work_classification not null,
  status public.alteration_task_status not null default 'proposed',
  original_quote_amount_minor_units integer not null default 0 check (original_quote_amount_minor_units >= 0),
  original_quote_currency text not null,
  agreed_price_amount_minor_units integer check (agreed_price_amount_minor_units >= 0),
  agreed_price_currency text,
  assigned_worker_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (classification = 'work_now' or assigned_worker_id is null),
  check (
    (agreed_price_amount_minor_units is null and agreed_price_currency is null)
    or (agreed_price_amount_minor_units is not null and agreed_price_currency is not null)
  )
);

create table public.work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  assigned_worker_id uuid references public.retailer_staff_members (id) on delete set null,
  assigned_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  target_completion_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alteration_task_notes (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid not null references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 2000),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index one_active_work_order_assignment_idx
  on public.work_order_assignments (alteration_id) where active;

create table public.alteration_status_history (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  from_status public.alteration_work_order_status,
  to_status public.alteration_work_order_status not null,
  note text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.alteration_pricing_history (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  event_type text not null check (event_type in ('original_quote', 'proposal', 'approval', 'rejection', 'withdrawal', 'price_list_change')),
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency text not null,
  reason text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.price_change_proposals (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  original_amount_minor_units integer not null check (original_amount_minor_units between 0 and 100000000),
  proposed_amount_minor_units integer not null check (proposed_amount_minor_units between 0 and 100000000),
  currency text not null,
  explanation text not null check (length(trim(explanation)) >= 10),
  status public.price_change_proposal_status not null default 'pending',
  proposed_by_staff_id uuid not null references public.retailer_staff_members (id) on delete restrict,
  decided_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (status in ('approved', 'rejected') and decided_by_staff_id is not null and decided_at is not null and decision_reason is not null)
    or status in ('pending', 'withdrawn')
  )
);

create table public.alteration_attachments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  alteration_id uuid references public.alteration_work_orders (id) on delete restrict,
  task_id uuid references public.alteration_tasks (id) on delete restrict,
  observation_id uuid references public.fitting_observations (id) on delete restrict,
  proposal_id uuid references public.price_change_proposals (id) on delete restrict,
  physical_garment_id uuid references public.physical_garments (id) on delete restrict,
  kind public.alteration_attachment_kind not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(alteration_id, task_id, observation_id, proposal_id, physical_garment_id) >= 1),
  unique (storage_bucket, storage_path)
);

alter table public.price_change_proposals
  add column evidence_attachment_id uuid references public.alteration_attachments (id) on delete set null;

create table public.chain_of_custody_events (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  event_type public.custody_event_type not null,
  from_party text,
  to_party text,
  condition_note text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create table public.completion_reviews (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status public.completion_review_status not null default 'pending',
  notes text,
  reviewed_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.alteration_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  method public.alteration_fulfillment_method not null,
  status public.alteration_fulfillment_status not null,
  scheduled_at timestamptz,
  completed_at timestamptz,
  delivery_address jsonb,
  released_to_name text,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default now()
);

create index physical_garments_customer_idx on public.physical_garments (customer_id, created_at desc);
create index fitting_observations_garment_idx on public.fitting_observations (physical_garment_id, created_at);
create index alteration_work_orders_retailer_idx on public.alteration_work_orders (retailer_id, created_at desc);
create index alteration_work_orders_customer_idx on public.alteration_work_orders (customer_id, created_at desc);
create index alteration_tasks_work_order_idx on public.alteration_tasks (alteration_id, created_at);
create index alteration_task_notes_task_idx on public.alteration_task_notes (task_id, created_at);
create index alteration_status_history_work_order_idx on public.alteration_status_history (alteration_id, created_at);
create index alteration_pricing_history_work_order_idx on public.alteration_pricing_history (alteration_id, created_at);
create index chain_of_custody_work_order_idx on public.chain_of_custody_events (alteration_id, occurred_at);
create index price_change_proposals_work_order_idx on public.price_change_proposals (alteration_id, created_at);

create trigger set_workshops_updated_at before update on public.workshops for each row execute function public.set_updated_at();
create trigger set_alteration_catalogue_categories_updated_at before update on public.alteration_catalogue_categories for each row execute function public.set_updated_at();
create trigger set_alteration_operations_updated_at before update on public.alteration_operations for each row execute function public.set_updated_at();
create trigger set_alteration_price_lists_updated_at before update on public.alteration_price_lists for each row execute function public.set_updated_at();
create trigger set_alteration_price_list_items_updated_at before update on public.alteration_price_list_items for each row execute function public.set_updated_at();
create trigger set_physical_garments_updated_at before update on public.physical_garments for each row execute function public.set_updated_at();
create trigger set_fitting_sessions_updated_at before update on public.fitting_sessions for each row execute function public.set_updated_at();
create trigger set_alteration_work_orders_updated_at before update on public.alteration_work_orders for each row execute function public.set_updated_at();
create trigger set_alteration_tasks_updated_at before update on public.alteration_tasks for each row execute function public.set_updated_at();
create trigger set_work_order_assignments_updated_at before update on public.work_order_assignments for each row execute function public.set_updated_at();
create trigger set_price_change_proposals_updated_at before update on public.price_change_proposals for each row execute function public.set_updated_at();
create trigger set_completion_reviews_updated_at before update on public.completion_reviews for each row execute function public.set_updated_at();
create trigger set_alteration_fulfillment_events_updated_at before update on public.alteration_fulfillment_events for each row execute function public.set_updated_at();

-- Preserve every legacy alteration as a garment-backed work order. The
-- garment is explicitly marked needs_verification because the old model did
-- not capture enough identifying information to assert more.
insert into public.physical_garments (
  retailer_id, customer_id, source_kind, category_code, garment_type,
  description, intake_condition, identification_state, legacy_alteration_id,
  order_line_id, external_reference, created_at, updated_at, deleted_at
)
select
  retailer_id, customer_id, 'external', 'other', 'Unspecified garment',
  'Migrated from the Phase 3 alteration foundation; identify at the next fitting.',
  'Condition was not recorded in the legacy intake.', 'needs_verification', id,
  order_line_id, tailor_reference, created_at, updated_at, deleted_at
from public.legacy_alterations;

insert into public.alteration_work_orders (
  id, retailer_id, customer_id, physical_garment_id, work_order_number,
  status, original_quote_amount_minor_units, original_quote_currency,
  due_date, created_at, updated_at, deleted_at
)
select
  a.id, a.retailer_id, a.customer_id, g.id,
  public.next_alteration_work_order_number(),
  case a.status
    when 'requested' then 'intake'::public.alteration_work_order_status
    when 'measured' then 'quoted'::public.alteration_work_order_status
    when 'in_progress' then 'in_progress'::public.alteration_work_order_status
    when 'ready_for_fitting' then 'completion_review'::public.alteration_work_order_status
    when 'ready_for_pickup' then 'ready_for_pickup'::public.alteration_work_order_status
    when 'complete' then 'completed'::public.alteration_work_order_status
  end,
  0, r.default_currency, a.due_date, a.created_at, a.updated_at, a.deleted_at
from public.legacy_alterations a
join public.physical_garments g on g.legacy_alteration_id = a.id
join public.retailers r on r.id = a.retailer_id;

insert into public.alteration_tasks (
  alteration_id, retailer_id, title, instructions, classification, status,
  original_quote_amount_minor_units, original_quote_currency, created_at, updated_at
)
select
  a.id, a.retailer_id, 'Legacy alteration instructions', a.instructions,
  'work_now',
  case when a.status = 'complete' then 'completed'::public.alteration_task_status
       when a.status = 'in_progress' then 'in_progress'::public.alteration_task_status
       else 'proposed'::public.alteration_task_status end,
  0, r.default_currency, a.created_at, a.updated_at
from public.legacy_alterations a
join public.retailers r on r.id = a.retailer_id;

insert into public.alteration_status_history (
  alteration_id, retailer_id, from_status, to_status, note,
  actor_staff_id, customer_visible, created_at
)
select
  u.alteration_id, u.retailer_id, null,
  case u.status
    when 'requested' then 'intake'::public.alteration_work_order_status
    when 'measured' then 'quoted'::public.alteration_work_order_status
    when 'in_progress' then 'in_progress'::public.alteration_work_order_status
    when 'ready_for_fitting' then 'completion_review'::public.alteration_work_order_status
    when 'ready_for_pickup' then 'ready_for_pickup'::public.alteration_work_order_status
    when 'complete' then 'completed'::public.alteration_work_order_status
  end,
  u.note, u.staff_id, true, u.created_at
from public.legacy_alteration_updates u;

insert into public.alteration_status_history (
  alteration_id, retailer_id, to_status, note, customer_visible, created_at
)
select w.id, w.retailer_id, w.status, 'Migrated from Phase 3 foundation', true, w.created_at
from public.alteration_work_orders w
where not exists (
  select 1 from public.alteration_status_history h where h.alteration_id = w.id
);

comment on table public.physical_garments is 'A specific physical garment in PAON custody or fitting. Manufacturing specifications remain authoritative in GoCreate/supplier systems.';
comment on table public.fitting_observations is 'Append-only garment-specific fit observations, explicitly classified as work_now or future_order_note.';
comment on table public.alteration_work_orders is 'The in-store alteration aggregate. Status changes only through append-only alteration_status_history and validated transition RPCs.';
comment on table public.alteration_tasks is 'Proposed alteration operations. future_order_note tasks are retained for manual future GoCreate entry and are never assigned as current work.';
comment on table public.alteration_pricing_history is 'Immutable original quote and every proposed/decided price event.';
comment on table public.audit_log_entries is 'Immutable audit history for sensitive alteration pricing, task, handoff, release, completion and cancellation changes.';
insert into public.alteration_catalogue_categories (code, name, description, display_order)
values
  ('suit', 'Suits', 'Coordinated two- and three-piece suits.', 10),
  ('jacket', 'Jackets & blazers', 'Tailored jackets, blazers and dinner jackets.', 20),
  ('trousers', 'Trousers', 'Tailored trousers and chinos.', 30),
  ('waistcoat', 'Waistcoats', 'Single- and double-breasted waistcoats.', 40),
  ('shirt', 'Shirts', 'Dress, formal and casual woven shirts.', 50),
  ('overcoat', 'Overcoats', 'Structured overcoats and topcoats.', 60),
  ('coat', 'Coats & outerwear', 'Casual coats, field jackets and rainwear.', 70),
  ('formalwear', 'Formalwear', 'Dinner suits, morning dress and eveningwear.', 80),
  ('denim', 'Denim', 'Jeans and denim garments.', 90),
  ('knitwear', 'Knitwear', 'Fine-gauge knitwear and knitted jackets.', 100),
  ('leather', 'Leather & suede', 'Leather and suede garments requiring specialist handling.', 110),
  ('accessories', 'Accessories', 'Ties, pocket squares, belts and soft accessories.', 120),
  ('other', 'Other garments', 'Unlisted premium garments and custom work.', 999);

with operation(category_code, code, name, description, minutes, display_order) as (
  values
    ('suit','suit_full_rebalance','Full suit balance','Coordinate jacket and trouser balance across a suit.',180,10),
    ('suit','suit_posture_correction','Suit posture correction','Coordinate front/back balance for erect or stooped posture.',240,20),
    ('suit','suit_finish_basting','Finish basted fitting','Complete agreed work following a basted fitting.',180,30),
    ('jacket','jacket_sleeve_length_cuff','Shorten/lengthen sleeves from cuff','Adjust sleeve length at cuff, preserving finish.',90,10),
    ('jacket','jacket_sleeve_length_shoulder','Shorten sleeves from shoulder','Adjust sleeve length at sleevehead.',180,20),
    ('jacket','jacket_sleeve_pitch','Correct sleeve pitch','Reset sleeve pitch for clean drape.',180,30),
    ('jacket','jacket_sleeve_narrow','Narrow sleeves','Reduce sleeve width through forearm or upper arm.',120,40),
    ('jacket','jacket_take_in_side_seams','Take in side seams','Reduce jacket body through side seams.',120,50),
    ('jacket','jacket_let_out_side_seams','Let out side seams','Release available side-seam inlay.',120,60),
    ('jacket','jacket_suppress_waist','Suppress waist','Shape jacket waist while retaining balance.',120,70),
    ('jacket','jacket_center_back','Adjust centre back seam','Take in or release centre back.',90,80),
    ('jacket','jacket_shorten_length','Shorten jacket length','Shorten hem and rebalance vents/pockets where possible.',240,90),
    ('jacket','jacket_collar_lower','Lower collar','Remove collar roll or excess below collar.',120,100),
    ('jacket','jacket_collar_raise','Raise collar','Add height or correct collar position where inlay permits.',150,110),
    ('jacket','jacket_neck_point','Adjust neck point','Correct lapel/neck point alignment.',180,120),
    ('jacket','jacket_shoulders_narrow','Narrow shoulders','Reduce shoulder width and reset sleeveheads.',300,130),
    ('jacket','jacket_shoulder_pad','Adjust shoulder padding','Add, remove or reshape shoulder padding.',150,140),
    ('jacket','jacket_chest_darts','Adjust chest/darts','Refine chest volume and front suppression.',180,150),
    ('jacket','jacket_vent_repair','Repair vents','Repair or reinforce side/centre vents.',120,160),
    ('jacket','jacket_button_move','Move buttons','Reposition front or cuff buttons.',45,170),
    ('jacket','jacket_lining_repair','Repair lining','Local lining repair or reinforcement.',90,180),
    ('jacket','jacket_reline','Full reline','Replace complete jacket lining.',360,190),
    ('jacket','jacket_hand_finish','Hand finishing','Buttonholes, pick stitching or specialist hand finishing.',180,200),
    ('trousers','trouser_plain_hem','Plain hem','Shorten or lengthen with plain machine-finished hem.',45,10),
    ('trousers','trouser_turnups','Hem with turn-ups','Create or adjust cuffed trouser hem.',60,20),
    ('trousers','trouser_original_finish','Preserve original finish','Adjust length while preserving original construction.',75,30),
    ('trousers','trouser_waist_take_in','Take in waist','Reduce waistband and seat cleanly.',90,40),
    ('trousers','trouser_waist_let_out','Let out waist','Release available waistband/seat inlay.',90,50),
    ('trousers','trouser_seat_adjust','Adjust seat','Correct excess or shortage through seat seam.',90,60),
    ('trousers','trouser_taper_knee_hem','Taper knee to hem','Reduce lower-leg width.',75,70),
    ('trousers','trouser_taper_full_leg','Taper full leg','Reduce thigh, knee and hem width.',120,80),
    ('trousers','trouser_thigh_adjust','Adjust thigh','Take in or release thigh through seams.',90,90),
    ('trousers','trouser_rise_adjust','Adjust rise','Correct front/back rise where construction permits.',180,100),
    ('trousers','trouser_crotch_adjust','Adjust fork/crotch','Correct fork balance and crotch curve.',150,110),
    ('trousers','trouser_side_seams','Adjust side seams','Take in or release through side seams.',120,120),
    ('trousers','trouser_replace_zip','Replace zip','Replace trouser fly zip.',90,130),
    ('trousers','trouser_add_brace_buttons','Add brace buttons','Install internal brace buttons.',45,140),
    ('trousers','trouser_add_side_adjusters','Add/repair side adjusters','Install or repair waistband adjusters.',120,150),
    ('trousers','trouser_recut','Major trouser recut','Comprehensive reshape requiring waistband removal.',300,160),
    ('waistcoat','waistcoat_side_seams','Adjust side seams','Take in or release waistcoat body.',90,10),
    ('waistcoat','waistcoat_back_strap','Adjust back strap','Shorten, replace or reposition back strap.',60,20),
    ('waistcoat','waistcoat_length','Adjust waistcoat length','Shorten and rebalance front points where possible.',180,30),
    ('waistcoat','waistcoat_shoulder','Adjust shoulders','Shorten shoulders and correct armholes.',120,40),
    ('waistcoat','waistcoat_reline','Reline waistcoat','Replace back/lining panels.',240,50),
    ('shirt','shirt_sleeve_length','Adjust sleeve length','Shorten sleeves and reset cuffs/plackets.',90,10),
    ('shirt','shirt_body_take_in','Take in body','Reduce side seams or add darts.',75,20),
    ('shirt','shirt_body_let_out','Let out body','Release available side-seam allowance.',75,30),
    ('shirt','shirt_shorten','Shorten shirt length','Shorten curved or straight hem.',60,40),
    ('shirt','shirt_collar_reduce','Reduce collar','Reduce collar circumference where construction permits.',150,50),
    ('shirt','shirt_cuff_adjust','Adjust cuffs','Move buttons or resize cuffs.',45,60),
    ('shirt','shirt_replace_collar_cuffs','Replace collar/cuffs','Specialist replacement using supplied/matching cloth.',240,70),
    ('shirt','shirt_darts','Add/remove darts','Refine body suppression with back darts.',60,80),
    ('overcoat','overcoat_sleeve_length','Adjust sleeve length','Shorten/lengthen coat sleeves.',120,10),
    ('overcoat','overcoat_body_suppression','Adjust body','Take in or release coat body.',180,20),
    ('overcoat','overcoat_shorten','Shorten overcoat','Shorten hem and rebalance vent.',300,30),
    ('overcoat','overcoat_shoulders','Adjust shoulders','Narrow or reshape shoulders and reset sleeves.',360,40),
    ('overcoat','overcoat_reline','Full reline','Replace complete coat lining.',480,50),
    ('coat','coat_sleeve_length','Adjust sleeve length','Adjust sleeves on casual outerwear.',120,10),
    ('coat','coat_body_adjust','Adjust body','Take in or release outerwear body.',180,20),
    ('coat','coat_zip_replace','Replace zip','Replace compatible outerwear zip.',180,30),
    ('coat','coat_lining_repair','Lining repair','Repair or replace damaged lining section.',120,40),
    ('formalwear','formal_satin_lapel_repair','Repair satin facings','Specialist repair to satin lapels/facings.',240,10),
    ('formalwear','formal_braid_adjust','Adjust trouser braid','Reset braid after trouser taper/length work.',120,20),
    ('formalwear','formal_morning_tail_balance','Morning coat balance','Correct balance/length of morning coat tails.',300,30),
    ('formalwear','formal_dress_trouser_adjust','Formal trouser adjustment','Adjust evening or morning-dress trousers.',120,40),
    ('denim','denim_original_hem','Original hem','Preserve original washed hem.',75,10),
    ('denim','denim_chainstitch_hem','Chainstitch hem','Specialist chainstitched hem.',60,20),
    ('denim','denim_taper','Taper jeans','Taper leg while respecting felled seams.',120,30),
    ('denim','denim_waist','Adjust waist','Take in waistband and seat.',120,40),
    ('denim','denim_repair','Invisible/reinforced repair','Darn or reinforce worn denim.',120,50),
    ('knitwear','knit_sleeve_length','Adjust knitted sleeves','Specialist shorten/lengthen at cuff or shoulder.',180,10),
    ('knitwear','knit_body_length','Adjust knit body length','Specialist re-linking or hem adjustment.',240,20),
    ('knitwear','knit_repair','Repair knit damage','Re-knit or stabilize holes/pulls.',180,30),
    ('leather','leather_sleeve_length','Adjust leather sleeves','Specialist sleeve shortening.',240,10),
    ('leather','leather_body_adjust','Adjust leather body','Specialist side-seam reshaping.',300,20),
    ('leather','leather_zip_replace','Replace leather garment zip','Specialist zip replacement.',300,30),
    ('leather','leather_lining','Repair/replace lining','Specialist leather garment lining work.',360,40),
    ('accessories','accessory_tie_length','Adjust tie length','Shorten and reconstruct tie.',120,10),
    ('accessories','accessory_belt_length','Adjust belt length','Shorten from buckle end where possible.',90,20),
    ('accessories','accessory_repair','Accessory repair','Custom repair to soft accessory.',90,30),
    ('other','other_custom','Custom alteration','Operation scoped after garment inspection.',120,10),
    ('other','other_repair','Repair','Repair scoped after garment inspection.',120,20)
)
insert into public.alteration_operations (
  category_id, code, name, description, default_duration_minutes, display_order
)
select c.id, o.code, o.name, o.description, o.minutes, o.display_order
from operation o
join public.alteration_catalogue_categories c on c.code = o.category_code;
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.retailer_staff_members
  where user_id = auth.uid() and accepted_at is not null and deleted_at is null
  limit 1
$$;

create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id
  from public.retailer_staff_members
  where user_id = auth.uid() and accepted_at is not null and deleted_at is null
  limit 1
$$;

create or replace function public.enforce_retailer_staff_workshop_scope()
returns trigger
language plpgsql
as $$
begin
  if new.workshop_id is not null and not exists (
    select 1 from public.workshops w
    where w.id = new.workshop_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Staff workshop must belong to the staff retailer'; end if;
  return new;
end;
$$;

create trigger enforce_retailer_staff_workshop_scope_on_write
  before insert or update on public.retailer_staff_members
  for each row execute function public.enforce_retailer_staff_workshop_scope();

create or replace function public.is_alterations_management()
returns boolean
language sql
stable
as $$
  select public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
$$;

create or replace function public.is_alterations_advisor()
returns boolean
language sql
stable
as $$
  select public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate')
$$;

create or replace function public.can_access_alteration_work_order(p_alteration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role' or public.is_platform_staff() or exists (
    select 1
    from public.alteration_work_orders w
    where w.id = p_alteration_id
      and w.retailer_id = public.current_retailer_id()
      and public.current_staff_id() is not null
      and (
        public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
        or (
          public.current_retailer_role() = 'workshop_manager'
          and exists (
            select 1 from public.work_order_assignments a
            where a.alteration_id = w.id
              and a.workshop_id = public.current_workshop_id()
              and a.active
          )
        )
        or (
          public.current_retailer_role() = 'worker'
          and (
            exists (
              select 1 from public.work_order_assignments a
              where a.alteration_id = w.id
                and a.assigned_worker_id = public.current_staff_id()
                and a.active
            )
            or exists (
              select 1 from public.alteration_tasks t
              where t.alteration_id = w.id
                and t.assigned_worker_id = public.current_staff_id()
                and t.deleted_at is null
            )
          )
        )
      )
  )
$$;

-- Workshop identities share the Retailer Portal login machinery but must not
-- inherit the broad tenant reads/writes granted to in-house retailer roles by
-- earlier migrations. Restrictive policies narrow those existing permissive
-- policies without rewriting migration history.
create policy "workshop roles cannot read customer records"
  on public.customers as restrictive for select
  using (
    coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true)
  );
create policy "workshop roles cannot insert customer records"
  on public.customers as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update customer records"
  on public.customers as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot delete customer records"
  on public.customers as restrictive for delete
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles only read necessary staff"
  on public.retailer_staff_members as restrictive for select
  using (
    coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true)
    or user_id = auth.uid()
    or (
      public.current_retailer_role() = 'workshop_manager'
      and workshop_id = public.current_workshop_id()
    )
  );

create policy "workshop roles cannot read commerce orders"
  on public.orders as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update commerce orders"
  on public.orders as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read order lines"
  on public.order_lines as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles cannot read appointments"
  on public.appointments as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot insert appointments"
  on public.appointments as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update appointments"
  on public.appointments as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read availability"
  on public.availability_windows as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot insert availability"
  on public.availability_windows as restrictive for insert
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot update availability"
  on public.availability_windows as restrictive for update
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true))
  with check (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot delete availability"
  on public.availability_windows as restrictive for delete
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create policy "workshop roles cannot read collections"
  on public.collections as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read products"
  on public.products as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));
create policy "workshop roles cannot read product variants"
  on public.product_variants as restrictive for select
  using (coalesce(public.current_retailer_role() not in ('workshop_manager','worker'), true));

create or replace function public.can_access_physical_garment(p_garment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_staff() or exists (
    select 1 from public.physical_garments g
    where g.id = p_garment_id
      and g.retailer_id = public.current_retailer_id()
      and (
        public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
        or exists (
          select 1 from public.alteration_work_orders w
          where w.physical_garment_id = g.id
            and public.can_access_alteration_work_order(w.id)
        )
      )
  )
$$;

alter table public.workshops enable row level security;
alter table public.alteration_catalogue_categories enable row level security;
alter table public.alteration_operations enable row level security;
alter table public.retailer_alteration_category_settings enable row level security;
alter table public.retailer_alteration_operation_settings enable row level security;
alter table public.alteration_price_lists enable row level security;
alter table public.alteration_price_list_items enable row level security;
alter table public.physical_garments enable row level security;
alter table public.fitting_sessions enable row level security;
alter table public.fitting_observations enable row level security;
alter table public.alteration_work_orders enable row level security;
alter table public.alteration_tasks enable row level security;
alter table public.alteration_task_notes enable row level security;
alter table public.work_order_assignments enable row level security;
alter table public.alteration_status_history enable row level security;
alter table public.alteration_pricing_history enable row level security;
alter table public.price_change_proposals enable row level security;
alter table public.alteration_attachments enable row level security;
alter table public.chain_of_custody_events enable row level security;
alter table public.completion_reviews enable row level security;
alter table public.alteration_fulfillment_events enable row level security;
alter table public.audit_log_entries enable row level security;

create policy "authenticated users can read alteration catalogue categories"
  on public.alteration_catalogue_categories for select to authenticated
  using (
    active and (
      public.is_platform_staff()
      or (
        public.current_staff_id() is not null
        and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff','workshop_manager')
      )
    )
  );
create policy "authenticated users can read alteration operations"
  on public.alteration_operations for select to authenticated
  using (
    active and (
      public.is_platform_staff()
      or (
        public.current_staff_id() is not null
        and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff','workshop_manager')
      )
    )
  );
create policy "platform staff can manage alteration catalogue categories"
  on public.alteration_catalogue_categories for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff can manage alteration operations"
  on public.alteration_operations for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "retailer staff can read their retailer workshops"
  on public.workshops for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and (
      public.current_retailer_role() not in ('workshop_manager','worker')
      or (public.current_retailer_role() = 'workshop_manager' and id = public.current_workshop_id())
    )
  );
create policy "management can manage workshops"
  on public.workshops for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read workshops"
  on public.workshops for select using (public.is_platform_staff());

create policy "retailer staff can read category settings"
  on public.retailer_alteration_category_settings for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() <> 'worker'
  );
create policy "management can manage category settings"
  on public.retailer_alteration_category_settings for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read category settings"
  on public.retailer_alteration_category_settings for select using (public.is_platform_staff());

create policy "retailer staff can read operation settings"
  on public.retailer_alteration_operation_settings for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() <> 'worker'
  );
create policy "management can manage operation settings"
  on public.retailer_alteration_operation_settings for all
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read operation settings"
  on public.retailer_alteration_operation_settings for select using (public.is_platform_staff());

create policy "authorized staff can read price lists"
  on public.alteration_price_lists for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and (
      public.current_retailer_role() in ('owner', 'admin', 'manager', 'sales_associate', 'production_staff')
      or (public.current_retailer_role() = 'workshop_manager' and workshop_id = public.current_workshop_id())
    )
  );
create policy "platform staff can read price lists"
  on public.alteration_price_lists for select using (public.is_platform_staff());

create policy "authorized staff can read price list items"
  on public.alteration_price_list_items for select
  using (exists (select 1 from public.alteration_price_lists p where p.id = price_list_id));
create policy "platform staff can read price list items"
  on public.alteration_price_list_items for select using (public.is_platform_staff());

create or replace function public.enforce_physical_garment_reference_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.customers c
    where c.id = new.customer_id and c.retailer_id = new.retailer_id
  ) then raise exception 'Physical garment customer must belong to its retailer'; end if;
  if not exists (
    select 1 from public.alteration_catalogue_categories c
    where c.code = new.category_code and c.active
  ) then raise exception 'Physical garment category is not active'; end if;
  if new.order_line_id is not null and not exists (
    select 1 from public.order_lines l
    join public.orders o on o.id = l.order_id
    where l.id = new.order_line_id and o.retailer_id = new.retailer_id
  ) then raise exception 'Order line must belong to the garment retailer'; end if;
  return new;
end;
$$;

create trigger enforce_physical_garment_reference_scope_on_write
  before insert or update on public.physical_garments
  for each row execute function public.enforce_physical_garment_reference_scope();

create or replace function public.enforce_fitting_reference_scope()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'fitting_sessions' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.retailer_id = new.retailer_id
    ) then raise exception 'Fitting customer must belong to its retailer'; end if;
    if new.appointment_id is not null and not exists (
      select 1 from public.appointments a
      where a.id = new.appointment_id and a.retailer_id = new.retailer_id
    ) then raise exception 'Fitting appointment must belong to its retailer'; end if;
  else
    if not exists (
      select 1 from public.fitting_sessions s
      where s.id = new.fitting_session_id and s.retailer_id = new.retailer_id
    ) or not exists (
      select 1 from public.physical_garments g
      where g.id = new.physical_garment_id and g.retailer_id = new.retailer_id
    ) then raise exception 'Observation session and garment must belong to its retailer'; end if;
  end if;
  return new;
end;
$$;

create trigger enforce_fitting_session_reference_scope_on_write
  before insert or update on public.fitting_sessions
  for each row execute function public.enforce_fitting_reference_scope();
create trigger enforce_fitting_observation_reference_scope_on_write
  before insert or update on public.fitting_observations
  for each row execute function public.enforce_fitting_reference_scope();

create or replace function public.enforce_alteration_price_list_scope()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'alteration_price_lists' then
    if new.workshop_id is not null and not exists (
      select 1 from public.workshops w
      where w.id = new.workshop_id and w.retailer_id = new.retailer_id
    ) then raise exception 'Price-list workshop must belong to its retailer'; end if;
  else
    if not exists (
      select 1 from public.alteration_price_lists p
      where p.id = new.price_list_id
        and p.retailer_id = new.retailer_id
        and p.currency = new.currency
    ) then raise exception 'Price-list item must match its list retailer and currency'; end if;
  end if;
  return new;
end;
$$;

create trigger enforce_alteration_price_list_scope_on_write
  before insert or update on public.alteration_price_lists
  for each row execute function public.enforce_alteration_price_list_scope();
create trigger enforce_alteration_price_list_item_scope_on_write
  before insert or update on public.alteration_price_list_items
  for each row execute function public.enforce_alteration_price_list_scope();

create policy "authorized staff can read physical garments"
  on public.physical_garments for select using (
    public.current_retailer_role() <> 'worker'
    and public.can_access_physical_garment(id)
  );
create policy "advisors can record physical garments"
  on public.physical_garments for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "advisors can correct physical garment identification"
  on public.physical_garments for update
  using (retailer_id = public.current_retailer_id() and public.is_alterations_advisor())
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read physical garments"
  on public.physical_garments for select using (public.is_platform_staff());

create policy "authorized staff can read fitting sessions"
  on public.fitting_sessions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
  );
create policy "advisors can record fitting sessions"
  on public.fitting_sessions for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read fitting sessions"
  on public.fitting_sessions for select using (public.is_platform_staff());

create policy "authorized staff can read fitting observations"
  on public.fitting_observations for select
  using (public.current_retailer_role() <> 'worker' and public.can_access_physical_garment(physical_garment_id));
create policy "advisors can record fitting observations"
  on public.fitting_observations for insert
  with check (retailer_id = public.current_retailer_id() and public.is_alterations_advisor());
create policy "platform staff can read fitting observations"
  on public.fitting_observations for select using (public.is_platform_staff());

create policy "authorized staff can read work orders"
  on public.alteration_work_orders for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(id));
create policy "platform staff can read work orders"
  on public.alteration_work_orders for select using (public.is_platform_staff());

create policy "authorized staff can read alteration tasks"
  on public.alteration_tasks for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration tasks"
  on public.alteration_tasks for select using (public.is_platform_staff());

create policy "authorized staff can read alteration task notes"
  on public.alteration_task_notes for select using (
    (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id))
    or (public.current_retailer_role() = 'worker' and exists (
      select 1 from public.alteration_tasks t
      where t.id = task_id
        and t.assigned_worker_id = public.current_staff_id()
        and t.classification = 'work_now'
        and t.deleted_at is null
    ))
  );
create policy "platform staff can read alteration task notes"
  on public.alteration_task_notes for select using (public.is_platform_staff());

create policy "authorized staff can read work order assignments"
  on public.work_order_assignments for select using (
    public.current_retailer_role() <> 'worker'
    and public.can_access_alteration_work_order(alteration_id)
  );
create policy "platform staff can read work order assignments"
  on public.work_order_assignments for select using (public.is_platform_staff());

create or replace function public.enforce_work_order_assignment_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = new.alteration_id and w.retailer_id = new.retailer_id
  ) or not exists (
    select 1 from public.workshops w
    where w.id = new.workshop_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Assignment order and workshop must belong to its retailer'; end if;
  if new.assigned_worker_id is not null and not exists (
    select 1 from public.retailer_staff_members s
    where s.id = new.assigned_worker_id
      and s.retailer_id = new.retailer_id
      and s.workshop_id = new.workshop_id
      and s.role = 'worker'
      and s.accepted_at is not null
      and s.deleted_at is null
  ) then
    raise exception 'Assigned worker must be an active worker in the assigned workshop';
  end if;
  if tg_op = 'UPDATE' and public.current_retailer_role() = 'workshop_manager'
    and (
      new.alteration_id is distinct from old.alteration_id
      or new.retailer_id is distinct from old.retailer_id
      or new.workshop_id is distinct from old.workshop_id
      or new.assigned_by_staff_id is distinct from old.assigned_by_staff_id
      or new.active is distinct from old.active
    )
  then
    raise exception 'Workshop managers may only update the assigned worker and target completion date';
  end if;
  return new;
end;
$$;

create trigger enforce_work_order_assignment_scope_on_write
  before insert or update on public.work_order_assignments
  for each row execute function public.enforce_work_order_assignment_scope();

create policy "authorized staff can read alteration status history"
  on public.alteration_status_history for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration status history"
  on public.alteration_status_history for select using (public.is_platform_staff());
create policy "authorized staff can read alteration pricing history"
  on public.alteration_pricing_history for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration pricing history"
  on public.alteration_pricing_history for select using (public.is_platform_staff());

create policy "authorized staff can read price proposals"
  on public.price_change_proposals for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read price proposals"
  on public.price_change_proposals for select using (public.is_platform_staff());

create policy "authorized staff can read alteration attachments"
  on public.alteration_attachments for select
  using (
    (alteration_id is not null and public.can_access_alteration_work_order(alteration_id))
    or (physical_garment_id is not null and public.can_access_physical_garment(physical_garment_id))
    or (task_id is not null and exists (select 1 from public.alteration_tasks t where t.id = task_id and public.can_access_alteration_work_order(t.alteration_id)))
  );
create policy "authorized staff can add alteration attachment metadata"
  on public.alteration_attachments for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
    and (
      (alteration_id is not null and public.can_access_alteration_work_order(alteration_id))
      or (physical_garment_id is not null and public.can_access_physical_garment(physical_garment_id))
    )
  );
create policy "platform staff can read alteration attachments"
  on public.alteration_attachments for select using (public.is_platform_staff());

create or replace function public.enforce_alteration_attachment_scope()
returns trigger
language plpgsql
as $$
begin
  if new.storage_bucket <> 'alteration-evidence' then
    raise exception 'Alteration attachments must use the private evidence bucket';
  end if;
  if new.alteration_id is null then
    raise exception 'Alteration attachments must identify their work order';
  end if;
  if new.storage_path not like (new.retailer_id::text || '/' || new.alteration_id::text || '/%') then
    raise exception 'Attachment path must be scoped to its retailer and work order';
  end if;
  if new.alteration_id is not null and not exists (
    select 1 from public.alteration_work_orders w
    where w.id = new.alteration_id and w.retailer_id = new.retailer_id
  ) then raise exception 'Attachment work order must belong to its retailer'; end if;
  if new.task_id is not null and not exists (
    select 1 from public.alteration_tasks t
    where t.id = new.task_id and t.retailer_id = new.retailer_id
      and (new.alteration_id is null or t.alteration_id = new.alteration_id)
  ) then raise exception 'Attachment task must belong to its work order and retailer'; end if;
  if new.observation_id is not null and not exists (
    select 1 from public.fitting_observations o
    where o.id = new.observation_id and o.retailer_id = new.retailer_id
  ) then raise exception 'Attachment observation must belong to its retailer'; end if;
  if new.proposal_id is not null and not exists (
    select 1 from public.price_change_proposals p
    where p.id = new.proposal_id and p.retailer_id = new.retailer_id
      and (new.alteration_id is null or p.alteration_id = new.alteration_id)
  ) then raise exception 'Attachment proposal must belong to its work order and retailer'; end if;
  if new.physical_garment_id is not null and not exists (
    select 1 from public.physical_garments g
    where g.id = new.physical_garment_id and g.retailer_id = new.retailer_id
  ) then raise exception 'Attachment garment must belong to its retailer'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_attachment_scope_on_write
  before insert or update on public.alteration_attachments
  for each row execute function public.enforce_alteration_attachment_scope();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alteration-evidence',
  'alteration-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_access_alteration_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_alteration_id uuid;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2
    or v_folders[1] <> public.current_retailer_id()::text
  then return false; end if;
  begin
    v_alteration_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.can_access_alteration_work_order(v_alteration_id);
end;
$$;

create policy "authorized alteration staff can read evidence objects"
  on storage.objects for select
  using (bucket_id = 'alteration-evidence' and public.can_access_alteration_storage_object(name));
create policy "authorized alteration staff can upload evidence objects"
  on storage.objects for insert
  with check (
    bucket_id = 'alteration-evidence'
    and public.current_retailer_role() <> 'read_only'
    and public.can_access_alteration_storage_object(name)
  );
create policy "uploaders can remove unregistered evidence objects"
  on storage.objects for delete
  using (
    bucket_id = 'alteration-evidence'
    and public.can_access_alteration_storage_object(name)
    and not exists (
      select 1 from public.alteration_attachments a
      where a.storage_bucket = bucket_id and a.storage_path = name
    )
  );

create policy "authorized staff can read custody events"
  on public.chain_of_custody_events for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "authorized staff can record custody events"
  on public.chain_of_custody_events for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.can_access_alteration_work_order(alteration_id)
    and (
      (public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
        and event_type in ('received','handed_to_workshop','returned_to_retailer','released_to_customer','delivery_dispatch','delivery_complete'))
      or (public.current_retailer_role() = 'workshop_manager'
        and event_type in ('handed_to_workshop','returned_to_retailer'))
    )
  );
create policy "platform staff can read custody events"
  on public.chain_of_custody_events for select using (public.is_platform_staff());

create policy "authorized staff can read completion reviews"
  on public.completion_reviews for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read completion reviews"
  on public.completion_reviews for select using (public.is_platform_staff());

create policy "authorized staff can read fulfillment events"
  on public.alteration_fulfillment_events for select using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "retailer oversight can record fulfillment events"
  on public.alteration_fulfillment_events for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.current_retailer_role() in ('owner','admin','manager','sales_associate','production_staff')
  );
create policy "platform staff can read fulfillment events"
  on public.alteration_fulfillment_events for select using (public.is_platform_staff());

create policy "retailer management can read their audit log"
  on public.audit_log_entries for select
  using (retailer_id = public.current_retailer_id() and public.is_alterations_management());
create policy "platform staff can read all audit logs"
  on public.audit_log_entries for select using (public.is_platform_staff());

create or replace function public.is_valid_alteration_transition(
  p_from public.alteration_work_order_status,
  p_to public.alteration_work_order_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'intake' then p_to in ('quoted', 'canceled')
    when 'quoted' then p_to in ('awaiting_approval', 'approved', 'canceled')
    when 'awaiting_approval' then p_to in ('approved', 'canceled')
    when 'approved' then p_to in ('assigned', 'canceled')
    when 'assigned' then p_to in ('in_progress', 'canceled')
    when 'in_progress' then p_to in ('completion_review', 'canceled')
    when 'completion_review' then p_to in ('in_progress', 'ready_for_pickup', 'out_for_delivery', 'canceled')
    when 'ready_for_pickup' then p_to in ('completed', 'canceled')
    when 'out_for_delivery' then p_to in ('completed', 'canceled')
    else false
  end
$$;

create or replace function public.enforce_work_order_status_via_history()
returns trigger
language plpgsql
as $$
begin
  if new.original_quote_amount_minor_units is distinct from old.original_quote_amount_minor_units
    or new.original_quote_currency is distinct from old.original_quote_currency
  then
    raise exception 'The original work-order quote is immutable';
  end if;
  if auth.role() = 'service_role' or current_user <> session_user or public.is_platform_staff() then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.agreed_total_amount_minor_units is distinct from old.agreed_total_amount_minor_units
    or new.agreed_total_currency is distinct from old.agreed_total_currency
    or new.canceled_at is distinct from old.canceled_at
    or new.cancellation_reason is distinct from old.cancellation_reason
  then
    raise exception 'Work-order status and agreed pricing may only change through validated workflow functions';
  end if;
  return new;
end;
$$;

create trigger enforce_work_order_status_via_history_on_update
  before update on public.alteration_work_orders
  for each row execute function public.enforce_work_order_status_via_history();

create or replace function public.enforce_alteration_task_immutable_scope()
returns trigger
language plpgsql
as $$
begin
  if new.alteration_id is distinct from old.alteration_id
    or new.retailer_id is distinct from old.retailer_id
    or new.operation_id is distinct from old.operation_id
    or new.title is distinct from old.title
    or new.instructions is distinct from old.instructions
    or new.classification is distinct from old.classification
    or new.original_quote_amount_minor_units is distinct from old.original_quote_amount_minor_units
    or new.original_quote_currency is distinct from old.original_quote_currency
  then
    raise exception 'Alteration task scope and original quote are immutable';
  end if;
  return new;
end;
$$;

create trigger enforce_alteration_task_immutable_scope_on_update
  before update on public.alteration_tasks
  for each row execute function public.enforce_alteration_task_immutable_scope();

create or replace function public.enforce_alteration_custody_workflow()
returns trigger
language plpgsql
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_last_event public.custody_event_type;
begin
  select * into v_order
  from public.alteration_work_orders
  where id = new.alteration_id and deleted_at is null;
  if v_order.id is null or v_order.retailer_id <> new.retailer_id then
    raise exception 'Custody event must belong to the work order retailer';
  end if;
  select event_type into v_last_event
  from public.chain_of_custody_events
  where alteration_id = new.alteration_id
  order by occurred_at desc, id desc
  limit 1;
  if new.event_type = 'received' and v_order.status <> 'intake' then
    raise exception 'Garments may only be received during intake';
  elsif new.event_type = 'received' and v_last_event is not null then
    raise exception 'Garment receipt has already been recorded';
  elsif new.event_type = 'handed_to_workshop' and v_order.status not in ('assigned','in_progress') then
    raise exception 'Garment handoff to workshop requires assigned work';
  elsif new.event_type = 'handed_to_workshop' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Workshop handoff must follow retailer custody';
  elsif new.event_type = 'returned_to_retailer' and v_order.status not in ('in_progress','completion_review') then
    raise exception 'Workshop return requires work in progress or completion review';
  elsif new.event_type = 'returned_to_retailer' and v_last_event is distinct from 'handed_to_workshop' then
    raise exception 'Workshop return must follow a workshop handoff';
  elsif new.event_type = 'released_to_customer' and v_order.status <> 'ready_for_pickup' then
    raise exception 'Customer release requires ready-for-pickup status';
  elsif new.event_type = 'released_to_customer' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Customer release requires retailer custody';
  elsif new.event_type in ('delivery_dispatch','delivery_complete') and v_order.status <> 'out_for_delivery' then
    raise exception 'Delivery custody events require out-for-delivery status';
  elsif new.event_type = 'delivery_dispatch' and (
    v_last_event is null or v_last_event not in ('received','returned_to_retailer')
  ) then
    raise exception 'Delivery dispatch requires retailer custody';
  elsif new.event_type = 'delivery_complete' and v_last_event is distinct from 'delivery_dispatch' then
    raise exception 'Delivery completion must follow dispatch';
  end if;
  if new.event_type in ('released_to_customer','delivery_complete')
    and nullif(trim(new.to_party), '') is null
  then raise exception 'Release recipient is required'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_custody_workflow_on_insert
  before insert on public.chain_of_custody_events
  for each row execute function public.enforce_alteration_custody_workflow();

create or replace function public.enforce_alteration_fulfillment_workflow()
returns trigger
language plpgsql
as $$
declare
  v_order public.alteration_work_orders%rowtype;
begin
  select * into v_order
  from public.alteration_work_orders
  where id = new.alteration_id and deleted_at is null;
  if v_order.id is null or v_order.retailer_id <> new.retailer_id then
    raise exception 'Fulfillment event must belong to the work order retailer';
  end if;
  if new.method = 'pickup' and new.status in ('ready','completed')
    and v_order.status <> 'ready_for_pickup'
  then raise exception 'Pickup readiness and completion require ready-for-pickup status'; end if;
  if new.method = 'delivery' and new.status in ('dispatched','completed')
    and v_order.status <> 'out_for_delivery'
  then raise exception 'Delivery dispatch and completion require out-for-delivery status'; end if;
  if new.status = 'dispatched' and new.method <> 'delivery' then
    raise exception 'Only delivery fulfillment can be dispatched';
  end if;
  if new.method = 'delivery' and new.status <> 'canceled'
    and new.delivery_address is null
  then raise exception 'Delivery fulfillment requires an address'; end if;
  if new.method = 'pickup' and new.delivery_address is not null then
    raise exception 'Pickup fulfillment cannot carry a delivery address';
  end if;
  if new.status = 'completed' and (
    nullif(trim(new.released_to_name), '') is null
    or nullif(trim(new.verification_note), '') is null
  ) then raise exception 'Completed fulfillment requires recipient and verification'; end if;
  return new;
end;
$$;

create trigger enforce_alteration_fulfillment_workflow_on_insert
  before insert on public.alteration_fulfillment_events
  for each row execute function public.enforce_alteration_fulfillment_workflow();

create or replace function public.audit_alteration_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_retailer_id uuid := (v_row ->> 'retailer_id')::uuid;
  v_entity_id uuid := (v_row ->> 'id')::uuid;
begin
  insert into public.audit_log_entries (
    retailer_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, before_state, after_state
  ) values (
    v_retailer_id, auth.uid(), public.current_staff_id(),
    lower(tg_op), tg_table_name, v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_work_order_changes after insert or update on public.alteration_work_orders for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_retailer_staff_changes after insert or update on public.retailer_staff_members for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_workshop_changes after insert or update on public.workshops for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_task_changes after insert or update on public.alteration_tasks for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_task_notes after insert on public.alteration_task_notes for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_work_order_assignments after insert or update on public.work_order_assignments for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_price_proposals after insert or update on public.price_change_proposals for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_attachment_metadata after insert on public.alteration_attachments for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_custody_events after insert on public.chain_of_custody_events for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_completion_reviews after insert or update on public.completion_reviews for each row execute function public.audit_alteration_sensitive_change();
create trigger audit_fulfillment_events after insert or update on public.alteration_fulfillment_events for each row execute function public.audit_alteration_sensitive_change();

create or replace function public.audit_alteration_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid := coalesce(
    (to_jsonb(new) ->> 'category_id')::uuid,
    (to_jsonb(new) ->> 'operation_id')::uuid
  );
begin
  insert into public.audit_log_entries (
    retailer_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, before_state, after_state
  ) values (
    new.retailer_id, auth.uid(), public.current_staff_id(), lower(tg_op),
    tg_table_name, v_entity_id,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger audit_alteration_category_settings
  after insert or update on public.retailer_alteration_category_settings
  for each row execute function public.audit_alteration_setting_change();
create trigger audit_alteration_operation_settings
  after insert or update on public.retailer_alteration_operation_settings
  for each row execute function public.audit_alteration_setting_change();

create or replace function public.create_alteration_intake(
  p_customer_id uuid,
  p_appointment_id uuid,
  p_source_kind public.garment_source_kind,
  p_category_code text,
  p_garment_type text,
  p_brand text,
  p_description text,
  p_identifying_photo_url text,
  p_label_metadata jsonb,
  p_intake_condition text,
  p_external_reference text,
  p_order_line_id uuid,
  p_supplier_order_reference text,
  p_due_date date,
  p_observations jsonb,
  p_tasks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid;
  v_currency text;
  v_staff_id uuid := public.current_staff_id();
  v_garment_id uuid;
  v_session_id uuid;
  v_work_order_id uuid;
  v_price_list_id uuid;
  v_price_list_currency text;
  v_quote bigint := 0;
  v_item jsonb;
  v_operation_id uuid;
  v_operation_name text;
  v_task_quote integer;
begin
  select c.retailer_id, r.default_currency
    into v_retailer_id, v_currency
  from public.customers c
  join public.retailers r on r.id = c.retailer_id
  where c.id = p_customer_id and c.deleted_at is null;

  if v_retailer_id is null then
    raise exception 'Customer not found';
  end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_retailer_id <> public.current_retailer_id()
    or not public.is_alterations_advisor()
  )
  then
    raise exception 'Not authorized to create an alteration intake';
  end if;
  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id
      and a.customer_id = p_customer_id
      and a.retailer_id = v_retailer_id
      and a.deleted_at is null
  ) then raise exception 'Fitting appointment does not belong to this customer'; end if;
  if length(trim(coalesce(p_garment_type, ''))) not between 2 and 120
    or length(trim(coalesce(p_description, ''))) not between 2 and 1000
    or length(trim(coalesce(p_intake_condition, ''))) not between 2 and 1000
  then raise exception 'Garment identification and condition are incomplete'; end if;
  if length(coalesce(p_brand, '')) > 120
    or length(coalesce(p_external_reference, '')) > 160
    or length(coalesce(p_supplier_order_reference, '')) > 160
  then raise exception 'Garment reference is too long'; end if;
  if p_label_metadata is not null and jsonb_typeof(p_label_metadata) <> 'object' then
    raise exception 'Label metadata must be a JSON object';
  end if;
  if not exists (
    select 1 from public.alteration_catalogue_categories c
    left join public.retailer_alteration_category_settings s
      on s.category_id = c.id and s.retailer_id = v_retailer_id
    where c.code = p_category_code and c.active and coalesce(s.enabled, true)
  ) then
    raise exception 'Garment category is not enabled';
  end if;
  if p_source_kind = 'finished_mtm' and p_order_line_id is null and nullif(trim(p_supplier_order_reference), '') is null then
    raise exception 'Finished MTM intake requires a PAON order line or supplier/order reference';
  end if;
  if p_order_line_id is not null and not exists (
    select 1 from public.order_lines l
    join public.orders o on o.id = l.order_id
    where l.id = p_order_line_id and o.customer_id = p_customer_id and o.retailer_id = v_retailer_id
  ) then
    raise exception 'PAON order line does not belong to this customer';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Tasks must be a JSON array';
  end if;
  if jsonb_array_length(p_tasks) not between 1 and 30
    or not exists (select 1 from jsonb_array_elements(p_tasks) x where x ->> 'classification' = 'work_now')
  then
    raise exception 'At least one work_now task is required';
  end if;
  if p_observations is null or jsonb_typeof(p_observations) <> 'array' then
    raise exception 'Observations must be a JSON array';
  end if;
  if jsonb_array_length(p_observations) not between 1 and 20 then
    raise exception 'At least one garment-specific observation is required';
  end if;

  select id, currency into v_price_list_id, v_price_list_currency
  from public.alteration_price_lists
  where retailer_id = v_retailer_id
    and kind = 'retailer'
    and active and deleted_at is null
    and effective_from <= current_date
    and (effective_until is null or effective_until >= current_date)
  order by effective_from desc, created_at desc
  limit 1;
  if v_price_list_id is not null then v_currency := v_price_list_currency; end if;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    if length(trim(coalesce(v_item ->> 'title', ''))) not between 2 and 160
      or length(coalesce(v_item ->> 'instructions', '')) > 2000
    then raise exception 'Task title or instructions are invalid'; end if;
    v_operation_id := nullif(v_item ->> 'operationId', '')::uuid;
    if v_operation_id is not null and not exists (
      select 1 from public.alteration_operations o
      join public.alteration_catalogue_categories c on c.id = o.category_id
      left join public.retailer_alteration_operation_settings s
        on s.operation_id = o.id and s.retailer_id = v_retailer_id
      where o.id = v_operation_id and c.code = p_category_code
        and o.active and coalesce(s.enabled, true)
    ) then
      raise exception 'Task operation is not enabled for this garment category';
    end if;
    if v_item ->> 'classification' not in ('work_now', 'future_order_note') then
      raise exception 'Invalid task classification';
    end if;
    if v_item ->> 'classification' = 'work_now' then
      select coalesce(i.amount_minor_units, 0) into v_task_quote
      from (select 1) seed
      left join public.alteration_price_list_items i
        on i.price_list_id = v_price_list_id and i.operation_id = v_operation_id;
      v_quote := v_quote + coalesce(v_task_quote, 0);
    end if;
  end loop;
  if v_quote > 2147483647 then raise exception 'Original quote exceeds the supported Money range'; end if;

  insert into public.physical_garments (
    retailer_id, customer_id, source_kind, category_code, garment_type,
    brand, description, identifying_photo_url, label_metadata,
    intake_condition, external_reference, order_line_id,
    supplier_order_reference
  ) values (
    v_retailer_id, p_customer_id, p_source_kind, p_category_code,
    trim(p_garment_type), nullif(trim(p_brand), ''), trim(p_description),
    nullif(trim(p_identifying_photo_url), ''), coalesce(p_label_metadata, '{}'::jsonb),
    trim(p_intake_condition), nullif(trim(p_external_reference), ''),
    p_order_line_id, nullif(trim(p_supplier_order_reference), '')
  ) returning id into v_garment_id;

  insert into public.fitting_sessions (
    retailer_id, customer_id, appointment_id, fitted_by_staff_id, notes
  ) values (
    v_retailer_id, p_customer_id, p_appointment_id, v_staff_id,
    'Alteration intake fitting'
  )
  returning id into v_session_id;

  for v_item in select value from jsonb_array_elements(p_observations)
  loop
    if v_item ->> 'classification' not in ('work_now', 'future_order_note')
      or length(trim(coalesce(v_item ->> 'area', ''))) not between 2 and 120
      or length(trim(coalesce(v_item ->> 'observation', ''))) not between 2 and 2000
    then raise exception 'Fitting observation is invalid'; end if;
    insert into public.fitting_observations (
      retailer_id, fitting_session_id, physical_garment_id, classification,
      area, observation, recorded_by_staff_id
    ) values (
      v_retailer_id, v_session_id, v_garment_id,
      (v_item ->> 'classification')::public.work_classification,
      trim(v_item ->> 'area'), trim(v_item ->> 'observation'), v_staff_id
    );
  end loop;

  insert into public.alteration_work_orders (
    retailer_id, customer_id, physical_garment_id, fitting_session_id,
    original_quote_amount_minor_units, original_quote_currency, due_date
  ) values (
    v_retailer_id, p_customer_id, v_garment_id, v_session_id,
    v_quote, v_currency, p_due_date
  ) returning id into v_work_order_id;

  for v_item in select value from jsonb_array_elements(p_tasks)
  loop
    v_operation_id := nullif(v_item ->> 'operationId', '')::uuid;
    select name into v_operation_name from public.alteration_operations where id = v_operation_id;
    select coalesce(i.amount_minor_units, 0) into v_task_quote
    from (select 1) seed
    left join public.alteration_price_list_items i
      on i.price_list_id = v_price_list_id and i.operation_id = v_operation_id;
    if v_item ->> 'classification' = 'future_order_note' then
      v_task_quote := 0;
    end if;
    insert into public.alteration_tasks (
      alteration_id, retailer_id, operation_id, title, instructions,
      classification, original_quote_amount_minor_units, original_quote_currency
    ) values (
      v_work_order_id, v_retailer_id, v_operation_id,
      coalesce(nullif(trim(v_item ->> 'title'), ''), v_operation_name),
      nullif(trim(v_item ->> 'instructions'), ''),
      (v_item ->> 'classification')::public.work_classification,
      coalesce(v_task_quote, 0), v_currency
    );
  end loop;

  insert into public.alteration_status_history (
    alteration_id, retailer_id, to_status, note, actor_staff_id,
    actor_user_id, customer_visible
  ) values (
    v_work_order_id, v_retailer_id, 'intake', 'Garment received and fitting recorded',
    v_staff_id, auth.uid(), false
  );
  insert into public.alteration_pricing_history (
    alteration_id, retailer_id, event_type, amount_minor_units, currency,
    reason, actor_staff_id
  ) values (
    v_work_order_id, v_retailer_id, 'original_quote', v_quote, v_currency,
    'Effective retailer price list at intake', v_staff_id
  );
  insert into public.chain_of_custody_events (
    alteration_id, retailer_id, event_type, from_party, to_party,
    condition_note, actor_staff_id
  ) values (
    v_work_order_id, v_retailer_id, 'received', 'Customer', 'Retailer',
    p_intake_condition, v_staff_id
  );

  return v_work_order_id;
end;
$$;

revoke all on function public.create_alteration_intake(uuid, uuid, public.garment_source_kind, text, text, text, text, text, jsonb, text, text, uuid, text, date, jsonb, jsonb) from public;
grant execute on function public.create_alteration_intake(uuid, uuid, public.garment_source_kind, text, text, text, text, text, jsonb, text, text, uuid, text, date, jsonb, jsonb) to authenticated, service_role;

create or replace function public.transition_alteration_work_order(
  p_alteration_id uuid,
  p_to_status public.alteration_work_order_status,
  p_note text,
  p_customer_visible boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_role text := public.current_retailer_role();
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null for update;
  if v_order.id is null then raise exception 'Work order not found'; end if;
  if auth.role() <> 'service_role' and (public.is_platform_staff() or not public.can_access_alteration_work_order(p_alteration_id)) then
    raise exception 'Not authorized for this work order';
  end if;
  if not public.is_valid_alteration_transition(v_order.status, p_to_status) then
    raise exception 'Invalid alteration transition: % to %', v_order.status, p_to_status;
  end if;
  if p_to_status = 'canceled' and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'A cancellation reason is required';
  end if;
  if p_to_status = 'assigned' then
    raise exception 'Use assign_alteration_work_order to assign approved work';
  end if;
  if p_to_status = 'approved' and v_role not in ('owner','admin','manager') and auth.role() <> 'service_role' and not public.is_platform_staff() then
    raise exception 'Retailer management approval is required';
  end if;
  if v_role = 'worker' and p_to_status not in ('in_progress','completion_review') then
    raise exception 'Workers may only start assigned work or mark it review-ready';
  end if;
  if v_role = 'workshop_manager' and p_to_status not in ('in_progress','completion_review') then
    raise exception 'Workshop managers may only progress assigned work to retailer review';
  end if;
  if v_role in ('workshop_manager','worker') and p_to_status = 'in_progress'
    and coalesce((
      select latest.event_type is distinct from 'handed_to_workshop'
      from public.chain_of_custody_events latest
      where latest.alteration_id = p_alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    ), true)
  then raise exception 'Workshop custody is required before work starts'; end if;
  if v_role = 'sales_associate' and (
    v_order.status not in ('intake','quoted','awaiting_approval')
    or p_to_status not in ('quoted','awaiting_approval','canceled')
  ) then raise exception 'Advisors may only progress intake through quote or cancel before work begins'; end if;
  if p_to_status = 'completion_review' and exists (
    select 1 from public.alteration_tasks
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status not in ('review_ready','completed')
      and deleted_at is null
  ) then raise exception 'Every work-now task must be review-ready before completion review'; end if;
  if p_to_status = 'completion_review' and exists (
    select 1 from public.price_change_proposals
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null
  ) then raise exception 'Pending price proposals must be decided before completion review'; end if;
  if p_to_status in ('ready_for_pickup','out_for_delivery') and not exists (
    select 1
    from public.chain_of_custody_events c
    where c.id = (
      select latest.id
      from public.chain_of_custody_events latest
      where latest.alteration_id = p_alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    )
      and c.event_type in ('received','returned_to_retailer')
  ) then raise exception 'Retailer custody is required before release readiness'; end if;
  if p_to_status = 'completed' and not exists (
    select 1 from public.alteration_fulfillment_events f
    where f.alteration_id = p_alteration_id
      and f.status = 'completed'
      and f.deleted_at is null
      and (
        (v_order.status = 'ready_for_pickup' and f.method = 'pickup')
        or (v_order.status = 'out_for_delivery' and f.method = 'delivery')
      )
  ) then raise exception 'Verified pickup or delivery completion is required'; end if;
  if p_to_status = 'completed' and not exists (
    select 1 from public.chain_of_custody_events c
    where c.alteration_id = p_alteration_id
      and (
        (v_order.status = 'ready_for_pickup' and c.event_type = 'released_to_customer')
        or (v_order.status = 'out_for_delivery' and c.event_type = 'delivery_complete')
      )
  ) then raise exception 'Final chain-of-custody release is required'; end if;

  if p_to_status = 'completion_review' then
    insert into public.completion_reviews (alteration_id, retailer_id, status)
    values (p_alteration_id, v_order.retailer_id, 'pending');
  elsif v_order.status = 'completion_review' and p_to_status = 'in_progress' then
    update public.completion_reviews
    set status = 'changes_requested', notes = nullif(trim(p_note), ''),
        reviewed_by_staff_id = v_staff_id, reviewed_at = now()
    where id = (
      select id from public.completion_reviews
      where alteration_id = p_alteration_id and status = 'pending' and deleted_at is null
      order by created_at desc limit 1
    );
    if not found then raise exception 'Pending completion review not found'; end if;
  elsif v_order.status = 'completion_review' and p_to_status in ('ready_for_pickup','out_for_delivery') then
    update public.completion_reviews
    set status = 'approved', notes = nullif(trim(p_note), ''),
        reviewed_by_staff_id = v_staff_id, reviewed_at = now()
    where id = (
      select id from public.completion_reviews
      where alteration_id = p_alteration_id and status = 'pending' and deleted_at is null
      order by created_at desc limit 1
    );
    if not found then raise exception 'Pending completion review not found'; end if;
  end if;

  if p_to_status = 'canceled' then
    insert into public.alteration_pricing_history (
      alteration_id, task_id, retailer_id, event_type, amount_minor_units,
      currency, reason, actor_staff_id
    )
    select
      alteration_id, task_id, retailer_id, 'withdrawal', proposed_amount_minor_units,
      currency, 'Withdrawn because the work order was canceled: ' || trim(p_note),
      v_staff_id
    from public.price_change_proposals
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null;

    update public.price_change_proposals
    set status = 'withdrawn', decided_by_staff_id = v_staff_id,
        decided_at = now(), decision_reason = 'Work order canceled: ' || trim(p_note)
    where alteration_id = p_alteration_id
      and status = 'pending'
      and deleted_at is null;
  end if;

  update public.alteration_work_orders
  set status = p_to_status,
      agreed_total_amount_minor_units = case when p_to_status = 'approved' then coalesce(agreed_total_amount_minor_units, original_quote_amount_minor_units) else agreed_total_amount_minor_units end,
      agreed_total_currency = case when p_to_status = 'approved' then coalesce(agreed_total_currency, original_quote_currency) else agreed_total_currency end,
      customer_notification_ready_at = case when p_to_status in ('ready_for_pickup','out_for_delivery') then coalesce(customer_notification_ready_at, now()) else customer_notification_ready_at end,
      canceled_at = case when p_to_status = 'canceled' then now() else canceled_at end,
      cancellation_reason = case when p_to_status = 'canceled' then nullif(trim(p_note), '') else cancellation_reason end
  where id = p_alteration_id;

  if p_to_status = 'approved' then
    update public.alteration_tasks
    set status = 'approved',
        agreed_price_amount_minor_units = coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units),
        agreed_price_currency = coalesce(agreed_price_currency, original_quote_currency)
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and deleted_at is null;
  elsif v_order.status = 'completion_review' and p_to_status in ('ready_for_pickup','out_for_delivery') then
    update public.alteration_tasks
    set status = 'completed'
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status = 'review_ready'
      and deleted_at is null;
  elsif p_to_status = 'canceled' then
    update public.alteration_tasks
    set status = 'canceled'
    where alteration_id = p_alteration_id
      and classification = 'work_now'
      and status <> 'completed'
      and deleted_at is null;
  end if;

  insert into public.alteration_status_history (
    alteration_id, retailer_id, from_status, to_status, note,
    actor_staff_id, actor_user_id, customer_visible
  ) values (
    p_alteration_id, v_order.retailer_id, v_order.status, p_to_status,
    nullif(trim(p_note), ''), v_staff_id, auth.uid(),
    p_customer_visible or p_to_status in ('approved','ready_for_pickup','out_for_delivery','completed','canceled')
  );
end;
$$;

revoke all on function public.transition_alteration_work_order(uuid, public.alteration_work_order_status, text, boolean) from public;
grant execute on function public.transition_alteration_work_order(uuid, public.alteration_work_order_status, text, boolean) to authenticated, service_role;

create or replace function public.set_alteration_operation_price(
  p_operation_id uuid,
  p_amount_minor_units integer,
  p_workshop_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_currency text;
  v_list_currency text;
  v_list_id uuid;
  v_kind public.alteration_price_list_kind := case
    when p_workshop_id is null then 'retailer'::public.alteration_price_list_kind
    else 'workshop'::public.alteration_price_list_kind
  end;
begin
  if p_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if public.is_platform_staff() then raise exception 'Platform access is oversight-only for retailer pricing'; end if;
  if auth.role() <> 'service_role' and not public.is_platform_staff() and (
    v_retailer_id is null
    or (p_workshop_id is null and not public.is_alterations_management())
    or (p_workshop_id is not null and (public.current_retailer_role() <> 'workshop_manager' or p_workshop_id <> public.current_workshop_id()))
  ) then raise exception 'Not authorized to set this price'; end if;
  if not exists (
    select 1
    from public.alteration_operations o
    join public.alteration_catalogue_categories c on c.id = o.category_id
    left join public.retailer_alteration_category_settings cs
      on cs.category_id = c.id and cs.retailer_id = v_retailer_id
    left join public.retailer_alteration_operation_settings os
      on os.operation_id = o.id and os.retailer_id = v_retailer_id
    where o.id = p_operation_id
      and o.active and c.active
      and coalesce(cs.enabled, true)
      and coalesce(os.enabled, true)
  ) then raise exception 'Alteration operation is not enabled'; end if;
  select default_currency into v_currency from public.retailers where id = v_retailer_id;
  select id, currency into v_list_id, v_list_currency from public.alteration_price_lists
  where retailer_id = v_retailer_id and kind = v_kind and workshop_id is not distinct from p_workshop_id
    and active and deleted_at is null and effective_from <= current_date
    and (effective_until is null or effective_until >= current_date)
  order by effective_from desc, created_at desc limit 1;
  if v_list_id is not null then v_currency := v_list_currency; end if;
  if v_list_id is null then
    insert into public.alteration_price_lists (retailer_id, workshop_id, kind, name, currency)
    values (v_retailer_id, p_workshop_id, v_kind, case when p_workshop_id is null then 'Retail price list' else 'Workshop price list' end, v_currency)
    on conflict do nothing
    returning id into v_list_id;
    if v_list_id is null then
      select id into v_list_id
      from public.alteration_price_lists
      where retailer_id = v_retailer_id
        and kind = v_kind
        and workshop_id is not distinct from p_workshop_id
        and effective_from = current_date
        and deleted_at is null;
    end if;
  end if;
  insert into public.alteration_price_list_items (retailer_id, price_list_id, operation_id, amount_minor_units, currency)
  values (v_retailer_id, v_list_id, p_operation_id, p_amount_minor_units, v_currency)
  on conflict (price_list_id, operation_id) do update
    set amount_minor_units = excluded.amount_minor_units, currency = excluded.currency, updated_at = now();
  insert into public.audit_log_entries (retailer_id, actor_user_id, actor_staff_id, action, entity_type, entity_id, after_state)
  values (v_retailer_id, auth.uid(), public.current_staff_id(), 'set_price', 'alteration_operation', p_operation_id,
    jsonb_build_object('price_list_id', v_list_id, 'amount_minor_units', p_amount_minor_units, 'currency', v_currency));
end;
$$;

revoke all on function public.set_alteration_operation_price(uuid, integer, uuid) from public;
grant execute on function public.set_alteration_operation_price(uuid, integer, uuid) to authenticated;

create unique index one_pending_price_change_per_target
  on public.price_change_proposals (
    alteration_id,
    coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending' and deleted_at is null;

create or replace function public.propose_alteration_price_change(
  p_alteration_id uuid,
  p_task_id uuid,
  p_proposed_amount_minor_units integer,
  p_explanation text,
  p_evidence_attachment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_original integer;
  v_id uuid;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then raise exception 'Work order not found'; end if;
  if public.current_retailer_role() <> 'workshop_manager' and auth.role() <> 'service_role' then
    raise exception 'Only an assigned workshop manager may propose price changes';
  end if;
  if v_order.status not in ('assigned','in_progress') then
    raise exception 'Price changes may only be proposed while assigned work is active';
  end if;
  if length(trim(p_explanation)) < 10 then raise exception 'A substantive explanation is required'; end if;
  if p_proposed_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if p_evidence_attachment_id is not null and not exists (
    select 1 from public.alteration_attachments a
    where a.id = p_evidence_attachment_id
      and a.retailer_id = v_order.retailer_id
      and (
        a.alteration_id = p_alteration_id
        or a.physical_garment_id = v_order.physical_garment_id
        or exists (
          select 1 from public.alteration_tasks t
          where t.id = a.task_id and t.alteration_id = p_alteration_id
        )
      )
  ) then raise exception 'Evidence attachment does not belong to this work order'; end if;
  if p_task_id is not null then
    select original_quote_amount_minor_units into v_original from public.alteration_tasks where id = p_task_id and alteration_id = p_alteration_id;
    if v_original is null then raise exception 'Task not found on work order'; end if;
  else
    v_original := v_order.original_quote_amount_minor_units;
  end if;
  insert into public.price_change_proposals (
    alteration_id, task_id, retailer_id, original_amount_minor_units,
    proposed_amount_minor_units, currency, explanation, proposed_by_staff_id,
    evidence_attachment_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, v_original,
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id, p_evidence_attachment_id
  ) returning id into v_id;
  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, 'proposal',
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id
  );
  return v_id;
end;
$$;

revoke all on function public.propose_alteration_price_change(uuid, uuid, integer, text, uuid) from public;
grant execute on function public.propose_alteration_price_change(uuid, uuid, integer, text, uuid) to authenticated, service_role;

create or replace function public.decide_alteration_price_change(
  p_proposal_id uuid,
  p_decision public.price_change_proposal_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.price_change_proposals%rowtype;
  v_total integer;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_proposal from public.price_change_proposals where id = p_proposal_id and deleted_at is null for update;
  if v_proposal.id is null or v_proposal.status <> 'pending' then raise exception 'Pending proposal not found'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Decision reason is required'; end if;
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = v_proposal.alteration_id
      and w.status in ('assigned','in_progress')
      and w.deleted_at is null
  ) then raise exception 'Price proposals may only be decided while assigned work is active'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_proposal.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management approval is required'; end if;

  update public.price_change_proposals
  set status = p_decision, decided_by_staff_id = v_staff_id,
      decided_at = now(), decision_reason = trim(p_reason)
  where id = p_proposal_id;

  if p_decision = 'approved' then
    if v_proposal.task_id is not null then
      update public.alteration_tasks
      set agreed_price_amount_minor_units = v_proposal.proposed_amount_minor_units,
          agreed_price_currency = v_proposal.currency
      where id = v_proposal.task_id;
      select sum(coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units))
        into v_total from public.alteration_tasks
        where alteration_id = v_proposal.alteration_id and classification = 'work_now' and deleted_at is null;
    else
      v_total := v_proposal.proposed_amount_minor_units;
    end if;
    update public.alteration_work_orders
    set agreed_total_amount_minor_units = v_total,
        agreed_total_currency = v_proposal.currency
    where id = v_proposal.alteration_id;
  end if;

  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    v_proposal.alteration_id, v_proposal.task_id, v_proposal.retailer_id,
    case when p_decision = 'approved' then 'approval' else 'rejection' end,
    v_proposal.proposed_amount_minor_units, v_proposal.currency,
    trim(p_reason), v_staff_id
  );
end;
$$;

revoke all on function public.decide_alteration_price_change(uuid, public.price_change_proposal_status, text) from public;
grant execute on function public.decide_alteration_price_change(uuid, public.price_change_proposal_status, text) to authenticated, service_role;

create or replace function public.assign_alteration_work_order(
  p_alteration_id uuid,
  p_workshop_id uuid,
  p_target_completion_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null for update;
  if v_order.id is null then raise exception 'Work order not found'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_order.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management assignment is required'; end if;
  if auth.role() = 'service_role' and v_staff_id is null then
    select id into v_staff_id
    from public.retailer_staff_members
    where retailer_id = v_order.retailer_id
      and role in ('owner','admin','manager')
      and accepted_at is not null
      and deleted_at is null
    order by created_at
    limit 1;
  end if;
  if v_staff_id is null then raise exception 'An assigning staff actor is required'; end if;
  if v_order.status <> 'approved' then raise exception 'Only approved work orders can be assigned'; end if;
  if not exists (select 1 from public.workshops where id = p_workshop_id and retailer_id = v_order.retailer_id and status = 'active' and deleted_at is null) then
    raise exception 'Workshop not found';
  end if;
  update public.work_order_assignments set active = false where alteration_id = p_alteration_id and active;
  insert into public.work_order_assignments (
    alteration_id, retailer_id, workshop_id, assigned_worker_id,
    assigned_by_staff_id, target_completion_date
  ) values (
    p_alteration_id, v_order.retailer_id, p_workshop_id, null,
    v_staff_id, p_target_completion_date
  );
  update public.alteration_tasks set assigned_worker_id = null, status = 'assigned'
    where alteration_id = p_alteration_id and classification = 'work_now' and deleted_at is null;
  update public.alteration_work_orders set status = 'assigned' where id = p_alteration_id;
  insert into public.alteration_status_history (
    alteration_id, retailer_id, from_status, to_status, note,
    actor_staff_id, actor_user_id, customer_visible
  ) values (
    p_alteration_id, v_order.retailer_id, v_order.status, 'assigned',
    'Assigned to workshop', v_staff_id, auth.uid(), false
  );
end;
$$;

revoke all on function public.assign_alteration_work_order(uuid, uuid, date) from public;
grant execute on function public.assign_alteration_work_order(uuid, uuid, date) to authenticated, service_role;

create or replace function public.update_workshop_assignment(
  p_alteration_id uuid,
  p_worker_id uuid,
  p_target_completion_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.work_order_assignments%rowtype;
begin
  select * into v_assignment
  from public.work_order_assignments
  where alteration_id = p_alteration_id and active
  for update;

  if v_assignment.id is null then raise exception 'Active workshop assignment not found'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or public.current_retailer_role() <> 'workshop_manager'
    or v_assignment.retailer_id <> public.current_retailer_id()
    or v_assignment.workshop_id <> public.current_workshop_id()
  ) then raise exception 'Only the assigned workshop manager may update this assignment'; end if;
  if p_worker_id is not null and not exists (
    select 1 from public.retailer_staff_members
    where id = p_worker_id
      and retailer_id = v_assignment.retailer_id
      and workshop_id = v_assignment.workshop_id
      and role = 'worker'
      and accepted_at is not null
      and deleted_at is null
  ) then raise exception 'Worker is not authorized for this workshop'; end if;

  update public.work_order_assignments
  set assigned_worker_id = p_worker_id,
      target_completion_date = p_target_completion_date
  where id = v_assignment.id;

  -- Keep task authorization synchronized with the active assignment so a
  -- replaced worker immediately loses access to the order's actionable tasks.
  update public.alteration_tasks
  set assigned_worker_id = p_worker_id
  where alteration_id = p_alteration_id
    and classification = 'work_now'
    and deleted_at is null;
end;
$$;

revoke all on function public.update_workshop_assignment(uuid, uuid, date) from public;
grant execute on function public.update_workshop_assignment(uuid, uuid, date) to authenticated, service_role;

create or replace function public.update_alteration_task_status(
  p_task_id uuid,
  p_status public.alteration_task_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.alteration_tasks%rowtype;
  v_role text := public.current_retailer_role();
begin
  select * into v_task from public.alteration_tasks where id = p_task_id and deleted_at is null for update;
  if v_task.id is null or v_task.classification <> 'work_now' then raise exception 'Actionable task not found'; end if;
  if not public.can_access_alteration_work_order(v_task.alteration_id) then raise exception 'Not authorized for task'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_role not in ('owner','admin','manager','production_staff','workshop_manager','worker')
  )
  then raise exception 'This role cannot perform alteration work'; end if;
  if v_role = 'worker' and v_task.assigned_worker_id <> public.current_staff_id() then raise exception 'Worker is not assigned this task'; end if;
  if v_role in ('workshop_manager','worker') and p_status = 'in_progress'
    and coalesce((
      select latest.event_type is distinct from 'handed_to_workshop'
      from public.chain_of_custody_events latest
      where latest.alteration_id = v_task.alteration_id
      order by latest.occurred_at desc, latest.id desc
      limit 1
    ), true)
  then raise exception 'Workshop custody is required before task work starts'; end if;
  if p_status not in ('in_progress','review_ready') then raise exception 'Tasks may only be started or marked review-ready directly'; end if;
  if not (
    (v_task.status = 'assigned' and p_status = 'in_progress')
    or (v_task.status = 'in_progress' and p_status = 'review_ready')
    or (v_task.status = 'review_ready' and p_status = 'in_progress')
  ) then raise exception 'Invalid alteration task transition: % to %', v_task.status, p_status; end if;
  update public.alteration_tasks set status = p_status where id = p_task_id;
  if nullif(trim(p_note), '') is not null then
    if length(trim(p_note)) > 2000 then raise exception 'Work note is too long'; end if;
    insert into public.alteration_task_notes (
      alteration_id, task_id, retailer_id, note, actor_staff_id
    ) values (
      v_task.alteration_id, v_task.id, v_task.retailer_id,
      trim(p_note), public.current_staff_id()
    );
  end if;
end;
$$;

revoke all on function public.update_alteration_task_status(uuid, public.alteration_task_status, text) from public;
grant execute on function public.update_alteration_task_status(uuid, public.alteration_task_status, text) to authenticated, service_role;

create or replace function public.add_alteration_task_note(
  p_task_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.alteration_tasks%rowtype;
  v_note_id uuid;
begin
  select * into v_task
  from public.alteration_tasks
  where id = p_task_id and deleted_at is null;

  if v_task.id is null or v_task.classification <> 'work_now' then
    raise exception 'Actionable task not found';
  end if;
  if v_task.status not in ('assigned','in_progress','review_ready') then
    raise exception 'Work notes may only be added while a task is active';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'Work note must be between 1 and 2000 characters';
  end if;
  if not public.can_access_alteration_work_order(v_task.alteration_id) then
    raise exception 'Not authorized for task';
  end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or public.current_retailer_role() not in ('owner','admin','manager','production_staff','workshop_manager','worker')
    or (
      public.current_retailer_role() = 'worker'
      and v_task.assigned_worker_id <> public.current_staff_id()
    )
  ) then
    raise exception 'This role cannot add a work note';
  end if;

  insert into public.alteration_task_notes (
    alteration_id, task_id, retailer_id, note, actor_staff_id
  ) values (
    v_task.alteration_id, v_task.id, v_task.retailer_id,
    trim(p_note), public.current_staff_id()
  ) returning id into v_note_id;

  return v_note_id;
end;
$$;

revoke all on function public.add_alteration_task_note(uuid, text) from public;
grant execute on function public.add_alteration_task_note(uuid, text) to authenticated, service_role;

-- Workers receive purpose-built projections with no customer record or pricing
-- columns. Their base-table policies are intentionally false even when they
-- are assigned to the work order.
create view public.worker_alteration_work_orders
with (security_barrier = true)
as
select
  w.id,
  w.retailer_id,
  w.physical_garment_id,
  w.work_order_number,
  w.status,
  g.category_code,
  g.garment_type,
  g.brand,
  g.description,
  g.intake_condition,
  w.due_date,
  w.created_at,
  w.updated_at
from public.alteration_work_orders w
join public.physical_garments g on g.id = w.physical_garment_id
where public.current_retailer_role() = 'worker'
  and w.deleted_at is null
  and exists (
    select 1 from public.alteration_tasks t
    where t.alteration_id = w.id
      and t.assigned_worker_id = public.current_staff_id()
      and t.classification = 'work_now'
      and t.deleted_at is null
  );

create view public.worker_alteration_tasks
with (security_barrier = true)
as
select
  t.id,
  t.alteration_id,
  t.retailer_id,
  t.operation_id,
  t.title,
  t.instructions,
  t.classification,
  t.status,
  t.assigned_worker_id,
  t.created_at,
  t.updated_at
from public.alteration_tasks t
where public.current_retailer_role() = 'worker'
  and t.assigned_worker_id = public.current_staff_id()
  and t.classification = 'work_now'
  and t.deleted_at is null;

revoke all on public.worker_alteration_work_orders from public;
revoke all on public.worker_alteration_tasks from public;
grant select on public.worker_alteration_work_orders to authenticated;
grant select on public.worker_alteration_tasks to authenticated;

-- Customer Portal gets purpose-built safe projections, never base-table
-- access. Internal notes, unapproved pricing, workshop identities and evidence
-- are absent by construction.
create view public.customer_alteration_work_orders
with (security_barrier = true)
as
select
  w.id,
  w.retailer_id,
  w.customer_id,
  w.physical_garment_id,
  w.work_order_number,
  w.status,
  w.due_date,
  w.agreed_total_amount_minor_units,
  w.agreed_total_currency,
  w.customer_notification_ready_at,
  g.category_code,
  g.garment_type,
  g.brand,
  g.description,
  w.created_at,
  w.updated_at
from public.alteration_work_orders w
join public.physical_garments g on g.id = w.physical_garment_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and w.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create view public.customer_alteration_status_history
with (security_barrier = true)
as
select h.id, h.alteration_id, h.to_status, h.note, h.created_at
from public.alteration_status_history h
join public.alteration_work_orders w on w.id = h.alteration_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and h.customer_visible
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create view public.customer_alteration_fulfillment
with (security_barrier = true)
as
select f.id, f.alteration_id, f.method, f.status, f.scheduled_at, f.completed_at,
       f.delivery_address, f.released_to_name, f.created_at, f.updated_at
from public.alteration_fulfillment_events f
join public.alteration_work_orders w on w.id = f.alteration_id
join public.customers c on c.id = w.customer_id
where c.user_id = auth.uid()
  and f.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

revoke all on public.customer_alteration_work_orders from public;
revoke all on public.customer_alteration_status_history from public;
revoke all on public.customer_alteration_fulfillment from public;
grant select on public.customer_alteration_work_orders to authenticated;
grant select on public.customer_alteration_status_history to authenticated;
grant select on public.customer_alteration_fulfillment to authenticated;

-- RLS is the boundary, but removing grants from the archived tables ensures
-- no future permissive policy can accidentally reactivate the superseded model.
revoke all on public.legacy_customer_fit_profile_entries from authenticated, anon;
revoke all on public.legacy_alterations from authenticated, anon;
revoke all on public.legacy_alteration_updates from authenticated, anon;
-- PostgREST requires SQL privileges in addition to RLS policies. The local
-- stack's default privileges intentionally do not grant DML on newly created
-- tables, so grant it explicitly for base tables. RLS remains the authority
-- for anon/authenticated access; service_role bypasses RLS for trusted server
-- and test-fixture operations.
--
-- Views are deliberately excluded. Sensitive worker/customer projections in
-- 20260719000103 grant SELECT individually and must never inherit write access.
do $$
declare
  relation record;
begin
  for relation in
    select namespace.nspname as schema_name, class.relname as relation_name
    from pg_class as class
    join pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind in ('r', 'p')
  loop
    execute format(
      'grant select, insert, update, delete on table %I.%I to anon, authenticated, service_role',
      relation.schema_name,
      relation.relation_name
    );
  end loop;
end
$$;

create type public.loyalty_tier as enum ('member', 'silver', 'gold', 'platinum');
create type public.loyalty_entry_type as enum ('earn_purchase', 'earn_referral', 'earn_bonus', 'redeem_reward', 'adjustment_expiry', 'adjustment_manual');
create type public.reward_type as enum ('discount_percent', 'discount_fixed', 'gift', 'early_access');
create type public.redemption_status as enum ('issued', 'used', 'cancelled');
create type public.referral_status as enum ('invited', 'signed_up', 'first_purchase_completed', 'rewarded');

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null unique references public.retailers(id) on delete cascade,
  name text not null default 'Loyalty programme',
  enabled boolean not null default true,
  points_per_currency_unit integer not null default 1 check (points_per_currency_unit >= 0),
  referral_points integer not null default 500 check (referral_points >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create trigger set_loyalty_programs_updated_at before update on public.loyalty_programs for each row execute function public.set_updated_at();

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  tier public.loyalty_tier not null default 'member',
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier_anniversary_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, customer_id)
);
create index loyalty_accounts_customer_idx on public.loyalty_accounts(customer_id);
create trigger set_loyalty_accounts_updated_at before update on public.loyalty_accounts for each row execute function public.set_updated_at();

create table public.loyalty_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  type public.loyalty_entry_type not null,
  points integer not null check (points <> 0),
  related_order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_account_idx on public.loyalty_ledger_entries(loyalty_account_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  type public.reward_type not null,
  points_cost integer not null check (points_cost > 0),
  minimum_tier public.loyalty_tier,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index rewards_retailer_idx on public.rewards(retailer_id);
create trigger set_rewards_updated_at before update on public.rewards for each row execute function public.set_updated_at();

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  points_spent integer not null check (points_spent > 0),
  status public.redemption_status not null default 'issued',
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_at timestamptz not null default now(), used_at timestamptz
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  referring_customer_id uuid not null references public.customers(id) on delete cascade,
  referred_email text not null,
  referred_customer_id uuid references public.customers(id) on delete set null,
  status public.referral_status not null default 'invited',
  reward_id uuid references public.rewards(id) on delete set null,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, referring_customer_id, referred_email)
);
create index referrals_retailer_idx on public.referrals(retailer_id);
create trigger set_referrals_updated_at before update on public.referrals for each row execute function public.set_updated_at();

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger_entries enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.referrals enable row level security;

create policy "platform manages loyalty programs" on public.loyalty_programs for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty program" on public.loyalty_programs for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage loyalty program" on public.loyalty_programs for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));

create policy "platform manages loyalty accounts" on public.loyalty_accounts for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty accounts" on public.loyalty_accounts for select using (retailer_id = public.current_retailer_id());
create policy "customer reads own loyalty accounts" on public.loyalty_accounts for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

create policy "platform manages loyalty ledger" on public.loyalty_ledger_entries for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads loyalty ledger" on public.loyalty_ledger_entries for select using (exists (select 1 from public.loyalty_accounts a where a.id = loyalty_account_id and a.retailer_id = public.current_retailer_id()));
create policy "customer reads own loyalty ledger" on public.loyalty_ledger_entries for select using (exists (select 1 from public.loyalty_accounts a join public.customers c on c.id = a.customer_id where a.id = loyalty_account_id and c.user_id = auth.uid()));

create policy "platform manages rewards" on public.rewards for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads rewards" on public.rewards for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage rewards" on public.rewards for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));
create policy "customer reads active rewards" on public.rewards for select using (active and deleted_at is null and exists (select 1 from public.customers c where c.retailer_id = rewards.retailer_id and c.user_id = auth.uid()));

create policy "platform manages redemptions" on public.reward_redemptions for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads redemptions" on public.reward_redemptions for select using (exists (select 1 from public.loyalty_accounts a where a.id = loyalty_account_id and a.retailer_id = public.current_retailer_id()));
create policy "customer reads own redemptions" on public.reward_redemptions for select using (exists (select 1 from public.loyalty_accounts a join public.customers c on c.id = a.customer_id where a.id = loyalty_account_id and c.user_id = auth.uid()));

create policy "platform manages referrals" on public.referrals for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer reads referrals" on public.referrals for select using (retailer_id = public.current_retailer_id());
create policy "customer reads own referrals" on public.referrals for select using (exists (select 1 from public.customers c where c.id = referring_customer_id and c.user_id = auth.uid()));

create or replace function public.ensure_my_loyalty_account(p_retailer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_account_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'No customer relationship exists for this retailer'; end if;
  insert into public.loyalty_programs(retailer_id) values (p_retailer_id) on conflict (retailer_id) do nothing;
  insert into public.loyalty_accounts(retailer_id, customer_id) values (p_retailer_id, v_customer_id)
    on conflict (retailer_id, customer_id) do update set updated_at = public.loyalty_accounts.updated_at returning id into v_account_id;
  return v_account_id;
end $$;

create or replace function public.create_my_referral(p_retailer_id uuid, p_referred_email text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'No customer relationship exists for this retailer'; end if;
  if lower(p_referred_email) = lower(coalesce(auth.jwt()->>'email','')) then raise exception 'You cannot refer yourself'; end if;
  insert into public.referrals(retailer_id, referring_customer_id, referred_email)
    values (p_retailer_id, v_customer_id, lower(trim(p_referred_email)))
    on conflict (retailer_id, referring_customer_id, referred_email) do update set updated_at = now()
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.redeem_my_reward(p_reward_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_reward public.rewards%rowtype; v_customer_id uuid; v_account public.loyalty_accounts%rowtype; v_id uuid;
begin
  select * into v_reward from public.rewards where id = p_reward_id and active and deleted_at is null for update;
  if not found then raise exception 'Reward unavailable'; end if;
  select id into v_customer_id from public.customers where retailer_id = v_reward.retailer_id and user_id = auth.uid() and deleted_at is null;
  select * into v_account from public.loyalty_accounts where retailer_id = v_reward.retailer_id and customer_id = v_customer_id for update;
  if v_account.id is null or v_account.points_balance < v_reward.points_cost then raise exception 'Insufficient points'; end if;
  update public.loyalty_accounts set points_balance = points_balance - v_reward.points_cost where id = v_account.id;
  insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, note) values (v_account.id, 'redeem_reward', -v_reward.points_cost, 'Reward redeemed');
  insert into public.reward_redemptions(loyalty_account_id, reward_id, points_spent) values (v_account.id, v_reward.id, v_reward.points_cost) returning id into v_id;
  return v_id;
end $$;

create or replace function public.accrue_loyalty_on_delivered_order() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_program public.loyalty_programs%rowtype; v_account_id uuid; v_points integer;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;
  select * into v_program from public.loyalty_programs where retailer_id = new.retailer_id and enabled and deleted_at is null;
  if not found then return new; end if;
  insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, new.customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_account_id;
  v_points := floor(new.total_amount_minor_units / 100.0)::integer * v_program.points_per_currency_unit;
  if v_points > 0 and not exists (select 1 from public.loyalty_ledger_entries where related_order_id = new.id and type = 'earn_purchase') then
    insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, related_order_id, note) values (v_account_id, 'earn_purchase', v_points, new.id, 'Points earned from delivered order');
    update public.loyalty_accounts set points_balance = points_balance + v_points, lifetime_points = lifetime_points + v_points where id = v_account_id;
  end if;
  return new;
end $$;
create trigger accrue_loyalty_after_delivery after update of status on public.orders for each row execute function public.accrue_loyalty_on_delivered_order();

revoke all on function public.ensure_my_loyalty_account(uuid) from public;
revoke all on function public.create_my_referral(uuid, text) from public;
revoke all on function public.redeem_my_reward(uuid) from public;
grant execute on function public.ensure_my_loyalty_account(uuid) to authenticated, service_role;
grant execute on function public.create_my_referral(uuid, text) to authenticated, service_role;
grant execute on function public.redeem_my_reward(uuid) to authenticated, service_role;

grant select, insert, update, delete on public.loyalty_programs, public.loyalty_accounts, public.loyalty_ledger_entries, public.rewards, public.reward_redemptions, public.referrals to authenticated, service_role;
create type public.event_visibility as enum ('public', 'invite_only', 'vip_tier');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.event_rsvp_status as enum ('invited', 'attending', 'declined', 'attended');

create table public.retailer_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,
  venue_address text,
  visibility public.event_visibility not null default 'public',
  status public.event_status not null default 'draft',
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);
create index retailer_events_retailer_time_idx on public.retailer_events(retailer_id, starts_at);
create trigger set_retailer_events_updated_at before update on public.retailer_events for each row execute function public.set_updated_at();

create table public.event_rsvps (
  event_id uuid not null references public.retailer_events(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.event_rsvp_status not null default 'invited',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, customer_id)
);

alter table public.retailer_events enable row level security;
alter table public.event_rsvps enable row level security;

create or replace function public.is_my_event_invitation(p_event_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_rsvps r join public.customers c on c.id = r.customer_id where r.event_id = p_event_id and c.user_id = auth.uid());
$$;

create policy "platform manages retailer events" on public.retailer_events for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer staff read events" on public.retailer_events for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage events" on public.retailer_events for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));
create policy "public reads published public events" on public.retailer_events for select using (status = 'published' and visibility = 'public' and deleted_at is null);
create policy "customers read eligible published events" on public.retailer_events for select using (status = 'published' and deleted_at is null and exists (select 1 from public.customers c where c.retailer_id = retailer_events.retailer_id and c.user_id = auth.uid()) and (visibility = 'public' or (visibility = 'vip_tier' and exists (select 1 from public.loyalty_accounts a where a.retailer_id = retailer_events.retailer_id and a.customer_id in (select id from public.customers where user_id = auth.uid()) and a.tier in ('gold','platinum'))) or (visibility = 'invite_only' and public.is_my_event_invitation(retailer_events.id))));

create policy "platform manages event rsvps" on public.event_rsvps for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer staff read event rsvps" on public.event_rsvps for select using (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id()));
create policy "retailer managers manage event rsvps" on public.event_rsvps for all using (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'))) with check (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')));
create policy "customers read own event rsvps" on public.event_rsvps for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

create or replace function public.rsvp_to_event(p_event_id uuid, p_status public.event_rsvp_status) returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.retailer_events%rowtype; v_customer_id uuid; v_count integer;
begin
  if p_status not in ('attending','declined') then raise exception 'Invalid customer RSVP status'; end if;
  select * into v_event from public.retailer_events where id = p_event_id and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'Event unavailable'; end if;
  select id into v_customer_id from public.customers where retailer_id = v_event.retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then
    if v_event.visibility <> 'public' then raise exception 'This event requires an existing retailer relationship'; end if;
    insert into public.customers(retailer_id,user_id,full_name,email,lifecycle_stage,shipping_addresses,tags,acquisition_source)
      values (v_event.retailer_id, auth.uid(), coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->>'email','Event guest'), auth.jwt()->>'email', 'prospect', '[]'::jsonb, '{}', 'event') returning id into v_customer_id;
  end if;
  if v_event.visibility = 'vip_tier' and not exists (select 1 from public.loyalty_accounts where retailer_id = v_event.retailer_id and customer_id = v_customer_id and tier in ('gold','platinum')) then raise exception 'VIP tier required'; end if;
  if v_event.visibility = 'invite_only' and not exists (select 1 from public.event_rsvps where event_id = p_event_id and customer_id = v_customer_id) then raise exception 'Invitation required'; end if;
  if p_status = 'attending' and v_event.capacity is not null then select count(*) into v_count from public.event_rsvps where event_id = p_event_id and status = 'attending' and customer_id <> v_customer_id; if v_count >= v_event.capacity then raise exception 'Event is at capacity'; end if; end if;
  insert into public.event_rsvps(event_id,customer_id,status,responded_at) values (p_event_id,v_customer_id,p_status,now()) on conflict (event_id,customer_id) do update set status = excluded.status, responded_at = excluded.responded_at;
end $$;

revoke all on function public.rsvp_to_event(uuid, public.event_rsvp_status) from public;
revoke all on function public.is_my_event_invitation(uuid) from public;
grant execute on function public.is_my_event_invitation(uuid) to authenticated;
grant execute on function public.rsvp_to_event(uuid, public.event_rsvp_status) to authenticated, service_role;
grant select, insert, update, delete on public.retailer_events, public.event_rsvps to authenticated, service_role;
create table public.clienteling_notes (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_staff_id uuid not null references public.retailer_staff_members(id),
  body text not null check (char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index clienteling_notes_customer_idx on public.clienteling_notes(customer_id, pinned desc, created_at desc);
create trigger set_clienteling_notes_updated_at before update on public.clienteling_notes for each row execute function public.set_updated_at();
alter table public.clienteling_notes enable row level security;
create policy "platform reads clienteling notes" on public.clienteling_notes for select using (public.is_platform_staff());
create policy "retailer staff read clienteling notes" on public.clienteling_notes for select using (retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker'));
create policy "sales staff create clienteling notes" on public.clienteling_notes for insert with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('sales_associate','manager','admin','owner') and exists (select 1 from public.retailer_staff_members s where s.id = author_staff_id and s.user_id = auth.uid() and s.retailer_id = clienteling_notes.retailer_id and s.accepted_at is not null and s.deleted_at is null));
create policy "authors and managers update clienteling notes" on public.clienteling_notes for update using (retailer_id = public.current_retailer_id() and (exists (select 1 from public.retailer_staff_members s where s.id = author_staff_id and s.user_id = auth.uid()) or public.current_retailer_role() in ('manager','admin','owner'))) with check (retailer_id = public.current_retailer_id());
grant select, insert, update on public.clienteling_notes to authenticated, service_role;
create type public.message_sender_type as enum ('customer','staff','ai_assistant');
create type public.notification_channel as enum ('email','sms','push','in_app');
create type public.notification_category as enum ('order_update','production_update','alteration_update','appointment_reminder','loyalty_update','message','marketing','system');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, customer_id)
);
create index conversations_retailer_last_idx on public.conversations(retailer_id, last_message_at desc nulls last);
create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type public.message_sender_type not null,
  sender_staff_id uuid references public.retailer_staff_members(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  read_by_customer_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check ((sender_type = 'staff' and sender_staff_id is not null) or (sender_type = 'customer' and sender_user_id is not null) or sender_type = 'ai_assistant')
);
create index messages_conversation_time_idx on public.messages(conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  category public.notification_category not null,
  title text not null,
  body text not null,
  action_href text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at desc);
create trigger set_notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create or replace function public.protect_notification_recipient_update() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_platform_staff() then return new; end if;
  if new.id <> old.id or new.retailer_id <> old.retailer_id or new.recipient_user_id <> old.recipient_user_id or new.customer_id is distinct from old.customer_id or new.channel <> old.channel or new.category <> old.category or new.title <> old.title or new.body <> old.body or new.action_href is distinct from old.action_href or new.sent_at is distinct from old.sent_at or new.created_at <> old.created_at or new.deleted_at is distinct from old.deleted_at or new.read_at is null or (old.read_at is not null and new.read_at <> old.read_at) then raise exception 'Recipients may only mark a notification read'; end if;
  return new;
end $$;
create trigger protect_notification_recipient_columns before update on public.notifications for each row execute function public.protect_notification_recipient_update();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "platform reads conversations" on public.conversations for select using (public.is_platform_staff());
create policy "retailer staff read conversations" on public.conversations for select using (retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker'));
create policy "customers read own conversations" on public.conversations for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));
create policy "platform reads messages" on public.messages for select using (public.is_platform_staff());
create policy "participants read messages" on public.messages for select using (exists (select 1 from public.conversations c where c.id = conversation_id and ((c.retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker')) or exists (select 1 from public.customers cu where cu.id = c.customer_id and cu.user_id = auth.uid()))));
create policy "users read own notifications" on public.notifications for select using (recipient_user_id = auth.uid());
create policy "users mark own notifications read" on public.notifications for update using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());
create policy "platform reads notifications" on public.notifications for select using (public.is_platform_staff());

create or replace function public.get_or_create_my_conversation(p_retailer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship required'; end if;
  insert into public.conversations(retailer_id,customer_id) values (p_retailer_id,v_customer_id) on conflict (retailer_id,customer_id) do update set updated_at = public.conversations.updated_at returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_or_create_staff_conversation(p_customer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_retailer_id uuid; v_id uuid;
begin
  select retailer_id into v_retailer_id from public.customers where id = p_customer_id and deleted_at is null;
  if v_retailer_id is null or v_retailer_id <> public.current_retailer_id() or public.current_retailer_role() not in ('sales_associate','manager','admin','owner') then raise exception 'Not authorized'; end if;
  insert into public.conversations(retailer_id,customer_id) values (v_retailer_id,p_customer_id) on conflict (retailer_id,customer_id) do update set updated_at = public.conversations.updated_at returning id into v_id;
  return v_id;
end $$;

create or replace function public.send_conversation_message(p_conversation_id uuid, p_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_conversation public.conversations%rowtype; v_staff public.retailer_staff_members%rowtype; v_customer public.customers%rowtype; v_message_id uuid;
begin
  if length(trim(p_body)) < 1 or length(p_body) > 5000 then raise exception 'Message must contain 1 to 5000 characters'; end if;
  select * into v_conversation from public.conversations where id = p_conversation_id and deleted_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;
  select * into v_customer from public.customers where id = v_conversation.customer_id;
  select * into v_staff from public.retailer_staff_members where retailer_id = v_conversation.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_customer.user_id = auth.uid() then
    insert into public.messages(conversation_id,sender_type,sender_user_id,body,read_by_customer_at) values (p_conversation_id,'customer',auth.uid(),trim(p_body),now()) returning id into v_message_id;
    insert into public.notifications(retailer_id,recipient_user_id,customer_id,category,title,body,action_href,sent_at)
      select v_conversation.retailer_id,s.user_id,v_customer.id,'message','New customer message',left(trim(p_body),240),'/messages/'||p_conversation_id,now() from public.retailer_staff_members s where s.retailer_id = v_conversation.retailer_id and s.user_id is not null and s.accepted_at is not null and s.deleted_at is null and s.role in ('sales_associate','manager','admin','owner');
  elsif v_staff.id is not null and v_staff.role in ('sales_associate','manager','admin','owner') then
    insert into public.messages(conversation_id,sender_type,sender_staff_id,sender_user_id,body,read_by_staff_at) values (p_conversation_id,'staff',v_staff.id,auth.uid(),trim(p_body),now()) returning id into v_message_id;
    if v_customer.user_id is not null then insert into public.notifications(retailer_id,recipient_user_id,customer_id,category,title,body,action_href,sent_at) values (v_conversation.retailer_id,v_customer.user_id,v_customer.id,'message','New message',left(trim(p_body),240),'/messages/'||p_conversation_id,now()); end if;
  else raise exception 'Not authorized'; end if;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_message_id;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_conversation public.conversations%rowtype;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if exists (select 1 from public.customers where id = v_conversation.customer_id and user_id = auth.uid()) then update public.messages set read_by_customer_at = coalesce(read_by_customer_at,now()) where conversation_id = p_conversation_id and sender_type <> 'customer';
  elsif exists (select 1 from public.retailer_staff_members where retailer_id = v_conversation.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null and role not in ('workshop_manager','worker')) then update public.messages set read_by_staff_at = coalesce(read_by_staff_at,now()) where conversation_id = p_conversation_id and sender_type = 'customer';
  else raise exception 'Not authorized'; end if;
  update public.notifications set read_at = coalesce(read_at,now()) where recipient_user_id = auth.uid() and action_href = '/messages/'||p_conversation_id;
end $$;

revoke all on function public.get_or_create_my_conversation(uuid), public.get_or_create_staff_conversation(uuid), public.send_conversation_message(uuid,text), public.mark_conversation_read(uuid) from public;
grant execute on function public.get_or_create_my_conversation(uuid), public.get_or_create_staff_conversation(uuid), public.send_conversation_message(uuid,text), public.mark_conversation_read(uuid) to authenticated, service_role;
grant select, insert, update on public.conversations, public.messages, public.notifications to authenticated, service_role;
create table public.behavioral_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  name text not null check (length(name) between 1 and 100),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  source text not null check (source in ('customer_portal', 'retailer_portal', 'admin', 'server')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index behavioral_events_retailer_occurred_idx
  on public.behavioral_events (retailer_id, occurred_at desc);
create index behavioral_events_customer_occurred_idx
  on public.behavioral_events (customer_id, occurred_at desc)
  where customer_id is not null;

alter table public.behavioral_events enable row level security;

create policy "platform staff read behavioral events"
  on public.behavioral_events for select to authenticated
  using (public.is_platform_staff());

create policy "retailer managers read behavioral events"
  on public.behavioral_events for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create or replace function public.capture_behavioral_event(
  p_retailer_id uuid,
  p_name text,
  p_properties jsonb default '{}'::jsonb,
  p_source text default 'server',
  p_customer_id uuid default null,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_customer_id uuid := p_customer_id;
begin
  if p_name is null or length(p_name) not between 1 and 100 then
    raise exception 'Invalid event name';
  end if;
  if p_source not in ('customer_portal', 'retailer_portal', 'admin', 'server') then
    raise exception 'Invalid event source';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Event properties must be an object';
  end if;

  if auth.uid() is not null then
    if p_source = 'customer_portal' then
      select c.id into v_customer_id
      from public.customers c
      where c.retailer_id = p_retailer_id and c.user_id = auth.uid()
      limit 1;
    elsif p_source = 'retailer_portal' then
      if p_retailer_id <> public.current_retailer_id()
        or public.current_retailer_role() in ('workshop_manager', 'worker', 'read_only') then
        raise exception 'Not authorized to capture this event';
      end if;
      if v_customer_id is not null and not exists (
        select 1 from public.customers c
        where c.id = v_customer_id and c.retailer_id = p_retailer_id
      ) then
        raise exception 'Customer does not belong to retailer';
      end if;
    elsif not public.is_platform_staff() then
      raise exception 'Not authorized to capture this event';
    end if;
  elsif current_user not in ('service_role', 'postgres') then
    raise exception 'Authentication required';
  end if;

  insert into public.behavioral_events (
    retailer_id, customer_id, name, properties, source, occurred_at
  ) values (
    p_retailer_id, v_customer_id, p_name, coalesce(p_properties, '{}'::jsonb),
    p_source, p_occurred_at
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(uuid, text, jsonb, text, uuid, timestamptz) from public;
grant execute on function public.capture_behavioral_event(uuid, text, jsonb, text, uuid, timestamptz)
  to authenticated, service_role;

create or replace function public.get_retailer_analytics(
  p_retailer_id uuid,
  p_since timestamptz default (now() - interval '30 days')
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_staff() and (
    p_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner')
  ) then
    raise exception 'Not authorized to view retailer analytics';
  end if;

  select jsonb_build_object(
    'customers', (select count(*) from public.customers where retailer_id = p_retailer_id and deleted_at is null),
    'newCustomers', (select count(*) from public.customers where retailer_id = p_retailer_id and deleted_at is null and created_at >= p_since),
    'orders', (select count(*) from public.orders where retailer_id = p_retailer_id and deleted_at is null and created_at >= p_since),
    'revenueMinorUnits', coalesce((select sum(total_amount_minor_units) from public.orders where retailer_id = p_retailer_id and deleted_at is null and status in ('placed','in_production','ready_for_fulfillment','shipped','delivered','completed') and created_at >= p_since), 0),
    'appointments', (select count(*) from public.appointments where retailer_id = p_retailer_id and deleted_at is null and starts_at >= p_since),
    'openAlterations', (select count(*) from public.alteration_work_orders where retailer_id = p_retailer_id and status not in ('completed','canceled')),
    'eventRsvps', (select count(*) from public.event_rsvps er join public.retailer_events re on re.id = er.event_id where re.retailer_id = p_retailer_id and er.status = 'attending' and er.created_at >= p_since),
    'messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.retailer_id = p_retailer_id and m.created_at >= p_since),
    'behavioralEvents', (select count(*) from public.behavioral_events where retailer_id = p_retailer_id and occurred_at >= p_since)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_retailer_analytics(uuid, timestamptz) from public;
grant execute on function public.get_retailer_analytics(uuid, timestamptz) to authenticated, service_role;

comment on table public.behavioral_events is
  'Immutable retailer-scoped interaction signals for analytics and future personalisation; never a replacement for source business records.';
create or replace function public.get_platform_analytics(
  p_since timestamptz default (now() - interval '30 days')
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff access required';
  end if;

  select jsonb_build_object(
    'retailers', (select count(*) from public.retailers where deleted_at is null),
    'activeRetailers', (select count(*) from public.retailers where deleted_at is null and status = 'active'),
    'newRetailers', (select count(*) from public.retailers where deleted_at is null and created_at >= p_since),
    'customers', (select count(*) from public.customers where deleted_at is null),
    'newCustomers', (select count(*) from public.customers where deleted_at is null and created_at >= p_since),
    'orders', (select count(*) from public.orders where deleted_at is null and created_at >= p_since),
    'grossMerchandiseValueByCurrency', coalesce((select jsonb_object_agg(currency, total) from (select currency, sum(total_amount_minor_units) as total from public.orders where deleted_at is null and status in ('placed','in_production','ready_for_fulfillment','shipped','delivered','completed') and created_at >= p_since group by currency) totals), '{}'::jsonb),
    'appointments', (select count(*) from public.appointments where deleted_at is null and created_at >= p_since),
    'openAlterations', (select count(*) from public.alteration_work_orders where status not in ('completed','canceled')),
    'messages', (select count(*) from public.messages where created_at >= p_since),
    'behavioralEvents', (select count(*) from public.behavioral_events where occurred_at >= p_since)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_platform_analytics(timestamptz) from public;
grant execute on function public.get_platform_analytics(timestamptz) to authenticated, service_role;

comment on function public.get_platform_analytics(timestamptz) is
  'Cross-retailer operational adoption metrics, restricted to authenticated PAON platform staff.';
alter table public.platform_staff_members
  add column invited_at timestamptz not null default now(),
  add column accepted_at timestamptz;

-- Existing platform operators predate the acceptance flow and are already active.
update public.platform_staff_members set accepted_at = created_at;

create or replace function public.accept_platform_staff_invite(p_staff_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted_at timestamptz;
begin
  update public.platform_staff_members
  set accepted_at = coalesce(accepted_at, now())
  where id = p_staff_id
    and user_id = auth.uid()
    and deleted_at is null
  returning accepted_at into v_accepted_at;

  if v_accepted_at is null then
    raise exception 'No pending platform staff invitation found';
  end if;
  return v_accepted_at;
end;
$$;

revoke all on function public.accept_platform_staff_invite(uuid) from public;
grant execute on function public.accept_platform_staff_invite(uuid) to authenticated;
create or replace function public.update_product_catalogue(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_status public.product_status,
  p_is_made_to_order boolean,
  p_is_alterable boolean,
  p_primary_image_url text,
  p_collection_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
begin
  select retailer_id into v_retailer_id
  from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if v_retailer_id is null
    or v_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to update product';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_collection_ids, '{}'::uuid[])) collection_id
    where not exists (
      select 1 from public.collections c
      where c.id = collection_id
        and c.retailer_id = v_retailer_id
        and c.deleted_at is null
    )
  ) then
    raise exception 'Collection does not belong to retailer';
  end if;

  update public.products set
    name = p_name,
    slug = p_slug,
    description = p_description,
    status = p_status,
    is_made_to_order = p_is_made_to_order,
    is_alterable = p_is_alterable,
    primary_image_url = nullif(p_primary_image_url, '')
  where id = p_product_id;

  delete from public.product_collections where product_id = p_product_id;
  insert into public.product_collections (product_id, collection_id)
  select p_product_id, collection_id
  from unnest(coalesce(p_collection_ids, '{}'::uuid[])) collection_id;

  return p_product_id;
end;
$$;

revoke all on function public.update_product_catalogue(uuid, text, text, text, public.product_status, boolean, boolean, text, uuid[]) from public;
grant execute on function public.update_product_catalogue(uuid, text, text, text, public.product_status, boolean, boolean, text, uuid[]) to authenticated;
create unique index one_draft_cart_per_retailer_customer_idx
  on public.orders (retailer_id, customer_id)
  where status = 'draft' and deleted_at is null;

create unique index one_variant_per_order_idx
  on public.order_lines (order_id, product_variant_id);

create or replace function public.add_to_cart(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_quantity integer
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_variant public.product_variants;
  v_product public.products;
  v_customer_id uuid;
  v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  select pv.* into v_variant from public.product_variants pv
  where pv.id = p_variant_id and pv.deleted_at is null;
  select p.* into v_product from public.products p
  where p.id = v_variant.product_id and p.deleted_at is null
    and p.retailer_id = p_retailer_id and p.status = 'active';
  if v_variant.id is null or v_product.id is null then
    raise exception 'Product is not available from this retailer';
  end if;
  if not exists (select 1 from public.retailers r where r.id = p_retailer_id and r.status = 'active' and r.deleted_at is null) then
    raise exception 'Retailer is not open for orders';
  end if;

  select c.id into v_customer_id from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id) on conflict do nothing;
  end if;

  select o.id into v_order_id from public.orders o
  where o.retailer_id = p_retailer_id and o.customer_id = v_customer_id
    and o.status = 'draft' and o.deleted_at is null for update;
  if v_order_id is null then
    insert into public.orders (retailer_id, customer_id, order_number, status, channel, currency, subtotal_amount_minor_units, total_amount_minor_units)
    values (p_retailer_id, v_customer_id, public.next_order_number(), 'draft', 'online', v_variant.price_currency, 0, 0)
    returning id into v_order_id;
  elsif (select currency from public.orders where id = v_order_id) <> v_variant.price_currency then
    raise exception 'Cart items must use one currency';
  end if;

  insert into public.order_lines (order_id, product_variant_id, quantity, unit_price_amount_minor_units, unit_price_currency, requires_production, requires_alteration)
  values (v_order_id, v_variant.id, p_quantity, v_variant.price_amount_minor_units, v_variant.price_currency, v_product.is_made_to_order, v_product.is_alterable)
  on conflict (order_id, product_variant_id) do update
    set quantity = least(20, public.order_lines.quantity + excluded.quantity),
        unit_price_amount_minor_units = excluded.unit_price_amount_minor_units,
        unit_price_currency = excluded.unit_price_currency;

  update public.orders o set
    subtotal_amount_minor_units = totals.amount,
    total_amount_minor_units = totals.amount
  from (select coalesce(sum(quantity * unit_price_amount_minor_units), 0)::integer amount from public.order_lines where order_id = v_order_id) totals
  where o.id = v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.update_cart_line(p_line_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_order_id uuid;
begin
  if p_quantity is null or p_quantity < 0 or p_quantity > 20 then raise exception 'Quantity must be between 0 and 20'; end if;
  select ol.order_id into v_order_id from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  join public.customers c on c.id = o.customer_id
  where ol.id = p_line_id and o.status = 'draft' and c.user_id = auth.uid()
  for update of o;
  if v_order_id is null then raise exception 'Cart line not found'; end if;
  if p_quantity = 0 then delete from public.order_lines where id = p_line_id;
  else update public.order_lines set quantity = p_quantity where id = p_line_id; end if;
  update public.orders o set subtotal_amount_minor_units = totals.amount, total_amount_minor_units = totals.amount
  from (select coalesce(sum(quantity * unit_price_amount_minor_units), 0)::integer amount from public.order_lines where order_id = v_order_id) totals
  where o.id = v_order_id;
end;
$$;

create or replace function public.checkout_cart(p_order_id uuid, p_shipping_address jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_line record;
  v_total integer := 0;
  v_count integer := 0;
begin
  select o.* into v_order from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.id = p_order_id and o.status = 'draft' and o.deleted_at is null and c.user_id = auth.uid()
  for update of o;
  if v_order.id is null then raise exception 'Cart not found'; end if;
  if jsonb_typeof(p_shipping_address) <> 'object'
    or coalesce(trim(p_shipping_address ->> 'line1'), '') = ''
    or coalesce(trim(p_shipping_address ->> 'city'), '') = ''
    or coalesce(trim(p_shipping_address ->> 'postalCode'), '') = ''
    or length(coalesce(p_shipping_address ->> 'countryCode', '')) <> 2 then
    raise exception 'Complete shipping address required';
  end if;

  for v_line in
    select ol.*, pv.inventory_quantity, pv.price_amount_minor_units current_price,
      pv.price_currency current_currency, p.is_made_to_order, p.is_alterable, p.status product_status
    from public.order_lines ol
    join public.product_variants pv on pv.id = ol.product_variant_id and pv.deleted_at is null
    join public.products p on p.id = pv.product_id and p.deleted_at is null
    where ol.order_id = v_order.id and p.retailer_id = v_order.retailer_id
    for update of pv
  loop
    v_count := v_count + 1;
    if v_line.product_status <> 'active' then raise exception 'A cart item is no longer available'; end if;
    if v_line.current_currency <> v_order.currency then raise exception 'Cart currency mismatch'; end if;
    if not v_line.is_made_to_order and v_line.inventory_quantity < v_line.quantity then
      raise exception 'Not enough stock for a cart item';
    end if;
    if not v_line.is_made_to_order then
      update public.product_variants set inventory_quantity = inventory_quantity - v_line.quantity where id = v_line.product_variant_id;
    end if;
    update public.order_lines set unit_price_amount_minor_units = v_line.current_price,
      unit_price_currency = v_line.current_currency, requires_production = v_line.is_made_to_order,
      requires_alteration = v_line.is_alterable where id = v_line.id;
    v_total := v_total + (v_line.current_price * v_line.quantity);
  end loop;
  if v_count = 0 then raise exception 'Cart is empty'; end if;

  update public.orders set status = 'pending_payment', subtotal_amount_minor_units = v_total,
    total_amount_minor_units = v_total, shipping_address = p_shipping_address, placed_at = now()
  where id = v_order.id;
  update public.customers set lifecycle_stage = 'first_purchase' where id = v_order.customer_id and lifecycle_stage = 'prospect';
  return v_order.id;
end;
$$;

revoke all on function public.add_to_cart(uuid, uuid, integer) from public;
revoke all on function public.update_cart_line(uuid, integer) from public;
revoke all on function public.checkout_cart(uuid, jsonb) from public;
grant execute on function public.add_to_cart(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.update_cart_line(uuid, integer) to authenticated, service_role;
grant execute on function public.checkout_cart(uuid, jsonb) to authenticated, service_role;
-- ADR-025. Completes the referral acquisition journey ADR-017/
-- create_my_referral left as "invited": a referral now progresses to
-- signed_up when the referred email links to a Customer Portal login
-- at the referring retailer, to first_purchase_completed on that
-- customer's first delivered order there, and to rewarded once the
-- referrer's loyalty account is credited referral_points.

-- Signup matching: fires whenever a customers row gains a user_id
-- (insert with one already set — place_order/add_to_cart/
-- request_appointment's inline Customer creation — or an update from
-- link_my_customer_accounts linking an existing prospect record).
create or replace function public.match_referral_on_customer_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.referrals
    set referred_customer_id = new.id, status = 'signed_up'
    where retailer_id = new.retailer_id
      and status = 'invited'
      and referred_customer_id is null
      and lower(referred_email) = lower(new.email);

  return new;
end;
$$;

create trigger match_referral_after_customer_link
  after insert or update of user_id on public.customers
  for each row
  when (new.user_id is not null)
  execute function public.match_referral_on_customer_signup();

-- Purchase matching + reward issuance: extends the existing
-- "order reaches delivered" trigger (20260720000001_*) rather than
-- adding a second trigger on the same event — both concerns react to
-- the same transition and share the loyalty-account-ensure step.
create or replace function public.accrue_loyalty_on_delivered_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_account_id uuid;
  v_points integer;
  v_referral public.referrals%rowtype;
  v_referrer_account_id uuid;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;

  select * into v_program from public.loyalty_programs where retailer_id = new.retailer_id and enabled and deleted_at is null;
  if found then
    insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, new.customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_account_id;
    v_points := floor(new.total_amount_minor_units / 100.0)::integer * v_program.points_per_currency_unit;
    if v_points > 0 and not exists (select 1 from public.loyalty_ledger_entries where related_order_id = new.id and type = 'earn_purchase') then
      insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, related_order_id, note) values (v_account_id, 'earn_purchase', v_points, new.id, 'Points earned from delivered order');
      update public.loyalty_accounts set points_balance = points_balance + v_points, lifetime_points = lifetime_points + v_points where id = v_account_id;
    end if;
  end if;

  -- Referral conversion requires this to be the referred customer's
  -- first-ever delivered order at this retailer — a repeat purchase
  -- from an already-converted referral does not re-trigger a reward
  -- (status is no longer 'signed_up' once converted).
  select * into v_referral from public.referrals
    where referred_customer_id = new.customer_id
      and retailer_id = new.retailer_id
      and status = 'signed_up'
    for update;

  if found
    and not exists (
      select 1 from public.orders
      where customer_id = new.customer_id
        and retailer_id = new.retailer_id
        and status = 'delivered'
        and deleted_at is null
        and id <> new.id
    )
  then
    update public.referrals set status = 'first_purchase_completed' where id = v_referral.id;

    if v_program.id is not null and v_program.referral_points > 0 then
      insert into public.loyalty_accounts(retailer_id, customer_id) values (new.retailer_id, v_referral.referring_customer_id) on conflict (retailer_id, customer_id) do update set updated_at = now() returning id into v_referrer_account_id;
      insert into public.loyalty_ledger_entries(loyalty_account_id, type, points, note) values (v_referrer_account_id, 'earn_referral', v_program.referral_points, 'Referral reward: ' || v_referral.referred_email);
      update public.loyalty_accounts set points_balance = points_balance + v_program.referral_points, lifetime_points = lifetime_points + v_program.referral_points where id = v_referrer_account_id;
      update public.referrals set status = 'rewarded' where id = v_referral.id;
    end if;
  end if;

  return new;
end;
$$;
-- ADR-026. Wishlist/WishlistItem (docs/DOMAIN_MODEL.md Customer bounded
-- context) — a customer's saved products, one default wishlist per
-- customer, created lazily on first save.

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null default 'Wishlist',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index one_default_wishlist_per_customer_idx
  on public.wishlists (customer_id)
  where is_default and deleted_at is null;

create trigger set_wishlists_updated_at
  before update on public.wishlists
  for each row
  execute function public.set_updated_at();

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text,
  primary key (wishlist_id, product_variant_id)
);

alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

create policy "platform staff can manage all wishlists"
  on public.wishlists for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own wishlists"
  on public.wishlists for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = wishlists.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Wishlist is part of the Customer aggregate (docs/DOMAIN_MODEL.md) and
-- retailer staff already read the full CRM record at this same gate
-- (sales_associate+, docs/DATABASE.md) — a client's saved pieces are
-- clienteling-relevant the same way their order/appointment history is.
create policy "retailer staff can read their retailer's customer wishlists"
  on public.wishlists for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = wishlists.customer_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

create policy "platform staff can manage all wishlist items"
  on public.wishlist_items for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own wishlist items"
  on public.wishlist_items for select
  using (
    exists (
      select 1 from public.wishlists w
      join public.customers c on c.id = w.customer_id
      where w.id = wishlist_items.wishlist_id
        and c.user_id = auth.uid()
    )
  );

create policy "retailer staff can read their retailer's wishlist items"
  on public.wishlist_items for select
  using (
    exists (
      select 1 from public.wishlists w
      join public.customers c on c.id = w.customer_id
      where w.id = wishlist_items.wishlist_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

comment on table public.wishlists is
  'A customer''s saved-products list. Written only by toggle_wishlist_item().';
comment on table public.wishlist_items is
  'wishlists x product_variants. Written only by toggle_wishlist_item().';

-- The one write path for both tables — same "narrow RPC, inline
-- Customer creation on first interaction" shape as add_to_cart/
-- place_order/request_appointment (docs/DECISIONS.md ADR-012 family),
-- since saving to a wishlist may be a shopper's very first interaction
-- with a retailer, same as adding to cart.
create or replace function public.toggle_wishlist_item(
  p_retailer_id uuid,
  p_variant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_retailer_id uuid;
  v_customer_id uuid;
  v_wishlist_id uuid;
  v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select p.retailer_id into v_product_retailer_id
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id and pv.deleted_at is null and p.deleted_at is null;
  if v_product_retailer_id is null or v_product_retailer_id <> p_retailer_id then
    raise exception 'Product is not available from this retailer';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
    limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.wishlists (customer_id, name, is_default)
    values (v_customer_id, 'Wishlist', true)
    on conflict (customer_id) where is_default and deleted_at is null do nothing;
  select id into v_wishlist_id from public.wishlists
    where customer_id = v_customer_id and is_default and deleted_at is null;

  if exists (
    select 1 from public.wishlist_items
    where wishlist_id = v_wishlist_id and product_variant_id = p_variant_id
  ) then
    delete from public.wishlist_items
      where wishlist_id = v_wishlist_id and product_variant_id = p_variant_id;
    v_removed := true;
  else
    insert into public.wishlist_items (wishlist_id, product_variant_id)
      values (v_wishlist_id, p_variant_id);
  end if;

  return not v_removed;
end;
$$;

revoke all on function public.toggle_wishlist_item(uuid, uuid) from public;
grant execute on function public.toggle_wishlist_item(uuid, uuid) to authenticated, service_role;

grant select, insert, update, delete on public.wishlists, public.wishlist_items to authenticated, service_role;
-- Storefront collection browsing (docs/PROJECT_STATE.md's "assigning a
-- product to a collection from the storefront" gap, closed by this
-- slice). Same "anyone can read the publicly showable subset" shape as
-- 20260719000013_add_public_storefront_read_policies.sql (ADR-014) —
-- extended here to collections and the product_collections join table,
-- neither of which had a public policy yet because nothing on the
-- storefront read them before now.

create policy "anyone can read collections of active retailers"
  on public.collections for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.retailers r
      where r.id = collections.retailer_id
        and r.status = 'active'
    )
  );

create policy "anyone can read product collection links for public products"
  on public.product_collections for select
  using (
    exists (
      select 1 from public.products p
      join public.retailers r on r.id = p.retailer_id
      where p.id = product_collections.product_id
        and p.status = 'active'
        and r.status = 'active'
    )
  );
-- CustomerPreferences (docs/DOMAIN_MODEL.md Customer bounded context,
-- packages/domain/src/customer/customer.ts) — a shopper's own declared
-- locale/currency/communication/style preferences, persisted for the
-- first time in this slice. One row per Customer relationship (not per
-- User — a shopper's preferences for one retailer never leak into
-- another, same per-relationship shape as everything else in this
-- bounded context, see ADR-013).

create table public.customer_preferences (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  preferred_locale text not null default 'en-US',
  preferred_currency text not null default 'USD',
  communication_channels text[] not null default array['email'],
  style_notes text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_preferences_channels_valid check (
    communication_channels <@ array['email', 'sms', 'push', 'in_app']::text[]
  )
);

create trigger set_customer_preferences_updated_at
  before update on public.customer_preferences
  for each row
  execute function public.set_updated_at();

alter table public.customer_preferences enable row level security;

create policy "platform staff can manage all customer preferences"
  on public.customer_preferences for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- A customer manages their own preferences directly (no RPC needed —
-- unlike add_to_cart/toggle_wishlist_item, this never creates the
-- Customer row itself, only a row that references an existing one the
-- caller already owns, and there's no second table to write
-- transactionally). Same "self, via exists against the owning table"
-- shape as ADR-013.
create policy "a customer can read their own preferences"
  on public.customer_preferences for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "a customer can save their own preferences"
  on public.customer_preferences for insert
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "a customer can update their own preferences"
  on public.customer_preferences for update
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Retailer staff already read the full CRM record at sales_associate+
-- (docs/DATABASE.md) — communication opt-ins and style notes are
-- clienteling-relevant the same way wishlist/order/appointment history
-- already is (ADR-026).
create policy "retailer staff can read their retailer's customer preferences"
  on public.customer_preferences for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

-- PostgREST needs table-level SQL privileges in addition to RLS — this
-- table postdates 20260720000000's one-time blanket grant, so it needs
-- its own (see that migration's comment for the full reasoning).
grant select, insert, update, delete on public.customer_preferences
  to authenticated, service_role;
-- Direct product image upload (docs/PROJECT_STATE.md's last remaining
-- catalogue-editing gap: "Direct image upload remains deferred; the
-- hosted image URL field is validated until Storage is added").
-- products.primary_image_url (20260719000010_*) already stores a plain
-- URL string with no storage integration — this slice doesn't touch
-- that column or update_product_catalogue's write path at all, it only
-- adds a way to populate it with a real uploaded file's public URL
-- instead of requiring staff to type/host one themselves.
--
-- Unlike alteration-evidence (20260719000103_*, private + signed URLs,
-- because that content is internal workshop evidence), product photos
-- are customer-facing on the public storefront — same "publicly
-- showable, no `to` clause" shape ADR-014 gave products/retailers — so
-- this bucket is public and reads use `getPublicUrl`, never a signed URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "anyone can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Same "managers and above can manage their retailer's products" gate
-- as the products table itself (20260719000010_*) — an image is part
-- of the product record, not a separate permission surface. The path's
-- first folder segment is the retailer id, set by the upload Server
-- Action (`apps/retailer/app/(dashboard)/products/[id]/actions.ts`),
-- so no per-product ownership lookup is needed here (unlike alteration
-- evidence, there's no per-product staff assignment to check).
create policy "managers and above can upload their retailer's product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (
      public.is_platform_staff()
      or (
        (storage.foldername(name))[1] = public.current_retailer_id()::text
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
      )
    )
  );

create policy "managers and above can remove their retailer's product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (
      public.is_platform_staff()
      or (
        (storage.foldername(name))[1] = public.current_retailer_id()::text
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
      )
    )
  );
-- Stripe Connect Express customer payments (founder decision,
-- docs/DECISIONS.md ADR-030). Every retailer is merchant of record —
-- direct charges on their own connected account, never destination
-- charges — PAON only ever touches money via an optional
-- application_fee_amount, computed from platform_fee_basis_points.

create type public.payment_status as enum (
  'pending', 'authorized', 'captured', 'refunded', 'failed'
);

create table public.retailer_stripe_accounts (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  platform_fee_basis_points integer not null default 0
    check (platform_fee_basis_points between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_retailer_stripe_accounts_updated_at
  before update on public.retailer_stripe_accounts
  for each row
  execute function public.set_updated_at();

alter table public.retailer_stripe_accounts enable row level security;

create policy "platform staff can manage all retailer stripe accounts"
  on public.retailer_stripe_accounts for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "owner or admin can read their retailer's stripe account"
  on public.retailer_stripe_accounts for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

-- The initial row is written by the owner/admin-initiated "Connect with
-- Stripe" action (apps/retailer) after a real Stripe account already
-- exists — never a client-invented id, just the caller's own
-- already-created account's id being recorded. There is no update
-- policy for authenticated roles: charges_enabled/payouts_enabled/
-- details_submitted are only ever synced from the account.updated
-- webhook (service_role, bypasses RLS), and platform_fee_basis_points
-- is platform-staff-only, the same "platform-controlled field" shape
-- as Retailer.defaultCurrency (docs/PROJECT_STATE.md).
create policy "owner or admin can start connecting their stripe account"
  on public.retailer_stripe_accounts for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_stripe_accounts
  to authenticated, service_role;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_intent_id text not null,
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency text not null,
  platform_fee_amount_minor_units integer not null default 0
    check (platform_fee_amount_minor_units >= 0),
  status public.payment_status not null default 'pending',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_intent_id)
);

create trigger set_payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "platform staff can manage all payments"
  on public.payments for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.retailer_id = public.current_retailer_id()
    )
  );

create policy "a customer can read their own order's payment"
  on public.payments for select
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = payments.order_id
        and c.user_id = auth.uid()
    )
  );

-- No insert/update policy for authenticated — same "narrow RPC over
-- broadened policy" shape as place_order/checkout_cart (ADR-014/024):
-- a client asserting its own payment status is exactly what must never
-- be trusted. Only record_stripe_payment_event (service_role) writes here.
grant select, insert, update, delete on public.payments to authenticated, service_role;

-- Idempotency ledger: Stripe retries a webhook delivery until it gets a
-- 2xx, so the same event id can and will arrive more than once under
-- normal operation, not just after a crash.
create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

create policy "platform staff can read all stripe webhook events"
  on public.stripe_webhook_events for select
  using (public.is_platform_staff());

grant select, insert, update, delete on public.stripe_webhook_events
  to authenticated, service_role;

-- The only way a payments row or a pending_payment -> placed/refunded
-- order transition happens. Called only by the Customer Portal Stripe
-- webhook Route Handler using a service-role client — granted to
-- service_role only, never authenticated, since it must never be
-- triggerable by a normal user session (same reasoning as every other
-- "narrow RPC over broadened policy" function, ADR-012/013/014/024).
-- MVP scope: one payments row per order (unique order_id) — a later
-- payment retry after a failed attempt updates that same row rather
-- than creating a new one; multi-attempt/partial-refund history is a
-- future enhancement, not modeled speculatively now.
create or replace function public.record_stripe_payment_event(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_provider_payment_intent_id text,
  p_amount_minor_units integer,
  p_currency text,
  p_status public.payment_status,
  p_platform_fee_amount_minor_units integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  insert into public.stripe_webhook_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    -- Already processed this exact Stripe event — redelivery, no-op.
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.currency <> p_currency
    or v_order.total_amount_minor_units <> p_amount_minor_units
  then
    raise exception 'Payment amount/currency does not match order %', p_order_id;
  end if;

  insert into public.payments (
    order_id, provider, provider_payment_intent_id,
    amount_minor_units, currency, platform_fee_amount_minor_units,
    status, captured_at
  )
  values (
    p_order_id, 'stripe', p_provider_payment_intent_id,
    p_amount_minor_units, p_currency, p_platform_fee_amount_minor_units,
    p_status, case when p_status = 'captured' then now() else null end
  )
  on conflict (order_id) do update
    set status = excluded.status,
        provider_payment_intent_id = excluded.provider_payment_intent_id,
        captured_at = coalesce(public.payments.captured_at, excluded.captured_at);

  if p_status = 'captured' and v_order.status = 'pending_payment' then
    update public.orders
      set status = 'placed', placed_at = coalesce(placed_at, now())
      where id = p_order_id;
  elsif p_status = 'refunded' and v_order.status not in ('refunded', 'canceled') then
    update public.orders set status = 'refunded' where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.record_stripe_payment_event(
  text, text, uuid, text, integer, text, public.payment_status, integer
) from public;
grant execute on function public.record_stripe_payment_event(
  text, text, uuid, text, integer, text, public.payment_status, integer
) to service_role;

comment on function public.record_stripe_payment_event is
  'The only way a payments row or a pending_payment->placed/refunded order transition happens. Called only by the Stripe webhook Route Handler (service_role). Idempotent at both the Stripe event level (stripe_webhook_events) and the payment-record level (unique order_id).';
-- Stripe Billing for retailer subscriptions (founder decision,
-- docs/DECISIONS.md ADR-031). PAON's own platform Stripe account —
-- the reverse money direction from 20260720000015_*'s Connect payments
-- (a retailer paying PAON, not a customer paying the retailer).

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  price_amount_minor_units integer not null check (price_amount_minor_units >= 0),
  price_currency text not null,
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  included_feature_keys text[] not null default '{}',
  seat_limit integer,
  -- Absent until a platform operator creates the real Stripe Price in
  -- the dashboard and records its id here — a retailer cannot be
  -- subscribed to a plan with no price yet (see
  -- docs/PROJECT_STATE.md "Credentials needed").
  provider_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_subscription_plans_updated_at
  before update on public.subscription_plans
  for each row
  execute function public.set_updated_at();

alter table public.subscription_plans enable row level security;

create policy "platform staff can manage all subscription plans"
  on public.subscription_plans for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- Not tenant-scoped data — PAON's own product catalog, the same way
-- any retailer knowing PAON's pricing tiers exist isn't sensitive. No
-- `anon` access: nothing public-facing shows this yet (no storefront
-- pricing page), so keep it authenticated-only until something needs more.
create policy "authenticated users can read subscription plans"
  on public.subscription_plans for select
  to authenticated
  using (true);

grant select, insert, update, delete on public.subscription_plans
  to authenticated, service_role;

insert into public.subscription_plans (
  key, name, price_amount_minor_units, price_currency, billing_interval, included_feature_keys, seat_limit
)
values
  ('boutique_monthly', 'Boutique', 29900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments'], 5),
  ('house_monthly', 'House', 79900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments', 'alterations', 'loyalty'], 20),
  ('maison_monthly', 'Maison', 199900, 'USD', 'monthly',
    array['catalog', 'orders', 'appointments', 'alterations', 'loyalty', 'analytics', 'messaging'], null);

create table public.retailer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null unique references public.retailers (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_customer_id text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_retailer_subscriptions_updated_at
  before update on public.retailer_subscriptions
  for each row
  execute function public.set_updated_at();

alter table public.retailer_subscriptions enable row level security;

-- No narrow RPC needed here, unlike payments (20260720000015_*):
-- assignment is platform-staff-initiated (already fully covered by the
-- "manage all" policy below) and the webhook sync is a single-table,
-- no-business-validation update, the same shape as
-- retailer_stripe_accounts.syncCapabilities — neither needs the
-- "two tables, one client call" transactional guarantee an RPC exists for.
create policy "platform staff can manage all retailer subscriptions"
  on public.retailer_subscriptions for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "owner or admin can read their retailer's subscription"
  on public.retailer_subscriptions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_subscriptions
  to authenticated, service_role;
-- Resend transactional email (founder decision, docs/DECISIONS.md
-- ADR-032). Postgres triggers can't make HTTP calls, so this is an
-- outbox: every notifications insert (the one place notifications are
-- created, see 20260720000004_*'s send_conversation_message) enqueues
-- an email row here via an AFTER INSERT trigger; a scheduled Route
-- Handler (apps/admin, no live credentials needed to build) drains it.

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  html_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_pending_idx on public.email_outbox (created_at)
  where status = 'pending';

create trigger set_email_outbox_updated_at
  before update on public.email_outbox
  for each row
  execute function public.set_updated_at();

alter table public.email_outbox enable row level security;

create policy "platform staff can manage all email outbox rows"
  on public.email_outbox for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on public.email_outbox
  to authenticated, service_role;

-- One universal hook instead of instrumenting every RPC that creates a
-- notification (today, only send_conversation_message) — a future
-- notification-creating RPC gets email delivery for free. security
-- definer so it can read auth.users.email regardless of the inserting
-- caller's own privileges, the same reasoning every other
-- security-definer function in this schema already relies on.
create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_email text;
  v_wants_email boolean;
begin
  -- A customer recipient's own communication_channels preference
  -- (docs/DECISIONS.md ADR-028) gates delivery; no preferences row yet
  -- defaults to sending, matching that table's own "email" default.
  if new.customer_id is not null then
    select ('email' = any(cp.communication_channels)) into v_wants_email
      from public.customer_preferences cp
      where cp.customer_id = new.customer_id;
    if coalesce(v_wants_email, true) is false then
      return new;
    end if;
  end if;

  select email into v_recipient_email
    from auth.users
    where id = new.recipient_user_id;
  if v_recipient_email is null then
    return new;
  end if;

  insert into public.email_outbox (notification_id, recipient_email, subject, html_body)
  values (
    new.id,
    v_recipient_email,
    new.title,
    '<p>' || new.body || '</p>'
  );

  return new;
end;
$$;

create trigger enqueue_notification_email_after_insert
  after insert on public.notifications
  for each row
  execute function public.enqueue_notification_email();

-- Atomic claim: a single statement, not a select-then-update, so two
-- overlapping drain runs (e.g. a slow previous cron tick) can never
-- both pick up the same row — `for update skip locked` is what makes
-- that safe. service_role only, called from the scheduled Route
-- Handler, never from a browser-reachable path.
create or replace function public.claim_pending_emails(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.email_outbox
    set status = 'sending'
    where id in (
      select id from public.email_outbox
      where status = 'pending'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_pending_emails(integer) from public;
grant execute on function public.claim_pending_emails(integer) to service_role;
-- AI personalisation (founder decision, docs/DECISIONS.md ADR-033):
-- OpenAI behind a provider-neutral interface (@paon/ai). Every
-- generation attempt is recorded — success or failure — doubling as
-- both the per-customer history shown in Retailer Portal and the
-- cross-retailer monitoring surface in PAON Admin.

create type public.ai_generation_kind as enum (
  'next_best_action', 'product_recommendation', 'communication_draft'
);

create type public.ai_generation_status as enum ('succeeded', 'failed');

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  requested_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  kind public.ai_generation_kind not null,
  status public.ai_generation_status not null,
  provider text not null default 'openai',
  model text not null,
  input_summary text not null,
  output jsonb,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index ai_generations_retailer_created_idx
  on public.ai_generations (retailer_id, created_at desc);
create index ai_generations_customer_idx
  on public.ai_generations (customer_id, created_at desc)
  where customer_id is not null;

alter table public.ai_generations enable row level security;

create policy "platform staff can read all ai generations"
  on public.ai_generations for select
  using (public.is_platform_staff());

create policy "retailer staff can read their retailer's ai generations"
  on public.ai_generations for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
  );

-- Same "verify the caller's own accepted staff membership" shape as
-- clienteling_notes' insert policy — requested_by_staff_id must be the
-- caller's own row, never an arbitrary staff id within the retailer.
-- Direct RLS, no security-definer RPC: a single-table write scoped to
-- the caller's own retailer with no transactional fan-out, the same
-- reasoning ADR-028 gave customer_preferences.
create policy "sales staff and above can record ai generations"
  on public.ai_generations for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    and (
      requested_by_staff_id is null
      or exists (
        select 1 from public.retailer_staff_members s
        where s.id = requested_by_staff_id
          and s.user_id = auth.uid()
          and s.retailer_id = ai_generations.retailer_id
          and s.accepted_at is not null
          and s.deleted_at is null
      )
    )
  );

grant select, insert on public.ai_generations to authenticated, service_role;
-- Separate migration because PostgreSQL enum values cannot be referenced by
-- another statement until the ALTER TYPE transaction has committed (see
-- 20260719000100_add_workshop_roles.sql for the same constraint).
alter type public.message_sender_type add value if not exists 'guest';
-- TableService: an intent-driven lead-capture entry point on the public
-- storefront (`/r/[slug]`) for visitors who have never logged in. Reuses
-- the existing Conversation/Message model (ADR-034) rather than a new
-- messaging system — a guest inquiry becomes an ordinary conversation
-- the moment a Customer row exists for it, deduped by (retailer, email)
-- the same way `customers_retailer_email_idx` already dedupes elsewhere.
--
-- Deliberately no anonymous RLS insert policy on conversations/messages
-- (ADR-034: "no new anonymous RLS insert path, no auth bypass") — the
-- single `security definer` entry point below is the only way an
-- unauthenticated visitor can reach these tables, same shape as
-- `get_or_create_my_conversation` for logged-in customers.

alter table public.conversations
  add column intent text
  check (intent is null or intent in ('wedding', 'shirts', 'style_help', 'freeform'));

-- Widen the sender_type check (originally customer/staff/ai_assistant
-- only) to allow a 'guest' message with neither a staff nor a linked
-- portal user — found dynamically since it's an unnamed table-level
-- check constraint from the original CREATE TABLE.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sender_type%';
  if v_conname is not null then
    execute format('alter table public.messages drop constraint %I', v_conname);
  end if;
end $$;

alter table public.messages add constraint messages_sender_type_check check (
  (sender_type = 'staff' and sender_staff_id is not null)
  or (sender_type = 'customer' and sender_user_id is not null)
  or (sender_type = 'guest' and sender_user_id is null and sender_staff_id is null)
  or sender_type = 'ai_assistant'
);

create or replace function public.submit_table_service_inquiry(
  p_retailer_id uuid,
  p_name text,
  p_email text,
  p_intent text,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_message text := trim(p_message);
  v_customer_id uuid;
  v_conversation_id uuid;
  v_recent_count int;
begin
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Message must contain 1 to 2000 characters';
  end if;
  if p_intent is not null and p_intent not in ('wedding', 'shirts', 'style_help', 'freeform') then
    raise exception 'Unrecognized intent';
  end if;
  if not exists (select 1 from public.retailers where id = p_retailer_id and deleted_at is null) then
    raise exception 'Retailer unavailable';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (p_retailer_id, v_name, v_email, 'prospect', 'tableservice')
      returning id into v_customer_id;
  end if;

  select count(*) into v_recent_count from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.customer_id = v_customer_id
      and m.sender_type = 'guest'
      and m.created_at > now() - interval '10 minutes';
  if v_recent_count >= 5 then
    raise exception 'Please wait a moment before sending another message.';
  end if;

  insert into public.conversations (retailer_id, customer_id, intent)
    values (p_retailer_id, v_customer_id, p_intent)
    on conflict (retailer_id, customer_id)
    do update set
      intent = coalesce(public.conversations.intent, excluded.intent),
      updated_at = now()
    returning id into v_conversation_id;

  insert into public.messages (conversation_id, sender_type, body)
    values (v_conversation_id, 'guest', v_message);

  update public.conversations set last_message_at = now() where id = v_conversation_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
    select
      p_retailer_id, s.user_id, v_customer_id, 'message',
      'New TableService inquiry', left(v_message, 240),
      '/messages/' || v_conversation_id, now()
    from public.retailer_staff_members s
    where s.retailer_id = p_retailer_id
      and s.user_id is not null
      and s.accepted_at is not null
      and s.deleted_at is null
      and s.role in ('sales_associate', 'manager', 'admin', 'owner');

  return v_conversation_id;
end $$;

revoke all on function public.submit_table_service_inquiry(uuid, text, text, text, text) from public;
grant execute on function public.submit_table_service_inquiry(uuid, text, text, text, text)
  to anon, authenticated, service_role;
-- "Today's Pick" (MorningRoutine-inspired, ADR-035): a customer-
-- initiated product_recommendation generation, recorded through a
-- narrow security-definer RPC rather than broadening
-- ai_generations' existing staff-only insert policy — same
-- "security definer RPC over a broadened RLS policy for a narrow
-- state transition a caller triggers about themselves" convention as
-- get_or_create_my_conversation. Re-derives customer_id/retailer_id
-- from the caller's own customers row; never trusts a client-supplied
-- customer_id.

create or replace function public.record_customer_ai_generation(
  p_retailer_id uuid,
  p_status public.ai_generation_status,
  p_model text,
  p_input_summary text,
  p_output jsonb default null,
  p_error_message text default null,
  p_latency_ms integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_id uuid;
begin
  select id into v_customer_id
  from public.customers
  where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;

  if v_customer_id is null then
    raise exception 'Customer relationship required';
  end if;

  insert into public.ai_generations (
    retailer_id, customer_id, kind, status, provider, model,
    input_summary, output, error_message, latency_ms
  ) values (
    p_retailer_id, v_customer_id, 'product_recommendation', p_status, 'openai', p_model,
    p_input_summary, p_output, p_error_message, p_latency_ms
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_customer_ai_generation(
  uuid, public.ai_generation_status, text, text, jsonb, text, integer
) from public;
grant execute on function public.record_customer_ai_generation(
  uuid, public.ai_generation_status, text, text, jsonb, text, integer
) to authenticated, service_role;
-- Wedding Party (ADR-035, overriding ADR-034's earlier deferral of the
-- deck's "Moonstruck" concept): an organizer and their invited party
-- members, each getting a real Customer identity, staff tracking
-- fitting progress across the group. Scoped to coordination only.

create type public.wedding_party_status as enum (
  'planning', 'confirmed', 'completed', 'cancelled'
);

create type public.wedding_party_member_role as enum (
  'groom', 'best_man', 'groomsman', 'father_of_groom', 'other'
);

create type public.wedding_party_member_fitting_status as enum (
  'invited', 'scheduled', 'fitted', 'completed'
);

create table public.wedding_parties (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  organizer_customer_id uuid not null references public.customers (id) on delete cascade,
  event_date date,
  venue_name text,
  status public.wedding_party_status not null default 'planning',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index wedding_parties_retailer_idx on public.wedding_parties (retailer_id);
create index wedding_parties_organizer_idx on public.wedding_parties (organizer_customer_id);
create trigger set_wedding_parties_updated_at
  before update on public.wedding_parties
  for each row execute function public.set_updated_at();

create table public.wedding_party_members (
  id uuid primary key default gen_random_uuid(),
  wedding_party_id uuid not null references public.wedding_parties (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  role public.wedding_party_member_role not null default 'other',
  fitting_status public.wedding_party_member_fitting_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (wedding_party_id, customer_id)
);
create index wedding_party_members_party_idx on public.wedding_party_members (wedding_party_id);
create index wedding_party_members_customer_idx on public.wedding_party_members (customer_id);
create trigger set_wedding_party_members_updated_at
  before update on public.wedding_party_members
  for each row execute function public.set_updated_at();

alter table public.wedding_parties enable row level security;
alter table public.wedding_party_members enable row level security;

create policy "platform reads wedding parties" on public.wedding_parties
  for select using (public.is_platform_staff());

create policy "retailer staff manage wedding parties" on public.wedding_parties
  for all
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "organizer and members read their wedding party" on public.wedding_parties
  for select using (
    exists (
      select 1 from public.customers c
      where c.id = organizer_customer_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from public.wedding_party_members m
      join public.customers c on c.id = m.customer_id
      where m.wedding_party_id = wedding_parties.id and c.user_id = auth.uid()
    )
  );

create policy "platform reads wedding party members" on public.wedding_party_members
  for select using (public.is_platform_staff());

create policy "retailer staff manage wedding party members" on public.wedding_party_members
  for all
  using (
    exists (
      select 1 from public.wedding_parties p
      where p.id = wedding_party_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_parties p
      where p.id = wedding_party_id
        and p.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
    )
  );

create policy "organizer and members read the roster" on public.wedding_party_members
  for select using (
    exists (
      select 1 from public.wedding_parties p
      join public.customers oc on oc.id = p.organizer_customer_id
      where p.id = wedding_party_members.wedding_party_id and oc.user_id = auth.uid()
    )
    or exists (
      select 1 from public.wedding_party_members m2
      join public.customers c2 on c2.id = m2.customer_id
      where m2.wedding_party_id = wedding_party_members.wedding_party_id
        and c2.user_id = auth.uid()
    )
  );

grant select, insert, update on public.wedding_parties, public.wedding_party_members
  to authenticated, service_role;

-- Transactional find-or-create-guest-customer + add-member, same
-- reasoning as `place_order` for "two tables written from one call."
create or replace function public.add_wedding_party_member(
  p_wedding_party_id uuid,
  p_name text,
  p_email text,
  p_role public.wedding_party_member_role
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_email text := lower(trim(p_email));
  v_customer_id uuid;
  v_member_id uuid;
begin
  select p.retailer_id into v_retailer_id
  from public.wedding_parties p
  where p.id = p_wedding_party_id and p.deleted_at is null;

  if v_retailer_id is null
    or v_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('sales_associate', 'manager', 'admin', 'owner')
  then
    raise exception 'Not authorized';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(p_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = v_retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (v_retailer_id, trim(p_name), v_email, 'prospect', 'wedding_party')
      returning id into v_customer_id;
  end if;

  insert into public.wedding_party_members (wedding_party_id, customer_id, name, role)
    values (p_wedding_party_id, v_customer_id, trim(p_name), p_role)
    on conflict (wedding_party_id, customer_id) do update set role = excluded.role
    returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke all on function public.add_wedding_party_member(
  uuid, text, text, public.wedding_party_member_role
) from public;
grant execute on function public.add_wedding_party_member(
  uuid, text, text, public.wedding_party_member_role
) to authenticated, service_role;

-- Narrow state transition a member can trigger about themselves
-- (self-report "I've booked my fitting"), same "security definer RPC
-- over a broadened RLS policy" shape as get_or_create_my_conversation.
-- Staff may set any status; a member may only set their own row to
-- 'scheduled' — 'fitted'/'completed' stay a staff sign-off.
create or replace function public.update_wedding_party_member_status(
  p_member_id uuid,
  p_status public.wedding_party_member_fitting_status
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.wedding_party_members%rowtype;
  v_retailer_id uuid;
  v_is_staff boolean;
begin
  select * into v_member from public.wedding_party_members where id = p_member_id and deleted_at is null;
  if not found then
    raise exception 'Member not found';
  end if;

  select p.retailer_id into v_retailer_id from public.wedding_parties p where p.id = v_member.wedding_party_id;
  v_is_staff := v_retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner');

  if v_is_staff then
    update public.wedding_party_members set fitting_status = p_status where id = p_member_id;
  elsif exists (
    select 1 from public.customers c where c.id = v_member.customer_id and c.user_id = auth.uid()
  ) then
    if p_status <> 'scheduled' then
      raise exception 'Members may only mark their own fitting as scheduled';
    end if;
    update public.wedding_party_members set fitting_status = p_status where id = p_member_id;
  else
    raise exception 'Not authorized';
  end if;
end;
$$;

revoke all on function public.update_wedding_party_member_status(
  uuid, public.wedding_party_member_fitting_status
) from public;
grant execute on function public.update_wedding_party_member_status(
  uuid, public.wedding_party_member_fitting_status
) to authenticated, service_role;
-- Groom-shareable invite links: the organizer sends one link to the
-- whole party instead of a sales associate typing in every member's
-- name and email by hand. Anonymous join, same shape as
-- submit_table_service_inquiry (ADR-034) — a single narrow
-- security-definer entry point, no anonymous RLS insert policy.

alter table public.wedding_parties
  add column invite_token uuid not null default gen_random_uuid() unique;

create index wedding_parties_invite_token_idx on public.wedding_parties (invite_token);

create or replace function public.join_wedding_party(
  p_invite_token uuid,
  p_name text,
  p_email text,
  p_role public.wedding_party_member_role
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_email text := lower(trim(p_email));
  v_customer_id uuid;
  v_member_id uuid;
begin
  select * into v_party
  from public.wedding_parties
  where invite_token = p_invite_token and deleted_at is null and status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(p_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = v_party.retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (v_party.retailer_id, trim(p_name), v_email, 'prospect', 'wedding_party_invite')
      returning id into v_customer_id;
  end if;

  insert into public.wedding_party_members (wedding_party_id, customer_id, name, role)
    values (v_party.id, v_customer_id, trim(p_name), p_role)
    on conflict (wedding_party_id, customer_id) do update set role = excluded.role
    returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke all on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role
) from public;
grant execute on function public.join_wedding_party(
  uuid, text, text, public.wedding_party_member_role
) to anon, authenticated, service_role;
-- Staff planning: who's scheduled to work which day (staff_shifts,
-- manager-authored) and actual worked time (staff_time_entries,
-- self-service clock in/out) — two separate concepts, since a
-- schedule and what actually happened are not the same record
-- (matches this repo's "status that must only change through its own
-- history log" style separation, e.g. Alteration vs AlterationStatusHistory).

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_time > start_time)
);
create index staff_shifts_retailer_date_idx on public.staff_shifts (retailer_id, shift_date);
create index staff_shifts_staff_idx on public.staff_shifts (staff_id, shift_date);
create trigger set_staff_shifts_updated_at
  before update on public.staff_shifts
  for each row execute function public.set_updated_at();

create table public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);
create index staff_time_entries_staff_idx on public.staff_time_entries (staff_id, clock_in_at desc);
create index staff_time_entries_retailer_idx on public.staff_time_entries (retailer_id, clock_in_at desc);
create trigger set_staff_time_entries_updated_at
  before update on public.staff_time_entries
  for each row execute function public.set_updated_at();

alter table public.staff_shifts enable row level security;
alter table public.staff_time_entries enable row level security;

create policy "platform reads staff shifts" on public.staff_shifts
  for select using (public.is_platform_staff());
create policy "retailer staff read their retailer's shifts" on public.staff_shifts
  for select using (retailer_id = public.current_retailer_id());
create policy "managers manage staff shifts" on public.staff_shifts
  for insert with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "managers update staff shifts" on public.staff_shifts
  for update using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "managers delete staff shifts" on public.staff_shifts
  for delete using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy "platform reads time entries" on public.staff_time_entries
  for select using (public.is_platform_staff());
create policy "managers read all time entries" on public.staff_time_entries
  for select using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "staff read their own time entries" on public.staff_time_entries
  for select using (
    exists (
      select 1 from public.retailer_staff_members s
      where s.id = staff_id and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.staff_shifts to authenticated, service_role;
grant select on public.staff_time_entries to authenticated, service_role;

-- Self-service clock in/out — re-derives staff_id from auth.uid(),
-- same "security definer RPC over a broadened RLS policy for a narrow
-- state transition a caller triggers about themselves" shape as
-- get_or_create_my_conversation.
create or replace function public.clock_in() returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.retailer_staff_members%rowtype;
  v_open_entry uuid;
  v_id uuid;
begin
  select * into v_staff from public.retailer_staff_members
    where user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if not found then
    raise exception 'No active staff membership';
  end if;

  select id into v_open_entry from public.staff_time_entries
    where staff_id = v_staff.id and clock_out_at is null
    limit 1;
  if v_open_entry is not null then
    raise exception 'Already clocked in';
  end if;

  insert into public.staff_time_entries (retailer_id, staff_id)
    values (v_staff.retailer_id, v_staff.id)
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.clock_out() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from public.retailer_staff_members
    where user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_staff_id is null then
    raise exception 'No active staff membership';
  end if;

  update public.staff_time_entries
    set clock_out_at = now()
    where staff_id = v_staff_id and clock_out_at is null;

  if not found then
    raise exception 'Not currently clocked in';
  end if;
end;
$$;

revoke all on function public.clock_in() from public;
revoke all on function public.clock_out() from public;
grant execute on function public.clock_in() to authenticated, service_role;
grant execute on function public.clock_out() to authenticated, service_role;
-- SMS/WhatsApp transactional notifications — same outbox shape as
-- email_outbox (ADR-032): Postgres triggers can't make HTTP calls, so
-- every notifications insert enqueues a row here, drained by a
-- scheduled Route Handler. Founder decision: build the pipeline now,
-- Twilio credentials (SMS + WhatsApp both go through the same
-- provider) get provisioned later — same non-faking treatment as
-- every other unconfigured provider in this codebase.

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  recipient_phone text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sms_outbox_pending_idx on public.sms_outbox (created_at)
  where status = 'pending';

create trigger set_sms_outbox_updated_at
  before update on public.sms_outbox
  for each row
  execute function public.set_updated_at();

alter table public.sms_outbox enable row level security;

create policy "platform staff can manage all sms outbox rows"
  on public.sms_outbox for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on public.sms_outbox
  to authenticated, service_role;

-- Gated on the customer's own communication_channels preference
-- (already includes 'sms', ADR-028) and requiring a phone number on
-- file — no preferences row yet defaults to *not* sending SMS (unlike
-- email's opt-out default), since a phone number was never explicitly
-- offered as a channel until now.
create or replace function public.enqueue_notification_sms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_wants_sms boolean;
begin
  if new.customer_id is null then
    return new;
  end if;

  select c.phone, ('sms' = any(coalesce(cp.communication_channels, '{}'::text[])))
    into v_phone, v_wants_sms
    from public.customers c
    left join public.customer_preferences cp on cp.customer_id = c.id
    where c.id = new.customer_id;

  if v_phone is null or coalesce(v_wants_sms, false) is false then
    return new;
  end if;

  insert into public.sms_outbox (notification_id, recipient_phone, body)
  values (new.id, v_phone, new.title || ': ' || new.body);

  return new;
end;
$$;

create trigger enqueue_notification_sms_after_insert
  after insert on public.notifications
  for each row
  execute function public.enqueue_notification_sms();

-- Atomic claim, identical shape to claim_pending_emails.
create or replace function public.claim_pending_sms(p_limit integer default 20)
returns setof public.sms_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.sms_outbox
    set status = 'sending'
    where id in (
      select id from public.sms_outbox
      where status = 'pending'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_pending_sms(integer) from public;
grant execute on function public.claim_pending_sms(integer) to service_role;
-- Newsletter signup on the storefront front door — deliberately a
-- lighter-weight concept than Customer (a browser signing up for
-- emails hasn't started a purchase relationship yet, matching
-- TableService's guest-Customer pattern but even lighter: no
-- Customer row at all until they actually buy or message the
-- retailer).

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  email text not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, email)
);
create index newsletter_subscribers_retailer_idx on public.newsletter_subscribers (retailer_id)
  where unsubscribed_at is null;
create trigger set_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

alter table public.newsletter_subscribers enable row level security;

create policy "platform reads newsletter subscribers" on public.newsletter_subscribers
  for select using (public.is_platform_staff());
create policy "retailer staff read their newsletter subscribers" on public.newsletter_subscribers
  for select using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

grant select on public.newsletter_subscribers to authenticated, service_role;

-- The only anonymous write on this table — same shape as
-- submit_table_service_inquiry (ADR-034): a single narrow
-- security-definer entry point, no anonymous RLS insert policy.
-- Idempotent (re-subscribing after unsubscribing just clears the flag).
create or replace function public.subscribe_to_newsletter(
  p_retailer_id uuid,
  p_email text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if not exists (select 1 from public.retailers where id = p_retailer_id and deleted_at is null) then
    raise exception 'Retailer unavailable';
  end if;

  insert into public.newsletter_subscribers (retailer_id, email)
    values (p_retailer_id, v_email)
    on conflict (retailer_id, email)
    do update set unsubscribed_at = null, subscribed_at = now();
end;
$$;

revoke all on function public.subscribe_to_newsletter(uuid, text) from public;
grant execute on function public.subscribe_to_newsletter(uuid, text) to anon, authenticated, service_role;
-- Hardening pass on the existing proposal/approval price-change flow
-- (docs/DECISIONS.md, garment-first alterations ADR block) — two real
-- gaps identified in an audit: unlimited resubmission after rejection,
-- and no dual-control on large increases (any single manager/admin/
-- owner could approve an unbounded increase, which is exactly the
-- single-point-of-collusion a "watertight" control needs to close).
-- Everything else audited (immutable original quote, mandatory
-- explanation/evidence, append-only history, amount ceiling,
-- workshop-manager-only proposing, management-only deciding) was
-- already real and is left unchanged.

create or replace function public.propose_alteration_price_change(
  p_alteration_id uuid,
  p_task_id uuid,
  p_proposed_amount_minor_units integer,
  p_explanation text,
  p_evidence_attachment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_original integer;
  v_id uuid;
  v_staff_id uuid := public.current_staff_id();
  v_rejected_count integer;
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then raise exception 'Work order not found'; end if;
  if public.current_retailer_role() <> 'workshop_manager' and auth.role() <> 'service_role' then
    raise exception 'Only an assigned workshop manager may propose price changes';
  end if;
  if v_order.status not in ('assigned','in_progress') then
    raise exception 'Price changes may only be proposed while assigned work is active';
  end if;
  if length(trim(p_explanation)) < 10 then raise exception 'A substantive explanation is required'; end if;
  if p_proposed_amount_minor_units not between 0 and 100000000 then
    raise exception 'Price must be between zero and 1,000,000 major currency units';
  end if;
  if p_evidence_attachment_id is not null and not exists (
    select 1 from public.alteration_attachments a
    where a.id = p_evidence_attachment_id
      and a.retailer_id = v_order.retailer_id
      and (
        a.alteration_id = p_alteration_id
        or a.physical_garment_id = v_order.physical_garment_id
        or exists (
          select 1 from public.alteration_tasks t
          where t.id = a.task_id and t.alteration_id = p_alteration_id
        )
      )
  ) then raise exception 'Evidence attachment does not belong to this work order'; end if;
  if p_task_id is not null then
    select original_quote_amount_minor_units into v_original from public.alteration_tasks where id = p_task_id and alteration_id = p_alteration_id;
    if v_original is null then raise exception 'Task not found on work order'; end if;
  else
    v_original := v_order.original_quote_amount_minor_units;
  end if;

  -- Fraud-prevention: cap resubmission after rejection. Two rejected
  -- proposals on the same target means the workshop has already had
  -- two chances to justify a price with evidence — a third attempt
  -- needs a human conversation, not another automated proposal.
  select count(*) into v_rejected_count
    from public.price_change_proposals
    where alteration_id = p_alteration_id
      and coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_task_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status = 'rejected'
      and deleted_at is null;
  if v_rejected_count >= 2 then
    raise exception 'Two price proposals for this item have already been rejected — contact the retailer directly instead of resubmitting';
  end if;

  insert into public.price_change_proposals (
    alteration_id, task_id, retailer_id, original_amount_minor_units,
    proposed_amount_minor_units, currency, explanation, proposed_by_staff_id,
    evidence_attachment_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, v_original,
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id, p_evidence_attachment_id
  ) returning id into v_id;
  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    p_alteration_id, p_task_id, v_order.retailer_id, 'proposal',
    p_proposed_amount_minor_units, v_order.original_quote_currency,
    trim(p_explanation), v_staff_id
  );
  return v_id;
end;
$$;

create or replace function public.decide_alteration_price_change(
  p_proposal_id uuid,
  p_decision public.price_change_proposal_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.price_change_proposals%rowtype;
  v_total integer;
  v_staff_id uuid := public.current_staff_id();
  v_increase_ratio numeric;
begin
  select * into v_proposal from public.price_change_proposals where id = p_proposal_id and deleted_at is null for update;
  if v_proposal.id is null or v_proposal.status <> 'pending' then raise exception 'Pending proposal not found'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Decision reason is required'; end if;
  if not exists (
    select 1 from public.alteration_work_orders w
    where w.id = v_proposal.alteration_id
      and w.status in ('assigned','in_progress')
      and w.deleted_at is null
  ) then raise exception 'Price proposals may only be decided while assigned work is active'; end if;
  if auth.role() <> 'service_role' and (
    public.is_platform_staff()
    or v_proposal.retailer_id <> public.current_retailer_id()
    or not public.is_alterations_management()
  )
  then raise exception 'Retailer management approval is required'; end if;

  -- Fraud-prevention: dual control on large increases. A proposal
  -- more than 50% above the original quote (and at least 5000 minor
  -- units, so a trivial small-ticket item never trips this) can only
  -- be approved by the retailer owner — a manager/admin colluding
  -- with a workshop can no longer unilaterally approve an inflated
  -- invoice on their own.
  if p_decision = 'approved' and v_proposal.original_amount_minor_units > 0 then
    v_increase_ratio := v_proposal.proposed_amount_minor_units::numeric / v_proposal.original_amount_minor_units::numeric;
    if v_increase_ratio > 1.5
      and (v_proposal.proposed_amount_minor_units - v_proposal.original_amount_minor_units) >= 5000
      and auth.role() <> 'service_role'
      and public.current_retailer_role() <> 'owner'
    then
      raise exception 'Increases of more than 50%% over the original quote require owner approval';
    end if;
  end if;

  update public.price_change_proposals
  set status = p_decision, decided_by_staff_id = v_staff_id,
      decided_at = now(), decision_reason = trim(p_reason)
  where id = p_proposal_id;

  if p_decision = 'approved' then
    if v_proposal.task_id is not null then
      update public.alteration_tasks
      set agreed_price_amount_minor_units = v_proposal.proposed_amount_minor_units,
          agreed_price_currency = v_proposal.currency
      where id = v_proposal.task_id;
      select sum(coalesce(agreed_price_amount_minor_units, original_quote_amount_minor_units))
        into v_total from public.alteration_tasks
        where alteration_id = v_proposal.alteration_id and classification = 'work_now' and deleted_at is null;
    else
      v_total := v_proposal.proposed_amount_minor_units;
    end if;
    update public.alteration_work_orders
    set agreed_total_amount_minor_units = v_total,
        agreed_total_currency = v_proposal.currency
    where id = v_proposal.alteration_id;
  end if;

  insert into public.alteration_pricing_history (
    alteration_id, task_id, retailer_id, event_type, amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    v_proposal.alteration_id, v_proposal.task_id, v_proposal.retailer_id,
    case when p_decision = 'approved' then 'approval' else 'rejection' end,
    v_proposal.proposed_amount_minor_units, v_proposal.currency,
    trim(p_reason), v_staff_id
  );
end;
$$;
-- "Retailers can order shipping and/or pick up from their favorite
-- carriers... for a customer in the customer's address card" — a
-- retailer-staff-set preference, not a customer self-service one
-- (unlike CustomerPreferences, which only the customer themselves can
-- write). customers already has a staff-writable "for all" RLS policy
-- (sales_associate+, 20260719000007_*), so this is a plain column, no
-- new RPC needed.

alter table public.customers
  add column preferred_carrier text
  check (preferred_carrier is null or preferred_carrier in (
    'dhl', 'postnl', 'ups', 'fedex', 'local_courier', 'customer_pickup'
  ));
-- `behavioral_events` (20260720000005) was created after the blanket
-- PostgREST grant (20260720000000) and never got its own — the same class
-- of gap `customer_preferences`/`wishlists` hit before: RLS is satisfied but
-- the direct table read still 403s with "permission denied for table
-- behavioral_events" because SQL-level grants are enforced independently.
-- Writes stay RPC-only (`capture_behavioral_event`, security definer) — this
-- grants only `select`, matching the table's own read-only RLS policies.
grant select on public.behavioral_events to authenticated, service_role;
create or replace function public.notify_customer_when_alteration_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
  v_garment_type text;
  v_title text;
  v_body text;
begin
  if new.status not in ('ready_for_pickup', 'out_for_delivery')
    or new.status is not distinct from old.status
  then
    return new;
  end if;

  select customer.user_id, garment.garment_type
  into v_recipient_user_id, v_garment_type
  from public.customers customer
  join public.physical_garments garment
    on garment.id = new.physical_garment_id
    and garment.retailer_id = new.retailer_id
    and garment.deleted_at is null
  where customer.id = new.customer_id
    and customer.retailer_id = new.retailer_id
    and customer.deleted_at is null;

  if v_recipient_user_id is null then
    return new;
  end if;

  if new.status = 'ready_for_pickup' then
    v_title := 'Alteration ready for pickup';
    v_body := 'Your ' || v_garment_type || ' is ready for pickup.';
  else
    v_title := 'Alteration out for delivery';
    v_body := 'Your ' || v_garment_type || ' is on its way.';
  end if;

  insert into public.notifications (
    retailer_id,
    recipient_user_id,
    customer_id,
    category,
    title,
    body,
    action_href,
    sent_at
  )
  values (
    new.retailer_id,
    v_recipient_user_id,
    new.customer_id,
    'alteration_update',
    v_title,
    v_body,
    '/alterations/' || new.id,
    now()
  );

  return new;
end;
$$;

revoke all on function public.notify_customer_when_alteration_ready() from public;

create trigger notify_customer_when_alteration_ready_after_update
  after update of status on public.alteration_work_orders
  for each row
  execute function public.notify_customer_when_alteration_ready();

insert into public.notifications (
  retailer_id,
  recipient_user_id,
  customer_id,
  category,
  title,
  body,
  action_href,
  sent_at,
  created_at,
  updated_at
)
select
  work_order.retailer_id,
  customer.user_id,
  work_order.customer_id,
  'alteration_update',
  case work_order.status
    when 'ready_for_pickup' then 'Alteration ready for pickup'
    else 'Alteration out for delivery'
  end,
  case work_order.status
    when 'ready_for_pickup' then
      'Your ' || garment.garment_type || ' is ready for pickup.'
    else
      'Your ' || garment.garment_type || ' is on its way.'
  end,
  '/alterations/' || work_order.id,
  coalesce(work_order.customer_notification_ready_at, now()),
  coalesce(work_order.customer_notification_ready_at, now()),
  coalesce(work_order.customer_notification_ready_at, now())
from public.alteration_work_orders work_order
join public.customers customer
  on customer.id = work_order.customer_id
  and customer.retailer_id = work_order.retailer_id
  and customer.deleted_at is null
join public.physical_garments garment
  on garment.id = work_order.physical_garment_id
  and garment.retailer_id = work_order.retailer_id
  and garment.deleted_at is null
where work_order.status in ('ready_for_pickup', 'out_for_delivery')
  and work_order.deleted_at is null
  and customer.user_id is not null
  and not exists (
    select 1
    from public.notifications notification
    where notification.recipient_user_id = customer.user_id
      and notification.category = 'alteration_update'
      and notification.action_href = '/alterations/' || work_order.id
      and notification.deleted_at is null
  );
alter table public.alteration_fulfillment_events
  add column actor_staff_id uuid references public.retailer_staff_members (id) on delete set null;

with first_actor as (
  select distinct on (entry.entity_id)
    entry.entity_id,
    entry.actor_staff_id
  from public.audit_log_entries entry
  where entry.entity_type = 'alteration_fulfillment_events'
    and entry.action = 'insert'
    and entry.actor_staff_id is not null
  order by entry.entity_id, entry.occurred_at asc
)
update public.alteration_fulfillment_events fulfillment
set actor_staff_id = first_actor.actor_staff_id
from first_actor
where first_actor.entity_id = fulfillment.id
  and fulfillment.actor_staff_id is null;

create or replace function public.derive_alteration_attachment_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.uploaded_by_staff_id := public.current_staff_id();
    if new.uploaded_by_staff_id is null then
      raise exception 'An active staff membership is required to upload alteration evidence';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_attachment_actor_before_insert
  before insert on public.alteration_attachments
  for each row
  execute function public.derive_alteration_attachment_actor();

create or replace function public.derive_alteration_custody_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.actor_staff_id := public.current_staff_id();
    if new.actor_staff_id is null then
      raise exception 'An active staff membership is required to record custody';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_custody_actor_before_insert
  before insert on public.chain_of_custody_events
  for each row
  execute function public.derive_alteration_custody_actor();

create or replace function public.derive_alteration_fulfillment_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.actor_staff_id := public.current_staff_id();
    if new.actor_staff_id is null then
      raise exception 'An active staff membership is required to record fulfillment';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_fulfillment_actor_before_insert
  before insert on public.alteration_fulfillment_events
  for each row
  execute function public.derive_alteration_fulfillment_actor();

revoke all on function public.derive_alteration_attachment_actor() from public;
revoke all on function public.derive_alteration_custody_actor() from public;
revoke all on function public.derive_alteration_fulfillment_actor() from public;
-- Commercial plan catalogue and server-enforced entitlements for PAON
-- Subscription revenue, implementation work, and managed services remain distinct

alter table public.subscription_plans
  add column positioning text not null default '',
  add column description text not null default '',
  add column implementation_fee_amount_minor_units integer not null default 0
    check (implementation_fee_amount_minor_units >= 0),
  add column implementation_fee_currency text not null default 'EUR',
  add column price_is_from boolean not null default false,
  add column is_public boolean not null default true,
  add column display_order integer not null default 0;

create table public.commercial_features (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  category text not null check (
    category in ('foundation', 'commerce', 'engagement', 'operations', 'intelligence', 'service')
  ),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_commercial_features_updated_at
  before update on public.commercial_features
  for each row execute function public.set_updated_at();

create table public.subscription_plan_entitlements (
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  feature_key text not null references public.commercial_features (key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (plan_id, feature_key)
);

create table public.retailer_entitlement_overrides (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  feature_key text not null references public.commercial_features (key) on delete restrict,
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (retailer_id, feature_key)
);

create trigger set_retailer_entitlement_overrides_updated_at
  before update on public.retailer_entitlement_overrides
  for each row execute function public.set_updated_at();

create table public.managed_service_offerings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  price_amount_minor_units integer check (price_amount_minor_units >= 0),
  price_currency text,
  billing_interval text check (
    billing_interval is null or billing_interval in ('one_time', 'monthly', 'quarterly')
  ),
  price_is_from boolean not null default false,
  is_public boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (price_amount_minor_units is null and price_currency is null and billing_interval is null)
    or
    (price_amount_minor_units is not null and price_currency is not null and billing_interval is not null)
  )
);

create trigger set_managed_service_offerings_updated_at
  before update on public.managed_service_offerings
  for each row execute function public.set_updated_at();

alter table public.commercial_features enable row level security;
alter table public.subscription_plan_entitlements enable row level security;
alter table public.retailer_entitlement_overrides enable row level security;
alter table public.managed_service_offerings enable row level security;

create policy "public can read commercial features"
  on public.commercial_features for select using (true);
create policy "platform staff manage commercial features"
  on public.commercial_features for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "public can read public plan entitlements"
  on public.subscription_plan_entitlements for select
  using (
    exists (
      select 1 from public.subscription_plans p
      where p.id = plan_id and p.is_public
    )
  );
create policy "platform staff manage plan entitlements"
  on public.subscription_plan_entitlements for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "platform staff manage retailer entitlement overrides"
  on public.retailer_entitlement_overrides for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer owners read entitlement overrides"
  on public.retailer_entitlement_overrides for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

create policy "public can read public managed services"
  on public.managed_service_offerings for select using (is_public);
create policy "platform staff manage managed services"
  on public.managed_service_offerings for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

drop policy "authenticated users can read subscription plans"
  on public.subscription_plans;
create policy "public reads public subscription plans"
  on public.subscription_plans for select using (is_public);
create policy "authenticated users read subscription plans"
  on public.subscription_plans for select to authenticated using (true);

grant select on public.subscription_plans, public.commercial_features,
  public.subscription_plan_entitlements, public.managed_service_offerings
  to anon;
grant select, insert, update, delete on public.commercial_features,
  public.subscription_plan_entitlements, public.retailer_entitlement_overrides,
  public.managed_service_offerings to authenticated, service_role;

insert into public.commercial_features (key, name, category, display_order) values
  ('branded_website', 'Branded website template', 'foundation', 10),
  ('customer_accounts', 'Customer accounts', 'foundation', 20),
  ('crm', 'CRM and client records', 'foundation', 30),
  ('catalogue', 'Product catalogue', 'foundation', 40),
  ('appointments', 'Appointments', 'foundation', 50),
  ('order_tracking', 'Order tracking', 'foundation', 60),
  ('alterations_core', 'Core alteration workflow', 'operations', 70),
  ('analytics_basic', 'Basic analytics', 'intelligence', 80),
  ('ecommerce', 'Ecommerce', 'commerce', 90),
  ('loyalty', 'Loyalty and rewards', 'engagement', 100),
  ('referrals', 'Referrals', 'engagement', 110),
  ('vouchers', 'Vouchers', 'engagement', 120),
  ('events', 'Events', 'engagement', 130),
  ('wedding_planning', 'Wedding planning', 'engagement', 140),
  ('clienteling', 'Clienteling', 'engagement', 150),
  ('messaging', 'Messaging', 'engagement', 160),
  ('alterations_advanced', 'Advanced alteration workflows', 'operations', 170),
  ('analytics_expanded', 'Expanded analytics', 'intelligence', 180),
  ('multi_user', 'Multiple operational users', 'operations', 190),
  ('multi_location', 'Multiple locations', 'operations', 200),
  ('bespoke_implementation', 'Bespoke implementation', 'service', 210),
  ('analytics_advanced', 'Advanced analytics', 'intelligence', 220),
  ('ai_personalisation', 'AI personalisation', 'intelligence', 230),
  ('custom_integrations', 'Custom integrations', 'service', 240),
  ('campaign_support', 'Campaign support', 'service', 250),
  ('lead_generation', 'Lead-generation support', 'service', 260),
  ('management_consulting', 'Management consulting', 'service', 270),
  ('priority_support', 'Priority support', 'service', 280),
  ('quarterly_growth_planning', 'Quarterly growth planning', 'service', 290);

update public.subscription_plans set
  key = 'fused_monthly',
  name = 'PAON Fused',
  positioning = 'A professional digital customer foundation.',
  description = 'The essential branded customer and operating foundation for a premium retailer.',
  price_amount_minor_units = 34900,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 150000,
  implementation_fee_currency = 'EUR',
  price_is_from = false,
  display_order = 10,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic'
  ]
where key = 'boutique_monthly';

update public.subscription_plans set
  key = 'half_canvas_monthly',
  name = 'PAON Half Canvas',
  positioning = 'Customer growth, service and retention.',
  description = 'A connected growth and service platform for retailers ready to deepen every customer relationship.',
  price_amount_minor_units = 74900,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 350000,
  implementation_fee_currency = 'EUR',
  price_is_from = false,
  display_order = 20,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic',
    'ecommerce', 'loyalty', 'referrals', 'vouchers', 'events',
    'wedding_planning', 'clienteling', 'messaging', 'alterations_advanced',
    'analytics_expanded', 'multi_user', 'multi_location'
  ]
where key = 'house_monthly';

update public.subscription_plans set
  key = 'full_canvas_monthly',
  name = 'PAON Full Canvas',
  positioning = 'Complete platform with managed growth.',
  description = 'A bespoke platform and growth partnership for ambitious premium retail houses.',
  price_amount_minor_units = 175000,
  price_currency = 'EUR',
  implementation_fee_amount_minor_units = 750000,
  implementation_fee_currency = 'EUR',
  price_is_from = true,
  display_order = 30,
  included_feature_keys = array[
    'branded_website', 'customer_accounts', 'crm', 'catalogue',
    'appointments', 'order_tracking', 'alterations_core', 'analytics_basic',
    'ecommerce', 'loyalty', 'referrals', 'vouchers', 'events',
    'wedding_planning', 'clienteling', 'messaging', 'alterations_advanced',
    'analytics_expanded', 'multi_user', 'multi_location',
    'bespoke_implementation', 'analytics_advanced', 'ai_personalisation',
    'custom_integrations', 'campaign_support', 'lead_generation',
    'management_consulting', 'priority_support', 'quarterly_growth_planning'
  ]
where key = 'maison_monthly';

insert into public.subscription_plan_entitlements (plan_id, feature_key)
select p.id, unnest(p.included_feature_keys)
from public.subscription_plans p
on conflict do nothing;

insert into public.managed_service_offerings (
  key, name, description, price_amount_minor_units, price_currency,
  billing_interval, price_is_from, display_order
) values
  ('campaign_partnership', 'Campaign partnership',
    'Ongoing campaign planning, execution support and reporting.',
    null, null, null, true, 10),
  ('lead_generation_retainer', 'Lead-generation retainer',
    'Targeted acquisition support aligned to the retailer growth plan.',
    null, null, null, true, 20),
  ('management_advisory', 'Management advisory',
    'Structured commercial and operating guidance for the leadership team.',
    null, null, null, true, 30);

create or replace function public.retailer_has_entitlement(
  p_retailer_id uuid,
  p_feature_key text
)
returns boolean
language sql
stable
security definer
 set search_path = public
as $$
  select
    case
      when not (
        public.is_platform_staff()
        or p_retailer_id = public.current_retailer_id()
      ) then false
      when exists (
        select 1
        from public.retailer_entitlement_overrides o
        where o.retailer_id = p_retailer_id
          and o.feature_key = p_feature_key
          and (o.expires_at is null or o.expires_at > now())
      ) then (
        select o.enabled
        from public.retailer_entitlement_overrides o
        where o.retailer_id = p_retailer_id
          and o.feature_key = p_feature_key
          and (o.expires_at is null or o.expires_at > now())
      )
      else exists (
        select 1
        from public.retailer_subscriptions s
        join public.subscription_plan_entitlements e on e.plan_id = s.plan_id
        where s.retailer_id = p_retailer_id
          and s.status in ('trialing', 'active')
          and e.feature_key = p_feature_key
      )
    end;
$$;

revoke all on function public.retailer_has_entitlement(uuid, text) from public;
grant execute on function public.retailer_has_entitlement(uuid, text)
  to authenticated, service_role;
-- One platform-staff operation updates commercial copy/pricing and its
-- entitlement set atomically. The client cannot leave a plan half-updated.

create or replace function public.update_commercial_plan(
  p_plan_id uuid,
  p_name text,
  p_positioning text,
  p_description text,
  p_price_amount_minor_units integer,
  p_price_currency text,
  p_price_is_from boolean,
  p_implementation_fee_amount_minor_units integer,
  p_implementation_fee_currency text,
  p_seat_limit integer,
  p_feature_keys text[],
  p_is_public boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff access required';
  end if;

  if coalesce(array_length(p_feature_keys, 1), 0) = 0 then
    raise exception 'A commercial plan must include at least one capability';
  end if;

  update public.subscription_plans
  set name = p_name,
      positioning = p_positioning,
      description = p_description,
      price_amount_minor_units = p_price_amount_minor_units,
      price_currency = p_price_currency,
      price_is_from = p_price_is_from,
      implementation_fee_amount_minor_units = p_implementation_fee_amount_minor_units,
      implementation_fee_currency = p_implementation_fee_currency,
      seat_limit = p_seat_limit,
      included_feature_keys = p_feature_keys,
      is_public = p_is_public
  where id = p_plan_id;

  if not found then
    raise exception 'Commercial plan not found';
  end if;

  delete from public.subscription_plan_entitlements
  where plan_id = p_plan_id;

  insert into public.subscription_plan_entitlements (plan_id, feature_key)
  select p_plan_id, feature_key
  from unnest(p_feature_keys) feature_key;
end;
$$;

revoke all on function public.update_commercial_plan(
  uuid, text, text, text, integer, text, boolean, integer, text,
  integer, text[], boolean
) from public;
grant execute on function public.update_commercial_plan(
  uuid, text, text, text, integer, text, boolean, integer, text,
  integer, text[], boolean
) to authenticated, service_role;
-- Public commercial calls-to-action persist as a founder-owned inbox. They do
-- not create a retailer, prospect demo or production tenant automatically.

create type public.commercial_inquiry_type as enum (
  'personalized_demo', 'consultation', 'paid_pilot'
);

create table public.commercial_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_type public.commercial_inquiry_type not null,
  company_name text not null,
  contact_name text not null,
  email text not null,
  website_url text,
  objective text not null,
  requested_plan_key text references public.subscription_plans (key)
    on update cascade on delete set null,
  status text not null default 'new' check (
    status in ('new', 'reviewed', 'converted', 'closed')
  ),
  source text not null default 'paon_marketing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_commercial_inquiries_updated_at
  before update on public.commercial_inquiries
  for each row execute function public.set_updated_at();

alter table public.commercial_inquiries enable row level security;

create policy "platform staff manage commercial inquiries"
  on public.commercial_inquiries for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

grant select, insert, update, delete on public.commercial_inquiries
  to authenticated, service_role;

create or replace function public.submit_commercial_inquiry(
  p_inquiry_type public.commercial_inquiry_type,
  p_company_name text,
  p_contact_name text,
  p_email text,
  p_website_url text,
  p_objective text,
  p_requested_plan_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(p_company_name)) not between 2 and 160
    or length(trim(p_contact_name)) not between 2 and 160
    or length(trim(p_objective)) not between 10 and 2000
    or length(trim(p_email)) > 320
    or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (p_website_url is not null and length(trim(p_website_url)) > 500)
  then
    raise exception 'Invalid commercial inquiry';
  end if;

  insert into public.commercial_inquiries (
    inquiry_type, company_name, contact_name, email, website_url, objective,
    requested_plan_key
  ) values (
    p_inquiry_type,
    trim(p_company_name),
    trim(p_contact_name),
    lower(trim(p_email)),
    nullif(trim(p_website_url), ''),
    trim(p_objective),
    nullif(trim(p_requested_plan_key), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_commercial_inquiry(
  public.commercial_inquiry_type, text, text, text, text, text, text
) from public;
grant execute on function public.submit_commercial_inquiry(
  public.commercial_inquiry_type, text, text, text, text, text, text
) to anon, authenticated, service_role;
-- One curated brand-token vocabulary serves live retailers, future demos and
-- proposals. Arbitrary CSS, scripts and HTML are deliberately not representable.

create or replace function public.is_valid_retailer_brand_theme(p_theme jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_theme) = 'object'
    and p_theme ?& array[
      'accentColor', 'surfaceColor', 'inkColor', 'displayFont', 'bodyFont',
      'cornerStyle'
    ]
    and not exists (
      select 1 from jsonb_object_keys(p_theme) as key
      where key <> all(array[
        'logoUrl', 'faviconUrl', 'heroImageUrl', 'accentColor', 'surfaceColor',
        'inkColor', 'displayFont', 'bodyFont', 'cornerStyle'
      ])
    )
    and (p_theme->>'accentColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'surfaceColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'inkColor') ~ '^#[0-9a-fA-F]{6}$'
    and p_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
    and p_theme->>'bodyFont' in ('quiet_sans', 'humanist')
    and p_theme->>'cornerStyle' in ('tailored', 'soft', 'architectural')
    and (
      not (p_theme ? 'logoUrl')
      or p_theme->>'logoUrl' = ''
      or p_theme->>'logoUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'faviconUrl')
      or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'heroImageUrl')
      or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
    );
$$;

update public.retailers
set brand_theme = jsonb_build_object(
  'accentColor', coalesce(nullif(brand_theme->>'accentColor', ''), '#1a1a1a'),
  'surfaceColor', '#f5f3f0',
  'inkColor', '#1a1a1a',
  'displayFont',
    case when brand_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
      then brand_theme->>'displayFont' else 'paon_editorial' end,
  'bodyFont', 'quiet_sans',
  'cornerStyle', 'soft'
) || case when coalesce(brand_theme->>'logoUrl', '') ~ '^https://'
  then jsonb_build_object('logoUrl', brand_theme->>'logoUrl') else '{}'::jsonb end;

alter table public.retailers
  add constraint retailers_brand_theme_is_valid
  check (public.is_valid_retailer_brand_theme(brand_theme));

alter table public.retailers
  alter column brand_theme set default '{
    "accentColor":"#1a1a1a",
    "surfaceColor":"#f5f3f0",
    "inkColor":"#1a1a1a",
    "displayFont":"paon_editorial",
    "bodyFont":"quiet_sans",
    "cornerStyle":"soft"
  }'::jsonb;

create table public.retailer_brand_theme_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  theme jsonb not null check (public.is_valid_retailer_brand_theme(theme)),
  change_note text not null check (length(trim(change_note)) between 2 and 240),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (retailer_id, version_number)
);

create index retailer_brand_theme_versions_retailer_idx
  on public.retailer_brand_theme_versions(retailer_id, version_number desc);

alter table public.retailer_brand_theme_versions enable row level security;

create policy "platform staff manage retailer theme versions"
  on public.retailer_brand_theme_versions for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "retailer owners and admins read theme versions"
  on public.retailer_brand_theme_versions for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_brand_theme_versions
  to authenticated, service_role;

create or replace function public.save_retailer_brand_theme(
  p_retailer_id uuid,
  p_theme jsonb,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  if not (
    public.is_platform_staff()
    or (
      p_retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'admin')
    )
    or auth.role() = 'service_role'
  ) then
    raise exception 'Not authorized to configure this retailer theme';
  end if;

  if not public.is_valid_retailer_brand_theme(p_theme)
    or length(trim(p_change_note)) not between 2 and 240
  then
    raise exception 'Invalid retailer brand theme';
  end if;

  perform 1 from public.retailers where id = p_retailer_id for update;
  if not found then raise exception 'Retailer not found'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.retailer_brand_theme_versions
  where retailer_id = p_retailer_id;

  insert into public.retailer_brand_theme_versions (
    retailer_id, version_number, theme, change_note, changed_by_user_id
  ) values (
    p_retailer_id, v_version, p_theme, trim(p_change_note), auth.uid()
  );

  update public.retailers set brand_theme = p_theme where id = p_retailer_id;
  return v_version;
end;
$$;

revoke all on function public.save_retailer_brand_theme(uuid, jsonb, text)
  from public;
grant execute on function public.save_retailer_brand_theme(uuid, jsonb, text)
  to authenticated, service_role;

create or replace function public.restore_retailer_brand_theme(
  p_retailer_id uuid,
  p_version_number integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme jsonb;
begin
  if not (
    public.is_platform_staff()
    or (
      p_retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'admin')
    )
    or auth.role() = 'service_role'
  ) then
    raise exception 'Not authorized to restore this retailer theme';
  end if;

  select theme into v_theme
  from public.retailer_brand_theme_versions
  where retailer_id = p_retailer_id and version_number = p_version_number;
  if not found then raise exception 'Theme version not found'; end if;

  return public.save_retailer_brand_theme(
    p_retailer_id, v_theme, 'Restored version ' || p_version_number
  );
end;
$$;

revoke all on function public.restore_retailer_brand_theme(uuid, integer)
  from public;
grant execute on function public.restore_retailer_brand_theme(uuid, integer)
  to authenticated, service_role;

create or replace function public.enforce_retailer_staff_editable_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role'
    or current_user <> session_user
    or public.is_platform_staff()
  then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.tier is distinct from old.tier
    or new.slug is distinct from old.slug
    or new.default_currency is distinct from old.default_currency
    or new.brand_theme is distinct from old.brand_theme
  then
    raise exception
      'Retailer staff may only update profile fields directly; platform fields and brand themes use their dedicated workflows';
  end if;

  return new;
end;
$$;
create or replace function public.hex_color_relative_luminance(p_hex text)
returns double precision
language plpgsql
immutable
strict
as $$
declare
  r double precision;
  g double precision;
  b double precision;
begin
  r := ('x' || substr(p_hex, 2, 2))::bit(8)::integer / 255.0;
  g := ('x' || substr(p_hex, 4, 2))::bit(8)::integer / 255.0;
  b := ('x' || substr(p_hex, 6, 2))::bit(8)::integer / 255.0;
  r := case when r <= 0.04045 then r / 12.92 else power((r + 0.055) / 1.055, 2.4) end;
  g := case when g <= 0.04045 then g / 12.92 else power((g + 0.055) / 1.055, 2.4) end;
  b := case when b <= 0.04045 then b / 12.92 else power((b + 0.055) / 1.055, 2.4) end;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
end;
$$;

create or replace function public.hex_color_contrast_ratio(
  p_first text,
  p_second text
)
returns double precision
language sql
immutable
strict
as $$
  select
    (greatest(
      public.hex_color_relative_luminance(p_first),
      public.hex_color_relative_luminance(p_second)
    ) + 0.05)
    /
    (least(
      public.hex_color_relative_luminance(p_first),
      public.hex_color_relative_luminance(p_second)
    ) + 0.05);
$$;

create or replace function public.is_valid_retailer_brand_theme(p_theme jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_theme) = 'object'
    and p_theme ?& array[
      'accentColor', 'surfaceColor', 'inkColor', 'displayFont', 'bodyFont',
      'cornerStyle'
    ]
    and not exists (
      select 1 from jsonb_object_keys(p_theme) as key
      where key <> all(array[
        'logoUrl', 'faviconUrl', 'heroImageUrl', 'accentColor', 'surfaceColor',
        'inkColor', 'displayFont', 'bodyFont', 'cornerStyle'
      ])
    )
    and (p_theme->>'accentColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'surfaceColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'inkColor') ~ '^#[0-9a-fA-F]{6}$'
    and public.hex_color_contrast_ratio(
      p_theme->>'surfaceColor', p_theme->>'inkColor'
    ) >= 4.5
    and p_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
    and p_theme->>'bodyFont' in ('quiet_sans', 'humanist')
    and p_theme->>'cornerStyle' in ('tailored', 'soft', 'architectural')
    and (
      not (p_theme ? 'logoUrl') or p_theme->>'logoUrl' = ''
      or p_theme->>'logoUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'faviconUrl') or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
    )
    and (
      not (p_theme ? 'heroImageUrl') or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
    );
$$;
create type public.commercial_prospect_stage as enum (
  'researched', 'qualified', 'demo_preparation', 'demo_ready', 'demo_sent',
  'consultation', 'proposal', 'pilot', 'converted', 'lost'
);

create table public.commercial_prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) between 2 and 160),
  website_url text check (website_url is null or website_url ~ '^https://'),
  primary_contact_name text not null
    check (length(trim(primary_contact_name)) between 2 and 160),
  primary_contact_email text not null
    check (primary_contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  primary_contact_phone text,
  stage public.commercial_prospect_stage not null default 'researched',
  source text not null default 'founder_outreach',
  observed_opportunities text[] not null default '{}',
  sales_notes text not null default '',
  recommended_plan_id uuid references public.subscription_plans(id) on delete set null,
  next_action text,
  next_action_due_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_commercial_prospects_updated_at before update
  on public.commercial_prospects for each row execute function public.set_updated_at();

alter table public.commercial_prospects enable row level security;
create policy "platform staff manage commercial prospects"
  on public.commercial_prospects for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
grant select, insert, update, delete on public.commercial_prospects
  to authenticated, service_role;

create type public.demo_configuration_status as enum ('draft', 'review_ready', 'published');

create table public.prospect_demo_configurations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique
    references public.commercial_prospects(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  theme jsonb not null default '{
    "accentColor":"#1a1a1a",
    "surfaceColor":"#f5f3f0",
    "inkColor":"#1a1a1a",
    "displayFont":"paon_editorial",
    "bodyFont":"quiet_sans",
    "cornerStyle":"soft"
  }'::jsonb check (public.is_valid_retailer_brand_theme(theme)),
  marketing_headline text not null default ''
    check (length(marketing_headline) <= 180),
  personalized_introduction text not null default ''
    check (length(personalized_introduction) <= 2000),
  locations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(locations) = 'array' and jsonb_array_length(locations) <= 25),
  product_mix text[] not null default '{}'
    check (product_mix <@ array[
      'tailoring', 'formalwear', 'ready_to_wear', 'accessories',
      'bridal', 'made_to_measure'
    ]),
  status public.demo_configuration_status not null default 'draft',
  current_version integer not null default 0 check (current_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_prospect_demo_configurations_updated_at before update
  on public.prospect_demo_configurations for each row execute function public.set_updated_at();

create table public.prospect_demo_modules (
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete cascade,
  feature_key text not null references public.commercial_features(key) on delete restrict,
  primary key (configuration_id, feature_key)
);

create table public.prospect_demo_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_note text not null check (length(trim(change_note)) between 2 and 240),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (configuration_id, version_number)
);

alter table public.prospect_demo_configurations enable row level security;
alter table public.prospect_demo_modules enable row level security;
alter table public.prospect_demo_configuration_versions enable row level security;

create policy "platform staff manage prospect demo configurations"
  on public.prospect_demo_configurations for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff manage prospect demo modules"
  on public.prospect_demo_modules for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff manage prospect demo versions"
  on public.prospect_demo_configuration_versions for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());

grant select, insert, update, delete on public.prospect_demo_configurations,
  public.prospect_demo_modules, public.prospect_demo_configuration_versions
  to authenticated, service_role;

create or replace function public.save_prospect_demo_configuration(
  p_prospect_id uuid,
  p_plan_id uuid,
  p_theme jsonb,
  p_marketing_headline text,
  p_personalized_introduction text,
  p_locations jsonb,
  p_product_mix text[],
  p_feature_keys text[],
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_configuration_id uuid;
  v_version integer;
  v_snapshot jsonb;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  if not public.is_valid_retailer_brand_theme(p_theme)
    or jsonb_typeof(p_locations) <> 'array'
    or jsonb_array_length(p_locations) > 25
    or coalesce(array_length(p_feature_keys, 1), 0) = 0
    or length(p_marketing_headline) > 180
    or length(p_personalized_introduction) > 2000
    or length(trim(p_change_note)) not between 2 and 240
    or not (p_product_mix <@ array[
      'tailoring', 'formalwear', 'ready_to_wear', 'accessories',
      'bridal', 'made_to_measure'
    ])
  then
    raise exception 'Invalid demo configuration';
  end if;
  if exists (
    select 1 from unnest(p_feature_keys) key
    where not exists (select 1 from public.commercial_features f where f.key = key)
  ) then
    raise exception 'Unknown demo capability';
  end if;
  if not exists (
    select 1 from public.commercial_prospects
    where id = p_prospect_id and deleted_at is null
  ) then raise exception 'Prospect not found'; end if;

  insert into public.prospect_demo_configurations (prospect_id)
  values (p_prospect_id)
  on conflict (prospect_id) do update set updated_at = now()
  returning id into v_configuration_id;
  perform 1 from public.prospect_demo_configurations
    where id = v_configuration_id for update;

  select current_version + 1 into v_version
  from public.prospect_demo_configurations where id = v_configuration_id;

  update public.prospect_demo_configurations set
    plan_id = p_plan_id,
    theme = p_theme,
    marketing_headline = trim(p_marketing_headline),
    personalized_introduction = trim(p_personalized_introduction),
    locations = p_locations,
    product_mix = p_product_mix,
    current_version = v_version
  where id = v_configuration_id;

  delete from public.prospect_demo_modules where configuration_id = v_configuration_id;
  insert into public.prospect_demo_modules(configuration_id, feature_key)
    select v_configuration_id, key from unnest(p_feature_keys) key;

  select jsonb_build_object(
    'planId', p_plan_id,
    'theme', p_theme,
    'marketingHeadline', trim(p_marketing_headline),
    'personalizedIntroduction', trim(p_personalized_introduction),
    'locations', p_locations,
    'productMix', to_jsonb(p_product_mix),
    'featureKeys', to_jsonb(p_feature_keys)
  ) into v_snapshot;

  insert into public.prospect_demo_configuration_versions (
    configuration_id, version_number, snapshot, change_note, changed_by_user_id
  ) values (
    v_configuration_id, v_version, v_snapshot, trim(p_change_note), auth.uid()
  );
  update public.commercial_prospects
    set stage = case when stage in ('researched', 'qualified')
      then 'demo_preparation' else stage end
    where id = p_prospect_id;
  return v_version;
end;
$$;

revoke all on function public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text
) from public;
grant execute on function public.save_prospect_demo_configuration(
  uuid, uuid, jsonb, text, text, jsonb, text[], text[], text
) to authenticated, service_role;
alter table public.commercial_prospects
  alter column created_by_user_id set default auth.uid();

create or replace function public.protect_commercial_prospect_creator()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.created_by_user_id is distinct from old.created_by_user_id
    and auth.role() <> 'service_role'
  then
    raise exception 'Prospect creator attribution is immutable';
  end if;
  if tg_op = 'INSERT' and auth.role() <> 'service_role' then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger protect_commercial_prospect_creator
  before insert or update on public.commercial_prospects
  for each row execute function public.protect_commercial_prospect_creator();
-- Migration: Create synthetic_demo_generations table for synthetic demo generation and role/device previews

create table public.synthetic_demo_generations (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  device text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users
);

-- Add index for quick lookup
create index synthetic_demo_generations_role_device_idx on public.synthetic_demo_generations (role, device);

-- Enable row level security
alter table public.synthetic_demo_generations enable row level security;

-- Policy: platform staff can view
create policy "platform staff can view synthetic demo generations"
  on public.synthetic_demo_generations for select
  using (public.is_platform_staff());

-- Policy: platform staff can insert (with check)
create policy "platform staff can insert synthetic demo generations"
  on public.synthetic_demo_generations for insert
  with check (public.is_platform_staff());

-- Policy: platform staff can update
create policy "platform staff can update synthetic demo generations"
  on public.synthetic_demo_generations for update
  using (public.is_platform_staff());

-- Policy: platform staff can delete
create policy "platform staff can delete synthetic demo generations"
  on public.synthetic_demo_generations for delete
  using (public.is_platform_staff());insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demo-brand-assets',
  'demo-brand-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']
)
on conflict (id) do nothing;

create policy "anyone can read published demo brand assets"
  on storage.objects for select
  using (bucket_id = 'demo-brand-assets');

create policy "platform staff upload demo brand assets"
  on storage.objects for insert
  with check (bucket_id = 'demo-brand-assets' and public.is_platform_staff());

create policy "platform staff remove demo brand assets"
  on storage.objects for delete
  using (bucket_id = 'demo-brand-assets' and public.is_platform_staff());
-- Migration: Create prospect_demo_previews table for role/device previews

create table public.prospect_demo_previews (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null
    references public.prospect_demo_environments(id) on delete cascade,
  role text not null,
  device text not null,
  preview_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Add index for quick lookup by environment, role, device
create index prospect_demo_previews_env_role_device_idx on public.prospect_demo_previews (environment_id, role, device);

-- Enable row level security
alter table public.prospect_demo_previews enable row level security;

-- Policy: platform staff can view
create policy "platform staff can view prospect demo previews"
  on public.prospect_demo_previews for select
  using (public.is_platform_staff());

-- Policy: platform staff can insert
create policy "platform staff can insert prospect demo previews"
  on public.prospect_demo_previews for insert
  with check (public.is_platform_staff());

-- Policy: platform staff can update
create policy "platform staff can update prospect demo previews"
  on public.prospect_demo_previews for update
  using (public.is_platform_staff());

-- Policy: platform staff can delete
create policy "platform staff can delete prospect demo previews"
  on public.prospect_demo_previews for delete
  using (public.is_platform_staff());-- Migration: Add RPC function for generating synthetic demo previews

create or replace function public.generate_prospect_demo_preview(
  p_environment_id uuid,
  p_role text,
  p_device text,
  p_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview_id uuid;
  v_synthetic_data jsonb;
begin
  -- Verify platform staff access
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;

  -- Verify environment exists
  if not exists (
    select 1 from public.prospect_demo_environments
    where id = p_environment_id
  ) then
    raise exception 'Demo environment not found';
  end if;

  -- Generate synthetic data based on role, device, and config
  -- This is a simplified version - in production, this would call the TypeScript service
  v_synthetic_data := jsonb_build_object(
    'personas', jsonb_build_array(
      jsonb_build_object(
        'key', p_role,
        'label', case p_role
          when 'sales_manager' then 'Retail Sales Manager'
          when 'fashion_designer' then 'Apparel Designer'
          else 'Retail Professional'
        end,
        'attention', case p_role
          when 'sales_manager' then 'Conversion optimization'
          when 'fashion_designer' then 'Customization options'
          else 'Store operations'
        end,
        'primaryAction', case p_role
          when 'sales_manager' then 'Schedule demo'
          when 'fashion_designer' then 'Review product mix'
          else 'Review dashboard'
        end
      )
    ),
    'customers', jsonb_build_array(
      jsonb_build_object(
        'name', case p_device
          when 'desktop' then 'Tech-Savvy Shopper'
          when 'mobile' then 'On-the-go Customer'
          else 'Walk-in Customer'
        end,
        'tier', case p_device
          when 'desktop' then 'VIP'
          else 'Standard'
        end,
        'nextMoment', case p_device
          when 'desktop' then 'Collection preview'
          when 'mobile' then 'Quick fitting'
          else 'Fitting appointment'
        end,
        'lifetimeValue', case p_device
          when 'desktop' then '€12,000'
          when 'mobile' then '€8,500'
          else '€5,000'
        end
      )
    ),
    'products', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'name', product,
          'category', 'Apparel',
          'price', '€150',
          'imageUrl', '/default-product.jpg'
        )
      ) from jsonb_array_elements_text(p_config->'productMix') as product),
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Classic Tailored Suit',
          'category', 'Tailoring',
          'price', '€800',
          'imageUrl', '/default-suit.jpg'
        )
      )
    ),
    'appointments', jsonb_build_array(
      jsonb_build_object('time', '10:00', 'customer', 'Isabelle Moreau', 'purpose', 'Fitting', 'status', 'Confirmed'),
      jsonb_build_object('time', '14:30', 'customer', 'James Wilson', 'purpose', 'Consultation', 'status', 'Pending')
    ),
    'alterations', jsonb_build_array(),
    'orders', jsonb_build_array(),
    'metrics', jsonb_build_object(
      'relationshipValue', '€0',
      'appointmentsToday', 2,
      'garmentsInMotion', 0,
      'returnRate', '5%'
    )
  );

  -- Insert preview record
  insert into public.prospect_demo_previews (environment_id, role, device, preview_data)
  values (p_environment_id, p_role, p_device, v_synthetic_data)
  returning id into v_preview_id;

  return v_preview_id;
end;
$$;

revoke all on function public.generate_prospect_demo_preview(uuid, text, text, jsonb) from public;
grant execute on function public.generate_prospect_demo_preview(uuid, text, text, jsonb) to authenticated, service_role;-- Local Supabase serves Storage over loopback HTTP. Keep production assets
-- HTTPS-only while allowing the actual local demo environment to use its own
-- uploaded files.
create or replace function public.is_valid_retailer_brand_theme(p_theme jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_theme) = 'object'
    and p_theme ?& array[
      'accentColor', 'surfaceColor', 'inkColor', 'displayFont', 'bodyFont',
      'cornerStyle'
    ]
    and not exists (
      select 1 from jsonb_object_keys(p_theme) as key
      where key <> all(array[
        'logoUrl', 'faviconUrl', 'heroImageUrl', 'accentColor', 'surfaceColor',
        'inkColor', 'displayFont', 'bodyFont', 'cornerStyle'
      ])
    )
    and (p_theme->>'accentColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'surfaceColor') ~ '^#[0-9a-fA-F]{6}$'
    and (p_theme->>'inkColor') ~ '^#[0-9a-fA-F]{6}$'
    and public.hex_color_contrast_ratio(
      p_theme->>'surfaceColor', p_theme->>'inkColor'
    ) >= 4.5
    and p_theme->>'displayFont' in ('paon_editorial', 'heritage', 'modern')
    and p_theme->>'bodyFont' in ('quiet_sans', 'humanist')
    and p_theme->>'cornerStyle' in ('tailored', 'soft', 'architectural')
    and (
      not (p_theme ? 'logoUrl') or p_theme->>'logoUrl' = ''
      or p_theme->>'logoUrl' ~ '^https://'
      or p_theme->>'logoUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    )
    and (
      not (p_theme ? 'faviconUrl') or p_theme->>'faviconUrl' = ''
      or p_theme->>'faviconUrl' ~ '^https://'
      or p_theme->>'faviconUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    )
    and (
      not (p_theme ? 'heroImageUrl') or p_theme->>'heroImageUrl' = ''
      or p_theme->>'heroImageUrl' ~ '^https://'
      or p_theme->>'heroImageUrl' ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/'
    );
$$;
create type public.prospect_demo_environment_status as enum (
  'draft', 'published', 'revoked', 'expired'
);

create table public.prospect_demo_environments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique
    references public.commercial_prospects(id) on delete cascade,
  configuration_id uuid not null
    references public.prospect_demo_configurations(id) on delete restrict,
  configuration_version integer not null check (configuration_version > 0),
  public_token text not null unique check (length(public_token) >= 40),
  access_code_hash text,
  status public.prospect_demo_environment_status not null default 'draft',
  expires_at timestamptz not null,
  synthetic_data jsonb not null check (
    jsonb_typeof(synthetic_data) = 'object'
    and synthetic_data ?& array['personas', 'customers', 'products', 'appointments', 'alterations', 'orders', 'metrics']
  ),
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_prospect_demo_environments_updated_at before update
  on public.prospect_demo_environments for each row execute function public.set_updated_at();

create table public.prospect_demo_engagement_events (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null
    references public.prospect_demo_environments(id) on delete cascade,
  event_name text not null check (event_name in ('opened', 'access_denied')),
  occurred_at timestamptz not null default now()
);

alter table public.prospect_demo_environments enable row level security;
alter table public.prospect_demo_engagement_events enable row level security;
create policy "platform staff manage prospect demo environments"
  on public.prospect_demo_environments for all
  using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "platform staff read demo engagement"
  on public.prospect_demo_engagement_events for select
  using (public.is_platform_staff());
grant select, insert, update, delete on public.prospect_demo_environments
  to authenticated, service_role;
grant select on public.prospect_demo_engagement_events to authenticated, service_role;

create or replace function public.generate_prospect_demo_environment(
  p_prospect_id uuid,
  p_public_token text,
  p_access_code text,
  p_expires_at timestamptz,
  p_synthetic_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_configuration public.prospect_demo_configurations%rowtype;
  v_id uuid;
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  select * into v_configuration from public.prospect_demo_configurations
    where prospect_id = p_prospect_id for update;
  if not found or v_configuration.current_version < 1 then
    raise exception 'A saved demo configuration is required';
  end if;
  if length(p_public_token) < 40
    or p_expires_at <= now()
    or length(coalesce(p_access_code, '')) not between 6 and 80
    or jsonb_typeof(p_synthetic_data) <> 'object'
    or not (p_synthetic_data ?& array[
      'personas', 'customers', 'products', 'appointments',
      'alterations', 'orders', 'metrics'
    ])
  then raise exception 'Invalid demo environment'; end if;

  insert into public.prospect_demo_environments (
    prospect_id, configuration_id, configuration_version, public_token,
    access_code_hash, status, expires_at, synthetic_data, created_by_user_id
  ) values (
    p_prospect_id, v_configuration.id, v_configuration.current_version,
    p_public_token, extensions.crypt(p_access_code, extensions.gen_salt('bf')),
    'draft', p_expires_at, p_synthetic_data, auth.uid()
  )
  on conflict (prospect_id) do update set
    configuration_id = excluded.configuration_id,
    configuration_version = excluded.configuration_version,
    public_token = excluded.public_token,
    access_code_hash = excluded.access_code_hash,
    status = 'draft',
    expires_at = excluded.expires_at,
    synthetic_data = excluded.synthetic_data,
    generated_at = now(),
    published_at = null,
    revoked_at = null,
    created_by_user_id = excluded.created_by_user_id
  returning id into v_id;
  update public.commercial_prospects set stage = 'demo_preparation'
    where id = p_prospect_id;
  return v_id;
end;
$$;

create or replace function public.set_prospect_demo_publication(
  p_prospect_id uuid,
  p_publish boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;
  update public.prospect_demo_environments set
    status = case when p_publish then 'published'::public.prospect_demo_environment_status
      else 'revoked'::public.prospect_demo_environment_status end,
    published_at = case when p_publish then now() else published_at end,
    revoked_at = case when p_publish then null else now() end
  where prospect_id = p_prospect_id and expires_at > now();
  if not found then raise exception 'Current demo environment not found'; end if;
  update public.prospect_demo_configurations set
    status = case when p_publish then 'published'::public.demo_configuration_status
      else 'review_ready'::public.demo_configuration_status end
  where prospect_id = p_prospect_id;
  update public.commercial_prospects set
    stage = case when p_publish then 'demo_ready'::public.commercial_prospect_stage
      else 'demo_preparation'::public.commercial_prospect_stage end
  where id = p_prospect_id;
end;
$$;

create or replace function public.open_prospect_demo(
  p_public_token text,
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_environment public.prospect_demo_environments%rowtype;
  v_result jsonb;
begin
  select * into v_environment from public.prospect_demo_environments
  where public_token = p_public_token;
  if not found
    or v_environment.status <> 'published'
    or v_environment.expires_at <= now()
  then return null; end if;
  if v_environment.access_code_hash is not null
    and v_environment.access_code_hash <> extensions.crypt(
      coalesce(p_access_code, ''), v_environment.access_code_hash
    )
  then
    insert into public.prospect_demo_engagement_events(environment_id, event_name)
      values (v_environment.id, 'access_denied');
    return null;
  end if;
  select jsonb_build_object(
    'environmentId', v_environment.id,
    'companyName', p.company_name,
    'expiresAt', v_environment.expires_at,
    'configuration', jsonb_build_object(
      'theme', c.theme,
      'marketingHeadline', c.marketing_headline,
      'personalizedIntroduction', c.personalized_introduction,
      'locations', c.locations,
      'productMix', to_jsonb(c.product_mix)
    ),
    'syntheticData', v_environment.synthetic_data
  ) into v_result
  from public.commercial_prospects p
  join public.prospect_demo_configurations c on c.prospect_id = p.id
  where p.id = v_environment.prospect_id;
  insert into public.prospect_demo_engagement_events(environment_id, event_name)
    values (v_environment.id, 'opened');
  return v_result;
end;
$$;

revoke all on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb
) from public;
revoke all on function public.set_prospect_demo_publication(uuid, boolean) from public;
revoke all on function public.open_prospect_demo(text, text) from public;
grant execute on function public.generate_prospect_demo_environment(
  uuid, text, text, timestamptz, jsonb
) to authenticated, service_role;
grant execute on function public.set_prospect_demo_publication(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.open_prospect_demo(text, text)
  to anon, authenticated, service_role;
-- Migration to create alteration_measurements table for voice command tool
-- Supports voice command measurement tracking and fit tool integration

CREATE TABLE IF NOT EXISTS alteration_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  garment_id UUID REFERENCES garments(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL, -- e.g., 'neiging', 'kraag', 'schouder_l', 'sluitknoop', 'arm_length'
  value NUMERIC,
  unit TEXT DEFAULT 'mm',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  voice_command TEXT,
  confidence_score NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPS
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_customer_id ON alteration_measurements (customer_id);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_garment_id ON alteration_measurements (garment_id);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_recorded_at ON alteration_measurements (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alteration_measurements_voice_command ON alteration_measurements (voice_command);

-- RLS policies for security
ALTER TABLE alteration_measurements ENABLE ROW LEVEL SECURITY;

-- Staff can view all measurements
CREATE POLICY "Staff can view measurements"
  ON alteration_measurements FOR SELECT
  USING (true);

-- Customers can view their own measurements
CREATE POLICY "Customers can view own measurements"
  ON alteration_measurements FOR SELECT
  USING (customer_id = current_user_id());

-- Staff can update measurement status
CREATE POLICY "Staff can update measurement status"
  ON alteration_measurements FOR UPDATE
  USING (true);

-- Staff can insert measurements
CREATE POLICY "Staff can insert measurements"
  ON alteration_measurements FOR INSERT
  WITH CHECK (true);-- Pilot to Live Onboarding Transition
-- Converts a prospect in the 'pilot' stage to an active retailer

create or replace function public.convert_pilot_to_live_retailer(
  p_prospect_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect public.commercial_prospects%rowtype;
  v_retailer_id uuid;
  v_configuration public.prospect_demo_configurations%rowtype;
begin
  -- Check that the prospect exists and is in the pilot stage
  select * into v_prospect from public.commercial_prospects
    where id = p_prospect_id and stage = 'pilot' and deleted_at is null;

  if not found then
    raise exception 'Prospect not found or not in pilot stage';
  end if;

  -- Create a retailer record from the prospect
  insert into public.retailers (
    legal_name,
    display_name,
    slug,
    status,
    tier,
    primary_domain,
    billing_address,
    default_currency,
    default_locale,
    brand_theme
  ) values (
    v_prospect.company_name,
    v_prospect.company_name, -- display_name same as company_name for now
    lower(regexp_replace(v_prospect.company_name, '[^a-z0-9]+', '-', 'g')), -- slug
    'active',
    'boutique', -- default tier, can be updated later
    null, -- primary_domain to be set by retailer during onboarding
    '{}'::jsonb, -- billing_address
    'EUR', -- default_currency
    'en-US', -- default_locale
    '{}'::jsonb -- brand_theme to be set later
  )
  returning id into v_retailer_id;

  -- Optionally, copy the demo configuration to the retailer's brand theme or settings
  -- For now, we'll just note that the retailer can configure their theme later
  -- We could also copy the product mix, locations, etc. to the retailer's initial setup
  -- but that would require additional tables and is beyond the scope of this transition.

  -- Update the prospect stage to 'converted'
  update public.commercial_prospects
    set stage = 'converted'
    where id = p_prospect_id;

  return v_retailer_id;
end;
$$;

-- Grant execute permissions
grant execute on function public.convert_pilot_to_live_retailer(uuid) to authenticated, service_role;

-- Add a comment
comment on function public.convert_pilot_to_live_retailer(uuid) is
  'Converts a prospect in the pilot stage to an active retailer. Returns the new retailer ID.';