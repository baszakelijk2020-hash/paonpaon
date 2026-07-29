# PAON Intelligence Platform

**Status: authoritative technical programme and founder-requirement
traceability for the active programme.** The complete founder product intent
lives in `PAON_FOUNDER_INTELLIGENCE_BRIEF.md`. Code and migrations remain the
truth for what is implemented; `PHASE.md` alone sequences and authorizes work.

## Resume Protocol

Read this block with `AGENTS.md` and the active `PHASE.md` item in ordinary
implementation sessions. Do not reread the full programme unless a conflict
requires it.

- **Current queue item:** `1.2 Metadata persistence, repositories, and RLS`
- **Current requirement IDs:** `CAT-003`, `CAT-004`, `ENG-001`, `ENG-003`
- **Completed programme commits:** `dd695d5` authorized the Intelligence
  Platform programme; `0af9e00` folded the complete founder brief into the
  programme; `f61e53a` added stable traceability and queue contracts; `HEAD`
  implements metadata domain contracts.
- **Available schema/interfaces:** metadata concept/edge/assignment/override/
  target branded types, validation schemas, `ProductFabricProfile`, and pure
  assignment/edge tenancy rules are exported by `@paon/domain`; no metadata
  table or repository exists yet.
- **Checks/deployment state:** the full local repository definition of done
  passes, including 137 `@paon/domain` tests, strict typecheck, lint, all three
  app builds, and formatting. No metadata deployment exists.
- **Real blockers:** none for Stage 1. Missing optional provider credentials do
  not block local/domain/database work.
- **Exact next files/tests:** add the forward metadata migration under
  `supabase/migrations/`, regenerate
  `packages/database/src/generated/database.types.ts`, then add metadata
  repositories and cross-tenant repository/RLS tests.

## 1. Programme intent

PAON evolves from an already broad RetailOS into an intelligent retail
relationship system. The existing storefront, Customer Environment,
clienteling, appointments, loyalty, events, wedding parties, commerce, and
alteration foundations remain. The programme adds one explainable intelligence
layer that serves:

- a metadata-driven catalogue;
- reusable education and discovery cards;
- bulk imports and AI-assisted enrichment with human review;
- structured search and filters;
- customer signals, StyleProfile evidence, and advisor intelligence;
- wardrobe ownership, Wardrobe Roadmaps, and MorningRoutine;
- premium campaigns and meaningful milestones;
- Preferred Tailoring and HighMaintenance concierge services; and
- later compliant commerce, Tie-Mate, and a separate retailer-owner
  marketplace.

PAON owns the canonical menswear taxonomy and knowledge library. Retailers own
their catalogue, customer relationships, local presentation, review choices,
and advice. AI proposes and explains; it does not silently invent or publish.

## 2. Factual starting point

Verified from code and migrations on 2026-07-30:

- `Product` has name, slug, description, status, made-to-order/alterable flags,
  collection membership, primary image, and swatch image.
- `ProductVariant` has SKU, size, color, price, compare-at price, inventory,
  and lead time.
- Storefront category, color, pattern, and season values are derived at request
  time from names, collections, variant color, and founder image-number
  heuristics in `apps/customer/app/r/[slug]/route.ts`.
- `behavioral_events` is an immutable retailer-scoped signal stream, and
  `ai_generations` records next-best-action/product-recommendation attempts.
- Customer preferences, wishlist, orders, appointments, conversations,
  clienteling notes, loyalty, events, physical garments, fittings, alterations,
  and wedding parties exist.
- Metadata domain contracts now exist, but the repository has no metadata,
  knowledge-object, catalogue-import, StyleProfile, wardrobe-item, outfit,
  wardrobe-roadmap, campaign, or concierge-service persistence.

Names below describe intended persistence and later-stage types until their
queue item lands. Documentation must not call them shipped early.

## Requirement traceability

IDs are stable. Split a requirement only by adding a new ID; never reuse or
renumber one. “Current implementation” is factual as of the verified baseline
above. Status changes only after the named acceptance criteria are verified.

| Founder requirement ID | Founder requirement                                                                                                                                                                                        | PAON module                        | Current implementation                                                              | Dependency                                | Implementation phase | Acceptance criteria                                                                                                              | Status             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| CAT-001                | Universal catalogue graph for mills, collections, fibres, weaves, patterns, colours, seasons, garment types, construction, fit, formality, climate, performance, care, style, occasions, and compatibility | `metadata`                         | Domain concepts, edges, targets, enums, and schemas exist; no persistence           | Direction                                 | 1.1–1.3              | Typed concepts/edges exist; accepted assignments cover every named kind; unknowns remain reviewable proposals                    | In progress (1.1)  |
| CAT-002                | Exact composition percentages, fabric weight, supplier reference, and variant-specific facts where genuinely different                                                                                     | `metadata` + `catalog`             | Validated `ProductFabricProfile` contract exists; no persistence                    | CAT-001                                   | 1.1, 1.4             | Composition validates to 100%; exact values persist without duplicating concept labels                                           | In progress (1.1)  |
| CAT-003                | Retailer overrides, canonical ownership, and strict tenant isolation                                                                                                                                       | `metadata`                         | Domain ownership/target compatibility rules exist; no database enforcement          | CAT-001                                   | 1.2–1.4              | Canonical rows are platform-owned; retailer rows/overrides cannot cross tenants or mutate canonical facts                        | In progress (1.1)  |
| CAT-004                | Provenance, source, confidence, evidence, review state, and auditable review                                                                                                                               | `metadata`                         | Assignment/review provenance schemas exist; no review persistence                   | CAT-001                                   | 1.1–1.3              | Every proposal records authority and evidence; AI never bypasses pending review; review actor/time are retained                  | In progress (1.1)  |
| EDU-001                | Reusable commercial education for mills, fibres, fabrics, weaves, construction, collars, styling, care, performance, occasion, value, and tradeoffs                                                        | `knowledge`                        | Static founder information content only                                             | CAT-001, CAT-004                          | 2.1                  | Reviewed reusable objects cover every named topic and explain why, fit, tradeoffs, and value                                     | Not started        |
| EDU-002                | Automatic metadata-backed card selection with ranking and diversity                                                                                                                                        | `knowledge` + `discovery`          | No knowledge/discovery engine                                                       | EDU-001                                   | 2.2                  | Accepted metadata selects three to six explainable, diverse cards under ADR-060 precedence                                       | Not started        |
| EDU-003                | Inject cards into existing desktop/mobile founder information areas without redesign                                                                                                                       | Customer founder storefront        | Canonical HTML has Archetype/Fabric/Sizing areas but no dynamic knowledge cards     | EDU-002                                   | 2.3                  | Narrow hooks render square-image/title/copy cards accessibly with no unrelated visual or interaction drift                       | Not started        |
| IMP-001                | CSV, XLSX, JSON, and future PDF-ready supplier ingestion                                                                                                                                                   | Catalogue import                   | No import model or parser                                                           | CAT-004                                   | 2.5                  | Versioned CSV/XLSX/JSON contracts and fixtures work; source type permits a later PDF extractor without schema redesign           | Not started        |
| IMP-002                | Preserve supplier SKU/reference/raw data; match main/swatches; map categories; validate and detect duplicates                                                                                              | Catalogue import                   | Product create/edit is individual; images and SKUs exist                            | IMP-001                                   | 2.5–2.6              | Preview explains mappings/errors/duplicates; raw identifiers survive; assets match deterministically                             | Not started        |
| IMP-003                | AI-assisted structured extraction with taxonomy validation, evidence/confidence, no invented facts, and pending review                                                                                     | `@paon/ai` + import                | Generic AI generation audit exists; no import enrichment                            | IMP-001, CAT-004                          | 2.7                  | External prompt and provider-neutral schema return validated proposals; unsupported facts fail closed                            | Not started        |
| IMP-004                | Retailer preview, bulk review, resumable transactional publishing, and documented PAON CSV/LLM contract                                                                                                    | Catalogue import + Retailer Portal | No import UI/job/review state                                                       | IMP-001, IMP-002                          | 2.5–2.7              | Valid reviewed rows publish atomically; failed rows remain unpublished/resumable; contracts are downloadable                     | Not started        |
| SRCH-001               | Accepted-metadata search/filter facets for mill, weave, weight, performance, climate, season, pattern, construction, occasion, formality, colour, and price                                                | Catalogue query                    | Keyword/collection/variant-colour/image-number heuristics                           | CAT-002, CAT-004                          | 2.4                  | Active accepted assignments drive indexed facets/ranges with pagination and parity tests                                         | Not started        |
| SRCH-002               | Natural-language intent for travel, humidity, wrinkles, formality, weddings, softness, and approved concepts, with transparent fallback                                                                    | Catalogue query                    | Name/description substring search only                                              | SRCH-001                                  | 2.4                  | Known intent resolves to explainable structured filters; unresolved language is reported without fabricated matches              | Not started        |
| CUST-001               | Consent-aware signals for signed-in views, searches, filters, favourites, cart, knowledge, chat, swipes, appointment intent, and conversion                                                                | `intelligence` events              | Retailer-scoped `behavioral_events` exists without purpose/consent/retention shape  | SRCH-001                                  | 3.1                  | Typed events record purpose, consent snapshot, retention, and lawful anonymous session where applicable                          | Not started        |
| CUST-002               | StyleProfile with explicit and inferred preferences, evidence, polarity, confidence, and recomputation                                                                                                     | `intelligence`                     | Customer preferences exist; no concept evidence or StyleProfile                     | CUST-001                                  | 3.2                  | Declared and inferred fields cannot overwrite each other; every inference is explainable and reproducible                        | Not started        |
| CUST-003               | Visible customer controls and advisor-safe, retailer-scoped access                                                                                                                                         | Customer + advisor intelligence    | Tenant-scoped CRM exists; no intelligence consent controls                          | CUST-001, CUST-002                        | 3.1–3.3              | Withdrawal stops new use and invokes retention rules; advisors see only consented same-retailer evidence                         | Not started        |
| ADV-001                | Advisor-first TableService handoff and grounded AI answers from approved PAON knowledge only                                                                                                               | TableService + `@paon/ai`          | Basic TableService/conversations and audited AI generation exist                    | EDU-002, CUST-002                         | 3.4                  | Human handoff is always available; answers cite approved objects, express uncertainty, and never invent facts                    | Partial foundation |
| ADV-002                | Occasion guidance, preliminary shortlists, summer-wedding discovery, elegant swipe capture, and appointment conversion                                                                                     | TableService + discovery           | Conversation, wishlist, appointment, and legacy swipe UI foundations exist          | ADV-001                                   | 3.4                  | Occasion flow yields traceable evidence, shortlist, explanations, and book-advisor action                                        | Partial foundation |
| ADV-003                | Consented advisor preparation brief and continuation of the online conversation in store                                                                                                                   | Advisor workspace                  | CRM notes/conversations/appointments exist; no aggregated intelligence brief        | CUST-002                                  | 3.3                  | Brief shows need, interests, questions, shortlist, evidence, and preparation without cross-tenant/withdrawn data                 | Not started        |
| WARD-001               | Visual wardrobe containing retailer-bought and externally owned garments                                                                                                                                   | `wardrobe`                         | Physical garments exist for fitting/alteration, not customer wardrobe ownership     | CUST-002, CAT-001                         | 4.1                  | Owned and external items are distinct, visually available, and can link to catalogue metadata without becoming products          | Not started        |
| WARD-002               | Ownership history, condition, age, wear rotation, care, repair, fit notes, combinations, and gaps                                                                                                          | `wardrobe`                         | Garment fitting/alteration records cover only part of service history               | WARD-001                                  | 4.1–4.3              | Typed histories and current state support lifecycle, combinations, gaps, and service explanations                                | Not started        |
| WARD-003               | Tenant-safe customer/advisor collaboration                                                                                                                                                                 | `wardrobe`                         | Existing customer/retailer RLS foundations                                          | WARD-001                                  | 4.1–4.3              | Customer and authorized advisor can collaborate inside one retailer relationship; no retailer-to-retailer sharing                | Not started        |
| ROAD-001               | Advisor-built ideal wardrobe with ranked gaps and staged purchase priorities                                                                                                                               | Wardrobe Roadmap                   | No roadmap entities                                                                 | WARD-001                                  | 4.2                  | Advisor can author goals/gaps/stages; customer sees approved plan and how each purchase fills a gap                              | Not started        |
| ROAD-002               | Complete looks and founder-authored rules for jacket/trouser/shirt/shoe/accessory/pocket-square/fabric/colour/formality/occasion compatibility                                                             | Sartorial knowledge + outfits      | No approved sartorial rule or outfit model                                          | EDU-001, WARD-001                         | 4.2                  | Recommendations link approved rules and owned/catalogue items, remain retailer-controlled, and explain every compatibility claim | Not started        |
| MR-001                 | Opt-in location, weather, temperature, calendar/occasion, wardrobe, catalogue, and StyleProfile inputs                                                                                                     | MorningRoutine                     | No routine/location/weather model                                                   | ROAD-001, CUST-003                        | 4.4                  | Each input has provenance/consent/fallback; location is optional and separately revocable                                        | Not started        |
| MR-002                 | Daily in-app/email recommendations with one-tap save, review, appointment, or purchase paths                                                                                                               | MorningRoutine                     | Notification/email outbox foundations exist; no daily selector                      | MR-001                                    | 4.4–4.5              | Owned garments rank first; recommendations explain why; delivery is opt-in, scheduled, auditable, and unsubscribeable            | Not started        |
| MR-003                 | Retailer-controlled campaign selection and timely service rather than generic advertising                                                                                                                  | MorningRoutine + campaigns         | Newsletter tooling exists; no intelligence campaign controls                        | MR-002, CAMP-002                          | 4.5, 5.1             | Retailer controls eligible products/audiences/schedule; suppression and service relevance are testable                           | Not started        |
| FIT-001                | Order-line self-scan photo upload and notes for purchased garments                                                                                                                                         | Customer wardrobe + fit service    | Order lines and garment attachments exist separately; no self-scan journey          | WARD-001                                  | 4.3                  | Eligible order line/garment accepts customer photo/notes with private storage and advisor handoff                                | Not started        |
| FIT-002                | Customer-reported change, fit freshness, last measured date, escalating stale state, fit-update appointment, and alteration handoff                                                                        | Fit relationship                   | Garment-scoped fitting observations and appointments exist; no freshness projection | FIT-001                                   | 4.3                  | Customer sees factual last official measurement, deterministic freshness, and service actions; advisor receives context          | Not started        |
| FIT-003                | Strict separation of self-reported information from official garment fitting observations                                                                                                                  | Fit relationship                   | ADR-016 garment-scoped official observations exist                                  | FIT-001                                   | 4.3                  | Self reports never populate official measurements; provenance is visible in domain, repository, and UI tests                     | Partial foundation |
| LONG-001               | Garment age, wear/rotation/rest, care, cleaning, repair, and sustainability-led longevity guidance without coercive obsolescence                                                                           | Wardrobe lifecycle                 | Alteration/garment service records exist; no wardrobe rotation model                | WARD-002                                  | 4.3                  | Guidance derives from actual state, is dismissible/explainable, and contains no forced replacement mechanic                      | Not started        |
| MILE-001               | Recognition for first commission, repeat orders, new categories, premium construction, advanced fabric, and comparable tailoring achievements                                                              | Loyalty milestones                 | Loyalty ledger/rewards exist; no tailoring milestone rules                          | CAT-002                                   | 5.2                  | Auditable idempotent rules derive milestones from authoritative records without a second ledger                                  | Not started        |
| MILE-002               | Restrained premium rewards and loyalty progression without gambling or discount-retail presentation                                                                                                        | Loyalty milestones                 | General rewards exist                                                               | MILE-001                                  | 5.2                  | Reward eligibility/value is auditable, capped, premium in tone, and never chance-based                                           | Partial foundation |
| SERV-001               | Preferred Tailoring advisor wardrobe planning and HighMaintenance pressing, cleaning, repair, collection/delivery, and checks                                                                              | Concierge services                 | Appointments, garments, alterations, and staff ownership foundations exist          | WARD-002                                  | 5.3                  | Dedicated service plans compose existing aggregates and expose customer/advisor workflows                                        | Not started        |
| SERV-002               | Service bookings, fulfilment, credits, subscriptions, operational costs, and approved billing boundary                                                                                                     | Concierge services                 | Appointment/alteration/payment/subscription primitives exist separately             | SERV-001, PAY-002 for money movement      | 5.3, 6.1–6.2         | Operational state works without payment; credits/billing activate only through approved provider/compliance design               | Not started        |
| CAMP-001               | Guided seven-day catalogue wardrobe/look creation with elegant tie/shirt/short-lived rewards                                                                                                               | Campaigns                          | No campaign/challenge model                                                         | CUST-002, ROAD-002                        | 5.1                  | Authenticated customer composes seven complete looks; deterministic completion and restrained reward are auditable               | Not started        |
| CAMP-002               | Authenticated private offers with retailer-controlled daily/weekly fabric/category/product/audience/schedule rules                                                                                         | Campaigns                          | No private-offer area or audience model                                             | CUST-003, CAT-002                         | 5.1                  | Consent-aware offers are scheduled, suppressible, explainable, tenant-scoped, and premium in presentation                        | Not started        |
| PAY-001                | Visible payment eligibility and approved one-click purchase using provider-authorized payment data                                                                                                         | Commerce compliance                | Stripe Connect payment foundation exists; no eligibility or reusable-method journey | Compliance gate                           | 6.1–6.2              | Provider/legal design documents eligibility, SCA, custody, refund, accounting, and consent before implementation                 | Blocked by 6.1     |
| PAY-002                | MunroMonnaie-style provider/legal-approved order commitment and deposit; never custom credit/lending/direct debit/stored value/instalments                                                                 | Commerce compliance                | No approved deposit/commitment capability                                           | Compliance gate                           | 6.1–6.2              | Dedicated ADR/provider design authorizes only supported capability; immutable payment/order history remains                      | Blocked by 6.1     |
| TIE-001                | Mobile-first full-screen realistic-scale tie-fabric exploration with save, order, advisor handoff, catalogue, and stock integration                                                                        | Tie-Mate                           | No approved Tie-Mate surface                                                        | EDU-003, ADV-001, approved founder design | 5.4                  | Phone-scale fabrics preserve stock truth and support swipe/save/order/handoff with mobile accessibility                          | Design blocker     |
| MKT-001                | Separate retailer-owner marketplace for mannequins, bags, shoe displays, fixtures, custom furniture, and supplies                                                                                          | Business marketplace               | No marketplace context                                                              | Marketplace ADR + stable programme        | 6.3                  | Separate tenant/customer/catalogue/order assumptions are proven; retailer products never enter customer retail facets            | Not started        |
| ENG-001                | PAON owns canonical taxonomy/knowledge; retailers own tenant catalogue, review, and local overrides                                                                                                        | Metadata + knowledge governance    | Metadata ownership is enforced in domain types/rules; persistence is next           | Direction                                 | 1.1–2.1              | ADR-059/060 ownership rules are enforced in types, database constraints, RLS, and repositories                                   | In progress (1.1)  |
| ENG-002                | Recommendations and AI answers use accepted metadata/approved knowledge, explain why, and respect consent/retention                                                                                        | Intelligence governance            | Audited AI calls exist without the new grounding/consent model                      | EDU-002, CUST-001                         | 2.2–4.5              | Every output exposes evidence/explanation and fails closed when approval or consent is absent                                    | Not started        |
| ENG-003                | Extend branded-ID/domain/repository/Server-Action/RLS/migration/test architecture; do not create a parallel product                                                                                        | Engineering platform               | Architecture exists and is enforced in current code                                 | Direction                                 | All                  | Every slice follows package boundaries, strict TypeScript, forward migrations, generated types, and tenant tests                 | In force           |
| ENG-004                | Preserve founder HTML and interaction behavior through narrow hooks rather than React/Tailwind/design-system rewrites                                                                                      | Founder surfaces                   | Founder route serves canonical HTML with narrow runtime injection                   | ADR-052                                   | 2.3, 5.4             | DOM/CSS diff and desktop/mobile/a11y checks show only authorized mounts changed                                                  | Partial foundation |
| ENG-005                | Continuous inspect→implement→test→repair→state→commit→push loop without routine handoff                                                                                                                    | Delivery governance                | AGENTS/WORKING_AGREEMENT establish the loop                                         | Direction                                 | 0.1 and recurring    | Queue and Resume Protocol remain factual after every pushed slice; agent stops only at real blockers                             | In force           |

## 3. Architecture and bounded contexts

Add four bounded contexts alongside the existing ones:

| Context        | Owns                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| `metadata`     | Concepts, edges, assignments, provenance, review, retailer overrides   |
| `knowledge`    | Reusable education objects, concept links, relations, discovery rules  |
| `intelligence` | Consent-aware evidence, StyleProfile, advisor briefs, recommendations  |
| `wardrobe`     | Owned garments, roadmaps, outfits, condition, care, rotation, services |

Use the established layering:

```text
apps/* Server Components / Server Actions
  → @paon/auth authorization
  → @paon/database repositories
  → Supabase PostgreSQL + RLS

@paon/domain   branded IDs, entities, schemas, pure ranking/validation
@paon/database generated types, repositories, transaction boundaries
@paon/ai       provider-neutral structured proposals and grounded generation
```

Tenant-owned rows carry `retailer_id`. PAON-owned canonical taxonomy and
knowledge rows use platform ownership (`retailer_id = null`). Retailer
assignments and overrides never mutate the canonical row.

Founder-authored `paon-template.html`, `pag1.html`, and `pag3.html` remain the
visual authorities wherever they define a surface (ADR-052). Intelligence is
mounted through narrow data hooks; the programme does not authorize a React or
design-system rewrite of those surfaces.

## 4. Metadata graph

### 4.1 Concepts

```ts
type MetadataConceptKind =
  | "mill"
  | "fabric_collection"
  | "fibre"
  | "weave"
  | "weight_band"
  | "pattern"
  | "colour"
  | "season"
  | "garment_type"
  | "construction"
  | "fit"
  | "formality"
  | "climate"
  | "performance"
  | "care"
  | "style"
  | "occasion"
  | "compatibility"
  | "collar"
  | "silhouette";

type MetadataSource = "supplier" | "ai" | "retailer" | "paon";
type MetadataReviewStatus = "accepted" | "pending" | "rejected";
type MetadataEdgeKind =
  | "parent"
  | "related"
  | "equivalent"
  | "suggests"
  | "compatible_with"
  | "incompatible_with";
type MetadataTargetType = "product" | "product_variant" | "wardrobe_item";
```

Required persistence:

```text
metadata_concepts
- id, retailer_id nullable, kind, slug, canonical_name
- attributes jsonb, image_url nullable, active, timestamps

metadata_concept_edges
- id, retailer_id nullable, source_concept_id, target_concept_id
- kind, weight, timestamps

entity_metadata_assignments
- id, retailer_id, target_type, target_id, concept_id
- source, confidence nullable, review_status
- supplier_value nullable, evidence nullable
- reviewed_by_staff_id nullable, reviewed_at nullable, timestamps

retailer_concept_overrides
- id, retailer_id, concept_id
- display_name nullable, summary_override nullable
- image_url_override nullable, is_hidden, priority_override nullable, timestamps
```

Concept slugs are unique within ownership and kind. Cross-tenant edges or
assignments are rejected in the database, not only in application code.
Canonical rows are platform-managed; retailer rows and overrides are visible
only inside that retailer. Review history is auditable.

### 4.2 Exact product facts

Do not keep independent strings such as `"Hopsack"` or `"summer"` once an
accepted concept represents them. Exact numeric/product-specific facts remain
typed values:

```ts
interface ProductFabricProfile {
  readonly fabricWeightGramsPerSquareMetre?: number;
  readonly composition: readonly {
    readonly fibreConceptId: MetadataConceptId;
    readonly percentage: number;
  }[];
  readonly supplierReference?: string;
}
```

Composition totals must validate. Supplier values and identifiers are retained
even after mapping so an advisor can see provenance. Product-level facts cover
fabric, garment, construction, and discovery unless a SKU/size/color variant
genuinely differs.

## 5. Knowledge library and discovery

Knowledge is reusable PAON expertise, not duplicated product-page copy.

```ts
type KnowledgeDisplayType =
  | "information_card"
  | "accordion"
  | "tooltip"
  | "comparison"
  | "advisor_answer";

type KnowledgeCommercialIntent =
  "educate" | "justify_premium" | "upgrade" | "cross_sell" | "appointment";
```

```text
knowledge_objects
- id, retailer_id nullable, title, slug, summary, body nullable
- image_url nullable, display_types, commercial_intent, priority, active
- timestamps

knowledge_object_concepts
- knowledge_object_id, concept_id, match_strength

knowledge_object_relations
- source_knowledge_object_id, target_knowledge_object_id
```

Retailers may hide, rename, summarize, prioritize, or pin local presentation
without modifying PAON canonical content.

Discovery receives retailer, product, optional customer, journey, viewed cards,
and retailer pins. Candidate eligibility starts with accepted product-concept
matches. Ranking then applies:

```text
accepted concept match
+ journey relevance
+ retailer pin/priority
+ commercial-intent relevance
+ customer novelty
+ relationship proximity
- repeated concept-kind penalty
- already-viewed penalty
```

Return three to six cards and enforce topic diversity: mill,
fibre/composition, weave/performance, construction/detail, and
style/occasion should outrank five near-duplicate fabric cards. Every result
returns a score explanation. AI may summarize approved knowledge but cannot
create runtime facts or outrank accepted content.

The storefront injects selected cards into the existing Archetype, Fabric, and
Sizing disclosure areas without changing established desktop/mobile panel
behavior.

## 6. Search and filters

The catalogue query contract is repository-backed:

```ts
interface CatalogueSearchRequest {
  readonly retailerId: RetailerId;
  readonly query?: string;
  readonly conceptIds?: readonly MetadataConceptId[];
  readonly ranges?: {
    readonly minWeight?: number;
    readonly maxWeight?: number;
    readonly minPriceMinor?: number;
    readonly maxPriceMinor?: number;
  };
  readonly sort: "newest" | "price_asc" | "price_desc" | "relevance";
  readonly page: number;
  readonly pageSize: number;
}
```

- Facets derive from accepted metadata in the retailer's active catalogue.
- Structured filtering is SQL-based and indexed by retailer, product status,
  assignment, concept, and variant price.
- Natural-language terms map to concepts and known intent. “summer wedding,”
  “travel suit,” or “I dislike wrinkles” resolves through climate, weight,
  weave, formality, occasion, and performance concepts.
- Unresolved language produces a transparent fallback, never fabricated
  matches.
- Semantic/vector retrieval waits for accepted metadata and real search/click
  evidence.

The keyword/image heuristics stay in place until this query path reaches
behavioral parity and browser tests protect the transition.

## 7. Bulk import and AI enrichment

Required lifecycle:

```text
catalogue_imports
- id, retailer_id, status, uploaded_by_staff_id
- source_filename, source_type, row_count
- created_at, completed_at nullable

catalogue_import_rows
- id, import_id, row_number, external_sku, raw_payload jsonb
- proposed_product jsonb, validation_errors jsonb
- status: pending | valid | rejected | published

metadata_review_tasks
- id, retailer_id, import_row_id nullable, assignment_id nullable
- proposed_concept_id nullable, proposed_value, source, confidence
- status, reviewed_by_staff_id nullable, reviewed_at nullable
```

Minimum input fields:

```text
external_sku, name, description, garment_type, price, currency,
primary_image_url, swatch_image_url, mill, collection, composition,
weight_gsm, season, colour, supplier_reference
```

Optional fields include weave, pattern, construction, fit, formality,
occasion, climate suitability, performance, and care.

Rules:

- Preserve source rows, supplier identifiers, and raw supplier values.
- Match assets/rows by retailer plus SKU or supplier reference; supplement
  duplicate detection with slug and image fingerprint where available.
- Exact supplier facts follow the retailer's review policy. Inference remains
  pending.
- Unknown terms create reviewable concept proposals, not ungoverned tags.
- AI receives structured rows/descriptions, returns only schema-valid JSON
  with field confidence and evidence, and never invents mill, composition, or
  construction facts.
- Publishing is transactional across product, variants, assets, exact facts,
  and accepted assignments.

The first AI-assisted workflow is an Admin-maintained PAON prompt plus
CSV/XLSX template for external ChatGPT use. A production provider-neutral job
runner follows only after preview/review/publish foundations are proven.

## 8. Customer and advisor intelligence

Existing `behavioral_events` is the starting point, not the finished model.
The programme adds typed events, consent purpose, anonymous session support
where lawful, retention, and evidence:

```text
customer_style_profiles
- id, retailer_id, customer_id
- explicit_preferences jsonb
- inferred_preferences jsonb
- confidence jsonb, updated_at

customer_style_preference_evidence
- id, retailer_id, customer_id, concept_id
- source_event_id nullable, source
- polarity: positive | negative | neutral
- confidence, created_at
```

Track product view, search, filter, favorite, cart, knowledge open, advisor
question, swipe choice, and appointment conversion. Do not duplicate orders,
appointments, messages, or other durable records into the event stream.

Personalization consent and marketing consent are separate. Location is
separate opt-in data and is not required for the initial intelligence release.
Withdrawal stops new personalization and triggers the documented retention/
deletion behavior without erasing business records that must legally remain.

StyleProfile keeps explicit preferences separate from inference. Every inferred
preference links to evidence, polarity, confidence, and recency. An advisor
brief aggregates only retailer-scoped, consented information: recent interests,
saved products, knowledge consumed, declared occasion, evidence, questions,
wardrobe gaps when available, and appointment preparation.

TableService becomes hybrid: early human handoff remains available; AI answers
only from approved knowledge, expresses uncertainty, cites its basis, and can
produce a shortlist or appointment handoff. The existing swipe interaction
becomes guided preference evidence for an occasion, not an isolated novelty.
PAON's recommendation knowledge must progressively encode founder/advisor
sartorial judgement—fabric and colour compatibility, jacket/trouser/shirt/shoe/
accessory relationships, formality, occasion, climate, and complete looks—while
remaining explainable, retailer-controlled, and grounded in approved data.

## 9. Wardrobe intelligence and MorningRoutine

Wardrobe items represent retailer purchases and customer-added external
garments. Both use the metadata assignment/review mechanism. A wardrobe item
may reference a product but is not the product: it records ownership,
condition, fit observations/notes, wear frequency, care needs, and lifecycle
history. It belongs to one retailer-customer relationship and follows ADR-063;
`PhysicalGarment` remains the source for official fitting/service observations.

Wardrobe Roadmaps are advisor-authored plans with goals, ranked gaps, staged
purchases, outfits/complete looks, and explanation links showing how a
recommendation supports what the customer already owns.

MorningRoutine selects owned garments first and catalogue recommendations when
useful, based on:

- wardrobe availability and condition;
- accepted preferences and evidence;
- occasion or calendar input;
- weather; and
- separately consented location.

It explains every choice and offers direct save, book, or buy actions. Daily
in-app/email delivery is opt-in, frequency-controlled, auditable, and
unsubscribeable.

Care, rotation, age, and fit-update reminders attach to owned garments. A
customer may submit a current-wear photo and notes against a wardrobe item,
prompting a fit-update appointment and giving the advisor relevant context.
The Customer Environment shows fit freshness: the last real measured/fitting
date, a progressively more urgent stale status, and a clear appointment action.
Self-reported photos/notes can trigger service but never become formal
measurements.
This does not recreate the archived generic manufacturing fit profile: real
fitting observations remain garment-scoped (ADRs 016 and 055).

## 10. Relationship programmes and concierge services

Campaigns support refined weekly/daily private offers, limited member releases,
and an authenticated private-offers area. Retailers control eligible fabric,
category, product, audience, and schedule. The seven-day wardrobe challenge
lets a client compose ideal catalogue looks for each day and may lead to a
restrained reward such as a personalized tie, shirt, or short-lived controlled
offer. Audiences are consent-aware and explainable; delivery and suppression
are auditable. PAON does not use mass-retail discount gamification.

Milestones extend existing loyalty events/ledger through auditable eligibility
rules: first commission, repeat orders, new categories, premium construction,
and advanced fabrics. They do not create a second balance ledger.

Preferred Tailoring and HighMaintenance use dedicated service plans,
entitlements/credits, bookings, fulfilment, care/repair records, collection/
delivery, and advisor-managed commitments. They compose existing appointments,
alterations, and garments without overloading the Order aggregate.

Tie-Mate is a dedicated mobile-first tie-fabric discovery surface. Fabrics
appear at a true-feeling phone-screen scale so a client can hold the phone in
front of themselves while swiping, then save, order, or start an advisor
conversation through the metadata/discovery foundation.

## 11. Later commerce boundaries

Existing Stripe Connect makes the retailer merchant of record for customer
payments; Stripe Billing handles retailer subscriptions to PAON. Neither
authorizes custom credit or stored-value behavior.

Deposits, stored value, one-click payments, instalments, service subscriptions,
and membership billing require the Stage 6 design gate and ADR-062:
provider capabilities, VAT/accounting, refund/custody rules, SCA, consent,
retention, jurisdiction, and merchant-of-record must be explicit. PAON never
stores raw payment credentials, becomes an unlicensed payment processor, or
implements custom lending.

The Customer Environment may show a payment-eligibility journey and status
only after that gate. The founder's MunroMonnaie intent means a trusted,
provider/legal-approved order commitment and deposit experience—not PAON-issued
credit. Eligible one-click purchase reuses provider-authorized payment data and
existing account information.

The retailer-owner marketplace for mannequins, packaging, shoe displays,
fixtures, custom furniture, and other retail supplies is a separate
catalogue/commerce context. The founder may populate it later. It must not
share customer-retail catalogue assumptions merely to reuse code. ADR-064
requires distinct listing, buyer, order, fulfilment, access, and payment
boundaries while permitting reuse of context-neutral platform primitives.

## 12. Verification standard

Each relevant slice includes:

- domain schema and pure-rule tests;
- repository integration tests against a migrated local database;
- RLS and cross-tenant denial tests;
- import/parser/duplicate/publish fixtures;
- deterministic ranking and explanation tests;
- search/filter end-to-end coverage;
- desktop/mobile founder-storefront browser tests;
- consent withdrawal and advisor-visibility tests;
- grounded-answer and uncertain-handoff tests;
- accessibility checks for injected cards and new controls; and
- the repository-wide definition of done from `AGENTS.md`.

Provider unit tests prove integration shape, not live operation. Live provider
verification is recorded separately and never claimed when credentials are
missing.

## 13. Programme assumptions

- PAON maintains canonical menswear taxonomy and knowledge.
- Retailers curate their own catalogue and local overrides.
- Accepted metadata, not keyword strings, becomes the source for discovery and
  filters.
- Existing founder-authored HTML remains visually authoritative.
- Catalogue Intelligence is the first implementation release; advisor,
  wardrobe, MorningRoutine, campaigns, milestones, concierge, and commerce are
  sequenced dependencies, not discarded ideas.
- Code/migrations win for shipped state; `PHASE.md` wins for order.
