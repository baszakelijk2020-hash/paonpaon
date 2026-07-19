# Project State

Living status of the build. Update this file as part of every vertical
slice — a future session (human or AI) should be able to read this one
document and know exactly what exists, what's next, and why, without
re-deriving it from git history. See [ROADMAP.md](./ROADMAP.md) for the
phase-level plan this fits into.

## Where we are

**Phase 0 (engineering foundation): done. Phase 1 (Identity, Retailer,
Customer core): done. Phase 2 (Catalog and Commerce): catalog, storefront
and order placement/management shipped — payment integration is the
one thing left, blocked on a provider decision + external credentials,
not on anything technical. Phase 3 (Production, Alteration,
Appointments): Appointments and Alteration foundations + Customer Fit
Profile shipped — `ProductionOrder` tracking and any supplier/
manufacturing connector are not started.** All three apps have real
auth; retailer onboarding is complete end to end; Customer identity is
in place; Retailer Portal can author a full catalog, manage orders,
run an appointment calendar, and track alterations; Customer Portal has
a public storefront/checkout and can request appointments and see
alteration status. See "Not yet built" below.

### Shipped: PAON Admin — platform auth + retailer onboarding

A PAON platform operator signs in to PAON Admin (`/login`, email +
password) and onboards a new retailer end to end: `/retailers` lists
tenants; `/retailers/new` creates one **and** invites its first owner
(`role: "owner"`) in the same submission, `redirectTo`-ing the invite at
Retailer Portal's `/auth/confirm` — see `docs/DECISIONS.md` ADR-009.
`/retailers/[id]` shows the tenant and its staff with an Invited/Active
badge. `middleware.ts` protects every route and rejects any signed-in
user who isn't platform staff.

**Known gap, not fixed, out of scope for every slice so far:** PAON
Admin's own platform-staff invites (`bootstrap-platform-admin.ts`) have
**no accept-invite landing page** — no `/auth/confirm` or
`/accept-invite` route in `apps/admin`. A platform-staff invite email
has nowhere correct to send the invitee. Fix by replicating the exact
`/auth/confirm` + `/accept-invite` shape below (same pattern, no new
design) plus an `accept_platform_staff_invite` RPC and a
`PlatformStaffRepository.acceptInvite` method, **before** building any
"invite another platform admin" UI in PAON Admin.

### Shipped: Retailer Portal — invite acceptance + operational workspace

- **Accept invite**: emailed link → `/auth/confirm` (Route Handler,
  `verifyOtp`) → `/accept-invite` (set password, then call
  `accept_retailer_staff_invite` via
  `RetailerStaffRepository.acceptInvite`) — sets `accepted_at` and, for
  the owner on a `pending_onboarding` retailer, activates it. See ADR-012.
- **Auth wiring**: `apps/retailer` has its own `middleware.ts`,
  `lib/session.ts`, `lib/supabase-server.ts`, `lib/supabase-admin.ts`,
  `lib/env.ts` (same pattern as `apps/admin`, not shared — see
  "duplication risk" below). `requireSession()` also redirects to
  `/accept-invite` if the caller's staff record hasn't accepted yet (a
  DB check, not a JWT claim — see ADR-012's context).
- **`/dashboard`**: retailer name/status/tier, team headcount.
- **`/staff`, `/staff/new`**: owner/admin only, both nav and route
  gated. Invites additional staff the same way PAON Admin invites the
  first owner. **Cannot grant `"owner"`** —
  `INVITABLE_RETAILER_ROLES` (`@paon/domain`) excludes it, and
  `20260719000006_*` adds a matching `as restrictive` DB policy (an
  "admin" could otherwise self-grant ownership through the existing
  "manage their retailer's staff" policy).
- **`/settings`**: owner/admin only. Business-profile fields only —
  `slug`/`tier`/`status`/`defaultCurrency` stay platform-controlled,
  enforced by a `before update` trigger
  (`enforce_retailer_staff_editable_columns`, `20260719000005_*`), not
  just by which fields the form exposes.
- **`/customers`, `/customers/new`, `/customers/[id]`**: `sales_associate`+
  (CRM data entry is frontline, not admin-only). Creates a per-retailer
  `Customer` CRM record — see the Customer identity section below for
  how it later links to a Customer Portal login.

### Shipped: Customer identity foundation

A Customer Portal login is fundamentally different from staff auth: it's
self-serve and passwordless (`docs/PRODUCT.md`), and one login can hold
**many** simultaneous per-retailer `Customer` relationships (never a
single tenant, unlike staff) — see `docs/DOMAIN_MODEL.md` "Why a
Customer is scoped to one Retailer" and `docs/DECISIONS.md` ADR-013 for
the full reasoning this section assumes.

- **`CustomerRepository`** (`@paon/database`): `findById`,
  `findByRetailer`, `findByUserId` (every `Customer` row linked to one
  Customer Portal login, across retailers), `create`, `linkMyAccounts`
  (calls the RPC below).
- **`customers` table** (`20260719000007_*`): per-retailer CRM record.
  RLS: platform staff full access; any retailer staff role can read
  their retailer's customers (the exact worked example in
  `docs/DATABASE.md`); `sales_associate`+ can write; a customer reads
  their own linked row(s) via `user_id = auth.uid()` **directly** — no
  JWT claim, because (per ADR-013) there's no single tenant to mirror.
- **`customer_account_links` table + `link_my_customer_accounts()` RPC**
  (`20260719000008_*`): the RPC is called once per Customer Portal
  session (from `/auth/confirm`, right after `verifyOtp`) — idempotent,
  links every still-`user_id`-null `customers` row matching the caller's
  own verified email to `auth.uid()`, and records the link. A `security
definer` RPC re-deriving its own authority, same shape as ADR-012 —
  not an invite flow, because there's no retailer- or admin-issued
  invite to accept on this path.
- **Customer Portal (`apps/customer`) auth wiring**: same
  `middleware.ts`/`lib/*` shape as `apps/retailer`, adapted —
  `/login` collects an email and calls `signInWithOtp`
  (`emailRedirectTo` → this app's own `/auth/confirm`), showing a "check
  your email" state via `useActionState`, never a password field.
  `requireCustomerSession` (new in `@paon/auth`) is the guard —
  simpler than `requireRetailerSession`: valid the instant the session
  exists, no further claim to check, since which relationships exist is
  resolved per-request from `CustomerRepository`, not from a session-wide
  claim.
- **`/dashboard`**: lists the signed-in shopper's linked retailer
  relationships (`CustomerRepository.findByUserId` + `RetailerRepository.findById`
  per relationship — reading an arbitrary `retailers` row by id needed a
  new customer-facing RLS policy on `retailers` too, added in the same
  migration). Zero relationships is a real, valid, designed-for state
  (empty-state copy, not an error) — there's no storefront yet to create
  one organically.
- **Deliberately not built yet**: `Wishlist` and `CustomerPreferences`
  persistence — domain types exist, no tables. No profile-editing UI in
  Customer Portal. No OAuth provider (Google/Apple) — passwordless email
  is the only login method; OAuth needs external provider credentials
  this session doesn't have, so it's flagged, not silently skipped or
  faked. Pick up when either becomes the next highest-value slice.

### Shipped: Product Catalogue foundation

- **`CollectionRepository`, `ProductRepository`, `ProductVariantRepository`**
  (`@paon/database`) — standard create/find shape, matching every prior
  repository. `ProductRepository` additionally resolves
  `Product.collectionIds` (required, never optional, on the domain
  type) from the `product_collections` join table
  (`collectionIdsByProduct`, batched for `findByRetailer`'s list case)
  — `Product`/`ProductVariant` carry no `retailerId ` of their own in
  `@paon/domain` (only `Product.retailerId` — variants and the
  collection join relate through it), so their RLS policies
  (`20260719000010_*`, `20260719000011_*`) scope through `products` via
  an `exists (select 1 from products where …)` subquery rather than a
  denormalized column, mirroring the domain model's own ownership shape
  exactly instead of adding a DB-only field the entity doesn't have.
- **`products`, `product_variants`, `collections`, `product_collections`
  tables** (`20260719000009_*`–`20260719000011_*`). RLS: platform full
  access; any retailer staff role reads; **`manager`+ writes** — a
  stricter gate than `customers`' `sales_associate`+, since catalog
  authoring is managerial, CRM data entry is frontline (see
  `docs/PRODUCT.md` "Retailer Portal").
- **Retailer Portal `/products`, `/products/new`, `/products/[id]`,
  `/collections`** (all `manager`+, nav + route gated). Creating a
  product also creates its first variant in the same submission — a
  `Product` is never sold at its own price (`@paon/domain`
  `catalog/product.ts`), so a product with zero variants is a useless
  intermediate state, the same reasoning ADR-009 applies to retailer
  creation folding in the first owner invite. `Money` is stored as two
  split columns (`*_amount_minor_units` + `*_currency`) per variant
  price field, matching `shared/money.ts`'s "never a float" value
  object shape exactly — `ProductVariantRepository` is the only place
  that (de)composes it.
- **Deliberately not built yet**: editing a product/variant after
  creation (only create + list + detail so far); assigning a product to
  a collection (the join table and its RLS exist; no UI writes to it
  yet — `product_collections` is currently read-only from the app's
  perspective); image upload (`primaryImageUrl` is a plain URL column,
  no Supabase Storage wiring). Pick these up if they become the next
  highest-value slice — likely once storefront browsing (next) makes
  them visibly necessary rather than adding them speculatively now.

### Shipped: Commerce foundation

Two decisions here were put to the human operator rather than guessed
— routing scheme for reaching a retailer's storefront, and whether an
`Order` may exist before any payment provider is integrated (none is).
Both decisions and the full reasoning are in `docs/DECISIONS.md`
ADR-014; this section covers only what got built as a result.

- **Storefront routing is path-based**: `apps/customer/app/r/[slug]/...`.
  `/r/[slug]` redirects to `/r/[slug]/products`; `/r/[slug]/products/[productSlug]`
  is the buy page. Both are genuinely public — `apps/customer/middleware.ts`
  never gates the `/r/` prefix behind a session, and never signs an
  existing session out just for visiting it (unlike every protected
  path in that app).
- **`retailers`/`products`/`product_variants` gain a public `select`
  policy** (`20260719000013_*`) — the first policies in the schema with
  no `to` clause, so they apply to `anon` too, scoped to `status =
'active'` rows only. Flipping a product/retailer out of `active`
  removes it from public visibility immediately, with no separate
  "unpublish" step.
- **`OrderStatus` gained `"pending_payment"`** (`@paon/domain`
  `commerce/order.ts`) — sits between `"draft"` (still reserved, for a
  future persisted cart — nothing creates one) and `"placed"`
  (unreachable until payment integration exists to drive it). Every
  order created today starts and stays at `"pending_payment"` unless a
  retailer manually moves it (see below).
- **`place_order(retailer_id, variant_id, quantity)`** (`20260719000012_*`,
  `OrderRepository.placeOrder`) is the only way an `Order`/`OrderLine`
  is created — no client-facing insert policy on either table, same
  "narrow RPC over broadened policy" shape as ADR-012/013. Re-derives
  price and inventory from the variant row server-side; decrements
  `product_variants.inventory_quantity` (skipped for made-to-order
  variants — nothing to decrement); creates the caller's `Customer` row
  on the spot, already linked, if this is their first purchase from
  that retailer (no need for the separate email-matching
  `link_my_customer_accounts` path here — both `retailer_id` and
  `auth.uid()` are already known). Also the first place in the schema
  where a client call needs two tables written transactionally — a
  `security definer` PL/pgSQL function is how this repository gets a
  transaction at all, since neither PostgREST nor supabase-js exposes
  multi-statement transactions to application code. Granted to
  `service_role` as well as `authenticated`, specifically so e2e
  fixtures (and future internal tooling) can seed real orders without a
  real customer session — see both apps' `e2e/global-setup.ts`.
- **Customer Portal `/orders`, `/orders/[id]`**: a signed-in shopper's
  order history across every linked retailer relationship
  (`CustomerRepository.findByUserId` → `OrderRepository.findByCustomer`
  per customer row, same fan-out shape as the dashboard's relationship
  list).
- **Retailer Portal `/orders`, `/orders/[id]`**: any retailer staff role
  can read; **`production_staff`+ can update status**
  (`OrderRepository.updateStatus`) — a looser gate than `customers`'
  `sales_associate`+ or `products`' `manager`+, because fulfillment is
  its own operational concern, closer to `production_staff`'s job than
  to CRM or catalog authoring. No transition validation yet — any
  `production_staff`+ session can set any status in any order. Add a
  state-machine check (e.g. can't go `delivered` → `pending_payment`)
  if that turns out to matter before payment integration forces a
  proper state machine anyway.
- **Deliberately not built yet**: shipping address collection (checkout
  never asks for one — `Order.shippingAddress` stays unset); a
  persisted multi-item cart (checkout is buy-now, one variant at a
  time — `OrderStatus.draft` is reserved for exactly this, not built);
  tax/shipping calculation (`subtotal` and `total` are currently
  identical); assigning a product to a collection from the storefront
  (browsing doesn't filter by collection); redirect-back-to-product
  after signing in mid-checkout (the "Sign in to purchase" link goes to
  `/login` with a `redirectTo` query param the login page doesn't
  currently act on — a customer who signs in mid-checkout has to
  navigate back to the product manually). None of these are silent gaps
  — each is a real, scoped-out piece of "Commerce foundation," not an
  oversight.

### Not yet built (Phase 2 — Catalog and Commerce, continued)

1. Payment provider integration — the provider itself is an open
   decision (needs its own ADR once made, per `docs/DECISIONS.md`'s own
   convention) and needs external credentials (a payment provider
   account) this environment doesn't have — flag this explicitly when
   reached rather than guessing a provider or faking a working
   integration. This is the one piece of Phase 2 not shipped.

### Shipped: Appointments, Fit Profile and Alteration foundations (Phase 3)

Full reasoning in `docs/DECISIONS.md` ADR-015; this section covers what
got built. PAON stays retailer-first/customer-first per
`docs/NORTH_STAR.md` — none of this reaches toward owning
manufacturing; that stays a future connector's job (GoCreate or
similar), never PAON's core model.

- **`availability_windows`, `appointments` tables + `request_appointment`
  RPC** (`20260719000014_*`–`20260719000015_*`). A staff member manages
  their own recurring schedule; `manager`+ manages anyone's (no
  `current_staff_id()` JWT claim exists, so this is an `exists` subquery
  against `retailer_staff_members`, not a claim comparison).
  `request_appointment` mirrors `place_order`: creates the caller's
  `Customer` row on the spot if this is their first interaction with
  the retailer. No slot-conflict prevention at request time — retailer
  staff resolve overlaps when confirming.
- **Retailer Portal `/appointments`, `/appointments/[id]`,
  `/appointments/new`, `/appointments/availability`**: any staff role
  reads; `sales_associate`+ books/manages/assigns. The detail page
  surfaces the customer's current fit profile before the appointment
  (`docs/PRODUCT.md`'s "view customer profile before appointment").
- **Customer Portal `/r/[slug]/appointments`** (public — browsing/
  requesting needs no sign-in until submission, same pattern as
  checkout's "Sign in to purchase") and `(dashboard)/appointments`,
  `/appointments/[id]` (the signed-in shopper's own history across every
  retailer relationship, same fan-out shape as `/orders`). **No live
  slot picker** — `computeAvailableSlots` (`@paon/domain`) exists and is
  used nowhere in Customer Portal yet, because exposing real
  availability to an anonymous browser would require a new
  privacy-safe read surface this slice didn't need to build (see
  ADR-015 point 7 for the exact reasoning and what building it later
  looks like).
- **`customer_fit_profile_entries` table** (`20260719000016_*`),
  `CustomerFitProfileRepository`. Append-only — "current" is the most
  recent row per customer, no separate mutable "profile" row to drift
  out of sync. `sales_associate`+ record entries (same gate as CRM data
  entry); any staff role reads; a customer reads their own. Surfaced on
  the Retailer Portal customer detail page (`/customers/[id]`, new "Fit
  profile" section) and on the appointment detail page.
- **`alterations`, `alteration_updates` tables** (`20260719000017_*`–
  `20260719000018_*`), `AlterationRepository`, `AlterationUpdateRepository`.
  `alterations.status` is denormalized from the append-only
  `alteration_updates` log by a trigger
  (`sync_alteration_status_on_update_insert`) — a second trigger
  (`enforce_alteration_status_via_updates_only`) blocks any direct
  client `UPDATE` of `status`, so the two can never drift apart no
  matter what future code path writes an update. Creating/editing the
  request itself is `sales_associate`+; adding status/progress updates
  is `production_staff`+ (mirrors the orders fulfillment gate — this is
  the actual alteration work, not CRM or booking).
- **`AlterationStatus` gained `ready_for_pickup`** and
  `Alteration.customerId` is now required (previously only reachable
  transitively through an optional `orderLineId`, which a standalone
  alteration on a past purchase might not have — see ADR-015 point 1).
- **Retailer Portal `/alterations`, `/alterations/new`,
  `/alterations/[id]`**; **Customer Portal `(dashboard)/alterations`,
  `/alterations/[id]`** with a "ready for pickup" banner when that's the
  current status.
- **Deliberately not built yet**: `ProductionOrder` tracking (next, per
  ROADMAP.md — reuse the alteration append-only-log shape, don't
  redesign); attaching an alteration to a specific order line has no UI
  picker (the field exists and works, just no cascading
  customer→orders→order-lines selector yet — see ADR-015 point 9); a
  `Location` entity (still deferred from Phase 1 — "select
  retailer/location" means selecting the retailer here, via `/r/[slug]`
  routing); any supplier/manufacturing connector (GoCreate or similar)
  — not started, nothing to connect to yet.

## Environment constraints every session so far has hit

- **No Docker daemon available in the sandbox any of this was built
  in.** `supabase start` could not be run locally, so:
  - Every migration and RLS policy (19 files now, `20260719000000`–
    `20260719000018`) was written and reviewed by hand, never executed
    against a live Postgres instance.
  - `packages/database/src/generated/database.types.ts` is hand-
    maintained (see its own header comment), not `supabase gen types`
    output. **Run `pnpm --filter @paon/database generate-types` against
    a real local instance and diff it against the hand-written version
    at the first opportunity** — still the single highest-value
    verification gap. Riskiest SQL in the schema, in order:
    `place_order` (`20260719000012_*`) is the first `security definer`
    function that writes to _two_ tables transactionally from a
    genuinely untrusted context (any signed-in customer) — verify the
    inventory-decrement and customer-linking logic first. Close behind:
    the `enforce_alteration_status_via_updates_only` /
    `sync_alteration_status_on_update_insert` trigger pair
    (`20260719000017_*`–`20260719000018_*`) — two triggers on two
    tables cooperating to keep one column in sync is the most elaborate
    trigger interaction in the schema so far, and it's exactly the kind
    of thing that's easy to get subtly wrong in ways only a real
    Postgres instance would catch (e.g. trigger firing order, whether
    `current_user <> session_user` actually holds the way reasoned).
  - The Playwright e2e specs across all three apps were written and
    typecheck but were never executed locally — they need a live
    Supabase instance (`e2e/global-setup.ts` per app). They run in CI
    (`.github/workflows/ci.yml` `e2e` job, which has Docker) but have
    not been observed passing yet. Treat the first CI run as the real
    verification. Highest-risk SQL to check first if something fails:
    (a) the `auth.role()`/`current_user <> session_user` trigger logic
    in `20260719000005_*` (retailer settings self-service), (b) the
    `link_my_customer_accounts` RPC's interaction with the new
    `customers`/`customer_account_links` RLS policies (Customer Portal
    login test), (c) `place_order`'s inventory decrement + the public
    `anon`-visible policies in `20260719000013_*` (storefront browsing
    test) — all hand-reasoned from documented Postgres/Supabase
    semantics, not observed.
  - `apps/retailer/e2e/accept-invite.spec.ts` and
    `apps/customer/e2e/login.spec.ts` both exercise their real
    `/auth/confirm` route with a real token from
    `admin.auth.admin.generateLink` (not a workaround password, not
    reading Inbucket) — this is now the standard technique for
    e2e-testing any future email-link flow in this repo; reuse it.
  - What _was_ verified locally, repeatedly, and is trustworthy:
    `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit), `pnpm build`,
    `pnpm format:check` — all green across every package and app as of
    this slice.
- **No live Supabase project.** `.env.local` was never created in any
  app. To actually run the apps: `supabase start`, copy its printed
  `API URL`/`anon key`/`service_role key` into each app's `.env.local`
  per its `.env.example` — admin needs `NEXT_PUBLIC_RETAILER_APP_URL`,
  retailer and customer each need their own `NEXT_PUBLIC_APP_URL` — then
  `pnpm --filter @paon/database bootstrap:platform-admin` to create the
  first PAON Admin login before `pnpm dev`.

## Conventions established across slices (reuse, don't reinvent)

- **Email-link flow, reusable by any future app/subject**: (1) a
  `security definer` RPC (`accept_<subject>_invite`, or
  `link_my_<subject>` for a non-invite self-link) that re-derives its
  own authority from `auth.uid()`/`auth.jwt()`, never a client-supplied
  id; (2) a `/auth/confirm` Route Handler calling `verifyOtp` against a
  `token_hash`+`type` from a **custom** Supabase email template
  (`supabase/templates/*.html`, using `{{ .RedirectTo }}` — set
  per-call via `redirectTo`/`emailRedirectTo` — never the fixed
  `{{ .SiteURL }}`, since different subjects land on different apps);
  (3) whatever page that redirects to. `apps/admin` doesn't have this
  yet for platform staff — see "Known gap" above.
- **`security definer` RPC over a broadened RLS policy** for any narrow
  state transition a caller triggers about themselves (accept, activate,
  link) — see ADR-012, ADR-013, `docs/DATABASE.md` "Row Level Security".
- **An identity that can hold many simultaneous tenant relationships
  reads its own rows via `auth.uid()` directly, not a JWT claim** — see
  ADR-013. Only extend the JWT-claim-mirroring pattern
  (`sync_retailer_staff_claim`-style) to an identity that belongs to
  exactly one tenant per session.
- **`as restrictive` policy to narrow one command on an existing
  permissive policy**, instead of rewriting the permissive one.
- **`before update` trigger for column-level write protection** — `WITH
CHECK` never sees the pre-update row.
- **`PaonSupabaseClient`** (`packages/database/src/client-type.ts`) is
  the only type every repository/client factory should use — ADR-010.
- **`stripUndefined`** (`@paon/utils`) at the Server Action boundary,
  right after parsing a zod schema — ADR-011.
- **Server Action forms use `useActionState`** with a `{ values,
fieldErrors, formError }` shape (a `sent`/`success` flag added where a
  form doesn't redirect on success — see Customer Portal's login form,
  Retailer Portal's settings form). The template for every form in every
  app.
- **Never import a type from `@supabase/supabase-js` directly outside
  `@paon/database`** — only that package lists it as a real dependency
  (pnpm strict linking, ADR-001). Use a local literal type instead — see
  any app's `auth/confirm/route.ts`.
- **App-local auth scaffold, not a shared package, even now that all
  three apps have one.** Each of `apps/admin`, `apps/retailer`,
  `apps/customer` has its own `middleware.ts`/`lib/session.ts` — still
  not extracted into `@paon/auth`, because all three genuinely differ
  (public paths, post-login redirect, retailer's accept-invite check,
  customer's simpler no-extra-claim guard). Three copies now exist with
  real, load-bearing differences between each — that's a _stronger_
  signal to keep them app-local than to extract, not a trigger to
  extract "because there are three." Only extract if a **fourth**
  consumer needs the identical shape with no variance, or if a future
  refactor removes today's differences.
- **Need two tables written transactionally from one client call?** A
  `security definer` PL/pgSQL function is how this repository gets a
  real transaction — PostgREST/supabase-js expose no multi-statement
  transaction to application code. See `place_order`
  (`20260719000012_*`) — same "narrow RPC" shape as
  ADR-012/013, just also transactional.
- **A table anyone (even `anon`) may read a subset of**: add a `select`
  policy with **no `to` clause**, scoped tightly to the publicly-safe
  rows (`status = 'active'`, etc.) — see `20260719000013_*`. This is
  additive to whatever narrower policies already exist for
  `authenticated`/staff roles; it never has to touch them.
- **Grant a `security definer` RPC to `service_role` too** when e2e
  fixtures (or future internal tooling) legitimately need to call it
  without a real end-user session — see `place_order`'s grant and both
  apps' `e2e/global-setup.ts`. Never do this for a table's RLS
  policies, only for a function whose own body re-derives everything it
  needs and doesn't blindly trust `auth.uid()` being present.
- **A status that must only change through its own history log**: make
  the log table append-only (insert-only policies, no update/delete for
  any non-platform role) and add a trigger pair — one `after insert`
  trigger on the log that updates the parent's denormalized `status`
  column, one `before update` trigger on the parent that rejects any
  direct client write to that column (same `current_user <>
session_user` / `auth.role() = 'service_role'` check as
  `enforce_retailer_staff_editable_columns`, ADR-012). See
  `alterations`/`alteration_updates` (ADR-015) for the reference shape
  — reuse it for `ProductionOrder` next, don't redesign.
- **"Self, or a more senior role" RLS**, when there's no JWT claim for
  "my own row id" (unlike `current_retailer_id()`): an `exists`
  subquery against the owning table (`retailer_staff_members` in this
  case) comparing `user_id = auth.uid()`, `or`'d with the senior-role
  check. See `availability_windows`' policy (ADR-015) — the same shape
  as a customer's own-row read (ADR-013), applied to staff.
- **Testing an email-link flow**: use `admin.auth.admin.generateLink()`
  to get a real `token_hash`, then `page.goto('/auth/confirm?token_hash=...&type=...')`
  directly — exercises the real route, no Inbucket parsing needed. See
  `apps/retailer/e2e/accept-invite.spec.ts`,
  `apps/customer/e2e/login.spec.ts`, `apps/customer/e2e/appointments-alterations.spec.ts`.
