-- SMS/WhatsApp transactional notifications — same outbox shape as
-- email_outbox (ADR-032): Postgres triggers can't make HTTP calls, so
-- every notifications insert enqueues a row here, drained by a
-- scheduled Route Handler. Founder decision: build the pipeline now,
-- Twilio credentials (SMS + WhatsApp both go through the same
-- provider) get provisioned later — same non-faking treatment as
-- every other unconfigured provider in this codebase.

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  recipient_phone text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sms_outbox_pending_idx on public.sms_outbox (created_at)
  where status = 'pending';

create trigger set_sms_outbox_updated_at
  before update on public.sms_outbox
  for each row
  execute function public.set_updated_at();

alter table public.sms_outbox enable row level security;

create policy "platform staff can manage all sms outbox rows"
  on public.sms_outbox for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on public.sms_outbox
  to authenticated, service_role;

-- Gated on the customer's own communication_channels preference
-- (already includes 'sms', ADR-028) and requiring a phone number on
-- file — no preferences row yet defaults to *not* sending SMS (unlike
-- email's opt-out default), since a phone number was never explicitly
-- offered as a channel until now.
create or replace function public.enqueue_notification_sms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_wants_sms boolean;
begin
  if new.customer_id is null then
    return new;
  end if;

  select c.phone, ('sms' = any(coalesce(cp.communication_channels, '{}'::text[])))
    into v_phone, v_wants_sms
    from public.customers c
    left join public.customer_preferences cp on cp.customer_id = c.id
    where c.id = new.customer_id;

  if v_phone is null or coalesce(v_wants_sms, false) is false then
    return new;
  end if;

  insert into public.sms_outbox (notification_id, recipient_phone, body)
  values (new.id, v_phone, new.title || ': ' || new.body);

  return new;
end;
$$;

create trigger enqueue_notification_sms_after_insert
  after insert on public.notifications
  for each row
  execute function public.enqueue_notification_sms();

-- Atomic claim, identical shape to claim_pending_emails.
create or replace function public.claim_pending_sms(p_limit integer default 20)
returns setof public.sms_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.sms_outbox
    set status = 'sending'
    where id in (
      select id from public.sms_outbox
      where status = 'pending'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_pending_sms(integer) from public;
grant execute on function public.claim_pending_sms(integer) to service_role;
