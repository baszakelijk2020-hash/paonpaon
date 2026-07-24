create or replace function public.notify_customer_when_alteration_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
  v_garment_type text;
  v_title text;
  v_body text;
begin
  if new.status not in ('ready_for_pickup', 'out_for_delivery')
    or new.status is not distinct from old.status
  then
    return new;
  end if;

  select customer.user_id, garment.garment_type
  into v_recipient_user_id, v_garment_type
  from public.customers customer
  join public.physical_garments garment
    on garment.id = new.physical_garment_id
    and garment.retailer_id = new.retailer_id
    and garment.deleted_at is null
  where customer.id = new.customer_id
    and customer.retailer_id = new.retailer_id
    and customer.deleted_at is null;

  if v_recipient_user_id is null then
    return new;
  end if;

  if new.status = 'ready_for_pickup' then
    v_title := 'Alteration ready for pickup';
    v_body := 'Your ' || v_garment_type || ' is ready for pickup.';
  else
    v_title := 'Alteration out for delivery';
    v_body := 'Your ' || v_garment_type || ' is on its way.';
  end if;

  insert into public.notifications (
    retailer_id,
    recipient_user_id,
    customer_id,
    category,
    title,
    body,
    action_href,
    sent_at
  )
  values (
    new.retailer_id,
    v_recipient_user_id,
    new.customer_id,
    'alteration_update',
    v_title,
    v_body,
    '/alterations/' || new.id,
    now()
  );

  return new;
end;
$$;

revoke all on function public.notify_customer_when_alteration_ready() from public;

create trigger notify_customer_when_alteration_ready_after_update
  after update of status on public.alteration_work_orders
  for each row
  execute function public.notify_customer_when_alteration_ready();

insert into public.notifications (
  retailer_id,
  recipient_user_id,
  customer_id,
  category,
  title,
  body,
  action_href,
  sent_at,
  created_at,
  updated_at
)
select
  work_order.retailer_id,
  customer.user_id,
  work_order.customer_id,
  'alteration_update',
  case work_order.status
    when 'ready_for_pickup' then 'Alteration ready for pickup'
    else 'Alteration out for delivery'
  end,
  case work_order.status
    when 'ready_for_pickup' then
      'Your ' || garment.garment_type || ' is ready for pickup.'
    else
      'Your ' || garment.garment_type || ' is on its way.'
  end,
  '/alterations/' || work_order.id,
  coalesce(work_order.customer_notification_ready_at, now()),
  coalesce(work_order.customer_notification_ready_at, now()),
  coalesce(work_order.customer_notification_ready_at, now())
from public.alteration_work_orders work_order
join public.customers customer
  on customer.id = work_order.customer_id
  and customer.retailer_id = work_order.retailer_id
  and customer.deleted_at is null
join public.physical_garments garment
  on garment.id = work_order.physical_garment_id
  and garment.retailer_id = work_order.retailer_id
  and garment.deleted_at is null
where work_order.status in ('ready_for_pickup', 'out_for_delivery')
  and work_order.deleted_at is null
  and customer.user_id is not null
  and not exists (
    select 1
    from public.notifications notification
    where notification.recipient_user_id = customer.user_id
      and notification.category = 'alteration_update'
      and notification.action_href = '/alterations/' || work_order.id
      and notification.deleted_at is null
  );
