-- CustomerPreferences (docs/DOMAIN_MODEL.md Customer bounded context,
-- packages/domain/src/customer/customer.ts) — a shopper's own declared
-- locale/currency/communication/style preferences, persisted for the
-- first time in this slice. One row per Customer relationship (not per
-- User — a shopper's preferences for one retailer never leak into
-- another, same per-relationship shape as everything else in this
-- bounded context, see ADR-013).

create table public.customer_preferences (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  preferred_locale text not null default 'en-US',
  preferred_currency text not null default 'USD',
  communication_channels text[] not null default array['email'],
  style_notes text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_preferences_channels_valid check (
    communication_channels <@ array['email', 'sms', 'push', 'in_app']::text[]
  )
);

create trigger set_customer_preferences_updated_at
  before update on public.customer_preferences
  for each row
  execute function public.set_updated_at();

alter table public.customer_preferences enable row level security;

create policy "platform staff can manage all customer preferences"
  on public.customer_preferences for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- A customer manages their own preferences directly (no RPC needed —
-- unlike add_to_cart/toggle_wishlist_item, this never creates the
-- Customer row itself, only a row that references an existing one the
-- caller already owns, and there's no second table to write
-- transactionally). Same "self, via exists against the owning table"
-- shape as ADR-013.
create policy "a customer can read their own preferences"
  on public.customer_preferences for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "a customer can save their own preferences"
  on public.customer_preferences for insert
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "a customer can update their own preferences"
  on public.customer_preferences for update
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Retailer staff already read the full CRM record at sales_associate+
-- (docs/DATABASE.md) — communication opt-ins and style notes are
-- clienteling-relevant the same way wishlist/order/appointment history
-- already is (ADR-026).
create policy "retailer staff can read their retailer's customer preferences"
  on public.customer_preferences for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_preferences.customer_id
        and c.retailer_id = public.current_retailer_id()
    )
  );

-- PostgREST needs table-level SQL privileges in addition to RLS — this
-- table postdates 20260720000000's one-time blanket grant, so it needs
-- its own (see that migration's comment for the full reasoning).
grant select, insert, update, delete on public.customer_preferences
  to authenticated, service_role;
