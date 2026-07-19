# Roadmap

Phased by dependency order — each phase's data model and UI depend on
the ones before it. Not date-committed; sequencing, not scheduling.

## Phase 0 — Engineering foundation (this bootstrap)

Monorepo, shared packages (`domain`, `database`, `auth`, `ui`, `utils`),
full domain model, design tokens, linting/formatting/testing/CI,
Supabase and Vercel scaffolding, and this documentation set. No
application features. Done when: `pnpm build`, `pnpm lint`,
`pnpm typecheck` and `pnpm test` are all green on a repository with
three apps that boot and render a placeholder home page each.

## Phase 1 — Identity, Retailer, Customer core

- Supabase Auth wired into all three apps; `@paon/auth` session
  resolution implemented for real (currently types only).
- `Retailer` CRUD in PAON Admin (onboarding a tenant).
- `RetailerStaffMember` invitation and role management in Retailer
  Portal.
- `Customer` CRUD and basic profile in Retailer Portal; Customer Portal
  login and profile.
- First real RLS policies and migrations landed in `supabase/migrations`.

This phase proves the multi-tenant foundation end-to-end before any
commerce logic is built on top of it.

## Phase 2 — Catalog and Commerce

- `Product` / `ProductVariant` / `Collection` authoring in Retailer
  Portal.
- Storefront browsing and `Order` placement in Customer Portal.
- Order management in Retailer Portal.
- `Payment` integration (provider selection tracked as its own
  decision in [DECISIONS.md](./DECISIONS.md) once made).

## Phase 3 — Production, Alteration, Appointments

- `ProductionOrder` tracking, staff-facing and customer-facing status.
- `Alteration` request and tracking flow.
- `Appointment` booking (`AvailabilityWindow` management, customer
  self-booking).

This is the phase that differentiates PAON from generic commerce
platforms — see [VISION.md](./VISION.md).

## Phase 4 — Loyalty, Rewards, Referrals, Events

- `LoyaltyAccount` / `LoyaltyLedgerEntry` accrual on qualifying orders.
- `Reward` redemption.
- `Referral` flow, invite-to-reward.
- `RetailerEvent` / `EventRsvp` for trunk shows and VIP events.

## Phase 5 — Engagement and Personalisation

- `Conversation` / `Message` between customer and staff.
- `Notification` delivery across channels (email/SMS/push/in-app).
- `ClientelingNote` staff tooling.
- AI personalisation built on `BehavioralEvent` — recommendations,
  next-best-action for staff, personalized customer communication —
  with AI monitoring surfaced in PAON Admin
  ([PRODUCT.md](./PRODUCT.md)).

## Phase 6 — Platform maturity

- Retailer- and platform-scoped analytics dashboards.
- Subscription self-serve billing changes, usage-based feature gating.
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
