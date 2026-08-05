-- PHASE 17.13 (ADV-113): the QR wardrobe card's physical-to-digital
-- bridge. A scan must show the item's real, full information without
-- requiring the scanner to be signed in — the same anonymous
-- opaque-token reveal pattern `resolve_gift_invitation` (15.x) and
-- `resolve_corporate_tender` (18.3) already established, extended here
-- to a wardrobe item instead of inventing a third mechanism.
--
-- `public_token` is permanent (no revoke here — this session's own
-- 18.3 revocation work named that as a real, separate feature; a
-- wardrobe card is not a time-limited commercial document, it is a
-- physical object glued to a hanger for the item's whole life).

alter table public.wardrobe_items
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists wardrobe_items_public_token_key
  on public.wardrobe_items (public_token);

create or replace function public.resolve_wardrobe_item_public(
  p_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.wardrobe_items%rowtype;
  v_retailer public.retailers%rowtype;
  v_product_slug text;
begin
  select * into v_item
    from public.wardrobe_items
    where public_token = p_token and deleted_at is null;
  if not found then
    raise exception 'This wardrobe item link is no longer valid';
  end if;

  select * into v_retailer
    from public.retailers
    where id = v_item.retailer_id and deleted_at is null;
  if not found or v_retailer.status <> 'active' then
    raise exception 'This wardrobe item link is no longer valid';
  end if;

  if v_item.product_id is not null then
    select slug into v_product_slug
      from public.products
      where id = v_item.product_id and deleted_at is null;
  end if;

  -- Full item information always shown, scanner authentication or
  -- account linkage notwithstanding — this item's own non-goal.
  -- Never the owning customer's name, email or any other personal
  -- detail: the card identifies the GARMENT, not its owner.
  return jsonb_build_object(
    'retailerDisplayName', v_retailer.display_name,
    'retailerSlug', v_retailer.slug,
    'itemId', v_item.id,
    'categoryCode', v_item.category_code,
    'displayName', v_item.display_name,
    'brand', v_item.brand,
    'description', v_item.description,
    'condition', v_item.condition,
    'careState', v_item.care_state,
    'identifyingPhotoUrl', v_item.identifying_photo_url,
    'retired', v_item.retired_at is not null,
    'productSlug', v_product_slug
  );
end;
$$;

revoke all on function public.resolve_wardrobe_item_public(uuid) from public;
grant execute on function public.resolve_wardrobe_item_public(uuid)
  to anon, authenticated, service_role;

comment on function public.resolve_wardrobe_item_public(uuid) is
  'PHASE 17.13 / ADV-113. Anonymous, opaque-token reveal of a wardrobe '
  'item''s garment information only — never the owning customer''s '
  'identity. Scanner authentication is never required to see it.';
