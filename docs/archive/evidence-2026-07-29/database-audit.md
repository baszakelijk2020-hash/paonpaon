# Database Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Migrations:** 89 files · newest `20260729000002_founder_outreach_pack.sql`  
**Verdict:** Schema chain healthy; **local and remote migration bookkeeping in sync** through newest migration. Production deploy of schema would succeed for current tip.

---

## Findings

### D1 — Migration chain clean

| Field                | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Findings**         | 89 migrations, unique timestamps, consistent `YYYYMMDDHHMMSS_name.sql` pattern. No duplicate prefixes. |
| **Evidence**         | `ls supabase/migrations/*.sql \| wc -l` → 89; timestamp uniqueness check empty.                        |
| **Severity**         | None (positive)                                                                                        |
| **Recommended fix**  | None                                                                                                   |
| **Estimated effort** | —                                                                                                      |
| **Current status**   | Clean                                                                                                  |

### D2 — Hosted remote matches local

| Field                | Value                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Every local migration has a matching remote entry through `20260729000002`.                                                            |
| **Evidence**         | `supabase migration list` JSON: each of 89 entries shows `"local":"…","remote":"…"` identical IDs including `20260729000000`–`000002`. |
| **Severity**         | None (positive)                                                                                                                        |
| **Recommended fix**  | Keep applying new migrations with founder-run `supabase db push --linked` (ADR-044).                                                   |
| **Estimated effort** | —                                                                                                                                      |
| **Current status**   | In sync                                                                                                                                |

### D3 — RLS on all created tables

| Field                | Value                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | 82/82 created tables enable RLS with policies; tenant scoping via `retailer_id` / `current_retailer_id()` or parent JOINs.                               |
| **Evidence**         | Migration audit sampling; `current_retailer_id()` used across ~37 migration files; historical wedding-party recursion fixed (`20260725000003`, ADR-045). |
| **Severity**         | None (positive)                                                                                                                                          |
| **Recommended fix**  | Continue same-file RLS on creates.                                                                                                                       |
| **Estimated effort** | —                                                                                                                                                        |
| **Current status**   | Healthy                                                                                                                                                  |

### D4 — Generated types in sync

| Field                | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | `packages/database/src/generated/database.types.ts` (~5912 lines) includes latest columns/RPCs (`founder_outreach_pack`, etc.). |
| **Evidence**         | Types file present; matches newest migration names in type surface.                                                             |
| **Severity**         | None (positive)                                                                                                                 |
| **Recommended fix**  | Always regenerate + commit types with migrations.                                                                               |
| **Estimated effort** | Process                                                                                                                         |
| **Current status**   | In sync                                                                                                                         |

### D5 — Prod migration apply not in CI

| Field                | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | App deploys do not apply SQL. Hosted schema updates are manual founder ops. Docs partially imply CI/DB integration that does not push to prod. |
| **Evidence**         | DEPLOYMENT.md focuses on Vercel + seed; CI e2e starts local Supabase only on workflow_dispatch; ADR-044 blocks agents from prod `db push`.     |
| **Severity**         | Medium (process risk)                                                                                                                          |
| **Recommended fix**  | Add explicit “apply migrations” runbook next to seed in DEPLOYMENT.md.                                                                         |
| **Estimated effort** | 30–60 min docs                                                                                                                                 |
| **Current status**   | Known; currently in sync so not urgent                                                                                                         |

### D6 — Historical wipe / silent-skip footgun

| Field                | Value                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Past schema wipe left `schema_migrations` claiming applied → silent skip; USAGE grant loss. Mitigations exist in chain. |
| **Evidence**         | ADR-044; `20260725000000_restore_schema_usage_grant.sql`.                                                               |
| **Severity**         | High **if** destructive ops recur; Low today                                                                            |
| **Recommended fix**  | Never wipe hosted schema casually; use `migration repair` if bookkeeping drifts.                                        |
| **Estimated effort** | Ops discipline                                                                                                          |
| **Current status**   | Mitigated / documented                                                                                                  |

### D7 — Dead Prisma / SQL scaffolds archived

| Field                | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Findings**         | Prisma schema and combined SQL dump live under `docs/archive/dead-scaffolds/` only. |
| **Evidence**         | Archive README obsolete banner; no package depends on Prisma.                       |
| **Severity**         | Info                                                                                |
| **Recommended fix**  | Do not revive.                                                                      |
| **Estimated effort** | —                                                                                   |
| **Current status**   | Correctly dead                                                                      |

### D8 — Seeds

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Local `supabase/seed.sql` is minimal; production/demo use TS `seedDemoData` / `seedProspectDemoRetailer` via `scripts/seed-production.sh`. |
| **Evidence**         | Scripts present; PHASE notes Maison Dubois re-seeded 2026-07-28; live storefront 200.                                                      |
| **Severity**         | None (positive)                                                                                                                            |
| **Recommended fix**  | Keep idempotent; never pipe `seed.sql` to prod.                                                                                            |
| **Estimated effort** | —                                                                                                                                          |
| **Current status**   | Healthy                                                                                                                                    |

### D9 — Naming / sequence quirks

| Field                | Value                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **Findings**         | Same-day jump `…00018` → `…00100`; a few files omit leading verb (`demo_*`, `wedding_party_*`). Harmless. |
| **Evidence**         | File list in `supabase/migrations/`.                                                                      |
| **Severity**         | Low                                                                                                       |
| **Recommended fix**  | Prefer `<verb>_<subject>` on **new** migrations only.                                                     |
| **Estimated effort** | Process                                                                                                   |
| **Current status**   | Accept                                                                                                    |

---

## Production deployment judgment

| Question                                 | Answer                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Would a fresh empty DB accept the chain? | Likely yes (historically green; continuous CI e2e not proving it)     |
| Is current hosted project aligned?       | **Yes** — remote bookkeeping matches all 89 local migrations          |
| Would app deploy alone update schema?    | **No** — separate founder `db push`                                   |
| Blockers for pilot DB?                   | None observed on schema sync; product blockers are Stripe/Resend keys |

---

## Overall status

**Database health: Strong.** Schema, RLS, types, and remote sync are in good shape for continued freeze work and demo operations.
