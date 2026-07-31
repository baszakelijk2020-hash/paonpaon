-- Stage 9.2 (INT-002/INT-003/INT-004): completes integration_connections'
-- owner boundary. 20260730300000 gave connectors observed health
-- (health_status) and raw event storage; it never gave an operator-intended
-- pause/resume/disconnect state distinct from observed health, a secret
-- reference boundary, a sync cursor, a run history, dead letters or
-- reconciliation aggregates. Those are what 9.2's acceptance criteria
-- actually require to be observable.

-- 1. Operator-intended lifecycle, distinct from observed health_status.
-- health_status answers "is it working"; operational_state answers "did an
-- operator turn it off". Conflating the two (as a single enum would) loses
-- exactly the distinction between "the provider failed" and "we paused it on
-- purpose" that a real support surface needs.
alter table public.integration_connections
  add column if not exists operational_state text not null default 'active'
    check (operational_state in ('active', 'paused', 'disconnected')),
  add column if not exists operational_state_reason text,
  add column if not exists operational_state_changed_at timestamptz
    not null default now(),
  add column if not exists operational_state_changed_by uuid
    references public.retailer_staff_members (id) on delete set null;

comment on column public.integration_connections.operational_state is
  'Operator intent: active | paused | disconnected. Independent of '
  'health_status, which reports observed provider health.';

-- 2. Connection secret reference boundary.
-- Never stores a secret value. retailer_stripe_accounts (20260720000015)
-- established the pattern this follows: the database holds a pointer to
-- where a credential lives (an env var name, a vault path, a KMS key id),
-- and the actual secret is resolved at the edge by whatever process holds
-- that env/vault access. A connector with no live credentials yet still
-- rows here with kind set and secret_ref null, which is what "an operator
-- can configure a local/mock connection" (9.2's acceptance) means before
-- any real credential exists.
create table if not exists public.integration_connection_secrets (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  kind text not null check (
    kind in (
      'api_key', 'webhook_shared_secret', 'oauth_access_token',
      'oauth_refresh_token'
    )
  ),
  secret_ref text,
  last_rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, kind)
);

create trigger set_integration_connection_secrets_updated_at
  before update on public.integration_connection_secrets
  for each row
  execute function public.set_updated_at();

create index if not exists integration_connection_secrets_retailer_idx
  on public.integration_connection_secrets (retailer_id);

alter table public.integration_connection_secrets enable row level security;

revoke all on table public.integration_connection_secrets from public, anon;
grant select on table public.integration_connection_secrets
  to authenticated, service_role;
grant insert, update on table public.integration_connection_secrets
  to service_role;

-- Only secret_ref (a pointer) is ever exposed to a retailer role, and only
-- to owner/manager/admin - never sales_associate/production_staff/read_only,
-- matching the source_authority read scope one table over. Rotation of the
-- pointer itself still requires service_role: no browser-issued write path
-- exists yet, matching "connection configuration/secrets boundary" as a
-- boundary the retailer manages through staff intent recorded elsewhere, not
-- a raw credential form.
create policy integration_connection_secrets_retailer_select
  on public.integration_connection_secrets for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_connection_secrets_platform_select
  on public.integration_connection_secrets for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_connection_secret_tenant()
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
    raise exception 'Integration connection secret''s connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration connection secret does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_connection_secrets_tenant_trg
  on public.integration_connection_secrets;
create trigger integration_connection_secrets_tenant_trg
  before insert or update on public.integration_connection_secrets
  for each row
  execute function public.enforce_integration_connection_secret_tenant();

-- 3. Sync cursor / checkpoint per connection + resource.
-- One row per (connection, resource) - e.g. (conn-1, 'products'),
-- (conn-1, 'orders') - so a delta sync can resume from where it left off
-- without replaying the whole history or losing its place on a crash.
create table if not exists public.integration_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  resource text not null,
  cursor_value jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, resource)
);

create trigger set_integration_sync_cursors_updated_at
  before update on public.integration_sync_cursors
  for each row
  execute function public.set_updated_at();

create index if not exists integration_sync_cursors_retailer_idx
  on public.integration_sync_cursors (retailer_id);

alter table public.integration_sync_cursors enable row level security;

revoke all on table public.integration_sync_cursors from public, anon;
grant select on table public.integration_sync_cursors
  to authenticated, service_role;
grant insert, update on table public.integration_sync_cursors
  to service_role;

create policy integration_sync_cursors_retailer_select
  on public.integration_sync_cursors for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_sync_cursors_platform_select
  on public.integration_sync_cursors for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_sync_cursor_tenant()
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
    raise exception 'Integration sync cursor''s connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration sync cursor does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_sync_cursors_tenant_trg
  on public.integration_sync_cursors;
create trigger integration_sync_cursors_tenant_trg
  before insert or update on public.integration_sync_cursors
  for each row
  execute function public.enforce_integration_sync_cursor_tenant();

-- 4. Scheduled/webhook run history.
-- integration_connections only ever held the LATEST success/error
-- (last_success_at, last_error_at, last_error_summary) - a single row, not a
-- history. 9.2's acceptance needs "signature/replay/cursor/failure/retry/
-- reconcile" to be observable over time, which a single latest-value column
-- cannot do.
create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  trigger_kind text not null check (
    trigger_kind in ('scheduled', 'webhook', 'manual')
  ),
  status text not null default 'running' check (
    status in ('running', 'succeeded', 'failed', 'partial')
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0
    check (records_processed >= 0),
  records_failed integer not null default 0 check (records_failed >= 0),
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists integration_sync_runs_connection_idx
  on public.integration_sync_runs (connection_id, started_at desc);

create index if not exists integration_sync_runs_retailer_idx
  on public.integration_sync_runs (retailer_id, started_at desc);

alter table public.integration_sync_runs enable row level security;

revoke all on table public.integration_sync_runs from public, anon;
grant select on table public.integration_sync_runs
  to authenticated, service_role;
grant insert, update on table public.integration_sync_runs
  to service_role;

create policy integration_sync_runs_retailer_select
  on public.integration_sync_runs for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_sync_runs_platform_select
  on public.integration_sync_runs for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_sync_run_tenant()
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
    raise exception 'Integration sync run''s connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration sync run does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_sync_runs_tenant_trg
  on public.integration_sync_runs;
create trigger integration_sync_runs_tenant_trg
  before insert or update on public.integration_sync_runs
  for each row
  execute function public.enforce_integration_sync_run_tenant();

-- 5. Dead letters.
-- external_identities.reconciliation_status already has a 'dead_letter'
-- value for a per-record match failure, but there was nowhere for an event
-- that failed before it ever became an identity/raw-event row (e.g. a
-- signature or replay rejection) to be recorded, retried or resolved.
create table if not exists public.integration_dead_letters (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  run_id uuid references public.integration_sync_runs (id) on delete set null,
  provider_event_id text,
  failure_reason text not null check (
    failure_reason in (
      'signature_invalid', 'replay_rejected', 'mapping_error',
      'validation_error', 'downstream_error', 'other'
    )
  ),
  failure_detail jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  first_failed_at timestamptz not null default now(),
  last_attempted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (
    resolution is null
    or resolution in ('retried_success', 'discarded', 'manual_fix')
  ),
  created_at timestamptz not null default now(),
  constraint integration_dead_letters_resolution_requires_timestamp check (
    (resolution is null) = (resolved_at is null)
  )
);

create index if not exists integration_dead_letters_connection_idx
  on public.integration_dead_letters (connection_id, first_failed_at desc);

create index if not exists integration_dead_letters_retailer_idx
  on public.integration_dead_letters (retailer_id)
  where resolved_at is null;

alter table public.integration_dead_letters enable row level security;

revoke all on table public.integration_dead_letters from public, anon;
grant select on table public.integration_dead_letters
  to authenticated, service_role;
grant insert, update on table public.integration_dead_letters
  to service_role;

create policy integration_dead_letters_retailer_select
  on public.integration_dead_letters for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_dead_letters_platform_select
  on public.integration_dead_letters for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_dead_letter_tenant()
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
    raise exception 'Integration dead letter''s connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration dead letter does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_dead_letters_tenant_trg
  on public.integration_dead_letters;
create trigger integration_dead_letters_tenant_trg
  before insert or update on public.integration_dead_letters
  for each row
  execute function public.enforce_integration_dead_letter_tenant();

-- 6. Reconciliation aggregates.
-- external_identities.reconciliation_status carries per-record state; 9.2's
-- acceptance also needs a per-run reconciliation RESULT (counts), which a
-- per-record column cannot summarize without a live aggregate query every
-- time a human wants to know "did the last sync actually reconcile".
create table if not exists public.integration_reconciliation_reports (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid not null
    references public.integration_connections (id) on delete cascade,
  run_id uuid references public.integration_sync_runs (id) on delete set null,
  resource text not null,
  matched_count integer not null default 0 check (matched_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  stale_count integer not null default 0 check (stale_count >= 0),
  dead_letter_count integer not null default 0
    check (dead_letter_count >= 0),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists integration_reconciliation_reports_connection_idx
  on public.integration_reconciliation_reports (connection_id, generated_at desc);

alter table public.integration_reconciliation_reports enable row level security;

revoke all on table public.integration_reconciliation_reports
  from public, anon;
grant select on table public.integration_reconciliation_reports
  to authenticated, service_role;
grant insert on table public.integration_reconciliation_reports
  to service_role;

create policy integration_reconciliation_reports_retailer_select
  on public.integration_reconciliation_reports for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy integration_reconciliation_reports_platform_select
  on public.integration_reconciliation_reports for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_integration_reconciliation_report_tenant()
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
    raise exception 'Integration reconciliation report''s connection not found';
  end if;

  if v_connection_retailer <> new.retailer_id then
    raise exception 'Integration reconciliation report does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists integration_reconciliation_reports_tenant_trg
  on public.integration_reconciliation_reports;
create trigger integration_reconciliation_reports_tenant_trg
  before insert or update on public.integration_reconciliation_reports
  for each row
  execute function public.enforce_integration_reconciliation_report_tenant();
