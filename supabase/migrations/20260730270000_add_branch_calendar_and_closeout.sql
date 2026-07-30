-- PHASE 7.5 / CLI-006: branch calendar, recurring moments, post-appointment closeout.

create table if not exists public.retailer_branches (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  timezone text not null check (char_length(btrim(timezone)) between 1 and 64),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists retailer_branches_one_primary_idx
  on public.retailer_branches (retailer_id)
  where is_primary = true and deleted_at is null;

create index if not exists retailer_branches_retailer_idx
  on public.retailer_branches (retailer_id)
  where deleted_at is null;

create table if not exists public.branch_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  branch_id uuid not null references public.retailer_branches (id) on delete cascade,
  entry_type text not null check (
    entry_type in (
      'coverage',
      'recurring_moment',
      'store_event',
      'blocked'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recurrence text not null default 'none' check (
    recurrence in ('none', 'weekly', 'monthly')
  ),
  assigned_staff_ids uuid[] not null default '{}'::uuid[],
  customer_id uuid references public.customers (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint branch_calendar_entries_time_order check (starts_at < ends_at),
  constraint branch_calendar_entries_recurring_customer_chk check (
    entry_type <> 'recurring_moment' or customer_id is not null
  )
);

create index if not exists branch_calendar_entries_branch_range_idx
  on public.branch_calendar_entries (branch_id, starts_at, ends_at)
  where deleted_at is null;

alter table public.appointments
  add column if not exists branch_id uuid references public.retailer_branches (id)
    on delete set null;

create index if not exists appointments_branch_idx
  on public.appointments (branch_id, starts_at)
  where deleted_at is null and branch_id is not null;

create table if not exists public.appointment_closeouts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_staff_id uuid not null references public.retailer_staff_members (id)
    on delete restrict,
  outcome text not null check (
    outcome in (
      'completed_with_interest',
      'completed_no_purchase',
      'follow_up_scheduled',
      'alteration_started',
      'no_show_confirmed'
    )
  ),
  rectangle_selections jsonb not null default '[]'::jsonb,
  follow_up_notes text check (
    follow_up_notes is null or char_length(follow_up_notes) <= 2000
  ),
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  constraint appointment_closeouts_one_per_appointment unique (appointment_id)
);

create index if not exists appointment_closeouts_customer_idx
  on public.appointment_closeouts (retailer_id, customer_id, created_at desc);

alter table public.retailer_branches enable row level security;
alter table public.branch_calendar_entries enable row level security;
alter table public.appointment_closeouts enable row level security;

revoke all on table public.retailer_branches from public, anon;
revoke all on table public.branch_calendar_entries from public, anon;
revoke all on table public.appointment_closeouts from public, anon;

grant select, insert, update on table public.retailer_branches
  to authenticated, service_role;
grant select, insert, update on table public.branch_calendar_entries
  to authenticated, service_role;
grant select, insert on table public.appointment_closeouts
  to authenticated, service_role;

create policy retailer_branches_retailer_select
  on public.retailer_branches for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy retailer_branches_manager_write
  on public.retailer_branches for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy retailer_branches_manager_update
  on public.retailer_branches for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy branch_calendar_entries_retailer_select
  on public.branch_calendar_entries for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy branch_calendar_entries_manager_write
  on public.branch_calendar_entries for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy branch_calendar_entries_manager_update
  on public.branch_calendar_entries for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create policy appointment_closeouts_retailer_select
  on public.appointment_closeouts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy appointment_closeouts_sales_write
  on public.appointment_closeouts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create or replace function public.record_appointment_closeout(
  p_retailer_id uuid,
  p_appointment_id uuid,
  p_staff_id uuid,
  p_outcome text,
  p_selections jsonb,
  p_follow_up_notes text default null,
  p_follow_up_at timestamptz default null
) returns setof public.customer_facts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_selection jsonb;
  v_concept_id uuid;
  v_kind text;
  v_label text;
  v_polarity text;
  v_fact_type text;
  v_closeout_id uuid;
begin
  if public.current_retailer_id() is distinct from p_retailer_id then
    raise exception 'Retailer mismatch';
  end if;

  if public.current_retailer_role() not in (
    'sales_associate', 'manager', 'admin', 'owner'
  ) then
    raise exception 'Insufficient role for closeout';
  end if;

  select * into v_appointment
    from public.appointments
    where id = p_appointment_id
      and retailer_id = p_retailer_id
      and deleted_at is null;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if exists (
    select 1 from public.appointment_closeouts
    where appointment_id = p_appointment_id
  ) then
    raise exception 'Closeout already recorded for appointment';
  end if;

  insert into public.appointment_closeouts (
    retailer_id,
    appointment_id,
    customer_id,
    author_staff_id,
    outcome,
    rectangle_selections,
    follow_up_notes,
    follow_up_at
  ) values (
    p_retailer_id,
    p_appointment_id,
    v_appointment.customer_id,
    p_staff_id,
    p_outcome,
    coalesce(p_selections, '[]'::jsonb),
    p_follow_up_notes,
    p_follow_up_at
  )
  returning id into v_closeout_id;

  for v_selection in select * from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  loop
    v_concept_id := (v_selection ->> 'conceptId')::uuid;
    v_kind := v_selection ->> 'kind';
    v_label := btrim(v_selection ->> 'label');
    v_polarity := coalesce(v_selection ->> 'polarity', 'positive');

    if v_label is null or char_length(v_label) = 0 then
      continue;
    end if;

    v_fact_type := case
      when v_polarity = 'negative' then 'rejected_concept'
      when v_kind = 'colour' then 'colour_interest'
      when v_kind = 'pattern' then 'pattern_interest'
      when v_kind in ('fibre', 'weave') then 'fabric_interest'
      when v_kind = 'occasion' then 'occasion'
      when v_kind = 'fit' then 'fit_note'
      else 'preference_concept'
    end;

    return query
    insert into public.customer_facts (
      retailer_id,
      customer_id,
      fact_type,
      provenance_class,
      value_label,
      value_concept_id,
      confidence,
      sensitivity,
      visibility,
      observed_at,
      author_staff_id,
      evidence
    ) values (
      p_retailer_id,
      v_appointment.customer_id,
      v_fact_type,
      'advisor_observed',
      v_label,
      v_concept_id,
      0.92,
      'standard',
      'customer_and_advisor',
      now(),
      p_staff_id,
      jsonb_build_array(
        jsonb_build_object(
          'note', 'appointment_closeout',
          'appointmentId', p_appointment_id,
          'closeoutId', v_closeout_id
        )
      )
    )
    returning *;
  end loop;

  if p_follow_up_notes is not null and char_length(btrim(p_follow_up_notes)) > 0 then
    return query
    insert into public.customer_facts (
      retailer_id,
      customer_id,
      fact_type,
      provenance_class,
      value_label,
      value_text,
      confidence,
      sensitivity,
      visibility,
      observed_at,
      author_staff_id,
      evidence
    ) values (
      p_retailer_id,
      v_appointment.customer_id,
      'other',
      'advisor_observed',
      left(btrim(p_follow_up_notes), 500),
      btrim(p_follow_up_notes),
      0.85,
      'standard',
      'advisor_only',
      now(),
      p_staff_id,
      jsonb_build_array(
        jsonb_build_object(
          'note', 'appointment_closeout_follow_up',
          'appointmentId', p_appointment_id,
          'closeoutId', v_closeout_id,
          'outcome', p_outcome
        )
      )
    )
    returning *;
  end if;

  return;
end;
$$;

revoke all on function public.record_appointment_closeout(
  uuid, uuid, uuid, text, jsonb, text, timestamptz
) from public;
grant execute on function public.record_appointment_closeout(
  uuid, uuid, uuid, text, jsonb, text, timestamptz
) to authenticated, service_role;

comment on table public.retailer_branches is
  'Tenant-scoped store/branch with IANA timezone for honest calendar display.';
comment on table public.branch_calendar_entries is
  'Manager-controlled branch calendar: coverage, recurring customer moments, events.';
comment on table public.appointment_closeouts is
  'Structured post-appointment closeout rectangles feeding provenance-aware facts.';
