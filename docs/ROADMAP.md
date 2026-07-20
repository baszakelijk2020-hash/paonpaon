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
- ✅ AI personalisation built on `BehavioralEvent` — OpenAI behind a
  provider-neutral interface (founder decision, ADR-033). Next-best-action
  for staff shipped (Retailer Portal customer detail page); product
  recommendations shipped as customer-facing "Today's Pick" (ADR-035);
  personalized customer communication is still modeled
  (`AIGenerationKind`) but not wired to a call site. AI monitoring
  shipped in PAON Admin (`/ai-monitoring`). Code-complete, blocked only
  on a platform operator provisioning an OpenAI API key, see
  `docs/PROJECT_STATE.md` "Credentials needed".
- ✅ Immutable retailer-scoped `BehavioralEvent` capture, actually
  instrumented on the customer storefront (product views, category
  browsing) as of ADR-035, and the first real retailer analytics
  dashboard — the foundation the AI personalisation slice above builds
  its context from. Self-Portrait (ADR-034) is the composed read view
  of this data on the retailer customer record.
- ✅ `WeddingParty` / `WeddingPartyMember` (ADR-035, overriding
  ADR-034's earlier deferral) — an organizer and their invited party
  members, each getting their own guest `Customer` identity and
  self-service fitting-status tracking, staff-managed per retailer.
  Scoped to coordination (roster, fitting status, appointments); no
  wedding-specific marketing/lead-gen funnel was built.

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

## Phase 7 — Founder-directed, not yet built (2026-07-21)

A large batch of asks landed in one session (ADR-035's scope plus
this list) faster than they can be responsibly built and verified.
Recorded here so none of it is lost, roughly in the order it should
be picked up. None of these have any code yet unless noted.

- **Back-office premium visual pass.** ADR-034 drew a line — premium/
  editorial styling for the customer storefront, quiet/restrained for
  admin and retailer portal back-office. The founder's later messages
  ask for paon.html's language "on literally all pages, all
  interfaces." Treat this as superseding that line: extend the same
  token-driven heading/color/radius treatment already used across the
  customer app to `apps/retailer` and `apps/admin` — mechanical, since
  every page already reads the same `--font-display`/`--color-stone-*`
  tokens `packages/ui` defines centrally.
- **Wedding Party visual redesign.** What shipped (ADR-035) is a
  functional roster — plain tables, dropdowns, Cards — not a redesign
  matching the founder's original wedding-tool HTML mockup's actual
  layout. Functionally complete; visually still default back-office.
- **Staff planning/roster tool.** A shift-scheduling surface for
  retailer staff — new domain concept, not an extension of
  `AvailabilityWindow` (that's customer-appointment availability, a
  different thing). Needs its own scoping pass: what "roster" means
  here (weekly shift grid? time-off requests? workshop capacity
  planning?) before a data model is worth committing to.
- **Shipping/pickup carrier selection.** A preference field on the
  customer address card (DHL, PostNL, local pickup, "preferred
  carrier") is buildable now with no credentials — a UI-only addition
  to `CustomerPreferences`/order fulfillment. Actual label generation,
  rate shopping or tracking against a real carrier API is a separate,
  much larger integration needing real DHL/PostNL/carrier credentials
  this deployment does not have — do not fabricate a working "buy
  shipping label" button before those exist.
- **SMS/WhatsApp notifications.** `docs/PROJECT_STATE.md`'s Resend
  slice (ADR-032) already established the provider-neutral pattern
  (`notification_channel` enum already includes `sms`/`push`, the
  `email_outbox`-style durable queue is generalizable). No SMS/WhatsApp
  provider is chosen or has credentials — this is the same shape of
  work as Resend, blocked the same way, not started.
- **Alteration operation depth**: per-employee login/photo/notes
  attribution already exists in large part (`AlterationAttachmentId`,
  `ChainOfCustodyEvent`, `CompletionReview`, `AlterationTaskNote`
  in the domain model — see DOMAIN_MODEL.md) — audit what's actually
  wired into UI before assuming a rebuild is needed. What's explicitly
  not built: a customer-facing "your alteration is ready" push
  notification trigger (the `notifications` table/category already
  supports `alteration_update`, wiring a trigger on the relevant
  status transition is small); a dedicated manager cost-approval
  dashboard distinct from the existing pricing-history/proposal
  records; and a stated "watertight fraud-prevention calculation" —
  needs a concrete definition of what fraud pattern is being guarded
  against before designing controls against it.
- **Dynamic pricing / idle-customer re-engagement.** "Full insight
  into customer online behavior... dynamic pricing... track buying
  patterns... know when to clientele" is a real analytics/personalisation
  engine, not a UI feature — needs its own domain concept (a
  "re-engagement window" or "purchase cadence" model per customer,
  computed from `BehavioralEvent`/`Order` history) and a pricing-rules
  concept that doesn't exist anywhere in the current commerce domain
  (today: one fixed price per `ProductVariant`, no discount/promotion
  primitives at all). The single largest item on this list — deserves
  its own dedicated design pass, not a bolt-on.

## How this roadmap changes

A phase only starts once the previous phase's data model has real
retailers and customers using it — sequencing is intentionally strict
because each phase's UI and business logic assume the previous phase's
records exist and are correct. Reordering requires updating this
document and, if it changes a dependency assumption, adding an entry to
[DECISIONS.md](./DECISIONS.md).
