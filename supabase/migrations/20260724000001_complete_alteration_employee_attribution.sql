alter table public.alteration_fulfillment_events
  add column actor_staff_id uuid references public.retailer_staff_members (id) on delete set null;

with first_actor as (
  select distinct on (entry.entity_id)
    entry.entity_id,
    entry.actor_staff_id
  from public.audit_log_entries entry
  where entry.entity_type = 'alteration_fulfillment_events'
    and entry.action = 'insert'
    and entry.actor_staff_id is not null
  order by entry.entity_id, entry.occurred_at asc
)
update public.alteration_fulfillment_events fulfillment
set actor_staff_id = first_actor.actor_staff_id
from first_actor
where first_actor.entity_id = fulfillment.id
  and fulfillment.actor_staff_id is null;

create or replace function public.derive_alteration_attachment_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.uploaded_by_staff_id := public.current_staff_id();
    if new.uploaded_by_staff_id is null then
      raise exception 'An active staff membership is required to upload alteration evidence';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_attachment_actor_before_insert
  before insert on public.alteration_attachments
  for each row
  execute function public.derive_alteration_attachment_actor();

create or replace function public.derive_alteration_custody_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.actor_staff_id := public.current_staff_id();
    if new.actor_staff_id is null then
      raise exception 'An active staff membership is required to record custody';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_custody_actor_before_insert
  before insert on public.chain_of_custody_events
  for each row
  execute function public.derive_alteration_custody_actor();

create or replace function public.derive_alteration_fulfillment_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    new.actor_staff_id := public.current_staff_id();
    if new.actor_staff_id is null then
      raise exception 'An active staff membership is required to record fulfillment';
    end if;
  end if;
  return new;
end;
$$;

create trigger derive_alteration_fulfillment_actor_before_insert
  before insert on public.alteration_fulfillment_events
  for each row
  execute function public.derive_alteration_fulfillment_actor();

revoke all on function public.derive_alteration_attachment_actor() from public;
revoke all on function public.derive_alteration_custody_actor() from public;
revoke all on function public.derive_alteration_fulfillment_actor() from public;
