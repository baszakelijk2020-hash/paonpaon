-- PHASE 7.6 / CLI-007: For You interaction event names.

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
      'tie_mate_impressed',
      'for_you_impressed',
      'for_you_clicked',
      'for_you_dismissed',
      'for_you_corrected'
    )
  );

-- Extend capture RPC allowlist for For You feedback events.
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
    'tie_mate_impressed',
    'for_you_impressed',
    'for_you_clicked',
    'for_you_dismissed',
    'for_you_corrected'
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
