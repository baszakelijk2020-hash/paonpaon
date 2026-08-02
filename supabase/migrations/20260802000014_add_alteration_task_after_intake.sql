-- FT-04 gap closure: the only path to alteration_tasks was the single
-- transactional intake RPC (create_alteration_intake) — there was no way
-- for an advisor to add a task after intake, e.g. after a group fitting
-- or a fit-tool observation surfaces new work. This does not invent a
-- new money-movement path: new tasks always insert with a zero original
-- quote and a 'proposed' status, so they contribute nothing to
-- alteration_work_orders.agreed_total_amount_minor_units until priced
-- through the EXISTING propose_alteration_price_change /
-- decide_alteration_price_change dual-control flow, unchanged here.

create or replace function public.add_alteration_task(
  p_alteration_id uuid,
  p_title text,
  p_instructions text default null,
  p_classification public.work_classification default 'work_now',
  p_operation_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.alteration_work_orders%rowtype;
  v_staff_id uuid := public.current_staff_id();
  v_task_id uuid;
begin
  select * into v_order from public.alteration_work_orders where id = p_alteration_id and deleted_at is null;
  if v_order.id is null or not public.can_access_alteration_work_order(p_alteration_id) then
    raise exception 'Work order not found';
  end if;
  if auth.role() <> 'service_role' and not public.is_alterations_advisor() then
    raise exception 'Only alterations advisors may add a task to a work order';
  end if;
  if v_order.status in ('completed', 'canceled') then
    raise exception 'Cannot add a task to a completed or canceled work order';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 then raise exception 'Task title is required'; end if;
  if p_operation_id is not null and not exists (
    select 1 from public.alteration_operations o where o.id = p_operation_id
  ) then raise exception 'Operation not found'; end if;

  insert into public.alteration_tasks (
    alteration_id, retailer_id, operation_id, title, instructions,
    classification, original_quote_currency
  ) values (
    p_alteration_id, v_order.retailer_id, p_operation_id, trim(p_title),
    nullif(trim(coalesce(p_instructions, '')), ''), p_classification,
    v_order.original_quote_currency
  ) returning id into v_task_id;

  if length(trim(coalesce(p_note, ''))) > 0 then
    if length(trim(p_note)) > 2000 then raise exception 'Note is too long'; end if;
    insert into public.alteration_task_notes (
      alteration_id, task_id, retailer_id, note, actor_staff_id
    ) values (
      p_alteration_id, v_task_id, v_order.retailer_id, trim(p_note), v_staff_id
    );
  end if;

  return v_task_id;
end;
$$;

revoke all on function public.add_alteration_task(uuid, text, text, public.work_classification, uuid, text) from public;
grant execute on function public.add_alteration_task(uuid, text, text, public.work_classification, uuid, text) to authenticated, service_role;
