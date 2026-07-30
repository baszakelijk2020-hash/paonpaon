-- PHASE 9.1 / INT-002 / INT-003: generic staged-file migration cockpit foundation.

create table if not exists public.migration_jobs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  connection_id uuid references public.integration_connections (id),
  display_name text not null,
  status text not null default 'uploaded' check (
    status in (
      'uploaded', 'profiled', 'mapped', 'dry_run',
      'publishing', 'completed', 'failed'
    )
  ),
  contract_version text not null default 'staged-file-migration-v1',
  dry_run_report jsonb,
  reconcile_report jsonb,
  rollback_ref text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists migration_jobs_retailer_idx
  on public.migration_jobs (retailer_id, created_at desc);

alter table public.migration_jobs enable row level security;
revoke all on table public.migration_jobs from public, anon;
grant select on table public.migration_jobs to authenticated, service_role;
grant insert, update on table public.migration_jobs to service_role;

create policy migration_jobs_retailer_select
  on public.migration_jobs for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy migration_jobs_platform_select
  on public.migration_jobs for select to authenticated
  using (public.is_platform_staff());

create table if not exists public.migration_staged_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.migration_jobs (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  entity_kind text not null check (
    entity_kind in ('customer', 'product', 'stock', 'order')
  ),
  row_number integer not null check (row_number > 0),
  external_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'staged' check (
    status in ('staged', 'ready', 'published', 'dead_letter', 'skipped')
  ),
  rejection_code text,
  rejection_message text,
  canonical_id text,
  raw_event_id uuid references public.integration_raw_events (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists migration_staged_rows_job_entity_ext_uidx
  on public.migration_staged_rows (job_id, entity_kind, external_id);

create index if not exists migration_staged_rows_retailer_idx
  on public.migration_staged_rows (retailer_id, entity_kind);

alter table public.migration_staged_rows enable row level security;
revoke all on table public.migration_staged_rows from public, anon;
grant select on table public.migration_staged_rows
  to authenticated, service_role;
grant insert, update on table public.migration_staged_rows
  to service_role;

create policy migration_staged_rows_retailer_select
  on public.migration_staged_rows for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy migration_staged_rows_platform_select
  on public.migration_staged_rows for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_migration_staged_row_tenant()
returns trigger
language plpgsql
as $$
declare
  v_job_retailer uuid;
begin
  select retailer_id into v_job_retailer
  from public.migration_jobs
  where id = new.job_id;

  if v_job_retailer is null then
    raise exception 'Migration staged row job not found';
  end if;

  if v_job_retailer <> new.retailer_id then
    raise exception 'Migration staged row does not belong to the retailer';
  end if;

  return new;
end;
$$;

drop trigger if exists migration_staged_rows_tenant_trg
  on public.migration_staged_rows;
create trigger migration_staged_rows_tenant_trg
  before insert or update on public.migration_staged_rows
  for each row execute function public.enforce_migration_staged_row_tenant();

create table if not exists public.migration_publish_receipts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.migration_jobs (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  entity_kind text not null check (
    entity_kind in ('customer', 'product', 'stock', 'order')
  ),
  external_id text not null,
  canonical_id text not null,
  money_minor integer not null default 0 check (money_minor >= 0),
  stock_units integer not null default 0 check (stock_units >= 0),
  created_at timestamptz not null default now(),
  unique (job_id, entity_kind, external_id)
);

alter table public.migration_publish_receipts enable row level security;
revoke all on table public.migration_publish_receipts from public, anon;
grant select on table public.migration_publish_receipts
  to authenticated, service_role;
grant insert on table public.migration_publish_receipts
  to service_role;

create policy migration_publish_receipts_retailer_select
  on public.migration_publish_receipts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy migration_publish_receipts_platform_select
  on public.migration_publish_receipts for select to authenticated
  using (public.is_platform_staff());

comment on table public.migration_jobs is
  'Staged-file migration jobs (PHASE 9.1 / INT-002).';
comment on table public.migration_staged_rows is
  'Immutable-enough staged rows with dead-letter and resume statuses.';
comment on table public.migration_publish_receipts is
  'Publish receipts for reconcile (counts/money/stock) and rollback refs.';
