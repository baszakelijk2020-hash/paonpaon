create table public.behavioral_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  name text not null check (length(name) between 1 and 100),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  source text not null check (source in ('customer_portal', 'retailer_portal', 'admin', 'server')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index behavioral_events_retailer_occurred_idx
  on public.behavioral_events (retailer_id, occurred_at desc);
create index behavioral_events_customer_occurred_idx
  on public.behavioral_events (customer_id, occurred_at desc)
  where customer_id is not null;

alter table public.behavioral_events enable row level security;

create policy "platform staff read behavioral events"
  on public.behavioral_events for select to authenticated
  using (public.is_platform_staff());

create policy "retailer managers read behavioral events"
  on public.behavioral_events for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('manager', 'admin', 'owner')
  );

create or replace function public.capture_behavioral_event(
  p_retailer_id uuid,
  p_name text,
  p_properties jsonb default '{}'::jsonb,
  p_source text default 'server',
  p_customer_id uuid default null,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_customer_id uuid := p_customer_id;
begin
  if p_name is null or length(p_name) not between 1 and 100 then
    raise exception 'Invalid event name';
  end if;
  if p_source not in ('customer_portal', 'retailer_portal', 'admin', 'server') then
    raise exception 'Invalid event source';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Event properties must be an object';
  end if;

  if auth.uid() is not null then
    if p_source = 'customer_portal' then
      select c.id into v_customer_id
      from public.customers c
      where c.retailer_id = p_retailer_id and c.user_id = auth.uid()
      limit 1;
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

  insert into public.behavioral_events (
    retailer_id, customer_id, name, properties, source, occurred_at
  ) values (
    p_retailer_id, v_customer_id, p_name, coalesce(p_properties, '{}'::jsonb),
    p_source, p_occurred_at
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.capture_behavioral_event(uuid, text, jsonb, text, uuid, timestamptz) from public;
grant execute on function public.capture_behavioral_event(uuid, text, jsonb, text, uuid, timestamptz)
  to authenticated, service_role;

create or replace function public.get_retailer_analytics(
  p_retailer_id uuid,
  p_since timestamptz default (now() - interval '30 days')
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_staff() and (
    p_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in ('manager', 'admin', 'owner')
  ) then
    raise exception 'Not authorized to view retailer analytics';
  end if;

  select jsonb_build_object(
    'customers', (select count(*) from public.customers where retailer_id = p_retailer_id and deleted_at is null),
    'newCustomers', (select count(*) from public.customers where retailer_id = p_retailer_id and deleted_at is null and created_at >= p_since),
    'orders', (select count(*) from public.orders where retailer_id = p_retailer_id and deleted_at is null and created_at >= p_since),
    'revenueMinorUnits', coalesce((select sum(total_amount_minor_units) from public.orders where retailer_id = p_retailer_id and deleted_at is null and status in ('placed','in_production','ready_for_fulfillment','shipped','delivered','completed') and created_at >= p_since), 0),
    'appointments', (select count(*) from public.appointments where retailer_id = p_retailer_id and deleted_at is null and starts_at >= p_since),
    'openAlterations', (select count(*) from public.alteration_work_orders where retailer_id = p_retailer_id and status not in ('completed','canceled')),
    'eventRsvps', (select count(*) from public.event_rsvps er join public.retailer_events re on re.id = er.event_id where re.retailer_id = p_retailer_id and er.status = 'attending' and er.created_at >= p_since),
    'messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.retailer_id = p_retailer_id and m.created_at >= p_since),
    'behavioralEvents', (select count(*) from public.behavioral_events where retailer_id = p_retailer_id and occurred_at >= p_since)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_retailer_analytics(uuid, timestamptz) from public;
grant execute on function public.get_retailer_analytics(uuid, timestamptz) to authenticated, service_role;

comment on table public.behavioral_events is
  'Immutable retailer-scoped interaction signals for analytics and future personalisation; never a replacement for source business records.';
