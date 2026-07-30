-- PHASE 10.1 / CMP-101: versioned campaign library + pinned retailer copies.

create table if not exists public.campaign_library_entries (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (
    key in ('private_offer_member_fabric')
  ),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_library_entries enable row level security;
revoke all on table public.campaign_library_entries from public, anon;
grant select on table public.campaign_library_entries
  to authenticated, service_role;
grant insert, update on table public.campaign_library_entries
  to service_role;

create policy campaign_library_entries_authenticated_select
  on public.campaign_library_entries for select to authenticated
  using (true);

create table if not exists public.campaign_library_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null
    references public.campaign_library_entries (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft', 'active', 'retired')),
  snapshot jsonb not null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, version_number)
);

create unique index if not exists campaign_library_versions_one_active
  on public.campaign_library_versions (entry_id)
  where status = 'active';

alter table public.campaign_library_versions enable row level security;
revoke all on table public.campaign_library_versions from public, anon;
grant select on table public.campaign_library_versions
  to authenticated, service_role;
grant insert, update on table public.campaign_library_versions
  to service_role;

create policy campaign_library_versions_authenticated_select
  on public.campaign_library_versions for select to authenticated
  using (true);

create or replace function public.enforce_campaign_library_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.snapshot is distinct from old.snapshot then
      raise exception 'Campaign library version snapshot is immutable';
    end if;
    if new.entry_id is distinct from old.entry_id
      or new.version_number is distinct from old.version_number then
      raise exception 'Campaign library version identity is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_library_versions_immutable_trg
  on public.campaign_library_versions;
create trigger campaign_library_versions_immutable_trg
  before update on public.campaign_library_versions
  for each row
  execute function public.enforce_campaign_library_version_immutability();

alter table public.campaigns
  add column if not exists library_entry_id uuid
    references public.campaign_library_entries (id),
  add column if not exists library_version_id uuid
    references public.campaign_library_versions (id),
  add column if not exists library_pinned_at timestamptz;

create index if not exists campaigns_library_version_idx
  on public.campaigns (library_version_id)
  where library_version_id is not null;

insert into public.campaign_library_entries (key, display_name)
values ('private_offer_member_fabric', 'Member fabric private offer')
on conflict (key) do nothing;

comment on table public.campaign_library_entries is
  'PAON campaign library catalogue (PHASE 10.1 / CMP-101).';
comment on table public.campaign_library_versions is
  'Immutable library version snapshots; retailer campaigns pin a version id.';
