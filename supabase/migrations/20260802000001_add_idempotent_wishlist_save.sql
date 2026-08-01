-- A swipe-right means "saved", not "invert whatever state happens to exist".
-- Keep toggle_wishlist_item for explicit wishlist buttons, and give campaign
-- surfaces an idempotent command that remains safe when a Server Action is
-- retried after a lost response.

create or replace function public.save_wishlist_item(
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

  insert into public.wishlist_items (wishlist_id, product_variant_id)
    values (v_wishlist_id, p_variant_id)
    on conflict (wishlist_id, product_variant_id) do nothing;

  return true;
end;
$$;

revoke all on function public.save_wishlist_item(uuid, uuid) from public;
grant execute on function public.save_wishlist_item(uuid, uuid) to authenticated, service_role;

comment on function public.save_wishlist_item(uuid, uuid) is
  'Idempotently saves a retailer-owned product variant for the authenticated customer.';
comment on table public.wishlists is
  'A customer''s saved-products list. Written only by guarded wishlist RPCs.';
comment on table public.wishlist_items is
  'wishlists x product_variants. Written only by guarded wishlist RPCs.';
