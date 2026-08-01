-- R0.3 / ADR-070: one module kernel for every retailer and commercial plan.
-- Existing commercial_features remain fine-grained capabilities. These
-- module families are coherent entitlement, navigation and job boundaries.

create table public.platform_modules (
  key text primary key,
  name text not null,
  family_order integer not null unique check (family_order between 1 and 8),
  description text not null,
  dependency_keys text[] not null default '{}',
  authority_domains text[] not null default '{}',
  job_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_module_key_known check (key in (
    'platform_core',
    'relationship_intelligence',
    'wardrobe_styling',
    'commerce_growth',
    'garment_service_operations',
    'retail_operations',
    'enterprise_verticals',
    'network_ecosystem'
  )),
  constraint platform_module_not_self_dependent check (
    not (key = any(dependency_keys))
  )
);

create trigger set_platform_modules_updated_at
  before update on public.platform_modules
  for each row execute function public.set_updated_at();

insert into public.platform_modules (
  key, name, family_order, description, dependency_keys,
  authority_domains, job_keys
) values
  (
    'platform_core', 'Platform Core', 1,
    'Tenancy, identity, consent, provenance, audit, workflow, integration and module control.',
    '{}', '{}',
    array['notification_dispatch', 'audit_retention']
  ),
  (
    'relationship_intelligence', 'Client & Relationship Intelligence', 2,
    'House Memory, advisor preparation, appointments, conversations, promises and outcomes.',
    array['platform_core'], array['customer', 'appointment', 'message'],
    array['advisor_brief_refresh', 'promise_due_scan']
  ),
  (
    'wardrobe_styling', 'Wardrobe & Styling Intelligence', 3,
    'Garment graph, visual wardrobe, fit evidence, composed looks, consultation and Morning Routine.',
    array['platform_core', 'relationship_intelligence'],
    array['catalogue', 'customer'],
    array['morning_routine_delivery', 'wardrobe_freshness_scan']
  ),
  (
    'commerce_growth', 'Commerce & Growth', 4,
    'Assisted selling, orders, offers, campaigns, loyalty, referrals and measurable journeys.',
    array['platform_core', 'relationship_intelligence'],
    array['order', 'payment', 'catalogue'],
    array['campaign_activation', 'loyalty_milestone_refresh']
  ),
  (
    'garment_service_operations', 'Garment & Service Operations', 5,
    'Production, fitting, alterations, custody, delivery, care plans and partner fulfilment.',
    array['platform_core', 'relationship_intelligence'],
    array['production', 'appointment', 'order'],
    array['production_milestone_scan', 'service_care_reminder']
  ),
  (
    'retail_operations', 'Retail Operations', 6,
    'Catalogue, inventory, POS, staff work, scheduling, analytics and reconciliation.',
    array['platform_core'],
    array['catalogue', 'inventory', 'order', 'payment', 'payroll'],
    array['inventory_drift_monitor', 'integration_reconciliation']
  ),
  (
    'enterprise_verticals', 'Enterprise & Vertical Solutions', 7,
    'Corporate wardrobes, wedding parties, multi-location, preferred tailoring and consultancy.',
    array['platform_core', 'relationship_intelligence', 'garment_service_operations'],
    array['customer', 'order', 'production', 'appointment'],
    array['wedding_readiness_scan', 'corporate_entitlement_monitor']
  ),
  (
    'network_ecosystem', 'Network & Ecosystem', 8,
    'Partner procurement, publisher participation, curated commerce and multi-party experiences.',
    array['platform_core', 'commerce_growth', 'garment_service_operations'],
    array['catalogue', 'order', 'payment', 'production'],
    array['partner_attribution_reconciliation', 'audience_release_expiry']
  );

create table public.subscription_plan_modules (
  plan_id uuid not null
    references public.subscription_plans (id) on delete cascade,
  module_key text not null
    references public.platform_modules (key) on delete restrict,
  default_authority_mode text not null default 'co_managed'
    check (default_authority_mode in ('paon', 'external', 'co_managed')),
  created_at timestamptz not null default now(),
  primary key (plan_id, module_key)
);

create table public.retailer_module_configurations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null
    references public.retailers (id) on delete cascade,
  module_key text not null
    references public.platform_modules (key) on delete restrict,
  state text not null
    check (state in ('off', 'preview', 'active', 'suspended')),
  authority_mode text not null
    check (authority_mode in ('paon', 'external', 'co_managed')),
  source text not null
    check (source in ('add_on', 'override')),
  reason text,
  configured_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_module_configuration_unique
    unique (retailer_id, module_key),
  constraint retailer_module_override_has_reason check (
    source <> 'override' or char_length(btrim(coalesce(reason, ''))) >= 5
  )
);

create trigger set_retailer_module_configurations_updated_at
  before update on public.retailer_module_configurations
  for each row execute function public.set_updated_at();

create table public.retailer_module_configuration_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null
    references public.retailers (id) on delete cascade,
  module_key text not null
    references public.platform_modules (key) on delete restrict,
  previous_state text check (
    previous_state is null or previous_state in ('off', 'preview', 'active', 'suspended')
  ),
  next_state text not null
    check (next_state in ('off', 'preview', 'active', 'suspended')),
  previous_authority_mode text check (
    previous_authority_mode is null
    or previous_authority_mode in ('paon', 'external', 'co_managed')
  ),
  next_authority_mode text not null
    check (next_authority_mode in ('paon', 'external', 'co_managed')),
  source text not null check (source in ('add_on', 'override')),
  reason text,
  changed_by_user_id uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index retailer_module_events_tenant_time_idx
  on public.retailer_module_configuration_events (
    retailer_id, occurred_at desc
  );

create or replace function public.resolve_retailer_modules(
  p_retailer_id uuid
)
returns table (
  module_key text,
  state text,
  authority_mode text,
  source text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff()
    and public.current_retailer_id() is distinct from p_retailer_id
    and coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using
      message = 'Not authorized to inspect retailer modules.';
  end if;

  return query
  select
    m.key,
    coalesce(c.state, case when pm.module_key is not null then 'active' else 'off' end),
    coalesce(c.authority_mode, pm.default_authority_mode, 'external'),
    coalesce(c.source, case when pm.module_key is not null then 'plan' else 'plan' end)
  from public.platform_modules m
  left join public.retailer_module_configurations c
    on c.retailer_id = p_retailer_id
   and c.module_key = m.key
  left join lateral (
    select spm.module_key, spm.default_authority_mode
    from public.retailer_subscriptions rs
    join public.subscription_plan_modules spm on spm.plan_id = rs.plan_id
    where rs.retailer_id = p_retailer_id
      and rs.status in ('active', 'trialing')
      and spm.module_key = m.key
    limit 1
  ) pm on true
  order by m.family_order;
end;
$$;

create or replace function public.assert_retailer_module_dependencies(
  p_retailer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflict record;
begin
  select active.module_key, dependency.dependency_key
    into v_conflict
  from public.resolve_retailer_modules(p_retailer_id) active
  join public.platform_modules m on m.key = active.module_key
  cross join lateral unnest(m.dependency_keys) dependency(dependency_key)
  left join public.resolve_retailer_modules(p_retailer_id) required
    on required.module_key = dependency.dependency_key
  where active.state = 'active'
    and coalesce(required.state, 'off') <> 'active'
  limit 1;

  if found then
    raise check_violation using message = format(
      'Module %s requires active module %s.',
      v_conflict.module_key,
      v_conflict.dependency_key
    );
  end if;
end;
$$;

create or replace function public.set_retailer_module_configuration(
  p_retailer_id uuid,
  p_module_key text,
  p_state text,
  p_authority_mode text,
  p_source text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_staff()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using
      message = 'Only platform staff can configure retailer modules.';
  end if;

  insert into public.retailer_module_configurations (
    retailer_id, module_key, state, authority_mode, source, reason,
    configured_by_user_id
  ) values (
    p_retailer_id, p_module_key, p_state, p_authority_mode, p_source,
    nullif(btrim(coalesce(p_reason, '')), ''), auth.uid()
  )
  on conflict (retailer_id, module_key) do update set
    state = excluded.state,
    authority_mode = excluded.authority_mode,
    source = excluded.source,
    reason = excluded.reason,
    configured_by_user_id = excluded.configured_by_user_id
  where (
    retailer_module_configurations.state,
    retailer_module_configurations.authority_mode,
    retailer_module_configurations.source,
    retailer_module_configurations.reason
  ) is distinct from (
    excluded.state,
    excluded.authority_mode,
    excluded.source,
    excluded.reason
  )
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.retailer_module_configurations
    where retailer_id = p_retailer_id and module_key = p_module_key;
  end if;

  perform public.assert_retailer_module_dependencies(p_retailer_id);
  return v_id;
end;
$$;

create or replace function public.audit_retailer_module_configuration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.retailer_module_configuration_events (
    retailer_id, module_key, previous_state, next_state,
    previous_authority_mode, next_authority_mode, source, reason,
    changed_by_user_id
  ) values (
    new.retailer_id,
    new.module_key,
    case when tg_op = 'UPDATE' then old.state else null end,
    new.state,
    case when tg_op = 'UPDATE' then old.authority_mode else null end,
    new.authority_mode,
    new.source,
    new.reason,
    new.configured_by_user_id
  );
  return new;
end;
$$;

create or replace function public.replace_subscription_plan_modules(
  p_plan_id uuid,
  p_module_keys text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module_keys text[];
  v_conflict record;
begin
  if not public.is_platform_staff()
    and coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using
      message = 'Only platform staff can edit plan modules.';
  end if;

  select array_agg(distinct module_key order by module_key)
    into v_module_keys
  from unnest(coalesce(p_module_keys, '{}')) as requested(module_key);

  if coalesce(cardinality(v_module_keys), 0) = 0
    or not ('platform_core' = any(v_module_keys)) then
    raise check_violation using
      message = 'A plan must include Platform Core.';
  end if;

  select module.key, dependency.dependency_key
    into v_conflict
  from public.platform_modules module
  cross join lateral unnest(module.dependency_keys) dependency(dependency_key)
  where module.key = any(v_module_keys)
    and not (dependency.dependency_key = any(v_module_keys))
  limit 1;
  if found then
    raise check_violation using message = format(
      'Plan module %s requires module %s.',
      v_conflict.key,
      v_conflict.dependency_key
    );
  end if;

  delete from public.subscription_plan_modules where plan_id = p_plan_id;
  insert into public.subscription_plan_modules (
    plan_id, module_key, default_authority_mode
  )
  select
    p_plan_id,
    module_key,
    case when module_key = 'platform_core' then 'paon' else 'co_managed' end
  from unnest(v_module_keys) as selected(module_key);
end;
$$;

create trigger audit_retailer_module_configuration
  after insert or update on public.retailer_module_configurations
  for each row execute function public.audit_retailer_module_configuration();

create or replace function public.retailer_module_job_enabled(
  p_retailer_id uuid,
  p_job_key text
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.resolve_retailer_modules(p_retailer_id) configured
    join public.platform_modules module on module.key = configured.module_key
    where configured.state = 'active'
      and p_job_key = any(module.job_keys)
  );
$$;

-- Map the existing three commercial plans without changing their prices or
-- names. Platform staff can replace these bundles later through the catalogue.
insert into public.subscription_plan_modules (
  plan_id, module_key, default_authority_mode
)
select p.id, bundle.module_key, bundle.authority_mode
from public.subscription_plans p
cross join lateral (
  select module_key, authority_mode
  from (values
    ('fused_monthly', 'platform_core', 'paon'),
    ('fused_monthly', 'relationship_intelligence', 'co_managed'),
    ('half_canvas_monthly', 'platform_core', 'paon'),
    ('half_canvas_monthly', 'relationship_intelligence', 'co_managed'),
    ('half_canvas_monthly', 'wardrobe_styling', 'co_managed'),
    ('half_canvas_monthly', 'commerce_growth', 'co_managed'),
    ('full_canvas_monthly', 'platform_core', 'paon'),
    ('full_canvas_monthly', 'relationship_intelligence', 'co_managed'),
    ('full_canvas_monthly', 'wardrobe_styling', 'co_managed'),
    ('full_canvas_monthly', 'commerce_growth', 'co_managed'),
    ('full_canvas_monthly', 'garment_service_operations', 'co_managed'),
    ('full_canvas_monthly', 'retail_operations', 'co_managed'),
    ('full_canvas_monthly', 'enterprise_verticals', 'co_managed'),
    ('full_canvas_monthly', 'network_ecosystem', 'co_managed')
  ) as configured(plan_key, module_key, authority_mode)
  where configured.plan_key = p.key
) bundle
on conflict do nothing;

-- Preserve the routes existing tenants could already use before the module
-- kernel. This is a migration compatibility override, not a future default:
-- newly onboarded retailers derive access from their plan/add-ons.
insert into public.retailer_module_configurations (
  retailer_id, module_key, state, authority_mode, source, reason
)
select
  retailer.id,
  module.key,
  'active',
  case when module.key = 'platform_core' then 'paon' else 'co_managed' end,
  'override',
  'Legacy access preserved during module migration'
from public.retailers retailer
cross join public.platform_modules module
on conflict (retailer_id, module_key) do nothing;

alter table public.platform_modules enable row level security;
alter table public.subscription_plan_modules enable row level security;
alter table public.retailer_module_configurations enable row level security;
alter table public.retailer_module_configuration_events enable row level security;

create policy "anyone reads module catalogue"
  on public.platform_modules for select using (true);

create policy "public reads modules in public plans"
  on public.subscription_plan_modules for select using (
    exists (
      select 1 from public.subscription_plans p
      where p.id = subscription_plan_modules.plan_id and p.is_public
    )
    or public.is_platform_staff()
  );

create policy "retailer staff read own module configuration"
  on public.retailer_module_configurations for select to authenticated using (
    retailer_id = public.current_retailer_id() or public.is_platform_staff()
  );

create policy "platform staff manage retailer module configuration"
  on public.retailer_module_configurations for all to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff read own module history"
  on public.retailer_module_configuration_events for select to authenticated using (
    retailer_id = public.current_retailer_id() or public.is_platform_staff()
  );

grant select on table public.platform_modules
  to anon, authenticated, service_role;
grant select on table public.subscription_plan_modules
  to anon, authenticated, service_role;
grant select on table public.retailer_module_configurations,
  public.retailer_module_configuration_events
  to authenticated, service_role;
grant insert, update, delete on table public.retailer_module_configurations
  to authenticated, service_role;
grant all on table public.platform_modules, public.subscription_plan_modules,
  public.retailer_module_configuration_events
  to service_role;

revoke all on function public.resolve_retailer_modules(uuid) from public, anon;
grant execute on function public.resolve_retailer_modules(uuid)
  to authenticated, service_role;
revoke all on function public.assert_retailer_module_dependencies(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.set_retailer_module_configuration(
  uuid, text, text, text, text, text
) from public, anon;
grant execute on function public.set_retailer_module_configuration(
  uuid, text, text, text, text, text
) to authenticated, service_role;
revoke all on function public.audit_retailer_module_configuration()
  from public, anon, authenticated, service_role;
revoke all on function public.replace_subscription_plan_modules(uuid, text[])
  from public, anon;
grant execute on function public.replace_subscription_plan_modules(uuid, text[])
  to authenticated, service_role;
revoke all on function public.retailer_module_job_enabled(uuid, text)
  from public, anon;
grant execute on function public.retailer_module_job_enabled(uuid, text)
  to authenticated, service_role;

comment on table public.platform_modules is
  'R0.3 deployable PAON module-family registry. Fine-grained commercial features remain ADR-040 capabilities inside these coherent boundaries.';
comment on table public.retailer_module_configurations is
  'Explicit add-on or override lifecycle and authority configuration. Historical data is retained when a module is off or suspended.';
