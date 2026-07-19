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
