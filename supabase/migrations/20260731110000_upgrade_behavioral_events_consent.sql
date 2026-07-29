-- PAON Intelligence Platform Stage 3.1 — upgrade behavioral_events for consent,
-- retention, and typed interactions (ADR-021 preserved, ADR-061).

create type public.retention_class as enum (
  'personalization_standard',
  'legacy_analytics',
  'anonymous_session'
);

create type public.interaction_event_type as enum (
  'product_viewed',
  'category_browsed',
  'search_performed',
  'filter_applied',
  'product_favorited',
  'product_skipped',
  'cart_item_added',
  'knowledge_opened',
  'advisor_question_asked',
  'swipe_choice',
  'appointment_intent'
);

alter table public.behavioral_events
  add column interaction_type public.interaction_event_type,
  add column purpose public.consent_purpose,
  add column consent_snapshot jsonb,
  add column retention_class public.retention_class,
  add column retention_expires_at timestamptz,
  add column anonymous_session_id uuid,
  add column anonymized_at timestamptz;

-- Backfill legacy rows with a documented implicit basis.
update public.behavioral_events
set
  interaction_type = case name
    when 'product_viewed' then 'product_viewed'::public.interaction_event_type
    when 'category_browsed' then 'category_browsed'::public.interaction_event_type
    when 'product_favorited' then 'product_favorited'::public.interaction_event_type
    when 'product_skipped' then 'product_skipped'::public.interaction_event_type
    else 'product_viewed'::public.interaction_event_type
  end,
  purpose = 'personalization'::public.consent_purpose,
  consent_snapshot = jsonb_build_object(
    'purpose', 'personalization',
    'granted', true,
    'basis', 'legacy_implicit',
    'recordedAt', occurred_at,
    'version', 1
  ),
  retention_class = 'legacy_analytics'::public.retention_class,
  retention_expires_at = occurred_at + interval '730 days'
where interaction_type is null;

alter table public.behavioral_events
  alter column interaction_type set not null,
  alter column purpose set not null,
  alter column consent_snapshot set not null,
  alter column retention_class set not null;

alter table public.behavioral_events
  add constraint behavioral_events_consent_snapshot_object check (
    jsonb_typeof(consent_snapshot) = 'object'
  ),
  add constraint behavioral_events_anonymous_not_linked check (
    anonymized_at is null
    or customer_id is null
  );

create index behavioral_events_retention_expires_idx
  on public.behavioral_events (retention_expires_at)
  where anonymized_at is null;

create index behavioral_events_anonymous_session_idx
  on public.behavioral_events (anonymous_session_id, occurred_at desc)
  where anonymous_session_id is not null;

-- Replace capture RPC with consent-aware validation.
drop function if exists public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz
);

create or replace function public.capture_behavioral_event(
  p_retailer_id uuid,
  p_interaction_type public.interaction_event_type,
  p_properties jsonb default '{}'::jsonb,
  p_source text default 'server',
  p_customer_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_purpose public.consent_purpose default 'personalization',
  p_consent_snapshot jsonb default null,
  p_retention_class public.retention_class default 'personalization_standard',
  p_retention_expires_at timestamptz default null,
  p_anonymous_session_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_customer_id uuid := p_customer_id;
  v_snapshot jsonb := coalesce(p_consent_snapshot, '{}'::jsonb);
  v_retention_expires_at timestamptz := p_retention_expires_at;
begin
  if p_source not in ('customer_portal', 'retailer_portal', 'admin', 'server') then
    raise exception 'Invalid event source';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Event properties must be an object';
  end if;
  if jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'Consent snapshot must be an object';
  end if;

  if p_anonymous_session_id is not null and v_customer_id is not null then
    raise exception 'Anonymous session events cannot include customer_id';
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

  if p_purpose = 'personalization'
    and v_customer_id is not null
    and coalesce((v_snapshot ->> 'granted')::boolean, false) is false then
    raise exception 'Personalization consent required';
  end if;

  if v_retention_expires_at is null then
    v_retention_expires_at := p_occurred_at + interval '730 days';
  end if;

  insert into public.behavioral_events (
    retailer_id,
    customer_id,
    name,
    interaction_type,
    purpose,
    consent_snapshot,
    retention_class,
    retention_expires_at,
    anonymous_session_id,
    properties,
    source,
    occurred_at
  ) values (
    p_retailer_id,
    v_customer_id,
    p_interaction_type::text,
    p_interaction_type,
    p_purpose,
    v_snapshot,
    p_retention_class,
    v_retention_expires_at,
    p_anonymous_session_id,
    coalesce(p_properties, '{}'::jsonb),
    p_source,
    p_occurred_at
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(
  uuid,
  public.interaction_event_type,
  jsonb,
  text,
  uuid,
  timestamptz,
  public.consent_purpose,
  jsonb,
  public.retention_class,
  timestamptz,
  uuid
) from public;

grant execute on function public.capture_behavioral_event(
  uuid,
  public.interaction_event_type,
  jsonb,
  text,
  uuid,
  timestamptz,
  public.consent_purpose,
  jsonb,
  public.retention_class,
  timestamptz,
  uuid
) to authenticated, service_role;

create or replace function public.anonymize_expired_interaction_events(
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'Service role required';
  end if;

  update public.behavioral_events be
  set
    properties = '{}'::jsonb,
    customer_id = null,
    anonymized_at = p_now,
    consent_snapshot = jsonb_build_object(
      'purpose', be.purpose::text,
      'granted', false,
      'basis', 'withdrawn',
      'recordedAt', p_now,
      'version', 1
    )
  where be.anonymized_at is null
    and (
      (be.retention_expires_at is not null and be.retention_expires_at <= p_now)
      or exists (
        select 1
        from public.customer_consent_records ccr
        where ccr.retailer_id = be.retailer_id
          and ccr.customer_id = be.customer_id
          and ccr.purpose = be.purpose
          and ccr.retention_deadline_at is not null
          and ccr.retention_deadline_at <= p_now
      )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.anonymize_expired_interaction_events(timestamptz) from public;
grant execute on function public.anonymize_expired_interaction_events(timestamptz)
  to service_role;

comment on column public.behavioral_events.consent_snapshot is
  'Immutable capture-time consent basis for explainable advisor intelligence (ADR-061).';
