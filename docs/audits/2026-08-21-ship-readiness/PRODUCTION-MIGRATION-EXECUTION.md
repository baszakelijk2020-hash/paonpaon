# Production Migration Execution Runbook

**Status: NOT EXECUTED. This document specifies the procedure; it does
not authorize or perform it.** See `PAON-FINAL-RELEASE-CERTIFICATION.md`
and the founder-gate report for the current READY/NOT READY verdict.

Companion to `PRODUCTION-MIGRATION-PLAN.md` (root cause, why this isn't
a blind push) and `DEPLOYMENT-RECOVERY-RUNBOOK.md` (general procedure,
verified backup state). This document is the specific, exact-command
execution plan for the one migration push production actually needs
right now.

## Preflight checks

Run and record the output of every check below before touching anything.

1. **Confirm target.**

   ```
   supabase status
   supabase link --project-ref hngxrczavwywsnfceppb
   ```

   Confirm the linked project ref is exactly `hngxrczavwywsnfceppb`
   ("PAON", org "nguyen") — never any other ref, never the local stack.

2. **Confirm current remote migration state matches what this document
   assumes.**

   ```
   supabase migration list --linked
   ```

   Expected: remote's latest entry is `20260729000002`. If it is not —
   if anything has changed production's migration state since this
   document was written (2026-08-21) — **stop and re-derive this
   runbook**; do not proceed on a stale assumption.

3. **Confirm local migration chain is exactly what's intended to ship.**

   ```
   ls supabase/migrations | sort | tail -5
   ```

   Expected tip: `20260821000000_create_error_events.sql`. If the repo
   has moved past this since, re-verify nothing risky was added between
   `20260729000002` and the new tip before pushing.

4. **Read every migration between the two points.** This is not
   optional. As of this writing that's 161 files
   (`20260729174939_create_metadata_foundation.sql` through
   `20260821000000_create_error_events.sql`). This session's
   investigation confirmed the specific lineage touching
   `entity_metadata_assignments` is additive-only (`CREATE`, `GRANT`,
   function-replace) — **it did not exhaustively read all 161 files**,
   only that lineage. Before executing, either read the full set or
   accept that as a known, stated gap in this runbook's own diligence.

5. **Confirm CI is green** on the commit being deployed:
   `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test` all passing
   (verified for this session's changes — re-verify if anything changed
   since).

6. **Confirm application code compatible with the target schema is
   ready to deploy immediately after** (or already deployed) — a schema
   push that lands between an old and new app deployment recreates
   exactly the Blocker 1 failure mode. See "Application deployment
   ordering" below.

## Backup requirement — BLOCKING, currently unsatisfied

**Per `DEPLOYMENT-RECOVERY-RUNBOOK.md`, verified 2026-08-21: this
project has no backup capability on its current Free plan — no
scheduled backups, no PITR, no restore-to-new-project.**

This migration must not execute until one of the following is true,
confirmed with evidence (a timestamp, a dump file listing — not a
verbal assumption):

- **Option A (preferred):** org upgraded to Pro plan, and at least one
  scheduled backup has actually completed (visible with a timestamp
  under Database → Backups → Scheduled backups).
- **Option B (minimum acceptable):** founder has personally run
  `pg_dump` against the production connection string and confirmed the
  resulting file is non-empty and openable, immediately (within
  minutes) before proceeding to migration execution below. This dump
  must be stored somewhere durable outside this machine's ephemeral
  environment before the migration runs.

Do not skip this section. If neither is true when this runbook is
executed, stop and return to `DEPLOYMENT-RECOVERY-RUNBOOK.md`'s Phase 0.

## Exact migration(s) and order

Sequential, as ordered by filename timestamp — `supabase db push`
applies them in this order automatically; no manual reordering needed
or safe to do. Full list (161 files) is reproducible via:

```
ls supabase/migrations | sort | awk -F_ '{v=$1} v > "20260729000002" {print}'
```

Representative early and late entries, confirmed in this session:

- **First to apply:** `20260729174939_create_metadata_foundation.sql`
  — creates `entity_metadata_assignments` and related objects.
- **Last to apply:** `20260821000000_create_error_events.sql` — this
  session's own addition, creates `error_events` for Blocker 2.

All 161 are additive (`CREATE TABLE`/`CREATE POLICY`/`GRANT`/function
replace) for the specific lineage this session traced
(`entity_metadata_assignments` and its dependents). The remaining files
were not individually re-audited for destructive operations in this
pass — preflight check 4 above exists precisely to close that gap
before execution, not to wave it through.

## Expected schema changes

- New tables including `entity_metadata_assignments`,
  `metadata_review_tasks`, `error_events`, and others introduced across
  the 161-migration span (catalogue import, knowledge foundation,
  loyalty milestones, payroll, alteration workflow additions, and more
  — see individual migration filenames for the full inventory).
- New RPCs/functions: `review_metadata_assignment`,
  `publish_catalogue_import_row`, `sync_loyalty_milestones_for_order`,
  among others added across the span.
- New RLS policies and grants scoped to the new tables.
- No `DROP TABLE`/`DROP COLUMN` identified in the traced
  `entity_metadata_assignments` lineage; not yet confirmed absent
  across all 161 files (see preflight check 4).

## Migration command

```
supabase db push --linked
```

Run only after preflight checks 1–6 and the backup requirement above
are all satisfied with recorded evidence, and only by the founder from
an authenticated session (this agent's Supabase CLI session in its own
environment was unauthenticated as of this writing; if the founder is
running this from the same machine/session where they completed
`supabase login` during this conversation, that session may now be
usable — re-run preflight check 1 to confirm before trusting it).

## Verification queries (run immediately after push)

Via `supabase migration list --linked` (confirm all 161 now show as
applied) and via SQL Editor or `psql`:

```sql
-- Confirm the target table exists and is reachable
select count(*) from public.entity_metadata_assignments;

-- Confirm error_events exists and grants are correct
select count(*) from public.error_events;

-- Row-count sanity check on tables NOT touched by this migration span —
-- these must be unchanged; any delta here is a stop-ship finding
select count(*) from public.retailers;
select count(*) from public.orders;
select count(*) from public.customers;
```

Record all counts. Compare against a pre-push snapshot taken during the
backup step (Option A or B above) — if Option B was used, the `pg_dump`
file itself is the pre-push baseline; query it locally to get comparable
counts before comparing against production's post-push counts.

## Application smoke tests (immediately after push)

1. `https://paonpaon-customer.vercel.app/r/maison-dubois` → expect 200,
   not 500.
2. Customer login, profile, dashboard load without error.
3. `https://paonpaon-admin.vercel.app/login` and
   `https://paonpaon-retailer.vercel.app/login` → still 200 (these were
   already working; confirm the push didn't regress them).
4. Retailer admin dashboard loads.
5. Trigger the `error_events` write path once (e.g. a deliberately
   invalid request to a route covered by this session's
   `onRequestError`/`client-error` wiring, if that code is deployed in
   the same window) and confirm a row lands in production `error_events`.

## Failure conditions

- `supabase db push` exits non-zero, or output shows an error on any
  individual migration file.
- Any verification query above returns an unexpected count or errors.
- Any smoke test in the previous section fails after the push.

## Recovery procedure

**BACKUP → RESTORE, not MIGRATION → DOWN MIGRATION** — no verified
down-migration path exists for this chain (see
`DEPLOYMENT-RECOVERY-RUNBOOK.md`).

1. Stop immediately on any failure condition above. Do not attempt to
   hand-run remaining SQL or "fix forward" without understanding root
   cause first.
2. If Option A (Pro plan + completed backup) was used: restore via
   Supabase's restore-to-new-project or direct restore flow, per their
   current UI at the time of the incident.
3. If Option B (`pg_dump`) was used: restore requires manually loading
   the dump into a project (`psql` against the connection string, or
   into a fresh project) — this is slower and more error-prone than a
   managed restore; expect meaningful downtime if this path is needed.
4. After restore, re-run the verification queries above against the
   restored state to confirm it matches the pre-push baseline.
5. Do not re-attempt `supabase db push` until the specific failing
   migration is understood and, if needed, corrected in a **new**
   migration file — never by editing an already-applied or
   already-pushed file.

## Post-migration checks

Same as "Application smoke tests" above, plus:

- Confirm all three `paonpaon-*` Vercel deployments are the versions
  intended to run against the new schema (not a stale deployment now
  mismatched with the new database state).
- Update `docs/ENVIRONMENTS.md`'s migration-state note (lines around 18
  and 61-70) to reflect the new reality — that document currently says
  the original PAON project must not receive the migration chain until
  an approved restore proves recovery; once this runbook has actually
  executed successfully, that note is stale and should be corrected in
  the same change, not left contradicting the new production state.
