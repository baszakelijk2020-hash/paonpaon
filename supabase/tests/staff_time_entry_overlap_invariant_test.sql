begin;
select plan(5);

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'd2220000-0000-0000-0000-000000000001',
  'Time Overlap Invariant Ltd',
  'Time Overlap Invariant',
  'time-overlap-invariant',
  'active'
);

insert into public.retailer_staff_members (
  id, retailer_id, full_name, email, role, accepted_at
) values
  (
    'd2220000-0000-0000-0000-000000000011',
    'd2220000-0000-0000-0000-000000000001',
    'Time Overlap Staff One',
    'time-overlap-one@example.test',
    'sales_associate',
    now()
  ),
  (
    'd2220000-0000-0000-0000-000000000012',
    'd2220000-0000-0000-0000-000000000001',
    'Time Overlap Staff Two',
    'time-overlap-two@example.test',
    'sales_associate',
    now()
  );

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.staff_time_entries'::regclass
      and conname = 'staff_time_entries_no_overlap_per_staff_excl'
      and contype = 'x'
  ),
  'staff time entries have a named per-staff exclusion constraint'
);

insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at, clock_out_at)
values (
  'd2220000-0000-0000-0000-000000000001',
  'd2220000-0000-0000-0000-000000000011',
  '2026-08-11 09:00:00+00',
  '2026-08-11 11:00:00+00'
);

select throws_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at)
    values (
      'd2220000-0000-0000-0000-000000000001',
      'd2220000-0000-0000-0000-000000000011',
      '2026-08-11 10:00:00+00'
    )
  $$,
  '23P01',
  'conflicting key value violates exclusion constraint "staff_time_entries_no_overlap_per_staff_excl"',
  'an open interval cannot overlap a closed interval for the same staff member'
);

select lives_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at, clock_out_at)
    values (
      'd2220000-0000-0000-0000-000000000001',
      'd2220000-0000-0000-0000-000000000011',
      '2026-08-11 11:00:00+00',
      '2026-08-11 12:00:00+00'
    )
  $$,
  'adjacent intervals are allowed by half-open interval semantics'
);

select lives_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at, clock_out_at)
    values (
      'd2220000-0000-0000-0000-000000000001',
      'd2220000-0000-0000-0000-000000000012',
      '2026-08-11 09:30:00+00',
      '2026-08-11 10:30:00+00'
    )
  $$,
  'different staff members may have overlapping intervals'
);

select lives_ok(
  $$
    insert into public.staff_time_entries (retailer_id, staff_id, clock_in_at, clock_out_at)
    values (
      'd2220000-0000-0000-0000-000000000001',
      'd2220000-0000-0000-0000-000000000011',
      '2026-08-11 12:00:00+00',
      '2026-08-11 13:00:00+00'
    )
  $$,
  'separated intervals for the same staff member are allowed'
);

select * from finish();
rollback;
