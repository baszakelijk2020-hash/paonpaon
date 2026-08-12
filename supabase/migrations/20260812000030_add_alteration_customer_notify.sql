-- Alteration Operations: thread customer-visible status updates into the
-- Communication Centre. `customer_notified_at`/`customer_notification_ready_at`
-- have existed on alteration_work_orders since the garment-first
-- alterations foundation but nothing has ever written to them -- a
-- customer-visible status transition (ready for pickup, quote approved,
-- completed, canceled) has never actually reached the customer anywhere.
--
-- Narrow, staff-gated RPC: stamps customer_notified_at once the caller has
-- actually sent the update through the existing messaging RPCs
-- (get_or_create_staff_conversation / send_conversation_message), rather
-- than duplicating message-composition or conversation lookup logic here.
-- Reuses the same access check transition_alteration_work_order already
-- uses, so this can never be called for a work order the caller cannot see.

create or replace function public.mark_alteration_customer_notified(
  p_alteration_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.can_access_alteration_work_order(p_alteration_id) then
    raise exception 'Not authorized for this work order';
  end if;

  update public.alteration_work_orders
  set customer_notified_at = now()
  where id = p_alteration_id
    and deleted_at is null;

  if not found then
    raise exception 'Work order not found';
  end if;
end;
$$;

revoke all on function public.mark_alteration_customer_notified(uuid) from public;
grant execute on function public.mark_alteration_customer_notified(uuid)
  to authenticated, service_role;
