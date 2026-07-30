-- PHASE 8.2 / INT-001 / INT-003 / INT-004: source-authority and external-identity registry.
-- Authority is by domain/field group. Write-back is never implied by ingest.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  provider text not null check (
    provider in ('faden', 'shopify', 'staged_file', 'other')
  ),
  display_name text not null,
  health_status text not null default 'disconnected' check (
    health_status in (
      'healthy', 'degraded', 'stale', 'failed', 'disconnected'
    )
  ),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_summary text,
  lag_seconds integer not null default 0 check (lag_seconds >= 0),
  deep_link_base_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists integration_connections_retailer_idx
  on public.integration_connections (retailer_id)
  where deleted_at is null;

alter table public.integration_connections enable row level security;

revoke all on table public.integration_connections from public, anon;
grant select on table public.integration_connections
  to authenticated, service_role;
grant insert, update on table public.integration_connections
  to service_role;

create policy integration_connections_retailer_select
  on public.integration_connections for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_connections_platform_select
  on public.integration_connections for select to authenticated
  using (public.is_platform_staff());

create table if not exists public.source_authority_policies (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  domain text not null check (
    domain in (
      'catalogue', 'inventory', 'customer', 'order', 'payment',
      'production', 'appointment', 'message', 'payroll'
    )
  ),
  field_group text not null,
  authority text not null check (
    authority in ('paon', 'external', 'co_managed')
  ),
  allowed_directions text[] not null default array['ingest']::text[]
    check (
      allowed_directions <@ array['ingest', 'export', 'write_api']::text[]
      and cardinality(allowed_directions) > 0
    ),
  mapping_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint source_authority_policies_connection_tenant_chk
    check (true)
);

create unique index if not exists source_authority_policies_uidx
  on public.source_authority_policies (
    connection_id, domain, field_group
  )
  where deleted_at is null;

create index if not exists source_authority_policies_retailer_idx
  on public.source_authority_policies (retailer_id)
  where deleted_at is null;

alter table public.source_authority_policies enable row level security;

revoke all on table public.source_authority_policies from public, anon;
grant select on table public.source_authority_policies
  to authenticated, service_role;
grant insert, update on table public.source_authority_policies
  to service_role;

create policy source_authority_policies_retailer_select
  on public.source_authority_policies for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy source_authority_policies_platform_select
  on public.source_authority_policies for select to authenticated
  using (public.is_platform_staff());

-- Keep policy.connection tenant-aligned with the parent connection.
create or replace function public.enforce_source_authority_policy_tenant()
returns trigger
language plpgsql
as $$
declare
  v_connection_retailer uuid;
begin
  select retailer_id into v_connection_retailer
  from public.integration_connections
  where id = new.connection_id
    and deleted_at is null;

  if v_connection_retailer is null then
    raise exception 'Source authority policy connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Source authority policy does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists source_authority_policies_tenant_trg
  on public.source_authority_policies;
create trigger source_authority_policies_tenant_trg
  before insert or update on public.source_authority_policies
  for each row execute function public.enforce_source_authority_policy_tenant();

create table if not exists public.integration_raw_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  provider_event_id text not null,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  mapping_version text not null,
  direction text not null check (
    direction in ('ingest', 'export', 'write_api')
  ),
  created_at timestamptz not null default now(),
  constraint integration_raw_events_no_write_api_fake check (
    direction <> 'write_api'
    or payload ? 'provider_write_confirmed'
  )
);

create unique index if not exists integration_raw_events_idempotent_uidx
  on public.integration_raw_events (connection_id, provider_event_id);

create index if not exists integration_raw_events_retailer_idx
  on public.integration_raw_events (retailer_id, received_at desc);

alter table public.integration_raw_events enable row level security;

revoke all on table public.integration_raw_events from public, anon;
grant select on table public.integration_raw_events
  to authenticated, service_role;
grant insert on table public.integration_raw_events
  to service_role;

create policy integration_raw_events_retailer_select
  on public.integration_raw_events for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_raw_events_platform_select
  on public.integration_raw_events for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_raw_event_tenant()
returns trigger
language plpgsql
as $$
declare
  v_connection_retailer uuid;
begin
  select retailer_id into v_connection_retailer
  from public.integration_connections
  where id = new.connection_id
    and deleted_at is null;

  if v_connection_retailer is null then
    raise exception 'Integration raw event connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration raw event does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_raw_events_tenant_trg
  on public.integration_raw_events;
create trigger integration_raw_events_tenant_trg
  before insert or update on public.integration_raw_events
  for each row execute function public.enforce_integration_raw_event_tenant();

create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  domain text not null check (
    domain in (
      'catalogue', 'inventory', 'customer', 'order', 'payment',
      'production', 'appointment', 'message', 'payroll'
    )
  ),
  external_object_type text not null,
  external_id text not null,
  canonical_object_type text not null,
  canonical_id text not null,
  external_version text,
  external_updated_at timestamptz,
  raw_event_id uuid references public.integration_raw_events (id),
  mapping_version text not null,
  reconciliation_status text not null default 'pending' check (
    reconciliation_status in (
      'matched', 'pending', 'conflict', 'stale', 'dead_letter'
    )
  ),
  conflict_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists external_identities_uidx
  on public.external_identities (
    connection_id, domain, external_object_type, external_id
  )
  where deleted_at is null;

create index if not exists external_identities_retailer_idx
  on public.external_identities (retailer_id)
  where deleted_at is null;

alter table public.external_identities enable row level security;

revoke all on table public.external_identities from public, anon;
grant select on table public.external_identities
  to authenticated, service_role;
grant insert, update on table public.external_identities
  to service_role;

create policy external_identities_retailer_select
  on public.external_identities for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy external_identities_platform_select
  on public.external_identities for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_external_identity_tenant()
returns trigger
language plpgsql
as $$
declare
  v_connection_retailer uuid;
begin
  select retailer_id into v_connection_retailer
  from public.integration_connections
  where id = new.connection_id
    and deleted_at is null;

  if v_connection_retailer is null then
    raise exception 'External identity connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'External identity does not belong to the retailer';
  end if;

  if new.raw_event_id is not null then
    if not exists (
      select 1
      from public.integration_raw_events e
      where e.id = new.raw_event_id
        and e.retailer_id = new.retailer_id
        and e.connection_id = new.connection_id
    ) then
      raise exception 'External identity raw reference does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists external_identities_tenant_trg
  on public.external_identities;
create trigger external_identities_tenant_trg
  before insert or update on public.external_identities
  for each row execute function public.enforce_external_identity_tenant();

create table if not exists public.integration_handoff_tasks (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  external_object_type text not null,
  external_id text not null,
  deep_link_url text not null,
  write_back_claimed boolean not null default false
    check (write_back_claimed = false),
  instruction text not null,
  status text not null default 'open' check (
    status in ('open', 'confirmed', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_handoff_tasks_retailer_idx
  on public.integration_handoff_tasks (retailer_id, created_at desc);

alter table public.integration_handoff_tasks enable row level security;

revoke all on table public.integration_handoff_tasks from public, anon;
grant select on table public.integration_handoff_tasks
  to authenticated, service_role;
grant insert, update on table public.integration_handoff_tasks
  to service_role;

create policy integration_handoff_tasks_retailer_select
  on public.integration_handoff_tasks for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_handoff_tasks_platform_select
  on public.integration_handoff_tasks for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_handoff_tenant()
returns trigger
language plpgsql
as $$
declare
  v_connection_retailer uuid;
begin
  if new.write_back_claimed is distinct from false then
    raise exception 'Integration handoff must not claim write-back';
  end if;

  select retailer_id into v_connection_retailer
  from public.integration_connections
  where id = new.connection_id
    and deleted_at is null;

  if v_connection_retailer is null then
    raise exception 'Integration handoff connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration handoff does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_handoff_tasks_tenant_trg
  on public.integration_handoff_tasks;
create trigger integration_handoff_tasks_tenant_trg
  before insert or update on public.integration_handoff_tasks
  for each row execute function public.enforce_integration_handoff_tenant();

comment on table public.integration_connections is
  'External system connection health (PHASE 8.2 / INT-001).';
comment on table public.source_authority_policies is
  'Domain/field-group authority modes paon|external|co_managed (PHASE 8.2).';
comment on table public.external_identities is
  'External ID to canonical object mapping with reconciliation (PHASE 8.2).';
comment on table public.integration_raw_events is
  'Immutable raw provider payloads before mapping (PHASE 8.2 / INT-003).';
comment on table public.integration_handoff_tasks is
  'Deep-link handoffs; write_back_claimed must remain false (PHASE 8.2 / INT-004).';
