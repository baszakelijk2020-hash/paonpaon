-- PAON Intelligence Platform Stage 3.1.
-- Purpose-specific consent, typed interaction-event upgrade, retention,
-- withdrawal anonymization, and lawful anonymous session support (denied
-- until a jurisdiction documents a basis — PHASE 3.1 hard blocker).

-- ---------------------------------------------------------------------------
-- Customer preferences: separate personalization / location from marketing
-- ---------------------------------------------------------------------------

alter table public.customer_preferences
  add column if not exists personalization_opt_in boolean not null default false,
  add column if not exists location_opt_in boolean not null default false,
  add column if not exists personalization_withdrawn_at timestamptz,
  add column if not exists marketing_withdrawn_at timestamptz,
  add column if not exists location_withdrawn_at timestamptz;

comment on column public.customer_preferences.personalization_opt_in is
  'Explicit personalization / StyleProfile consent (ADR-061). Independent of marketing_opt_in.';
comment on column public.customer_preferences.location_opt_in is
  'Separate precise-location opt-in. Never required for baseline personalization.';

-- ---------------------------------------------------------------------------
-- Append-only consent history (grant / deny / withdraw)
-- ---------------------------------------------------------------------------

-- Composite uniqueness so consent rows cannot cross retailer boundaries.
create unique index if not exists customers_id_retailer_uidx
  on public.customers (id, retailer_id);

create table if not exists public.customer_consent_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  purpose text not null check (
    purpose in ('personalization', 'marketing', 'location')
  ),
  status text not null check (
    status in ('granted', 'denied', 'withdrawn')
  ),
  previous_status text check (
    previous_status is null
    or previous_status in ('granted', 'denied', 'withdrawn')
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  reason text check (
    reason is null
    or length(btrim(reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  constraint customer_consent_events_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index if not exists customer_consent_events_customer_created_idx
  on public.customer_consent_events (customer_id, created_at desc);

create index if not exists customer_consent_events_retailer_created_idx
  on public.customer_consent_events (retailer_id, created_at desc);

alter table public.customer_consent_events enable row level security;

revoke all on table public.customer_consent_events from anon;

create policy "customers read own consent events"
  on public.customer_consent_events for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_consent_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant consent events"
  on public.customer_consent_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read consent events"
  on public.customer_consent_events for select to authenticated
  using ((select public.is_platform_staff()));

-- No direct insert/update/delete for authenticated — RPC only.
grant select on table public.customer_consent_events
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- behavioral_events: purpose, consent snapshot, retention, anonymous session
-- ---------------------------------------------------------------------------

alter table public.behavioral_events
  add column if not exists purpose text
    check (purpose in ('personalization', 'marketing', 'location')),
  add column if not exists consent_basis text
    check (
      consent_basis in (
        'explicit_opt_in',
        'explicit_opt_out',
        'legitimate_interest_anonymous',
        'service_necessary'
      )
    ),
  add column if not exists consent_snapshot jsonb
    check (
      consent_snapshot is null
      or jsonb_typeof(consent_snapshot) = 'object'
    ),
  add column if not exists retention_class text
    check (
      retention_class in ('personalization_signal', 'operational_analytics')
    ),
  add column if not exists retention_expires_at timestamptz,
  add column if not exists anonymous_session_id uuid,
  add column if not exists anonymized_at timestamptz;

-- Backfill legacy rows so new NOT NULL constraints can apply.
update public.behavioral_events
set
  purpose = coalesce(purpose, 'personalization'),
  consent_basis = coalesce(consent_basis, 'explicit_opt_in'),
  consent_snapshot = coalesce(
    consent_snapshot,
    jsonb_build_object(
      'personalization', 'granted',
      'marketing', 'denied',
      'location', 'denied',
      'capturedAt', occurred_at,
      'basis', 'explicit_opt_in'
    )
  ),
  retention_class = coalesce(retention_class, 'personalization_signal'),
  retention_expires_at = coalesce(
    retention_expires_at,
    occurred_at + interval '365 days'
  )
where purpose is null
   or consent_basis is null
   or consent_snapshot is null
   or retention_class is null
   or retention_expires_at is null;

alter table public.behavioral_events
  alter column purpose set default 'personalization',
  alter column purpose set not null,
  alter column consent_basis set default 'explicit_opt_in',
  alter column consent_basis set not null,
  alter column consent_snapshot set default jsonb_build_object(
    'personalization', 'denied',
    'marketing', 'denied',
    'location', 'denied',
    'capturedAt', now(),
    'basis', 'explicit_opt_out'
  ),
  alter column consent_snapshot set not null,
  alter column retention_class set default 'personalization_signal',
  alter column retention_class set not null,
  alter column retention_expires_at set default (now() + interval '365 days'),
  alter column retention_expires_at set not null;

-- Constrain event names to the typed CUST-001 set (legacy free-form blocked).
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
      'conversion_recorded'
    )
  );

-- Subject: customer XOR anonymous for customer_portal captures (enforced in RPC).
-- Never allow retroactive linking of an anonymous session onto a customer row.
create or replace function public.prevent_behavioral_event_identity_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.anonymous_session_id is not null
      and old.customer_id is null
      and new.customer_id is not null
    then
      raise exception 'Anonymous session cannot be linked to a customer';
    end if;
    if old.anonymized_at is not null and new.anonymized_at is distinct from old.anonymized_at then
      raise exception 'Anonymized behavioral events are immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_behavioral_event_identity_link
  on public.behavioral_events;
create trigger prevent_behavioral_event_identity_link
  before update on public.behavioral_events
  for each row execute function public.prevent_behavioral_event_identity_link();

create index if not exists behavioral_events_anonymous_session_idx
  on public.behavioral_events (anonymous_session_id, occurred_at desc)
  where anonymous_session_id is not null;

create index if not exists behavioral_events_retention_expires_idx
  on public.behavioral_events (retention_expires_at)
  where anonymized_at is null;

-- Advisors/managers still read tenant events; usable personalization reads
-- filter anonymized/expired in repository/RPC.
drop policy if exists "retailer managers read behavioral events"
  on public.behavioral_events;

create policy "retailer advisors read behavioral events"
  on public.behavioral_events for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "customers read own usable behavioral events"
  on public.behavioral_events for select to authenticated
  using (
    customer_id is not null
    and anonymized_at is null
    and retention_expires_at > now()
    and exists (
      select 1 from public.customers c
      where c.id = behavioral_events.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Anonymize personalization signals (withdrawal / retention expiry)
-- ---------------------------------------------------------------------------

create or replace function public.anonymize_behavioral_events_for_customer(
  p_retailer_id uuid,
  p_customer_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.behavioral_events
  set
    customer_id = null,
    anonymized_at = now(),
    properties = '{}'::jsonb,
    consent_snapshot = jsonb_set(
      consent_snapshot,
      '{personalization}',
      '"withdrawn"'::jsonb
    )
  where retailer_id = p_retailer_id
    and customer_id = p_customer_id
    and retention_class = 'personalization_signal'
    and anonymized_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.anonymize_behavioral_events_for_customer(uuid, uuid)
  from public;
grant execute on function public.anonymize_behavioral_events_for_customer(uuid, uuid)
  to service_role;

create or replace function public.anonymize_expired_behavioral_events(
  p_limit integer default 1000
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    select id
    from public.behavioral_events
    where anonymized_at is null
      and retention_expires_at <= now()
      and retention_class = 'personalization_signal'
    order by retention_expires_at
    limit greatest(1, least(coalesce(p_limit, 1000), 5000))
  )
  update public.behavioral_events be
  set
    customer_id = null,
    anonymized_at = now(),
    properties = '{}'::jsonb
  from expired
  where be.id = expired.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.anonymize_expired_behavioral_events(integer) from public;
grant execute on function public.anonymize_expired_behavioral_events(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Consent set / withdraw RPC (customer self-service)
-- ---------------------------------------------------------------------------

create or replace function public.set_customer_consent(
  p_customer_id uuid,
  p_purpose text,
  p_status text,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_user_id uuid := auth.uid();
  v_prev text;
  v_opt_in boolean := p_status = 'granted';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_purpose not in ('personalization', 'marketing', 'location') then
    raise exception 'Invalid consent purpose';
  end if;
  if p_status not in ('granted', 'denied', 'withdrawn') then
    raise exception 'Invalid consent status';
  end if;

  select c.retailer_id into v_retailer_id
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = v_user_id
    and c.deleted_at is null;

  if v_retailer_id is null then
    raise exception 'Not authorized to change consent for this customer';
  end if;

  insert into public.customer_preferences (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do nothing;

  if p_purpose = 'personalization' then
    select case
      when personalization_withdrawn_at is not null then 'withdrawn'
      when personalization_opt_in then 'granted'
      else 'denied'
    end into v_prev
    from public.customer_preferences
    where customer_id = p_customer_id;

    update public.customer_preferences
    set
      personalization_opt_in = v_opt_in,
      personalization_withdrawn_at = case
        when p_status = 'withdrawn' then now()
        when p_status = 'granted' then null
        else personalization_withdrawn_at
      end,
      updated_at = now()
    where customer_id = p_customer_id;

  elsif p_purpose = 'marketing' then
    select case
      when marketing_withdrawn_at is not null then 'withdrawn'
      when marketing_opt_in then 'granted'
      else 'denied'
    end into v_prev
    from public.customer_preferences
    where customer_id = p_customer_id;

    update public.customer_preferences
    set
      marketing_opt_in = v_opt_in,
      marketing_withdrawn_at = case
        when p_status = 'withdrawn' then now()
        when p_status = 'granted' then null
        else marketing_withdrawn_at
      end,
      updated_at = now()
    where customer_id = p_customer_id;

  else
    select case
      when location_withdrawn_at is not null then 'withdrawn'
      when location_opt_in then 'granted'
      else 'denied'
    end into v_prev
    from public.customer_preferences
    where customer_id = p_customer_id;

    update public.customer_preferences
    set
      location_opt_in = v_opt_in,
      location_withdrawn_at = case
        when p_status = 'withdrawn' then now()
        when p_status = 'granted' then null
        else location_withdrawn_at
      end,
      updated_at = now()
    where customer_id = p_customer_id;
  end if;

  insert into public.customer_consent_events (
    retailer_id, customer_id, purpose, status, previous_status,
    actor_user_id, reason
  ) values (
    v_retailer_id, p_customer_id, p_purpose, p_status, v_prev,
    v_user_id, nullif(btrim(coalesce(p_reason, '')), '')
  );

  if p_purpose = 'personalization' and p_status = 'withdrawn' then
    perform public.anonymize_behavioral_events_for_customer(
      v_retailer_id, p_customer_id
    );
  end if;
end;
$$;

revoke all on function public.set_customer_consent(uuid, text, text, text)
  from public;
grant execute on function public.set_customer_consent(uuid, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capture RPC: consent fail-closed + typed fields + anonymous denial
-- ---------------------------------------------------------------------------

drop function if exists public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz
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
  p_anonymous_session_id uuid default null
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
    'conversion_recorded'
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
  then
    raise exception 'Event must not duplicate durable business records';
  end if;

  -- Anonymous persistence blocked until jurisdiction documents a lawful basis.
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

  -- Fail closed: signed-in personalization requires explicit opt-in.
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
    anonymous_session_id
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
    null
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid
) from public;
grant execute on function public.capture_behavioral_event(
  uuid, text, jsonb, text, uuid, timestamptz,
  text, text, jsonb, text, timestamptz, uuid
) to authenticated, service_role;

comment on table public.customer_consent_events is
  'Append-only purpose-specific consent history for personalization, marketing, and location.';
comment on column public.behavioral_events.consent_snapshot is
  'Consent state at capture time; advisors fail closed when personalization is not granted.';
comment on column public.behavioral_events.anonymous_session_id is
  'Lawful anonymous session id when jurisdiction allows; capture currently rejects anonymous persistence.';
