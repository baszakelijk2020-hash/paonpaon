-- Resend transactional email (founder decision, docs/DECISIONS.md
-- ADR-032). Postgres triggers can't make HTTP calls, so this is an
-- outbox: every notifications insert (the one place notifications are
-- created, see 20260720000004_*'s send_conversation_message) enqueues
-- an email row here via an AFTER INSERT trigger; a scheduled Route
-- Handler (apps/admin, no live credentials needed to build) drains it.

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  html_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_pending_idx on public.email_outbox (created_at)
  where status = 'pending';

create trigger set_email_outbox_updated_at
  before update on public.email_outbox
  for each row
  execute function public.set_updated_at();

alter table public.email_outbox enable row level security;

create policy "platform staff can manage all email outbox rows"
  on public.email_outbox for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

grant select, insert, update, delete on public.email_outbox
  to authenticated, service_role;

-- One universal hook instead of instrumenting every RPC that creates a
-- notification (today, only send_conversation_message) — a future
-- notification-creating RPC gets email delivery for free. security
-- definer so it can read auth.users.email regardless of the inserting
-- caller's own privileges, the same reasoning every other
-- security-definer function in this schema already relies on.
create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_email text;
  v_wants_email boolean;
begin
  -- A customer recipient's own communication_channels preference
  -- (docs/DECISIONS.md ADR-028) gates delivery; no preferences row yet
  -- defaults to sending, matching that table's own "email" default.
  if new.customer_id is not null then
    select ('email' = any(cp.communication_channels)) into v_wants_email
      from public.customer_preferences cp
      where cp.customer_id = new.customer_id;
    if coalesce(v_wants_email, true) is false then
      return new;
    end if;
  end if;

  select email into v_recipient_email
    from auth.users
    where id = new.recipient_user_id;
  if v_recipient_email is null then
    return new;
  end if;

  insert into public.email_outbox (notification_id, recipient_email, subject, html_body)
  values (
    new.id,
    v_recipient_email,
    new.title,
    '<p>' || new.body || '</p>'
  );

  return new;
end;
$$;

create trigger enqueue_notification_email_after_insert
  after insert on public.notifications
  for each row
  execute function public.enqueue_notification_email();

-- Atomic claim: a single statement, not a select-then-update, so two
-- overlapping drain runs (e.g. a slow previous cron tick) can never
-- both pick up the same row — `for update skip locked` is what makes
-- that safe. service_role only, called from the scheduled Route
-- Handler, never from a browser-reachable path.
create or replace function public.claim_pending_emails(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.email_outbox
    set status = 'sending'
    where id in (
      select id from public.email_outbox
      where status = 'pending'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_pending_emails(integer) from public;
grant execute on function public.claim_pending_emails(integer) to service_role;
