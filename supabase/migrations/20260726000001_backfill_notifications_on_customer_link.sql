-- notify_customer_when_alteration_ready() (20260724000000) requires the
-- alteration's customer to already have a linked user_id at the moment
-- the status changes to ready_for_pickup/out_for_delivery — a real gap,
-- not just a fixture quirk: a customer intaken as a guest/prospect by
-- staff can easily have their garment become ready before they ever
-- create a Customer Portal login. That migration's own one-time backfill
-- INSERT only ran once, at deploy time, so it can never catch a link
-- that happens afterward — found via e2e coverage (2026-07-26)
-- exercising exactly that order (fixture alteration marked ready, then
-- the customer signs in and links).
--
-- Fix: run the same guarded backfill every time link_my_customer_accounts
-- runs, scoped to the customer rows it just linked, instead of only once
-- historically.
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

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body,
    action_href, sent_at
  )
  select
    work_order.retailer_id,
    auth.uid(),
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
    now()
  from public.alteration_work_orders work_order
  join public.customers customer
    on customer.id = work_order.customer_id
    and customer.retailer_id = work_order.retailer_id
    and customer.deleted_at is null
  join public.physical_garments garment
    on garment.id = work_order.physical_garment_id
    and garment.retailer_id = work_order.retailer_id
    and garment.deleted_at is null
  where customer.user_id = auth.uid()
    and work_order.status in ('ready_for_pickup', 'out_for_delivery')
    and work_order.deleted_at is null
    and not exists (
      select 1
      from public.notifications notification
      where notification.recipient_user_id = auth.uid()
        and notification.category = 'alteration_update'
        and notification.action_href = '/alterations/' || work_order.id
        and notification.deleted_at is null
    );
end;
$$;
