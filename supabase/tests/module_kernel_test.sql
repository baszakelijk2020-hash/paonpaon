begin;
select plan(15);

select is(
  (select count(*) from public.platform_modules),
  8::bigint,
  'the catalogue contains the eight committed module families'
);

select is(
  (
    select count(*)
    from public.platform_modules module
    cross join lateral unnest(module.dependency_keys) dependency(module_key)
    left join public.platform_modules required on required.key = dependency.module_key
    where required.key is null
  ),
  0::bigint,
  'every declared module dependency exists'
);

select is(
  (
    select count(*)
    from public.subscription_plan_modules modules
    join public.subscription_plans plan on plan.id = modules.plan_id
    where plan.key = 'fused_monthly'
  ),
  2::bigint,
  'the foundation plan has core plus relationship intelligence'
);

select is(
  (
    select count(*)
    from public.subscription_plan_modules modules
    join public.subscription_plans plan on plan.id = modules.plan_id
    where plan.key = 'full_canvas_monthly'
  ),
  8::bigint,
  'the full plan composes all module families'
);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Module House A Ltd', 'Module House A', 'module-house-a', 'active'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Module House B Ltd', 'Module House B', 'module-house-b', 'active'
  );

insert into public.retailer_subscriptions (
  retailer_id, plan_id, status
)
select
  'a1000000-0000-0000-0000-000000000001', id, 'active'
from public.subscription_plans
where key = 'full_canvas_monthly';

select set_config('request.jwt.claim.role', 'service_role', true);

select throws_ok(
  $$
    select public.replace_subscription_plan_modules(
      (select id from public.subscription_plans where key = 'fused_monthly'),
      array['platform_core', 'network_ecosystem']
    )
  $$,
  '23514',
  'Plan module network_ecosystem requires module commerce_growth.',
  'a commercial plan cannot be saved with missing dependencies'
);

select lives_ok(
  $$
    select public.replace_subscription_plan_modules(
      (select id from public.subscription_plans where key = 'fused_monthly'),
      array[
        'platform_core',
        'relationship_intelligence',
        'wardrobe_styling'
      ]
    )
  $$,
  'a complete commercial plan bundle is replaced atomically'
);

select is(
  (
    select count(*)
    from public.subscription_plan_modules modules
    join public.subscription_plans plan on plan.id = modules.plan_id
    where plan.key = 'fused_monthly'
  ),
  3::bigint,
  'the plan replacement has exactly the requested modules'
);

select is(
  (
    select count(*)
    from public.resolve_retailer_modules(
      'a1000000-0000-0000-0000-000000000001'
    )
    where state = 'active'
  ),
  8::bigint,
  'an active full-plan retailer resolves all eight modules as active'
);

select ok(
  public.retailer_module_job_enabled(
    'a1000000-0000-0000-0000-000000000001',
    'inventory_drift_monitor'
  ),
  'a job is enabled when its owning module is active'
);

select throws_ok(
  $$
    select public.set_retailer_module_configuration(
      'a1000000-0000-0000-0000-000000000001',
      'relationship_intelligence',
      'off',
      'co_managed',
      'override',
      'Commercial suspension test'
    )
  $$,
  '23514',
  'Module wardrobe_styling requires active module relationship_intelligence.',
  'a required dependency cannot be disabled beneath active modules'
);

select is(
  (
    select count(*)
    from public.retailer_module_configurations
    where retailer_id = 'a1000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'a dependency failure rolls the configuration and audit event back'
);

select lives_ok(
  $$
    select public.set_retailer_module_configuration(
      'a1000000-0000-0000-0000-000000000001',
      'network_ecosystem',
      'suspended',
      'co_managed',
      'override',
      'Partner activation is paused'
    )
  $$,
  'a leaf module can be suspended without deleting its history'
);

select ok(
  not public.retailer_module_job_enabled(
    'a1000000-0000-0000-0000-000000000001',
    'partner_attribution_reconciliation'
  )
  and (
    select count(*) = 1
    from public.retailer_module_configuration_events
    where retailer_id = 'a1000000-0000-0000-0000-000000000001'
      and module_key = 'network_ecosystem'
      and next_state = 'suspended'
  ),
  'suspension suppresses jobs and leaves one audit event'
);

select lives_ok(
  $$
    select public.set_retailer_module_configuration(
      'a1000000-0000-0000-0000-000000000001',
      'network_ecosystem',
      'suspended',
      'co_managed',
      'override',
      'Partner activation is paused'
    )
  $$,
  'replaying an identical module configuration is safe'
);

select is(
  (
    select count(*)
    from public.retailer_module_configuration_events
    where retailer_id = 'a1000000-0000-0000-0000-000000000001'
      and module_key = 'network_ecosystem'
  ),
  1::bigint,
  'an identical configuration replay does not duplicate audit history'
);

select * from finish();
rollback;
