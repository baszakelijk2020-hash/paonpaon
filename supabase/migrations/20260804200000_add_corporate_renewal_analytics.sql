-- PHASE 18.9 (BD-109): corporate analytics and renewal engine. Reuses
-- `cited_recommendations` (14.2) for the renewal-risk signal — a new
-- `corporate_renewal_risk` kind, not a second citation mechanism — so
-- the same "no black-box owner dashboard" enforcement (CHECK-enforced
-- non-empty sources, `buildRecommendation` as the only constructor)
-- applies here without being reimplemented.

alter table public.cited_recommendations
  drop constraint cited_recommendations_kind_check;
alter table public.cited_recommendations
  add constraint cited_recommendations_kind_check check (
    kind in (
      'temporal_hotspot', 'interest_progression', 'complete_look',
      'fit_risk', 'production_risk', 'stock_risk', 'staffing_risk',
      'corporate_renewal_risk'
    )
  );

-- The one genuinely new object: an auto-generated renewal task, created
-- only when risk is elevated and only once per open task
-- (`shouldCreateRenewalTask`) — never accumulating duplicates every time
-- analytics recompute.
create table if not exists public.corporate_renewal_tasks (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 5 and 2000),
  status text not null default 'open' check (status in ('open', 'done')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_renewal_tasks_resolution check (
    (status = 'open') = (resolved_at is null)
  )
);

create unique index if not exists corporate_renewal_tasks_one_open_per_programme
  on public.corporate_renewal_tasks (programme_id)
  where status = 'open';

create index if not exists corporate_renewal_tasks_open_idx
  on public.corporate_renewal_tasks (retailer_id, created_at)
  where status = 'open';

create trigger set_corporate_renewal_tasks_updated_at
  before update on public.corporate_renewal_tasks
  for each row execute function public.set_updated_at();

alter table public.corporate_renewal_tasks enable row level security;
revoke all on table public.corporate_renewal_tasks from public, anon;
grant select, insert, update on table public.corporate_renewal_tasks
  to authenticated, service_role;

create policy corporate_renewal_tasks_retailer_select
  on public.corporate_renewal_tasks for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy corporate_renewal_tasks_staff_insert
  on public.corporate_renewal_tasks for insert to authenticated with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy corporate_renewal_tasks_staff_update
  on public.corporate_renewal_tasks for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.corporate_renewal_tasks is
  'PHASE 18.9 / BD-109. corporate_renewal_tasks_one_open_per_programme is '
  'the actual enforcement against duplicate tasks, not application code '
  'alone.';
