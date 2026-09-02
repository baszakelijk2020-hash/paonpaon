# Deployment & Recovery Runbook — Blocker 4

Companion to `PRODUCTION-MIGRATION-PLAN.md`, which is specific to the
`entity_metadata_assignments` gap. This document is the general,
repeatable procedure for any future production database deployment.

## What backup mechanism actually exists today

**VERIFIED, 2026-08-21, directly in the production Supabase dashboard —
NONE.**

- Org "nguyen" (sole member: `baszakelijk2020@gmail.com`, Owner) is on
  the **Free plan**.
- **Database → Backups → Scheduled backups**: "Free Plan does not
  include project backups. Upgrade to the Pro Plan for up to 7 days of
  scheduled backups."
- **Database → Backups → Point in time**: "Point in Time Recovery is a
  Pro Plan add-on... Starts at $100/month."
- **Database → Backups → Restore to new project**: "requires Pro Plan
  and above... you need to upgrade to a Pro Plan and have physical
  backups enabled."

**There is currently zero backup or recovery capability for this
production database, at any tier Supabase offers on this project.** No
scheduled snapshot, no PITR, no restore-to-new-project. If the database
were lost or corrupted right now — by this migration or anything else —
there is nothing to restore from except whatever the founder captures
manually before acting.

This is a harder blocker than "unverified" — it is confirmed absent.
**Phase 0 of `PRODUCTION-MIGRATION-PLAN.md` cannot be satisfied by
checking a box; it requires one of:**

1. **Upgrade the org to Pro plan** (base plan cost, before the separate
   $100/month PITR add-on — daily backups are included free on Pro,
   PITR is not). After upgrading, at least one scheduled backup must
   actually complete (check timestamp in Database → Backups) before it
   can be relied on — upgrading alone does not retroactively create a
   backup of current state.
2. **Manual `pg_dump`**, run by the founder against the production
   connection string (Project Settings → Database → Connection string;
   this agent does not have and should not be given that password).
   This is a real but weaker substitute: a single point-in-time dump,
   not a managed, restorable, continuously-refreshed backup — if
   something goes wrong hours after the dump was taken, only that one
   snapshot exists to go back to, and restoring it means manually
   recreating the project or `psql`-loading it into a fresh database,
   not a one-click Supabase restore.

Do not proceed to a production migration push under the assumption that
"a backup exists" — as of this verification, it does not, on either
axis Supabase provides.

## Standard deployment procedure

### 1. Pre-deployment checks

- [ ] Confirm target project ref matches intent (`hngxrczavwywsnfceppb`
      for production — never anything else without explicit, re-confirmed
      intent; the mechanical guard in `environment-safety.ts` enforces
      this for test/seed writes but does **not** cover
      `supabase db push`, which is a raw CLI command outside the
      application's own safety net).
- [ ] Run `supabase migration list --linked` and confirm the exact set of
      pending migrations. Read every pending migration file — do not
      trust a summary. Confirm none contain `DROP TABLE`, `DROP COLUMN`,
      or a data-lossy `ALTER ... TYPE` without an explicit backfill step
      that's already been reviewed.
- [ ] Run `pnpm -w typecheck`, `pnpm -w lint`, and the full test suite
      locally against the current migration chain (via
      `supabase db reset` on local Supabase) — a chain that doesn't apply
      cleanly locally must never be pushed to production.
- [ ] Confirm application code compatible with the target schema is
      already deployed or ready to deploy immediately after — a schema
      push that lands between an old and new app deployment is exactly
      how Blocker 1 happened.

### 2. Backup

- [ ] Confirm a backup taken within the last few minutes exists (per
      "What backup mechanism actually exists today" above) before
      proceeding. No backup, no push.

### 3. Migration execution

- [ ] Founder runs `supabase db push --linked` from an authenticated
      session. This is intentionally manual per ADR-044 (see
      `docs/ENVIRONMENTS.md`) — production migration is not, and per that
      ADR should not become, part of automated CI/CD.
- [ ] Watch the CLI output for the first error. `supabase db push`
      applies migrations sequentially and stops on the first failure —
      it does not partially apply a single migration file's statements
      unless that file itself lacks a transaction wrapper (Supabase
      migrations run inside an implicit transaction per file by default;
      confirm any migration using `-- supabase-transaction-mode: off` or
      similar escape hatches gets extra scrutiny before push, since those
      lose the automatic per-file rollback).

### 4. Migration verification

- [ ] Re-run `supabase migration list --linked` — every migration should
      now show as applied remotely.
- [ ] Query row counts on tables touched by the pushed migrations;
      compare against the pre-push baseline captured in step 1.
- [ ] Spot-check RLS: a scoped query as a real (non-service-role) tenant
      returns only that tenant's rows.

### 5. Application deployment ordering

- [ ] For an additive migration (new table/column with a default, new
      function): schema first, application deploy after — this is the
      order already used in this repo's history and is safe because old
      code simply doesn't reference the new objects yet.
- [ ] For a migration that changes something existing code depends on
      (renamed column, changed function signature): this requires a
      two-step "expand/contract" deploy (add new alongside old, migrate
      code to new, remove old in a later migration) — not a single
      lockstep push. No migration in the current pending set requires
      this, based on this session's investigation of the
      `entity_metadata_assignments` lineage specifically; re-verify for
      any future migration before assuming lockstep is safe.

### 6. Failure handling

- [ ] If `supabase db push` fails partway: **stop immediately.** Do not
      attempt to hand-run the remaining SQL to "finish the job." Capture
      the exact error and the name of the migration that failed.
- [ ] Determine whether the failure is transient (network, timeout — safe
      to retry `supabase db push`, which resumes from the first
      unapplied migration) or structural (a genuine conflict with
      existing production data/schema — do not retry; this is now an
      incident, go to Recovery below).

### 7. Recovery strategy

**Be technically honest: this project's migration framework does not
provide verified `down` migrations for this chain.** Recovery is
**BACKUP → RESTORE**, not **MIGRATION → DOWN MIGRATION**, unless a
specific migration has been individually verified to have a safe,
tested reverse operation (none have been, as of this document).

- [ ] Stop all traffic-affecting changes (do not deploy new application
      code on top of a half-migrated database).
- [ ] Restore the pre-push backup from step 2 into production, or into a
      side-by-side project if a zero-downtime restore isn't available on
      the current Supabase plan — confirm which is actually possible on
      this project's tier before an incident, not during one.
- [ ] After restore, re-verify row counts and RLS as in step 4 against
      the restored state.
- [ ] Do not re-attempt the same migration push until the structural
      cause is understood and fixed in a new migration file (never by
      editing an already-applied migration file's contents).

### 8. Post-deployment verification

Same checklist as Phase 3 in `PRODUCTION-MIGRATION-PLAN.md` — customer
storefront, auth, dashboards, `error_events` write path, and the specific
RPCs the pushed migrations touch.

## What this runbook does not claim

- It does not claim zero-downtime migrations are guaranteed — that
  depends on the specific migration and hasn't been evaluated generically
  here.
- It does not claim a rollback command exists. It exists nowhere in this
  codebase today.
- It does not claim this procedure has been executed against production.
  As of 2026-08-21, it has not — see `PRODUCTION-MIGRATION-PLAN.md`'s
  "cannot be performed in this session" conclusion.
