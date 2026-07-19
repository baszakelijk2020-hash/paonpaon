create type public.message_sender_type as enum ('customer','staff','ai_assistant');
create type public.notification_channel as enum ('email','sms','push','in_app');
create type public.notification_category as enum ('order_update','production_update','alteration_update','appointment_reminder','loyalty_update','message','marketing','system');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (retailer_id, customer_id)
);
create index conversations_retailer_last_idx on public.conversations(retailer_id, last_message_at desc nulls last);
create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type public.message_sender_type not null,
  sender_staff_id uuid references public.retailer_staff_members(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  read_by_customer_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check ((sender_type = 'staff' and sender_staff_id is not null) or (sender_type = 'customer' and sender_user_id is not null) or sender_type = 'ai_assistant')
);
create index messages_conversation_time_idx on public.messages(conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  category public.notification_category not null,
  title text not null,
  body text not null,
  action_href text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at desc);
create trigger set_notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create or replace function public.protect_notification_recipient_update() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_platform_staff() then return new; end if;
  if new.id <> old.id or new.retailer_id <> old.retailer_id or new.recipient_user_id <> old.recipient_user_id or new.customer_id is distinct from old.customer_id or new.channel <> old.channel or new.category <> old.category or new.title <> old.title or new.body <> old.body or new.action_href is distinct from old.action_href or new.sent_at is distinct from old.sent_at or new.created_at <> old.created_at or new.deleted_at is distinct from old.deleted_at or new.read_at is null or (old.read_at is not null and new.read_at <> old.read_at) then raise exception 'Recipients may only mark a notification read'; end if;
  return new;
end $$;
create trigger protect_notification_recipient_columns before update on public.notifications for each row execute function public.protect_notification_recipient_update();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "platform reads conversations" on public.conversations for select using (public.is_platform_staff());
create policy "retailer staff read conversations" on public.conversations for select using (retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker'));
create policy "customers read own conversations" on public.conversations for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));
create policy "platform reads messages" on public.messages for select using (public.is_platform_staff());
create policy "participants read messages" on public.messages for select using (exists (select 1 from public.conversations c where c.id = conversation_id and ((c.retailer_id = public.current_retailer_id() and public.current_retailer_role() not in ('workshop_manager','worker')) or exists (select 1 from public.customers cu where cu.id = c.customer_id and cu.user_id = auth.uid()))));
create policy "users read own notifications" on public.notifications for select using (recipient_user_id = auth.uid());
create policy "users mark own notifications read" on public.notifications for update using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());
create policy "platform reads notifications" on public.notifications for select using (public.is_platform_staff());

create or replace function public.get_or_create_my_conversation(p_retailer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_id uuid;
begin
  select id into v_customer_id from public.customers where retailer_id = p_retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship required'; end if;
  insert into public.conversations(retailer_id,customer_id) values (p_retailer_id,v_customer_id) on conflict (retailer_id,customer_id) do update set updated_at = public.conversations.updated_at returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_or_create_staff_conversation(p_customer_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_retailer_id uuid; v_id uuid;
begin
  select retailer_id into v_retailer_id from public.customers where id = p_customer_id and deleted_at is null;
  if v_retailer_id is null or v_retailer_id <> public.current_retailer_id() or public.current_retailer_role() not in ('sales_associate','manager','admin','owner') then raise exception 'Not authorized'; end if;
  insert into public.conversations(retailer_id,customer_id) values (v_retailer_id,p_customer_id) on conflict (retailer_id,customer_id) do update set updated_at = public.conversations.updated_at returning id into v_id;
  return v_id;
end $$;

create or replace function public.send_conversation_message(p_conversation_id uuid, p_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_conversation public.conversations%rowtype; v_staff public.retailer_staff_members%rowtype; v_customer public.customers%rowtype; v_message_id uuid;
begin
  if length(trim(p_body)) < 1 or length(p_body) > 5000 then raise exception 'Message must contain 1 to 5000 characters'; end if;
  select * into v_conversation from public.conversations where id = p_conversation_id and deleted_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;
  select * into v_customer from public.customers where id = v_conversation.customer_id;
  select * into v_staff from public.retailer_staff_members where retailer_id = v_conversation.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_customer.user_id = auth.uid() then
    insert into public.messages(conversation_id,sender_type,sender_user_id,body,read_by_customer_at) values (p_conversation_id,'customer',auth.uid(),trim(p_body),now()) returning id into v_message_id;
    insert into public.notifications(retailer_id,recipient_user_id,customer_id,category,title,body,action_href,sent_at)
      select v_conversation.retailer_id,s.user_id,v_customer.id,'message','New customer message',left(trim(p_body),240),'/messages/'||p_conversation_id,now() from public.retailer_staff_members s where s.retailer_id = v_conversation.retailer_id and s.user_id is not null and s.accepted_at is not null and s.deleted_at is null and s.role in ('sales_associate','manager','admin','owner');
  elsif v_staff.id is not null and v_staff.role in ('sales_associate','manager','admin','owner') then
    insert into public.messages(conversation_id,sender_type,sender_staff_id,sender_user_id,body,read_by_staff_at) values (p_conversation_id,'staff',v_staff.id,auth.uid(),trim(p_body),now()) returning id into v_message_id;
    if v_customer.user_id is not null then insert into public.notifications(retailer_id,recipient_user_id,customer_id,category,title,body,action_href,sent_at) values (v_conversation.retailer_id,v_customer.user_id,v_customer.id,'message','New message',left(trim(p_body),240),'/messages/'||p_conversation_id,now()); end if;
  else raise exception 'Not authorized'; end if;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_message_id;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_conversation public.conversations%rowtype;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if exists (select 1 from public.customers where id = v_conversation.customer_id and user_id = auth.uid()) then update public.messages set read_by_customer_at = coalesce(read_by_customer_at,now()) where conversation_id = p_conversation_id and sender_type <> 'customer';
  elsif exists (select 1 from public.retailer_staff_members where retailer_id = v_conversation.retailer_id and user_id = auth.uid() and accepted_at is not null and deleted_at is null and role not in ('workshop_manager','worker')) then update public.messages set read_by_staff_at = coalesce(read_by_staff_at,now()) where conversation_id = p_conversation_id and sender_type = 'customer';
  else raise exception 'Not authorized'; end if;
  update public.notifications set read_at = coalesce(read_at,now()) where recipient_user_id = auth.uid() and action_href = '/messages/'||p_conversation_id;
end $$;

revoke all on function public.get_or_create_my_conversation(uuid), public.get_or_create_staff_conversation(uuid), public.send_conversation_message(uuid,text), public.mark_conversation_read(uuid) from public;
grant execute on function public.get_or_create_my_conversation(uuid), public.get_or_create_staff_conversation(uuid), public.send_conversation_message(uuid,text), public.mark_conversation_read(uuid) to authenticated, service_role;
grant select, insert, update on public.conversations, public.messages, public.notifications to authenticated, service_role;
