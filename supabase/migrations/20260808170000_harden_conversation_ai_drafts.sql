-- PHASE 17.14: keep AI reply drafts tenant-correct and human-approved.
-- This forward migration closes the cross-House reference gaps in the first
-- draft schema and makes approve+send one transaction instead of a message
-- insert followed by a fallible draft update.

create or replace function public.enforce_conversation_claim_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.claimed_by_staff_id is not null and not exists (
    select 1 from public.retailer_staff_members s
    where s.id = new.claimed_by_staff_id
      and s.retailer_id = new.retailer_id
  ) then
    raise exception 'Claimed advisor must belong to the conversation retailer';
  end if;
  return new;
end $$;

create trigger enforce_conversation_claim_tenant
before insert or update of retailer_id, claimed_by_staff_id
on public.conversations
for each row execute function public.enforce_conversation_claim_tenant();

create or replace function public.enforce_message_ai_draft_tenant_refs()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id
      and c.retailer_id = new.retailer_id
  ) then
    raise exception 'Draft conversation must belong to the draft retailer';
  end if;
  if new.based_on_message_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.based_on_message_id
      and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Draft source message must belong to the draft conversation';
  end if;
  if new.resolved_by_staff_id is not null and not exists (
    select 1 from public.retailer_staff_members s
    where s.id = new.resolved_by_staff_id
      and s.retailer_id = new.retailer_id
  ) then
    raise exception 'Draft resolver must belong to the draft retailer';
  end if;
  if new.sent_message_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.sent_message_id
      and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Sent message must belong to the draft conversation';
  end if;
  return new;
end $$;

create trigger enforce_message_ai_draft_tenant_refs
before insert or update of retailer_id, conversation_id, based_on_message_id,
  resolved_by_staff_id, sent_message_id
on public.message_ai_drafts
for each row execute function public.enforce_message_ai_draft_tenant_refs();

-- Existing rows must already satisfy the new invariant; refuse the migration
-- rather than legitimizing or silently rewriting a cross-House reference.
do $$
begin
  if exists (
    select 1
    from public.conversations c
    join public.retailer_staff_members s on s.id = c.claimed_by_staff_id
    where s.retailer_id <> c.retailer_id
  ) or exists (
    select 1
    from public.message_ai_drafts d
    join public.conversations c on c.id = d.conversation_id
    where c.retailer_id <> d.retailer_id
  ) or exists (
    select 1
    from public.message_ai_drafts d
    join public.messages m on m.id = d.based_on_message_id
    where m.conversation_id <> d.conversation_id
  ) or exists (
    select 1
    from public.message_ai_drafts d
    join public.retailer_staff_members s on s.id = d.resolved_by_staff_id
    where s.retailer_id <> d.retailer_id
  ) or exists (
    select 1
    from public.message_ai_drafts d
    join public.messages m on m.id = d.sent_message_id
    where m.conversation_id <> d.conversation_id
  ) then
    raise exception 'Existing conversation AI data violates same-tenant references';
  end if;
  if exists (
    select 1
    from public.message_ai_drafts
    where status = 'proposed'
    group by conversation_id
    having count(*) > 1
  ) then
    raise exception 'Existing conversation has more than one proposed AI draft';
  end if;
end $$;

create unique index message_ai_drafts_one_proposed_per_conversation_idx
  on public.message_ai_drafts (conversation_id)
  where status = 'proposed';

-- Draft writes are internal workflow operations. Staff may read drafts, but
-- create/dismiss/approve only through the server-authorized proposal path or
-- the narrow caller-deriving RPCs below.
revoke insert, update on table public.message_ai_drafts from authenticated;
drop policy if exists message_ai_drafts_retailer_insert on public.message_ai_drafts;
drop policy if exists message_ai_drafts_retailer_update on public.message_ai_drafts;

create or replace function public.dismiss_conversation_ai_draft(p_draft_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.message_ai_drafts%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_conversation public.conversations%rowtype;
begin
  select * into v_draft
  from public.message_ai_drafts
  where id = p_draft_id
  for update;
  if not found then return false; end if;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_draft.retailer_id
    and user_id = auth.uid()
    and accepted_at is not null
    and deleted_at is null
    and role in ('sales_associate', 'manager', 'admin', 'owner');
  if v_staff.id is null then raise exception 'Not authorized'; end if;
  if v_draft.status <> 'proposed' then return false; end if;
  select * into v_conversation
  from public.conversations
  where id = v_draft.conversation_id;
  if v_conversation.claimed_by_staff_id is distinct from v_staff.id
     and v_staff.role not in ('manager', 'admin', 'owner') then
    raise exception 'Only the assigned advisor or a manager can dismiss this draft';
  end if;

  update public.message_ai_drafts
  set status = 'dismissed',
      resolved_by_staff_id = v_staff.id,
      resolved_at = now()
  where id = v_draft.id;
  return true;
end $$;

create or replace function public.approve_conversation_ai_draft(
  p_draft_id uuid,
  p_edited_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.message_ai_drafts%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_conversation public.conversations%rowtype;
  v_final_text text;
  v_message_id uuid;
  v_edited boolean;
begin
  select * into v_draft
  from public.message_ai_drafts
  where id = p_draft_id
  for update;
  if not found then raise exception 'Draft unavailable'; end if;

  select * into v_staff
  from public.retailer_staff_members
  where retailer_id = v_draft.retailer_id
    and user_id = auth.uid()
    and accepted_at is not null
    and deleted_at is null
    and role in ('sales_associate', 'manager', 'admin', 'owner');
  if v_staff.id is null then raise exception 'Not authorized'; end if;
  if v_draft.status <> 'proposed' then raise exception 'Draft already resolved'; end if;
  select * into v_conversation
  from public.conversations
  where id = v_draft.conversation_id;
  if v_conversation.claimed_by_staff_id is null then
    raise exception 'Conversation must be claimed before approving a draft';
  end if;
  if v_conversation.claimed_by_staff_id is distinct from v_staff.id
     and v_staff.role not in ('manager', 'admin', 'owner') then
    raise exception 'Only the assigned advisor or a manager can approve this draft';
  end if;

  v_final_text := btrim(coalesce(p_edited_text, v_draft.draft_text));
  if char_length(v_final_text) < 1 or char_length(v_final_text) > 5000 then
    raise exception 'Message must contain 1 to 5000 characters';
  end if;
  v_edited := v_final_text <> btrim(v_draft.draft_text);

  select public.send_conversation_message(v_draft.conversation_id, v_final_text)
  into v_message_id;

  update public.message_ai_drafts
  set status = case when v_edited then 'edited_and_sent' else 'sent' end,
      resolved_by_staff_id = v_staff.id,
      resolved_at = now(),
      sent_message_id = v_message_id
  where id = v_draft.id;

  update public.conversations
  set status = 'waiting_for_customer'
  where id = v_draft.conversation_id
    and status in ('needs_human', 'claimed', 'follow_up_required');

  return v_message_id;
end $$;

revoke all on function public.dismiss_conversation_ai_draft(uuid) from public;
revoke all on function public.approve_conversation_ai_draft(uuid, text) from public;
grant execute on function public.dismiss_conversation_ai_draft(uuid) to authenticated, service_role;
grant execute on function public.approve_conversation_ai_draft(uuid, text) to authenticated, service_role;
