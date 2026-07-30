-- PHASE 8.3 / INT-005 / WFM-103: versioned workflow definitions + familiarity presets.

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (
    key in ('alteration_work_order', 'appointment')
  ),
  subject_type text not null check (
    subject_type in ('alteration', 'appointment')
  ),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workflow_definitions enable row level security;
revoke all on table public.workflow_definitions from public, anon;
grant select on table public.workflow_definitions
  to authenticated, service_role;
grant insert, update on table public.workflow_definitions
  to service_role;

create policy workflow_definitions_authenticated_select
  on public.workflow_definitions for select to authenticated
  using (true);

create table if not exists public.workflow_definition_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null
    references public.workflow_definitions (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft', 'active', 'retired')),
  snapshot jsonb not null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, version_number)
);

create unique index if not exists workflow_definition_versions_one_active
  on public.workflow_definition_versions (definition_id)
  where status = 'active';

alter table public.workflow_definition_versions enable row level security;
revoke all on table public.workflow_definition_versions from public, anon;
grant select on table public.workflow_definition_versions
  to authenticated, service_role;
grant insert, update on table public.workflow_definition_versions
  to service_role;

create policy workflow_definition_versions_authenticated_select
  on public.workflow_definition_versions for select to authenticated
  using (true);

-- Snapshots are immutable after insert; only status/activated_at/updated_at may change.
create or replace function public.enforce_workflow_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.snapshot is distinct from old.snapshot then
      raise exception 'Workflow definition version snapshot is immutable';
    end if;
    if new.definition_id is distinct from old.definition_id then
      raise exception 'Workflow definition version definition_id is immutable';
    end if;
    if new.version_number is distinct from old.version_number then
      raise exception 'Workflow definition version number is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_definition_versions_immutable_trg
  on public.workflow_definition_versions;
create trigger workflow_definition_versions_immutable_trg
  before update on public.workflow_definition_versions
  for each row execute function public.enforce_workflow_version_immutability();

create table if not exists public.workflow_instance_bindings (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  subject_type text not null check (
    subject_type in ('alteration', 'appointment')
  ),
  subject_id uuid not null,
  definition_version_id uuid not null
    references public.workflow_definition_versions (id),
  pinned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_type, subject_id)
);

create index if not exists workflow_instance_bindings_retailer_idx
  on public.workflow_instance_bindings (retailer_id);

alter table public.workflow_instance_bindings enable row level security;
revoke all on table public.workflow_instance_bindings from public, anon;
grant select on table public.workflow_instance_bindings
  to authenticated, service_role;
grant insert, update on table public.workflow_instance_bindings
  to service_role;

create policy workflow_instance_bindings_retailer_select
  on public.workflow_instance_bindings for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'admin', 'production_staff',
      'sales_associate', 'workshop_manager', 'worker'
    )
  );

create policy workflow_instance_bindings_platform_select
  on public.workflow_instance_bindings for select to authenticated
  using (public.is_platform_staff());

create table if not exists public.familiarity_presets (
  key text primary key check (
    key in ('paon_recommended', 'atelier_tailoring')
  ),
  display_name text not null,
  terminology jsonb not null,
  navigation jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.familiarity_presets enable row level security;
revoke all on table public.familiarity_presets from public, anon;
grant select on table public.familiarity_presets
  to authenticated, service_role;
grant insert, update on table public.familiarity_presets
  to service_role;

create policy familiarity_presets_authenticated_select
  on public.familiarity_presets for select to authenticated
  using (true);

create table if not exists public.retailer_familiarity_settings (
  retailer_id uuid primary key
    references public.retailers (id) on delete cascade,
  preset_key text not null
    references public.familiarity_presets (key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.retailer_familiarity_settings enable row level security;
revoke all on table public.retailer_familiarity_settings from public, anon;
grant select on table public.retailer_familiarity_settings
  to authenticated, service_role;
grant insert, update on table public.retailer_familiarity_settings
  to authenticated, service_role;

create policy retailer_familiarity_settings_retailer_select
  on public.retailer_familiarity_settings for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy retailer_familiarity_settings_retailer_write
  on public.retailer_familiarity_settings for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy retailer_familiarity_settings_retailer_update
  on public.retailer_familiarity_settings for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy retailer_familiarity_settings_platform_select
  on public.retailer_familiarity_settings for select to authenticated
  using (public.is_platform_staff());

-- Platform catalogue seeds (presentation only for presets).
insert into public.workflow_definitions (key, subject_type, display_name)
values
  ('alteration_work_order', 'alteration', 'Alteration work order'),
  ('appointment', 'appointment', 'Appointment')
on conflict (key) do nothing;

insert into public.familiarity_presets (key, display_name, terminology, navigation)
values
  (
    'paon_recommended',
    'PAON recommended',
    '{"labels":{"intake":"Intake","quoted":"Quoted","awaiting_approval":"Awaiting approval","approved":"Approved","assigned":"Assigned","in_progress":"In progress","completion_review":"Completion review","ready_for_pickup":"Ready for collection","out_for_delivery":"Out for delivery","completed":"Completed","canceled":"Cancelled","nav_alterations":"Alterations","nav_alterations_group":"Fitting room"}}'::jsonb,
    '{"labelsByHref":{"/alterations":"Alterations","/alterations/catalogue":"Service catalogue","/alterations/workshops":"Workshop network"},"groupLabels":{"fitting_room":"Fitting room"},"defaultLandingHref":"/dashboard"}'::jsonb
  ),
  (
    'atelier_tailoring',
    'Atelier tailoring',
    '{"labels":{"intake":"Received","quoted":"Estimate ready","awaiting_approval":"Client review","approved":"Greenlit","assigned":"On the board","in_progress":"On the horse","completion_review":"Final check","ready_for_pickup":"Ready for client","out_for_delivery":"With courier","completed":"Delivered","canceled":"Withdrawn","nav_alterations":"Work orders","nav_alterations_group":"Atelier floor"}}'::jsonb,
    '{"labelsByHref":{"/alterations":"Work orders","/alterations/catalogue":"Price list","/alterations/workshops":"Partner ateliers"},"groupLabels":{"fitting_room":"Atelier floor"},"defaultLandingHref":"/dashboard"}'::jsonb
  )
on conflict (key) do nothing;

comment on table public.workflow_definitions is
  'Canonical workflow keys (PHASE 8.3 / WFM-103 kernel).';
comment on table public.workflow_definition_versions is
  'Immutable versioned snapshots; active instances pin a version id.';
comment on table public.workflow_instance_bindings is
  'Pins a subject to a definition version so later publishes do not mutate it.';
comment on table public.familiarity_presets is
  'Terminology/navigation overlays only (PHASE 8.3 / INT-005).';
comment on table public.retailer_familiarity_settings is
  'Per-retailer active familiarity preset key.';
