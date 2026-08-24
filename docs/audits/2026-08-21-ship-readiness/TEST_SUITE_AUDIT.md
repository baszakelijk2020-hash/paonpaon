# PAON Test Suite Quality Audit — 2026-08-21

## Executive Summary

PAON has **533 total test files** across unit, integration, and e2e coverage. Test distribution is **heavily skewed toward e2e (147 tests)** with modest unit/mock coverage (381 tests) and minimal true database integration tests (5 tests). **False confidence risk is moderate to high** in several areas: critical business logic is tested only through UI journeys, many Server Actions lack dedicated unit tests, and RLS/authorization verification is incomplete.

**Recommendation**: Differentiate TESTED-GENUINELY from TESTED-BY-PROXY. The test suite provides good end-to-end confidence for happy paths but weak coverage for authorization boundaries, data persistence guarantees, and error handling across system tiers.

---

## Test Distribution

### By Category

| Category                  | Count | Location                                                                   | Coverage Type                                 |
| ------------------------- | ----- | -------------------------------------------------------------------------- | --------------------------------------------- |
| **E2E (Playwright)**      | 147   | `apps/*/e2e/*.spec.ts`                                                     | Browser automation, real Supabase             |
| **Unit + Mocked**         | 381   | `packages/*/src/*.test.ts`                                                 | Business logic, domain models, query builders |
| **Integration (Live DB)** | 5     | `packages/database/src/repositories/__integration__/*.integration.test.ts` | Real Postgres constraints, unique indexes     |
| **Migration Security**    | 39    | `packages/database/src/repositories/*security.test.ts`                     | RLS syntax verification only                  |
| **Total**                 | 533   | —                                                                          | —                                             |

### By App/Package

```
apps/admin/e2e           7 Playwright tests
  ├─ login.spec.ts
  ├─ retailer-onboarding.spec.ts
  ├─ demo-experience.spec.ts
  ├─ billing.spec.ts
  ├─ commercials.spec.ts
  ├─ demo-studio.spec.ts
  └─ dispatch-emails-cron.spec.ts

apps/customer/e2e        65 Playwright tests (largest coverage)
  ├─ Wardrobe workflows (wardrobe.spec.ts, wardrobe-card-reveal.spec.ts)
  ├─ Shopping (storefront.spec.ts, cart-soft-close.spec.ts, one-tap-checkout.spec.ts)
  ├─ Appointments (appointments-alterations.spec.ts)
  ├─ Corporate/Employee portal (multiple specs)
  ├─ Concierge services (concierge.spec.ts, tableservice-*.spec.ts)
  ├─ Content (morning-routine-*.spec.ts, dashboard-morning-routine-hero.spec.ts)
  └─ AI features (silhouette-analysis.spec.ts, virtual-studio.spec.ts)

apps/retailer/e2e        75 Playwright tests (largest test file count)
  ├─ Staff operations (staff-profile.spec.ts, staff-announcements.spec.ts, payroll.spec.ts)
  ├─ Corporate/Wearer programs (corporate-*.spec.ts, 14 files)
  ├─ Appointments (appointment-brief.spec.ts)
  ├─ AI workflows (academy-roleplay*.spec.ts, concept-generation.spec.ts)
  ├─ Analytics (analytics.spec.ts, customer-rankings.spec.ts)
  ├─ Operational (pos.spec.ts, inventory.spec.ts, service-partners.spec.ts)
  └─ Canonical proof (canonical-house.spec.ts)

packages/database        109 tests total
  ├─ Unit/Mocked:  70 repository + orchestrator tests
  │   ├─ Repository mapping tests (mocked Supabase, not real DB)
  │   │   └─ product-repository.test.ts, availability-window-repository.test.ts, etc. (using fakeQueryBuilder)
  │   └─ Orchestrator tests (mocked clients)
  │       └─ campaign-activation-orchestrator.test.ts, morning-routine-delivery-orchestrator.test.ts, etc.
  │
  ├─ Migration RLS Verification: 39 *-security.test.ts files
  │   └─ LIMITATION: Verify migration SQL contains RLS strings, NOT actual enforcement
  │
  └─ Integration (Live Postgres): 5 files (SKIPPED unless PAON_INTEGRATION=1)
      ├─ stage-11-12-live.integration.test.ts
      ├─ loss-prevention-live.integration.test.ts
      ├─ stock-ledger-live.integration.test.ts
      ├─ stock-single-truth.integration.test.ts
      └─ pos-live.integration.test.ts

packages/auth            2 tests
  ├─ guards.test.ts (authorization function testing)
  └─ session.test.ts (session resolution logic)

packages/ai              9 tests (mocked OpenAI provider)

packages/payments        5 tests

packages/sms             1 test

packages/email           1 test

packages/utils           1 test

packages/ui              0 tests

packages/eslint-config   0 tests

packages/typescript-config 0 tests
```

---

## Coverage Quality Analysis

### ✅ Genuinely Covered (High Confidence)

#### 1. **End-to-End Happy Paths (E2E)**

- **Evidence**: 147 Playwright tests across customer, retailer, admin apps
- **Quality**: Tests use real Supabase clients, real session generation, real database writes
- **Scope**: Login, onboarding, appointment booking, alterations workflow, corporate wearer setup, payments flow
- **What Works**: UI interactions, form submission, navigation, cross-page state transitions
- **Example**: `/apps/customer/e2e/appointments-alterations.spec.ts`
  - Creates real customer record
  - Generates magic link via Supabase admin API
  - Tests appointment request and alteration status verification
  - Verifies database persistence via admin client queries
  - File path: `/Users/nguyen/Projects/PAON/apps/customer/e2e/appointments-alterations.spec.ts`

#### 2. **Test Data Provisioning**

- **Evidence**: Comprehensive global setup files in each app's e2e suite
- **Quality**: Creates idempotent, reusable test fixtures using actual repository APIs
- **Scope**: Retailers, customers, products, alterations, staff, workshops, corporate accounts
- **Example**: `/apps/customer/e2e/global-setup.ts` (lines 34-299)
  - Creates retailer, enables all modules
  - Sets up customer with email
  - Creates product with variant
  - Provisions full alteration workflow with state transitions
  - Uses transactional garment-first intake and validated transition paths
  - File path: `/Users/nguyen/Projects/PAON/apps/customer/e2e/global-setup.ts`

#### 3. **Authorization & Tenant Isolation (Selective)**

- **Evidence**: Some e2e tests explicitly verify cross-tenant refusal
- **Quality**: Real database assertions, not just UI mocking
- **Example**: `/apps/retailer/e2e/employee-portal-customer-link.spec.ts` (lines 49-159)
  - Creates wearer in retailer A
  - Creates customer in retailer A, links successfully
  - Creates customer in retailer B
  - Attempts to link cross-tenant customer — **verifies it fails**
  - Asserts database state didn't change via admin query
  - File path: `/Users/nguyen/Projects/PAON/apps/retailer/e2e/employee-portal-customer-link.spec.ts`
- **Limitation**: Only 7 authorization-related assertions across all e2e tests (grep found 7 lines mentioning authorization/permission/forbidden)

#### 4. **Database Schema Integrity (Migration Verification)**

- **Evidence**: 39 `*-security.test.ts` files
- **Quality**: **SYNTAX ONLY** — tests read migration SQL files as text strings and verify RLS clauses exist
- **Scope**: Style profiles, virtual try-on, advisor capture, service plans, alterations, wardrobe, knowledge, staff recognition, internal community, and more
- **Example**: `/packages/database/src/repositories/style-profile-security.test.ts`
  - Reads migration file
  - Verifies `enable row level security` strings present
  - Verifies `revoke all on table ... from anon` present
  - Does NOT test that constraints actually fire
  - File path: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/style-profile-security.test.ts`
- **Critical Limitation**: These are **FALSE CONFIDENCE markers** — as stated in `/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` lines 2-17:
  > "The `*-security.test.ts` files read migration `.sql` files as TEXT and assert they contain a constraint string. That proves the migration SAYS the right thing. It does not prove a single constraint ever fires."

#### 5. **Live Database Integration (Minimal but Genuine)**

- **Evidence**: 5 live integration test files (skipped by default, only run with `PAON_INTEGRATION=1`)
- **Quality**: Real Postgres constraint testing
- **Scope**: Coverage planning, loss prevention, stock ledger, POS, single truth
- **Example**: `/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` (lines 68-96)
  - Tests coverage_plans UNIQUE constraint with NULL handling
  - Verifies REJECT behavior for duplicate whole-retailer plans
  - Tests CHECK constraints (e.g., published state without publisher)
  - Uses real Supabase admin client
  - File path: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts`
- **Limitation**: **Only 5 files**, **not run in CI by default**, covers 2 schema stages (11-12) out of ~16+

#### 6. **Business Logic & Data Mapping (Unit Tests)**

- **Evidence**: 381 unit/mocked tests in packages
- **Quality**: Tests cover logic but use **fake query builders**, not real DB
- **Scope**: Authorization guards, session resolution, repository mapping, orchestrator logic
- **Examples**:
  - `packages/auth/src/guards.test.ts`: Tests role hierarchy, permission enforcement
  - `packages/auth/src/session.test.ts`: Tests session type resolution from claims
  - `packages/database/src/repositories/product-repository.test.ts`: Tests row-to-domain mapping
  - File paths: `/Users/nguyen/Projects/PAON/packages/auth/src/guards.test.ts`, `/Users/nguyen/Projects/PAON/packages/auth/src/session.test.ts`, `/Users/nguyen/Projects/PAON/packages/database/src/repositories/product-repository.test.ts`

---

### ⚠️ Partially Covered / False Confidence

#### 1. **Authorization Boundaries**

- **Status**: PARTIALLY TESTED, MOSTLY UNVERIFIED
- **What's Tested**:
  - `packages/auth/src/guards.test.ts` has 8 authorization test cases (e.g., requirePlatformSession, requireRetailerSession) — these use mock sessions, not real users/tokens
  - `/apps/retailer/e2e/employee-portal-customer-link.spec.ts` explicitly tests cross-tenant refusal
- **What's NOT Tested**:
  - No e2e tests for unauthorized access attempts (e.g., customer accessing retailer routes, retailer accessing platform routes)
  - No Server Action tests for authorization failures
  - No tests verifying RLS policies reject unauthorized queries in live DB (except the 5 integration tests, and those are skipped by default)
  - Platform admin vs. support_agent permission differences not tested end-to-end
- **Risk**: Authorization bypasses could exist undetected in live code paths

#### 2. **Server Actions & API Routes (Next.js)**

- **Status**: NO UNIT TESTS, TESTED ONLY VIA E2E
- **What's Not Tested**:
  - All Server Actions in apps (`*/app/*/actions.ts`) have no dedicated tests
  - No isolated testing of Server Action validation, error handling, or authorization
  - Error conditions (400, 403, 500) tested only if e2e journey encounters them naturally
- **Count**: ~50+ Server Action files found, zero dedicated unit tests
- **Risk**: Server Action bugs and authorization gaps go undetected until e2e runs

#### 3. **Persistence & Transactionality**

- **Status**: PARTIALLY TESTED
- **What's Tested**:
  - E2e tests assert database state after complex workflows (e.g., alteration transitions)
  - Integration tests verify unique constraints and check constraints fire
- **What's NOT Tested**:
  - No tests for transaction rollback on partial failures
  - No tests for concurrent operations (race conditions)
  - No tests for orphaned records if cascade logic fails
  - Repository tests use **mocked query builders** that don't execute real DB calls
- **Risk**: Data consistency bugs in multi-step operations

#### 4. **RLS Enforcement (Row Level Security)**

- **Status**: MIGRATION SYNTAX VERIFIED, ACTUAL ENFORCEMENT NOT TESTED
- **What's Tested**:
  - 39 migration files have `enable row level security` strings verified
  - 5 integration tests exist but are skipped by default
  - Integration tests have NOT been verified to test RLS policies (only generic constraints)
- **What's NOT Tested**:
  - No e2e tests that attempt cross-tenant or cross-customer data access to verify RLS rejects
  - No tests of specific RLS policy logic
  - No tests of RLS bypass via service_role abuse in app code
  - All tests use service_role key (admin access) for setup, not end-user RLS policies
- **Risk**: RLS policies could be malformed, missing, or insufficient without detection
- **File**: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` lines 13-22 explicitly state this gap

#### 5. **Error Handling & Edge Cases**

- **Status**: INCOMPLETE
- **What's Tested**:
  - E2e tests some validation failures (e.g., duplicate slug in onboarding)
  - Auth tests mock some error paths
- **What's NOT Tested**:
  - Network failures during Supabase operations
  - Concurrent conflicting updates
  - Boundary conditions (empty results, max query limits)
  - Graceful degradation when optional services fail
- **Risk**: Silent failures, data corruption, or poor UX in error conditions

---

### ❌ Not Covered / Critical Gaps

#### 1. **No Unit Tests for UI Components or Pages**

- **Apps**: `apps/admin`, `apps/customer`, `apps/retailer` have **zero component/page unit tests**
- **Tools**: Playwright e2e is the only client-side test mechanism
- **Risk**: Component logic bugs, CSS regressions, accessibility issues undetected until e2e

#### 2. **No Email/SMS Delivery Tests**

- **Packages**: `packages/email` and `packages/sms` have 1 test each
- **What's Missing**: No verification that emails are actually sent, no template rendering tests, no retry logic tests
- **Risk**: Silent email failures (e.g., Resend API down) undetected; customers never receive critical emails

#### 3. **No Payment Flow Unit Tests**

- **Coverage**: 5 tests in `packages/payments`, all mocked
- **What's Missing**: No real Stripe integration tests, no webhook simulation, no idempotency tests
- **Risk**: Payments could be duplicated, refunds could fail silently

#### 4. **No API Contract Tests**

- **Status**: All API testing is through e2e UI journeys
- **What's Missing**: No OpenAPI/REST contract validation, no response schema tests, no rate limit tests
- **Risk**: Breaking API changes undetected until client breaks

#### 5. **No Accessibility (a11y) Tests**

- **Status**: Not mentioned in any test file
- **Risk**: WCAG compliance not verified

#### 6. **No Load/Performance Tests**

- **Status**: Not found in test suite
- **Risk**: Scaling issues, database query N+1 problems undetected

#### 7. **Module System (Platform Modules)**

- **Status**: Limited e2e coverage (`apps/customer/e2e/module-boundary.spec.ts` exists)
- **Risk**: Module gating logic could have bypasses

---

## Test Execution & Infrastructure

### Configuration

| Aspect                | Details                                                                                   | File Path                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Test Runner**       | `vitest` (packages), `playwright` (e2e)                                                   | Configured via `package.json` scripts                                                                                              |
| **Turbo Task**        | Defined in `turbo.json` lines 33-38                                                       | `/Users/nguyen/Projects/PAON/turbo.json`                                                                                           |
| **E2E Config**        | Playwright configured with 120s timeout, single worker (to avoid magic link reuse issues) | `/Users/nguyen/Projects/PAON/apps/customer/playwright.config.ts` lines 8-34                                                        |
| **Integration Tests** | Opt-in via `PAON_INTEGRATION=1` environment variable; skipped by default                  | `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` lines 36, 51 |
| **CI Integration**    | E2E tests configured to run on CI with GitHub reporter; retries 2x on failure             | `playwright.config.ts` lines 11-13 across apps                                                                                     |

### Known Configuration Issues

1. **E2E Single Worker**: `workers: 1` in Playwright config
   - **Reason**: Magic links are single-use; parallel test execution causes flakes
   - **File**: `/Users/nguyen/Projects/PAON/apps/customer/playwright.config.ts` line 10
   - **Impact**: E2E tests run serially, slow CI

2. **Integration Tests Skipped by Default**
   - **Environment Gate**: `PAON_INTEGRATION=1` required
   - **File**: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` line 36
   - **Impact**: Real database constraints never verified in standard test run

3. **High Timeouts for E2E**
   - **Test Timeout**: 120 seconds (vs. default 30s)
   - **Expect Timeout**: 20 seconds (vs. default 5s)
   - **Reason**: Tests run against cloud Postgres, many sequential round trips
   - **File**: `/Users/nguyen/Projects/PAON/apps/customer/playwright.config.ts` lines 20-21
   - **Impact**: Masks slow operations; fails to catch real performance regressions

---

## Critical Business Workflows — Coverage Map

| Workflow                        | E2E Test                                                            | Unit Test                                              | Integration Test         | RLS Verified                                                          | Notes                                           |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| **Customer Login**              | ✅ `/apps/customer/e2e/login.spec.ts` (not shown in listing)        | ❌                                                     | ❌                       | ⚠️ Via e2e                                                            | Magic link flow tested                          |
| **Wardrobe Management**         | ✅ 2 tests (wardrobe.spec.ts, wardrobe-card-reveal.spec.ts)         | ❌                                                     | ❌                       | ⚠️                                                                    | Happy path only                                 |
| **Appointment Booking**         | ✅ `appointments-alterations.spec.ts`                               | ❌                                                     | ❌                       | ⚠️                                                                    | Alteration workflow included                    |
| **Alteration Workflow**         | ✅ `appointments-alterations.spec.ts`                               | ❌                                                     | ✅ If PAON_INTEGRATION=1 | ✅ (fixture)                                                          | Full state transition tested                    |
| **Payment Processing**          | ✅ `billing.spec.ts` (admin)                                        | ⚠️ 5 mocked tests                                      | ❌                       | ❌                                                                    | Webhook signature, idempotency not tested       |
| **Staff Onboarding**            | ✅ `accept-invite.spec.ts` (retailer)                               | ❌                                                     | ❌                       | ❌                                                                    | Invite acceptance tested, authorization not     |
| **Retailer Onboarding**         | ✅ `retailer-onboarding.spec.ts` (admin)                            | ❌                                                     | ❌                       | ❌                                                                    | Happy path, error cases (duplicate slug) tested |
| **Corporate Wearer Setup**      | ✅ 4 tests (corporate-setup-wizard, corporate-full-lifecycle, etc.) | ❌                                                     | ❌                       | ✅ `employee-portal-customer-link.spec.ts` tests cross-tenant refusal | Tenant isolation verified                       |
| **AI Concept Generation**       | ✅ `corporate-concept-generation.spec.ts` (retailer)                | ✅ `concept-generation-runner.test.ts` (mocked OpenAI) | ❌                       | ❌                                                                    | Mocked provider, not real API                   |
| **Morning Routine Delivery**    | ✅ 3 tests (morning-routine*.spec.ts)                               | ✅ mocked orchestrator                                 | ❌                       | ❌                                                                    | Mocked, no real email/SMS verification          |
| **Campaign Activation**         | ❌                                                                  | ✅ Mocked orchestrator test                            | ❌                       | ❌                                                                    | Logic tested, real execution not verified       |
| **Role-Based Authorization**    | ⚠️ Only 7 refs to authorization in all e2e                          | ✅ 8 test cases in guards.test.ts (mocked)             | ❌                       | ⚠️ Syntax only                                                        | Heavy reliance on RLS, not app-level tests      |
| **Cross-Tenant Data Isolation** | ✅ `employee-portal-customer-link.spec.ts` explicitly tests refusal | ❌                                                     | ❌                       | ✅ (1 test)                                                           | Only 1 e2e test for this critical boundary      |
| **Inventory Management**        | ✅ `inventory.spec.ts` (retailer)                                   | ❌                                                     | ✅ If PAON_INTEGRATION=1 | ❌                                                                    | Real constraint tests exist but skipped         |
| **POS Operations**              | ✅ `pos.spec.ts` (retailer)                                         | ❌                                                     | ✅ If PAON_INTEGRATION=1 | ❌                                                                    | Similar to inventory                            |

---

## False Confidence Indicators

### 🔴 High Risk

1. **RLS Policies Are Only Syntax-Checked**
   - **Belief**: "39 security tests verify RLS"
   - **Reality**: Tests read migration SQL files as text; no actual RLS policy enforcement tested
   - **Risk**: Policies could be missing, malformed, or insufficient
   - **Evidence**: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/style-profile-security.test.ts` only checks for string presence

2. **Repository Tests Use Fake Query Builders**
   - **Belief**: "Database layer is tested"
   - **Reality**: `fakeQueryBuilder` mocks all DB calls; no real queries execute
   - **Risk**: Database schema mismatches, missing columns, type errors undetected
   - **Evidence**: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/product-repository.test.ts` lines 31-37

3. **Authorization Guards Are Tested with Mock Sessions**
   - **Belief**: "Authorization is tested"
   - **Reality**: `guards.test.ts` creates fake session objects; never tests real JWT tokens or Supabase Auth flow
   - **Risk**: Token validation, claim extraction, or session hydration bugs undetected
   - **Evidence**: `/Users/nguyen/Projects/PAON/packages/auth/src/guards.test.ts` lines 16-50

4. **Server Actions Have Zero Isolation Tests**
   - **Belief**: "Server actions are tested via e2e"
   - **Reality**: If e2e tests never hit an error path, that path is untested
   - **Risk**: Authorization bypasses, validation failures, error handling bugs in Server Actions
   - **Evidence**: 50+ `*/app/*/actions.ts` files, zero `.test.ts` or `.spec.ts` files for them

### 🟡 Moderate Risk

5. **E2E Tests Timeout Masks Slow Operations**
   - **Belief**: "Tests pass, so performance is acceptable"
   - **Reality**: 120s timeout is for latency-distant cloud DB; slow queries not caught
   - **Evidence**: `/Users/nguyen/Projects/PAON/apps/customer/playwright.config.ts` line 20-21

6. **Integration Tests Skipped by Default**
   - **Belief**: "Database constraints are tested"
   - **Reality**: Must run with `PAON_INTEGRATION=1` manually; not in CI
   - **Evidence**: `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts` lines 36, 51

7. **Orchestrator Tests Are Mocked**
   - **Belief**: "Campaign delivery, morning routine, etc. are tested"
   - **Reality**: All external services (Supabase, Resend, Twilio) mocked
   - **Risk**: Service integration bugs, API changes, authentication failures undetected
   - **Evidence**: `campaign-activation-orchestrator.test.ts` lines 13-28 use vi.fn() mock builder

---

## Recommendations

### Priority 1: Ship Readiness (Mandatory)

1. **Enforce Integration Test Runs in CI**
   - Add `PAON_INTEGRATION=1` to CI pipeline for at least one test pass per release
   - Verify all 5 integration test files pass before shipping
   - File to modify: CI configuration (not found in repo; likely in GitHub Actions or similar)

2. **Add Cross-Tenant Data Isolation E2E Tests**
   - Only 1 e2e test explicitly verifies tenant isolation (employee-portal-customer-link.spec.ts)
   - Add tests for: customer accessing another customer's data, retailer accessing another retailer's staff
   - Files to create: Add tests to appropriate spec files (e.g., `apps/customer/e2e/tenant-isolation.spec.ts`)

3. **Create Server Action Authorization Tests**
   - Test Server Actions directly, not just via UI
   - At minimum, test failed authorization scenarios (e.g., customer calling admin action)
   - Files to create: Unit test files alongside each `actions.ts` file

### Priority 2: Quality Improvements (Strongly Recommended)

4. **Separate RLS Verification from Migration Syntax Checks**
   - Create dedicated RLS enforcement tests that attempt unauthorized queries
   - Use restricted-role Supabase clients (authenticated as customer/staff) instead of service_role
   - Files to modify: New RLS-specific integration tests

5. **Add Email/SMS Delivery Tests**
   - Test actual sends to Resend/Twilio (with mock responses or sandbox)
   - Files to modify: `packages/email/src/send.test.ts`, `packages/sms/src/send.test.ts`

6. **Add Stripe Integration Tests**
   - Mock Stripe webhook signatures and test payment flow end-to-end
   - Files to modify: `packages/payments/src/webhooks.test.ts`

7. **Document Test Coverage by Business Capability**
   - Create a mapping of features to test files (as above, but more detailed)
   - File to create: `docs/TEST_COVERAGE_MAP.md`

### Priority 3: Infrastructure Improvements (Nice-to-Have)

8. **Reduce E2E Single-Worker Bottleneck**
   - Investigate: Can magic links be generated fresh per test run to allow parallelism?
   - If yes, change `workers: 1` to `workers: 4` in Playwright config (4x speed improvement)

9. **Add API Contract Tests**
   - If Next.js app exposes REST/GraphQL APIs, add contract tests
   - Verification: No public APIs found; skip if internal only

10. **Add Accessibility Tests**
    - Use `@axe-core/playwright` in e2e tests
    - At minimum, smoke test all pages for WCAG violations

---

## Test Execution Checklist

- [ ] **Unit Tests**: `pnpm test` (runs vitest on all packages)
- [ ] **E2E Tests**: `pnpm test:e2e` (runs Playwright on all apps, requires running servers)
- [ ] **Integration Tests**: `PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run src/repositories/__integration__`
- [ ] **All Tests**: `pnpm test && pnpm test:e2e` (sequential; full suite ~15+ minutes)

---

## Files Referenced in This Audit

### Test Configuration

- `/Users/nguyen/Projects/PAON/turbo.json`
- `/Users/nguyen/Projects/PAON/package.json`
- `/Users/nguyen/Projects/PAON/apps/customer/playwright.config.ts`
- `/Users/nguyen/Projects/PAON/apps/retailer/playwright.config.ts`
- `/Users/nguyen/Projects/PAON/apps/admin/playwright.config.ts`
- `/Users/nguyen/Projects/PAON/packages/database/vitest.config.ts`

### E2E Tests

- `/Users/nguyen/Projects/PAON/apps/admin/e2e/retailer-onboarding.spec.ts`
- `/Users/nguyen/Projects/PAON/apps/customer/e2e/appointments-alterations.spec.ts`
- `/Users/nguyen/Projects/PAON/apps/customer/e2e/global-setup.ts`
- `/Users/nguyen/Projects/PAON/apps/retailer/e2e/employee-portal-customer-link.spec.ts`

### Unit Tests

- `/Users/nguyen/Projects/PAON/packages/auth/src/guards.test.ts`
- `/Users/nguyen/Projects/PAON/packages/auth/src/session.test.ts`
- `/Users/nguyen/Projects/PAON/packages/database/src/repositories/product-repository.test.ts`
- `/Users/nguyen/Projects/PAON/packages/database/src/repositories/test-helpers/fake-query-builder.ts`

### Integration Tests

- `/Users/nguyen/Projects/PAON/packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts`

### Security Syntax Tests

- `/Users/nguyen/Projects/PAON/packages/database/src/repositories/style-profile-security.test.ts`
- `/Users/nguyen/Projects/PAON/packages/database/src/repositories/virtual-try-on-usage-security.test.ts`

---

## Conclusion

PAON's test suite provides **strong end-to-end confidence for happy paths** but has **significant gaps in authorization verification, data persistence guarantees, and error handling**. The reliance on e2e testing as the primary verification mechanism creates **false confidence in lower-layer correctness** (especially RLS, constraints, and Server Action logic). **Before shipping, address Priority 1 items**: integration test enforcement and cross-tenant isolation verification. The current suite is suitable for active development but insufficient for a production release without these additions.
