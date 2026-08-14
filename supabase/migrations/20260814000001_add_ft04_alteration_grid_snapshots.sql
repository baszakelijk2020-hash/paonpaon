-- FT-04: immutable first-fitting grid snapshots and selective dispatch.
create table public.alteration_grid_snapshots (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  alteration_id uuid not null references public.alteration_work_orders(id) on delete restrict,
  version integer not null check (version > 0),
  values jsonb not null,
  comments text,
  created_by_staff_id uuid references public.retailer_staff_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (alteration_id, version),
  check (jsonb_typeof(values) = 'array')
);

create index alteration_grid_snapshots_alteration_version_idx
  on public.alteration_grid_snapshots(alteration_id, version desc);
create index alteration_grid_snapshots_customer_created_idx
  on public.alteration_grid_snapshots(customer_id, created_at desc);

alter table public.alteration_tasks
  add column origin_grid_snapshot_id uuid references public.alteration_grid_snapshots(id) on delete set null;
create unique index alteration_grid_snapshot_task_once_idx
  on public.alteration_tasks(origin_grid_snapshot_id, operation_id)
  where origin_grid_snapshot_id is not null and deleted_at is null;

alter table public.alteration_grid_snapshots enable row level security;
create policy "staff read alteration grid snapshots"
  on public.alteration_grid_snapshots for select to authenticated
  using (retailer_id = public.current_retailer_id() and public.current_staff_id() is not null);
create policy "platform reads alteration grid snapshots"
  on public.alteration_grid_snapshots for select to authenticated
  using (public.is_platform_staff());
grant select on public.alteration_grid_snapshots to authenticated, service_role;

create or replace function public.prevent_alteration_grid_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Alteration grid snapshots are immutable';
end;
$$;
create trigger alteration_grid_snapshots_immutable
  before update or delete on public.alteration_grid_snapshots
  for each row execute function public.prevent_alteration_grid_snapshot_mutation();

create or replace function public.save_alteration_grid_snapshot(
  p_alteration_id uuid,
  p_values jsonb,
  p_comments text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_version integer;
  v_snapshot_id uuid;
  v_item record;
begin
  select * into v_order from public.alteration_work_orders
   where id = p_alteration_id and deleted_at is null for update;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then
    raise exception 'Work order not found';
  end if;
  if not public.is_alterations_advisor() then
    raise exception 'Alterations advisor permission is required';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) = 0 then
    raise exception 'At least one grid value is required';
  end if;
  for v_item in select * from jsonb_to_recordset(p_values) as x(operation_id uuid, value numeric) loop
    if v_item.operation_id is null or v_item.value is null
      or v_item.value < -5 or v_item.value > 5 or mod(v_item.value * 10, 5) <> 0 then
      raise exception 'Grid values must be 0.5 increments between -5.0 and +5.0';
    end if;
    if not exists (
      select 1 from public.alteration_operations o
      join public.retailer_alteration_operation_settings s on s.operation_id = o.id
      where o.id = v_item.operation_id and o.active and s.retailer_id = v_order.retailer_id and s.enabled
    ) and not exists (
      select 1 from public.alteration_operations o
      where o.id = v_item.operation_id and o.active
        and not exists (select 1 from public.retailer_alteration_operation_settings s where s.operation_id = o.id and s.retailer_id = v_order.retailer_id)
    ) then raise exception 'Operation is not enabled for this retailer'; end if;
  end loop;
  select coalesce(max(version), 0) + 1 into v_version
    from public.alteration_grid_snapshots where alteration_id = p_alteration_id;
  if v_version > 1 and not public.is_alterations_management() then
    raise exception 'Alterations management must authorize a revision';
  end if;
  insert into public.alteration_grid_snapshots(retailer_id, customer_id, alteration_id, version, values, comments, created_by_staff_id)
  values (v_order.retailer_id, v_order.customer_id, p_alteration_id, v_version, p_values,
    nullif(trim(coalesce(p_comments, '')), ''), public.current_staff_id()) returning id into v_snapshot_id;
  return v_snapshot_id;
end;
$$;

create or replace function public.dispatch_alteration_grid_snapshot(
  p_snapshot_id uuid, p_selected_operation_ids uuid[], p_comments text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_snapshot public.alteration_grid_snapshots%rowtype;
  v_order public.alteration_work_orders%rowtype;
  v_operation_id uuid;
  v_value numeric;
  v_price record;
  v_task_id uuid;
begin
  if not public.is_alterations_management() then raise exception 'Alterations management permission is required'; end if;
  if cardinality(p_selected_operation_ids) is null or cardinality(p_selected_operation_ids) = 0 then raise exception 'Select at least one non-zero alteration'; end if;
  if cardinality(p_selected_operation_ids) <> cardinality(array(select distinct unnest(p_selected_operation_ids))) then raise exception 'Duplicate operations are not allowed'; end if;
  select * into v_snapshot from public.alteration_grid_snapshots where id = p_snapshot_id;
  if v_snapshot.id is null then raise exception 'Snapshot not found'; end if;
  select * into v_order from public.alteration_work_orders where id = v_snapshot.alteration_id and deleted_at is null for update;
  if v_order.id is null or not public.can_access_alteration_work_order(v_order.id) then raise exception 'Work order not found'; end if;
  foreach v_operation_id in array p_selected_operation_ids loop
    select (x.value)::numeric into v_value from jsonb_to_recordset(v_snapshot.values) as x(operation_id uuid, value text)
      where x.operation_id = v_operation_id;
    if coalesce(v_value, 0) = 0 then raise exception 'Only non-zero grid values may be dispatched'; end if;
    select i.amount_minor_units, i.currency, o.name into v_price
      from public.alteration_price_list_items i
      join public.alteration_price_lists l on l.id = i.price_list_id
      join public.alteration_operations o on o.id = i.operation_id
      where i.retailer_id = v_order.retailer_id and i.operation_id = v_operation_id
        and l.kind = 'retailer' and l.active and l.deleted_at is null and l.effective_from <= current_date
        and (l.effective_until is null or l.effective_until >= current_date)
      order by l.effective_from desc limit 1;
    if v_price.amount_minor_units is null then raise exception 'No active fixed price exists for selected alteration'; end if;
    insert into public.alteration_tasks(alteration_id, retailer_id, operation_id, title, instructions, classification, status, original_quote_amount_minor_units, original_quote_currency, origin_grid_snapshot_id)
    values(v_order.id, v_order.retailer_id, v_operation_id, v_price.name,
      concat('Grid value: ', case when v_value > 0 then '+' else '' end, v_value, coalesce(E'\n' || nullif(trim(p_comments), ''), '')),
      'work_now', 'proposed', v_price.amount_minor_units, v_price.currency, v_snapshot.id)
    on conflict (origin_grid_snapshot_id, operation_id) where deleted_at is null do nothing returning id into v_task_id;
  end loop;
  return v_order.id;
end;
$$;

revoke all on function public.save_alteration_grid_snapshot(uuid, jsonb, text) from public;
revoke all on function public.dispatch_alteration_grid_snapshot(uuid, uuid[], text) from public;
grant execute on function public.save_alteration_grid_snapshot(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.dispatch_alteration_grid_snapshot(uuid, uuid[], text) to authenticated, service_role;
