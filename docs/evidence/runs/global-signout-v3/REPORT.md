# Global sign-out (customer / retailer / admin) — v3 proof

Source commit: `e6ffd9ff7dca4c258a8feb97b9e543b2e17363ef`
Founder decision: 2026-09-01 — sign-out is **global**, superseding the prior
local-scope customer sign-out.

## What changed

- **Global scope in all three apps.** `supabase.auth.signOut()` is now
  called with **no `scope` argument** (Supabase default `scope: "global"`)
  in `apps/customer`, `apps/retailer`, and `apps/admin`
  `app/(dashboard)/actions.ts`. Signing out in one browser context revokes
  **every** refresh token for that user, everywhere — not just the device
  that clicked Sign out. The customer "Sign out of your account on this
  device." copy is replaced with "Sign out of your PAON account
  everywhere."
- **Retailer + admin `signOut` action hardened** to the
  `useActionState`-compatible shape already used by customer: signature
  `(_prevState, _formData) => SignOutState`, returns `{ error }` on a
  failed `signOut` instead of redirecting as if the session had cleared,
  and only a verified-clean sign-out calls `revalidatePath("/", "layout")`
  then `redirect("/login")`.

## AppShell root-cause fix

`docs/PHASE.md` "REAL BUG FOUND, NOT FIXED 2026-08-19": the retailer/admin
sign-out click registered in the DOM but produced **zero POST requests**.
Root cause: the layout passed a single server-rendered
`<form action={serverAction}>` **element** into AppShell, which mounts its
sign-out slot in two DOM locations (desktop sidebar + mobile drawer);
re-using one element instance across both mounts left the click wired to a
detached/duplicated node.

Fix: each app now renders **two independent `SignOutButton` client
components** (`"use client"`, `useActionState`, mirroring the
already-working customer control) — one passed to `signOutControl`, one to
`signOutControlMobile`. New files:
`apps/retailer/app/(dashboard)/components/sign-out-button.tsx`,
`apps/admin/app/(dashboard)/components/sign-out-button.tsx`. AppShell itself
was not modified.

## Proof — E2E specs

| App      | Spec                                            | Tests                                    | Result                                   |
| -------- | ----------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| customer | `apps/customer/e2e/customer-signout-v3.spec.ts` | 2 (desktop cross-context, mobile)        | 2 passed, 0 failed (1 flaky — see below) |
| retailer | `apps/retailer/e2e/retailer-signout-v3.spec.ts` | 3 (desktop cross-context, mobile, guest) | 3 passed, 0 failed (1 flaky — see below) |
| admin    | `apps/admin/e2e/admin-signout-v3.spec.ts`       | 3 (desktop cross-context, mobile, guest) | 3 passed, 0 failed (1 flaky — see below) |

Shared helper `e2e/_signout-helpers.ts` (identical in all three apps)
decodes the `sb-*-auth-token` cookie to read the embedded `refresh_token`,
POSTs it directly to Supabase Auth's `/auth/v1/token?grant_type=refresh_token`
endpoint (bypassing the app), and returns the HTTP status.

### Cross-context refresh-token proof (baseline 200 -> post-signout 400)

Each app's desktop test signs in two independent browser contexts (A and B)
as the same user, snapshots context B's session, verifies B's refresh token
is live (`200`), has context A click Sign out, then verifies B's **same**
refresh token is now revoked (`400`) and that B drops to the guest
shell / `/login` on its next server round-trip.

- **customer**: baseline `200` -> post-signout `400` — confirmed.
- **retailer**: baseline `200` -> post-signout `400` — confirmed (on the warm retry pass).
- **admin**: baseline `200` -> post-signout `400` — confirmed (on the warm retry pass).

### Flaky notes (no assertion weakened; `--retries=2` = the config's own CI value)

- **customer**: a pre-existing, separately-tracked **React #418
  dashboard-hydration** error (`agent/c3-dashboard-hydration-v3`; already
  documented in `docs/evidence/runs/customer-v3-signout-local-session/REPORT.md`
  and `docs/PHASE.md`). It fires on the first request to a cold `next start`
  server and lands on whichever test runs first. It is **not** introduced
  by this diff — the entire customer app-code change is removing the
  `{ scope: "local" }` argument and one copy string, neither of which
  touches a hydration path. An isolated 3x-repeat of the desktop test ran
  3/3 green. `--retries=2` absorbs the cold-start occurrence.
- **retailer / admin**: the desktop cross-context test's
  `expect(pageA).toHaveURL(/\/login$/)` **after** the sign-out click
  exceeds Playwright's 20s expect timeout on the **first request to a cold
  server** (~27s; the sign-out `POST` has already fired and been asserted
  by that point). Warm, the whole flow — POST -> `signOut()` -> revalidate
  -> redirect -> `/login` -> cookies cleared -> cross-context `400` —
  completes in ~7-8s. Confirmed cold-start-only by a repeat run whose warm
  iteration passed in 7.7s. The retailer/admin `playwright.config.ts`
  already sets `retries: 2` in CI with the comment "a click that triggers a
  Server Action round-trip regularly exceeds Playwright's ... default ...
  timeout".

## No `scope: "local"` anywhere

`grep -rn 'scope.*local' apps/customer/app apps/retailer/app apps/admin/app --include='*.ts' --include='*.tsx'`
-> **no matches**. All three `auth.signOut()` call sites are bare
`supabase.auth.signOut()`.

## No RLS / cookie / auth-boundary file touched

Full list of files in the source commit `e6ffd9f` — application code and
E2E specs only:

- `apps/customer/app/(dashboard)/actions.ts`
- `apps/customer/app/(dashboard)/account/page.tsx`
- `apps/customer/e2e/customer-signout-v3.spec.ts`
- `apps/customer/e2e/_signout-helpers.ts` (new)
- `apps/retailer/app/(dashboard)/actions.ts`
- `apps/retailer/app/(dashboard)/layout.tsx`
- `apps/retailer/app/(dashboard)/components/sign-out-button.tsx` (new)
- `apps/retailer/e2e/retailer-signout-v3.spec.ts` (new)
- `apps/retailer/e2e/_signout-helpers.ts` (new)
- `apps/admin/app/(dashboard)/actions.ts`
- `apps/admin/app/(dashboard)/layout.tsx`
- `apps/admin/app/(dashboard)/components/sign-out-button.tsx` (new)
- `apps/admin/e2e/admin-signout-v3.spec.ts` (new)
- `apps/admin/e2e/_signout-helpers.ts` (new)

No migration, RLS policy, `SECURITY DEFINER` function, grant, middleware,
cookie-flag, or Supabase-client-config file is in the diff.

## Static checks

`pnpm --filter @paon/{customer,retailer,admin} lint` + `typecheck` — all
clean. `pnpm --filter @paon/ui typecheck` — clean. `pnpm --filter
@paon/{retailer,admin} build` — production build succeeds. The pre-commit
hook re-ran turbo `lint` + `typecheck` across the affected packages on
commit — all green.
