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
