-- Message attachments for the TableService/staff chat inbox (pag1's `gcw-`
-- widget — attach panel, chat history, picture gallery). Mirrors
-- alteration_attachments' shape exactly (private bucket, path-scoped
-- storage RLS, a metadata row per file) rather than inventing a new
-- pattern — see 20260719000101/20260719000103.

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  uploaded_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  check (num_nonnulls(uploaded_by_staff_id, uploaded_by_user_id) = 1)
);
create index message_attachments_message_idx on public.message_attachments (message_id);
create index message_attachments_retailer_idx on public.message_attachments (retailer_id);

-- The blanket PostgREST grant (20260720000000) only covers tables that
-- existed when it ran — every table created afterward needs its own grant
-- or every read 403s even though RLS is satisfied (hit this same class of
-- gap with customer_preferences, wishlists, and behavioral_events; see
-- docs/PROJECT_STATE.md "Local database verification"). Writes stay
-- RPC-only (record_message_attachment below), so this only needs select.
grant select on public.message_attachments to authenticated, service_role;

alter table public.message_attachments enable row level security;

create policy "platform reads message attachments"
  on public.message_attachments for select
  using (public.is_platform_staff());

create policy "participants read message attachments"
  on public.message_attachments for select
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (
          (c.retailer_id = public.current_retailer_id()
            and public.current_retailer_role() not in ('workshop_manager', 'worker'))
          or exists (
            select 1 from public.customers cu
            where cu.id = c.customer_id and cu.user_id = auth.uid()
          )
        )
    )
  );

-- Narrow security-definer RPC (same shape as send_conversation_message) —
-- re-derives the caller's own sender identity rather than trusting a
-- client-supplied uploaded_by_* value. The file itself is already in
-- Storage by the time this runs; this only records the metadata row.
create or replace function public.record_message_attachment(
  p_message_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
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
begin
  select * into v_message from public.messages where id = p_message_id and deleted_at is null;
  if not found then raise exception 'Message not found'; end if;
  select * into v_conversation from public.conversations where id = v_message.conversation_id;
  select * into v_customer from public.customers where id = v_conversation.customer_id;
  select * into v_staff from public.retailer_staff_members
    where retailer_id = v_conversation.retailer_id and user_id = auth.uid()
      and accepted_at is not null and deleted_at is null;

  if v_customer.user_id = auth.uid() then
    insert into public.message_attachments (
      retailer_id, message_id, storage_bucket, storage_path, file_name,
      mime_type, size_bytes, uploaded_by_user_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'message-attachments', p_storage_path,
      p_file_name, p_mime_type, p_size_bytes, auth.uid()
    ) returning id into v_attachment_id;
  elsif v_staff.id is not null and v_staff.role in ('sales_associate', 'manager', 'admin', 'owner') then
    insert into public.message_attachments (
      retailer_id, message_id, storage_bucket, storage_path, file_name,
      mime_type, size_bytes, uploaded_by_staff_id
    ) values (
      v_conversation.retailer_id, p_message_id, 'message-attachments', p_storage_path,
      p_file_name, p_mime_type, p_size_bytes, v_staff.id
    ) returning id into v_attachment_id;
  else
    raise exception 'Not authorized';
  end if;

  return v_attachment_id;
end;
$$;

revoke all on function public.record_message_attachment(uuid, text, text, text, bigint) from public;
grant execute on function public.record_message_attachment(uuid, text, text, text, bigint) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Path convention: <retailer_id>/<conversation_id>/<filename> — mirrors
-- can_access_alteration_storage_object exactly.
create or replace function public.can_access_conversation_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_conversation_id uuid;
  v_conversation public.conversations%rowtype;
begin
  if public.is_platform_staff() then return true; end if;
  if array_length(v_folders, 1) < 2
    or v_folders[1] <> public.current_retailer_id()::text
  then return false; end if;
  begin
    v_conversation_id := v_folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  select * into v_conversation from public.conversations where id = v_conversation_id;
  if not found then return false; end if;
  if v_conversation.retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
  then return true; end if;
  return exists (
    select 1 from public.customers cu
    where cu.id = v_conversation.customer_id and cu.user_id = auth.uid()
  );
end;
$$;

create policy "conversation participants can read attachment objects"
  on storage.objects for select
  using (bucket_id = 'message-attachments' and public.can_access_conversation_storage_object(name));
create policy "conversation participants can upload attachment objects"
  on storage.objects for insert
  with check (bucket_id = 'message-attachments' and public.can_access_conversation_storage_object(name));
create policy "uploaders can remove unregistered attachment objects"
  on storage.objects for delete
  using (
    bucket_id = 'message-attachments'
    and public.can_access_conversation_storage_object(name)
    and not exists (
      select 1 from public.message_attachments a
      where a.storage_bucket = 'message-attachments' and a.storage_path = storage.objects.name
    )
  );
