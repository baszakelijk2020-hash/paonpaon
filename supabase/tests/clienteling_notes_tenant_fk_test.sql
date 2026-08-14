-- Proof for 20260815000020: a clienteling note can no longer be attached to
-- another retailer's customer.
--
-- The realistic attack is a crafted POST straight to createClientelingNote
-- (apps/retailer/app/(dashboard)/customers/[id]/actions.ts), which trusts a
-- client-supplied customerId. The insert policy
-- ("sales staff create clienteling notes") checks the note's own
-- retailer_id, the caller's role, and that author_staff_id is really the
-- caller — but never that customer_id belongs to the caller's retailer.
--
-- So the negative case below runs as a fully authenticated House B sales
-- associate writing a row that satisfies every RLS condition, and expects
-- 23503. A 42501 would mean RLS blocked it first and the foreign key went
-- untested.

begin;
select plan(5);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'Notes House A Ltd', 'Notes House A', 'notes-house-a', 'active'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Notes House B Ltd', 'Notes House B', 'notes-house-b', 'active'
  );

insert into public.customers (id, retailer_id, full_name)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001', 'House A Private Client'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002', 'House B Client'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'c4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'notes.houseb@example.test', '{}', '{}', now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'c5000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000002',
  'c4000000-0000-0000-0000-000000000002',
  'House B Associate', 'notes.houseb@example.test', 'sales_associate', now()
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where conname = 'clienteling_notes_customer_retailer_fkey'
      and contype = 'f'
  ),
  1,
  'clienteling_notes carries the composite tenant foreign key'
);

-- The unique constraint this fix depends on already existed on main, added
-- incidentally by 20260814000000_add_store_feedback_signals for its own
-- composite key. Assert there is exactly one — proving 20260815000020
-- correctly did not re-add it.
select is(
  (
    select count(*)::int
    from pg_constraint
    where conname = 'customers_id_retailer_id_key'
  ),
  1,
  'customers has exactly one (id, retailer_id) unique constraint, not a duplicate'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "c4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "c1000000-0000-0000-0000-000000000002",
    "retailer_role": "sales_associate"
  }
}';

select throws_ok(
  $$
    insert into public.clienteling_notes (
      retailer_id, customer_id, author_staff_id, body
    ) values (
      'c1000000-0000-0000-0000-000000000002',
      'c2000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000002',
      'Injected note on another retailer''s client'
    )
  $$,
  '23503',
  null,
  'an authenticated House B associate cannot write a note against House A''s customer'
);

select lives_ok(
  $$
    insert into public.clienteling_notes (
      retailer_id, customer_id, author_staff_id, body
    ) values (
      'c1000000-0000-0000-0000-000000000002',
      'c2000000-0000-0000-0000-000000000002',
      'c5000000-0000-0000-0000-000000000002',
      'Legitimate note on their own client'
    )
  $$,
  'the same associate can still write a note against their own customer'
);

reset request.jwt.claims;
set local role none;

select is(
  (
    select count(*)::int
    from public.clienteling_notes
    where customer_id = 'c2000000-0000-0000-0000-000000000001'
  ),
  0,
  'House A''s customer holds no note after the cross-tenant attempt'
);

select * from finish();
rollback;
