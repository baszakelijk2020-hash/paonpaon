# PAON Release Blockers — Classification & Evidence

**Generated:** 2026-08-21  
**Audit Scope:** Four business journey verdicts (retailer-onboarding, customer-journey, retail-worker-journey, manager-journey, third-party-journey)  
**Classification System:** P0 (cannot ship) | P1 (must fix before selling) | P2 (should fix before wide rollout) | P3 (post-launch) | PARKED | BLOCKED | UNKNOWN

---

## P0: CANNOT SHIP

### 1. Credential Exposure Unresolved (21 days)

**Origin Journey:** All (retailer-onboarding, customer, worker, manager)  
**Evidence:** Production-config audit finding, credential exposed in chat 2026-08-01 in Supabase secret key  
**Impact:** Immediate compromise of all three apps upon any deployment with real data; all customer/retailer data at risk  
**Why P0:** Active security incident; no authenticated user data can be trusted with this credential live  
**Fix Effort:** 2–4 hours (credential rotation + redeployment)  
**Status:** BLOCKED on founder decision to rotate credentials immediately

---

### 2. Production Schema Mismatch (entity_metadata_assignments Table)

**Origin Journeys:** customer-journey (Step 3 Profile), retailer-onboarding (Stage 5 First Customer)  
**Evidence:**

- Missing table in production: `entity_metadata_assignments`
- Code expects table: `apps/customer/app/(dashboard)/account/page.tsx:54` (`getEntityMetadataAssignments()`)
- Migration exists but not applied: `supabase/migrations/20260810000000_add_entity_metadata_assignments.sql`
- **Result:** HTTP 500 on `/account` when customer logs in; entire customer profile functionality broken

**Impact:** Customer journey cannot proceed past Step 3 (Profile Setup) → cannot reach appointment/order management → revenue-blocking  
**Why P0:** Production is currently failing (verified); blocking all Stage 5+ work in live environment  
**Fix Effort:** 1–2 hours (apply migration + verify schema)  
**Status:** Requires migration rehearsal with founder approval (see blocker #5)

---

### 3. No Error Tracking / Monitoring Infrastructure

**Origin Journeys:** All (retailer-onboarding, customer, worker, manager)  
**Evidence:**

- Codebase grep: zero instances of Sentry/Rollbar/NewRelic across all apps
- Production failures (HTTP 500 above) require manual log review to detect
- Cron job failures (processWardrobeVisualizations) invisible until manual audit
- Silent admin action failures (see P1 blockers) undetectable by operations staff

**Impact:** Cannot detect cascading issues, alerts, or rollback triggers; operational blindness in production  
**Why P0:** Ship without observability = undetectable incidents; cannot safely operate platform at scale  
**Fix Effort:** 4–6 hours (Sentry integration across apps, alert rules, dashboard)  
**Status:** BLOCKED on founder infrastructure decision

---

### 4. Demo Login Still Enabled on All Production Vercel Projects

**Origin Journeys:** All (noted in retailer-onboarding, customer journey)  
**Evidence:**

- `NEXT_PUBLIC_DEMO_LOGIN=1` set on production Vercel deployments
- Allows any user to sign in without password once real customer/retailer data exists
- Retail worker journey audit notes: "demo-login button overrides typed credentials — UX risk but functionally transparent"

**Impact:** Any person can impersonate any user (retailer staff, manager, customer) with real business data; GDPR/compliance violation  
**Why P0:** Data security incident; real PII/payment data accessible without authentication  
**Fix Effort:** 15 minutes (disable flag on three Vercel projects)  
**Status:** BLOCKED on founder confirmation

---

### 5. Database Migration Path Untested on Production Data

**Origin Journey:** retailer-onboarding (Stage 8, DAILY OPERATION)  
**Evidence:**

- 249 migrations in `supabase/migrations/` directory never applied to production environment
- No rollback procedure documented
- No rehearsal with real data to verify idempotency or data loss
- Current production schema lags code expectations (blocker #2 proves this)

**Impact:** Cannot safely migrate production to match application code; risk of data loss, corruption, or downtime  
**Why P0:** Cannot move from staging to production; migration is single-point-of-failure for go-live  
**Fix Effort:** 6–8 hours (dry-run migration, verify idempotency, document rollback procedure, rehearse with founder)  
**Status:** BLOCKED on founder rehearsal + approval

---

### 6. Third-Party Journey MISSING (Scope Decision Required)

**Origin Journey:** third-party-journey (entire journey)  
**Evidence:**

- No third-party (service partner) user accounts, authentication, or portal
- Service partners exist only as data entities managed by retailers (`/service-partners` in retailer app only)
- No work assignment inbox, status update mechanism, or billing for third parties
- Alteration workflow requires manual out-of-band communication (phone/email)

**Impact:** External workshops cannot participate in workflow; entire third-party fulfillment manual and error-prone  
**Why P0 or PARKED:** If third-party participation required for MVP → cannot ship. If deferred → PARKED for Phase 2+  
**Fix Effort:** 40–60 hours (auth, portal, work queue, status API, billing)  
**Status:** BLOCKED on product scope decision

---

### 7. Manager Cannot See Customers (Admin App Missing CUSTOMERS Phase)

**Origin Journey:** manager-journey (Phase 3 CUSTOMERS)  
**Evidence:**

- Admin app has 47 documented capabilities; zero customer management routes
- No `/customers`, `/customer-search`, or customer profile access
- Customer data visible only through aggregated metrics in `/daily-briefing`
- Manager must switch to retailer app or bypass admin entirely to access customer detail

**Impact:** Platform manager has zero visibility into customer issues, disputes, or escalations; cannot operate platform  
**Why P0 or P1:** If customer management required for MVP → P0 (cannot ship). If deferred → P1 (must add immediately post-launch)  
**Fix Effort:** 8–12 hours (customer search, detail pages, messaging, history)  
**Status:** BLOCKED on product scope decision (MVP vs Phase 2)

---

## P1: MUST FIX BEFORE SELLING

### 8. Seven Silent Failure Modes in Admin App

**Origin Journey:** manager-journey (OPERATIONS phase)  
**Evidence:** Admin app actions return `Promise<void>` without error state; all failures uncaught:

| Action                          | File                                                              | Consequence                                                                          | Journey Impact                                  |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `setRetailerStatus()`           | `retailers/[id]/actions.ts:238–251`                               | Suspend/activate fails silently; retailer storefront still accessible when suspended | Manager onboarding broken (Stage 2 lost)        |
| `resendStaffInvite()`           | `retailers/[id]/actions.ts:253–272`                               | Staff invite fails, staff member thinks invited but never receives email             | Retailer staffing blocked                       |
| `updateProspectStage()`         | `prospects/actions.ts:70–82`                                      | Sales pipeline stalls silently; founder unaware prospect stuck                       | Sales operations blind                          |
| `setDemoPublication()`          | `prospects/[id]/studio/actions.ts:319–328`                        | Demo environment fails to publish; founder sends non-existent link                   | Prospect demos broken                           |
| `updateInquiryStatus()`         | `inquiries/actions.ts:12–23`                                      | Lead triage fails silently; inquiry stuck in wrong status                            | Lead triage broken                              |
| `setDemoLoginsActive()`         | `demo-mode/actions.ts:44–65`                                      | Toggle throws unhandled error; cron loop stops on first failure                      | Demo mode toggling fails                        |
| `processWardrobeVisualizations` | `admin/api/cron/process-wardrobe-visualizations/route.ts:182–212` | Partial job failures not monitored; high failure rate invisible                      | Wardrobe visualization async job silently fails |

**Impact:** Every critical operation (retailer suspension, staff invitation, sales tracking, demo publishing) fails silently without user feedback; staff blind to failures; cascading issues  
**Why P1:** Operations team cannot see when critical actions fail; leads to data inconsistency, customer impact, and debugging nightmares  
**Fix Effort:** 4 hours (convert void returns to error-state, add UI error rendering using existing templates from `billing-panel.tsx`)  
**Status:** Code exists to fix; no blockers

---

### 9. Worker Role (production_staff) Cannot Access CUSTOMER Step

**Origin Journey:** retail-worker-journey (Step 3 CUSTOMER access denied)  
**Evidence:**

- RLS policy: `production_staff` role has no access to `/customers` route
- Role completeness audit: "production_staff... Dashboard redirects to `/orders`; orders, alterations, no appointments/messages/customers"
- Worker cannot see customer list; can only access via `/alterations` workaround (pre-established customer linkage required)

**Impact:** Prescribed worker journey broken; staff must use workaround to complete tasks  
**Why P1:** Journey is functionally complete (alterations exist) but prescribed path is blocked; UX friction and training overhead  
**Fix Effort:** 2–3 hours (grant `production_staff` access to customers table + route, test RLS policies)  
**Status:** Code complete; permission/RLS adjustment needed; no blockers

---

### 10. Exception/Escalation Dashboard Missing (Admin App Missing EXCEPTIONS Phase)

**Origin Journey:** manager-journey (Phase 5 EXCEPTIONS)  
**Evidence:**

- Admin app inventory: 47 capabilities documented; zero incident/exception handling routes
- No `/exceptions`, `/escalations`, `/service-recovery`, or incident tracking dashboard
- Service recovery exists in retailer app (retailer staff can request goodwill) but zero admin visibility
- Manager cannot see exceptions/incidents across all retailers, escalate, track resolution, or identify patterns

**Impact:** Platform manager cannot respond to customer escalations or systemic issues; no visibility into service recovery requests  
**Why P1:** Operational necessity; manager must see exceptions to triage and escalate; lack of visibility = poor customer experience  
**Fix Effort:** 6–8 hours (exception dashboard, escalation queue, resolution tracking)  
**Status:** BLOCKED on product scope (MVP requirement vs Phase 2)

---

### 11. Database Migration Rehearsal Required

**Origin Journey:** retailer-onboarding (Stage 8 DAILY OPERATION)  
**Evidence:** 249 migrations in `supabase/migrations/` have never been applied to production data with rollback rehearsal  
**Impact:** Cannot execute go-live migration with confidence; single point of failure  
**Why P1:** Not blocking code, but required before any production deployment  
**Fix Effort:** 6–8 hours (dry-run, verify, document rollback, get founder sign-off)  
**Status:** Operational task; no code blockers

---

## P2: SHOULD FIX BEFORE WIDE ROLLOUT

### 12. Data Integrity: Foreign Key Constraints Using SET NULL

**Origin Journey:** retailer-onboarding (Data Integrity section)  
**Evidence:**

- Table: `prospect_demo_environments` → Migration: `20260728000001:7`
  - Foreign key: `retailer_id` uses `ON DELETE SET NULL`
  - Risk: Orphaned demo environments when retailers deleted
- Table: `audit_log_entries` → Migration: `20260719000101:443`
  - Foreign key: `retailer_id` uses `ON DELETE SET NULL`
  - Risk: Orphaned audit records break tenant isolation lookup

**Impact:** Orphaned records accumulate; audit trail integrity compromised; tenant isolation vulnerabilities  
**Why P2:** Not blocking ship (functioning with limitations) but data integrity risk; should fix before wide rollout  
**Fix Effort:** 2 migrations (CASCADE constraints) ~30 minutes  
**Status:** Code exists; reversible; no blockers

---

### 13. Settings Profile Update Missing Eventual Consistency Revalidation

**Origin Journey:** retailer-onboarding (Stage 3 CONFIGURATION)  
**Evidence:**

- File: Retailer settings profile update action
- Issue: Missing `revalidatePath()` after database mutation
- Impact: User sees stale settings briefly until cache expires

**Why P2:** Cosmetic UX issue; data persists correctly; cache eventually consistent  
**Fix Effort:** 1 line of code (add revalidatePath call)  
**Status:** Minor; no blockers

---

## P3: POST-LAUNCH

### 14. Demo-Login Button UX (Already Noted)

**Origin Journey:** retail-worker-journey  
**Evidence:** Demo login button silently overrides typed credentials; UX confusion but functionally transparent  
**Why P3:** Deferred by audit rules ("already logged"); cosmetic UX issue  
**Status:** Known, deferred

---

## PARKED (Intentionally Out of Scope)

### 15. Third-Party Journey (If Deferred from MVP)

**Origin Journey:** third-party-journey  
**Evidence:** Entire journey missing; no auth, portal, work queue, or billing for service partners  
**Decision Required:** If product scope says third-parties Phase 2+ → classify as PARKED  
**Status:** BLOCKED on founder scope decision

---

## BLOCKED (External Dependency / Founder Decision)

### 16–20. All Five Hard Blockers (#1–5 above) BLOCKED on Founder Sign-Off

- Credential rotation decision + execution
- Schema migration rehearsal + approval
- Error tracking infrastructure decision
- Demo-login disable approval
- Database migration strategy approval

---

## UNKNOWN (Insufficient Evidence)

None identified. All findings have concrete evidence citations.

---

## Summary by Severity

| Severity    | Count | Blocking Ship     | Requires Founder Decision                             |
| ----------- | ----- | ----------------- | ----------------------------------------------------- |
| **P0**      | 7     | YES               | 5 items (all hard blockers)                           |
| **P1**      | 4     | YES (operational) | 2 items (EXCEPTIONS scope, customer visibility scope) |
| **P2**      | 2     | NO                | None                                                  |
| **P3**      | 1     | NO                | None                                                  |
| **PARKED**  | 1     | Conditional       | 1 (third-party scope)                                 |
| **BLOCKED** | 5     | YES               | All (founder decisions pending)                       |

**Total Release Blockers:** 12 (7 P0 + 5 hard-blocked on founder)

---

## Critical Path to Ship

1. **Immediate (Day 0):** Rotate Supabase credentials (blocker #1)
2. **Day 0–1:** Disable demo-login flag on production; apply schema migration #2; set up error tracking (blockers #2–4)
3. **Day 1–2:** Rehearse database migration with founder; document rollback (blocker #5)
4. **Day 2–3:** Fix 7 silent failures in admin (blocker #8)
5. **Day 3–4:** Resolve MVP scope: is customer mgmt + exceptions required? If yes, build (blockers #7, #10)
6. **Day 4–5:** Resolve MVP scope: is third-party journey required? If yes, defer; if no, PARK (blocker #6)
7. **Day 5–6:** Fix worker role access to customers (blocker #9); fix FK constraints (blocker #12)
8. **Go-live:** All P0 + P1 blockers cleared; production environment validated

**Estimated Time to Ship-Ready:** 5–10 business days (dependent on founder scope/approval decisions)
