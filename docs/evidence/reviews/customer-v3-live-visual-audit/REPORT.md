# Customer V3 live visual audit

Date: 2026-08-28  
Branch: `release-integration-lane-h` at `3f7f8b3`  
Scope: requested customer routes at 1512x982 and 390x844 only.

## Result

The authenticated V3 visual audit is blocked and therefore incomplete. No authenticated route surface or workflow is claimed as exercised.

The local canonical Isabelle demo sign-in returned `invalid_demo_credentials`. A read-only inspection found no supported non-mutating authenticated local path: the focused login test first runs the data-changing demo seed. Seeding, authentication changes, Supabase changes, and email/magic-link creation were outside this audit's authorization.

While capturing the requested routes, all route views visibly rendered `Internal Server Error`. The local Next process logged missing generated `.next` manifest files while serving these views. This is a runtime-output failure, not evidence of an application-source defect; no source file is attributed without further authorized diagnosis.

## Route evidence

All screenshots below show the visible `Internal Server Error` page, not an authenticated customer surface.

| Route                   | Desktop 1512x982                                | Mobile 390x844                                 |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------- |
| `/dashboard`            | `desktop-dashboard-auth-blocked.png`            | `mobile-dashboard-auth-blocked.png`            |
| `/wardrobe`             | `desktop-wardrobe-auth-blocked.png`             | `mobile-wardrobe-auth-blocked.png`             |
| `/appointments`         | `desktop-appointments-auth-blocked.png`         | `mobile-appointments-auth-blocked.png`         |
| `/orders`               | `desktop-orders-auth-blocked.png`               | `mobile-orders-auth-blocked.png`               |
| `/rewards`              | `desktop-rewards-auth-blocked.png`              | `mobile-rewards-auth-blocked.png`              |
| `/account`              | `desktop-account-auth-blocked.png`              | `mobile-account-auth-blocked.png`              |
| `/digital-fitting-room` | `desktop-digital-fitting-room-auth-blocked.png` | `mobile-digital-fitting-room-auth-blocked.png` |

## Real visible defects and blockers

| Severity | Exact route and screenshot evidence                                                                                                                                                      | Violated V3 requirement                                                                                                                           | Likely responsible source file                                                                                                                                                              | Safe next implementation scope                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker  | `/dashboard`: `desktop-dashboard-auth-blocked.png`, `mobile-dashboard-auth-blocked.png`                                                                                                  | Overview must be visually verified at both required viewports; no V3 route may be replaced by an error page.                                      | None established. The observed failure is generated runtime output: `apps/customer/.next/server/app/(dashboard)/dashboard/page/app-build-manifest.json` missing while served.               | Diagnose the isolated local Next build-output lifecycle; do not alter customer application behaviour until a stable local runtime can render the route.    |
| Blocker  | `/wardrobe`: `desktop-wardrobe-auth-blocked.png`, `mobile-wardrobe-auth-blocked.png`                                                                                                     | The eight-rail Wardrobe contract cannot be rendered or audited.                                                                                   | None established. The observed failure is generated runtime output: `apps/customer/.next/server/app/login/page/app-build-manifest.json` and `_buildManifest.js.tmp.*` missing while served. | Restore a stable local runtime, then rerun authenticated desktop/mobile Wardrobe proof including rails and `Actions +`.                                    |
| Blocker  | `/appointments`: `desktop-appointments-auth-blocked.png`, `mobile-appointments-auth-blocked.png`                                                                                         | My Appointments must render and be verified as the progressive booking/service surface.                                                           | None established. The observed failure is generated runtime output: `apps/customer/.next/server/pages/_app/build-manifest.json` missing while served.                                       | Restore a stable local runtime, then rerun the authenticated visual and control audit without creating bookings or service requests.                       |
| Blocker  | `/orders`: `desktop-orders-auth-blocked.png`, `mobile-orders-auth-blocked.png`                                                                                                           | Pending Orders and Order History cannot be rendered or audited.                                                                                   | None established. The observed failure is generated runtime output: `apps/customer/.next/server/pages/_app/build-manifest.json` missing while served.                                       | Restore a stable local runtime, then rerun the authenticated visual audit without placing or modifying orders.                                             |
| Blocker  | `/rewards`: `desktop-rewards-auth-blocked.png`, `mobile-rewards-auth-blocked.png`                                                                                                        | Rewards & Referrals must render the existing `/loyalty` implementation; this requested `/rewards` path did not present a usable customer surface. | None established. The observed failure is generated runtime output: `apps/customer/.next/server/app/login/page/app-build-manifest.json` missing while served.                               | First establish the intended canonical route mapping and a stable runtime; then audit `/loyalty` as the V3-specified destination.                          |
| Blocker  | `/account`: `desktop-account-auth-blocked.png`, `mobile-account-auth-blocked.png`                                                                                                        | Profile cannot be checked for absence of House Memory, style discovery, and avatar setup.                                                         | None established. The observed failure is generated runtime output: `apps/customer/.next/server/pages/_app/build-manifest.json` missing while served.                                       | Restore stable runtime, then rerun authenticated profile visual audit only.                                                                                |
| Blocker  | `/digital-fitting-room`: `desktop-digital-fitting-room-auth-blocked.png`, `mobile-digital-fitting-room-auth-blocked.png`                                                                 | `/digital-fitting-room` must resolve and render its first screen; it visibly did not.                                                             | None established. The observed failure is generated runtime output: `apps/customer/.next/server/app/login/page/app-build-manifest.json` missing while served.                               | Restore stable runtime, then rerun authenticated first-screen audit without uploading or generating anything.                                              |
| Blocker  | Login attempt preceding the captures: `desktop-dashboard-auth-blocked.png` and `mobile-dashboard-auth-blocked.png` are the retained route evidence after the failed canonical-demo path. | V3 proof gate requires authenticated Isabelle at both required viewports.                                                                         | `apps/customer/app/login/actions.ts` (maps password-auth failures to `invalid_demo_credentials`); local demo identity source is `packages/database/src/demo-seed.ts`.                       | In a separately authorized environment-readiness slice, establish exactly one canonical demo Isabelle identity in the local target, then rerun this audit. |

## Workflow claim boundary

No route-specific customer workflow, control, cross-role handoff, data mutation, payment, QR receipt, email, or persisted state change was exercised. The report contains only the observed visible error state and the authenticated-audit blocker.

## Verification performed

- Started a local customer dev server only to reach the requested live routes; stopped it after the manifest failures.
- Attempted the canonical Customer Demo / Isabelle sign-in once; it returned `invalid_demo_credentials`.
- Captured every requested route at desktop 1512x982 and mobile 390x844.
- Did not edit application code, tests, PHASE.md, queue files, authentication, RLS, migrations, Supabase, payments, QR, email, receipts, Mission Control, storefront source, or pre-existing dirty files.
