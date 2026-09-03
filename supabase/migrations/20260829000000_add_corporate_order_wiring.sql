-- PHASE 14.1: Corporate order wiring (CORP-103, part 2)
-- Extend orders table to support corporate wearer ordering, add place_corporate_order RPC,
-- and add corporate manager RLS policies for order access.

-- 1. Allow orders to be placed for corporate wearers instead of just customers
alter table public.orders
  alter column customer_id drop not null;

alter table public.orders
  add column corporate_wearer_id uuid references public.corporate_wearers (id);

-- Ensure exactly one of customer_id or corporate_wearer_id is set
alter table public.orders
  add constraint orders_customer_or_corporate_wearer_chk
    check (
      (customer_id is not null and corporate_wearer_id is null)
      or (customer_id is null and corporate_wearer_id is not null)
    );

-- Index on corporate_wearer_id for efficient scoped queries
create index orders_corporate_wearer_id_idx
  on public.orders (corporate_wearer_id)
  where corporate_wearer_id is not null;

-- 2. New RPC: place_corporate_order — mirrors place_order but for corporate wearers,
-- only callable by retailer staff (never by wearer), and links the order to the wearer.
create or replace function public.place_corporate_order(
  p_retailer_id uuid,
  p_wearer_id uuid,
  p_lines jsonb,
  p_channel order_channel,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wearer public.corporate_wearers;
  v_programme public.corporate_programmes;
  v_retailer public.retailers;
  v_order_id uuid;
  v_line jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_line_total integer;
  v_subtotal integer := 0;
begin
  -- Verify staff authorization: caller must be authenticated retailer staff.
  -- current_retailer_id()/current_retailer_role() return SQL NULL for any caller with no
  -- retailer-staff claim (customers, corporate wearers, corporate managers). `NOT (NULL AND ...)`
  -- evaluates to NULL, and PL/pgSQL's `IF NULL THEN` behaves like `IF FALSE THEN` — so a naive
  -- `if not (a = b and c in (...))` check silently falls through to FALSE (no exception raised)
  -- for exactly that population. Use IS DISTINCT FROM / IS NULL so a NULL claim always fails closed.
  if public.current_retailer_id() is null
    or public.current_retailer_id() is distinct from p_retailer_id
    or public.current_retailer_role() is null
    or public.current_retailer_role() not in ('owner', 'manager', 'admin', 'sales_associate') then
    raise exception 'Only retailer staff can place corporate orders';
  end if;

  -- Verify wearer exists and belongs to this retailer's programme
  select * into v_wearer
    from public.corporate_wearers
    where id = p_wearer_id and deleted_at is null;
  if not found then
    raise exception 'Wearer not found';
  end if;

  select * into v_programme
    from public.corporate_programmes
    where id = v_wearer.programme_id
      and retailer_id = p_retailer_id
      and deleted_at is null;
  if not found then
    raise exception 'Wearer does not belong to a programme under this retailer';
  end if;

  -- Verify retailer is active
  select * into v_retailer
    from public.retailers
    where id = p_retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for orders';
  end if;

  -- Get staff_id from current caller's auth.uid()
  declare
    v_staff_id uuid;
  begin
    select id into v_staff_id
      from public.retailer_staff_members
      where retailer_id = p_retailer_id
        and user_id = auth.uid()
        and deleted_at is null;
    -- staff_id can be null for e2e testing via service_role
  end;

  -- Validate and process each line: reuse place_order's price/inventory logic
  for v_line in select jsonb_array_elements(p_lines)
  loop
    declare
      v_variant_id uuid := (v_line->>'productVariantId')::uuid;
      v_quantity integer := (v_line->>'quantity')::integer;
    begin
      if v_quantity is null or v_quantity < 1 then
        raise exception 'Quantity must be at least 1';
      end if;

      select * into v_variant
        from public.product_variants
        where id = v_variant_id and deleted_at is null;
      if not found then
        raise exception 'Product variant % not found', v_variant_id;
      end if;

      select * into v_product
        from public.products
        where id = v_variant.product_id and deleted_at is null;
      if not found or v_product.retailer_id <> p_retailer_id or v_product.status <> 'active' then
        raise exception 'Product is not available from this retailer';
      end if;

      -- Stock check: made-to-order variants have no stock to decrement
      if not v_product.is_made_to_order then
        if v_variant.inventory_quantity < v_quantity then
          raise exception 'Not enough stock for %', v_variant.sku;
        end if;

        update public.product_variants
          set inventory_quantity = inventory_quantity - v_quantity
          where id = v_variant.id;
      end if;

      v_line_total := v_variant.price_amount_minor_units * v_quantity;
      v_subtotal := v_subtotal + v_line_total;
    end;
  end loop;

  -- Create the order with customer_id = NULL and corporate_wearer_id = p_wearer_id
  insert into public.orders (
    retailer_id, customer_id, corporate_wearer_id, order_number, status, channel,
    currency, subtotal_amount_minor_units, total_amount_minor_units, placed_at, staff_id
  )
  values (
    p_retailer_id, null, p_wearer_id, public.next_order_number(), 'pending_payment', p_channel,
    p_currency, v_subtotal, v_subtotal, now(), (
      select id from public.retailer_staff_members
      where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
      limit 1
    )
  )
  returning id into v_order_id;

  -- Insert order lines for each line item
  for v_line in select jsonb_array_elements(p_lines)
  loop
    declare
      v_variant_id uuid := (v_line->>'productVariantId')::uuid;
      v_quantity integer := (v_line->>'quantity')::integer;
    begin
      select * into v_variant
        from public.product_variants
        where id = v_variant_id and deleted_at is null;
      if found then
        select * into v_product
          from public.products
          where id = v_variant.product_id and deleted_at is null;

        insert into public.order_lines (
          order_id, product_variant_id, quantity,
          unit_price_amount_minor_units, unit_price_currency,
          requires_production, requires_alteration
        )
        values (
          v_order_id, v_variant.id, v_quantity,
          v_variant.price_amount_minor_units, v_variant.price_currency,
          v_product.is_made_to_order, v_product.is_alterable
        );
      end if;
    end;
  end loop;

  return v_order_id;
end;
$$;

-- Revoke default PUBLIC execute, grant only to authenticated staff (via place_order RPC caller pattern)
revoke all on function public.place_corporate_order(uuid, uuid, jsonb, order_channel, text) from public;
grant execute on function public.place_corporate_order(uuid, uuid, jsonb, order_channel, text) to authenticated;
grant execute on function public.place_corporate_order(uuid, uuid, jsonb, order_channel, text) to service_role;

comment on function public.place_corporate_order(uuid, uuid, jsonb, order_channel, text) is
  'PHASE 14.1 CORP-103: Place an order for a corporate wearer. Mirrors place_order''s validation logic but for staff-only, wearer-targeted orders. Called only by retailer staff, never by a wearer themselves. Mutates inventory and order tables only via this RPC, never direct insert.';

-- 3. RLS: Add manager-scoped SELECT access to orders and order_lines
-- A corporate manager can see orders for wearers in their account's programmes
create policy "corporate_orders_manager_select"
  on public.orders for select to authenticated using (
    corporate_wearer_id in (
      select w.id from public.corporate_wearers w
      join public.corporate_programmes p on p.id = w.programme_id
      join public.corporate_managers m on m.account_id = p.account_id
      where m.id = public.current_corporate_manager_id()
    )
  );

create policy "corporate_order_lines_manager_select"
  on public.order_lines for select to authenticated using (
    order_id in (
      select id from public.orders o
      where o.corporate_wearer_id in (
        select w.id from public.corporate_wearers w
        join public.corporate_programmes p on p.id = w.programme_id
        join public.corporate_managers m on m.account_id = p.account_id
        where m.id = public.current_corporate_manager_id()
      )
    )
  );

comment on table public.orders is
  'The commercial record — see docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration". Created only by place_order() for retail customers, or place_corporate_order() for corporate wearers.';
