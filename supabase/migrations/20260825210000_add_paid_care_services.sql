-- My Appointments paid-care services (Customer Environment Rebuild V3
-- §6.1): dry-cleaning pickup, shoe repair & maintenance, alteration.
--
-- Alteration pricing already has a real catalogue
-- (alteration_price_lists/alteration_operations) and is reused as-is by
-- application code — nothing new here for that path. Dry-cleaning and
-- shoe-repair had no price data anywhere in the schema, so this adds one
-- retailer-scoped price list seeded with standard European premium-
-- tailoring going rates (founder direction: real, ordinary market prices,
-- not invented one-offs) rather than leaving those two services unpriced.
--
-- paid_care_bookings is the customer-initiated, pay-per-use record for
-- all three service kinds. It is deliberately separate from
-- ServicePlan/ServiceBooking (packages/domain/src/concierge/service-plan.ts)
-- which model membership-gated concierge entitlements — a customer here
-- has no plan/membership prerequisite.

create table public.paid_care_service_prices (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  service_kind text not null check (service_kind in ('dry_cleaning', 'shoe_repair')),
  operation_code text not null check (char_length(btrim(operation_code)) between 1 and 60),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  amount_minor_units integer not null check (amount_minor_units between 0 and 100000000),
  currency text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (retailer_id, service_kind, operation_code)
);

create index paid_care_service_prices_retailer_idx
  on public.paid_care_service_prices (retailer_id, service_kind)
  where deleted_at is null and active;

create trigger set_paid_care_service_prices_updated_at
  before update on public.paid_care_service_prices
  for each row execute function public.set_updated_at();

alter table public.paid_care_service_prices enable row level security;

revoke all on table public.paid_care_service_prices from public, anon;
grant select on table public.paid_care_service_prices to authenticated;
grant select, insert, update on table public.paid_care_service_prices to service_role;

create policy paid_care_service_prices_customer_read
  on public.paid_care_service_prices for select to authenticated
  using (
    active and deleted_at is null
    and exists (
      select 1 from public.customers c
      where c.retailer_id = paid_care_service_prices.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy paid_care_service_prices_staff_read
  on public.paid_care_service_prices for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy paid_care_service_prices_staff_write
  on public.paid_care_service_prices for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner')
  );

comment on table public.paid_care_service_prices is
  'Real, retailer-scoped going-rate prices for dry-cleaning and shoe-repair (no membership/plan required). Alteration reuses the existing alteration_price_lists catalogue instead of this table.';

-- Standard European premium-tailoring going rates. Seeded as a function
-- (not a one-time backfill insert) so every retailer gets real prices —
-- existing ones now, and any created afterward via the trigger below —
-- rather than only whichever retailers happened to exist when this
-- migration ran.
create or replace function public.seed_default_paid_care_service_prices(p_retailer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.paid_care_service_prices
    (retailer_id, service_kind, operation_code, label, amount_minor_units, currency, display_order)
  values
    (p_retailer_id, 'dry_cleaning', 'suit_two_piece', 'Suit (2-piece)', 1800, 'EUR', 1),
    (p_retailer_id, 'dry_cleaning', 'jacket_blazer', 'Jacket / blazer', 1200, 'EUR', 2),
    (p_retailer_id, 'dry_cleaning', 'trousers', 'Trousers', 800, 'EUR', 3),
    (p_retailer_id, 'dry_cleaning', 'shirt', 'Shirt', 500, 'EUR', 4),
    (p_retailer_id, 'dry_cleaning', 'overcoat', 'Overcoat / coat', 2200, 'EUR', 5),
    (p_retailer_id, 'dry_cleaning', 'knitwear', 'Knitwear', 900, 'EUR', 6),
    (p_retailer_id, 'shoe_repair', 'full_sole_replacement', 'Full sole replacement', 4500, 'EUR', 1),
    (p_retailer_id, 'shoe_repair', 'heel_replacement', 'Heel replacement', 1800, 'EUR', 2),
    (p_retailer_id, 'shoe_repair', 'shoe_shine_polish', 'Shoe shine & polish', 800, 'EUR', 3),
    (p_retailer_id, 'shoe_repair', 'stretching', 'Stretching', 1500, 'EUR', 4),
    (p_retailer_id, 'shoe_repair', 'waterproofing', 'Waterproofing treatment', 1200, 'EUR', 5)
  on conflict (retailer_id, service_kind, operation_code) do nothing;
$$;

revoke all on function public.seed_default_paid_care_service_prices(uuid) from public;
grant execute on function public.seed_default_paid_care_service_prices(uuid) to service_role;

-- Backfill every currently active retailer.
select public.seed_default_paid_care_service_prices(r.id)
from public.retailers r
where r.deleted_at is null;

-- Every retailer created from now on gets the same real defaults
-- automatically — a manager can still edit them afterward via the
-- staff-write policy above.
create or replace function public.seed_paid_care_prices_for_new_retailer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_paid_care_service_prices(new.id);
  return new;
end;
$$;

revoke all on function public.seed_paid_care_prices_for_new_retailer() from public;

create trigger seed_paid_care_prices_after_retailer_insert
  after insert on public.retailers
  for each row
  execute function public.seed_paid_care_prices_for_new_retailer();

-- Paid-care bookings: the real, tenant-safe request record for all three
-- services. Price/currency are captured at booking time (not just
-- referenced live) so a later price-list change never rewrites history.
create table public.paid_care_bookings (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_kind text not null check (service_kind in ('dry_cleaning', 'shoe_repair', 'alteration')),
  garment_description text not null check (char_length(btrim(garment_description)) between 1 and 500),
  quantity integer not null default 1 check (quantity between 1 and 50),
  operation_code text,
  operation_label text,
  unit_amount_minor_units integer check (unit_amount_minor_units between 0 and 100000000),
  total_amount_minor_units integer check (total_amount_minor_units between 0 and 100000000),
  currency text,
  pricing_status text not null default 'priced' check (pricing_status in ('priced', 'confirmed_by_advisor')),
  pickup_method text not null check (pickup_method in ('home', 'office', 'store')),
  return_method text not null check (return_method in ('home', 'office', 'store')),
  preferred_window text,
  notes text,
  payment_choice text not null check (payment_choice in ('pay_now', 'pay_at_pickup')),
  -- 'demo_authorized' is this build's honest placeholder for a real
  -- payment API not yet plugged in (founder direction, 2026-08-25) — it
  -- is never presented to the customer as a completed real-money charge.
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'demo_authorized', 'due_at_pickup')
  ),
  status text not null default 'requested' check (
    status in ('requested', 'confirmed', 'in_progress', 'fulfilled', 'canceled')
  ),
  qr_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (qr_token is null or return_method = 'store'),
  check (
    (pricing_status = 'priced' and total_amount_minor_units is not null and currency is not null)
    or pricing_status = 'confirmed_by_advisor'
  )
);

create unique index paid_care_bookings_qr_token_idx
  on public.paid_care_bookings (qr_token)
  where qr_token is not null;

create index paid_care_bookings_customer_idx
  on public.paid_care_bookings (customer_id)
  where deleted_at is null;

create index paid_care_bookings_retailer_idx
  on public.paid_care_bookings (retailer_id)
  where deleted_at is null;

create trigger set_paid_care_bookings_updated_at
  before update on public.paid_care_bookings
  for each row execute function public.set_updated_at();

alter table public.paid_care_bookings enable row level security;

revoke all on table public.paid_care_bookings from public, anon;
grant select, insert on table public.paid_care_bookings to authenticated;
grant update on table public.paid_care_bookings to authenticated;
grant select, insert, update on table public.paid_care_bookings to service_role;

create policy paid_care_bookings_customer_read
  on public.paid_care_bookings for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = paid_care_bookings.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy paid_care_bookings_staff_read
  on public.paid_care_bookings for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy paid_care_bookings_customer_insert
  on public.paid_care_bookings for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = paid_care_bookings.customer_id
        and c.retailer_id = paid_care_bookings.retailer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy paid_care_bookings_staff_update
  on public.paid_care_bookings for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

comment on table public.paid_care_bookings is
  'Customer-initiated, pay-per-use paid-care requests (dry-cleaning/shoe-repair/alteration). Not gated by any ServiceMembership.';

-- A confirmation notification (-> real transactional email via the
-- existing email_outbox trigger chain) the moment a booking is created,
-- mirroring notify_customer_when_alteration_ready's exact shape.
alter type public.notification_category add value if not exists 'paid_care_booking';

create or replace function public.notify_customer_paid_care_booking_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
  v_title text;
  v_body text;
begin
  select user_id into v_recipient_user_id
    from public.customers
    where id = new.customer_id
      and retailer_id = new.retailer_id
      and deleted_at is null;

  if v_recipient_user_id is null then
    return new;
  end if;

  v_title := 'Your care request is booked';
  v_body := 'We received your ' || replace(new.service_kind, '_', ' ') ||
    ' request for ' || new.garment_description || '.';

  insert into public.notifications (
    retailer_id, recipient_user_id, customer_id, category, title, body, action_href, sent_at
  )
  values (
    new.retailer_id, v_recipient_user_id, new.customer_id, 'paid_care_booking',
    v_title, v_body, '/appointments', now()
  );

  return new;
end;
$$;

revoke all on function public.notify_customer_paid_care_booking_confirmed() from public;

create trigger notify_customer_paid_care_booking_confirmed_after_insert
  after insert on public.paid_care_bookings
  for each row
  execute function public.notify_customer_paid_care_booking_confirmed();
