# Roadmap

Phased by dependency order — each phase's data model and UI depend on
the ones before it. Not date-committed; sequencing, not scheduling.

## Phase 0 — Engineering foundation (done)

Monorepo, shared packages (`domain`, `database`, `auth`, `ui`, `utils`),
full domain model, design tokens, linting/formatting/testing/CI,
Supabase and Vercel scaffolding, and this documentation set. No
application features. Done when: `pnpm build`, `pnpm lint`,
`pnpm typecheck` and `pnpm test` are all green on a repository with
three apps that boot and render a placeholder home page each. ✅ Done.

## Phase 1 — Identity, Retailer, Customer core (done)

Live status: see [PROJECT_STATE.md](./PROJECT_STATE.md). ✅ Done — all
three apps have real auth, the retailer onboarding journey is complete
end to end, and Customer identity (CRM + Customer Portal login +
account linking) is in place. Phase 2 (Catalog and Commerce) is next.

- ✅ Supabase Auth wired into PAON Admin; `@paon/auth` session
  resolution implemented for real (`resolveAppSession`, role guards).
  Retailer Portal and Customer Portal now have the same wiring too —
  all three apps have real auth.
- ✅ `Retailer` create + list + detail in PAON Admin — the onboarding
  flow that creates a tenant and invites its first owner in one step.
- ✅ The retailer owner's side of onboarding: accept the invite
  (`/auth/confirm` → `/accept-invite`), set a password, land in
  Retailer Portal for the first time, retailer status transitions
  `pending_onboarding` → `active` — see `docs/DECISIONS.md` ADR-012.
- ✅ Retailer setup (business profile, billing address) in Retailer
  Portal `/settings`, gated `owner`/`admin`. Locations as a distinct
  entity (multi-store) is not modeled yet — deferred until a slice
  actually needs more than one address per retailer, not built
  speculatively now.
- ✅ `RetailerStaffMember` invitation and role management from inside
  Retailer Portal itself (`/staff`, `/staff/new`) — reuses the same
  accept-invite RPC the first owner uses. Cannot grant `"owner"` — see
  `docs/PROJECT_STATE.md`.
- ✅ `Customer` CRUD in Retailer Portal (`/customers`, `/customers/new`,
  `/customers/[id]`, gated `sales_associate`+); Customer Portal
  passwordless login (`docs/PRODUCT.md` — no OAuth provider wired up
  yet, that needs external credentials this session doesn't have) and
  a dashboard listing the signed-in shopper's linked retailer
  relationships. Linking a Customer Portal login to a per-retailer
  `Customer` record is automatic (`link_my_customer_accounts`, by
  matching email) — see `docs/DECISIONS.md` ADR-013. `Wishlist` shipped in
  Phase 2 alongside the storefront (ADR-026); `CustomerPreferences`
  persistence and a Customer Portal profile-editing UI (`/account`) shipped
  afterward (ADR-028).
- ✅ First real RLS policies and migrations landed in
  `supabase/migrations` (`retailers`, `platform_staff_members`,
  `retailer_staff_members`, `customers`, `customer_account_links`, JWT
  claim-sync triggers, auth helper functions).

This phase proves the multi-tenant foundation end-to-end before any
commerce logic is built on top of it.

## Phase 2 — Catalog and Commerce (in progress)

- ✅ `Product` / `ProductVariant` / `Collection` authoring in Retailer
  Portal (`/products`, `/products/new`, `/products/[id]`,
  `/collections` — gated `manager`+, a stricter minimum than the
  `sales_associate`+ CRM gate, since catalog authoring is a managerial
  task). A product is created with its first variant in the same
  submission — a product with no sellable variant is the same
  "no useless intermediate state" reasoning as retailer
  creation+owner-invite (`docs/DECISIONS.md` ADR-009-adjacent).
- ✅ Storefront browsing (public, path-based — `/r/[slug]/products`) and
  `Order` placement in Customer Portal. `Order` management (fulfillment
  status) in Retailer Portal (`/orders`, gated `production_staff`+).
  Both decided by the human operator rather than guessed — routing
  scheme (path vs. subdomain vs. custom domain) and whether an order
  may exist unpaid — see `docs/DECISIONS.md` ADR-014.
- ✅ Persisted multi-item cart (`/r/[slug]/cart`) — `draft` `Order` per
  retailer relationship, add/update/remove lines, checkout re-validates
  price/stock/currency and collects a shipping address. Buy-now
  (`place_order`) still exists alongside it. See ADR-024.
- ✅ `Payment` integration — Stripe Connect Express, direct charges,
  every retailer merchant of record (founder decision, ADR-030).
  Code-complete and unit-tested; blocked only on a platform operator
  provisioning real Stripe credentials, see `docs/PROJECT_STATE.md`
  "Credentials needed".

## Phase 3 — Production, Alteration, Appointments (in progress)

- ✅ `Appointment` booking foundation: Customer Portal requests one from
  a retailer's storefront (`/r/[slug]/appointments`, no sign-in needed
  to browse, required to submit); Retailer Portal has a calendar-ish
  list, detail, staff assignment, and status management
  (`sales_associate`+), plus `AvailabilityWindow` management (a staff
  member manages their own, `manager`+ manages anyone's). See
  `docs/DECISIONS.md` ADR-015 for why there's no live slot picker on
  the customer side yet (privacy: showing real-time availability would
  otherwise require exposing booking data to anonymous browsers).
- ✅ Production-ready Alterations vertical slice (ADR-016): external/random
  and finished-MTM garment intake; physical-garment fitting observations;
  `work_now` versus manual-future-GoCreate notes; configurable seeded
  premium-menswear operations; effective retailer/workshop Money price lists;
  immutable original quotes and workshop proposal/retailer approval history;
  assignments, worker task notes/review-ready flow, validated append-only
  status history, attachments metadata, chain of custody, completion review,
  notification readiness, pickup/delivery and cancellation audit.
- ✅ Explicit least-privilege alteration access: owner/manager configuration,
  assignment, approval and oversight; advisor intake/fitting/handoffs;
  workshop manager access limited to the assigned workshop; worker access
  limited to directly assigned work; customers limited to safe approved-status
  and pickup/delivery projections; platform oversight retained.
- ⬜ Connector-facing `ProductionOrder` status, staff-facing and
  customer-facing — not started. It must project status from an authoritative
  supplier/manufacturing system, not absorb MTM/specification/construction
  ownership into PAON.
- ⬜ Supplier/manufacturing integrations (e.g. GoCreate) — connectors
  only, per `docs/NORTH_STAR.md`; PAON does not become a manufacturing
  system. Not started, and no connector exists to integrate yet.

This is the phase that differentiates PAON from generic commerce
platforms — see [VISION.md](./VISION.md).

## Phase 4 — Loyalty, Rewards, Referrals, Events

- ✅ `LoyaltyAccount` / append-only `LoyaltyLedgerEntry` accrual when an
  order becomes delivered, with retailer-configurable earning rules.
- ✅ Reward catalogue and transactional customer redemption.
- ✅ Referral invite, signup matching, first-purchase matching and reward
  issuance — the full acquisition journey, not just the invite. See ADR-025.
- ✅ `RetailerEvent` / `EventRsvp` for public, invitation-only and VIP-tier
  trunk shows and events, with capacity-safe customer responses.

## Phase 5 — Engagement and Personalisation

- ✅ `Conversation` / `Message` between customer and retailer staff, with
  participant-only access and shared retailer inbox.
- ✅ In-app `Notification` delivery and read state. Email delivery shipped
  (Resend via a durable outbox + scheduled drain, founder decision,
  ADR-032) — code-complete, blocked only on a platform operator
  provisioning Resend credentials, see `docs/PROJECT_STATE.md`
  "Credentials needed". SMS/push remain credential-dependent adapters,
  no provider chosen yet.
- ✅ Private `ClientelingNote` staff tooling and a unified relationship timeline
  on the retailer customer record.
- AI personalisation built on `BehavioralEvent` — recommendations,
  next-best-action for staff, personalized customer communication —
  with AI monitoring surfaced in PAON Admin
  ([PRODUCT.md](./PRODUCT.md)).
- ✅ Immutable retailer-scoped `BehavioralEvent` capture and the first real
  retailer analytics dashboard. AI-generated recommendations remain deferred
  until a model/provider is configured; the event foundation does not fake AI.

## Phase 6 — Platform maturity

- ✅ Retailer- and platform-scoped analytics dashboards.
- ✅ Retailer subscription billing — Stripe Billing under PAON's own
  platform account (founder decision, ADR-031). Plan assignment
  (PAON Admin), status/renewal display and Stripe-hosted billing
  portal (Retailer Portal `/settings/billing`) are code-complete;
  blocked only on a platform operator provisioning Stripe
  Products/Prices, see `docs/PROJECT_STATE.md` "Credentials needed".
  Self-serve plan upgrade/downgrade and usage-based feature gating
  remain future enhancements — one plan per retailer, platform-staff-assigned only, today.
- Public API (see [API.md](./API.md), [NON_GOALS.md](./NON_GOALS.md) —
  only once a real integration partner exists).
- Anything deferred in [NON_GOALS.md](./NON_GOALS.md) gets re-evaluated
  here, not before.

## How this roadmap changes

A phase only starts once the previous phase's data model has real
retailers and customers using it — sequencing is intentionally strict
because each phase's UI and business logic assume the previous phase's
records exist and are correct. Reordering requires updating this
document and, if it changes a dependency assumption, adding an entry to
[DECISIONS.md](./DECISIONS.md).
