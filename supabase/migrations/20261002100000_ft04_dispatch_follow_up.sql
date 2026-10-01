-- FT-04, completed. Also fixes dispatch, which never worked: its ON CONFLICT
-- predicate did not match the unique index's, so every dispatch raised 42P10.
--
-- The rest: the selective work order records an order number and
-- photos, and creates the Mission Control follow-up the founder spec asks
-- for — update the client's fit profile from the locked grid. Opening that
-- follow-up goes to the work order's grid.

-- Which work order a follow-up came from, so Mission Control can link to it.
alter table public.clienteling_opportunities
  add column if not exists source_alteration_id uuid
    references public.alteration_work_orders (id) on delete set null;
create index if not exists clienteling_opportunities_source_alteration_idx
  on public.clienteling_opportunities (source_alteration_id)
  where source_alteration_id is not null;

alter table public.clienteling_opportunities
  drop constraint if exists clienteling_opportunities_opportunity_type_check;
alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_opportunity_type_check check (
    opportunity_type in (
      'interest_follow_up',
      'purchase_care_check',
      'occasion_readiness',
      'relationship_dormancy',
      'wardrobe_gap',
      'anniversary_moment',
      'contact_pressure_warning',
      'campaign_mission',
      'advisor_commitment',
      'fit_profile_update'
    )
  );

-- One row per dispatch: what was sent, with which order number and photos.
create table if not exists public.alteration_grid_dispatches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  alteration_id uuid not null references public.alteration_work_orders (id) on delete cascade,
  snapshot_id uuid not null references public.alteration_grid_snapshots (id) on delete restrict,
  order_number text check (order_number is null or char_length(order_number) between 1 and 80),
  comments text check (comments is null or char_length(comments) <= 2000),
  attachment_ids uuid[] not null default '{}',
  operation_ids uuid[] not null,
  follow_up_opportunity_id uuid references public.clienteling_opportunities (id) on delete set null,
  dispatched_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists alteration_grid_dispatches_alteration_idx
  on public.alteration_grid_dispatches (alteration_id, created_at desc);

alter table public.alteration_grid_dispatches enable row level security;
revoke all on table public.alteration_grid_dispatches from public, anon, authenticated;
grant select on table public.alteration_grid_dispatches to authenticated;
grant all on table public.alteration_grid_dispatches to service_role;

create policy "staff read alteration grid dispatches"
  on public.alteration_grid_dispatches for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_staff_id() is not null
    and public.can_access_alteration_work_order(alteration_id)
  );
create policy "platform reads alteration grid dispatches"
  on public.alteration_grid_dispatches for select to authenticated
  using (public.is_platform_staff());

drop function if exists public.dispatch_alteration_grid_snapshot(uuid, uuid[], text);

create or replace function public.dispatch_alteration_grid_snapshot(
  p_snapshot_id uuid,
  p_selected_operation_ids uuid[],
  p_comments text default null,
  p_order_number text default null,
  p_attachment_ids uuid[] default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_snapshot public.alteration_grid_snapshots%rowtype;
  v_order public.alteration_work_orders%rowtype;
  v_operation_id uuid;
  v_value numeric;
  v_price record;
  v_task_id uuid;
  v_order_number text := nullif(btrim(coalesce(p_order_number, '')), '');
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_attachments uuid[] := coalesce(p_attachment_ids, '{}');
  v_opportunity_id uuid;
  v_dispatch_id uuid;
begin
  if not public.is_alterations_management() then raise exception 'Alterations management permission is required'; end if;
  if cardinality(p_selected_operation_ids) is null or cardinality(p_selected_operation_ids) = 0 then raise exception 'Select at least one non-zero alteration'; end if;
  if cardinality(p_selected_operation_ids) <> cardinality(array(select distinct unnest(p_selected_operation_ids))) then raise exception 'Duplicate operations are not allowed'; end if;
  select * into v_snapshot from public.alteration_grid_snapshots where id = p_snapshot_id;
  if v_snapshot.id is null then raise exception 'Snapshot not found'; end if;
  select * into v_order from public.alteration_work_orders where id = v_snapshot.alteration_id and deleted_at is null for update;
  if v_order.id is null or not public.can_access_alteration_work_order(v_order.id) then raise exception 'Work order not found'; end if;
  if v_order_number is not null and char_length(v_order_number) > 80 then
    raise exception 'Order number is too long';
  end if;
  if v_comments is not null and char_length(v_comments) > 2000 then
    raise exception 'Workshop comments are too long';
  end if;
  if cardinality(v_attachments) > 12 then
    raise exception 'At most 12 photos per dispatch';
  end if;
  -- Photos must be this work order's own evidence.
  if exists (
    select 1 from unnest(v_attachments) a(id)
    where not exists (
      select 1 from public.alteration_attachments t
      where t.id = a.id and t.alteration_id = v_order.id and t.retailer_id = v_order.retailer_id
    )
  ) then
    raise exception 'Photos must belong to this work order';
  end if;
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
      concat(
        'Grid value: ', case when v_value > 0 then '+' else '' end, v_value,
        coalesce(E'\nOrder: ' || v_order_number, ''),
        coalesce(E'\n' || v_comments, '')
      ),
      'work_now', 'proposed', v_price.amount_minor_units, v_price.currency, v_snapshot.id)
    on conflict (origin_grid_snapshot_id, operation_id)
      where origin_grid_snapshot_id is not null and deleted_at is null do nothing returning id into v_task_id;
  end loop;

  -- The follow-up: update the client's fit profile from the locked grid.
  -- It lands in Mission Control's inbox and opens the work order's grid.
  insert into public.clienteling_opportunities (
    retailer_id, customer_id, opportunity_type, why_now, suggested_action,
    channel, assigned_staff_id, priority, confidence, status, due_at,
    evidence, projector_version, source_alteration_id
  ) values (
    v_order.retailer_id,
    v_order.customer_id,
    'fit_profile_update',
    format(
      'Grid version %s was sent to the workshop%s.',
      v_snapshot.version,
      coalesce(' (order ' || v_order_number || ')', '')
    ),
    'Update the fit profile from the locked first-fitting grid.',
    'in_person',
    public.current_staff_id(),
    60,
    0.95,
    'draft',
    now() + interval '1 day',
    jsonb_build_array(jsonb_build_object(
      'note', format('First-fitting grid v%s dispatched', v_snapshot.version)
    )),
    'ft04-dispatch',
    v_order.id
  )
  returning id into v_opportunity_id;

  insert into public.alteration_grid_dispatches (
    retailer_id, alteration_id, snapshot_id, order_number, comments,
    attachment_ids, operation_ids, follow_up_opportunity_id, dispatched_by_staff_id
  ) values (
    v_order.retailer_id, v_order.id, v_snapshot.id, v_order_number, v_comments,
    v_attachments, p_selected_operation_ids, v_opportunity_id, public.current_staff_id()
  )
  returning id into v_dispatch_id;

  return v_order.id;
end;
$$;


revoke all on function public.dispatch_alteration_grid_snapshot(uuid, uuid[], text, text, uuid[])
  from public, anon;
grant execute on function public.dispatch_alteration_grid_snapshot(uuid, uuid[], text, text, uuid[])
  to authenticated, service_role;
