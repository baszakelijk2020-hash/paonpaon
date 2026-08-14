-- PHASE 10.3: "opt-out/failure suppresses" — the one acceptance clause the
-- outbox pipeline (20260720000017 email, 20260721000007 sms) never
-- implemented. It already gates delivery on `communication_channels`
-- preference; this adds the two things still missing:
--
-- 1. Marketing opt-out: a 'marketing'-category notification must not enqueue
--    unless the customer's marketing consent is actually granted
--    (`marketing_opt_in` true and not withdrawn). Every other category
--    (order_update, appointment_reminder, message, etc.) is transactional
--    and stays ungated by consent, matching how `marketing_opt_in` already
--    defaults to false while other channels default open.
-- 2. Failure suppression: once an outbox row exhausts MAX_ATTEMPTS and
--    lands in terminal 'failed', that customer's address/number is
--    presumed bad — stop trying to reach it at all (any category), not
--    just retry the one message. Suppression is per-channel and cleared
--    only by direct action on customer_preferences (no auto-expiry here).

alter table public.customer_preferences
  add column if not exists email_suppressed_at timestamptz,
  add column if not exists sms_suppressed_at timestamptz;

comment on column public.customer_preferences.email_suppressed_at is
  'Set once an email_outbox row for this customer exhausts MAX_ATTEMPTS (PHASE 10.3 failure suppression). Null clears it.';
comment on column public.customer_preferences.sms_suppressed_at is
  'Set once an sms_outbox row for this customer exhausts MAX_ATTEMPTS (PHASE 10.3 failure suppression). Null clears it.';

create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_email text;
  v_wants_email boolean;
  v_suppressed boolean;
  v_marketing_granted boolean;
begin
  if new.customer_id is not null then
    select
      ('email' = any(cp.communication_channels)),
      (cp.email_suppressed_at is not null),
      (cp.marketing_opt_in and cp.marketing_withdrawn_at is null)
      into v_wants_email, v_suppressed, v_marketing_granted
      from public.customer_preferences cp
      where cp.customer_id = new.customer_id;

    if coalesce(v_wants_email, true) is false then
      return new;
    end if;
    if coalesce(v_suppressed, false) is true then
      return new;
    end if;
    if new.category = 'marketing' and coalesce(v_marketing_granted, false) is false then
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

create or replace function public.enqueue_notification_sms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_wants_sms boolean;
  v_suppressed boolean;
  v_marketing_granted boolean;
begin
  if new.customer_id is null then
    return new;
  end if;

  select
    c.phone,
    ('sms' = any(coalesce(cp.communication_channels, '{}'::text[]))),
    coalesce(cp.sms_suppressed_at is not null, false),
    coalesce(cp.marketing_opt_in and cp.marketing_withdrawn_at is null, false)
    into v_phone, v_wants_sms, v_suppressed, v_marketing_granted
    from public.customers c
    left join public.customer_preferences cp on cp.customer_id = c.id
    where c.id = new.customer_id;

  if v_phone is null or coalesce(v_wants_sms, false) is false then
    return new;
  end if;
  if v_suppressed is true then
    return new;
  end if;
  if new.category = 'marketing' and v_marketing_granted is false then
    return new;
  end if;

  insert into public.sms_outbox (notification_id, recipient_phone, body)
  values (new.id, v_phone, new.title || ': ' || new.body);

  return new;
end;
$$;

-- Terminal-failure suppression: fires only on the pending/sending -> failed
-- transition (never on sent, never re-fires on an already-failed row).
create or replace function public.suppress_customer_email_on_terminal_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    select n.customer_id into v_customer_id
      from public.notifications n
      where n.id = new.notification_id;

    if v_customer_id is not null then
      insert into public.customer_preferences (customer_id, email_suppressed_at)
      values (v_customer_id, now())
      on conflict (customer_id)
        do update set email_suppressed_at = excluded.email_suppressed_at
        where public.customer_preferences.email_suppressed_at is null;
    end if;
  end if;
  return new;
end;
$$;

create trigger suppress_customer_email_on_terminal_failure_after_update
  after update on public.email_outbox
  for each row
  execute function public.suppress_customer_email_on_terminal_failure();

create or replace function public.suppress_customer_sms_on_terminal_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    select n.customer_id into v_customer_id
      from public.notifications n
      where n.id = new.notification_id;

    if v_customer_id is not null then
      insert into public.customer_preferences (customer_id, sms_suppressed_at)
      values (v_customer_id, now())
      on conflict (customer_id)
        do update set sms_suppressed_at = excluded.sms_suppressed_at
        where public.customer_preferences.sms_suppressed_at is null;
    end if;
  end if;
  return new;
end;
$$;

create trigger suppress_customer_sms_on_terminal_failure_after_update
  after update on public.sms_outbox
  for each row
  execute function public.suppress_customer_sms_on_terminal_failure();
