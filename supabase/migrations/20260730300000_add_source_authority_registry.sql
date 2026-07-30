-- PHASE 8.2 / INT-001 / INT-003 / INT-004: source authority and external identity registry.

create type public.source_domain as enum (
  'catalogue',
  'inventory',
  'customer',
  'order',
  'payment',
  'production',
  'appointment',
  'message',
  'payroll'
);

create type public.source_authority_mode as enum (
  'paon',
  'external',
  'co_managed'
);

create type public.sync_direction as enum (
  'ingest',
  'export',
  'write_api'
);

create type public.reconciliation_state as enum (
  'matched',
  'conflict',
  'stale',
  'unmapped',
  'pending'
);

create type public.connector_provider as enum (
  'faden',
  'shopify',
  'staged_file'
);

create type public.connection_status as enum (
  'active',
  'paused',
  'disconnected',
  'fixture'
);

create type public.connector_health_status as enum (
  'healthy',
  'degraded',
  'failed',
  'stale'
);

create table if not exists public.source_connections (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  provider public.connector_provider not null,
  label text not null,
  status public.connection_status not null default 'active',
  mapping_version text not null default 'source-authority-v1',
  allowed_directions public.sync_direction[] not null default array['ingest']::public.sync_direction[],
  last_sync_at timestamptz,
  cursor text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_connections_allowed_directions_nonempty
    check (cardinality(allowed_directions) >= 1)
);

create unique index if not exists source_connections_retailer_provider_label_uidx
  on public.source_connections (retailer_id, provider, label);

create table if not exists public.source_authority_policies (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  domain public.source_domain not null,
  field_group text not null,
  authority_mode public.source_authority_mode not null,
  allowed_directions public.sync_direction[] not null,
  connection_id uuid references public.source_connections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_authority_policies_field_group_nonempty
    check (char_length(field_group) > 0),
  constraint source_authority_policies_allowed_directions_nonempty
    check (cardinality(allowed_directions) >= 1)
);

create unique index if not exists source_authority_policies_retailer_domain_group_uidx
  on public.source_authority_policies (retailer_id, domain, field_group);

create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null references public.source_connections (id) on delete cascade,
  domain public.source_domain not null,
  external_object_type text not null,
  external_id text not null,
  canonical_type text not null,
  canonical_id uuid not null,
  external_version text not null,
  mapping_version text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_identities_external_id_nonempty
    check (char_length(external_id) > 0)
);

create unique index if not exists external_identities_connection_object_uidx
  on public.external_identities (
    connection_id,
    external_object_type,
    external_id
  );

create table if not exists public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null references public.source_connections (id) on delete cascade,
  provider_event_id text not null,
  payload_hash text not null,
  raw_payload jsonb not null,
  ingested_at timestamptz not null default now(),
  constraint source_snapshots_provider_event_id_nonempty
    check (char_length(provider_event_id) > 0)
);

create unique index if not exists source_snapshots_connection_event_hash_uidx
  on public.source_snapshots (connection_id, provider_event_id, payload_hash);

create table if not exists public.source_reconciliations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  external_identity_id uuid not null references public.external_identities (id) on delete cascade,
  state public.reconciliation_state not null,
  conflict_reason text,
  resolved_at timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists source_reconciliations_open_conflict_idx
  on public.source_reconciliations (retailer_id, observed_at desc)
  where state = 'conflict' and resolved_at is null;

create table if not exists public.connector_health_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null references public.source_connections (id) on delete cascade,
  status public.connector_health_status not null,
  lag_seconds integer not null default 0 check (lag_seconds >= 0),
  open_conflict_count integer not null default 0 check (open_conflict_count >= 0),
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists connector_health_events_observed_idx
  on public.connector_health_events (observed_at desc);

create or replace function public.enforce_source_connection_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  connection_retailer uuid;
begin
  select retailer_id into connection_retailer
  from public.source_connections
  where id = new.connection_id;

  if connection_retailer is null then
    raise exception 'Source connection does not exist';
  end if;

  if new.retailer_id <> connection_retailer then
    raise exception 'Source connection does not belong to the retailer';
  end if;

  return new;
end;
$$;

create trigger source_authority_policies_connection_tenancy
before insert or update on public.source_authority_policies
for each row
when (new.connection_id is not null)
execute function public.enforce_source_connection_tenancy();

create trigger external_identities_connection_tenancy
before insert or update on public.external_identities
for each row
execute function public.enforce_source_connection_tenancy();

create trigger source_snapshots_connection_tenancy
before insert or update on public.source_snapshots
for each row
execute function public.enforce_source_connection_tenancy();

create trigger connector_health_events_connection_tenancy
before insert or update on public.connector_health_events
for each row
execute function public.enforce_source_connection_tenancy();

create or replace function public.enforce_external_identity_reconciliation_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  identity_retailer uuid;
begin
  select retailer_id into identity_retailer
  from public.external_identities
  where id = new.external_identity_id;

  if identity_retailer is null then
    raise exception 'External identity does not exist';
  end if;

  if new.retailer_id <> identity_retailer then
    raise exception 'External identity does not belong to the retailer';
  end if;

  return new;
end;
$$;

create trigger source_reconciliations_identity_tenancy
before insert or update on public.source_reconciliations
for each row
execute function public.enforce_external_identity_reconciliation_tenancy();

alter table public.source_connections enable row level security;
alter table public.source_authority_policies enable row level security;
alter table public.external_identities enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.source_reconciliations enable row level security;
alter table public.connector_health_events enable row level security;

revoke all on table public.source_connections from public, anon;
revoke all on table public.source_authority_policies from public, anon;
revoke all on table public.external_identities from public, anon;
revoke all on table public.source_snapshots from public, anon;
revoke all on table public.source_reconciliations from public, anon;
revoke all on table public.connector_health_events from public, anon;

grant select on table public.source_connections to authenticated, service_role;
grant insert, update on table public.source_connections to authenticated, service_role;

grant select on table public.source_authority_policies to authenticated, service_role;
grant insert, update on table public.source_authority_policies to authenticated, service_role;

grant select on table public.external_identities to authenticated, service_role;
grant insert, update on table public.external_identities to authenticated, service_role;

grant select on table public.source_snapshots to authenticated, service_role;
grant insert on table public.source_snapshots to authenticated, service_role;

grant select on table public.source_reconciliations to authenticated, service_role;
grant insert, update on table public.source_reconciliations to authenticated, service_role;

grant select on table public.connector_health_events to authenticated, service_role;
grant insert on table public.connector_health_events to authenticated, service_role;

create policy source_connections_retailer_select
  on public.source_connections for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
    or public.is_platform_staff()
  );

create policy source_connections_retailer_write
  on public.source_connections for all to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy source_authority_policies_retailer_select
  on public.source_authority_policies for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
    or public.is_platform_staff()
  );

create policy source_authority_policies_retailer_write
  on public.source_authority_policies for all to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy external_identities_retailer_select
  on public.external_identities for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
    or public.is_platform_staff()
  );

create policy external_identities_retailer_write
  on public.external_identities for all to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy source_snapshots_retailer_select
  on public.source_snapshots for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
    or public.is_platform_staff()
  );

create policy source_snapshots_retailer_write
  on public.source_snapshots for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy source_reconciliations_retailer_select
  on public.source_reconciliations for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
    or public.is_platform_staff()
  );

create policy source_reconciliations_retailer_write
  on public.source_reconciliations for all to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy connector_health_events_platform_select
  on public.connector_health_events for select to authenticated
  using (public.is_platform_staff());

create policy connector_health_events_retailer_select
  on public.connector_health_events for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin', 'associate')
  );

create policy connector_health_events_retailer_write
  on public.connector_health_events for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create or replace function public.ingest_source_snapshot(
  p_connection_id uuid,
  p_provider_event_id text,
  p_payload_hash text,
  p_raw_payload jsonb,
  p_domain public.source_domain,
  p_external_object_type text,
  p_external_id text,
  p_canonical_type text,
  p_canonical_id uuid,
  p_external_version text,
  p_mapping_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_snapshot_id uuid;
  v_identity_id uuid;
  v_existing record;
  v_reconcile public.reconciliation_state;
  v_conflict text;
  v_should_update boolean := true;
begin
  if public.current_retailer_role() not in ('owner', 'manager', 'admin') then
    raise exception 'Not authorized to ingest source snapshots';
  end if;

  select retailer_id into v_retailer_id
  from public.source_connections
  where id = p_connection_id
    and retailer_id = public.current_retailer_id();

  if v_retailer_id is null then
    raise exception 'Source connection does not belong to the retailer';
  end if;

  insert into public.source_snapshots (
    retailer_id,
    connection_id,
    provider_event_id,
    payload_hash,
    raw_payload
  )
  values (
    v_retailer_id,
    p_connection_id,
    p_provider_event_id,
    p_payload_hash,
    p_raw_payload
  )
  on conflict do nothing
  returning id into v_snapshot_id;

  select id, canonical_id, external_version, mapping_version
  into v_existing
  from public.external_identities
  where connection_id = p_connection_id
    and external_object_type = p_external_object_type
    and external_id = p_external_id
  limit 1;

  if v_existing.id is null then
    v_reconcile := 'pending';
  elsif v_existing.canonical_id <> p_canonical_id
    and v_existing.external_version = p_external_version then
    v_reconcile := 'conflict';
    v_conflict := format(
      'External id already maps to %s, not %s',
      v_existing.canonical_id,
      p_canonical_id
    );
    v_should_update := false;
  elsif v_existing.mapping_version <> p_mapping_version
    and v_existing.canonical_id <> p_canonical_id then
    v_reconcile := 'conflict';
    v_conflict := format(
      'Mapping version %s would remap external identity to a different canonical id',
      p_mapping_version
    );
    v_should_update := false;
  elsif p_external_version < v_existing.external_version then
    v_reconcile := 'stale';
    v_conflict := format(
      'Incoming external version %s is older than last seen %s',
      p_external_version,
      v_existing.external_version
    );
    v_should_update := false;
  elsif v_existing.canonical_id = p_canonical_id then
    v_reconcile := 'matched';
  else
    v_reconcile := 'pending';
  end if;

  if v_should_update then
    insert into public.external_identities (
      retailer_id,
      connection_id,
      domain,
      external_object_type,
      external_id,
      canonical_type,
      canonical_id,
      external_version,
      mapping_version,
      last_seen_at
    )
    values (
      v_retailer_id,
      p_connection_id,
      p_domain,
      p_external_object_type,
      p_external_id,
      p_canonical_type,
      p_canonical_id,
      p_external_version,
      p_mapping_version,
      now()
    )
    on conflict (connection_id, external_object_type, external_id)
    do update set
      canonical_type = excluded.canonical_type,
      canonical_id = excluded.canonical_id,
      external_version = excluded.external_version,
      mapping_version = excluded.mapping_version,
      last_seen_at = excluded.last_seen_at,
      updated_at = now()
    returning id into v_identity_id;
  else
    v_identity_id := v_existing.id;
  end if;

  insert into public.source_reconciliations (
    retailer_id,
    external_identity_id,
    state,
    conflict_reason
  )
  values (
    v_retailer_id,
    v_identity_id,
    v_reconcile,
    v_conflict
  );

  update public.source_connections
  set last_sync_at = now(),
      updated_at = now()
  where id = p_connection_id;

  insert into public.connector_health_events (
    retailer_id,
    connection_id,
    status,
    lag_seconds,
    open_conflict_count,
    notes
  )
  select
    v_retailer_id,
    p_connection_id,
    case
      when exists (
        select 1
        from public.source_reconciliations sr
        where sr.retailer_id = v_retailer_id
          and sr.state = 'conflict'
          and sr.resolved_at is null
      ) then 'degraded'::public.connector_health_status
      else 'healthy'::public.connector_health_status
    end,
    0,
    (
      select count(*)::integer
      from public.source_reconciliations sr
      where sr.retailer_id = v_retailer_id
        and sr.state = 'conflict'
        and sr.resolved_at is null
    ),
    case when v_snapshot_id is null then 'duplicate snapshot ignored' else null end;

  return jsonb_build_object(
    'snapshotId', v_snapshot_id,
    'externalIdentityId', v_identity_id,
    'reconciliationState', v_reconcile,
    'conflictReason', v_conflict,
    'updated', v_should_update
  );
end;
$$;

grant execute on function public.ingest_source_snapshot(
  uuid,
  text,
  text,
  jsonb,
  public.source_domain,
  text,
  text,
  text,
  uuid,
  text,
  text
) to authenticated;

comment on table public.source_connections is
  'Retailer connector registry with mapping version and allowed directions (PHASE 8.2).';
comment on table public.source_authority_policies is
  'Per-domain field-group authority configuration (PHASE 8.2).';
comment on table public.external_identities is
  'External-to-canonical identity map with versioned mapping (PHASE 8.2).';
comment on table public.source_snapshots is
  'Immutable raw provider payloads before mapping (PHASE 8.2).';
comment on table public.source_reconciliations is
  'Operator-visible reconciliation and conflict history (PHASE 8.2).';
comment on table public.connector_health_events is
  'Connection lag/conflict health without customer payload exposure (PHASE 8.2).';
