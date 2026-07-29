# 14 — Code health

**Snapshot date: 2026-07-29.**

## Technical debt (documented + observed)

- Breadth vs conversion focus (ADR-051)
- Five provider integrations historically never live-executed
- Heuristic catalog facets vs missing metadata graph
- Dual UI systems (portals vs HTML storefront)
- Alterations UX invented pending founder design (PHASE)
- ADR-050 pricing decision without matching implementation symbols
- `ProductionOrder` domain without persistence
- Root orphan docs/schema (`ROADMAP.md`, `CURRENT_STATE.md`, `prisma/`)
- Newsletter cron not in `vercel.json`
- `PROJECT_STATE.md` trust issues

## Duplicate logic

- Per-app `lib/session.ts` / middleware wrapping shared `@paon/auth`
- Storefront cart mutations available as both Server Actions and
  `r/[slug]/api/*` Route Handlers (intentional for HTML `fetch`)
- Possible parallel “demo environment” vs live retailer concepts (by design)

Full clone detection across apps was **not** run; additional duplication is
**Unknown**.

## Dead / unused artifacts

| Artifact                                   | Status                    |
| ------------------------------------------ | ------------------------- |
| `prisma/schema.prisma`                     | Dead                      |
| Root `CURRENT_STATE.md`, root `ROADMAP.md` | Stale                     |
| `docs/archive/*`                           | Archived                  |
| `legacy_*` tables                          | Deprecated but retained   |
| `_tmp-verify-login.spec.ts` e2e files      | Temp-named; may still run |

## Performance concerns

- Storefront injects full active catalog into large HTML document
- Client-side list filtering only
- No catalog search index
- Large template file size (ADR-051 cited ~16k lines historically)

## Security concerns (architectural)

- RLS is the tenant boundary — regressions are high impact (ADR-044/045)
- Service-role usage must stay confined to webhooks/cron/authorized admin
- Public product image bucket (ADR-029) — intentional public read
- Storefront anonymous endpoints need continued abuse consideration
- Secrets live in `.env.local` / Vercel — not in git (`.env.example` only)

No dedicated security audit was performed for this snapshot.

## Test coverage

| Kind                         | Count (approx.)        |
| ---------------------------- | ---------------------- |
| Package unit test files      | 57                     |
| App unit tests               | 0 files found          |
| Playwright e2e specs         | 28                     |
| ADR-051 cited unit **cases** | 280 (different metric) |

Coverage % **unknown** (no coverage report ingested). AI/payments/email/sms
tests largely fake providers.

## Maintainability

**Strengths:** clear package boundaries, branded IDs, ADR trail, typed domain.  
**Weaknesses:** doc sprawl (~6k+ lines historically), unreliable status prose,
founder HTML outside normal React maintainability model (accepted trade-off
ADR-052), large migration history.
