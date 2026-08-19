-- Customer self-provided intake (PHASE 17.11), direct founder instruction
-- (2026-08-19): "a tool that lets me input the client's data they give
-- themselves when they become a customer, following a set of rules I set
-- in terms of data organization, which I will convert their data to
-- using some LLM, producing perhaps CLV or other [derived metrics]."
--
-- Mirrors advisor_capture_sessions/advisor_capture_bundles
-- (20260804120000) exactly in shape, with the one real difference that
-- matters: the AUTHOR here is the customer themselves, not staff, so
-- write access is gated on the caller's own customer_id, not a retailer
-- role. A staff member can still READ intake for their retailer (the
-- whole point is turning it into a reviewable Self-Portrait fact), but
-- can never author intake on a customer's behalf through this path —
-- that already exists as advisor_capture.
--
-- Proposals write into the EXISTING customer_facts table on confirm
-- (provenance_class='customer_declared'), never a parallel table — same
-- reasoning advisor_capture_bundles already established for
-- self_portrait_fact bundles.

create table public.customer_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  raw_text text not null check (char_length(btrim(raw_text)) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index customer_intake_sessions_retailer_idx
  on public.customer_intake_sessions (retailer_id, created_at desc);
create index customer_intake_sessions_customer_idx
  on public.customer_intake_sessions (customer_id, created_at desc);

create table public.customer_intake_proposals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  intake_session_id uuid not null
    references public.customer_intake_sessions (id) on delete cascade,
  fact_type text not null check (
    fact_type in (
      'preference_concept', 'occasion', 'anniversary', 'wedding_date',
      'travel_window', 'fit_note', 'fabric_interest', 'colour_interest',
      'pattern_interest', 'other'
    )
  ),
  value_label text not null check (char_length(btrim(value_label)) between 1 and 300),
  value_text text,
  -- Same non-negotiable rule as advisor_capture_bundles.source_excerpt:
  -- a proposal with nothing to point back at in the raw intake text is
  -- unreviewable, which is exactly the black-box outcome citation exists
  -- to prevent.
  source_excerpt text not null check (char_length(btrim(source_excerpt)) between 1 and 2000),
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'dismissed')),
  linked_fact_id uuid references public.customer_facts (id) on delete set null,
  confirmed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_intake_proposals_resolution_chk check (
    (status = 'proposed' and confirmed_at is null and confirmed_by_staff_id is null)
    or (status in ('confirmed', 'dismissed') and confirmed_at is not null
        and confirmed_by_staff_id is not null)
  )
);

create index customer_intake_proposals_session_idx
  on public.customer_intake_proposals (intake_session_id, created_at asc);
create index customer_intake_proposals_retailer_status_idx
  on public.customer_intake_proposals (retailer_id, status);

create trigger set_customer_intake_proposals_updated_at
  before update on public.customer_intake_proposals
  for each row execute function public.set_updated_at();

alter table public.customer_intake_sessions enable row level security;
alter table public.customer_intake_proposals enable row level security;

revoke all on table public.customer_intake_sessions from public, anon;
revoke all on table public.customer_intake_proposals from public, anon;

grant select, insert on table public.customer_intake_sessions
  to authenticated, service_role;
-- Proposals may be resolved (confirm/dismiss) by STAFF only, mirroring
-- advisor_capture_bundles — a customer authors the raw intake text, but
-- confirming which extracted facts actually become Self-Portrait truth
-- is a review step, same human-in-the-loop principle as advisor capture.
grant select, insert, update on table public.customer_intake_proposals
  to authenticated, service_role;

-- A customer may create their OWN intake session (find their own customer
-- row via user_id = auth.uid()) and read their own retailer's sessions
-- back is not needed by design -- intake is write-once from the
-- customer's side, review happens entirely on the staff side.
create policy customer_intake_sessions_customer_insert
  on public.customer_intake_sessions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.customers c
      where c.id = customer_intake_sessions.customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = customer_intake_sessions.retailer_id
    )
  );

create policy customer_intake_sessions_retailer_select
  on public.customer_intake_sessions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy customer_intake_proposals_retailer_select
  on public.customer_intake_proposals for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

-- Proposal rows are written by the AI-extraction pass, which runs as
-- service_role (a customer never directly inserts a proposal — they
-- only ever author the raw session text above). No authenticated insert
-- policy at all, matching the security-definer-only pattern used
-- elsewhere in this codebase for the same reason: an anonymous or
-- customer-authored client-side insert of an "AI proposal" would be
-- indistinguishable from a customer writing arbitrary unreviewed facts
-- about themselves directly into the review queue.
create policy customer_intake_proposals_retailer_update
  on public.customer_intake_proposals for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'sales_associate')
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.customer_intake_sessions is
  'Raw self-provided customer intake text (PHASE 17.11). One row per session, authored by the customer themselves, never edited.';
comment on table public.customer_intake_proposals is
  'AI-proposed, evidence-cited CustomerFact proposals extracted from an intake session. Never written to customer_facts until a staff member confirms -- proposals are not conclusions, and the customer authoring the raw text does not themselves confirm what gets written about them.';
