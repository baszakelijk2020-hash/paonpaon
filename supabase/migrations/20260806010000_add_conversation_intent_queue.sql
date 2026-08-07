-- PHASE 17.14: prospect AI conversation, buying-intent queue, and human
-- handoff. Extends the existing FT-09 Conversation/Message model (ADR-034)
-- rather than a second messaging system.
--
-- `conversations` gains a real triage queue state and an explainable
-- (never opaque-score) buying-intent classification with cited evidence.
-- No new write path is opened on `conversations` for authenticated
-- callers: like the rest of this table (see `linkOutcome`'s own
-- docstring), it still grants no authenticated UPDATE via RLS — every
-- write here goes through the same narrow, caller-authorizes-itself
-- service-role boundary `linkOutcome`/`bookFromConsultation` already use.
--
-- `message_ai_drafts` is the human-in-the-loop AI reply proposal, same
-- discipline as `advisor_capture_bundles` (20260804120000): an AI
-- proposal never reaches a customer as a real message until a staff
-- member sends it as-is or edited — a `messages` row is only ever
-- created afterward, through the existing `send_conversation_message`
-- RPC, preserving that every real message keeps its own true sender.

alter type public.ai_generation_kind add value if not exists 'communication_draft';

alter table public.conversations
  add column status text not null default 'ai_handling'
    check (status in (
      'ai_handling', 'needs_human', 'claimed', 'waiting_for_customer',
      'follow_up_required', 'converted', 'closed'
    )),
  add column claimed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  add column claimed_at timestamptz,
  add column buying_intent_level text
    check (buying_intent_level is null or buying_intent_level in ('low', 'medium', 'high', 'very_high')),
  -- Array of {code, label, matchedText, sourceMessageId} — every element
  -- traceable back to a real matched substring of a real message, never
  -- a bare score. See `classifyBuyingIntent` (@paon/domain).
  add column buying_intent_signals jsonb not null default '[]'::jsonb,
  add constraint conversations_claim_chk check (
    (claimed_by_staff_id is null and claimed_at is null)
    or (claimed_by_staff_id is not null and claimed_at is not null)
  );

create index conversations_retailer_status_idx
  on public.conversations (retailer_id, status);
create index conversations_retailer_intent_idx
  on public.conversations (retailer_id, buying_intent_level)
  where buying_intent_level is not null;

create table public.message_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  based_on_message_id uuid references public.messages (id) on delete set null,
  draft_text text not null check (char_length(btrim(draft_text)) between 1 and 5000),
  -- Same allowlist-citation shape as `generateGroundedAnswer` — never a
  -- free-floating fact the model invented outside these ids.
  knowledge_object_ids jsonb not null default '[]'::jsonb,
  product_ids jsonb not null default '[]'::jsonb,
  status text not null default 'proposed'
    check (status in ('proposed', 'sent', 'edited_and_sent', 'dismissed')),
  resolved_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  resolved_at timestamptz,
  -- Set only once the approved (as-is or edited) text is actually sent
  -- as a real message — links the internal AI provenance to the real
  -- customer-visible row without ever claiming the AI text was typed by
  -- the advisor personally.
  sent_message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint message_ai_drafts_resolution_chk check (
    (status = 'proposed' and resolved_at is null and resolved_by_staff_id is null and sent_message_id is null)
    or (status = 'dismissed' and resolved_at is not null and resolved_by_staff_id is not null and sent_message_id is null)
    or (status in ('sent', 'edited_and_sent') and resolved_at is not null and resolved_by_staff_id is not null and sent_message_id is not null)
  )
);

create index message_ai_drafts_conversation_idx
  on public.message_ai_drafts (conversation_id, created_at desc);
create index message_ai_drafts_retailer_status_idx
  on public.message_ai_drafts (retailer_id, status);

alter table public.message_ai_drafts enable row level security;
revoke all on table public.message_ai_drafts from public, anon;
grant select, insert, update on table public.message_ai_drafts to authenticated, service_role;

create policy message_ai_drafts_retailer_select
  on public.message_ai_drafts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy message_ai_drafts_retailer_insert
  on public.message_ai_drafts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
  );

create policy message_ai_drafts_retailer_update
  on public.message_ai_drafts for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.message_ai_drafts is
  'AI-proposed conversation reply, grounded on the same approved knowledge/product allowlist as TableService guidance. Never sent to a customer until a staff member approves it as-is or edited.';

-- Claim a conversation for triage. Re-derives the caller's own staff row
-- server-side (never trusts a client-supplied staff id) — the same
-- security-definer shape as `mark_conversation_read`. A conversation
-- already claimed by someone else is left untouched (0 rows updated),
-- so the caller can tell claim vs. already-claimed apart.
create or replace function public.claim_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_staff public.retailer_staff_members%rowtype;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id and deleted_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;

  select * into v_staff from public.retailer_staff_members
    where retailer_id = v_conversation.retailer_id
      and user_id = auth.uid()
      and accepted_at is not null
      and deleted_at is null
      and role in ('sales_associate', 'manager', 'admin', 'owner');
  if v_staff.id is null then raise exception 'Not authorized'; end if;

  update public.conversations
    set claimed_by_staff_id = v_staff.id, claimed_at = now(), status = 'claimed'
    where id = p_conversation_id and claimed_by_staff_id is null;

  return found;
end $$;

revoke all on function public.claim_conversation(uuid) from public;
grant execute on function public.claim_conversation(uuid) to authenticated, service_role;

-- Staff-driven status transitions once a conversation is in the queue
-- (e.g. "waiting_for_customer" after a reply, "follow_up_required",
-- "converted", "closed"). Restricted to whoever claimed it or a
-- manager+, so one associate cannot silently close another's queue item.
create or replace function public.set_conversation_status(p_conversation_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_staff public.retailer_staff_members%rowtype;
begin
  if p_status not in ('needs_human', 'claimed', 'waiting_for_customer', 'follow_up_required', 'converted', 'closed') then
    raise exception 'Unrecognized status';
  end if;

  select * into v_conversation from public.conversations where id = p_conversation_id and deleted_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;

  select * into v_staff from public.retailer_staff_members
    where retailer_id = v_conversation.retailer_id
      and user_id = auth.uid()
      and accepted_at is not null
      and deleted_at is null
      and role in ('sales_associate', 'manager', 'admin', 'owner');
  if v_staff.id is null then raise exception 'Not authorized'; end if;
  if v_conversation.claimed_by_staff_id is not null
     and v_conversation.claimed_by_staff_id <> v_staff.id
     and v_staff.role not in ('manager', 'admin', 'owner') then
    raise exception 'Only the assigned advisor or a manager can change this conversation''s status';
  end if;

  update public.conversations set status = p_status where id = p_conversation_id;
end $$;

revoke all on function public.set_conversation_status(uuid, text) from public;
grant execute on function public.set_conversation_status(uuid, text) to authenticated, service_role;
