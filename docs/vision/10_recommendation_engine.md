# 10 — AI Recommendation Engine

**Status: architectural destination, not shipped.** Hardest technical
pillar. Optimizes **wardrobe quality**; revenue is consequence — never
sole objective. Not a work ticket — see [PHASE.md](../PHASE.md) and
[vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Today AI product picks use name + description only
(`packages/ai`). Collaborative “customers also bought” is wrong for
low-volume luxury.

**Non-goals.** Not black-box ranking. Not maximizing attach rate alone.
Not recommending without explanation.

## 2. Bounded context and intended entities

- `Recommendation` — candidate, scores, explanation, confidence, commercial
  priority, ethical/wardrobe-quality score
- Signal vector (intended): current wardrobe, lifestyle, climate, colours,
  duplicate risk, body/silhouette prefs (from memory — not archived fit
  profile), occasions, budget, mill preference, season, cost-per-wear,
  timing, retailer priorities, roadmap, appointments

## 3. Relationships to other pillars

Requires [02](./02_metadata_graph.md), [03](./03_wardrobe_intelligence.md),
[05](./05_lifestyle_intelligence.md), [13](./13_ai_memory.md),
[04](./04_wardrobe_roadmap.md), [11](./11_colour_intelligence.md),
[12](./12_garment_lifecycle.md). Powers [06](./06_ai_style_advisor.md),
[09](./09_clienteling_cockpit.md), discovery ranking.

## 4. Consumer surfaces

- Today’s Pick evolution
- Roadmap “buy next”
- PDP alternatives / deep-sell
- Staff suggested attach

## 5. Data ownership and tenancy

Computed in tenant context. Platform models may be shared; features never
leak PII across retailers.

## 6. AI contracts

Every recommendation: explainability bullets referencing metadata and
wardrobe facts; confidence; reviewable. Prefer refuse over hallucinate.

## 7. Phased delivery

- P0 — Signal list + scoring rubric (wardrobe-quality first)
- P1 — Rule-based recs using metadata assignments
- P2 — Model-assisted ranking with citations
- P3 — Full multi-signal + ethical/commercial balance

## 8. Dependencies and freeze blockers

Horizon D for full engine; Horizon A enables rule-based slice. Freeze:
do not expand speculative AI during pilot.

## 9. Open research questions

Cold-start clients; how retailer “commercial priority” is capped so it
cannot dominate wardrobe quality.
