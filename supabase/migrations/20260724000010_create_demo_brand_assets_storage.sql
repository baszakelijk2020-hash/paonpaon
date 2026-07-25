insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demo-brand-assets',
  'demo-brand-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon']
)
on conflict (id) do nothing;

create policy "anyone can read published demo brand assets"
  on storage.objects for select
  using (bucket_id = 'demo-brand-assets');

create policy "platform staff upload demo brand assets"
  on storage.objects for insert
  with check (bucket_id = 'demo-brand-assets' and public.is_platform_staff());

create policy "platform staff remove demo brand assets"
  on storage.objects for delete
  using (bucket_id = 'demo-brand-assets' and public.is_platform_staff());
