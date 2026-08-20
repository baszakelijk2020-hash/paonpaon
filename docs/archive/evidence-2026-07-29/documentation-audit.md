# Documentation Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Docs inventory:** 67 Markdown files under `docs/` (plus this audits set).  
**Verdict:** Constitution (ADR-057) is sound. **PROJECT_STATE** and parts of **ai_snapshot** / **ROADMAP** body contradict live reality. Trust PHASE + DEPLOYMENT + code.

---

## Findings

### Doc1 — Authority map is correct and useful

| Field                | Value                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | `docs/README.md` ranks Implementation → PHASE → CLAUDE/WORKING_AGREEMENT → ADRs → … Archive. Matches how the audit had to be run. |
| **Evidence**         | docs/README.md authority hierarchy; ADR-057.                                                                                      |
| **Severity**         | None (positive)                                                                                                                   |
| **Recommended fix**  | Index this `docs/audits/` set (done in same change).                                                                              |
| **Estimated effort** | —                                                                                                                                 |
| **Current status**   | Healthy                                                                                                                           |

### Doc2 — PROJECT_STATE.md is dangerously stale

| Field                | Value                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Still describes undeployed checkpoints, wrong Vercel URL family (`paon-*`), empty DB, synthetic-only Demo Studio. |
| **Evidence**         | PROJECT_STATE self-disclaimer (ADR-051); contradicts PHASE, DEPLOYMENT, live 200s, `seedProspectDemoRetailer`.    |
| **Severity**         | **High**                                                                                                          |
| **Recommended fix**  | Banner + archive or rewrite from code; never use as work queue.                                                   |
| **Estimated effort** | 1–3h                                                                                                              |
| **Current status**   | Drifted                                                                                                           |

### Doc3 — ROADMAP.md competing “in progress” body

| Field                | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Findings**         | Banner says Experience Rebuild paused; body H2 still “(in progress)” for phases that freeze forbids. |
| **Evidence**         | ROADMAP.md header vs body; PHASE says ROADMAP is not a work queue.                                   |
| **Severity**         | High if misread                                                                                      |
| **Recommended fix**  | Soften body status language to “paused / reference”.                                                 |
| **Estimated effort** | 30–60 min                                                                                            |
| **Current status**   | Contradictory                                                                                        |

### Doc4 — ai_snapshot rows copy stale Studio/marketing claims

| Field                | Value                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Snapshot dated 2026-07-29 still says Demo Studio synthetic incomplete / marketing stubby in places; recommendations obsolete. |
| **Evidence**         | Feature audit vs `docs/ai_snapshot/12`, `15`, `16`.                                                                           |
| **Severity**         | Medium                                                                                                                        |
| **Recommended fix**  | Regenerate ai_snapshot from code (constitution rule 8).                                                                       |
| **Estimated effort** | 2–4h                                                                                                                          |
| **Current status**   | Partially stale                                                                                                               |

### Doc5 — COMPETITIVE_GAPS overclaims email proof

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Findings**         | Claims email delivery rails “proven” while Resend never live-verified. |
| **Evidence**         | COMPETITIVE_GAPS vs PHASE Resend blocker; no `RESEND_API_KEY` locally. |
| **Severity**         | Medium                                                                 |
| **Recommended fix**  | Soften to “implemented, not live-proven”.                              |
| **Estimated effort** | 15 min                                                                 |
| **Current status**   | Overclaim                                                              |

### Doc6 — PRODUCT.md is intent, not shipped checklist

| Field                | Value                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Describes full Admin/Retailer/Customer surfaces including Production, OAuth, etc. Many not built or blocked. |
| **Evidence**         | PRODUCT.md vs code; doc itself often frames as product definition.                                           |
| **Severity**         | Low if read as intent; High if treated as done                                                               |
| **Recommended fix**  | Keep; reinforce first-line “intended surfaces”.                                                              |
| **Estimated effort** | 15 min                                                                                                       |
| **Current status**   | OK with discipline                                                                                           |

### Doc7 — PHASE.md / DEPLOYMENT.md / DESIGN_PORTS.md align with reality

| Field                | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Findings**         | Freeze scope, live URLs, blockers, port statuses match verified production HTTP and code. |
| **Evidence**         | Production curl 200s; migration sync; DESIGN_PORTS vs code mounts.                        |
| **Severity**         | None (positive)                                                                           |
| **Recommended fix**  | Continue treating as Tier 0 / ops SoT.                                                    |
| **Estimated effort** | —                                                                                         |
| **Current status**   | Authoritative                                                                             |

### Doc8 — vision/ correctly destination-only

| Field                | Value                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Findings**         | Wardrobe intelligence docs exist; no corresponding domain implementation. Freeze forbids building. |
| **Evidence**         | `docs/vision/*`; no KnowledgeObject / wardrobe twin symbols in packages.                           |
| **Severity**         | None (positive)                                                                                    |
| **Recommended fix**  | None                                                                                               |
| **Estimated effort** | —                                                                                                  |
| **Current status**   | Correct                                                                                            |

### Doc9 — Archive constitution followed

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Findings**         | Made-to-Munro orphans and dead Prisma/SQL under `docs/archive/`. |
| **Evidence**         | docs/README archive map; ADR-057.                                |
| **Severity**         | None (positive)                                                  |
| **Recommended fix**  | None                                                             |
| **Estimated effort** | —                                                                |
| **Current status**   | Clean                                                            |

### Doc10 — Features implemented but under-documented

| Field                | Value                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Rapid Jul 28–29 Demo Studio / wedding / label-map work is captured mainly in PHASE narrative, not in PRODUCT/ROADMAP updates. |
| **Evidence**         | PHASE long changelog vs thinner PRODUCT updates.                                                                              |
| **Severity**         | Low                                                                                                                           |
| **Recommended fix**  | Optional PRODUCT touch for Studio tenant seed + founder page.                                                                 |
| **Estimated effort** | 1h                                                                                                                            |
| **Current status**   | Acceptable during freeze                                                                                                      |

---

## Feature documentation vs reality (summary)

| Feature             | Docs claim     | Reality                     | Doc health                  |
| ------------------- | -------------- | --------------------------- | --------------------------- |
| Storefront          | PHASE Complete | Complete / live             | Good                        |
| Demo Studio         | PHASE Complete | Complete / live             | Good (PROJECT_STATE wrong)  |
| Marketing + founder | PHASE Complete | Complete / live             | Good                        |
| Stripe              | PHASE Blocked  | Code yes / live no          | Good                        |
| Resend              | PHASE Blocked  | Code yes / live no          | COMPETITIVE_GAPS soft-wrong |
| Alterations         | Parked         | Deep code / product blocked | Good                        |
| Vision              | Destination    | Not started                 | Good                        |

---

## Overall status

**Documentation health: Mixed.** Constitutional docs are excellent; historical status docs are liabilities. Prefer PHASE + DEPLOYMENT + code over PROJECT_STATE / stale snapshot rows.
