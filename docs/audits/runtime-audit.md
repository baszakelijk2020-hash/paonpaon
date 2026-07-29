# Runtime Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Verdict:** Production runtime healthy. Local Next.js apps were **not listening** at audit time (prior session processes dead). Local Supabase API is up.

---

## Findings

### R1 — Production apps respond HTTP 200

| Field                | Value                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | All three production surfaces and key customer routes return 200.                                                                                                                                                              |
| **Evidence**         | `curl` (2026-07-29 audit): `paonpaon-customer.vercel.app/` 200; `/r/maison-dubois` 200; `/founder` 200; `paonpaon-admin.vercel.app/login` 200; `paonpaon-retailer.vercel.app/login` 200. Aligns with DEPLOYMENT.md / PHASE.md. |
| **Severity**         | None (positive)                                                                                                                                                                                                                |
| **Recommended fix**  | None                                                                                                                                                                                                                           |
| **Estimated effort** | —                                                                                                                                                                                                                              |
| **Current status**   | Live                                                                                                                                                                                                                           |

### R2 — Local Next.js apps down at audit time

| Field                | Value                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Ports 3000/3001/3002 were not in LISTEN state. Terminal metadata claimed long-running `pnpm --filter … dev` sessions, but PIDs 10552/10732/10975 were dead. |
| **Evidence**         | `lsof -iTCP:3000,3001,3002 -sTCP:LISTEN` empty; `curl 127.0.0.1:3000                                                                                        | 3001 | 3002`→ connection fail; only`*:54321` (Docker/Supabase) listening. Terminal logs show earlier successful compiles/GETs (e.g. customer wedding-parties 200, retailer dashboard 200, admin Ready). |
| **Severity**         | Medium (local DX)                                                                                                                                           |
| **Recommended fix**  | Restart with `pnpm dev` (or per-app filters) when local walkthrough needed. Not a production blocker.                                                       |
| **Estimated effort** | 2–5 min                                                                                                                                                     |
| **Current status**   | Local down; production up                                                                                                                                   |

### R3 — Local Supabase stack partially up

| Field                | Value                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Local API responds; some optional services stopped.                                                                                                                            |
| **Evidence**         | `curl http://127.0.0.1:54321/rest/v1/` → 200 (~499KB OpenAPI); `supabase status` reports Stopped: imgproxy, edge_runtime, analytics, vector, pooler; core API/DB URLs present. |
| **Severity**         | Low                                                                                                                                                                            |
| **Recommended fix**  | `supabase start` full stack if edge/storage features needed locally.                                                                                                           |
| **Estimated effort** | 2–5 min                                                                                                                                                                        |
| **Current status**   | Usable for REST/DB                                                                                                                                                             |

### R4 — Auth / demo login configuration

| Field                | Value                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | App `.env.local` files contain Supabase URL/anon/service role and app URLs. No `NEXT_PUBLIC_DEMO_LOGIN` in local app envs (production PHASE claims it is set on Vercel). No Stripe/Resend/OpenAI/Twilio keys in any checked local env. |
| **Evidence**         | Key names only from `apps/{admin,retailer,customer}/.env.local` and root `.env.local` (tokens only). `rg STRIPE_                                                                                                                       | RESEND_` across those files → none. |
| **Severity**         | High for payments/email product proof; Low for demo auth if Vercel still has `NEXT_PUBLIC_DEMO_LOGIN=1`                                                                                                                                |
| **Recommended fix**  | Provision Stripe/Resend when founder ready; confirm demo login flags on Vercel before sharing links with prospects.                                                                                                                    |
| **Estimated effort** | Credentials (founder) + 1–2h verify                                                                                                                                                                                                    |
| **Current status**   | Keys blocked (known)                                                                                                                                                                                                                   |

### R5 — Retailer session failure path dumps sensitive debug

| Field                | Value                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | When staff lookup fails, retailer session loads **all** staff rows + auth users and `console.warn`s emails, user IDs, staff rows, and Supabase URL under `RETAILER_STAFF_DEBUG`.                 |
| **Evidence**         | `apps/retailer/lib/session.ts` ~L61–110: admin client `.from("retailer_staff_members")`, `listUsers`, counts, then `console.warn("RETAILER_STAFF_DEBUG …")` before `redirect("/accept-invite")`. |
| **Severity**         | **Critical** (PII / tenancy data in logs if this path hits production)                                                                                                                           |
| **Recommended fix**  | Delete the debug block; keep repository + redirect only.                                                                                                                                         |
| **Estimated effort** | 15–30 min                                                                                                                                                                                        |
| **Current status**   | **Fixed** after snapshot in same session (debug block removed; redirect retained)                                                                                                                |

### R6 — Background jobs / queues

| Field                | Value                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Email outbox + cron route exist; delivery blocked without Resend. Hobby cron capacity noted as constrained in PHASE.                                                                  |
| **Evidence**         | `@paon/email`, `email_outbox` repository tests pass; PHASE: Resend key missing; daily dispatch via `/api/cron/dispatch-emails`. No separate worker process — serverless cron pattern. |
| **Severity**         | High (product) / Medium (architecture OK)                                                                                                                                             |
| **Recommended fix**  | Set `RESEND_API_KEY`; verify outbox delivery end-to-end.                                                                                                                              |
| **Estimated effort** | 1–2h after credentials                                                                                                                                                                |
| **Current status**   | Code present; live delivery unverified                                                                                                                                                |

### R7 — Middleware / routing

| Field                | Value                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Middleware compiles in prior local sessions; production login and storefront routes resolve. No runtime middleware errors observed in production HTTP probes. |
| **Evidence**         | Terminal logs: “Compiled middleware”; production URLs 200; customer storefront HTML product path `/r/[slug]`.                                                 |
| **Severity**         | Info                                                                                                                                                          |
| **Recommended fix**  | None from this probe                                                                                                                                          |
| **Estimated effort** | —                                                                                                                                                             |
| **Current status**   | Appears healthy in production                                                                                                                                 |

---

## Runtime matrix

| Surface                 | Local (audit)          | Production                              |
| ----------------------- | ---------------------- | --------------------------------------- |
| Admin :3000 / Vercel    | Down                   | 200 `/login`                            |
| Retailer :3001 / Vercel | Down                   | 200 `/login`                            |
| Customer :3002 / Vercel | Down                   | 200 `/`, `/founder`, `/r/maison-dubois` |
| Supabase API            | Up (:54321)            | Hosted project linked                   |
| Stripe Checkout         | Not runnable (no keys) | Same                                    |
| Resend delivery         | Not runnable (no keys) | Same                                    |

---

## Overall status

**Production: Internally testable / demo-ready.**  
**Local: restart required.**  
**Critical repair:** remove `RETAILER_STAFF_DEBUG` before treating retailer portal as safe under real staff accounts.
