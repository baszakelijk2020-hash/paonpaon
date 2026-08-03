-- FT-09 gap closure: 20260802000015 closed party-linking on TableService
-- attachments and left "garment links are a separate, unattempted gap."
-- Mirrors that same shape for a customer's own wardrobe item (e.g. "here is
-- a photo of the blazer I'm asking about") on the 'photo' purpose. Links to
-- `wardrobe_items` (the customer-readable, customer-facing garment record),
-- not `physical_garments` (a staff-only alteration-intake record a customer
-- has no RLS read access to and typically has none of before ever visiting).

alter table public.message_attachments
  add column if not exists wardrobe_item_id uuid
    references public.wardrobe_items (id) on delete set null;

create index if not exists message_attachments_wardrobe_item_idx
  on public.message_attachments (wardrobe_item_id)
  where wardrobe_item_id is not null;

-- `create or replace` only replaces a function with an identical argument
-- list; adding p_wardrobe_item_id changes the signature, so without this
-- drop the old 9-arg overload would stay callable alongside the new one.
drop function if exists public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid
);

create or replace function public.record_consultation_attachment(
  p_message_id uuid,
  p_source_kind text,
  p_purpose text,
  p_file_name text,
  p_mime_type text default null,
  p_size_bytes bigint default 0,
  p_storage_path text default null,
  p_source_url text default null,
  p_wedding_party_id uuid default null,
  p_wardrobe_item_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages%rowtype;
  v_conversation public.conversations%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_customer public.customers%rowtype;
  v_attachment_id uuid;
  v_rights_basis text;
  v_wardrobe_item public.wardrobe_items%rowtype;
begin
  select * into v_message
  from public.messages
  where id = p_message_id and deleted_at is null;
  if not found then raise exception 'Message not found'; end if;

  select * into v_conversation
  from public.conversations
  where id = v_message.conversation_id and deleted_at is null;
  select * into v_customer
  from public.customers
  where id = v_conversation.customer_id and deleted_at is null;
  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_conversation.retailer_id
    and user_id = auth.uid()
    and accepted_at is not null
    and deleted_at is null;

  if v_customer.user_id = auth.uid() then
    v_rights_basis := 'customer_consultation';
    if v_message.sender_user_id is distinct from auth.uid() then
      raise exception 'Attachment message does not belong to caller';
    end if;
  elsif v_staff.id is not null
    and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner')
  then
    v_rights_basis := 'retailer_consultation';
    if v_message.sender_staff_id is distinct from v_staff.id then
      raise exception 'Attachment message does not belong to caller';
    end if;
  else
    raise exception 'Not authorized';
  end if;

  if p_source_kind not in ('upload', 'link') then
    raise exception 'Invalid attachment source';
  end if;
  if p_purpose not in ('photo', 'document', 'pinterest_link', 'wedding_fabric') then
    raise exception 'Invalid attachment purpose';
  end if;
  if length(btrim(p_file_name)) not between 1 and 120 then
    raise exception 'Invalid attachment file name';
  end if;

  if p_wedding_party_id is not null then
    if not exists (
      select 1 from public.wedding_parties w
      where w.id = p_wedding_party_id
        and w.retailer_id = v_conversation.retailer_id
        and w.deleted_at is null
    ) then
      raise exception 'Wedding party not found on this retailer';
    end if;
    if v_customer.user_id = auth.uid()
      and not public.is_wedding_party_organizer_or_member(p_wedding_party_id)
    then
      raise exception 'Not a member of this wedding party';
    end if;
  end if;

  if p_wardrobe_item_id is not null then
    select * into v_wardrobe_item
    from public.wardrobe_items
    where id = p_wardrobe_item_id
      and retired_at is null
      and deleted_at is null;
    if v_wardrobe_item.id is null
      or v_wardrobe_item.retailer_id <> v_conversation.retailer_id
    then
      raise exception 'Wardrobe item not found on this retailer';
    end if;
    -- Staff already manage the relationship and may tag any of this
    -- retailer's customer's wardrobe items; a customer caller may only
    -- link their own.
    if v_customer.user_id = auth.uid()
      and v_wardrobe_item.customer_id <> v_customer.id
    then
      raise exception 'Not your wardrobe item';
    end if;
  end if;

  if p_source_kind = 'link' then
    if p_purpose <> 'pinterest_link'
      or p_source_url is null
      or p_source_url !~ '^https://([a-z0-9-]+\.)*pinterest\.com/'
        and p_source_url !~ '^https://pin\.it/'
    then
      raise exception 'Invalid Pinterest reference';
    end if;
    insert into public.message_attachments (
      retailer_id, message_id, source_kind, purpose, source_url,
      file_name, mime_type, size_bytes, rights_basis, scan_status,
      wedding_party_id, wardrobe_item_id, uploaded_by_staff_id,
      uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'link', p_purpose,
      p_source_url, btrim(p_file_name), null, 0, v_rights_basis,
      'basic_validated', p_wedding_party_id, p_wardrobe_item_id,
      case when v_staff.id is not null then v_staff.id else null end,
      case when v_customer.user_id = auth.uid() then auth.uid() else null end
    )
    on conflict (message_id, source_url) where source_kind = 'link'
    do update set source_url = excluded.source_url
    returning id into v_attachment_id;
  else
    if p_purpose = 'pinterest_link'
      or p_storage_path is null
      or p_mime_type not in (
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
      )
      or p_size_bytes not between 1 and 10485760
      or p_storage_path !~ (
        '^' || v_conversation.retailer_id::text || '/' ||
        v_conversation.id::text || '/'
      )
      or not exists (
        select 1 from storage.objects object
        where object.bucket_id = 'message-attachments'
          and object.name = p_storage_path
      )
    then
      raise exception 'Invalid consultation upload';
    end if;
    if (p_purpose = 'photo' and p_mime_type = 'application/pdf')
      or (p_purpose = 'document' and p_mime_type <> 'application/pdf')
    then
      raise exception 'Attachment type does not match purpose';
    end if;

    insert into public.message_attachments (
      retailer_id, message_id, source_kind, purpose, storage_bucket,
      storage_path, source_url, file_name, mime_type, size_bytes,
      rights_basis, scan_status, wedding_party_id, wardrobe_item_id,
      uploaded_by_staff_id, uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'upload', p_purpose,
      'message-attachments', p_storage_path, null, btrim(p_file_name),
      p_mime_type, p_size_bytes, v_rights_basis, 'basic_validated',
      p_wedding_party_id, p_wardrobe_item_id,
      case when v_staff.id is not null then v_staff.id else null end,
      case when v_customer.user_id = auth.uid() then auth.uid() else null end
    ) returning id into v_attachment_id;
  end if;

  return v_attachment_id;
end;
$$;

revoke all on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid, uuid
) from public;
grant execute on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid, uuid
) to authenticated, service_role;
