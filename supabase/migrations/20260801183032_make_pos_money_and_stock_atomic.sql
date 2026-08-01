-- R0.2: money and stock must cross a transaction boundary together.
--
-- The first POS implementation performed each step through a separate Data
-- API request. A timeout after reserving but before inserting the sale line,
-- or after completing the transaction but before writing the sale movement,
-- left a valid-looking half operation. These RPCs lock the aggregate and
-- commit its payment, state and ledger effects as one Postgres transaction.

alter table public.pos_transaction_lines
  add column if not exists returns_line_id uuid;

alter table public.pos_transaction_lines
  add constraint pos_lines_retailer_id_id_key unique (retailer_id, id);

alter table public.pos_transaction_lines
  add constraint pos_lines_returns_line_same_retailer_fk
  foreign key (retailer_id, returns_line_id)
  references public.pos_transaction_lines (retailer_id, id)
  on delete restrict
  not valid;

alter table public.pos_transaction_lines
  add constraint pos_return_line_is_negative
  check (returns_line_id is null or quantity < 0) not valid;

create unique index if not exists pos_lines_one_return_per_original_idx
  on public.pos_transaction_lines (returns_line_id)
  where returns_line_id is not null;

create unique index if not exists stock_ledger_one_reversal_per_entry_idx
  on public.stock_ledger_entries (reverses_entry_id)
  where reverses_entry_id is not null;

alter table public.pos_transaction_lines
  validate constraint pos_lines_returns_line_same_retailer_fk;
alter table public.pos_transaction_lines
  validate constraint pos_return_line_is_negative;

create or replace function public.assert_pos_actor(p_retailer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;

  if public.current_retailer_id() is distinct from p_retailer_id
    or public.current_retailer_role() not in
      ('owner', 'manager', 'admin', 'sales_associate') then
    raise insufficient_privilege using
      message = 'POS operation is outside the caller retailer or role.';
  end if;
end;
$$;

create or replace function public.stock_available_at(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_location_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with deduped as (
    select distinct on (coalesce(e.idempotency_key, e.id::text))
      e.id, e.kind, e.quantity, e.reverses_entry_id,
      e.occurred_at
    from public.stock_ledger_entries e
    where e.retailer_id = p_retailer_id
      and e.variant_id = p_variant_id
      and e.location_id = p_location_id
    order by coalesce(e.idempotency_key, e.id::text), e.occurred_at, e.id
  ),
  signed as (
    select
      case d.kind
        when 'receipt' then d.quantity
        when 'transfer_in' then d.quantity
        when 'sale' then -d.quantity
        when 'transfer_out' then -d.quantity
        when 'count_adjustment' then d.quantity
        when 'reversal' then -1 * coalesce((
          select case original.kind
            when 'receipt' then original.quantity
            when 'transfer_in' then original.quantity
            when 'sale' then -original.quantity
            when 'transfer_out' then -original.quantity
            when 'count_adjustment' then original.quantity
            else 0
          end
          from public.stock_ledger_entries original
          where original.id = d.reverses_entry_id
        ), 0)
        else 0
      end as on_hand_delta,
      case d.kind
        when 'reservation' then d.quantity
        when 'reservation_release' then -d.quantity
        when 'reversal' then -1 * coalesce((
          select case original.kind
            when 'reservation' then original.quantity
            when 'reservation_release' then -original.quantity
            else 0
          end
          from public.stock_ledger_entries original
          where original.id = d.reverses_entry_id
        ), 0)
        else 0
      end as reserved_delta
    from deduped d
  )
  select (coalesce(sum(on_hand_delta), 0) -
    coalesce(sum(reserved_delta), 0))::integer
  from signed;
$$;

create or replace function public.reserve_stock_atomic(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_recorded_by_staff_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available integer;
  v_id uuid;
begin
  perform public.assert_pos_actor(p_retailer_id);
  if p_quantity <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'quantity_not_positive');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_retailer_id::text || ':' || p_variant_id::text || ':' || p_location_id::text,
    0
  ));

  if p_idempotency_key is not null then
    select id into v_id
    from public.stock_ledger_entries
    where retailer_id = p_retailer_id
      and idempotency_key = p_idempotency_key;
    if v_id is not null then
      return jsonb_build_object('ok', true, 'id', v_id, 'replayed', true);
    end if;
  end if;

  v_available := public.stock_available_at(
    p_retailer_id, p_variant_id, p_location_id
  );
  if v_available < p_quantity then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_available');
  end if;

  insert into public.stock_ledger_entries (
    retailer_id, variant_id, location_id, kind, quantity,
    recorded_by_staff_id, idempotency_key
  ) values (
    p_retailer_id, p_variant_id, p_location_id, 'reservation', p_quantity,
    p_recorded_by_staff_id, p_idempotency_key
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'replayed', false);
end;
$$;

create or replace function public.transfer_stock_atomic(
  p_retailer_id uuid,
  p_variant_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity integer,
  p_recorded_by_staff_id uuid default null,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available integer;
  v_out_id uuid;
  v_in_id uuid;
  v_first text;
  v_second text;
begin
  perform public.assert_pos_actor(p_retailer_id);
  if p_from_location_id = p_to_location_id then
    return jsonb_build_object('ok', false, 'reason', 'same_location');
  end if;
  if p_quantity <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'quantity_not_positive');
  end if;

  v_first := least(p_from_location_id::text, p_to_location_id::text);
  v_second := greatest(p_from_location_id::text, p_to_location_id::text);
  perform pg_advisory_xact_lock(hashtextextended(
    p_retailer_id::text || ':' || p_variant_id::text || ':' || v_first, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_retailer_id::text || ':' || p_variant_id::text || ':' || v_second, 0
  ));

  select id into v_out_id
  from public.stock_ledger_entries
  where retailer_id = p_retailer_id
    and idempotency_key = 'transfer-out:' || p_operation_id::text;
  select id into v_in_id
  from public.stock_ledger_entries
  where retailer_id = p_retailer_id
    and idempotency_key = 'transfer-in:' || p_operation_id::text;
  if v_out_id is not null and v_in_id is not null then
    return jsonb_build_object(
      'ok', true, 'outId', v_out_id, 'inId', v_in_id, 'replayed', true
    );
  end if;

  v_available := public.stock_available_at(
    p_retailer_id, p_variant_id, p_from_location_id
  );
  if v_available < p_quantity then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_available');
  end if;

  insert into public.stock_ledger_entries (
    retailer_id, variant_id, location_id, kind, quantity,
    recorded_by_staff_id, idempotency_key
  ) values (
    p_retailer_id, p_variant_id, p_from_location_id, 'transfer_out', p_quantity,
    p_recorded_by_staff_id, 'transfer-out:' || p_operation_id::text
  ) returning id into v_out_id;

  insert into public.stock_ledger_entries (
    retailer_id, variant_id, location_id, kind, quantity,
    recorded_by_staff_id, idempotency_key
  ) values (
    p_retailer_id, p_variant_id, p_to_location_id, 'transfer_in', p_quantity,
    p_recorded_by_staff_id, 'transfer-in:' || p_operation_id::text
  ) returning id into v_in_id;

  return jsonb_build_object(
    'ok', true, 'outId', v_out_id, 'inId', v_in_id, 'replayed', false
  );
end;
$$;

create or replace function public.reverse_stock_entry_atomic(
  p_retailer_id uuid,
  p_entry_id uuid,
  p_recorded_by_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.stock_ledger_entries%rowtype;
  v_id uuid;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_original
  from public.stock_ledger_entries
  where id = p_entry_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Ledger entry not found' using errcode = 'P0002';
  end if;

  select id into v_id
  from public.stock_ledger_entries
  where retailer_id = p_retailer_id and reverses_entry_id = p_entry_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'replayed', true);
  end if;

  insert into public.stock_ledger_entries (
    retailer_id, variant_id, location_id, kind, quantity,
    reverses_entry_id, recorded_by_staff_id, idempotency_key
  ) values (
    p_retailer_id, v_original.variant_id, v_original.location_id,
    'reversal', v_original.quantity, v_original.id,
    p_recorded_by_staff_id, 'reversal:' || v_original.id::text
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'replayed', false);
end;
$$;

create or replace function public.add_pos_line_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_location_id uuid,
  p_kind text,
  p_quantity integer,
  p_unit_price_minor_units integer,
  p_variant_id uuid default null,
  p_currency text default 'EUR'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_line_id uuid := gen_random_uuid();
  v_reservation jsonb;
  v_reservation_id uuid;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.location_id <> p_location_id then
    raise foreign_key_violation using message = 'POS location does not belong to the transaction.';
  end if;
  if v_transaction.state <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'transition_not_allowed');
  end if;
  if p_kind not in ('rtw', 'alteration_service', 'mtm') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_line_kind');
  end if;
  if p_quantity <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'quantity_not_positive');
  end if;
  if p_unit_price_minor_units < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_price');
  end if;
  if p_kind = 'rtw' and p_variant_id is null then
    return jsonb_build_object('ok', false, 'reason', 'rtw_line_needs_variant');
  end if;

  if p_kind = 'rtw' then
    v_reservation := public.reserve_stock_atomic(
      p_retailer_id, p_variant_id, p_location_id, p_quantity, null,
      'pos-reservation:' || v_line_id::text
    );
    if not (v_reservation ->> 'ok')::boolean then
      return v_reservation;
    end if;
    v_reservation_id := (v_reservation ->> 'id')::uuid;
  end if;

  insert into public.pos_transaction_lines (
    id, retailer_id, transaction_id, kind, variant_id, quantity,
    unit_price_minor_units, currency, reservation_entry_id
  ) values (
    v_line_id, p_retailer_id, p_transaction_id, p_kind, p_variant_id,
    p_quantity, p_unit_price_minor_units, p_currency, v_reservation_id
  );

  return jsonb_build_object('ok', true, 'lineId', v_line_id);
end;
$$;

create or replace function public.record_pos_payment_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_provider text,
  p_provider_reference text,
  p_amount_minor_units integer,
  p_currency text default 'EUR'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_expected bigint;
  v_existing public.pos_payments%rowtype;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.state in ('completed', 'voided') then
    return jsonb_build_object('ok', false, 'reason', 'completed_is_final');
  end if;

  select coalesce(sum(quantity * unit_price_minor_units), 0) into v_expected
  from public.pos_transaction_lines
  where retailer_id = p_retailer_id
    and transaction_id = p_transaction_id
    and returns_line_id is null;
  if p_amount_minor_units <> v_expected then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;

  select * into v_existing
  from public.pos_payments
  where retailer_id = p_retailer_id
    and provider = p_provider
    and provider_reference = p_provider_reference;
  if found then
    if v_existing.transaction_id = p_transaction_id
      and v_existing.amount_minor_units = p_amount_minor_units
      and v_existing.currency = p_currency then
      return jsonb_build_object('ok', true, 'replayed', true);
    end if;
    return jsonb_build_object(
      'ok', false, 'reason', 'provider_reference_conflict'
    );
  end if;

  insert into public.pos_payments (
    retailer_id, transaction_id, provider, provider_reference,
    amount_minor_units, currency
  ) values (
    p_retailer_id, p_transaction_id, p_provider,
    p_provider_reference, p_amount_minor_units, p_currency
  );
  return jsonb_build_object('ok', true, 'replayed', false);
end;
$$;

create or replace function public.complete_pos_sale_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_location_id uuid,
  p_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_line record;
  v_line_count integer;
  v_expected bigint;
  v_captured bigint;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.location_id <> p_location_id then
    raise foreign_key_violation using message = 'POS location does not belong to the transaction.';
  end if;
  if v_transaction.state = 'voided' then
    return jsonb_build_object('ok', false, 'reason', 'not_presented_for_payment');
  end if;

  select count(*), coalesce(sum(quantity * unit_price_minor_units), 0)
    into v_line_count, v_expected
  from public.pos_transaction_lines
  where retailer_id = p_retailer_id
    and transaction_id = p_transaction_id
    and returns_line_id is null;
  if v_line_count = 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_sell');
  end if;

  select coalesce(sum(amount_minor_units), 0) into v_captured
  from public.pos_payments
  where retailer_id = p_retailer_id and transaction_id = p_transaction_id;
  if v_captured < v_expected then
    return jsonb_build_object('ok', false, 'reason', 'payment_incomplete');
  end if;

  for v_line in
    select id, variant_id, quantity, reservation_entry_id
    from public.pos_transaction_lines
    where retailer_id = p_retailer_id
      and transaction_id = p_transaction_id
      and kind = 'rtw'
      and returns_line_id is null
    order by id
  loop
    if v_line.reservation_entry_id is null then
      return jsonb_build_object(
        'ok', false, 'reason', 'stock_reservation_missing'
      );
    end if;
    perform pg_advisory_xact_lock(hashtextextended(
      p_retailer_id::text || ':' || v_line.variant_id::text || ':' || p_location_id::text,
      0
    ));
    insert into public.stock_ledger_entries (
      retailer_id, variant_id, location_id, kind, quantity,
      recorded_by_staff_id, idempotency_key
    ) values (
      p_retailer_id, v_line.variant_id, p_location_id,
      'reservation_release', v_line.quantity, p_staff_id,
      'pos-complete-release:' || p_transaction_id::text || ':' || v_line.id::text
    ) on conflict (retailer_id, idempotency_key) do nothing;

    insert into public.stock_ledger_entries (
      retailer_id, variant_id, location_id, kind, quantity,
      recorded_by_staff_id, idempotency_key
    ) values (
      p_retailer_id, v_line.variant_id, p_location_id,
      'sale', v_line.quantity, p_staff_id,
      'pos-complete-sale:' || p_transaction_id::text || ':' || v_line.id::text
    ) on conflict (retailer_id, idempotency_key) do nothing;
  end loop;

  if v_transaction.state <> 'completed' then
    perform set_config('paon.pos_atomic', 'on', true);
    update public.pos_transactions
    set state = 'awaiting_payment'
    where id = p_transaction_id and state <> 'awaiting_payment';
    update public.pos_transactions
    set state = 'completed', completed_at = now(), staff_id = coalesce(p_staff_id, staff_id)
    where id = p_transaction_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'replayed', v_transaction.state = 'completed'
  );
end;
$$;

create or replace function public.take_cash_and_complete_pos_sale_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_location_id uuid,
  p_staff_id uuid default null,
  p_currency text default 'EUR'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_expected bigint;
  v_captured bigint;
  v_cash_amount bigint;
  v_existing_cash bigint;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.location_id <> p_location_id then
    raise foreign_key_violation using message = 'POS location does not belong to the transaction.';
  end if;
  if v_transaction.state = 'completed' then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  if v_transaction.state = 'voided' then
    return jsonb_build_object('ok', false, 'reason', 'not_presented_for_payment');
  end if;

  select coalesce(sum(quantity * unit_price_minor_units), 0) into v_expected
  from public.pos_transaction_lines
  where retailer_id = p_retailer_id
    and transaction_id = p_transaction_id
    and returns_line_id is null;
  if v_expected <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_sell');
  end if;

  select coalesce(sum(amount_minor_units), 0) into v_captured
  from public.pos_payments
  where retailer_id = p_retailer_id and transaction_id = p_transaction_id;
  v_cash_amount := greatest(v_expected - v_captured, 0);

  select amount_minor_units into v_existing_cash
  from public.pos_payments
  where retailer_id = p_retailer_id
    and provider = 'cash'
    and provider_reference = 'cash:' || p_transaction_id::text;

  if v_cash_amount > 0 and v_existing_cash is null then
    insert into public.pos_payments (
      retailer_id, transaction_id, provider, provider_reference,
      amount_minor_units, currency
    ) values (
      p_retailer_id, p_transaction_id, 'cash',
      'cash:' || p_transaction_id::text, v_cash_amount, p_currency
    );
  elsif v_cash_amount > 0 then
    return jsonb_build_object('ok', false, 'reason', 'payment_incomplete');
  end if;

  return public.complete_pos_sale_atomic(
    p_retailer_id, p_transaction_id, p_location_id, p_staff_id
  );
end;
$$;

create or replace function public.void_pos_transaction_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_location_id uuid,
  p_void_reason text,
  p_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_line record;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.location_id <> p_location_id then
    raise foreign_key_violation using message = 'POS location does not belong to the transaction.';
  end if;
  if v_transaction.state = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'completed_is_final');
  end if;
  if v_transaction.state = 'voided' then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  if char_length(btrim(coalesce(p_void_reason, ''))) < 5 then
    return jsonb_build_object('ok', false, 'reason', 'void_requires_reason');
  end if;

  for v_line in
    select id, variant_id, quantity
    from public.pos_transaction_lines
    where retailer_id = p_retailer_id
      and transaction_id = p_transaction_id
      and kind = 'rtw'
      and returns_line_id is null
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      p_retailer_id::text || ':' || v_line.variant_id::text || ':' || p_location_id::text,
      0
    ));
    insert into public.stock_ledger_entries (
      retailer_id, variant_id, location_id, kind, quantity,
      recorded_by_staff_id, idempotency_key
    ) values (
      p_retailer_id, v_line.variant_id, p_location_id,
      'reservation_release', v_line.quantity, p_staff_id,
      'pos-void-release:' || p_transaction_id::text || ':' || v_line.id::text
    ) on conflict (retailer_id, idempotency_key) do nothing;
  end loop;

  perform set_config('paon.pos_atomic', 'on', true);
  update public.pos_transactions
  set state = 'voided', void_reason = btrim(p_void_reason)
  where id = p_transaction_id;
  return jsonb_build_object('ok', true, 'replayed', false);
end;
$$;

create or replace function public.return_pos_line_atomic(
  p_retailer_id uuid,
  p_transaction_id uuid,
  p_location_id uuid,
  p_line_id uuid,
  p_requested_on timestamptz,
  p_staff_id uuid default null,
  p_service_performed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.pos_transactions%rowtype;
  v_line public.pos_transaction_lines%rowtype;
  v_existing_return public.pos_transaction_lines%rowtype;
  v_return_transaction_id uuid := gen_random_uuid();
  v_return_line_id uuid := gen_random_uuid();
  v_remaining integer;
  v_refund bigint;
  v_restocked integer := 0;
begin
  perform public.assert_pos_actor(p_retailer_id);
  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id and retailer_id = p_retailer_id
  for update;
  if not found or v_transaction.state <> 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'not_from_completed_sale');
  end if;
  if v_transaction.location_id <> p_location_id then
    raise foreign_key_violation using message = 'POS location does not belong to the transaction.';
  end if;

  select * into v_line
  from public.pos_transaction_lines
  where id = p_line_id
    and retailer_id = p_retailer_id
    and transaction_id = p_transaction_id
    and returns_line_id is null
  for update;
  if not found then
    raise exception 'Line not found' using errcode = 'P0002';
  end if;

  select * into v_existing_return
  from public.pos_transaction_lines
  where retailer_id = p_retailer_id and returns_line_id = p_line_id;
  if found then
    return jsonb_build_object(
      'ok', true,
      'returnTransactionId', v_existing_return.transaction_id,
      'refundMinorUnits', abs(v_existing_return.quantity) * v_existing_return.unit_price_minor_units,
      'restocked', case when v_existing_return.kind = 'rtw' then abs(v_existing_return.quantity) else 0 end,
      'replayed', true
    );
  end if;

  if v_line.returned_quantity >= abs(v_line.quantity) then
    return jsonb_build_object('ok', false, 'reason', 'already_returned');
  end if;
  if v_line.kind = 'mtm' then
    return jsonb_build_object('ok', false, 'reason', 'mtm_is_bespoke');
  end if;
  if v_line.kind = 'alteration_service' and p_service_performed then
    return jsonb_build_object('ok', false, 'reason', 'service_already_performed');
  end if;
  if v_line.kind = 'rtw'
    and p_requested_on > coalesce(v_transaction.completed_at, v_transaction.created_at) + interval '30 days' then
    return jsonb_build_object('ok', false, 'reason', 'window_expired');
  end if;

  v_remaining := abs(v_line.quantity) - v_line.returned_quantity;
  v_refund := v_remaining * v_line.unit_price_minor_units;

  insert into public.pos_transactions (
    id, retailer_id, location_id, staff_id, state,
    completed_at, returns_transaction_id
  ) values (
    v_return_transaction_id, p_retailer_id, p_location_id, p_staff_id,
    'completed', now(), p_transaction_id
  );

  insert into public.pos_transaction_lines (
    id, retailer_id, transaction_id, kind, variant_id, alteration_id,
    production_spec_id, quantity, unit_price_minor_units, currency,
    returns_line_id
  ) values (
    v_return_line_id, p_retailer_id, v_return_transaction_id, v_line.kind,
    v_line.variant_id, v_line.alteration_id, v_line.production_spec_id,
    -v_remaining, v_line.unit_price_minor_units, v_line.currency, p_line_id
  );

  if v_line.kind = 'rtw' then
    perform pg_advisory_xact_lock(hashtextextended(
      p_retailer_id::text || ':' || v_line.variant_id::text || ':' || p_location_id::text,
      0
    ));
    insert into public.stock_ledger_entries (
      retailer_id, variant_id, location_id, kind, quantity,
      recorded_by_staff_id, idempotency_key, reason
    ) values (
      p_retailer_id, v_line.variant_id, p_location_id, 'receipt', v_remaining,
      p_staff_id, 'pos-return-restock:' || p_line_id::text,
      'Returned goods placed back into sellable stock.'
    ) on conflict (retailer_id, idempotency_key) do nothing;
    v_restocked := v_remaining;
  end if;

  perform set_config('paon.pos_atomic', 'on', true);
  update public.pos_transaction_lines
  set returned_quantity = returned_quantity + v_remaining
  where id = p_line_id;

  return jsonb_build_object(
    'ok', true,
    'returnTransactionId', v_return_transaction_id,
    'refundMinorUnits', v_refund,
    'restocked', v_restocked,
    'replayed', false
  );
end;
$$;

create or replace function public.enforce_pos_finality()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.state in ('completed', 'voided') then
    raise check_violation using
      message = 'A completed or voided POS transaction is immutable.';
  end if;

  if new.state in ('completed', 'voided')
    and coalesce(current_setting('paon.pos_atomic', true), 'off') <> 'on' then
    raise check_violation using
      message = 'Final POS state must be reached through its atomic operation.';
  end if;

  if new.state <> old.state and not (
    (old.state = 'open' and new.state in ('suspended', 'quoted', 'awaiting_payment', 'voided'))
    or (old.state = 'suspended' and new.state in ('open', 'voided'))
    or (old.state = 'quoted' and new.state in ('open', 'awaiting_payment', 'voided'))
    or (old.state = 'awaiting_payment' and new.state in ('open', 'completed', 'voided'))
  ) then
    raise check_violation using message = 'Invalid POS transaction transition.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pos_finality on public.pos_transactions;
create trigger enforce_pos_finality
  before update on public.pos_transactions
  for each row execute function public.enforce_pos_finality();

create or replace function public.enforce_pos_line_finality()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise check_violation using message = 'POS lines are never deleted.';
  end if;
  if coalesce(current_setting('paon.pos_atomic', true), 'off') <> 'on' then
    raise check_violation using
      message = 'POS line changes must use an atomic operation.';
  end if;
  if new.id <> old.id
    or new.retailer_id <> old.retailer_id
    or new.transaction_id <> old.transaction_id
    or new.kind <> old.kind
    or new.variant_id is distinct from old.variant_id
    or new.alteration_id is distinct from old.alteration_id
    or new.production_spec_id is distinct from old.production_spec_id
    or new.quantity <> old.quantity
    or new.unit_price_minor_units <> old.unit_price_minor_units
    or new.currency <> old.currency
    or new.reservation_entry_id is distinct from old.reservation_entry_id
    or new.returns_line_id is distinct from old.returns_line_id then
    raise check_violation using message = 'POS line commercial facts are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pos_line_finality on public.pos_transaction_lines;
create trigger enforce_pos_line_finality
  before update or delete on public.pos_transaction_lines
  for each row execute function public.enforce_pos_line_finality();

revoke insert, update, delete on table public.pos_transaction_lines
  from authenticated;
revoke insert, update, delete on table public.pos_payments
  from authenticated;

-- Only the aggregate RPCs are Data API operations. Their helper routines
-- are callable by the owner during nested execution but not exposed as RPCs.
revoke all on function public.assert_pos_actor(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.stock_available_at(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.stock_available_at(uuid, uuid, uuid)
  to service_role;

revoke all on function public.reserve_stock_atomic(uuid, uuid, uuid, integer, uuid, text)
  from public, anon;
grant execute on function public.reserve_stock_atomic(uuid, uuid, uuid, integer, uuid, text)
  to authenticated, service_role;
revoke all on function public.transfer_stock_atomic(uuid, uuid, uuid, uuid, integer, uuid, uuid)
  from public, anon;
grant execute on function public.transfer_stock_atomic(uuid, uuid, uuid, uuid, integer, uuid, uuid)
  to authenticated, service_role;
revoke all on function public.reverse_stock_entry_atomic(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.reverse_stock_entry_atomic(uuid, uuid, uuid)
  to authenticated, service_role;
revoke all on function public.add_pos_line_atomic(uuid, uuid, uuid, text, integer, integer, uuid, text)
  from public, anon;
grant execute on function public.add_pos_line_atomic(uuid, uuid, uuid, text, integer, integer, uuid, text)
  to authenticated, service_role;
revoke all on function public.record_pos_payment_atomic(uuid, uuid, text, text, integer, text)
  from public, anon;
grant execute on function public.record_pos_payment_atomic(uuid, uuid, text, text, integer, text)
  to authenticated, service_role;
revoke all on function public.complete_pos_sale_atomic(uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.complete_pos_sale_atomic(uuid, uuid, uuid, uuid)
  to authenticated, service_role;
revoke all on function public.take_cash_and_complete_pos_sale_atomic(uuid, uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.take_cash_and_complete_pos_sale_atomic(uuid, uuid, uuid, uuid, text)
  to authenticated, service_role;
revoke all on function public.void_pos_transaction_atomic(uuid, uuid, uuid, text, uuid)
  from public, anon;
grant execute on function public.void_pos_transaction_atomic(uuid, uuid, uuid, text, uuid)
  to authenticated, service_role;
revoke all on function public.return_pos_line_atomic(uuid, uuid, uuid, uuid, timestamptz, uuid, boolean)
  from public, anon;
grant execute on function public.return_pos_line_atomic(uuid, uuid, uuid, uuid, timestamptz, uuid, boolean)
  to authenticated, service_role;
revoke all on function public.enforce_pos_finality()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_pos_line_finality()
  from public, anon, authenticated, service_role;

comment on function public.take_cash_and_complete_pos_sale_atomic(uuid, uuid, uuid, uuid, text) is
  'R0.2 atomic cash tender: payment, transaction finality, reservation release and sale movements commit or roll back together. Cash activation remains subject to the founder-commercial policy ADR.';
