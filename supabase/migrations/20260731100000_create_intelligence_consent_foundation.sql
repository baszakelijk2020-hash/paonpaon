-- PAON Intelligence Platform Stage 3.1 — consent foundation (ADR-061).
-- Purpose-specific consent is tenant-scoped and customer-controlled.

create type public.consent_purpose as enum (
  'personalization',
  'marketing',
  'location'
);

create table public.customer_consent_records (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  purpose public.consent_purpose not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  retention_deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_consent_records_grant_withdrawal_order check (
    withdrawn_at is null
    or granted_at is null
    or withdrawn_at >= granted_at
  ),
  constraint customer_consent_records_withdrawal_deadline check (
    retention_deadline_at is null
    or withdrawn_at is not null
  )
);

create unique index customer_consent_records_retailer_customer_purpose_uidx
  on public.customer_consent_records (retailer_id, customer_id, purpose);

create index customer_consent_records_customer_idx
  on public.customer_consent_records (customer_id, purpose);

create trigger set_customer_consent_records_updated_at
  before update on public.customer_consent_records
  for each row execute function public.set_updated_at();

alter table public.customer_consent_records enable row level security;

revoke all on table public.customer_consent_records from anon;
revoke all on table public.customer_consent_records from public;

create policy "platform staff manage customer consent records"
  on public.customer_consent_records for all to authenticated
  using ((select public.is_platform_staff()))
  with check ((select public.is_platform_staff()));

create policy "customers read their consent records"
  on public.customer_consent_records for select to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_consent_records.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "customers upsert their consent records"
  on public.customer_consent_records for insert to authenticated
  with check (
    exists (
      select 1
      from public.customers c
      where c.id = customer_consent_records.customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = customer_consent_records.retailer_id
    )
  );

create policy "customers update their consent records"
  on public.customer_consent_records for update to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_consent_records.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.customers c
      where c.id = customer_consent_records.customer_id
        and c.user_id = auth.uid()
        and c.retailer_id = customer_consent_records.retailer_id
    )
  );

create policy "retailer staff read customer consent records"
  on public.customer_consent_records for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('manager', 'admin', 'owner', 'sales_associate')
  );

grant select, insert, update on public.customer_consent_records
  to authenticated, service_role;

comment on table public.customer_consent_records is
  'Purpose-specific intelligence consent per retailer-customer relationship (ADR-061). Withdrawal sets retention_deadline_at for downstream anonymization.';
