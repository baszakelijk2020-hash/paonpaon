-- Direct product image upload (docs/PROJECT_STATE.md's last remaining
-- catalogue-editing gap: "Direct image upload remains deferred; the
-- hosted image URL field is validated until Storage is added").
-- products.primary_image_url (20260719000010_*) already stores a plain
-- URL string with no storage integration — this slice doesn't touch
-- that column or update_product_catalogue's write path at all, it only
-- adds a way to populate it with a real uploaded file's public URL
-- instead of requiring staff to type/host one themselves.
--
-- Unlike alteration-evidence (20260719000103_*, private + signed URLs,
-- because that content is internal workshop evidence), product photos
-- are customer-facing on the public storefront — same "publicly
-- showable, no `to` clause" shape ADR-014 gave products/retailers — so
-- this bucket is public and reads use `getPublicUrl`, never a signed URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "anyone can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Same "managers and above can manage their retailer's products" gate
-- as the products table itself (20260719000010_*) — an image is part
-- of the product record, not a separate permission surface. The path's
-- first folder segment is the retailer id, set by the upload Server
-- Action (`apps/retailer/app/(dashboard)/products/[id]/actions.ts`),
-- so no per-product ownership lookup is needed here (unlike alteration
-- evidence, there's no per-product staff assignment to check).
create policy "managers and above can upload their retailer's product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (
      public.is_platform_staff()
      or (
        (storage.foldername(name))[1] = public.current_retailer_id()::text
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
      )
    )
  );

create policy "managers and above can remove their retailer's product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (
      public.is_platform_staff()
      or (
        (storage.foldername(name))[1] = public.current_retailer_id()::text
        and public.current_retailer_role() in ('manager', 'admin', 'owner')
      )
    )
  );
