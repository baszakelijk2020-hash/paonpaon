-- MorningRoutine delivery subscriptions, audit, and retailer controls
-- (PHASE 4.5 / MR-002, MR-003, CUST-003 / ADR-061).

alter type public.notification_category add value if not exists 'morning_routine';

-- ---------------------------------------------------------------------------
-- morning_routine_subscriptions — explicit opt-in delivery per relationship
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_subscriptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  delivery_opt_in boolean not null default false,
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly')),
  channels text[] not null default array['in_app']::text[]
    check (channels <@ array['in_app', 'email']::text[] and cardinality(channels) >= 1),
  timezone text not null default 'UTC',
  delivery_hour_local smallint not null default 7
    check (delivery_hour_local between 0 and 23),
  quiet_start_hour smallint
    check (quiet_start_hour is null or quiet_start_hour between 0 and 23),
  quiet_end_hour smallint
    check (quiet_end_hour is null or quiet_end_hour between 0 and 23),
  weekly_anchor_dow smallint not null default 1
    check (weekly_anchor_dow between 0 and 6),
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, customer_id),
  constraint morning_routine_subscriptions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
);

create index if not exists morning_routine_subscriptions_due_idx
  on public.morning_routine_subscriptions (retailer_id, delivery_opt_in)
  where delivery_opt_in = true and unsubscribed_at is null;

create trigger set_morning_routine_subscriptions_updated_at
  before update on public.morning_routine_subscriptions
  for each row
  execute function public.set_updated_at();

comment on table public.morning_routine_subscriptions is
  'Explicit MorningRoutine delivery opt-in — separate from marketing consent (MR-002).';

alter table public.morning_routine_subscriptions enable row level security;
revoke all on table public.morning_routine_subscriptions from anon;

create policy "customers manage own morning routine subscriptions"
  on public.morning_routine_subscriptions for all to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_subscriptions.customer_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_subscriptions.customer_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "retailer staff read tenant morning routine subscriptions"
  on public.morning_routine_subscriptions for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff manage morning routine subscriptions"
  on public.morning_routine_subscriptions for all to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on table public.morning_routine_subscriptions
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_retailer_settings — eligible catalogue controls (MR-003)
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_retailer_settings (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  enabled boolean not null default true,
  delivery_hour_local smallint not null default 7
    check (delivery_hour_local between 0 and 23),
  eligible_product_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now()
);

create trigger set_morning_routine_retailer_settings_updated_at
  before update on public.morning_routine_retailer_settings
  for each row
  execute function public.set_updated_at();

comment on table public.morning_routine_retailer_settings is
  'Retailer MorningRoutine service controls — eligible catalogue allowlist only; cannot bypass consent.';

alter table public.morning_routine_retailer_settings enable row level security;
revoke all on table public.morning_routine_retailer_settings from anon;

create policy "retailer managers manage morning routine retailer settings"
  on public.morning_routine_retailer_settings for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

create policy "platform staff manage morning routine retailer settings"
  on public.morning_routine_retailer_settings for all to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on table public.morning_routine_retailer_settings
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_deliveries — auditable delivery / suppression log
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_deliveries (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  selection_id uuid references public.morning_routine_selections (id) on delete set null,
  for_date date not null,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'suppressed', 'failed')),
  suppressed_reason text,
  notification_id uuid references public.notifications (id) on delete set null,
  email_outbox_id uuid references public.email_outbox (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (retailer_id, customer_id, for_date, channel),
  constraint morning_routine_deliveries_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
);

create index if not exists morning_routine_deliveries_customer_day_idx
  on public.morning_routine_deliveries (customer_id, for_date desc);

create index if not exists morning_routine_deliveries_retailer_day_idx
  on public.morning_routine_deliveries (retailer_id, for_date desc);

comment on table public.morning_routine_deliveries is
  'Append-only MorningRoutine delivery audit with idempotent per-day channel rows.';

alter table public.morning_routine_deliveries enable row level security;
revoke all on table public.morning_routine_deliveries from anon;

create policy "customers read own morning routine deliveries"
  on public.morning_routine_deliveries for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_deliveries.customer_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "retailer staff read tenant morning routine deliveries"
  on public.morning_routine_deliveries for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff manage morning routine deliveries"
  on public.morning_routine_deliveries for all to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select on table public.morning_routine_deliveries to authenticated;
grant all on table public.morning_routine_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- RPC: upsert_morning_routine_subscription (customer-owned)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_morning_routine_subscription(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_delivery_opt_in boolean,
  p_frequency text,
  p_channels text[],
  p_timezone text,
  p_delivery_hour_local smallint,
  p_quiet_start_hour smallint,
  p_quiet_end_hour smallint,
  p_weekly_anchor_dow smallint default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized for this customer relationship';
  end if;

  if p_frequency not in ('daily', 'weekly') then
    raise exception 'Invalid frequency';
  end if;
  if p_channels is null or cardinality(p_channels) < 1
    or not (p_channels <@ array['in_app', 'email']::text[]) then
    raise exception 'Invalid channels';
  end if;

  insert into public.morning_routine_subscriptions (
    retailer_id,
    customer_id,
    delivery_opt_in,
    frequency,
    channels,
    timezone,
    delivery_hour_local,
    quiet_start_hour,
    quiet_end_hour,
    weekly_anchor_dow,
    unsubscribed_at
  ) values (
    p_retailer_id,
    p_customer_id,
    p_delivery_opt_in,
    p_frequency,
    p_channels,
    coalesce(nullif(trim(p_timezone), ''), 'UTC'),
    p_delivery_hour_local,
    p_quiet_start_hour,
    p_quiet_end_hour,
    coalesce(p_weekly_anchor_dow, 1),
    case when p_delivery_opt_in then null else now() end
  )
  on conflict (retailer_id, customer_id) do update set
    delivery_opt_in = excluded.delivery_opt_in,
    frequency = excluded.frequency,
    channels = excluded.channels,
    timezone = excluded.timezone,
    delivery_hour_local = excluded.delivery_hour_local,
    quiet_start_hour = excluded.quiet_start_hour,
    quiet_end_hour = excluded.quiet_end_hour,
    weekly_anchor_dow = excluded.weekly_anchor_dow,
    unsubscribed_at = case
      when excluded.delivery_opt_in then null
      else coalesce(morning_routine_subscriptions.unsubscribed_at, now())
    end,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_morning_routine_subscription(
  uuid, uuid, boolean, text, text[], text, smallint, smallint, smallint, smallint
) from public;
grant execute on function public.upsert_morning_routine_subscription(
  uuid, uuid, boolean, text, text[], text, smallint, smallint, smallint, smallint
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: unsubscribe_morning_routine_by_token (public unsubscribe link)
-- ---------------------------------------------------------------------------

create or replace function public.unsubscribe_morning_routine_by_token(
  p_token text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.morning_routine_subscriptions
  set delivery_opt_in = false,
      unsubscribed_at = now(),
      updated_at = now()
  where unsubscribe_token = p_token
    and delivery_opt_in = true
  returning id into v_id;

  if v_id is null then
    raise exception 'Subscription not found or already unsubscribed';
  end if;

  return v_id;
end;
$$;

revoke all on function public.unsubscribe_morning_routine_by_token(text) from public;
grant execute on function public.unsubscribe_morning_routine_by_token(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: upsert_morning_routine_retailer_settings (manager+)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_morning_routine_retailer_settings(
  p_retailer_id uuid,
  p_enabled boolean,
  p_delivery_hour_local smallint,
  p_eligible_product_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    if not public.is_platform_staff() then
      raise exception 'Not authorized';
    end if;
  end if;

  insert into public.morning_routine_retailer_settings (
    retailer_id,
    enabled,
    delivery_hour_local,
    eligible_product_ids
  ) values (
    p_retailer_id,
    p_enabled,
    p_delivery_hour_local,
    coalesce(p_eligible_product_ids, '{}'::uuid[])
  )
  on conflict (retailer_id) do update set
    enabled = excluded.enabled,
    delivery_hour_local = excluded.delivery_hour_local,
    eligible_product_ids = excluded.eligible_product_ids,
    updated_at = now();

  return p_retailer_id;
end;
$$;

revoke all on function public.upsert_morning_routine_retailer_settings(
  uuid, boolean, smallint, uuid[]
) from public;
grant execute on function public.upsert_morning_routine_retailer_settings(
  uuid, boolean, smallint, uuid[]
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_morning_routine_delivery (service_role scheduler)
-- ---------------------------------------------------------------------------

create or replace function public.record_morning_routine_delivery(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_selection_id uuid,
  p_for_date date,
  p_channel text,
  p_status text,
  p_payload jsonb,
  p_suppressed_reason text default null,
  p_notification_id uuid default null,
  p_email_outbox_id uuid default null,
  p_scheduled_for timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_channel not in ('in_app', 'email') then
    raise exception 'Invalid channel';
  end if;
  if p_status not in ('pending', 'sent', 'suppressed', 'failed') then
    raise exception 'Invalid status';
  end if;

  insert into public.morning_routine_deliveries (
    retailer_id,
    customer_id,
    selection_id,
    for_date,
    channel,
    status,
    suppressed_reason,
    notification_id,
    email_outbox_id,
    payload,
    scheduled_for,
    sent_at
  ) values (
    p_retailer_id,
    p_customer_id,
    p_selection_id,
    p_for_date,
    p_channel,
    p_status,
    p_suppressed_reason,
    p_notification_id,
    p_email_outbox_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_scheduled_for, now()),
    case when p_status = 'sent' then now() else null end
  )
  on conflict (retailer_id, customer_id, for_date, channel) do update set
    selection_id = excluded.selection_id,
    status = excluded.status,
    suppressed_reason = excluded.suppressed_reason,
    notification_id = coalesce(excluded.notification_id, morning_routine_deliveries.notification_id),
    email_outbox_id = coalesce(excluded.email_outbox_id, morning_routine_deliveries.email_outbox_id),
    payload = excluded.payload,
    scheduled_for = excluded.scheduled_for,
    sent_at = case
      when excluded.status = 'sent' then coalesce(morning_routine_deliveries.sent_at, now())
      else morning_routine_deliveries.sent_at
    end
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_morning_routine_delivery(
  uuid, uuid, uuid, date, text, text, jsonb, text, uuid, uuid, timestamptz
) from public;
grant execute on function public.record_morning_routine_delivery(
  uuid, uuid, uuid, date, text, text, jsonb, text, uuid, uuid, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: create_morning_routine_in_app_notification (service_role)
-- ---------------------------------------------------------------------------

create or replace function public.create_morning_routine_in_app_notification(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_title text,
  p_body text,
  p_action_href text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_notification_id uuid;
begin
  select c.user_id into v_user_id
  from public.customers c
  where c.id = p_customer_id
    and c.retailer_id = p_retailer_id
    and c.deleted_at is null;

  if v_user_id is null then
    raise exception 'Customer user not found';
  end if;

  insert into public.notifications (
    retailer_id,
    recipient_user_id,
    customer_id,
    channel,
    category,
    title,
    body,
    action_href,
    sent_at
  ) values (
    p_retailer_id,
    v_user_id,
    p_customer_id,
    'in_app',
    'morning_routine',
    p_title,
    p_body,
    p_action_href,
    now()
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_morning_routine_in_app_notification(
  uuid, uuid, text, text, text
) from public;
grant execute on function public.create_morning_routine_in_app_notification(
  uuid, uuid, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: enqueue_morning_routine_email (service_role — bypasses marketing gate)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_morning_routine_email(
  p_recipient_email text,
  p_subject text,
  p_html_body text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_outbox (recipient_email, subject, html_body)
  values (p_recipient_email, p_subject, p_html_body)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_morning_routine_email(text, text, text) from public;
grant execute on function public.enqueue_morning_routine_email(text, text, text)
  to service_role;
