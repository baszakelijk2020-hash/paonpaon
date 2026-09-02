# Production Observability — Blocker 2 Remediation

Status legend used throughout: **CODE IMPLEMENTED** (compiles, exists) →
**MIGRATION APPLIED** (schema exists in the target database) → **RUNTIME
VERIFIED** (proven to work against a real, running Postgres) →
**PRODUCTION VERIFIED** (proven to work against the actual production
deployment). Only the last of these justifies calling this blocker
resolved end to end.

## Decision

Founder chose (2026-08-21): ship a Supabase-based error capture now,
architected so a Sentry (or other) SDK can be swapped in later without
touching call sites. Sentry was explicitly deferred, not required for this
release.

## What was built

### 1. Schema — `supabase/migrations/20260821000000_create_error_events.sql`

Append-only `public.error_events` table: `app` (admin/retailer/customer),
`environment`, `level`, `route`, `message`, `stack`, `request_id`,
`context` (jsonb), `created_at`. RLS enabled; no insert policy exists for
`anon`/`authenticated` — rows are written only by the service-role
reporter, which bypasses RLS. `service_role` and `authenticated` get an
explicit `GRANT SELECT` (this project revokes default table privileges —
see `20260814030000_grant_service_role_conversation_proposals_write.sql`
for precedent); `service_role` additionally gets `GRANT INSERT`. A read
policy restricts `authenticated` reads to `public.is_platform_staff()`.

**Status: CODE IMPLEMENTED, MIGRATION APPLIED to local rehearsal DB only.**
Not yet applied to production. Production migration application is
covered by `PRODUCTION-MIGRATION-PLAN.md` / `DEPLOYMENT-RECOVERY-RUNBOOK.md`
and requires founder-run `supabase db push --linked` per ADR-044 — this
agent's Supabase CLI session in this environment is unauthenticated
(`supabase migration list --linked` returns 401), so it cannot self-apply
to production regardless.

### 2. Reporter — `packages/database/src/error-reporting.ts`

`reportError(input)` — fire-and-forget, never throws. Uses
`createSupabaseAdminClient` (service-role) to insert a row. Strips any
context key matching
`/password|token|secret|cookie|apikey|api_key|authorization|session/i`
before storage, and only keeps primitive (string/number/boolean/null)
context values — no nested objects, no accidental blobs. If Supabase
credentials are missing, or the insert itself fails, it logs to
`console.error` and returns — a broken reporter can never become a second
outage on top of what it was trying to report.

Swapping in Sentry later means changing the body of this one function;
no call site changes.

### 3. Wiring — one instance per app (admin done directly; retailer and

customer replicated from the proven admin pattern):

- `apps/<app>/instrumentation.ts` — Next.js `onRequestError` hook, catches
  uncaught Server Component / Route Handler / Server Action errors (the
  paths Blocker 5's audit found silently dying).
- `apps/<app>/app/global-error.tsx` — client root error boundary, posts to
  `/api/client-error` on render crashes it can't recover from.
- `apps/<app>/app/api/client-error/route.ts` — zod-validates the client
  report (message required; stack/digest/route optional, length-capped),
  calls `reportError`, always responds `204` regardless of outcome.

**Status: CODE IMPLEMENTED for admin (typechecked). Retailer/customer
replication dispatched to workers — confirm their typecheck result before
counting them done.**

### 4. Regression test —

`packages/database/src/repositories/__integration__/error-reporting-live.integration.test.ts`

Run with `PAON_INTEGRATION=1` against a live Postgres. Two cases:

1. Reports a controlled test error with both safe fields
   (`userFacingCode`, `retryCount`) and secret-shaped keys (`password`,
   `sessionToken`, `apiKey`) in context; asserts the row lands, the safe
   fields survive, the secret-shaped keys are absent from the stored row,
   and the literal secret value (`should-not-be-stored`) does not appear
   anywhere in the persisted JSON.
2. Asserts `reportError` resolves (never throws) when Supabase credentials
   are entirely missing.

**Verified: RAN against the local Supabase rehearsal stack
(`supabase db reset` → full 249-migration chain including this one →
`pnpm exec vitest run .../error-reporting-live.integration.test.ts`) on
2026-08-21. Both tests passed.** This is real Postgres, real RLS, real
grants — not a mock. It is **not** production.

## What is NOT yet true (do not claim these)

- **Not applied to the production database.** `error_events` does not
  exist in the live `hngxrczavwywsnfceppb` project yet.
- **No production evidence.** No error has been captured from a real
  production request; the capture path has never executed inside a
  deployed Vercel function.
- **No alerting.** Rows land in a table; nobody is paged. Reading them
  today means a platform-staff account querying `error_events` directly
  (e.g. via Studio or a future admin-app view). That view was not built —
  out of scope for this blocker unless the founder asks for it; it is not
  required to satisfy "meaningful visibility," but it is the honest gap.
- **Sentry is not integrated.** Deliberately deferred per founder
  decision above — not a release blocker for this pass.

## Required before this blocker can be marked RESOLVED

1. Apply `20260821000000_create_error_events.sql` to production (part of
   the broader Blocker 1/4 migration push — not run separately, since
   this project's migration process is "apply the whole pending chain,"
   not cherry-pick).
2. Confirm the three apps' `SUPABASE_SERVICE_ROLE_KEY` /
   `NEXT_PUBLIC_SUPABASE_URL` Vercel env vars are present in each
   Production environment (the reporter silently no-ops without them —
   check Vercel project settings, not just `.env.example`).
3. Trigger one real error against each deployed production app (e.g. a
   safe, deliberately-invalid request to a route already covered by the
   `onRequestError`/`client-error` path) and confirm a row appears in
   production `error_events` with no secret values present.
4. Only then: mark **PRODUCTION VERIFIED** and consider Blocker 2
   genuinely resolved.

Until step 3 has evidence attached, this blocker is **CODE
IMPLEMENTED + RUNTIME VERIFIED (local only)** — not resolved.
