-- Virtual Wardrobe Studio — Style Portrait consent (VWS-002 / PHASE 4.7 /
-- ADR-074). Deliberately independent of `customer_consent_events`/
-- `CONSENT_PURPOSES` (personalization/marketing/location): this purpose
-- carries its own explicit disclosures (why images are needed, whether the
-- assigned advisor can see them, that outputs are AI visualizations, how to
-- delete/revoke) that don't fit the generic three-purpose shape, and adding
-- a fourth purpose there would have forced changes across every existing
-- consumer of that shared type. One row per Customer relationship, same
-- "self, via exists against the owning table" RLS shape as
-- customer_preferences (no RPC needed).

create table public.style_portrait_consents (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  status text not null default 'denied' check (
    status in ('granted', 'denied', 'withdrawn')
  ),
  disclosures_acknowledged boolean not null default false,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_portrait_consents_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint style_portrait_consents_granted_chk check (
    status <> 'granted' or (disclosures_acknowledged and granted_at is not null)
  )
);

create index style_portrait_consents_retailer_idx
  on public.style_portrait_consents (retailer_id, status);

create trigger set_style_portrait_consents_updated_at
  before update on public.style_portrait_consents
  for each row execute function public.set_updated_at();

alter table public.style_portrait_consents enable row level security;

revoke all on table public.style_portrait_consents from anon;

create policy "platform staff can manage all style portrait consents"
  on public.style_portrait_consents for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

create policy "a customer can read their own style portrait consent"
  on public.style_portrait_consents for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = style_portrait_consents.customer_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "a customer can save their own style portrait consent"
  on public.style_portrait_consents for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = style_portrait_consents.customer_id
        and c.retailer_id = style_portrait_consents.retailer_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "a customer can update their own style portrait consent"
  on public.style_portrait_consents for update to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = style_portrait_consents.customer_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = style_portrait_consents.customer_id
        and c.user_id = (select auth.uid())
    )
  );

-- The assigned advisor needs to know whether they may see this customer's
-- Style Portrait images (founder brief's explicit disclosure requirement)
-- — read-only, same role floor as every other tenant CRM read.
create policy "retailer staff read tenant style portrait consent"
  on public.style_portrait_consents for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

grant select, insert, update on table public.style_portrait_consents
  to authenticated, service_role;
grant all on table public.style_portrait_consents to service_role;

comment on table public.style_portrait_consents is
  'VWS-002: explicit, revocable image-generation consent with disclosure '
  'acknowledgement. Generation is blocked unless status = granted and '
  'disclosures_acknowledged = true (canGenerateWardrobeVisualization).';
