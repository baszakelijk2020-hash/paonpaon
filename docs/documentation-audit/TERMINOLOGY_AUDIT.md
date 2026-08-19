# Terminology Audit

Audit-only deliverable. Maps important terms across documentation, domain
types (`packages/domain/src`), database schema (`supabase/migrations`),
route/UI naming (`apps/*/app`), and tests. Proposes one canonical term per
concept where the evidence supports it; places genuinely unresolved
naming choices in `FOUNDER_QUESTIONS.md`.

---

## Terms that are consistent across all layers (no action needed)

| Term                       | Docs                                                                                                              | Domain type                                           | DB table                                                                                                                                    | Routes                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Customer                   | `Customer`, throughout                                                                                            | `Customer` (`customer/customer.ts`)                   | `customers`                                                                                                                                 | `/customers` (retailer), customer app root                            |
| Retailer                   | "House"/"Retailer" used interchangeably in prose, `Retailer` in code                                              | `Retailer` (`retailer/retailer.ts`)                   | `retailers`                                                                                                                                 | `/retailers` (admin), `/settings` (retailer)                          |
| Order                      | `Order`                                                                                                           | `Order`, `OrderLine` (`commerce/order.ts`)            | `orders`, `order_lines`                                                                                                                     | `/orders` (both apps)                                                 |
| Appointment                | `Appointment`                                                                                                     | `Appointment`, `AvailabilityWindow`                   | `appointments`, `availability_windows`                                                                                                      | `/appointments` (both apps)                                           |
| Alteration                 | `Alteration`                                                                                                      | `Alteration`, `AlterationTask`, `AlterationOperation` | `alterations`, `alteration_tasks`, `alteration_operations`, + 9 more `alteration_*` tables                                                  | `/alterations` (both apps)                                            |
| Wardrobe                   | `WardrobeItem`                                                                                                    | `WardrobeItem`, `WardrobeOwnershipEvent`              | (wardrobe tables not in this audit's 24-table DB sample by name, but domain type + repository confirmed)                                    | `/wardrobe` (customer)                                                |
| Knowledge Object / Academy | "Academy" in product prose (`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §5), `KnowledgeObject` in code and docs | `KnowledgeObject`, `KnowledgeObjectConcept`           | `knowledge_objects`, `knowledge_object_concepts`, `knowledge_object_relations`                                                              | surfaces embedded in `/for-you`, `/wardrobe`; settings at `/metadata` |
| Consent                    | `CustomerConsentState`, `ConsentSnapshot` throughout                                                              | same                                                  | (consent fields live inside customer/behavioral tables, confirmed via `customer_consent_events`/consent columns referenced by the DB audit) | `/account` (customer preferences)                                     |

---

## Term: "House" vs. "Retailer" vs. "Tenant"

- **Product prose** (`NORTH_STAR.md`, `VISION.md`, `docs/FOUNDER_TOOL_BLUEPRINTS.md`,
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`): uses **"House"**
  pervasively as the customer-facing/founder-voiced term for a retailer
  tenant ("this house knows me," "House Memory," "designated tools" are
  scoped per House).
- **Engineering docs and code**: uses **"Retailer"** exclusively —
  `Retailer` type, `retailers` table, `retailer_id` tenancy column,
  `@paon/database` repository names, route segments.
- **"Tenant"** appears only as a generic security/architecture term
  (`ACCESS_MODEL.md`, `ARCHITECTURE.md`, `AGENTS.md`'s "same-tenant foreign
  references") — never as an entity name.
- **Assessment:** not a conflict — "House" is deliberate brand/product
  voice for a "Retailer" tenant, the same way "advisor" is brand voice for
  "retailer_staff." No engineering document ever uses "House" as a type or
  table name, and no product document ever uses "Retailer" in customer-facing
  copy language. This is a two-register vocabulary (product voice vs.
  system name), correctly kept distinct, not naming drift.
- **Canonical term:** keep both, explicitly paired — recommend
  `docs/README.md`'s topic-owner table gain one line stating "House
  (product term) = Retailer (system term)" so a reader encountering "House"
  in a founder document knows immediately which code entity it maps to.
  This is a documentation clarity fix, not a rename.

## Term: "Self-Portrait" vs. "CustomerFact"

- **Product/founder prose:** "Self-Portrait" — `NORTH_STAR.md`,
  `docs/FOUNDER_TOOL_BLUEPRINTS.md` FT-05, `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §13 ("identical KnowledgeCard component... Customer Education").
- **Code:** `CustomerFact` is the persistent entity
  (`packages/domain/src/intelligence/customer-fact.ts`); `SelfPortraitFactPayload`
  exists as an _input payload_ type in `advisor-capture.ts`, one layer
  removed from the stored fact.
- **Assessment:** naming drift between product and code registers, same
  pattern as House/Retailer, but **less consistently paired** — the code
  only uses "Self-Portrait" in one payload-type name, not in the primary
  entity, table, or repository name (`customer_fact.ts`,
  `customer-fact-repository.ts`). A reader who knows the product term
  "Self-Portrait" and greps the codebase for it will find only the payload
  type, not the entity that actually stores the data.
- **Canonical term:** keep "Self-Portrait" as the product/UI term (it is
  customer-facing language used in `FOUNDER_TOOL_BLUEPRINTS.md`'s FT-05
  contract, which is Rank 2 and governs what may be renamed) and
  `CustomerFact` as the schema term, but **add an explicit mapping note** to
  `DOMAIN_MODEL.md` ("Self-Portrait" in product docs = `CustomerFact` in
  code) so the pairing is discoverable the way House/Retailer already is.

## Term: "Mission Control"

- **Referenced in:** `docs/PRODUCT.md`, `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §10 ("already exists as a concept in `PRODUCT.md`... partial build
  (Stage 17.2)"), `docs/vision/PAON_WORKFORCE_MISSION_CONTROL.md`,
  `docs/FOUNDER_TOOL_BLUEPRINTS.md` FT-05 (bundles Mission Control together
  with Self-Portrait as one contract).
- **Code:** no standalone `MissionControl` domain type. The retailer route
  `/mission-control` exists and is backed by
  `clienteling-dashboard-repository.ts` / `clienteling-opportunity-repository.ts`
  / `advisor-brief-repository.ts` — an aggregation surface, not a modeled
  entity.
- **Assessment: this is the one place in the terminology audit where the
  same name is used for two different scopes across documents, not just two
  registers.** `docs/vision/PAON_WORKFORCE_MISSION_CONTROL.md` describes
  Mission Control as the **leadership↔workforce operating layer**
  (scheduling, clock, daily briefing/closeout, coaching). `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §10 describes Mission Control as the surface that **publishes campaigns
  and knowledge cards** to advisors — a leadership-to-advisor _content_
  channel, not a workforce-operations tool. `docs/FOUNDER_TOOL_BLUEPRINTS.md`
  FT-05 bundles it with Self-Portrait as a **customer-cockpit** concept. Three
  documents, three distinct scopes, one name.
- **Canonical term: unresolved — this is a genuine founder-decision
  question, not a documentation-hygiene fix**, because the three scopes
  (workforce ops / content publishing / customer cockpit) are different
  enough that unifying them under one screen would be a product decision,
  not a naming cleanup. Tracked in `FOUNDER_QUESTIONS.md`.

## Term: "Proposal"

- **Code:** three unrelated types share the English word "proposal" with no
  shared interface: `CaptureBundleProposal` (AI advisor-capture →
  fact/follow-up/task), `PriceChangeProposal` (alteration pricing
  negotiation), `ImportEnrichmentFieldProposal` (catalogue import
  enrichment).
- **Docs:** the audit's required ontology scope lists "Proposal" as a named
  concept alongside Order/Appointment, implying a customer-facing composed
  offer (matching `NORTH_STAR.md`'s golden-journey step "composed
  proposal"). No domain type named `Proposal` or `CustomerProposal` exists
  for that meaning — the golden-journey "composed proposal" step is
  currently realized through `cited_recommendations`/order-line composition,
  not a discrete `Proposal` aggregate.
- **Assessment:** not competing modeling (the three code types solve
  genuinely different problems, correctly kept separate), but the word
  **"proposal" is unsafe to use unqualified** in any future document: it
  could mean the AI capture-bundle proposal, the alteration price-change
  proposal, the import enrichment field-proposal, or the golden-journey
  "composed proposal" concept that has no dedicated type at all yet.
- **Canonical term:** always qualify — "capture-bundle proposal,"
  "price-change proposal," "import-enrichment proposal," or "composed
  proposal (golden-journey step, not yet a discrete aggregate)." Recommend
  `DOMAIN_MODEL.md` add a short disambiguation note the next time it is
  touched.

## Term: "Relationship Intelligence" vs. "Relationship Graph" vs. "Clienteling"

- **"Relationship Intelligence"** — used as the Module 2 family name in
  `NORTH_STAR.md` and as the title of `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`.
  No single domain type; realized across `ClientelingNote`,
  `ClientelingOpportunity`, `AdvisorBrief`, `CustomerFact`,
  `InteractionEvent`.
- **"Relationship Graph"** — a specific proposed feature _inside_
  Relationship Intelligence (§12 of the blueprint): a visualization/analytics
  layer over companies/offices/departments/individuals and referral edges.
  Not implemented (confirmed — no graph-shaped table or domain module).
  Distinct from "Relationship Intelligence" (the whole module) even though
  the names are easy to conflate.
- **"Clienteling"** — the term actually used in code
  (`clienteling-repository.ts`, `clienteling-opportunity-repository.ts`,
  `clienteling_notes` table, `/mission-control` UI) for what product
  documents call "Relationship Intelligence."
- **Assessment:** three-way naming drift between the product term
  ("Relationship Intelligence"), the more specific proposed sub-feature
  ("Relationship Graph"), and the code term ("Clienteling"). Genuinely
  confusing for a new reader: "Relationship Intelligence" and "Relationship
  Graph" differ by one word but are not the same scope (module vs. feature),
  and neither matches the code word "Clienteling" at all.
- **Canonical term:** recommend "Relationship Intelligence" as the
  product-facing module name (already Rank-2 ratified via `NORTH_STAR.md`),
  "Relationship Graph" reserved exclusively for the specific unbuilt
  visualization feature (never used loosely as a synonym for the whole
  module), and an explicit mapping note added wherever `Clienteling*` code
  symbols are introduced or documented ("Clienteling* in code = Relationship
  Intelligence in product docs"). This is a documentation clarity fix.

## Term: "Founder tool" / "FT-*"

- **Docs:** `FT-01`…`FT-14`, used consistently across
  `FOUNDER_TOOL_BLUEPRINTS.md`, `DESIGN_PORTS.md`, `CAPABILITY_DISPOSITION.md`,
  `PROJECT_STATE.md`, `NIGHT_LOG.md`.
- **Code:** no shared `FounderTool` type or tag exists anywhere in
  `packages/domain/src` — each FT is realized as ordinary, unrelated domain
  types and routes (e.g. FT-02 is `SilhouetteAnalysisSession`, FT-08 is the
  swipe-deck's wishlist/StyleProfile primitives). The `FT-*` label is a
  **documentation and process concept only**, deliberately not a runtime
  concept.
- **Assessment: not a conflict.** This is intentional — founder tools are a
  governance/traceability grouping over otherwise-ordinary features, not a
  data-model category. Confirmed no document claims otherwise.
- **Canonical term:** no change needed; worth stating explicitly once
  (e.g. in `DOMAIN_MODEL.md`) that "FT-*" is a documentation label, not a
  code concept, so a future engineer doesn't go looking for a
  `founder_tool_id` column.

## Term: "Metadata Graph"

- **Docs:** `docs/vision/02_metadata_graph.md` (the semantic-spine pillar:
  weave/mill/fibre/season/occasion concepts with versioned definitions and
  retailer overrides), `docs/ai_snapshot/15_current_vs_vision.md` (confirms
  it "does not exist — critical gap").
- **Code/DB:** `metadata_concepts`, `metadata_concept_edges`,
  `entity_metadata_assignments` tables and a `metadata` domain module exist,
  but implement a narrower **review/assignment workflow** for taxonomy
  curation, not the full generalized graph-with-versioned-definitions
  described in the vision pillar.
- **Assessment:** not competing definitions — the vision pillar is a
  forward-looking superset of what exists; the existing tables are a
  legitimate first slice, correctly named. No drift, just incompleteness
  (tracked in `IMPLEMENTATION_AUDIT.md`, not a terminology problem).
- **Canonical term:** no change; "Metadata Graph" should continue to mean
  the full vision-pillar concept, and existing `metadata_*` tables should be
  understood as "metadata foundation" (a phrase `docs/DATABASE.md` already
  uses) — a deliberate partial step toward it, not a synonym for it.

## Term: "Fit" / "Fitting" / "Measurement" family

| Term                  | Meaning                                                                                            | Type                                                                                 | Table                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Fitting session       | An appointment-adjacent event where garments are physically fitted                                 | `FittingSession`                                                                     | `fitting_sessions`                                                                              |
| Fitting observation   | A single noted fact from a fitting session (e.g. "sleeve too long")                                | `FittingObservation`                                                                 | `fitting_observations`                                                                          |
| Fit profile candidate | A proposed update to a customer's approved measurements, derived from observations, pending review | `FitProfileCandidate`, `FitProfileCandidateAction`, `FitProfileCandidateObservation` | `fit_profile_candidates`, `fit_profile_candidate_actions`, `fit_profile_candidate_observations` |
| Measurement version   | The approved, immutable, versioned measurement record itself                                       | `MeasurementVersion` (in `packages/domain/src/fit/measurement-monitor.ts`)           | (measurement-monitor tables, confirmed via repository `measurement-monitor-repository.ts`)      |

- **Assessment:** consistent and correctly layered (this is the "three
  layers never collapse" design explicitly stated in
  `docs/vision/PAON_FIT_MEASUREMENT_AND_SERVICE_NETWORK.md`: approved
  measurement / fitting observation / self-scan candidate). No conflict
  found. Included here specifically because it is a case where four
  similarly-named concepts _could_ have been confused but are not — worth
  recording as a positive finding, not just flagging problems.

---

## Obsolete terminology (confirmed dead, correctly archived)

| Term                                                     | Where it appears                                                                                                                                                                                                                                 | Status                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Made to Munro"                                          | `docs/archive/made-to-munro/*` only                                                                                                                                                                                                              | Dead product-name-and-stack (Prisma/NextAuth) from before the current Supabase-based PAON; root `README.md` explicitly warns readers off it. No live document uses this name.                                                                                                                                   |
| "RetailOS"                                               | `docs/ai_snapshot/15_current_vs_vision.md` (as a prior internal name being compared against current vision)                                                                                                                                      | Superseded internal codename; not used in any Rank 0–9 document read in this audit. Low risk.                                                                                                                                                                                                                   |
| "Atelier Munro" (as a literal brand/business to emulate) | Corrected by ADR-071/073 and `docs/audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md`: the term now means "design-research corpus," never "literal spec to copy," and the surrounding Atelier brand/catalogue is explicitly non-requirement | Not obsolete as a _reference_, but its _meaning_ changed materially on 2026-08-01 — any document written before that date using "Atelier Munro" without the corrected framing should be read through the ADR-071/073 lens, not taken literally. No document was found still asserting the literal-copy reading. |

---

## Code names vs. customer-facing names (confirmed intentional, not drift)

| Code/internal name                                         | Customer/product-facing name                                                                         | Where used                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| TableService (code/docs)                                   | "MunroMessenger" in some founder-source material, "consultation"/"messaging" in customer-facing copy | `docs/FOUNDER_TOOL_BLUEPRINTS.md` FT-09 explicitly notes both names refer to the same widget |
| Suit Configurator (code)                                   | "Lapel, pocket and shoulder configurator" (product description)                                      | FT-07                                                                                        |
| Preferred Tailoring / HighMaintenance (code and docs both) | Same terms used consistently at both levels                                                          | FT-14 — no drift                                                                             |

---

## Summary of canonical-term recommendations

| Concept                                | Canonical product term                                | Canonical code term                     | Action needed                                              |
| -------------------------------------- | ----------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Tenant entity                          | House                                                 | `Retailer`                              | Add explicit pairing note to `docs/README.md`              |
| Structured preference/observation fact | Self-Portrait                                         | `CustomerFact`                          | Add explicit pairing note to `DOMAIN_MODEL.md`             |
| Relationship module                    | Relationship Intelligence                             | `Clienteling*`                          | Add explicit pairing note to `DOMAIN_MODEL.md`             |
| Graph visualization sub-feature        | Relationship Graph (never used for the whole module)  | not yet implemented                     | No code action; documentation discipline only              |
| Ambiguous business-decision word       | "proposal" (always qualified)                         | 3 distinct types, correctly separate    | Add disambiguation note to `DOMAIN_MODEL.md`               |
| **Mission Control**                    | **Unresolved — three distinct scopes share one name** | partial (`/mission-control` route only) | **Founder decision required — see `FOUNDER_QUESTIONS.md`** |

Only one terminology question in this audit rises to the level of requiring
founder input; every other finding is a documentation-clarity fix an agent
can execute directly (see `MIGRATION_PLAN.md`).
