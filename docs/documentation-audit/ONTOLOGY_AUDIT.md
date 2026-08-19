# Ontology Audit

Audit-only deliverable. Maps PAON's current and intended ontology across the
26 concepts named in the audit brief. Grounded in a direct code pass over
`packages/domain/src` (34 top-level modules), `packages/database/src`
(106 repository files), `supabase/migrations` (149 tables across 180
migrations), and route trees in `apps/admin`, `apps/retailer`,
`apps/customer`.

Maturity legend: **Modeled** = dedicated domain type + repository + at least
one route; **Partial** = the concept exists but is scattered across other
types, is a payload/projection rather than a first-class entity, or is a
surface with no dedicated type; **Absent** = no code evidence found.

---

## Customer

- **Canonical definition:** an individual who has a relationship with one
  Retailer (House); the root of the golden-relationship-journey spine.
- **Current implementation:** **Modeled.** `Customer`, `CustomerLifecycleStage`,
  `CustomerPreferences`, `CustomerAccountLink`.
- **Owning module:** `packages/domain/src/customer`.
- **Source of truth:** `customers` table.
- **Producers:** onboarding flows (retailer-created or self-service account
  link), commercial-prospect conversion.
- **Consumers:** every retailer-facing module (appointments, orders,
  alterations, wardrobe, relationship intelligence).
- **Lifecycle:** prospect → active customer → (dormant/archived, not
  independently confirmed as a modeled state — see gap below).
- **Permissions:** scoped to one `retailer_id`; customer-app access is
  self-scoped via `CustomerAccountLink`.
- **Duplicate/competing concepts:** none.
- **Missing implementation:** no confirmed lifecycle-state enum beyond
  `CustomerLifecycleStage`'s existence being noted — not independently
  verified whether dormant/churn states are modeled or left to inference.
- **Missing documentation:** `DOMAIN_MODEL.md` should confirm the lifecycle
  enum's actual states now that this audit has flagged the question.

## House / Retailer (tenant)

- **Canonical definition:** the tenant root — an independent premium
  retailer operating one or more locations, entitled to a subset of the 8
  module families.
- **Current implementation:** **Modeled.** `Retailer`, `RetailerStatus`,
  `RetailerTier`, `RetailerBrandTheme(Version)`.
- **Owning module:** `packages/domain/src/retailer`.
- **Source of truth:** `retailers` table.
- **Producers:** admin app retailer-provisioning flow.
- **Consumers:** every tenant-scoped table via `retailer_id`; module
  entitlement checks; RLS policies globally.
- **Lifecycle:** provisioned → active → (suspended/churned per
  `RetailerStatus`).
- **Permissions:** root of the tenancy boundary; platform staff (admin app)
  have cross-tenant read access, retailer staff do not.
- **Duplicate/competing concepts:** none in code. In product prose, "House"
  is the customer-facing synonym — see `TERMINOLOGY_AUDIT.md`.
- **Missing implementation:** none found.
- **Missing documentation:** the House=Retailer pairing (see
  `TERMINOLOGY_AUDIT.md`).

## Advisor / Staff

- **Canonical definition:** a retailer employee who serves customers
  directly (advisor/sales associate) or operates the business
  (manager/owner/production/workshop).
- **Current implementation:** **Modeled**, multi-dimensional.
  `RetailerStaff`/`PlatformStaff` (identity), `StaffShift`/`StaffTimeEntry`
  (roster).
- **Owning module:** `packages/domain/src/identity` (staff-roster,
  retailer-staff/platform-staff schemas).
- **Source of truth:** `retailer_staff_members`, `platform_staff_members`,
  `staff_shifts`, `staff_time_entries` tables.
- **Producers:** retailer-side staff onboarding; admin-side platform-staff
  provisioning.
- **Consumers:** `ACCESS_MODEL.md`'s role hierarchy (read_only →
  production_staff/sales_associate → manager → admin → owner), every
  retailer-scoped write that needs an acting-staff attribution.
- **Lifecycle:** invited → active → deactivated (role hierarchy enforced
  per `ACCESS_MODEL.md`, mechanism in `packages/auth/src/guards.ts`).
- **Permissions:** the most granular permission surface in the system — see
  `ACCESS_MODEL.md`'s explicit caveat that `support_agent` vs.
  `platform_analyst` granularity is not assumed to exist until checked.
- **Duplicate/competing concepts:** none.
- **Missing implementation:** none found; this is one of the more mature
  concepts in the system.
- **Missing documentation:** none beyond the existing honest caveat in
  `ACCESS_MODEL.md`.

## Relationship

- **Canonical definition:** the durable customer↔advisor/House connection
  that all evidence, memory, and intelligence accrues against — the thing
  the entire "Relationship Intelligence" module family is named for.
- **Current implementation:** **Partial — no first-class aggregate.** Only
  `RelationshipDateWindowInput`/`RelationshipDateWindowResult`
  (`packages/domain/src/campaign/relationship-calendar.ts`) exist as code,
  and those are tactical scheduling types, not a modeled customer↔advisor
  relationship entity.
- **Owning module:** implicitly, `customer` + `identity` + `intelligence`
  together — no single module claims it.
- **Source of truth:** none — "relationship" as a concept is currently
  _implied_ by the foreign-key graph (a `Customer` row scoped to a
  `retailer_id`, with `CustomerFact`/`ClientelingNote`/`AdvisorBrief` rows
  hanging off it), not stored as its own row.
- **Producers/consumers:** every module that touches a customer is a de
  facto producer/consumer of "the relationship," which is precisely the
  ontology gap: there is no place a "relationship health," "relationship
  strength," or "primary advisor for this customer" fact would canonically
  live.
- **Lifecycle:** not modeled.
- **Permissions:** inherited from `Customer`/`Retailer` scoping; no
  independent permission surface.
- **Duplicate/competing concepts:** none — this is under-modeling, not
  over-modeling.
- **Missing implementation:** a first-class `Relationship` (or
  `CustomerAdvisorRelationship`) entity, if the product ever needs to answer
  "who is this customer's assigned advisor" as a queryable fact rather than
  an inference from appointment/order history. **Note:**
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12 explicitly and
  deliberately rejects a composite "relationship strength score" as a
  feature — so this gap should not be read as license to build a scoring
  system; it is a request to confirm whether even a _plain_ relationship
  record (advisor assignment, start date) is wanted, independent of any
  scoring.
- **Missing documentation:** `DOMAIN_MODEL.md` does not currently name
  "Relationship" as a bounded context at all, despite it being the word the
  whole Module 2 family is named after.

## House Memory

- **Canonical definition:** the accumulated, evidence-cited record of what a
  House knows about a customer — the second step of the golden-journey
  spine ("House Memory → Advisor Today → composed proposal...").
- **Current implementation:** **Partial — a capability, not a type.**
  Realized as an aggregation of `CustomerFact`, `ClientelingNote`, event
  history, and evidence records, surfaced through `/customers`,
  `/mission-control`, `/appointments` — no unified `HouseMemory` type exists.
- **Owning module:** `intelligence` (primarily), cross-cut by `customer`
  and `engagement`.
- **Source of truth:** distributed across `customer_facts`,
  `clienteling_notes`, `behavioral_events`, `interaction_event` tables.
- **Producers:** advisor capture flows, AI-inferred evidence, appointment
  debriefs.
- **Consumers:** Mission Control surfaces, MorningRoutine, recommendation
  engine, pre-appointment prep.
- **Lifecycle:** append-only fact accrual, with `supersededBy`-style
  versioning at the `CustomerFact` level (confirmed field on the type).
- **Permissions:** visibility-tiered per `ACCESS_MODEL.md` and per
  `CustomerFactVisibility` on the type itself.
- **Duplicate/competing concepts:** none — this is deliberate: `NORTH_STAR.md`
  and `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` both explicitly design
  House Memory as an aggregation _of_ existing primitives rather than a
  parallel store, and the code matches that intent.
- **Missing implementation:** a queryable "House Memory" projection/view
  that assembles the scattered sources into one read model would make the
  concept discoverable in code the way it already is in product language —
  currently a reader has to know to look in four different repositories.
- **Missing documentation:** `DOMAIN_MODEL.md` should name the aggregation
  explicitly, even without a new table, purely as a documented read-model
  pattern.

## Self Portrait

- Covered in depth in `TERMINOLOGY_AUDIT.md`. **Modeled** as `CustomerFact`
  (`packages/domain/src/intelligence/customer-fact.ts`); "Self-Portrait" is
  the product-facing name, `SelfPortraitFactPayload` the advisor-capture
  input shape. Producers: advisor observation, customer self-declaration, AI
  inference (`CustomerFactProvenanceClass` distinguishes these). Consumers:
  Mission Control, MorningRoutine, `/customers`, customer-facing style
  panel. Lifecycle: declared/observed/inferred → confirmed/stale/superseded.
  No duplicate/competing concepts. No missing implementation. Missing
  documentation: the product↔code name pairing (see `TERMINOLOGY_AUDIT.md`).

## Wardrobe

- **Canonical definition:** a customer's owned-garment digital twin.
- **Current implementation:** **Modeled.** `WardrobeItem`,
  `WardrobeOwnershipEvent`, `WardrobeOwnershipKind`,
  `WardrobeFitPerception`, `WardrobeCareState`.
- **Owning module:** `packages/domain/src/wardrobe`.
- **Source of truth:** wardrobe tables (confirmed via
  `wardrobe-repository.ts`, `wardrobe-lifecycle-repository.ts`,
  `wardrobe-roadmap-repository.ts`).
- **Producers:** order fulfillment (auto-add on purchase), advisor-added
  known-external items, customer photo import.
- **Consumers:** MorningRoutine, six-rail wardrobe UI (FT-12),
  recommendation engine, wardrobe-roadmap.
- **Lifecycle:** owned → worn/cared-for → altered/repaired → retired,
  tracked via `WardrobeOwnershipEvent`.
- **Permissions:** customer-owned, advisor-visible per role.
- **Duplicate/competing concepts:** correctly distinguished from `Product`/
  `PhysicalGarment` — see "Garment" below.
- **Missing implementation:** `docs/vision/03_wardrobe_intelligence.md`'s
  fuller twin (wear-frequency analytics, resale estimate,
  replacement-prediction) is not yet built — expected, tracked as a
  vision-pillar gap, not a defect.
- **Missing documentation:** none beyond keeping `docs/vision/03…` correctly
  labeled as target, not current.

## Garment and physical garment

- **Canonical definition:** two distinct facts that must stay distinct: (a)
  a sellable catalog item/SKU, and (b) a specific physical instance a
  customer owns or a workshop is producing.
- **Current implementation:** **Modeled, correctly as two types.**
  `Product`/`ProductVariant` (catalog) in `packages/domain/src/catalog`;
  `PhysicalGarment` (owned/produced instance) in
  `packages/domain/src/production`.
- **Source of truth:** `products`/`product_variants` (catalog) vs.
  `physical_garments` (instance).
- **Relationship:** `PhysicalGarment` can reference an `OrderLine`, which
  references a `ProductVariant` — a 1:1:N chain, not a shared base type.
  `PhysicalGarment` also supports `sourceKind: "external"` for
  customer-imported non-PAON-sold garments.
- **Duplicate/competing concepts: none — verified intentional separation**,
  not a modeling defect. This was the single most likely candidate for
  "the same business fact modeled in multiple places" flagged by the audit
  brief, and it checks out as correct design.
- **Missing implementation/documentation:** none found.

## Appointment

- **Canonical definition:** a scheduled in-person or remote interaction
  between a customer and advisor.
- **Current implementation:** **Modeled.** `Appointment`,
  `AvailabilityWindow`, `AppointmentType`, `AppointmentStatus`.
- **Source of truth:** `appointments`, `availability_windows`.
- **Producers:** customer self-booking, advisor booking,
  consultation-to-appointment conversion (FT-09's `book_appointment_from_consultation`
  RPC).
- **Consumers:** Mission Control ("today's appointment" card),
  pre-appointment prep, post-appointment debrief (per
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §2).
- **Lifecycle:** requested → confirmed → completed/no-show/cancelled.
- **Duplicate/competing concepts:** none.
- **Missing implementation:** the structured post-appointment
  `AppointmentDebrief` object described in
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §2 (8 debrief categories,
  32 subtypes) is a proposed extension, not yet built — tracked as a
  blueprint-to-implementation gap in `IMPLEMENTATION_AUDIT.md`, not an
  ontology defect.

## Proposal

- Covered in depth in `TERMINOLOGY_AUDIT.md`. **Partial — three disjoint,
  correctly-separate types, no unifying "composed proposal" aggregate for
  the golden-journey step of that name.** `CaptureBundleProposal`,
  `PriceChangeProposal`, `ImportEnrichmentFieldProposal`.
- **Missing implementation:** whether the golden-journey "composed proposal"
  step needs its own aggregate, or is intentionally realized as an ordinary
  order/recommendation composition with no discrete "Proposal" row, is
  unresolved and worth a founder confirmation only if product wants a
  trackable proposal-lifecycle (draft/sent/viewed/revised/accepted/expired)
  — currently there is no evidence such a lifecycle is tracked anywhere.
  Flagged in `FOUNDER_QUESTIONS.md`.

## Order

- **Canonical definition:** a committed commercial transaction.
- **Current implementation:** **Modeled.** `Order`, `OrderLine`,
  `OrderStatus`, `OrderChannel`.
- **Source of truth:** `orders`, `order_lines`.
- **Producers:** checkout/POS flows, corporate rollout ordering.
- **Consumers:** wardrobe (auto-add), loyalty accrual, corporate KPI/renewal
  analytics, alterations (order-linked garments).
- **Lifecycle:** draft → placed → fulfilled/returned/cancelled.
- **Duplicate/competing concepts:** none.
- **Missing implementation/documentation:** none found.

## Fit and fitting observations

- **Canonical definition:** in-session, human-recorded facts about how a
  garment sits on a customer.
- **Current implementation:** **Modeled.** `FittingSession`,
  `FittingObservation`, `FitProfileCandidate`,
  `FitProfileCandidateAction`/`Observation` (append-only via
  `supersedes_observation_id`).
- **Source of truth:** `fitting_sessions`, `fitting_observations`,
  `fit_profile_candidates`, `fit_profile_candidate_*`.
- **Producers:** FT-01 (voice+drag fit slider), advisor manual entry.
- **Consumers:** measurement-approval workflow, alteration work orders.
- **Lifecycle:** observed → proposed candidate → advisor-reviewed →
  customer-confirmed/rejected/expired (explicit state machine, confirmed in
  FT-01's contract).
- **Duplicate/competing concepts:** none — correctly kept as its own layer,
  distinct from the approved `MeasurementVersion` (see next).
- **Missing implementation/documentation:** none found.

## Measurements

- **Canonical definition:** the approved, versioned, immutable
  body-measurement record.
- **Current implementation:** **Modeled.** `MeasurementValue`,
  `MeasurementVersion`, `MeasurementDecision`, `MeasurementDecisionResult`,
  `MeasurementApprovalCheck` (`packages/domain/src/fit/measurement-monitor.ts`).
- **Source of truth:** measurement-monitor tables.
- **Producers:** advisor-only entry via `/staff/measurements` (explicitly
  gated — customer self-scan never writes directly here, per the three-layer
  design in `docs/vision/PAON_FIT_MEASUREMENT_AND_SERVICE_NETWORK.md`).
- **Consumers:** MTM ordering, alteration sizing.
- **Lifecycle:** versioned, append-only, with an explicit approval-decision
  gate before a candidate measurement becomes the approved version.
- **Duplicate/competing concepts:** none.
- **Missing implementation:** the smartphone-image drift-detection layer
  (`MeasurementMonitor`'s AI half) described in
  `docs/vision/PAON_FIT_MEASUREMENT_AND_SERVICE_NETWORK.md` is a named
  domain module (`measurement-monitor.ts` exists) but this audit did not
  independently confirm whether the AI drift-scoring is wired to a live
  model or is domain-schema-only — tracked in `IMPLEMENTATION_AUDIT.md`.

## Alterations

- **Canonical definition:** the tailoring service workflow, from work order
  through fulfillment.
- **Current implementation:** **Modeled, extensively.** `Alteration`,
  `AlterationTask`, `AlterationOperation`, `AlterationStatus`,
  `AlterationCatalogueCategory`, `AlterationPriceList`,
  `AlterationPricingHistoryEntry` — 12+ tables, 7 repositories.
- **Source of truth:** `alterations` and 11 sibling `alteration_*` tables.
- **Producers:** post-fitting workflow, `add_alteration_task` RPC (FT-04's
  advisor-only task-creation closure).
- **Consumers:** workshop/production, customer status view, aftercare.
- **Lifecycle:** work-order root, immutable original quote, append-only
  status history (explicit design principle in `DOMAIN_MODEL.md`).
- **Duplicate/competing concepts:** none — the most mature single concept in
  the codebase by table/repository count.
- **Missing implementation/documentation:** none found.

## Mission Control

- Covered in depth in `TERMINOLOGY_AUDIT.md`. **Partial — a route/
  aggregation surface (`/mission-control`), not a modeled entity**, and one
  where three source documents assign it three different scopes (workforce
  ops vs. content-publishing vs. customer cockpit). **This is the single
  highest-priority founder question in the entire audit** — see
  `FOUNDER_QUESTIONS.md`.

## Academy and knowledge cards

- **Canonical definition:** reusable, single-concept education objects
  surfaced contextually (pre-appointment, product page, Academy roleplay,
  customer-facing).
- **Current implementation:** **Modeled.** `KnowledgeObject`,
  `KnowledgeObjectConcept`, `KnowledgeObjectRelation`,
  `RetailerKnowledgeOverride`, `KnowledgeTopic`, `KnowledgeDisplayType`,
  `KnowledgeCommercialIntent`.
- **Source of truth:** `knowledge_objects` and siblings.
- **Producers:** PAON-authored starter library, retailer overrides.
- **Consumers:** `/for-you`, `/wardrobe` (embedded), `/metadata` (retailer
  settings), and — per `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §5 —
  proposed new surfaces (pre-appointment SOP cards, Appointment Debrief,
  Academy roleplay, customer education).
- **Duplicate/competing concepts:** none — `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  explicitly verified it was extending this existing system rather than
  building a parallel one.
- **Missing implementation:** the SOP-card and roleplay-engine surfaces from
  the blueprint are not yet built (expected — blueprint is 2026-08-06, not
  yet sequenced in `PHASE.md`).
- **Missing documentation:** none found.

## Relationship Intelligence

- Covered under "Relationship" and in `TERMINOLOGY_AUDIT.md`.
  **Partial — module name with no unified type**, realized as
  `ClientelingNote`, `ClientelingOpportunity`, `AdvisorBrief`,
  `CustomerFact`, `InteractionEvent` together. This is consistent with the
  design intent (aggregation, not a new store) but means the module
  boundary is a documentation convention, not a code package boundary — the
  closest code package is `intelligence`, but pieces also live in
  `engagement` and `customer`.

## Relationship Graph

- **Canonical definition:** a proposed visualization/analytics layer over
  companies, offices, departments, individuals, and referral/employment
  edges — company penetration, department gaps, referral chains,
  introduction candidates.
- **Current implementation: Absent.** No graph-shaped table, no domain
  module. Confirmed via direct search.
- **Source of truth (proposed):** would extend the existing
  `corporate_opportunity_signals`/BD pipeline (Stage 18.1/18.11/18.12) per
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12 — explicitly _not_ a new
  data model, a visualization layer over existing tenant-safe data.
- **Producers/consumers:** proposed, not built.
- **Duplicate/competing concepts:** none.
- **Explicitly rejected sibling features** (per the blueprint's own §15
  critique — recorded here because it constrains what "missing
  implementation" should mean): composite relationship-strength/influence
  scores, automatic outreach/introduction execution, cross-tenant views.
  These must not be built even once the graph itself is.
- **Missing implementation:** the entire feature. This is a **known,
  explicitly-scoped gap**, not an oversight — `PHASE.md` has not yet
  sequenced it.
- **Missing documentation:** none — the blueprint is thorough. The gap is
  purely implementation timing.

## Corporate Intelligence

- **Canonical definition:** business-development and account-management
  intelligence for corporate (B2B) programmes — tenders, renewal risk,
  opportunity signals.
- **Current implementation:** **Modeled at the sub-type level, no unified
  "CorporateIntelligence" aggregate.** `CorporateProgrammeMetrics`,
  `RenewalRiskAssessment`, `CorporateOpportunity`,
  `CorporateExceptionEvent` — 9 files under
  `packages/domain/src/corporate`.
- **Source of truth:** `commercial_prospects`, `commercial_inquiries`,
  corporate-specific tables (confirmed 9 corporate repositories).
- **Producers/consumers:** `/corporate` (retailer full CRUD, customer
  viewer per organizer role).
- **Duplicate/competing concepts:** none.
- **Missing implementation:** a single `CorporateIntelligence` read-model
  that ties opportunity/tender/renewal-risk together the way "House Memory"
  ties customer facts together would mirror that pattern, but is not
  required — flagged as a possible future consistency improvement, not a
  defect.
- **Missing documentation:** `DOMAIN_MODEL.md` should name the 9-file
  `corporate` module explicitly; it currently does not enumerate it as one
  of its nine listed bounded contexts (see `ARCHITECTURE_AUDIT.md`).

## Referrals and introductions

- **Canonical definition:** a customer- or advisor-initiated introduction of
  a new prospect, tracked to reward/outcome.
- **Current implementation:** **Modeled, narrowly.** `Referral`,
  `ReferralStatus` in `packages/domain/src/loyalty`.
- **Source of truth:** `referrals` table.
- **Producers/consumers:** loyalty programme only (`/loyalty`).
- **Duplicate/competing concepts:** none, but scope mismatch —
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12 describes "introduction
  candidates" as a Relationship Graph analytic (a business-development
  concept), while the only implemented "Referral" is a consumer
  loyalty-reward mechanic. These are conceptually adjacent but not the same
  system, and no document currently states whether they should merge or
  stay separate.
- **Missing implementation:** the BD-flavored "introduction" concept the
  Relationship Graph blueprint describes.
- **Missing documentation:** the loyalty-Referral vs. BD-introduction
  scope distinction should be made explicit once the Relationship Graph is
  scheduled.

## Recommendations

- **Canonical definition:** an AI-assisted, evidence-cited suggestion
  surfaced to a customer or advisor.
- **Current implementation:** **Modeled.** `CitedRecommendation`
  (`RecommendationKind`, `EvidenceSource`),
  `MorningRoutineRecommendation`.
- **Source of truth:** `cited-recommendation-repository.ts`,
  `for-you-repository.ts` (confirms citation is structurally enforced, not
  optional — matching the blueprint's "no black box, ever" principle).
- **Producers:** recommendation engine, MorningRoutine orchestrator.
- **Consumers:** `/for-you`, `/morning-routine`.
- **Duplicate/competing concepts:** none.
- **Missing implementation:** the 11 new recommendation kinds proposed in
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §8 (budget forecasting,
  revenue composition, outlier detection, etc.) are additive to the
  existing `RecommendationKind` enum, not a redesign — straightforward
  extension once sequenced.

## Consent and provenance

- **Canonical definition:** the record of what a customer has consented to,
  and the origin/trust-class of every fact/inference in the system.
- **Current implementation:** **Modeled.** `CustomerConsentState`,
  `ConsentSnapshot`, `CustomerConsentEvent`, `ConsentPurpose`,
  `ConsentStatus`, `ConsentBasis`; `CustomerFactProvenanceClass` on the
  fact side.
- **Source of truth:** consent tables/columns confirmed via
  `customer-consent-repository.ts`.
- **Duplicate/competing concepts:** correctly separated from
  `CustomerPreferences` (UX/channel configuration vs. GDPR eligibility) —
  verified not a duplicate.
- **Missing implementation/documentation:** none found; this is one of the
  more rigorously modeled concepts in the system.

## Retail analytics and KPIs

- **Canonical definition:** operational and financial performance metrics
  (conversion, appointment fill rate, retention, wardrobe value, MTM ratio,
  lost-sale rate, etc. — the 12-KPI set proposed in
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §7).
- **Current implementation:** **Partial — repository-only, no domain
  type.** `analytics-repository.ts` exists and backs `/analytics` (retailer)
  and `/analytics`/`/intelligence-health` (admin), but no
  `packages/domain/src/analytics` type formalizes a KPI as a first-class
  concept (computed ad hoc per query).
- **Missing implementation:** a domain-level KPI definition (name,
  formula, roll-up rule) matching the blueprint's 12-KPI set, distinct from
  the current per-query computation.
- **Missing documentation:** `DOMAIN_MODEL.md` does not list `analytics` as
  one of its nine named bounded contexts despite a repository existing for
  it.

## Buying intelligence

- **Canonical definition:** online + offline signal capture for what
  customers wanted but didn't get (lost sales) alongside what they did buy,
  per `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §9.
- **Current implementation: Absent** as a distinct concept. Online signals
  partially exist via `behavioral_events`; the proposed `LostSaleEvent`
  (offline signal, closed reason vocabulary) has no code evidence.
- **Missing implementation:** the entire offline half (`LostSaleEvent`),
  which the blueprint itself calls "the genuinely valuable half."
- **Missing documentation:** none — well-specified in the blueprint,
  purely awaiting sequencing.

## Services

- **Canonical definition:** concierge/membership offerings (Preferred
  Tailoring, HighMaintenance) — plans, entitlements, bookings.
- **Current implementation:** **Modeled.** `ServicePlan`,
  `ServiceMembership`, `ServiceEntitlement`, `ServiceBooking`,
  `ServiceKind`, `ServicePlanStatus` (`packages/domain/src/concierge`).
- **Source of truth:** service tables (confirmed via `/services` e2e proof
  in FT-14).
- **Duplicate/competing concepts:** none.
- **Missing implementation:** the _faithful customer/advisor/partner
  journey_ FT-14 requires is explicitly unproven, even though the
  primitives are — see `IMPLEMENTATION_AUDIT.md`.

## Founder tools

- Covered in `TERMINOLOGY_AUDIT.md`: **deliberately not a code concept.**
  "FT-*" is a documentation/governance label over otherwise-ordinary
  features. No missing implementation (nothing to implement — it's a
  classification, not an entity); no missing documentation.

## Events and audit history

- **Canonical definition:** immutable append-only records of retailer
  events (RSVP-able) and platform-wide mutation history.
- **Current implementation:** **Modeled.** `RetailerEvent`, `EventRsvp`,
  `EventVisibility`, `EventStatus` (engagement); `AuditLogEntry`
  (platform, append-only, enforced at RLS layer).
- **Source of truth:** `retailer_events`, `event_rsvps`, `audit_log_entries`.
- **Duplicate/competing concepts:** none — two genuinely distinct concepts
  sharing the word "event" (a customer-facing retail event vs. a system
  audit-log entry), correctly modeled as separate types, no drift risk
  because the names don't collide (`RetailerEvent` vs. `AuditLogEntry`).
- **Missing implementation/documentation:** none found.

---

## Cross-cutting finding: where PAON models the same business fact twice

Only **one** genuine candidate was found after checking every concept above,
and it turned out **not** to be duplication:

- `Product`/`ProductVariant` vs. `PhysicalGarment` — verified intentional
  and correctly linked (see "Garment and physical garment" above).

**No other duplicate business-fact modeling was found.** The dominant
pattern in this codebase is under-modeling relative to product ambition
(Relationship, Relationship Graph, Retail Analytics/KPIs, Buying
Intelligence, House Memory-as-a-queryable-thing), not over-modeling or
drift. This is a materially different finding than a typical legacy-system
ontology audit would produce, and is worth stating plainly: **PAON's
ontology risk is incompleteness, not incoherence.**

## Summary table

| Concept                      | Maturity                                            | Owning module                    | Founder decision needed?           |
| ---------------------------- | --------------------------------------------------- | -------------------------------- | ---------------------------------- |
| Customer                     | Modeled                                             | customer                         | No                                 |
| House/Retailer               | Modeled                                             | retailer                         | No                                 |
| Advisor/Staff                | Modeled                                             | identity                         | No                                 |
| Relationship                 | Partial (no aggregate)                              | customer/identity/intelligence   | No — engineering follow-up         |
| House Memory                 | Partial (aggregation, no type)                      | intelligence                     | No                                 |
| Self Portrait                | Modeled (as CustomerFact)                           | intelligence                     | No                                 |
| Wardrobe                     | Modeled                                             | wardrobe                         | No                                 |
| Garment (catalog + physical) | Modeled, correctly dual                             | catalog + production             | No                                 |
| Appointment                  | Modeled                                             | appointments                     | No                                 |
| Proposal                     | Partial, 3 disjoint types                           | intelligence/production/import   | **Yes — see FOUNDER_QUESTIONS.md** |
| Order                        | Modeled                                             | commerce                         | No                                 |
| Fit/fitting observations     | Modeled                                             | production                       | No                                 |
| Measurements                 | Modeled                                             | fit                              | No                                 |
| Alterations                  | Modeled                                             | production                       | No                                 |
| Mission Control              | Partial (route only, 3 competing scopes)            | none                             | **Yes — see FOUNDER_QUESTIONS.md** |
| Academy/knowledge cards      | Modeled                                             | knowledge                        | No                                 |
| Relationship Intelligence    | Partial (aggregation)                               | intelligence/engagement/customer | No                                 |
| Relationship Graph           | Absent (scoped, not built)                          | corporate (proposed)             | No — sequencing, not scope         |
| Corporate Intelligence       | Modeled at sub-type level                           | corporate                        | No                                 |
| Referrals/introductions      | Modeled, narrow scope mismatch vs. BD introductions | loyalty                          | Minor — flagged, not blocking      |
| Recommendations              | Modeled                                             | intelligence                     | No                                 |
| Consent/provenance           | Modeled                                             | intelligence                     | No                                 |
| Retail analytics/KPIs        | Partial (repo only)                                 | (unnamed)                        | No                                 |
| Buying intelligence          | Absent (offline half)                               | (proposed: intelligence)         | No — sequencing                    |
| Services                     | Modeled                                             | concierge                        | No                                 |
| Founder tools                | N/A by design                                       | n/a                              | No                                 |
| Events/audit history         | Modeled                                             | engagement/platform              | No                                 |
