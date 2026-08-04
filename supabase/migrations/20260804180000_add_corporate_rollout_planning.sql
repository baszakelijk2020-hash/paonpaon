-- PHASE 18.6 (BD-106): measurement and fitting rollout planning — bulk
-- planning for a programme rollout, distinct from booking one
-- appointment at a time (the existing `appointments` table, untouched
-- here). A rollout day carries its own capacity; a slot assigns one
-- wearer to one day. `corporate_rollout_slots_wearer_active_unique`
-- allows a wearer to have at most one *active* (`planned`) slot at a
-- time while preserving every past `no_show`/`completed` row — a
-- no-show is re-slotted onto a new day, never edited in place, so the
-- history of "this person didn't show on day 1, then came on day 3" is
-- never lost.

create table if not exists public.corporate_rollout_days (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  fitting_date date not null,
  capacity integer not null check (capacity > 0),
  advisor_note text check (
    advisor_note is null or char_length(btrim(advisor_note)) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_rollout_days_unique unique (programme_id, fitting_date)
);

create table if not exists public.corporate_rollout_slots (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  rollout_day_id uuid not null
    references public.corporate_rollout_days (id) on delete cascade,
  wearer_id uuid not null
    references public.corporate_wearers (id) on delete cascade,
  status text not null default 'planned' check (
    status in ('planned', 'completed', 'no_show')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_rollout_slots_day_wearer_unique unique (rollout_day_id, wearer_id)
);

-- A wearer may have historical no_show rows, but only one live `planned`
-- slot at any time — the row a no-show reslot leaves behind stays
-- `no_show`, and a brand new row is inserted for the new day.
create unique index if not exists corporate_rollout_slots_wearer_active_unique
  on public.corporate_rollout_slots (wearer_id)
  where status = 'planned';

create index if not exists corporate_rollout_slots_day_idx
  on public.corporate_rollout_slots (rollout_day_id, status);

create trigger set_corporate_rollout_days_updated_at
  before update on public.corporate_rollout_days
  for each row execute function public.set_updated_at();
create trigger set_corporate_rollout_slots_updated_at
  before update on public.corporate_rollout_slots
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_rollout_days', 'corporate_rollout_slots'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

grant insert, update on table public.corporate_rollout_days
  to authenticated, service_role;
grant insert, update on table public.corporate_rollout_slots
  to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_rollout_days', 'corporate_rollout_slots'
  ] loop
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate'')) '
      || 'with check (retailer_id = public.current_retailer_id())',
      t || '_staff_update', t
    );
  end loop;
end $$;

comment on table public.corporate_rollout_slots is
  'PHASE 18.6 / BD-106. corporate_rollout_slots_wearer_active_unique '
  'limits a wearer to one live planned slot; a no-show reslot inserts a '
  'new row rather than editing the old one, so the miss stays visible.';
