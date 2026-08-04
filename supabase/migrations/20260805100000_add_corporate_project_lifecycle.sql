-- PHASE 18.7 (BD-107): the corporate project/rollout lifecycle state
-- machine — opportunity -> tender -> award -> design approval -> sample
-- approval -> material approval -> employee import -> fitting ->
-- production -> qc -> distribution -> launch -> renewal.
--
-- One project row per opportunity. `stage` is constrained to the exact
-- named chain so a project can never sit in an undefined state between
-- two named steps, and `corporate_project_events` is an append-only
-- audit trail of every transition (who, when, optional note) so a
-- "who moved this and why" question always has a real answer.

create table if not exists public.corporate_projects (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  opportunity_id uuid not null unique
    references public.corporate_opportunities (id) on delete cascade,
  account_id uuid references public.corporate_accounts (id) on delete set null,
  stage text not null default 'opportunity' check (
    stage in (
      'opportunity', 'tender', 'award', 'design_approval',
      'sample_approval', 'material_approval', 'employee_import',
      'fitting', 'production', 'qc', 'distribution', 'launch', 'renewal'
    )
  ),
  stage_entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_projects_retailer_stage_idx
  on public.corporate_projects (retailer_id, stage);

create table if not exists public.corporate_project_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  project_id uuid not null
    references public.corporate_projects (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists corporate_project_events_project_idx
  on public.corporate_project_events (project_id, created_at desc);

create trigger set_corporate_projects_updated_at
  before update on public.corporate_projects
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_projects', 'corporate_project_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

grant insert, update on table public.corporate_projects
  to authenticated, service_role;
-- Events are append-only: a transition history that can be edited is not
-- an audit trail.
grant insert on table public.corporate_project_events
  to authenticated, service_role;

create policy corporate_projects_staff_update
  on public.corporate_projects for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.corporate_projects is
  'PHASE 18.7 / BD-107. One row per opportunity, tracking the full '
  'opportunity-to-renewal lifecycle. stage is constrained to the named '
  'chain so a project can never be in an undefined state.';
comment on table public.corporate_project_events is
  'PHASE 18.7 / BD-107. Append-only transition audit trail: from_stage, '
  'to_stage, optional note, and the staff member who advanced it (null '
  'for an automatic transition triggered by another item, e.g. tender '
  'creation or opportunity win).';
