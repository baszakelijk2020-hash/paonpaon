-- Consolidates the loyalty tier system from 4 tiers (member/silver/gold/
-- platinum) down to the 3 the founder's spec actually names: METRE, MILLI,
-- MICRON. `gold` and `platinum` already displayed identically in the
-- retailer UI (both mapped to "MICRON" — a labeling bug), so this migration
-- makes that merge real at the data layer instead of papering over it with
-- labels: member -> metre, silver -> milli, gold & platinum -> micron.

-- ---------------------------------------------------------------------------
-- 1. Drop the retailer_events policy that depends on loyalty_accounts.tier
--    first — Postgres won't let a dependent column be dropped otherwise.
--    Recreated at the end of this migration against the new tier values.
-- ---------------------------------------------------------------------------

drop policy "customers read eligible published events" on public.retailer_events;

-- ---------------------------------------------------------------------------
-- 2. loyalty_accounts.tier and rewards.minimum_tier: swap enum type
-- ---------------------------------------------------------------------------

create type public.loyalty_tier_v2 as enum ('metre', 'milli', 'micron');

alter table public.loyalty_accounts add column tier_v2 public.loyalty_tier_v2;
update public.loyalty_accounts set tier_v2 = (case tier
  when 'member' then 'metre'
  when 'silver' then 'milli'
  when 'gold' then 'micron'
  when 'platinum' then 'micron'
end)::public.loyalty_tier_v2;
alter table public.loyalty_accounts alter column tier_v2 set not null;
alter table public.loyalty_accounts alter column tier_v2 set default 'metre';
alter table public.loyalty_accounts drop column tier;
alter table public.loyalty_accounts rename column tier_v2 to tier;

alter table public.rewards add column minimum_tier_v2 public.loyalty_tier_v2;
update public.rewards set minimum_tier_v2 = (case minimum_tier
  when 'member' then 'metre'
  when 'silver' then 'milli'
  when 'gold' then 'micron'
  when 'platinum' then 'micron'
  else null
end)::public.loyalty_tier_v2;
alter table public.rewards drop column minimum_tier;
alter table public.rewards rename column minimum_tier_v2 to minimum_tier;

drop type public.loyalty_tier;
alter type public.loyalty_tier_v2 rename to loyalty_tier;

-- ---------------------------------------------------------------------------
-- 3. campaign_audience_rules.loyalty_tier: plain text + check constraint
-- ---------------------------------------------------------------------------

update public.campaign_audience_rules
set loyalty_tier = (case loyalty_tier
  when 'member' then 'metre'
  when 'silver' then 'milli'
  when 'gold' then 'micron'
  when 'platinum' then 'micron'
  else loyalty_tier
end)
where loyalty_tier is not null;

alter table public.campaign_audience_rules
  drop constraint campaign_audience_rules_loyalty_tier_check;
alter table public.campaign_audience_rules
  add constraint campaign_audience_rules_loyalty_tier_check
  check (loyalty_tier is null or loyalty_tier in ('metre', 'milli', 'micron'));

-- ---------------------------------------------------------------------------
-- 4. retailer_events: recreate the VIP-tier policy dropped in step 1, and
--    the RSVP function, against the new tier values — both previously
--    checked `tier in ('gold','platinum')`, which now collapse to 'micron'
-- ---------------------------------------------------------------------------

create policy "customers read eligible published events" on public.retailer_events for select using (
  status = 'published'
  and deleted_at is null
  and exists (
    select 1 from public.customers c
    where c.retailer_id = retailer_events.retailer_id and c.user_id = auth.uid()
  )
  and (
    visibility = 'public'
    or (
      visibility = 'vip_tier'
      and exists (
        select 1 from public.loyalty_accounts a
        where a.retailer_id = retailer_events.retailer_id
          and a.customer_id in (select id from public.customers where user_id = auth.uid())
          and a.tier = 'micron'
      )
    )
    or (visibility = 'invite_only' and public.is_my_event_invitation(retailer_events.id))
  )
);

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
  if v_event.visibility = 'vip_tier' and not exists (select 1 from public.loyalty_accounts where retailer_id = v_event.retailer_id and customer_id = v_customer_id and tier = 'micron') then raise exception 'VIP tier required'; end if;
  if v_event.visibility = 'invite_only' and not exists (select 1 from public.event_rsvps where event_id = p_event_id and customer_id = v_customer_id) then raise exception 'Invitation required'; end if;
  if p_status = 'attending' and v_event.capacity is not null then select count(*) into v_count from public.event_rsvps where event_id = p_event_id and status = 'attending' and customer_id <> v_customer_id; if v_count >= v_event.capacity then raise exception 'Event is at capacity'; end if; end if;
  insert into public.event_rsvps(event_id,customer_id,status,responded_at) values (p_event_id,v_customer_id,p_status,now()) on conflict (event_id,customer_id) do update set status = excluded.status, responded_at = excluded.responded_at;
end $$;
