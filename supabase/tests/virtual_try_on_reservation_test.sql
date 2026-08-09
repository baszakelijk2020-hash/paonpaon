begin;
select plan(17);

-- Fixture setup with distinct prefix f2000000 to avoid collision with other tests
insert into public.retailers (
  id, legal_name, display_name, slug, status, default_currency
) values (
  'f2000000-0000-0000-0000-000000000001',
  'Virtual Try-On Test Ltd',
  'Virtual Try-On Test',
  'virtual-try-on-test',
  'active',
  'USD'
), (
  'f2000000-0000-0000-0000-000000000099',
  'Second Retailer Ltd',
  'Second Retailer',
  'second-retailer',
  'active',
  'USD'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'f2000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'virtual-try-on-customer@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
), (
  'f2000000-0000-0000-0000-000000000010',
  'authenticated',
  'authenticated',
  'virtual-try-on-staff@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
), (
  'f2000000-0000-0000-0000-0000000000aa',
  'authenticated',
  'authenticated',
  'second-retailer-staff@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.customers (
  id, retailer_id, user_id, full_name, email
) values (
  'f2000000-0000-0000-0000-000000000003',
  'f2000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000002',
  'Virtual Try-On Customer',
  'virtual-try-on-customer@example.test'
), (
  'f2000000-0000-0000-0000-0000000000bb',
  'f2000000-0000-0000-0000-000000000099',
  'f2000000-0000-0000-0000-0000000000aa',
  'Second Retailer Customer',
  'second-retailer-customer@example.test'
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'f2000000-0000-0000-0000-000000000011',
  'f2000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000010',
  'Virtual Try-On Staff',
  'virtual-try-on-staff@example.test',
  'manager',
  now()
), (
  'f2000000-0000-0000-0000-0000000000cc',
  'f2000000-0000-0000-0000-000000000099',
  'f2000000-0000-0000-0000-0000000000aa',
  'Second Retailer Staff',
  'second-retailer-staff@example.test',
  'manager',
  now()
);

-- Seed module configuration in preview state for first retailer, active for second
insert into public.retailer_module_configurations (
  id,
  retailer_id,
  module_key,
  state,
  authority_mode,
  source,
  reason
) values (
  'f2000000-0000-0000-0000-000000000020',
  'f2000000-0000-0000-0000-000000000001',
  'wardrobe_styling',
  'preview',
  'co_managed',
  'override',
  'Virtual try-on reservation test'
), (
  'f2000000-0000-0000-0000-0000000000dd',
  'f2000000-0000-0000-0000-000000000099',
  'wardrobe_styling',
  'active',
  'co_managed',
  'override',
  'Virtual try-on reservation test'
);

-- Policies are auto-seeded by the trigger when retailers are created.
-- Verify the first retailer's default policy exists and is disabled (default state),
-- and enable the second retailer's policy for testing.
update public.retailer_virtual_try_on_policies
set enabled = true, currency = 'USD'
where retailer_id = 'f2000000-0000-0000-0000-000000000099';

-- Set role and JWT for authenticated customer
set local role authenticated;
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "f2000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

-- Test 1: module in preview state → denied with module_not_active
select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).status,
  'denied',
  'preview wardrobe_styling module returns denied status'
);

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).denial_reason,
  'module_not_active',
  'preview module sets correct denial_reason'
);

-- Test 2: module active but policy disabled → denied with retailer_disabled
-- First, activate the module and enable the policy for first retailer
set local role none;
update public.retailer_module_configurations
set state = 'active'
where retailer_id = 'f2000000-0000-0000-0000-000000000001'
  and module_key = 'wardrobe_styling';
set local role authenticated;

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).status,
  'denied',
  'disabled retailer policy returns denied status'
);

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).denial_reason,
  'retailer_disabled',
  'disabled retailer policy sets correct denial_reason'
);

-- Test 3: policy enabled but no consent → denied with image_processing_consent_missing
set local role none;
update public.retailer_virtual_try_on_policies
set enabled = true, allow_image = true, allow_video = false,
    max_customer_generations_per_day = 5, max_customer_generations_per_week = 10,
    max_customer_generations_per_month = 30,
    monthly_budget_minor_units = 100000, per_customer_monthly_budget_minor_units = 100000
where retailer_id = 'f2000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).status,
  'denied',
  'missing consent returns denied status'
);

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).denial_reason,
  'image_processing_consent_missing',
  'missing consent sets correct denial_reason'
);

-- Test 4: grant consent and call should succeed with authorized status
set local role none;
insert into public.style_portrait_consents (
  customer_id,
  retailer_id,
  status,
  disclosures_acknowledged,
  granted_at,
  withdrawn_at
) values (
  'f2000000-0000-0000-0000-000000000003',
  'f2000000-0000-0000-0000-000000000001',
  'granted',
  true,
  now(),
  null
);
set local role authenticated;

select set_config('paon.test_first_ledger_id', (
  public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )
).id::text, true);

select is(
  (
    select status
    from public.virtual_try_on_usage_ledger
    where id = current_setting('paon.test_first_ledger_id')::uuid
  ),
  'authorized',
  'with consent and enabled policy returns authorized status'
);

select is(
  (
    select estimated_cost_minor_units
    from public.virtual_try_on_usage_ledger
    where id = current_setting('paon.test_first_ledger_id')::uuid
  ),
  100000,
  'authorized call reserves correct estimated cost'
);

select is(
  (
    select count(*)
    from public.virtual_try_on_usage_ledger
    where customer_id = 'f2000000-0000-0000-0000-000000000003'
      and retailer_id = 'f2000000-0000-0000-0000-000000000001'
      and status = 'authorized'
  ),
  1::bigint,
  'authorized call creates exactly one authorized ledger row'
);

-- Test 5: cache_hit call → status = cache_hit, settled_at is not null
select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    true,
    true
  )).status,
  'cache_hit',
  'cache_hit call returns cache_hit status'
);

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    true,
    true
  )).settled_at is not null,
  true,
  'cache_hit call is settled immediately'
);

-- Test 6: daily quota exhausted → denied with daily_quota_exhausted
set local role none;
update public.retailer_virtual_try_on_policies
set max_customer_generations_per_day = 0
where retailer_id = 'f2000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).status,
  'denied',
  'exhausted daily quota returns denied status'
);

select is(
  (public.reserve_virtual_try_on_generation(
    'f2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000003',
    null,
    null,
    'openai',
    'gpt-image-1',
    'https://api.openai.com',
    'image',
    'preview',
    'customer_try_on',
    array[]::text[],
    false,
    100000,
    'USD',
    false,
    true
  )).denial_reason,
  'daily_quota_exhausted',
  'exhausted daily quota sets correct denial_reason'
);

-- Test 7: settle_virtual_try_on_generation as service_role
-- Use the authorized ledger_id stored in test 4
set local role none;
set local role service_role;

select is(
  (public.settle_virtual_try_on_generation(
    current_setting('paon.test_first_ledger_id')::uuid,
    'succeeded',
    null,
    null,
    100000,
    'USD'
  )).status,
  'succeeded',
  'settle_virtual_try_on_generation with succeeded status works'
);

select is(
  (
    select settled_at is not null
    from public.virtual_try_on_usage_ledger
    where id = current_setting('paon.test_first_ledger_id')::uuid
  ),
  true,
  'settled row has settled_at timestamp'
);

-- Test 8: settle the same row again → throws error
select throws_ok(
  $$
    select public.settle_virtual_try_on_generation(
      current_setting('paon.test_first_ledger_id')::uuid,
      'succeeded',
      null,
      null,
      100000,
      'USD'
    )
  $$,
  'Ledger row not found or already settled',
  'settling already-settled row throws correct error'
);

-- Test 9: tenant isolation via RLS
-- Second retailer staff should see zero rows from first retailer
set local role none;
set local role authenticated;
set local request.jwt.claim.sub = 'f2000000-0000-0000-0000-0000000000aa';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "f2000000-0000-0000-0000-0000000000aa",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "f2000000-0000-0000-0000-000000000099",
    "retailer_role": "manager"
  }
}';

select is(
  (
    select count(*)
    from public.virtual_try_on_usage_ledger
    where retailer_id = 'f2000000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'staff from second retailer cannot read ledger rows from first retailer (RLS isolation)'
);

select * from finish();
rollback;
