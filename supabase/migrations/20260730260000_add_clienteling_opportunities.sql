-- PHASE 7.4 / CLI-004 / CLI-005: sparse clienteling opportunities.

create table if not exists public.clienteling_opportunities (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  opportunity_type text not null check (
    opportunity_type in (
      'interest_follow_up',
      'purchase_care_check',
      'occasion_readiness',
      'relationship_dormancy',
      'wardrobe_gap',
      'anniversary_moment',
      'contact_pressure_warning'
    )
  ),
  why_now text not null check (char_length(btrim(why_now)) between 1 and 1000),
  suggested_action text not null check (
    char_length(btrim(suggested_action)) between 1 and 1000
  ),
  channel text not null check (
    channel in ('in_person', 'message', 'email', 'phone', 'appointment')
  ),
  best_time_window text,
  assigned_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  branch_label text,
  priority integer not null default 1 check (priority between 1 and 100),
  confidence numeric(4, 3) not null default 0.5
    check (confidence >= 0 and confidence <= 1),
  status text not null default 'draft' check (
    status in (
      'draft',
      'accepted',
      'snoozed',
      'dismissed',
      'incorrect',
      'completed',
      'expired'
    )
  ),
  due_at timestamptz,
  expires_at timestamptz,
  cooldown_until timestamptz,
  contact_pressure boolean not null default false,
  evidence jsonb not null default '[]'::jsonb,
  outcome_message_id uuid,
  outcome_appointment_id uuid,
  outcome_order_id uuid,
  projector_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists clienteling_opportunities_inbox_idx
  on public.clienteling_opportunities (
    retailer_id, status, priority, created_at desc
  )
  where deleted_at is null;

create index if not exists clienteling_opportunities_customer_idx
  on public.clienteling_opportunities (
    retailer_id, customer_id, created_at desc
  )
  where deleted_at is null;

alter table public.clienteling_opportunities enable row level security;

revoke all on table public.clienteling_opportunities from public, anon;
grant select, insert, update on table public.clienteling_opportunities
  to authenticated, service_role;

create policy clienteling_opportunities_retailer_select
  on public.clienteling_opportunities for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy clienteling_opportunities_retailer_write
  on public.clienteling_opportunities for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

create policy clienteling_opportunities_retailer_update
  on public.clienteling_opportunities for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  )
  with check (retailer_id = public.current_retailer_id());

comment on table public.clienteling_opportunities is
  'Sparse human-reviewable clienteling opportunity drafts (PHASE 7.4).';
