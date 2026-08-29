# PAON V3 integrated release-candidate gate

Candidate branch: `integration/paon-v3-controller-final-20260829`
Candidate SHA: `6570556b08ec618a60a2efb5a84a241f5b4b2f75`
Release base: `ee3397024469cad0f9d1a2e8e593c49809fb6724`
Gate date: 2026-08-29

## Integrated scope

This candidate is a clean descendant of the protected release base and contains the independently reviewed V3 changes for:

- customer wardrobe-roadmap approval and advisor-selection removal;
- My Appointments progressive booking proof;
- Orders hardening and Seasonal staff favourites;
- customer-visible local-session sign-out;
- raw storefront to Digital Fitting Room handoff;
- real-image-only Digital Fitting Room invitation direction.

The protected `/Users/nguyen/Projects/PAON` worktree was not modified during this integration gate.

## Current-SHA verification

All commands ran from isolated worktrees at candidate SHA `6570556` against the local Supabase stack only.

| Gate | Result |
| --- | --- |
| `pnpm --filter @paon/customer lint` | pass |
| `pnpm --filter @paon/customer typecheck` | pass |
| `pnpm --filter @paon/customer build` | pass |
| Full focused V3 Playwright sequence | 27/27 passed |

The Playwright gate used a unique server port (`3624`), a unique Next output directory (`.next-e2e-controller-full-3624`), and `PAON_E2E_WEBSERVER_TIMEOUT_MS=420000`. It executed these current-tip specs:

- `appointments-booking-wizard-v3.spec.ts`
- `customer-signout-v3.spec.ts`
- `digital-fitting-room-first-run.spec.ts`
- `digital-fitting-room-start-creating-reproof-v3.spec.ts`
- `digital-fitting-room-supported-actions-proof-v3.spec.ts`
- `orders-actions-v3.spec.ts`
- `orders-history-integrity-v3.spec.ts`
- `orders-seasonal-staff-favourites-v3.spec.ts`
- `orders-v3-presentation.spec.ts`
- `roadmap-approval-rls-v3.spec.ts`
- `storefront-digital-fitting-room-handoff-v3.spec.ts`
- `wardrobe-removal-v3.spec.ts`

The passing run completed in 2.9 minutes. Its tests retain their own current-route/browser/database assertions, including the existing zero-console/page-error checks.

## Hydration note

Earlier full-suite attempts intermittently observed React error #418 on different routes. The final fresh full run passed all 27 tests, and a separate fresh sign-out desktop run passed 1/1. No unproven source-level hydration patch was applied and no zero-error assertion was weakened. This candidate records the passing gate while retaining the dedicated regression coverage added by the C3 review lane.

## Acceptance boundary

This is an isolated release candidate, not a modification of the dirty protected release worktree. Promotion requires the serial integrator to inspect this commit range and fast-forward or merge it only into a clean release target.
