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
- Schema source: 108 forward Supabase migrations plus generated TypeScript
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
  save/review/book/buy actions exists; explicit opt-in delivery with
  frequency/quiet hours, append-only audit, and retailer pause/eligible-product
  controls exist.
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
  attachment, MorningRoutine selection, MorningRoutine delivery, campaign,
  private-offer, and seven-day wardrobe-challenge tables exist; loyalty
  milestone definition/award tables exist and write through the existing
  loyalty ledger; Preferred Tailoring / HighMaintenance service-plan,
  membership, entitlement, booking, fulfilment, care, cost, and history
  tables exist.

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
contracts. Stages 1–4 and PHASE 5.1–5.3 (campaigns, loyalty milestones, and
Preferred Tailoring / HighMaintenance operations) are complete. The
authoritative Resume Protocol identifies Tie-Mate (PHASE 5.4) as the next
queue item. The Hermès Tie Break–like concept and domain deck/photo/handoff
contract are authorized (ADR-065); the customer UI remains paused until an
approved founder mobile surface exists under ADR-052. Stage 6.1–6.3 are not
independently buildable (compliance gate; marketplace not explicitly
activated).
