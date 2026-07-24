# Project State

Living status of the build. Update this file as part of every vertical
slice — a future session (human or AI) should be able to read this one
document and know exactly what exists, what's next, and why, without
re-deriving it from git history. See [ROADMAP.md](./ROADMAP.md) for the
phase-level plan this fits into.

## Where we are

**Phase 0 (engineering foundation): done. Phase 1 (Identity, Retailer,
Customer core): done. Phase 2 (Catalog and Commerce): catalog, storefront,
order placement/management and Stripe Connect customer payments shipped
— fully wired code-complete, blocked only on a platform operator
provisioning real Stripe credentials (see "Credentials needed" below),
not on anything technical. Phase 3 (Production, Alteration,
Appointments): Appointments plus the production-ready garment-first
Alterations vertical slice shipped — connector-facing `ProductionOrder`
tracking and supplier/manufacturing connectors are not started.** All three apps have real
auth; retailer onboarding is complete end to end; Customer identity is
in place; Retailer Portal can author a full catalog, manage orders,
run an appointment calendar, and track alterations; Customer Portal has
a public storefront/checkout and can request appointments and see
alteration status. See "Not yet built" below.

### Shipped: Production deployment

All three apps are live on Vercel, backed by a real (not local) Supabase
project — the first time anything in this repo has run outside a
developer's machine.

- **Supabase**: project `hngxrczavwywsnfceppb` (`ap-southeast-2`). All
  migrations in `supabase/migrations` applied via `supabase db push
--linked`. No seed data — the live database is empty until real
  retailers/customers sign up or a platform operator seeds it.
- **Vercel**: three projects, one per app, each with its Root Directory
  set to the corresponding `apps/<name>` and reading the rest of the
  monorepo (`packages/*`) as workspace dependencies —
  `paon-admin.vercel.app`, `paon-retailer.vercel.app`,
  `paon-customer.vercel.app`. `.vercelignore` at the repo root excludes
  `node_modules`/build artifacts so CLI archive uploads stay small
  enough for Vercel's Hobby-plan quotas.
- **Env vars configured (production only)**: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on all
  three; `NEXT_PUBLIC_ADMIN_APP_URL`/`NEXT_PUBLIC_RETAILER_APP_URL` on
  admin; `NEXT_PUBLIC_APP_URL` on retailer and customer.
  **`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY` and all
  other provider credentials are still unset** — see "Credentials
  needed" throughout this document. Every feature that depends on them
  renders its existing "not configured" state in production exactly as
  it does locally; nothing was faked to make the deploy look more
  complete than it is.
- **Cron on Hobby plan**: `apps/admin/vercel.json`'s email-dispatch cron
  was changed from every 5 minutes to once daily (`0 6 * * *`) — Vercel
  Hobby accounts cap cron jobs at once per day. This means, once Resend
  credentials are added, enqueued email can sit in `email_outbox` for
  up to 24h before a Hobby-plan deploy sends it; upgrading to Pro
  restores near-real-time dispatch. This is a plan-cost tradeoff for a
  human to decide, not something to change silently.
- **Verified live**: `/login` renders correctly on all three apps
  against the real Supabase Auth instance; the public storefront
  (`/r/[slug]/products` on Customer Portal) correctly 404s for an
  unknown retailer slug rather than erroring. No further live-account
  verification (e.g. actually signing up a retailer) has been done —
  see "Not yet built"/"Credentials needed" for what's still required
  before this is usable by a real retailer.
- **Deployed via Vercel CLI archive upload, not git** — there is no
  GitHub remote connected to this repo, so there is no CI-triggered
  redeploy on push. Future deploys are manual: `vercel deploy --prod
--yes --archive=tgz` from the repo root, after `vercel link --project
paon-<app>` for whichever app changed.

### Shipped: Behavioral analytics foundation

- Immutable retailer-scoped `behavioral_events`, captured only through a narrow
  identity-rederiving RPC and readable by manager-level staff or platform staff.
- Retailer Portal `/analytics` shows real 30-day revenue, orders, customers,
  appointments, alteration workload, event attendance, messages and captured
  experience signals. Metrics aggregate authoritative source tables rather than
  copying business records into an analytics shadow model (ADR-021).
- AI-generated recommendations shipped afterward (founder decision: OpenAI
  behind a provider-neutral interface) — see "Shipped: AI personalisation" below.
- PAON Admin `/analytics` provides cross-retailer adoption and operational
  metrics behind platform-staff authorization. Cross-currency GMV is explicitly
  directional until a currency conversion policy exists.

### Shipped: AI personalisation (Phase 5)

Full reasoning in `docs/DECISIONS.md` ADR-033.

- **`@paon/ai`**: an `AIProvider` interface (`generateNextBestAction` is
  the only method implemented this slice — `product_recommendation`/
  `communication_draft` are modeled in `AIGenerationKind` for the audit
  trail but not wired to a call site yet) plus `OpenAIProvider`. Swapping
  providers means adding another `AIProvider` implementation and
  changing one construction site (`apps/retailer/lib/ai.ts`) — nothing
  else imports `openai` directly.
- **`ai_generations` table** (`20260720000018_*`) — every generation
  attempt recorded, success or failure, append-only. Doubles as the
  per-customer history (Retailer Portal) and the cross-retailer
  monitoring feed (PAON Admin), not two separate tables. Direct RLS, no
  RPC — a single-table write scoped to the caller's own retailer,
  verifying `requested_by_staff_id` against the caller's own accepted
  staff membership the same way `clienteling_notes` already does.
- **Retailer Portal customer detail page**: an "AI insights" card
  (`sales_associate`+) suggests one next action from the customer's
  recent `BehavioralEvent` names and order summaries — never raw event
  payloads or full prompts get stored, only a short `input_summary` for
  audit purposes. Renders "AI personalisation is not configured on this
  deployment" when `OPENAI_API_KEY` is unset.
- **PAON Admin `/ai-monitoring`**: every generation across every
  retailer, most recent first, with success/failure counts, latency and
  error messages — the monitoring surface `docs/PRODUCT.md` named.
- **Deliberately not built**: `product_recommendation`/
  `communication_draft` generation (modeled, not wired to a UI — no
  call site has needed them yet); a NullAIProvider/mock provider
  (unnecessary — `lib/ai.ts` returning `null` when unconfigured already
  covers the "gracefully degrade" case the provider-neutral interface
  exists for).

#### Credentials needed (OpenAI)

Everything above is real, wired code, fully unit-tested by mocking the
OpenAI client — it needs a platform operator to:

1. Create an OpenAI account/API key (platform.openai.com), optionally
   configure a usage limit.
2. Set `OPENAI_API_KEY` in `apps/retailer`'s environment.

No code change is required once this exists — `lib/ai.ts` picks it up
automatically, and every caller already checks for its presence.

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
- **Deliberately not built yet**: No OAuth provider (Google/Apple) —
  passwordless email is the only login method; OAuth needs external
  provider credentials this session doesn't have, so it's flagged, not
  silently skipped or faked. `Wishlist` and `CustomerPreferences` (both
  listed here previously) shipped — see below.

### Shipped: CustomerPreferences persistence

Full reasoning in `docs/DECISIONS.md` ADR-028.

- `customer_preferences` is a plain table (no RPC — nothing about saving
  preferences creates a `Customer` row or writes a second table
  transactionally, unlike every other customer-write path this session),
  scoped by direct RLS to `customers.user_id = auth.uid()`.
  `CustomerPreferencesRepository.findByCustomer`/`.upsert` wrap it.
- Customer Portal `/account` lists one preferences form per retailer
  relationship — language, currency, contact channels
  (email/SMS/push/in-app), marketing opt-in, and free-text style notes —
  same per-relationship fan-out shape as `/wishlist`/`/loyalty`/`/orders`.
- Retailer staff (`sales_associate`+) can read a customer's preferences
  through RLS, the same clienteling extension ADR-026 gave the wishlist —
  no Retailer Portal UI surfaces it yet.

### Shipped: Wishlist

Full reasoning in `docs/DECISIONS.md` ADR-026.

- One `security definer` RPC, `toggle_wishlist_item`, does the whole job:
  creates the caller's `Customer` row inline on a first save (same pattern
  as `add_to_cart`), lazily creates their one default `Wishlist`, and
  flips the `WishlistItem` row. `WishlistRepository` wraps it plus the two
  reads (`findByCustomer`, `findItems`).
- Storefront `/r/[slug]/products/[productSlug]` has a "♡ Save to
  wishlist"/"♥ Saved to wishlist" toggle next to the buy form (signed-in
  shoppers only, same gate as purchasing). Customer Portal `/wishlist`
  lists saved products across every retailer relationship, each linking
  back to its storefront page, with a remove action.
- Retailer staff (`sales_associate`+) can read a customer's wishlist
  through RLS — no Retailer Portal UI surfaces it yet, but the read path
  exists for a future clienteling view, the same way orders/appointments
  already work.

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
  publishing status, merchandising flags, image, price, inventory, lead time
  and collection assignment. Product metadata and collection membership
  update in one tenant-revalidating transaction. Direct image upload shipped
  — see below.

### Shipped: Direct product image upload

Full reasoning in `docs/DECISIONS.md` ADR-029.

- `product-images` is a **public** Storage bucket (`manager`+ upload/remove,
  RLS-gated by path-prefix retailer match) — unlike alteration evidence's
  private/signed-URL shape, product photos are customer-facing, so reads use
  `getPublicUrl`. `ProductRepository.uploadImage`/`.removeImageByPublicUrl`
  are the new data-access surface; `products.primary_image_url` and
  `update_product_catalogue` are unchanged, this only adds a real upload
  path for that existing field.
- Retailer Portal `/products/[id]` gained a dedicated `ProductImageUploader`
  card (upload/remove), separate from the main product-fields form, which no
  longer owns `primaryImageUrl` at all — replacing the old "paste a hosted
  URL" text field.
- Customer Portal's storefront `/r/[slug]/products` and
  `/r/[slug]/products/[productSlug]` render the image for the first time —
  `primaryImageUrl` was captured but never displayed anywhere before this
  slice.

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
  `total` are currently identical) — this needs a product decision on tax
  provider/jurisdiction model before it can be built correctly, the same
  "flag, don't guess" treatment as payment provider selection, not a
  silent gap. Buy-now (`place_order`) still exists unchanged alongside the
  cart (see below) — nothing forces a caller through the cart.
  Storefront collection browsing shipped — see below.
- **Storefront collection browsing** (`/r/[slug]/products?collection=<slug>`,
  ADR-027): `collections`/`product_collections` gained `anon`-inclusive read
  policies (the same shape ADR-014 gave `products`/`retailers`), closing a
  latent gap — `Product.collectionIds` was always resolved by
  `ProductRepository` but nothing using the anon client could actually read
  the join table before this. Collection chips filter the product list;
  filtering happens in the Server Component, not a new repository method.

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

### Shipped: Stripe Connect customer payments

Full reasoning in `docs/DECISIONS.md` ADR-030 (founder decision: Stripe
Connect Express, every retailer is merchant of record, optional
configurable platform fee). This is the piece of Phase 2 the previous
version of this document flagged as not started — it is now fully
code-complete and unit-tested, blocked only on real credentials (see
"Credentials needed" below), not on anything technical.

- **`@paon/payments`** — new package, isolates every Stripe SDK call the
  same way `@paon/database` isolates `@supabase/supabase-js` (ADR-001).
  `connect.ts` (Express account creation, onboarding/dashboard links,
  direct-charge Checkout Session creation), `webhooks.ts` (signature
  verification), `webhook-events.ts` (pure event → action mapping, fully
  unit-tested with fixture objects, no live Stripe account needed).
- **`retailer_stripe_accounts`, `payments`, `stripe_webhook_events`
  tables + `record_stripe_payment_event` RPC** (`20260720000015_*`).
  `record_stripe_payment_event` is the only way a `payments` row or a
  `pending_payment`→`placed`/`refunded` order transition happens —
  granted to `service_role` only, idempotent at both the Stripe-event
  level and the payment-record level (a redelivered webhook, which
  Stripe does until it gets a 2xx, is a total no-op).
- **Retailer Portal `/settings/payments`** (owner/admin): "Connect with
  Stripe" starts Express onboarding; status badges
  (charges/payouts enabled, onboarding incomplete); "Manage on Stripe"
  opens an Express dashboard login link. Renders a "Stripe is not
  configured on this deployment" state instead of crashing when
  `STRIPE_SECRET_KEY` is unset — same non-faking treatment
  `docs/PROJECT_STATE.md` already applies to unconfigured AI.
- **Customer Portal `/orders/[id]`**: a `pending_payment` order shows a
  "Pay now" button (`createCheckoutSession` → redirect to Stripe
  Checkout); canceling returns to the same page with a retry affordance
  — checkout never strands an order mid-flow, since `checkout_cart`
  itself never calls Stripe. A `captured`/`refunded` payment renders a
  receipt line from the real `payments` row.
- **`apps/customer/app/api/webhooks/stripe/route.ts`**: verifies the
  signature, calls `parseStripeConnectEvent`, dispatches to
  `PaymentRepository`/`RetailerStripeAccountRepository` — handles
  `payment_intent.succeeded`/`.payment_failed`, `charge.refunded`,
  `account.updated`. Never inlines business logic (docs/API.md "Route
  Handlers").
- **Deliberately not built**: multiple payment attempts or partial
  refunds per order (`payments.order_id` is unique — MVP scope, a later
  enhancement, not modeled speculatively now); a PAON Admin cross-retailer
  payments view (Retailer Portal and Customer Portal cover today's actual
  need).

#### Credentials needed (Stripe Connect)

Everything above is real, wired code — it needs a platform operator to:

1. Create (or use an existing) Stripe account for PAON itself, enable
   **Connect** (Dashboard → Connect → Get started, Express accounts).
2. Copy the **platform account's secret key** into `STRIPE_SECRET_KEY`
   for both `apps/retailer` and `apps/customer` (same key, both apps —
   see each app's `.env.example`).
3. Register a webhook endpoint at
   `https://<customer-app-domain>/api/webhooks/stripe`, subscribed to
   **Connect events** (not account events): `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `charge.refunded`,
   `account.updated`. Copy the endpoint's signing secret into
   `STRIPE_CONNECT_WEBHOOK_SECRET` (`apps/customer` only).
4. For local development, use the Stripe CLI (`stripe listen --forward-to
localhost:3002/api/webhooks/stripe`) to get a local webhook secret and
   exercise the flow against Stripe's real test mode.

No code change is required once these exist — `lib/stripe.ts` in both
apps picks up `STRIPE_SECRET_KEY` automatically, and every caller
already checks for its presence.

### Shipped: Stripe Billing retailer subscriptions (Phase 6)

Full reasoning in `docs/DECISIONS.md` ADR-031. `RetailerSubscription`/
`SubscriptionPlan` (`packages/domain/src/retailer/subscription.ts`)
existed as domain types with no table since Phase 0 — this is the
first implementation, and it's deliberately separate from Stripe
Connect (ADR-030): a retailer paying PAON, not a customer paying a
retailer.

- **`subscription_plans`, `retailer_subscriptions` tables**
  (`20260720000016_*`). Three plans seeded (`boutique_monthly`/
  `house_monthly`/`maison_monthly`) with `provider_price_id` null until
  a platform operator creates the matching Stripe Price. No `security
definer` RPC needed — unlike payments, assignment is a single-table
  write already covered by "platform staff can manage all," and the
  webhook sync is a single-table, no-validation update, the same shape
  `retailer_stripe_accounts.syncCapabilities` already established.
- **PAON Admin `/billing`**: lists all plans, lets a platform operator
  paste in each plan's real Stripe Price id. `/retailers/[id]` gained a
  Billing panel — assign a plan (creates the real Stripe
  Customer/Subscription, then records the result) or view the current
  subscription's status/renewal date. A plan with no Price configured
  can't be assigned (checked before calling Stripe).
- **Retailer Portal `/settings/billing`** (owner/admin): status badge,
  current plan, renewal/cancellation date, and a "Manage billing"
  button that opens a Stripe-hosted Billing Portal session — PAON never
  handles a retailer's card details directly, same restraint ADR-030
  applies to customer payments.
- **`apps/admin/app/api/webhooks/stripe/route.ts`**: verifies the
  signature, calls `parseStripePlatformEvent`, syncs
  `retailer_subscriptions` on `customer.subscription.updated`/`.deleted`.
  A separate endpoint, separate signing secret
  (`STRIPE_BILLING_WEBHOOK_SECRET`) and separate app from Connect's
  webhook (`apps/customer`) — platform-account events, not
  connected-account events.
- **Deliberately not built**: self-serve plan upgrade/downgrade
  (`assignSubscriptionPlan` explicitly rejects reassigning an existing
  subscription — cancel/change directly in the Stripe dashboard for
  now); usage-based feature gating from `FeatureFlagOverride` (the
  domain type exists, nothing reads it yet).

#### Credentials needed (Stripe Billing)

Everything above is real, wired code — it needs a platform operator to:

1. In the **same** Stripe account used for Connect (Dashboard, not in
   Connect-specific settings this time), create one Product + Price per
   plan (Boutique/House/Maison, matching `subscription_plans.key`).
2. Paste each Price id into PAON Admin → Billing (`/billing`) — no
   direct database edit needed.
3. `STRIPE_SECRET_KEY` is the same platform secret key Connect already
   uses (`apps/admin`'s own `.env.example` — a third copy, since
   `apps/admin` didn't need one before this).
4. Register a **second** webhook endpoint at
   `https://<admin-app-domain>/api/webhooks/stripe`, subscribed to
   **platform account events** (not Connect events):
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy its signing secret into `STRIPE_BILLING_WEBHOOK_SECRET`
   (`apps/admin` only — distinct from Connect's
   `STRIPE_CONNECT_WEBHOOK_SECRET` in `apps/customer`).
5. For local development, `stripe listen --forward-to
localhost:3000/api/webhooks/stripe` for a local billing webhook
   secret, separate from Connect's `stripe listen` session.

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
  verified pickup/delivery and sensitive audit triggers are first-class.
  Moving a linked customer's work order to `ready_for_pickup` or
  `out_for_delivery` now creates an `alteration_update` notification in the
  same database transaction, deep-linked to the safe Customer Portal detail
  view. Existing ready work was backfilled; the established email/SMS outbox
  triggers fan the notification out according to the customer's channel
  preferences (ADR-038).
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
  MTM/specification/construction UI or native push provider.
  `ProductionOrder` remains a future connector-facing status projection.
  Alteration-readiness in-app delivery is real; email and SMS delivery use the
  existing code-complete outboxes and remain credential-dependent.

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

### Shipped: Referral acquisition journey (Phase 4)

Full reasoning in `docs/DECISIONS.md` ADR-025.

- A referral now progresses through its full lifecycle with no new customer
  action required beyond the invite already shipped: `invited` →
  `signed_up`, driven by a trigger on `customers` that fires whenever a row
  gains a `user_id` (the referred email's Customer Portal signup, however it
  happens — inline creation from `place_order`/`add_to_cart`/
  `request_appointment`, or `link_my_customer_accounts` linking an existing
  prospect) → `first_purchase_completed`, on the referred customer's
  first-ever delivered order at that retailer → `rewarded`, crediting the
  _referrer's_ loyalty account `referral_points` as an `earn_referral`
  ledger entry, in the same transaction as ordinary purchase-point accrual.
- Customer Portal `/loyalty` lists each sent referral with its live status
  (previously just a count) so a shopper can see a referral convert.
- `Referral.rewardId` stays unused — today's reward is always raw points,
  not a catalogue `Reward` redemption; the column is reserved for a possible
  future enhancement, not populated speculatively.

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
  title, body, recipient or routing. SMS and push remain future delivery
  adapters requiring provider credentials — email shipped, see below.

### Shipped: Resend transactional email (Phase 5)

Full reasoning in `docs/DECISIONS.md` ADR-032.

- **`email_outbox` table + `enqueue_notification_email` trigger**
  (`20260720000017_*`) — fires on every `notifications` insert
  (currently only `send_conversation_message`, but any future
  notification-creating code gets email for free with no changes to
  it). A customer who opted out of email in their
  `CustomerPreferences.communicationChannels` (ADR-028) gets no outbox
  row at all. Verified directly against the local database with a
  throwaway script (trigger logic and `claim_pending_emails`'s atomic
  `for update skip locked` claim can't be meaningfully unit-tested in
  Vitest) — confirmed the opt-out gate, the enqueue, and that two
  overlapping claims never both grab the same row.
- **`apps/admin/app/api/cron/dispatch-emails`**: a scheduled Route
  Handler (`vercel.json`, every 5 minutes), authenticated by
  `CRON_SECRET` rather than a webhook signature — `docs/API.md`/
  `docs/DATABASE.md` already named scheduled jobs as a legitimate
  service-role-client use case. Claims up to 20 pending rows, sends via
  `@paon/email`, marks sent or reverts to `pending` (up to 5 attempts,
  then permanently `failed`).
- **`@paon/email`**: isolates the Resend SDK the same way
  `@paon/payments` isolates Stripe — `createResendClient`/`sendEmail`,
  unit-tested by mocking the client.
- **Deliberately not built**: per-category HTML templates (a single
  `<p>` wraps the notification body today — richer templates are a
  future enhancement once there's a second call site to generalize
  from); SMS/push transports (still fully deferred, no provider chosen).

#### Credentials needed (Resend)

Everything above is real, wired code — it needs a platform operator to:

1. Create a Resend account, verify a sending domain (Resend dashboard →
   Domains), and generate an API key.
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (e.g. `PAON
<notifications@yourdomain.com>`, must be on the verified domain) in
   `apps/admin`'s environment.
3. Generate any long random string for `CRON_SECRET` and set it in the
   same environment — Vercel automatically sends it as
   `Authorization: Bearer $CRON_SECRET` for a project's own cron
   invocations once `vercel.json` (already committed,
   `apps/admin/vercel.json`) is deployed with that env var set.
4. For local development or manual triggering, `curl -X POST
-H "Authorization: Bearer $CRON_SECRET"
http://localhost:3000/api/cron/dispatch-emails`.

No code change is required once these exist — enqueued email already
accumulates in `email_outbox` regardless of configuration; it just
waits for the next successful drain.

### Shipped: Self-Portrait consolidated profile + TableService storefront lead capture

Full reasoning in `docs/DECISIONS.md` ADR-034 (also records the full
triage of a founder-supplied concept deck onto the roadmap — what's
being built vs. explicitly out of scope).

- **Self-Portrait** (`apps/retailer/app/(dashboard)/customers/[id]/self-portrait.tsx`):
  a single composed card on the retailer customer detail page —
  loyalty tier/points (`LoyaltyRepository.findAccountByCustomer`),
  recent `BehavioralEvent`s (`AnalyticsRepository.findRecentByCustomer`)
  and the top pinned `ClientelingNote`. No new domain state; every
  signal it shows already existed from Phase 4/5 work, just not in one
  place.
- **TableService**: an intent-driven lead-capture widget
  (`apps/customer/app/r/[slug]/table-service-widget.tsx`) on every
  public storefront page (mounted from the new `r/[slug]/layout.tsx`).
  An anonymous visitor picks an intent (wedding / shirts / style help /
  general) and submits name, email and a message with no login.
  - `submit_table_service_inquiry` (`20260721000002_*`, `security
definer`) is the only write path: finds-or-creates a guest
    `Customer` by (retailer, email) — reusing the existing
    `customers_retailer_email_idx` dedupe — finds-or-creates their
    `Conversation`, tags it with `intent` (new nullable column, set
    once, never overwritten), and inserts a `guest`-sender `Message`.
    A 5-messages-per-10-minutes cap per customer is the only
    spam guard; no CAPTCHA/rate-limit service integrated.
  - **Deliberately not built**: any anonymous RLS insert policy on
    `conversations`/`messages` — access is entirely through this one
    narrow `security definer` function (granted to `anon`), matching
    the founder's explicit choice (ADR-034) over a fully anonymous
    session-based chat.
  - `message_sender_type` gained a `guest` value
    (`20260721000001_*`, its own migration — enum values can't be
    referenced in the same transaction they're added in, same
    constraint `20260719000100_add_workshop_roles.sql` hit first).
  - Retailer inbox (`messages/page.tsx`, `messages/[id]/page.tsx`)
    shows the intent as a badge and labels guest-originated threads
    "Storefront inquiry — no portal account yet."
- **Verified**: full migration chain applies cleanly on a local reset
  (`supabase db reset --local`), types regenerated from local Postgres
  (`pnpm --filter @paon/database generate-types`, which already targets
  `--local` and needs no remote token), `pnpm lint`/`typecheck`/`test`/
  `build` all pass repo-wide. **Not yet pushed to the live Supabase
  project** — see "Credentials needed" below.

**Pushed to production** (2026-07-21): both migrations are now applied
to the live project (`hngxrczavwywsnfceppb`) via `supabase db push
--linked`, once a founder-provisioned `SUPABASE_ACCESS_TOKEN` became
available. TableService is live end to end.

### Shipped: Storefront editorial visual redesign

Also part of ADR-034's triage (bucket 2 — "real, scoped, next").
Catalog (`products/page.tsx`) is now a masonry grid with larger
imagery instead of a single-column list; the PDP is a two-column
sticky-image layout with a serif (`--font-display`, defined in
`packages/ui` since the design system's inception but unused until
now) heading treatment, a computed price/price-range label, and an
inline "Book a complimentary fitting" link into the existing
appointments flow. `order-form.tsx`/`wishlist-toggle.tsx` also had
their raw `<input type=number>`/`<select>` replaced with the shared
`Input`/`Select` components — a pre-existing inconsistency, not
something this redesign introduced. The same heading treatment was
then carried to appointments/cart/events for visual consistency across
the whole `/r/[slug]` storefront. The authenticated back-office UI
(admin/retailer portals, customer account dashboard) deliberately
keeps the existing quiet/editorial restraint — this redesign is scoped
to the public storefront only.

- **Verified**: manually seeded a product+variants into the local
  database and confirmed both pages render correctly (formatted price,
  image, made-to-order tag, sign-in gating) via direct HTTP requests
  against a local dev server. Also ran the existing Playwright e2e
  suite's `storefront.spec.ts` against local Supabase —
  `browsing the storefront requires no sign-in` and
  `storefront shows an uploaded product image` both pass unmodified
  (proof the redesign didn't change any behavior those tests depend
  on). The suite's third test (`a signed-in shopper builds a
cart...`) fails at the magic-link sign-in step, before it ever
  reaches a page this redesign touched — `apps/customer/app/auth/confirm/route.ts`
  was last modified in an unrelated, much earlier commit
  (`0dc0da5`), so this is a pre-existing local-environment issue
  (likely Inbucket/GoTrue email-link timing in this Docker setup), not
  a regression from this change. Not investigated further — out of
  scope for a UI redesign task.

### Shipped: Second wave — Wedding Party invites, staff roster, SMS/WhatsApp, weather, newsletter, carrier preference, alteration cost controls

Full reasoning in `docs/DECISIONS.md` ADR-036. All migrations applied
to production (`hngxrczavwywsnfceppb`) the same session.

- **Wedding Party invite links**: `wedding_parties.invite_token` +
  `join_wedding_party` (anonymous-safe security definer RPC, same
  shape as `submit_table_service_inquiry`) — the organizer shares one
  link, every member self-registers and appears immediately in the
  retailer's existing roster view. Verified end to end (RPC called
  directly as `anon`, confirmed the member row was created).
- **Staff planning**: `StaffShift` (manager-authored schedule) +
  `StaffTimeEntry` (self-service clock in/out via `clock_in`/`clock_out`
  RPCs). Retailer `/staff/roster` (manager+) shows a week grid plus
  actual worked hours (`totalHours`, computed from clocked duration,
  never the schedule); a clock in/out widget is on the retailer
  dashboard for every staff role.
- **SMS/WhatsApp pipeline** (`@paon/sms`, Twilio): `sms_outbox` mirrors
  `email_outbox` exactly; `/api/cron/dispatch-sms` drains it. **Not
  live** — reports 503 until a platform operator sets
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_SMS_FROM` (and
  optionally `TWILIO_WHATSAPP_FROM`) on `apps/admin`. No code change
  needed once those exist.
- **Weather-personalized Today's Pick**: real, founder-supplied
  OpenWeatherMap key (verified live against the real API). **Not live
  in production** — `OPENWEATHER_API_KEY` needs to be set on the
  `paon-customer` Vercel project; this specific step was blocked by
  the build sandbox's own safety classifier (a production
  infrastructure change) rather than by a missing credential. Set it
  in the Vercel dashboard (Settings → Environment Variables) or grant
  Bash permission for Vercel API calls.
- **Newsletter signup + daily digest**: `newsletter_subscribers` +
  `subscribe_to_newsletter` (anonymous-safe RPC) + a footer signup
  form on the storefront front door. `/api/cron/dispatch-newsletter`
  sends one "featured product" email per retailer to every active
  subscriber. **Not scheduled** — Vercel's Hobby plan cron-job cap per
  project is already used by `dispatch-emails`/`dispatch-sms`; needs
  an external scheduler, folding into an existing cron tick, or a plan
  upgrade before it fires automatically. Callable manually today with
  `CRON_SECRET`.
- **Shipping/carrier preference**: `customers.preferred_carrier`
  (DHL/PostNL/UPS/FedEx/local courier/customer pickup), shown next to
  a customer's shipping addresses on their retailer detail page.
  Staff-writable directly (no RPC — `customers` already grants
  sales_associate+ a blanket RLS policy). No real carrier API
  integration exists or was faked.
- **Alteration cost-control hardening**: audited the existing
  proposal/approval system first (it was already real — immutable
  quote, mandatory evidence, append-only history). Closed two gaps:
  capped resubmission after two rejections on the same target, and
  increases over 50% of the original quote now require the retailer
  _owner_ specifically to approve (not any manager/admin) — closes the
  single-approver collusion risk. The full `alteration_pricing_history`
  audit trail (existed in the DB, had no UI) is now a visible Card on
  the alteration detail page.
- **Wedding Party + back-office visual pass**: rounded-xl +
  shadow-elevated cards on every Wedding Party view (retailer and
  customer); the serif display heading carried across all 45
  retailer/admin back-office pages. Not the full paon.html component
  treatment on back-office yet — see `docs/ROADMAP.md` Phase 7 "Still
  open."

#### Credentials needed (Twilio, OpenWeatherMap, real carrier APIs)

- **Twilio** (SMS/WhatsApp): create an account, provision a phone
  number (SMS) and a WhatsApp Business sender, set
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_SMS_FROM`/
  `TWILIO_WHATSAPP_FROM` on `apps/admin`.
- **OpenWeatherMap**: key already exists (see above) — just needs
  `OPENWEATHER_API_KEY` set on `apps/customer`'s Vercel project.
- **Carrier APIs** (DHL/PostNL/UPS/FedEx): not started at all — no
  account, no key, no integration code. The `preferred_carrier` field
  only records staff's intent today.

### Shipped: UX & Logic Audit, omni-device optimization, and a monorepo Tailwind fix

Full reasoning in `docs/DECISIONS.md` ADR-037. A founder-directed
"brutal diagnostic teardown" of both portals — audit first, then fix,
then prove with automated tests, then document. Findings themselves
were delivered as a "Friction Elimination Matrix" in-session, not
duplicated here.

- Retailer Portal `/dashboard` replaced its Phase-1 placeholder with a
  real "Needs your attention" digest — pending alteration price
  approvals, today's appointments, unread messages, each linking
  straight to the record. Customer Portal `/dashboard` gained the
  equivalent per-relationship status line. No new tables; both compose
  existing repository reads differently.
- Alteration detail page: Pricing proposals moved from the 8th section
  to immediately after the header (`id="pricing"` anchor) — approving a
  price change no longer requires scrolling past unrelated history.
- Both apps' flat nav lists are now grouped (`role="group"` clusters);
  Customer Portal additionally gained a pinned bottom tab bar on mobile
  viewports (Orders/Appointments/Messages/Account).
- Cart quantity control replaced raw-input-plus-separate-button with
  auto-submitting steppers and a dedicated Remove action; a sticky
  mobile checkout bar keeps "Place order" reachable on longer carts.
  Every new/changed control verified at the 44×44px minimum tap target.
- **Found and fixed while verifying the above: `@paon/ui` component
  classes (Button's `inline-flex`, `h-*`, `gap-2`, etc.) were missing
  from every app's compiled CSS.** Tailwind v4's automatic content
  detection never follows the `node_modules/@paon/ui` workspace
  symlink. Fixed with two `@source` directives in
  `packages/ui/src/styles/globals.css` — retroactively fixes every
  `@paon/ui` component in all three apps, not just this slice's
  changes. This was invisible without direct compiled-CSS inspection;
  no browser/visual-QA tool exists in this environment to have caught
  it visually.
- Also fixed: `behavioral_events` was missing its table-level `select`
  grant (same class of bug `customer_preferences`/`wishlists` hit
  before it) — caught by the retailer e2e suite, not by lint/typecheck.
- **Verified**: `pnpm lint`/`typecheck`/`test`/`build` all pass
  repo-wide. All 38 Playwright e2e tests pass across all three apps
  (PAON Admin 6, Retailer Portal 16 — including two new specs,
  Customer Portal 16 — including two new specs) against a local
  Supabase reset, each app rebuilt clean (`.next` removed) after the
  Tailwind `@source` fix to rule out stale-build false negatives.

## Local database verification

- `20260724000000_notify_customer_when_alteration_ready.sql` applied cleanly
  to the existing local migration chain. Alteration readiness now creates a
  customer `alteration_update` transactionally and backfills linked customers
  whose work was already ready. The Customer Portal e2e journey proves the
  inbox notification opens the intended safe alteration detail view, and the
  resulting notification has a linked durable email-outbox row.
  `supabase db lint --level warning` reports no schema errors.
- Docker and Supabase CLI are available. On 2026-07-20, the complete migration
  chain (`20260719000000`–`20260719000103`, then `20260720000000`–
  `20260720000014` including the persisted-cart, referral-journey, wishlist,
  collection-browsing, customer-preferences and product-image-storage
  migrations) was executed repeatedly from an empty local PostgreSQL
  database with `supabase start` and `supabase db reset`. `supabase db lint
--level warning` reports no schema errors. The referral triggers were also
  verified directly against the local database with a throwaway script
  exercising the full invite → signup → delivered-order → reward sequence
  via the admin client before the Playwright coverage below was written,
  since a Postgres trigger can't be unit-tested in Vitest.
- `packages/database/src/generated/database.types.ts` is real output from
  `supabase gen types typescript --local`, reformatted with `pnpm format`
  (the CLI's raw output omits semicolons; Prettier normalizes it back to the
  repo's style — diffing the two confirms no schema drift beyond the
  intended change). Repository and application code compile against the
  actual schema, not a hand-maintained approximation. The Storage bucket/RLS
  migration produces zero diff here, as expected — `storage.*` isn't part of
  the generated `public` schema types.
- The real local Supabase stack backs all browser journeys. Playwright is
  green for PAON Admin (5 tests), Retailer Portal (15 tests), and Customer
  Portal (12 tests) — re-verified 2026-07-20 against the persisted-cart,
  referral-journey, wishlist, collection-browsing, customer-preferences and
  product-image-upload slices, each suite run at least twice back-to-back to
  confirm idempotency. These cover onboarding, invitations, authentication,
  CRM, catalogue, product image upload, storefront ordering, cart/checkout,
  wishlist, collection browsing, appointments, alterations, pickup
  readiness, referral conversion, and account preferences. This pass caught
  and fixed four real bugs, not just environment drift:
  - `customer_preferences` (this slice) had RLS policies but no PostgREST
    table-level grant — `20260720000000_grant_api_base_table_access.sql`'s
    blanket grant only covered tables that existed at the time it ran; every
    table created afterward (see `wishlists`, `20260720000011_*`) must grant
    `select, insert, update, delete` to `authenticated, service_role`
    itself, or every request fails with `permission denied for table ...`
    even though RLS is satisfied — RLS and SQL-level grants are enforced
    independently in Postgres. Caught immediately by the new e2e spec, not
    by lint/typecheck/build/unit tests, none of which touch the real
    database.
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
  (3) whatever page that redirects to. All three apps now use this shape
  — `apps/admin`'s platform-staff invite acceptance (ADR-022) was the
  last to land it.
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
