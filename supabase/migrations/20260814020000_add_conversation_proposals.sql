-- FT-09 / PHASE 10.3: the "unified remote proposal" half of FT-09 — an
-- advisor turns a remote conversation into one concrete decision artifact
-- (selected products/looks, fabrics, config intentions, price, alternatives,
-- an appointment option) that the customer can accept or decline. The one
-- requirement docs/NIGHT_SHIFT_BLOCKERS.md flagged as needing real schema:
-- "expiration/versioning (a stale proposal is never silently treated as
-- still valid)" — every response is validated server-side against freshness
-- (still the latest version, not superseded, not past expires_at) inside a
-- security-definer RPC, the same trust boundary send_conversation_message
-- and mark_conversation_read already use for this table family. Reuses
-- `conversations`/`messages` rather than a parallel proposal/quote model,
-- per the spec's own instruction.
--
-- Order/appointment creation on accept is deliberately NOT wired here —
-- that stays a manual staff follow-up via the existing outcome-linking
-- pattern (`linkOutcome` / the messages inbox's "Link" button), matching
-- how 10.3's outcome half already works and avoiding a second, unreviewed
-- Commerce integration path in the same slice as new RLS.

create table public.conversation_proposals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  created_by_staff_id uuid not null references public.retailer_staff_members (id),
  version integer not null check (version >= 1),
  status text not null default 'active'
    check (status in ('active', 'superseded', 'accepted', 'declined')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  advisor_note text not null
    check (char_length(btrim(advisor_note)) between 1 and 2000),
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array'),
  alternatives jsonb not null default '[]'::jsonb
    check (jsonb_typeof(alternatives) = 'array'),
  price_minor_units integer check (price_minor_units is null or price_minor_units >= 0),
  price_currency text check (price_currency is null or char_length(price_currency) = 3),
  appointment_offered boolean not null default false,
  expires_at timestamptz not null,
  responded_at timestamptz,
  response text check (response is null or response in ('accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, version)
);

-- Enforces "only one current proposal per conversation" as a DB constraint,
-- not just application discipline — a second insert while one is still
-- 'active' fails outright rather than silently creating an ambiguous
-- "which one is latest" state.
create unique index conversation_proposals_one_active_idx
  on public.conversation_proposals (conversation_id)
  where status = 'active';

create index conversation_proposals_conversation_idx
  on public.conversation_proposals (conversation_id, version desc);

create trigger set_conversation_proposals_updated_at
  before update on public.conversation_proposals
  for each row
  execute function public.set_updated_at();

alter table public.conversation_proposals enable row level security;

revoke all on table public.conversation_proposals from public, anon;
grant select on table public.conversation_proposals to authenticated, service_role;

create policy "platform reads conversation proposals"
  on public.conversation_proposals for select
  using (public.is_platform_staff());

create policy "retailer staff read conversation proposals"
  on public.conversation_proposals for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
  );

create policy "customers read own conversation proposals"
  on public.conversation_proposals for select
  using (
    exists (
      select 1 from public.conversations c
      join public.customers cu on cu.id = c.customer_id
      where c.id = conversation_id and cu.user_id = auth.uid()
    )
  );

-- All writes go through the two RPCs below (same trust boundary as
-- send_conversation_message/mark_conversation_read) — no insert/update
-- grant to authenticated on the table itself.

create or replace function public.create_conversation_proposal(
  p_conversation_id uuid,
  p_title text,
  p_advisor_note text,
  p_items jsonb,
  p_alternatives jsonb default '[]'::jsonb,
  p_price_minor_units integer default null,
  p_price_currency text default null,
  p_appointment_offered boolean default false,
  p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_staff public.retailer_staff_members%rowtype;
  v_customer public.customers%rowtype;
  v_next_version integer;
  v_id uuid;
begin
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'A proposal must expire in the future';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'A proposal must carry at least one selected item';
  end if;

  select * into v_conversation from public.conversations where id = p_conversation_id and deleted_at is null;
  if not found then raise exception 'Conversation unavailable'; end if;

  select * into v_staff from public.retailer_staff_members
    where retailer_id = v_conversation.retailer_id and user_id = auth.uid()
      and accepted_at is not null and deleted_at is null;
  if v_staff.id is null or v_staff.role not in ('sales_associate', 'manager', 'admin', 'owner') then
    raise exception 'Not authorized';
  end if;

  update public.conversation_proposals
    set status = 'superseded'
    where conversation_id = p_conversation_id and status = 'active';

  select coalesce(max(version), 0) + 1 into v_next_version
    from public.conversation_proposals where conversation_id = p_conversation_id;

  insert into public.conversation_proposals (
    retailer_id, conversation_id, created_by_staff_id, version, title,
    advisor_note, items, alternatives, price_minor_units, price_currency,
    appointment_offered, expires_at
  ) values (
    v_conversation.retailer_id, p_conversation_id, v_staff.id, v_next_version, p_title,
    p_advisor_note, p_items, p_alternatives, p_price_minor_units, p_price_currency,
    p_appointment_offered, p_expires_at
  ) returning id into v_id;

  select * into v_customer from public.customers where id = v_conversation.customer_id;
  if v_customer.user_id is not null then
    insert into public.notifications (retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at)
      values (v_conversation.retailer_id, v_customer.user_id, v_customer.id, 'message', 'New proposal', left(trim(p_title), 240), '/messages/' || p_conversation_id, now());
  end if;

  update public.conversations set last_message_at = now() where id = p_conversation_id;

  return v_id;
end;
$$;

create or replace function public.respond_to_conversation_proposal(
  p_proposal_id uuid,
  p_response text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.conversation_proposals%rowtype;
  v_conversation public.conversations%rowtype;
  v_customer public.customers%rowtype;
  v_staff_ids uuid[];
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'Response must be accepted or declined';
  end if;

  select * into v_proposal from public.conversation_proposals where id = p_proposal_id;
  if not found then raise exception 'Proposal unavailable'; end if;

  select * into v_conversation from public.conversations where id = v_proposal.conversation_id;
  select * into v_customer from public.customers where id = v_conversation.customer_id;
  if v_customer.user_id is null or v_customer.user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  -- The exact stale-proposal check the spec names: superseded by a newer
  -- version, already responded to, or past its own expiry all refuse here
  -- rather than silently accepting a decision on out-of-date terms.
  if v_proposal.status <> 'active' then
    raise exception 'This proposal is no longer active';
  end if;
  if now() > v_proposal.expires_at then
    raise exception 'This proposal has expired';
  end if;

  update public.conversation_proposals
    set status = p_response, response = p_response, responded_at = now()
    where id = p_proposal_id;

  select array_agg(s.user_id) into v_staff_ids
    from public.retailer_staff_members s
    where s.retailer_id = v_conversation.retailer_id and s.user_id is not null
      and s.accepted_at is not null and s.deleted_at is null
      and s.role in ('sales_associate', 'manager', 'admin', 'owner');

  if v_staff_ids is not null then
    insert into public.notifications (retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at)
      select v_conversation.retailer_id, staff_user_id, v_customer.id, 'message',
        case when p_response = 'accepted' then 'Proposal accepted' else 'Proposal declined' end,
        left(v_proposal.title, 240), '/messages/' || v_conversation.id, now()
      from unnest(v_staff_ids) as staff_user_id;
  end if;

  update public.conversations set last_message_at = now() where id = v_conversation.id;
end;
$$;

revoke all on function public.create_conversation_proposal(uuid, text, text, jsonb, jsonb, integer, text, boolean, timestamptz) from public;
grant execute on function public.create_conversation_proposal(uuid, text, text, jsonb, jsonb, integer, text, boolean, timestamptz) to authenticated, service_role;

revoke all on function public.respond_to_conversation_proposal(uuid, text) from public;
grant execute on function public.respond_to_conversation_proposal(uuid, text) to authenticated, service_role;

comment on table public.conversation_proposals is
  'FT-09 unified remote proposal (PHASE 10.3): versioned, expiring decision artifacts on a conversation. Only one status=active row per conversation at a time (partial unique index); all writes go through create_conversation_proposal/respond_to_conversation_proposal, which enforce freshness server-side.';
