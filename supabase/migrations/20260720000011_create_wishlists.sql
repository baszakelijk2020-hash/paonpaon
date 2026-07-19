-- ADR-026. Wishlist/WishlistItem (docs/DOMAIN_MODEL.md Customer bounded
-- context) — a customer's saved products, one default wishlist per
-- customer, created lazily on first save.

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null default 'Wishlist',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index one_default_wishlist_per_customer_idx
  on public.wishlists (customer_id)
  where is_default and deleted_at is null;

create trigger set_wishlists_updated_at
  before update on public.wishlists
  for each row
  execute function public.set_updated_at();

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text,
  primary key (wishlist_id, product_variant_id)
);

alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

create policy "platform staff can manage all wishlists"
  on public.wishlists for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own wishlists"
  on public.wishlists for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = wishlists.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Wishlist is part of the Customer aggregate (docs/DOMAIN_MODEL.md) and
-- retailer staff already read the full CRM record at this same gate
-- (sales_associate+, docs/DATABASE.md) — a client's saved pieces are
-- clienteling-relevant the same way their order/appointment history is.
create policy "retailer staff can read their retailer's customer wishlists"
  on public.wishlists for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = wishlists.customer_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

create policy "platform staff can manage all wishlist items"
  on public.wishlist_items for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own wishlist items"
  on public.wishlist_items for select
  using (
    exists (
      select 1 from public.wishlists w
      join public.customers c on c.id = w.customer_id
      where w.id = wishlist_items.wishlist_id
        and c.user_id = auth.uid()
    )
  );

create policy "retailer staff can read their retailer's wishlist items"
  on public.wishlist_items for select
  using (
    exists (
      select 1 from public.wishlists w
      join public.customers c on c.id = w.customer_id
      where w.id = wishlist_items.wishlist_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

comment on table public.wishlists is
  'A customer''s saved-products list. Written only by toggle_wishlist_item().';
comment on table public.wishlist_items is
  'wishlists x product_variants. Written only by toggle_wishlist_item().';

-- The one write path for both tables — same "narrow RPC, inline
-- Customer creation on first interaction" shape as add_to_cart/
-- place_order/request_appointment (docs/DECISIONS.md ADR-012 family),
-- since saving to a wishlist may be a shopper's very first interaction
-- with a retailer, same as adding to cart.
create or replace function public.toggle_wishlist_item(
  p_retailer_id uuid,
  p_variant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_retailer_id uuid;
  v_customer_id uuid;
  v_wishlist_id uuid;
  v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select p.retailer_id into v_product_retailer_id
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id and pv.deleted_at is null and p.deleted_at is null;
  if v_product_retailer_id is null or v_product_retailer_id <> p_retailer_id then
    raise exception 'Product is not available from this retailer';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null
    limit 1;
  if v_customer_id is null then
    insert into public.customers (retailer_id, user_id, full_name, email, lifecycle_stage)
    values (p_retailer_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Customer'), auth.jwt() ->> 'email', 'prospect')
    returning id into v_customer_id;
    insert into public.customer_account_links (user_id, customer_id, retailer_id)
    values (auth.uid(), v_customer_id, p_retailer_id)
    on conflict (user_id, customer_id) do nothing;
  end if;

  insert into public.wishlists (customer_id, name, is_default)
    values (v_customer_id, 'Wishlist', true)
    on conflict (customer_id) where is_default and deleted_at is null do nothing;
  select id into v_wishlist_id from public.wishlists
    where customer_id = v_customer_id and is_default and deleted_at is null;

  if exists (
    select 1 from public.wishlist_items
    where wishlist_id = v_wishlist_id and product_variant_id = p_variant_id
  ) then
    delete from public.wishlist_items
      where wishlist_id = v_wishlist_id and product_variant_id = p_variant_id;
    v_removed := true;
  else
    insert into public.wishlist_items (wishlist_id, product_variant_id)
      values (v_wishlist_id, p_variant_id);
  end if;

  return not v_removed;
end;
$$;

revoke all on function public.toggle_wishlist_item(uuid, uuid) from public;
grant execute on function public.toggle_wishlist_item(uuid, uuid) to authenticated, service_role;

grant select, insert, update, delete on public.wishlists, public.wishlist_items to authenticated, service_role;
