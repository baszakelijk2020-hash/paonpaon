-- paon.html's product detail view shows a distinct fabric/texture
-- close-up separate from the main mannequin photo (`#paon-mobile-swatch-img`)
-- — Product had no second image field to hold it, so every swatch was
-- silently falling back to the same primary photo. Same shape as
-- primary_image_url (nullable, no RLS change needed — covered by the
-- existing products policies).

alter table public.products
  add column swatch_image_url text;

comment on column public.products.swatch_image_url is
  'A distinct fabric/texture close-up shown in the storefront detail view — falls back to primary_image_url when not set, see apps/customer/app/r/[slug]/route.ts.';
