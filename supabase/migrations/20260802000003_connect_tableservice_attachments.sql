-- Connect the founder TableService attachment controls to the canonical
-- conversation while keeping source, purpose, rights and validation explicit.

alter table public.message_attachments
  alter column storage_bucket drop not null,
  alter column storage_path drop not null,
  alter column mime_type drop not null,
  add column if not exists source_kind text not null default 'upload'
    check (source_kind in ('upload', 'link')),
  add column if not exists purpose text not null default 'photo'
    check (purpose in ('photo', 'document', 'pinterest_link', 'wedding_fabric')),
  add column if not exists source_url text,
  add column if not exists rights_basis text not null default 'customer_consultation'
    check (rights_basis in ('customer_consultation', 'retailer_consultation')),
  add column if not exists scan_status text not null default 'basic_validated'
    check (scan_status in ('pending_scan', 'basic_validated', 'quarantined', 'failed')),
  add constraint message_attachments_source_payload_chk check (
    (
      source_kind = 'upload'
      and storage_bucket is not null
      and storage_path is not null
      and source_url is null
      and mime_type is not null
    )
    or (
      source_kind = 'link'
      and storage_bucket is null
      and storage_path is null
      and source_url is not null
      and mime_type is null
      and size_bytes = 0
    )
  ),
  add constraint message_attachments_purpose_source_chk check (
    (source_kind = 'link' and purpose = 'pinterest_link')
    or (source_kind = 'upload' and purpose <> 'pinterest_link')
  );

create unique index message_attachments_message_source_url_uidx
  on public.message_attachments (message_id, source_url)
  where source_kind = 'link';

create or replace function public.record_consultation_attachment(
  p_message_id uuid,
  p_source_kind text,
  p_purpose text,
  p_file_name text,
  p_mime_type text default null,
  p_size_bytes bigint default 0,
  p_storage_path text default null,
  p_source_url text default null
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
      uploaded_by_staff_id, uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'link', p_purpose,
      p_source_url, btrim(p_file_name), null, 0, v_rights_basis,
      'basic_validated',
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
      rights_basis, scan_status, uploaded_by_staff_id, uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'upload', p_purpose,
      'message-attachments', p_storage_path, null, btrim(p_file_name),
      p_mime_type, p_size_bytes, v_rights_basis, 'basic_validated',
      case when v_staff.id is not null then v_staff.id else null end,
      case when v_customer.user_id = auth.uid() then auth.uid() else null end
    ) returning id into v_attachment_id;
  end if;

  return v_attachment_id;
end;
$$;

revoke all on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text
) from public;
grant execute on function public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text
) to authenticated, service_role;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
]
where id = 'message-attachments';
