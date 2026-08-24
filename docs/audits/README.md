# Engineering audits

Point-in-time takeover health checks. **Not a work queue** — PHASE.md still gates what may be built.

> **Archived:** The 2026-07-29 evidence run has been archived to [`docs/archive/evidence-2026-07-29/`](../archive/evidence-2026-07-29/).

Start here: **[project-health.md](./project-health.md)**

| Report                                             | Focus                                         |
| -------------------------------------------------- | --------------------------------------------- |
| [git-audit.md](./git-audit.md)                     | Branches, history, dirty tree                 |
| [build-audit.md](./build-audit.md)                 | Install, lint, typecheck, test, build, format |
| [runtime-audit.md](./runtime-audit.md)             | Local + production HTTP, auth, jobs           |
| [database-audit.md](./database-audit.md)           | Migrations, RLS, seeds, remote sync           |
| [architecture-audit.md](./architecture-audit.md)   | Boundaries, drift, ports                      |
| [code-quality.md](./code-quality.md)               | TODOs, debug, smells                          |
| [testing-audit.md](./testing-audit.md)             | Unit, e2e, coverage gaps                      |
| [documentation-audit.md](./documentation-audit.md) | Doc ↔ reality                                 |
| [release-readiness.md](./release-readiness.md)     | Ladder + blockers                             |
| [project-health.md](./project-health.md)           | Executive scores + next actions               |

Latest full audit: **2026-07-29** @ `e75de84`.

A newer, broader audit exists at
[`docs/documentation-audit/`](../documentation-audit/) (dated **2026-08-06**,
migration executed the same day) — check there first for anything touching
documentation architecture, ontology, cross-module system interaction, or
this directory's own findings; several of them (e.g. `runtime-audit.md`'s
"production HTTP 200" snapshot) are known superseded by later events. See
`docs/documentation-audit/DOCUMENT_CONFLICTS.md` #4.
