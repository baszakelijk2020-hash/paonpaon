-- PHASE 7.8 / CLI-009 / ENG-006: policy config + admin projection health.

create table if not exists public.intelligence_policy_configs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  jurisdiction_tag text,
  allow_anonymous_capture boolean not null default false,
  allow_personalization_projection boolean not null default true,
  allow_advisor_display boolean not null default true,
  allow_customer_display boolean not null default true,
  allow_export boolean not null default false,
  allow_activation boolean not null default false,
  retention_days_personalization integer not null default 365
    check (retention_days_personalization between 1 and 3650),
  field_mask text[] not null default array[
    'password', 'cardNumber', 'cvv', 'credentials', 'rawForm'
  ]::text[],
  policy_version text not null default 'intelligence-policy-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists intelligence_policy_configs_retailer_uidx
  on public.intelligence_policy_configs (retailer_id)
  where deleted_at is null and retailer_id is not null;

alter table public.intelligence_policy_configs enable row level security;

revoke all on table public.intelligence_policy_configs from public, anon;
grant select on table public.intelligence_policy_configs
  to authenticated, service_role;
grant insert, update on table public.intelligence_policy_configs
  to service_role;

create policy intelligence_policy_configs_retailer_select
  on public.intelligence_policy_configs for select to authenticated
  using (
    retailer_id is null
    or (
      retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'manager', 'admin')
    )
    or public.is_platform_staff()
  );

create table if not exists public.intelligence_projection_health (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  projector_version text not null,
  status text not null check (
    status in ('healthy', 'degraded', 'failed', 'stale')
  ),
  lag_seconds integer not null default 0 check (lag_seconds >= 0),
  correction_rate numeric(6, 4) not null default 0
    check (correction_rate >= 0 and correction_rate <= 1),
  explainability_ok boolean not null default true,
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists intelligence_projection_health_observed_idx
  on public.intelligence_projection_health (observed_at desc);

alter table public.intelligence_projection_health enable row level security;

revoke all on table public.intelligence_projection_health from public, anon;
grant select on table public.intelligence_projection_health
  to authenticated, service_role;
grant insert, update on table public.intelligence_projection_health
  to service_role;

create policy intelligence_projection_health_platform_select
  on public.intelligence_projection_health for select to authenticated
  using (public.is_platform_staff());

create policy intelligence_projection_health_retailer_select
  on public.intelligence_projection_health for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );

comment on table public.intelligence_policy_configs is
  'Tenant/jurisdiction policy plane for intelligence eligibility (PHASE 7.8).';
comment on table public.intelligence_projection_health is
  'Admin/ops projection health without customer-content browsing (PHASE 7.8).';
