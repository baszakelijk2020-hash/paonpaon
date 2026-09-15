-- PHASE 20.38: Appointment booking platform foundation — extended schema
-- Adds party_size to appointments, photo_url/bio/bookable to staff,
-- and appointment_action_tokens for change/cancel actions.

-- Add party_size column to appointments with default and check constraint
alter table public.appointments
  add column party_size int not null default 1
  check (party_size between 1 and 8);

-- Add photo_url, bio, bookable to retailer_staff_members
alter table public.retailer_staff_members
  add column photo_url text,
  add column bio text,
  add column bookable boolean not null default true;

-- Create appointment_action_tokens table for change/cancel flow
-- Pattern: follows invite_tokens (20260721000005) + auth_tokens style
create table public.appointment_action_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  action text not null check (action in ('change', 'cancel')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for quick token lookup and expiry queries
create index appointment_action_tokens_token_idx on public.appointment_action_tokens (token);
create index appointment_action_tokens_appointment_id_idx on public.appointment_action_tokens (appointment_id);
create index appointment_action_tokens_retailer_id_idx on public.appointment_action_tokens (retailer_id);
create index appointment_action_tokens_expires_at_idx on public.appointment_action_tokens (expires_at) where used_at is null;

alter table public.appointment_action_tokens enable row level security;

-- Tenant-scoped RLS: customer can only see tokens tied to their own appointments
create policy "customers can read their appointment action tokens"
  on public.appointment_action_tokens for select
  using (
    exists (
      select 1 from public.appointments a
      join public.customers c on c.id = a.customer_id
      where a.id = appointment_action_tokens.appointment_id
        and c.user_id = auth.uid()
    )
  );

-- Platform staff can read and redeem (update used_at) any tokens
create policy "platform staff can read all appointment action tokens"
  on public.appointment_action_tokens for select
  using (public.is_platform_staff());

create policy "platform staff can manage all appointment action tokens"
  on public.appointment_action_tokens for all
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- Retailer staff can read tokens for their retailer
create policy "retailer staff can read their retailer's appointment action tokens"
  on public.appointment_action_tokens for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

-- Retailer staff can update (redeem) tokens for their retailer
create policy "retailer staff can redeem their retailer's appointment action tokens"
  on public.appointment_action_tokens for update
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('sales_associate', 'manager', 'admin', 'owner')
  );

-- Staff overlap constraint: prevent overlapping appointments for same staff member
-- Pattern: follows 20260811220000 with btree_gist
create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add constraint appointments_no_overlap_per_staff_excl
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (staff_id is not null and status <> 'canceled');

comment on column public.appointments.party_size is
  'Number of people in the booking party (1-8). Used for capacity planning and group appointment flows.';

comment on column public.retailer_staff_members.photo_url is
  'Staff member profile photo URL. Displayed in advisor preview and staff scheduling UI.';

comment on column public.retailer_staff_members.bio is
  'Staff member bio/specializations. Displayed in advisor preview and customer-facing advisor selection.';

comment on column public.retailer_staff_members.bookable is
  'Whether this staff member is available for customer booking. Controls visibility in appointment scheduling flows.';

comment on table public.appointment_action_tokens is
  'Signed tokens for customer-initiated appointment changes/cancellations. Issued by appointment_change() and appointment_cancel() RPCs (stub RPC placeholders). Single-use, expiry-scoped, tenant-isolated. Redeem via dedicated SECURITY DEFINER RPC (future: appointment_redeem_action_token).';
