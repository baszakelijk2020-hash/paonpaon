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
