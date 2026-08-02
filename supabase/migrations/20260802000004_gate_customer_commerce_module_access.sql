-- The retailer app enforces its effective module lifecycle at the server
-- boundary via resolve_retailer_modules(), but that function requires the
-- caller to be platform staff or the target retailer itself. Customer-facing
-- entry points (cart add/update/checkout on the storefront) have no such
-- session and were bypassing module state entirely: a customer could still
-- write to commerce_growth's cart/order tables while the module was off,
-- suspended, or preview for that retailer.
--
-- This adds a narrow, non-sensitive lookup — a single module's lifecycle
-- state for a retailer — safe to expose without a staff/retailer session,
-- since it reveals nothing beyond "is this shop capability turned on," which
-- is no more sensitive than the storefront itself being publicly browsable.
create or replace function public.retailer_module_access_state(
  p_retailer_id uuid,
  p_module_key text
)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    c.state,
    case when pm.module_key is not null then 'active' else 'off' end
  )
  from public.platform_modules m
  left join public.retailer_module_configurations c
    on c.retailer_id = p_retailer_id
   and c.module_key = m.key
  left join lateral (
    select spm.module_key
    from public.retailer_subscriptions rs
    join public.subscription_plan_modules spm on spm.plan_id = rs.plan_id
    where rs.retailer_id = p_retailer_id
      and rs.status in ('active', 'trialing')
      and spm.module_key = m.key
    limit 1
  ) pm on true
  where m.key = p_module_key;
$$;

revoke all on function public.retailer_module_access_state(uuid, text)
  from public;
grant execute on function public.retailer_module_access_state(uuid, text)
  to anon, authenticated, service_role;
