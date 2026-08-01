-- PHASE 11.2 (WFM-104): employee-logged extra-mile acts with manager
-- acknowledgement/coaching. Deliberately has NO counter, score, rank or
-- points column — this item's non-goal is explicit that there is no
-- raw-volume leaderboard, and the surest way to honour that is for the
-- schema to make one impossible to render without adding a column first.
-- A "recognition" here is a specific narrated act tied to real evidence,
-- not a tally.

create table if not exists public.staff_recognition_acts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  -- The employee the act is ABOUT (usually the author, but a manager or a
  -- peer may also log an act on someone else's behalf).
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  authored_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  -- What actually happened, in words. No enum: the point is a specific
  -- narrated act, and an enum would collapse it back into a countable
  -- category.
  narrative text not null check (
    char_length(btrim(narrative)) between 10 and 2000
  ),
  -- Optional links to the real records the act happened on, so a
  -- recognition is auditable rather than a self-reported claim. All
  -- nullable: an act may be operational and touch none of them.
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  occurred_on date not null,
  -- Manager response. review_state drives the whole surface; a coaching
  -- note is optional and separate from a plain acknowledgement, because
  -- "seen and appreciated" and "here is how to do it better" are
  -- different acts and conflating them makes coaching feel punitive.
  review_state text not null default 'submitted' check (
    review_state in ('submitted', 'acknowledged', 'coached', 'dismissed')
  ),
  reviewed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  reviewed_at timestamptz,
  coaching_note text check (
    coaching_note is null
    or char_length(btrim(coaching_note)) between 1 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- A reviewed act must name its reviewer and when; an unreviewed one must
  -- name neither. Prevents a half-written review looking complete.
  constraint staff_recognition_acts_review_complete check (
    (review_state = 'submitted')
    = (reviewed_by_staff_id is null and reviewed_at is null)
  ),
  -- Coaching requires an actual note — a 'coached' state with no guidance
  -- in it is exactly the empty gesture this surface should not produce.
  constraint staff_recognition_acts_coaching_needs_note check (
    review_state <> 'coached' or coaching_note is not null
  )
);

create trigger set_staff_recognition_acts_updated_at
  before update on public.staff_recognition_acts
  for each row execute function public.set_updated_at();

create index if not exists staff_recognition_acts_retailer_idx
  on public.staff_recognition_acts (retailer_id, occurred_on desc)
  where deleted_at is null;

create index if not exists staff_recognition_acts_staff_idx
  on public.staff_recognition_acts (staff_id, occurred_on desc)
  where deleted_at is null;

-- Manager review queue: unreviewed acts, oldest first.
create index if not exists staff_recognition_acts_review_queue_idx
  on public.staff_recognition_acts (retailer_id, created_at)
  where review_state = 'submitted' and deleted_at is null;

alter table public.staff_recognition_acts enable row level security;

revoke all on table public.staff_recognition_acts from public, anon;
grant select on table public.staff_recognition_acts
  to authenticated, service_role;
grant insert, update on table public.staff_recognition_acts
  to authenticated, service_role;

-- Every retailer staff role may READ their own retailer's acts: recognition
-- that only managers can see is not recognition. Deliberately broader than
-- clienteling_opportunities' owner/manager/sales_associate read scope,
-- because this table holds no customer-sensitive content of its own beyond
-- the optional links (each of which is separately protected on its own
-- table).
create policy staff_recognition_acts_retailer_select
  on public.staff_recognition_acts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy staff_recognition_acts_platform_select
  on public.staff_recognition_acts for select to authenticated
  using (public.is_platform_staff());

-- Any staff member may log an act, but only as its stated author — this is
-- what stops one employee attributing a fabricated act to a colleague, or
-- to themselves under someone else's name.
create policy staff_recognition_acts_author_insert
  on public.staff_recognition_acts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = authored_by_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );

-- Only a manager/admin/owner may review. Enforced here rather than only in
-- a Server Action so a direct API call cannot self-acknowledge.
create policy staff_recognition_acts_manager_review
  on public.staff_recognition_acts for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

comment on table public.staff_recognition_acts is
  'PHASE 11.2 / WFM-104 extra-mile acts. Intentionally has no count, score '
  'or rank column: this item forbids a raw-volume leaderboard.';
