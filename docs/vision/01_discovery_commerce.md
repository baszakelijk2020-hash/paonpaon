# 01 — Discovery Commerce

**Status: architectural destination, not shipped.** Not a work ticket —
see [PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Luxury shoppers need education at the moment of interest
(mill, weave, construction). Today knowledge is absent or trapped in
static pages. Staff become the encyclopedia.

**Non-goals.** Not a CMS of blog posts. Not rewriting
`paon-template.html` in Tailwind (ADR-052). Not keyword “related articles”
unrelated to structured metadata.

## 2. Bounded context and intended entities

- `KnowledgeObject` — title, body, locale, concept links, commercial intent
- `DiscoverySurface` — placement rules (PDP, filter empty-state, advisor)
- Attachments are to **Metadata concepts**, not to Product IDs alone

Not in schema yet.

## 3. Relationships to other pillars

Depends on [02_metadata_graph.md](./02_metadata_graph.md). Feeds
[06_ai_style_advisor.md](./06_ai_style_advisor.md) with citeable education.
Recommendation explanations ([10](./10_recommendation_engine.md)) may deep-link
knowledge objects.

## 4. Consumer surfaces

- Customer storefront PDP / filters (data hooks into founder chrome only)
- Retailer preview of what clients see
- Admin/platform curation of platform-level knowledge; retailer overrides

## 5. Data ownership and tenancy

Platform concepts + knowledge can be global; retailers may override or
add house-specific stories. RLS by `retailerId` where owned by tenant.

## 6. AI contracts

Input: concept IDs on a product. Output: ranked KnowledgeObjects with
citations. Never invent mill facts; flag low confidence.

## 7. Phased delivery

- P0 — Spec + concept taxonomy for education topics
- P1 — Schema for KnowledgeObject ↔ concept
- P2 — Thin PDP injection via existing `__PAON_*` hooks
- P3 — Auto-surface from assignments (“has Weave=Hopsack → show story”)

## 8. Dependencies and freeze blockers

Freeze: storefront work only if PHASE allows and ADR-052 preserved.
Blocked on Metadata Graph Phase 0+ for durable concept IDs.

## 9. Open research questions

How much knowledge is platform-authored vs retailer-authored for MTM-only
houses with no third-party mill storytelling?
