# Evidence-Producer Map

Task: `t9a-evidence-spec-inventory`
Method: Static inventory of 16 gated evidence ids.

Per id:
(a) `docs/evidence/tranches/<id>.json` exists?
(b) `docs/evidence/runs/<id>.json` exists? gitSha?
(c) Which spec file declares `PHASE_ITEM_ID` equal to that id? (file:line)
(d) If no spec declares it: **NO PRODUCER**.

---

## Per-id facts

|    Id | Tranche |  Run   | gitSha       | Spec (from run)                                                      | PHASE_ITEM_ID match (file:line)                                                    | Producer        |
| ----: | :-----: | :----: | :----------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :-------------- |
|   4.6 | EXISTS  | EXISTS | d5e66de9cb58 | apps/customer/e2e/virtual-studio.spec.ts                             | —                                                                                  | **NO PRODUCER** |
|   4.7 | EXISTS  | EXISTS | d5e66de9cb58 | apps/customer/e2e/virtual-studio.spec.ts                             | —                                                                                  | **NO PRODUCER** |
|   4.9 | EXISTS  | EXISTS | d5e66de9cb58 | apps/retailer/e2e/visual-roadmap.spec.ts                             | —                                                                                  | **NO PRODUCER** |
|  4.10 | EXISTS  | EXISTS | d5e66de9cb58 | apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts | —                                                                                  | **NO PRODUCER** |
|   8.4 | EXISTS  | EXISTS | 0a7ae8c80a0f | apps/retailer/e2e/completion-harness.spec.ts                         | apps/retailer/e2e/completion-harness.spec.ts:15                                    | ok              |
|   9.1 | EXISTS  | EXISTS | 0a7ae8c80a0f | apps/retailer/e2e/migration-write-through.spec.ts                    | apps/retailer/e2e/migration-write-through.spec.ts:22 (inline `phaseItemId: "9.1"`) | ok              |
|  17.1 | EXISTS  | EXISTS | fc783be9c95d | apps/retailer/e2e/advisor-capture.spec.ts                            | apps/retailer/e2e/advisor-capture.spec.ts:16                                       | ok              |
|  17.2 | EXISTS  | EXISTS | fc783be9c95d | apps/retailer/e2e/mission-control.spec.ts                            | apps/retailer/e2e/mission-control.spec.ts:17                                       | ok              |
|  17.3 | EXISTS  | EXISTS | 71a90a133554 | apps/retailer/e2e/appointment-brief.spec.ts                          | apps/retailer/e2e/appointment-brief.spec.ts:16                                     | ok              |
|  17.4 | EXISTS  | EXISTS | cc47e0db4857 | apps/retailer/e2e/fabric-pairing.spec.ts                             | apps/retailer/e2e/fabric-pairing.spec.ts:12                                        | ok              |
|  17.5 | EXISTS  | EXISTS | cc47e0db4857 | apps/retailer/e2e/promise-matching.spec.ts                           | apps/retailer/e2e/promise-matching.spec.ts:12                                      | ok              |
|  17.6 | EXISTS  | EXISTS | cc47e0db4857 | apps/retailer/e2e/customer-rankings.spec.ts                          | apps/retailer/e2e/customer-rankings.spec.ts:12                                     | ok              |
|  17.8 | EXISTS  | EXISTS | 99cb0ec33270 | apps/retailer/e2e/academy-roleplay.spec.ts                           | apps/retailer/e2e/academy-roleplay.spec.ts:10 (`PERSONA_PHASE_ITEM_ID = "17.8"`)   | ok              |
|  17.9 | EXISTS  | EXISTS | 29b217762c95 | apps/retailer/e2e/channel-contact.spec.ts                            | apps/retailer/e2e/channel-contact.spec.ts:12                                       | ok              |
| 17.14 | EXISTS  | EXISTS | 964d9dbdb058 | apps/retailer/e2e/prospect-ai-conversation.spec.ts                   | apps/retailer/e2e/prospect-ai-conversation.spec.ts:19                              | ok              |
|  18.5 | EXISTS  | EXISTS | ef9f43cfea2b | apps/customer/e2e/employee-portal-linked-customer.spec.ts            | apps/customer/e2e/employee-portal-linked-customer.spec.ts:8                        | ok              |

## Blocking set — ids with NO PRODUCER

These 5 evidence ids have a run/tranche file but **no spec declares `PHASE_ITEM_ID` equal to the bare id**. This blocks Tranche 9 regeneration until the spec-producer relationship is resolved.

| Id       | Run spec                                                             |                                             Actual `PHASE_ITEM_ID` declared in spec |
| :------- | :------------------------------------------------------------------- | ----------------------------------------------------------------------------------: |
| **4.6**  | apps/customer/e2e/virtual-studio.spec.ts                             | `"4.7-4.8-customer-style-portrait-onboarding"` spans 4.6–4.8 but omits bare `"4.6"` |
| **4.7**  | apps/customer/e2e/virtual-studio.spec.ts                             |                `"4.7-4.8-customer-style-portrait-onboarding"` — same spec, same gap |
| **4.9**  | apps/retailer/e2e/visual-roadmap.spec.ts                             |                         `"4.9-advisor-visual-roadmap"` (suffixed; not bare `"4.9"`) |
| **4.10** | apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts |         `"4.10-customer-batch-and-feedback-evidence"` (suffixed; not bare `"4.10"`) |
| **9.1**  | apps/retailer/e2e/migration-write-through.spec.ts                    |                   No `PHASE_ITEM_ID` const; inline `phaseItemId: "9.1"` at line 22. |

**Root cause**: The specs for ids 4.6, 4.7, 4.9, 4.10 use suffixed PHASE_ITEM_ID values
(e.g. `"4.9-advisor-visual-roadmap"`) while the run evidence files record the bare id
(e.g. `"4.9"`). For 9.1, the spec uses an inline literal instead of a `PHASE_ITEM_ID` const
and thus won't match a grep for the const.

## Non-blocking producers (ok)

Ids 8.4, 17.1–17.6, 17.8, 17.9, 17.14, 18.5 all have exact `PHASE_ITEM_ID` const declarations
matching their evidence id. No action needed.

---

_Generated: 2026-08-15 by worker/t9a-evidence-spec-inventory_
