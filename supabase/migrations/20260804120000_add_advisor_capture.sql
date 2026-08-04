-- Advisor capture: frictionless note/voice capture that an AI pass turns
-- into confirmable action bundles. Human-in-the-loop by construction — a
-- bundle is a *proposal*, never written to a canonical table
-- (customer_facts, clienteling_opportunities) until an advisor confirms
-- or edits it. Every bundle keeps the exact source excerpt it was drawn
-- from, so nothing here is a black box: an advisor, manager or the
-- founder can always see exactly what text produced which suggestion.
--
-- Deliberately reuses customer_facts (Self-Portrait) and
-- clienteling_opportunities (staff follow-ups) as the write targets on
-- confirm, rather than inventing parallel truths — the same reasoning
-- 20260801000000_add_campaign_mission_opportunities.sql already gave for
-- campaign_mission.

alter type public.ai_generation_kind add value if not exists 'advisor_capture';

alter table public.clienteling_opportunities
  drop constraint if exists clienteling_opportunities_opportunity_type_check;

alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_opportunity_type_check check (
    opportunity_type in (
      'interest_follow_up',
      'purchase_care_check',
      'occasion_readiness',
      'relationship_dormancy',
      'wardrobe_gap',
      'anniversary_moment',
      'contact_pressure_warning',
      'campaign_mission',
      'advisor_commitment'
    )
  );

create table if not exists public.advisor_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  source text not null default 'text' check (source in ('text', 'voice', 'photo')),
  raw_text text not null check (char_length(btrim(raw_text)) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index if not exists advisor_capture_sessions_retailer_idx
  on public.advisor_capture_sessions (retailer_id, created_at desc);
create index if not exists advisor_capture_sessions_customer_idx
  on public.advisor_capture_sessions (customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.advisor_capture_bundles (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  capture_session_id uuid not null
    references public.advisor_capture_sessions (id) on delete cascade,
  kind text not null check (kind in ('self_portrait_fact', 'follow_up', 'task_note')),
  summary text not null check (char_length(btrim(summary)) between 1 and 300),
  -- The exact substring of raw_text this bundle was drawn from. Never
  -- empty: a suggestion with nothing to point back at is unreviewable,
  -- which is exactly the black-box outcome this table exists to prevent.
  source_excerpt text not null check (char_length(btrim(source_excerpt)) between 1 and 2000),
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  -- Kind-specific proposed fields (fact_type/value_label, or
  -- opportunity why_now/suggested_action/due_at, or a plain note) —
  -- validated per-kind at the application boundary before confirm ever
  -- writes it, same split as the rest of this codebase's jsonb payloads.
  proposed_payload jsonb not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'dismissed')),
  linked_fact_id uuid references public.customer_facts (id) on delete set null,
  linked_opportunity_id uuid
    references public.clienteling_opportunities (id) on delete set null,
  linked_note_id uuid references public.clienteling_notes (id) on delete set null,
  confirmed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_capture_bundles_resolution_chk check (
    (status = 'proposed' and confirmed_at is null and confirmed_by_staff_id is null)
    or (status in ('confirmed', 'dismissed') and confirmed_at is not null
        and confirmed_by_staff_id is not null)
  )
);

create index if not exists advisor_capture_bundles_session_idx
  on public.advisor_capture_bundles (capture_session_id, created_at asc);
create index if not exists advisor_capture_bundles_retailer_status_idx
  on public.advisor_capture_bundles (retailer_id, status);

alter table public.advisor_capture_sessions enable row level security;
alter table public.advisor_capture_bundles enable row level security;

revoke all on table public.advisor_capture_sessions from public, anon;
revoke all on table public.advisor_capture_bundles from public, anon;

grant select, insert on table public.advisor_capture_sessions
  to authenticated, service_role;
-- Bundles may be edited (payload/summary) only while still proposed —
-- enforced by the resolution CHECK above plus the application layer,
-- which refuses to edit a bundle whose status is no longer 'proposed'.
grant select, insert, update on table public.advisor_capture_bundles
  to authenticated, service_role;

create policy advisor_capture_sessions_retailer_select
  on public.advisor_capture_sessions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy advisor_capture_sessions_retailer_insert
  on public.advisor_capture_sessions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
    and exists (
      select 1 from public.retailer_staff_members s
      where s.id = advisor_capture_sessions.staff_id
        and s.user_id = auth.uid()
        and s.retailer_id = advisor_capture_sessions.retailer_id
        and s.accepted_at is not null
        and s.deleted_at is null
    )
  );

create policy advisor_capture_bundles_retailer_select
  on public.advisor_capture_bundles for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy advisor_capture_bundles_retailer_insert
  on public.advisor_capture_bundles for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
  );

create policy advisor_capture_bundles_retailer_update
  on public.advisor_capture_bundles for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.advisor_capture_sessions is
  'Raw advisor note/voice/photo capture (frictionless intake). One row per capture, never edited.';
comment on table public.advisor_capture_bundles is
  'AI-proposed, evidence-cited action bundles from a capture session. Never written to customer_facts or clienteling_opportunities until an advisor confirms — proposals are not conclusions.';
