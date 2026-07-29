-- PAON Intelligence Platform Stage 2.5.
-- Catalogue import jobs, rows, and metadata review tasks. Preview persists
-- raw supplier payloads without publishing products. source_type includes
-- pdf so a future extractor can reuse this schema without redesign.

create type public.catalogue_import_source_type as enum (
  'csv',
  'xlsx',
  'json',
  'pdf'
);

create type public.catalogue_import_status as enum (
  'uploaded',
  'previewing',
  'ready',
  'publishing',
  'completed',
  'failed'
);

create type public.catalogue_import_row_status as enum (
  'pending',
  'valid',
  'rejected',
  'published'
);

create type public.metadata_review_task_status as enum (
  'pending',
  'accepted',
  'rejected',
  'dismissed'
);

create table public.catalogue_imports (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status public.catalogue_import_status not null default 'uploaded',
  uploaded_by_staff_id uuid not null
    references public.retailer_staff_members (id) on delete restrict,
  source_filename text not null check (
    length(btrim(source_filename)) between 1 and 255
  ),
  source_type public.catalogue_import_source_type not null,
  row_count integer not null default 0 check (row_count >= 0),
  contract_version text not null default 'v1' check (
    length(btrim(contract_version)) between 1 and 20
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index catalogue_imports_retailer_created_idx
  on public.catalogue_imports (retailer_id, created_at desc)
  where deleted_at is null;

create index catalogue_imports_retailer_status_idx
  on public.catalogue_imports (retailer_id, status)
  where deleted_at is null;

create trigger set_catalogue_imports_updated_at
  before update on public.catalogue_imports
  for each row execute function public.set_updated_at();

create table public.catalogue_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null
    references public.catalogue_imports (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  row_number integer not null check (row_number > 0),
  external_sku text check (
    external_sku is null
    or length(btrim(external_sku)) between 1 and 64
  ),
  raw_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(raw_payload) = 'object'
  ),
  proposed_product jsonb check (
    proposed_product is null
    or jsonb_typeof(proposed_product) = 'object'
  ),
  validation_errors jsonb not null default '[]'::jsonb check (
    jsonb_typeof(validation_errors) = 'array'
  ),
  status public.catalogue_import_row_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_import_rows_import_row_uidx unique (import_id, row_number)
);

create index catalogue_import_rows_retailer_import_idx
  on public.catalogue_import_rows (retailer_id, import_id, row_number);

create index catalogue_import_rows_retailer_sku_idx
  on public.catalogue_import_rows (retailer_id, external_sku)
  where external_sku is not null;

create trigger set_catalogue_import_rows_updated_at
  before update on public.catalogue_import_rows
  for each row execute function public.set_updated_at();

create or replace function public.enforce_catalogue_import_row_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_import_retailer_id uuid;
begin
  select catalogue_import.retailer_id into v_import_retailer_id
  from public.catalogue_imports as catalogue_import
  where catalogue_import.id = new.import_id
    and catalogue_import.deleted_at is null;
  if not found then
    raise exception 'Catalogue import is unavailable';
  end if;
  if v_import_retailer_id <> new.retailer_id then
    raise exception 'Catalogue import row does not belong to the retailer';
  end if;
  return new;
end;
$$;

create trigger enforce_catalogue_import_row_tenancy
  before insert or update on public.catalogue_import_rows
  for each row execute function public.enforce_catalogue_import_row_tenancy();

create or replace function public.enforce_catalogue_import_staff_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_staff_retailer_id uuid;
begin
  select staff.retailer_id into v_staff_retailer_id
  from public.retailer_staff_members as staff
  where staff.id = new.uploaded_by_staff_id
    and staff.deleted_at is null;
  if not found then
    raise exception 'Catalogue import staff is unavailable';
  end if;
  if v_staff_retailer_id <> new.retailer_id then
    raise exception 'Catalogue import staff does not belong to the retailer';
  end if;
  return new;
end;
$$;

create trigger enforce_catalogue_import_staff_tenancy
  before insert or update on public.catalogue_imports
  for each row execute function public.enforce_catalogue_import_staff_tenancy();

create table public.metadata_review_tasks (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  import_row_id uuid references public.catalogue_import_rows (id) on delete cascade,
  assignment_id uuid
    references public.entity_metadata_assignments (id) on delete set null,
  proposed_concept_id uuid
    references public.metadata_concepts (id) on delete set null,
  proposed_value text not null check (
    length(btrim(proposed_value)) between 1 and 500
  ),
  source public.metadata_source not null,
  confidence numeric check (
    confidence is null
    or (
      confidence between 0 and 1
      and scale(confidence) <= 4
    )
  ),
  status public.metadata_review_task_status not null default 'pending',
  reviewed_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metadata_review_tasks_reviewer_consistency check (
    (status = 'pending' and reviewed_by_staff_id is null and reviewed_at is null)
    or (
      status <> 'pending'
      and reviewed_by_staff_id is not null
      and reviewed_at is not null
    )
  )
);

create index metadata_review_tasks_retailer_status_idx
  on public.metadata_review_tasks (retailer_id, status, created_at desc);

create index metadata_review_tasks_import_row_idx
  on public.metadata_review_tasks (import_row_id)
  where import_row_id is not null;

create trigger set_metadata_review_tasks_updated_at
  before update on public.metadata_review_tasks
  for each row execute function public.set_updated_at();

create or replace function public.enforce_metadata_review_task_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_row_retailer_id uuid;
  v_assignment_retailer_id uuid;
  v_concept_retailer_id uuid;
  v_staff_retailer_id uuid;
begin
  if new.import_row_id is not null then
    select import_row.retailer_id into v_row_retailer_id
    from public.catalogue_import_rows as import_row
    where import_row.id = new.import_row_id;
    if not found then
      raise exception 'Catalogue import row is unavailable';
    end if;
    if v_row_retailer_id <> new.retailer_id then
      raise exception 'Metadata review task import row does not belong to the retailer';
    end if;
  end if;

  if new.assignment_id is not null then
    select assignment.retailer_id into v_assignment_retailer_id
    from public.entity_metadata_assignments as assignment
    where assignment.id = new.assignment_id
      and assignment.deleted_at is null;
    if not found then
      raise exception 'Metadata assignment is unavailable';
    end if;
    if v_assignment_retailer_id <> new.retailer_id then
      raise exception 'Metadata review task assignment does not belong to the retailer';
    end if;
  end if;

  if new.proposed_concept_id is not null then
    select concept.retailer_id into v_concept_retailer_id
    from public.metadata_concepts as concept
    where concept.id = new.proposed_concept_id
      and concept.deleted_at is null;
    if not found then
      raise exception 'Metadata concept is unavailable';
    end if;
    if v_concept_retailer_id is not null
      and v_concept_retailer_id <> new.retailer_id then
      raise exception 'Metadata review task concept does not belong to the retailer';
    end if;
  end if;

  if new.reviewed_by_staff_id is not null then
    select staff.retailer_id into v_staff_retailer_id
    from public.retailer_staff_members as staff
    where staff.id = new.reviewed_by_staff_id
      and staff.deleted_at is null;
    if not found then
      raise exception 'Metadata review task staff is unavailable';
    end if;
    if v_staff_retailer_id <> new.retailer_id then
      raise exception 'Metadata review task staff does not belong to the retailer';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_metadata_review_task_tenancy
  before insert or update on public.metadata_review_tasks
  for each row execute function public.enforce_metadata_review_task_tenancy();

alter table public.catalogue_imports enable row level security;
alter table public.catalogue_import_rows enable row level security;
alter table public.metadata_review_tasks enable row level security;

revoke all on table public.catalogue_imports from anon;
revoke all on table public.catalogue_import_rows from anon;
revoke all on table public.metadata_review_tasks from anon;

create policy "authorized staff can read tenant catalogue imports"
  on public.catalogue_imports for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert tenant catalogue imports"
  on public.catalogue_imports for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant catalogue imports"
  on public.catalogue_imports for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete tenant catalogue imports"
  on public.catalogue_imports for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read tenant catalogue import rows"
  on public.catalogue_import_rows for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert tenant catalogue import rows"
  on public.catalogue_import_rows for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant catalogue import rows"
  on public.catalogue_import_rows for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete tenant catalogue import rows"
  on public.catalogue_import_rows for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can read tenant metadata review tasks"
  on public.metadata_review_tasks for select to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in (
        'read_only',
        'production_staff',
        'sales_associate',
        'manager',
        'admin',
        'owner'
      )
    )
  );

create policy "authorized staff can insert tenant metadata review tasks"
  on public.metadata_review_tasks for insert to authenticated
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can update tenant metadata review tasks"
  on public.metadata_review_tasks for update to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  )
  with check (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

create policy "authorized staff can delete tenant metadata review tasks"
  on public.metadata_review_tasks for delete to authenticated
  using (
    (select public.is_platform_staff())
    or (
      retailer_id = (select public.current_retailer_id())
      and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
    )
  );

grant select, insert, update, delete on table public.catalogue_imports
  to authenticated, service_role;
grant select, insert, update, delete on table public.catalogue_import_rows
  to authenticated, service_role;
grant select, insert, update, delete on table public.metadata_review_tasks
  to authenticated, service_role;
