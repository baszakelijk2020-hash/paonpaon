# 03 — Personal Wardrobe Intelligence

**Status: architectural destination, not shipped.** A digital twin of
someone’s clothing life — not a shopping list. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Retailers and clients lose memory of what is owned, worn,
altered and worn out. Recommendations ignore the closet.

**Non-goals.** Not factory MTM measurement sheets (NON_GOALS / ADR-016).
Not a social fashion network. Not inventing a second garment entity beside
`PhysicalGarment` without an ADR.

## 2. Bounded context and intended entities

Intended twin fields (many not in schema yet): owned item, purchase date,
estimated wear, photos, colours/patterns (via metadata), condition, fit
notes, tailor notes, repair/clean history, resale estimate, replacement
prediction, favourite score, wear frequency, outfit membership, missing
essentials, lifestyle compatibility.

**Seed today:** `PhysicalGarment` + fitting observations + alterations +
orders/wishlist as weak signals of ownership.

## 3. Relationships to other pillars

Consumes [02](./02_metadata_graph.md). Feeds [04](./04_wardrobe_roadmap.md),
[07](./07_wardrobe_scoring.md), [08](./08_outfit_intelligence.md),
[09](./09_clienteling_cockpit.md), [10](./10_recommendation_engine.md),
[12](./12_garment_lifecycle.md). Informed by [05](./05_lifestyle_intelligence.md)
and [11](./11_colour_intelligence.md).

## 4. Consumer surfaces

- Customer: “My wardrobe” across houses (privacy rules per retailer)
- Retailer: wardrobe on client detail (clienteling)
- AI: structured wardrobe snapshot for advisor/recs

## 5. Data ownership and tenancy

Per-retailer wardrobe is default (CRM ownership). Cross-house customer view
only where the customer opts in and RLS allows — never leak one house’s
notes to another.

## 6. AI contracts

Input: wardrobe items + metadata + lifestyle. Output: gaps, duplicates,
wear-out risks, explainable. No silent deletion of items.

## 7. Phased delivery

- P0 — Spec; map twin fields → PhysicalGarment / OrderLine / notes
- P1 — Explicit “in wardrobe” flag + photo/condition on garment
- P2 — Customer wardrobe UI
- P3 — Wear frequency, resale, replacement prediction

## 8. Dependencies and active programme

This historical Horizon B concept is now traced into Stage 4 of
[PHASE.md](../PHASE.md), after the metadata and consent dependencies. Follow
the active queue and `PAON_INTELLIGENCE_PLATFORM.md`, not this old horizon
sequence.

## 9. Open research questions

Multi-retailer wardrobe unification vs house-scoped closets; customer-added
items never bought at this house.
