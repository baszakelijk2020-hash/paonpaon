-- PHASE 18.5 (BD-105): the employee portal's auth path. A corporate
-- wearer is neither a customer nor retailer staff — see
-- packages/domain/src/corporate/corporate-programme.ts's header for why
-- a wearer is deliberately not folded into either. This migration adds
-- the third identity's own linking columns, claim-sync trigger and
-- self-link RPC, mirroring `retailer_staff_members`'s
-- `sync_retailer_staff_claim` and `customers`'
-- `link_my_customer_accounts` exactly rather than inventing a new
-- pattern for the third time.
--
-- `login_email` is deliberately its own column, never reusing
-- `corporate_wearers.customer_id`'s linked customer's email: most
-- wearers never become retail customers, and portal access must not
-- silently depend on whether one happens to exist.

alter table public.corporate_wearers
  add column if not exists login_email text,
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists corporate_wearers_login_email_unique
  on public.corporate_wearers (lower(login_email))
  where login_email is not null and deleted_at is null;

create index if not exists corporate_wearers_user_id_idx
  on public.corporate_wearers (user_id)
  where user_id is not null;

-- Deliberately NOT `auth.jwt() -> 'app_metadata' ->> 'wearer_id'` like
-- `current_retailer_id()`/`current_retailer_role()`. Those are safe
-- because retailer staff are admin-provisioned: `user_id` is linked
-- (and the claim-sync trigger fires) BEFORE the staff member's first
-- sign-in ever mints a JWT. A wearer's *first* magic-link click both
-- creates their session (`verifyOtp`, minting a JWT with whatever
-- `app_metadata` existed at that instant — none yet) and, in the same
-- request, calls `link_my_wearer_account` to set `user_id`. The trigger
-- fires and updates `auth.users.raw_app_meta_data` correctly, but the
-- JWT already in hand for this request is now stale until a refresh —
-- `auth.jwt()` decodes the request's bearer token locally and never
-- re-fetches. A direct table lookup on `auth.uid()` (the JWT's `sub`,
-- which is correct from the moment the token exists, refresh or not)
-- has no such staleness window. `security definer` is required so this
-- can be called from inside a SELECT policy ON THIS SAME TABLE without
-- recursing into its own RLS.
create or replace function public.current_wearer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.corporate_wearers
    where user_id = auth.uid() and deleted_at is null
    limit 1
$$;

-- Mirrors retailer_staff_members' sync_retailer_staff_claim exactly:
-- writes/clears the wearer_id claim whenever user_id is set/unset.
create or replace function public.sync_corporate_wearer_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.deleted_at is not null or new.user_id is null then
    if old.user_id is not null then
      update auth.users
        set raw_app_meta_data = raw_app_meta_data - 'wearer_id'
        where id = old.user_id;
    end if;
    return coalesce(new, old);
  end if;

  update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('wearer_id', new.id)
    where id = new.user_id;

  return new;
end;
$$;

create trigger sync_corporate_wearer_claim_on_write
  after insert or update or delete on public.corporate_wearers
  for each row
  execute function public.sync_corporate_wearer_claim();

-- Mirrors link_my_customer_accounts exactly: idempotent, matches by the
-- caller's own verified email, safe to call on every session.
create or replace function public.link_my_wearer_account()
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

  update public.corporate_wearers
    set user_id = auth.uid()
    where lower(login_email) = lower(v_email)
      and user_id is null
      and deleted_at is null;
end;
$$;

revoke all on function public.link_my_wearer_account() from public;
grant execute on function public.link_my_wearer_account() to authenticated;

-- Additional, narrow SELECT policies for a wearer's own data — these
-- are OR'd with the existing staff-only policies (PHASE 14.1), never
-- replacing them. A wearer never gains INSERT/UPDATE here.
create policy corporate_wearers_self_select
  on public.corporate_wearers for select to authenticated using (
    id = public.current_wearer_id()
  );

create policy corporate_programmes_wearer_select
  on public.corporate_programmes for select to authenticated using (
    id in (
      select programme_id from public.corporate_wearers
      where id = public.current_wearer_id()
    )
  );

create policy corporate_entitlement_versions_wearer_select
  on public.corporate_entitlement_versions for select to authenticated using (
    programme_id in (
      select programme_id from public.corporate_wearers
      where id = public.current_wearer_id()
    )
  );

create policy corporate_issue_records_wearer_select
  on public.corporate_issue_records for select to authenticated using (
    wearer_id = public.current_wearer_id()
  );

comment on column public.corporate_wearers.login_email is
  'PHASE 18.5. Employee Portal login identity — deliberately separate '
  'from the optional linked customer_id''s email; most wearers never '
  'become retail customers.';
