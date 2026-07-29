# 13 — AI Memory

**Status: architectural destination, not shipped.** Durable preference
memory so recommendations improve forever. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Staff remember “hates slim trousers / always Drago” in their
heads; systems forget.

**Non-goals.** Not unbounded conversation logs as memory. Not covert
surveillance.

## 2. Bounded context and intended entities

- `PreferenceMemoryEntry` — structured claim (avoid silhouette X; prefer
  mill concept Y; never double-breasted; avoid linen wrinkles)
- Provenance: stated by customer, observed by staff, inferred by AI
- Strength, last confirmed, supersededBy

## 3. Relationships to other pillars

Feeds [06](./06_ai_style_advisor.md), [10](./10_recommendation_engine.md),
[08](./08_outfit_intelligence.md), [05](./05_lifestyle_intelligence.md).
Prefer linking claims to [02](./02_metadata_graph.md) concepts over free text.

## 4. Consumer surfaces

- Customer “preferences” that show what the house remembers
- Retailer memory panel on client
- AI tools that read memory before answering

## 5. Data ownership and tenancy

Retailer–customer scoped. Customer right to see and correct. Soft-delete
with audit.

## 6. AI contracts

Inferred memories always `pending` until staff/customer accept. Citations
required when memory changes a recommendation.

## 7. Phased delivery

- P0 — Memory schema + concept links
- P1 — Manual staff capture
- P2 — Customer confirm/edit
- P3 — Assisted inference with review

## 8. Dependencies and freeze blockers

Horizon C. Thin lifestyle + metadata help.

## 9. Open research questions

Conflict resolution when memory contradicts lifestyle; expiry of weak
inferences.
