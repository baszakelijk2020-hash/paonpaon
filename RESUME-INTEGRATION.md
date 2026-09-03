# PAON — integration resume point (2026-09-03)

## TL;DR

The platform is **built, merged, and runs**. One branch:
`platform-integrated-20260903` = `release-integration-lane-h` = **`9c2bfc3`**.

- `pnpm install && pnpm build` → green (admin + retailer + customer + 11 pkgs)
- 292 migrations apply clean; demo data seeded
- All 3 apps boot and every screen was verified working by hand
  (admin, retailer as Nebel & Spiegel owner, customer as Isabelle)
- The work folded in this pass (PHASE 12.3 service-partner network) is live
  with data

## Run it (one command, after the stack is up)

```bash
cd /Users/nguyen/Projects/PAON && ./run-platform.sh
```

`run-platform.sh` brings up Supabase, applies migrations, seeds demo data, and
starts all three apps. Then:

| App      | URL                   | Login (password `Demo-PAON-2026!`, or use the "Quick persona" buttons) |
| -------- | --------------------- | ---------------------------------------------------------------------- |
| Admin    | http://localhost:3000 | `contact+platform-admin@nebelspiegel.com`                              |
| Retailer | http://localhost:3001 | `contact+atelier-demo-owner@nebelspiegel.com` (+ `-manager` etc.)      |
| Customer | http://localhost:3002 | `contact+isabelle@nebelspiegel.com` (+ `marc` `julien` `camille` …)    |

## What is NOT done

### 1. Completion gate — 28 of 46 re-proved, 18 left

`pnpm validate:completion` fails 18 checked items. All are customer-facing V3
screens (wardrobe, orders, account, dashboard OOTD, appointments audit, CTA
squircle) + 10.1 campaigns. **The screens themselves work** — confirmed by
logging in and using them. What fails is each item's automated Playwright
proof.

Root cause (partly diagnosed, not cracked): the failing specs do
`from("customers").eq("email", TEST_CUSTOMER_EMAIL).single()` where
`TEST_CUSTOMER_EMAIL = "e2e-shopper@paon.test"` (`apps/customer/e2e/fixtures.ts`),
but every `e2e-shopper` row in the DB has `email = e2e-shopper@nebelspiegel.com`
and there are **3 duplicate rows** — so `.single()` throws `fixture customer
missing` and the spec fast-fails (~100 ms) before it ever tests the screen.
Nothing in the schema, triggers, or `CustomerRepository` rewrites the address,
so the mismatch is between the running `global-setup.ts` and the `fixtures.ts`
on this checkout. `10.1 campaigns` is a separate, real assertion failure in the
clone/activate flow.

**Next step:** reconcile the e2e shopper identity — one email, one row, one
auth user — in `apps/customer/e2e/fixtures.ts` + `global-setup.ts`, wipe the
duplicate `customers` rows, then re-run and re-stamp:

```bash
cd apps/customer
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status`>
export SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`>
pnpm exec playwright test "(wardrobe-v3-presentation|orders-v3-presentation|account-v3-profile|dashboard-v3-daily-return|wardrobe-removal-v3|orders-actions-v3|orders-history-integrity-v3|item-specific-complete-the-look|customer-cta-squircle-v3|wardrobe-rail-contract-v3|dashboard-morning-routine-hero|appointments-audit-v3|campaigns)" --workers=1 --reporter=list
```

The specs write their own `docs/evidence/runs/<id>.json` on pass; then
`git add docs/evidence/runs/ && git commit`.

### 2. Not online — blocked by credentials nobody in-session holds

- **GitHub push:** HTTP 403 — the Claude GitHub App has no access to
  `baszakelijk2020-hash/paonpaon`. An org admin must (re)install it at
  https://github.com/apps/claude/installations/select_target . Until then every
  commit here is **local only** (safe: branch + tag `freeze-20260903-202905` +
  `/Users/nguyen/paon-freeze-20260903-202905.bundle`).
- **Direct Vercel deploy:** the token in `.env.local` fails with
  `Could not retrieve Project Settings` — expired or wrong scope. Needs a fresh
  `VERCEL_TOKEN` for team `team_fDLh0iXJ8upTJTwbAktVdtGc` (projects
  `paonpaon-customer` / `-retailer` / `-admin`).
- **Production Supabase** (`hngxrczavwywsnfceppb`) still needs this pass's new
  migrations applied: `supabase db push` (needs the DB password).

Once GitHub access is restored, `git push` from this branch triggers the normal
Vercel pipeline and no manual deploy is needed.

## Safety net

| Ref                                                                           | What                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `platform-integrated-20260903` / `release-integration-lane-h` @ `9c2bfc3`     | the integrated platform                            |
| tag `freeze-20260903-202905` / branch `stabilize/20260903-202905` @ `907d47d` | working tree exactly as inherited, pre-integration |
| `freeze/base-20260903-202905` @ `ec84ac5`                                     | the local trunk commit it was based on             |
| `/Users/nguyen/paon-freeze-20260903-202905.bundle`                            | offline copy of all of the above                   |

Full detail: `docs/PHASE.md` → "Integration checkpoint — 2026-09-03".
