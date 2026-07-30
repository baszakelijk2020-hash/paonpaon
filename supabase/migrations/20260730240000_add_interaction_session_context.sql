-- PHASE 7.2 / CLI-001: first-party interaction sessions + event context.
-- Authenticated sessions only; anonymous persistence remains jurisdiction-gated.

create table if not exists public.interaction_sessions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid references public.customers (id) on delete cascade,
  anonymous_session_id uuid,
  state text not null default 'active'
    check (state in ('active', 'idle', 'ended')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  device_class text not null default 'unknown'
    check (device_class in ('mobile', 'tablet', 'desktop', 'unknown')),
  locale text,
  timezone text,
  user_agent_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_sessions_subject_chk check (
    (customer_id is not null and anonymous_session_id is null)
    or (customer_id is null and anonymous_session_id is not null)
  ),
  constraint interaction_sessions_ended_chk check (
    (state = 'ended' and ended_at is not null)
    or (state <> 'ended' and ended_at is null)
  )
);

create index if not exists interaction_sessions_retailer_customer_open_idx
  on public.interaction_sessions (retailer_id, customer_id, last_seen_at desc)
  where customer_id is not null and state <> 'ended';

alter table public.interaction_sessions enable row level security;

revoke all on table public.interaction_sessions from public, anon;
grant select on table public.interaction_sessions to authenticated;
grant all on table public.interaction_sessions to service_role;

create policy interaction_sessions_retailer_select
  on public.interaction_sessions for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy interaction_sessions_customer_select
  on public.interaction_sessions for select to authenticated
  using (
    customer_id is not null
    and exists (
      select 1
      from public.customers c
      where c.id = interaction_sessions.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Event context columns on the existing evidence ledger.
alter table public.behavioral_events
  add column if not exists session_id uuid
    references public.interaction_sessions (id) on delete set null,
  add column if not exists correlation_id text,
  add column if not exists idempotency_key text,
  add column if not exists received_at timestamptz,
  add column if not exists page_path text,
  add column if not exists device_class text
    check (
      device_class is null
      or device_class in ('mobile', 'tablet', 'desktop', 'unknown')
    );

create unique index if not exists behavioral_events_retailer_idempotency_uidx
  on public.behavioral_events (retailer_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists behavioral_events_session_idx
  on public.behavioral_events (session_id, occurred_at desc)
  where session_id is not null;

alter table public.behavioral_events
  drop constraint if exists behavioral_events_name_check;

alter table public.behavioral_events
  add constraint behavioral_events_name_check check (
    name in (
      'session_started',
      'session_heartbeat',
      'session_ended',
      'page_viewed',
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
      'tie_mate_impressed'
    )
  );

-- Ensure / resume an authenticated personalization session.
create or replace function public.ensure_interaction_session(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_now timestamptz default now(),
  p_device_class text default 'unknown',
  p_locale text default null,
  p_timezone text default null,
  p_idle_minutes integer default 30
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_session_id uuid;
  v_device text := coalesce(nullif(p_device_class, ''), 'unknown');
begin
  if v_device not in ('mobile', 'tablet', 'desktop', 'unknown') then
    raise exception 'Invalid device class';
  end if;

  if auth.uid() is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.retailer_id = p_retailer_id
      and c.user_id = auth.uid()
      and c.id = p_customer_id
    limit 1;
    if v_customer_id is null then
      raise exception 'Customer relationship required';
    end if;
  elsif current_user not in ('service_role', 'postgres') then
    raise exception 'Authentication required';
  else
    v_customer_id := p_customer_id;
  end if;

  select s.id into v_session_id
  from public.interaction_sessions s
  where s.retailer_id = p_retailer_id
    and s.customer_id = v_customer_id
    and s.state <> 'ended'
    and s.last_seen_at > p_now - make_interval(mins => greatest(p_idle_minutes, 1))
  order by s.last_seen_at desc
  limit 1
  for update;

  if v_session_id is not null then
    update public.interaction_sessions
    set
      last_seen_at = p_now,
      state = 'active',
      device_class = v_device,
      locale = coalesce(p_locale, locale),
      timezone = coalesce(p_timezone, timezone),
      updated_at = p_now
    where id = v_session_id;
    return v_session_id;
  end if;

  insert into public.interaction_sessions (
    retailer_id,
    customer_id,
    state,
    started_at,
    last_seen_at,
    device_class,
    locale,
    timezone
  ) values (
    p_retailer_id,
    v_customer_id,
    'active',
    p_now,
    p_now,
    v_device,
    p_locale,
    p_timezone
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.ensure_interaction_session(
  uuid, uuid, timestamptz, text, text, text, integer
) from public;
grant execute on function public.ensure_interaction_session(
  uuid, uuid, timestamptz, text, text, text, integer
) to authenticated, service_role;

-- Replace capture RPC with session/idempotency/context support.
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
  p_correlation_id text default null,
  p_idempotency_key text default null,
  p_received_at timestamptz default null,
  p_page_path text default null,
  p_device_class text default null
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
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_device text := nullif(p_device_class, '');
begin
  if p_name is null or p_name not in (
    'session_started',
    'session_heartbeat',
    'session_ended',
    'page_viewed',
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
    'tie_mate_impressed'
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
  if v_device is not null
    and v_device not in ('mobile', 'tablet', 'desktop', 'unknown')
  then
    raise exception 'Invalid device class';
  end if;
  if v_key is not null and char_length(v_key) > 200 then
    raise exception 'Invalid idempotency key';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Event properties must be an object';
  end if;
  if p_properties ? 'orderPayload'
    or p_properties ? 'appointmentPayload'
    or p_properties ? 'messagePayload'
    or p_properties ? 'rawPrompt'
    or p_properties ? 'password'
    or p_properties ? 'cardNumber'
    or p_properties ? 'cvv'
    or p_properties ? 'credentials'
    or p_properties ? 'rawForm'
    or p_properties ? 'formValues'
  then
    raise exception 'Event must not capture sensitive or durable payloads';
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

  if p_session_id is not null and not exists (
    select 1
    from public.interaction_sessions s
    where s.id = p_session_id
      and s.retailer_id = p_retailer_id
      and (v_customer_id is null or s.customer_id = v_customer_id)
  ) then
    raise exception 'Session does not belong to retailer relationship';
  end if;

  if v_key is not null then
    select be.id into v_id
    from public.behavioral_events be
    where be.retailer_id = p_retailer_id
      and be.idempotency_key = v_key
    limit 1;
    if v_id is not null then
      return v_id;
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
    correlation_id,
    idempotency_key,
    received_at,
    page_path,
    device_class
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
    nullif(p_correlation_id, ''),
    v_key,
    coalesce(p_received_at, now()),
    nullif(p_page_path, ''),
    v_device
  ) returning id into v_id;

  if p_session_id is not null then
    update public.interaction_sessions
    set
      last_seen_at = coalesce(p_occurred_at, now()),
      state = case when state = 'ended' then state else 'active' end,
      updated_at = now()
    where id = p_session_id
      and state <> 'ended';
  end if;

  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid,
  uuid, text, text, timestamptz, text, text
) from public;
grant execute on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid,
  uuid, text, text, timestamptz, text, text
) to authenticated, service_role;

comment on table public.interaction_sessions is
  'First-party authenticated interaction sessions for PAON/storefront activity (PHASE 7.2).';
comment on column public.behavioral_events.session_id is
  'Optional link to interaction_sessions for session-count projectors.';
comment on column public.behavioral_events.idempotency_key is
  'Optional retailer-scoped dedupe key for capture retries.';
