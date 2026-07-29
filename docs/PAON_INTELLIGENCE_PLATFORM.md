# PAON Intelligence Platform

**Status: authoritative product and technical specification for the active
programme.** Code and migrations remain the truth for what is implemented;
`PHASE.md` alone sequences and authorizes work.

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
- The repository has no metadata concept, knowledge object, catalogue import,
  StyleProfile, wardrobe item, outfit, wardrobe roadmap, campaign, or
  concierge-service persistence.

Names below describe intended types and tables until their queue item lands.
Documentation must not call them shipped early.

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
  | "collection"
  | "fibre"
  | "composition"
  | "weave"
  | "weight_band"
  | "season"
  | "colour"
  | "pattern"
  | "garment_type"
  | "construction"
  | "collar"
  | "performance"
  | "formality"
  | "occasion"
  | "climate"
  | "care"
  | "style"
  | "silhouette";

type MetadataSource = "supplier" | "ai" | "retailer" | "paon";
type MetadataReviewStatus = "accepted" | "pending" | "rejected";
type MetadataEdgeKind = "parent" | "related" | "equivalent" | "suggests";
type MetadataTargetType = "product" | "product_variant" | "wardrobe_item";
```

Required persistence:

```text
metadata_concepts
- id, retailer_id nullable, kind, slug, canonical_name
- attributes jsonb, image_url nullable, active, timestamps

metadata_concept_edges
- id, source_concept_id, target_concept_id, kind, weight, timestamps

entity_metadata_assignments
- id, retailer_id, target_type, target_id, concept_id
- source, confidence nullable, review_status
- supplier_value nullable, evidence nullable
- accepted_by_staff_id nullable, accepted_at nullable, timestamps

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
  readonly fabricWeightGramsPerMetre?: number;
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

## 9. Wardrobe intelligence and MorningRoutine

Wardrobe items represent retailer purchases and customer-added external
garments. Both use the metadata assignment/review mechanism. A wardrobe item
may reference a product but is not the product: it records ownership,
condition, fit observations/notes, wear frequency, care needs, and lifecycle
history.

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
This does not recreate the archived generic manufacturing fit profile: real
fitting observations remain garment-scoped (ADRs 016 and 055).

## 10. Relationship programmes and concierge services

Campaigns support refined weekly private offers, limited member releases, and
the seven-day wardrobe challenge. Audiences are consent-aware and explainable;
delivery and suppression are auditable. PAON does not use mass-retail
discount gamification.

Milestones extend existing loyalty events/ledger through auditable eligibility
rules: first commission, repeat orders, new categories, premium construction,
and advanced fabrics. They do not create a second balance ledger.

Preferred Tailoring and HighMaintenance use dedicated service plans,
entitlements/credits, bookings, fulfilment, care/repair records, collection/
delivery, and advisor-managed commitments. They compose existing appointments,
alterations, and garments without overloading the Order aggregate.

Tie-Mate is a dedicated mobile-first tie-fabric discovery surface that uses the
metadata/discovery foundation and ends in a shortlist, order, or advisor
conversation.

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

The retailer-owner marketplace for fixtures, packaging, displays, and
furnishings is a separate catalogue/commerce context. It must not share
customer-retail catalogue assumptions merely to reuse code.

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

## Resume Protocol

Keep this block compact and update it after every completed slice.

- **Current queue item:** `1.1 Domain contracts`
- **Completed programme commits:** `HEAD` — documentation consolidation and
  programme authorization; no Intelligence Platform feature slice has landed
  yet.
- **Verification status:** documentation consistency and repository checks are
  recorded in the consolidation commit/CI; metadata feature verification has
  not started.
- **Hard blockers:** none for Stage 1. Live Stripe, Resend, OpenAI, Twilio, and
  weather credentials are absent locally, but they do not block metadata
  domain work.
- **Next exact area:** `packages/domain/src/shared/branded-id.ts`, new
  `packages/domain/src/metadata/` contracts/schemas/tests, exports in
  `packages/domain/src/index.ts`, then update `docs/DOMAIN_MODEL.md`.
