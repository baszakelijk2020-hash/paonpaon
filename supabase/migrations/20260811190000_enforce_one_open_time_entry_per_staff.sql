-- Historical data must already satisfy this invariant. Failing the migration
-- makes any remediation explicit instead of silently altering payroll history.
do $$
declare
  v_staff_id uuid;
  v_open_entry_count bigint;
begin
  select staff_id, count(*)
    into v_staff_id, v_open_entry_count
    from public.staff_time_entries
    where clock_out_at is null
    group by staff_id
    having count(*) > 1
    order by staff_id
    limit 1;

  if found then
    raise exception
      'Cannot enforce one open staff time entry per staff member: staff_id %, open_entry_count %',
      v_staff_id,
      v_open_entry_count;
  end if;
end;
$$;

create unique index staff_time_entries_one_open_per_staff_idx
  on public.staff_time_entries (staff_id)
  where clock_out_at is null;
