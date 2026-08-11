-- A conversation message is canonical evidence. Advisor capture only stores a
-- review workflow around it; it must never become a second notes system.

alter table public.advisor_capture_sessions
  add column message_id uuid references public.messages (id) on delete restrict;

alter table public.advisor_capture_sessions
  drop constraint if exists advisor_capture_sessions_source_check;

alter table public.advisor_capture_sessions
  add constraint advisor_capture_sessions_source_check
  check (source in ('text', 'voice', 'photo', 'conversation_message'));

alter table public.advisor_capture_sessions
  add constraint advisor_capture_sessions_conversation_message_source_check
  check (
    (source = 'conversation_message' and message_id is not null)
    or (source <> 'conversation_message' and message_id is null)
  );

create index advisor_capture_sessions_message_idx
  on public.advisor_capture_sessions (message_id)
  where message_id is not null;

-- The FK establishes object identity. This trigger also binds the session to
-- the message's canonical conversation/customer/House and prevents a caller
-- from swapping in an arbitrary text copy before the substring gate runs.
create or replace function public.validate_conversation_message_capture_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages%rowtype;
  v_conversation public.conversations%rowtype;
begin
  if new.source <> 'conversation_message' then
    return new;
  end if;

  select * into v_message
  from public.messages
  where id = new.message_id and deleted_at is null;
  if not found then
    raise exception 'Conversation message source not found' using errcode = 'P0001';
  end if;

  select * into v_conversation
  from public.conversations
  where id = v_message.conversation_id and deleted_at is null;
  if not found
    or v_conversation.retailer_id <> new.retailer_id
    or v_conversation.customer_id <> new.customer_id
    or new.raw_text <> v_message.body then
    raise exception 'Conversation message capture source does not match its House and customer'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_conversation_message_capture_session() from public;

create trigger advisor_capture_sessions_validate_conversation_message_source
  before insert or update of source, message_id, retailer_id, customer_id, raw_text
  on public.advisor_capture_sessions
  for each row execute function public.validate_conversation_message_capture_session();

comment on column public.advisor_capture_sessions.message_id is
  'Canonical message authority for source=conversation_message. source_excerpt is a citation only.';
