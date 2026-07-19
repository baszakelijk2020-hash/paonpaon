# Decisions

Architecture Decision Record. Append new decisions chronologically;
never edit or delete a past entry to reflect a later change — instead
add a new entry that supersedes it and link back. Format: Context →
Decision → Consequences.

---

## ADR-001: pnpm + Turborepo monorepo for all three apps

**Context.** Three Next.js apps share one Postgres schema, one domain
model and one design system. They need to evolve together without
either a published-package release cycle slowing every shared change,
or duplicated code drifting between apps.

**Decision.** Single pnpm workspace + Turborepo monorepo
(`apps/*`, `packages/*`), not three separate repositories, and not npm
or Yarn workspaces (pnpm's strict, content-addressed node_modules
prevents phantom dependencies — a package silently working because a
sibling happened to hoist a transitive dep — which matters more as the
number of packages grows).

**Consequences.** One `pnpm install`, one CI pipeline, coordinated
releases. Turborepo's task graph and caching keep `lint`/`typecheck`/
`build`/`test` fast by only running against affected packages. Cost:
all three apps deploy from the same repository state, so a broken build
in one package can block CI for a change to an unrelated app unless
Turborepo's affected-scoping is configured correctly (it is, per
[ARCHITECTURE.md](./ARCHITECTURE.md) "CI").

---

## ADR-002: Next.js 15 App Router, Server Components by default

**Context.** Need one rendering model across three apps with different
audiences (internal console, staff console, customer-facing) but the
same performance and correctness bar.

**Decision.** App Router with React Server Components as the default;
Client Components are opt-in per component, not per page.

**Consequences.** Data fetching is colocated with the component that
needs it, streaming is free, and client bundle size stays proportional
to actual interactivity rather than to page count. Cost: the team must
be disciplined about the server/client boundary — see
[ARCHITECTURE.md](./ARCHITECTURE.md) "Application layer."

---

## ADR-003: Supabase (Postgres) as the single backend, RLS as the tenant boundary

**Context.** Need multi-tenant data isolation (many retailers), auth,
realtime updates (order/production status), and storage, without
standing up and maintaining bespoke infrastructure for each.

**Decision.** One Supabase project (one Postgres database). Tenant
isolation via Row Level Security, not via per-tenant databases or
schemas.

**Consequences.** Massive operational simplicity versus per-tenant
infrastructure — one database to migrate, back up and monitor.
Correctness of RLS policies becomes the single most safety-critical
piece of the system; see [DATABASE.md](./DATABASE.md) "Row Level
Security" and the requirement that every table ship its policies in the
same migration that creates it. Revisit only if a specific retailer's
compliance requirement demands physical data isolation — not
anticipated at current scale.

---

## ADR-004: Branded (nominal) ID types across the domain model

**Context.** Dozens of entity types, many sharing the same underlying
`string` (UUID) representation. A `CustomerId` passed where a
`RetailerId` is expected is a real, dangerous class of bug in a
multi-tenant system.

**Decision.** Every entity ID is a distinct branded type (`Brand<string,
"CustomerId">`), defined once in `packages/domain/src/shared/branded-id.ts`.

**Consequences.** Cross-entity and cross-tenant ID mix-ups become
compile errors instead of runtime data leaks. Small cost in ceremony
(`asId<...>()` at data-access boundaries) that is worth paying every
time, given the priority order in [PRINCIPLES.md](./PRINCIPLES.md).

---

## ADR-005: Tailwind CSS v4 with CSS-native design tokens (`@theme`)

**Context.** One design system, three apps, per-retailer theming
overrides, using `oklch` for a perceptually consistent neutral scale.

**Decision.** Tailwind v4, tokens defined in `packages/ui/src/styles/globals.css`
via `@theme`, imported once by every app (`@paon/ui/styles.css`) rather
than a shared `tailwind.config.ts` preset (v4's CSS-first configuration
supersedes the old JS preset pattern).

**Consequences.** No JS config drift between apps; tokens are visible
and editable as CSS, which is also what a retailer's `brandTheme`
override ultimately manipulates. Cost: v4 is newer and its shared-config
conventions for monorepos are less battle-tested than v3's — accepted
given the multi-year horizon in [VISION.md](./VISION.md) makes adopting
v4 now cheaper than migrating later.

---

## ADR-006: Vitest for unit/integration, Playwright for e2e

**Context.** Need fast unit tests across TypeScript-only packages
(`@paon/domain`, `@paon/utils`) and real end-to-end coverage across
three Next.js apps.

**Decision.** Vitest (not Jest) for unit/integration — native ESM, fast,
shares config shape with Vite-family tooling used elsewhere in the
frontend ecosystem. Playwright (not Cypress) for e2e — multi-browser,
first-class Next.js support, better parallelization in CI.

**Consequences.** Two test runners in the repo, each doing the job it's
best at, rather than one runner stretched across both use cases.

---

## ADR-007: Repository pattern as the only data-access surface

**Context.** Need to prevent ad-hoc Supabase queries scattered across
Server Components and Actions, which would make schema changes and
RLS-alignment error-prone.

**Decision.** One repository class per aggregate root in
`@paon/database`, constructed with an already-authenticated Supabase
client. All reads and writes to that aggregate go through it.

**Consequences.** Query logic for a given aggregate lives in one place;
a schema change touches one file, not an unknown number of call sites.
Slightly more ceremony than calling `.from()` inline — accepted per
[PRINCIPLES.md](./PRINCIPLES.md) "maximum reuse, zero duplicated logic."

---

## ADR-008: zod schemas live in `@paon/domain`, next to the entity they validate

**Context.** Every Server Action across every app needs to validate
untrusted input (form data) against the same shape its domain entity
already describes. Defining that shape twice — once as a TypeScript
type, once as a validation schema per app — guarantees drift.

**Decision.** Validation schemas (e.g. `createRetailerInputSchema`,
`inviteRetailerStaffInputSchema`) are defined in `@paon/domain`,
colocated with the entity/context they belong to
(`retailer/retailer.schema.ts`, `identity/retailer-staff.schema.ts`),
using zod. This is the one exception to `@paon/domain` having zero
runtime dependencies (see [ARCHITECTURE.md](./ARCHITECTURE.md) "Layering
rule") — zod is a validation library, not a framework, and stays usable
from any context `@paon/domain` itself is usable from.

**Consequences.** One schema per input shape, imported by every Server
Action that accepts it, in every app. A field added to the domain
entity and its schema is validated everywhere in one edit.

---

## ADR-009: Retailer/platform staff invites provision the auth user first

**Context.** `RetailerStaffMember`/`PlatformStaffMember` rows carry a
`role` that must be mirrored onto the corresponding `auth.users` JWT
claim (`retailer_role`/`platform_role`) for RLS to see it — see
[DATABASE.md](./DATABASE.md) "Row Level Security". That mirroring is a
database trigger reacting to inserts/updates on the staff table, which
means the `auth.users` row must already exist before the staff row is
inserted, or the trigger has nothing to attach claims to.

**Decision.** Server Actions that provision staff always call
`supabase.auth.admin.inviteUserByEmail` (or `createUser` in the e2e
bootstrap) **first**, then pass the resulting `user_id` into
`RetailerStaffRepository.create` / `PlatformStaffRepository.create`.
`RetailerStaffMember.userId` is typed optional in `@paon/domain`
(a row can still exist with `user_id = null` if the linked auth user is
later deleted, via `on delete set null`) but the repository's
`CreateRetailerStaffParams.userId` is required — creation is only ever
called after a successful invite.

**Consequences.** The claim-sync trigger always has a user to write to
at insert time; there's no "invited but claims never got attached"
state to handle. Cost: if the invite email step fails, the retailer
row already exists with no reachable owner — surfaced to the PAON Admin
operator as a form error rather than rolled back, since retrying the
invite from the retailer's detail page is simpler than distributed
transaction rollback for a two-system (Postgres + Supabase Auth)
operation. Revisit if this proves confusing in practice.

---

## ADR-010: One canonical `PaonSupabaseClient` type alias

**Context.** `@supabase/ssr`'s `createServerClient<Database>()` and
`@supabase/supabase-js`'s `createClient<Database>()` return types that
are structurally intended to be the same client, but independently
re-deriving `SupabaseClient<Database>` in multiple files (once per
client factory, once per repository constructor) trips spurious
"not sufficiently overlapping" assignability errors under our
`exactOptionalPropertyTypes: true` — the two packages' generic default
parameters expand slightly differently even though both ultimately
construct the same runtime class.

**Decision.** `packages/database/src/client-type.ts` exports one
`PaonSupabaseClient` alias. Every client factory (`browser.ts`,
`server.ts`, `admin.ts`) casts its return value to it explicitly, and
every repository constructor parameter is typed as
`PaonSupabaseClient` — never as a fresh `SupabaseClient<Database>`
instantiation.

**Consequences.** The generic-expansion mismatch only has to be
resolved once, at each factory's `as unknown as PaonSupabaseClient`
cast, instead of at every repository call site. If a future
`@supabase/ssr` or `@supabase/supabase-js` upgrade changes this again,
there's exactly one file to fix.

---

## ADR-011: `stripUndefined` at the Server Action boundary

**Context.** zod's `.optional()` infers as `T | undefined`, and when a
Server Action builds an object from `FormData` it often explicitly
assigns `undefined` for an empty optional field (`raw.line2 ||
undefined`). Passing that object straight into a `@paon/domain` type
under `exactOptionalPropertyTypes: true` fails to typecheck — those
types mean "key absent or key present-and-defined," not "key present
with value possibly undefined."

**Decision.** `@paon/utils` exports `stripUndefined`, called once on
parsed zod output at the Server Action boundary before it's passed into
a repository or domain-typed object, rather than re-deriving this fix
ad hoc per form.

**Consequences.** Every future form follows the same one-line pattern
(`stripUndefined(parsed.data.someNestedObject)`) instead of each
author rediscovering the exactOptionalPropertyTypes friction
independently.
