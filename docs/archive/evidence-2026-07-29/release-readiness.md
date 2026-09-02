# Release Readiness

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Classification:** **Internally Testable** (approaching **Beta Ready** for _demo / cold-outreach_ use; **not Production Ready** for paid multi-tenant retail with real money and PII).

---

## Readiness ladder

| Level               | Definition                                               | Met?                                                            |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| Not Buildable       | Does not compile / typecheck / install                   | **No** — buildable                                              |
| Buildable           | CI six-pack green                                        | **Yes**                                                         |
| Internally Testable | Apps run against real DB; demo paths walkable            | **Yes** (production verified; local Next down at audit)         |
| Beta Ready          | Prospect-facing demo reliable; known blockers documented | **Mostly** for storefront/Studio/marketing; **No** for payments |
| Production Ready    | Money, email, security, e2e gates, ops runbooks          | **No**                                                          |

**Assigned level: Internally Testable** — with strong demo surfaces live on Vercel.

---

## Blockers

### Blocker 1 — Stripe keys missing

| Field                | Value                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Severity**         | Critical (commercial)                                                                                             |
| **Impact**           | Cannot take money; Connect/Checkout never live-proven (ADR-030 code exists). Bag CTA leads with Book Appointment. |
| **Recommended fix**  | Founder provisions `STRIPE_*` in local + Vercel; run Connect + charge E2E.                                        |
| **Estimated effort** | Credentials + 2–4h verify                                                                                         |
| **Current status**   | Blocked on founder                                                                                                |

### Blocker 2 — Resend key missing

| Field                | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| **Severity**         | Critical (ops / trust)                                            |
| **Impact**           | Outbox may queue; delivery unverified. Cron constrained on Hobby. |
| **Recommended fix**  | Set `RESEND_API_KEY`; verify dispatch cron delivers.              |
| **Estimated effort** | Credentials + 1–2h                                                |
| **Current status**   | Blocked on founder                                                |

### Blocker 3 — RETAILER_STAFF_DEBUG PII leak

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Severity**         | Critical (security)                                              |
| **Impact**           | Failed staff session path logs emails, user IDs, all staff rows. |
| **Recommended fix**  | Delete debug block in `apps/retailer/lib/session.ts`.            |
| **Estimated effort** | 15–30 min                                                        |
| **Current status**   | **Fixed** after snapshot in same session                         |

### Blocker 4 — E2E not on push CI

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Severity**         | High                                                                   |
| **Impact**           | Freeze journeys can regress on `main` unnoticed until manual dispatch. |
| **Recommended fix**  | Repair Supabase-on-runner; enable e2e on push.                         |
| **Estimated effort** | 1–2 days                                                               |
| **Current status**   | Known workaround                                                       |

### Blocker 5 — Demo login on production

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Severity**         | High before real retailer data                                                                                     |
| **Impact**           | One-click persona login (`NEXT_PUBLIC_DEMO_LOGIN=1`) is a conversion tool and a security footgun for real tenants. |
| **Recommended fix**  | Keep for prospect demos; disable per-tenant or globally before real PII.                                           |
| **Estimated effort** | S–M                                                                                                                |
| **Current status**   | Intentional for current phase                                                                                      |

### Blocker 6 — Vercel Hobby deploy cap / hook reliability

| Field                | Value                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Severity**         | Medium (ops)                                                                                            |
| **Impact**           | Daily free deployment quota; Deploy Hooks can stick PENDING. CI Deployments API is canonical (ADR-058). |
| **Recommended fix**  | Upgrade off Hobby before pilot volume; keep CI deploy path.                                             |
| **Estimated effort** | Billing decision + ops                                                                                  |
| **Current status**   | Soft-blocker; CI path works                                                                             |

### Blocker 7 — Alterations / silhouette not product-ready

| Field                | Value                                                |
| -------------------- | ---------------------------------------------------- |
| **Severity**         | High if sold as wedge; Low if not demonstrated       |
| **Impact**           | Invented UX; wrong silhouette port; founder-blocked. |
| **Recommended fix**  | Do not demo as finished; await design.               |
| **Estimated effort** | Blocked                                              |
| **Current status**   | Parked                                               |

### Blocker 8 — Stale documentation can mislead operators

| Field                | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Severity**         | Medium                                                               |
| **Impact**           | PROJECT_STATE / stale ai_snapshot may cause wrong incident response. |
| **Recommended fix**  | Banner/archive PROJECT_STATE; regenerate snapshot.                   |
| **Estimated effort** | 1–3h                                                                 |
| **Current status**   | Open                                                                 |

---

## What is ready enough for cold outreach

| Asset                                         | Ready?                        |
| --------------------------------------------- | ----------------------------- |
| Branded storefront `/r/{slug}`                | Yes                           |
| Demo Studio → real tenant + private demo gate | Yes                           |
| Marketing + founder page                      | Yes                           |
| Wedding party demo journey                    | Yes                           |
| Retailer Mission Control walk (seeded)        | Yes (after fixing debug leak) |
| Taking payment                                | No                            |
| Transactional email                           | No                            |

---

## Overall status

**Not Production Ready.**  
**Yes Buildable + Internally Testable.**  
**Beta-for-demos** if Stripe/Resend stay out of the pitch and Blocker 3 is fixed.
