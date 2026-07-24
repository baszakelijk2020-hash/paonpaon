-- One platform-staff operation updates commercial copy/pricing and its
-- entitlement set atomically. The client cannot leave a plan half-updated.

create or replace function public.update_commercial_plan(
  p_plan_id uuid,
  p_name text,
  p_positioning text,
  p_description text,
  p_price_amount_minor_units integer,
  p_price_currency text,
  p_price_is_from boolean,
  p_implementation_fee_amount_minor_units integer,
  p_implementation_fee_currency text,
  p_seat_limit integer,
  p_feature_keys text[],
  p_is_public boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Platform staff access required';
  end if;

  if coalesce(array_length(p_feature_keys, 1), 0) = 0 then
    raise exception 'A commercial plan must include at least one capability';
  end if;

  update public.subscription_plans
  set name = p_name,
      positioning = p_positioning,
      description = p_description,
      price_amount_minor_units = p_price_amount_minor_units,
      price_currency = p_price_currency,
      price_is_from = p_price_is_from,
      implementation_fee_amount_minor_units = p_implementation_fee_amount_minor_units,
      implementation_fee_currency = p_implementation_fee_currency,
      seat_limit = p_seat_limit,
      included_feature_keys = p_feature_keys,
      is_public = p_is_public
  where id = p_plan_id;

  if not found then
    raise exception 'Commercial plan not found';
  end if;

  delete from public.subscription_plan_entitlements
  where plan_id = p_plan_id;

  insert into public.subscription_plan_entitlements (plan_id, feature_key)
  select p_plan_id, feature_key
  from unnest(p_feature_keys) feature_key;
end;
$$;

revoke all on function public.update_commercial_plan(
  uuid, text, text, text, integer, text, boolean, integer, text,
  integer, text[], boolean
) from public;
grant execute on function public.update_commercial_plan(
  uuid, text, text, text, integer, text, boolean, integer, text,
  integer, text[], boolean
) to authenticated, service_role;
