begin;
select plan(8);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values (
  'f1000000-0000-0000-0000-000000000001',
  'Wardrobe Try-On Test Ltd',
  'Wardrobe Try-On Test',
  'wardrobe-try-on-test',
  'active'
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
  'f1000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'wardrobe-try-on-customer@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.customers (
  id, retailer_id, user_id, full_name, email
) values (
  'f1000000-0000-0000-0000-000000000003',
  'f1000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000002',
  'Wardrobe Try-On Customer',
  'wardrobe-try-on-customer@example.test'
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'f1000000-0000-0000-0000-000000000004',
  'f1000000-0000-0000-0000-000000000001',
  null,
  'Wardrobe Try-On Staff',
  'wardrobe-try-on-staff@example.test',
  'manager',
  now()
);

insert into public.outfits (
  id,
  retailer_id,
  customer_id,
  title,
  created_by_staff_id
) values (
  'f1000000-0000-0000-0000-000000000005',
  'f1000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000003',
  'Wardrobe Try-On Look',
  'f1000000-0000-0000-0000-000000000004'
);

-- Retailer creation seeds its default preset. Give that trigger-created row a
-- stable fixture id so every RPC assertion can name the same relationship.
update public.retailer_visual_presets
set id = 'f1000000-0000-0000-0000-000000000006'
where retailer_id = 'f1000000-0000-0000-0000-000000000001'
  and is_default;

insert into public.style_portraits (
  id,
  retailer_id,
  customer_id,
  version,
  status
) values (
  'f1000000-0000-0000-0000-000000000007',
  'f1000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000003',
  1,
  'draft'
);

insert into public.retailer_module_configurations (
  id,
  retailer_id,
  module_key,
  state,
  authority_mode,
  source,
  reason
) values (
  'f1000000-0000-0000-0000-000000000008',
  'f1000000-0000-0000-0000-000000000001',
  'wardrobe_styling',
  'preview',
  'co_managed',
  'override',
  'Queue test'
);

set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claims = '{
  "sub": "f1000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'Wardrobe styling is not active for this retailer',
  'preview wardrobe_styling throws before enqueueing'
);

set local role none;
update public.retailer_module_configurations
set state = 'suspended'
where retailer_id = 'f1000000-0000-0000-0000-000000000001'
  and module_key = 'wardrobe_styling';
set local role authenticated;

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'Wardrobe styling is not active for this retailer',
  'suspended wardrobe_styling throws before enqueueing'
);

set local role none;
update public.retailer_module_configurations
set state = 'off'
where retailer_id = 'f1000000-0000-0000-0000-000000000001'
  and module_key = 'wardrobe_styling';
set local role authenticated;

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'Wardrobe styling is not active for this retailer',
  'off wardrobe_styling throws before enqueueing'
);

set local role none;
update public.retailer_module_configurations
set state = 'active'
where retailer_id = 'f1000000-0000-0000-0000-000000000001'
  and module_key = 'wardrobe_styling';
set local role authenticated;

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'Image-generation consent is not active',
  'missing consent throws before enqueueing'
);

set local role none;
insert into public.style_portrait_consents (
  customer_id,
  retailer_id,
  status,
  disclosures_acknowledged,
  granted_at,
  withdrawn_at
) values (
  'f1000000-0000-0000-0000-000000000003',
  'f1000000-0000-0000-0000-000000000001',
  'withdrawn',
  true,
  null,
  now()
);
set local role authenticated;

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'Image-generation consent is not active',
  'withdrawn consent throws before enqueueing'
);

set local role none;
update public.style_portrait_consents
set status = 'granted',
    disclosures_acknowledged = true,
    granted_at = now(),
    withdrawn_at = null
where customer_id = 'f1000000-0000-0000-0000-000000000003';
set local role authenticated;

select throws_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'P0001',
  'An approved Style Portrait is required',
  'a draft portrait throws before enqueueing'
);

set local role none;
update public.style_portraits
set status = 'approved',
    approved_at = now()
where id = 'f1000000-0000-0000-0000-000000000007';
set local role authenticated;

select lives_ok(
  $$
    select public.enqueue_wardrobe_visualization_job(
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000007',
      'f1000000-0000-0000-0000-000000000006',
      'openai',
      'gpt-image-1',
      '{"look":"single"}'::jsonb,
      'wardrobe-try-on-hash'
    )
  $$,
  'an active module, acknowledged consent, and approved same-House portrait enqueue successfully'
);

select is(
  (
    select count(*)
    from public.wardrobe_visualization_jobs
    where retailer_id = 'f1000000-0000-0000-0000-000000000001'
      and customer_id = 'f1000000-0000-0000-0000-000000000003'
      and outfit_id = 'f1000000-0000-0000-0000-000000000005'
      and style_portrait_id = 'f1000000-0000-0000-0000-000000000007'
      and retailer_visual_preset_id = 'f1000000-0000-0000-0000-000000000006'
      and input_hash = 'wardrobe-try-on-hash'
      and status = 'queued'
  ),
  1::bigint,
  'the successful enqueue creates exactly one queued job'
);

select set_config('role', 'none', true);

select * from finish();
rollback;
