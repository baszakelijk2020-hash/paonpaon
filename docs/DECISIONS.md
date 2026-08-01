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

---

## ADR-012: Invite acceptance is a narrow `security definer` RPC, not a broadened RLS policy

**Context.** An invited retailer staff member (owner or otherwise, per
ADR-009) needs to do exactly two things the moment they set their
password: mark their own `retailer_staff_members` row accepted, and —
if they are the owner completing the retailer's first onboarding —
flip `retailers.status` from `pending_onboarding` to `active`. Neither
operation fits the existing RLS shape. Granting retailer staff a
general `update` policy on `retailer_staff_members` (to let them set
`accepted_at`) would also let them edit their own `role`, and no
retailer-staff RLS policy on `retailers` should ever allow a
tenant-controlled status transition to be driven by arbitrary
client-supplied data.

**Decision.** `accept_retailer_staff_invite(p_staff_id uuid)`
(`supabase/migrations/20260719000004_accept_retailer_staff_invite.sql`)
is a `security definer` function, callable only by `authenticated`,
that re-derives everything it needs server-side (`auth.uid()` must
match the staff row's `user_id`; the role and retailer come from the
staff row itself, never from function arguments) rather than trusting
any caller-supplied role or status. It is intentionally named for
"accept an invite," not "complete owner onboarding" — the same
function is reused when the Retailer Portal itself invites additional
staff (`docs/PROJECT_STATE.md`), not just for the first owner PAON
Admin provisions.

Extending this pattern: retailer self-service profile edits (display
name, address, locale) use a real RLS `update` policy plus a
`before update` trigger that blocks changes to platform-controlled
columns (`status`, `tier`, `slug`, `default_currency`) — see
`20260719000005_add_retailer_self_service_profile_update.sql`. That
trigger tells a privileged internal write (e.g. this RPC) apart from a
direct retailer-staff `UPDATE` via `current_user <> session_user` —
true only inside a `security definer` function, since `session_user`
is fixed for the connection but `current_user` switches to the
function owner for its duration. This is the general rule for any
future narrow state transition: a `security definer` RPC that
re-derives its own authority from `auth.uid()`, never a policy or
column grant broad enough to let the client assert the transition
directly.

**Consequences.** Every future "accept," "activate," "approve"-shaped
transition follows this same shape — a small RPC, not a widened
policy — and the `current_user <> session_user` trigger check becomes
the standard way to distinguish "the platform did this" from "the
tenant did this" without a bespoke flag column or session variable per
migration.

---

## ADR-013: Customer identity — direct `auth.uid()` RLS, not a JWT claim; linking by a security definer RPC, not an invite

**Context.** Every other Portal session so far (platform staff,
retailer staff) belongs to exactly one tenant, so mirroring
`retailer_id`/`retailer_role` onto the JWT (`sync_retailer_staff_claim`,
ADR pattern predating this one) is enough for RLS to key off a single
claim. A Customer Portal login does not fit that shape:
`docs/DOMAIN_MODEL.md` "Why a Customer is scoped to one Retailer" is
explicit that one Customer Portal `User` links to **many** per-retailer
`Customer` rows (a shopper with relationships at two PAON retailers has
two independent `Customer` records). There is no single
`customer_id`/`retailer_id` pair to mirror onto `app_metadata` the way
`sync_retailer_staff_claim` does. Separately, a Customer Portal login is
self-serve and passwordless (`docs/PRODUCT.md` "Customer Portal" >
Login) — there is no PAON-Admin- or Retailer-Portal-issued invite email
to accept the way ADR-009/ADR-012 assume; a `Customer` CRM record and a
Customer Portal login are created independently and only need
connecting if the same email shows up on both sides.

**Decision.**

1. **RLS reads `customers.user_id = auth.uid()` directly for a
   customer's own read access** (`20260719000007_create_customers.sql`)
   — no JWT claim, no `current_customer_id()` helper. This is
   deliberately different from the `current_retailer_id()`/
   `current_platform_role()` helpers every other table's policies use,
   because those exist specifically to let RLS on _other_ tables key off
   the caller's tenant; nothing else in the schema needs to filter by
   "the caller's `customer_id`" the way dozens of future tables will
   filter by "the caller's `retailer_id`."
2. **Linking is `link_my_customer_accounts()`, a `security definer` RPC
   the Customer Portal calls once per session** (`/auth/confirm`, right
   after `verifyOtp` establishes the session), not an invite flow. It
   re-derives everything from `auth.uid()`/`auth.jwt() ->> 'email'` —
   the same "narrow RPC over broadened policy" shape as ADR-012 — and
   is idempotent, so calling it on every sign-in is safe and requires no
   "have I already linked?" state elsewhere.
3. **Both `customers.user_id` (denormalized, what RLS/queries actually
   filter on) and `customer_account_links` (the auditable link event,
   `docs/DOMAIN_MODEL.md`'s `CustomerAccountLink`) are written together**,
   in the same function, so they can never drift apart.

**Consequences.** A Customer Portal user who has never engaged a
specific retailer signs in successfully with zero linked `Customer`
rows — the Customer Portal home page must render that as a real, valid
state (no relationships yet), not an error; see
`apps/customer/app/(dashboard)/dashboard/page.tsx`. Any future feature
that needs "the current customer" for a _specific_ retailer (storefront
checkout, Phase 2) must resolve it from `customer_account_links`/
`customers` scoped to that retailer's context, never from a single
session-wide claim — there isn't one, by design.

---

## ADR-014: Storefront routing is path-based; orders exist before payment does

**Context.** Phase 2 commerce needed two decisions with real
consequences neither the roadmap nor any existing ADR had made yet: (1)
how a shopper reaches a specific retailer's storefront in Customer
Portal — path (`/r/[slug]`), subdomain (`[slug].customer-app.com`), or
`Retailer.primaryDomain` as a real custom domain — and (2) whether an
`Order` may exist before any payment provider is integrated (none is —
choosing and wiring one is its own future decision, and likely needs
external provider credentials this environment doesn't have). Both were
put to the human operator rather than decided silently, since routing
scheme has real branding/SEO consequences and "can an order exist
unpaid" is a product-policy call, not a technical one.

**Decision.**

1. **Path-based storefront routing**: `apps/customer/app/r/[slug]/...`.
   One deployment, no wildcard DNS or Next.js host-based middleware
   routing needed now. `Retailer.primaryDomain`/subdomain routing stays
   a real, valid future direction — this doesn't foreclose it, it just
   isn't built until there's a concrete reason to (NON_GOALS.md-style
   deferral, not a rejection).
2. **Orders exist now; payment capture doesn't.** `OrderStatus` gains
   `"pending_payment"`, sitting between `"draft"` (reserved for a future
   persisted-cart feature — nothing creates one yet) and `"placed"`
   (payment confirmed — unreachable until a payment integration exists
   to drive that transition). A storefront checkout creates a real
   `Order`/`OrderLine` pair, decrements real inventory, and creates the
   customer's `Customer` record on the spot if this is their first
   purchase from that retailer — everything except taking payment.
3. **`place_order(retailer_id, variant_id, quantity)`** is the only way
   an `Order`/`OrderLine` is created — no client-facing insert policy on
   either table. Same "narrow `security definer` RPC over a broadened
   policy" shape as ADR-012/ADR-013: price, inventory availability, and
   which `Customer` row the order belongs to are all re-derived
   server-side from `p_variant_id`/`auth.uid()`, never trusted from the
   client. This is also the first place in the schema two tables are
   written transactionally from one client call — a `security definer`
   PL/pgSQL function is how this repository gets a transaction at all,
   since neither PostgREST nor supabase-js exposes multi-statement
   transactions to application code.
4. **Storefront browsing is public** (`retailers`/`products`/
   `product_variants` gain a `select` policy with no `to` clause,
   scoped to `status = 'active'` rows only) — the first policies in the
   schema that apply to `anon`, not just `authenticated`. Checkout
   itself still requires a signed-in session (`place_order` is granted
   to `authenticated` only).

**Consequences.** A product/variant/retailer's public visibility is
exactly its `active` status — flipping status to `draft`/`archived`/
`suspended` immediately removes it from anon read access with no
separate "publish" step to remember. Retailer Portal order management
(fulfillment status updates) is scoped to `production_staff`+, not
`sales_associate`+ or `manager`+ like the other two write gates —
fulfillment is its own operational concern, not CRM or catalog
authoring. Payment integration, when built, changes exactly one thing
at the data layer: what drives the `pending_payment` → `placed`
transition — it does not change how `place_order` computes price,
inventory, or customer linking.

---

## ADR-015: Phase 3 foundations — Appointments, Fit Profile, Alterations

**Context.** Phase 3 (Production, Alteration, Appointments) is what
`docs/VISION.md`/`docs/NORTH_STAR.md` call the differentiator versus a
generic commerce platform — PAON stays a retailer-first and
customer-first _operating_ platform, never a supplier/manufacturing
system (GoCreate and similar stay external connectors, not something
PAON's core model absorbs). This slice built the operational layer
between "we have a customer relationship" and "we deliver a retail
service": appointment booking, a staff-maintained fit/measurement
record, and the customer/retailer-facing shell of alteration tracking
— deliberately not a tailor/manufacturing workflow engine. Several
small domain gaps surfaced while wiring these up for the first time,
the same way ADR-009/013/014's predecessors did.

**Decision.**

1. **`Alteration.customerId` is now required.** It previously only
   reached a customer transitively through an optional `orderLineId`,
   but `docs/DOMAIN_MODEL.md` explicitly allows an alteration on a past
   purchase with no order line at all — that case had no way to know
   whose alteration it was. `Alteration.appointmentIdForFitting` is now
   `AppointmentId`, not a bare `string` — the same "fix a loose type the
   first time something actually implements the entity" reasoning as
   `Customer.assignedStaffId` (Phase 2) and the retailer-role gap
   (Phase 1).
2. **`AlterationStatus` gained `ready_for_pickup`**, between
   `ready_for_fitting` and `complete` — the requirements explicitly ask
   for customer-visible "pickup readiness," which the previous five
   statuses didn't distinguish from "picked up."
3. **Sizing history and alteration progress are both append-only
   logs**, not a mutable "current" row with a bolted-on audit trail.
   `CustomerFitProfileEntry` (`customer/customer.ts`) and
   `AlterationUpdate` (`production/production.ts`) are each just a
   timestamped snapshot; "current" is simply the most recent row.
   `alterations.status` is the one place this needed enforcement, not
   just convention: a `before update` trigger
   (`enforce_alteration_status_via_updates_only`,
   `20260719000017_create_alterations.sql`) blocks any direct client
   `UPDATE` of `status` — only the `sync_alteration_status_on_update_insert`
   trigger (itself triggered by inserting into `alteration_updates`,
   `20260719000018_*`) may change it, using the same `current_user <>
session_user` / `auth.role() = 'service_role'` distinction as
   `enforce_retailer_staff_editable_columns` (ADR-012).
4. **Requesting an appointment reuses the `place_order` shape.**
   `request_appointment(retailer_id, type, starts_at, ends_at, notes)`
   (`20260719000015_*`) is a `security definer` RPC that creates the
   caller's `Customer` row on the spot if this is their first
   interaction with the retailer — a customer may request a
   consultation before ever buying anything, so the same "customer
   might not exist yet" problem `place_order` solved applies here too.
   Unlike `place_order`, there is nothing to price or decrement, so no
   inventory-style check — the only invariant enforced server-side is
   that the retailer is `active` and `starts_at < ends_at`.
5. **No slot-conflict prevention at request time.** An appointment
   starts in `requested` status; multiple customers may request
   overlapping times, and retailer staff resolve the conflict when
   confirming (moving to `confirmed`). This is simpler than exposing
   real-time availability to anonymous browsers would have required —
   see point 7.
6. **Availability windows have no `current_staff_id()` JWT claim to key
   off**, unlike `current_retailer_id()`/`current_retailer_role()`
   (every staff session already carries those). Managing "my own
   schedule" is expressed as an `exists` subquery against
   `retailer_staff_members` (`user_id = auth.uid()`) OR `manager`+,
   directly in the RLS policy (`20260719000014_*`) — the same shape
   ADR-013 uses for a customer's own-row access, applied here for staff.
7. **Storefront appointment booking shows no live slot picker.**
   Computing real availability for an anonymous browser would require
   exposing either individual staff schedules or actual booked/busy
   times — the latter leaks other customers' booking data if done
   naively, and neither `availability_windows` nor `appointments` has
   (or should gain) a public read policy the way `products` did in
   ADR-014. The customer instead states a preferred date/time as a
   request; `computeAvailableSlots` (`@paon/domain`) exists for the
   Retailer Portal's own calendar (an authenticated staff session,
   which already has full read access to both tables) and is not
   (yet) exposed to Customer Portal.
8. **Location stays deferred, again.** "Select retailer/location" in
   the original brief means selecting the retailer — via the existing
   `/r/[slug]` storefront routing (ADR-014) — not a new `Location`
   entity. Multi-location was explicitly deferred in Phase 1 and
   nothing in this slice's requirements forced revisiting that.
9. **Attaching an alteration to a specific order line has no UI picker
   yet**, though the schema/repository fully support it
   (`orderLineId` optional on `createAlterationInputSchema`). Building
   a customer→orders→order-lines cascading selector is real UI
   complexity `docs/PRINCIPLES.md` doesn't justify speculatively;
   revisit once evidence shows standalone alterations aren't enough.

**Consequences.** Every future "this status may only change through
its own append-only log" need (loyalty ledger balances, production
stages) should reach for the same
`enforce_<table>_status_via_updates_only` + `sync_<table>_status_from_update`
trigger pair rather than re-deriving the pattern. Every future
"a customer or staff member may request something before they formally
exist in our system" need should reach for the `place_order`/
`request_appointment` shape: a `security definer` RPC that creates the
`Customer` row inline. The moment Customer Portal needs real
availability (not just a request), building it means adding a narrow,
non-leaking read surface (e.g. a `get_busy_windows(retailer_id, date)`
RPC returning only start/end ranges, no identifying data) — not a
blanket public policy on `appointments`.

---

## ADR-016: Alterations are garment-first; manufacturing ownership stays external

**Context.** ADR-015 introduced `CustomerFitProfileEntry` and a thin
`Alteration`/`AlterationUpdate` request tracker. Founder clarification made the
ownership boundary more precise: GoCreate and supplier systems remain
authoritative for manufacturing, MTM measurements and fit profiles, garment
specifications, production ordering and construction. PAON is authoritative
for the in-store fitting and alteration journey around one identifiable
physical garment. Generic customer measurements would make PAON a second,
divergent manufacturing source of truth and cannot be retained as the active
model.

**Decision.**

1. `CustomerFitProfileEntry` is removed from `@paon/domain`, repositories and
   UI. Its committed table is renamed `legacy_customer_fit_profile_entries` in
   a forward migration, has tenant/customer grants revoked, and remains only as
   a read-only archive. It is not silently attributed to a garment because the
   old record contains no evidence identifying one.
2. Every active fitting observation references both a `FittingSession` and a
   `PhysicalGarment`. A physical garment records source (`external` or
   `finished_mtm`), category/type, brand/description, photo/label metadata,
   condition and either a PAON order line or external supplier/order reference
   where applicable.
3. `Alteration` is the branded work-order aggregate backed by
   `alteration_work_orders`. Tasks and observations are explicitly
   `work_now` or `future_order_note`; the latter is retained for manual future
   GoCreate entry and cannot be assigned to a worker.
4. Work-order state changes use one explicit transition graph and a
   `security definer` transition function. Status history, task notes, pricing
   history and custody events are append-only. Completion review is created on
   entry to review and must be approved or returned for changes before release.
5. Original quote values are immutable `Money`. Workshop managers on assigned
   work may propose an increase or decrease with explanation and optional
   evidence. Only retailer owner/admin/manager roles decide it; proposal,
   decision, actors, timestamps, reasons and the original quote remain in
   pricing/audit history.
6. Workshop manager and worker are capability roles outside the existing
   retailer hierarchy. Restrictive RLS policies remove inherited tenant access:
   workshop managers see their workshop's assignments/workers/prices/dates and
   workers see only directly assigned jobs/tasks/notes/private photos through
   projections that omit customer records and pricing columns.
7. Customers receive no base-table access. Security-barrier views expose only
   approved work-order/agreed-price status, customer-visible timeline entries,
   and pickup/delivery information for their own linked customer rows.
8. The comprehensive premium-menswear operation catalogue is platform-seeded;
   retailers enable/hide categories and operations and maintain effective
   retailer price lists, while workshop price lists are scoped to a workshop.
   Workshop managers maintain only their own effective cost list. No GoCreate
   connector is implemented in this slice.
9. Alteration images live in a private `alteration-evidence` Storage bucket.
   Object paths are retailer/work-order scoped, registered attachment metadata
   is append-only, and only unregistered objects may be removed as failed-upload
   compensation.

**Consequences.** ADR-015 point 3's customer-level fit-profile ownership and
point 9's deferred order-line intake UI are superseded. Its appointment/privacy
decisions remain authoritative. Legacy alteration requests are migrated
forward into garment-backed work orders using an explicitly
`needs_verification` garment rather than discarded; old update rows are
preserved in the new timeline and the original foundation tables remain
archived. Future production connectors may project supplier status into PAON,
but they must not move manufacturing specifications or construction workflow
into this aggregate.

## ADR-017: Loyalty is a retailer programme with an append-only ledger

**Decision.** Loyalty belongs to each retailer-customer relationship. Points
accrue once when an order first reaches `delivered`; balances are cached on the
account but every change has an immutable ledger entry. Reward redemption is a
single transactional RPC that locks the account, deducts points, writes the
ledger and issues a unique redemption code. Customer authority is always
re-derived through `customers.user_id = auth.uid()`.

**Why.** One customer login can belong to many retailers, whose programmes and
balances must never blend. Payment is not integrated yet, so `delivered` is the
first reliable qualifying lifecycle event. The ledger preserves an auditable
history and prevents direct client-side balance arithmetic.

## ADR-018: Event eligibility is enforced inside the RSVP transaction

**Decision.** Events are retailer-owned and may be public, invitation-only, or
restricted to gold/platinum loyalty members. Public browsing exposes only
published public events. The RSVP RPC re-derives the customer relationship,
checks visibility and membership, locks the event, enforces capacity, and then
upserts the response. A first-time public guest becomes a retailer prospect.

**Why.** Visibility in the interface is not authorization, and capacity cannot
be safely checked in browser code. The database transaction prevents two final
places being sold simultaneously and keeps restricted guest lists private.

## ADR-019: Clienteling notes are retailer-private relationship memory

**Decision.** Clienteling notes are staff-authored, retailer-scoped and never
customer-visible. Sales staff may create them; authors and managers may update
them. The customer page projects existing orders, appointments and physical
garments into a timeline without duplicating those source records.

**Why.** Luxury clienteling needs durable team memory, but private advisor
context must not be confused with customer-editable preferences or supplier fit
profiles. A projection preserves one source of truth for each activity.

## ADR-020: One shared retailer conversation per customer relationship

**Decision.** A customer has one conversation per retailer relationship; staff
rotate inside the retailer side rather than owning personal threads. Only
customer and accepted non-workshop staff participants can read it. Sending and
marking read use narrow database functions that re-derive identity and create
in-app notifications transactionally.

**Why.** The relationship belongs to the retailer, not an individual advisor,
so history survives staff changes. Server-side identity and notification writes
prevent sender impersonation and lost notifications. External email/SMS/push
delivery is deferred until credentials exist; in-app delivery is real now.

## ADR-021: Analytics derive from source records; behavioral events are signals

**Decision.** Retailer analytics aggregate authoritative commerce, CRM,
appointment, alteration, event and messaging records inside a permission-gated
database function. `BehavioralEvent` is an immutable, retailer-scoped signal
stream for interactions that are not already durable business records. It does
not duplicate orders, appointments or other source entities.

**Why.** Dashboards must remain explainable and cannot depend on an external AI
provider. The signal stream prepares future personalisation while the first
analytics view delivers real value now. Manager-level access and database-side
tenant checks prevent cross-retailer reporting leaks.

## ADR-022: Platform staff invitations require explicit acceptance

**Decision.** PAON Admin mirrors the proven retailer-staff invite confirmation
flow. A platform membership records invitation and acceptance separately; the
authenticated invitee sets a password and accepts only their own membership
through a narrow database function before protected Admin routes are available.

**Why.** An Auth session exists immediately after an invite link is verified,
but that alone is not completed onboarding. Explicit acceptance closes the dead
invite-link gap and prevents partially onboarded platform operators from
browsing privileged cross-retailer tooling.

## ADR-023: Product merchandising and collections update atomically

**Decision.** A manager updates product metadata, publication status and full
collection membership through one database transaction that re-derives the
retailer and validates every collection. Variant price, inventory and lead-time
changes remain individually permission-gated records.

**Why.** Replacing collection membership with separate browser requests could
leave a published product partially merchandised. The transactional boundary
also prevents a crafted request from attaching another retailer's collection.

## ADR-024: Persisted cart is a `draft` Order; checkout re-validates everything

**Context.** ADR-014 deliberately reserved `OrderStatus.draft` for a future
multi-item cart and shipped buy-now (`place_order`) instead. A cart needs to
accumulate lines over multiple visits, let a shopper adjust quantity or remove
a line, and then commit atomically — while still going through the same
"never trust the client for price/inventory/tenant" boundary every other
commerce write uses (ADR-014 point 3).

**Decision.**

1. **The cart _is_ the `Order` aggregate, at `status = 'draft'`.** No new
   entity. One draft `Order` per `(retailer_id, customer_id)`, enforced by a
   partial unique index (`one_draft_cart_per_retailer_customer_idx`) rather
   than at the application layer — a client cannot create a second concurrent
   cart even by racing two requests.
2. **Three narrow `security definer` RPCs**, the same shape as
   `place_order`/`request_appointment` (ADR-012/013/014/015): `add_to_cart`
   (creates the draft and/or the caller's `Customer` row on first add, exactly
   like `place_order`'s first-purchase case; upserts a line via
   `one_variant_per_order_idx`, capped at 20), `update_cart_line` (set
   quantity, or delete the line at quantity 0 — no separate "remove" RPC),
   and `checkout_cart` (the only place a `draft` order leaves that status).
3. **`checkout_cart` re-validates every line against current data**, not
   whatever was cached when the line was added: product still `active`,
   currency still matches the order, stock still sufficient for
   non-made-to-order variants, and it re-snapshots price at the moment of
   commit (a cart line's price can drift between add-to-cart and checkout;
   the checkout snapshot is authoritative, matching `place_order`'s "never
   trust a stale client value" rule). Only then does it decrement inventory,
   set `shipping_address`, and flip `status` to `pending_payment`.
4. **`findByRetailer`/`findByCustomer` (order history) now exclude `draft`.**
   A cart is not yet a commercial record; retailer order management and a
   shopper's order history should never show an abandoned, still-mutable
   cart alongside real orders. `findCart`/`findLinesByOrder` (unchanged) are
   the cart-specific reads, gated by the existing "a customer can read their
   own orders/order lines" RLS policies — no new read policy was needed
   because those policies were never scoped to a status.
5. **Magic-link sign-in now honors an optional relative `next`/`redirectTo`
   destination** (`/auth/confirm?next=...`, `/login?redirectTo=...`),
   validated to be same-origin-relative (`startsWith("/")`, rejecting
   `//`-prefixed values) before use. This closes the "Sign in to purchase"
   gap ADR-014/PROJECT_STATE.md flagged: a shopper who has to sign in
   mid-checkout now lands back on the product (or cart) page instead of
   `/dashboard`.

**Consequences.** Buy-now (`place_order`) is untouched and still exists —
this slice does not migrate it to the cart. A future decision could retire
`place_order` in favor of "add one line to a cart and check out immediately,"
but that's a product call, not forced by this ADR. Any future multi-line
mutation that needs the same "recompute the total after touching one line"
shape should reuse `add_to_cart`/`update_cart_line`'s pattern (recompute
`subtotal`/`total` from `order_lines` inside the same transaction) rather
than trusting a client-supplied total.

## ADR-025: Referral conversion is trigger-driven off existing lifecycle events

**Context.** ADR-017 shipped `create_my_referral` and the `Referral`
aggregate but left every referral at `status = 'invited'` forever —
`docs/PROJECT_STATE.md` flagged "signup/purchase matching and reward
issuance" as the remaining piece. The three later states
(`signed_up`, `first_purchase_completed`, `rewarded`) each correspond to an
event that already happens elsewhere in the system: a Customer Portal
signup/link, and an order reaching `delivered`. No new customer action or
UI submission drives any of these transitions.

**Decision.**

1. **A new trigger on `customers` (`match_referral_after_customer_link`,
   `after insert or update of user_id ... when (new.user_id is not null)`)
   matches a still-`invited` referral by `lower(referred_email) =
lower(customers.email)` within the same retailer**, and advances it to
   `signed_up`. This fires for every path a `customers` row can gain a
   `user_id` — the inline creation inside `place_order`/`add_to_cart`/
   `request_appointment` (insert with `user_id` already set) and
   `link_my_customer_accounts` linking a staff-created prospect record
   (update of `user_id`) — without either of those functions needing to
   know referrals exist.
2. **`accrue_loyalty_on_delivered_order` (ADR-017) is extended in place**
   (`create or replace function`, same forward-migration shape as
   `20260719000101_*`/`20260719000103_*` amending earlier functions) rather
   than adding a second trigger on the same `orders` status transition —
   purchase-point accrual and referral conversion both react to "this order
   just became delivered" and share the "ensure a loyalty account exists"
   step. It advances a `signed_up` referral to `first_purchase_completed`
   only if this is the referred customer's first-ever delivered order at
   that retailer (a repeat purchase can't retroactively earn a reward,
   and can't re-fire regardless — the referral is no longer `signed_up`
   after conversion), then to `rewarded` and credits the _referrer's_
   loyalty account `referral_points` as an `earn_referral` ledger entry, in
   the same transaction as the purchase accrual.
3. **`Referral.rewardId` stays unused by this slice.** The column exists on
   the table/domain type for a possible future "reward the referrer with a
   specific catalogue `Reward` instead of raw points" enhancement; today's
   reward is always `loyalty_programs.referral_points`, recorded as a
   ledger entry, not a `reward_redemptions` row.

**Why.** Every prior "X happens as a side effect of Y" case in this
codebase (loyalty accrual on delivery, JWT claim sync on staff writes) uses
a trigger that re-derives its own facts rather than asking the triggering
code path to know about the downstream concern — referral conversion is the
same shape. Doing it any other way would mean `place_order`, `add_to_cart`,
`request_appointment`, and `link_my_customer_accounts` all growing
referral-specific logic, and `OrderRepository.updateStatus` growing
loyalty-specific logic on top of what it already carries — a violation of
`docs/PRINCIPLES.md` "maximum reuse, zero duplicated logic" in the other
direction (duplicating a concern across every place that can cause it,
instead of centralizing it at the one place that observes it).

## ADR-026: Wishlist reuses the cart's "narrow RPC + inline Customer creation" shape; retailer staff can read it

**Context.** `Wishlist`/`WishlistItem` (`docs/DOMAIN_MODEL.md` Customer
bounded context) have existed as domain types with no table since Phase 1 —
`docs/PROJECT_STATE.md` listed them as deliberately deferred. Saving a
product is, like adding to cart, potentially a shopper's first-ever
interaction with a retailer (browsing needs no sign-in; saving does, but
nothing else about the relationship needs to exist yet).

**Decision.**

1. **One `security definer` RPC, `toggle_wishlist_item(retailer_id,
variant_id)`**, does everything: creates the caller's `Customer` row
   inline if this is their first interaction with the retailer (same
   `place_order`/`add_to_cart`/`request_appointment` shape,
   ADR-012/014/015/024 family), lazily creates the customer's one default
   `Wishlist` (`one_default_wishlist_per_customer_idx`, a partial unique
   index — the same "enforce cardinality in the schema, not application
   code" shape as `one_draft_cart_per_retailer_customer_idx`), and flips
   the `WishlistItem` row (insert if absent, delete if present) — a toggle,
   not separate add/remove RPCs, since the client always knows which state
   it's requesting from the button it clicked.
2. **Retailer staff (`sales_associate`+) can read a customer's wishlist**,
   the same gate as reading the rest of the `customers` CRM record
   (`docs/DATABASE.md`). This is a deliberate, minimal extension beyond
   what `docs/PRODUCT.md`'s Customer Portal feature table names — a
   client's saved pieces are exactly the kind of clienteling signal
   `docs/VISION.md` says differentiates PAON, and the read policy costs
   nothing beyond the two lines it takes to add (no new UI shipped in
   Retailer Portal this slice; the data is there for a future clienteling
   view to surface, same as orders/appointments already are).
3. **`Referral.rewardId`-style restraint**: `WishlistItem.note` exists on
   the domain type (a customer's own note on a saved piece — "for
   anniversary") but has no write path in this slice. Reserved, not
   populated speculatively.

**Consequences.** Any future "a shopper does X to a specific product
before necessarily having any other relationship with the retailer" need
(a size-alert subscription, a "notify when back in stock") should reach for
this same RPC shape rather than requiring the customer relationship to
already exist.

## ADR-027: Collections and their product links get the same public-read shape as products

**Decision.** `collections` and `product_collections` gain `anon`-inclusive
`select` policies scoped to active retailers (and, for the join table,
active products) — the same "publicly showable subset, no `to` clause"
shape ADR-014 established for `retailers`/`products`/`product_variants`.
Storefront `/r/[slug]/products` reads the retailer's collections and
`Product.collectionIds` (already resolved by `ProductRepository`) to
render collection chips and filter by `?collection=<slug>`, filtered
in the Server Component rather than a new repository query.

**Why.** `Product.collectionIds` has been populated by
`ProductRepository` since the catalogue foundation shipped, but nothing
using the anon/customer client could actually read `product_collections`
or `collections` — the storefront had never exercised that path, so the
gap was latent rather than discovered. This closes
`docs/PROJECT_STATE.md`'s "assigning a product to a collection from the
storefront" gap and makes Retailer Portal's existing collection authoring
(`/collections`) have real customer-facing effect. No new repository
method: catalog sizes here are boutique-scale, and filtering a
Server-Component-fetched list in place is simpler than a second query
path — revisit only if evidence shows catalogs large enough to need it.

## ADR-028: `CustomerPreferences` is direct-RLS, not a `security definer` RPC

**Context.** `CustomerPreferences` (`packages/domain/src/customer/customer.ts`)
has existed as a domain type with no table since Phase 1 — every prior
customer-write path this session (`add_to_cart`, `toggle_wishlist_item`,
`request_appointment`) used a `security definer` RPC (ADR-012/013 family)
because each one also had to create the caller's `Customer` row inline on
a first interaction with a retailer, and often a second row
transactionally.

**Decision.** `customer_preferences` is a plain table with direct
`insert`/`update`/`select` RLS policies scoped by `exists (select 1 from
customers c where c.id = customer_preferences.customer_id and c.user_id =
auth.uid())` — no RPC. Unlike every prior write path, saving preferences
never creates the `Customer` row itself (a shopper can only reach
`/account` once at least one relationship already exists from ordering,
saving, or appointment-booking) and never writes a second table
transactionally, so neither reason for reaching for `security definer`
applies. `CustomerPreferencesRepository.upsert` does a plain
`.upsert(..., { onConflict: "customer_id" })`, backed by RLS on both the
insert and update branch.

**Consequences.** This is the RLS-only counterpart to the
"`security definer` RPC over a broadened RLS policy" convention
(`docs/PROJECT_STATE.md`'s conventions list) — reach for direct RLS
instead of an RPC when a write is scoped to a single already-existing
owned row and needs no transactional fan-out. Customer Portal `/account`
lists one preferences form per retailer relationship (same fan-out shape
as `/wishlist`, `/loyalty`, `/orders` — `CustomerPreferences` is
per-`Customer`, i.e. per retailer relationship, not per `User`, matching
every other entity in this bounded context, ADR-013). Retailer staff
(`sales_associate`+) can read a customer's preferences through RLS, the
same clienteling extension ADR-026 gave the wishlist — no Retailer Portal
UI surfaces it yet. New tables created after `20260720000000`'s one-time
blanket grant must `grant` PostgREST privileges themselves (this
migration does); forgetting it produces a `permission denied for table`
error that only surfaces at request time, since RLS and SQL-level grants
are enforced independently in Postgres.

## ADR-029: Product images use a public Storage bucket, not a signed-URL one

**Context.** `products.primary_image_url` (`20260719000010_*`) has always
been a plain, hand-typed URL string — `docs/PROJECT_STATE.md` flagged
"direct image upload remains deferred... until Storage is added" as the
last gap in catalogue editing. The only existing Storage integration in
the repo is `alteration-evidence` (`20260719000103_*`): a **private**
bucket, read via a 15-minute `createSignedUrl`, because that content is
internal workshop evidence gated by `can_access_alteration_work_order`.

**Decision.** `product-images` (`20260720000014_*`) is a **public**
bucket instead. Product photos are customer-facing on the public
storefront — the same "publicly showable, no `to` clause" territory
ADR-014 already put `products`/`retailers` in — so reads use
`getPublicUrl` (a pure client-side string, no request, no expiry), never
a signed URL. Writes (insert/delete on `storage.objects`) are RLS-gated
to `current_retailer_role() in ('manager','admin','owner')` scoped by the
path's first folder segment matching `current_retailer_id()` — the same
gate `20260719000010_*` already put on the `products` table itself,
since an image is part of the product record, not a separate permission
surface. No per-product ownership subquery is needed (unlike alteration
evidence's `can_access_alteration_storage_object`), because there's no
per-product staff assignment to check — retailer-manager+ is sufficient.

**Consequences.** `products.primary_image_url` and
`update_product_catalogue` are unchanged — this slice only adds a way to
populate that existing field with a real uploaded file's public URL
instead of requiring staff to type/host one themselves.
`ProductRepository.uploadImage`/`removeImageByPublicUrl` are the only
new data-access surface; there's no new table, because the column
already existed and a single primary image needs no gallery/ordering
metadata a `product_images` table would exist to hold. Retailer Portal's
`/products/[id]` gained a dedicated upload/remove card
(`ProductImageUploader`) separate from the main field-editing form —
the same modularity the page already had between product fields and
variant rows — so the main "Save product" submit no longer touches the
image field at all (it now always round-trips the product's current
`primaryImageUrl` unchanged, since the RPC's `p_primary_image_url`
parameter has no "leave unchanged" sentinel of its own and an empty
string clears it). Customer Portal's storefront list and detail pages
render the image for the first time — it was captured but never
displayed anywhere before this slice.

## ADR-030: Stripe Connect Express for customer payments, direct charges, retailer is merchant of record

**Context.** Payment provider integration has been the one deliberately
unbuilt piece of Phase 2 since ADR-014 — `Order` could reach
`"pending_payment"` but never `"placed"`, because nothing actually moved
money. Founder decision: Stripe Connect Express, every retailer is
merchant of record, PAON must support an optional configurable platform
fee later.

**Decision.**

1. **Direct charges on the connected account, never destination
   charges.** `createDirectChargeCheckoutSession` (`@paon/payments`)
   calls `stripe.checkout.sessions.create(..., { stripeAccount:
connectedAccountId })` — the retailer's own Express account is the
   merchant of record for every charge; PAON's platform account never
   holds customer funds. The only money PAON ever touches is an
   optional `application_fee_amount`, computed from
   `RetailerStripeAccount.platformFeeBasisPoints` (0 unless a platform
   operator configures one — "optional configurable... later" built as
   a real, working field with a zero default, not a stub).
2. **`RetailerStripeAccount` is a new table, not a `Retailer` column**
   (`20260720000015_*`) — same reasoning as `CustomerPreferences`
   (ADR-028): a retailer's Stripe relationship is operational
   integration state, not core tenant identity. Owner/admin can start
   Connect onboarding (`connectStripeAccount`, Retailer Portal
   `/settings/payments`) and read their own account's status; only the
   `account.updated` webhook (service-role) ever updates
   `charges_enabled`/`payouts_enabled`/`details_submitted` —
   `platform_fee_basis_points` is platform-staff-only, the same
   "platform-controlled field" shape as `Retailer.defaultCurrency`.
3. **`payments` uses direct RLS + a narrow RPC, not RLS alone** —
   unlike ADR-028's `customer_preferences` (direct RLS was enough
   because nothing else needed to change transactionally), a payment
   event must atomically record the payment row _and_ transition
   `orders.status`, exactly the "two tables, one client call" shape
   ADR-012/013/014/024 already established a `security definer` RPC
   for. `record_stripe_payment_event` is granted to `service_role`
   only — a normal user session must never be able to assert its own
   payment status, the same restraint `place_order`/`checkout_cart`
   already apply to price and inventory.
4. **Idempotent at two levels.** `stripe_webhook_events` (Stripe event
   id as primary key) makes a redelivered webhook a total no-op — Stripe
   retries every delivery until it gets a 2xx, so this _will_ happen
   under normal operation, not just after a crash. `payments.order_id`
   is unique, so a payment retry after a failed attempt updates the same
   row rather than creating a new one.
5. **The webhook Route Handler is thin; event interpretation is a pure,
   unit-tested function.** `parseStripeConnectEvent` (`@paon/payments`)
   maps a verified `Stripe.Event` to a small discriminated-union
   "action" with no I/O — fully testable with plain fixture objects, no
   live Stripe account needed. The Route Handler
   (`apps/customer/app/api/webhooks/stripe/route.ts`) only verifies the
   signature, calls the parser, and dispatches to repository methods —
   matching docs/API.md's "verify signatures before doing anything
   else; delegate to a repository/service, never inline business logic
   in the handler."
6. **Failure recovery, not a one-shot flow.** `checkout_cart` (ADR-024)
   still only moves an order to `pending_payment` — it does not call
   Stripe. Creating the Checkout Session is a separate step
   (`createCheckoutSession`, `/orders/[id]`'s "Pay now"), so a canceled
   or failed Stripe Checkout leaves the order exactly where it was:
   `pending_payment`, retryable, never stranded mid-flow.

**Consequences.** MVP scope is one `payments` row per order — multiple
payment attempts and partial refunds are a later enhancement (a refund
event always records the order's full original amount, not
`amount_refunded`, since the recording RPC validates against the
order's total). Every Stripe API-calling function (`connect.ts`) is
unit-tested by mocking the Stripe SDK client (dependency injection, no
live account); nothing about credential absence is faked — `lib/stripe.ts`
in both `apps/retailer` and `apps/customer` returns `null` when
`STRIPE_SECRET_KEY` is unset, and every caller renders a "not
configured" state rather than a crash or a fabricated success. See
`docs/PROJECT_STATE.md` "Credentials needed" for the exact Stripe
dashboard setup (webhook endpoint, events, secrets) required before
this goes live.

## ADR-031: Stripe Billing under PAON's own platform account for retailer subscriptions

**Context.** `RetailerSubscription`/`SubscriptionPlan` (`packages/domain/src/retailer/subscription.ts`)
have existed as domain types with no table since Phase 0's initial
modeling — "Owned by PAON Admin," never implemented. Founder decision:
Stripe Billing under PAON's own platform Stripe account, kept
separate from ADR-030's Connect customer-payments integration — this
is the reverse money direction, a retailer paying PAON, not a customer
paying a retailer.

**Decision.**

1. **Separate from Connect entirely** — `billing.ts` (`@paon/payments`)
   calls the Stripe SDK with no `stripeAccount` header, i.e. against
   PAON's own platform account, never a connected account.
   `retailer_subscriptions`/`subscription_plans` are new tables,
   unrelated to `retailer_stripe_accounts`/`payments`
   (`20260720000015_*`).
2. **`SubscriptionStatus` mirrors Stripe's own `Subscription.status`
   values directly** (`trialing`/`active`/`past_due`/`canceled`/
   `incomplete`/`incomplete_expired`/`unpaid`/`paused`), not a narrower
   business-level enum translated at the boundary — Stripe is the one
   provider (founder decision), so a translation layer would only add
   a place for drift.
3. **`subscription_plans` is a real, seeded table, not env-var
   config** (`20260720000016_*`, seeded with `boutique_monthly`/
   `house_monthly`/`maison_monthly`) — `SubscriptionPlan.providerPriceId`
   starts null and PAON Admin `/billing` lets a platform operator paste
   in the real Stripe Price id once created in the dashboard. A plan
   with no price configured can't be assigned to a retailer (checked
   before calling Stripe, not discovered as a Stripe API error).
4. **Assignment is platform-staff-initiated, RLS alone, no RPC** —
   unlike ADR-030's `payments` (which needs the "two tables, one
   client call" transactional guarantee a `security definer` RPC
   exists for), assigning a subscription is a single-table write
   already fully covered by `retailer_subscriptions`' "platform staff
   can manage all" policy, and the webhook sync
   (`customer.subscription.updated`/`.deleted`) is a single-table,
   no-business-validation update via `service_role` — the same shape
   `retailer_stripe_accounts.syncCapabilities` already established.
5. **Retailers manage their own payment method via the Stripe-hosted
   Billing Portal**, not a PAON-built form — `createBillingPortalSession`
   (Retailer Portal `/settings/billing`, owner/admin) redirects to
   Stripe. PAON never handles a retailer's card details, the same
   restraint ADR-030 already applies to customer payments.
6. **One subscription per retailer, no plan-change flow yet** —
   `retailer_subscriptions.retailer_id` is unique; `assignSubscriptionPlan`
   explicitly rejects reassigning an existing subscription rather than
   guessing at upgrade/downgrade/proration semantics no one has
   specified. Cancel or change a plan directly in the Stripe dashboard
   until that flow is built.

**Consequences.** Same non-faking treatment as ADR-030: `lib/stripe.ts`
in `apps/admin` returns `null` when `STRIPE_SECRET_KEY` is unset, and
every caller (`/billing`, retailer plan assignment, `/settings/billing`)
renders a "not configured" state. Every Stripe API-calling function in
`billing.ts` is unit-tested by mocking the Stripe client (dependency
injection); `parseStripePlatformEvent`'s event→action mapping is pure
and unit-tested with fixture objects, no live account needed. See
`docs/PROJECT_STATE.md` "Credentials needed" for the exact Stripe
dashboard setup (Products/Prices per plan, webhook endpoint, secrets)
required before this goes live.

## ADR-032: Resend transactional email via a durable outbox, not synchronous send

**Context.** `docs/PROJECT_STATE.md` has flagged "Email, SMS and push
remain future delivery adapters requiring provider credentials" since
the messaging/notifications slice shipped — `notifications.channel`
already had an `'email'` enum value with nothing behind it. Founder
decision: Resend. Postgres triggers cannot make HTTP calls, and the one
place `notifications` rows are created (`send_conversation_message`,
`20260720000004_*`) runs inside a database transaction, not Node — so
"call Resend synchronously when a notification is created" isn't
available as an option the way it would be from a Server Action.

**Decision.**

1. **A durable outbox (`email_outbox`), not a direct send.** One
   `after insert on notifications` trigger
   (`enqueue_notification_email`, `20260720000017_*`) is the single
   integration point — it fires regardless of which RPC created the
   notification, so a future notification-creating code path gets
   email delivery for free with zero changes to it. The trigger reads
   `auth.users.email` and the customer's own
   `communication_channels` preference (ADR-028); a customer who
   opted out of email gets no outbox row at all, not a suppressed send.
2. **A scheduled Route Handler drains it, not a background worker
   process.** `apps/admin/app/api/cron/dispatch-emails` — `docs/API.md`
   and `docs/DATABASE.md` already named "scheduled jobs" as a
   legitimate Route Handler / service-role-client use case, so this
   fills an anticipated gap rather than introducing a new pattern.
   Authenticated by a shared secret (`CRON_SECRET`, checked as
   `Authorization: Bearer`), the same shape Vercel Cron sends
   automatically — not a webhook signature, since nothing signs a
   scheduled trigger.
3. **Atomic claim, not select-then-update.** `claim_pending_emails`
   (`for update skip locked`, service_role only) makes two overlapping
   drain runs safe by construction — the second run's claim simply
   returns fewer or zero rows, never the same row twice. Verified
   directly against the local database with a throwaway script (a
   trigger and a `skip locked` claim can't be meaningfully unit-tested
   in Vitest), the same verification approach ADR-025's referral
   triggers used.
4. **Retry with a cap, not infinite retry or immediate permanent
   failure.** `EmailOutboxRepository.markFailed` reverts a failed send
   to `pending` (picked up by the next drain tick) until
   `MAX_ATTEMPTS` (5), then marks it `failed` permanently — bounded
   failure recovery without needing exponential backoff bookkeeping
   the 5-minute cron interval already provides for free.
5. **`@paon/email` isolates the Resend SDK**, same shape
   `@paon/payments` gives Stripe and `@paon/database` gives
   `@supabase/supabase-js` (ADR-001) — `sendEmail` is a thin, unit-tested
   wrapper; nothing else in the repository imports `resend` directly.

**Consequences.** Same non-faking treatment as ADR-030/031:
`lib/email.ts` returns `null` when `RESEND_API_KEY` is unset, and the
drain endpoint reports "not configured" (503) rather than silently
dropping queued email — mail simply accumulates in `email_outbox`
until a platform operator provisions credentials, then drains normally
on the next scheduled tick. No email HTML templating system was
added — `enqueue_notification_email` builds a single `<p>` wrapping the
notification body; richer per-category templates are a future
enhancement once there's a second call site to generalize from. See
`docs/PROJECT_STATE.md` "Credentials needed" for the exact Resend
account setup (domain verification, API key, `CRON_SECRET` generation)
required before this goes live.

## ADR-033: OpenAI for AI personalisation, behind a provider-neutral interface

**Context.** `docs/PROJECT_STATE.md`/`docs/ROADMAP.md` have named "AI
personalisation built on `BehavioralEvent` — recommendations,
next-best-action for staff, personalized customer communication — with
AI monitoring surfaced in PAON Admin" as the one deliberately
unimplemented piece of Phase 5 since the behavioral-analytics slice
shipped (ADR-021 explicitly said "analytics work does not pretend
deterministic counts are AI"). Founder decision: OpenAI, but — unlike
ADR-030/031/032's single-provider Stripe/Resend integrations — behind a
provider-neutral interface so the provider stays replaceable.

**Decision.**

1. **`@paon/ai` exports an `AIProvider` interface first, `OpenAIProvider`
   second.** `generateNextBestAction(context): Promise<NextBestActionResult>`
   is the only method implemented in this slice — the interface is
   deliberately narrow rather than speculatively covering
   `product_recommendation`/`communication_draft` (both modeled in
   `AIGenerationKind` for the audit trail, ADR-026's "reserved, not
   populated speculatively" restraint) before a real call site needs
   them. Swapping providers later means adding another `AIProvider`
   implementation and changing one construction site
   (`apps/retailer/lib/ai.ts`) — nothing else in the codebase imports
   `openai` (ADR-001's "never import a provider SDK type directly
   outside its wrapping package" shape).
2. **Every generation attempt is recorded, success or failure** —
   `ai_generations` (`20260720000018_*`) is simultaneously the
   per-customer history a sales associate sees (Retailer Portal
   customer detail page) and the cross-retailer monitoring feed PAON
   Admin's `/ai-monitoring` reads, rather than two separate tables
   duplicating the same event. Append-only (no update/delete grant) —
   a generation record is an audit entry, not a mutable document.
3. **Direct RLS, no security-definer RPC** — a single-table write
   scoped to the caller's own retailer, verifying `requested_by_staff_id`
   against the caller's own accepted staff membership the same way
   `clienteling_notes`' insert policy already does. No transactional
   fan-out, no privilege-escalation risk, the same reasoning ADR-028
   and ADR-031 already established for reaching for direct RLS instead
   of an RPC.
4. **The context fed to the model is small and structured, not a raw
   data dump** — `NextBestActionContext` carries only event _names_
   (`AnalyticsRepository.findRecentByCustomer`) and short order
   summaries, never full `BehavioralEvent.properties` payloads or PII
   beyond the customer's own name — `input_summary` on the stored
   record is similarly a short descriptive string
   (`"customer=... events=N orders=M"`), not the full prompt, keeping
   the audit trail useful without duplicating potentially-sensitive
   content into a second table.
5. **JSON-mode chat completion, strictly validated.** `OpenAIProvider`
   requests `response_format: { type: "json_object" }` and throws if
   the response is missing, unparseable, or missing `action`/`rationale`
   — a malformed model response becomes a recorded `failed` generation
   with a real error message, never a silently empty or fabricated result.

**Consequences.** Same non-faking treatment as ADR-030/031/032:
`apps/retailer/lib/ai.ts` returns `null` when `OPENAI_API_KEY` is
unset, and the customer detail page's AI Insights card renders "AI
personalisation is not configured on this deployment" rather than a
crash or a fake suggestion. `OpenAIProvider` is unit-tested by mocking
the OpenAI client (dependency injection, no live account, no API
cost); nothing about this slice required or used a real OpenAI key.
See `docs/PROJECT_STATE.md` "Credentials needed" for the exact OpenAI
account setup (API key, usage limits) required before this goes live.

## ADR-034: Mapping the Nebel & Spiegel concept deck onto PAON's roadmap

**Context.** The founder shared a client-pitch concept deck (Atelier
Munro / "Nebel & Spiegel") — `Self-Portrait`, `TableService`,
`MunroMissionControl`, `MunroMerchant`, `InsiderTailoring`,
`MorningRoutine`, `Moonstruck`, `The Residents Club`, and a separate
storefront visual-language mockup (fabric/archetype product
customization, catalog masonry grid, appointment booking) — as the
benchmark for where PAON's UI and feature depth should be headed, and
asked for these "tools" to be built into the real platform where
applicable. The deck is marketing/vision material for a different
brand (Adobe Muse export, fake data, no backend) — not a spec — so
each concept needs mapping onto PAON's actual bounded contexts rather
than literal reimplementation.

**Decision.** Triage every concept in the deck into one of three
buckets, and only build in the first:

1. **Already shipped, needs surfacing.** `Self-Portrait` ("a digital
   reflection of the customer") already exists as data — loyalty tier,
   `BehavioralEvent` tracking, `ClientelingNote`, next-best-action
   (ADR-033) — just not as one composed view. Addressed in this
   change: a `SelfPortrait` card on the retailer customer detail page
   composing `LoyaltyRepository.findAccountByCustomer`,
   `AnalyticsRepository.findRecentByCustomer` and the top pinned
   `ClientelingNote` — no new domain state, no new table.
2. **Real, scoped, next.** `TableService` (chat-style, intent-driven
   lead capture — "I'm getting married" / "I need new shirts" as
   entry points instead of a search bar) maps onto PAON's existing
   `Conversation`/`Message` model (Phase 5, shipped) plus a
   customer-app front-door widget that starts a conversation with a
   structured intent tag — not a new chat/LLM system. The storefront
   visual language (archetype-based product customization, fabric/size
   panel, masonry catalog, in-page appointment booking) is a
   `packages/ui` + customer-app PDP/catalog investment, staying inside
   `DESIGN_SYSTEM.md`'s "quiet, editorial" restraint — the information
   architecture (customize → fabric → fit → book), not the deck's
   GSAP/motion execution, is what's worth carrying over. Both are
   scoped as immediate next work, not this change.
3. **Out of scope, not on the roadmap.** `MunroMissionControl`
   (competing-retailer marketing/onboarding hub), `MunroMerchant`
   (managed multi-retailer ecom + asset supply chain — PAON is
   single-tenant-per-retailer by design), `InsiderTailoring`
   (third-party event/conference data scraping for lead generation),
   `MorningRoutine` (always-logged-in daily-push commerce app),
   `Moonstruck` (wedding vertical) and `The Residents Club` (physical
   membership club + events business) describe a different company's
   business model, not PAON's. None of these get built speculatively
   per `NON_GOALS.md` — "building toward it prematurely is exactly the
   kind of unrequested complexity `PRINCIPLES.md` warns against." They
   stay listed here so a future re-read of the deck doesn't re-litigate
   the triage.

**Consequences.** UI plainness relative to the deck was, until now, a
deliberate reading of `DESIGN_SYSTEM.md`'s restraint principle; this
ADR records that the founder wants more visual and interaction depth
on the customer-facing storefront specifically, which supersedes that
default for the catalog/PDP/appointment surfaces (not the admin/
retailer back-office UI, which stays quiet/editorial). `packages/ui`
has 7 primitives (`Badge`, `Button`, `Card`, `FormField`, `Input`,
`Label`, `Select`) — the storefront work will need several new
components (fabric/material selector, archetype customizer, masonry
grid) built against the existing design tokens, not a new visual
system.

## ADR-035: Overriding ADR-034's bucket 3 — Wedding Party and Today's Pick, and a founder-directed premium visual pass

**Context.** ADR-034 triaged the Nebel & Spiegel concept deck into
three buckets and explicitly deferred `Moonstruck` (wedding vertical),
`MorningRoutine` (daily curated push-commerce) and several others as
"a different company's business model, not PAON's." The founder has
since explicitly overridden that triage for two of them — "build the
wedding party thing... make it working on the customer end and on the
retailer end" and "build morningroutine" — and separately directed
that the storefront's premium visual language (ADR-034 bucket 2)
extend across every customer-facing surface, not just catalog/PDP,
with the explicit instruction to prioritize this "despite any risks."
Per this repository's own rule ("a reversal of a past ADR" is
"genuinely architectural" and needs a recorded entry), this ADR
supersedes ADR-034's bucket-3 placement of those two items only —
`MunroMissionControl`, `MunroMerchant`, `InsiderTailoring`, `The
Residents Club` remain out of scope; nothing about those changed.

**Decision — scope, not literal reimplementation.** Both features are
built as real PAON domain concepts serving the same underlying need
the deck named, not as a port of Atelier Munro's specific mechanics
(which assume a different product, a different membership business,
and a static prototype with no real backend):

1. **Behavioral tracking now actually fires.** `capture_behavioral_event`
   and the `BehavioralEvent` domain model existed since Phase 5 with no
   call site in `apps/customer`. A client-mount tracker
   (`r/[slug]/track-view.tsx`) now emits `product_viewed` on the PDP
   and `category_browsed` on a filtered catalog view, for signed-in
   customers only — feeding Self-Portrait live instead of it only ever
   showing whatever a seed script or manual entry produced. Self-Portrait
   also gained a "worth a clienteling note?" nudge when a customer has
   activity in the last 3 days.
2. **"Today's Pick"** (MorningRoutine's core idea — one curated,
   context-aware recommendation — without the parts that need
   infrastructure this deployment doesn't have: no weather API, no
   scheduled push/cron for a daily send, no 1-click saved-payment
   checkout beyond what the existing cart already does). User-initiated
   via a button on the customer dashboard, per retailer relationship.
   `@paon/ai`'s `AIProvider` gained `generateProductRecommendation`
   (candidates = a bounded slice of the retailer's active catalog,
   never the full catalog dumped into the prompt); OpenAI is asked to
   pick one candidate id and enforced to have actually picked one of
   them, same defensive parsing shape as `generateNextBestAction`.
   Recording the generation needed a new entry point:
   `record_customer_ai_generation` (`20260721000003_*`) is a
   `security definer` RPC re-deriving the caller's own `customer_id`
   from `auth.uid()`, because `ai_generations`' insert policy is
   staff-only (ADR-033) and broadening it to let a customer insert
   arbitrary rows would be a much larger privilege change than this
   narrow, kind-locked (`product_recommendation` only) RPC.
3. **Wedding Party** (`Moonstruck`'s coordination need — one organizer,
   several invited members, each booking their own fitting, staff
   tracking the group — without the deck's broader "wedding vertical as
   a lead-generation funnel" business strategy, which is a marketing
   decision, not a data model). New bounded concept:
   `WeddingParty` (one per retailer + organizer `Customer`, event date,
   venue, status) and `WeddingPartyMember` (name, email, role, an
   always-present `customer_id` — a member is find-or-created as a
   guest `Customer` by email exactly the way TableService creates one,
   reusing that dedupe rather than inventing a second guest-identity
   path, `fitting_status`). Members and the organizer can read their own
   party; staff (`sales_associate`+) manage it for their retailer.
   Fitting-status transitions go through `update_wedding_party_member_status`
   (`security definer`) so a member can mark themselves `scheduled`
   without gaining any broader write access to the party record.
4. **Premium visual pass**: extends the ADR-034 storefront redesign
   (masonry catalog, editorial PDP) across every remaining
   customer-facing page — dashboard, loyalty, wishlist, orders,
   account — with the same serif-display + restrained-motion language,
   plus the two new features' own UI. The back-office UI (admin,
   retailer portal) is unaffected — ADR-034's distinction between
   "storefront gets premium treatment, back-office stays quiet/editorial"
   still holds; only the founder's instruction to broaden which pages
   count as "storefront-adjacent, customer-facing" changed.

**Consequences.** Two new tables (`wedding_parties`,
`wedding_party_members`), one new nullable column already added
nowhere else needs touching, and `@paon/ai`'s public interface grew by
one method (a superset — `OpenAIProvider` implements both, nothing
existing changed shape). No weather integration, no scheduled/cron
daily send, no new payment capability were built — those remain
explicitly unimplemented pending real infrastructure/credentials, not
silently faked. `MunroMissionControl`, `MunroMerchant`,
`InsiderTailoring`, `The Residents Club` are unchanged from ADR-034's
bucket 3.

## ADR-036: Second wave — Wedding Party invites, staff roster, SMS/WhatsApp, weather, newsletter, carrier preference, alteration cost controls

**Context.** Immediately following ADR-035, the founder directed a
further batch of concrete features in one session, all building on
infrastructure ADR-032–035 already established. Recorded together
since they shipped together and lean on the same patterns rather than
introducing new ones.

**Decisions.**

1. **Wedding Party self-service invite links.** Each `WeddingParty`
   gets an `invite_token` (unique uuid); the organizer shares
   `/r/{slug}/wedding-parties/join/{token}`, fully public. Rather than
   a pre-validation read of the token (which would need a new
   anonymous `wedding_parties` select policy), `join_wedding_party`
   (security definer) validates the token itself and is the only
   write path — same "narrow RPC, no new anonymous RLS policy" shape
   as `submit_table_service_inquiry`. A joining member is found-or-created
   as a guest `Customer` exactly like TableService, and immediately
   visible in the retailer's existing roster view — no new retailer-side
   code needed, since it's the same `wedding_party_members` table the
   staff "add member" flow already writes to.
2. **Staff planning: scheduled roster + self-service check-in/check-out.**
   New Identity-context concept, deliberately two tables: `StaffShift`
   (manager-authored schedule) and `StaffTimeEntry` (what actually
   happened) — the same status-vs-history split this repo already uses
   everywhere (Alteration vs. AlterationStatusHistory, etc.). `clock_in`/
   `clock_out` are narrow security-definer RPCs deriving the caller's
   own `staff_id` from `auth.uid()`; only one open time entry per staff
   member at a time. Hours are computed from actual clocked duration
   (`totalHours` in `@paon/database`), never from the schedule.
3. **SMS/WhatsApp pipeline, no credentials yet.** Founder decision:
   build the plumbing now, a Twilio key gets provisioned later — same
   non-faking pattern as every other unconfigured provider. New
   `@paon/sms` package isolates the Twilio SDK (ADR-001); one
   `sendText()` serves both channels (Twilio differs only by a
   `whatsapp:` prefix). `sms_outbox` mirrors `email_outbox` exactly
   (ADR-032's shape) — `enqueue_notification_sms` gates on the
   customer's own `communication_channels` preference (already
   supported `'sms'`) and a phone on file, defaulting to _not_ sending
   (unlike email's opt-out default, since SMS was never previously
   offered). `/api/cron/dispatch-sms` drains it.
4. **Weather-personalized Today's Pick.** Uses a real, founder-supplied
   OpenWeatherMap key (verified live) via a bare `fetch` in
   `apps/customer/lib/weather.ts` — not a wrapping package, since
   there's no SDK to isolate (ADR-001's rule is about provider SDKs).
   Returns `null` on any failure or missing key; `@paon/ai`'s
   `ProductRecommendationContext` gained an optional `weather` field,
   additive to existing call sites.
5. **Newsletter signup + daily digest, deliberately lighter than Customer.**
   A newsletter subscriber hasn't started a purchase relationship —
   `newsletter_subscribers` is its own table, not a `Customer`, with
   `subscribe_to_newsletter` as the one anonymous write path (same
   ADR-034 shape). `/api/cron/dispatch-newsletter` sends one "featured
   product" per retailer to every active subscriber — no AI/behavioral
   personalisation (a subscriber may have no browsing history to
   personalise against, unlike Today's Pick). Deliberately **not**
   added to `vercel.json`'s crons: Vercel's Hobby plan caps cron jobs
   per project and `dispatch-emails`/`dispatch-sms` already claim the
   available slots — noted as needing an external scheduler or folding
   into an existing cron tick, not silently assumed to just work.
6. **Shipping/carrier preference on the customer record.** Retailer-staff-set
   (DHL/PostNL/UPS/FedEx/local courier/customer pickup) — unlike
   `CustomerPreferences`, which only the customer themselves may write,
   `customers` already has a staff-writable `for all` RLS policy
   (sales_associate+), so this is a plain column and a direct update,
   no RPC needed. No real carrier API integration exists or was faked
   — this only records staff's chosen arrangement for them to act on
   manually.
7. **Alteration cost-control hardening.** Audited the existing
   proposal/approval flow first rather than rebuilding it — it was
   already real (immutable original quote, mandatory explanation and
   evidence, append-only history, amount ceiling, workshop-manager-only
   proposing, management-only deciding). Two genuine gaps closed:
   unlimited resubmission after rejection (now capped at two rejections
   per target), and single-approver collusion risk on large increases
   (`decide_alteration_price_change` now requires the retailer _owner_
   specifically — not any manager/admin — to approve an increase over
   50% of the original quote, above a 5000-minor-unit floor so
   small-ticket items never trip it).

**Consequences.** One new package (`@paon/sms`), four new tables
(`staff_shifts`, `staff_time_entries`, `sms_outbox`,
`newsletter_subscribers`), one new column (`customers.preferred_carrier`),
and two hardened functions (no schema change, `create or replace`
only). Every new provider-dependent path (Twilio, OpenWeatherMap,
carrier APIs) either has a real key already wired (weather) or reports
"not configured" rather than faking a result (SMS/WhatsApp, carrier
label generation — never built, never pretended to exist).

## ADR-037: UX & Logic Audit, Omni-Device Optimization, and a monorepo Tailwind content-detection fix

**Context.** A founder-directed request for a "brutal, full-scale
diagnostic audit" of both portals before any further feature work —
output the audit findings first, then fix what the audit found, then
prove the fixes with automated tests, then update docs. Full findings
are the "Friction Elimination Matrix" delivered alongside this ADR in
the session transcript, not restated here; this entry records the
architectural decisions behind the fixes, not the UX rationale (that
lives in the matrix itself and in each changed component's own
comments where non-obvious).

**Decisions.**

1. **"Needs your attention" digest replaces the Retailer Portal
   dashboard placeholder.** `/dashboard` previously rendered a literal
   Phase-1 placeholder string even though orders, alterations,
   appointments and messaging had all since shipped. It now surfaces,
   in priority order: pending alteration price approvals the viewer
   can act on (`AlterationWorkflowRepository.findPendingProposalsByRetailer`,
   new), today's non-terminal appointments, and unread notification
   count — each a direct link into the record. No new tables; this is
   a read-composition of data that already existed, the same shape
   Self-Portrait (ADR-034) already established for the customer detail
   page.
2. **Pricing proposals moved to the top of the alteration detail page.**
   Approving a price change was the single named pain point — the
   section was previously the 8th thing on the page, below read-only
   history a viewer has to scroll past every time. It's now
   immediately after the header, with an `id="pricing"` anchor the
   dashboard digest links straight to. Every other section's order is
   unchanged.
3. **Customer Portal dashboard gained a per-relationship status line**
   (next appointment / order awaiting payment / unread count), same
   reasoning as (1) applied to the shopper side — existing repository
   reads, composed differently, no new queries invented.
4. **Both apps' flat navigation lists are now grouped**, not
   restructured into new routes: Retailer Portal into Operate /
   Alterations / Sell / Configure (`role="group"` clusters with a
   divider, `aria-label`s so a screen reader announces the grouping);
   Customer Portal into My activity / Community / Inbox on desktop,
   **plus a pinned bottom tab bar on mobile** (`md:hidden` desktop nav,
   a fixed `<nav>` under `md:hidden` reversed) for the four highest-use
   destinations (Orders, Appointments, Messages, Account) — the
   explicit "pinned bottom bar" mandate, applied where it actually
   matters (the most mobile-first of the three apps).
5. **Cart quantity control replaced with steppers + a Remove button.**
   The previous UI required editing a raw number `<input>` then tapping
   a separately-positioned "Update" button — two imprecise taps for one
   action, with no way to remove a line except discovering that
   quantity 0 does it. Steppers auto-submit the existing
   `updateCartLine` action via `element.requestSubmit()`; no new
   backend logic. A sticky bottom bar (mobile only) mirrors the total
   and "Place order" CTA so checkout never scrolls out of reach on a
   multi-item cart.
6. **Every new/changed interactive control meets the 44×44px minimum
   tap target** (steppers, Remove, the mobile bottom nav links, the
   sticky checkout CTA) — enforced by, not just designed to, the
   Playwright specs in decision 8.
7. **A real, unrelated, severe bug found and fixed while verifying (6):
   `packages/ui`'s own component classes were missing from every app's
   compiled CSS.** Tailwind v4's automatic content-detection walks
   outward from the app doing `@import "tailwindcss"`, explicitly
   skipping anything under `node_modules` — and `@paon/ui` is only ever
   reached through the pnpm workspace symlink at
   `node_modules/@paon/ui`. Any class that lived solely inside a
   `@paon/ui` component's own source (`Button.tsx`'s `inline-flex`,
   `h-12`, `h-10`, `h-8`, `gap-2`, `whitespace-nowrap`, ...) — never
   re-typed as a literal string in app-local code — was silently absent
   from every app's production CSS. Confirmed by direct inspection of
   compiled output (`grep -c '\.inline-flex{' .next/static/css/*.css`
   returned 0 before the fix), not assumed. This means every Button
   across all three apps has been rendering without its intended
   `display`/`height`/`padding`/`gap` this entire build — invisible in
   this environment because there is no browser/visual-QA tool to
   catch it, and unit/type checks never exercise compiled CSS. Fixed
   with two `@source` directives in `packages/ui/src/styles/globals.css`
   (`@source "../components"; @source "../lib";`) — Tailwind v4's
   documented escape hatch for exactly this monorepo shape. This is the
   single most consequential fix in this slice and applies retroactively
   to every component built in every prior session, not just this one.
8. **Automated proof, not just written code.** Two new Playwright
   specs: `apps/retailer/e2e/dashboard-digest.spec.ts` (seeds a pending
   price proposal, asserts the dashboard surfaces it and that the
   alteration page's h2 order places "Pricing proposals" before "Chain
   of custody") and `apps/customer/e2e/mobile-ux.spec.ts` (390×844
   mobile viewport: bottom-nav visibility and 44px tap targets, cart
   stepper/remove/checkout-bar tap targets, desktop viewport shows the
   opposite nav). `apps/customer/e2e/storefront.spec.ts`'s existing
   cart test was updated for the new stepper interaction (no "Update"
   button exists anymore) — the same "fix the stale test, don't work
   around it" precedent `docs/PROJECT_STATE.md` already documents for
   the product-editing test. One new unit test
   (`alteration-workflow-repository.test.ts`) covers the new
   `findPendingProposalsByRetailer` query in isolation.
9. **`behavioral_events` grant gap, found by the retailer e2e suite,
   fixed the same way `customer_preferences`/`wishlists` was before
   it.** `20260720000005_create_behavioral_analytics.sql` predates the
   blanket PostgREST grant migration by table-creation order the wrong
   way, so it never got its own `select` grant — RLS was satisfied but
   PostgREST still 403'd with "permission denied for table
   behavioral_events". One-line additive migration
   (`20260721000011_grant_behavioral_events_select.sql`), matching the
   established pattern exactly (`docs/PROJECT_STATE.md` "Local database
   verification" already documents this class of bug once).

**Consequences.** No schema changes beyond the one-line grant in (9).
One new repository method, no new tables. The Tailwind `@source` fix
(7) is a two-line change with outsized effect — every existing and
future `@paon/ui` component now renders its intended styling in every
app, retroactively; worth a deliberate visual smoke-check next time a
browser/visual-QA tool is available in this environment, since it was
never actually seen broken, only proven broken by measurement.

## ADR-038: Alteration readiness creates one customer notification at the workflow boundary

**Context.** The garment-first alteration workflow already recorded
`ready_for_pickup`/`out_for_delivery` transactionally and exposed those
statuses through a customer-safe projection, but it only set
`customer_notification_ready_at`; it never created a `Notification`.
The shared notification inbox and preference-aware email/SMS outboxes
already supported the `alteration_update` category, so adding another
delivery path or sending from the Retailer Portal Server Action would
duplicate established infrastructure and could let workflow state
commit without its customer update.

**Decision.** An `after update of status` trigger on
`alteration_work_orders` creates an in-app `alteration_update` only when
a work order first enters `ready_for_pickup` or `out_for_delivery` and
the customer has a linked Customer Portal user. It derives the recipient
and garment description from tenant-matched database rows, never from
the caller, and deep-links to `/alterations/{id}`, whose repository reads
the existing security-barrier customer projection. The insert happens in
the same transaction as `transition_alteration_work_order`; ADR-032 and
ADR-036's existing notification triggers then enqueue email and SMS
according to the customer's stored channel preferences. The forward
migration backfills already-ready work for linked customers while
skipping an existing readiness notification for the same work order.

**Consequences.** Retailer code has no second notification call to
remember or retry, and a failed notification insert rolls back the
status transition instead of silently losing the update. Customers
without a linked portal identity still see the authoritative status
after they link/sign in, but there is no recipient to notify before
that identity exists. Native push remains unimplemented pending a
provider decision and credentials; email/SMS continue to degrade through
their documented durable outbox behavior when credentials are absent.

## ADR-039: Operational alteration attribution is database-derived and visible in the work-order audit trail

**Context.** The garment-first model already stored staff ids on most
operational records, but the Retailer Portal rendered only pricing-history
actors. Task notes, evidence, custody, status changes and completion reviews
therefore looked anonymous even though their rows were attributed, while
fulfillment had no actor column at all. More importantly, attachment and custody
were direct-RLS inserts whose actor columns came from the Server Action payload:
RLS checked permission to insert but did not prevent an authorized caller from
submitting a different staff member's id.

**Decision.** `alteration_fulfillment_events` gains nullable
`actor_staff_id`, forward-filled from its existing immutable audit entry where
available. Before-insert triggers now overwrite attachment uploader, custody
actor and fulfillment actor with `current_staff_id()` for every non-service-role
caller; the service role may retain explicit attribution for fixtures and
authorized internal tooling. This keeps the existing direct-RLS write shape but
makes staff identity a database-derived fact. The Retailer work-order page maps
ids through `RetailerStaffRepository` and displays actor + timestamp for price
proposals/decisions, pricing history, custody, evidence, task notes, status
history, completion reviews and the full fulfillment history. Worker views load
only their own staff record and retain the established customer/pricing
projection restrictions.

**Consequences.** An authorized staff member can no longer impersonate a
colleague in alteration evidence or handoff metadata. Managers get one
human-readable audit surface without querying `audit_log_entries`, while the
immutable audit log remains the deeper privileged record. Former/deleted staff
continue to render as “Former staff member” rather than losing the event; system
or legacy rows with no actor render as “System.” No customer-safe projection
gained employee identity, and no supplier/manufacturing responsibility moved
into PAON.

## ADR-040: Commercial packages use normalized server entitlements and separate revenue concepts

**Context.** PAON must support public pricing, retailer-specific demos,
proposals and paid pilots from one codebase. ADR-031 established Stripe Billing
and three seeded plans, but their names/prices were provisional, capability
keys were an unvalidated text array, and only the provider Price ID was
editable. Using retailer tiers or plan-name checks in routes would couple
product access to marketing copy and make demos unsafe to configure.

**Decision.**

1. Existing plan rows migrate in place to PAON Fused, Half Canvas and Full
   Canvas so subscription foreign keys and any configured Stripe Price IDs
   survive. Public copy, recurring price, “from” treatment, implementation fee,
   visibility and display order become editable plan data.
2. Recurring software price and one-time implementation fee are distinct typed
   money fields. Optional managed services have a separate catalogue and may be
   scoped per proposal; they are neither entitlements nor hidden subscription
   charges.
3. `commercial_features` is the validated capability vocabulary and
   `subscription_plan_entitlements` is the authorization source. The legacy
   `included_feature_keys` array remains a synchronized read-compatible
   projection during migration, updated only through the same atomic RPC.
4. `update_commercial_plan` updates package content/pricing and replaces its
   entitlement set in one platform-staff transaction. An invalid capability
   foreign key or empty set rolls back the entire change.
5. `retailer_entitlement_overrides` models explicit enabled/disabled
   exceptions with reason and optional expiry. It is not a general feature-flag
   system and cannot contain arbitrary keys.
6. `retailer_has_entitlement` is the server decision boundary. It re-derives
   tenant/platform authority, honors a current override, then requires an
   active or trialing subscription with the capability. UI visibility may
   mirror this result but can never replace the server check.
7. Public users may read only public package/catalogue data. Overrides and
   retailer subscriptions retain tenant/platform RLS.

**Consequences.** Marketing, Demo Studio, proposals and application guards can
consume one catalogue without forking applications or scattering tier checks.
Package copy can change without changing authorization keys. Existing
retailers are not silently subscribed or granted features by the migration;
live access enforcement is introduced route by route only after subscription
fixtures and denial-state UX are in place. Managed-service proposal pricing and
live Stripe product provisioning remain subsequent commercial checkpoints.

## ADR-041: Public commercial interest is persisted without creating a tenant

**Context.** PAON's public product story needs genuine next actions for a
personalized demonstration, retailer consultation and paid pilot. A decorative
form would fail the experience test, but allowing an anonymous request to
create a retailer, demo environment or sales prospect would cross a material
trust and isolation boundary before the founder has reviewed it.

**Decision.** The three public journeys submit one validated
`CommercialInquiryInput` with an explicit intent enum. Anonymous callers have
execute permission only on `submit_commercial_inquiry`; they have no table
grant or policy. The security-definer function normalizes and bounds every
field, inserts a founder-owned inbox row with `new` status, and returns only its
opaque id. Platform staff may manage the rows through RLS. The public marketing
surface lives in Customer Portal because it already owns customer-facing and
public retailer experiences, but protected private-client routes retain their
existing middleware boundary.

**Consequences.** Success feedback represents a real durable request, and the
same commercial intent can later feed the sales cockpit without re-parsing
unstructured messages. Submission does not imply qualification, consent to
research, demo generation, tenant creation or production onboarding. Abuse
controls beyond payload validation and platform-level infrastructure limits
remain required before high-volume public launch.

## ADR-042: Retailer branding is a validated token document with immutable versions

**Context.** Personalized demonstrations and live retailers need meaningful
visual identity without retailer-specific forks. Storing arbitrary CSS, font
URLs or HTML would make every preview a security boundary, undermine PAON's
design coherence and create configurations that cannot safely move from a
prospect into onboarding. The existing `retailers.brand_theme` JSON was only
cast to a TypeScript interface and accepted three optional strings.

**Decision.** `RetailerBrandTheme` is one closed token document: three HTTPS
asset URLs, three six-digit colors, curated display/body font keys and a
curated corner key. Domain and database validation reject unknown keys and
require 4.5:1 contrast between surface and ink. A shared UI component maps the
keys to scoped CSS variables; it never emits supplied CSS. Publishing goes
through `save_retailer_brand_theme`, which re-derives platform or tenant
owner/admin authority, locks the retailer, appends an immutable attributed
version and activates the same validated document transactionally. Restore
appends another version rather than rewriting history. Direct staff updates to
the JSON field are blocked by the retailer update trigger.

**Consequences.** Storefront, operating portal, future prospect demo and
proposal can share one design system and one configuration shape. A sold
prospect can copy an approved token document into onboarding without copying
code or synthetic records. The curated vocabulary intentionally limits
pixel-level brand mimicry; extending it requires an explicit schema, database
validator and shared renderer change rather than injecting bespoke CSS.

## ADR-043: Demo Studio configuration is versioned before an isolated environment exists

**Context.** A founder must prepare a specific retailer demonstration quickly,
but configuration, tenant generation and publication have different security
consequences. Creating a live retailer or copying showcase records as soon as a
prospect form is saved would make research destructive, leak synthetic state
into onboarding and produce links before role isolation can be verified.

**Decision.** `commercial_prospects` stores only business research, contact and
sales context under platform-staff RLS. A prospect has at most one current
`prospect_demo_configuration`, composed from an existing commercial plan,
normalized feature keys, the ADR-042 theme document, bounded retailer copy,
locations and a curated product mix. `save_prospect_demo_configuration`
validates and replaces the module set and appends a full immutable snapshot in
one transaction. Configuration advances early pipeline state only to
`demo_preparation`; it cannot create a retailer, auth identity, demo tenant or
public link. Brand assets use a dedicated bounded platform-write Storage
bucket; non-local asset URLs remain HTTPS-only.

**Consequences.** Research and design can be revised/restored without orphaned
tenants, and synthetic generation can consume one explicit version in the next
checkpoint. Demo Studio shows a component preview but labels the environment
as ungenerated until isolation exists. Publication, access codes, engagement
tracking and pilot conversion cannot accidentally be inferred from a saved
configuration.

## ADR-044: Production incident recovery — inverted auth check, wiped schema, and the migration-bookkeeping repair pattern

**Context.** A separate, uncoordinated tool session (not this one) left an
unfinished, uncommitted NextAuth migration in the working tree that deleted
every app's login page and `/auth/confirm` route, and gutted
`packages/auth/src/guards.ts` so every authorization check
(`requireRetailerRole`, `requireAlterationsPermission`,
`requireCustomerSession`, etc.) unconditionally passed — every guard function
returned immediately with no check at all. Separately, and more seriously,
the production Supabase database's entire `public` schema had been dropped
down to one stray, hand-created table (`prospect_demo_environments`),
confirmed by direct Management API query rather than assumed from symptoms.
The founder confirmed no real retailer or customer had used production yet.

**Decision.** Discard the auth-gutting work entirely (`git stash drop` — not
committed, not deployed, unrecoverable by design) rather than attempt to
finish or repair it; it was fundamentally the wrong direction, not a
work-in-progress worth salvaging. Rebuild the wiped schema by pushing the
existing, already-reviewed migration chain rather than writing new recovery
SQL — but first: fix a real dependency-ordering bug the chain had (a table
referencing another table numbered to be created after it), remove one
migration outright for a hard syntax error and wide-open `USING (true)`
RLS with no `TO` clause (any caller, authenticated or anonymous, could have
read and written every customer's data), and scan the rest of the pending
batch for the same destructive/RLS patterns before pushing anything to
production. Since the remote migration-bookkeeping table (`supabase_migrations
.schema_migrations`, outside the wiped `public` schema) still recorded the
now-missing tables as applied, `db push --linked` silently skipped
recreating them — fixed with `supabase migration repair --status reverted`
against the affected version range before repushing, a now-documented,
reusable pattern for exactly this failure mode.

**Consequences.** No customer/retailer data was lost (none existed yet), but
this establishes migration-bookkeeping repair as a real, load-bearing
recovery technique for this project, not just a `db push` retry. It also
means every future migration batch gets scanned for destructive statements
and permissive RLS before touching production — the classifier that blocks
Claude from running `db push`/`migration repair` directly against production
is a deliberate, correct guard, not friction to route around; the founder
ran both commands themselves after review. `packages/auth/src/guards.ts`
having ever been gutted, even briefly and never deployed, is the reason
authorization-check integrity is now something worth spot-checking after any
externally-sourced or multi-tool-session change to this repository, not just
assumed intact.

## ADR-045: RLS self-referential-pair recursion — the mutual-lookup trap and its fix

**Context.** `wedding_parties`' "organizer and members read their wedding
party" `select` policy inlined a lookup against `wedding_party_members`
(itself RLS-protected); `wedding_party_members`' "organizer and members read
the roster" policy inlined a lookup against `wedding_parties` right back.
Postgres evaluates each inline subquery under RLS too, so reading either
table re-triggered the other's policy, which re-triggered the first —
`ERROR 42P17: infinite recursion detected in policy`. This had shipped
silently: every prior code path read these tables as retailer staff (a
different, non-recursive policy branch), so the bug was invisible until
Phase 4 of the Nebel & Spiegel round-2 build (2026-07-26) added the first
code path reading them as an organizer/member.

**Decision.** Fixed by moving the cross-table check into
`is_wedding_party_organizer_or_member(p_wedding_party_id)`, a `stable
security definer` function owned by the migration role (which owns both
tables). A `security definer` function's body executes under its owner's
privileges, and Postgres does not apply RLS to a table's owner by default —
so the function's _internal_ lookups bypass RLS entirely instead of
re-entering the calling policy, breaking the cycle. Both policies now call
this one function instead of inlining the join.

**Consequences.** Any future policy that needs to read a _different_
RLS-protected table as part of its own `USING`/`WITH CHECK` clause should
default to a `security definer` helper rather than an inline subquery,
whenever there's a realistic chance the other table's own policies read
back the first table (a "pair" or "cycle" of mutually-referencing tables —
`wedding_parties`/`wedding_party_members`, `conversations`/`messages`, and
similar parent/child shapes are exactly the pattern to watch). This is the
same technique `current_retailer_id()`/`is_platform_staff()` already use for
JWT-claim lookups, just applied to a table lookup instead. See
[ACCESS_MODEL.md](./ACCESS_MODEL.md) for the broader visibility-tier
reference this spot-check fed into.

## ADR-046: paon.html served byte-for-byte through a Route Handler — a deliberate exception to "Route Handlers are only for webhooks/non-browser callers"

**Context.** After the Nebel & Spiegel round-2 build (ADR-045 and the
surrounding "Shipped: Nebel & Spiegel round 2" entry in
`docs/PROJECT_STATE.md`) reimplemented the storefront landing page and
Mission Control/AM House Party/Morning Routine as idiomatic React ports of
the founder's `paon.html`/`pag1.html` design files, the founder rejected
that approach outright and explicitly, repeatedly demanded the literal
source files be served pixel-for-pixel, not a reinterpretation, with only
backend data wiring changed. A React Server Component render, even a very
careful one, cannot byte-reproduce a ~1,600-line hand-authored HTML/CSS/JS
file; every port introduces some drift (attribute order, whitespace, a
Tailwind utility standing in for a bespoke `rgba()`/`blur()` value, event
wiring living in a different place) that is invisible in isolation but
violates the literal instruction given.

**Decision.** `apps/customer/app/r/[slug]/route.ts` serves the founder's
`paon.html` verbatim: the file is stored unmodified as
`paon-template.html` (aside from five narrow placeholder tokens —
`__PAON_PRODUCTS_JSON__`, `__PAON_RETAILER_NAME__`, `__PAON_CATEGORIES_JSON__`,
`__PAON_DEFAULT_CATEGORY_JSON__`, `__PAON_SLUG__`) and returned as raw
`text/html` from a `GET` Route Handler, with real catalog data
(`ProductRepository`/`ProductVariantRepository`/`CollectionRepository`)
substituted in via string replacement before the response is sent. A
trailing `<script>` block wires the original file's buy/consult buttons to
a real `POST /r/[slug]/api/cart-add` endpoint (also a Route Handler, since
its only caller is the template's own inline JS, not a Server
Component/Action). This directly contradicts `docs/API.md`'s stated scope
for Route Handlers ("used only when the caller is not the app's own Server
Components/Actions... if you're reaching for one to serve the app's own
frontend, use a Server Component or Server Action instead") — flagged here
rather than silently worked around, per this project's standing rule that
an unavoidable shortcut gets written down, not hidden. It is unavoidable
here specifically because a Route Handler is the only mechanism in the App
Router that bypasses the React component tree (and therefore `layout.tsx`,
JSX serialization, and any Tailwind/React rendering drift) entirely — which
is exactly the property "byte-for-byte" requires.

The same "serve/replicate the real design exactly, layer real data on top,
never invent" instruction was applied, at the founder's explicit direction,
to the retailer dashboard (a dark Mission Control utility header —
`apps/retailer/app/(dashboard)/dashboard/page.tsx`), the wedding-party
detail page (`AmHouseHero`,
`apps/customer/app/(dashboard)/wedding-parties/[id]/am-house-hero.tsx`, a
full-bleed video hero with glass notification/nav panels pixel-matched to
pag1.html's "AM House Party"/"Moonstruck" screen), and Today's Pick
(`apps/customer/app/(dashboard)/dashboard/todays-pick.tsx`, matched to
pag1.html's "Morning Routine" screen) — those three are ordinary React
components, not Route Handlers, because none of them needed to reproduce a
file that isn't itself HTML/JS (pag1.html's screens were extracted as a
visual/CSS reference via direct `sed`/`grep` inspection and a Playwright
screenshot of the rendered phone-bezel mockup, not served as a file).
Where pag1.html's own copy described a feature with no backend model behind
it (the "Munchies"/"I AM" nav icons in the AM House Party screen — a
wedding food-menu concept never modeled in PAON's domain), the icons were
relabeled to real destinations (Fittings/Your look/Cart/Account) rather
than fabricated, consistent with this project's no-fabrication rule — the
one deliberate content deviation from "exact," made because inventing a
working feature behind a mockup icon would violate a different, equally
firm rule.

**Consequences.** `apps/customer/app/r/[slug]/route.ts` is the one route in
this codebase that is simultaneously "serves the app's own frontend" and "a
Route Handler," and any future engineer reading `docs/API.md` in isolation
will correctly flag it as a violation — this entry is that flag, resolved.
`paon-template.html` must never be "cleaned up," reformatted, or partially
rewritten into JSX; any future visual change to the storefront happens by
editing the founder's own file directly (or replacing it wholesale if he
supplies a new one), not by the codebase's usual component conventions. The
old `apps/customer/app/r/[slug]/page.tsx` and its supporting
`product-detail-panel.tsx`/`product-variant-selector.tsx`/
`storefront-nav.tsx` components (the Phase 5/6 React port) were deleted
entirely rather than kept as a fallback — confirmed via grep that nothing
else referenced them first. Not yet done as of this entry: a fresh
Playwright e2e pass for the storefront's new cart-add flow (only
lint/typecheck/build were re-verified after the swap), and the
founder-requested separate consumer landing page ("the same for the lander
for consumers with the bg video and buttons like am house on it" — distinct
from the AM House Party wedding-coordination screen above, a public
marketing entry point reusing the same video-hero/glass-button visual
language). See `docs/PROJECT_STATE.md`'s "paon.html verbatim + Mission
Control/AM House Party/Morning Routine" entry for the fuller status and
what's still open.

## ADR-047: a real layout bug in `paon-template.html` was patched directly, and the founder-requested consumer lander was built as Customer Portal's own `/login`

**Context.** Closing out ADR-046's two open items surfaced a genuine defect,
not a styling question. `paon-template.html` contains `#paon-mobile-menu-dim`
and `#paon-mobile-menu-drawer` — markup for a phone hamburger-menu overlay
with **zero** CSS anywhere in the 4,342-line file and **zero** JavaScript
(`window.paonOpenMenu`/`paonCloseMenu` are referenced by `onclick` but never
defined). Being unstyled, plain `<div>`s, they behaved as ordinary items in
`.layout`'s CSS Grid and stole the middle (`1fr`) track from `#main` — on
**every** viewport, desktop included, collapsing the real storefront content
into a 0-width or wrong-position box. It was invisible to a quick look
because deeply-nested absolutely-positioned children still painted outside
their collapsed container, and it was invisible to the existing e2e suite
because those tests only asserted `toBeVisible()`/text content, never actual
box dimensions.

**Decision.** Patched `paon-template.html` directly — the one class of change
ADR-046 reserves for "editing the founder's own file directly": (1)
`position: fixed` on the two unstyled menu placeholders so they stop
participating in grid layout at all (they remain exactly as inert/invisible
as before — no menu was ever functional, so nothing about the visible product
changes); (2) an explicit `.layout main { grid-column: 2; }` rule, because
`#main` was never given its own column assignment and only ever landed in the
right place by the accident of being the Nth sibling after `aside` — which
breaks the moment `aside` is `display:none` (every viewport ≤ 850px, i.e.
every phone), independent of the menu-placeholder bug. Confirmed via a direct
Playwright `getBoundingClientRect()` probe at both 390px and 1280px before and
after, not just re-running the existing assertions. Checked with the founder
before patching, given ADR-046's explicit "never edit this file" instruction;
confirmed the menu scaffold has no current visible or functional presence, so
fixing it changes nothing a real visitor could already see.

Also rewrote `apps/customer/e2e/landing-page.spec.ts` entirely — it still
exercised the deleted Phase 5 React port (top nav, bottom dock, slide-out
menu `getByRole("button", {name: "Menu"})`), none of which exists in the
verbatim template. It now drives the real template: opens a product via
`.grid-card[data-product-id]`, asserts `#view-detail.visible`, and exercises
"Add to Bag" end to end (signed-out → `/login?redirectTo=...`; signed-in →
real `addToCart` line, landing on `/r/[slug]/cart`). The test product
belongs to `collections.spec.ts`'s "E2E Capsule" collection, which is never
the grid's default active category, so desktop tests switch to it via the
sidebar's `.cat-grid` category chip first; mobile hides that chip entirely
(the category rail lives in the `<aside>` `.cat-grid`, which mobile's own
`@media (max-width: 850px)` rule hides in favor of a separate `#filter-panel`
flow) so the mobile test checks the grid's default-category product instead
of switching category — the mobile filter-panel flow itself is not exercised.
Separately, `apps/retailer/e2e/demo-personas.spec.ts` broke for an unrelated
reason: the Mission Control header's new "Daily briefing · N" pill
(`href="#attention"`) starts with the same text as the sidebar's existing
"Daily brief" nav link, so a page-wide `getByRole("link", {name:
/^Daily brief/})` became ambiguous. Scoped those assertions to
`getByRole("navigation", {name: "Primary"})` instead of touching either
label.

The founder-requested consumer lander ("the same for the lander for
consumers with the bg video and buttons like am house on it") is now
`apps/customer/app/login/page.tsx` — deliberately not a new orphan route.
Customer Portal's only other public page is `(marketing)/page.tsx`, which is
platform-facing B2B copy aimed at prospective retailers ("PAON gives premium
retailers…", pricing plans, "Book a retailer consultation") — not a page a
shopper ever lands on. `/login` is the actual front door every real customer
hits, and on mobile the previous shared `AuthShell` component hid its image
hero entirely (`hidden lg:block`), leaving phones with a bare form and no
hero at all. The new page keeps `AmHouseHero`'s exact visual grammar — a
full-bleed autoplay/muted/loop video (`nebelspiegel.com/images/munross2026.mp4`,
the "Spring—Summer Tailoring" clip already present in `pag1.html`, generic
apparel content rather than the wedding-specific `wed2027.mp4`), a
translucent `bg-white/10 backdrop-blur-2xl` glass eyebrow badge and outer
card — but the actual sign-in form (`MagicLinkForm`/`DemoLoginForm`/
`QuickDemoLogin`) is unchanged and sits in a solid `bg-[var(--color-stone-50)]`
inner card, not directly on the glass. `@paon/ui`'s `Input`/`Label`/`Button`
have no inverted-on-dark variant, and adding one for a single call site would
be exactly the kind of speculative abstraction `docs/PRINCIPLES.md` rules
out — wrapping the unmodified, already-accessible form in a solid card gets
the video-hero/glass treatment the founder asked for without touching a
shared component or its contrast guarantees. `apps/retailer` and
`apps/admin` logins are untouched; both remain on the shared `AuthShell`
(staff auth, a different audience with no such request).

**Consequences.** All 60 e2e tests across the three apps pass (24 customer,
27 retailer, 9 admin), plus `pnpm lint`/`typecheck`/`build`/`test` clean
across every package, run with caches forced off to confirm nothing was
stale. Not yet done: a live-browser screenshot pass against the founder's
own device (only this session's own Playwright screenshots were checked);
whether "ALL THE OTHER TOOLS" the founder referenced covers anything beyond
the items ADR-046 already named remains unconfirmed.

## ADR-048: `paon-template.html` re-synced to the founder's complete file; `#gilda-chat-widget` ("TableService") ported byte-for-byte

**Context.** ADR-046/047's "byte-for-byte" claim turned out to be only
partially true: `paon-template.html` (4,359 lines) was a stored copy of an
_older, incomplete_ snapshot of the founder's actual `paon.html`
(15,982 lines, 600,652 bytes vs the stored 140,076). Entire later sections
— the home masonry feed, the founder's own mobile-menu CSS fix, the grid's
fixed 10-category taxonomy (Suits/Jackets/Pants/Knits/Shoes/Shirts/
Outerwear/Evening/Wedding), dozens of the founder's own iterative "final"
CSS/JS patches — never made it into the repo. This is what the founder
meant by "this is 70%."

**Decision.** Replaced `paon-template.html` wholesale with the founder's
complete current file, re-applying only the same class of minimal
data-wiring hooks as ADR-046/047 (never new visual markup):

- `const products = __PAON_PRODUCTS_JSON__;` at the real array's exact
  bounds (previously lines 3973–4464 in the source).
- `const categories = [...]` is the founder's own fixed taxonomy —
  **not** templated, left exactly as written. Its `getCat()` bucketing
  was keyed to the founder's own sample data's id-naming scheme (numeric
  ids, `broek*`/`schoen*` prefixes), which real slug-based products never
  match; `route.ts`'s `canonicalCategoryFor()` classifies each real
  product into that exact taxonomy by keyword match against its
  name/collection, and a one-line addition to `getCat()` trusts an exact
  canonical match before falling back to the founder's own heuristic. The
  default active category is now whichever bucket has the most products,
  not just the first one, so the initial view isn't gratuitously sparse.
- The `openModal()` hook and trailing wiring `<script>` are unchanged in
  shape from ADR-046 — re-applied to the new file since it's a wholesale
  replacement, not a patch.
- The old file's missing `#paon-mobile-menu-final` style/script (the
  founder's own later fix for the mobile-menu grid bug ADR-047 patched
  independently) is now present natively; ADR-047's manual patch was
  redundant against the complete file and was dropped.
- Maison Dubois's demo catalog grew from 6 products (one per taxonomy
  bucket, so every category view showed exactly one item) to 15, using
  real image assets already present in the founder's own file
  (`broeken-webp/broek2.webp`, `trui1_converted.webp`,
  `schoen02_converted.webp`, etc.) — a content-depth fix, not a code fix;
  the taxonomy-matching code was already correct, the seed just didn't
  have enough products per bucket to look like a real boutique.

Separately, **`#gilda-chat-widget`** — pag1.html's "TableService" section,
anchor `id="tableservice"` — is a real, self-contained ~170-line CSS +
37-line HTML + 53-line JS chat widget (quick-intent image picker,
WhatsApp-style `#dcf8c6` message bubbles, paperclip/attach panel), not a
restaurant-ordering flow as its name suggests. `apps/customer/app/r/
[slug]/table-service-widget.tsx` was previously a generic `@paon/ui`
popup form with no visual relationship to it — despite "TableService"
being named as shipped in an earlier session, its actual CSS/markup was
never ported. Rewrote it as a byte-for-byte port: identical class names,
colors, image URLs, and interaction behavior (picker fade-out, bubble
rendering, attach-panel slide). The source widget has no name/email
field — a static mockup never needed a real visitor identity — but the
already-shipped, real `submitTableServiceInquiry` Server Action
(anonymous-write, ADR-034's `submit_table_service_inquiry` RPC) requires
both, so the single `.gcw-field` input is reused as a short guided
sequence (name → email → message) instead of adding three fields at
once. The attach-panel's four items stay exactly as inert as they are in
the founder's own source (no upload call exists in his original JS
either) — not wired to a fabricated upload feature. Two `<div
onClick>` elements became `<button>` (source used raw divs; this repo's
WCAG 2.1 AA rule and `jsx-a11y` lint require a real interactive element),
styled to be visually identical via inline resets.

**Consequences.** Verified end-to-end against the running dev server (per
the new "never rebuild `.next` under a live `pnpm dev`" rule): every
category renders the founder's real taxonomy with correct product
counts/images/captions; the TableService widget's full flow (intent tap →
name → email → message → submit) produces a real `messages` row joined to
a real `customers`/`conversations` record, confirmed directly against the
local database. Not yet done: e2e coverage for the TableService widget
(no existing spec touches it); the same rigor still owed to Voice
Command's fit-tool slider, the Tinder-style swipe deck, Self-Portrait, and
both apps' messaging UI — all confirmed generic `@paon/ui` builds with no
relationship to pag1.html's actual CSS, still open.

## ADR-049: `products.swatch_image_url` — a real second image field, not a reused photo

**Context.** The storefront detail view's mobile "swatch" section
(`#paon-mobile-swatch-img`) is supposed to show a distinct fabric/texture
close-up, separate from the main mannequin photo. `Product` (`@paon/domain`)
only ever had one image field, `primaryImageUrl`; `route.ts`'s `toDetailImg`
returned that same URL for both, so every product's "swatch" was silently
just its main photo again — a real content defect the founder flagged
directly ("fabric swatches are incorrect").

**Decision.** `20260726000002_add_product_swatch_image.sql` adds a plain
nullable `swatch_image_url` column to `products` (same shape as
`primary_image_url`, no RLS change needed — covered by the table's existing
policies). `Product.swatchImageUrl` (`@paon/domain`) and
`ProductRepository`'s `toDomain` mapping expose it; `route.ts`'s
`toDetailImg` now returns `product.swatchImageUrl ?? product.primaryImageUrl`
— a real second asset when the retailer has one, the same photo as before
when they don't, never a broken image.

The demo seed's `swatchImagePath` per product is **not** a guessed naming
convention (`smaller/6054.webp` → `smaller/6054_1.webp` looks reliable, but
`schoen01_converted.webp`'s real companion is `schoen3-3.jpg` — the
founder's own numbering is shuffled between his `img`/`detailImg` pairs, not
sequential). Every one of the 21 demo products' swatch paths was looked up
directly in the founder's real `paon.html` array by matching `img` to its
actual `detailImg`, then verified to resolve with a live `curl` before being
committed — not derived, not invented.

**Consequences.** `retailer_has_entitlement`-style write access to this new
field from the Retailer Portal's `/products/[id]` editor is **not** built —
`update_product_catalogue` (the manager-facing RPC) doesn't accept it yet.
Scoped deliberately to fixing the storefront read path the founder flagged;
extending the manager upload UI to let a retailer set their own swatch photo
is a real, separate, disclosed follow-up, not silently skipped.

## ADR-050: Pricing primitives — `PriceAdjustment` records, `PromotionRule` configuration, and stored value as tender

> **Status: design only. No code implements this ADR.** It is recorded
> ahead of implementation because the shape of the model determines how
> every order total in the system is computed, and that is not a decision
> to make incrementally inside a feature PR. Read it as a deliberate
> design, not a description of working code, until an implementing ADR
> supersedes this line. Several points below are marked as requiring a
> founder decision and are genuinely undecided.

**Context.** PAON has no pricing primitives of any kind. `Order` carries
`subtotal` and `total`; `OrderLine` carries `unitPrice`; nothing in
`packages/domain/src` or `supabase/migrations` expresses a discount, a
promotion, a coupon or a gift card. `ROADMAP.md` Phase 7 already names this
as the largest open item, and `COMPETITIVE_GAPS.md` ("Discount, promotion
and stored-value primitives") records it as an adoption blocker for the
initial target segment: every retailer there runs seasonal offers,
trunk-show pricing and gift cards, and there is no manual workaround that
doesn't corrupt the order record.

Two existing parts of the system constrain the answer and must not be
duplicated. `Reward` redemption already exists in the Loyalty context
(Phase 4) and already reduces what a customer pays. And the Production
context already solved a structurally identical problem for alterations:
an immutable original quote plus append-only pricing history with employee
attribution (ADR-016). A second, parallel discount mechanism would violate
`PRINCIPLES.md` "maximum reuse, zero duplicated logic" on day one.

**Decision.** Three separate concepts, in the Commerce context, plus one
correction to Order's shape.

_1. `PriceAdjustment` — an immutable applied record._ A row stating that a
specific amount was taken off a specific order line, why, and on whose
authority. It is never recomputed after the fact, for the same reason
`Alteration`'s original quote is immutable: an order's history must remain
readable years later, when the promotion that produced it no longer exists.
Kinds: `promotion` (a rule fired), `manual` (staff discretion),
`loyalty_reward` (a `Reward` redemption, so loyalty produces adjustments
rather than owning a parallel path to the same effect). `manual` carries
the responsible `RetailerStaffMember`, derived in Postgres from the caller
rather than trusted from the client — the attribution pattern ADR-039
established.

_2. `PromotionRule` — retailer-scoped configuration._ What may be
discounted, by how much, under what conditions, over what period. Editing
or deleting a rule never alters a `PriceAdjustment` it previously produced.

_3. Stored value is tender, not a discount._ A gift card does not reduce
the price of goods; it settles part of what is owed. Modeling it as a
discount produces wrong VAT (tax is due on the full price) and wrong
revenue recognition (the sale of a gift card is a liability, not revenue).
It therefore belongs alongside `Payment`, not alongside `PriceAdjustment`.
This is the single most consequential call in this ADR and the one most
commonly got wrong.

_4. Adjustments attach at line level, always._ An order-level discount is
allocated across lines rather than stored at the order. Returns, partial
refunds, tax and per-garment margin reporting all need per-line truth, and
reconstructing it later from an order-level figure is lossy. Allocation is
deterministic and uses largest-remainder distribution so that integer
minor-unit amounts sum exactly to the intended total with no rounding
drift — `Money` forbids float arithmetic by construction
(`shared/money.ts`) and this is exactly the case that tempts a violation.

_5. `Order` gains explicit components._ `subtotal`, `adjustmentTotal`,
`taxTotal`, `shippingTotal`, `total` — replacing today's bare
`subtotal`/`total`. A pure `computeOrderTotals()` in `@paon/domain` owns
the arithmetic and the ordering (adjustments before tax), following the
`retailerRoleAtLeast` precedent `DOMAIN_MODEL.md` names as the pattern for
invariant-enforcing functions.

**Open — requires a founder decision, not an engineering default.**

- **Stacking.** Whether two promotions may apply to one line; whether a
  manual staff discount stacks on a promotional price. This is commercial
  policy, and guessing it wrong is expensive to unwind once real orders
  exist.
- **Manual discount authority.** Whether staff may discount at all, and
  from which role upward. Every other sensitive capability in this
  codebase is role-gated (`ACCESS_MODEL.md`); discounting is more
  sensitive than most, since it is a direct margin leak.
- **Stored value in the first slice, or deferred.** Gift cards are
  separable from discounts and could follow later. They carry their own
  liability-accounting and fraud surface.
- **Whether promotion rules are retailer-authored or platform-configured**
  at this stage, consistent with how `SubscriptionPlan` is handled.

**Consequences.** Nothing here is built; the repository is unchanged by
this entry. When it is built, three things follow. Changing `Order`'s
shape is a breaking domain change touching the cart, checkout, order
repositories, both portals' order views and the analytics dashboards —
it is not additive and should not be attempted as a side effect of a
feature. Tax is deliberately named in `computeOrderTotals()` while no tax
concept exists anywhere in the system (`COMPETITIVE_GAPS.md`, "Tax, VAT and
multi-currency correctness"), so either tax lands first or `taxTotal` is a
documented zero with a tracked follow-up rather than a silent omission. And
deposit schedules (`COMPETITIVE_GAPS.md`, Tier 2) depend on this landing
first, since a deposit is a percentage of a total that is currently
computed wrong — that work also has to supersede ADR-030's "one Payment per
Order (MVP scope)" constraint explicitly, which this ADR does not do.

Cross-references in this entry are by section name rather than number: the
gap document was reorganized after this ADR was written, and a pointer that
silently goes stale is worse than a slightly longer one. The decision
itself is unchanged.

## ADR-051: Build audit — breadth is now a liability; five subsystems have never executed

**Context.** A full inventory taken 2026-07-27, immediately after CI was
switched on for the first time:

- 84 pages, 16 API routes, 30 domain entity files, 76 migrations, 41
  repositories, 280 unit tests.
- Shipped surface includes loyalty, rewards, referrals, events and RSVP,
  wedding parties, clienteling, staff shift scheduling, staff time clock,
  AI next-best-action, AI recommendations, weather personalisation,
  newsletter digests, behavioural analytics, subscription billing, and an
  alterations vertical with chain of custody, immutable quotes, workshop
  assignment and Postgres-derived employee attribution.
- Paying customers: zero. Pilot commitments: zero.

Three facts make that inventory misleading.

**Five subsystems have never run.** Stripe payments (ADR-030), Stripe
billing (ADR-031), Resend email (ADR-032), Twilio SMS/WhatsApp (ADR-036)
and OpenAI personalisation (ADR-033) are all recorded as "code-complete,
blocked only on credentials." None of those credentials were ever
provisioned. Their unit tests exercise fakes, so a green suite proves the
code calls a pretend provider correctly and nothing more. Code that has
never executed against its real dependency is a hypothesis, not a feature,
and this document set has repeatedly described such code as shipped.

**Breadth is now a demo liability.** Every one of those 84 pages is a place
a prospect can click and find an empty state. For a product being sold on
the promise of digital credibility, a half-populated Loyalty screen does
more damage than a missing one.

**The three workstreams that matter are the thinnest artifacts in the
repository.** Marketing site: 817 lines, three of six routes are stubs.
Demo Studio: 696 lines. Storefront: a 271-line route injecting JSON into a
16,183-line hand-authored HTML file that sits outside `@paon/ui`, is
exempt from prettier and lint, has no test coverage, and has been re-synced
wholesale twice after drifting from the founder's own source (ADR-048).

The underlying error is diagnosable: **PAON was built as though the risk
were technical.** It is not. The risk is that no retailer wants it. Every
hour spent on alteration chain-of-custody presumed the product question had
already been answered. It had not.

**Decision.** Four things are settled by this entry.

1. **Provision Stripe.** Not to build anything new — to make ADR-030's
   existing code real. The stated objective in `PHASE.md` is retailers with
   money down, and PAON currently cannot accept money. This moves onto the
   critical path.
2. **Connect Vercel to git.** `PROJECT_STATE.md` records that deploys happen
   by CLI archive upload with no git integration, so there is no per-change
   preview URL and no staging anyone trusts. For a business whose conversion
   instrument is sending a prospect a link, this is the highest-value piece
   of missing infrastructure.
3. **`ROADMAP.md` is subordinate to `PHASE.md`.** It still describes an
   "Experience Rebuild in progress" with an eight-item commercialisation
   track. Two competing plans in one repository is the precise mechanism by
   which control was lost. `PHASE.md` wins; `ROADMAP.md` is sequencing
   history until the freeze lifts.
4. **`PROJECT_STATE.md` is not trustworthy without verification.** It
   asserted that no GitHub remote existed and no CI ran. Both were false —
   `origin` was configured and `.github/workflows/ci.yml` had been present
   the whole time. A 1,721-line document that is wrong about something that
   basic must be checked against code before any claim in it is relied on.

**Open — requires a founder decision.**

- **Is `paon-template.html` a demo artifact or the product?** Today the
  repository treats it as both, which is the worst of the options. As a
  demo artifact it should be left alone and never "properly integrated." As
  the product it carries a large, unplanned debt that grows with every hour
  of polish. Answer before any further work on the storefront.
- **Which wedge is actually being sold — the storefront or alterations?**
  The alterations vertical (`highmaintenance`) is the deepest and most
  differentiated thing in this repository and solves an expensive, boring,
  real problem: control over third-party alteration cost. A prettier
  storefront is aesthetic; alteration cost control is financial. Neither has
  been validated with a retailer. Two conversations asking which they would
  pay for would cost nothing and could redirect the entire build.
- **Whether to feature-flag the demo surface down.** `FeatureFlagOverride`
  and entitlements already exist. Using them to hide everything outside the
  demo path would trade breadth for polish. Cheap to do, materially changes
  what a prospect sees.

**Consequences.** Nothing in the codebase changes as a result of this entry;
it records an assessment and four commitments. The two open questions gate
real work — storefront effort should not begin before the template question
is answered, and the wedge question should be tested against live retailers
rather than settled in a document. Items 1 and 2 are infrastructure that
serve the current phase directly and are therefore in scope under
`PHASE.md` despite not being one of the three workstreams; this entry is the
authority for that exception.

## ADR-052: Founder-designed surfaces are ported verbatim; the design-system rule does not apply to them

**Context.** The founder hand-designed the storefront
(`paon-template.html`) and a set of tools (`downloaded_pages/pag1.html`:
fit sliders, silhouette carousel, table service chat, location globe, lapel
configurator, gift-card booklet, house-party orbit, monthly grid). All of
those sources have been committed to this repository the entire time.

Three separate sessions implemented them anyway as Tailwind rewrites:

- `voice-measurement-slider.tsx` — 609 lines, **one** reference to the
  founder's `vox-` class names.
- `silhouette-carousel.tsx` — 186 lines, one reference.
- `swipe-deck.tsx` — 217 lines, **zero** references.

The founder's description: "outputs that didn't remotely look like what I
had made." ADR-048 already recorded this as an open problem and it was not
acted on.

The cause was not missing sources or messy Adobe Muse output. It was this
charter. `CLAUDE.md`'s hard rule — "never duplicate a component, build from
`@paon/ui`" — made rewriting the architecturally correct act. Every session
did the right thing by the charter and destroyed the product's
differentiator doing it.

**Decision.** Founder-designed surfaces are ported byte-for-byte and are a
named exception to the design-system rule.

- Copy the founder's `<style>`, markup and script unchanged into an isolated
  component. The widgets already self-scope by id/class prefix, so they do
  not leak.
- Wire data through the narrowest possible hook — a JSON injection point, a
  submit handler, an initial value.
- Two deviations only, each noted in the component: accessibility fixes this
  repository's lint requires (`<div onClick>` → `<button>`, inline-reset to
  stay visually identical), and removal of hardcoded credentials (the Cesium
  globe embeds a live Ion token, which must move to an environment variable).
- If a surface genuinely cannot be ported verbatim, stop and ask. Do not
  approximate.

`paon-template.html` is confirmed as **the product**, not a demo artifact —
resolving the open question ADR-051 raised. The inventory and per-surface
status live in `docs/DESIGN_PORTS.md`.

**Consequences.** The trade is explicit: these components sit outside the
token system, will not inherit theme changes, and cannot be restyled
centrally. That cost is accepted, because consistency with the design system
is worth less than the design. Three existing components are now recorded as
wrong and must be replaced by real ports rather than patched — patching a
rewrite produces a slightly better rewrite, not the founder's design. Two
further surfaces (`table-service-widget.tsx`, `am-house-hero.tsx`) claim to
be faithful and are unverified.

This ADR does not authorise porting anything. `DESIGN_PORTS.md` notes that
the full inventory is months of work against an objective of three paid
pilots, and that four of the ten surfaces are sales-presentation modules
rather than product. Sequencing remains a founder decision under
`PHASE.md`.

---

## ADR-053: Customer-written tenant-scoped rows must prove both actor identity and tenant identity

**Context.** `wedding_parties` is the first tenant-scoped table in PAON that
an authenticated customer may insert into directly. The initial policy shape
for customer-created wedding parties checked only that
`organizer_customer_id` belonged to `auth.uid()`. That proves who the actor
is, but not that the new row stays inside that actor's tenant. On a table
whose boundary is `retailer_id`, a policy that omits the tenant join allows a
customer to create a row under a different retailer if they can supply that
UUID.

**Decision.** Customer-side `insert` policies on tenant-scoped tables must
prove both facts in the same `with check`:

1. the actor owns the customer/member record being referenced, and
2. that customer/member record belongs to the same tenant as the row being
   inserted (`... and c.retailer_id = <table>.retailer_id`).

For `wedding_parties`, that means the policy checks both
`c.id = wedding_parties.organizer_customer_id` and
`c.retailer_id = wedding_parties.retailer_id`, not either alone.

**Consequences.** This becomes the baseline for every future customer-writable
tenant-scoped table: identity-only checks are insufficient. The rule is cheap
to apply up front and expensive to rediscover after a feature ships, so it is
recorded here as an explicit policy-design requirement rather than left as a
one-off wedding-party fix.

---

## ADR-054: Continuous agent working mode (supersedes stop-and-wait)

**Context.** ADR-era process docs (`WORKING_AGREEMENT.md`, `CLAUDE.md`)
required the session to stop after every reviewable increment so the
founder could confirm before the next began. That fixed a prior failure
mode (21 unpushed commits, 130 uncommitted files, no CI). By 2026-07-28
the founder decided the gate had become the bottleneck: cold outreach
needs the three in-scope workstreams finished, and the founder can
self-verify via push → CI → Vercel rather than click-through between
every change.

**Decision.** Continuous mode inside the PHASE.md scope freeze:

1. Build → self-verify (curl / browser / Playwright against running
   apps) → iterate → commit → push `origin/main` → advance the PHASE
   queue automatically — **all the way until the queue is exhausted or
   only hard blockers remain.**
2. Do **not** stop for founder review, confirmation, or "please check"
   between increments. A "Test it" section is a record, not a gate.
3. Missing founder-only credentials (Stripe, Resend, …) and design-blocked
   ports (e.g. silhouette without a founder-designed mount) are **skip
   and continue**, not session-ending hard stops. Note one line in
   PHASE.md and take the next item.
4. Hard stops that actually wait for the founder: out-of-freeze work;
   ADR conflicts that cannot be recorded as a new ADR; founder surfaces
   that cannot be ported verbatim (ADR-052); destructive irreversible
   production ops beyond documented seed/teardown.
5. Quality bar unchanged: definition-of-done, no silent debt, verbatim
   founder surfaces (ADR-052), tenant RLS, repository pattern.

**Reinforcement (2026-07-29).** The founder again: do not stop between
finished batches and features; hardcode that rule into the controlling
docs. Ending an agent turn after a shipped batch while in-scope PHASE
work remains is a process failure — chain the next item in the same
turn. "Test it" is only for when the queue is exhausted or only hard
blockers remain, never a pause after one batch.

**Restatement (2026-07-29, stronger):** You are **not allowed to stop
until you are REALLY ALL FINISHED** — the active founder request is
complete, the buildable queue has no agent-doable items, only hard
blockers remain, and finished work is pushed. A stale "queue exhausted"
note does not authorize stopping while the founder's latest instruction
still has open follow-through (e.g. back-env aesthetic polish). Closing
on a visual audit verdict without fixing the P0/P1 gaps found is a
process failure. Operational wording lives in `WORKING_AGREEMENT.md`,
`CLAUDE.md`, `AGENTS.md`, and `PHASE.md`.

**Consequences.** Sessions ship more often and must leave the tree clean
after every coherent change. Risk of drift returns if sessions skip
self-verify or leave unpushed work — continuous mode commits _more_
often, not less. `WORKING_AGREEMENT.md`, `CLAUDE.md`, `AGENTS.md`, and
`PHASE.md` carry the operational wording; this ADR is the decision
record.

---

## ADR-055: Party-scoped height/weight on WeddingPartyMember (not CustomerFitProfile)

**Context.** The AM House Party join flow needs self-reported height and
weight so the atelier can pull roughly-right sample garments before a
group fitting. ADR-016 archived the generic customer measurement
aggregate (`CustomerFitProfileEntry`) — fit data belongs on a
`PhysicalGarment` via `FittingObservation`, never on `Customer`. Putting
height/weight on the customer record would reverse that decision.

**Decision.** Store join-flow height (`height_cm`) and weight
(`weight_kg`) on `WeddingPartyMember` only. They are coordination data
for one party, readable in party roster UIs, and superseded the moment a
real fitting observation exists. Do not reintroduce a customer-level
fit profile. Anonymous join photo upload after `join_wedding_party`
uses the service-role client because the joiner has no session and
`party-photos` storage RLS is organizer/staff-only; the invite token
already gated membership creation.

**Consequences.** Orbit and Mission Control can show prep sizes per
member without polluting `Customer`. Any future "my measurements" portal
feature still needs FittingObservation / garment-scoped data, not these
columns.

## ADR-056: Vision documents are destination architecture; PHASE authorizes build

**Context.** PAON’s long-term category is lifelong wardrobe intelligence
(RetailOS plus a customer-side wardrobe advisor loop). Specifying that as
one mega-prompt invites shallow design and, worse, agents treating vision
text as a build queue during the pilot freeze. Discovery Commerce and a
Universal Metadata Graph are only part of the ambition; wardrobe twin,
roadmap, scoring, outfit, advisor, clienteling cockpit, colour, lifecycle
and memory need first-class pillar docs. Separately, storefront category /
colour / pattern / season still come from keyword heuristics in
`apps/customer/app/r/[slug]/route.ts` — that must eventually become graph
data, but not during freeze and not by rewriting founder chrome (ADR-052).

**Decision.**

1. Author and maintain [docs/vision/](./vision/) as the architectural
   destination for wardrobe intelligence (pillars 01–14 + README). Each
   pillar is labeled **not shipped**; entities named there are intended,
   not schema.
2. **[PHASE.md](./PHASE.md) alone authorizes implementation.** Vision docs,
   ROADMAP Horizons A–D, COMPETITIVE_GAPS and PRODUCT “future surfaces”
   never expand the freeze by themselves.
3. **Conflict rule:** if vision docs disagree with code or
   [PROJECT_STATE.md](./PROJECT_STATE.md), code/PROJECT_STATE win — fix the
   vision doc or supersede with a new ADR. Do not invent “shipped”
   systems in vision prose.
4. **Metadata Graph intent:** Horizon A (post-pilot) will displace
   `route.ts` heuristics with concept assignments. Record that intent here;
   do not implement the graph, embeddings, import wizard or advisor under
   this ADR. Do not revive archived customer-level fit profiles (ADR-016 /
   ADR-055) under a wardrobe-twin name without a new ADR. Do not treat
   Collection as Brand.

**Consequences.** Agents may plan against vision pillars after pilot proof
using ROADMAP Horizons; they must refuse to build those pillars while
PHASE freeze is active unless the founder explicitly expands PHASE. Schema
landings still require DOMAIN_MODEL / DATABASE / migration ADR discipline
when PHASE allows.

## ADR-057: Documentation constitution — one authority map, archive contradictions

**Context.** The repository accumulated parallel “constitutions”: a working
tiered `docs/README.md`, Tier 0 charters, vision/, ai_snapshot/, plus root
Made-to-Munro `ROADMAP.md` / `CURRENT_STATE.md` / `AUDIT_LOG.md`, a dead
`prisma/` schema, and archive files without obsolete banners. Agents and
humans could pick the wrong source. ARCHITECTURE omitted real packages
(`ai`, `email`, `payments`, `sms`). DOMAIN_MODEL / DATABASE / PRODUCT implied
persisted `ProductionOrder` / `production_orders` that do not exist in
migrations. Continuous-mode docs disagreed on when to emit “Test it.”

**Decision.**

1. **[docs/README.md](./README.md) is the documentation constitution** —
   authority hierarchy, topic→source table, tiers, classification, archive
   map. Every doc is indexed there or lives under `docs/archive/`.
2. **Authority order:** code/migrations → PHASE → CLAUDE/WORKING_AGREEMENT/
   PRINCIPLES → DECISIONS → product direction → architecture/domain docs →
   ops → vision (destination) → ai_snapshot (as-built) → ROADMAP/gaps →
   PROJECT_STATE (untrusted without verify) → archive.
3. **Archive, don’t delete history:** Made-to-Munro root trackers, unused
   Prisma schema, and `combined_schema.sql` move under `docs/archive/` with
   obsolete banners. Design HTML in `downloaded_pages/` stays (ADR-052).
4. **Drift fixes in place:** ARCHITECTURE lists all packages; ProductionOrder
   documented as domain-only until migrated; “Test it” only when really
   finished (align CLAUDE with WORKING_AGREEMENT).
5. **No second constitution file.** Improve `docs/README.md` rather than
   adding `CONSTITUTION.md`. Do not fork authority into PROJECT_STATE or
   root READMEs beyond pointers.

**Consequences.** Sessions start from PHASE + WORKING_AGREEMENT + docs/
README authority map. Finding Made-to-Munro or Prisma at repo root is a
regression. Future docs must declare design-vs-shipped on line one and take
a single topic owner. ai_snapshot remains dated inventory, not a competing
charter.

## ADR-058: Production deploys via CI Deployments API (not hooks / push alone)

**Context.** All three `paonpaon-*` Vercel projects are Git-linked to
`baszakelijk2020-hash/paonpaon`, but Hobby deploy-on-push is intermittent
(customer/admin often `link.sourceless: true`; GitHub repo webhooks can be
empty). Deploy Hooks accept POSTs with `job.state: PENDING` and never
create deployments — a known Hobby failure mode. Manual CLI deploys work
but share the same `api-deployments-free-per-day` (~100) pool and were
exhausted mid-session. Prospect conversion depends on production URLs
matching `main` after CI is green.

**Decision.** After `verify` succeeds on `main`, CI job `Deploy production`
creates one production deployment per app via `POST /v13/deployments` with
explicit `gitSource` (`github`, repo id, `ref: main`). Secrets:
`VERCEL_TOKEN`, `VERCEL_TEAM_ID`. The Hobby daily-cap error is a CI
**warning**, not a red `main`. Document the runbook in
[DEPLOYMENT.md](./DEPLOYMENT.md). Treat Deploy Hooks as non-authoritative.
Do not spam CLI to “catch up.”

**Consequences.** Production tracks green `main` when quota remains.
Sessions must not assume a push alone updated Vercel. Native GitHub→Vercel
or a plan upgrade remains desirable ops debt; CI is the sellable path until
then. Three deploys per push consume Hobby quota — keep the matrix to these
three apps only.

## ADR-059: Canonical metadata is platform-owned; assignments and review are tenant-bound

**Status: authorized design; implementation begins at PHASE 1.1.**

**Context.** Product discovery currently derives category, color, pattern, and
season from product names, variant color, collection names, and founder image
numbers. The Intelligence Platform needs reusable menswear concepts without
creating either a cross-tenant data leak or an ungoverned tag system. Supplier
facts, retailer judgement, PAON canonical knowledge, and AI inference have
different authority and cannot be flattened into one string.

**Decision.**

1. PAON canonical concepts are platform-owned rows with `retailer_id = null`.
   A retailer may create retailer-owned concepts and presentation overrides but
   cannot mutate the canonical row.
2. Every entity assignment is tenant-bound even when it references a canonical
   concept. Database constraints/RLS must prove that the target belongs to the
   assignment retailer and that a retailer-owned concept belongs to the same
   retailer.
3. Assignments record source, supplier value, confidence/evidence where
   applicable, and `pending | accepted | rejected` review state. Supplier and
   retailer facts may follow an explicit retailer review policy; AI inference
   never bypasses pending review.
4. Exact numeric facts such as grams per metre and composition percentages
   remain typed product facts linked to concepts. Accepted concepts replace
   duplicate descriptive strings; raw supplier input is retained for
   provenance.
5. Unknown values create reviewable proposals. They do not become free-form
   tags or silently expand the canonical taxonomy.

**Consequences.** Canonical knowledge can be reused without sharing retailer
catalogue or customer data. RLS and cross-tenant constraint tests are mandatory
for every metadata table. Review state becomes a dependency for discovery,
facets, imports, and inference; those consumers use accepted assignments only.
`Collection` remains merchandising and is not overloaded as Brand. This ADR
supersedes ADR-056's prohibition on implementing the metadata graph because
`PHASE.md` now explicitly authorizes it; ADR-056's warning that vision prose
alone does not authorize work remains valid.

## ADR-060: Approved metadata gates discovery; retailer presentation overrides canonical knowledge

**Status: authorized design; implementation begins at PHASE 2.1.**

**Context.** PAON needs reusable education cards and grounded advisor answers,
but five generic cards or model-generated product prose would be repetitive,
unverifiable, and commercially unsafe. PAON owns canonical expertise while a
retailer must control local tone, visibility, and sales emphasis.

**Decision.**

1. A knowledge object is eligible only through accepted concept assignments
   and active knowledge-concept links. AI output is not an eligibility source.
2. Precedence is: safety/active/accepted gates; retailer hide and explicit pin;
   retailer presentation/priority override; PAON canonical content and
   priority; deterministic journey, novelty, proximity, and diversity scores.
3. A retailer override changes local presentation and priority without
   mutating canonical content. A hidden object is ineligible for that retailer;
   a pin still must pass safety and accepted-concept gates.
4. Discovery returns three to six results, penalizes already-viewed and
   repeated concept kinds, and includes an explanation of the matched concepts
   and score factors.
5. Grounded AI may summarize or answer from the approved result set, cite its
   basis, and express uncertainty. It may not invent product facts, publish
   knowledge, or outrank a retailer hide.

**Consequences.** Ranking is deterministic and unit-testable before an AI
provider is configured. Retailer autonomy does not fork canonical content.
Storefront integration is a narrow data mount into founder-authored HTML under
ADR-052. Semantic retrieval may later generate candidates, but it cannot bypass
the same eligibility and precedence rules.

## ADR-061: Personalization requires purpose-specific consent and explainable evidence

**Status: authorized design; implementation begins at PHASE 3.1.**

**Context.** ADR-021 created immutable retailer-scoped behavioral signals and
ADR-033 uses a small subset for AI next-best-action. The current event shape has
no purpose/consent snapshot, anonymous-session identifier, retention class,
StyleProfile evidence, or withdrawal behavior. Advisor intelligence and
MorningRoutine cannot safely build on an implicit “event exists, therefore use
it” rule.

**Decision.**

1. Operational records and interaction signals remain separate. Orders,
   appointments, messages, fittings, and other durable business records stay
   authoritative; behavioral events never duplicate them.
2. Personalization consent and marketing consent are distinct, explicit, and
   revocable. Location is a third, separately opt-in purpose and is never
   required for baseline service.
3. New interaction evidence records purpose, consent basis/snapshot, source,
   time, and retention class. Anonymous-session signals may be used only under
   the documented consent basis and are not retroactively linked to a customer
   without authorization.
4. StyleProfile keeps declared preferences separate from inferred
   preferences. Every inference links to concept evidence, source, polarity,
   confidence, and recency; advisors and customers can see why it exists.
5. Advisor views are restricted to the same retailer relationship and to
   consented purposes. Withdrawal stops new personalization and starts the
   documented deletion/anonymization process while legally required commercial
   records remain.

**Consequences.** Existing `behavioral_events` must be upgraded by forward
migration rather than treated as sufficient. Recommendations and advisor briefs
fail closed when consent/evidence is absent. Retention and withdrawal tests are
part of the data model, not deferred privacy copy. This decision narrows
ADR-033: model context must also satisfy consent and evidence rules, not merely
be small and structured.

## ADR-062: Regulated commerce stays provider-hosted and behind a compliance design gate

**Status: boundary decision; no new commerce capability is authorized before
PHASE 6.1 completes.**

**Context.** ADR-030 makes each retailer merchant of record for customer
payments through Stripe Connect direct charges. ADR-031 separates retailer
subscription billing to PAON. ADR-050 designs pricing adjustments and stored
value but is explicitly unimplemented. The Intelligence Platform later needs
deposits, one-click payment, instalments, memberships, service credits, and
possibly stored value; treating those as ordinary feature flags would create
payment, tax, custody, credit, and consumer-protection risk.

**Decision.**

1. PAON does not become a payment processor, lender, stored-card vault, or
   silent merchant of record. Payment credentials remain provider-hosted and
   tokenized.
2. Before implementing a new money capability, PHASE 6.1 must record provider
   support, merchant-of-record, fund custody, VAT/accounting, refund/dispute
   treatment, SCA, consent/retention, supported jurisdictions, and required
   legal review.
3. Stored value is tender/liability, not a discount (ADR-050). Instalments use
   an approved regulated provider; PAON does not implement custom credit.
   One-click payment means reuse of a provider-authorized payment method, never
   storage of raw credentials.
4. Preferred Tailoring/HighMaintenance service plans, entitlements, bookings,
   fulfilment, and care records are domain concepts separate from payments.
   Billing may fund them but does not own their operational state.
5. The retailer-owner marketplace requires a separate catalogue/commerce ADR
   and cannot inherit customer-retail assumptions by convenience.

**Consequences.** Metadata, knowledge, advisor, wardrobe, campaigns, milestones,
and non-payment concierge work can proceed independently. Live provider keys do
not block those stages. Deposits, stored value, instalments, one-click payment,
and new membership billing are real hard blockers until their boundary review
is complete. Existing Stripe code and ADRs remain authoritative where they
already apply.

## ADR-063: Wardrobe ownership is relationship-scoped and does not replace official garment fitting

**Status: authorized design; implementation begins at PHASE 4.1.**

**Context.** PAON already models `PhysicalGarment` as the retailer's
garment-scoped source for official fitting observations, alteration work, and
service history (ADR-016). The Intelligence Platform also needs a customer-
visible wardrobe containing retailer purchases and garments bought elsewhere,
plus self-reported wear, care, condition, and current-fit evidence. Collapsing
those concerns into `Product`, `PhysicalGarment`, or a generic customer body
profile would either contaminate catalogue truth, weaken fitting provenance, or
revive the model rejected by ADR-016/055.

**Decision.**

1. A wardrobe item belongs to exactly one retailer-customer relationship and
   carries both `retailer_id` and `customer_id`. It may optionally reference a
   product, order line, or physical garment, but it is not any of those
   aggregates and never creates a cross-retailer “global wardrobe.”
2. Retailer-purchased and customer-added external garments have explicit
   ownership/provenance. External garment descriptions and metadata assignments
   remain retailer-bound proposals subject to the metadata review rules in
   ADR-059; they cannot mutate canonical taxonomy or create a catalogue product
   implicitly.
3. `PhysicalGarment` and garment-scoped fitting observations remain the source
   of official measured/fitted truth. Customer photos, notes, perceived size
   changes, wear, condition, and care are self-reported wardrobe evidence. They
   may trigger an appointment or alteration handoff but never populate official
   measurements silently.
4. Customers may read/manage wardrobe data for their own linked relationship.
   Authorized retailer staff may collaborate only inside the same retailer.
   RLS and repository tests must deny another retailer, another customer, and
   unlinked portal identities.
5. Wardrobe Roadmaps and outfits reference wardrobe/catalogue items and
   approved knowledge with explanation links. They do not copy product facts,
   fitting observations, or loyalty balances into a parallel source of truth.
6. Lifecycle events with service or audit value are append-only. User-removable
   personalization and legally retained business/service records follow their
   respective consent/retention rules rather than one blanket delete.

**Consequences.** Wardrobe intelligence can include external possessions and
daily-use evidence without weakening PAON's garment-first production boundary.
Fit freshness projects the last official observation while showing
self-reported context separately. MorningRoutine, roadmaps, longevity, and
concierge services share one relationship-scoped wardrobe model, and none may
leak it to another retailer.

## ADR-064: The retailer-owner marketplace is a separate business-commerce context

**Status: boundary decision; implementation is sequenced by PHASE 6.3.**

**Context.** The founder intends a marketplace where retailer owners buy
mannequins, bags, shoe displays, fixtures, furniture, and other store supplies.
Those buyers, products, inventory, tax/shipping assumptions, fulfilment, and
merchant relationships are materially different from a retailer selling
menswear to its customers. Reusing the customer-retail `Product`, `Order`, or
storefront merely because their screens may look familiar would spread invalid
tenant and commerce assumptions through both systems.

**Decision.**

1. The marketplace is a separate bounded context. A PAON retailer participates
   as a business buyer; it is not treated as one of its own customer records.
2. Marketplace listings, categories, inventory, suppliers, carts, orders, and
   fulfilment do not share customer-retail aggregate tables. They may reuse
   context-neutral value objects and infrastructure such as branded IDs,
   `Money`, asset handling, pagination, and provider clients through explicit
   interfaces.
3. Marketplace listings never appear in a retailer's customer catalogue,
   accepted-metadata facets, customer recommendations, StyleProfile, wardrobe,
   campaigns, loyalty, or MorningRoutine. Database constraints, RLS, repository
   contracts, and search tests prove that separation.
4. Marketplace access is authenticated and authorized through a dedicated
   retailer-buyer capability. One retailer cannot see another buyer's orders or
   private commercial data.
5. Merchant-of-record, supplier onboarding, tax, shipping, returns, custody,
   payment flow, jurisdictions, and PAON's commercial role remain explicit
   design-gate decisions. Existing Stripe Connect customer-payment assumptions
   do not authorize marketplace money movement.
6. A visual family resemblance to PAON catalogue surfaces does not authorize
   reuse of founder customer-storefront HTML or customer interaction rules.

**Consequences.** Marketplace implementation can reuse safe platform
primitives without contaminating the customer intelligence programme. PHASE
6.3 remains blocked for money movement and operational claims until the
separate commercial/provider decisions are recorded; no earlier queue item
needs marketplace assumptions.

---

## ADR-065: Tie-Mate follows Hermès Tie Break's try-on discovery model; fabric photos are retailer-fed catalogue assets

**Status: product/tech decision for PHASE 5.4 / TIE-001. Domain deck contract
and interim Customer route `/r/[slug]/tie-mate` are authorized. A later
ADR-052 verbatim founder-HTML port may still replace the interim surface.**

**Context.** PHASE 5.4 paused because no Tie-Mate HTML exists under
`downloaded_pages/`, founder storefront HTML, or docs, while catalogue,
discovery, stock, shortlist, and advisor foundations already shipped. The
founder authorized the product idea by pointing at Hermès Tie Break (2014
iOS/Android app, later discontinued / removed from stores) and stating they
will feed PAON sharp close-up photos of tie fabric.

Public reporting on Tie Break (Fast Company, Out, WWD, LUXUO, Fashion Headline,
AnOther, APK archives) shows it was **not** computer-vision fabric recognition.
Its practical shopping loop was: browse the collection's patterns → enlarge a
pattern to fill the phone screen → hold the phone against a shirt to judge the
match → learn knots / be entertained → buy online. A special tie carried a
barcode that launched the app. PAON's founder brief already asks for the same
practical core: phone-scale fabrics, swipe while holding the phone in front of
oneself, then save, order, or start an advisor conversation on live stock.

**Decision.**

1. Tie-Mate replicates Tie Break's **try-on discovery** behaviour, not CV
   reverse-image search and not Hermès branding/games/comics.
2. Sharp fabric close-ups are **ingest assets** owned by the retailer/founder.
   They land on existing catalogue fields — preferentially
   `products.swatch_image_url` / `Product.swatchImageUrl` (ADR-049) — via
   product management, import, or future admin upload. Customers explore those
   assets; they do not photograph unknown mills to identify stock.
3. The domain owns a pure deck builder (`buildTieMateDeck`) that:
   - includes only active products matching accepted neckwear/tie
     `garment_type` concepts;
   - requires a fabric image (swatch preferred, primary fallback);
   - preserves stock truth (quantity or made-to-order);
   - can pin shortlist/advisor products first;
   - hands off to existing Customer paths (product/order, swipe/wishlist save,
     appointments, messages) without a parallel catalogue.
4. Customer UI originally required an approved founder mobile surface for an
   ADR-052 verbatim port. On 2026-07-30 the founder authorized an **interim**
   Customer route at `/r/[slug]/tie-mate` using existing PAON storefront
   patterns/tokens (not Hermès branding, not invented founder HTML, not
   discontinued Tie Break chrome). This ADR still forbids inventing founder
   HTML, Hermes-branded chrome, generic Tinder restyling of swipe, or a
   second product catalogue. A later founder-HTML port may replace the
   interim surface under ADR-052.
5. Visual embeddings / AI matching are out of scope for TIE-001 unless a later
   ADR explicitly adds a provider-neutral `@paon/ai` port for optional
   similarity search. Tie Break did not need them; PAON's photo assumption is
   content quality for phone-scale preview.

**Consequences.** Agents may ship and extend the Tie-Mate domain/repository
wiring and the founder-authorized interim Customer route. Existing swipe is a
related gesture surface but is not Tie-Mate; Tie-Mate must prefer fabric
close-ups and neckwear stock, not mixed catalogue heroes. A later ADR-052
verbatim founder-HTML port may supersede the interim chrome without changing
the deck/handoff contracts.

## ADR-066: Evidence-cited Self-Portrait and clienteling intelligence

**Status: accepted for Stage 7 / requirement IDs `CLI-001`–`CLI-009`,
`ENG-006`. Independently authorized after Stage 5; does not unlock Stage 6
payment/compliance or marketplace work.**

**Context.** Stages 0–5 shipped catalogue metadata, consented interaction
events, StyleProfile, advisor briefs, wardrobe, MorningRoutine, campaigns,
milestones, concierge operations, and interim Tie-Mate. Stage 6 remains blocked
on founder business/legal/accounting/provider decisions. The founder product
north star now requires turning first-party PAON touchpoints into
evidence-cited Self-Portrait facts, sparse clienteling opportunities, shared
branch calendars, and a deterministic For You experience — without inventing
jurisdiction hard-coding in core derivation logic and without pretending
payment gates are resolved.

**Decision.**

1. **One raw evidence layer.** Interaction/session events and durable business
   records are the only sources of truth. Projectors cite event IDs and durable
   record IDs; they never persist black-box prose as authority.
2. **Four provenance classes.** Customer-declared, advisor-observed,
   transactional, and behaviour-derived inferences remain distinct. An
   inference must never silently become a declared or transactional fact.
   Employer/industry/bonus month are declared-only; salary/bonus are never
   inferred from occupation.
3. **Accepted metadata only.** Pending/rejected concepts cannot drive customer
   conclusions. Negative evidence (skips/dismissals) is preserved separately
   from positive evidence.
4. **Deterministic-first projectors.** Concept affinity, intent acceleration,
   temporal affinity, occasion readiness, wardrobe gap, purchase follow-up,
   dormancy, contact pressure, and data-quality signals are versioned pure
   functions with explicit numerator/denominator, confidence, freshness, low-
   sample suppression, and evidence citations. AI may summarize or rank
   eligible facts; it may not invent them.
5. **Human-reviewable opportunities.** Opportunity hooks are sparse draft
   tasks with why-now, suggested action/channel/time, assignment, cooldown,
   and outcome links. The system does not autonomously spam customers.
6. **Policy as a separate eligibility plane.** Capture, projection, display,
   export, and activation accept typed eligibility decisions. Core domain
   logic must not embed scattered state-law branches. Capability is built
   broadly; jurisdiction/tenant narrowing is configuration later.
7. **Engineering invariants remain non-optional.** Tenant isolation, RLS,
   authentication, provenance, auditability, correction/deletion hooks, field
   masking, and exclusion of passwords/payment/credentials/arbitrary form
   contents are always enforced.

**Consequences.** Stage 7 proceeds independently of Stage 6. Existing
`behavioral_events`, StyleProfile, advisor briefs, appointments, wishlist,
Tie-Mate, and Self-Portrait mounts are extended rather than replaced. Session
IDs and richer event taxonomy land when persistence requires them (7.2+).
Tranche 7.1 ships the first end-to-end cited interest insight over current
events and accepted metadata before introducing a giant schema.

## ADR-067: PAON expands through domain authority and one Mission Control

**Status: accepted for the post-Stage-7 programme / requirement families
`INT-*`, `WRD-1*`, `WFM-*`, `INV-1*`, `CORP-*`, `CMP-1*`, `FIT-1*`, `SRV-1*`,
`NET-1*`, and `KNW-1*`.**

**Context.** Stage 7 completed the evidence-cited customer intelligence loop.
The founder has now explicitly authorized the broader PAON operating-system
destination: workforce Mission Control, barcode/RFID inventory identity,
corporate-fashion programmes, campaign infrastructure, the six-section
digital wardrobe, fit monitoring, services, lifestyle network commerce,
consultancy/training and later B2B procurement/vertical packs. Retailers may
already use Shopify, Faden, factory-owned order systems, payroll/accounting
providers and local operational tools. Requiring replacement at onboarding
would create double entry and prevent adoption; simply adding PAON as another
disconnected tool would fail for the same reason.

**Decision.**

1. PAON supports three modes per domain: Experience Overlay, Co-managed and
   Full PAON. A retailer may combine modes. Replacement is an earned migration
   outcome, not a prerequisite.
2. Every co-system field group has an explicit authority, external identity,
   allowed direction and reconciliation state. "Two-way sync" is not a
   sufficient contract.
3. Employees operate through one PAON Mission Control. External systems appear
   as source state, executable adapter actions or resolved deep-link tasks;
   source-familiar presets change presentation, not canonical semantics.
4. Workforce operations, payroll/tax payout, inventory, production, payment
   and accounting remain distinct authorities. PAON may own scheduling/time
   approval and export an immutable pay-period package without claiming to be
   payroll. It may ingest a Faden read-only API/webhook without claiming
   writable order sync.
5. Barcode/QR and RFID observations resolve to the same auditable inventory
   and custody ledger. RFID is optional acceleration, never a separate stock
   truth.
6. Customer wardrobe, fit candidates, official measurements and physical
   garment/service custody remain separate aggregates under ADR-063. A
   self-scan can trigger review or block a reorder but cannot silently approve
   measurements.
7. Campaigns are versioned executable packages connecting audience, staff
   missions, customer surfaces, channel drafts, operations and outcomes.
   Lifestyle listings, referrals, rewards and B2B marketplace transactions
   retain explicit commercial, attribution and money boundaries.
8. Broad technical modelling remains permitted, but money movement, stored
   value, partner payout and provider claims remain behind ADR-062/064 design
   gates. Tenant isolation, security, evidence, correction and audit are not
   optional configuration.

**Consequences.** `docs/PHASE.md` may authorize the successor build queue.
Initial work prioritizes a visible wardrobe slice plus the source-authority
control plane, workforce approvals, campaign library and stock ledger before
large replacement modules. Target documents must keep target/as-built language
honest. A missing provider write API, payroll account, RFID reader or payment
decision blocks only that activation/live proof; provider-neutral and
independent product work continues.

## ADR-068: Completion requires connected multi-role proof, not landed scaffolding

**Status: accepted for Stage 8.4 and every later PHASE item / requirement IDs
`AUD-001`–`AUD-005`.**

**Context.** The expanded programme has landed material foundations quickly:
six-section wardrobe presentation, source authority, workflow versions,
staged migration, provider fixtures and pinned campaign copies. However,
several PHASE items were checked complete while their own landed descriptions
listed missing acceptance behavior. Examples include migration receipts
without full canonical catalogue/stock/order write-through, adapter fixtures
without a running connector lifecycle, and campaign copies without the
activation-to-outcome loop. Green compilation and unit checks cannot establish
whether the product works logically across roles and modules.

The founder requires PAON to be a real connected operating system, not static
demo surfaces or convincing isolated scaffolding, and does not intend to
manually inspect every tranche.

**Decision.**

1. Programme status uses `target`, `implemented_unverified`,
   `verified_local`, `verified_live`, `blocked_external`, `deferred` and
   `excluded`. A checked PHASE box means verified, not merely implemented.
2. Every applicable tranche records machine-readable evidence for domain
   rules, canonical persistence, service/repository, originating UI, receiving
   UI, RLS/permissions, exception/correction behavior, deterministic browser
   proof, operational recovery and any live-only gap.
3. A validator prevents completion when applicable evidence is absent. Stage
   8.4 establishes the evidence contract, deterministic linked multi-role seed
   and reusable browser harness before the reopened Stage 9/10 items continue.
4. A vertical slice follows:
   `real evidence -> authoritative state -> originating role -> receiving
role -> persisted outcome/exception -> downstream handoff`.
   A receipt, toast, screenshot, component render or fixture returned directly
   to UI is not a complete end-to-end path.
5. UI/UX proof covers role orientation, task continuation, responsive
   operating contexts, accessibility and applicable loading/empty/error/
   denied/stale/conflict/success states. New capabilities compose into role
   homes and shared object pages rather than each becoming a top-level app.
6. Missing live credentials, commercial agreements or hardware may leave
   `verified_live` as `blocked_external` while independently verified local
   work continues. That boundary may not conceal missing local connector,
   workflow or recovery behavior.
7. The source-feature and omission ledger is canonical traceability input.
   Full wedding planning, named customer-data sale, invasive employee
   surveillance, custom payroll/tax, unlicensed money holding and technically
   false measurement claims remain explicit non-goals; wedding-party apparel,
   supplier operations, internal community and instrumented-store capabilities
   are explicitly sequenced targets.
8. Verification is risk-proportionate. Agents reuse one linked seed, run
   focused checks while iterating and full DoD once per tranche. Cross-role and
   authority/stock/money/time/fit flows require browser-plus-database proof;
   pure infrastructure may cite focused proof and its later consumer. Minor
   copy, spacing, secondary-device and rare-state defects may be consolidated
   into a stage-end repair ledger. Data-loss, source-authority, RLS, migration,
   build and primary-flow defects may not be deferred.

**Consequences.** Stage 9.1, 9.2 and 10.1 return to unchecked
`implemented_unverified` status until their listed connected behavior is
proven. Cursor first implements Stage 8.4, then closes those gaps before
building Honeymoon/Seven-Day and later stages. Future green checks remain
necessary but cannot by themselves authorize a completion claim.

## ADR-069: Sequence PAON by relationship proof, with later layers behind gates

**Status: accepted. Supersedes ADR-067 only for sequencing and product
activation; retains its source-authority, integration and domain-boundary
decisions.**

**Context.** The expanded Stage 8–16 programme translated nearly every founder
Mark-II concept into a capability family. This preserved intent but promoted
workforce, POS, corporate fashion, network commerce, advertising, B2B
procurement and vertical packs into one apparent product path before PAON had
established a reliable deployed baseline, a secure production environment, a
complete primary relationship journey or a paying pilot. A visual review of
the founder source also showed that its distinguishing contribution is the
choreography of preparation, composed choice, anticipation and aftercare—not
the number of modules represented in schema.

**Decision.**

1. PAON's current product is the Relationship Operating Layer described in
   `NORTH_STAR.md`: House Memory, Advisor Today, visual wardrobe/composed
   proposals, order/fitting/alteration continuity and aftercare.
2. The release unit is one Golden Relationship Journey from cited evidence to
   human action to persisted outcome. Route, repository, migration or stage
   counts are not product progress measures.
3. Stage 8–16 capability work already landed remains in the codebase and may be
   hardened when required by the golden journey. It does not itself authorize
   completion, navigation exposure or further horizontal expansion.
4. House Operations activate only for a named pilot requirement. Specialist
   products (corporate wardrobes, wedding apparel and other vertical packs)
   require a distinct buyer, proposition and connected proof. Network/media/
   marketplace capabilities require trusted distribution, partner supply,
   legal/commercial decisions and an explicit founder activation gate.
5. PAON integrates commodity authorities before replacing them. A provider
   adapter requires a current written/public contract or real sample payload;
   fixtures must not invent provider signatures, headers or writable APIs.
6. Founder source pages are a design-research corpus. Their reusable
   interaction grammar is translated into accessible product primitives;
   speculative claims, surveillance, brand-specific assumptions and separate
   venture ideas are not copied as requirements.
7. Security, environment truth, upgrade safety, primary e2e, onboarding and a
   real pilot precede the former 9.2 continuation. `PHASE.md` defines the new
   control gate and remains the only queue.

**Consequences.** The former expanded queue becomes a gated option portfolio,
not the immediate conveyor belt. No existing schema is deleted merely for
being early. Navigation and active implementation narrow around role-based
journeys. Strategy documents describe a broad destination and a narrow release
boundary without contradiction.

## ADR-070: Commit to the full modular PAON platform; sequence is not scope

**Status: accepted. Clarifies and supersedes ADR-069 wherever ADR-069 treats
the Golden Relationship Journey as PAON's product boundary or the later
module families as an optional portfolio. ADR-069 remains accepted for its
security, environment, connected-proof, provider-authority and coherent-slice
discipline.**

**Context.** The founder's Atelier Munro and Faden source material was supplied
as a broad intent and interaction-research corpus, not as literal PAON pages,
brand concepts or a request to reduce PAON to the few concepts closest to a
first retailer pilot. The response to overproduction in Stage 8–16
overcorrected: it correctly prioritized environment truth, security and
connected journeys, but wrongly implied that operations, vertical solutions
and ecosystem capabilities were fantasies to be indefinitely gated out.

The founder intends a technically achievable but unusually ambitious platform
whose modules retailers can switch on independently and whose bundles form
commercial tiers. The platform must become greater and more coherent than its
source material through interpretation, not transplantation.

**Decision.**

1. PAON's committed destination comprises the eight module families defined
   in `NORTH_STAR.md`: Platform Core; Client and Relationship Intelligence;
   Wardrobe and Styling Intelligence; Commerce and Growth; Garment and
   Service Operations; Retail Operations; Enterprise and Vertical Solutions;
   and Network and Ecosystem.
2. House Memory -> Advisor Today -> wardrobe/proposal -> order/fitting ->
   aftercare is the shared intelligence spine and first demonstrator. It is
   not the module list, navigation model or ceiling of the product.
3. Modules are tenant entitlements over one platform kernel. They declare
   dependencies, roles, navigation, authority mode, jobs, limits, audit and
   lifecycle state. Plans are commercially editable bundles, not code forks.
4. Delivery is chaptered by technical dependency and connected proof. Later
   chapters are committed roadmap scope even when they are not the active
   coding item. A real pilot validates work continuously but does not hold all
   independent platform development hostage.
5. Gates attach to the risk they control: security and environment gates
   protect live data; money gates protect tender, settlement and stored value;
   provider gates protect integration claims; legal and supply gates protect
   live ecosystem activation. They do not prohibit provider-neutral domain,
   UX, workflow or local verification work.
6. Founder source names, brand structures, claims and page composition are not
   PAON requirements. Agents extract the underlying job, emotional effect,
   service choreography and useful interaction pattern, then design the best
   PAON-native system.
7. Existing Stage 8–16 work is audited and mapped into the modular chapters:
   keep and harden useful primitives, consolidate duplicates, replace false
   abstractions, and delete or quarantine only with evidence. Breadth is not a
   completion claim; every chapter still requires end-to-end proof.

**Consequences.** `PHASE.md` retains an ordered safety and foundation chapter,
then realizes the complete modular programme. The first connected journey
remains urgent because it is the strongest integration test and sales
demonstrator, not because PAON is being narrowed to a CRM/clienteling product.
Commercial activation can remain gated while technical delivery continues on
safe, independent work.

## ADR-071: Founder-specified tools are exact experience and system contracts

**Status: accepted. Supersedes ADR-069 decision 6 and ADR-070 decision 6 where
they classify a founder-specified tool as merely reusable interaction grammar.
Retains their rejection of unsupported claims, invasive data use and literal
Atelier Munro business framing. Extends ADR-052.**

**Context.** The founder supplied the Nebelspiegel corpus for two different
purposes that prior handoffs repeatedly collapsed. The wider branded ventures,
claims and commercial structures are strategy material to interpret for PAON.
But the founder also explicitly designed and selected concrete software tools
over two years and instructed PAON to build how those tools look and behave.
Treating the latter as loose inspiration produced generic Tailwind screens,
domain/schema scaffolds and static visual shells that were then described as
implemented. This was not the requested product.

**Decision.**

1. `downloaded_pages/pag1.html` is the experience authority for its
   founder-specified tools. Pag2 is the experience authority for the groom and
   best-men fitting-planning workflow. Pag3 is the experience authority for
   Preferred Tailoring's weekly calendar-led wardrobe orchestration and
   HighMaintenance care workflow.
2. A tool or workflow explicitly called out for implementation in the founder
   brief or linked-source instructions is also designated. Its source
   composition, spatial hierarchy, motion, pacing and interaction are
   requirements, not optional styling cues.
3. The surrounding Atelier Munro brand, literal catalogue, unsupported claim
   and unrelated venture scope are not automatically PAON requirements. PAON
   may adapt identity, copy and commercial packaging without redesigning the
   designated tool.
4. A designated tool has two simultaneous authorities: the source experience
   and PAON's domain/security architecture. Data enters through narrow hooks;
   permissions, tenant isolation, provenance, persistence, corrections and
   receiving-role continuation remain real PAON behavior.
5. "Built" requires four proofs: source visual/motion parity; real domain and
   persistence; complete originating/receiving role actions; and connected
   browser-plus-database proof including applicable denied, empty, stale,
   conflict and recovery states. A matching table, repository, unit test,
   route, static shell or screenshot proves only its own layer.
6. Existing faithful ports are retained and connected. Generic substitutes are
   replaced rather than cosmetically patched. Missing supplier write access
   may block only that external handoff; it does not park the independent
   fitting, planning, care or PAON workflow.

**Consequences.** `docs/DESIGN_PORTS.md` is the implementation inventory for
designated source tools and must be read before touching them. `PHASE.md`
orders their delivery and connected proof. Strategic curation remains broad
and ambitious, but it can no longer erase an explicit founder experience
contract or call infrastructure the finished tool.

## ADR-072: Cash is a recorded retailer tender, pending founder activation

**Status: proposed operating policy; locally implemented, not authorized for
production or a pilot until the founder accepts it.**

**Context.** The Stage 13 till could not complete a sale because ADR-062
correctly blocks unapproved payment providers. The prior agent exempted cash
on the reasoning that physical notes are not a provider integration. That is
technically coherent but still a commercial and accounting decision; a
blocked card processor cannot silently authorize a different tender policy.
The first implementation also recorded cash, completed the sale and moved
stock in separate requests, allowing partial failure.

**Proposed decision.**

1. Cash is physical tender received by the retailer as merchant of record.
   PAON never holds, settles or lends the funds; it records the retailer's
   opaque till event and its stock consequence.
2. A cash completion uses one deterministic reference per sale and one
   Postgres transaction for tender, state finality, reservation release and
   sale movements. Retries reconcile to the same event.
3. Cash never weakens ADR-062: card details remain forbidden and every
   provider-hosted payment remains blocked until its own compliance design is
   accepted.
4. Local proof does not make the till production-ready. Receipt/fiscal rules,
   VAT/accounting export, cash drawer opening/closing, change, till variance,
   refunds and jurisdiction-specific obligations must be assigned before a
   real pilot activates cash.

**Consequences.** The locally proven cash path remains available for product
integration and demos. Production entitlements must keep it off until founder
acceptance and the operational checklist above are recorded. If the founder
rejects cash, the same atomic completion boundary remains and a later approved
provider supplies the tender event.

## ADR-073: Ratify a non-lossy founder product control plane

**Status: accepted. Clarifies the authority relationship among the founder
brief, the curated PAON destination, exact designated source tools, the work
queue and factual implementation. Extends ADR-070/071.**

**Context.** Repeated model handoffs produced opposite forms of drift. Some
sessions treated the Nebelspiegel/Atelier material literally and risked
copying a different business into PAON. Others treated two years of explicitly
specified tools as loose inspiration, substituted generic interfaces or
domain scaffolds, and reported those foundations as built. A large raw prompt
is valuable non-lossy memory but is too ambiguous to be a routine work queue;
a concise plan without the raw source can quietly erase ambition. Chat history
cannot be the only place that resolves the difference.

**Decision.**

1. `NORTH_STAR.md`, `FOUNDER_TOOL_BLUEPRINTS.md` and `DESIGN_PORTS.md` form the
   ratified PAON product contract. They curate the preserved founder input into
   the PAON company, exact designated experiences, system jobs, decision
   rights and completion proof.
2. `PAON_FOUNDER_INTELLIGENCE_BRIEF.md`, linked instructions and committed
   founder HTML remain non-lossy source evidence. They cannot become a second
   queue or automatically reinstate brand framing, unrelated ventures or
   unsupported claims. The exact interaction regions designated by ADR-071
   remain experience authority and may not be weakened by curation.
3. `PHASE.md` is the sole delivery queue. Sequencing a capability later never
   deletes it from the destination. An agent may decompose the active contract
   into safe coherent slices but may not remove or materially reinterpret a
   founder-owned element.
4. Code and executable proof decide only what currently exists. They do not
   acquire product authority by being implemented first. Every founder-tool
   slice must declare identity/source, effect, PAON job, actors/continuation,
   canonical objects, modules, trust, state/recovery, exactness boundary,
   connected proof and explicit remaining gaps.
5. Founder-owned changes require an explicit founder decision and a dated ADR.
   Engineering owns internal decomposition and technical mechanisms inside the
   contract. Missing answers that would change founder-owned scope block only
   that decision; safe independent queue work continues.
6. Completion is evaluated across experience, function, canonical continuity,
   trust, recovery, outcome and operability. An inert source control, generic
   substitute, disconnected role, shadow aggregate, old-SHA proof or omitted
   known gap invalidates the completion claim.
7. Each founder-tool and chapter transition performs a targeted contract-to-
   source-to-code-to-proof check. Ordinary turns use the minimum context path;
   they do not repeatedly reread the full corpus.

**Consequences.** Future builders receive enough context to preserve intent
without spending an entire session rediscovering it. The founder can change
the product, but models cannot do so silently. Ambition remains broad; delivery
remains dependency-ordered; current status remains falsifiable. No additional
roadmap or handoff document is created.
