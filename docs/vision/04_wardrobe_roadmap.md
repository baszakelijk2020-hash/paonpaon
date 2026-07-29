# 04 — Wardrobe Roadmap

**Status: architectural destination, not shipped.** A financial-planner
for clothing — not a product carousel. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Clients buy reactively. Advisors lack a shared multi-year plan.

**Non-goals.** Not pushy drip campaigns optimized only for GMV. Not a
subscription box.

## 2. Bounded context and intended entities

- `WardrobePlan` — horizon (e.g. 3 years), score snapshot, problem list
- `WardrobePlanItem` — quarter, intent (buy/replace/repair), concept links,
  budget band, status

Problems example: too much navy; no casual jackets; worn shirts; no summer
trousers; no travel wardrobe; too many black shoes.

## 3. Relationships to other pillars

Needs [03](./03_wardrobe_intelligence.md), [05](./05_lifestyle_intelligence.md),
[07](./07_wardrobe_scoring.md), [02](./02_metadata_graph.md). Drives
[10](./10_recommendation_engine.md) and [09](./09_clienteling_cockpit.md).

## 4. Consumer surfaces

- Customer: roadmap timeline
- Retailer: co-edit plan in appointment
- AI: propose plan diffs with explanations

## 5. Data ownership and tenancy

Plan is retailer–customer scoped. Customer may see their plan in portal.

## 6. AI contracts

Input: wardrobe + lifestyle + scores + calendar events. Output: ordered
plan items with rationale citing metadata and gaps. Confidence per item.

## 7. Phased delivery

- P0 — Spec + problem taxonomy
- P1 — Manual plan items by advisor
- P2 — Score-driven problem detection
- P3 — Auto quarterly suggestions

## 8. Dependencies and freeze blockers

Horizon B. Requires wardrobe twin + scoring at least thin.

## 9. Open research questions

Who owns edits when customer and advisor disagree; wedding/seasonal
overrides.
