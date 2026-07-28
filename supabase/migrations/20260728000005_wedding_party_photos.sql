-- Party cover + member photos for AM House Party (PHASE.md queue item 6
-- step 5). Public bucket — roster/orbit are customer-facing, same shape
-- as product-images (ADR-029), not private alteration evidence.
-- Path convention: <retailer_id>/<wedding_party_id>/…

alter table public.wedding_parties
  add column cover_photo_url text;

alter table public.wedding_party_members
  add column photo_url text;

-- Organizers previously could insert a party but not update it (only
-- retailer staff had for-all). Photo URLs are written by the organizer
-- after create, so open a narrow update path that still proves
-- organizer identity + tenant match (ADR-053).
create policy "organizer updates own wedding party"
  on public.wedding_parties for update
  using (
    exists (
      select 1 from public.customers c
      where c.id = wedding_parties.organizer_customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = wedding_parties.retailer_id
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = wedding_parties.organizer_customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = wedding_parties.retailer_id
    )
  );

create policy "organizer updates wedding party member photos"
  on public.wedding_party_members for update
  using (
    exists (
      select 1 from public.wedding_parties p
      join public.customers c on c.id = p.organizer_customer_id
      where p.id = wedding_party_members.wedding_party_id
        and c.user_id = auth.uid()
        and c.retailer_id = p.retailer_id
    )
  )
  with check (
    exists (
      select 1 from public.wedding_parties p
      join public.customers c on c.id = p.organizer_customer_id
      where p.id = wedding_party_members.wedding_party_id
        and c.user_id = auth.uid()
        and c.retailer_id = p.retailer_id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'party-photos',
  'party-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create or replace function public.can_manage_party_photo_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_retailer_id uuid;
  v_party_id uuid;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2 then return false; end if;
  begin
    v_retailer_id := v_folders[1]::uuid;
    v_party_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if v_retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  then
    return exists (
      select 1 from public.wedding_parties p
      where p.id = v_party_id and p.retailer_id = v_retailer_id and p.deleted_at is null
    );
  end if;

  return exists (
    select 1 from public.wedding_parties p
    join public.customers c on c.id = p.organizer_customer_id
    where p.id = v_party_id
      and p.retailer_id = v_retailer_id
      and p.deleted_at is null
      and c.user_id = auth.uid()
      and c.retailer_id = p.retailer_id
  );
end;
$$;

revoke all on function public.can_manage_party_photo_object(text) from public;
grant execute on function public.can_manage_party_photo_object(text)
  to authenticated, service_role;

create policy "anyone can read party photos"
  on storage.objects for select
  using (bucket_id = 'party-photos');

create policy "organizer or staff can upload party photos"
  on storage.objects for insert
  with check (
    bucket_id = 'party-photos'
    and public.can_manage_party_photo_object(name)
  );

create policy "organizer or staff can remove party photos"
  on storage.objects for delete
  using (
    bucket_id = 'party-photos'
    and public.can_manage_party_photo_object(name)
  );
