# Security Review — Global sign-out candidate `feat/global-signout-20260901`

Independent review, 2026-09-01. Candidate commits on `feat/global-signout-20260901`
(branched from `e17236b`, the V3 controller final tip; not pushed, not merged):

- **Source** `e6ffd9ff7dca4c258a8feb97b9e543b2e17363ef` — `feat(auth): global sign-out across customer/retailer/admin`
- **Evidence** `cb49d940fc3e1a107d0b6bb2952ac12a6744660c` — `evidence(auth): prove global sign-out (customer/retailer/admin)`

Reviewed read-only in the candidate worktree. No files modified by this review
outside this report.

## Verdict

# ACCEPT

The candidate implements the founder's 2026-09-01 decision exactly (global
refresh-token revocation, proven cross-context), removes all "on this device"
copy, and fixes the long-standing cross-app "sign-out click sends zero POST"
bug with the minimal pattern already proven in the customer app. It touches no
RLS, tenancy, migration, cookie-flag, middleware, or Supabase-client-config
surface. Integrate **after** the V3 controller candidate (`e17236b`), which
this branch descends from.

Two residuals are noted below; neither is a defect in this candidate and
neither blocks integration.

---

## What changed (source `e6ffd9f`, 14 files)

| File                                                                                                                                                                                        | Change                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/customer/app/(dashboard)/actions.ts`                                                                                                                                                  | `supabase.auth.signOut({ scope: "local" })` → `supabase.auth.signOut()` (default `scope: "global"`); JSDoc updated                                                                                                                                                                                                                          |
| `apps/retailer/app/(dashboard)/actions.ts`                                                                                                                                                  | `signOut()` reshaped to the `useActionState` signature `(_prevState: SignOutState, _formData: FormData) => Promise<SignOutState>`; returns `{ error }` on failure instead of redirecting blind; `revalidatePath("/", "layout")` then `redirect("/login")` on success. `supabase.auth.signOut()` unchanged (already global — no `scope` arg) |
| `apps/admin/app/(dashboard)/actions.ts`                                                                                                                                                     | identical reshape to retailer                                                                                                                                                                                                                                                                                                               |
| `apps/retailer/app/(dashboard)/components/sign-out-button.tsx`                                                                                                                              | **new** `"use client"` component: `useActionState(signOut, null)`, `<form action={formAction}>`, `<Button type="submit" disabled={isPending}>`, `<p role="alert">` for the error                                                                                                                                                            |
| `apps/admin/app/(dashboard)/components/sign-out-button.tsx`                                                                                                                                 | **new**, identical                                                                                                                                                                                                                                                                                                                          |
| `apps/retailer/app/(dashboard)/layout.tsx`                                                                                                                                                  | drop inline `<form action={signOut}><Button/></form>` × 2; pass `<SignOutButton testId="retailer-signout-desktop" />` and a **separate** `<SignOutButton testId="retailer-signout-mobile" />`                                                                                                                                               |
| `apps/admin/app/(dashboard)/layout.tsx`                                                                                                                                                     | same; **now passes both** `signOutControl` and `signOutControlMobile` (previously only `signOutControl`, so AppShell reused one element instance in both DOM slots)                                                                                                                                                                         |
| `apps/customer/app/(dashboard)/account/page.tsx`                                                                                                                                            | copy: "Sign out of your account on this device." → "Sign out of your PAON account everywhere."                                                                                                                                                                                                                                              |
| E2E: `apps/{customer,retailer,admin}/e2e/_signout-helpers.ts` (new), `customer-signout-v3.spec.ts` (rewritten for global), `retailer-signout-v3.spec.ts` / `admin-signout-v3.spec.ts` (new) | proof only                                                                                                                                                                                                                                                                                                                                  |

All three `actions.ts` are now byte-identical (`git` blob `22c87f1`).
`packages/ui/src/components/AppShell.tsx` is **unchanged**.

## Verification by dimension

### Authentication / session invalidation — sound

- All three apps call `supabase.auth.signOut()` with **no `scope`** →
  `@supabase/supabase-js` default `scope: "global"` → GoTrue revokes **every
  refresh token** for the user, server-side, immediately.
- Proven, not asserted: each spec signs in two independent browser contexts as
  the same user, extracts context B's `refresh_token` from its
  `sb-*-auth-token` cookie, and POSTs it to `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`
  — **HTTP 200 before** context A signs out, **HTTP 400 after**. Confirmed for
  customer, retailer, and admin.
- End-to-end UX claim also proven: after A signs out, the spec rewrites
  context B's session cookie to expire the access token (simulating the
  eventual real expiry), reloads, and B drops to the guest shell (customer) /
  `/login` (retailer, admin). All three middlewares use
  `supabase.auth.getUser()` (server-validated), not `getSession()`, so a stale
  access token is rejected on its next use.
- Failure handling: on a `signOut` error the action returns `{ error }` and
  does **not** redirect — no false "you are signed out" while cookies are
  still live. On success: `revalidatePath("/", "layout")` then
  `redirect("/login")`. The cookie-clearing writes go through the existing SSR
  cookie adapter (`getSupabaseServerClient` `setAll`); specs assert
  `sb-*-auth-token` cookie count is 0 in the signing-out context afterward.
- The historical "zero POST reaches the server" bug (docs/PHASE.md "REAL BUG
  FOUND, NOT FIXED 2026-08-19") is fixed: `waitForRequest(r => r.method() === "POST" …)`
  resolves on every attempt (cold and warm), all three apps, desktop and
  mobile.

### Tenant isolation / RLS — not applicable, nothing touched

`git show --stat e6ffd9f` contains no migration, no `supabase/**`, no policy,
no `grant`, no `SECURITY DEFINER`, no RLS-adjacent file. Confirmed by
inspection of the full diff. Sign-out is user-session scoped and has no tenant
dimension.

### Cookies — unchanged

No change to cookie flags, `SameSite`, `HttpOnly`, `Secure`, cookie names,
the `@supabase/ssr` client config, or the `getSupabaseServerClient` cookie
adapter. `revalidatePath` (added in retailer/admin) is Next.js cache
invalidation, not a cookie or auth operation.

### The AppShell dual-mount fix — minimal and correct

Root cause: a server-rendered `<form action={serverAction}>` passed as a
`ReactNode` prop into the `"use client"` `AppShell`, and for admin the **same
element instance** rendered in both the desktop `<aside>` (line 244) and the
mobile drawer (line 383, `{signOutControlMobile ?? signOutControl}`). The fix
renders **two independent** `"use client"` `SignOutButton` components, each
with its own `useActionState(signOut)` — the identical pattern the customer
control has used successfully since `09274cf`. `AppShell` itself is not
modified. This is the smallest change that resolves the defect; no broader
refactor, no new abstraction.

### Accessibility / error handling — preserved and improved

`<button type="submit">` / `<Button type="submit">`, keyboard-reachable,
`disabled={isPending}` with a "Signing out…" label, and the failure path
renders `<p role="alert">` so a screen reader announces it. The prior
retailer/admin inline `<form>` had no error surface at all.

### Test quality — strong

Real auth (customer magic link; retailer/admin password form), two
independent contexts, the `waitForRequest` POST guard (the exact regression
check), a direct GoTrue refresh-token-endpoint assertion for the cross-context
proof, a simulated-expiry reload for the UX claim, a guest/redirect test, and
a console-error assertion. Retailer/admin match on the exact current-route URL
for the POST (their server action has no explicit form `action`) to avoid
racing incidental dashboard POST traffic — a deliberate, correct tightening.

### Merge compatibility

`feat/global-signout-20260901` is a direct descendant of `e17236b`. Its
customer `actions.ts` / `layout.tsx` edits sit on top of the V3 controller's
own customer sign-out commits (`f456c3c`/`09274cf`), which are ancestors here
— so integrating **V3 controller first, then this** applies cleanly. Applying
this branch's customer changes directly onto `release-integration-lane-h`
(which still has the pre-controller customer sign-out) would conflict on
`actions.ts`; the stated integration order avoids that.

---

## Residuals (not defects in this candidate; do not block integration)

1. **Cold-start Playwright flake.** Each app's desktop cross-context test
   times out once on the first request to a cold `next start` server (the POST
   has already fired and been asserted by then); warm runs pass in ~7–8 s.
   Absorbed by `retries: 2`, which the retailer/admin `playwright.config.ts`
   already sets for CI with a documented "Server Action round-trip exceeds the
   default timeout" rationale. No assertion was weakened. The release E2E
   sweep should run against warm servers.
2. **Pre-existing customer dashboard React #418 hydration error.** One
   customer cold-start retry is triggered by this, tracked separately under
   `agent/c3-dashboard-hydration-v3` / `docs/evidence/runs/customer-v3-signout-local-session/REPORT.md`.
   This candidate neither fixes nor worsens it.
3. **≤1 h stale-access-token window in other contexts.** Global sign-out
   revokes refresh tokens immediately, but a not-yet-expired access token in
   another context remains cryptographically valid until its next
   server-validated use or its `jwt_expiry` (3600 s local). This is inherent
   to Supabase's stateless-JWT model, not specific to this change, and the
   spec proves the other context _is_ logged out the moment its access token
   is stale. Closing the window entirely would require custom token
   denylisting — out of scope unless the founder requests it.

## Founder decision required

None. The decision that prompted this work (GLOBAL sign-out) is already made
and is implemented faithfully.

---

_Reviewed read-only 2026-09-01. This report is the only file added by the
review._
