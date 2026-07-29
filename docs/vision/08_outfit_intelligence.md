# 08 — Outfit Intelligence

**Status: architectural destination, not shipped.** Assemble outfits — not
only recommend SKUs. Not a work ticket — see [PHASE.md](../PHASE.md) and
[vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Clients own pieces but cannot compose looks for weather,
calendar and dress code.

**Non-goals.** Not a social outfit feed. Not AR try-on as a prerequisite.

## 2. Bounded context and intended entities

- `Outfit` — set of wardrobe item refs + occasion + constraints used
- Constraints: weather, calendar/appointments, travel, colour harmony,
  laundry/repair status, dress code, preferences

## 3. Relationships to other pillars

Needs [03](./03_wardrobe_intelligence.md), [02](./02_metadata_graph.md),
[11](./11_colour_intelligence.md), [05](./05_lifestyle_intelligence.md),
[12](./12_garment_lifecycle.md) (availability), [13](./13_ai_memory.md).
Surfaces via [06](./06_ai_style_advisor.md) and customer “wear today.”

## 4. Consumer surfaces

- Customer daily outfit
- Retailer appointment prep looks
- Wedding party coordination (later)

## 5. Data ownership and tenancy

Outfits are retailer–customer scoped; items must belong to that wardrobe.

## 6. AI contracts

Input: date + constraints + wardrobe. Output: ranked outfits with
harmony explanation citing concepts. Exclude items in repair/laundry.

## 7. Phased delivery

- P0 — Constraint model
- P1 — Manual outfit builder
- P2 — Auto suggest
- P3 — Calendar-aware automation

## 8. Dependencies and freeze blockers

Horizon C. Thin wardrobe + colour basics first.

## 9. Open research questions

Weather API dependency; multi-day travel packing lists.
