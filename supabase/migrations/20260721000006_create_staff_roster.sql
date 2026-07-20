-- Staff planning: who's scheduled to work which day (staff_shifts,
-- manager-authored) and actual worked time (staff_time_entries,
-- self-service clock in/out) — two separate concepts, since a
-- schedule and what actually happened are not the same record
-- (matches this repo's "status that must only change through its own
-- history log" style separation, e.g. Alteration vs AlterationStatusHistory).

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_time > start_time)
);
create index staff_shifts_retailer_date_idx on public.staff_shifts (retailer_id, shift_date);
create index staff_shifts_staff_idx on public.staff_shifts (staff_id, shift_date);
create trigger set_staff_shifts_updated_at
  before update on public.staff_shifts
  for each row execute function public.set_updated_at();

create table public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);
create index staff_time_entries_staff_idx on public.staff_time_entries (staff_id, clock_in_at desc);
create index staff_time_entries_retailer_idx on public.staff_time_entries (retailer_id, clock_in_at desc);
create trigger set_staff_time_entries_updated_at
  before update on public.staff_time_entries
  for each row execute function public.set_updated_at();

alter table public.staff_shifts enable row level security;
alter table public.staff_time_entries enable row level security;

create policy "platform reads staff shifts" on public.staff_shifts
  for select using (public.is_platform_staff());
create policy "retailer staff read their retailer's shifts" on public.staff_shifts
  for select using (retailer_id = public.current_retailer_id());
create policy "managers manage staff shifts" on public.staff_shifts
  for insert with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "managers update staff shifts" on public.staff_shifts
  for update using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "managers delete staff shifts" on public.staff_shifts
  for delete using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy "platform reads time entries" on public.staff_time_entries
  for select using (public.is_platform_staff());
create policy "managers read all time entries" on public.staff_time_entries
  for select using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );
create policy "staff read their own time entries" on public.staff_time_entries
  for select using (
    exists (
      select 1 from public.retailer_staff_members s
      where s.id = staff_id and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.staff_shifts to authenticated, service_role;
grant select on public.staff_time_entries to authenticated, service_role;

-- Self-service clock in/out — re-derives staff_id from auth.uid(),
-- same "security definer RPC over a broadened RLS policy for a narrow
-- state transition a caller triggers about themselves" shape as
-- get_or_create_my_conversation.
create or replace function public.clock_in() returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.retailer_staff_members%rowtype;
  v_open_entry uuid;
  v_id uuid;
begin
  select * into v_staff from public.retailer_staff_members
    where user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if not found then
    raise exception 'No active staff membership';
  end if;

  select id into v_open_entry from public.staff_time_entries
    where staff_id = v_staff.id and clock_out_at is null
    limit 1;
  if v_open_entry is not null then
    raise exception 'Already clocked in';
  end if;

  insert into public.staff_time_entries (retailer_id, staff_id)
    values (v_staff.retailer_id, v_staff.id)
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.clock_out() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
begin
  select id into v_staff_id from public.retailer_staff_members
    where user_id = auth.uid() and accepted_at is not null and deleted_at is null;
  if v_staff_id is null then
    raise exception 'No active staff membership';
  end if;

  update public.staff_time_entries
    set clock_out_at = now()
    where staff_id = v_staff_id and clock_out_at is null;

  if not found then
    raise exception 'Not currently clocked in';
  end if;
end;
$$;

revoke all on function public.clock_in() from public;
revoke all on function public.clock_out() from public;
grant execute on function public.clock_in() to authenticated, service_role;
grant execute on function public.clock_out() to authenticated, service_role;
