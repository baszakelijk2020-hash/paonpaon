# PAON Platform Admin — Human-Acceptance Audit Report

**Date**: 2026-08-21  
**Persona**: Platform Owner (contact@nebelspiegel.com, role: `platform_owner`)  
**Scope**: Admin app only, port :3010. Local Supabase (:54321)  
**Browsers**: Desktop (1440×900) + Mobile (390×844)

---

## Executive Summary

Comprehensive browser-driven audit of the PAON admin app across 7 test areas (login, dashboard, retailer management, new retailer creation, platform features, mobile, permissions). **One critical P0 defect discovered** during retailer creation workflow—a database permission error (code 42501) that blocks the core platform operator function of onboarding new retailers via the UI. Earlier API-level fix (migration 13ed9d8) did not cover the browser submission path, leaving a gap in test coverage.

**Release certification**: ⛔ **HOLD** pending P0 resolution → **RESOLVED, see follow-up below.**

---

## ROOT CAUSE FOUND AND FIXED (coordinating-agent follow-up, 2026-08-21)

This P0 is real, but the auditing agent's stated root cause ("earlier API-level fix did not
cover the browser submission path") is **incorrect** — it's not a code-path gap. Direct
database inspection immediately after this finding was reported showed:

```
select proname, prosecdef from pg_proc where proname in
  ('ensure_default_retailer_virtual_try_on_policy','ensure_default_retailer_visual_preset');
 ensure_default_retailer_visual_preset         | f
 ensure_default_retailer_virtual_try_on_policy | f
```

Both trigger functions had `prosecdef = f` — the `SECURITY DEFINER` fix from migration
`13ed9d8` (committed to git) was **not actually applied to this local database**, and
`supabase_migrations.schema_migrations` had no record of the `20260820` migrations at all.

**Actual root cause of the regression:** the original fix (see `RELEASE-BLOCKERS.md` B1) was
applied to local Postgres via `psql -f` directly, never through Supabase's CLI migration
tracking (the CLI's own migration-apply command failed with an unrelated
`LegacyMigrationMissingLocalError` at the time, which is why `psql -f` was used as a
workaround). Because the fix was never registered in `schema_migrations`, it did not survive
whatever caused the local Supabase Postgres data to reset between the original verification
(2026-08-20) and this audit pass (2026-08-21) — most plausibly a `supabase start`/container
cycle against a fresh data volume during one of several session interruptions in this
timeframe. This is the **same durability gap already flagged once** in
`RELEASE-CERTIFICATION-SUMMARY.md`'s outstanding-action-item note about committing the
migrations — committing them to git was necessary but not sufficient, since this local
environment isn't `supabase link`-ed to a project ref, so `supabase migration up` can't track
them either.

**Fix applied:** re-ran both migration files directly against local Postgres and verified:

```
select proname, prosecdef from pg_proc where proname in (...);
 ensure_default_retailer_visual_preset         | t
 ensure_default_retailer_virtual_try_on_policy | t
```

Both functions are now `SECURITY DEFINER` again. This resolves the 42501 error at the
database layer that this agent hit in the browser.

**Browser-level re-verification (2026-08-21, via peer session on this machine, independently
challenged and confirmed):** a peer session initially proposed an alternative theory — that
the browser had hit a stale Next.js process serving a different git checkout on the same
port — and reported success without first isolating whether that theory or the DB fix above
was the actual cause. That theory was checked and ruled out: this environment runs exactly
one local Supabase Postgres instance system-wide (confirmed via `docker ps` — a single
`supabase_*_paon` container set), and the "stale" checkout's own `.env.local` points at the
same `localhost:54321`, so a 42501 Postgres permission error cannot be explained by which
checkout's server rendered the page — both would hit the identical database. On being
challenged for evidence, the peer re-ran the test properly: confirmed `prosecdef = t`
immediately beforehand, started a demonstrably fresh server process (verified via
`lsof`/`ps`), and ran the retailer-creation flow with explicit timestamps
(03:36:51.593Z–03:36:54.631Z) cross-checked against the server log tail taken immediately
after — `POST /retailers/new` returned 303, redirected cleanly to the new retailer's detail
page, zero errors in that window. Two separate clean runs confirmed. The peer retracted the
stale-worktree theory as the explanation for the original 42501.

**Conclusion:** the P0 is resolved. Root cause was the DB-level `SECURITY DEFINER` reversion
described above (not a worktree/routing issue), the fix has been re-applied, and it has now
been verified working through an actual browser-driven retailer-creation flow, not just a
raw API call. The stray dev server on :3000 serving an unrelated checkout was a real but
unrelated hygiene issue, independently found and killed.

**Standing risk:** because this environment has no durable migration-tracking mechanism
(`supabase link` was never run), this exact regression can recur on any future Postgres data
reset. This is an infrastructure gap, not a one-time bug — it should be flagged to the
founder as needing either `supabase link` + `supabase db push`, or an explicit note in
onboarding docs that `supabase/migrations/*.sql` must be replayed via `supabase db reset`
(which does apply every file in that directory, unlike `supabase start` on an existing
volume) after any environment rebuild.

---

## Test Results by Area

### ✅ Step 1: Login

- **Status**: PASS
- **Evidence**: Successfully authenticated as `contact@nebelspiegel.com` (platform_owner role)
- **Screenshots**: 01-login-page.png, 02-login-form-filled.png, 03-dashboard-after-login.png

### ✅ Step 2: Dashboard / Platform Overview

- **Status**: PASS
- **Visibility**: Dashboard displays "The network, clearly in view"
- **Metrics visible**: 6 active retailers, 35 known clients, 35 orders (30 days), 4 open garments
- **Assessment**: Platform-level cross-retailer oversight working correctly
- **Screenshot**: 03-dashboard-after-login.png

### ✅ Step 3: Retailer List / Network Management

- **Status**: PASS
- **Outcome**: Navigated to Retailer network page showing 6 operating houses
- **Features**: Onboarding option present ("Onboard a retailer" link visible)
- **Screenshot**: 04-retailer-network-page.png

### ⛔ Step 4: CREATE NEW RETAILER (Critical Test)

- **Status**: **P0 FAILURE**

**Procedure**:

1. Clicked "Onboard a retailer" link → Opened `/retailers/new` form
2. Form displays all required fields: Retailer section (Legal name, Display name, Slug), Billing address (Address line 1, City, Postal code, Country code), Owner section (Full name, Email)
3. **Filled all required fields**:
   - Legal name: `Test Retailer 1787282285559`
   - Display name: `Test Display 1787282285559`
   - Slug: `test-1787282285559`
   - Billing Address line 1: `123 Main Street`
   - City: `Test City`
   - Postal code: `12345`
   - Country code: `US`
   - Owner Full name: `Platform Auditor 1787282285559`
   - Owner Email: `audit-1787282285559@paon.test`
4. Clicked "Create retailer & send invite" button
5. **FAILURE**: Page displayed Next.js Runtime Error
   - **Error code**: 42501
   - **Component**: RetailerForm (line 26:7 in `app/(dashboard)/retailers/new/page.tsx`)
   - **Type**: Database authorization/permission error

**Root Cause Analysis**:

- Migration 13ed9d8 (referenced in audit scope) was verified to fix DB trigger bugs **via API-level tests only**
- The fix did not account for the browser-based Server Action submission path
- Form validation (client-side) passes—error occurs at database permission layer during row creation
- Error 42501 in Next.js typically indicates insufficient RLS policy permissions or missing database grants

**Impact**:

- **Blocking defect**: Platform operators cannot create retailers through the UI
- **Scope**: Core operational function unavailable
- **Fallback**: API-level retailer creation may work (not tested in this audit)

**Recommendation**: Investigate Supabase RLS policies on `retailers` table and verify `platform_owner` role has INSERT permission through Server Actions. Retest full UI flow after fix.

**Screenshots**:

- 05-onboard-form-empty.png (empty form)
- 06-form-filled-complete.png (filled form)
- 07-onboard-result.png (error state)

### ✅ Step 5: Platform Features (Daily Briefing)

- **Status**: PASS
- **Feature**: Daily briefing accessible at `/daily-briefing`
- **Display**: Platform morning brief with health overview
- **Screenshot**: 08-daily-briefing.png

### ✅ Step 6: Mobile Testing (390×844 viewport)

- **Status**: PASS (partial)
- **Desktop login**: Responsive and functional
- **Dashboard**: Renders correctly, menu accessible
- **Retailer network**: Link visible in sidebar, navigation has minor delay but resolves
- **Assessment**: Responsive design works; no layout breaks observed
- **Screenshots**: 09-mobile-login.png, 10-mobile-dashboard.png, 11-mobile-retailer-network.png

### ✅ Step 7: Permission Boundaries

- **Status**: PASS
- **Findings**:
  - Platform admin can view: network dashboard, retailer list, create form
  - No inappropriate cross-retailer data leaks observed
  - Retailer network list shows aggregated stats only (no retailer-specific secrets)
  - Permission model correctly restricts platform operators to platform-level views

---

## Defect Classification

| Issue                                      | Type | Severity          | Status                 |
| ------------------------------------------ | ---- | ----------------- | ---------------------- |
| Retailer creation form (42501 error)       | P0   | Critical/Blocking | Open                   |
| Mobile retailer network navigation timeout | P3   | Minor/UX          | Acceptable for release |

---

## Summary Table

| Test Area           | Browser (Y/N) | Mobile (Y/N) | Result            | Issues   |
| ------------------- | ------------- | ------------ | ----------------- | -------- |
| Login               | Y             | Y            | PASS              | 0        |
| Dashboard           | Y             | Y            | PASS              | 0        |
| Retailer Network    | Y             | Y            | PASS              | 0        |
| **Create Retailer** | Y             | N/A          | **FAIL**          | **1 P0** |
| Daily Briefing      | Y             | N            | PASS              | 0        |
| Mobile Pages        | N             | Y            | PASS              | 1 P3     |
| **Certification**   | **HOLD**      | —            | **Blocked by P0** | —        |

---

## Verification Notes

**P0 Issue Confirmation**: The retailer creation failure represents a gap between API-level testing (which passed) and browser UI testing (which failed). The form correctly validates all fields client-side, and submission reaches the backend, but the database permission error (42501) indicates a mismatch in the RLS policies or Server Action permissions. This must be resolved before the fix from migration 13ed9d8 can be considered complete for browser-based workflows.

**Mobile UX**: Sidebar navigation on 390×844 is slightly slower than desktop but functional. Acceptable for release with minor polish noted.

**Security**: No permission boundaries violated during audit. Platform admin isolation is correct.

---

## Recommendation

**Do not ship** until P0 is resolved. The blocking defect prevents platform operators from performing their primary operational task (retailer onboarding). A hotfix addressing the RLS policy for the `retailers` table Server Action is required.

After fix:

1. Verify retailer creation succeeds through browser UI
2. Confirm new retailer is accessible in retailer list
3. Run full e2e test suite to ensure no regression
4. Re-run this audit on the fixed build

---

**Report generated by**: PAON human-acceptance audit automation  
**Screenshots location**: `/private/tmp/paon-claude-nguyen2/docs/audits/release-certification-2026-08-20/screenshots-human-acceptance/platform-admin/`  
**Findings data**: `findings.json`
