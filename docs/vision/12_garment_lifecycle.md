# 12 — Garment Lifecycle

**Status: architectural destination, not shipped.** Every garment has a
life — each stage can spawn recommendations. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Ownership ends at purchase in most software. Repair, clean,
resole, store, sell, donate, replace are invisible.

**Non-goals.** Not becoming a dry-cleaner POS. Not marketplace for resale
as core (may link later).

## 2. Bounded context and intended entities

Stages: purchased → altered → dry cleaned → repaired → resoled → stored →
sold → donated → archived → replaced. Events on `PhysicalGarment` timeline.

Seed today: alterations workflow, custody, completion — extend rather than
replace.

## 3. Relationships to other pillars

Feeds [08](./08_outfit_intelligence.md) (availability),
[07](./07_wardrobe_scoring.md) (condition), [04](./04_wardrobe_roadmap.md)
(replace), [10](./10_recommendation_engine.md) (“resole before replace”),
[03](./03_wardrobe_intelligence.md).

## 4. Consumer surfaces

- Customer garment timeline
- Retailer service booking from lifecycle event
- Advisor “worth repairing?”

## 5. Data ownership and tenancy

Garment is retailer–customer scoped. Workshop partners see only assigned
work orders.

## 6. AI contracts

Suggest next lifecycle action with cost/benefit vs replace; cite condition
and metadata durability.

## 7. Phased delivery

- P0 — Stage enum + event model
- P1 — Log events from alterations/clean notes
- P2 — Customer-visible timeline
- P3 — Predictive replacement

## 8. Dependencies and freeze blockers

Aligns with alterations vertical — founder design still gates invented UI
(PHASE). Prefer extending existing alteration domain.

## 9. Open research questions

Customer self-reported cleans vs atelier-only events; multi-house service
history.
