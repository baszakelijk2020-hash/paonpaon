-- Profile overhaul groundwork + 1-Click Checkout "honor" status.
--
-- Three additive, non-destructive changes:
--
-- 1. `customers` gains `date_of_birth`, `profile_photo_url` — self-service
--    profile fields the customer app is about to surface. Nullable; no
--    backfill needed, no existing reader depends on their absence.
--
-- 2. A new `upsert_my_labeled_address` RPC alongside (not replacing)
--    `update_my_default_shipping_address` (20260803000003). That function
--    always collapses `shipping_addresses` to a single-entry array — the
--    "1-Tap Checkout" default. The founder now wants separate, persistent
--    Home and Work addresses on the profile (with floor/delivery notes),
--    which is a different shape: a small labeled set, not one collapsing
--    default. This RPC upserts-by-label into the same jsonb array column
--    instead of replacing it outright, so both call sites keep working
--    without interfering with each other (one-tap default vs. labeled
--    profile addresses are simply different entries in the same array,
--    distinguished by `label`).
--
-- 3. 1-Click Checkout eligibility status, framed as an honor the customer
--    requests rather than a self-service toggle. This is a STATUS FIELD
--    ONLY: no card, no payment method, no Stripe object is stored or
--    created here, and no charge becomes possible because of it. Stripe is
--    not connected yet (ADR-062 gate on real payment capture remains
--    fully in force). `request_one_click_checkout_eligibility` only moves
--    a customer's own row from 'not_requested' to 'pending_review' so an
--    advisor can follow up manually — the honor-system waitlist the
--    founder asked for, not a payment feature.

alter table public.customers
  add column if not exists date_of_birth date,
  add column if not exists profile_photo_url text,
  add column if not exists one_click_checkout_status text not null default 'not_requested',
  add column if not exists one_click_requested_at timestamptz,
  add column if not exists one_click_activated_at timestamptz;

alter table public.customers
  drop constraint if exists customers_one_click_checkout_status_check;
alter table public.customers
  add constraint customers_one_click_checkout_status_check
  check (one_click_checkout_status in ('not_requested', 'pending_review', 'eligible', 'active'));

comment on column public.customers.one_click_checkout_status is
  'Honor-system 1-Click Checkout status only. Never gates or implies a stored payment method — Stripe is not connected (ADR-062).';

-- Upsert a labeled address (home/work/other) into shipping_addresses by
-- label, leaving every other entry untouched. Mirrors
-- update_my_default_shipping_address's own-row resolution and validation
-- exactly (20260803000003) so both stay consistent.
create or replace function public.upsert_my_labeled_address(
  p_retailer_id uuid,
  p_label text,
  p_address jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_existing jsonb;
  v_next jsonb;
  v_addr jsonb;
  v_found boolean := false;
  v_i int;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_label not in ('home', 'work', 'other') then
    raise exception 'Invalid address label';
  end if;
  if jsonb_typeof(p_address) <> 'object'
    or coalesce(trim(p_address ->> 'line1'), '') = ''
    or coalesce(trim(p_address ->> 'city'), '') = ''
    or coalesce(trim(p_address ->> 'postalCode'), '') = ''
    or length(coalesce(p_address ->> 'countryCode', '')) <> 2 then
    raise exception 'Complete address required';
  end if;

  select c.id, coalesce(c.shipping_addresses, '[]'::jsonb)
    into v_customer_id, v_existing
  from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship not found'; end if;

  v_addr := p_address || jsonb_build_object('label', p_label);
  v_next := '[]'::jsonb;
  for v_i in 0 .. jsonb_array_length(v_existing) - 1 loop
    if (v_existing -> v_i ->> 'label') = p_label then
      v_next := v_next || jsonb_build_array(v_addr);
      v_found := true;
    else
      v_next := v_next || jsonb_build_array(v_existing -> v_i);
    end if;
  end loop;
  if not v_found then
    v_next := v_next || jsonb_build_array(v_addr);
  end if;

  update public.customers set shipping_addresses = v_next where id = v_customer_id;
end;
$$;

revoke all on function public.upsert_my_labeled_address(uuid, text, jsonb) from public;
grant execute on function public.upsert_my_labeled_address(uuid, text, jsonb) to authenticated, service_role;

-- Self-service profile detail update: name, date of birth, photo. Any
-- argument left null clears that field rather than being ignored, except
-- full name, which is required non-empty (matches `customers.full_name`
-- not-null already enforced by the base schema).
create or replace function public.update_my_profile_details(
  p_retailer_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_profile_photo_url text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name required';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship not found'; end if;

  update public.customers
  set full_name = trim(p_full_name),
      date_of_birth = p_date_of_birth,
      profile_photo_url = p_profile_photo_url
  where id = v_customer_id;
end;
$$;

revoke all on function public.update_my_profile_details(uuid, text, date, text) from public;
grant execute on function public.update_my_profile_details(uuid, text, date, text) to authenticated, service_role;

-- The honor-system 1-Click Checkout eligibility request. Idempotent: a
-- second request while already pending/eligible/active is a silent no-op,
-- never an error the customer would see as a bug.
create or replace function public.request_one_click_checkout_eligibility(
  p_retailer_id uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select c.id, c.one_click_checkout_status into v_customer_id, v_status
  from public.customers c
  where c.retailer_id = p_retailer_id and c.user_id = auth.uid() and c.deleted_at is null;
  if v_customer_id is null then raise exception 'Customer relationship not found'; end if;

  if v_status = 'not_requested' then
    update public.customers
    set one_click_checkout_status = 'pending_review',
        one_click_requested_at = now()
    where id = v_customer_id;
    v_status := 'pending_review';
  end if;

  return v_status;
end;
$$;

revoke all on function public.request_one_click_checkout_eligibility(uuid) from public;
grant execute on function public.request_one_click_checkout_eligibility(uuid) to authenticated, service_role;
