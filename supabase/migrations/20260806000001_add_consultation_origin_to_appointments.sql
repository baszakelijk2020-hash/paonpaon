-- FT-09 consultation-outcome journey: appointment-booking from consultation thread
-- Adds a nullable FK to record the origin conversation/thread for provenance and
-- visibility. Mirrors alteration_tasks.origin_fitting_observation_id pattern
-- (narrow SECURITY DEFINER RPC validates thread belongs to same customer/retailer,
-- revoke-all-then-grant-specific ACL convention).

alter table public.appointments
  add column if not exists origin_message_thread_id uuid
    references public.conversations (id) on delete set null;

create index if not exists appointments_origin_thread_idx
  on public.appointments (origin_message_thread_id)
  where origin_message_thread_id is not null;

-- RPC: create an appointment from within a consultation thread, optionally
-- linked to a tagged attachment (the "shared look"). Validates thread belongs
-- to the same customer/retailer before accepting the link.
create or replace function public.book_appointment_from_consultation(
  p_conversation_id uuid,
  p_type public.appointment_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null,
  p_message_attachment_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_customer public.customers%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_attachment public.message_attachments%rowtype;
  v_new_appointment_id uuid;
begin
  -- Retrieve and validate the conversation.
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id and deleted_at is null;
  if not found then
    raise exception 'Conversation not found';
  end if;

  -- Retrieve the customer.
  select * into v_customer
  from public.customers
  where id = v_conversation.customer_id and deleted_at is null;
  if not found then
    raise exception 'Customer not found';
  end if;

  -- Validate caller is authorized (customer or retailer staff on that retailer).
  if v_customer.user_id = auth.uid() then
    -- Customer is authorized for their own conversation.
    null;
  elsif exists (
    select 1
    from public.retailer_staff_members
    where retailer_id = v_conversation.retailer_id
      and user_id = auth.uid()
      and accepted_at is not null
      and deleted_at is null
      and role in ('sales_associate', 'manager', 'admin', 'owner')
  ) then
    -- Staff is authorized on their retailer.
    null;
  else
    raise exception 'Not authorized for this conversation';
  end if;

  -- Validate time range.
  if p_starts_at >= p_ends_at then
    raise exception 'Start time must be before end time';
  end if;

  -- Validate optional attachment (if provided, it must belong to this conversation).
  if p_message_attachment_id is not null then
    select * into v_attachment
    from public.message_attachments
    where id = p_message_attachment_id;
    if v_attachment.id is null then
      raise exception 'Attachment not found';
    end if;
    -- Verify it belongs to this conversation (via its message).
    if not exists (
      select 1
      from public.messages m
      where m.id = v_attachment.message_id
        and m.conversation_id = v_conversation.id
        and m.deleted_at is null
    ) then
      raise exception 'Attachment does not belong to this conversation';
    end if;
  end if;

  -- Create the appointment with origin_message_thread_id set.
  insert into public.appointments (
    retailer_id,
    customer_id,
    type,
    starts_at,
    ends_at,
    notes,
    origin_message_thread_id
  ) values (
    v_conversation.retailer_id,
    v_conversation.customer_id,
    p_type,
    p_starts_at,
    p_ends_at,
    btrim(coalesce(p_notes, '')),
    v_conversation.id
  ) returning id into v_new_appointment_id;

  return v_new_appointment_id;
end;
$$;

revoke all on function public.book_appointment_from_consultation(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) from public;
grant execute on function public.book_appointment_from_consultation(
  uuid, public.appointment_type, timestamptz, timestamptz, text, uuid
) to authenticated, service_role;
