-- FT-09 gap closure: the blueprint calls for "optional party/garment links"
-- on TableService attachments — connects an already-existing purpose
-- ('wedding_fabric') to an actual wedding party rather than leaving it a
-- floating label. Party-linking only; garment links are a separate,
-- unattempted gap.

alter table public.message_attachments
  add column if not exists wedding_party_id uuid
    references public.wedding_parties (id) on delete set null;

create index if not exists message_attachments_wedding_party_idx
  on public.message_attachments (wedding_party_id)
  where wedding_party_id is not null;

-- `create or replace` only replaces a function with an identical argument
-- list; adding p_wedding_party_id changes the signature, so without this
-- drop the old 8-arg overload would stay callable alongside the new one.
drop function if exists public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text
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
  p_wedding_party_id uuid default null
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
      wedding_party_id, uploaded_by_staff_id, uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'link', p_purpose,
      p_source_url, btrim(p_file_name), null, 0, v_rights_basis,
      'basic_validated', p_wedding_party_id,
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
      rights_basis, scan_status, wedding_party_id, uploaded_by_staff_id,
      uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'upload', p_purpose,
      'message-attachments', p_storage_path, null, btrim(p_file_name),
      p_mime_type, p_size_bytes, v_rights_basis, 'basic_validated',
      p_wedding_party_id,
      case when v_staff.id is not null then v_staff.id else null end,
      case when v_customer.user_id = auth.uid() then auth.uid() else null end
    ) returning id into v_attachment_id;
  end if;

  return v_attachment_id;
end;
$$;

revoke all on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid
) from public;
grant execute on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid
) to authenticated, service_role;
