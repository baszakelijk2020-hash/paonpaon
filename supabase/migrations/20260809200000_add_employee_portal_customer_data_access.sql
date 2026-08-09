-- Employee Portal — linked-customer data access (PHASE 18.5 / BD-105).
--
-- 18.5's own status already named the real gap: appointments, orders and
-- alterations are unwired for a wearer whose `corporate_wearers.customer_id`
-- is set. That column has existed since the corporate foundation
-- (20260801000012) but nothing has ever written to it and nothing has ever
-- read through it — a schema field with no path in either direction.
--
-- The column's own comment (20260804160000) says `login_email` is
-- "deliberately separate from the optional linked customer_id's email;
-- most wearers never become retail customers" — i.e. the same real person
-- may use a different login for their Employee Portal session than for
-- their retail Customer account. That means the existing customer-self RLS
-- (`customers.user_id = auth.uid()`) will NOT already pass for a wearer
-- reading their linked customer's data — the wearer's `auth.uid()` and the
-- customer row's `user_id` can legitimately be two different auth users
-- for the same real person. This migration adds narrow, additive
-- ("OR'd, never replacing", same posture as `corporate_wearers_self_select`)
-- read policies keyed off the wearer's OWN linked `corporate_wearers` row,
-- not off the customer row's own auth identity.

-- ---------------------------------------------------------------------------
-- Tenant invariant: a wearer's linked customer_id must belong to the same
-- retailer as the wearer. A CHECK constraint can't do a cross-table lookup,
-- so this is a trigger — same shape as
-- academy_roleplay_grade_session_tenant_chk (20260809190000).
-- ---------------------------------------------------------------------------

create or replace function public.check_corporate_wearer_customer_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is not null and not exists (
    select 1 from public.customers c
    where c.id = new.customer_id
      and c.retailer_id = new.retailer_id
      and c.deleted_at is null
  ) then
    raise exception 'customer_id must belong to the same retailer as the wearer';
  end if;
  return new;
end;
$$;

revoke all on function public.check_corporate_wearer_customer_tenant() from public;

create trigger corporate_wearer_customer_tenant_chk
  before insert or update of customer_id, retailer_id
  on public.corporate_wearers
  for each row execute function public.check_corporate_wearer_customer_tenant();

-- ---------------------------------------------------------------------------
-- Appointments / orders — real tables, additive SELECT policy.
-- ---------------------------------------------------------------------------

create policy "a linked wearer can read their own customer's appointments"
  on public.appointments for select to authenticated
  using (
    exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = appointments.customer_id
        and cw.user_id = (select auth.uid())
        and cw.deleted_at is null
    )
  );

create policy "a linked wearer can read their own customer's orders"
  on public.orders for select to authenticated
  using (
    exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = orders.customer_id
        and cw.user_id = (select auth.uid())
        and cw.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Alterations — the customer-facing surface is three security_barrier
-- views (20260719000103) whose own WHERE clause is the enforcement
-- boundary, not a table RLS policy. Views can't carry multiple OR'd
-- policies, so the wearer condition is added directly into each view's
-- WHERE clause via CREATE OR REPLACE VIEW (safe: same column list, same
-- security_barrier option, no drop).
-- ---------------------------------------------------------------------------

create or replace view public.customer_alteration_work_orders
with (security_barrier = true)
as
select
  w.id,
  w.retailer_id,
  w.customer_id,
  w.physical_garment_id,
  w.work_order_number,
  w.status,
  w.due_date,
  w.agreed_total_amount_minor_units,
  w.agreed_total_currency,
  w.customer_notification_ready_at,
  g.category_code,
  g.garment_type,
  g.brand,
  g.description,
  w.created_at,
  w.updated_at
from public.alteration_work_orders w
join public.physical_garments g on g.id = w.physical_garment_id
left join public.customers c on c.id = w.customer_id
where (
    c.user_id = auth.uid()
    or exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = w.customer_id
        and cw.user_id = auth.uid()
        and cw.deleted_at is null
    )
  )
  and w.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create or replace view public.customer_alteration_status_history
with (security_barrier = true)
as
select h.id, h.alteration_id, h.to_status, h.note, h.created_at
from public.alteration_status_history h
join public.alteration_work_orders w on w.id = h.alteration_id
left join public.customers c on c.id = w.customer_id
where (
    c.user_id = auth.uid()
    or exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = w.customer_id
        and cw.user_id = auth.uid()
        and cw.deleted_at is null
    )
  )
  and h.customer_visible
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

create or replace view public.customer_alteration_fulfillment
with (security_barrier = true)
as
select f.id, f.alteration_id, f.method, f.status, f.scheduled_at, f.completed_at,
       f.delivery_address, f.released_to_name, f.created_at, f.updated_at
from public.alteration_fulfillment_events f
join public.alteration_work_orders w on w.id = f.alteration_id
left join public.customers c on c.id = w.customer_id
where (
    c.user_id = auth.uid()
    or exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = w.customer_id
        and cw.user_id = auth.uid()
        and cw.deleted_at is null
    )
  )
  and f.deleted_at is null
  and (
    w.status in ('approved','assigned','in_progress','completion_review','ready_for_pickup','out_for_delivery','completed')
    or (w.status = 'canceled' and exists (
      select 1 from public.alteration_status_history approval
      where approval.alteration_id = w.id and approval.to_status = 'approved'
    ))
  );

grant select on public.customer_alteration_work_orders to authenticated;
grant select on public.customer_alteration_status_history to authenticated;
grant select on public.customer_alteration_fulfillment to authenticated;

-- ---------------------------------------------------------------------------
-- Body measurements — the record a wearer's linked customer holds.
-- ---------------------------------------------------------------------------

create policy "a linked wearer can read their own customer's measurement versions"
  on public.customer_measurement_versions for select to authenticated
  using (
    exists (
      select 1 from public.corporate_wearers cw
      where cw.customer_id = customer_measurement_versions.customer_id
        and cw.user_id = (select auth.uid())
        and cw.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Silent auto-link on login: the common, fully safe case where a wearer's
-- Employee Portal session and their retail Customer account share the same
-- login (their own real `auth.uid()`, not staff attestation). Extends
-- `link_my_wearer_account()` (20260804160000) rather than adding a second
-- call site — same "idempotent, re-derived entirely from auth.uid(), safe
-- to call on every session" contract that function already documents.
--
-- This is deliberately narrower than the staff-driven `setWearerCustomerId`
-- path above: it only ever links a customer row this exact auth user
-- already owns (`c.user_id = auth.uid()`), never a colleague's or a
-- staff-attested cross-login match — no new trust is created, only an
-- already-true relationship is recorded. It never creates a new `customers`
-- row (no shadow-customer fabrication, matching 18.6's own standing
-- constraint against exactly that) — a wearer with no matching login
-- simply stays unlinked until staff link them or a later slice adds an
-- explicit opt-in creation flow.
create or replace function public.link_my_wearer_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then
    return;
  end if;

  update public.corporate_wearers
    set user_id = auth.uid()
    where lower(login_email) = lower(v_email)
      and user_id is null
      and deleted_at is null;

  update public.corporate_wearers cw
    set customer_id = c.id
    from public.customers c
    where cw.user_id = auth.uid()
      and cw.customer_id is null
      and cw.deleted_at is null
      and c.retailer_id = cw.retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null;
end;
$$;

revoke all on function public.link_my_wearer_account() from public;
grant execute on function public.link_my_wearer_account() to authenticated;
