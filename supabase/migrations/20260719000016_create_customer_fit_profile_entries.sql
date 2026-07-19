-- See docs/DOMAIN_MODEL.md "Customer" and
-- packages/domain/src/customer/customer.ts "CustomerFitProfileEntry".
-- Deliberately append-only (insert-only policies below, no update/
-- delete for any non-platform role) — "current" is simply the most
-- recent row per customer, so sizing history is the data model, not a
-- bolted-on audit trail of a separately-mutable "profile" row.

create table public.customer_fit_profile_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  measurements jsonb not null default '{}'::jsonb,
  fit_preferences text,
  style_notes text,
  recorded_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index customer_fit_profile_entries_customer_id_idx
  on public.customer_fit_profile_entries (customer_id, recorded_at desc);

alter table public.customer_fit_profile_entries enable row level security;

create policy "platform staff can manage all fit profile entries"
  on public.customer_fit_profile_entries for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "retailer staff can read their retailer's fit profile entries"
  on public.customer_fit_profile_entries for select
  using (retailer_id = public.current_retailer_id());

-- Same crowd as customers' sales_associate+ CRM gate — taking
-- measurements after a consultation is frontline client-service work.
create policy "sales staff and above can record fit profile entries"
  on public.customer_fit_profile_entries for insert
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

create policy "a customer can read their own fit profile entries"
  on public.customer_fit_profile_entries for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_fit_profile_entries.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.customer_fit_profile_entries is
  'Append-only measurement/fit/style snapshots. "Current" = most recent row per customer_id. See @paon/domain CustomerFitProfileEntry.';
