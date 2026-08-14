-- Proof for 20260815000000: the wedding-party child tables can no longer be
-- attached across tenants.
--
-- The attack this proves is closed is NOT a superuser one. It is an
-- ordinary, fully authenticated House B manager doing something RLS
-- explicitly permits: writing a row whose own retailer_id really is House
-- B's. The insert policy
-- (wedding_guest_vouchers_staff_insert) checks only
-- `retailer_id = current_retailer_id()` and the caller's role — it never
-- looks at whose wedding party the row points to. So RLS says yes, and
-- before the composite foreign key existed the row landed on House A's
-- wedding party, where House A's organizer could then read it via
-- is_wedding_party_organizer_or_member().
--
-- Every negative case below therefore runs as `authenticated` with real
-- House B JWT claims, and expects 23503 (foreign_key_violation) — not
-- 42501. A 42501 here would mean RLS stopped the write first and the test
-- proved nothing about the foreign key.
--
-- wedding_guest_vouchers carries value_minor_units, so this is the
-- money-bearing case.

begin;
select plan(9);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'Wedding House A Ltd', 'Wedding House A', 'wedding-house-a', 'active'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Wedding House B Ltd', 'Wedding House B', 'wedding-house-b', 'active'
  );

insert into public.customers (id, retailer_id, full_name)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', 'House A Organizer'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002', 'House B Organizer'
  );

insert into public.wedding_parties (id, retailer_id, organizer_customer_id)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'a4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'wedding.houseb@example.test', '{}', '{}', now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'a5000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000002',
  'a4000000-0000-0000-0000-000000000002',
  'House B Manager', 'wedding.houseb@example.test', 'manager', now()
);

-- Schema proof: all five composite keys are actually present.
select is(
  (
    select count(*)::int
    from pg_constraint
    where contype = 'f'
      and conname in (
        'wedding_inspiration_items_party_retailer_fkey',
        'wedding_design_choices_party_retailer_fkey',
        'wedding_group_fittings_party_retailer_fkey',
        'wedding_guest_vouchers_party_retailer_fkey',
        'wedding_aftercare_plans_party_retailer_fkey'
      )
  ),
  5,
  'all five wedding-party child tables carry the composite tenant foreign key'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "a4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "a1000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

-- The money case. RLS permits this row; only the foreign key stops it.
select throws_ok(
  $$
    insert into public.wedding_guest_vouchers (
      retailer_id, wedding_party_id, guest_label, value_minor_units,
      funding_source, expires_on
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000001',
      'Injected cross-tenant voucher', 999999, 'couple', current_date + 30
    )
  $$,
  '23503',
  null,
  'an authenticated House B manager cannot attach a voucher to House A''s wedding party'
);

-- Positive control: the same caller, same table, their own party. If this
-- failed, the fix would be over-blocking legitimate work.
select lives_ok(
  $$
    insert into public.wedding_guest_vouchers (
      retailer_id, wedding_party_id, guest_label, value_minor_units,
      funding_source, expires_on
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000002',
      'Legitimate House B voucher', 5000, 'couple', current_date + 30
    )
  $$,
  'the same manager can still attach a voucher to their own wedding party'
);

-- Insert is not the only way in. Re-parenting an already-legitimate row is
-- the same attack one step later, and a foreign key that only guarded
-- INSERT would leave it wide open.
select throws_ok(
  $$
    update public.wedding_guest_vouchers
    set wedding_party_id = 'a3000000-0000-0000-0000-000000000001'
    where guest_label = 'Legitimate House B voucher'
  $$,
  '23503',
  null,
  'an existing House B voucher cannot be re-parented onto House A''s wedding party'
);

select throws_ok(
  $$
    insert into public.wedding_inspiration_items (
      retailer_id, wedding_party_id, note
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000001',
      'Injected cross-tenant inspiration note'
    )
  $$,
  '23503',
  null,
  'an inspiration item cannot be attached to another retailer''s wedding party'
);

select throws_ok(
  $$
    insert into public.wedding_design_choices (
      retailer_id, wedding_party_id, slot_key, value_key
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000001',
      'lapel', 'peak'
    )
  $$,
  '23503',
  null,
  'a design choice cannot be attached to another retailer''s wedding party'
);

select throws_ok(
  $$
    insert into public.wedding_group_fittings (
      retailer_id, wedding_party_id, scheduled_at, capacity
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000001',
      now() + interval '7 days', 4
    )
  $$,
  '23503',
  null,
  'a group fitting cannot be attached to another retailer''s wedding party'
);

select throws_ok(
  $$
    insert into public.wedding_aftercare_plans (
      retailer_id, wedding_party_id, instruction
    ) values (
      'a1000000-0000-0000-0000-000000000002',
      'a3000000-0000-0000-0000-000000000001',
      'Injected aftercare instruction'
    )
  $$,
  '23503',
  null,
  'an aftercare plan cannot be attached to another retailer''s wedding party'
);

reset request.jwt.claims;
set local role none;

-- Nothing leaked into House A's party from any of the attempts above.
select is(
  (
    select count(*)::int
    from public.wedding_guest_vouchers
    where wedding_party_id = 'a3000000-0000-0000-0000-000000000001'
  ),
  0,
  'House A''s wedding party holds no voucher after every cross-tenant attempt'
);

select * from finish();
rollback;
