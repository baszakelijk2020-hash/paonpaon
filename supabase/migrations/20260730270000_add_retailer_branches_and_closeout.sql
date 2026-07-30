-- PHASE 7.5 / CLI-006: branches, appointment branch link, closeout audit,
-- and recurring customer moments.

create table if not exists public.retailer_branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  timezone text not null check (char_length(btrim(timezone)) between 3 and 64),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists retailer_branches_one_default_idx
  on public.retailer_branches (retailer_id)
  where is_default and deleted_at is null;

create index if not exists retailer_branches_retailer_idx
  on public.retailer_branches (retailer_id)
  where deleted_at is null;

alter table public.retailer_branches enable row level security;

revoke all on table public.retailer_branches from public, anon;
grant select, insert, update on table public.retailer_branches
  to authenticated, service_role;

create policy retailer_branches_select
  on public.retailer_branches for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy retailer_branches_write
  on public.retailer_branches for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

create policy retailer_branches_update
  on public.retailer_branches for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (retailer_id = public.current_retailer_id());

alter table public.appointments
  add column if not exists branch_id uuid
    references public.retailer_branches (id) on delete set null;

create index if not exists appointments_branch_idx
  on public.appointments (retailer_id, branch_id, starts_at)
  where deleted_at is null and branch_id is not null;

create table if not exists public.appointment_closeouts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  appointment_id uuid not null references public.appointments (id)
    on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  staff_id uuid not null references public.retailer_staff_members (id),
  freeform_note text,
  next_step text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

alter table public.appointment_closeouts enable row level security;

revoke all on table public.appointment_closeouts from public, anon;
grant select, insert on table public.appointment_closeouts
  to authenticated, service_role;

create policy appointment_closeouts_select
  on public.appointment_closeouts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy appointment_closeouts_insert
  on public.appointment_closeouts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

create table if not exists public.customer_moments (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  branch_id uuid references public.retailer_branches (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  moment_type text not null check (
    moment_type in (
      'anniversary', 'wedding', 'travel', 'bonus_window', 'follow_up', 'other'
    )
  ),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  occurs_on date not null,
  recurrence text not null default 'none' check (
    recurrence in ('none', 'yearly', 'monthly')
  ),
  timezone text not null check (char_length(btrim(timezone)) between 3 and 64),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists customer_moments_calendar_idx
  on public.customer_moments (retailer_id, occurs_on)
  where deleted_at is null;

alter table public.customer_moments enable row level security;

revoke all on table public.customer_moments from public, anon;
grant select, insert, update on table public.customer_moments
  to authenticated, service_role;

create policy customer_moments_select
  on public.customer_moments for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy customer_moments_write
  on public.customer_moments for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

create policy customer_moments_update
  on public.customer_moments for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.retailer_branches is
  'Branch/store locations with IANA timezone (PHASE 7.5).';
comment on table public.appointment_closeouts is
  'Audit row for post-appointment rectangle closeout (PHASE 7.5).';
comment on table public.customer_moments is
  'Recurring customer moments on the shared calendar (PHASE 7.5).';
