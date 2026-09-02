# PAON Deployment — Critical Blockers (Cannot Ship)

**Date:** 2026-08-21  
**Verdict:** Production NOT ready. Five hard blockers must be resolved before any deployment attempt.

---

## Blocker #1: Unresolved Credential Exposure (21 Days Old)

**Evidence:** `/Users/nguyen/Projects/PAON/docs/ENVIRONMENTS.md` (lines 71–75)

> "Unresolved credential exposure (found 2026-08-01): a Supabase secret key was pasted into a chat transcript. No later record confirms rotation. Treat as still needing rotation until explicitly confirmed done; rotating it requires updating the corresponding Vercel environment variable in the same change or the affected production deployment breaks."

**Impact:**

- Supabase service role key (can bypass RLS, read/write all data) is compromised
- Affects all three production apps simultaneously
- Must be rotated and all three Vercel projects updated atomically

**Action Required:**

1. Rotate Supabase secret key in original project dashboard
2. Fetch new key via `supabase projects api-keys --project-ref hngxrczavwywsnfceppb`
3. Update `SUPABASE_SERVICE_ROLE_KEY` on `paonpaon-admin`, `paonpaon-retailer`, `paonpaon-customer` via `vercel env add` (not GUI)
4. **Confirm no failures** via manual curl to `/login` on each deployment

**Current Status:** PENDING (no rotation confirmation as of 2026-08-21)

---

## Blocker #2: Production Customer App Returns HTTP 500

**Evidence:**

- `/Users/nguyen/Projects/PAON/docs/ENVIRONMENTS.md` (lines 32, 6–12)
- `/Users/nguyen/Projects/PAON/docs/DEPLOYMENT.md` (lines 6–12)

**Symptom:**

```
GET https://paonpaon-customer.vercel.app/r/maison-dubois → HTTP 500
```

**Root Cause:**

- Deployed code expects `entity_metadata_assignments` table
- Production database (`hngxrczavwywsnfceppb`) does not have this table
- Schema is older than current codebase migrations

**Action Required:**

1. **Option A (Recommended):** Restore backup of original production DB, apply full migration chain to backup copy, verify with real data, promote tested copy to live
2. **Option B:** Downgrade deployed customer code to match old schema (requires code revert, loses features)
3. **Do NOT:** Blindly apply all 249 migrations to live production DB — no tested rollback path exists

**Current Status:** BLOCKED (no approved restore rehearsed)

---

## Blocker #3: No Error Tracking in Production

**Evidence:** Grep results across all `package.json`, `middleware.ts`, `app.tsx` files

**Finding:**

- Zero instances of Sentry, Rollbar, Datadog, or similar
- No `pino`, `winston`, or structured logging library
- Vercel built-in logs only (manual access required)
- No alerting when errors occur

**Impact:**

- Production HTTP 500s are invisible until manual log check or user report
- Cascading failures (e.g., cron job hangs, webhook receiver down) won't be detected
- Debugging requires founder intervention with Vercel dashboard access

**Action Required:**

1. Add Sentry free tier (minimum 5k events/month included)
   - Install `@sentry/nextjs` in all three apps
   - Configure in each `next.config.ts`
   - Add environment-specific DSN to Vercel env vars
2. **Or:** Use Vercel error reporting integration (built-in, requires Pro plan or higher)

**Current Status:** ABSENT (0% coverage)

---

## Blocker #4: Demo Login Still Enabled

**Evidence:** `/Users/nguyen/Projects/PAON/docs/DEPLOYMENT.md` (lines 33–36)

> "All three have `NEXT_PUBLIC_DEMO_LOGIN=1` set, so `/login` shows one-click persona buttons (confirmed present in the rendered HTML on all three). **Remove that variable on every project before any real retailer data exists** — it signs anyone straight in."

**Current State:**

- `NEXT_PUBLIC_DEMO_LOGIN=1` is set on `paonpaon-admin`, `paonpaon-retailer`, `paonpaon-customer` Vercel projects
- Anyone visiting `/login` can sign in as a hardcoded persona without a password

**Impact:**

- Before first real retailer data exists: acceptable (demo/dev tool)
- After real data exists: **security vulnerability** (anyone bypasses auth)

**Action Required:**

1. Verify no real retailer customer data exists in production DB
2. Remove `NEXT_PUBLIC_DEMO_LOGIN` from all three Vercel projects:
   ```bash
   vercel env rm NEXT_PUBLIC_DEMO_LOGIN production --scope baszakelijk2020-hashs-projects
   ```
3. Redeploy each app

**Current Status:** ENABLED (check before go-live)

---

## Blocker #5: Database Migration Path Undefined

**Evidence:** `/Users/nguyen/Projects/PAON/docs/ENVIRONMENTS.md` (lines 18–26)

> "The original PAON project is on an older schema and must not receive the migration chain until an approved restore of its actual data proves row counts, backfills, stock, money, RLS and rollback/recovery."

**Context:**

- Production DB: `hngxrczavwywsnfceppb` (original PAON project)
- Codebase migrations: 249 files (2026-07-19 to 2026-08-21)
- Current DB schema: **unknown** (likely from pre-June 2026)

**Gap:**

- No documented "approved restore of original data" exists
- Synthetic data migration tested locally (green)
- Real-data migration (with production row counts, RLS, money) is intentionally blocked
- No rollback/recovery procedure documented if migration fails

**Action Required:**

1. Run rehearsal against restored backup (per `runbooks/STOCK_UPGRADE_REHEARSAL.md`)
2. Verify all row counts post-migration
3. Test RLS (users can only read their own data)
4. Confirm payment/stock/money balances are correct
5. Document rollback procedure (backup to restore point)
6. Get founder approval on written evidence

**Current Status:** REHEARSAL PENDING (synthetic proof green, real-data proof intentionally blocked)

---

## Secondary Blockers (Should Fix Before Ship)

### No Rollback Procedure

- No documented incident response runbook
- Vercel deployments can be reverted via dashboard manually, but no automation
- Database migrations are apply-only (no downgrade path)
- A bad deploy today = manual recovery, potential data loss

### Stripe & Resend Not Configured

- `STRIPE_SECRET_KEY` missing (blocks billing, payments return 503)
- `RESEND_API_KEY` missing (blocks email, enqueued messages wait indefinitely)
- Both blocked on new business entity (founder decision)

### E2E Tests Broken in CI

- `/github/workflows/ci.yml` line 113: `if: github.event_name == 'workflow_dispatch'` (manual only)
- Fails at `supabase start` with exit code 254 (infrastructure, not code)
- Cannot verify end-to-end journeys automatically
- Gated rather than deleted to preserve signal (red main = people stop reading)

### Auth Callback URLs Unverified

- Local config only (`supabase/config.toml`)
- Production Supabase project URLs must be set in hosted dashboard
- No IaC or code ensures URLs match deployed apps
- May break after login if URLs wrong

---

## Go/No-Go Decision Matrix

| Blocker                    | Status                   | Must Resolve Before Deploy? |
| -------------------------- | ------------------------ | --------------------------- |
| Credential exposure        | Unresolved, 21 days old  | **YES**                     |
| Customer HTTP 500          | Database schema mismatch | **YES**                     |
| Error tracking absent      | No monitoring            | **YES**                     |
| Demo login enabled         | Security bypass          | **YES**                     |
| Migration path undefined   | Risky, no rehearsal      | **YES**                     |
| No rollback procedure      | Manual recovery only     | SHOULD                      |
| Stripe/Resend unconfigured | Graceful degradation     | SHOULD                      |
| E2E tests broken           | No verification          | SHOULD                      |
| Auth URLs unverified       | Risk of login failure    | SHOULD                      |

---

## Timeline to Ship

**Best case (if all hard blockers resolve immediately):**

1. Rotate credential (1–2 hours)
2. Rehearse DB migration with real data (2–4 hours)
3. Apply migration to production (15 min)
4. Deploy customer app (5 min)
5. Verify HTTP 200 on customer URLs (5 min)
6. Remove DEMO_LOGIN (5 min)
7. Add error tracking (1–2 hours if Sentry, < 30 min if Vercel Pro)

**Total:** 5–10 hours of focused work, **no concurrent blockers**

**Current reality:** Blockers are **not concurrent** (credential exposure + DB migration + monitoring setup = overlapping work, requires founder involvement for billing decision on Sentry/Vercel tier)

---

**Report:** 2026-08-21 Deployment Readiness Audit  
**Classification:** Critical path, founder decision required
