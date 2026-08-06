-- FT-14 Preferred Tailoring: first connected slice — a customer-facing
-- weekly wardrobe plan view with read-only authorize/accept, over real
-- service_plans/service_memberships data (docs/PROJECT_STATE.md's
-- 2026-08-06 scoping decision; docs/FOUNDER_TOOL_BLUEPRINTS.md FT-14).
-- Custody handoffs, the partner portal and cost reconciliation are
-- explicitly deferred to a later slice.
--
-- Weekly composition is a versioned job (blueprint: "State and wiring"):
-- an advisor proposes a plan for a membership's week; the customer
-- authorizes (accepts) or declines it. Mirrors the wedding_aftercare_plans
-- precedent (20260802000007): the table grants insert/update broadly but
-- customer decisions only ever happen through a SECURITY DEFINER RPC that
-- re-derives the caller's own customer row server-side.

-- ---------------------------------------------------------------------------
-- service_weekly_plans
-- ---------------------------------------------------------------------------

create table if not exists public.service_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  week_start_date date not null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (
    status in ('draft', 'proposed', 'customer_accepted', 'customer_declined')
  ),
  advisor_notes text check (
    advisor_notes is null
    or char_length(btrim(advisor_notes)) between 1 and 1000
  ),
  decline_reason text check (
    decline_reason is null
    or char_length(btrim(decline_reason)) between 1 and 1000
  ),
  created_by_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  proposed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_weekly_plans_membership_fk
    foreign key (membership_id, retailer_id)
    references public.service_memberships (id, retailer_id)
    on delete cascade,
  constraint service_weekly_plans_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_weekly_plans_id_retailer_uidx unique (id, retailer_id),
  constraint service_weekly_plans_membership_week_version_uidx
    unique (membership_id, week_start_date, version),
  constraint service_weekly_plans_proposed_ck check (
    (status = 'draft' and proposed_at is null)
    or (status <> 'draft' and proposed_at is not null)
  ),
  constraint service_weekly_plans_decided_ck check (
    (status in ('customer_accepted', 'customer_declined')
      and decided_at is not null)
    or (status not in ('customer_accepted', 'customer_declined')
      and decided_at is null)
  )
);

create trigger set_service_weekly_plans_updated_at
  before update on public.service_weekly_plans
  for each row execute function public.set_updated_at();

create index if not exists service_weekly_plans_membership_idx
  on public.service_weekly_plans (membership_id, week_start_date desc);

create index if not exists service_weekly_plans_customer_idx
  on public.service_weekly_plans (customer_id, status);

comment on table public.service_weekly_plans is
  'FT-14 Preferred Tailoring: versioned weekly wardrobe plan proposed by an advisor and authorized (accepted/declined) by the customer.';

alter table public.service_weekly_plans enable row level security;
revoke all on table public.service_weekly_plans from anon;

create policy "retailer staff read tenant service weekly plans"
  on public.service_weekly_plans for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service weekly plans"
  on public.service_weekly_plans for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service weekly plans"
  on public.service_weekly_plans for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_weekly_plans.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service weekly plans"
  on public.service_weekly_plans for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_weekly_plans to authenticated, service_role;
grant insert, update, delete on table public.service_weekly_plans to authenticated;
grant all on table public.service_weekly_plans to service_role;

-- No customer UPDATE grant is meaningful here: the RLS policies above give
-- customers select-only, matching wedding_aftercare_plans (20260802000007).
-- Decisions go only through decide_service_weekly_plan below.

-- ---------------------------------------------------------------------------
-- service_weekly_plan_days
-- ---------------------------------------------------------------------------

create table if not exists public.service_weekly_plan_days (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  occasion_tag text not null check (
    occasion_tag in ('distinguished', 'refined', 'elevated', 'neutral')
  ),
  outfit_notes text not null check (
    char_length(btrim(outfit_notes)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_weekly_plan_days_plan_fk
    foreign key (weekly_plan_id, retailer_id)
    references public.service_weekly_plans (id, retailer_id)
    on delete cascade,
  constraint service_weekly_plan_days_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint service_weekly_plan_days_plan_day_uidx
    unique (weekly_plan_id, day_of_week)
);

create trigger set_service_weekly_plan_days_updated_at
  before update on public.service_weekly_plan_days
  for each row execute function public.set_updated_at();

create index if not exists service_weekly_plan_days_plan_idx
  on public.service_weekly_plan_days (weekly_plan_id, day_of_week);

comment on table public.service_weekly_plan_days is
  'FT-14: one garment-day entry (occasion tag, notes) within a service_weekly_plans week.';

alter table public.service_weekly_plan_days enable row level security;
revoke all on table public.service_weekly_plan_days from anon;

create policy "retailer staff read tenant service weekly plan days"
  on public.service_weekly_plan_days for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff write tenant service weekly plan days"
  on public.service_weekly_plan_days for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own service weekly plan days"
  on public.service_weekly_plan_days for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = service_weekly_plan_days.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "platform staff read service weekly plan days"
  on public.service_weekly_plan_days for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.service_weekly_plan_days
  to authenticated, service_role;
grant insert, update, delete on table public.service_weekly_plan_days
  to authenticated;
grant all on table public.service_weekly_plan_days to service_role;

-- ---------------------------------------------------------------------------
-- Extend service_history_events kind vocabulary
-- ---------------------------------------------------------------------------

alter table public.service_history_events
  drop constraint service_history_events_kind_check;
alter table public.service_history_events
  add constraint service_history_events_kind_check check (
    kind in (
      'plan_created',
      'membership_opened',
      'membership_paused',
      'membership_ended',
      'entitlement_granted',
      'entitlement_consumed',
      'booking_requested',
      'booking_confirmed',
      'booking_fulfilled',
      'booking_canceled',
      'fulfilment_recorded',
      'care_recorded',
      'cost_recorded',
      'appointment_linked',
      'alteration_linked',
      'advisor_assigned',
      'weekly_plan_proposed',
      'weekly_plan_accepted',
      'weekly_plan_declined'
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: propose_service_weekly_plan (staff)
-- ---------------------------------------------------------------------------

create or replace function public.propose_service_weekly_plan(
  p_membership_id uuid,
  p_week_start_date date,
  p_days jsonb,
  p_advisor_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.service_memberships%rowtype;
  v_staff_id uuid;
  v_plan_id uuid;
  v_next_version integer;
  v_day_count integer;
  v_distinct_day_count integer;
  v_day record;
begin
  select * into v_membership
  from public.service_memberships
  where id = p_membership_id;
  if not found then
    raise exception 'Membership not found';
  end if;
  if v_membership.status <> 'active' then
    raise exception 'Membership is not active';
  end if;
  v_staff_id := public._service_assert_staff_retailer(v_membership.retailer_id);

  if extract(dow from p_week_start_date) <> 1 then
    raise exception 'Week must start on a Monday';
  end if;

  select count(*) into v_day_count
  from jsonb_array_elements(p_days);
  if v_day_count < 1 or v_day_count > 7 then
    raise exception 'A weekly plan needs between 1 and 7 days';
  end if;

  select count(distinct (elem ->> 'dayOfWeek')::int) into v_distinct_day_count
  from jsonb_array_elements(p_days) as elem;
  if v_distinct_day_count <> v_day_count then
    raise exception 'Duplicate day_of_week in weekly plan days';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.service_weekly_plans
  where membership_id = p_membership_id
    and week_start_date = p_week_start_date;

  insert into public.service_weekly_plans (
    membership_id,
    retailer_id,
    customer_id,
    week_start_date,
    version,
    status,
    advisor_notes,
    created_by_staff_id,
    proposed_at
  ) values (
    p_membership_id,
    v_membership.retailer_id,
    v_membership.customer_id,
    p_week_start_date,
    v_next_version,
    'proposed',
    p_advisor_notes,
    v_staff_id,
    now()
  )
  returning id into v_plan_id;

  for v_day in
    select
      (elem ->> 'dayOfWeek')::smallint as day_of_week,
      elem ->> 'occasionTag' as occasion_tag,
      elem ->> 'outfitNotes' as outfit_notes
    from jsonb_array_elements(p_days) as elem
  loop
    insert into public.service_weekly_plan_days (
      weekly_plan_id,
      retailer_id,
      customer_id,
      day_of_week,
      occasion_tag,
      outfit_notes
    ) values (
      v_plan_id,
      v_membership.retailer_id,
      v_membership.customer_id,
      v_day.day_of_week,
      v_day.occasion_tag,
      v_day.outfit_notes
    );
  end loop;

  perform public._service_history_insert(
    v_membership.retailer_id,
    v_membership.customer_id,
    p_membership_id,
    null,
    'weekly_plan_proposed',
    'Weekly plan proposed for week of ' || p_week_start_date::text,
    v_staff_id
  );

  return v_plan_id;
end;
$$;

revoke all on function public.propose_service_weekly_plan(
  uuid, date, jsonb, text
) from public;
grant execute on function public.propose_service_weekly_plan(
  uuid, date, jsonb, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: decide_service_weekly_plan (customer; re-derives caller server-side)
-- ---------------------------------------------------------------------------

create or replace function public.decide_service_weekly_plan(
  p_plan_id uuid,
  p_decision text,
  p_decline_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.service_weekly_plans%rowtype;
  v_customer public.customers%rowtype;
  v_target_status text;
  v_history_kind text;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined';
  end if;

  select * into v_plan
  from public.service_weekly_plans
  where id = p_plan_id
  for update;
  if not found then
    raise exception 'Weekly plan not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_plan.customer_id
    and deleted_at is null;
  if not found or v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized for this weekly plan';
  end if;

  v_target_status := case p_decision
    when 'accepted' then 'customer_accepted'
    else 'customer_declined'
  end;

  if v_plan.status = v_target_status then
    return p_plan_id;
  end if;
  if v_plan.status <> 'proposed' then
    raise exception 'This weekly plan has already been decided';
  end if;

  update public.service_weekly_plans
  set status = v_target_status,
      decided_at = now(),
      decline_reason = case
        when p_decision = 'declined' then p_decline_reason
        else null
      end
  where id = p_plan_id;

  v_history_kind := case p_decision
    when 'accepted' then 'weekly_plan_accepted'
    else 'weekly_plan_declined'
  end;

  perform public._service_history_insert(
    v_plan.retailer_id,
    v_plan.customer_id,
    v_plan.membership_id,
    null,
    v_history_kind,
    'Weekly plan ' || p_decision || ' for week of ' || v_plan.week_start_date::text,
    null
  );

  return p_plan_id;
end;
$$;

revoke all on function public.decide_service_weekly_plan(uuid, text, text)
  from public;
grant execute on function public.decide_service_weekly_plan(uuid, text, text)
  to authenticated, service_role;
