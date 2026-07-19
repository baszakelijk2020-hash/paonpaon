-- See docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration" and
-- docs/DECISIONS.md ADR-014. Orders are only ever created by
-- `place_order` (end of this migration) — never inserted directly by a
-- client — so there is no client-facing insert policy on either table.

create type public.order_status as enum (
  'draft',
  'pending_payment',
  'placed',
  'in_production',
  'ready_for_fulfillment',
  'shipped',
  'delivered',
  'completed',
  'canceled',
  'refunded'
);

create type public.order_channel as enum (
  'online',
  'in_store',
  'clienteling',
  'phone'
);

create sequence public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORD-' || lpad(nextval('public.order_number_seq')::text, 6, '0')
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_number text not null unique,
  status public.order_status not null default 'pending_payment',
  channel public.order_channel not null default 'online',
  currency text not null,
  subtotal_amount_minor_units integer not null check (subtotal_amount_minor_units >= 0),
  total_amount_minor_units integer not null check (total_amount_minor_units >= 0),
  shipping_address jsonb,
  placed_at timestamptz,
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index orders_retailer_id_idx on public.orders (retailer_id);
create index orders_customer_id_idx on public.orders (customer_id);

create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy "platform staff can manage all orders"
  on public.orders for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's orders"
  on public.orders for select
  using (retailer_id = public.current_retailer_id());

-- Fulfillment/status updates — production_staff and above, not
-- read_only. A stricter-than-customers, looser-than-products gate:
-- order handling is closer to production_staff's job than to catalog
-- authoring.
create policy "production staff and above can update their retailer's orders"
  on public.orders for update
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() <> 'read_only'
  );

create policy "a customer can read their own orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.orders is
  'The commercial record — see docs/DOMAIN_MODEL.md "Order vs. Production vs. Alteration". Created only by place_order().';

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id),
  quantity integer not null check (quantity > 0),
  unit_price_amount_minor_units integer not null check (unit_price_amount_minor_units >= 0),
  unit_price_currency text not null,
  requires_production boolean not null default false,
  requires_alteration boolean not null default false,
  created_at timestamptz not null default now()
);

create index order_lines_order_id_idx on public.order_lines (order_id);

alter table public.order_lines enable row level security;

create policy "platform staff can read all order lines"
  on public.order_lines for select
  using (public.is_platform_staff());

create policy "retailer staff can read their retailer's order lines"
  on public.order_lines for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.retailer_id = public.current_retailer_id()
    )
  );

create policy "a customer can read their own order lines"
  on public.order_lines for select
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_lines.order_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.order_lines is
  'Snapshots productVariantId/unitPrice at order time — a later price/product change never rewrites a past order. Written only by place_order().';

-- The one write path for both tables above. See docs/DECISIONS.md
-- ADR-014 for why this is a security definer RPC (same "narrow RPC
-- over broadened policy" reasoning as accept_retailer_staff_invite /
-- link_my_customer_accounts, ADR-012/013) rather than insert policies
-- that would let a client assert its own price/inventory/customer_id.
create or replace function public.place_order(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer public.retailers;
  v_variant public.product_variants;
  v_product public.products;
  v_customer_id uuid;
  v_order_id uuid;
  v_line_total integer;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into v_retailer
    from public.retailers
    where id = p_retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'Retailer is not open for orders';
  end if;

  select * into v_variant
    from public.product_variants
    where id = p_variant_id and deleted_at is null;
  if not found then
    raise exception 'Product variant % not found', p_variant_id;
  end if;

  select * into v_product
    from public.products
    where id = v_variant.product_id and deleted_at is null;
  if not found or v_product.retailer_id <> p_retailer_id or v_product.status <> 'active' then
    raise exception 'Product is not available from this retailer';
  end if;

  -- Made-to-order variants have no stock to check or decrement.
  if not v_product.is_made_to_order then
    if v_variant.inventory_quantity < p_quantity then
      raise exception 'Not enough stock for %', v_variant.sku;
    end if;

    update public.product_variants
      set inventory_quantity = inventory_quantity - p_quantity
      where id = v_variant.id;
  end if;

  select id into v_customer_id
    from public.customers
    where retailer_id = p_retailer_id
      and user_id = auth.uid()
      and deleted_at is null
    limit 1;

  -- First purchase from this retailer: create the Customer record now,
  -- already linked (we already have both retailer_id and auth.uid()) —
  -- see docs/DECISIONS.md ADR-013 for why linking is otherwise a
  -- separate step (link_my_customer_accounts, email-matched).
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (
      p_retailer_id,
      auth.uid(),
      coalesce(auth.jwt() ->> 'email', 'Customer'),
      auth.jwt() ->> 'email',
      'first_purchase'
    )
    returning id into v_customer_id;

    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  v_line_total := v_variant.price_amount_minor_units * p_quantity;

  insert into public.orders (
    retailer_id, customer_id, order_number, status, channel,
    currency, subtotal_amount_minor_units, total_amount_minor_units, placed_at
  )
  values (
    p_retailer_id, v_customer_id, public.next_order_number(), 'pending_payment', 'online',
    v_variant.price_currency, v_line_total, v_line_total, now()
  )
  returning id into v_order_id;

  insert into public.order_lines (
    order_id, product_variant_id, quantity,
    unit_price_amount_minor_units, unit_price_currency,
    requires_production, requires_alteration
  )
  values (
    v_order_id, v_variant.id, p_quantity,
    v_variant.price_amount_minor_units, v_variant.price_currency,
    v_product.is_made_to_order, v_product.is_alterable
  );

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, uuid, integer) from public;
grant execute on function public.place_order(uuid, uuid, integer) to authenticated;
-- service_role too: not for browser-reachable use (it bypasses the
-- "is this caller authenticated" question place_order otherwise relies
-- on, same caution as every other admin-client use — see
-- docs/DATABASE.md "Row Level Security"), but e2e fixtures and any
-- future internal/support tooling need to seed orders without a real
-- customer session.
grant execute on function public.place_order(uuid, uuid, integer) to service_role;

comment on function public.place_order(uuid, uuid, integer) is
  'The only way an Order/OrderLine is created. Re-derives price, inventory and the caller''s Customer record server-side — never trusts client-supplied values for any of them. No payment capture yet (docs/DECISIONS.md ADR-014) — orders start "pending_payment".';
