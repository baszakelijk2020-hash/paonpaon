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
- Schema source: 105 forward Supabase migrations plus generated TypeScript
  database types.
- CI definition of done: frozen install, lint, typecheck, unit tests, build,
  and format check.

## Implemented baseline relevant to the programme

- Tenant, staff/customer identity, RLS, catalogue, variants, collections,
  storefront, cart/orders/payments, appointments, clienteling/messaging,
  behavioral analytics, AI generation audit, loyalty/referrals/events,
  wedding parties, physical garments/fittings/alterations, commercial plans,
  and Demo Studio foundations exist.
- Product persistence has primary and swatch images plus exact product/variant
  fabric profiles and reviewed metadata assignments.
- Storefront category/color/pattern/season values prefer accepted metadata
  when present and still fall back to request-time heuristics in
  `apps/customer/app/r/[slug]/route.ts`.
- `behavioral_events` and `ai_generations` exist. Purpose-specific consent
  (personalization/marketing/location), typed interaction events with
  consent snapshot/retention/withdrawal anonymization, and customer account
  consent controls now exist; anonymous persistence remains blocked pending
  jurisdiction documentation. StyleProfile declared/inferred preferences,
  concept evidence, deterministic recomputation, and customer inspect/remove
  exist. Consented advisor preparation briefing projects into Retailer Portal
  customer and appointment workspaces. Grounded TableService occasion guidance
  cites approved knowledge, seeds swipe shortlists, and converts to
  appointments. Relationship-scoped wardrobe ownership (retailer-purchased and
  external) with append-only ownership history, Customer `/wardrobe`, and
  Retailer customer wardrobe collaboration exist; `PhysicalGarment` remains
  the fitting/service aggregate. Wardrobe roadmaps (goals/ranked gaps/cited
  stages), outfits/slots, and approved sartorial rules exist; customers approve
  plans and compatibility fails closed without an approved rule. Lifecycle
  events, private self-scan attachments, dismissible longevity guidance, and
  deterministic fit freshness from official observations exist; self-reports
  never write fitting observations. MorningRoutine in-app owned-first
  selection with consent-aware weather/calendar/StyleProfile provenance and
  save/review/book/buy actions exists; opt-in email delivery remains Stage
  4.5.
- Canonical/retailer metadata concepts, edges, assignments, append-only review
  evidence, retailer overrides, exact fabric profiles, an actor-derived review
  RPC, PAON Admin canonical management, the Retailer Portal metadata review
  UI, and product-management fabric/assignment editors exist.
- Canonical/retailer knowledge objects, concept joins, relations, retailer
  hide/presentation/priority/pin overrides, `KnowledgeRepository`,
  `rankKnowledgeDiscovery`, `rankStorefrontKnowledgePanels`, founder PDP
  knowledge mounts, `CatalogueQueryRepository`, intent resolution, and
  idempotent EDU-001 canonical fixtures exist. Public storefront can read
  active knowledge, accepted catalogue assignments, active concepts, and
  fabric profiles for active products.
- Catalogue import jobs, rows, and metadata review tasks exist with RLS,
  versioned CSV/XLSX/JSON parsers, downloadable Admin-maintained LLM contract,
  Retailer Portal preview/review, transactional reviewed-row publishing with
  rollback/resumable retries, and AI enrichment that persists only pending
  review proposals with field-level evidence/confidence. Wardrobe ownership,
  sartorial rules, outfits, wardrobe roadmap, lifecycle, self-scan,
  attachment, and MorningRoutine selection tables exist; no campaign or
  concierge-service tables exist.

## External systems

- Deployment architecture and live project identifiers are documented only in
  `DEPLOYMENT.md`.
- Local root environment does not currently contain Stripe, Resend, OpenAI,
  Twilio, or OpenWeatherMap credentials. Provider-dependent code must not be
  described as live-verified without separate evidence.
- Existing provider unit tests verify integration shape with mocks, not live
  provider operation.

## Current handoff

The founder brief is the complete product-intent authority. The technical
programme traces it through stable requirement IDs, and `PHASE.md` contains
the sole dependency-ordered queue with per-item acceptance/test/boundary
contracts. Stages 1–3 and PHASE 4.1–4.4 (wardrobe ownership through
MorningRoutine selection/actions) are complete. The authoritative Resume
Protocol identifies MorningRoutine delivery and retailer controls (PHASE 4.5)
as the exact continuation point.
