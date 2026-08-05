-- FT-01 reviewed FitProfile candidate/version — the distinct reviewed
-- candidate concept the blueprint names as not yet built (docs/
-- FOUNDER_TOOL_BLUEPRINTS.md). A fitting_observations row (or batch from
-- same session) is proposed by staff as a candidate fit revision — advisor
-- reviews it against the previous approved fit and either approves (writes
-- new customer_fit_profile_entries) or rejects. Each candidate tracks
-- which observations contributed to it and records the advisor's decision.
-- Corrections append rather than erase: an already-submitted observation
-- can be corrected by inserting a new row that references the one it
-- supersedes (nullable supersedes_observation_id self-reference column).
-- Network loss preserves an encrypted local draft and idempotency key;
-- duplicate submit cannot duplicate candidates/work via on conflict
-- (idempotency_key) do nothing.

-- First, add the nullable supersedes_observation_id column to
-- fitting_observations for the corrections-append pattern.
alter table public.fitting_observations
add column supersedes_observation_id uuid references public.fitting_observations (id) on delete set null;

-- The proposed fit profile candidate from staff review.
create table public.fit_profile_candidates (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  fitting_session_id uuid references public.fitting_sessions (id) on delete set null,
  status text not null default 'proposed' check (
    status in ('proposed', 'advisor_approved', 'advisor_rejected', 'customer_confirmed')
  ),
  proposed_measurements jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fit_profile_candidates_customer_idx
  on public.fit_profile_candidates (customer_id, created_at desc);
create index fit_profile_candidates_retailer_status_idx
  on public.fit_profile_candidates (retailer_id, status);
create trigger set_fit_profile_candidates_updated_at
  before update on public.fit_profile_candidates
  for each row execute function public.set_updated_at();

-- Link fit_profile_candidates to the fitting_observations that
-- contributed to them.
create table public.fit_profile_candidate_observations (
  fit_profile_candidate_id uuid not null references public.fit_profile_candidates (id) on delete cascade,
  fitting_observation_id uuid not null references public.fitting_observations (id) on delete restrict,
  primary key (fit_profile_candidate_id, fitting_observation_id)
);
create index fit_profile_candidate_observations_observation_idx
  on public.fit_profile_candidate_observations (fitting_observation_id);

-- Track advisor decisions on candidates.
create table public.fit_profile_candidate_actions (
  id uuid primary key default gen_random_uuid(),
  fit_profile_candidate_id uuid not null references public.fit_profile_candidates (id) on delete cascade,
  action_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  action text not null check (action in ('approved', 'rejected')),
  note text check (note is null or char_length(btrim(note)) <= 1000),
  created_at timestamptz not null default now()
);
create index fit_profile_candidate_actions_candidate_idx
  on public.fit_profile_candidate_actions (fit_profile_candidate_id);

alter table public.fit_profile_candidates enable row level security;
alter table public.fit_profile_candidate_observations enable row level security;
alter table public.fit_profile_candidate_actions enable row level security;

-- RLS policies: customers read their own candidates, staff read their
-- retailer's candidates.
create policy "platform reads all fit profile candidates"
  on public.fit_profile_candidates for select
  using (public.is_platform_staff());

create policy "a customer reads their own fit profile candidates"
  on public.fit_profile_candidates for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = fit_profile_candidates.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "retailer staff read their retailer's fit profile candidates"
  on public.fit_profile_candidates for select
  using (retailer_id = public.current_retailer_id());

create policy "platform reads all candidate observations"
  on public.fit_profile_candidate_observations for select
  using (public.is_platform_staff());

create policy "a customer reads candidate observations for their candidates"
  on public.fit_profile_candidate_observations for select
  using (
    exists (
      select 1 from public.fit_profile_candidates fc
      join public.customers c on c.id = fc.customer_id
      where fc.id = fit_profile_candidate_observations.fit_profile_candidate_id
        and c.user_id = auth.uid()
    )
  );

create policy "retailer staff read candidate observations for their retailer"
  on public.fit_profile_candidate_observations for select
  using (
    exists (
      select 1 from public.fit_profile_candidates fc
      where fc.id = fit_profile_candidate_observations.fit_profile_candidate_id
        and fc.retailer_id = public.current_retailer_id()
    )
  );

create policy "platform reads all candidate actions"
  on public.fit_profile_candidate_actions for select
  using (public.is_platform_staff());

create policy "a customer reads actions on their own candidates"
  on public.fit_profile_candidate_actions for select
  using (
    exists (
      select 1 from public.fit_profile_candidates fc
      join public.customers c on c.id = fc.customer_id
      where fc.id = fit_profile_candidate_actions.fit_profile_candidate_id
        and c.user_id = auth.uid()
    )
  );

create policy "retailer staff read actions for their retailer"
  on public.fit_profile_candidate_actions for select
  using (
    exists (
      select 1 from public.fit_profile_candidates fc
      where fc.id = fit_profile_candidate_actions.fit_profile_candidate_id
        and fc.retailer_id = public.current_retailer_id()
    )
  );

-- Writes only through RPCs below.
grant select, insert, update, delete on public.fit_profile_candidates
  to authenticated, service_role;
grant select, insert on public.fit_profile_candidate_observations
  to authenticated, service_role;
grant select, insert on public.fit_profile_candidate_actions
  to authenticated, service_role;

-- Staff proposes a fit profile candidate from one or more observations,
-- with idempotency key to prevent duplicate-submit. Self-derives caller
-- identity and validates observations belong to same garment and retailer.
create or replace function public.propose_fit_profile_candidate(
  p_observation_ids uuid[],
  p_proposed_measurements jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_observation public.fitting_observations%rowtype;
  v_candidate_id uuid;
  v_observation_id uuid;
  v_staff_id uuid;
  v_existing_candidate_id uuid;
begin
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to propose fit profile candidates';
  end if;
  if array_length(p_observation_ids, 1) < 1 then
    raise exception 'At least one observation is required';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key is required';
  end if;

  -- Idempotency: check if this key already resulted in a candidate.
  select id into v_existing_candidate_id from public.fit_profile_candidates
    where idempotency_key = p_idempotency_key
    limit 1;
  if v_existing_candidate_id is not null then
    return v_existing_candidate_id;
  end if;

  -- Validate first observation exists and belongs to this retailer.
  select * into v_first_observation from public.fitting_observations
    where id = p_observation_ids[1];
  if not found then
    raise exception 'First observation not found';
  end if;
  if v_first_observation.retailer_id <> public.current_retailer_id() then
    raise exception 'Not authorized to access this observation';
  end if;

  -- Validate all observations: same physical garment, same retailer.
  foreach v_observation_id in array p_observation_ids loop
    perform public.fitting_observations
      where id = v_observation_id
        and physical_garment_id = v_first_observation.physical_garment_id
        and retailer_id = public.current_retailer_id();
    if not found then
      raise exception 'Observation does not match garment or retailer';
    end if;
  end loop;

  v_staff_id := public.current_staff_id();

  -- Create the candidate.
  insert into public.fit_profile_candidates (
    retailer_id, customer_id, fitting_session_id, status,
    proposed_measurements, idempotency_key
  ) values (
    v_first_observation.retailer_id, v_first_observation.physical_garment_id::uuid,
    v_first_observation.fitting_session_id, 'proposed',
    coalesce(p_proposed_measurements, '{}'::jsonb), p_idempotency_key
  ) returning id into v_candidate_id;

  -- Link observations to candidate.
  foreach v_observation_id in array p_observation_ids loop
    insert into public.fit_profile_candidate_observations (
      fit_profile_candidate_id, fitting_observation_id
    ) values (v_candidate_id, v_observation_id);
  end loop;

  return v_candidate_id;
end;
$$;

-- Advisor approves a candidate and creates a new customer_fit_profile_entries
-- row, advancing the candidate to 'advisor_approved' status.
create or replace function public.approve_fit_profile_candidate(
  p_candidate_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.fit_profile_candidates%rowtype;
  v_staff_id uuid;
begin
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to review fit profile candidates';
  end if;

  select * into v_candidate from public.fit_profile_candidates
    where id = p_candidate_id and retailer_id = public.current_retailer_id();
  if not found then
    raise exception 'Candidate not found';
  end if;
  if v_candidate.status <> 'proposed' then
    raise exception 'Candidate is not awaiting review';
  end if;

  v_staff_id := public.current_staff_id();

  -- Record the approval action.
  insert into public.fit_profile_candidate_actions (
    fit_profile_candidate_id, action_by_staff_id, action, note
  ) values (
    p_candidate_id, v_staff_id, 'approved', p_note
  );

  -- Create new fit profile entry from proposed measurements.
  insert into public.customer_fit_profile_entries (
    customer_id, retailer_id, measurements, recorded_by_staff_id, recorded_at
  ) values (
    v_candidate.customer_id, v_candidate.retailer_id,
    v_candidate.proposed_measurements, v_staff_id, now()
  );

  -- Advance candidate to advisor_approved.
  update public.fit_profile_candidates
    set status = 'advisor_approved'
    where id = p_candidate_id;
end;
$$;

-- Advisor rejects a candidate.
create or replace function public.reject_fit_profile_candidate(
  p_candidate_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.fit_profile_candidates%rowtype;
  v_staff_id uuid;
begin
  if not public.is_alterations_advisor() then
    raise exception 'Not authorized to review fit profile candidates';
  end if;

  select * into v_candidate from public.fit_profile_candidates
    where id = p_candidate_id and retailer_id = public.current_retailer_id();
  if not found then
    raise exception 'Candidate not found';
  end if;
  if v_candidate.status <> 'proposed' then
    raise exception 'Candidate is not awaiting review';
  end if;

  v_staff_id := public.current_staff_id();

  -- Record the rejection action.
  insert into public.fit_profile_candidate_actions (
    fit_profile_candidate_id, action_by_staff_id, action, note
  ) values (
    p_candidate_id, v_staff_id, 'rejected', p_note
  );

  -- Mark as rejected.
  update public.fit_profile_candidates
    set status = 'advisor_rejected'
    where id = p_candidate_id;
end;
$$;

-- Customer confirms a candidate after advisor approval.
create or replace function public.confirm_fit_profile_candidate(
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.fit_profile_candidates%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select fc.* into v_candidate from public.fit_profile_candidates fc
    join public.customers c on c.id = fc.customer_id
    where fc.id = p_candidate_id and c.user_id = auth.uid();
  if not found then
    raise exception 'Candidate not found';
  end if;
  if v_candidate.status <> 'advisor_approved' then
    raise exception 'Candidate is not awaiting customer confirmation';
  end if;

  update public.fit_profile_candidates
    set status = 'customer_confirmed'
    where id = p_candidate_id;
end;
$$;

revoke all on function public.propose_fit_profile_candidate(uuid[], jsonb, text) from public;
revoke all on function public.approve_fit_profile_candidate(uuid, text) from public;
revoke all on function public.reject_fit_profile_candidate(uuid, text) from public;
revoke all on function public.confirm_fit_profile_candidate(uuid) from public;

grant execute on function public.propose_fit_profile_candidate(uuid[], jsonb, text)
  to authenticated, service_role;
grant execute on function public.approve_fit_profile_candidate(uuid, text)
  to authenticated, service_role;
grant execute on function public.reject_fit_profile_candidate(uuid, text)
  to authenticated, service_role;
grant execute on function public.confirm_fit_profile_candidate(uuid)
  to authenticated, service_role;

comment on table public.fit_profile_candidates is
  'FT-01 reviewed FitProfile candidate/version. States: proposed, '
  'advisor_approved, advisor_rejected, customer_confirmed. Writes only '
  'through RPCs in this migration.';
comment on column public.fit_profile_candidates.idempotency_key is
  'Client-generated key for duplicate-submit prevention. Must be unique.';
comment on column public.fitting_observations.supersedes_observation_id is
  'For corrections-append pattern: if this observation supersedes an earlier one, '
  'points to the prior observation. Corrections never erase; they append.';
