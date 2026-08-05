# Stock Single-Truth Upgrade Rehearsal

Use this only on disposable local Supabase or an approved restored copy. It
must never target the protected original project directly.

## What the rehearsal proves

- Migration 18 stops transactionally when an existing catalogue quantity and
  ledger balance disagree. Neither source is silently chosen.
- Variants without ledger history receive one idempotent opening receipt.
- Variants with matching ledger history retain it without a duplicate opening
  receipt.
- Migrations 18–22 and the R0.1 tenant hardening preserve projected quantity,
  leave `count_inventory_disagreements()` at zero and create no cross-tenant
  stock references.

The synthetic populated fixture is
`supabase/rehearsals/pre_stock_single_truth_upgrade.sql` — deliberately
outside `supabase/tests/` so `supabase test db`'s default recursive scan
never loads it (it has no `begin`/`rollback` wrapper by design, since a
rehearsal needs its rows to persist for inspection; loaded into the
pgTAP tree, its non-transactional inserts leaked into later test files
and collided with their own hardcoded fixture IDs).

## Local sequence

1. Reset only the disposable local stack to the last pre-projection migration:

   ```text
   supabase db reset --local --version 20260801000017 --no-seed --yes
   ```

2. Load the fixture with `psql` against the local DB URL printed by
   `supabase status`.
3. Conflict path: change `UP-A-TROUSER` from 2 to 5, run
   `supabase migration up --local`, and require migration 18 to abort with
   `Inventory single-truth upgrade blocked`. Verify the quantity is still 5,
   the original ledger row still exists and the migration function rolled
   back.
4. Clean path: repeat step 1, load the unchanged fixture, then run
   `supabase migration up --local`.
5. Require exact post-upgrade results:

   | SKU            | catalogue | ledger available | ledger rows | opening rows |
   | -------------- | --------: | ---------------: | ----------: | -----------: |
   | `UP-A-JACKET`  |         7 |                7 |           1 |            1 |
   | `UP-A-TROUSER` |         2 |                2 |           1 |            0 |
   | `UP-B-COAT`    |         3 |                3 |           1 |            1 |

6. Require zero from `count_inventory_disagreements()` and from a join that
   compares each ledger row's retailer with its location and product owner.
7. Restore the ordinary local stack with `supabase db reset --local --yes`
   before any other suite.

## Original-data gate

The synthetic rehearsal is necessary but not authorization to migrate the
original database. Obtain an approved backup/restore, run the conflict query
and the complete chain there, compare protected row counts and recovery, then
record the evidence before any hosted push.
