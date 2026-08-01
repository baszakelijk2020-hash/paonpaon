-- PHASE 12.1 (FIT-101..103): MeasurementMonitor decision gate.
--
-- The rule this schema exists to make unbreakable: a self-scan can never
-- become a customer's measurement of record on its own.
--
-- `customer_measurement_versions` is append-only and immutable — no UPDATE
-- grant to any session role at all. A correction is a new version, never an
-- edit, because Stage 12.2's production spec pins a measurement version id
-- and editing one in place would retroactively change what a garment was
-- supposedly cut to.
--
-- `measurement_candidates` is where a scan's output actually lands. It
-- carries the quality assessment, the decision (no_action / advisor_review
-- / remeasure) and the version of the decision RULES, so re-running an old
-- scan under new rules is visibly a different decision rather than a silent
-- restatement.
--
-- Note what is deliberately absent: there is no column, state or policy by
-- which a candidate becomes approved without an advisor. The link runs the
-- other way — an approved version may cite the candidate it was reviewed
-- from.

create table if not exists public.customer_measurement_versions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  version integer not null check (version >= 1),
  -- [{ key, millimetres, capturedBy }]. Millimetres are integers: a tenth
  -- of a millimetre is false precision from any capture method here.
  values jsonb not null,
  -- Named human. An approved set with no advisor behind it is the silent
  -- overwrite this item exists to prevent, wearing a signature.
  approved_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  approved_at timestamptz not null default now(),
  -- Required when any value came from a guided self-scan; enforced in the
  -- domain layer, which knows the capture method of each value.
  review_note text check (
    review_note is null or char_length(btrim(review_note)) between 1 and 2000
  ),
  -- The candidate this was reviewed from, when there was one. Nullable:
  -- most versions are simply a tailor with a tape.
  reviewed_candidate_id uuid,
  created_at timestamptz not null default now(),
  constraint customer_measurement_versions_unique
    unique (customer_id, version),
  constraint customer_measurement_values_is_array check (
    jsonb_typeof(values) = 'array' and jsonb_array_length(values) > 0
  )
);

create index if not exists customer_measurement_versions_latest_idx
  on public.customer_measurement_versions (customer_id, version desc);

create table if not exists public.customer_measurement_candidates (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- The scan this was derived from. ON DELETE CASCADE is the deletion
  -- recompute: removing the source capture removes the derived candidate,
  -- while approved versions (a different table, no FK to the scan) survive
  -- because a garment may already have been cut to one.
  self_scan_id uuid references public.wardrobe_self_scans (id) on delete cascade,
  compared_to_version_id uuid
    references public.customer_measurement_versions (id) on delete set null,
  values jsonb not null,
  quality_signals jsonb not null default '{}'::jsonb,
  quality_passed boolean not null,
  decision text not null check (
    decision in ('no_action', 'advisor_review', 'remeasure')
  ),
  decision_version integer not null,
  deltas jsonb not null default '[]'::jsonb,
  rationale text not null check (char_length(rationale) <= 2000),
  -- Set when an advisor has dealt with it, either way. An advisor_review
  -- candidate with no resolution is what blocks the reorder gate.
  resolved_at timestamptz,
  resolved_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint measurement_candidate_values_is_array check (
    jsonb_typeof(values) = 'array'
  ),
  constraint measurement_candidate_resolution_complete check (
    (resolved_at is null) = (resolved_by_staff_id is null)
  ),
  -- A failed-quality candidate must be a remeasure, never a comparison.
  constraint measurement_candidate_quality_decision check (
    quality_passed or decision = 'remeasure'
  )
);

create index if not exists measurement_candidates_open_review_idx
  on public.customer_measurement_candidates (customer_id, created_at)
  where decision = 'advisor_review' and resolved_at is null;

alter table public.customer_measurement_versions
  add constraint customer_measurement_versions_candidate_fk
  foreign key (reviewed_candidate_id)
  references public.customer_measurement_candidates (id) on delete set null;

create trigger set_customer_measurement_candidates_updated_at
  before update on public.customer_measurement_candidates
  for each row execute function public.set_updated_at();

alter table public.customer_measurement_versions enable row level security;
alter table public.customer_measurement_candidates enable row level security;

revoke all on table public.customer_measurement_versions from public, anon;
revoke all on table public.customer_measurement_candidates from public, anon;

grant select on table public.customer_measurement_versions
  to authenticated, service_role;
grant select on table public.customer_measurement_candidates
  to authenticated, service_role;
-- INSERT only. No UPDATE and no DELETE grant to any role, including
-- service_role: this table is append-only, and a correction is a new
-- version. This is the schema-level form of "never silently overwrite
-- approved measurements".
grant insert on table public.customer_measurement_versions
  to authenticated, service_role;
grant insert, update on table public.customer_measurement_candidates
  to authenticated, service_role;

-- Advisors and above see measurements; a read_only role does not. These are
-- body measurements, which is among the more sensitive things this system
-- holds about a person.
create policy customer_measurement_versions_staff_select
  on public.customer_measurement_versions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );
create policy customer_measurement_versions_advisor_insert
  on public.customer_measurement_versions for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
    and exists (
      select 1 from public.retailer_staff_members m
      where m.id = approved_by_staff_id
        and m.retailer_id = public.current_retailer_id()
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  );

-- The customer may read their own measurements and their own candidates.
-- A guided self-scan they performed and cannot see afterwards would be a
-- capture they have no visibility into.
create policy customer_measurement_versions_own_select
  on public.customer_measurement_versions for select to authenticated
  using (
    exists (
      select 1 from public.customer_account_links link
      where link.customer_id = customer_measurement_versions.customer_id
        and link.user_id = (select auth.uid())
    )
  );

create policy customer_measurement_candidates_staff_select
  on public.customer_measurement_candidates for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );
create policy customer_measurement_candidates_own_select
  on public.customer_measurement_candidates for select to authenticated
  using (
    exists (
      select 1 from public.customer_account_links link
      where link.customer_id = customer_measurement_candidates.customer_id
        and link.user_id = (select auth.uid())
    )
  );
create policy customer_measurement_candidates_staff_insert
  on public.customer_measurement_candidates for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );
create policy customer_measurement_candidates_advisor_resolve
  on public.customer_measurement_candidates for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.customer_measurement_versions is
  'PHASE 12.1 / FIT-101 append-only approved measurements. No UPDATE or '
  'DELETE grant exists on purpose: a correction is a new version, because '
  'Stage 12.2 production specs pin a version id.';
comment on table public.customer_measurement_candidates is
  'PHASE 12.1 self-scan output. Never a measurement of record. There is no '
  'path from candidate to approved that does not pass through an advisor.';
