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
