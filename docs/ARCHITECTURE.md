# Architecture

## Repository shape

PAON is a single pnpm + Turborepo monorepo. Three deployable Next.js
applications consume a set of shared, framework-aware packages. Nothing
in `apps/*` should contain business logic that a second app will need —
if it would be needed twice, it belongs in `packages/*`.

```
paon/
├── apps/
│   ├── admin/          @paon/admin     — PAON Admin
│   ├── retailer/       @paon/retailer  — Retailer Portal
│   └── customer/       @paon/customer  — Customer Portal
├── packages/
│   ├── domain/         @paon/domain          — entities, value objects, pure business types
│   ├── database/        @paon/database        — Supabase clients, generated DB types, repositories
│   ├── auth/            @paon/auth            — session shape, role guards
│   ├── ui/              @paon/ui              — design system: tokens + components
│   ├── utils/            @paon/utils           — framework-agnostic formatting/helpers
│   ├── typescript-config/ @paon/typescript-config — shared tsconfig bases
│   └── eslint-config/    @paon/eslint-config    — shared flat ESLint configs
├── supabase/            — migrations, config, seed data (single Postgres project, all three apps)
└── docs/                — this constitution
```

Why one repo for three apps: they share one Postgres schema, one domain
model and one design system. Splitting them into separate repos would
force either a published-package release cycle for every domain change
(slow, and it invites the three apps' models to drift) or a duplicated
domain model per repo (guaranteed drift). A monorepo with Turborepo's
task caching keeps CI fast without paying that cost. This is revisited
in [DECISIONS.md](./DECISIONS.md).

## Layering rule

Dependencies only ever point one direction:

```
apps/*  →  @paon/auth, @paon/ui, @paon/utils  →  @paon/database  →  @paon/domain
```

`@paon/domain` depends on nothing else in the workspace. It is pure
TypeScript types and value objects — no React, no Supabase client, no
Next.js. This is what makes it safe to import from any layer, including
future non-Next.js contexts (a background worker, a CLI, a public API
service) without dragging in a web framework.

An app must never import another app's code. Shared UI, shared logic and
shared types are the only things that cross the app boundary, and they
cross it through `packages/*`, never through a relative `../../` import
into a sibling app.

## Application layer (Next.js 15, per app)

- **App Router, React Server Components by default.** A component is a
  Client Component only when it needs interactivity, browser APIs, or
  state — not by default and not for convenience.
- **Data fetching happens in Server Components and Server Actions**,
  through a `@paon/database` repository, never through a client-side
  fetch to a bespoke API route unless the consumer is genuinely a
  third party (see [API.md](./API.md)).
- **Mutations go through Server Actions**, validated against
  `@paon/domain` types and authorized through `@paon/auth` guards,
  before hitting a repository.
- **Route Handlers (`app/api/**`)** exist only for: webhooks (Supabase,
  payment provider), the future public API, and anything a non-browser
  client must call. Not as a general-purpose backend-for-frontend.

## Data access layer — `@paon/database`

- Three Supabase client constructors: browser (anon key, RLS-enforced),
  server (anon key + user's cookies, RLS-enforced as that user), and
  admin (service-role key, bypasses RLS — restricted to trusted server
  contexts only: webhooks, cron, admin-authorized actions).
- **Repositories**, one per aggregate root, are the only code allowed to
  run a Supabase query. UI code and Server Actions call a repository
  method; they never construct a `.from("table")` query inline. This is
  what keeps query logic, and therefore correctness fixes, in one place
  per aggregate. See `RetailerRepository` for the reference shape.
- Generated types (`supabase gen types typescript`) are the source of
  truth for what a table row looks like on the wire; `@paon/domain`
  entities are what business logic operates on. Repositories are the
  translation boundary between the two — see [DATABASE.md](./DATABASE.md).

## Multi-tenancy and authorization

Every tenant-scoped table carries a `retailer_id`. Tenant isolation is
enforced at the database with Postgres Row Level Security — not only in
application code. Application-layer checks (`@paon/auth` guards,
`requireRetailerRole`) are defense in depth and produce better error
messages; RLS is the actual security boundary. A bug in a Server Action
must never be able to leak one retailer's data to another — see
[DATABASE.md](./DATABASE.md) "Row Level Security".

`@paon/domain` branded ID types (`RetailerId`, `CustomerId`, ...) exist
specifically to make it a compile error to pass the wrong tenant-scoped
ID into the wrong function, catching an entire class of cross-tenant bug
before RLS is ever asked to catch it at runtime.

## Design system — `@paon/ui`

One set of design tokens (`packages/ui/src/styles/globals.css`) and one
set of primitive components, consumed by all three apps and themeable
per retailer via `Retailer.brandTheme`. See
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md). No app defines its own color
palette, spacing scale or button component.

## State management

Server state lives on the server and is read via Server Components —
there is no client-side global store mirroring database state. Client
state (form state, optimistic UI, ephemeral UI state) uses React's
built-in state and, where genuinely cross-component, React context
scoped to a feature — not a global client state library, until a
concrete need proves otherwise.

## Hosting

Vercel for all three Next.js apps (one Vercel project per app, sharing
the Supabase project). Supabase for Postgres, Auth, Storage and
Realtime. See [DATABASE.md](./DATABASE.md) and each app's `.env.example`
for required environment variables.

## Testing

- **Unit / integration**: Vitest, colocated with the code under test in
  packages and apps that contain logic worth testing in isolation
  (`@paon/domain`, `@paon/utils`, repositories).
- **End-to-end**: Playwright, one suite per app under
  `apps/<app>/e2e`, run against a real Supabase local stack in CI.
- See [DECISIONS.md](./DECISIONS.md) for why Vitest + Playwright over
  alternatives.

## CI

GitHub Actions runs, on every pull request: install, lint, typecheck,
unit tests, and build, for every affected package/app (Turborepo
determines the affected set). E2E runs on merge to `main` and before
deploy. No PR merges with a red check.
