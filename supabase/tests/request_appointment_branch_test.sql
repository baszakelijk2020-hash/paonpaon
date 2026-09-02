begin;
select plan(4);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd7000000-0000-0000-0000-000000000001', 'Branch Appointment Test Ltd',
  'Branch Appointment Test', 'branch-appointment-test', 'active'
), (
  'd7000000-0000-0000-0000-000000000009', 'Branch Appointment Other Ltd',
  'Branch Appointment Other', 'branch-appointment-other', 'active'
);

insert into public.retailer_branches (id, retailer_id, name, timezone, is_default)
values (
  'd7000000-0000-0000-0000-000000000002', 'd7000000-0000-0000-0000-000000000001',
  'Flagship', 'Europe/Paris', true
), (
  'd7000000-0000-0000-0000-000000000003', 'd7000000-0000-0000-0000-000000000009',
  'Other Retailer Branch', 'Europe/Paris', true
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd7000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'branch-appt-customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "d7000000-0000-0000-0000-000000000004",
  "role": "authenticated"
}';

-- A real branch belonging to the same retailer is accepted and persisted.
select isnt(
  (
    select public.request_appointment(
      'd7000000-0000-0000-0000-000000000001', 'fitting',
      now() + interval '1 day', now() + interval '1 day 1 hour', null,
      'd7000000-0000-0000-0000-000000000002'
    )
  ),
  null,
  'a real same-retailer branch is accepted'
);

select is(
  (
    select branch_id::text from public.appointments
    where retailer_id = 'd7000000-0000-0000-0000-000000000001'
    order by created_at desc limit 1
  ),
  'd7000000-0000-0000-0000-000000000002',
  'the requested branch is persisted on the appointment'
);

-- A branch belonging to a different retailer is refused, not silently
-- accepted or silently dropped.
select throws_ok(
  $$
    select public.request_appointment(
      'd7000000-0000-0000-0000-000000000001', 'fitting',
      now() + interval '1 day', now() + interval '1 day 1 hour', null,
      'd7000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001',
  'Branch does not belong to this retailer',
  'a cross-retailer branch is refused'
);

-- Omitting the branch entirely still works (backward compatible).
select isnt(
  (
    select public.request_appointment(
      'd7000000-0000-0000-0000-000000000001', 'fitting',
      now() + interval '2 day', now() + interval '2 day 1 hour', null
    )
  ),
  null,
  'omitting the branch still books a real appointment'
);

select * from finish();
rollback;
