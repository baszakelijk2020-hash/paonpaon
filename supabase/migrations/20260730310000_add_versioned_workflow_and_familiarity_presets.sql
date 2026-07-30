-- PHASE 8.3: versioned workflow definitions/instances and retailer familiarity presets.
-- One exercised appointment flow; definition edits create new versions only.

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  key text not null,
  display_name text not null,
  active_version integer not null check (active_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_definitions_scope_chk check (
    retailer_id is null or retailer_id is not null
  )
);

create unique index if not exists workflow_definitions_platform_key_uidx
  on public.workflow_definitions (key)
  where retailer_id is null;

create unique index if not exists workflow_definitions_retailer_key_uidx
  on public.workflow_definitions (retailer_id, key)
  where retailer_id is not null;

create table if not exists public.workflow_definition_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.workflow_definitions (id) on delete cascade,
  retailer_id uuid references public.retailers (id) on delete cascade,
  key text not null,
  version integer not null check (version >= 1),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_definition_versions_unique unique (definition_id, version)
);

create index if not exists workflow_definition_versions_key_idx
  on public.workflow_definition_versions (key, version);

create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  definition_version_id uuid not null
    references public.workflow_definition_versions (id),
  subject_type text not null,
  subject_id uuid not null,
  current_state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_instances_subject_unique unique (retailer_id, subject_type, subject_id)
);

create index if not exists workflow_instances_retailer_subject_idx
  on public.workflow_instances (retailer_id, subject_type, subject_id);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  instance_id uuid not null references public.workflow_instances (id) on delete cascade,
  from_state text not null,
  to_state text not null,
  actor_staff_id uuid references public.retailer_staff_members (id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists workflow_events_instance_idx
  on public.workflow_events (instance_id, created_at desc);

create table if not exists public.retailer_familiarity_presets (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  preset_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_familiarity_presets_key_chk check (
    preset_key in ('paon_recommended', 'atelier_tailoring', 'endear_clienteling')
  )
);

alter table public.workflow_definitions enable row level security;
alter table public.workflow_definition_versions enable row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_events enable row level security;
alter table public.retailer_familiarity_presets enable row level security;

revoke all on table public.workflow_definitions from public, anon;
revoke all on table public.workflow_definition_versions from public, anon;
revoke all on table public.workflow_instances from public, anon;
revoke all on table public.workflow_events from public, anon;
revoke all on table public.retailer_familiarity_presets from public, anon;

grant select on table public.workflow_definitions to authenticated;
grant select on table public.workflow_definition_versions to authenticated;
grant select on table public.workflow_instances to authenticated;
grant select on table public.workflow_events to authenticated;
grant select on table public.retailer_familiarity_presets to authenticated;
grant insert, update on table public.retailer_familiarity_presets to authenticated;

create policy workflow_definitions_platform_select
  on public.workflow_definitions for select to authenticated
  using (retailer_id is null or public.is_platform_staff());

create policy workflow_definitions_retailer_select
  on public.workflow_definitions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy workflow_definition_versions_platform_select
  on public.workflow_definition_versions for select to authenticated
  using (retailer_id is null or public.is_platform_staff());

create policy workflow_definition_versions_retailer_select
  on public.workflow_definition_versions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy workflow_instances_retailer_select
  on public.workflow_instances for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy workflow_events_retailer_select
  on public.workflow_events for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy retailer_familiarity_presets_retailer_select
  on public.retailer_familiarity_presets for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy retailer_familiarity_presets_retailer_write
  on public.retailer_familiarity_presets for all to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create or replace function public.enforce_workflow_definition_version_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.retailer_id is not null
    and not exists (
      select 1
      from public.workflow_definitions d
      where d.id = new.definition_id
        and d.retailer_id = new.retailer_id
    ) then
    raise exception 'Workflow definition version does not belong to the retailer';
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_definition_versions_tenant_trg
  on public.workflow_definition_versions;
create trigger workflow_definition_versions_tenant_trg
  before insert or update on public.workflow_definition_versions
  for each row execute function public.enforce_workflow_definition_version_tenant();

create or replace function public.enforce_workflow_instance_tenant()
returns trigger
language plpgsql
as $$
declare
  version_retailer uuid;
begin
  select v.retailer_id into version_retailer
  from public.workflow_definition_versions v
  where v.id = new.definition_version_id;

  if version_retailer is not null and version_retailer <> new.retailer_id then
    raise exception 'Workflow instance definition version does not belong to the retailer';
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_instances_tenant_trg on public.workflow_instances;
create trigger workflow_instances_tenant_trg
  before insert or update on public.workflow_instances
  for each row execute function public.enforce_workflow_instance_tenant();

-- Seed platform appointment workflow v1 + v2 (active version 2 for new instances).
insert into public.workflow_definitions (retailer_id, key, display_name, active_version)
values (null, 'appointment', 'Appointment lifecycle', 2)
on conflict do nothing;

do $$
declare
  definition_id uuid;
begin
  select id into definition_id
  from public.workflow_definitions
  where retailer_id is null and key = 'appointment';

  if definition_id is null then
    return;
  end if;

  insert into public.workflow_definition_versions (
    definition_id, retailer_id, key, version, snapshot
  )
  values
    (
      definition_id,
      null,
      'appointment',
      1,
      '{
        "key": "appointment",
        "version": 1,
        "states": ["requested","confirmed","checked_in","completed","canceled","no_show"],
        "transitions": [
          {"from":"requested","to":"confirmed","requiredFields":["staffId"]},
          {"from":"requested","to":"canceled"},
          {"from":"confirmed","to":"checked_in"},
          {"from":"confirmed","to":"no_show","allowedRoles":["owner","admin","manager"]},
          {"from":"confirmed","to":"canceled"},
          {"from":"checked_in","to":"completed"},
          {"from":"checked_in","to":"canceled"}
        ]
      }'::jsonb
    ),
    (
      definition_id,
      null,
      'appointment',
      2,
      '{
        "key": "appointment",
        "version": 2,
        "states": ["requested","confirmed","checked_in","completed","canceled","no_show"],
        "transitions": [
          {"from":"requested","to":"confirmed","requiredFields":["staffId","branchId"]},
          {"from":"requested","to":"canceled"},
          {"from":"confirmed","to":"checked_in"},
          {"from":"confirmed","to":"no_show","allowedRoles":["owner","admin","manager"]},
          {"from":"confirmed","to":"canceled"},
          {"from":"checked_in","to":"completed"},
          {"from":"checked_in","to":"canceled"}
        ]
      }'::jsonb
    )
  on conflict do nothing;
end;
$$;

create or replace function public.ensure_appointment_workflow_instance(
  p_appointment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  instance_id uuid;
  version_id uuid;
begin
  select * into appointment_row
  from public.appointments
  where id = p_appointment_id and deleted_at is null;

  if appointment_row.id is null then
    raise exception 'Appointment not found';
  end if;

  select i.id into instance_id
  from public.workflow_instances i
  where i.retailer_id = appointment_row.retailer_id
    and i.subject_type = 'appointment'
    and i.subject_id = p_appointment_id;

  if instance_id is not null then
    return instance_id;
  end if;

  select v.id into version_id
  from public.workflow_definition_versions v
  join public.workflow_definitions d on d.id = v.definition_id
  where d.retailer_id is null
    and d.key = 'appointment'
    and v.version = 1;

  if version_id is null then
    raise exception 'Appointment workflow version 1 is not configured';
  end if;

  insert into public.workflow_instances (
    retailer_id,
    definition_version_id,
    subject_type,
    subject_id,
    current_state
  )
  values (
    appointment_row.retailer_id,
    version_id,
    'appointment',
    p_appointment_id,
    appointment_row.status::text
  )
  returning id into instance_id;

  return instance_id;
end;
$$;

revoke all on function public.ensure_appointment_workflow_instance(uuid) from public;
grant execute on function public.ensure_appointment_workflow_instance(uuid)
  to authenticated, service_role;

create or replace function public.transition_appointment_workflow(
  p_appointment_id uuid,
  p_to_state text,
  p_staff_id uuid default null,
  p_branch_id uuid default null,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_row public.appointments%rowtype;
  instance_row public.workflow_instances%rowtype;
  version_row public.workflow_definition_versions%rowtype;
  snapshot jsonb;
  transitions jsonb;
  transition jsonb;
  from_state text;
  role_name text;
  required_field text;
  allowed boolean := false;
begin
  if auth.role() <> 'service_role'
    and public.current_staff_id() is null then
    raise exception 'Unauthorized workflow transition';
  end if;

  select * into appointment_row
  from public.appointments
  where id = p_appointment_id and deleted_at is null
  for update;

  if appointment_row.id is null then
    raise exception 'Appointment not found';
  end if;

  if auth.role() <> 'service_role'
    and appointment_row.retailer_id <> public.current_retailer_id() then
    raise exception 'Appointment does not belong to the current retailer';
  end if;

  perform public.ensure_appointment_workflow_instance(p_appointment_id);

  select * into instance_row
  from public.workflow_instances
  where retailer_id = appointment_row.retailer_id
    and subject_type = 'appointment'
    and subject_id = p_appointment_id
  for update;

  select * into version_row
  from public.workflow_definition_versions
  where id = instance_row.definition_version_id;

  snapshot := version_row.snapshot;
  from_state := instance_row.current_state;

  if p_to_state = from_state then
    return appointment_row;
  end if;

  if not (snapshot->'states') ? from_state
    or not (snapshot->'states') ? p_to_state then
    raise exception 'Unknown workflow state';
  end if;

  role_name := coalesce(public.current_retailer_role()::text, 'manager');

  for transition in
    select value
    from jsonb_array_elements(snapshot->'transitions') value
    where value->>'from' = from_state and value->>'to' = p_to_state
  loop
    allowed := true;

    if transition ? 'allowedRoles'
      and not (transition->'allowedRoles') ? role_name then
      raise exception 'Your role cannot perform this transition';
    end if;

    if transition ? 'requiredFields' then
      for required_field in
        select jsonb_array_elements_text(transition->'requiredFields')
      loop
        if required_field = 'staffId'
          and coalesce(p_staff_id, appointment_row.staff_id) is null then
          raise exception 'Assign an advisor before confirming';
        end if;
        if required_field = 'branchId'
          and coalesce(p_branch_id, appointment_row.branch_id) is null then
          raise exception 'Select a branch before completing this step';
        end if;
      end loop;
    end if;
  end loop;

  if not allowed then
    raise exception 'Cannot move from % to %', from_state, p_to_state;
  end if;

  update public.workflow_instances
  set current_state = p_to_state, updated_at = now()
  where id = instance_row.id;

  insert into public.workflow_events (
    retailer_id,
    instance_id,
    from_state,
    to_state,
    actor_staff_id,
    reason
  )
  values (
    appointment_row.retailer_id,
    instance_row.id,
    from_state,
    p_to_state,
    public.current_staff_id(),
    p_reason
  );

  update public.appointments
  set
    status = p_to_state::public.appointment_status,
    staff_id = coalesce(p_staff_id, staff_id),
    branch_id = coalesce(p_branch_id, branch_id),
    updated_at = now()
  where id = p_appointment_id
  returning * into appointment_row;

  return appointment_row;
end;
$$;

revoke all on function public.transition_appointment_workflow(uuid, text, uuid, uuid, text)
  from public;
grant execute on function public.transition_appointment_workflow(uuid, text, uuid, uuid, text)
  to authenticated, service_role;

create or replace function public.create_appointment_workflow_instance_for_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  version_id uuid;
begin
  select v.id into version_id
  from public.workflow_definitions d
  join public.workflow_definition_versions v on v.definition_id = d.id
  where d.retailer_id is null
    and d.key = 'appointment'
    and v.version = d.active_version;

  if version_id is null then
    return new;
  end if;

  insert into public.workflow_instances (
    retailer_id,
    definition_version_id,
    subject_type,
    subject_id,
    current_state
  )
  values (
    new.retailer_id,
    version_id,
    'appointment',
    new.id,
    new.status::text
  )
  on conflict (retailer_id, subject_type, subject_id) do nothing;

  return new;
end;
$$;

drop trigger if exists appointments_create_workflow_instance_trg
  on public.appointments;
create trigger appointments_create_workflow_instance_trg
  after insert on public.appointments
  for each row execute function public.create_appointment_workflow_instance_for_new();

comment on table public.workflow_definitions is
  'Versioned workflow definitions. Active version applies to new instances only.';
comment on table public.workflow_definition_versions is
  'Immutable workflow definition snapshots bound by workflow instances.';
comment on table public.workflow_instances is
  'Pinned workflow runtime state for a subject such as an appointment.';
comment on table public.workflow_events is
  'Append-only workflow transition audit trail.';
comment on table public.retailer_familiarity_presets is
  'Presentation-only terminology/navigation preset per retailer.';
