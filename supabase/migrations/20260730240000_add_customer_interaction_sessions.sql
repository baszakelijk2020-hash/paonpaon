-- PAON Intelligence Platform Stage 7.2.
-- Signed-in customer interaction sessions, session-scoped event capture,
-- idempotency keys, and extended session/context event taxonomy (ADR-066).

-- ---------------------------------------------------------------------------
-- Session registry
-- ---------------------------------------------------------------------------

create table if not exists public.customer_interaction_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  route text not null check (length(btrim(route)) between 1 and 500),
  visibility_state text not null default 'visible' check (
    visibility_state in ('visible', 'hidden', 'idle')
  ),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  idle_since timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_interaction_sessions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists customer_interaction_sessions_customer_active_idx
  on public.customer_interaction_sessions (customer_id, last_heartbeat_at desc)
  where ended_at is null;

create index if not exists customer_interaction_sessions_retailer_started_idx
  on public.customer_interaction_sessions (retailer_id, started_at desc);

alter table public.customer_interaction_sessions enable row level security;

revoke all on table public.customer_interaction_sessions from anon;

create policy "customers read own interaction sessions"
  on public.customer_interaction_sessions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_interaction_sessions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer advisors read tenant interaction sessions"
  on public.customer_interaction_sessions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read interaction sessions"
  on public.customer_interaction_sessions for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.customer_interaction_sessions
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- behavioral_events: session link + idempotency
-- ---------------------------------------------------------------------------

alter table public.behavioral_events
  add column if not exists session_id uuid
    references public.customer_interaction_sessions (id) on delete set null,
  add column if not exists idempotency_key text
    check (
      idempotency_key is null
      or length(btrim(idempotency_key)) between 1 and 200
    );

create unique index if not exists behavioral_events_retailer_idempotency_uidx
  on public.behavioral_events (retailer_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists behavioral_events_session_occurred_idx
  on public.behavioral_events (session_id, occurred_at desc)
  where session_id is not null;

alter table public.behavioral_events
  drop constraint if exists behavioral_events_name_check;

alter table public.behavioral_events
  add constraint behavioral_events_name_check check (
    name in (
      'product_viewed',
      'category_browsed',
      'search_performed',
      'filter_applied',
      'product_favorited',
      'product_skipped',
      'cart_updated',
      'knowledge_opened',
      'advisor_question',
      'appointment_intent',
      'conversion_recorded',
      'session_started',
      'session_resumed',
      'session_heartbeat',
      'session_ended',
      'page_visibility_changed',
      'route_impression',
      'product_card_impression',
      'product_dwell_threshold',
      'scroll_depth_threshold',
      'tie_mate_impression'
    )
  );

-- ---------------------------------------------------------------------------
-- Session lifecycle RPCs
-- ---------------------------------------------------------------------------

create or replace function public.start_customer_interaction_session(
  p_retailer_id uuid,
  p_route text,
  p_resume_session_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_session_id uuid;
  v_resume record;
begin
  if p_route is null or length(btrim(p_route)) = 0 then
    raise exception 'Route is required';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.retailer_id = p_retailer_id
    and c.user_id = auth.uid()
    and c.deleted_at is null
  limit 1;

  if v_customer_id is null then
    raise exception 'Customer relationship required';
  end if;

  if p_resume_session_id is not null then
    select s.id, s.last_heartbeat_at
    into v_resume
    from public.customer_interaction_sessions s
    where s.id = p_resume_session_id
      and s.retailer_id = p_retailer_id
      and s.customer_id = v_customer_id
      and s.ended_at is null
      and s.last_heartbeat_at > now() - interval '30 minutes';

    if found then
      update public.customer_interaction_sessions
      set
        last_heartbeat_at = now(),
        route = btrim(p_route),
        visibility_state = 'visible',
        idle_since = null
      where id = v_resume.id
      returning id into v_session_id;

      return v_session_id;
    end if;
  end if;

  insert into public.customer_interaction_sessions (
    retailer_id,
    customer_id,
    route,
    visibility_state,
    started_at,
    last_heartbeat_at
  ) values (
    p_retailer_id,
    v_customer_id,
    btrim(p_route),
    'visible',
    now(),
    now()
  ) returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.heartbeat_customer_interaction_session(
  p_session_id uuid,
  p_visibility_state text default 'visible',
  p_route text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_session_id uuid;
begin
  if p_visibility_state not in ('visible', 'hidden', 'idle') then
    raise exception 'Invalid visibility state';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.user_id = auth.uid()
    and c.deleted_at is null
  limit 1;

  if v_customer_id is null then
    raise exception 'Customer relationship required';
  end if;

  update public.customer_interaction_sessions s
  set
    last_heartbeat_at = now(),
    visibility_state = p_visibility_state,
    route = coalesce(nullif(btrim(p_route), ''), s.route),
    idle_since = case
      when p_visibility_state = 'idle' then coalesce(s.idle_since, now())
      else null
    end
  where s.id = p_session_id
    and s.customer_id = v_customer_id
    and s.ended_at is null
  returning s.id into v_session_id;

  if v_session_id is null then
    raise exception 'Session not found or already ended';
  end if;

  return v_session_id;
end;
$$;

create or replace function public.end_customer_interaction_session(
  p_session_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_session_id uuid;
begin
  select c.id into v_customer_id
  from public.customers c
  where c.user_id = auth.uid()
    and c.deleted_at is null
  limit 1;

  if v_customer_id is null then
    raise exception 'Customer relationship required';
  end if;

  update public.customer_interaction_sessions s
  set
    ended_at = coalesce(s.ended_at, now()),
    last_heartbeat_at = now()
  where s.id = p_session_id
    and s.customer_id = v_customer_id
  returning s.id into v_session_id;

  if v_session_id is null then
    raise exception 'Session not found';
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.start_customer_interaction_session(uuid, text, uuid)
  from public;
grant execute on function public.start_customer_interaction_session(uuid, text, uuid)
  to authenticated, service_role;

revoke all on function public.heartbeat_customer_interaction_session(uuid, text, text)
  from public;
grant execute on function public.heartbeat_customer_interaction_session(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.end_customer_interaction_session(uuid)
  from public;
grant execute on function public.end_customer_interaction_session(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capture RPC: session + idempotency + extended taxonomy
-- ---------------------------------------------------------------------------

drop function if exists public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid
);

create or replace function public.capture_behavioral_event(
  p_retailer_id uuid,
  p_name text,
  p_properties jsonb default '{}'::jsonb,
  p_source text default 'server',
  p_customer_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_purpose text default 'personalization',
  p_consent_basis text default 'explicit_opt_in',
  p_consent_snapshot jsonb default null,
  p_retention_class text default 'personalization_signal',
  p_retention_expires_at timestamptz default null,
  p_anonymous_session_id uuid default null,
  p_session_id uuid default null,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_customer_id uuid := p_customer_id;
  v_snapshot jsonb;
  v_personalization text;
  v_opt_in boolean;
  v_withdrawn timestamptz;
  v_expires timestamptz;
  v_idempotency_key text;
begin
  if p_name is null or p_name not in (
    'product_viewed',
    'category_browsed',
    'search_performed',
    'filter_applied',
    'product_favorited',
    'product_skipped',
    'cart_updated',
    'knowledge_opened',
    'advisor_question',
    'appointment_intent',
    'conversion_recorded',
    'session_started',
    'session_resumed',
    'session_heartbeat',
    'session_ended',
    'page_visibility_changed',
    'route_impression',
    'product_card_impression',
    'product_dwell_threshold',
    'scroll_depth_threshold',
    'tie_mate_impression'
  ) then
    raise exception 'Invalid event name';
  end if;
  if p_source not in ('customer_portal', 'retailer_portal', 'admin', 'server') then
    raise exception 'Invalid event source';
  end if;
  if p_purpose not in ('personalization', 'marketing', 'location') then
    raise exception 'Invalid event purpose';
  end if;
  if p_consent_basis not in (
    'explicit_opt_in',
    'explicit_opt_out',
    'legitimate_interest_anonymous',
    'service_necessary'
  ) then
    raise exception 'Invalid consent basis';
  end if;
  if p_retention_class not in ('personalization_signal', 'operational_analytics') then
    raise exception 'Invalid retention class';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Event properties must be an object';
  end if;
  if p_properties ? 'orderPayload'
    or p_properties ? 'appointmentPayload'
    or p_properties ? 'messagePayload'
    or p_properties ? 'rawPrompt'
    or p_properties ? 'password'
    or p_properties ? 'payment'
    or p_properties ? 'credential'
    or p_properties ? 'credentials'
    or p_properties ? 'cardNumber'
    or p_properties ? 'cvv'
    or p_properties ? 'formContents'
  then
    raise exception 'Event must not capture sensitive or durable business records';
  end if;

  v_idempotency_key := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  if v_idempotency_key is not null then
    select be.id into v_id
    from public.behavioral_events be
    where be.retailer_id = p_retailer_id
      and be.idempotency_key = v_idempotency_key
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if p_anonymous_session_id is not null then
    raise exception 'Anonymous interaction persistence is not enabled for this jurisdiction';
  end if;

  if auth.uid() is not null then
    if p_source = 'customer_portal' then
      select c.id into v_customer_id
      from public.customers c
      where c.retailer_id = p_retailer_id and c.user_id = auth.uid()
      limit 1;
      if v_customer_id is null then
        raise exception 'Customer relationship required';
      end if;
    elsif p_source = 'retailer_portal' then
      if p_retailer_id <> public.current_retailer_id()
        or public.current_retailer_role() in ('workshop_manager', 'worker', 'read_only') then
        raise exception 'Not authorized to capture this event';
      end if;
      if v_customer_id is not null and not exists (
        select 1 from public.customers c
        where c.id = v_customer_id and c.retailer_id = p_retailer_id
      ) then
        raise exception 'Customer does not belong to retailer';
      end if;
    elsif not public.is_platform_staff() then
      raise exception 'Not authorized to capture this event';
    end if;
  elsif current_user not in ('service_role', 'postgres') then
    raise exception 'Authentication required';
  end if;

  if p_session_id is not null then
    if not exists (
      select 1
      from public.customer_interaction_sessions s
      where s.id = p_session_id
        and s.retailer_id = p_retailer_id
        and s.customer_id = v_customer_id
    ) then
      raise exception 'Session does not belong to customer';
    end if;
  end if;

  if v_customer_id is not null and p_purpose = 'personalization' then
    select
      coalesce(cp.personalization_opt_in, false),
      cp.personalization_withdrawn_at
    into v_opt_in, v_withdrawn
    from public.customer_preferences cp
    where cp.customer_id = v_customer_id;

    if v_withdrawn is not null or coalesce(v_opt_in, false) is not true then
      raise exception 'Personalization consent required';
    end if;
  end if;

  v_snapshot := coalesce(
    p_consent_snapshot,
    jsonb_build_object(
      'personalization', case when coalesce(v_opt_in, false) then 'granted' else 'denied' end,
      'marketing', 'denied',
      'location', 'denied',
      'capturedAt', coalesce(p_occurred_at, now()),
      'basis', p_consent_basis
    )
  );
  if jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'Consent snapshot must be an object';
  end if;

  v_personalization := v_snapshot ->> 'personalization';
  if v_customer_id is not null
    and p_purpose = 'personalization'
    and v_personalization is distinct from 'granted'
  then
    raise exception 'Consent snapshot must show personalization granted';
  end if;

  v_expires := coalesce(
    p_retention_expires_at,
    coalesce(p_occurred_at, now()) + interval '365 days'
  );

  insert into public.behavioral_events (
    retailer_id,
    customer_id,
    name,
    properties,
    source,
    occurred_at,
    purpose,
    consent_basis,
    consent_snapshot,
    retention_class,
    retention_expires_at,
    anonymous_session_id,
    session_id,
    idempotency_key
  ) values (
    p_retailer_id,
    v_customer_id,
    p_name,
    coalesce(p_properties, '{}'::jsonb),
    p_source,
    coalesce(p_occurred_at, now()),
    p_purpose,
    p_consent_basis,
    v_snapshot,
    p_retention_class,
    v_expires,
    null,
    p_session_id,
    v_idempotency_key
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid, uuid, text
) from public;
grant execute on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid, uuid, text
) to authenticated, service_role;

comment on table public.customer_interaction_sessions is
  'Signed-in first-party interaction sessions for session-scoped event context (PHASE 7.2).';
comment on column public.behavioral_events.session_id is
  'Optional link to customer_interaction_sessions for session counts and context.';
comment on column public.behavioral_events.idempotency_key is
  'Retailer-scoped dedupe key for retried captures.';
