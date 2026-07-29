# 02 — Universal Metadata Graph

**Status: architectural destination, not shipped.** The semantic spine of
PAON. Not string tags. Not a work ticket — see [PHASE.md](../PHASE.md) and
[vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Catalog is thin. Category, colour, pattern and season are
keyword heuristics in `apps/customer/app/r/[slug]/route.ts` — ephemeral,
uneditable, invisible to AI and wardrobe. Without a graph, every feature
reinvents classification.

**Non-goals (Phase 0).** Not Brand entity (deferred — COMPETITIVE_GAPS).
Not live AI enrichment runtime. Not import wizard UI. Not embeddings
infrastructure. Not displacing heuristics in the same slice as schema
(consumer slice comes later; ADR-052 intact).

## 2. Bounded context and intended entities

| Entity                     | Role                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MetadataConcept`          | Typed node: weave, mill, fibre, season, performance, occasion, formality, …                                   |
| `MetadataEdge`             | parent / related / equivalent / suggests                                                                      |
| `EntityMetadataAssignment` | Polymorphic attach: `product`, `product_variant`, later `physical_garment`                                    |
| Assignment provenance      | `source`: supplier \| ai \| retailer \| manual; `confidence`; `reviewStatus`: accepted \| pending \| rejected |
| `ConceptVersion`           | Versioning of definitions and edges                                                                           |
| `ConceptLocale`            | Multilingual labels/descriptions                                                                              |
| `RetailerConceptOverride`  | House-specific label or suppressed platform concept                                                           |

**First wedge (Product + fabric):** mill, weave, weight (g/m²), season,
performance (breathability, wrinkle resistance, travel suitability),
composition/fibre. Enough to replace heuristics and power travel/climate
reasoning later.

Example concept (not a tag string):

- Category → Weave → Value Hopsack
- Parent → Open Weaves
- Properties → high breathability, summer, textured, wrinkle resistant
- Related → Fresco, Tropical Wool, Panama
- Commercial intent → recommend summer / travel tailoring

## 3. Relationships to other pillars

**Every other pillar depends on this.** Wardrobe items, lifestyle climate,
scoring dimensions, outfits, colour palettes, lifecycle replacement and
recommendations must reference concepts — not free text.

## 4. Consumer surfaces

- Horizon A+: auto-derived filters (no manual filter config)
- Discovery knowledge attach
- Retailer review queue for AI-inferred assignments (later)
- Admin platform taxonomy maintenance (later)

## 5. Data ownership and tenancy

Platform taxonomy (`retailerId` null) + retailer overrides and assignments
scoped by `retailerId`. RLS on assignments. Customers never mutate catalog
taxonomy.

## 6. AI contracts

Enrichment (later): input supplier description / row; output proposed
assignments with confidence and source=`ai`, reviewStatus=`pending`.
Never auto-accept below threshold. ChatGPT-assisted **offline** workflow
is specified below for humans before import — not a production dependency
on OpenAI keys in Phase 0.

### ChatGPT-assisted import (documentation contract)

1. Export supplier catalogue (CSV / Excel / JSON / XML / API dump).
2. Feed into ChatGPT (or compatible LLM) with a standardised PAON prompt.
3. Prompt requires: identify products; extract factual attributes only;
   infer only at high confidence; flag uncertain values; preserve SKUs;
   emit JSON/CSV matching PAON import schema; never invent mills.
4. Human review → import into pending assignments.

Validation rules: required mill/weave/weight when garment is cloth-based;
unknown concept → new pending concept proposal, not silent string.
Confidence scoring mandatory on every inferred field.

### Supplier pipelines (later horizons)

1. Structured files (CSV/Excel/JSON/XML/API) mapped to concepts
2. Description NLP extraction
3. PDF / lookbook / technical sheet ingestion
4. Bulk AI enrichment of entire collections with review

### Import wizard (later)

Preview mappings, missing metadata, inferred suggestions, duplicates,
taxonomy validation, publish gate.

### Embeddings (contract only)

Concept and product embedding space for semantic search (“I travel a lot”
→ wrinkle resistance → hopsack). Storage and retrieval are Horizon D;
Phase 0 does not add vector tables.

## 7. Phased delivery

- P0 — ADR + schema + domain + repository for fabric wedge; seed core weaves/seasons/performance; assignment API for Product
- P1 — Displace storefront heuristics via data hooks; read assignments
- P2 — Retailer review UI; filters from graph
- P3 — Import wizard + enrichment + embeddings + knowledge attach

## 8. Dependencies and freeze blockers

Implementation requires explicit PHASE authorization (foundation exception
or post-pilot Horizon A). Brand remains deferred. Collection is not Brand.

## 9. Open research questions

Weight and composition units across EU/US suppliers; how retailer overrides
interact with platform concept merges; whether colour lives here or primarily
in Colour Intelligence ([11](./11_colour_intelligence.md)).
