begin;
select plan(4);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd1110000-0000-0000-0000-000000000001',
  'Open Entry Invariant Ltd',
  'Open Entry Invariant',
  'open-entry-invariant',
  'active'
);

insert into public.retailer_staff_members (
  id, retailer_id, full_name, email, role, accepted_at
) values
  (
    'd1110000-0000-0000-0000-000000000011',
    'd1110000-0000-0000-0000-000000000001',
    'Open Entry Staff One',
    'open-entry-one@example.test',
    'sales_associate',
    now()
  ),
  (
    'd1110000-0000-0000-0000-000000000012',
    'd1110000-0000-0000-0000-000000000001',
    'Open Entry Staff Two',
    'open-entry-two@example.test',
    'sales_associate',
    now()
  );

select has_index(
  'public',
  'staff_time_entries',
  'staff_time_entries_one_open_per_staff_idx',
  'open time entries have a per-staff unique index'
);

insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at)
values (
  'd1110000-0000-0000-0000-000000000001',
  'd1110000-0000-0000-0000-000000000011',
  now() - interval '2 hours'
);

select throws_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id)
    values (
      'd1110000-0000-0000-0000-000000000001',
      'd1110000-0000-0000-0000-000000000011'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "staff_time_entries_one_open_per_staff_idx"',
  'a staff member cannot have a second open time entry'
);

update public.staff_time_entries
set clock_out_at = now() - interval '1 hour'
where staff_id = 'd1110000-0000-0000-0000-000000000011'
  and clock_out_at is null;

select lives_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id)
    values (
      'd1110000-0000-0000-0000-000000000001',
      'd1110000-0000-0000-0000-000000000011'
    )
  $$,
  'a staff member can open a new time entry after closing the previous one'
);

select lives_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id)
    values (
      'd1110000-0000-0000-0000-000000000001',
      'd1110000-0000-0000-0000-000000000012'
    )
  $$,
  'a different staff member can have an open time entry'
);

select * from finish();
rollback;
