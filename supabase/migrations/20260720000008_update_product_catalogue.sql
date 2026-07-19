create or replace function public.update_product_catalogue(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_status public.product_status,
  p_is_made_to_order boolean,
  p_is_alterable boolean,
  p_primary_image_url text,
  p_collection_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
begin
  select retailer_id into v_retailer_id
  from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if v_retailer_id is null
    or v_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to update product';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_collection_ids, '{}'::uuid[])) collection_id
    where not exists (
      select 1 from public.collections c
      where c.id = collection_id
        and c.retailer_id = v_retailer_id
        and c.deleted_at is null
    )
  ) then
    raise exception 'Collection does not belong to retailer';
  end if;

  update public.products set
    name = p_name,
    slug = p_slug,
    description = p_description,
    status = p_status,
    is_made_to_order = p_is_made_to_order,
    is_alterable = p_is_alterable,
    primary_image_url = nullif(p_primary_image_url, '')
  where id = p_product_id;

  delete from public.product_collections where product_id = p_product_id;
  insert into public.product_collections (product_id, collection_id)
  select p_product_id, collection_id
  from unnest(coalesce(p_collection_ids, '{}'::uuid[])) collection_id;

  return p_product_id;
end;
$$;

revoke all on function public.update_product_catalogue(uuid, text, text, text, public.product_status, boolean, boolean, text, uuid[]) from public;
grant execute on function public.update_product_catalogue(uuid, text, text, text, public.product_status, boolean, boolean, text, uuid[]) to authenticated;
