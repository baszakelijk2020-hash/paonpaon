# PAON — Final Release Certification

**Date:** 2026-08-21
**Scope:** Remediation of the five confirmed release blockers and one
security unknown from the independent verification pass. This document
is the honest end state, not an aspiration — see each blocker's own
detail doc for full evidence.

## FINAL VERDICT: NOT SHIP READY

Code-level fixes for all five blockers are implemented, typechecked,
linted, unit-tested, and — for Blockers 2, 3 and 5 — runtime-verified
against a running application (local, not yet production). **None of the
five blockers has production evidence**, because none of the fixes have
been deployed to `paonpaon-admin`, `paonpaon-retailer`, or
`paonpaon-customer` yet, and Blocker 1's production database migration
requires a founder-run, currently-blocked backup/restore rehearsal
before it can even be attempted. Shipping requires completing the
deployment and production-verification steps each section below lists —
they are concrete and mostly short, but they have not happened.

---

## VERIFIED BLOCKERS

### Blocker 1 — Production customer app HTTP 500 (schema drift)

- **Original claim:** `/r/maison-dubois` returns HTTP 500; production
  Supabase schema predates `entity_metadata_assignments`
  (introduced 2026-07-29).
- **Fix applied:** No production change — the correct "fix" per this
  project's own existing safety rails (`docs/ENVIRONMENTS.md`,
  `@paon/database`'s environment-safety guard) is a documented,
  founder-executed migration procedure, not a blind push. Produced
  `PRODUCTION-MIGRATION-PLAN.md` and `DEPLOYMENT-RECOVERY-RUNBOOK.md`.
- **Rehearsal performed:** Full 249-migration chain (through this
  session's own `20260821000000_create_error_events.sql`) applied
  cleanly to local disposable Supabase via `supabase db reset` — zero
  errors. Full monorepo `pnpm -w typecheck` (12/12) passed against the
  regenerated types. This is clean-database proof only; it does not
  substitute for the still-required rehearsal against a restored copy of
  production's actual data.
- **Files changed:** none to application code; new docs
  `PRODUCTION-MIGRATION-PLAN.md`, `DEPLOYMENT-RECOVERY-RUNBOOK.md`.
- **Tests:** N/A (migration rehearsal, not a code test).
- **Browser evidence:** N/A — production is unreachable/broken until
  migrated; nothing to browser-test yet.
- **Production evidence:** none.
- **Final status: STILL OPEN.** Requires founder action (backup/restore
  rehearsal, then `supabase db push --linked`) that this session could
  not perform — no authenticated production Supabase CLI session
  existed in this environment, and the existing safety rails correctly
  prevent bypassing that gate.

### Blocker 2 — Zero production error tracking

- **Original claim:** No error tracking/observability existed anywhere
  in the three apps.
- **Fix applied:** New `public.error_events` table (RLS-protected,
  service-role-only insert, platform-staff-only read); a shared
  `reportError()` in `packages/database/src/error-reporting.ts` that
  strips secret-shaped context keys and never throws; wired into all
  three apps via `instrumentation.ts` (server errors) and
  `global-error.tsx` + `/api/client-error` (client render crashes).
  Architected so a future Sentry SDK swap only changes the reporter's
  body, not call sites (founder-approved deferral of Sentry itself).
- **Files changed:** `supabase/migrations/20260821000000_create_error_events.sql`,
  `packages/database/src/error-reporting.ts`,
  `packages/database/src/repositories/__integration__/error-reporting-live.integration.test.ts`,
  `apps/{admin,retailer,customer}/instrumentation.ts`,
  `apps/{admin,retailer,customer}/app/global-error.tsx`,
  `apps/{admin,retailer,customer}/app/api/client-error/route.ts`.
- **Tests added:** integration test asserting a controlled error
  persists, secret-shaped context keys (`password`, `sessionToken`,
  `apiKey`) are stripped and never appear in stored JSON, and the
  reporter never throws when Supabase credentials are missing.
- **Test results:** Both cases passed against local disposable Supabase
  (`PAON_INTEGRATION=1`, full migration chain applied).
- **Browser evidence:** none collected specifically for this blocker
  beyond the migration/typecheck proof above (its wiring is exercised
  indirectly whenever any of the browser checks below hit an error path,
  but no deliberate error was triggered through the UI in this session).
- **Production evidence:** none — not deployed, `error_events` doesn't
  exist in production yet.
- **Final status: STILL OPEN.** CODE IMPLEMENTED + RUNTIME VERIFIED
  (local). Needs: production migration (bundled with Blocker 1's push),
  confirmation of `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL`
  in each app's Vercel Production environment, and one real triggered
  error per app confirmed to land in production `error_events`.

### Blocker 3 — Demo-login reachable in production

- **Original claim:** `NEXT_PUBLIC_DEMO_LOGIN=1` set on all three
  production Vercel projects defeated the `NODE_ENV` gate, exposing
  demo login (and demo credentials) in real production.
- **Fix applied:** Replaced the leaky `NODE_ENV`-based gate with
  `VERCEL_ENV === "production"` (Vercel-managed, not developer-settable)
  in all three login pages. Added server-side rejection of demo-persona
  emails in `signIn`/`signInToDemo` for real production, so even a
  direct form submission with known demo credentials fails — not just a
  hidden button.
- **Files changed:** `apps/{admin,retailer,customer}/app/login/page.tsx`,
  `apps/{admin,retailer,customer}/app/login/actions.ts`.
- **Tests:** none added specifically (no existing test harness covers
  login pages' server-rendered conditional UI); verified by direct
  runtime exercise instead (below).
- **Browser evidence:** `pnpm build` with `VERCEL_ENV=production`
  succeeded for all three apps. Running each in that mode: `curl`/
  Playwright confirmed zero demo-login UI on all three `/login` pages
  (customer checked both plain and `?demo=1`). On admin, filled and
  submitted the real login form with known demo credentials through an
  actual browser — server redirected to `?error=invalid_credentials`,
  proving the server-side block works, not just the UI hiding. A
  dev-mode control check confirmed the gate doesn't suppress demo login
  outside real production (it still works locally, as intended).
- **Production evidence:** none — code not deployed;
  `NEXT_PUBLIC_DEMO_LOGIN=1` is still set on all three production Vercel
  projects (now inert, since nothing reads it, but not yet removed).
- **Final status: STILL OPEN** pending deployment + production
  verification, but this is the most thoroughly locally-proven of the
  five blockers — CODE IMPLEMENTED + RUNTIME VERIFIED (local, both UI
  and server-side rejection).

### Blocker 4 — No rehearsed/safe migration and recovery path

- **Original claim:** No documented, rehearsed procedure existed for
  safely deploying a production migration or recovering from a failed
  one.
- **Fix applied:** `DEPLOYMENT-RECOVERY-RUNBOOK.md` — the general,
  repeatable procedure (pre-deployment checks, backup, execution,
  verification, deployment ordering, failure handling, recovery
  strategy, post-deployment verification), explicit that recovery is
  BACKUP → RESTORE, not MIGRATION → DOWN MIGRATION, since no verified
  down-migration capability exists for this chain. Companion
  `PRODUCTION-MIGRATION-PLAN.md` is the specific instance for the
  `entity_metadata_assignments` gap.
- **Rehearsal performed:** Full clean-database migration chain rehearsal
  (see Blocker 1) — proves the chain applies without error from empty.
  Does **not** prove behavior against production's actual populated,
  older schema — that remains blocked on backup/restore access, exactly
  as `docs/ENVIRONMENTS.md` already documented before this session.
- **Files changed:** none to application code; new docs.
- **Final status: STILL OPEN.** A documented procedure now exists where
  none did before, and it has been partially rehearsed (clean-database
  path). It has not been rehearsed against restored production data,
  and no production deployment has used it yet — both required before
  this is genuinely resolved rather than merely planned.

### Blocker 5 — Six of seven admin actions fail silently

- **Original claim:** Six admin server actions returned `Promise<void>`,
  silently swallowed validation failures, and let real errors throw
  unhandled with zero UI feedback; one (`assignSubscriptionPlan`) already
  worked correctly and served as the reference pattern.
- **Fix applied:** All six (`setRetailerStatus`, `resendStaffInvite`,
  `updateProspectStage`, `updateInquiryStatus`, `setDemoLoginsActive`,
  `setDemoPublication`) now return a typed action-state object, wrap
  their mutation in try/catch with operator-facing (non-leaking) error
  messages, and are driven through `useActionState` in new or updated
  form components showing `role="alert"` errors, `role="status"`
  success, and a verb-specific pending/disabled button state — matching
  the pre-existing working pattern exactly, no new UI library introduced.
- **Files changed:** `apps/admin/app/(dashboard)/retailers/[id]/actions.ts`,
  `.../retailers/[id]/page.tsx`,
  `.../retailers/[id]/status-form.tsx` (new),
  `.../retailers/[id]/invite-form.tsx` (new),
  `.../prospects/actions.ts`, `.../prospects/prospects-workbench.tsx`,
  `.../inquiries/actions.ts`, `.../inquiries/inquiries-list.tsx`,
  `.../demo-mode/actions.ts`, `.../demo-mode/page.tsx`,
  `.../demo-mode/demo-logins-form.tsx` (new),
  `.../prospects/[id]/studio/actions.ts`, `.../prospects/[id]/studio/page.tsx`,
  `.../prospects/[id]/studio/demo-publication-form.tsx` (new).
- **Tests:** none added specifically beyond existing suite; the
  monorepo's 548-test unit suite still passes with these changes.
- **Browser evidence:** `setRetailerStatus` exercised end to end in a
  live local browser session — suspend and reactivate both produced
  visible status changes, correct button relabeling, and an explicit
  `role="status"` "Status updated." confirmation. The other five actions
  use the identical wiring pattern but were **not individually exercised
  in a browser** this session.
- **Production evidence:** none — not deployed.
- **Final status: STILL OPEN.** CODE IMPLEMENTED + RUNTIME VERIFIED for
  1 of 6 actions in a real browser; the remaining 5 need the same
  individual exercise (success/failure/pending states) before this can
  be called fully resolved, plus deployment and production verification
  for all six.

---

## SECURITY UNKNOWN

**Determination: UNKNOWN — NOT VERIFIED** (unchanged from
`docs/ENVIRONMENTS.md`'s existing note).

Git history contains no production Supabase secret at any point —
`.env*` has been gitignored since before the claimed exposure date, and
no committed file (past or present) contains a real-looking production
credential. This rules out a **git-history** exposure conclusively. It
cannot rule out the **chat-transcript** exposure the note describes,
because that event, if real, would leave no trace in this repository by
its nature. See `CREDENTIAL-EXPOSURE-ASSESSMENT.md`.

No credential rotation was performed this session — rotating a
production service-role key requires coordinated Vercel environment
variable updates across all three production projects in the same
change, which is a founder-directed action with real breakage risk if
done incompletely, not something to do speculatively.

**Recommendation unchanged from the assessment doc:** rotate the
production Supabase service-role key as a precaution, at a time the
founder chooses, ideally alongside the Blocker 1 migration window.

---

## REGRESSION STATUS

| Check                                               | Result                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint (`pnpm -w lint`)                               | ✅ 12/12 packages pass                                                                                                                                                                                                                                             |
| Typecheck (`pnpm -w typecheck`)                     | ✅ 12/12 packages pass                                                                                                                                                                                                                                             |
| Unit tests (`pnpm -w test`)                         | ✅ 548 passed, 72 skipped, 0 failed                                                                                                                                                                                                                                |
| Integration (error-reporting, `PAON_INTEGRATION=1`) | ✅ 2/2 passed (local Supabase)                                                                                                                                                                                                                                     |
| E2E (Playwright)                                    | ⚠️ Not run this session — pre-existing CI note marks the e2e suite as broken/gated (exit code 254, `.github/workflows/ci.yml`), a pre-existing condition unrelated to this session's changes; not re-diagnosed here                                                |
| Security tests                                      | ⚠️ No dedicated security test suite exists in this repo beyond RLS-focused unit tests, which are included in the "Unit tests" row above                                                                                                                            |
| Migration rehearsal                                 | ✅ Full 249-migration chain, clean database, local Supabase — zero errors. ⚠️ Not rehearsed against restored production data (blocked on backup access, per Blocker 1/4)                                                                                           |
| Browser verification                                | ⚠️ Partial — demo-login blocking verified in browser for all 3 apps; 1 of 6 admin actions verified in browser; remaining 5 admin actions and general role-based workflows (owner/manager/worker/customer journeys beyond what was touched) not walked this session |
| Production smoke test                               | ❌ Not performed — production is currently broken (Blocker 1) and none of this session's fixes are deployed                                                                                                                                                        |

Note on `validate:completion`: the monorepo's `pnpm -w test` pipeline
includes a PHASE.md evidence-freshness check
(`packages/domain/scripts/validate-completion-evidence.ts`) that failed
with stale `gitSha` references — this is a pre-existing evidence-tracking
mechanism for PHASE.md items unrelated to these five blockers, not a
regression introduced by this session. Flagged for awareness, not
treated as a ship blocker for this specific remediation.

---

## PRODUCTION STATUS

- **All production applications:** `paonpaon-admin` and
  `paonpaon-retailer` respond (HTTP 200 per `docs/ENVIRONMENTS.md`'s
  last check); `paonpaon-customer` returns HTTP 500 on storefront routes
  (Blocker 1, unresolved).
- **Critical routes:** `/r/maison-dubois` still broken as of this
  writing — no production fix has been applied.
- **Database schema:** production remains on its pre-2026-07-29 schema;
  `entity_metadata_assignments` and `error_events` do not exist there.
- **Authentication:** unaffected by this session's changes to real user
  auth flows — only demo-persona rejection was added, verified locally,
  not yet deployed.
- **Demo-login:** code fix complete and locally verified; **still live
  in production** until deployed. `NEXT_PUBLIC_DEMO_LOGIN=1` remains set
  on all three Vercel projects (recommended for removal, not yet done).
- **Observability:** code complete and locally verified; **no
  observability exists in production** until deployed and migrated.
- **Deployment/recovery:** a real, honest runbook now exists where none
  did before; it has not yet been executed against production.

---

## SCOPE STATUS

Confirmed: no scope was silently expanded.

- **PARKED remains PARKED:** customer-visibility dashboard, escalation
  dashboard, third-party functionality beyond current release scope,
  parked founder tools, blocked roadmap items — none were touched.
- **BLOCKED remains BLOCKED:** the original PAON production database
  migration remains blocked on the same "approved restore of actual
  data" gate that `docs/ENVIRONMENTS.md` already documented before this
  session; this session did not attempt to route around it.
- **FUTURE remains FUTURE:** Sentry integration was explicitly deferred
  per founder decision, not implemented as a substitute scope expansion.
- Every code change in this session maps directly to one of the five
  confirmed blockers or the credential-exposure investigation. No
  unrelated refactors, redesigns, or new features were introduced.

---

## What "NOT SHIP READY" concretely still requires

In priority order:

1. **Founder:** confirm/enable a production Supabase backup mechanism,
   obtain a restore, rehearse the full migration chain against it per
   `PRODUCTION-MIGRATION-PLAN.md` Phase 1.
2. **Founder:** execute the production migration push
   (`supabase db push --linked`) per Phase 2, including this session's
   `error_events` migration.
3. **Someone with deploy access:** deploy this session's code changes
   (demo-login gate, admin-action fixes, observability wiring) to all
   three `paonpaon-*` Vercel projects.
4. **Post-deploy:** confirm each Vercel Production environment has
   `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` set; remove
   the now-inert `NEXT_PUBLIC_DEMO_LOGIN=1`.
5. **Post-deploy:** run the production smoke test in the original
   mission brief — all app entry points, `/r/maison-dubois`, auth,
   demo-login inaccessibility, one triggered production error confirmed
   in `error_events`.
6. **Browser-verify the remaining 5 of 6 admin actions** individually,
   the same way `setRetailerStatus` was verified this session.
7. **Founder decision** on the credential-rotation recommendation
   (Security Unknown section) — not a code blocker, but an open item.

None of these require new design decisions — they are execution steps
against plans this session produced. But they have not happened, and
claiming SHIP READY before they do would be exactly the "appearance of
completeness" failure mode this mission was explicit about avoiding.
