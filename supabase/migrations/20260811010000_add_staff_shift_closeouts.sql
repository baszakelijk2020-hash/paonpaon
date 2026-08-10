-- PHASE 11.2 (WFM-104): ten-minute shift closeout captures promises made,
-- customer facts learned, opportunities created, problems requiring management,
-- stock/service anomalies, one thing that worked, an extra-mile act, and
-- help/coaching requested. One structured row per staff member per day.

create table if not exists public.staff_shift_closeouts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null
    references public.retailer_staff_members (id) on delete cascade,
  closeout_date date not null,
  promises_note text not null check (
    char_length(btrim(promises_note)) between 1 and 2000
  ),
  facts_learned_note text check (
    facts_learned_note is null
    or char_length(btrim(facts_learned_note)) between 1 and 2000
  ),
  problems_note text check (
    problems_note is null
    or char_length(btrim(problems_note)) between 1 and 2000
  ),
  anomalies_note text check (
    anomalies_note is null
    or char_length(btrim(anomalies_note)) between 1 and 2000
  ),
  what_worked_note text not null check (
    char_length(btrim(what_worked_note)) between 1 and 2000
  ),
  help_requested_note text check (
    help_requested_note is null
    or char_length(btrim(help_requested_note)) between 1 and 2000
  ),
  extra_mile_act_id uuid
    references public.staff_recognition_acts (id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One closeout per staff member per day; a second submission the same day
  -- must update, not duplicate (upsert on conflict).
  unique (retailer_id, staff_id, closeout_date)
);

create trigger set_staff_shift_closeouts_updated_at
  before update on public.staff_shift_closeouts
  for each row execute function public.set_updated_at();

create index if not exists staff_shift_closeouts_retailer_idx
  on public.staff_shift_closeouts (retailer_id, closeout_date desc);

create index if not exists staff_shift_closeouts_staff_idx
  on public.staff_shift_closeouts (staff_id, closeout_date desc);

alter table public.staff_shift_closeouts enable row level security;

revoke all on table public.staff_shift_closeouts from public, anon;
grant select on table public.staff_shift_closeouts
  to authenticated, service_role;
grant insert, update on table public.staff_shift_closeouts
  to authenticated, service_role;

-- A staff member may read their own closeouts and all closeouts for their
-- retailer (managers need to see the team's closeouts).
create policy staff_shift_closeouts_select
  on public.staff_shift_closeouts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

-- A staff member may insert their own closeout only.
create policy staff_shift_closeouts_insert
  on public.staff_shift_closeouts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );

-- A staff member may update their own closeout; managers may update any
-- closeout in their retailer (though typically only to update a submitted one).
create policy staff_shift_closeouts_update
  on public.staff_shift_closeouts for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
    and (
      -- Your own closeout
      exists (
        select 1 from public.retailer_staff_members m
        where m.id = staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
      -- Or you're a manager
      or public.current_retailer_role() in ('owner', 'manager', 'admin')
    )
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
    and (
      exists (
        select 1 from public.retailer_staff_members m
        where m.id = staff_id
          and m.retailer_id = public.current_retailer_id()
          and m.user_id = (select auth.uid())
          and m.deleted_at is null
      )
      or public.current_retailer_role() in ('owner', 'manager', 'admin')
    )
  );

comment on table public.staff_shift_closeouts is
  'PHASE 11.2 / WFM-104 ten-minute shift closeout. Captures promises, '
  'facts learned, problems, anomalies, what worked, and help requested.';
