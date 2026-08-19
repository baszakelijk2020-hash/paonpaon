-- PHASE 18.4 self-service slot booking, per direct founder instruction
-- (2026-08-19): "the retailer sets a schedule with slots, and new
-- customers or those who receive the link can pick a slot." Extends the
-- existing corporate office-visit landing page rather than a new surface.
--
-- corporate_visit_slots is a retailer-defined capacity pool per
-- programme, not tied to a specific staff member (corporate_programmes
-- has no staff-assignment concept). claim_corporate_visit_slot is the
-- ONLY write path an anonymous visitor reaches (same no-anonymous-RLS-
-- insert-policy pattern as submit_corporate_office_visit_request above
-- it in 20260804170000) and is where the real double-booking prevention
-- lives: it locks the slot row with `for update` before checking
-- capacity, so two visitors claiming the last seat at the same instant
-- serialize through the lock rather than both reading "1 of 2 booked"
-- and both succeeding. The pure checkClaimVisitSlot in
-- packages/domain/src/corporate/office-visit-request.ts mirrors this
-- condition for the UI to refuse an obviously-full slot early, but this
-- RPC is the actual enforcement.

create table public.corporate_visit_slots (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  programme_id uuid not null
    references public.corporate_programmes (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity >= 1),
  booked_count integer not null default 0 check (booked_count >= 0),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_visit_slots_time_window check (starts_at < ends_at),
  constraint corporate_visit_slots_capacity_not_exceeded check (booked_count <= capacity)
);

create index corporate_visit_slots_programme_upcoming_idx
  on public.corporate_visit_slots (programme_id, starts_at)
  where canceled_at is null;

create trigger set_corporate_visit_slots_updated_at
  before update on public.corporate_visit_slots
  for each row execute function public.set_updated_at();

alter table public.corporate_visit_slots enable row level security;
revoke all on table public.corporate_visit_slots from public, anon;
grant select, insert, update on table public.corporate_visit_slots to authenticated;
grant select, update on table public.corporate_visit_slots to service_role;

-- Retailer staff manage their own retailer's slot pool. Same management-
-- tier gate as mtm_price_components (20260819090000) and the alteration
-- price list precedent: defining bookable capacity is a pricing/ops
-- decision, not a line-staff action.
create policy "retailer staff read their retailer's corporate visit slots"
  on public.corporate_visit_slots for select
  to authenticated
  using (retailer_id = public.current_retailer_id());

create policy "retailer management creates corporate visit slots"
  on public.corporate_visit_slots for insert
  to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  );

create policy "retailer management updates corporate visit slots"
  on public.corporate_visit_slots for update
  to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'admin', 'manager')
  );

-- Public: the exact set of real, currently-claimable slots for a
-- programme's landing page. No retailer/company data beyond what
-- resolve_corporate_office_visit_page already exposes, no booked-by
-- identity of other visitors — only start/end/remaining capacity.
create or replace function public.list_open_corporate_visit_slots(
  p_programme_id uuid
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  remaining_capacity integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.id, s.starts_at, s.ends_at, (s.capacity - s.booked_count) as remaining_capacity
  from public.corporate_visit_slots s
  join public.corporate_programmes p on p.id = s.programme_id
  where s.programme_id = p_programme_id
    and s.canceled_at is null
    and s.starts_at > now()
    and s.booked_count < s.capacity
    and p.deleted_at is null
    and p.active
  order by s.starts_at asc;
$$;

-- The atomic claim. `for update` locks the target row for the duration
-- of this transaction; a concurrent caller claiming the same slot blocks
-- until this one commits or rolls back, then re-reads the now-current
-- booked_count — the exact mechanism that makes "two visitors claim the
-- last seat simultaneously" impossible rather than merely unlikely.
create or replace function public.claim_corporate_visit_slot(
  p_slot_id uuid,
  p_requester_name text,
  p_employee_reference text,
  p_contact_email text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slot public.corporate_visit_slots%rowtype;
  v_programme public.corporate_programmes%rowtype;
  v_name text := trim(p_requester_name);
  v_employee_reference text := nullif(trim(coalesce(p_employee_reference, '')), '');
  v_contact_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_request_id uuid;
begin
  if v_name = '' or char_length(v_name) > 200 then
    raise exception 'Name must be 1 to 200 characters';
  end if;
  if v_contact_email is not null
     and v_contact_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email or leave it blank';
  end if;

  select * into v_slot
    from public.corporate_visit_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'This time slot is no longer available';
  end if;
  if v_slot.canceled_at is not null then
    raise exception 'This time slot is no longer available';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'This time slot is no longer available';
  end if;
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'This time slot is fully booked';
  end if;

  select * into v_programme
    from public.corporate_programmes
    where id = v_slot.programme_id and deleted_at is null and active;
  if not found then
    raise exception 'This programme page is not available';
  end if;

  insert into public.corporate_office_visit_requests (
    retailer_id, programme_id, requester_name, employee_reference,
    contact_email, note, status, resolved_at
  ) values (
    v_slot.retailer_id, v_slot.programme_id, v_name, v_employee_reference,
    v_contact_email, v_note, 'scheduled', now()
  ) returning id into v_request_id;

  update public.corporate_visit_slots
    set booked_count = booked_count + 1
    where id = p_slot_id;

  return v_request_id;
end;
$$;

revoke all on function public.list_open_corporate_visit_slots(uuid) from public;
revoke all on function public.claim_corporate_visit_slot(uuid, text, text, text, text) from public;
grant execute on function public.list_open_corporate_visit_slots(uuid)
  to anon, authenticated;
grant execute on function public.claim_corporate_visit_slot(uuid, text, text, text, text)
  to anon, authenticated;

comment on table public.corporate_visit_slots is
  'PHASE 18.4 self-service booking capacity pool, one row per bookable window for one corporate programme. Not staff-scoped — corporate_programmes has no staff-assignment concept.';
comment on function public.claim_corporate_visit_slot is
  'The only anonymous write path onto corporate_visit_slots/corporate_office_visit_requests together. Locks the slot row (for update) before checking capacity, closing the double-booking race a plain read-then-write would leave open.';
