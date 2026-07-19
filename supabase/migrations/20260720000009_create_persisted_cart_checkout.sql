create unique index one_draft_cart_per_retailer_customer_idx
  on public.orders (retailer_id, customer_id)
  where status = 'draft' and deleted_at is null;

create unique index one_variant_per_order_idx
  on public.order_lines (order_id, product_variant_id);

create or replace function public.add_to_cart(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_quantity integer
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_variant public.product_variants;
  v_product public.products;
  v_customer_id uuid;
  v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  select pv.* into v_variant from public.product_variants pv
  where pv.id = p_variant_id and pv.deleted_at is null;
  select p.* into v_product from public.products p
  where p.id = v_variant.product_id and p.deleted_at is null
    and p.retailer_id = p_retailer_id and p.status = 'active';
  if v_variant.id is null or v_product.id is null then
    raise exception 'Product is not available from this retailer';
  end if;
  if not exists (select 1 from public.retailers r where r.id = p_retailer_id and r.status = 'active' and r.deleted_at is null) then
    raise exception 'Retailer is not open for orders';
  end if;

  select c.id into v_customer_id from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id) on conflict do nothing;
  end if;

  select o.id into v_order_id from public.orders o
  where o.retailer_id = p_retailer_id and o.customer_id = v_customer_id
    and o.status = 'draft' and o.deleted_at is null for update;
  if v_order_id is null then
    insert into public.orders (retailer_id, customer_id, order_number, status, channel, currency, subtotal_amount_minor_units, total_amount_minor_units)
    values (p_retailer_id, v_customer_id, public.next_order_number(), 'draft', 'online', v_variant.price_currency, 0, 0)
    returning id into v_order_id;
  elsif (select currency from public.orders where id = v_order_id) <> v_variant.price_currency then
    raise exception 'Cart items must use one currency';
  end if;

  insert into public.order_lines (order_id, product_variant_id, quantity, unit_price_amount_minor_units, unit_price_currency, requires_production, requires_alteration)
  values (v_order_id, v_variant.id, p_quantity, v_variant.price_amount_minor_units, v_variant.price_currency, v_product.is_made_to_order, v_product.is_alterable)
  on conflict (order_id, product_variant_id) do update
    set quantity = least(20, public.order_lines.quantity + excluded.quantity),
        unit_price_amount_minor_units = excluded.unit_price_amount_minor_units,
        unit_price_currency = excluded.unit_price_currency;

  update public.orders o set
    subtotal_amount_minor_units = totals.amount,
    total_amount_minor_units = totals.amount
  from (select coalesce(sum(quantity * unit_price_amount_minor_units), 0)::integer amount from public.order_lines where order_id = v_order_id) totals
  where o.id = v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.update_cart_line(p_line_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_order_id uuid;
begin
  if p_quantity is null or p_quantity < 0 or p_quantity > 20 then raise exception 'Quantity must be between 0 and 20'; end if;
  select ol.order_id into v_order_id from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  join public.customers c on c.id = o.customer_id
  where ol.id = p_line_id and o.status = 'draft' and c.user_id = auth.uid()
  for update of o;
  if v_order_id is null then raise exception 'Cart line not found'; end if;
  if p_quantity = 0 then delete from public.order_lines where id = p_line_id;
  else update public.order_lines set quantity = p_quantity where id = p_line_id; end if;
  update public.orders o set subtotal_amount_minor_units = totals.amount, total_amount_minor_units = totals.amount
  from (select coalesce(sum(quantity * unit_price_amount_minor_units), 0)::integer amount from public.order_lines where order_id = v_order_id) totals
  where o.id = v_order_id;
end;
$$;

create or replace function public.checkout_cart(p_order_id uuid, p_shipping_address jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_line record;
  v_total integer := 0;
  v_count integer := 0;
begin
  select o.* into v_order from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.id = p_order_id and o.status = 'draft' and o.deleted_at is null and c.user_id = auth.uid()
  for update of o;
  if v_order.id is null then raise exception 'Cart not found'; end if;
  if jsonb_typeof(p_shipping_address) <> 'object'
    or coalesce(trim(p_shipping_address ->> 'line1'), '') = ''
    or coalesce(trim(p_shipping_address ->> 'city'), '') = ''
    or coalesce(trim(p_shipping_address ->> 'postalCode'), '') = ''
    or length(coalesce(p_shipping_address ->> 'countryCode', '')) <> 2 then
    raise exception 'Complete shipping address required';
  end if;

  for v_line in
    select ol.*, pv.inventory_quantity, pv.price_amount_minor_units current_price,
      pv.price_currency current_currency, p.is_made_to_order, p.is_alterable, p.status product_status
    from public.order_lines ol
    join public.product_variants pv on pv.id = ol.product_variant_id and pv.deleted_at is null
    join public.products p on p.id = pv.product_id and p.deleted_at is null
    where ol.order_id = v_order.id and p.retailer_id = v_order.retailer_id
    for update of pv
  loop
    v_count := v_count + 1;
    if v_line.product_status <> 'active' then raise exception 'A cart item is no longer available'; end if;
    if v_line.current_currency <> v_order.currency then raise exception 'Cart currency mismatch'; end if;
    if not v_line.is_made_to_order and v_line.inventory_quantity < v_line.quantity then
      raise exception 'Not enough stock for a cart item';
    end if;
    if not v_line.is_made_to_order then
      update public.product_variants set inventory_quantity = inventory_quantity - v_line.quantity where id = v_line.product_variant_id;
    end if;
    update public.order_lines set unit_price_amount_minor_units = v_line.current_price,
      unit_price_currency = v_line.current_currency, requires_production = v_line.is_made_to_order,
      requires_alteration = v_line.is_alterable where id = v_line.id;
    v_total := v_total + (v_line.current_price * v_line.quantity);
  end loop;
  if v_count = 0 then raise exception 'Cart is empty'; end if;

  update public.orders set status = 'pending_payment', subtotal_amount_minor_units = v_total,
    total_amount_minor_units = v_total, shipping_address = p_shipping_address, placed_at = now()
  where id = v_order.id;
  update public.customers set lifecycle_stage = 'first_purchase' where id = v_order.customer_id and lifecycle_stage = 'prospect';
  return v_order.id;
end;
$$;

revoke all on function public.add_to_cart(uuid, uuid, integer) from public;
revoke all on function public.update_cart_line(uuid, integer) from public;
revoke all on function public.checkout_cart(uuid, jsonb) from public;
grant execute on function public.add_to_cart(uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.update_cart_line(uuid, integer) to authenticated, service_role;
grant execute on function public.checkout_cart(uuid, jsonb) to authenticated, service_role;
