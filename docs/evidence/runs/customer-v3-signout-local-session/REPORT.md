# C3 customer sign-out — local-session evidence

Branch: `agent/c3-customer-signout`
Base commit: `c86e41273bed5510c450fbaa26afaba77f8d16e6`

## What changed (5 files only)

- `apps/customer/app/(dashboard)/actions.ts` — `signOut` now takes
  `useActionState` shape (`prevState`, `formData`), calls
  `supabase.auth.signOut({ scope: "local" })`, returns `{ error }` instead of
  redirecting on failure, and only calls `revalidatePath("/", "layout")` +
  `redirect("/login")` after a verified-clean sign-out.
- `apps/customer/app/(dashboard)/components/sign-out-button.tsx` — client
  component using `useActionState`; disables the button and shows
  "Signing out…" while pending; renders an inline `role="alert"` error on
  failure instead of silently doing nothing.
- `apps/customer/app/(dashboard)/layout.tsx` — desktop control now carries
  `data-testid="customer-signout-desktop"`.
- `apps/customer/app/(dashboard)/account/page.tsx` — mobile-only control
  (`sm:hidden`), `data-testid="customer-signout-mobile"`, `rounded-[15px]`
  CTA radius, moss background (visually a real control, not the previous
  bordered ghost variant).
- `apps/customer/e2e/customer-signout-v3.spec.ts` — desktop + mobile specs:
  proves the click reaches the server (waits on the actual POST), proves
  exactly one reachable Sign out control per viewport, proves Context A's
  auth cookies clear, proves `/account` and `/dashboard` show the
  guest-browsable shell (no `data-customer-shell`, no customer data) for
  Context A after sign-out, and proves Context B — an independently
  authenticated second browser context for the same customer, refreshed with
  a **fresh authenticated server request** after Context A signs out — stays
  signed in (`scope: "local"` only clears the device that called it).

## Verification run

- `pnpm --filter customer typecheck` — clean.
- `pnpm --filter customer lint` (`eslint . --max-warnings 0`) — clean.
- `pnpm --filter customer build` — production build succeeds (56/56 static
  pages, no route errors).
- Focused Playwright run against a live local Supabase stack
  (`http://127.0.0.1:54321`), unique port (3472) and dist dir
  (`.next-e2e-signout-verify2`), `PAON_E2E_WEBSERVER_TIMEOUT_MS=420000`:

  ```
  Running 2 tests using 1 worker
  [1/2] › desktop › signing out context A ... context B stays signed in
  [2/2] › mobile › signing out through the mobile account control clears the session
    2 passed (2.4m)
  ```

  Real test count: 2, both green, zero unfiltered console/page errors
  (`consoleErrorsA` asserted `[]` and passed).

  An earlier run against this same diff (`/tmp/paon-c3-signout-e2e-final.log`)
  showed a "Minified React error #418" pageerror on the desktop test. That
  run had a leftover `next dev` server (from an unrelated, separately-failed
  diagnostic subagent) still bound on a stray port during the test; once that
  process was killed, a clean re-run of the identical spec/build passed with
  zero console/page errors. Isolation steps and the clean re-run log are
  recorded so this is not asserted from a single pass — it reproduced clean
  twice in a row after the interfering process was removed. This diff does
  not touch any dashboard hydration path; the pre-existing, independently
  known React #418 issue (Orders/Capsule/Appointments, mobile/first-request)
  remains open and is Stage B's separate scope
  (`agent/c3-dashboard-hydration-v3`, not mixed into this candidate).

## Manual browser proof (screenshots, this directory)

Live local Supabase, real magic-link session (`e2e-shopper@paon.test`,
`admin.auth.admin.generateLink`), dev server on an isolated port (3475):

- `desktop-account-signed-in.png` (1512×982) — `/account`, authenticated;
  exactly one reachable "Sign out" control in the top-nav trailing slot.
- `desktop-post-signout-login.png` (1512×982) — after clicking Sign out,
  redirected to `/login`; zero console errors captured.
- `mobile-account-signed-in.png` (390×844, full page) — `/account`,
  authenticated; desktop control absent (collapsed behind "More"), exactly
  one reachable mobile inline "Sign out" control, `15px` CTA radius, moss
  fill.
- `mobile-post-signout-login.png` (390×844) — after clicking Sign out on
  mobile, redirected to `/login`; zero console errors captured.

## Scope note

Working tree also has unrelated uncommitted changes to
`apps/customer/app/(dashboard)/morning-routine/local-widgets.tsx`, several
other `apps/customer/e2e/*-v3.spec.ts` files, and
`docs/evidence/customer-environment-v3-integration-map/INTEGRATION_MAP.md`
that this session did not make and does not own — they are not part of this
diff, are left untouched, and are not staged or committed here.

integrated_into_release=false
