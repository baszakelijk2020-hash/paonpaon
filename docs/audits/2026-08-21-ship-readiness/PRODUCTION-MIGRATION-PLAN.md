# Production Migration Plan — Blocker 1 (customer app HTTP 500)

## Root cause (verified directly against production, 2026-08-21)

Confirmed by reading the production Supabase dashboard directly
(`hngxrczavwywsnfceppb`, org "nguyen", region `ap-southeast-2` / Oceania
(Sydney)), Database → Migrations:

**Production's last applied migration is `20260729000002`
(`founder_outreach_pack`, 2026-07-29 00:00:02).**

The repository currently has **250 migration files**. Comparing
timestamps, **161 migrations are missing from production** — everything
from `20260729174939_create_metadata_foundation.sql` (which creates
`entity_metadata_assignments`) through this session's own
`20260821000000_create_error_events.sql`. That is not a single missing
table — it is roughly three weeks of accumulated schema history
(2026-07-29 17:49 through 2026-08-21) that production has never received.
The original blocker description ("missing `entity_metadata_assignments`")
undersold the actual gap.

Every deployed app expects `entity_metadata_assignments` specifically
(see `packages/database/src/repositories/metadata-repository.ts` and the
`publish_catalogue_import_row()` / `sync_loyalty_milestones_for_order()`
functions), so `https://paonpaon-customer.vercel.app/r/maison-dubois`
returns HTTP 500 the moment it touches that table — but the same request
could just as easily fail on any of the other 160 missing migrations'
objects if a different code path executes.

## Why this is not "just run the migrations"

Two independent, pre-existing safety rails already block that, and this
plan does not attempt to route around either of them:

1. **`docs/ENVIRONMENTS.md`** (2026-08-02): "The original PAON project is
   on an older schema and must not receive the migration chain until an
   approved restore of its actual data proves row counts, backfills,
   stock, money, RLS and rollback/recovery." No such restore has happened.
2. **`@paon/database`'s mechanical guard** (`environment-safety.ts`)
   hard-denies the original PAON ref for any `PAON_INTEGRATION=1` or
   Playwright write target, "even if someone mistakenly adds it" to the
   disposable-refs allowlist. This is defense in depth, not a formality.

Additionally: production migration application is documented as
**founder-only, manual**, via `supabase db push --linked` (ADR-044) — not
part of CI/CD (`.github/workflows/ci.yml` runs lint/typecheck/test/build
only, no migration step). This agent's Supabase CLI session is also
unauthenticated in this environment (`supabase migration list --linked`
→ 401), so it has no technical ability to push to production even if the
safety rails above were satisfied.

**Conclusion: the actual production migration push cannot be performed in
this session. It requires the founder to (a) obtain and restore an actual
production backup into a rehearsal target, (b) run the rehearsal proof
below against that restored copy, and (c) then personally run
`supabase db push --linked` from an authenticated session.** What follows
is that procedure, made concrete, plus what has already been rehearsed on
synthetic data.

## What has been rehearsed (this session, 2026-08-21)

Against **local disposable Supabase only** (`http://127.0.0.1:54321`,
never the original ref):

1. `supabase db reset` — applied the full current migration chain (249
   files, ending in `20260821000000_create_error_events.sql`) to a fresh
   database from empty. **Result: clean, zero errors.** This is
   clean-database proof only, matching the caveat already on record in
   ENVIRONMENTS.md — it does not prove behavior against production's
   actual pre-2026-07-29 data shape.
2. `supabase gen types typescript --local` regenerated
   `packages/database/src/generated/database.types.ts` against that
   schema; a full monorepo `pnpm -w typecheck` (12/12 packages) passed
   against the regenerated types — confirming application code and
   current schema agree.
3. `docs/runbooks/STOCK_UPGRADE_REHEARSAL.md` already documents an
   earlier, more targeted rehearsal (conflict path + clean path) proving
   migration 18's stock single-truth upgrade against a synthetic
   populated fixture, not just an empty database. That rehearsal is
   still valid and unchanged by this session's work.

Neither of these substitutes for the "approved restore of actual data"
gate. They are the synthetic/clean-database half of the proof; the
original-data half remains blocked on backup access.

## Required procedure (once a restored copy is available)

### Phase 0 — Preconditions (founder-only)

- [ ] Obtain a Supabase-native backup/restore of the production project
      (`hngxrczavwywsnfceppb`) — via Supabase's dashboard "Backups"
      feature (point-in-time or daily, depending on plan tier) or
      `pg_dump` against a read replica/direct connection if backups
      aren't enabled. **If no backup mechanism is currently enabled on
      this project, enabling one is itself a prerequisite** — see
      `DEPLOYMENT-RECOVERY-RUNBOOK.md` for what to check.
- [ ] Restore that backup into a **new, disposable** Supabase project (not
      local, not the original ref) — this becomes the rehearsal target.
      Register it in `PAON_DISPOSABLE_SUPABASE_REFS` only for the
      duration of the rehearsal.

### Phase 1 — Rehearsal against restored data

- [ ] Run `supabase migration list` against the restored copy; record the
      exact local/remote divergence (which migrations are missing —
      expected to start at `20260729174939_create_metadata_foundation.sql`
      and run through the current tip).
- [ ] Run `supabase db push` against the restored copy (not `--linked` —
      point explicitly at the disposable rehearsal project).
- [ ] Verify row counts for every production-critical table
      (`retailers`, `orders`, `customers`, stock/ledger tables, payment
      records) match pre- and post-migration. Any unexplained delta is a
      stop-ship finding, not a warning.
- [ ] Repeat the stock single-truth conflict/clean paths from
      `STOCK_UPGRADE_REHEARSAL.md` against this restored copy specifically
      — the synthetic fixture proves the migration's logic; this step
      proves it against the real data shape.
- [ ] Run RLS spot-checks: confirm a retailer-scoped query still returns
      only that retailer's rows post-migration (tenancy did not silently
      widen).
- [ ] Smoke-test the deployed application code (a preview Vercel
      deployment pointed at the restored-and-migrated copy, not
      production) against `/r/maison-dubois` and the other critical
      routes listed below.

### Phase 2 — Production push (founder-only, manual)

- [ ] Confirm Phase 1 evidence is recorded and reviewed.
- [ ] Take a fresh backup of production immediately before the push
      (belt-and-suspenders, even if Phase 0's backup is recent).
- [ ] Founder runs `supabase db push --linked` from an authenticated CLI
      session against `hngxrczavwywsnfceppb`.
- [ ] If the push fails partway: **stop.** Do not attempt to manually
      patch forward. Follow `DEPLOYMENT-RECOVERY-RUNBOOK.md`'s recovery
      section — this migration chain has additive-only changes to
      `entity_metadata_assignments` and its dependents (confirmed by this
      session's investigation: every migration touching that table is
      `CREATE`/`GRANT`/function-replace, never `DROP COLUMN` or
      `ALTER ... TYPE` on existing data), so a partial-apply failure is
      recoverable by re-running the remaining migrations once the cause
      is fixed — but confirm this against the actual failing migration
      before assuming it, and do not assume for any migration outside
      that specific chain without checking it directly.

### Phase 3 — Post-migration verification (this agent can perform once

migrations are applied and it is told to)

- [ ] `/r/maison-dubois` returns 200, not 500.
- [ ] Customer authentication, profile, dashboard load.
- [ ] Retailer login and admin/owner dashboard load.
- [ ] `error_events` (from Blocker 2) accepts a row — proves the new
      table + grants landed correctly, not just that the push "succeeded."
- [ ] All three `paonpaon-*` production apps' critical entry points
      return non-500 responses.
- [ ] Database connectivity and RPC calls used by the storefront
      (`publish_catalogue_import_row`, `sync_loyalty_milestones_for_order`,
      `review_metadata_assignment`) execute without error against
      representative data.

## Irreversibility statement

This plan does not claim a "down migration" capability. The migration
chain from `20260729174939` onward is additive (new tables, new grants,
new/replaced functions) as far as this investigation determined for the
`entity_metadata_assignments` lineage specifically — **this has not been
verified for the full 249-migration chain end to end**, only for the
migrations directly touching that table. Treat recovery as
**BACKUP → RESTORE**, not **MIGRATION → DOWN MIGRATION**, for any failure
this plan doesn't have a specific, verified answer for. See
`DEPLOYMENT-RECOVERY-RUNBOOK.md`.
