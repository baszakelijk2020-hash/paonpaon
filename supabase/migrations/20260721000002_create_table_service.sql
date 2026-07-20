-- TableService: an intent-driven lead-capture entry point on the public
-- storefront (`/r/[slug]`) for visitors who have never logged in. Reuses
-- the existing Conversation/Message model (ADR-034) rather than a new
-- messaging system — a guest inquiry becomes an ordinary conversation
-- the moment a Customer row exists for it, deduped by (retailer, email)
-- the same way `customers_retailer_email_idx` already dedupes elsewhere.
--
-- Deliberately no anonymous RLS insert policy on conversations/messages
-- (ADR-034: "no new anonymous RLS insert path, no auth bypass") — the
-- single `security definer` entry point below is the only way an
-- unauthenticated visitor can reach these tables, same shape as
-- `get_or_create_my_conversation` for logged-in customers.

alter table public.conversations
  add column intent text
  check (intent is null or intent in ('wedding', 'shirts', 'style_help', 'freeform'));

-- Widen the sender_type check (originally customer/staff/ai_assistant
-- only) to allow a 'guest' message with neither a staff nor a linked
-- portal user — found dynamically since it's an unnamed table-level
-- check constraint from the original CREATE TABLE.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sender_type%';
  if v_conname is not null then
    execute format('alter table public.messages drop constraint %I', v_conname);
  end if;
end $$;

alter table public.messages add constraint messages_sender_type_check check (
  (sender_type = 'staff' and sender_staff_id is not null)
  or (sender_type = 'customer' and sender_user_id is not null)
  or (sender_type = 'guest' and sender_user_id is null and sender_staff_id is null)
  or sender_type = 'ai_assistant'
);

create or replace function public.submit_table_service_inquiry(
  p_retailer_id uuid,
  p_name text,
  p_email text,
  p_intent text,
  p_message text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_message text := trim(p_message);
  v_customer_id uuid;
  v_conversation_id uuid;
  v_recent_count int;
begin
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Message must contain 1 to 2000 characters';
  end if;
  if p_intent is not null and p_intent not in ('wedding', 'shirts', 'style_help', 'freeform') then
    raise exception 'Unrecognized intent';
  end if;
  if not exists (select 1 from public.retailers where id = p_retailer_id and deleted_at is null) then
    raise exception 'Retailer unavailable';
  end if;

  select id into v_customer_id from public.customers
    where retailer_id = p_retailer_id and lower(email) = v_email and deleted_at is null
    limit 1;

  if v_customer_id is null then
    insert into public.customers (retailer_id, full_name, email, lifecycle_stage, acquisition_source)
      values (p_retailer_id, v_name, v_email, 'prospect', 'tableservice')
      returning id into v_customer_id;
  end if;

  select count(*) into v_recent_count from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.customer_id = v_customer_id
      and m.sender_type = 'guest'
      and m.created_at > now() - interval '10 minutes';
  if v_recent_count >= 5 then
    raise exception 'Please wait a moment before sending another message.';
  end if;

  insert into public.conversations (retailer_id, customer_id, intent)
    values (p_retailer_id, v_customer_id, p_intent)
    on conflict (retailer_id, customer_id)
    do update set
      intent = coalesce(public.conversations.intent, excluded.intent),
      updated_at = now()
    returning id into v_conversation_id;

  insert into public.messages (conversation_id, sender_type, body)
    values (v_conversation_id, 'guest', v_message);

  update public.conversations set last_message_at = now() where id = v_conversation_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
    select
      p_retailer_id, s.user_id, v_customer_id, 'message',
      'New TableService inquiry', left(v_message, 240),
      '/messages/' || v_conversation_id, now()
    from public.retailer_staff_members s
    where s.retailer_id = p_retailer_id
      and s.user_id is not null
      and s.accepted_at is not null
      and s.deleted_at is null
      and s.role in ('sales_associate', 'manager', 'admin', 'owner');

  return v_conversation_id;
end $$;

revoke all on function public.submit_table_service_inquiry(uuid, text, text, text, text) from public;
grant execute on function public.submit_table_service_inquiry(uuid, text, text, text, text)
  to anon, authenticated, service_role;
