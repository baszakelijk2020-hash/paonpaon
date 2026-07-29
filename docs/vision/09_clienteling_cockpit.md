# 09 — Retailer Clienteling Cockpit

**Status: architectural destination, not shipped.** What floor staff see
when the client is in front of them. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Mission Control and client detail are operational but not a
wardrobe-advisor cockpit (gaps, roadmap, mills, likelihood).

**Non-goals.** Not a full POS. Not regional multi-store rollup.

## 2. Bounded context and intended entities

Cockpit composition (views, not necessarily new tables): entire wardrobe,
missing pieces, upcoming events, recent purchases, budget band, open
recommendations, items wearing out, cross-sell opportunities, lifetime
roadmap, style evolution, colour analysis summary, favourite mills,
purchase likelihood, wardrobe gaps.

Seed today: customer detail, notes, orders, appointments, garments.

## 3. Relationships to other pillars

Aggregates [03](./03_wardrobe_intelligence.md)–[08](./08_outfit_intelligence.md),
[10](./10_recommendation_engine.md)–[13](./13_ai_memory.md) for staff.
Same vocabulary as customer portal.

## 4. Consumer surfaces

- Retailer `/customers/[id]` evolution
- Pre-appointment brief
- Tablet-friendly during fitting

## 5. Data ownership and tenancy

Strict retailer RLS. No platform-wide client dossier across tenants.

## 6. AI contracts

Briefing card: top 3 risks / opportunities before appointment with
citations. Staff can dismiss/pin.

## 7. Phased delivery

- P0 — Information architecture for cockpit
- P1 — Assemble from existing entities
- P2 — Gaps/roadmap panels when those pillars exist
- P3 — Likelihood + briefing AI

## 8. Dependencies and freeze blockers

Horizon C for full value; incremental IA improvements may align with
back-env polish only if PHASE allows.

## 9. Open research questions

Role gating (associate vs manager); print briefing for offline floor
(still not full offline mode).
