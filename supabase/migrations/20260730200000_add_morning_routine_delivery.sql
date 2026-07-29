-- PAON Intelligence Platform Stage 4.5.
-- MorningRoutine delivery subscriptions, audit, retailer eligible-product
-- controls, and pause flag (MR-002, MR-003, CUST-003; ADR-061).
-- Delivery derives from persisted selections; marketing consent is never
-- inferred as MorningRoutine opt-in.

-- ---------------------------------------------------------------------------
-- morning_routine_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_subscriptions (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  frequency text not null default 'daily' check (
    frequency in ('daily', 'weekdays', 'weekly')
  ),
  timezone text not null default 'UTC',
  quiet_start_minute integer check (
    quiet_start_minute is null
    or (quiet_start_minute >= 0 and quiet_start_minute <= 1439)
  ),
  quiet_end_minute integer check (
    quiet_end_minute is null
    or (quiet_end_minute >= 0 and quiet_end_minute <= 1439)
  ),
  channels text[] not null default array['in_app']::text[],
  preferred_local_hour integer not null default 7 check (
    preferred_local_hour >= 0 and preferred_local_hour <= 23
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint morning_routine_subscriptions_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint morning_routine_subscriptions_customer_unique unique (customer_id),
  constraint morning_routine_subscriptions_quiet_pair_chk check (
    (
      quiet_start_minute is null
      and quiet_end_minute is null
    )
    or (
      quiet_start_minute is not null
      and quiet_end_minute is not null
    )
  ),
  constraint morning_routine_subscriptions_channels_chk check (
    cardinality(channels) between 1 and 2
    and channels <@ array['in_app', 'email']::text[]
  )
);

create trigger set_morning_routine_subscriptions_updated_at
  before update on public.morning_routine_subscriptions
  for each row execute function public.set_updated_at();

comment on table public.morning_routine_subscriptions is
  'Explicit MorningRoutine delivery opt-in — independent of marketing consent (PHASE 4.5).';

alter table public.morning_routine_subscriptions enable row level security;
revoke all on table public.morning_routine_subscriptions from anon;

create policy "customers read own morning routine subscriptions"
  on public.morning_routine_subscriptions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_subscriptions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
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

create policy "platform staff read morning routine subscriptions"
  on public.morning_routine_subscriptions for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_subscriptions
  to authenticated, service_role;
grant all on table public.morning_routine_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_delivery_audits — append-only
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_delivery_audits (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  selection_id uuid references public.morning_routine_selections (id) on delete set null,
  for_date date not null,
  outcome text not null check (
    outcome in (
      'queued_in_app',
      'queued_email',
      'suppressed',
      'skipped_quiet_hours',
      'skipped_frequency',
      'skipped_not_opted_in',
      'skipped_no_selection',
      'skipped_duplicate',
      'skipped_retailer_paused',
      'failed'
    )
  ),
  suppression_reason text check (
    suppression_reason is null
    or suppression_reason in (
      'customer_opt_out',
      'product_not_eligible',
      'duplicate_for_date',
      'retailer_paused',
      'unrelated_promotion_blocked',
      'manual'
    )
  ),
  notification_id uuid references public.notifications (id) on delete set null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  constraint morning_routine_delivery_audits_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create unique index if not exists morning_routine_delivery_audits_success_day_uidx
  on public.morning_routine_delivery_audits (customer_id, for_date)
  where outcome in ('queued_in_app', 'queued_email');

create index if not exists morning_routine_delivery_audits_customer_day_idx
  on public.morning_routine_delivery_audits (customer_id, for_date desc);

comment on table public.morning_routine_delivery_audits is
  'Append-only MorningRoutine delivery/suppression audit (PHASE 4.5).';

alter table public.morning_routine_delivery_audits enable row level security;
revoke all on table public.morning_routine_delivery_audits from anon;

create policy "customers read own morning routine delivery audits"
  on public.morning_routine_delivery_audits for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_delivery_audits.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant morning routine delivery audits"
  on public.morning_routine_delivery_audits for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read morning routine delivery audits"
  on public.morning_routine_delivery_audits for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_delivery_audits
  to authenticated, service_role;
grant all on table public.morning_routine_delivery_audits to service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_eligible_products — retailer catalogue secondary allowlist
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_eligible_products (
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  active boolean not null default true,
  created_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (retailer_id, product_id)
);

create trigger set_morning_routine_eligible_products_updated_at
  before update on public.morning_routine_eligible_products
  for each row execute function public.set_updated_at();

comment on table public.morning_routine_eligible_products is
  'Retailer allowlist for MorningRoutine catalogue secondary picks. Cannot inject unrelated promotion outside selection (PHASE 4.5).';

alter table public.morning_routine_eligible_products enable row level security;
revoke all on table public.morning_routine_eligible_products from anon;

create policy "retailer staff manage morning routine eligible products"
  on public.morning_routine_eligible_products for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  );

create policy "retailer staff read morning routine eligible products"
  on public.morning_routine_eligible_products for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read morning routine eligible products"
  on public.morning_routine_eligible_products for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_eligible_products
  to authenticated, service_role;
grant insert, update, delete on table public.morning_routine_eligible_products
  to authenticated;
grant all on table public.morning_routine_eligible_products to service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_retailer_settings — pause delivery without deleting subs
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_retailer_settings (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger set_morning_routine_retailer_settings_updated_at
  before update on public.morning_routine_retailer_settings
  for each row execute function public.set_updated_at();

alter table public.morning_routine_retailer_settings enable row level security;
revoke all on table public.morning_routine_retailer_settings from anon;

create policy "retailer managers manage morning routine retailer settings"
  on public.morning_routine_retailer_settings for all to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read morning routine retailer settings"
  on public.morning_routine_retailer_settings for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_retailer_settings
  to authenticated, service_role;
grant insert, update, delete on table public.morning_routine_retailer_settings
  to authenticated;
grant all on table public.morning_routine_retailer_settings to service_role;

-- ---------------------------------------------------------------------------
-- RPC: upsert_morning_routine_subscription (customer only)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_morning_routine_subscription(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_opted_in boolean,
  p_frequency text default 'daily',
  p_timezone text default 'UTC',
  p_preferred_local_hour integer default 7,
  p_channels text[] default array['in_app']::text[],
  p_quiet_start_minute integer default null,
  p_quiet_end_minute integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_id uuid;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found for retailer';
  end if;
  if v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to update morning routine subscription';
  end if;

  insert into public.morning_routine_subscriptions (
    retailer_id,
    customer_id,
    opted_in,
    opted_in_at,
    opted_out_at,
    frequency,
    timezone,
    preferred_local_hour,
    channels,
    quiet_start_minute,
    quiet_end_minute
  ) values (
    p_retailer_id,
    p_customer_id,
    p_opted_in,
    case when p_opted_in then now() else null end,
    case when p_opted_in then null else now() end,
    p_frequency,
    p_timezone,
    p_preferred_local_hour,
    p_channels,
    p_quiet_start_minute,
    p_quiet_end_minute
  )
  on conflict (customer_id) do update set
    opted_in = excluded.opted_in,
    opted_in_at = case
      when excluded.opted_in and not morning_routine_subscriptions.opted_in
        then now()
      when excluded.opted_in
        then coalesce(morning_routine_subscriptions.opted_in_at, now())
      else morning_routine_subscriptions.opted_in_at
    end,
    opted_out_at = case
      when not excluded.opted_in then now()
      else null
    end,
    frequency = excluded.frequency,
    timezone = excluded.timezone,
    preferred_local_hour = excluded.preferred_local_hour,
    channels = excluded.channels,
    quiet_start_minute = excluded.quiet_start_minute,
    quiet_end_minute = excluded.quiet_end_minute,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_morning_routine_subscription(
  uuid, uuid, boolean, text, text, integer, text[], integer, integer
) from public;
grant execute on function public.upsert_morning_routine_subscription(
  uuid, uuid, boolean, text, text, integer, text[], integer, integer
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: record_morning_routine_delivery_audit (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.record_morning_routine_delivery_audit(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_for_date date,
  p_outcome text,
  p_scheduled_for timestamptz,
  p_selection_id uuid default null,
  p_suppression_reason text default null,
  p_notification_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.morning_routine_delivery_audits (
    retailer_id,
    customer_id,
    selection_id,
    for_date,
    outcome,
    suppression_reason,
    notification_id,
    scheduled_for
  ) values (
    p_retailer_id,
    p_customer_id,
    p_selection_id,
    p_for_date,
    p_outcome,
    p_suppression_reason,
    p_notification_id,
    p_scheduled_for
  )
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'MorningRoutine already delivered for this customer/day';
end;
$$;

revoke all on function public.record_morning_routine_delivery_audit(
  uuid, uuid, date, text, timestamptz, uuid, text, uuid
) from public;
grant execute on function public.record_morning_routine_delivery_audit(
  uuid, uuid, date, text, timestamptz, uuid, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: enqueue_morning_routine_delivery_notification (service/cron)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_morning_routine_delivery_notification(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_title text,
  p_body text,
  p_action_href text default '/morning-routine',
  p_channel text default 'in_app'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_notification_id uuid;
begin
  if p_channel not in ('in_app', 'email') then
    raise exception 'MorningRoutine delivery channel must be in_app or email';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found or v_customer.user_id is null then
    raise exception 'Customer not linked for MorningRoutine delivery';
  end if;

  insert into public.notifications (
    retailer_id,
    recipient_user_id,
    customer_id,
    channel,
    category,
    title,
    body,
    action_href
  ) values (
    p_retailer_id,
    v_customer.user_id,
    p_customer_id,
    p_channel::public.notification_channel,
    'system',
    btrim(p_title),
    btrim(p_body),
    p_action_href
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.enqueue_morning_routine_delivery_notification(
  uuid, uuid, text, text, text, text
) from public;
grant execute on function public.enqueue_morning_routine_delivery_notification(
  uuid, uuid, text, text, text, text
) to service_role;
