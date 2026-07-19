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
