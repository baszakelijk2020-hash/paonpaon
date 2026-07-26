# API

## Internal: Server Actions first

Within the three apps, mutations are Next.js Server Actions, not calls to
a hand-rolled REST/JSON API. A Server Action:

1. Receives input, validates it against a schema derived from
   `@paon/domain` types.
2. Authorizes the caller via `@paon/auth` (`requireRetailerRole`, etc.).
3. Calls one or more `@paon/database` repository methods.
4. Returns a typed result; errors are thrown as `UnauthorizedError` /
   `ForbiddenError` (`@paon/auth`) or domain-specific error classes,
   caught at the call site and rendered as UI state — never as an
   unhandled 500.

Reads happen directly in Server Components via repositories — there is
no internal "API layer" being called over HTTP by the app's own UI.
That indirection buys nothing when the caller and the server are the
same deployment, and it's one more place for the domain model and the
wire format to drift.

## Route Handlers (`app/api/**`)

Used only when the caller is not the app's own Server Components/Actions:

- **Webhooks** — Supabase, payment provider, future integrations.
  Verify signatures before doing anything else; delegate to a
  repository/service, never inline business logic in the handler.
- **Public API** (future, see [ROADMAP.md](./ROADMAP.md)) — versioned
  (`/api/v1/...`), authenticated with retailer-scoped API keys, rate
  limited, documented with OpenAPI. Not started yet — see
  [NON_GOALS.md](./NON_GOALS.md).
- **Anything a non-browser client must call** — e.g. a future mobile
  client, a scheduled job trigger.

A Route Handler is a deliberate, documented exception, not the default
way to move data — if you're reaching for one to serve the app's own
frontend, use a Server Component or Server Action instead.

**One narrow, deliberate exception**: `apps/customer/app/r/[slug]/route.ts`
serves a founder-supplied legacy HTML file byte-for-byte (a Route Handler
is the only mechanism that bypasses the React tree/layout entirely, which
byte-fidelity requires) — see `docs/DECISIONS.md` ADR-046 before assuming
this pattern is available elsewhere; it is not a precedent for serving any
other page this way.

## Error conventions

- Expected, user-facing failures (validation, authorization, not found)
  are typed errors, caught and turned into UI state with a clear
  message. Never a raw stack trace or a generic "something went wrong"
  where the cause is knowable.
- Unexpected failures are logged with enough context to reproduce
  (retailer, actor, action) and surfaced to the user as a generic,
  branded error state — see [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)
  "designed, not defaulted" for empty/error states.

## Versioning

Internal Server Actions are not versioned — they deploy atomically with
the app. The future public API is versioned from day one
(`/api/v1/...`) because external integrators cannot be forced to
redeploy on our schedule.
