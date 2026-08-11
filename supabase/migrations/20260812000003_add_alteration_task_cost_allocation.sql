-- Mission Control alteration operating tool (docs/PHASE.md founder priority
-- item 6, 2026-08-11): the work-order/task/pricing chain already covers
-- quote/price approval, task assignment, workshop handoff and custody, but
-- carries no breakdown of what a task's agreed price is actually made of
-- (labour vs. material vs. an external partner's own charge) -- the named
-- "labour/material/partner cost allocation" gap. This is internal margin
-- data, never a customer-visible price: kept off alteration_tasks' own
-- customer-facing surfaces by construction (the customer/worker projections
-- below are explicit column lists, not `select *`, so nothing needs to
-- change there), and written only through a management-gated, audited RPC --
-- the same dual-control discipline as 20260721000009's price-change flow.

alter table public.alteration_tasks
  add column labour_cost_amount_minor_units integer check (labour_cost_amount_minor_units >= 0),
  add column material_cost_amount_minor_units integer check (material_cost_amount_minor_units >= 0),
  add column partner_cost_amount_minor_units integer check (partner_cost_amount_minor_units >= 0),
  add column cost_allocation_currency text,
  add constraint alteration_tasks_cost_allocation_currency_consistency check (
    (
      labour_cost_amount_minor_units is null
      and material_cost_amount_minor_units is null
      and partner_cost_amount_minor_units is null
      and cost_allocation_currency is null
    )
    or (
      coalesce(labour_cost_amount_minor_units, 0) >= 0
      and coalesce(material_cost_amount_minor_units, 0) >= 0
      and coalesce(partner_cost_amount_minor_units, 0) >= 0
      and cost_allocation_currency is not null
    )
  );

comment on column public.alteration_tasks.labour_cost_amount_minor_units is 'Internal cost allocation, never customer-visible. Set only via record_alteration_task_cost_allocation.';
comment on column public.alteration_tasks.material_cost_amount_minor_units is 'Internal cost allocation, never customer-visible. Set only via record_alteration_task_cost_allocation.';
comment on column public.alteration_tasks.partner_cost_amount_minor_units is 'Internal cost allocation, never customer-visible. Set only via record_alteration_task_cost_allocation.';

create table public.alteration_cost_allocation_history (
  id uuid primary key default gen_random_uuid(),
  alteration_id uuid not null references public.alteration_work_orders (id) on delete restrict,
  task_id uuid not null references public.alteration_tasks (id) on delete restrict,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  labour_cost_amount_minor_units integer not null check (labour_cost_amount_minor_units >= 0),
  material_cost_amount_minor_units integer not null check (material_cost_amount_minor_units >= 0),
  partner_cost_amount_minor_units integer not null check (partner_cost_amount_minor_units >= 0),
  currency text not null,
  reason text,
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index alteration_cost_allocation_history_task_idx
  on public.alteration_cost_allocation_history (task_id, created_at);

alter table public.alteration_cost_allocation_history enable row level security;

create policy "authorized staff can read alteration cost allocation history"
  on public.alteration_cost_allocation_history for select
  using (public.current_retailer_role() <> 'worker' and public.can_access_alteration_work_order(alteration_id));
create policy "platform staff can read alteration cost allocation history"
  on public.alteration_cost_allocation_history for select using (public.is_platform_staff());

create or replace function public.record_alteration_task_cost_allocation(
  p_task_id uuid,
  p_labour_cost_amount_minor_units integer,
  p_material_cost_amount_minor_units integer,
  p_partner_cost_amount_minor_units integer,
  p_currency text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.alteration_tasks%rowtype;
  v_order public.alteration_work_orders%rowtype;
  v_staff_id uuid := public.current_staff_id();
begin
  select * into v_task from public.alteration_tasks where id = p_task_id and deleted_at is null;
  if v_task.id is null then raise exception 'Task not found'; end if;
  select * into v_order from public.alteration_work_orders where id = v_task.alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(v_task.alteration_id) then
    raise exception 'Work order not found';
  end if;
  if auth.role() <> 'service_role' and not public.is_alterations_management() then
    raise exception 'Only retailer management may record cost allocation';
  end if;
  if v_order.status in ('completed', 'canceled') then
    raise exception 'Cannot record cost allocation on a completed or canceled work order';
  end if;
  if p_labour_cost_amount_minor_units < 0 or p_material_cost_amount_minor_units < 0 or p_partner_cost_amount_minor_units < 0 then
    raise exception 'Cost amounts cannot be negative';
  end if;
  if length(trim(coalesce(p_currency, ''))) <> 3 then raise exception 'A three-letter currency code is required'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'A reason is required'; end if;

  update public.alteration_tasks
  set labour_cost_amount_minor_units = p_labour_cost_amount_minor_units,
      material_cost_amount_minor_units = p_material_cost_amount_minor_units,
      partner_cost_amount_minor_units = p_partner_cost_amount_minor_units,
      cost_allocation_currency = upper(trim(p_currency))
  where id = p_task_id;

  insert into public.alteration_cost_allocation_history (
    alteration_id, task_id, retailer_id, labour_cost_amount_minor_units,
    material_cost_amount_minor_units, partner_cost_amount_minor_units,
    currency, reason, actor_staff_id
  ) values (
    v_task.alteration_id, p_task_id, v_order.retailer_id, p_labour_cost_amount_minor_units,
    p_material_cost_amount_minor_units, p_partner_cost_amount_minor_units,
    upper(trim(p_currency)), trim(p_reason), v_staff_id
  );
end;
$$;

revoke all on function public.record_alteration_task_cost_allocation(uuid, integer, integer, integer, text, text) from public;
grant execute on function public.record_alteration_task_cost_allocation(uuid, integer, integer, integer, text, text) to authenticated, service_role;
