-- FT-09: uploads remain private and unavailable until a provider-neutral
-- scanner explicitly clears them. No scanner/provider is activated here.

alter table public.message_attachments
  drop constraint if exists message_attachments_scan_status_check;

update public.message_attachments
set scan_status = 'cleared'
where scan_status = 'basic_validated';

alter table public.message_attachments
  alter column scan_status set default 'pending_scan',
  add constraint message_attachments_scan_status_check
    check (scan_status in ('pending_scan', 'cleared', 'quarantined', 'failed'));

create table public.message_attachment_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null unique references public.message_attachments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'cleared', 'failed')),
  attempt integer not null default 0 check (attempt >= 0),
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_attachment_scan_jobs_queue_idx
  on public.message_attachment_scan_jobs (status, created_at);
create index message_attachment_scan_jobs_retailer_idx
  on public.message_attachment_scan_jobs (retailer_id);

alter table public.message_attachment_scan_jobs enable row level security;
revoke all on table public.message_attachment_scan_jobs from anon, authenticated;
grant select, insert, update, delete on table public.message_attachment_scan_jobs to service_role;

-- Existing historical uploads were admitted before quarantine existed. They
-- remain readable, while every new storage upload is fail-closed and queued.
drop function if exists public.record_consultation_attachment(
  uuid, text, text, text, text, bigint, text, text, uuid, uuid
);

create function public.record_consultation_attachment(
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
language plpgsql security definer set search_path = '' as $$
declare
  v_message public.messages%rowtype; v_conversation public.conversations%rowtype;
  v_staff public.retailer_staff_members%rowtype; v_customer public.customers%rowtype;
  v_attachment_id uuid; v_rights_basis text; v_wardrobe_item public.wardrobe_items%rowtype;
begin
  select * into v_message from public.messages where id = p_message_id and deleted_at is null;
  if not found then raise exception 'Message not found'; end if;
  select * into v_conversation from public.conversations where id = v_message.conversation_id and deleted_at is null;
  select * into v_customer from public.customers where id = v_conversation.customer_id and deleted_at is null;
  select * into v_staff from public.retailer_staff_members where retailer_id = v_conversation.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_customer.user_id = auth.uid() then
    v_rights_basis := 'customer_consultation';
    if v_message.sender_user_id is distinct from auth.uid() then raise exception 'Attachment message does not belong to caller'; end if;
  elsif v_staff.id is not null and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner') then
    v_rights_basis := 'retailer_consultation';
    if v_message.sender_staff_id is distinct from v_staff.id then raise exception 'Attachment message does not belong to caller'; end if;
  else raise exception 'Not authorized'; end if;
  if p_source_kind not in ('upload', 'link') or p_purpose not in ('photo', 'document', 'pinterest_link', 'wedding_fabric') or length(btrim(p_file_name)) not between 1 and 120 then raise exception 'Invalid attachment metadata'; end if;
  if p_wedding_party_id is not null and not exists (select 1 from public.wedding_parties w where w.id = p_wedding_party_id and w.retailer_id = v_conversation.retailer_id and w.deleted_at is null) then raise exception 'Wedding party not found on this retailer'; end if;
  if p_wedding_party_id is not null and v_customer.user_id = auth.uid() and not public.is_wedding_party_organizer_or_member(p_wedding_party_id) then raise exception 'Not a member of this wedding party'; end if;
  if p_wardrobe_item_id is not null then
    select * into v_wardrobe_item from public.wardrobe_items where id = p_wardrobe_item_id and retired_at is null and deleted_at is null;
    if v_wardrobe_item.id is null or v_wardrobe_item.retailer_id <> v_conversation.retailer_id then raise exception 'Wardrobe item not found on this retailer'; end if;
    if v_customer.user_id = auth.uid() and v_wardrobe_item.customer_id <> v_customer.id then raise exception 'Not your wardrobe item'; end if;
  end if;
  if p_source_kind = 'link' then
    if p_purpose <> 'pinterest_link' or p_source_url is null or (p_source_url !~ '^https://([a-z0-9-]+\\.)*pinterest\\.com/' and p_source_url !~ '^https://pin\\.it/') then raise exception 'Invalid Pinterest reference'; end if;
    insert into public.message_attachments (retailer_id, message_id, source_kind, purpose, source_url, file_name, mime_type, size_bytes, rights_basis, scan_status, wedding_party_id, wardrobe_item_id, uploaded_by_staff_id, uploaded_by_user_id)
    values (v_conversation.retailer_id, p_message_id, 'link', p_purpose, p_source_url, btrim(p_file_name), null, 0, v_rights_basis, 'cleared', p_wedding_party_id, p_wardrobe_item_id, case when v_staff.id is not null then v_staff.id end, case when v_customer.user_id = auth.uid() then auth.uid() end)
    on conflict (message_id, source_url) where source_kind = 'link' do update set source_url = excluded.source_url returning id into v_attachment_id;
  else
    if p_purpose = 'pinterest_link' or p_storage_path is null or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') or p_size_bytes not between 1 and 10485760 or p_storage_path !~ ('^' || v_conversation.retailer_id::text || '/' || v_conversation.id::text || '/') or not exists (select 1 from storage.objects object where object.bucket_id = 'message-attachments' and object.name = p_storage_path) then raise exception 'Invalid consultation upload'; end if;
    if (p_purpose = 'photo' and p_mime_type = 'application/pdf') or (p_purpose = 'document' and p_mime_type <> 'application/pdf') then raise exception 'Attachment type does not match purpose'; end if;
    insert into public.message_attachments (retailer_id, message_id, source_kind, purpose, storage_bucket, storage_path, source_url, file_name, mime_type, size_bytes, rights_basis, scan_status, wedding_party_id, wardrobe_item_id, uploaded_by_staff_id, uploaded_by_user_id)
    values (v_conversation.retailer_id, p_message_id, 'upload', p_purpose, 'message-attachments', p_storage_path, null, btrim(p_file_name), p_mime_type, p_size_bytes, v_rights_basis, 'pending_scan', p_wedding_party_id, p_wardrobe_item_id, case when v_staff.id is not null then v_staff.id end, case when v_customer.user_id = auth.uid() then auth.uid() end) returning id into v_attachment_id;
    insert into public.message_attachment_scan_jobs (attachment_id, retailer_id) values (v_attachment_id, v_conversation.retailer_id) on conflict (attachment_id) do nothing;
  end if;
  return v_attachment_id;
end;
$$;

create function public.claim_pending_message_attachment_scan_jobs(p_limit integer default 5)
returns setof public.message_attachment_scan_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query update public.message_attachment_scan_jobs set status = 'processing', attempt = attempt + 1, claimed_at = now(), updated_at = now()
  where id in (select id from public.message_attachment_scan_jobs where status = 'queued' order by created_at limit greatest(1, least(p_limit, 100)) for update skip locked) returning *;
end;
$$;

create function public.complete_message_attachment_scan_job(p_job_id uuid, p_status text, p_error_message text default null)
returns public.message_attachment_scan_jobs language plpgsql security definer set search_path = '' as $$
declare v_job public.message_attachment_scan_jobs%rowtype;
begin
  if p_status not in ('cleared', 'failed') then raise exception 'Invalid scan completion status'; end if;
  update public.message_attachment_scan_jobs set status = p_status, error_message = case when p_status = 'failed' then left(nullif(btrim(p_error_message), ''), 500) else null end, completed_at = now(), updated_at = now()
  where id = p_job_id and status = 'processing' returning * into v_job;
  if v_job.id is null then raise exception 'Scan job not found or not processing'; end if;
  update public.message_attachments set scan_status = p_status where id = v_job.attachment_id and scan_status = 'pending_scan';
  if not found then raise exception 'Attachment is not pending scan'; end if;
  return v_job;
end;
$$;

create function public.retry_message_attachment_scan(p_attachment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attachment public.message_attachments%rowtype; v_customer public.customers%rowtype; v_staff public.retailer_staff_members%rowtype;
begin
  select a.* into v_attachment from public.message_attachments a join public.messages m on m.id = a.message_id join public.conversations c on c.id = m.conversation_id where a.id = p_attachment_id and m.deleted_at is null and c.deleted_at is null;
  if not found then raise exception 'Attachment not found'; end if;
  select c.* into v_customer from public.customers c join public.conversations cv on cv.customer_id = c.id join public.messages m on m.conversation_id = cv.id where m.id = v_attachment.message_id and c.deleted_at is null;
  select * into v_staff from public.retailer_staff_members where retailer_id = v_attachment.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_customer.user_id is distinct from auth.uid() and (v_staff.id is null or v_staff.role not in ('sales_associate', 'manager', 'admin', 'owner')) then raise exception 'Not authorized'; end if;
  if v_attachment.source_kind <> 'upload' or v_attachment.scan_status <> 'failed' then raise exception 'Only failed uploads can be retried'; end if;
  update public.message_attachments set scan_status = 'pending_scan' where id = v_attachment.id;
  update public.message_attachment_scan_jobs set status = 'queued', error_message = null, claimed_at = null, completed_at = null, updated_at = now() where attachment_id = v_attachment.id;
end;
$$;

revoke all on function public.record_consultation_attachment(uuid, text, text, text, text, bigint, text, text, uuid, uuid) from public;
grant execute on function public.record_consultation_attachment(uuid, text, text, text, text, bigint, text, text, uuid, uuid) to authenticated, service_role;
revoke all on function public.claim_pending_message_attachment_scan_jobs(integer) from public;
revoke all on function public.complete_message_attachment_scan_job(uuid, text, text) from public;
revoke all on function public.retry_message_attachment_scan(uuid) from public;
grant execute on function public.claim_pending_message_attachment_scan_jobs(integer) to service_role;
grant execute on function public.complete_message_attachment_scan_job(uuid, text, text) to service_role;
grant execute on function public.retry_message_attachment_scan(uuid) to authenticated, service_role;
