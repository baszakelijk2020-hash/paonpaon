# Environment Ledger

**Authority for project identity and data classification.** No secrets belong
here. Read this before integration/e2e, migrations, seeding, key rotation, or
deployment work.

Snapshot: 2026-08-02, branch `agent/grok-takeover-2026-07-30`.

## Supabase

| Target                      | Project ref / URL        | Region           | Classification                         | Current access                                                                                                   | Permitted use                                                                                                       |
| --------------------------- | ------------------------ | ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Local Supabase              | `http://127.0.0.1:54321` | local Docker     | disposable                             | all three `apps/*/.env.local` files point here                                                                   | unit, integration, Playwright, migration iteration                                                                  |
| Original PAON               | `hngxrczavwywsnfceppb`   | `ap-southeast-2` | **protected original/production data** | linked CLI and local Supabase account                                                                            | read-only diagnosis; no tests, seed, migration, reset, or backfill without an approved restored-copy rehearsal      |
| Hyperagent takeover sandbox | `lowlzpktpayiglckvfpi`   | `ap-northeast-2` | disposable non-production sandbox      | documented by takeover; not visible to the current local Supabase token and not present in current app env files | blocked until credentials are restored; then requires explicit `PAON_DISPOSABLE_SUPABASE_REFS=lowlzpktpayiglckvfpi` |
| Landlord OS                 | `zpzbrojnhlmwsaxstkws`   | `ap-southeast-1` | unrelated protected project            | visible to local Supabase account                                                                                | out of scope; never touch from PAON                                                                                 |

The repository contains 149 migrations including the R0.1 tenant-boundary
repair, R0.2 atomic POS migration and local-only R0.3 module kernel. The Hyperagent sandbox
previously received the first 146 from empty.
That is clean-database proof only. A populated synthetic pre-18 upgrade has
now been rehearsed locally in both conflict and success modes; see
`runbooks/STOCK_UPGRADE_REHEARSAL.md`. The original PAON project is on an
older schema and must not receive the migration chain until an approved
restore of its actual data proves row counts, backfills, stock, money, RLS
and rollback/recovery.

## Vercel

| Project                                        | Project id                         | Classification         | Production check 2026-08-02                                                                                                                          |
| ---------------------------------------------- | ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paonpaon-customer`                            | `prj_LZi3NMbuRGmmjpX7oWzeFjbFeFHk` | active PAON production | deployment `dpl_GNp1rYAy17ZLPDJ7W8mhr6TyrHDa`, created 2026-07-30; HTTP 500 because `entity_metadata_assignments` is absent from its database schema |
| `paonpaon-admin`                               | `prj_wdpo4BZUignmmufUovwuEWW4xVMO` | active PAON production | login HTTP 200                                                                                                                                       |
| `paonpaon-retailer`                            | `prj_z2yJPrlzEyOBhkStN4cf9fCi1bEg` | active PAON production | login HTTP 200                                                                                                                                       |
| `paon-customer`, `paon-admin`, `paon-retailer` | see Vercel account                 | stale duplicates       | out of scope; do not deploy, relink, or delete                                                                                                       |

Production and preview carry a sensitive `NEXT_PUBLIC_SUPABASE_URL` variable
on each `paonpaon-*` project. A 2026-08-02 CLI pull confirmed all three values
are irreversibly returned as `[SENSITIVE]`; Vercel does not expose a sensitive
value after creation. Temporary pulled environment files were deleted
immediately. The current production deployment predates the takeover sandbox,
the deployment runbook records the original PAON ref, and customer runtime
demonstrates the older/original schema. Treat every current `paonpaon-*`
production/preview deployment as connected to protected original
infrastructure until a newly isolated preview is explicitly created and
proven otherwise.

## Mechanical guard

`@paon/database` refuses Playwright and `PAON_INTEGRATION=1` fixture writes
unless the target is:

1. local Supabase; or
2. a hosted ref explicitly listed in `PAON_DISPOSABLE_SUPABASE_REFS`.

The original PAON ref is hard-denied even if someone mistakenly adds it to
that variable. Unknown hosts also fail closed. This guard is necessary because
`PAON_INTEGRATION=1` alone only enables writes; it says nothing about target
safety.

## Current blockers

- Restore access to the takeover sandbox only if its historical proofs must be
  reproduced; local Supabase is the active disposable target.
- Obtain an approved restore of original data and repeat the now-documented
  upgrade rehearsal before any hosted migration. Synthetic populated proof is
  green; original-data proof remains intentionally blocked.
- Repair and redeploy customer production only after schema/application
  compatibility is decided; do not solve the current 500 by blindly pushing
  all migrations.
- **Unresolved credential exposure (found 2026-08-01):** a Supabase secret key
  was pasted into a chat transcript. No later record confirms rotation.
  Treat as still needing rotation until explicitly confirmed done; rotating it
  requires updating the corresponding Vercel environment variable in the same
  change or the affected production deployment breaks.
