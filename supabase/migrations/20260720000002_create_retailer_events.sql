create type public.event_visibility as enum ('public', 'invite_only', 'vip_tier');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.event_rsvp_status as enum ('invited', 'attending', 'declined', 'attended');

create table public.retailer_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  name text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,
  venue_address text,
  visibility public.event_visibility not null default 'public',
  status public.event_status not null default 'draft',
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);
create index retailer_events_retailer_time_idx on public.retailer_events(retailer_id, starts_at);
create trigger set_retailer_events_updated_at before update on public.retailer_events for each row execute function public.set_updated_at();

create table public.event_rsvps (
  event_id uuid not null references public.retailer_events(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.event_rsvp_status not null default 'invited',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, customer_id)
);

alter table public.retailer_events enable row level security;
alter table public.event_rsvps enable row level security;

create or replace function public.is_my_event_invitation(p_event_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_rsvps r join public.customers c on c.id = r.customer_id where r.event_id = p_event_id and c.user_id = auth.uid());
$$;

create policy "platform manages retailer events" on public.retailer_events for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer staff read events" on public.retailer_events for select using (retailer_id = public.current_retailer_id());
create policy "retailer managers manage events" on public.retailer_events for all using (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')) with check (retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'));
create policy "public reads published public events" on public.retailer_events for select using (status = 'published' and visibility = 'public' and deleted_at is null);
create policy "customers read eligible published events" on public.retailer_events for select using (status = 'published' and deleted_at is null and exists (select 1 from public.customers c where c.retailer_id = retailer_events.retailer_id and c.user_id = auth.uid()) and (visibility = 'public' or (visibility = 'vip_tier' and exists (select 1 from public.loyalty_accounts a where a.retailer_id = retailer_events.retailer_id and a.customer_id in (select id from public.customers where user_id = auth.uid()) and a.tier in ('gold','platinum'))) or (visibility = 'invite_only' and public.is_my_event_invitation(retailer_events.id))));

create policy "platform manages event rsvps" on public.event_rsvps for all using (public.is_platform_staff()) with check (public.is_platform_staff());
create policy "retailer staff read event rsvps" on public.event_rsvps for select using (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id()));
create policy "retailer managers manage event rsvps" on public.event_rsvps for all using (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner'))) with check (exists (select 1 from public.retailer_events e where e.id = event_id and e.retailer_id = public.current_retailer_id() and public.current_retailer_role() in ('manager','admin','owner')));
create policy "customers read own event rsvps" on public.event_rsvps for select using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid()));

create or replace function public.rsvp_to_event(p_event_id uuid, p_status public.event_rsvp_status) returns void language plpgsql security definer set search_path = '' as $$
declare v_event public.retailer_events%rowtype; v_customer_id uuid; v_count integer;
begin
  if p_status not in ('attending','declined') then raise exception 'Invalid customer RSVP status'; end if;
  select * into v_event from public.retailer_events where id = p_event_id and status = 'published' and deleted_at is null for update;
  if not found then raise exception 'Event unavailable'; end if;
  select id into v_customer_id from public.customers where retailer_id = v_event.retailer_id and user_id = auth.uid() and deleted_at is null;
  if v_customer_id is null then
    if v_event.visibility <> 'public' then raise exception 'This event requires an existing retailer relationship'; end if;
    insert into public.customers(retailer_id,user_id,full_name,email,lifecycle_stage,shipping_addresses,tags,acquisition_source)
      values (v_event.retailer_id, auth.uid(), coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->>'email','Event guest'), auth.jwt()->>'email', 'prospect', '[]'::jsonb, '{}', 'event') returning id into v_customer_id;
  end if;
  if v_event.visibility = 'vip_tier' and not exists (select 1 from public.loyalty_accounts where retailer_id = v_event.retailer_id and customer_id = v_customer_id and tier in ('gold','platinum')) then raise exception 'VIP tier required'; end if;
  if v_event.visibility = 'invite_only' and not exists (select 1 from public.event_rsvps where event_id = p_event_id and customer_id = v_customer_id) then raise exception 'Invitation required'; end if;
  if p_status = 'attending' and v_event.capacity is not null then select count(*) into v_count from public.event_rsvps where event_id = p_event_id and status = 'attending' and customer_id <> v_customer_id; if v_count >= v_event.capacity then raise exception 'Event is at capacity'; end if; end if;
  insert into public.event_rsvps(event_id,customer_id,status,responded_at) values (p_event_id,v_customer_id,p_status,now()) on conflict (event_id,customer_id) do update set status = excluded.status, responded_at = excluded.responded_at;
end $$;

revoke all on function public.rsvp_to_event(uuid, public.event_rsvp_status) from public;
revoke all on function public.is_my_event_invitation(uuid) from public;
grant execute on function public.is_my_event_invitation(uuid) to authenticated;
grant execute on function public.rsvp_to_event(uuid, public.event_rsvp_status) to authenticated, service_role;
grant select, insert, update, delete on public.retailer_events, public.event_rsvps to authenticated, service_role;
