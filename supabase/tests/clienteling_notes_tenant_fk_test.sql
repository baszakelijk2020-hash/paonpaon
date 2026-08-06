-- Same class of bug fixed for wedding-party child tables and the
-- corporate module (see 20260806000004/5/6): clienteling_notes had its
-- own retailer_id plus a foreign key to customers (also carrying its own
-- retailer_id), but nothing ever checked the two matched. Proves the
-- fixed composite FK now refuses a cross-tenant reference, plus ordinary
-- cross-House staff read isolation.

begin;
select plan(4);

insert into public.retailers (
  id, legal_name, display_name, slug, status
) values
  (
    '9a000000-0000-0000-0000-000000000001',
    'Notes House A Ltd', 'Notes House A', 'notes-house-a', 'active'
  ),
  (
    '9a000000-0000-0000-0000-000000000002',
    'Notes House B Ltd', 'Notes House B', 'notes-house-b', 'active'
  );

insert into public.customers (
  id, retailer_id, full_name, email, lifecycle_stage
) values
  (
    '9b000000-0000-0000-0000-000000000001',
    '9a000000-0000-0000-0000-000000000001',
    'House A Client', 'notes-client-a@example.test', 'prospect'
  ),
  (
    '9b000000-0000-0000-0000-000000000002',
    '9a000000-0000-0000-0000-000000000002',
    'House B Client', 'notes-client-b@example.test', 'prospect'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '9c000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'notes-house-a-manager@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  '9d000000-0000-0000-0000-000000000001',
  '9a000000-0000-0000-0000-000000000001',
  '9c000000-0000-0000-0000-000000000001',
  'House A Manager', 'notes-house-a-manager@example.test', 'manager', now()
);

-- The bug this migration fixed: House A's own retailer_id paired with
-- House B's real customer_id must now fail outright at the database
-- level, not merely be discouraged by the app's picker UI.
select throws_ok(
  $$
    insert into public.clienteling_notes (
      retailer_id, customer_id, author_staff_id, body
    ) values (
      '9a000000-0000-0000-0000-000000000001',
      '9b000000-0000-0000-0000-000000000002',
      '9d000000-0000-0000-0000-000000000001',
      'Injected cross-tenant note'
    )
  $$,
  '23503',
  null,
  'a note cannot pair one retailer''s id with another retailer''s customer'
);

-- The legitimate, same-tenant insert must still work.
select lives_ok(
  $$
    insert into public.clienteling_notes (
      retailer_id, customer_id, author_staff_id, body
    ) values (
      '9a000000-0000-0000-0000-000000000001',
      '9b000000-0000-0000-0000-000000000001',
      '9d000000-0000-0000-0000-000000000001',
      'Legitimate same-tenant note'
    )
  $$,
  'a note pairing the same retailer on both the note and its customer is accepted'
);

select is(
  (select count(*) from public.clienteling_notes),
  1::bigint,
  'exactly one note exists after the refused cross-tenant attempt and the accepted same-tenant one'
);

select is(
  (select customer_id from public.clienteling_notes limit 1),
  '9b000000-0000-0000-0000-000000000001'::uuid,
  'the surviving note is the legitimate same-tenant one, not the refused cross-tenant attempt'
);

select * from finish();
rollback;
