-- Hardening from the security review of the 16–30 Sep 2026 migrations.
--
-- 1. Closure notes are staff-only. The "anyone can read closures" policy and
--    the anon grant exposed every retailer's free-text closure reasons. Guests
--    never read the table: availability goes through the SECURITY DEFINER
--    appointment_slot_conflict(), which is unaffected.
-- 2. A closure's branch must belong to the closure's retailer.
-- 3. reschedule_my_appointment() only accepts a future slot of at most eight
--    hours.
-- 4. Party chat rows carry retailer_id, like every other tenant-owned row,
--    set from the party itself.
-- 5. A customer's profile photo must be an https URL.

-- 1 ─────────────────────────────────────────────────────────────────────────
drop policy if exists "anyone can read closures" on public.appointment_closures;
revoke select on table public.appointment_closures from anon;

-- 2 ─────────────────────────────────────────────────────────────────────────
create or replace function public.appointment_closures_same_tenant_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1
      from public.retailer_branches b
      where b.id = new.branch_id
        and b.retailer_id = new.retailer_id
  ) then
    raise exception 'That branch does not belong to this retailer';
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_closures_same_tenant_branch
  on public.appointment_closures;
create trigger appointment_closures_same_tenant_branch
  before insert or update of branch_id, retailer_id
  on public.appointment_closures
  for each row execute function public.appointment_closures_same_tenant_branch();

-- 3 ─────────────────────────────────────────────────────────────────────────
create or replace function public.reschedule_my_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
  v_conflict text;
begin
  select a.* into v_appt
    from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.id = p_appointment_id
      and a.deleted_at is null
      and c.user_id = auth.uid()
      and c.deleted_at is null;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.status in ('canceled', 'completed', 'no_show') then
    raise exception 'That appointment can no longer be changed';
  end if;

  -- A customer moves a visit, not a branch: the new slot is in the future and
  -- no longer than a working day, so one booking cannot hold a branch's
  -- capacity for days.
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now() then
    raise exception 'Choose a time in the future';
  end if;
  if p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '8 hours' then
    raise exception 'An appointment lasts at most eight hours';
  end if;

  v_conflict := public.appointment_slot_conflict(
    v_appt.retailer_id, v_appt.branch_id, p_starts_at, p_ends_at, p_appointment_id
  );
  if v_conflict is not null then
    raise exception '%', v_conflict;
  end if;

  -- Back to 'requested': a moved appointment is not a confirmed one until the
  -- retailer has seen the new time.
  update public.appointments
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        status = case when status = 'confirmed' then 'requested' else status end,
        updated_at = now()
    where id = p_appointment_id;

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
  select
    v_appt.retailer_id,
    s.user_id,
    v_appt.customer_id,
    'appointment_reminder',
    'Appointment moved by the customer',
    'Now ' || to_char(p_starts_at at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.',
    '/appointments/' || p_appointment_id::text,
    now()
  from public.retailer_staff_members s
  where s.retailer_id = v_appt.retailer_id
    and s.user_id is not null
    and s.accepted_at is not null
    and s.deleted_at is null
    and s.role in ('sales_associate', 'manager', 'admin', 'owner');
end;
$$;

revoke all on function public.reschedule_my_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function public.reschedule_my_appointment(uuid, timestamptz, timestamptz)
  to authenticated, service_role;


-- 4 ─────────────────────────────────────────────────────────────────────────
alter table public.wedding_party_messages
  add column if not exists retailer_id uuid references public.retailers(id);

update public.wedding_party_messages m
  set retailer_id = p.retailer_id
  from public.wedding_parties p
  where p.id = m.wedding_party_id
    and m.retailer_id is null;

alter table public.wedding_party_messages
  alter column retailer_id set not null;

create or replace function public.wedding_party_messages_set_retailer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.retailer_id into new.retailer_id
    from public.wedding_parties p
    where p.id = new.wedding_party_id;
  if new.retailer_id is null then
    raise exception 'Unknown party';
  end if;
  return new;
end;
$$;

drop trigger if exists wedding_party_messages_set_retailer
  on public.wedding_party_messages;
create trigger wedding_party_messages_set_retailer
  before insert or update of wedding_party_id
  on public.wedding_party_messages
  for each row execute function public.wedding_party_messages_set_retailer();

create index if not exists wedding_party_messages_retailer_idx
  on public.wedding_party_messages (retailer_id);

-- 5 ─────────────────────────────────────────────────────────────────────────
alter table public.customers
  drop constraint if exists customers_profile_photo_url_https_chk;
alter table public.customers
  add constraint customers_profile_photo_url_https_chk
  check (profile_photo_url is null or profile_photo_url ~ '^https://');

-- 6 ─────────────────────────────────────────────────────────────────────────
-- Elevated functions that name public in their search_path search temporary
-- tables last, so a session's temp table can never shadow a real one.
alter function public.enqueue_notification_email() set search_path = public, pg_temp;
alter function public.enqueue_notification_sms() set search_path = public, pg_temp;
alter function public.add_alteration_task(uuid,text,text,work_classification,uuid,text,uuid) set search_path = public, pg_temp;
alter function public.sync_corporate_wearer_claim() set search_path = public, pg_temp;
alter function public.link_my_wearer_account() set search_path = public, pg_temp;
alter function public.can_access_silhouette_storage_object(text) set search_path = public, pg_temp;
alter function public.claim_pending_wardrobe_visualization_jobs(integer) set search_path = public, pg_temp;
alter function public.can_access_wardrobe_studio_object(text) set search_path = public, pg_temp;
alter function public.record_alteration_task_cost_allocation(uuid,integer,integer,integer,text,text) set search_path = public, pg_temp;
alter function public.mark_alteration_customer_notified(uuid) set search_path = public, pg_temp;
alter function public.suppress_customer_email_on_terminal_failure() set search_path = public, pg_temp;
alter function public.suppress_customer_sms_on_terminal_failure() set search_path = public, pg_temp;
alter function public.record_customer_access_event(text,text,uuid,text,text) set search_path = public, pg_temp;
alter function public.sync_corporate_manager_claim() set search_path = public, pg_temp;
alter function public.link_my_corporate_manager_account() set search_path = public, pg_temp;
alter function public.request_appointment(uuid,appointment_type,timestamp with time zone,timestamp with time zone,text,uuid) set search_path = public, pg_temp;
alter function public.seed_default_paid_care_service_prices(uuid) set search_path = public, pg_temp;
alter function public.seed_paid_care_prices_for_new_retailer() set search_path = public, pg_temp;
alter function public.appointment_slot_conflict(uuid,uuid,timestamp with time zone,timestamp with time zone,uuid) set search_path = public, pg_temp;
alter function public.cancel_my_appointment(uuid,text) set search_path = public, pg_temp;
alter function public.reschedule_my_appointment(uuid,timestamp with time zone,timestamp with time zone) set search_path = public, pg_temp;
alter function public.notify_customer_of_appointment_change(uuid,text,text) set search_path = public, pg_temp;
