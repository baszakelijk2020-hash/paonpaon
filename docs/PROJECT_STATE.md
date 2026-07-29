# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30.

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Monorepo: pnpm 9 + Turborepo.
- Applications: PAON Admin, Retailer Portal, Customer Portal.
- Shared packages include domain, database, auth, UI, utils, payments, email,
  SMS, and AI.
- Schema source: 89 forward Supabase migrations plus generated TypeScript
  database types.
- CI definition of done: frozen install, lint, typecheck, unit tests, build,
  and format check.

## Implemented baseline relevant to the programme

- Tenant, staff/customer identity, RLS, catalogue, variants, collections,
  storefront, cart/orders/payments, appointments, clienteling/messaging,
  behavioral analytics, AI generation audit, loyalty/referrals/events,
  wedding parties, physical garments/fittings/alterations, commercial plans,
  and Demo Studio foundations exist.
- Product persistence has primary and swatch images but no structured fabric
  profile or metadata assignments.
- Storefront category/color/pattern/season values still come from request-time
  heuristics in `apps/customer/app/r/[slug]/route.ts`.
- `behavioral_events` and `ai_generations` exist; purpose-specific consent,
  StyleProfile evidence, and advisor briefing do not.
- No metadata, knowledge, catalogue-import, wardrobe, roadmap, outfit,
  campaign, or concierge-service tables exist.

## External systems

- Deployment architecture and live project identifiers are documented only in
  `DEPLOYMENT.md`.
- Local root environment does not currently contain Stripe, Resend, OpenAI,
  Twilio, or OpenWeatherMap credentials. Provider-dependent code must not be
  described as live-verified without separate evidence.
- Existing provider unit tests verify integration shape with mocks, not live
  provider operation.

## Current handoff

The documentation-consolidation pass authorizes the PAON Intelligence Platform.
No feature implementation is part of that pass. The next implementation area
is the metadata domain contract in `packages/domain/src/metadata/`, as stated
in the authoritative Resume Protocol.
