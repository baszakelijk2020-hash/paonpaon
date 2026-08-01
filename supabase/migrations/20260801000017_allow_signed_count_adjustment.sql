-- PHASE 13.1 gap found while writing StockLedgerRepository: a stock
-- SHORTFALL could not be recorded at all.
--
-- `stock_ledger_entries` declared `check (quantity > 0)` for every kind, and
-- the domain's sign table maps `count_adjustment` to +1. So an adjustment
-- could only ever ADD stock. A blind count that finds eight jackets where
-- the ledger expected ten — the single most common real outcome of counting
-- — had nowhere to go. The reconciliation reported the variance correctly
-- and then the adjustment insert would have died on the CHECK.
--
-- Found by writing the repository, not by any unit test: `projectBalance`
-- and `reconcileBlindCount` are both happy with negative variances, and the
-- schema test asserted the CHECK existed rather than asking whether it was
-- the right CHECK.
--
-- The fix keeps positive-quantity-plus-signed-kind for every movement kind,
-- because that is what makes a receipt unambiguous, and allows a signed
-- quantity for `count_adjustment` alone. `projectBalance` already multiplies
-- quantity by the kind's sign, so a negative count_adjustment decreases
-- on-hand with no domain change at all.
--
-- Zero is still refused everywhere: an adjustment of nothing is not a
-- correction, it is noise in an append-only ledger.

alter table public.stock_ledger_entries
  drop constraint if exists stock_ledger_entries_quantity_check;

alter table public.stock_ledger_entries
  add constraint stock_ledger_entries_quantity_check
  check (
    case
      -- A count adjustment may go either way: found more, or found fewer.
      when kind = 'count_adjustment' then quantity <> 0
      -- Every other kind carries its direction in the kind itself, so a
      -- negative quantity there would double-encode the sign and make
      -- "receipt of -3" expressible. It must not be.
      else quantity > 0
    end
  );

comment on constraint stock_ledger_entries_quantity_check
  on public.stock_ledger_entries is
  'count_adjustment may be signed so a shortfall is recordable; every other '
  'kind carries direction in the kind and must stay positive.';
