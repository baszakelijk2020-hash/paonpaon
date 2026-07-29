# 05 — Lifestyle Intelligence

**Status: architectural destination, not shipped.** The wardrobe adapts to
life — not fashion trends. Not a work ticket — see [PHASE.md](../PHASE.md)
and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Preferences today are thin (`CustomerPreferences`). Climate,
travel, sport, family and dress code are not structured enough to query
against fabric performance or occasions.

**Non-goals.** Not a quantified-self app. Not medical advice. Not social graph.

## 2. Bounded context and intended entities

Structured profile facets (intended): career/role, office days, travel
frequency, primary climate, gym, formal dinners, golf/sport, holidays,
weddings, children, body-change notes, dress code, preferred colours,
budget band, favourite mills/brands (as concepts), preferred fit/silhouette.

Seed: extend toward `CustomerPreferences` + clienteling notes — not a
dump of prose only.

## 3. Relationships to other pillars

Feeds [03](./03_wardrobe_intelligence.md), [04](./04_wardrobe_roadmap.md),
[08](./08_outfit_intelligence.md), [10](./10_recommendation_engine.md),
[11](./11_colour_intelligence.md). Queries [02](./02_metadata_graph.md)
(e.g. Singapore humidity → breathability concepts).

## 4. Consumer surfaces

- Customer onboarding / account lifestyle section
- Retailer intake during appointment
- AI memory mirrors durable facets ([13](./13_ai_memory.md))

## 5. Data ownership and tenancy

Customer-owned where possible; retailer copy for CRM with consent rules.
Soft PII — minimize retention of sensitive family data.

## 6. AI contracts

Infer lifestyle only with pending review. Prefer explicit entry. Explain
which facet drove a recommendation.

## 7. Phased delivery

- P0 — Facet taxonomy aligned to metadata occasions/climate
- P1 — Structured fields on preferences
- P2 — Intake UI
- P3 — Calendar/travel sync (optional, later)

## 8. Dependencies and freeze blockers

Horizon B. Metadata climate/occasion concepts should exist first.

## 9. Open research questions

Body-change handling without reintroducing customer fit profiles;
multi-climate customers.
