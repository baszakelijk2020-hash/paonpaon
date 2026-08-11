-- Historical time must not be rewritten during this integrity upgrade.  Report
-- one concrete conflict so the operator can remediate it deliberately.
do $$
declare
  v_staff_id uuid;
  v_first_entry_id uuid;
  v_second_entry_id uuid;
  v_first_interval tstzrange;
  v_second_interval tstzrange;
begin
  select
    first_entry.staff_id,
    first_entry.id,
    second_entry.id,
    tstzrange(first_entry.clock_in_at, first_entry.clock_out_at, '[)'),
    tstzrange(second_entry.clock_in_at, second_entry.clock_out_at, '[)')
  into
    v_staff_id,
    v_first_entry_id,
    v_second_entry_id,
    v_first_interval,
    v_second_interval
  from public.staff_time_entries first_entry
  join public.staff_time_entries second_entry
    on second_entry.staff_id = first_entry.staff_id
   and second_entry.id > first_entry.id
   and tstzrange(first_entry.clock_in_at, first_entry.clock_out_at, '[)')
       && tstzrange(second_entry.clock_in_at, second_entry.clock_out_at, '[)')
  order by first_entry.staff_id, first_entry.clock_in_at, second_entry.clock_in_at
  limit 1;

  if found then
    raise exception
      'Cannot enforce non-overlapping staff time entries: staff_id %, entry_ids (% and %), intervals (% and %)',
      v_staff_id,
      v_first_entry_id,
      v_second_entry_id,
      v_first_interval,
      v_second_interval;
  end if;
end;
$$;

create extension if not exists btree_gist with schema extensions;

alter table public.staff_time_entries
  add constraint staff_time_entries_no_overlap_per_staff_excl
  exclude using gist (
    staff_id with =,
    tstzrange(clock_in_at, clock_out_at, '[)') with &&
  );
