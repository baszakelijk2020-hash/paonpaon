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
Appointments): Appointments plus the production-ready garment-first
Alterations vertical slice shipped — connector-facing `ProductionOrder`
tracking and supplier/manufacturing connectors are not started.** All three apps have real
auth; retailer onboarding is complete end to end; Customer identity is
in place; Retailer Portal can author a full catalog, manage orders,
run an appointment calendar, and track alterations; Customer Portal has
a public storefront/checkout and can request appointments and see
alteration status. See "Not yet built" below.

### Shipped: Behavioral analytics foundation

- Immutable retailer-scoped `behavioral_events`, captured only through a narrow
  identity-rederiving RPC and readable by manager-level staff or platform staff.
- Retailer Portal `/analytics` shows real 30-day revenue, orders, customers,
  appointments, alteration workload, event attendance, messages and captured
  experience signals. Metrics aggregate authoritative source tables rather than
  copying business records into an analytics shadow model (ADR-021).
- AI-generated recommendations remain deliberately unimplemented until a real
  model/provider is configured; analytics work does not pretend deterministic
  counts are AI.
- PAON Admin `/analytics` provides cross-retailer adoption and operational
  metrics behind platform-staff authorization. Cross-currency GMV is explicitly
  directional until a currency conversion policy exists.

### Shipped: PAON Admin — platform auth + retailer onboarding

A PAON platform operator signs in to PAON Admin (`/login`, email +
password) and onboards a new retailer end to end: `/retailers` lists
tenants; `/retailers/new` creates one **and** invites its first owner
(`role: "owner"`) in the same submission, `redirectTo`-ing the invite at
Retailer Portal's `/auth/confirm` — see `docs/DECISIONS.md` ADR-009.
`/retailers/[id]` shows the tenant and its staff with an Invited/Active
badge. `middleware.ts` protects every route and rejects any signed-in
user who isn't platform staff.

PAON Admin platform-staff invitations now have the same complete acceptance
journey as retailer staff: invite email → `/auth/confirm` → password setup at
`/accept-invite` → accepted membership. Existing platform operators were
forward-migrated as accepted; new operators cannot browse PAON Admin before
finishing setup.

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
- Product and variant editing is complete from `/products/[id]`, including
  publishing status, merchandising flags, hosted image URL, price, inventory,
  lead time and collection assignment. Product metadata and collection
  membership update in one tenant-revalidating transaction. Direct image upload
  remains deferred; the hosted URL field is validated until Storage is added.

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
  `commerce/order.ts`) — sits between `"draft"` (now a real, customer-owned
  persisted cart — see below) and `"placed"` (unreachable until payment
  integration exists to drive it). Every order reaching `"pending_payment"`
  stays there unless a retailer manually moves it (see below).
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
- **Deliberately not built yet**: tax/shipping calculation (`subtotal` and
  `total` are currently identical); assigning a product to a collection from
  the storefront (browsing doesn't filter by collection). Buy-now
  (`place_order`) still exists unchanged alongside the cart (see below) —
  nothing forces a caller through the cart. None of these are silent gaps —
  each is a real, scoped-out piece of "Commerce foundation," not an
  oversight.

### Shipped: Persisted multi-item cart and checkout

Full reasoning in `docs/DECISIONS.md` ADR-024; this section covers only what
got built.

- **The cart is a `draft` `Order`** — no new entity. One draft order per
  `(retailer_id, customer_id)`, enforced by a partial unique index, not
  application code. `add_to_cart(retailer_id, variant_id, quantity)` creates
  or reuses it and upserts a line (capped at 20, one row per variant via
  another unique index); `update_cart_line(line_id, quantity)` adjusts a
  line or deletes it at quantity 0; both are `security definer` RPCs that
  recompute `subtotal`/`total` from `order_lines` server-side, same
  narrow-RPC shape as `place_order`. `OrderRepository.addToCart` /
  `.updateCartLine` / `.findCart` wrap them; `findCart` and
  `findLinesByOrder` read through the existing customer-owns-this-order RLS
  policies (never scoped to status, so no new policy was needed).
- **`checkout_cart(order_id, shipping_address)`** is the only way a `draft`
  order leaves that status. It re-validates every line against current
  data — product still active, currency still matches, stock still
  sufficient for non-made-to-order variants — re-snapshots price at commit
  time (a line's price can have drifted since it was added), decrements
  inventory, records `shipping_address`, and flips the order to
  `"pending_payment"`. A cart that fails revalidation (an item went
  inactive, stock ran out) surfaces that as a form error, not a partial
  checkout.
- **`OrderRepository.findByRetailer`/`.findByCustomer` now exclude
  `"draft"`** — an in-progress cart is not yet a commercial record and must
  never appear in retailer order management or a shopper's order history
  next to real orders.
- **Customer Portal `/r/[slug]/cart`**: lists the signed-in shopper's cart
  for that retailer relationship, lets them adjust or remove a line inline,
  and collects a shipping address to check out. The storefront's "Add to
  cart" button (`/r/[slug]/products/[productSlug]`) replaces the old
  buy-now submit — it now redirects to the cart instead of straight to
  `/orders/[id]`.
- **Sign-in mid-checkout now returns to where the shopper was.** Magic-link
  requests carry an optional relative `redirectTo`/`next`
  (`/login?redirectTo=...` → `emailRedirectTo`'s `?next=...` →
  `/auth/confirm` honors it), validated same-origin-relative before use.
  Closes the "Sign in to purchase" gap this document used to flag.
- **Deliberately not built**: a UI affordance to abandon/clear a whole cart
  in one action (removing every line one at a time works, there's just no
  single "empty cart" button); a cart-item counter/badge elsewhere in the
  storefront chrome.

### Not yet built (Phase 2 — Catalog and Commerce, continued)

1. Payment provider integration — the provider itself is an open
   decision (needs its own ADR once made, per `docs/DECISIONS.md`'s own
   convention) and needs external credentials (a payment provider
   account) this environment doesn't have — flag this explicitly when
   reached rather than guessing a provider or faking a working
   integration. This is the one piece of Phase 2 not shipped.

### Shipped: Appointments and garment-first Alterations (Phase 3)

Appointment reasoning remains in ADR-015. ADR-016 records the founder
clarification and the complete Alterations ownership correction: PAON owns the
in-store physical-garment journey; GoCreate/suppliers own MTM measurements,
manufacturing fit profiles, specifications, production ordering, construction
and factory execution.

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
  reads; `sales_associate`+ books/manages/assigns. Fit observations are
  captured later against the identified garment, not against the customer.
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
- **Ownership correction is additive and non-destructive.** The committed
  customer fit-profile and thin alteration/update tables are renamed `legacy_*`,
  stripped of tenant/customer grants and retained only for audit. Active domain,
  repository and UI references are removed. Legacy alteration requests migrate
  to new work orders with a physical garment explicitly marked
  `needs_verification`; unattributable customer-level measurements are never
  invented as garment observations.
- **Garment-first intake:** `/alterations/new` transactionally creates a
  `PhysicalGarment`, `FittingSession`, append-only garment observations,
  one work order, tasks, original quote, initial status/pricing history and
  receipt custody event. External/random garments capture category/type,
  brand, description, photo/label metadata, condition and reference. Finished
  MTM garments require a PAON order line or supplier/order reference.
  Intake launched from an appointment retains that appointment on the fitting
  session rather than creating an untraceable walk-in record.
- **Catalogue/prices:** `20260719000102_*` seeds a comprehensive common
  premium-menswear catalogue. `/alterations/catalogue` lets owner/admin/manager
  roles enable/hide categories and operations and maintain the effective
  retailer Money price list. Workshop managers maintain their workshop-scoped
  effective cost list from the same catalogue screen without receiving retailer
  configuration access.
- **Workshop operations inside Retailer Portal:** `/alterations/workshops`
  creates workshops; Staff invites support explicit `workshop_manager`/`worker`
  roles scoped to one workshop; managers assign an approved work order;
  workshop managers manage the assigned worker/date and submit explained
  increase/decrease proposals; workers start assigned tasks, append work notes
  upload private progress/completion photos and mark review-ready. Worker-safe
  projections omit customer records and every pricing column. No fourth app was
  introduced.
- **Workflow/history:** one validated transition graph covers intake, quote,
  approval, assignment, work, completion review, ready-for-pickup/delivery,
  completion and cancellation. Original quote, proposals/decisions, actors,
  timestamps and reasons are immutable. Private Storage-backed evidence,
  append-only attachment metadata, chain of custody, completion reviews,
  notification readiness, verified pickup/delivery and sensitive audit triggers
  are first-class.
- **Least privilege:** additive restrictive policies prevent workshop roles
  from inheriting broad CRM/commerce/appointment/product access. Workshop
  managers see only their assigned workshop's work; workers only directly
  assigned jobs/tasks. Alteration access also requires an accepted, non-deleted
  staff membership rather than trusting a pre-acceptance JWT role claim.
  Customer Portal has no base work-order/task/pricing access and reads approved
  status/agreed info/customer-visible timeline plus pickup/delivery through safe
  security-barrier views. Existing platform oversight remains.
- **Portals:** Retailer Portal provides mobile-first intake, work-order detail,
  task/pricing/approval/handoff/pickup-delivery controls and catalogue/workshop
  configuration. Customer Portal shows only the approved garment status and
  pickup/delivery projection. Customer records now list physical garments, not
  generic measurements.
- **Deliberately not built:** GoCreate integration, any supplier connector,
  MTM/specification/construction UI, notification delivery transport, payment
  provider, push and deployment. `ProductionOrder` remains a future
  connector-facing status projection.

### Shipped: Loyalty, Rewards and Referral foundation (Phase 4)

- Retailer managers configure an enabled loyalty programme, purchase earning
  rate and referral bonus, create tier-aware rewards, and see member/points
  totals at `/loyalty`.
- A delivered order accrues purchase points exactly once through a database
  trigger. The append-only ledger is authoritative; cached balances update in
  the same transaction.
- Customers join per-retailer programmes, see balances and available rewards,
  redeem transactionally with an issued redemption code, and invite friends.
  RLS follows the existing multi-retailer customer identity model rather than
  trusting a single retailer claim.
- Referral signup/purchase matching and reward issuance will be completed with
  the referral acquisition journey.

### Shipped: Retailer Events and customer RSVP journey (Phase 4)

- Retailer managers create drafts, choose public/invite-only/VIP visibility,
  set venues and capacity, publish events, and inspect guest responses.
- Public events appear at `/r/[slug]/events`; authenticated customers can RSVP.
  The transactional RSVP function creates a prospect relationship when a new
  public-event guest first engages, enforces capacity under a row lock, and
  enforces invitations or gold/platinum membership for restricted events.
- Customers see their event responses across retailer relationships at
  `/events`. RLS exposes only published eligible events and each customer's own
  RSVP records. Phase 4's core foundations are now complete; referral conversion
  automation remains a later enhancement rather than blocking Phase 5.

### Shipped: Clienteling notes and relationship timeline (Phase 5)

- Retail advisors add private, optionally pinned notes to a customer record.
  Notes are never exposed to Customer Portal or workshop roles; authorship is
  bound to the authenticated accepted staff membership by RLS.
- The retailer customer record now combines orders, appointments and physical
  garments into one reverse-chronological relationship timeline while keeping
  manufacturing fit data outside PAON.

### Shipped: Messaging and in-app notifications (Phase 5)

- One private conversation exists per retailer-customer relationship. Customers
  and accepted sales staff exchange messages through narrow security-definer
  functions that derive their authority rather than accepting sender identity.
- Retailer staff share an inbox while workshop roles are excluded. Customers
  see only their own retailer conversations. Read receipts are maintained per
  audience.
- Every message generates an in-app notification for the other side. Recipients
  can only mark notifications read; a database trigger prevents changing their
  title, body, recipient or routing. Email, SMS and push remain future delivery
  adapters requiring provider credentials.

## Local database verification

- Docker and Supabase CLI are available. On 2026-07-20, the complete migration
  chain (`20260719000000`–`20260719000103`, then `20260720000000`–
  `20260720000009` including the persisted-cart migration) was executed
  twice from an empty local PostgreSQL database with `supabase start` and
  `supabase db reset`. `supabase db lint --level warning` reports no schema
  errors.
- `packages/database/src/generated/database.types.ts` is real output from
  `supabase gen types typescript --local`, reformatted with `pnpm format`
  (the CLI's raw output omits semicolons; Prettier normalizes it back to the
  repo's style — diffing the two confirms no schema drift beyond the
  intended change). Repository and application code compile against the
  actual schema, not a hand-maintained approximation.
- The real local Supabase stack backs all browser journeys. Playwright is
  green for PAON Admin (5 tests), Retailer Portal (14 tests), and Customer
  Portal (7 tests) — re-verified 2026-07-20 against the persisted-cart
  slice, each suite run twice back-to-back to confirm idempotency. These
  cover onboarding, invitations, authentication, CRM, catalogue, storefront
  ordering and cart/checkout, appointments, alterations, and pickup
  readiness. This pass caught and fixed three real bugs, not just
  environment drift:
  - The cart's "Update" and "Place order" buttons
    (`apps/customer/app/r/[slug]/cart/cart-client.tsx`) had no
    `type="submit"` — `@paon/ui`'s `Button` defaults to `type="button"`
    (most usages are outside forms), so neither button ever submitted its
    form. The cart page rendered correctly and looked complete; nothing in
    it actually worked. Always pass `type="submit"` explicitly on a
    `Button` inside a form — the default is deliberately not submit.
  - `apps/retailer/e2e/workspace.spec.ts`'s product-creation test asserted
    SKU and price as plain text, but the product detail page renders both
    as editable form fields (`getByLabel(...).toHaveValue(...)` is the
    correct assertion) — stale since the catalogue-editing slice turned
    that page into a full inline editor.
  - `apps/admin/e2e/global-setup.ts` created its bootstrap platform-staff
    row but never accepted it, so every admin e2e run landed on
    `/accept-invite` instead of `/retailers` — stale since ADR-022 added
    the acceptance gate. The fixture now sets `accepted_at` directly
    (`accept_platform_staff_invite` can't be called from a service-role
    script — it re-derives authority from `auth.uid()`), the same
    "bypass the real flow, but bypass it completely" reasoning it already
    applied to skipping the invite email.
  - `apps/retailer/e2e/accept-invite.spec.ts` and
    `apps/customer/e2e/login.spec.ts` both exercise their real
    `/auth/confirm` route with a real token from
    `admin.auth.admin.generateLink` (not a workaround password, not
    reading Inbucket) — this is now the standard technique for
    e2e-testing any future email-link flow in this repo; reuse it.
  - A test that mutates its own persisted state (the cart) must clean up
    that state at its own start, not just rely on fixtures being idempotent
    — see `apps/customer/e2e/storefront.spec.ts`'s pre-test draft-cart
    deletion. Global fixtures (`global-setup.ts`) provision shared read-only
    data once; a test's own read-write side effects are its own
    responsibility to reset.
  - The standard code checks are also green: `pnpm lint`, `pnpm typecheck`,
    `pnpm test` (unit), `pnpm build`, and `pnpm format:check`.
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
- **A status that must only change through its own history log**: keep
  history append-only and expose one validated `security definer` transition
  function that locks the aggregate, verifies the transition/actor, updates
  the denormalized status and appends history transactionally. A `before
update` trigger rejects direct status/agreed-price writes. See
  `alteration_work_orders`/`alteration_status_history` and
  `transition_alteration_work_order` (ADR-016). Future connector-facing
  `ProductionOrder` status should reuse this invariant shape.
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
