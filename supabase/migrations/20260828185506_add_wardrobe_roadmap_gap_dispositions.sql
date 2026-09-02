-- Phase 20.17 (CENV-WARDROBE-REMOVE-001) — customer removal of an advisor
-- selection from their wardrobe plan.
--
-- CUSTOMER_ENVIRONMENT_REBUILD_V3 §5.5: an approved roadmap's unfilled gap
-- renders in the wardrobe as an "Advisor selection" card, one action of
-- which is "Remove from wardrobe plan". "Remove updates the real roadmap /
-- selection state and requires confirmation."
--
-- The existing schema cannot represent this safely: `wardrobe_roadmap_gaps`
-- has no customer-writable column, and its only mutation is
-- `filled_by_product_id` / `filled_by_wardrobe_item_id` — an advisor-owned
-- "this gap is now filled" signal, not "the customer dismissed this
-- suggestion". Reusing it would (a) let a customer write advisor-owned
-- fields they otherwise cannot, and (b) conflate two distinct meanings.
-- Hard-deleting the gap / stage / roadmap is explicitly forbidden — the
-- advisor keeps their authored plan and its history.
--
-- Smallest safe representation: a separate, customer-scoped, one-way
-- disposition table. A row here means "this customer removed this advisor
-- selection from their own wardrobe-plan presentation". The advisor-
-- authored roadmap, gaps, stages, and audit history are untouched; the
-- wardrobe page simply filters out any gap the customer has a disposition
-- for. Staff continue to read the underlying roadmap and gaps through
-- their existing policies.
--
-- Tenancy is pinned three ways with no SECURITY DEFINER: (1) a composite
-- FK ties (customer_id, retailer_id) to the same-tenant customers row;
-- (2) a BEFORE INSERT trigger, SECURITY INVOKER, search_path = '',
-- re-derives the gap -> roadmap and asserts the roadmap is the customer's
-- own approved roadmap in the same retailer and contains the gap — reading
-- only tables the customer's RLS session can already see
-- (wardrobe_roadmap_gaps, wardrobe_roadmaps), unlike
-- enforce_wardrobe_roadmap_tenancy which needs the staff table; (3) the
-- INSERT RLS policy repeats the ownership + approved-status check so a
-- direct API call cannot bypass application code. Identity columns are
-- immutable via a BEFORE UPDATE trigger, and there is no UPDATE or DELETE
-- policy for anyone — the disposition is append-only from every caller's
-- perspective (service_role retains full access for fixtures / support
-- tooling only, per docs/DATABASE.md).

create table if not exists public.wardrobe_roadmap_gap_dispositions (
  id uuid primary key default gen_random_uuid(),
  roadmap_gap_id uuid not null
    references public.wardrobe_roadmap_gaps (id) on delete cascade,
  roadmap_id uuid not null
    references public.wardrobe_roadmaps (id) on delete cascade,
  retailer_id uuid not null
    references public.retailers (id) on delete cascade,
  customer_id uuid not null
    references public.customers (id) on delete cascade,
  disposition text not null default 'removed_from_plan'
    check (disposition in ('removed_from_plan')),
  created_at timestamptz not null default now(),
  constraint wardrobe_roadmap_gap_dispositions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint wardrobe_roadmap_gap_dispositions_gap_customer_key
    unique (roadmap_gap_id, customer_id)
);

create index if not exists wardrobe_roadmap_gap_dispositions_customer_idx
  on public.wardrobe_roadmap_gap_dispositions (customer_id, disposition);

create index if not exists wardrobe_roadmap_gap_dispositions_retailer_idx
  on public.wardrobe_roadmap_gap_dispositions (retailer_id);

comment on table public.wardrobe_roadmap_gap_dispositions is
  'Customer-scoped, one-way disposition: a row means this customer removed '
  'this advisor-selection (approved wardrobe_roadmap_gap) from their own '
  'wardrobe-plan presentation. Never mutates or deletes the advisor-'
  'authored roadmap/gap/stage or its history. Phase 20.17.';

-- ---------------------------------------------------------------------------
-- Tenancy trigger — BEFORE INSERT, security invoker, empty search path.
-- Reads only tables the customer session can already see.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_wardrobe_roadmap_gap_disposition_tenancy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_gap_roadmap_id uuid;
  v_gap_retailer_id uuid;
  v_roadmap_customer_id uuid;
  v_roadmap_retailer_id uuid;
  v_roadmap_status text;
  v_roadmap_deleted_at timestamptz;
begin
  select gap.roadmap_id, gap.retailer_id
    into v_gap_roadmap_id, v_gap_retailer_id
  from public.wardrobe_roadmap_gaps as gap
  where gap.id = new.roadmap_gap_id;
  if v_gap_roadmap_id is null then
    raise exception 'Advisor selection not found';
  end if;

  select r.customer_id, r.retailer_id, r.status, r.deleted_at
    into v_roadmap_customer_id, v_roadmap_retailer_id,
         v_roadmap_status, v_roadmap_deleted_at
  from public.wardrobe_roadmaps as r
  where r.id = v_gap_roadmap_id;
  if v_roadmap_customer_id is null then
    raise exception 'Advisor selection roadmap not found';
  end if;

  if new.roadmap_id <> v_gap_roadmap_id
    or new.retailer_id <> v_gap_retailer_id
    or new.retailer_id <> v_roadmap_retailer_id
    or new.customer_id <> v_roadmap_customer_id then
    raise exception 'Gap disposition does not match the advisor selection tenancy';
  end if;

  if v_roadmap_deleted_at is not null
    or v_roadmap_status <> 'approved' then
    raise exception 'Advisor selection is not on an approved wardrobe plan';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_roadmap_gap_disposition_tenancy() from public;

create trigger enforce_wardrobe_roadmap_gap_disposition_tenancy_on_insert
  before insert on public.wardrobe_roadmap_gap_dispositions
  for each row
  execute function public.enforce_wardrobe_roadmap_gap_disposition_tenancy();

-- ---------------------------------------------------------------------------
-- Identity immutability — BEFORE UPDATE. There is no UPDATE policy for any
-- authenticated caller; this guards service_role / support tooling too.
-- ---------------------------------------------------------------------------
create or replace function public.protect_wardrobe_roadmap_gap_disposition_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.roadmap_gap_id is distinct from old.roadmap_gap_id
    or new.roadmap_id is distinct from old.roadmap_id
    or new.retailer_id is distinct from old.retailer_id
    or new.customer_id is distinct from old.customer_id then
    raise exception 'Wardrobe roadmap gap disposition identity fields are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_wardrobe_roadmap_gap_disposition_identity() from public;

create trigger protect_wardrobe_roadmap_gap_disposition_identity_on_update
  before update on public.wardrobe_roadmap_gap_dispositions
  for each row
  execute function public.protect_wardrobe_roadmap_gap_disposition_identity();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.wardrobe_roadmap_gap_dispositions enable row level security;

revoke all on table public.wardrobe_roadmap_gap_dispositions from anon;

create policy "customers read own gap dispositions"
  on public.wardrobe_roadmap_gap_dispositions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmap_gap_dispositions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "customers create own gap dispositions"
  on public.wardrobe_roadmap_gap_dispositions for insert to authenticated
  with check (
    disposition = 'removed_from_plan'
    and exists (
      select 1 from public.customers c
      where c.id = wardrobe_roadmap_gap_dispositions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
    and exists (
      select 1
      from public.wardrobe_roadmaps r
      join public.wardrobe_roadmap_gaps g on g.roadmap_id = r.id
      where g.id = wardrobe_roadmap_gap_dispositions.roadmap_gap_id
        and r.id = wardrobe_roadmap_gap_dispositions.roadmap_id
        and r.customer_id = wardrobe_roadmap_gap_dispositions.customer_id
        and r.retailer_id = wardrobe_roadmap_gap_dispositions.retailer_id
        and r.status = 'approved'
        and r.deleted_at is null
    )
  );

create policy "retailer staff read tenant gap dispositions"
  on public.wardrobe_roadmap_gap_dispositions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert on table public.wardrobe_roadmap_gap_dispositions
  to authenticated, service_role;
grant all on table public.wardrobe_roadmap_gap_dispositions to service_role;
