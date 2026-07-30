-- PHASE 10.2 / CMP-105 / CMP-106 / WRD-104: seven-day + honeymoon library packages
-- and order-linked honeymoon programme tracker.

alter table public.campaign_library_entries
  drop constraint if exists campaign_library_entries_key_check;

alter table public.campaign_library_entries
  add constraint campaign_library_entries_key_check check (
    key in (
      'private_offer_member_fabric',
      'seven_day_wardrobe',
      'honeymoon_phase'
    )
  );

insert into public.campaign_library_entries (key, display_name)
values
  ('seven_day_wardrobe', 'Seven-Day Wardrobe'),
  ('honeymoon_phase', 'Honeymoon Phase')
on conflict (key) do nothing;

-- Optional owned wardrobe reference on challenge slots (catalogue product remains).
alter table public.campaign_challenge_look_slots
  add column if not exists wardrobe_item_id uuid
    references public.wardrobe_items (id) on delete set null,
  add column if not exists source text
    check (source is null or source in ('owned', 'suggested', 'gap'));

alter table public.campaign_challenge_look_slots
  alter column product_id drop not null;

alter table public.campaign_challenge_look_slots
  drop constraint if exists campaign_challenge_look_slots_source_xor_chk;

alter table public.campaign_challenge_look_slots
  add constraint campaign_challenge_look_slots_source_xor_chk check (
    (
      source is null
      and product_id is not null
      and wardrobe_item_id is null
    )
    or (
      source = 'owned'
      and wardrobe_item_id is not null
    )
    or (
      source = 'suggested'
      and product_id is not null
    )
    or (
      source = 'gap'
      and product_id is null
      and wardrobe_item_id is null
    )
  );

create table if not exists public.honeymoon_programmes (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  library_version_id uuid
    references public.campaign_library_versions (id),
  status text not null default 'active' check (
    status in ('active', 'completed', 'suppressed', 'canceled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists honeymoon_programmes_retailer_idx
  on public.honeymoon_programmes (retailer_id, created_at desc);

alter table public.honeymoon_programmes enable row level security;
revoke all on table public.honeymoon_programmes from public, anon;
grant select on table public.honeymoon_programmes
  to authenticated, service_role;
grant insert, update on table public.honeymoon_programmes
  to service_role;

create policy honeymoon_programmes_customer_select
  on public.honeymoon_programmes for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = honeymoon_programmes.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy honeymoon_programmes_retailer_select
  on public.honeymoon_programmes for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'admin', 'sales_associate', 'production_staff'
    )
  );

create table if not exists public.honeymoon_programme_actions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null
    references public.honeymoon_programmes (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  kind text not null check (
    kind in ('preparation', 'collection', 'aftercare')
  ),
  title text not null,
  due_hint text not null,
  suppressed boolean not null default false,
  suppression_reason text,
  requires_payment_approval boolean not null default false
    check (requires_payment_approval = false),
  created_at timestamptz not null default now(),
  unique (programme_id, kind)
);

alter table public.honeymoon_programme_actions enable row level security;
revoke all on table public.honeymoon_programme_actions from public, anon;
grant select on table public.honeymoon_programme_actions
  to authenticated, service_role;
grant insert, update on table public.honeymoon_programme_actions
  to service_role;

create policy honeymoon_programme_actions_select
  on public.honeymoon_programme_actions for select to authenticated
  using (
    exists (
      select 1 from public.honeymoon_programmes p
      where p.id = honeymoon_programme_actions.programme_id
        and (
          p.retailer_id = public.current_retailer_id()
          or exists (
            select 1 from public.customers c
            where c.id = p.customer_id
              and c.user_id = (select auth.uid())
              and c.deleted_at is null
          )
        )
    )
  );

comment on table public.honeymoon_programmes is
  'Order-linked Honeymoon Phase programme (PHASE 10.2 / CMP-106).';
comment on table public.honeymoon_programme_actions is
  'Preparation/collection/aftercare actions with stock/pressure suppression.';
