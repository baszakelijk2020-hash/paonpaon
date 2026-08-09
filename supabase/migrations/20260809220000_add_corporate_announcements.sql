-- Corporate programme announcements (PHASE 18.5 / BD-105).
--
-- The last of 18.5's owner-boundary surfaces that still had no schema at
-- all: "appointments, measurements, wardrobe, orders, alterations,
-- tickets, announcements." Tickets already exist (18.8's
-- corporate_exceptions); this is the remaining one. Deliberately not the
-- same table as `staff_announcements` (20260801000006) — that table's
-- audience is retailer staff by role/branch; this one's audience is a
-- programme's wearers, a different reader population entirely, same
-- reasoning `academy_roleplay_grades` stayed separate from
-- `staff_announcements` rather than overloading one "announcements"
-- concept onto two unrelated audiences.
--
-- Draft-until-published, same posture `staff_announcements` already uses
-- (`published_at` nullable): a manager can write a draft that no wearer
-- sees until they explicitly publish it.

create table public.corporate_announcements (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null references public.corporate_programmes (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  body text not null check (char_length(btrim(body)) between 10 and 20000),
  authored_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index corporate_announcements_programme_idx
  on public.corporate_announcements (programme_id, published_at desc);
create index corporate_announcements_retailer_idx
  on public.corporate_announcements (retailer_id);

comment on table public.corporate_announcements is
  'PHASE 18.5 / BD-105: programme-scoped news for a corporate programme''s '
  'wearers. Draft (published_at null) until a manager explicitly publishes '
  'it — never visible to a wearer before that.';

-- Tenant invariant: retailer_id and programme_id are two independent FKs
-- with no cross-check between them, so RLS's own "retailer_id = caller's
-- own retailer" alone does not stop a same-retailer-shaped insert whose
-- programme_id actually belongs to a DIFFERENT retailer. Same trigger
-- shape as corporate_wearer_customer_tenant_chk (20260809200000).
create or replace function public.check_corporate_announcement_programme_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.corporate_programmes p
    where p.id = new.programme_id
      and p.retailer_id = new.retailer_id
  ) then
    raise exception 'programme_id must belong to the same retailer as the announcement';
  end if;
  return new;
end;
$$;

revoke all on function public.check_corporate_announcement_programme_tenant()
  from public;

create trigger corporate_announcement_programme_tenant_chk
  before insert or update of programme_id, retailer_id
  on public.corporate_announcements
  for each row execute function public.check_corporate_announcement_programme_tenant();

create trigger set_corporate_announcements_updated_at
  before update on public.corporate_announcements
  for each row execute function public.set_updated_at();

alter table public.corporate_announcements enable row level security;
revoke all on table public.corporate_announcements from public, anon;

create policy corporate_announcements_retailer_select
  on public.corporate_announcements for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) is not null
  );

create policy corporate_announcements_staff_insert
  on public.corporate_announcements for insert to authenticated
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'manager', 'admin')
  );

create policy corporate_announcements_staff_update
  on public.corporate_announcements for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'manager', 'admin')
  )
  with check (retailer_id = (select public.current_retailer_id()));

-- A wearer reads only PUBLISHED announcements for their OWN programme —
-- never a draft, never another programme's news, even within the same
-- retailer/account.
create policy corporate_announcements_wearer_select
  on public.corporate_announcements for select to authenticated
  using (
    published_at is not null
    and exists (
      select 1 from public.corporate_wearers cw
      where cw.programme_id = corporate_announcements.programme_id
        and cw.user_id = (select auth.uid())
        and cw.deleted_at is null
    )
  );

grant select, insert, update on table public.corporate_announcements
  to authenticated;
grant all on table public.corporate_announcements to service_role;
