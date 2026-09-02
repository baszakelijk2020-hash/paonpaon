# Demo Login Removal — Blocker 3 Remediation

## Root cause (confirmed)

All three apps (`apps/admin`, `apps/retailer`, `apps/customer`) gated
demo-login UI on:

```ts
process.env.NODE_ENV !== "production" ||
  process.env["NEXT_PUBLIC_DEMO_LOGIN"] === "1";
```

`docs/DEPLOYMENT.md:33-36` records that `NEXT_PUBLIC_DEMO_LOGIN=1` is set
on all three production Vercel projects — the second half of that `||`
made the `NODE_ENV` check irrelevant in real production. The likely
original intent of the flag was to keep demo login available on Vercel
**Preview** deployments, which also report `NODE_ENV=production` (Next.js
sets `NODE_ENV=production` for any production build, preview or not) — so
a `NODE_ENV`-only check can't tell Preview and Production apart, and
whoever added the flag needed _some_ way to re-enable demo login on
Preview. The flag was then also present on the real Production
environment, defeating the check entirely.

## Fix applied (code, this session)

### 1. Environment-aware gate replaces the leaky flag

`process.env["VERCEL_ENV"]` is set automatically by Vercel per deployment
target (`production` / `preview` / `development`) and cannot be
accidentally copied across environments the way a manually-set
`NEXT_PUBLIC_*` variable can. All three login pages now compute:

```ts
const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");
```

(The `NODE_ENV` fallback only applies when `VERCEL_ENV` is entirely
absent — i.e. running off Vercel, such as local `next start`.)

Every demo-login UI element (`MasterDemoLogin`, `QuickDemoLogin`,
`DemoLoginForm`) is now gated on `!isRealProduction` instead of the old
condition, in:

- `apps/admin/app/login/page.tsx`
- `apps/retailer/app/login/page.tsx`
- `apps/customer/app/login/page.tsx`

`NEXT_PUBLIC_DEMO_LOGIN` is no longer read anywhere in the codebase.
**The Vercel env var itself is still set on production as of this
writing** — it is now inert (nothing reads it), but removing it from the
three `paonpaon-*` Production environments is still recommended cleanup
so a future code path can't accidentally resurrect the footgun. This
agent has authenticated Vercel CLI access in this environment but has
not removed it, pending explicit confirmation this is wanted — flagged
in the final certification as an outstanding action, not silently done.

### 2. Server-side rejection, not just a hidden button

Per the mission's requirement that "direct route/API attempts fail
safely," hiding the UI element is not sufficient — someone who already
knows a demo email/password could still POST directly to the real sign-in
action. Server-side, in real production:

- **`apps/admin/app/login/actions.ts`, `apps/retailer/app/login/actions.ts`**
  — `signIn` (the same real Server Action both normal and demo login
  submit to) now rejects any email matching the demo persona pattern
  `/^contact(\+[^@]+)?@nebelspiegel\.com$/i` before calling Supabase auth,
  redirecting to the standard `invalid_credentials` error — indistinguishable
  from a wrong password, so it doesn't leak that demo-blocking is why it
  failed.
- **`apps/customer/app/login/actions.ts`** — `signInToDemo` (a distinct
  action from the customer app's real passwordless `requestMagicLink`)
  now short-circuits unconditionally in real production, before even
  parsing the submitted credentials.

Demo accounts are real Supabase users authenticated via real
`signInWithPassword` (not a bypass) — rejecting by email pattern in real
production is what actually prevents access; it does not touch or need
to touch RLS, since the accounts' own credentials remain otherwise valid
(e.g. for local/preview use) and are not being revoked here.

## Verification status

- **CODE IMPLEMENTED**: `pnpm -w typecheck` passes with these changes
  (12/12 packages).
- **RUNTIME VERIFIED (local, `VERCEL_ENV=production` build), 2026-08-21**:
  - `pnpm build` with `VERCEL_ENV=production` succeeded for all three
    apps (admin, retailer, customer).
  - Admin: production-mode server, `curl /login` — zero occurrences of
    "Demo login" in the HTML. Playwright confirmed visually: only
    Email/Password fields and the real "Enter PAON" submit — no demo
    controls rendered at all.
  - Admin: filled the real form with the known demo credentials
    (`contact@nebelspiegel.com` / `Demo-PAON-2026!`) and submitted via
    the actual browser form (not a raw POST, which Next.js Server
    Actions don't accept as plain `x-www-form-urlencoded`) — the
    submission redirected to `/login?error=invalid_credentials`,
    identical to a wrong password. **Server-side rejection confirmed
    working**, not just UI-hidden.
  - Retailer: production-mode server, `curl /login` — zero occurrences
    of "Demo login" in the HTML.
  - Customer: production-mode server, `curl /login` and
    `curl "/login?demo=1"` — no demo password form rendered at either
    URL. Playwright snapshot of `/login?demo=1` confirmed only the real
    magic-link email field is present; the `demo=1` query param no
    longer surfaces `DemoLoginForm` at all in real production.
  - Dev-mode control check: with `VERCEL_ENV` unset (`pnpm dev`), the
    demo login button and quick-persona controls render normally on
    admin's `/login`, confirming the gate only suppresses demo login in
    real production, not universally — the feature remains available
    for local development as intended.
- **NOT YET PRODUCTION VERIFIED**: this code has not been deployed to
  the actual `paonpaon-admin` / `paonpaon-retailer` / `paonpaon-customer`
  Vercel projects yet. Once deployed, confirm `/login` on each shows no
  demo controls and that a direct submission with known demo credentials
  fails, the same way it was verified locally above.

## What was explicitly NOT done (scope discipline)

- Demo accounts themselves were not deleted or deactivated — that's a
  data operation (`packages/database/src/demo-seed.ts`'s
  `deactivate:demo` script already exists for this) outside this code
  fix's scope, and orthogonal to closing the login path.
- `NEXT_PUBLIC_DEMO_LOGIN` was not removed from Vercel project settings
  in this session — flagged above as a recommended but not yet executed
  follow-up, since it's a production environment mutation.
