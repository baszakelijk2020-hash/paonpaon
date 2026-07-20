-- Stripe Connect Express customer payments (founder decision,
-- docs/DECISIONS.md ADR-030). Every retailer is merchant of record —
-- direct charges on their own connected account, never destination
-- charges — PAON only ever touches money via an optional
-- application_fee_amount, computed from platform_fee_basis_points.

create type public.payment_status as enum (
  'pending', 'authorized', 'captured', 'refunded', 'failed'
);

create table public.retailer_stripe_accounts (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  platform_fee_basis_points integer not null default 0
    check (platform_fee_basis_points between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_retailer_stripe_accounts_updated_at
  before update on public.retailer_stripe_accounts
  for each row
  execute function public.set_updated_at();

alter table public.retailer_stripe_accounts enable row level security;

create policy "platform staff can manage all retailer stripe accounts"
  on public.retailer_stripe_accounts for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "owner or admin can read their retailer's stripe account"
  on public.retailer_stripe_accounts for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

-- The initial row is written by the owner/admin-initiated "Connect with
-- Stripe" action (apps/retailer) after a real Stripe account already
-- exists — never a client-invented id, just the caller's own
-- already-created account's id being recorded. There is no update
-- policy for authenticated roles: charges_enabled/payouts_enabled/
-- details_submitted are only ever synced from the account.updated
-- webhook (service_role, bypasses RLS), and platform_fee_basis_points
-- is platform-staff-only, the same "platform-controlled field" shape
-- as Retailer.defaultCurrency (docs/PROJECT_STATE.md).
create policy "owner or admin can start connecting their stripe account"
  on public.retailer_stripe_accounts for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin')
  );

grant select, insert, update, delete on public.retailer_stripe_accounts
  to authenticated, service_role;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null default 'stripe',
  provider_payment_intent_id text not null,
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency text not null,
  platform_fee_amount_minor_units integer not null default 0
    check (platform_fee_amount_minor_units >= 0),
  status public.payment_status not null default 'pending',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_intent_id)
);

create trigger set_payments_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "platform staff can manage all payments"
  on public.payments for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.retailer_id = public.current_retailer_id()
    )
  );

create policy "a customer can read their own order's payment"
  on public.payments for select
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = payments.order_id
        and c.user_id = auth.uid()
    )
  );

-- No insert/update policy for authenticated — same "narrow RPC over
-- broadened policy" shape as place_order/checkout_cart (ADR-014/024):
-- a client asserting its own payment status is exactly what must never
-- be trusted. Only record_stripe_payment_event (service_role) writes here.
grant select, insert, update, delete on public.payments to authenticated, service_role;

-- Idempotency ledger: Stripe retries a webhook delivery until it gets a
-- 2xx, so the same event id can and will arrive more than once under
-- normal operation, not just after a crash.
create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

create policy "platform staff can read all stripe webhook events"
  on public.stripe_webhook_events for select
  using (public.is_platform_staff());

grant select, insert, update, delete on public.stripe_webhook_events
  to authenticated, service_role;

-- The only way a payments row or a pending_payment -> placed/refunded
-- order transition happens. Called only by the Customer Portal Stripe
-- webhook Route Handler using a service-role client — granted to
-- service_role only, never authenticated, since it must never be
-- triggerable by a normal user session (same reasoning as every other
-- "narrow RPC over broadened policy" function, ADR-012/013/014/024).
-- MVP scope: one payments row per order (unique order_id) — a later
-- payment retry after a failed attempt updates that same row rather
-- than creating a new one; multi-attempt/partial-refund history is a
-- future enhancement, not modeled speculatively now.
create or replace function public.record_stripe_payment_event(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_provider_payment_intent_id text,
  p_amount_minor_units integer,
  p_currency text,
  p_status public.payment_status,
  p_platform_fee_amount_minor_units integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  insert into public.stripe_webhook_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    -- Already processed this exact Stripe event — redelivery, no-op.
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.currency <> p_currency
    or v_order.total_amount_minor_units <> p_amount_minor_units
  then
    raise exception 'Payment amount/currency does not match order %', p_order_id;
  end if;

  insert into public.payments (
    order_id, provider, provider_payment_intent_id,
    amount_minor_units, currency, platform_fee_amount_minor_units,
    status, captured_at
  )
  values (
    p_order_id, 'stripe', p_provider_payment_intent_id,
    p_amount_minor_units, p_currency, p_platform_fee_amount_minor_units,
    p_status, case when p_status = 'captured' then now() else null end
  )
  on conflict (order_id) do update
    set status = excluded.status,
        provider_payment_intent_id = excluded.provider_payment_intent_id,
        captured_at = coalesce(public.payments.captured_at, excluded.captured_at);

  if p_status = 'captured' and v_order.status = 'pending_payment' then
    update public.orders
      set status = 'placed', placed_at = coalesce(placed_at, now())
      where id = p_order_id;
  elsif p_status = 'refunded' and v_order.status not in ('refunded', 'canceled') then
    update public.orders set status = 'refunded' where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.record_stripe_payment_event(
  text, text, uuid, text, integer, text, public.payment_status, integer
) from public;
grant execute on function public.record_stripe_payment_event(
  text, text, uuid, text, integer, text, public.payment_status, integer
) to service_role;

comment on function public.record_stripe_payment_event is
  'The only way a payments row or a pending_payment->placed/refunded order transition happens. Called only by the Stripe webhook Route Handler (service_role). Idempotent at both the Stripe event level (stripe_webhook_events) and the payment-record level (unique order_id).';
