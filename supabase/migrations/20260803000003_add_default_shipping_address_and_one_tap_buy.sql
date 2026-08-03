-- "1-Tap Checkout" eligibility: `customers.shipping_addresses` has existed
-- since the original schema but was never customer-writable (only staff
-- have a blanket RLS grant on `customers`) and the storefront checkout form
-- never pre-filled from it, so a returning customer retyped their full
-- address on every single order. This closes that: a customer can save one
-- default address, and eligibility for one-tap buy is simply "does this
-- array have at least one entry" — no payment collection is added or
-- implied. `checkout_cart` already leaves a new order at `pending_payment`
-- regardless of how it was created; this does not change when or how money
-- moves, only how many manual steps reaching that state takes.

create or replace function public.update_my_default_shipping_address(
  p_retailer_id uuid,
  p_address jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_address) <> 'object'
    or coalesce(trim(p_address ->> 'line1'), '') = ''
    or coalesce(trim(p_address ->> 'city'), '') = ''
    or coalesce(trim(p_address ->> 'postalCode'), '') = ''
    or length(coalesce(p_address ->> 'countryCode', '')) <> 2 then
    raise exception 'Complete shipping address required';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship not found'; end if;

  update public.customers
  set shipping_addresses = jsonb_build_array(p_address)
  where id = v_customer_id;
end;
$$;

revoke all on function public.update_my_default_shipping_address(uuid, jsonb) from public;
grant execute on function public.update_my_default_shipping_address(uuid, jsonb) to authenticated, service_role;
