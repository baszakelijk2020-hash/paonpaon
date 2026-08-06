# Domain Model

> **Status:** Active. **Authority:** Rank 8 — Current domain description.
> **Purpose:** explain the shape of the domain model that lives in code,
> the reasoning behind its bounded-context boundaries, and the product ↔
> code term pairings a reader needs to cross between founder/product
> language and type names. **Audience:** architects, senior engineers,
> agents crossing a domain boundary. **Canonical scope:** current
> bounded-context shape and modeling conventions only — never product
> intent (`NORTH_STAR.md`) or schema/RLS mechanics (`DATABASE.md`).
> **Depends on:** `packages/domain/src` (code is the ultimate source of
> truth; this document must be fixed, not the code, on disagreement).
> **Supersedes:** its own pre-2026-08-06 bounded-context list (9–11 named
> contexts), refreshed to the current 34 top-level modules — see
> `docs/archive/pre-documentation-rearchitecture-2026-08-06/`.
> **Related documents:** `docs/documentation-audit/ONTOLOGY_AUDIT.md`,
> `docs/documentation-audit/TERMINOLOGY_AUDIT.md`, `ARCHITECTURE.md`,
> `DATABASE.md`. **Implementation verification date:** 2026-08-06 (module
> list verified against a live `find packages/domain/src -maxdepth 1
-type d` run).

The canonical domain model lives in code at `packages/domain/src`, as
TypeScript types and value objects. This document explains the shape of
that model, the reasoning behind its boundaries, and must be kept in
sync with the code — if they disagree, the code's exported types are
correct and this document is stale and should be fixed.

## Modeling conventions

- **Branded IDs.** Every entity ID is a nominal type (`CustomerId`,
  `RetailerId`, ...), not a bare `string`. See
  `packages/domain/src/shared/branded-id.ts`. This makes "passed a
  CustomerId where a RetailerId was expected" a compile error instead of
  a cross-tenant data bug discovered in production.
- **Money is never a float.** `Money` is an integer minor-unit amount
  plus an ISO 4217 currency code. See `shared/money.ts`.
- **Timestamps and tenancy are structural, not incidental.** Every
  persisted entity extends `Timestamps` (`createdAt`, `updatedAt`,
  soft-delete `deletedAt`). Every tenant-scoped entity carries a
  `retailerId` directly on the entity, not just in the database row.
- **Entities are read models, not classes.** `@paon/domain` defines
  what an entity looks like and the value objects it's built from. It
  does not contain persistence logic (that's `@paon/database`
  repositories) or framework code. Where an invariant needs enforcing
  (e.g. loyalty point arithmetic, role hierarchy), a pure function lives
  alongside the type it operates on — see `retailerRoleAtLeast` in
  `identity/role.ts` as the pattern to follow.

## Bounded contexts

`packages/domain/src` currently has **34 top-level modules** (verified
2026-08-06 — re-run `find packages/domain/src -maxdepth 1 -type d` before
trusting this count on any later date, per the self-correcting rule at the
top of this document).

| Context       | Path             | Owns                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity      | `identity/`      | `User`, `PlatformStaffMember`, `RetailerStaffMember`, role hierarchy (`role.ts`), `StaffRoster`                                                                                                                                                                                                                                                                                           |
| Retailer      | `retailer/`      | `Retailer` (tenant root), `RetailerBranch`, `Subscription`/`SubscriptionPlan`, `CommercialProspect`/`CommercialInquiry`                                                                                                                                                                                                                                                                   |
| Customer      | `customer/`      | `Customer`, `Wishlist`                                                                                                                                                                                                                                                                                                                                                                    |
| Catalog       | `catalog/`       | `Product`, `ProductVariant`, `CatalogueQuery`/`CatalogueIntent`, `CatalogueStorefront` projections, `TieMate`                                                                                                                                                                                                                                                                             |
| Metadata      | `metadata/`      | Canonical/retailer `MetadataConcept`/`MetadataConceptEdge`, `EntityMetadataAssignment`, `MetadataRetailerForm`                                                                                                                                                                                                                                                                            |
| Commerce      | `commerce/`      | `Order`, `OrderLine`, `Payment`, `PosTransaction`                                                                                                                                                                                                                                                                                                                                         |
| Production    | `production/`    | `PhysicalGarment`, `FittingObservation`, `Alteration`/`AlterationTask`, `SerializedPiece`, `SupplierIntelligence`                                                                                                                                                                                                                                                                         |
| Appointments  | `appointments/`  | `Appointment`, `AppointmentCloseout`, `CustomerMoment`                                                                                                                                                                                                                                                                                                                                    |
| Loyalty       | `loyalty/`       | `LoyaltyAccount`, `LoyaltyLedgerEntry`, `LoyaltyMilestones`, `Referral` (consumer loyalty referral only — see "Proposal, Referral and other ambiguous terms" below)                                                                                                                                                                                                                       |
| Engagement    | `engagement/`    | `Notification`, `Messaging`/`Conversation`, `ClientelingNote` (code name for "Relationship Intelligence" — see pairing note below), `RetailerEvent`/`EventRsvp`, `WeddingParty` schema, `NewsletterSubscriber`, `EmailOutboxEntry`/`SmsOutboxEntry`, `CommunicationChannel`                                                                                                               |
| Analytics     | `analytics/`     | `AiGeneration` run records, `BehavioralEvent`, `AuditLogEntry` — see "Retail analytics/KPIs" gap noted in `docs/documentation-audit/ONTOLOGY_AUDIT.md` (no dedicated KPI domain type yet; `analytics-repository.ts` computes ad hoc)                                                                                                                                                      |
| Campaign      | `campaign/`      | `Campaign`, `CampaignLibrary` entries, `RelationshipCalendar` windows, `SevenDayHoneymoon` programme                                                                                                                                                                                                                                                                                      |
| Concept-scan  | `concept-scan/`  | `ConceptScanCode`, concept-order selections (FT-03 QR try-on)                                                                                                                                                                                                                                                                                                                             |
| Concierge     | `concierge/`     | `ServicePlan`, `ServiceMembership`/`ServiceBooking`, `PartnerNetwork` (FT-14 Preferred Tailoring/HighMaintenance)                                                                                                                                                                                                                                                                         |
| Corporate     | `corporate/`     | `CorporateProgramme`, `Tender`, business-development/renewal analytics, `OfficeVisitRequest`, `ProjectLifecycle`, `ServiceDesk`, `RolloutPlanning`, `ConceptGeneration`                                                                                                                                                                                                                   |
| Experience    | `experience/`    | `StoreInstrumentation`                                                                                                                                                                                                                                                                                                                                                                    |
| Fit           | `fit/`           | `MeasurementMonitor` (`MeasurementVersion`, drift/decision types)                                                                                                                                                                                                                                                                                                                         |
| Gifting       | `gifting/`       | `GiftExperience`, `GiftCuratedItem`, `GiftInvitation` (FT-10 Inspiration Box/gift booklet)                                                                                                                                                                                                                                                                                                |
| Import        | `import/`        | Catalogue import pipeline (`ImportPreview`/`Csv`/`Contract`/`Templates`/`Parser`/`Publish`), `ImportEnrichment`                                                                                                                                                                                                                                                                           |
| Integrations  | `integrations/`  | `ProviderAdapters`, `SourceAuthority`, calendar/weather provider clients, `ConnectionLifecycle`, Faden read-only fixture                                                                                                                                                                                                                                                                  |
| Intelligence  | `intelligence/`  | `CustomerFact` (code name for "Self-Portrait" — see pairing note below), `CitedRecommendation`, `AdvisorBrief`, `ClientelingOpportunity`/`ClientelingDashboard`, `Consent`, `StyleProfile`, `ForYou`, `InteractionEvent`/`InteractionSession`, `GroundedAnswer`, `IntelligencePolicy`, `StockPromiseMatching`, `CustomerSegmentation`, `AdvisorCapture` (incl. `SelfPortraitFactPayload`) |
| Inventory     | `inventory/`     | `StockLedger`, `LossPrevention`                                                                                                                                                                                                                                                                                                                                                           |
| Knowledge     | `knowledge/`     | `KnowledgeObject` (Academy), `KnowledgeDiscovery`, `AcademyConsultancy`, `KnowledgeStorefrontPanels`                                                                                                                                                                                                                                                                                      |
| Merchandising | `merchandising/` | `MicroCapsule`/`MicroCapsuleDrop`                                                                                                                                                                                                                                                                                                                                                         |
| Merchant      | `merchant/`      | `MunroMerchant` (retailer marketplace/supply concept)                                                                                                                                                                                                                                                                                                                                     |
| Migration     | `migration/`     | `StagedFileMigration` (data-migration cockpit primitive)                                                                                                                                                                                                                                                                                                                                  |
| Network       | `network/`       | `PartnerAttribution`, `AudienceGovernance`                                                                                                                                                                                                                                                                                                                                                |
| Platform      | `platform/`      | `ModuleKernel` — the 8 module families, entitlement and lifecycle state (R0.3)                                                                                                                                                                                                                                                                                                            |
| Programme     | `programme/`     | `ValidatePhaseCompletion`, `CompletionEvidence`, `ProgrammeProofSeed` — the ADR-068 evidence-discipline machinery itself, expressed as domain code                                                                                                                                                                                                                                        |
| Shared        | `shared/`        | `BrandedId`, `Money`, `Timestamps`, `Address` — cross-cutting value objects every other module builds on                                                                                                                                                                                                                                                                                  |
| Wardrobe      | `wardrobe/`      | `WardrobeItem`, `MorningRoutine` (+`Delivery`/`Occasions`), `Roadmap`, `Lifecycle`, `SuitConfigurator`, `StyleQuiz`, `Sartorial` rules, `SilhouetteAnalysis`, `Outfit`                                                                                                                                                                                                                    |
| Wedding       | `wedding/`       | `MoonstruckPack` (FT-13 groom/best-men journey content — note `WeddingParty` itself is schema-defined in `engagement/`, not here; see `docs/documentation-audit/ONTOLOGY_AUDIT.md` if consolidating)                                                                                                                                                                                      |
| Workflow      | `workflow/`      | `WorkflowDefinition` — the versioned SOP/workflow primitive `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §3 builds its SOP engine proposal on top of                                                                                                                                                                                                                                     |
| Workforce     | `workforce/`     | `Coaching`, `Coverage` (staff shifts), `Community`, `PayrollPeriod`, `Recognition`                                                                                                                                                                                                                                                                                                        |

## Product ↔ code term pairings

Product and founder documents sometimes use a different word for the same
concept code uses. These are intentional two-register vocabularies (product
voice vs. system name), not drift — but a reader moving between the two
needs the pairing stated explicitly:

- **House** (product/founder documents, e.g. `NORTH_STAR.md`) = `Retailer`
  (code, `retailer/retailer.ts`).
- **Self-Portrait** (product documents, e.g. `docs/FOUNDER_TOOL_BLUEPRINTS.md`
  FT-05) = `CustomerFact` (code, `intelligence/customer-fact.ts`). The
  advisor-capture _input_ shape is separately named `SelfPortraitFactPayload`
  (`intelligence/advisor-capture.ts`) — the payload carries the product name,
  the persisted entity does not.
- **Relationship Intelligence** (product documents, the Module 2 family name
  in `NORTH_STAR.md` and the title of `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`)
  = `Clienteling*` types (code, primarily `engagement/clienteling.ts` and
  `intelligence/clienteling-opportunity.ts`/`clienteling-dashboard.ts`). No
  single module owns the whole concept — it is an aggregation across
  `intelligence`, `engagement`, and `customer`, by design (see
  `docs/documentation-audit/ONTOLOGY_AUDIT.md`, "House Memory").

### Proposal, Referral and other ambiguous terms

"Proposal" is unsafe to use unqualified. Three unrelated domain types share
the word, each solving a genuinely different problem, correctly kept
separate: `CaptureBundleProposal` (`intelligence/advisor-capture.ts` — an
AI advisor-capture bundle awaiting review), `PriceChangeProposal`
(`production/production.ts` — an alteration pricing negotiation), and
`ImportEnrichmentFieldProposal` (`import/import-enrichment.ts` — a
catalogue-import field suggestion). None of these is the golden-journey's
"composed proposal" step (`NORTH_STAR.md`) — that step currently has no
dedicated aggregate at all; it is realized as ordinary recommendation
composition plus eventual `Order`/`OrderLine` creation. Always qualify
which "proposal" you mean. Whether the golden-journey step needs its own
tracked entity is an open founder question — see
`docs/documentation-audit/FOUNDER_QUESTIONS.md` Q2.

"Referral" similarly has a narrow, specific meaning today: only
`loyalty/loyalty.ts`'s `Referral`/`ReferralStatus` (a consumer
loyalty-reward mechanic) is implemented. The business-development
"introduction candidate" concept proposed in
`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12 (part of the unbuilt
Relationship Graph) is a different, adjacent concept with zero code
cross-references to the loyalty `Referral` today — see
`docs/documentation-audit/FOUNDER_QUESTIONS.md` Q3 for whether these should
ever unify.

## Key relationships

```
Retailer 1───* RetailerStaffMember ──1 User
Retailer 1───* Customer ──0..1 User (via CustomerAccountLink, many-to-one from the User side)
Retailer 1───* Product 1───* ProductVariant
MetadataConcept 1───* MetadataConceptEdge
MetadataConcept 1───* EntityMetadataAssignment *───1 Product / ProductVariant / future WardrobeItem
EntityMetadataAssignment 1───* MetadataAssignmentReview (append-only decisions)
Retailer 1───* RetailerConceptOverride *───1 MetadataConcept
Customer 1───* Order 1───* OrderLine ──1 ProductVariant
OrderLine 0..1─── ProductionOrder
Customer 1───* PhysicalGarment 0..1─── OrderLine
PhysicalGarment 1───* FittingObservation *───1 FittingSession
PhysicalGarment 1───* Alteration 1───* AlterationTask
Alteration 1───* AlterationStatusHistory       (append-only; validated transitions only)
Alteration 0..1───1 WorkOrderAssignment ──1 Workshop
Alteration 1───* PriceChangeProposal / AlterationPricingHistory
Alteration 1───* ChainOfCustodyEvent / CompletionReview / FulfillmentEvent
Customer 1───1 LoyaltyAccount 1───* LoyaltyLedgerEntry
Customer 1───* Appointment ──0..1 RetailerStaffMember
RetailerStaffMember 1───* AvailabilityWindow
Customer 1───1 Conversation 1───* Message
Customer 1───* WeddingParty (as organizer) 1───* WeddingPartyMember ──1 Customer (each member is also a Customer)
```

## Metadata ownership and review

The Intelligence Platform metadata contracts live in
`packages/domain/src/metadata/`. Their persistence lives in the seven
metadata/fabric tables created by
`20260729174939_create_metadata_foundation.sql`, the review transition in
`20260729181443_add_metadata_review_workflow.sql`, and the typed
`MetadataRepository` / `ProductFabricProfileRepository`.

- `MetadataConcept.retailerId = null` means PAON canonical ownership. A
  retailer-owned concept carries that retailer's branded ID.
- `MetadataConceptEdge` has the same nullable ownership boundary. A canonical
  edge can join canonical concepts only; a retailer edge can join canonical
  concepts and that retailer's own concepts.
- `EntityMetadataAssignment` is always retailer-owned and targets exactly one
  discriminated `Product`, `ProductVariant`, or future `WardrobeItem`. It
  records source, review state, raw supplier value, confidence/evidence, and
  completed-review provenance.
- AI assignments require confidence and evidence. Supplier assignments retain
  the supplier's raw value. Accepted/rejected assignments require reviewer and
  time; pending assignments cannot pretend review already occurred.
- `MetadataAssignmentReview` is an append-only decision snapshot. Terminal
  decisions are submitted through `review_metadata_assignment`, which derives
  the reviewer and time, rejects cross-tenant callers, and makes a repeated
  identical decision a no-op rather than duplicate audit evidence.
- `ProductFabricProfile` keeps numeric fabric weight and concept-linked
  composition outside the concept-label graph. Non-empty composition has
  unique fibre concepts and totals exactly 100%.

Pure compatibility rules reject target/concept/edge ownership combinations;
database triggers, RLS, explicit grants, and the atomic fabric-profile RPC
enforce the same boundary for persisted data.

## Why a Customer is scoped to one Retailer

A `Customer` record — purchase history, loyalty balance, clienteling
notes and relationship preferences — belongs entirely to one retailer relationship. A
shopper who buys from two PAON retailers has two independent `Customer`
rows, each invisible to the other retailer. What is shared is the
**login**: one `User` in the Customer Portal, linked to each per-retailer
`Customer` via `CustomerAccountLink`, so a shopper signs in once and sees
each relationship separately. This mirrors how the business actually
works (retailers do not share client books) and makes tenant isolation
in [DATABASE.md](./DATABASE.md) simple to reason about: nearly every
table's RLS policy is "rows where `retailer_id` matches the caller's
retailer," full stop.

## Why Order, ProductionOrder and Alteration are separate aggregates

**Persistence note (2026-07-29).** `ProductionOrder` exists as a **domain
type** in `@paon/domain` for the intended manufacturing-status projection.
There is **no** `production_orders` table, repository, or generated DB type
today. Supplier/connector work is not started ([ROADMAP.md](./ROADMAP.md),
[ai_snapshot](./ai_snapshot/03_domain_map.md)). Do not treat ProductionOrder
as shipped persistence. Order and Alteration aggregates below **are**
persisted.

Collapsing manufacturing and alteration status onto the `Order` would
force every order to model a superset of every possible workflow,
and would make it impossible to alter a purchase made months earlier
(there is no live order to attach it to). Keeping them separate
aggregates, linked by `orderLineId`, keeps each aggregate's invariants
simple and lets an alteration exist entirely independently of a current
order. See [PRODUCT.md](./PRODUCT.md) "Order vs. Production vs.
Alteration". Because `orderLineId` is genuinely optional on
`Alteration` (a standalone alteration on a past purchase has none),
`Alteration.customerId` is a separate, required field, not derived
transitively through the order line — see docs/DECISIONS.md ADR-015.

An alteration always identifies a `PhysicalGarment`. Fitting data belongs to
that garment through a `FittingObservation`; PAON has no generic customer
measurement or manufacturing fit-profile aggregate. The older
`CustomerFitProfileEntry` foundation is archived by an additive migration and
removed from the active domain (ADR-016). `work_now` tasks can be quoted,
assigned and completed. `future_order_note` tasks remain visible history for
manual future entry into GoCreate and cannot be assigned as current work.

`Alteration` is the work-order aggregate root. Its original quote is immutable;
approved workshop increases/decreases are separate proposal and pricing-history
records. Status history, task notes, pricing history and custody events are
append-only. Employee attribution is part of each operational record: task
notes, status/pricing changes, evidence uploads, custody, completion review and
pickup/delivery identify the responsible staff member; direct-RLS writes derive
that identity in Postgres instead of trusting a submitted staff id. Customer
Portal reads purpose-built safe projections rather than the base aggregate, so
internal notes, evidence, employee identities and unapproved prices are not part
of the customer security surface. Assigned workers likewise read worker-specific
work-order/task projections with customer and pricing fields removed; private
images are reached only through short-lived signed URLs backed by
assignment-aware Storage policies.

## Extending the model

When a new entity is needed:

1. Decide which bounded context it belongs to (add a new one only if it
   genuinely doesn't fit an existing context).
2. Define it in `packages/domain/src/<context>/`, following the
   conventions above (branded ID, `Timestamps`, `retailerId` if
   tenant-scoped).
3. Export it from `packages/domain/src/index.ts`.
4. Add the corresponding table and RLS policy — see
   [DATABASE.md](./DATABASE.md).
5. Update the relationship diagram and table above in this document.

Never define a shape that duplicates an existing entity's purpose with
minor field differences — extend the existing entity or compose a new
value object instead.
