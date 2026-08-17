-- PHASE 14.1 (CORP-101-106): the Employee Portal's manager auth path.
-- PHASE 18.5 built the wearer identity (an individual employee reading
-- their own data); this migration adds the second, separate identity
-- 14.1's own owner boundary always named but never built — the person
-- at the CLIENT company who runs the whole programme (roster, entitlement
-- status, open issues, announcements) across possibly several
-- `corporate_programmes` under one `corporate_accounts` row. A manager
-- is deliberately its own identity, never a `corporate_wearers` row with
-- an extra flag: a manager may not be outfitted at all, and folding the
-- two would let a programme-wide read leak through what is meant to stay
-- a strictly self-scoped wearer policy (see 20260804160000's header).
--
-- Mirrors 20260804160000 (`corporate_wearers` portal auth) exactly:
-- same login_email/user_id column pair, same "direct auth.uid() lookup,
-- not the JWT claim" reasoning for the current_*_id() helper (a
-- manager's first magic-link click has the identical staleness window),
-- same claim-sync trigger shape, same idempotent self-link RPC.

create table public.corporate_managers (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  account_id uuid not null references public.corporate_accounts (id) on delete cascade,
  contact_name text not null,
  login_email text,
  user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index corporate_managers_login_email_unique
  on public.corporate_managers (lower(login_email))
  where login_email is not null and deleted_at is null;

create index corporate_managers_user_id_idx
  on public.corporate_managers (user_id)
  where user_id is not null;

create index corporate_managers_account_idx
  on public.corporate_managers (account_id)
  where deleted_at is null;

alter table public.corporate_managers enable row level security;
revoke all on table public.corporate_managers from public, anon;
grant select, insert, update on table public.corporate_managers
  to authenticated, service_role;

-- Staff CRUD — same shape as the foundation migration's per-table loop
-- (20260801000012): any retailer staff role may read/invite/edit a
-- manager contact for their own retailer. This table postdates that
-- loop, so it needs its own copy rather than being added to the array.
create policy corporate_managers_staff_select
  on public.corporate_managers for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy corporate_managers_staff_insert
  on public.corporate_managers for insert to authenticated with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy corporate_managers_staff_update
  on public.corporate_managers for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

-- Same cross-tenant guard as corporate_wearer_customer_tenant_chk
-- (20260809200000) and corporate_announcement_programme_tenant_chk
-- (20260809220000): a CHECK constraint can't do the cross-table lookup,
-- so account_id's retailer_id agreement is enforced by trigger.
create or replace function public.check_corporate_manager_account_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.corporate_accounts a
    where a.id = new.account_id
      and a.retailer_id = new.retailer_id
  ) then
    raise exception 'account_id must belong to the same retailer as the manager';
  end if;
  return new;
end;
$$;

revoke all on function public.check_corporate_manager_account_tenant() from public;

create trigger corporate_manager_account_tenant_chk
  before insert or update of account_id, retailer_id
  on public.corporate_managers
  for each row execute function public.check_corporate_manager_account_tenant();

create trigger set_corporate_managers_updated_at
  before update on public.corporate_managers
  for each row execute function public.set_updated_at();

-- Deliberately a direct table lookup on auth.uid(), not
-- auth.jwt() -> 'app_metadata' ->> 'manager_id' — see 20260804160000's
-- header for the exact first-login staleness window this avoids.
create or replace function public.current_corporate_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.corporate_managers
    where user_id = auth.uid() and deleted_at is null
    limit 1
$$;

-- Mirrors sync_corporate_wearer_claim exactly: writes/clears the
-- manager_id claim whenever user_id is set/unset.
create or replace function public.sync_corporate_manager_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.deleted_at is not null or new.user_id is null then
    if old.user_id is not null then
      update auth.users
        set raw_app_meta_data = raw_app_meta_data - 'manager_id'
        where id = old.user_id;
    end if;
    return coalesce(new, old);
  end if;

  update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('manager_id', new.id)
    where id = new.user_id;

  return new;
end;
$$;

create trigger sync_corporate_manager_claim_on_write
  after insert or update or delete on public.corporate_managers
  for each row
  execute function public.sync_corporate_manager_claim();

-- Mirrors link_my_wearer_account exactly: idempotent, matches by the
-- caller's own verified email, safe to call on every session.
create or replace function public.link_my_corporate_manager_account()
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

  update public.corporate_managers
    set user_id = auth.uid()
    where lower(login_email) = lower(v_email)
      and user_id is null
      and deleted_at is null;
end;
$$;

revoke all on function public.link_my_corporate_manager_account() from public;
grant execute on function public.link_my_corporate_manager_account() to authenticated;

-- ---------------------------------------------------------------------------
-- READ policies. Additive (OR'd with the existing staff-only policies from
-- 20260801000012), never replacing them. A manager sees their own account's
-- programmes/wearers/entitlements/issues/exceptions/announcements — the same
-- breadth retailer staff have, but scoped to one account instead of the
-- whole retailer. No salary/manager-hierarchy/measurement access is granted
-- here at all: this policy set only touches the corporate_* tables already
-- named in the manager's owner boundary, never customer/measurement/
-- wardrobe tables — a corporate manager reading a colleague's chest
-- measurement is the same failure mode 14.1 already refuses for retailer
-- staff's own scoped view.
-- ---------------------------------------------------------------------------

create policy corporate_managers_self_select
  on public.corporate_managers for select to authenticated using (
    id = public.current_corporate_manager_id()
  );

create policy corporate_accounts_manager_select
  on public.corporate_accounts for select to authenticated using (
    id in (
      select account_id from public.corporate_managers
      where id = public.current_corporate_manager_id()
    )
  );

create policy corporate_programmes_manager_select
  on public.corporate_programmes for select to authenticated using (
    account_id in (
      select account_id from public.corporate_managers
      where id = public.current_corporate_manager_id()
    )
  );

create policy corporate_wearers_manager_select
  on public.corporate_wearers for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

create policy corporate_entitlement_versions_manager_select
  on public.corporate_entitlement_versions for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

create policy corporate_issue_records_manager_select
  on public.corporate_issue_records for select to authenticated using (
    wearer_id in (
      select w.id from public.corporate_wearers w
      join public.corporate_programmes p on p.id = w.programme_id
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

create policy corporate_exceptions_manager_select
  on public.corporate_exceptions for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

-- A manager sees drafts too (they may be the one publishing them), unlike
-- corporate_announcements_wearer_select (20260809220000) which is
-- published-only.
create policy corporate_announcements_manager_select
  on public.corporate_announcements for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

-- ---------------------------------------------------------------------------
-- corporate_announcements (20260809220000) was staff-authored-only:
-- authored_by_staff_id is NOT NULL. A manager needs to author too, so
-- this widens to dual authorship (exactly one of the two set) rather than
-- reusing the staff column for a non-staff identity.
-- ---------------------------------------------------------------------------

alter table public.corporate_announcements
  alter column authored_by_staff_id drop not null,
  add column authored_by_manager_id uuid
    references public.corporate_managers (id) on delete set null;

alter table public.corporate_announcements
  add constraint corporate_announcements_single_author_chk check (
    (authored_by_staff_id is not null) <> (authored_by_manager_id is not null)
  );

-- ---------------------------------------------------------------------------
-- WRITE policies — deliberately narrow. A manager may raise an exception
-- for one of their own account's wearers (same shape as
-- corporate_exceptions_wearer_insert, 20260804190000) and author/publish
-- an announcement for one of their own account's programmes. A manager
-- gets NO write path to corporate_wearers, corporate_entitlement_versions
-- or corporate_issue_records — entitlement and roster changes stay
-- retailer-staff-only, matching 14.1's hard constraint that PAON (not the
-- client company) owns entitlement truth.
-- ---------------------------------------------------------------------------

create policy corporate_exceptions_manager_insert
  on public.corporate_exceptions for insert to authenticated with check (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

create policy corporate_announcements_manager_insert
  on public.corporate_announcements for insert to authenticated with check (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
    and authored_by_manager_id = public.current_corporate_manager_id()
  );

-- Update is scoped to the manager's own authored rows only — never a
-- staff-authored announcement, even one in the manager's own programme.
create policy corporate_announcements_manager_update
  on public.corporate_announcements for update to authenticated using (
    authored_by_manager_id = public.current_corporate_manager_id()
  ) with check (
    authored_by_manager_id = public.current_corporate_manager_id()
  );

comment on table public.corporate_managers is
  'PHASE 14.1. The corporate account''s own contact who runs the wardrobe '
  'programme day to day — distinct from an individual corporate_wearers '
  'row (may not be outfitted at all) and from retailer staff (scoped to '
  'one corporate_accounts row, never the whole retailer tenant).';

comment on column public.corporate_managers.login_email is
  'Employee Portal (manager surface) login identity — same deliberate '
  'separation from any linked-customer email as corporate_wearers.login_email.';
