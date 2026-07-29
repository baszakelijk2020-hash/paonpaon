# Project Health — Executive Summary

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84` (`docs: close agent-findable back-env polish residual in PHASE.`)  
**Audit type:** Full takeover health check (no feature development)  
**Confidence:** **High** on build/git/DB sync/production HTTP; **Medium** on local runtime (apps down); **High** on known commercial blockers.

---

## Verdict

PAON is a **buildable, CI-green, production-deployed demo platform** with three freeze workstreams in good shape. It is **not** ready to take money or send reliable transactional email. One **Critical** security leftover (`RETAILER_STAFF_DEBUG`) should be removed before treating retailer sessions as safe. Agent-buildable PHASE queue is exhausted aside from hard blockers and that repair.

**Overall completion (freeze objective):** ~**85–90%** of agent-buildable demo/conversion scope.  
**Overall completion (full PRODUCT.md ambition):** ~**40–55%** (large verticals exist but unpaid / unfinished / blocked).

---

## Health scores (0–10)

| Area                            |   Score | Notes                                                      |
| ------------------------------- | ------: | ---------------------------------------------------------- |
| Architecture                    |     7.5 | Solid packages; repository leaks; dual UI by design        |
| Build                           |     9.5 | Local + CI green; build via CI on tip                      |
| Database                        |     9.0 | 89 migrations; remote synced; RLS solid                    |
| Frontend (storefront + portals) |     8.0 | Live storefront strong; back-env polished; local Next down |
| Backend (actions / repos)       |     8.0 | Repository pattern dominant                                |
| API                             |     7.5 | Server Actions + intentional storefront Route Handlers     |
| Authentication                  |     7.0 | OTP + demo login work; debug path Critical; OAuth absent   |
| Documentation                   |     6.0 | Constitution excellent; PROJECT_STATE toxic drift          |
| Testing                         |     6.0 | Unit strong; e2e manual-only                               |
| Technical debt                  |     6.5 | Clean markers; scope breadth + silhouette + clones         |
| **Release readiness**           | **5.5** | Internally testable / demo-beta; not production            |

---

## Feature completeness (selected)

| Feature                                           | Status                                |
| ------------------------------------------------- | ------------------------------------- |
| Storefront `/r/[slug]` (HTML product)             | **Complete**                          |
| Demo Studio + private demo gate                   | **Complete**                          |
| Marketing site + `/founder`                       | **Complete**                          |
| Wedding parties (create/share/join/orbit)         | **Complete**                          |
| Loyalty / appointments / orders / CRM (demo-path) | **Complete**                          |
| Auth + production demo login                      | **Complete** (remove before real PII) |
| Stripe / Connect / Checkout                       | **Parked/Blocked** (keys)             |
| Resend / email delivery                           | **Parked/Blocked** (keys)             |
| Alterations vertical                              | **Parked/Blocked** (founder design)   |
| Silhouette carousel                               | **Broken** (wrong port)               |
| Fit tools                                         | **Parked** (supplier integration)     |
| Vision wardrobe intelligence                      | **Not Started** (correct)             |
| ProductionOrder / POS / returns / multi-store     | **Not Started**                       |
| Presentation modules (globe, lapel, gifts)        | **Not Started**                       |

---

## Critical blockers

1. Stripe credentials not provisioned — cannot take money.
2. Resend credentials not provisioned — email unproven.
3. ~~`RETAILER_STAFF_DEBUG` PII dump~~ **Fixed** after snapshot (redirect-only).

## High priority

1. E2E not gating `main` (workflow_dispatch only).
2. Inline Supabase in storefront `route.ts` (repository leak).
3. PROJECT_STATE / stale ai_snapshot misleading operators.
4. Demo login must be disabled before real retailer data.
5. Hobby deploy quota / hook flakiness (mitigated by CI Deployments API).

## Medium priority

1. Cross-app duplicate badges / party-schedule form.
2. `CommercialProspectRepository` unit tests missing.
3. Marketing e2e misses `/founder`.
4. Oversized `demo-seed.ts` / `route.ts`.
5. DEPLOYMENT.md migration apply runbook thin.
6. COMPETITIVE_GAPS email “proven” overclaim.

## Low priority

1. Prune stale `origin/cursor/demo-studio-teardown`.
2. Tag a pilot release.
3. Residual `replaceAll("_"," ")` fallbacks.
4. Migration naming verb drift.
5. Coverage tooling absent.

---

## Immediate next actions

1. ~~**Remove `RETAILER_STAFF_DEBUG`**~~ Done in this session.
2. **`git fetch --prune`** — clear stale remote ref.
3. **Founder:** provision Stripe + Resend when ready to prove money/email.
4. **Do not** extend alterations / silhouette / vision / POS during freeze.
5. **Treat this audit set** as the known-good baseline; distrust PROJECT_STATE.

## Recommended development order (when building resumes)

1. Security fix (debug leak) → push.
2. Repository-ize storefront demo config queries.
3. Founder keys → Stripe then Resend live proofs.
4. Re-enable CI e2e.
5. Doc hygiene (PROJECT_STATE archive, ai_snapshot regenerate).
6. Only then: founder-designed alterations / silhouette home / out-of-freeze roadmap.

## Top risks

| Risk                                  | Why it matters                 |
| ------------------------------------- | ------------------------------ |
| Selling capability that cannot charge | Stripe never live-proven       |
| Log leak of staff PII                 | Debug path in retailer session |
| Doc-driven wrong work                 | PROJECT_STATE / ROADMAP body   |
| Silent freeze regression              | E2E not on push                |
| Demonstrating alterations as finished | Invented UX + wrong silhouette |
| Hobby quota mid-pitch                 | Deploy lag after heavy pushes  |

## Confidence level

**High (≈0.85)** that the freeze demo path is real and deployed.  
**High** that money/email do not work yet.  
**High** that git/build/DB sync are healthy.  
**Medium** that every out-of-freeze surface works end-to-end (not fully walked in this audit).

---

## Evidence index

| Report            | Path                                               |
| ----------------- | -------------------------------------------------- |
| Git               | [git-audit.md](./git-audit.md)                     |
| Build             | [build-audit.md](./build-audit.md)                 |
| Runtime           | [runtime-audit.md](./runtime-audit.md)             |
| Database          | [database-audit.md](./database-audit.md)           |
| Architecture      | [architecture-audit.md](./architecture-audit.md)   |
| Code quality      | [code-quality.md](./code-quality.md)               |
| Testing           | [testing-audit.md](./testing-audit.md)             |
| Documentation     | [documentation-audit.md](./documentation-audit.md) |
| Release readiness | [release-readiness.md](./release-readiness.md)     |

---

## Methodology notes

- Verified from repository, CI run `30444939257`, production HTTP, `supabase migration list`, local `pnpm` verify (install/lint/typecheck/test/format), and code inspection.
- Local Next.js apps were **not running** at probe time; production used for runtime proof.
- Local `pnpm build` skipped to avoid `.next` corruption; CI Build step on same SHA used as evidence.
- No features implemented during this audit.
