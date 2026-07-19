-- See docs/DOMAIN_MODEL.md "Appointments". A staff member's recurring
-- bookable hours — `computeAvailableSlots` (@paon/domain) turns these
-- into actual bookable start times for a given date. `start_time`/
-- `end_time` are `text`, not the native Postgres `time` type,
-- specifically so the wire format matches the "HH:MM" the zod schema
-- (createAvailabilityWindowInputSchema) validates exactly — `time`
-- round-trips as "HH:MM:SS" through the client, which would force a
-- format-translation layer in the repository for no benefit.

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.retailer_staff_members (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_windows_start_before_end check (start_time < end_time)
);

create index availability_windows_retailer_id_idx on public.availability_windows (retailer_id);
create index availability_windows_staff_id_idx on public.availability_windows (staff_id);

create trigger set_availability_windows_updated_at
  before update on public.availability_windows
  for each row
  execute function public.set_updated_at();

alter table public.availability_windows enable row level security;

create policy "platform staff can manage all availability windows"
  on public.availability_windows for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's availability windows"
  on public.availability_windows for select
  using (retailer_id = public.current_retailer_id());

-- A staff member manages their own schedule; manager+ can manage
-- anyone's (covering shift changes, onboarding a new hire's schedule,
-- etc.) — the same "self, or a more senior role" shape used nowhere
-- else yet in this schema, so it's spelled out with an `exists` against
-- retailer_staff_members rather than a JWT claim (there is no
-- `current_staff_id()` — see docs/DECISIONS.md ADR-015).
create policy "staff manage their own availability, managers manage any"
  on public.availability_windows for all
  using (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('manager', 'admin', 'owner')
      or exists (
        select 1 from public.retailer_staff_members rsm
        where rsm.id = availability_windows.staff_id
          and rsm.user_id = auth.uid()
      )
    )
  )
  with check (
    retailer_id = public.current_retailer_id()
    and (
      public.current_retailer_role() in ('manager', 'admin', 'owner')
      or exists (
        select 1 from public.retailer_staff_members rsm
        where rsm.id = availability_windows.staff_id
          and rsm.user_id = auth.uid()
      )
    )
  );

comment on table public.availability_windows is
  'A staff member''s recurring bookable hours. See docs/DOMAIN_MODEL.md "Appointments" and computeAvailableSlots in @paon/domain.';
