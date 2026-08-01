-- Ends the second truth about stock.
--
-- Before this migration two independent systems decremented stock and
-- neither could see the other:
--
--   1. `place_order` and `checkout_cart` did
--      `update product_variants set inventory_quantity = inventory_quantity - qty`,
--      guarded by their own `inventory_quantity < qty` check.
--   2. Stage 13.1's `stock_ledger_entries` recorded receipts, reservations,
--      sales and counts, and every till and stock screen read its projection.
--
-- So a garment sold online never reduced the ledger, and the till would
-- happily promise it again; a garment sold at the till never reduced
-- `inventory_quantity`, and the storefront would happily sell it again. Both
-- directions are a real oversell, and both screens looked correct while it
-- happened. That is precisely the failure the append-only ledger exists to
-- prevent, and it was live.
--
-- After this migration there is ONE writer of stock truth — the ledger — and
-- `inventory_quantity` is a maintained projection of it. The column stays
-- because 28 files read it (storefront, tie-mate, low-stock export, for-you,
-- morning routine); it just stops being independently authoritative.
--
-- The projection caches AVAILABLE, not on-hand. A garment held for a client
-- at the till must not be sellable online, and on-hand says yes to both.

-- ── 1. The ledger's own projection, in SQL ──────────────────────────────
-- Mirrors packages/domain's `projectBalance` exactly, including that a
-- reversal inverts the entry it cites (so it cannot be mis-signed) and that
-- duplicate idempotency keys collapse. Two different definitions of the same
-- balance is how the divergence this migration removes got started.
create or replace function public.variant_ledger_balance(p_variant_id uuid)
returns table (on_hand integer, reserved integer, available integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with deduped as (
    -- A replayed webhook arriving during a partition must not double count.
    select distinct on (coalesce(idempotency_key, id::text))
      id, kind, quantity, reverses_entry_id, occurred_at
    from public.stock_ledger_entries
    where variant_id = p_variant_id
    order by coalesce(idempotency_key, id::text), occurred_at, id
  ),
  signed as (
    select
      case d.kind
        when 'receipt' then d.quantity
        when 'transfer_in' then d.quantity
        when 'sale' then -d.quantity
        when 'transfer_out' then -d.quantity
        when 'count_adjustment' then d.quantity
        when 'reversal' then
          -- Invert whatever the cited entry did.
          -1 * coalesce((
            select case o.kind
              when 'receipt' then o.quantity
              when 'transfer_in' then o.quantity
              when 'sale' then -o.quantity
              when 'transfer_out' then -o.quantity
              when 'count_adjustment' then o.quantity
              else 0
            end
            from public.stock_ledger_entries o
            where o.id = d.reverses_entry_id
          ), 0)
        else 0
      end as on_hand_delta,
      case d.kind
        when 'reservation' then d.quantity
        when 'reservation_release' then -d.quantity
        when 'reversal' then
          -1 * coalesce((
            select case o.kind
              when 'reservation' then o.quantity
              when 'reservation_release' then -o.quantity
              else 0
            end
            from public.stock_ledger_entries o
            where o.id = d.reverses_entry_id
          ), 0)
        else 0
      end as reserved_delta
    from deduped d
  )
  select
    coalesce(sum(on_hand_delta), 0)::integer,
    coalesce(sum(reserved_delta), 0)::integer,
    (coalesce(sum(on_hand_delta), 0) - coalesce(sum(reserved_delta), 0))::integer
  from signed;
$$;

comment on function public.variant_ledger_balance(uuid) is
  'On-hand, reserved and available for a variant across every location, projected from the append-only ledger. The SQL twin of packages/domain projectBalance.';

-- ── 2. Every retailer needs somewhere online orders draw from ───────────
-- An online sale has no till. Without a named location it could not be
-- recorded in the ledger at all, which is the reason the two systems were
-- allowed to drift in the first place.
create or replace function public.retailer_online_location(p_retailer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.stock_locations
  where retailer_id = p_retailer_id and code = 'ONLINE'
  limit 1;

  if v_id is null then
    insert into public.stock_locations (retailer_id, code, name, active)
    values (p_retailer_id, 'ONLINE', 'Online orders', true)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.retailer_online_location(uuid) is
  'The fulfilment location online orders draw from, created on first use. Gives a webshop sale a place in the ledger so it stops being invisible to the shop floor.';

-- ── 2a. Refuse to erase a disagreement during an upgrade ───────────────
-- A database that already used the Stage 13 ledger can contain both an old
-- catalogue quantity and ledger history. If those disagree, choosing either
-- value automatically destroys information. Stop before the backfill or the
-- reconciliation UPDATE changes a single row; the restored-copy rehearsal
-- must resolve the discrepancy deliberately and rerun the migration.
do $$
declare
  v_conflict_count integer;
begin
  select count(*)::integer into v_conflict_count
  from public.product_variants pv
  cross join lateral public.variant_ledger_balance(pv.id) b
  where pv.deleted_at is null
    and exists (
      select 1
      from public.stock_ledger_entries e
      where e.variant_id = pv.id
    )
    and pv.inventory_quantity is distinct from greatest(b.available, 0);

  if v_conflict_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Inventory single-truth upgrade blocked: %s variant(s) disagree with their ledger balance.',
        v_conflict_count
      ),
      hint = 'Inspect product_variants against variant_ledger_balance on a restored copy and reconcile each discrepancy before retrying.';
  end if;
end $$;

-- ── 3. Carry the catalogue figure into the ledger as an opening balance ──
-- 1896 units across 77 variants existed only as `inventory_quantity`. If the
-- column became a projection without this, every one of them would read as
-- zero and the storefront would refuse every order. The opening receipt says
-- where the number came from, so a later variance is still explicable.
do $$
declare
  v record;
  v_location uuid;
begin
  for v in
    select pv.id, pv.inventory_quantity, p.retailer_id
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.deleted_at is null
      and pv.inventory_quantity > 0
      and not exists (
        select 1 from public.stock_ledger_entries e where e.variant_id = pv.id
      )
  loop
    v_location := public.retailer_online_location(v.retailer_id);
    insert into public.stock_ledger_entries
      (retailer_id, variant_id, location_id, kind, quantity, reason, idempotency_key)
    values (
      v.retailer_id, v.id, v_location, 'receipt', v.inventory_quantity,
      'Opening balance carried over from the catalogue stock figure when the ledger became the single source of truth.',
      'opening-balance:' || v.id::text
    )
    on conflict do nothing;
  end loop;
end $$;

-- ── 4. The ledger now maintains the column ─────────────────────────────
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

  update public.product_variants
    -- Clamped at zero: `inventory_quantity` carries a `>= 0` check and an
    -- oversold shop genuinely has negative availability. Clamping keeps the
    -- cache honest for its only job — refusing further sales — while the
    -- true signed figure stays in the ledger, where the stock screen reads
    -- it and says "oversold" out loud.
    set inventory_quantity = greatest(coalesce(v_available, 0), 0)
    where id = v_variant
      and inventory_quantity is distinct from greatest(coalesce(v_available, 0), 0);

  return null;
end;
$$;

drop trigger if exists sync_variant_inventory on public.stock_ledger_entries;
create trigger sync_variant_inventory
  after insert on public.stock_ledger_entries
  for each row execute function public.sync_variant_inventory_from_ledger();

comment on function public.sync_variant_inventory_from_ledger() is
  'Keeps product_variants.inventory_quantity equal to the ledger available figure. The column is a cache; appending to the ledger is the only way to change stock.';

-- Reconcile every variant that already had ledger entries, so the column and
-- the ledger agree from this moment rather than from the next movement.
update public.product_variants pv
set inventory_quantity = greatest(b.available, 0)
from (
  select e.variant_id, (public.variant_ledger_balance(e.variant_id)).available as available
  from (select distinct variant_id from public.stock_ledger_entries) e
) b
where pv.id = b.variant_id
  and pv.inventory_quantity is distinct from greatest(b.available, 0);
