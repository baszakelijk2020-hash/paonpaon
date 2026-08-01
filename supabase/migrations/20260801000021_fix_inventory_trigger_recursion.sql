-- Fixes the recursion migration 19 introduced.
--
-- `record_direct_inventory_write` runs BEFORE UPDATE on product_variants and
-- inserts a ledger entry. That insert fired the ledger's AFTER trigger, which
-- updated the very row being updated, and Postgres refused the whole
-- statement:
--
--   27000: tuple to be updated was already modified by an operation
--          triggered by the current command
--
-- The effect was worse than a plain failure. supabase-js surfaces that as an
-- error object, so any caller not checking it — every existing caller — saw
-- its write vanish with no exception and no change. Stock edits became silent
-- no-ops.
--
-- The fix removes the nesting rather than working around it: the writer marks
-- the ledger insert as self-handled, computes the projection itself, and puts
-- the value straight into the row it is already writing. One statement, one
-- update, no trigger calling back into the table it was invoked from.

create or replace function public.sync_variant_inventory_from_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_variant uuid := coalesce(new.variant_id, old.variant_id);
  v_available integer;
begin
  -- The caller is a product_variants write that will set the column itself.
  -- Updating it from here would re-enter the row mid-statement.
  if coalesce(current_setting('paon.ledger_sync', true), 'off') = 'on' then
    return null;
  end if;

  select available into v_available
  from public.variant_ledger_balance(v_variant);

  perform set_config('paon.ledger_sync', 'on', true);

  update public.product_variants
    -- Clamped at zero: the column carries a `>= 0` check and an oversold shop
    -- genuinely has negative availability. Clamping keeps the cache honest for
    -- its only job — refusing further sales — while the true signed figure
    -- stays in the ledger, where the stock screen says "oversold" out loud.
    set inventory_quantity = greatest(coalesce(v_available, 0), 0)
    where id = v_variant
      and inventory_quantity is distinct from greatest(coalesce(v_available, 0), 0);

  perform set_config('paon.ledger_sync', 'off', true);
  return null;
end;
$$;

create or replace function public.record_direct_inventory_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old integer := coalesce(old.inventory_quantity, 0);
  v_new integer := coalesce(new.inventory_quantity, 0);
  v_delta integer;
  v_retailer uuid;
  v_location uuid;
  v_available integer;
begin
  if coalesce(current_setting('paon.ledger_sync', true), 'off') = 'on' then
    return new;
  end if;

  v_delta := v_new - v_old;
  if v_delta = 0 then
    return new;
  end if;

  select p.retailer_id into v_retailer
  from public.products p
  where p.id = new.product_id;
  if v_retailer is null then
    return new;
  end if;

  v_location := public.retailer_online_location(v_retailer);

  -- Self-handled: the ledger's AFTER trigger must not touch this row while
  -- this very statement is still writing it.
  perform set_config('paon.ledger_sync', 'on', true);

  -- Stock going UP is a receipt. Stock going DOWN is a sale: every caller
  -- that decrements does so because something was sold (`place_order`,
  -- `checkout_cart`). A correction found during a stock count goes through
  -- the count-session path instead, which writes `count_adjustment` and
  -- never touches this column.
  insert into public.stock_ledger_entries
    (retailer_id, variant_id, location_id, kind, quantity, reason)
  values (
    v_retailer, new.id, v_location,
    case when v_delta > 0 then 'receipt' else 'sale' end,
    abs(v_delta),
    case
      when v_delta > 0
        then 'Stock added by setting the catalogue quantity directly.'
      else 'Stock removed by setting the catalogue quantity directly, normally an online order.'
    end
  );

  select available into v_available
  from public.variant_ledger_balance(new.id);

  perform set_config('paon.ledger_sync', 'off', true);

  -- The row being written lands on what the ledger now says, so the caller's
  -- intent and the ledger cannot disagree even for one statement.
  new.inventory_quantity := greatest(coalesce(v_available, 0), 0);
  return new;
end;
$$;

create or replace function public.record_new_variant_opening_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retailer uuid;
  v_location uuid;
begin
  if coalesce(new.inventory_quantity, 0) <= 0 then
    return null;
  end if;
  if coalesce(current_setting('paon.ledger_sync', true), 'off') = 'on' then
    return null;
  end if;

  select p.retailer_id into v_retailer
  from public.products p
  where p.id = new.product_id;
  if v_retailer is null then
    return null;
  end if;

  v_location := public.retailer_online_location(v_retailer);

  -- The opening receipt equals the column that was just inserted, so the
  -- ledger's sync has nothing to change. Marking it self-handled keeps it
  -- from re-entering the freshly inserted row regardless.
  perform set_config('paon.ledger_sync', 'on', true);

  insert into public.stock_ledger_entries
    (retailer_id, variant_id, location_id, kind, quantity, reason, idempotency_key)
  values (
    v_retailer, new.id, v_location, 'receipt', new.inventory_quantity,
    'Opening stock recorded when the variant was created.',
    'opening-balance:' || new.id::text
  )
  on conflict do nothing;

  perform set_config('paon.ledger_sync', 'off', true);
  return null;
end;
$$;
