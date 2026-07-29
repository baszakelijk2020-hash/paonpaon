# 06 — AI Style Advisor

**Status: architectural destination, not shipped.** Specialist menswear
advisor — not generic ChatGPT. Not a work ticket — see
[PHASE.md](../PHASE.md) and [vision README](./README.md).

## 1. Problem / non-goals

**Problem.** Clients ask “what should I wear / buy / repair?” and get
unstructured chat or silence.

**Non-goals.** Not an open-ended companion chatbot. Not unsupervised
autonomous purchasing. Not replacing human advisors on the floor.

## 2. Bounded context and intended entities

- `AdvisorSession` / turns with structured intents
- Question taxonomy: wear tomorrow; shoes; colour harmony; buy next;
  repair vs replace; dry clean; travel; wardrobe fit; why this rec

## 3. Relationships to other pillars

Consumes [03](./03_wardrobe_intelligence.md), [05](./05_lifestyle_intelligence.md),
[02](./02_metadata_graph.md), [13](./13_ai_memory.md),
[10](./10_recommendation_engine.md), [01](./01_discovery_commerce.md),
[08](./08_outfit_intelligence.md), [11](./11_colour_intelligence.md).
Must cite sources.

## 4. Consumer surfaces

- Customer portal advisor
- Retailer “prep briefing” before appointment (same engine, staff view)

## 5. Data ownership and tenancy

Session scoped to retailer–customer. No cross-tenant leakage.

## 6. AI contracts

Input: intent + wardrobe snapshot + metadata + memory + calendar.
Output: answer + citations (concept IDs, garment IDs, knowledge IDs) +
confidence. Refuse when data missing rather than invent.

## 7. Phased delivery

- P0 — Intent taxonomy + response schema
- P1 — Scripted advisor over structured data
- P2 — LLM grounded on PAON tools only
- P3 — Proactive briefs

## 8. Dependencies and freeze blockers

Horizon C. Needs Memory + Recs + Wardrobe thin slices.

## 9. Open research questions

Voice vs text; when to escalate to human advisor.
