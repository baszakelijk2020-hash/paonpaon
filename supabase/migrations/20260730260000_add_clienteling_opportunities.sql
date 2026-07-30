-- PHASE 7.4 / CLI-004 / CLI-005: sparse clienteling opportunity drafts.

create table if not exists public.clienteling_opportunities (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  hook_kind text not null check (
    hook_kind in (
      'recent_browsing',
      'interest_affinity',
      'advisor_question',
      'appointment_intent',
      'wishlist_signal',
      'dormancy'
    )
  ),
  projector_key text not null,
  projector_version text not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  why_now text not null check (char_length(btrim(why_now)) between 1 and 2000),
  suggested_action text not null check (
    suggested_action in (
      'send_message',
      'book_appointment',
      'add_note',
      'review_shortlist'
    )
  ),
  suggested_channel text not null check (
    suggested_channel in ('in_app_message', 'phone', 'in_store', 'email')
  ),
  suggested_at timestamptz not null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'assigned',
        'in_progress',
        'completed',
        'dismissed',
        'expired'
      )
    ),
  priority integer not null check (priority between 0 and 100),
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  due_at timestamptz not null,
  expires_at timestamptz not null,
  assigned_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  feedback_note text check (
    feedback_note is null or char_length(feedback_note) between 1 and 2000
  ),
  outcome_type text check (
    outcome_type is null
    or outcome_type in (
      'message_sent',
      'appointment_booked',
      'sale_recorded',
      'no_response',
      'not_relevant'
    )
  ),
  outcome_message_id uuid references public.messages (id) on delete set null,
  outcome_appointment_id uuid references public.appointments (id)
    on delete set null,
  outcome_order_id uuid references public.orders (id) on delete set null,
  outcome_recorded_at timestamptz,
  outcome_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clienteling_opportunities_outcome_chk check (
    (
      outcome_type is null
      and outcome_recorded_at is null
      and outcome_staff_id is null
    )
    or (
      outcome_type is not null
      and outcome_recorded_at is not null
      and outcome_staff_id is not null
    )
  )
);

create unique index if not exists clienteling_opportunities_projector_key_uq
  on public.clienteling_opportunities (retailer_id, projector_key)
  where deleted_at is null;

create index if not exists clienteling_opportunities_inbox_idx
  on public.clienteling_opportunities (
    retailer_id,
    status,
    priority desc,
    due_at asc
  )
  where deleted_at is null
    and status in ('draft', 'assigned', 'in_progress');

create index if not exists clienteling_opportunities_customer_idx
  on public.clienteling_opportunities (retailer_id, customer_id, created_at desc)
  where deleted_at is null;

alter table public.clienteling_opportunities enable row level security;

revoke all on table public.clienteling_opportunities from public, anon;
grant select, insert, update on table public.clienteling_opportunities
  to authenticated, service_role;

create policy clienteling_opportunities_retailer_select
  on public.clienteling_opportunities for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
  );

create policy clienteling_opportunities_retailer_write
  on public.clienteling_opportunities for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'sales_associate',
      'manager',
      'admin',
      'owner'
    )
  );

create policy clienteling_opportunities_retailer_update
  on public.clienteling_opportunities for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'sales_associate',
      'manager',
      'admin',
      'owner'
    )
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'sales_associate',
      'manager',
      'admin',
      'owner'
    )
  );

create or replace function public.sync_clienteling_opportunity_drafts(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_drafts jsonb
) returns setof public.clienteling_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft jsonb;
  v_row public.clienteling_opportunities%rowtype;
begin
  if public.current_retailer_id() is distinct from p_retailer_id then
    raise exception 'Retailer mismatch';
  end if;

  if public.current_retailer_role() not in (
    'sales_associate', 'manager', 'admin', 'owner'
  ) then
    raise exception 'Insufficient role';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
  ) then
    raise exception 'Customer not found for retailer';
  end if;

  for v_draft in select * from jsonb_array_elements(coalesce(p_drafts, '[]'::jsonb))
  loop
    insert into public.clienteling_opportunities (
      retailer_id,
      customer_id,
      hook_kind,
      projector_key,
      projector_version,
      title,
      why_now,
      suggested_action,
      suggested_channel,
      suggested_at,
      status,
      priority,
      confidence,
      due_at,
      expires_at,
      evidence
    )
    values (
      p_retailer_id,
      p_customer_id,
      v_draft->>'hookKind',
      v_draft->>'projectorKey',
      v_draft->>'projectorVersion',
      v_draft->>'title',
      v_draft->>'whyNow',
      v_draft->>'suggestedAction',
      v_draft->>'suggestedChannel',
      (v_draft->>'suggestedAt')::timestamptz,
      'draft',
      (v_draft->>'priority')::integer,
      (v_draft->>'confidence')::numeric,
      (v_draft->>'dueAt')::timestamptz,
      (v_draft->>'expiresAt')::timestamptz,
      coalesce(v_draft->'evidence', '[]'::jsonb)
    )
    on conflict (retailer_id, projector_key)
      where deleted_at is null
    do update set
      title = excluded.title,
      why_now = excluded.why_now,
      suggested_action = excluded.suggested_action,
      suggested_channel = excluded.suggested_channel,
      suggested_at = excluded.suggested_at,
      priority = excluded.priority,
      confidence = excluded.confidence,
      due_at = excluded.due_at,
      expires_at = excluded.expires_at,
      evidence = excluded.evidence,
      projector_version = excluded.projector_version,
      updated_at = now()
    where clienteling_opportunities.status = 'draft'
    returning * into v_row;

    if found then
      return next v_row;
    end if;
  end loop;

  return;
end;
$$;

create or replace function public.assign_clienteling_opportunity(
  p_opportunity_id uuid,
  p_staff_id uuid
) returns public.clienteling_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clienteling_opportunities%rowtype;
begin
  update public.clienteling_opportunities o
  set
    assigned_staff_id = p_staff_id,
    status = case when o.status = 'draft' then 'assigned' else o.status end,
    updated_at = now()
  where o.id = p_opportunity_id
    and o.retailer_id = public.current_retailer_id()
    and o.deleted_at is null
    and o.status in ('draft', 'assigned', 'in_progress')
    and exists (
      select 1
      from public.retailer_staff_members s
      where s.id = p_staff_id
        and s.retailer_id = o.retailer_id
        and s.deleted_at is null
        and s.accepted_at is not null
    )
  returning * into v_row;

  if not found then
    raise exception 'Opportunity not found or not assignable';
  end if;

  return v_row;
end;
$$;

create or replace function public.update_clienteling_opportunity_status(
  p_opportunity_id uuid,
  p_status text,
  p_feedback_note text default null
) returns public.clienteling_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clienteling_opportunities%rowtype;
begin
  if p_status not in (
    'draft', 'assigned', 'in_progress', 'completed', 'dismissed', 'expired'
  ) then
    raise exception 'Invalid status';
  end if;

  update public.clienteling_opportunities o
  set
    status = p_status,
    feedback_note = coalesce(p_feedback_note, o.feedback_note),
    updated_at = now()
  where o.id = p_opportunity_id
    and o.retailer_id = public.current_retailer_id()
    and o.deleted_at is null
  returning * into v_row;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  return v_row;
end;
$$;

create or replace function public.record_clienteling_opportunity_outcome(
  p_opportunity_id uuid,
  p_outcome_type text,
  p_staff_id uuid,
  p_message_id uuid default null,
  p_appointment_id uuid default null,
  p_order_id uuid default null,
  p_feedback_note text default null
) returns public.clienteling_opportunities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clienteling_opportunities%rowtype;
begin
  if p_outcome_type not in (
    'message_sent',
    'appointment_booked',
    'sale_recorded',
    'no_response',
    'not_relevant'
  ) then
    raise exception 'Invalid outcome type';
  end if;

  update public.clienteling_opportunities o
  set
    status = 'completed',
    outcome_type = p_outcome_type,
    outcome_message_id = p_message_id,
    outcome_appointment_id = p_appointment_id,
    outcome_order_id = p_order_id,
    outcome_recorded_at = now(),
    outcome_staff_id = p_staff_id,
    feedback_note = coalesce(p_feedback_note, o.feedback_note),
    updated_at = now()
  where o.id = p_opportunity_id
    and o.retailer_id = public.current_retailer_id()
    and o.deleted_at is null
    and o.status in ('draft', 'assigned', 'in_progress')
  returning * into v_row;

  if not found then
    raise exception 'Opportunity not found or already closed';
  end if;

  return v_row;
end;
$$;

revoke all on function public.sync_clienteling_opportunity_drafts(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.sync_clienteling_opportunity_drafts(uuid, uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.assign_clienteling_opportunity(uuid, uuid)
  from public, anon;
grant execute on function public.assign_clienteling_opportunity(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.update_clienteling_opportunity_status(uuid, text, text)
  from public, anon;
grant execute on function public.update_clienteling_opportunity_status(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.record_clienteling_opportunity_outcome(
  uuid, text, uuid, uuid, uuid, uuid, text
) from public, anon;
grant execute on function public.record_clienteling_opportunity_outcome(
  uuid, text, uuid, uuid, uuid, uuid, text
) to authenticated, service_role;

comment on table public.clienteling_opportunities is
  'Sparse human-reviewable clienteling opportunity drafts with cited evidence.';
