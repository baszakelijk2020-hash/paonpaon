# 15 — Current vs vision

**Snapshot date: 2026-07-29.**  
Compares **implemented system** to [docs/vision/](../vision/) (ADR-056).  
Describes gaps only — no solution design.

## Aligned areas

| Vision theme                           | Current alignment                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| RetailOS lifecycle (discovery→loyalty) | Substantial ops domains exist (CRM, catalog, orders, alterations, appointments, loyalty, messaging) |
| Retailer as relationship owner         | Multi-tenant retailer model + clienteling notes + messaging                                         |
| Physical garment as seed for wardrobe  | `PhysicalGarment` + fittings + alterations lifecycle tables                                         |
| Preferences / signals                  | `CustomerPreferences`, wishlist, behavioral events                                                  |
| Thin AI personalisation                | Next-best-action + Today’s Pick exist as narrow LLM features                                        |
| Explainability aspiration              | AI generations audited in DB; recommendations still shallow inputs                                  |
| PHASE subordination                    | Vision docs and ROADMAP Horizons explicitly defer to PHASE                                          |

## Missing areas (vision pillars without implementation)

| Pillar                        | Gap                                                            |
| ----------------------------- | -------------------------------------------------------------- |
| 01 Discovery Commerce         | No `KnowledgeObject` store; education not metadata-attached    |
| 02 Metadata Graph             | **Does not exist** (see [07_metadata.md](./07_metadata.md))    |
| 03 Wardrobe Intelligence twin | No digital twin beyond garments/orders/wishlist signals        |
| 04 Wardrobe Roadmap           | No plan entities/UI                                            |
| 05 Lifestyle Intelligence     | Preferences thin vs structured lifestyle profile               |
| 06 AI Style Advisor           | No specialist advisor product (only NBA / Today’s Pick)        |
| 07 Wardrobe Scoring           | No scores                                                      |
| 08 Outfit Intelligence        | No outfit assembly domain                                      |
| 09 Clienteling Cockpit        | Customer detail exists; not wardrobe-gap/roadmap cockpit       |
| 10 Recommendation Engine      | No multi-signal wardrobe-quality engine                        |
| 11 Colour Intelligence        | No palette pipeline                                            |
| 12 Garment Lifecycle (full)   | Alterations cover part; not full purchased→resale loop product |
| 13 AI Memory                  | No durable structured preference memory system                 |
| 14 Category claim             | Documented; not evidenced as category-defining product yet     |

## Contradictions / drift

| Topic                     | Drift                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Storefront facets         | Vision says Metadata Graph displaces heuristics; code still uses `route.ts` keywords                                                      |
| “Shipped AI” vs vision AI | PROJECT_STATE “AI personalisation shipped” ≠ wardrobe intelligence pillars                                                                |
| ADR-050 pricing           | Decision without code vs commerce vision of richer commercial signals                                                                     |
| ProductionOrder           | Domain implies manufacturing tracking; connectors absent                                                                                  |
| Root Made-to-Munro docs   | Contradict PAON docs constitution                                                                                                         |
| Collection vs Brand       | COMPETITIVE_GAPS / vision forbid treating Collection as Brand; catalog still has no Brand — **aligned**, but multi-brand remains deferred |

## Unfinished scaffolding

- Demo Studio synthetic environment generation (PROJECT_STATE: incomplete)
- Marketing routes historically stubby (ADR-051)
- `communication_draft` AI kind without implementation
- Newsletter cron without Vercel schedule
- Fit/silhouette tools ported but supplier-blocked (PHASE)
- Provider credentials historically unset

## Freeze interaction

Vision is **destination only**. Current PHASE freeze intentionally prevents
closing most of the above gaps until pilot proof + PHASE lift.
