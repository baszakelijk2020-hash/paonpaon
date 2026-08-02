-- FT-13 Moonstruck groom/best-men planner — wiring `wedding_inspiration_items`
-- (schema already existed since 20260801000014, unwired: retailer-staff
-- read/insert/update RLS existed, but the column `added_by_customer_id`
-- anticipates a customer write path that was never built). Unlike
-- wedding_group_fittings (retailer-only), this table is meant to be
-- customer-writable — a groom or party member pinning inspiration — so this
-- needs a SECURITY DEFINER RPC re-deriving the caller's customer id
-- server-side (ADR-034 narrow-RPC pattern), not a plain RLS insert policy,
-- since the caller has no staff session to trust.

alter table public.wedding_inspiration_items
  add constraint wedding_inspiration_item_has_content
  check (image_ref is not null or note is not null);

create policy "organizer and members read their party's inspiration items"
  on public.wedding_inspiration_items for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));

create or replace function public.add_wedding_inspiration_item(
  p_wedding_party_id uuid,
  p_image_ref text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_customer_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_image_ref is null and p_note is null then
    raise exception 'Provide an image or a note';
  end if;

  if not public.is_wedding_party_organizer_or_member(p_wedding_party_id) then
    raise exception 'Not authorized for this wedding party';
  end if;

  select retailer_id into v_retailer_id
    from public.wedding_parties where id = p_wedding_party_id;

  select c.id into v_customer_id
    from public.customers c
    where c.retailer_id = v_retailer_id and c.user_id = auth.uid()
    limit 1;

  insert into public.wedding_inspiration_items
    (retailer_id, wedding_party_id, added_by_customer_id, image_ref, note)
    values (v_retailer_id, p_wedding_party_id, v_customer_id, p_image_ref, p_note)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_wedding_inspiration_item(uuid, text, text) from public;
grant execute on function public.add_wedding_inspiration_item(uuid, text, text)
  to authenticated, service_role;
