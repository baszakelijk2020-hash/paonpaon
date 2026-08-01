-- PHASE 11.3 (WFM-105 / WFM-106): coverage planning, shift swaps, versioned
-- service ceremonies and the observation-to-coaching loop.
--
-- Three structural decisions worth stating, because each of them is a
-- non-goal made unbreakable rather than a convention:
--
-- 1. No table here assigns a shift. `public.staff_shifts` (2026-07-21)
--    remains the single truth for who is working when. Coverage plans state
--    a REQUIREMENT and recommendations state a GAP; a manager closes the gap
--    by writing a shift. "No fully autonomous scheduling" is therefore a
--    property of the schema, not of the UI.
-- 2. `staff_coaching_observations` has no per-person aggregate, average or
--    rank column, for the same reason `staff_recognition_acts` has no
--    counter: an average rubric score per advisor is a performance ranking
--    wearing a coaching costume.
-- 3. A published ceremony version is immutable. Editing one in place would
--    retroactively change what every observation citing it means.

-- ---------------------------------------------------------------- coverage

create table if not exists public.coverage_plans (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid references public.retailer_branches (id) on delete cascade,
  plan_date date not null,
  -- IANA zone, carried explicitly. Interval times below are LOCAL
  -- wall-clock; storing instants would shift the roster by an hour twice a
  -- year at a DST boundary.
  timezone text not null check (char_length(timezone) between 3 and 64),
  state text not null default 'draft' check (state in ('draft', 'published')),
  published_at timestamptz,
  published_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint coverage_plans_publish_complete check (
    (state = 'published')
    = (published_at is not null and published_by_staff_id is not null)
  ),
  constraint coverage_plans_unique_day
    unique (retailer_id, branch_id, plan_date)
);

create table if not exists public.coverage_plan_intervals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  plan_id uuid not null
    references public.coverage_plans (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  required_headcount smallint not null check (required_headcount between 0 and 100),
  -- Skills that must be present at least once in the interval. Text keys,
  -- not a foreign key: a retailer's skill vocabulary is theirs, and a
  -- platform-owned enum would force every store into one taxonomy.
  required_skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists coverage_plan_intervals_plan_idx
  on public.coverage_plan_intervals (plan_id, start_time);

create table if not exists public.staff_availability_declarations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  effective_on date not null,
  -- 0 = Sunday, matching PostgreSQL's extract(dow).
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  available boolean not null default true,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_time > start_time)
);

create index if not exists staff_availability_staff_idx
  on public.staff_availability_declarations (staff_id, weekday)
  where deleted_at is null;

create table if not exists public.staff_shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  shift_id uuid not null references public.staff_shifts (id) on delete cascade,
  requesting_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  peer_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  state text not null default 'requested' check (
    state in ('requested', 'accepted_by_peer', 'approved', 'declined', 'withdrawn')
  ),
  approved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  decided_at timestamptz,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- You cannot hand a shift to yourself, which would otherwise be a way to
  -- launder a self-approved roster change.
  constraint staff_shift_swap_not_self check (requesting_staff_id <> peer_staff_id),
  -- Neither party may be the approver. Enforced as a CHECK as well as in the
  -- domain layer, because the domain layer is not what a direct API call hits.
  constraint staff_shift_swap_independent_approver check (
    approved_by_staff_id is null
    or (
      approved_by_staff_id <> requesting_staff_id
      and approved_by_staff_id <> peer_staff_id
    )
  ),
  constraint staff_shift_swap_decision_complete check (
    state in ('requested', 'accepted_by_peer') = (decided_at is null)
  )
);

create index if not exists staff_shift_swap_open_idx
  on public.staff_shift_swap_requests (retailer_id, created_at)
  where state in ('requested', 'accepted_by_peer');

-- ---------------------------------------------------------------- ceremony

create table if not exists public.service_ceremony_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  ceremony_key text not null check (char_length(ceremony_key) between 2 and 64),
  version integer not null check (version >= 1),
  published boolean not null default false,
  published_at timestamptz,
  -- Ordered steps with optional context triggers. Stored as jsonb because
  -- the shape is authored as a whole and versioned as a whole; splitting it
  -- into rows would let a step be edited without bumping the version, which
  -- is exactly what immutability here is meant to prevent.
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_ceremony_versions_unique
    unique (retailer_id, ceremony_key, version),
  constraint service_ceremony_publish_complete check (
    published = (published_at is not null)
  ),
  constraint service_ceremony_steps_is_array check (
    jsonb_typeof(steps) = 'array'
  )
);

create index if not exists service_ceremony_published_idx
  on public.service_ceremony_versions (retailer_id, ceremony_key, version desc)
  where published;

-- ---------------------------------------------------------------- coaching

create table if not exists public.staff_coaching_observations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  observed_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  observer_staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  -- The ceremony version this was observed against. Immutable upstream, so
  -- "what was expected of them that day" stays answerable.
  ceremony_version_id uuid
    references public.service_ceremony_versions (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  observed_on date not null,
  -- [{ criterionKey, score, evidence }]. Evidence is required per score at
  -- the domain layer; a scored criterion with no observed evidence is a
  -- judgement, not an observation.
  scores jsonb not null default '[]'::jsonb,
  state text not null default 'observed' check (
    state in ('observed', 'discussed', 'plan_agreed', 'outcome_recorded')
  ),
  agreed_action text check (
    agreed_action is null or char_length(btrim(agreed_action)) between 1 and 2000
  ),
  outcome_note text check (
    outcome_note is null or char_length(btrim(outcome_note)) between 1 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Self-observation refused in the schema too: RLS can prove the caller is
  -- a manager but not that the subject is someone else.
  constraint staff_coaching_not_self check (observed_staff_id <> observer_staff_id),
  constraint staff_coaching_scores_is_array check (jsonb_typeof(scores) = 'array'),
  -- A plan state must carry the agreed action, and a closed loop must carry
  -- an outcome. Prevents a half-written record looking complete.
  constraint staff_coaching_plan_has_action check (
    state not in ('plan_agreed', 'outcome_recorded') or agreed_action is not null
  ),
  constraint staff_coaching_outcome_has_note check (
    state <> 'outcome_recorded' or outcome_note is not null
  )
);

create index if not exists staff_coaching_open_loop_idx
  on public.staff_coaching_observations (retailer_id, observed_on)
  where state <> 'outcome_recorded' and deleted_at is null;

create index if not exists staff_coaching_subject_idx
  on public.staff_coaching_observations (observed_staff_id, observed_on desc)
  where deleted_at is null;

-- ------------------------------------------------------------- triggers

create trigger set_coverage_plans_updated_at
  before update on public.coverage_plans
  for each row execute function public.set_updated_at();
create trigger set_coverage_plan_intervals_updated_at
  before update on public.coverage_plan_intervals
  for each row execute function public.set_updated_at();
create trigger set_staff_availability_declarations_updated_at
  before update on public.staff_availability_declarations
  for each row execute function public.set_updated_at();
create trigger set_staff_shift_swap_requests_updated_at
  before update on public.staff_shift_swap_requests
  for each row execute function public.set_updated_at();
create trigger set_service_ceremony_versions_updated_at
  before update on public.service_ceremony_versions
  for each row execute function public.set_updated_at();
create trigger set_staff_coaching_observations_updated_at
  before update on public.staff_coaching_observations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS

alter table public.coverage_plans enable row level security;
alter table public.coverage_plan_intervals enable row level security;
alter table public.staff_availability_declarations enable row level security;
alter table public.staff_shift_swap_requests enable row level security;
alter table public.service_ceremony_versions enable row level security;
alter table public.staff_coaching_observations enable row level security;

revoke all on table public.coverage_plans from public, anon;
revoke all on table public.coverage_plan_intervals from public, anon;
revoke all on table public.staff_availability_declarations from public, anon;
revoke all on table public.staff_shift_swap_requests from public, anon;
revoke all on table public.service_ceremony_versions from public, anon;
revoke all on table public.staff_coaching_observations from public, anon;

grant select on table public.coverage_plans to authenticated, service_role;
grant select on table public.coverage_plan_intervals to authenticated, service_role;
grant select on table public.staff_availability_declarations
  to authenticated, service_role;
grant select on table public.staff_shift_swap_requests to authenticated, service_role;
grant select on table public.service_ceremony_versions to authenticated, service_role;
grant select on table public.staff_coaching_observations
  to authenticated, service_role;

grant insert, update on table public.coverage_plans to authenticated, service_role;
grant insert, update, delete on table public.coverage_plan_intervals
  to authenticated, service_role;
grant insert, update on table public.staff_availability_declarations
  to authenticated, service_role;
grant insert, update on table public.staff_shift_swap_requests
  to authenticated, service_role;
grant insert, update on table public.service_ceremony_versions
  to authenticated, service_role;
grant insert, update on table public.staff_coaching_observations
  to authenticated, service_role;

-- Everyone in the retailer can READ the roster requirement and the published
-- ceremony: a coverage plan people cannot see is not a plan, and a ceremony
-- only managers can read cannot be followed on the floor.
create policy coverage_plans_retailer_select
  on public.coverage_plans for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy coverage_plans_manager_write
  on public.coverage_plans for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
create policy coverage_plans_manager_update
  on public.coverage_plans for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy coverage_plan_intervals_retailer_select
  on public.coverage_plan_intervals for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy coverage_plan_intervals_manager_write
  on public.coverage_plan_intervals for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
create policy coverage_plan_intervals_manager_update
  on public.coverage_plan_intervals for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
create policy coverage_plan_intervals_manager_delete
  on public.coverage_plan_intervals for delete to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

-- An employee declares their OWN availability. A manager can read the whole
-- team's (they need it to plan) but cannot forge a declaration in someone
-- else's name — the insert policy pins the author to the calling user, the
-- same shape as recognition's author pin.
create policy staff_availability_retailer_select
  on public.staff_availability_declarations for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy staff_availability_self_insert
  on public.staff_availability_declarations for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
create policy staff_availability_self_update
  on public.staff_availability_declarations for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  )
  with check (retailer_id = public.current_retailer_id());

create policy staff_shift_swap_retailer_select
  on public.staff_shift_swap_requests for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
-- Only the shift's own holder may open a swap.
create policy staff_shift_swap_requester_insert
  on public.staff_shift_swap_requests for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = requesting_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
-- The peer accepts/declines, the requester withdraws, a manager approves.
-- All three are updates; the CHECK constraints above stop the approver
-- being either party regardless of which of them made the call.
create policy staff_shift_swap_party_or_manager_update
  on public.staff_shift_swap_requests for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('owner', 'manager', 'admin')
      or exists (
        select 1 from public.retailer_staff_members m
        where m.id in (requesting_staff_id, peer_staff_id)
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
    )
  )
  with check (retailer_id = public.current_retailer_id());

create policy service_ceremony_retailer_select
  on public.service_ceremony_versions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );
create policy service_ceremony_manager_write
  on public.service_ceremony_versions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
-- Update is allowed only while the version is still a draft. This is the
-- immutability guarantee: once published, the only way forward is a new
-- version row.
create policy service_ceremony_manager_update_draft
  on public.service_ceremony_versions for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
    and published = false
  )
  with check (retailer_id = public.current_retailer_id());

-- A coaching record is NOT team-readable. The subject and managers only —
-- an observation visible to the whole floor is a public performance notice.
create policy staff_coaching_subject_or_manager_select
  on public.staff_coaching_observations for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('owner', 'manager', 'admin')
      or exists (
        select 1 from public.retailer_staff_members m
        where m.id = observed_staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
    )
  );
create policy staff_coaching_manager_insert
  on public.staff_coaching_observations for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = observer_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );
create policy staff_coaching_manager_update
  on public.staff_coaching_observations for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy coverage_plans_platform_select
  on public.coverage_plans for select to authenticated
  using (public.is_platform_staff());
create policy service_ceremony_platform_select
  on public.service_ceremony_versions for select to authenticated
  using (public.is_platform_staff());

comment on table public.coverage_plans is
  'PHASE 11.3 / WFM-105 staffing REQUIREMENT, not an assignment. '
  'public.staff_shifts remains the only truth for who works when.';
comment on table public.staff_coaching_observations is
  'PHASE 11.3 / WFM-106 observation-to-coaching loop. Intentionally has no '
  'average, total or rank column: that would be a performance ranking.';
