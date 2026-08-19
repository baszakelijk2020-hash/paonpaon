# System Interaction Audit

Audit-only deliverable. Treats PAON as one operating system and traces the
27 workflows named in the audit brief end to end, grouped into 9 coherent
journeys. Grounded in `ONTOLOGY_AUDIT.md`'s code findings, the FT-*
contracts, and `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`'s proposed
extensions. Where a step is proposed but not yet built, it is marked
**[proposed]**; where this audit could not independently verify a specific
mechanism (would require deeper code tracing than an architecture-level
pass affords), it is marked **[not independently verified]** rather than
asserted either way.

---

## Journey 1 — Onboarding and the appointment lifecycle

Covers: new customer onboarding · returning-customer appointment ·
pre-appointment preparation · during-appointment advisor workflow ·
post-appointment structured debrief.

| Step                                | Initiating actor/action                                                                      | Modules                                                | Canonical entities                                                                                      | State/DB writes                                                               | Permissions                                             | Dashboards/KPIs                            | Gaps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New customer onboarding             | Retailer staff creates a customer record, or a customer self-links via `CustomerAccountLink` | `customer`, `identity`                                 | `Customer`, `CustomerAccountLink`                                                                       | `customers` insert; `retailer_id` stamped                                     | Retailer staff (create), customer (self-link)           | none directly; feeds every downstream KPI  | Lifecycle-state modeling not independently confirmed (`ONTOLOGY_AUDIT.md`)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Returning-customer appointment      | Customer self-books or advisor books                                                         | `appointments`                                         | `Appointment`, `AvailabilityWindow`                                                                     | `appointments` insert                                                         | Customer (self), staff (any)                            | Mission Control "today's appointment" card | none found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Pre-appointment preparation         | System/advisor, triggered by upcoming `Appointment`                                          | `intelligence` (advisor brief), `wardrobe`, `commerce` | `AdvisorBrief` (aggregates `CustomerFact`, order history, open alterations)                             | read-only aggregation; no new canonical write                                 | Advisor-scoped read of assigned customer's House Memory | Mission Control                            | The blueprint's SOP-engine pre-appointment checklist cards **[proposed]** are not yet wired into this brief                                                                                                                                                                                                                                                                                                                                                                                           |
| During-appointment advisor workflow | Advisor, during the session                                                                  | `production` (fit/fitting), `intelligence`             | `FittingObservation`, `CaptureBundleProposal` (FT-01 voice+drag), `SilhouetteAnalysisSession` (FT-02)   | `fitting_observations`, `fit_profile_candidate_observations` inserts          | Advisor-only write                                      | none directly                              | FT-01's voice-capture (Web Speech API) and supplier write-back are explicitly not built (`FOUNDER_TOOL_BLUEPRINTS.md`)                                                                                                                                                                                                                                                                                                                                                                                |
| Post-appointment structured debrief | Advisor, after session                                                                       | `intelligence`                                         | `CustomerFact` (via advisor capture), **[proposed]** `AppointmentDebrief` with 8 categories/32 subtypes | `customer_facts` insert today; the dedicated debrief object is **[proposed]** | Advisor-only write, visibility-tiered                   | House Memory, Mission Control cards        | **This is the single largest named gap in the whole audit**: today, post-appointment capture goes through the general `CustomerFact`/advisor-capture path with no dedicated debrief taxonomy, category enforcement, or "what this deliberately does not do" guardrail (e.g. keeping medical/health data out) that `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §2 specifies. Not a defect — explicitly proposed, not yet sequenced — but the highest-leverage single build item this audit surfaced. |

## Journey 2 — Discovery, recommendation, and browsing

Covers: product recommendation · customer browsing and wishlist · AI
recommendation lifecycle.

- **Initiating actor/action:** customer browses catalogue or swipes (FT-08
  swipe deck).
- **Modules:** `catalog`, `intelligence`, `wardrobe`.
- **Canonical entities:** `Product`/`ProductVariant`, `WishlistItem`,
  `behavioral_events`, `CitedRecommendation`.
- **State changes:** swipe/save writes an idempotent wishlist row and a
  StyleProfile evidence event (confirmed: FT-08's migration "makes
  event+concept evidence idempotent"); recommendation recomputation joins
  the evidence back to reviewed catalogue concepts.
- **Events/audit:** `behavioral_events` insert per interaction; every
  `CitedRecommendation` carries an `EvidenceSource` (structurally enforced,
  per `ARCHITECTURE_AUDIT.md`).
- **Permissions:** customer-scoped; withdrawal (per FT-08) anonymizes
  events, suppresses evidence, clears inference, while the saved garment
  itself survives — a deliberate asymmetry (undoing _inference_, not
  _ownership_).
- **Dashboards/KPIs updated:** `/for-you` surface; not confirmed to feed
  `/analytics` directly (behavioral-event-to-KPI rollup not independently
  traced).
- **AI context updated:** yes — StyleProfile evidence recomputation is the
  direct mechanism.
- **Notifications/follow-ups:** none confirmed beyond the in-app `/for-you`
  surface.
- **Unresolved gaps:** none material — this is one of the most completely
  proven journeys in the system (FT-08 is marked "Verified," the most
  mature status in the FT vocabulary).
- **Duplicated responsibilities:** none.
- **Missing consumers:** the blueprint's proposed "recently viewed
  online/wishlist" **advisor dashboard card** (§4) would consume this same
  evidence for advisor-facing use — **[proposed]**, not yet built, meaning
  today this evidence is customer-facing only, not yet surfaced to staff.

## Journey 3 — Proposal, purchase, and commercial close

Covers: proposal creation/viewing/revision/acceptance/expiry · purchase.

- **Initiating actor/action:** advisor composes a set of recommendations
  into an offer; customer accepts, leading to `Order` creation.
- **Modules:** `intelligence` (composition), `commerce` (order).
- **Canonical entities:** no dedicated `Proposal` aggregate exists for this
  step (see `ONTOLOGY_AUDIT.md`/`TERMINOLOGY_AUDIT.md`) — the "composed
  proposal" step of the golden journey is realized through ordinary
  recommendation composition and order-line creation, not a tracked
  draft→sent→viewed→revised→accepted→expired lifecycle.
- **State changes:** `orders`/`order_lines` insert on purchase.
- **Permissions:** advisor composes, customer accepts (checkout flow).
- **Dashboards/KPIs updated:** conversion rate, average wardrobe value,
  units per transaction (per the KPI set in
  `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §7 — **[not independently
  verified]** whether these are currently computed live or only proposed).
- **Wardrobe updated:** yes — order fulfillment auto-adds purchased items
  to `WardrobeItem` (confirmed producer relationship in `ONTOLOGY_AUDIT.md`).
- **Unresolved gaps:** **this is the single clearest missing-continuation
  finding in the audit.** The golden-journey spine names "composed
  proposal" as its own step, distinct from the order itself, but no code
  entity tracks a proposal's own lifecycle (viewed? revised? expired
  without purchase?) independent of whether an order eventually results.
  Whether this is an intentional simplification (a proposal is just "the
  recommendation set the advisor is currently discussing," not a persisted
  object) or a genuine gap is a founder-confirmable question — see
  `FOUNDER_QUESTIONS.md`.
- **Duplicated responsibilities:** none — the three unrelated code types
  named "proposal" elsewhere (capture-bundle, price-change, import-
  enrichment) do not overlap with this step at all, which is itself worth
  noting: the golden-journey's most product-central named step is the one
  with the least dedicated code.

## Journey 4 — Wardrobe, fit, and aftercare

Covers: garment ownership and wardrobe updates · fitting observations and
fit-profile candidate workflow · alteration and aftercare.

- **Initiating actor/action:** order fulfillment, advisor-added external
  item, or customer photo import → `WardrobeItem` created; fitting session →
  `FittingObservation` → `FitProfileCandidate` → advisor review →
  `MeasurementVersion` update; alteration need → `AlterationTask` →
  `AlterationWorkOrder` → status history → completion.
- **Modules:** `wardrobe`, `production`, `fit`.
- **Canonical entities:** `WardrobeItem`, `WardrobeOwnershipEvent`,
  `FittingObservation`, `FitProfileCandidate(Action/Observation)`,
  `MeasurementVersion`, `Alteration`, `AlterationTask`.
- **State changes/events:** append-only observation chain
  (`supersedes_observation_id`), immutable original alteration quote with
  append-only status history (both confirmed design principles in
  `DOMAIN_MODEL.md` and `ONTOLOGY_AUDIT.md`).
- **Permissions:** advisor-only writes for fitting/measurement; customer
  read + wardrobe self-management (add photo, mark retired).
- **Dashboards/KPIs updated:** average wardrobe value, category penetration
  (proposed KPI set); alteration workshop queue.
- **AI context updated:** fit-profile candidates feed the measurement
  approval decision gate; wardrobe composition feeds MorningRoutine/
  recommendation engine.
- **Notifications/follow-ups:** alteration status changes (confirmed
  pattern via `alteration_fulfillment_events`/`alteration_status_history`
  tables); FT-14's care/aftercare custody handoffs are explicitly not yet
  built end-to-end (blueprint status: "strong operational primitives;
  faithful customer/advisor/partner journey absent").
- **Unresolved gaps:** aftercare (FT-14) — primitives proven via
  `apps/retailer/e2e/services.spec.ts`, but the customer-facing weekly plan
  view is "scoped, not started" as of the latest commit.
- **Duplicated responsibilities:** none.

## Journey 5 — Relationship memory and Mission Control

Covers: relationship-memory updates · Mission Control direction.

- **Initiating actor/action:** any advisor observation, AI inference, or
  customer declaration writes a `CustomerFact`; leadership/manager curates
  campaigns/knowledge for advisor-facing surfaces.
- **Modules:** `intelligence`, `engagement`.
- **Canonical entities:** `CustomerFact` (House Memory/Self-Portrait), the
  aggregation surfaces behind `/mission-control`.
- **State changes:** append-only fact accrual with provenance class and
  visibility tier (confirmed).
- **Permissions:** visibility-tiered per `CustomerFactVisibility`.
- **Dashboards/KPIs updated:** Mission Control cards, per-customer
  composited advisor-preparation-brief.
- **Unresolved gaps: this is the `TERMINOLOGY_AUDIT.md`/`ONTOLOGY_AUDIT.md`
  Mission Control ambiguity, restated as a workflow problem.** "Mission
  Control direction" as a workflow could mean: (a) a manager scheduling
  staff (workforce-ops reading, per `docs/vision/PAON_WORKFORCE_MISSION_CONTROL.md`),
  (b) a manager publishing campaigns/knowledge cards to advisors
  (content-publishing reading, per `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §10), or (c) an advisor's own daily cockpit view of their assigned
  customers (customer-cockpit reading, per FT-05). All three are partially
  realized in the same `/mission-control` route today, meaning the
  _workflow_ itself cannot be traced end-to-end without first resolving
  which of the three it is — flagged, not resolved, in
  `FOUNDER_QUESTIONS.md`.

## Journey 6 — Academy publishing and customer education

Covers: Academy/product-knowledge publishing · customer education.

- **Initiating actor/action:** PAON or retailer authors/overrides a
  `KnowledgeObject`; it surfaces contextually.
- **Modules:** `knowledge`.
- **Canonical entities:** `KnowledgeObject`, `KnowledgeObjectConcept`,
  `RetailerKnowledgeOverride`.
- **State changes:** `knowledge_objects` insert/update; retailer overrides
  layered, not destructive (confirmed pattern from `RetailerKnowledgeOverride`
  existing as a separate type rather than a mutation of the base object).
- **Permissions:** PAON-authored base library, retailer-scoped overrides,
  customer-visible subset filtered by a visibility flag (per blueprint §13,
  confirmed as reusing the identical `KnowledgeCard` component, not a
  parallel customer-education system).
- **Dashboards/KPIs updated:** none directly; feeds Academy roleplay
  **[proposed]** and follow-up/SOP completion-rate KPI **[proposed]**.
- **Unresolved gaps:** the roleplay engine (MunroMentor) and SOP-card
  surfacing are **[proposed]**, not yet built; the base publish→surface loop
  is live today.
- **Duplicated responsibilities:** explicitly checked and ruled out by the
  blueprint itself (§15) and independently confirmed in `ONTOLOGY_AUDIT.md`
  — no parallel knowledge system exists.

## Journey 7 — Buying intelligence, KPIs, and forecasting

Covers: offline product feedback · lost sale due to unavailable
size/colour/assortment · buying intelligence · KPI updates · revenue
forecasting.

- **Initiating actor/action:** advisor records a lost sale at point of
  loss, or online behavioral signal captured automatically.
- **Modules:** `intelligence` (online half, `behavioral_events` — live),
  **[proposed]** `LostSaleEvent` (offline half — not built).
- **Canonical entities:** `behavioral_events` (live); `LostSaleEvent` with
  closed reason vocabulary (color/size unavailable, price objection,
  deferred decision, etc.) — **[proposed]**.
- **State changes:** none for the offline half today — this is the entire
  gap.
- **Dashboards/KPIs updated:** lost-sale rate/reason mix (proposed KPI);
  revenue forecasting's "expected revenue gap," "pipeline quality,"
  "forecast confidence" recommendation kinds (`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  §8) all explicitly depend on this offline signal existing — **[proposed]**,
  chained dependency, not yet built.
- **Unresolved gaps:** the blueprint itself calls offline buying
  intelligence "the genuinely valuable half" — meaning this entire journey
  is currently the weakest-instrumented part of the target system, by the
  founder specification's own admission. Not a documentation defect; a
  build-sequencing fact worth surfacing plainly.
- **Missing consumers:** revenue forecasting and the KPI platform's
  forecast-confidence metric cannot be computed at all until this exists —
  a real dependency chain, not parallel independent gaps.

## Journey 8 — Corporate penetration, referrals, and the relationship graph

Covers: corporate client and company penetration · referral and
warm-introduction capture · relationship graph updates.

- **Initiating actor/action:** BD staff manage `CorporateOpportunity`/
  `CorporateProgrammeMetrics`; customers/advisors create `Referral` rows
  (loyalty-scoped only, today).
- **Modules:** `corporate` (9 files), `loyalty` (referrals).
- **Canonical entities:** `CorporateOpportunity`, `RenewalRiskAssessment`,
  `Referral`. **[proposed, absent]** Relationship Graph nodes/edges.
- **State changes:** corporate opportunity/tender tables (confirmed 9
  corporate repositories); `referrals` insert (loyalty flow only).
- **Dashboards/KPIs updated:** `/corporate` retailer dashboards; company
  penetration/department-gap/referral-chain analytics are **[proposed]**,
  explicitly designed to be "a visualization layer over that existing,
  already-tenant-safe data model," not a new one (blueprint §12).
- **Unresolved gaps:** the "introduction candidate" concept the blueprint
  describes as a BD-flavored, evidence-backed suggestion is scope-adjacent
  to but not the same system as the implemented consumer loyalty
  `Referral` — see `ONTOLOGY_AUDIT.md`'s "Referrals and introductions"
  entry. Whether these should merge is a founder-confirmable design
  question given they currently serve different audiences (consumer reward
  vs. B2B pipeline).
- **Duplicated responsibilities:** none confirmed — the graph is explicitly
  designed not to duplicate `corporate_opportunity_signals`.

## Journey 9 — Services, memberships, and special journeys

Covers: services and memberships · wedding and gift journeys.

- **Initiating actor/action:** customer enrolls in a `ServicePlan`
  (Preferred Tailoring/HighMaintenance, FT-14); wedding party organizer
  creates a `WeddingParty` (FT-13); gift giver curates a `GiftExperience`
  (FT-10).
- **Modules:** `concierge`, `wedding`, `gifting`.
- **Canonical entities:** `ServicePlan`/`ServiceMembership`/
  `ServiceBooking`; `WeddingParty`/`WeddingPartyMember`/
  `WeddingDateCandidate`/`WeddingDesignChoice`/`WeddingGuestVoucher`;
  `GiftExperience`/`GiftCuratedItem`/`GiftInvitation`.
- **State changes:** all three verified live via e2e/pgTAP evidence per
  `FOUNDER_TOOL_BLUEPRINTS.md` (FT-14 `/services` e2e proof 2026-08-06;
  FT-13's five-table cross-tenant RLS fix 2026-08-06 — a real
  cross-tenant integrity bug found and fixed via pgTAP coverage during this
  same period, per the FT-13 entry); FT-10's gift redemption flow (curate →
  invite → anonymous reveal → redeem, never granting marketing consent or
  creating an `Order` directly).
- **Permissions:** organizer-or-assigned-member authorization pattern for
  wedding RPCs (re-derived server-side, not client-trusted, per the FT-13
  entry); gift recipients see only their own reveal, never another
  recipient's activity.
- **Dashboards/KPIs updated:** not independently confirmed to feed
  `/analytics` directly.
- **Unresolved gaps:** FT-14's faithful customer/advisor/partner journey
  (vs. proven primitives) remains open; FT-10's giver payment/request flow
  and recall/refund handling remain open (both explicitly documented as
  such in `FOUNDER_TOOL_BLUEPRINTS.md`, not newly discovered here).
- **Duplicated responsibilities:** none — this journey group is a good
  example of the FT-* governance pattern working as intended: real defects
  (the wedding cross-tenant RLS gap) were found and fixed through the same
  evidence discipline (ADR-068 pgTAP coverage) this audit is evaluating.

---

## Cross-journey findings

1. **The single largest structural gap across all 27 workflows is the
   post-appointment debrief** (Journey 1) — everything downstream
   (Relationship Graph analytics, KPI platform, revenue forecasting, Insider
   Tailoring) that depends on rich, categorized, evidence-cited
   post-appointment facts currently has to make do with the general-purpose
   `CustomerFact` capture path.
2. **The "composed proposal" golden-journey step has no dedicated
   lifecycle entity** (Journey 3) — worth a founder confirmation on whether
   that's intentional.
3. **Mission Control cannot be traced as one workflow** (Journey 5) because
   three source documents assign it three different scopes sharing one
   route — the single highest-priority naming/scope question in the audit.
4. **Buying intelligence's offline half and everything chained to it
   (forecasting, pipeline quality, lost-sale KPIs) is a real, acknowledged,
   sequenced-but-not-yet-built dependency chain** (Journey 7), not a set of
   independent gaps — sequencing it should account for the dependency, not
   just the individual feature.
5. **No missing consumers or redundant integrations were found that
   indicate accidental coupling or duplicated ownership** — every gap
   found in this pass is a _not-yet-built_ proposed extension with a clear
   single intended owner, not a case of two modules racing to own the same
   fact. This matches `ONTOLOGY_AUDIT.md`'s top-line finding: PAON's system
   risk is incompleteness relative to the founder specification, not
   incoherence between what is built.
