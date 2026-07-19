create or replace function public.get_platform_analytics(
  p_since timestamptz default (now() - interval '30 days')
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff access required';
  end if;

  select jsonb_build_object(
    'retailers', (select count(*) from public.retailers where deleted_at is null),
    'activeRetailers', (select count(*) from public.retailers where deleted_at is null and status = 'active'),
    'newRetailers', (select count(*) from public.retailers where deleted_at is null and created_at >= p_since),
    'customers', (select count(*) from public.customers where deleted_at is null),
    'newCustomers', (select count(*) from public.customers where deleted_at is null and created_at >= p_since),
    'orders', (select count(*) from public.orders where deleted_at is null and created_at >= p_since),
    'grossMerchandiseValueByCurrency', coalesce((select jsonb_object_agg(currency, total) from (select currency, sum(total_amount_minor_units) as total from public.orders where deleted_at is null and status in ('placed','in_production','ready_for_fulfillment','shipped','delivered','completed') and created_at >= p_since group by currency) totals), '{}'::jsonb),
    'appointments', (select count(*) from public.appointments where deleted_at is null and created_at >= p_since),
    'openAlterations', (select count(*) from public.alteration_work_orders where status not in ('completed','canceled')),
    'messages', (select count(*) from public.messages where created_at >= p_since),
    'behavioralEvents', (select count(*) from public.behavioral_events where occurred_at >= p_since)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_platform_analytics(timestamptz) from public;
grant execute on function public.get_platform_analytics(timestamptz) to authenticated, service_role;

comment on function public.get_platform_analytics(timestamptz) is
  'Cross-retailer operational adoption metrics, restricted to authenticated PAON platform staff.';
