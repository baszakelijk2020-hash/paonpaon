-- One choke point for stock, instead of trusting 28 files to behave.
--
-- Migration 18 made `inventory_quantity` a projection of the ledger, but left
-- five writers still setting it directly: `place_order`, `checkout_cart`, the
-- catalogue importer, and the product create/edit forms. Any of them writing
-- the column now produces something worse than the old divergence — the next
-- ledger movement for that variant recomputes the column and SILENTLY UNDOES
-- their write. An online sale would reappear as stock.
--
-- Patching each caller would leave the next one free to get it wrong. Instead
-- the database converts a direct write into the ledger entry it should always
-- have been, so the column cannot be set to anything the ledger does not say.
-- Callers keep working unchanged; their intent is preserved and recorded.

-- ── The sync path identifies itself ─────────────────────────────────────
-- Without this the two triggers below call each other forever.
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
  select available into v_available
  from public.variant_ledger_balance(v_variant);

  -- Marks this update as coming FROM the ledger, so the guard on
  -- product_variants lets it through instead of trying to re-record it.
  perform set_config('paon.ledger_sync', 'on', true);

  update public.product_variants
    -- Clamped at zero: the column carries a `>= 0` check and an oversold
    -- shop genuinely has negative availability. Clamping keeps the cache
    -- honest for its only job — refusing further sales — while the true
    -- signed figure stays in the ledger, where the stock screen reads it and
    -- says "oversold" out loud.
    set inventory_quantity = greatest(coalesce(v_available, 0), 0)
    where id = v_variant
      and inventory_quantity is distinct from greatest(coalesce(v_available, 0), 0);

  perform set_config('paon.ledger_sync', 'off', true);
  return null;
end;
$$;

-- ── A direct write becomes a ledger movement ────────────────────────────
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
  -- The ledger is writing its own projection back. Nothing to record.
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

  -- A variant with no retailer cannot be placed in the ledger; leave the
  -- column alone rather than guess, and let the FK complain elsewhere.
  if v_retailer is null then
    return new;
  end if;

  v_location := public.retailer_online_location(v_retailer);

  -- Stock going UP is a receipt. Stock going DOWN is a sale: every existing
  -- caller that decrements does so because something was sold
  -- (`place_order`, `checkout_cart`). A correction made during a stock count
  -- goes through the count session path in the app, which writes
  -- `count_adjustment` directly and never touches this column.
  insert into public.stock_ledger_entries
    (retailer_id, variant_id, location_id, kind, quantity, reason)
  values (
    v_retailer,
    new.id,
    v_location,
    case when v_delta > 0 then 'receipt' else 'sale' end,
    abs(v_delta),
    case
      when v_delta > 0
        then 'Stock added by setting the catalogue quantity directly.'
      else 'Stock removed by setting the catalogue quantity directly, normally an online order.'
    end
  );

  -- Let the column land on what the ledger now says, so the caller's write
  -- and the ledger cannot disagree even for one statement. The AFTER trigger
  -- on the insert above already did this; recomputing here makes the value
  -- correct within THIS statement too.
  select available into v_available
  from public.variant_ledger_balance(new.id);
  new.inventory_quantity := greatest(coalesce(v_available, 0), 0);

  return new;
end;
$$;

comment on function public.record_direct_inventory_write() is
  'Converts a direct write to product_variants.inventory_quantity into the ledger entry it should have been, so no caller can set stock the ledger does not agree with.';

drop trigger if exists record_direct_inventory_write on public.product_variants;
create trigger record_direct_inventory_write
  before update of inventory_quantity on public.product_variants
  for each row execute function public.record_direct_inventory_write();

-- ── A new variant's opening stock enters the ledger too ─────────────────
-- The catalogue importer and the product form both INSERT a variant with a
-- starting quantity. Without this it is invisible to the ledger, and the
-- first movement of any kind would recompute the column down to that
-- movement alone.
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

  insert into public.stock_ledger_entries
    (retailer_id, variant_id, location_id, kind, quantity, reason, idempotency_key)
  values (
    v_retailer, new.id, v_location, 'receipt', new.inventory_quantity,
    'Opening stock recorded when the variant was created.',
    'opening-balance:' || new.id::text
  )
  on conflict do nothing;

  return null;
end;
$$;

comment on function public.record_new_variant_opening_stock() is
  'Gives a newly created variant an opening receipt, so its starting quantity exists in the ledger rather than only in the cached column.';

drop trigger if exists record_new_variant_opening_stock on public.product_variants;
create trigger record_new_variant_opening_stock
  after insert on public.product_variants
  for each row execute function public.record_new_variant_opening_stock();
