-- PHASE 7.8 / CLI-009: typed intelligence policy + fact correction replay.

create table if not exists public.intelligence_policy_configs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers (id) on delete cascade,
  plane text not null check (
    plane in ('capture', 'projection', 'display', 'export', 'activation')
  ),
  purpose text not null check (
    purpose in ('personalization', 'marketing', 'location')
  ),
  decision text not null check (decision in ('allow', 'deny', 'defer')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  jurisdiction_code text,
  anonymous_capture_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_policy_configs_retailer_plane_purpose_key
    unique nulls not distinct (retailer_id, plane, purpose)
);

create index if not exists intelligence_policy_configs_retailer_idx
  on public.intelligence_policy_configs (retailer_id, plane, purpose);

alter table public.intelligence_policy_configs enable row level security;

revoke all on table public.intelligence_policy_configs from public, anon;
grant select, insert, update on table public.intelligence_policy_configs
  to authenticated, service_role;

create policy intelligence_policy_platform_select
  on public.intelligence_policy_configs for select to authenticated
  using (
    retailer_id is null
    or (
      retailer_id = public.current_retailer_id()
      and public.current_retailer_role() in ('owner', 'manager')
    )
  );

create policy intelligence_policy_retailer_write
  on public.intelligence_policy_configs for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager')
  );

create policy intelligence_policy_retailer_update
  on public.intelligence_policy_configs for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager')
  )
  with check (retailer_id = public.current_retailer_id());

insert into public.intelligence_policy_configs (
  retailer_id, plane, purpose, decision, reason
) values
  (null, 'capture', 'personalization', 'allow',
   'Explicit personalization opt-in required at capture time.'),
  (null, 'capture', 'marketing', 'deny',
   'Marketing capture stays separate from personalization signals.'),
  (null, 'capture', 'location', 'defer',
   'Location capture requires a separate explicit opt-in.'),
  (null, 'projection', 'personalization', 'allow',
   'Projectors may derive cited insights when consent is granted.'),
  (null, 'display', 'personalization', 'allow',
   'Advisor and customer surfaces may show cited conclusions.'),
  (null, 'export', 'personalization', 'deny',
   'Bulk export of personalization signals is disabled by default.'),
  (null, 'activation', 'personalization', 'allow',
   'Draft opportunities may be accepted when consent is granted.')
on conflict on constraint intelligence_policy_configs_retailer_plane_purpose_key
do nothing;

create or replace function public.record_customer_fact_correction(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_fact_id uuid,
  p_reason text,
  p_actor_staff_id uuid default null,
  p_actor_customer_id uuid default null,
  p_excluded_event_ids uuid[] default '{}'::uuid[]
) returns public.customer_facts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fact public.customer_facts;
  v_replacement public.customer_facts;
  v_snapshot jsonb;
begin
  if p_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in (
      'owner', 'manager', 'sales_associate'
    )
  then
    raise exception 'Not authorized';
  end if;

  select * into v_fact
  from public.customer_facts cf
  where cf.id = p_fact_id
    and cf.retailer_id = p_retailer_id
    and cf.customer_id = p_customer_id
    and cf.deleted_at is null
    and cf.superseded_by_fact_id is null
  for update;

  if not found then
    raise exception 'Fact not found or already superseded';
  end if;

  v_snapshot := to_jsonb(v_fact);

  update public.customer_facts
  set deleted_at = now(), updated_at = now()
  where id = v_fact.id;

  insert into public.customer_fact_corrections (
    retailer_id,
    customer_id,
    fact_id,
    actor_staff_id,
    actor_customer_id,
    reason,
    previous_snapshot
  ) values (
    p_retailer_id,
    p_customer_id,
    v_fact.id,
    p_actor_staff_id,
    p_actor_customer_id,
    btrim(p_reason),
    v_snapshot
  );

  update public.clienteling_opportunities co
  set
    status = case
      when co.status in ('draft', 'accepted') then 'expired'
      when co.status in ('snoozed', 'dismissed') then 'incorrect'
      else co.status
    end,
    updated_at = now()
  where co.retailer_id = p_retailer_id
    and co.customer_id = p_customer_id
    and co.deleted_at is null
    and co.status not in ('completed', 'expired', 'incorrect')
    and exists (
      select 1
      from jsonb_array_elements(co.evidence) elem
      where elem ->> 'factId' = v_fact.id::text
    );

  return v_fact;
end;
$$;

revoke all on function public.record_customer_fact_correction(
  uuid, uuid, uuid, text, uuid, uuid, uuid[]
) from public;
grant execute on function public.record_customer_fact_correction(
  uuid, uuid, uuid, text, uuid, uuid, uuid[]
) to authenticated, service_role;

comment on table public.intelligence_policy_configs is
  'Typed intelligence policy eligibility plane (PHASE 7.8 / ADR-066).';
comment on function public.record_customer_fact_correction is
  'Soft-delete a fact, append correction history, and expire linked opportunities.';
