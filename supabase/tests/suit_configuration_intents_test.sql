-- FT-07 Lapel/pocket/shoulder configurator (docs/FOUNDER_TOOL_BLUEPRINTS.md) —
-- closes the blueprint's own named "cross-House isolation" proof gap for
-- suit_configuration_intents: this table had RLS and a narrow save RPC
-- since 20260802000008, but zero pgTAP coverage ever exercised either.

begin;
select plan(11);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_suit_configuration_intent(uuid,text,text,text,smallint)',
    'EXECUTE'
  ),
  'anonymous callers cannot invoke the suit configuration save command'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_suit_configuration_intent(uuid,text,text,text,smallint)',
    'EXECUTE'
  ),
  'authenticated customers can invoke the suit configuration save command'
);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    '91000000-0000-0000-0000-000000000001',
    'Configurator House A Ltd', 'Configurator House A', 'configurator-house-a', 'active'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'Configurator House B Ltd', 'Configurator House B', 'configurator-house-b', 'active'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '92000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'configurator-shopper@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'configurator-house-a-manager@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '92000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'configurator-house-b-manager@example.test',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values
  (
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002',
    'House A Manager', 'configurator-house-a-manager@example.test', 'manager', now()
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000003',
    'House B Manager', 'configurator-house-b-manager@example.test', 'manager', now()
  );

-- The same shopper explores the configurator on both retailers' storefronts
-- — a real scenario, not a contrived one: the widget is a pixel-exact port
-- served per-retailer, and nothing stops one shopper visiting two houses.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "92000000-0000-0000-0000-000000000001",
  "role": "authenticated"
}';

select lives_ok(
  $$
    select public.save_suit_configuration_intent(
      '91000000-0000-0000-0000-000000000001', 'peak', 'flap', 'roped', 2::smallint
    )
  $$,
  'the shopper can save a configuration intent at House A'
);

select lives_ok(
  $$
    select public.save_suit_configuration_intent(
      '91000000-0000-0000-0000-000000000002', 'notch', 'jetted', 'natural', 1::smallint
    )
  $$,
  'the same shopper can also save a configuration intent at House B'
);

select is(
  (
    select retailer_id from public.suit_configuration_intents
    where lapel = 'peak'
  ),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'the House A intent is scoped to House A, not the caller-supplied model preset or any other tenant'
);

select is(
  (
    select retailer_id from public.suit_configuration_intents
    where lapel = 'notch'
  ),
  '91000000-0000-0000-0000-000000000002'::uuid,
  'the House B intent is scoped to House B'
);

select is(
  (
    select count(distinct customer_id) from public.suit_configuration_intents
    where lapel in ('peak', 'notch')
  ),
  2::bigint,
  'the shopper gets two distinct tenant-scoped customer relationships, not one shared across retailers'
);

select is(
  (
    select count(*) from public.suit_configuration_intents
    where customer_id in (
      select id from public.customers where user_id = auth.uid()
    )
  ),
  2::bigint,
  'the shopper can read both of their own intents regardless of which retailer each belongs to'
);

-- Cross-House isolation: the named gap. House A staff must see House A's
-- intent and must NOT see House B's, even though both intents belong to
-- the exact same shopper.
reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "92000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "91000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*) from public.suit_configuration_intents),
  1::bigint,
  'House A staff see exactly their own retailer''s intent, never House B''s'
);

select is(
  (select lapel from public.suit_configuration_intents limit 1),
  'peak',
  'the one intent House A staff can see is House A''s own, not House B''s'
);

reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "92000000-0000-0000-0000-000000000003",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "91000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select is(
  (select lapel from public.suit_configuration_intents limit 1),
  'notch',
  'symmetrically, House B staff see only House B''s own intent'
);

select * from finish();
rollback;
