# 07 — Wardrobe Scoring

**Status: architectural destination, not shipped.** Health-style scores
for the closet — without dark-pattern addiction. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Clients cannot see wardrobe quality. Advisors lack a shared
scorecard.

**Non-goals.** Not public leaderboards. Not shame UX. Not optimizing score
solely to drive spend.

## 2. Bounded context and intended entities

Dimensions (intended): overall health; colour balance; versatility; summer /
winter readiness; business; travel; formal; casual; sustainability;
cost-per-wear. Each maps where possible to metadata facets
(e.g. travel readiness ↔ wrinkle/breathability coverage).

## 3. Relationships to other pillars

Needs [03](./03_wardrobe_intelligence.md) + [02](./02_metadata_graph.md).
Feeds [04](./04_wardrobe_roadmap.md) and [10](./10_recommendation_engine.md).

## 4. Consumer surfaces

- Customer score dashboard
- Retailer client header score strip

## 5. Data ownership and tenancy

Computed per retailer–customer wardrobe. Explainable breakdown stored or
recomputable.

## 6. AI contracts

Deterministic scoring preferred; AI only for narrative of “why score
moved.” No opaque black-box overall score without dimensions.

## 7. Phased delivery

- P0 — Dimension definitions + formulas
- P1 — Batch compute from wardrobe+metadata
- P2 — UI
- P3 — Trend over time

## 8. Dependencies and freeze blockers

Horizon B.

## 9. Open research questions

Weighting by lifestyle (executive vs creative); how to score incomplete
wardrobes fairly.
