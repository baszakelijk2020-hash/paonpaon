begin;
select plan(6);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd6000000-0000-0000-0000-000000000001', 'Wearer Appointment Test Ltd',
  'Wearer Appointment Test', 'wearer-appointment-test', 'active'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd6000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'wearer-appt-linked@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd6000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
  'wearer-appt-unlinked@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  'd6000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'wearer-appt-impersonator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.customers (id, retailer_id, user_id, full_name, email)
values (
  'd6000000-0000-0000-0000-000000000005', 'd6000000-0000-0000-0000-000000000001',
  null, 'Wearer Appointment Customer', 'wearer-appt-customer@example.test'
);

insert into public.corporate_accounts (id, retailer_id, legal_name, account_reference)
values ('d6000000-0000-0000-0000-000000000006', 'd6000000-0000-0000-0000-000000000001', 'Wearer Appt Account', 'WAPPT-1');

insert into public.corporate_programmes (id, retailer_id, account_id, name)
values ('d6000000-0000-0000-0000-000000000007', 'd6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000006', 'Wearer Appt Programme');

insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id, customer_id)
values (
  'd6000000-0000-0000-0000-000000000008', 'd6000000-0000-0000-0000-000000000001',
  'd6000000-0000-0000-0000-000000000007', 'WAPPT-REF-1', 'Linked Wearer', 'associate',
  '2025-01-01', 'd6000000-0000-0000-0000-000000000002', 'd6000000-0000-0000-0000-000000000005'
);

-- A wearer with no linked customer.
insert into public.corporate_wearers (id, retailer_id, programme_id, employee_reference, display_name, role_key, joined_on, user_id)
values (
  'd6000000-0000-0000-0000-000000000009', 'd6000000-0000-0000-0000-000000000001',
  'd6000000-0000-0000-0000-000000000007', 'WAPPT-REF-2', 'Unlinked Wearer', 'associate',
  '2025-01-01', 'd6000000-0000-0000-0000-000000000003'
);

-- The linked wearer can request a real appointment for their own linked
-- customer.
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d6000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select isnt(
  (
    select public.request_appointment_as_wearer(
      'd6000000-0000-0000-0000-000000000008', 'fitting',
      now() + interval '1 day', now() + interval '1 day 1 hour', 'First fitting'
    )
  ),
  null,
  'a linked wearer can request a real appointment'
);

select is(
  (
    select count(*)::int from public.appointments
    where customer_id = 'd6000000-0000-0000-0000-000000000005'
      and type = 'fitting'
  ),
  1,
  'the appointment is persisted under the wearer''s real linked customer_id'
);

-- No shadow customer was ever created.
reset role;
select is(
  (
    select count(*)::int from public.customers
    where retailer_id = 'd6000000-0000-0000-0000-000000000001'
  ),
  1,
  'no shadow customer row is ever created for the wearer'
);

-- An unlinked wearer is refused with a clear reason, not a shadow-customer
-- fallback.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d6000000-0000-0000-0000-000000000003",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.request_appointment_as_wearer(
      'd6000000-0000-0000-0000-000000000009', 'fitting',
      now() + interval '1 day', now() + interval '1 day 1 hour', null
    )
  $$,
  'P0001',
  'Link your Employee Portal account with a manager before requesting an appointment',
  'an unlinked wearer is refused with a clear reason'
);

-- A different authenticated user cannot request on the linked wearer's
-- behalf by guessing their wearer id.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d6000000-0000-0000-0000-000000000004",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.request_appointment_as_wearer(
      'd6000000-0000-0000-0000-000000000008', 'fitting',
      now() + interval '1 day', now() + interval '1 day 1 hour', null
    )
  $$,
  'P0001',
  'Not authorized to request an appointment for this wearer',
  'a different authenticated user cannot request on another wearer''s behalf'
);

-- starts_at must be before ends_at.
set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d6000000-0000-0000-0000-000000000002",
  "role": "authenticated"
}';

select throws_ok(
  $$
    select public.request_appointment_as_wearer(
      'd6000000-0000-0000-0000-000000000008', 'fitting',
      now() + interval '1 hour', now(), null
    )
  $$,
  'P0001',
  'starts_at must be before ends_at',
  'starts_at must be before ends_at'
);

select * from finish();
rollback;
