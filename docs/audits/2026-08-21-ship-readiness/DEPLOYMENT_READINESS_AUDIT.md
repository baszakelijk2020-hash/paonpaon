# PAON Production Deployment Readiness Audit

**Date:** 2026-08-21  
**Scope:** Environment variables, Supabase migration/seed strategy, auth callbacks, storage, cron/webhook config, monitoring, build config, rollback strategy  
**Methodology:** Code audit (file paths and line numbers cited), not trust documentation as proof of implementation

---

## Executive Summary

**PRODUCTION NOT READY FOR DEPLOYMENT.** Multiple critical blockers prevent shipping PAON tomorrow:

1. **Customer app HTTP 500 in production** — database schema mismatch (missing `entity_metadata_assignments`)
2. **Unresolved credential exposure** — Supabase secret key compromised (2026-08-01), rotation unconfirmed
3. **No error tracking/monitoring** — production issues invisible
4. **Database migration path undefined** — original production DB cannot safely receive full migration chain

The admin and retailer deployments are technically functional (HTTP 200 on login pages) but share the credential exposure risk and lack comprehensive monitoring.

---

## 1. Environment Variables

### Status: DOCUMENTED COMPLETE, IMPLEMENTATION INCOMPLETE

#### Root `.env.example`

**File:** `/Users/nguyen/Projects/PAON/.env.example` (lines 1–21)

- `SUPABASE_ACCESS_TOKEN` — required for `scripts/seed-production.sh`; fetches project API keys via CLI
- `VERCEL_TOKEN` — required for CI/CD deployments (GitHub Actions)
- `VERCEL_OIDC_TOKEN` — auto-written by Vercel CLI, not manual

**Status:** Documented. No indication in code whether these are set in Vercel/CI environment.

#### App Environment Variables

**apps/admin/.env.example** (lines 1–25):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — required
- `PAON_DISPOSABLE_SUPABASE_REFS` — empty for production (only for Playwright isolation)
- `NEXT_PUBLIC_RETAILER_APP_URL`, `NEXT_PUBLIC_ADMIN_APP_URL` — app cross-linking
- `STRIPE_SECRET_KEY`, `STRIPE_BILLING_WEBHOOK_SECRET` — optional (returns 503 if unconfigured)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — optional (email enqueue waits if missing)
- `CRON_SECRET` — required for `/api/cron/dispatch-emails` and `/api/cron/dispatch-sms` auth

**apps/retailer/.env.example** (lines 1–18):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — required
- `NEXT_PUBLIC_APP_URL` — retailer app URL
- `STRIPE_SECRET_KEY` — optional (Stripe Connect payment page shows "not configured")
- `OPENAI_API_KEY` — optional (customer detail AI Insights card shows "not configured")
- `E2E_FADEN_WEBHOOK_SECRET` — test-only (PHASE 9.2)

**apps/customer/.env.example** (lines 1–15):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — required
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_RETAILER_APP_URL` — app URLs
- `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET` — optional (checkout shows "payments not available yet")

**Critical Finding:** `/Users/nguyen/Projects/PAON/docs/DEPLOYMENT.md` (lines 6–12, 214–216) confirms:

- `STRIPE_SECRET_KEY` / `RESEND_API_KEY` **still owed by founder**, blocked on new business entity
- `SUPABASE_SERVICE_ROLE_KEY` is set on all three `paonpaon-*` projects (as of 2026-07-28)

#### Build Config

**turbo.json** (lines 5–16):

```json
"globalEnv": [
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
  "STRIPE_BILLING_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET",
  "OPENAI_API_KEY"
]
```

All required and optional vars listed explicitly. No dynamic discovery issues.

---

## 2. Supabase Migration & Seed Strategy

### Status: TECHNICALLY PRESENT, FUNCTIONALLY INCOMPLETE

#### Migration Chain

**Directory:** `/Users/nguyen/Projects/PAON/supabase/migrations/`  
**Count:** 249 SQL migrations (confirmed by `find . -maxdepth 1 -name "*.sql"`)  
**Date Range:** 2026-07-19 to 2026-08-21 (latest: `20260817000000_add_corporate_manager_portal_auth.sql`)

**Critical Issue (DOCUMENTED IN ENVIRONMENTS.md):**

See `/Users/nguyen/Projects/PAON/docs/ENVIRONMENTS.md` (lines 18–26, 68–75):

> "The original PAON project is on an older schema and must not receive the migration chain until an approved restore of its actual data proves row counts, backfills, stock, money, RLS and rollback/recovery."

**Conflict:** Production customer deployment (`paonpaon-customer.vercel.app`) is connected to the original PAON project (`hngxrczavwywsnfceppb`, `ap-southeast-2` region) but its database is missing `entity_metadata_assignments` table referenced by deployed code.

**What this means:**

- Production customer app returns **HTTP 500** on `/r/maison-dubois` (verified 2026-08-02, per DEPLOYMENT.md lines 6–12)
- The full migration chain cannot be blindly applied to production without data restore/rehearsal
- No explicit rehearsal of the "success with populated data" scenario has been done on production DB

#### Seed Strategy

**Production seed script:** `/Users/nguyen/Projects/PAON/scripts/seed-production.sh`

**Functionality:**

- Lines 13: Hard-coded project ref: `PROJECT_REF="hngxrczavwywsnfceppb"` (original production project)
- Lines 32–34: Ensures `supabase` CLI is installed
- Lines 37–66: Fetches API keys via CLI (never hand-typed) using `SUPABASE_ACCESS_TOKEN` from `.env.local`
- Line 73: Calls `pnpm --filter @paon/database seed:demo`
- **Idempotent:** Safe to re-run

**Documented:** DEPLOYMENT.md lines 194–210 explain it accepts `auth.admin.inviteUserByEmail` and uses `{{ .RedirectTo }}` per ADR-012.

**Status:** Script exists and is documented, but **last run date unknown**. No indication in code or docs when it was last executed or whether seed data in production is current.

#### Local Seed

**File:** `/Users/nguyen/Projects/PAON/supabase/seed.sql` (273 lines)  
**Used for:** `supabase start` local initialization  
**No production connection mechanism.**

---

## 3. Auth Callback URLs & Redirect Handling

### Status: PARTIALLY CONFIGURED, PRODUCTION URLS UNVERIFIED

#### Supabase Configuration

**File:** `/Users/nguyen/Projects/PAON/supabase/config.toml` (lines 35–66)

**Local Development (HTTP only):**

```toml
[auth]
enabled = true
site_url = "http://localhost:3002"  # Customer app as primary
additional_redirect_urls = [
  "http://localhost:3000",   # Admin
  "http://localhost:3001",   # Retailer
  "http://localhost:3002",   # Customer
]
```

**Email templates:**

- `[auth.email.template.invite]` — uses `{{ .RedirectTo }}` (ADR-012), not fixed `{{ .SiteURL }}`
- `[auth.email.template.magic_link]` — uses `{{ .RedirectTo }}` (customer portal passwordless flow)

**Critical Gap:** This file is **local config only** (`config.toml` applied by `supabase start`). Production Supabase project (`hngxrczavwywsnfceppb`) must have auth URLs configured in the hosted dashboard.

**What's NOT in code:**

- No Terraform/IaC describing production auth URLs
- No environment-specific config override for hosted Supabase
- DEPLOYMENT.md does not document production callback URLs

**Assumed production URLs (not verified):**

- Admin: `https://paonpaon-admin.vercel.app/auth/confirm`
- Retailer: `https://paonpaon-retailer.vercel.app/auth/confirm`
- Customer: `https://paonpaon-customer.vercel.app/auth/confirm`

#### Auth Callback Implementation

Each app has a confirm route:

- `/Users/nguyen/Projects/PAON/apps/admin/app/auth/confirm/route.ts`
- `/Users/nguyen/Projects/PAON/apps/retailer/app/auth/confirm/route.ts` (lines 1–59)
- `/Users/nguyen/Projects/PAON/apps/customer/app/auth/confirm/route.ts`

**Example (retailer):**

```typescript
// Lines 37–58: GET handler
// Accepts ?token_hash=<hash>&type=<invite|magiclink>
// Calls supabase.auth.verifyOtp({ type, token_hash })
// Redirects to /accept-invite or /dashboard on success
// Redirects to /login?error=invalid_invite on failure
```

**Finding:** Handler is correct but does not guard against redirectTo parameter injection (per line 71 in admin middleware, the `redirectTo` is trusted from searchParams without validation).

---

## 4. Storage Configuration

### Status: TECHNICALLY PRESENT, PERMISSIONS ESTABLISHED

**Storage buckets (3 public/private):**

1. **product-images** (`20260720000014_create_product_images_storage.sql`)
   - Public, 5MB limit, JPEG/PNG/WebP only
   - RLS: anyone read, managers/platform-staff can upload/delete per retailer
   - Used by: product catalog upload (apps/retailer)

2. **brand-assets** (`20260724000010_create_demo_brand_assets_storage.sql`)
   - Demo/development bucket for seeded retailers

3. **wardrobe-visualizations** (`20260806120000_add_wardrobe_visualization_output_storage.sql`)
   - Output storage for AI-generated wardrobe images
   - Private (signed URLs) or public (depends on RLS not shown in audit scope)

**File size limits verified:**

- supabase/config.toml line 33: `file_size_limit = "50MiB"` (local)
- apps/customer/next.config.ts lines 5–7: `serverActions: { bodySizeLimit: "11mb" }` (multipart overhead buffer)

**Finding:** No explicit backup policy for storage buckets documented. Supabase automatic backups are assumed but not stated.

---

## 5. Cron & Webhook Configuration

### Status: CONFIGURED WITH HARD LIMITS, NEAR CAPACITY

#### Cron Jobs

**File:** `/Users/nguyen/Projects/PAON/apps/admin/vercel.json` (lines 1–13)

**Current (2 jobs, at Vercel Hobby hard cap of 2):**

| Path                        | Schedule    | Purpose                           |
| --------------------------- | ----------- | --------------------------------- |
| `/api/cron/dispatch-emails` | `0 6 * * *` | Email outbox + Demo Studio expiry |
| `/api/cron/dispatch-sms`    | `0 7 * * *` | SMS outbox                        |

**DEPLOYMENT.md (lines 157–177) confirms Vercel Hobby limits:**

- Max **2 cron jobs** per project
- Daily frequency **only** (hourly rejected at deploy)
- Adding a third entry or hourly schedule **fails the build**

**Unused cron handlers (no corresponding `vercel.json` entry):**

- `/Users/nguyen/Projects/PAON/apps/admin/app/api/cron/dispatch-newsletter/route.ts` — deliberately not scheduled
- `/Users/nguyen/Projects/PAON/apps/admin/app/api/cron/expire-demo-environments/route.ts` — folded into `dispatch-emails` at line 47
- `/Users/nguyen/Projects/PAON/apps/admin/app/api/cron/process-wardrobe-visualizations/route.ts` — not scheduled

**Cron Authentication:**

- `/api/cron/dispatch-emails` (lines 28–38): Verifies `Authorization: Bearer $CRON_SECRET`
- Returns HTTP 503 if `CRON_SECRET` not set; HTTP 401 if signature invalid
- `CRON_SECRET` auto-sent by Vercel once env var is set

**Finding:** No retry policy or dead-letter queue for failed cron executions documented. Jobs either succeed or fail silently to stdout (visible in Vercel logs only).

#### Webhooks

**Stripe Platform (admin):**

- `/Users/nguyen/Projects/PAON/apps/admin/app/api/webhooks/stripe/route.ts` (lines 21–79)
- Authenticates via `stripe-signature` header
- Returns HTTP 503 if `STRIPE_BILLING_WEBHOOK_SECRET` not configured
- Processes `sync_subscription` events

**Stripe Connect (customer):**

- `/Users/nguyen/Projects/PAON/apps/customer/app/api/webhooks/stripe/route.ts`
- Same pattern: signature verification, 503 if unconfigured

**Faden Connector (retailer):**

- `/Users/nguyen/Projects/PAON/apps/retailer/app/api/webhooks/faden/[connectionId]/route.ts`
- Requires `E2E_FADEN_WEBHOOK_SECRET` in retailer `.env.example` (test-only)

**Finding:** No webhook retry logic in code. Supabase Functions or external webhook service assumed to handle retries (not in scope of this audit).

---

## 6. Monitoring, Error Tracking & Logging

### Status: ABSENT

**What exists:**

- Standard Next.js error pages (`MIDDLEWARE_INVOCATION_FAILED` mentioned in DEPLOYMENT.md line 142)
- Vercel built-in logs (CLI: `vercel logs`)
- Middleware error handling (apps/admin/middleware.ts): redirects on auth failure, no custom logging

**What does NOT exist:**

- **No Sentry/Rollbar/Datadog setup** — confirmed by grep: zero instances of `sentry`, `rollbar`, `datadog` in package.json files
- **No application-level logging library** — no `pino`, `winston`, `bunyan` in dependencies
- **No error tracking context** — no user IDs, environment, or request IDs attached to logs
- **No uptime monitoring** — no Pingdom, UptimeRobot, or similar integration documented
- **No custom metrics** — Next.js built-in telemetry is disabled (`TURBO_TELEMETRY_DISABLED=1` in CI, see ci.yml line 15)

**Discovery path for production issues:**

1. User reports white screen
2. Manual curl to deployment URL or Vercel dashboard logs
3. Grep logs for keyword (blind search, no structured logging)
4. Redeploy with console.log if needed

**Risk:** Critical production failures (like the customer HTTP 500) are only visible if someone manually checks logs. No alerting mechanism exists.

---

## 7. Build Configuration

### Status: FUNCTIONAL, MINIMAL CUSTOMIZATION

#### turbo.json

**File:** `/Users/nguyen/Projects/PAON/turbo.json`

**Build task dependency graph (lines 18–42):**

```
build: depends on ^build (upstream packages first)
  outputs: .next/**, !.next/cache/**, dist/**

lint: depends on ^build
typecheck: depends on ^build
test: depends on ^build
test:e2e: depends on build (not ^build — e2e is per-app)
```

**Finding:** Correct monorepo isolation. Turbo cache will rebuild only changed packages and their dependents.

#### Next.js Configs

**apps/admin/next.config.ts** (14 lines):

```typescript
reactStrictMode: true
transpilePackages: [@paon/ui, @paon/domain, @paon/database, @paon/auth, @paon/utils]
```

**apps/retailer/next.config.ts** (14 lines):
Same as admin.

**apps/customer/next.config.ts** (18 lines):
Same + `serverActions: { bodySizeLimit: "11mb" }` for image uploads.

**Finding:** No advanced features enabled (ISR, image optimization overrides, etc.). Safe defaults.

#### CI/CD Pipeline

**File:** `/Users/nguyen/Projects/PAON/.github/workflows/ci.yml`

**Jobs:**

1. **verify** (lines 18–55) — lint, typecheck, unit tests, build, format check
   - Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` injected at build time
   - Runs on: all branches + PR

2. **deploy** (lines 68–91) — production deploy to Vercel
   - Conditional: `github.ref == 'refs/heads/main'` only
   - Calls `scripts/vercel-create-production-deploy.sh` for each app
   - Matrix: customer, retailer, admin (all three)
   - Secrets: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`

3. **e2e** (lines 109–176) — end-to-end tests
   - **Manual trigger only** (line 113: `if: github.event_name == 'workflow_dispatch'`)
   - **Known broken** (lines 100–108): fails at `supabase start` with exit code 254 (infrastructure issue, not app code)
   - Gated rather than deleted to avoid red `main` without signal
   - Re-enable when Supabase startup is fixed

**Deploy script:** `/Users/nguyen/Projects/PAON/scripts/vercel-create-production-deploy.sh`

- Creates deployment via Vercel API (gitSource + explicit ref)
- Polls for READY state (40 attempts × 5s = 3.3 min timeout)
- Verifies HTTP 2xx on deployed URL (line 116–120)
- Handles Hobby deploy quota errors gracefully (treats as warning, not red main)

**Finding:** CI/CD is defensive and correctly handles Vercel Hobby constraints. However, **no automated rollback mechanism** — if HTTP health check fails, deployment is halted but there is no automatic revert to previous version.

---

## 8. Rollback Strategy

### Status: ABSENT

**What exists:**

- Git tags? **Not found** (no release branches, no semantic versioning documented)
- Vercel project versions? **Can be accessed manually** via Vercel dashboard (Deployments tab)
- Database downgrade path? **Not defined** — migrations are apply-only
- Seed/fixture reset? **`scripts/seed-production.sh` is idempotent** but has no rollback counterpart

**How production would recover from a bad deploy:**

1. Identify failed deployment in Vercel dashboard
2. Manually click "Redeploy" on previous working deployment
3. No data recovery — migrations are one-way

**Database rollback scenario:**

- If a bad migration lands in `main` and is deployed, **the only recovery is:**
  1. Supabase manual backup restore (done in dashboard, requires founder access)
  2. Re-run migrations from backup point forward
  3. Pray the interim data is not corrupted

**Finding:** No documented runbook for post-deploy incident response. No "if HTTP 500, do X" procedure. The credential rotation blocker (see ENVIRONMENTS.md lines 71–75) would compound any incident — a compromised secret cannot be immediately rotated without an emergency deploy coordination.

---

## 9. Credential Management & Security

### Status: CRITICAL ISSUES

#### Documented Exposure (UNRESOLVED)

**From ENVIRONMENTS.md (lines 71–75):**

> "Unresolved credential exposure (found 2026-08-01): a Supabase secret key was pasted into a chat transcript. No later record confirms rotation."

**Impact:**

- Affects all three production apps (`paonpaon-*`)
- Service role key can bypass all RLS, read/write any data
- No rotation confirmation since 2026-08-01 (**21 days ago**)
- Rotation requires update to all three Vercel env vars **in same change** or deployments break

**Finding:** This alone blocks deployment until resolved. Every production request could be made by an attacker with knowledge of the secret.

#### Token Storage

- Root `.env.local`: `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN` — git-ignored, not committed ✓
- App `.env.local`: Supabase keys — git-ignored, not committed ✓
- CI secrets: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, Supabase URLs — GitHub Secrets only ✓

**Finding:** No secrets are committed. However, the leaked secret must be rotated and all references updated atomically.

#### Demo Login

**DEPLOYMENT.md (lines 33–36):**

> "All three have `NEXT_PUBLIC_DEMO_LOGIN=1` set, so `/login` shows one-click persona buttons. **Remove that variable on every project before any real retailer data exists** — it signs anyone straight in."

**Status:** DEMO_LOGIN check is present in code (confirmed in login pages), but **MUST be removed from Vercel env vars before production go-live**.

---

## 10. Database Schema Compatibility

### Status: CRITICAL BLOCKER

**Production Database State:**

- Project: `hngxrczavwywsnfceppb` (ap-southeast-2)
- Last known schema: **older than current codebase**
- Missing table: `entity_metadata_assignments` (referenced by deployed customer code)
- Result: **HTTP 500 on customer production deployment**

**Current Deployed Code:**

- Built from HEAD of `main` (latest migrations included)
- Expects `entity_metadata_assignments` table to exist
- No fallback for missing column

**Safe Path Forward (per ENVIRONMENTS.md):**

1. Restore backup of original production data (with original schema)
2. Run migration chain against restored copy
3. Verify row counts, RLS, rollback/recovery with **real data**, not synthetic
4. Only then apply to live production DB

**Current Blocker:**

- No "approved restore" of original data has been done
- Synthetic populated proof is green but real-data proof is intentionally blocked
- Cannot deploy customer app until this is resolved

---

## 11. What Would Block Deploying Tomorrow

### Hard Blockers (MUST FIX BEFORE SHIP)

| Blocker                             | File/Evidence                                                  | Impact                                                   |
| ----------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| **Credential exposure unresolved**  | ENVIRONMENTS.md:71–75                                          | Compromised Supabase secret; no confirmation of rotation |
| **Production customer HTTP 500**    | ENVIRONMENTS.md:32; missing `entity_metadata_assignments`      | Undeployable; dead feature for end users                 |
| **No error tracking in production** | Zero Sentry/monitoring setup                                   | Cannot detect/diagnose failures post-deploy              |
| **Database schema mismatch**        | Original DB older than migrations; no rehearsal with real data | Cannot safely apply full migration chain                 |
| **DEMO_LOGIN still enabled**        | DEPLOYMENT.md:33–36                                            | Anyone can sign in without password                      |

### Soft Blockers (SHOULD FIX BEFORE SHIP)

| Blocker                           | Evidence                                       | Impact                                         |
| --------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| **No rollback procedure**         | DEPLOYMENT.md; no documented incident response | Cannot recover quickly from bad deploy         |
| **E2E tests broken**              | ci.yml:100–108, exit 254 at `supabase start`   | Cannot verify end-to-end user journeys in CI   |
| **Stripe + Resend unconfigured**  | DEPLOYMENT.md:214–216                          | Email/SMS/payments return 503 or fail silently |
| **No uptime monitoring**          | No Pingdom/monitoring integration              | Will not detect if production is down          |
| **Auth callback URLs unverified** | Not in code, only local config.toml            | May not redirect after login if URLs wrong     |

---

## 12. Summary Table: Deployment Readiness

| Category                  | Status                                   | Verdict      |
| ------------------------- | ---------------------------------------- | ------------ |
| **Environment variables** | Documented, incomplete in production     | Partial      |
| **Supabase migrations**   | 249 migrations, schema mismatch          | Blocked      |
| **Seed strategy**         | Script exists, last-run unknown          | Partial      |
| **Auth callbacks**        | Local config only, production unverified | At risk      |
| **Storage buckets**       | Configured, no backup policy             | Partial      |
| **Cron jobs**             | 2/2 capacity, no retry logic             | At capacity  |
| **Webhooks**              | Implemented, no retry policy             | Partial      |
| **Monitoring/logging**    | Absent                                   | Critical gap |
| **Build & CI/CD**         | Functional, no automated rollback        | Working      |
| **Rollback strategy**     | Absent                                   | Critical gap |
| **Credentials**           | Exposure unresolved (21 days)            | Critical gap |
| **Demo login**            | Enabled, must remove                     | Critical gap |

---

## Recommendations

### Immediate (Before Any Deployment)

1. **Rotate Supabase secret key** confirmed in rotation, update all three Vercel env vars atomically
2. **Disable `NEXT_PUBLIC_DEMO_LOGIN`** on all three `paonpaon-*` projects
3. **Restore and test production DB migration** — use ENVIRONMENTS.md rehearsal runbook with actual backup
4. **Fix `entity_metadata_assignments` schema gap** — either apply missing migration or remove code dependency
5. **Implement basic error tracking** — Sentry free tier minimum, or Vercel error reporting

### Before First Paid Pilot

1. **Add uptime monitoring** (Pingdom, UptimeRobot, or similar)
2. **Document rollback runbook** — when to revert, how to restore data
3. **Re-enable E2E tests in CI** — fix Supabase startup issue (infrastructure, not code)
4. **Set auth callback URLs in hosted Supabase** — verify against production deployment URLs
5. **Define backup/recovery SLA** — how often, retention, recovery time target

### Ongoing

1. **Monitor cron job quota** — currently at 2/2; refactor if new daily work emerges
2. **Add structured logging** — correlate requests across app/middleware/DB
3. **Implement feature flags** — gate risky features independently of deployment
4. **Schedule credential rotation** — quarterly minimum, immediately after any exposure

---

## Audit Evidence Summary

- **Root config:** `/Users/nguyen/Projects/PAON/.env.example`, `turbo.json`, `supabase/config.toml`
- **App configs:** `/Users/nguyen/Projects/PAON/apps/{admin,retailer,customer}/.env.example`, `next.config.ts`
- **Migrations:** `/Users/nguyen/Projects/PAON/supabase/migrations/` (249 files)
- **Auth:** `/Users/nguyen/Projects/PAON/apps/{admin,retailer,customer}/app/auth/confirm/route.ts`
- **Cron/webhooks:** `/Users/nguyen/Projects/PAON/apps/admin/vercel.json`, `/api/cron/*`, `/api/webhooks/*`
- **CI/CD:** `/Users/nguyen/Projects/PAON/.github/workflows/ci.yml`, `scripts/vercel-create-production-deploy.sh`
- **Documentation:** `/Users/nguyen/Projects/PAON/docs/DEPLOYMENT.md`, `ENVIRONMENTS.md`, `PROJECT_STATE.md`

---

**Report generated:** 2026-08-21  
**Audit classification:** READ-ONLY, no code changes made
