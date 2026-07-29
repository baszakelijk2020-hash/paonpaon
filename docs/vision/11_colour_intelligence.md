# 11 — Colour Intelligence

**Status: architectural destination, not shipped.** Palette from person
and wardrobe — not a quiz toy. Not a work ticket — see [PHASE.md](../PHASE.md)
and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Colour advice is tribal knowledge. Wardrobes accumulate
clashing navy/black without a shared palette.

**Non-goals.** Not beauty-filter AR. Not racial stereotyping via crude
season boxes without opt-in and careful design.

## 2. Bounded context and intended entities

Pipeline: customer photos → skin undertone, hair, eyes, contrast →
seasonal/custom palette concepts in metadata → score wardrobe → suggest
future colours → warn on poor combinations.

## 3. Relationships to other pillars

Writes colour concepts into [02](./02_metadata_graph.md). Feeds
[07](./07_wardrobe_scoring.md), [08](./08_outfit_intelligence.md),
[10](./10_recommendation_engine.md), [09](./09_clienteling_cockpit.md).

## 4. Consumer surfaces

- Customer colour profile
- Retailer consult tool
- Outfit harmony checks

## 5. Data ownership and tenancy

Biometric-adjacent imagery — explicit consent, retention limits, delete
path. Retailer access only for that house relationship.

## 6. AI contracts

Vision model outputs structured palette + confidence. Human confirm before
locking profile. Never auto-purge wardrobe items.

## 7. Phased delivery

- P0 — Palette taxonomy as metadata concepts
- P1 — Manual palette assignment by advisor
- P2 — Photo-assisted with review
- P3 — Wardrobe colour scoring automation

## 8. Dependencies and freeze blockers

Horizon D. Ethics review before photo pipeline.

## 9. Open research questions

Consent UX; lighting variance; linking to fabric colourways from suppliers.
