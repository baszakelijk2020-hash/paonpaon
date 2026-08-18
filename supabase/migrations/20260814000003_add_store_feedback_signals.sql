-- EXP-101: explicitly submitted, consent-gated in-store feedback. This is
-- deliberately separate from anonymous store_observations: neither staff nor
-- biometric identity belongs in this audit trail.

alter table public.customers
  add constraint customers_id_retailer_id_key unique (id, retailer_id);

create table public.store_feedback_signals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  customer_id uuid,
  garment_ref text,
  audience text not null check (audience in ('buying', 'merchandising', 'client_experience')),
  feedback text not null check (char_length(btrim(feedback)) between 3 and 2000),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'corrected')),
  corrects_signal_id uuid references public.store_feedback_signals(id) on delete restrict,
  acknowledged_at timestamptz,
  follow_up_note text check (follow_up_note is null or char_length(btrim(follow_up_note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_feedback_signals_context_chk check (
    customer_id is not null or nullif(btrim(garment_ref), '') is not null
  ),
  constraint store_feedback_signals_ack_chk check (
    (status = 'acknowledged' and acknowledged_at is not null and follow_up_note is not null)
    or (status in ('open', 'corrected') and acknowledged_at is null and follow_up_note is null)
  ),
  constraint store_feedback_signals_customer_tenant_fkey
    foreign key (customer_id, retailer_id)
    references public.customers(id, retailer_id) on delete restrict,
  unique (retailer_id, idempotency_key)
);

create index store_feedback_signals_queue_idx
  on public.store_feedback_signals(retailer_id, status, created_at desc);
create index store_feedback_signals_customer_idx
  on public.store_feedback_signals(retailer_id, customer_id, created_at desc)
  where customer_id is not null;

create trigger set_store_feedback_signals_updated_at
  before update on public.store_feedback_signals
  for each row execute function public.set_updated_at();

alter table public.store_feedback_signals enable row level security;
revoke all on table public.store_feedback_signals from public, anon;
grant select on table public.store_feedback_signals to authenticated, service_role;

create policy store_feedback_signals_leadership_select
  on public.store_feedback_signals for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'admin', 'manager')
  );

create or replace function public.capture_store_feedback_signal(
  p_customer_id uuid default null,
  p_garment_ref text default null,
  p_audience text default null,
  p_feedback text default null,
  p_idempotency_key text default null
)
returns public.store_feedback_signals
language plpgsql security definer set search_path = ''
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_role text := public.current_retailer_role();
  v_customer public.customers%rowtype;
  v_personalization_granted boolean := false;
  v_existing public.store_feedback_signals%rowtype;
  v_signal public.store_feedback_signals%rowtype;
  v_garment_ref text := nullif(btrim(coalesce(p_garment_ref, '')), '');
  v_feedback text := nullif(btrim(coalesce(p_feedback, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or v_retailer_id is null
     or v_role not in ('owner', 'admin', 'manager', 'sales_associate') then
    raise exception 'Not authorized';
  end if;
  if p_audience not in ('buying', 'merchandising', 'client_experience') then
    raise exception 'Select a leadership audience';
  end if;
  if v_key is null or v_feedback is null or char_length(v_feedback) < 3 then
    raise exception 'Feedback and idempotency key are required';
  end if;
  if p_customer_id is null and v_garment_ref is null then
    raise exception 'A customer context or garment reference is required';
  end if;
  if p_customer_id is not null then
    select * into v_customer from public.customers
      where id = p_customer_id and retailer_id = v_retailer_id and deleted_at is null;
    if not found then raise exception 'Customer unavailable'; end if;
    select coalesce(cp.personalization_opt_in, false) and cp.personalization_withdrawn_at is null
      into v_personalization_granted from public.customer_preferences cp where cp.customer_id = p_customer_id;
    if v_personalization_granted is not true then
      raise exception 'Customer personalization consent is required';
    end if;
  end if;
  select * into v_existing from public.store_feedback_signals
    where retailer_id = v_retailer_id and idempotency_key = v_key;
  if found then
    if v_existing.customer_id is not distinct from p_customer_id
       and v_existing.garment_ref is not distinct from v_garment_ref
       and v_existing.audience = p_audience and v_existing.feedback = v_feedback then
      return v_existing;
    end if;
    raise exception 'Idempotency key was already used for another feedback signal';
  end if;
  insert into public.store_feedback_signals(retailer_id, customer_id, garment_ref, audience, feedback, idempotency_key)
  values (v_retailer_id, p_customer_id, v_garment_ref, p_audience, v_feedback, v_key)
  returning * into v_signal;
  return v_signal;
end $$;

create or replace function public.acknowledge_store_feedback_signal(
  p_signal_id uuid, p_follow_up_note text
)
returns public.store_feedback_signals
language plpgsql security definer set search_path = ''
as $$
declare v_signal public.store_feedback_signals%rowtype; v_note text := nullif(btrim(coalesce(p_follow_up_note, '')), '');
begin
  if auth.uid() is null or public.current_retailer_role() not in ('owner', 'admin', 'manager') then raise exception 'Not authorized'; end if;
  if v_note is null then raise exception 'A follow-up note is required'; end if;
  update public.store_feedback_signals set status = 'acknowledged', acknowledged_at = now(), follow_up_note = v_note
    where id = p_signal_id and retailer_id = public.current_retailer_id() and status = 'open'
    returning * into v_signal;
  if not found then raise exception 'Feedback signal unavailable'; end if;
  return v_signal;
end $$;

create or replace function public.correct_store_feedback_signal(
  p_signal_id uuid, p_customer_id uuid default null, p_garment_ref text default null,
  p_audience text default null, p_feedback text default null, p_idempotency_key text default null
)
returns public.store_feedback_signals
language plpgsql security definer set search_path = ''
as $$
declare
  v_original public.store_feedback_signals%rowtype;
  v_replacement public.store_feedback_signals%rowtype;
  v_retailer_id uuid := public.current_retailer_id();
  v_customer public.customers%rowtype;
  v_personalization_granted boolean := false;
  v_garment_ref text := nullif(btrim(coalesce(p_garment_ref, '')), '');
  v_feedback text := nullif(btrim(coalesce(p_feedback, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if auth.uid() is null or public.current_retailer_role() not in ('owner', 'admin', 'manager') then raise exception 'Not authorized'; end if;
  select * into v_original from public.store_feedback_signals where id = p_signal_id and retailer_id = v_retailer_id and status = 'open' for update;
  if not found then raise exception 'Open feedback signal unavailable'; end if;
  if p_audience not in ('buying', 'merchandising', 'client_experience') then
    raise exception 'Select a leadership audience';
  end if;
  if v_key is null or v_feedback is null or char_length(v_feedback) < 3 then
    raise exception 'Feedback and idempotency key are required';
  end if;
  if p_customer_id is null and v_garment_ref is null then
    raise exception 'A customer context or garment reference is required';
  end if;
  if exists (
    select 1 from public.store_feedback_signals
    where retailer_id = v_retailer_id and idempotency_key = v_key
  ) then
    raise exception 'Idempotency key was already used for another feedback signal';
  end if;
  if p_customer_id is not null then
    select * into v_customer from public.customers
      where id = p_customer_id and retailer_id = v_retailer_id and deleted_at is null;
    if not found then raise exception 'Customer unavailable'; end if;
    select coalesce(cp.personalization_opt_in, false) and cp.personalization_withdrawn_at is null
      into v_personalization_granted from public.customer_preferences cp where cp.customer_id = p_customer_id;
    if v_personalization_granted is not true then
      raise exception 'Customer personalization consent is required';
    end if;
  end if;
  insert into public.store_feedback_signals(
    retailer_id, customer_id, garment_ref, audience, feedback, idempotency_key, corrects_signal_id
  ) values (
    v_retailer_id, p_customer_id, v_garment_ref, p_audience, v_feedback, v_key, v_original.id
  ) returning * into v_replacement;
  update public.store_feedback_signals set status = 'corrected' where id = v_original.id;
  return v_replacement;
end $$;

revoke all on function public.capture_store_feedback_signal(uuid, text, text, text, text) from public, anon;
revoke all on function public.acknowledge_store_feedback_signal(uuid, text) from public, anon;
revoke all on function public.correct_store_feedback_signal(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.capture_store_feedback_signal(uuid, text, text, text, text), public.acknowledge_store_feedback_signal(uuid, text), public.correct_store_feedback_signal(uuid, uuid, text, text, text, text) to authenticated, service_role;

comment on table public.store_feedback_signals is 'Explicit in-store feedback routed to leadership. It has no staff identity, no auth user id, and no biometric data.';
