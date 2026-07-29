# Code Quality Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Verdict:** Unusually clean marker hygiene (0 TODO/FIXME/@ts-ignore in app TS). Critical issue is leftover production debug logging with PII.

---

## Findings

### Q1 — No TODO / FIXME / HACK in production TS

| Field                | Value                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Findings**         | Zero matches for TODO/FIXME/HACK/XXX in `apps`+`packages` TypeScript (excluding archive/downloaded_pages). |
| **Evidence**         | `rg` count → 0.                                                                                            |
| **Severity**         | None (positive)                                                                                            |
| **Recommended fix**  | None                                                                                                       |
| **Estimated effort** | —                                                                                                          |
| **Current status**   | Clean                                                                                                      |

### Q2 — No @ts-ignore / as any in apps

| Field                | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Findings**         | No `@ts-ignore` / `@ts-expect-error`; no `as any` in non-e2e app TS. |
| **Evidence**         | Architecture audit greps.                                            |
| **Severity**         | None (positive)                                                      |
| **Recommended fix**  | None                                                                 |
| **Estimated effort** | —                                                                    |
| **Current status**   | Clean                                                                |

### Q3 — RETAILER_STAFF_DEBUG (Critical)

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Temporary debug left in retailer session failure path: dumps staff rows, auth user IDs, emails via `console.warn`. |
| **Evidence**         | `apps/retailer/lib/session.ts` L61–110 at snapshot. Only production-path `console.warn` found in apps (non-e2e).   |
| **Severity**         | **Critical**                                                                                                       |
| **Recommended fix**  | Delete debug block entirely.                                                                                       |
| **Estimated effort** | 15–30 min                                                                                                          |
| **Current status**   | **Fixed** after snapshot (redirect-only)                                                                           |

### Q4 — eslint-disable for founder ports

| Field                | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Findings**         | ~9 `eslint-disable` uses, mostly `no-img-element` on ADR-052 ports. |
| **Evidence**         | Architecture audit count.                                           |
| **Severity**         | Low / justified                                                     |
| **Recommended fix**  | Keep with ADR-052 justification.                                    |
| **Estimated effort** | —                                                                   |
| **Current status**   | OK                                                                  |

### Q5 — Temporary demo login UI

| Field                | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **Findings**         | `quick-demo-login.tsx` in three apps, marked temporary, NODE_ENV-gated. |
| **Evidence**         | Files under each app; PHASE: demo login on production via env flag.     |
| **Severity**         | Medium before real retailer data                                        |
| **Recommended fix**  | Remove or hard-disable when pilot tenants hold real PII.                |
| **Estimated effort** | S                                                                       |
| **Current status**   | Intentional for demos                                                   |

### Q6 — Residual string munging

| Field                | Value                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Domain label maps largely replaced `replaceAll("_"," ")` / raw enum display. A few fallbacks remain.                                                                   |
| **Evidence**         | ~4 residual `replaceAll("_", " ")` sites (AI monitoring fallbacks, acquisitionSource, self-portrait event name). `humaniseStatus` defined but unused directly in apps. |
| **Severity**         | Low                                                                                                                                                                    |
| **Recommended fix**  | Prefer domain maps; use `humaniseStatus` for unknown strings.                                                                                                          |
| **Estimated effort** | S                                                                                                                                                                      |
| **Current status**   | Minor                                                                                                                                                                  |

### Q7 — Commented-out code

| Field                | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| **Findings**         | Essentially no commented-out statement blocks in apps. |
| **Evidence**         | Grep sampling.                                         |
| **Severity**         | None (positive)                                        |
| **Recommended fix**  | None                                                   |
| **Estimated effort** | —                                                      |
| **Current status**   | Clean                                                  |

### Q8 — God objects / oversized modules

| Field                | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **Findings**         | Oversized pages: alterations detail, dashboards, storefront route, mega seed. |
| **Evidence**         | See architecture-audit large-file table.                                      |
| **Severity**         | Medium                                                                        |
| **Recommended fix**  | Split when next touched; do not invent alterations redesign.                  |
| **Estimated effort** | M–L                                                                           |
| **Current status**   | Open                                                                          |

### Q9 — Mock / placeholder implementations

| Field                | Value                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Payments/email packages are real implementations but **unproven live** without keys — not mocks. Silhouette carousel is a wrong port (not a stub). Vision features are docs-only. |
| **Evidence**         | `@paon/payments`, `@paon/email` code + PHASE blockers; DESIGN_PORTS #2.                                                                                                           |
| **Severity**         | High product / Medium code honesty                                                                                                                                                |
| **Recommended fix**  | Provision keys; do not pretend delivery works.                                                                                                                                    |
| **Estimated effort** | Founder credentials                                                                                                                                                               |
| **Current status**   | Code-complete, runtime-blocked                                                                                                                                                    |

### Q10 — Copy-pasted forms/badges

| Field                | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Findings**         | Identical cross-app components (status badges, party schedule form). |
| **Evidence**         | MD5 equality across apps.                                            |
| **Severity**         | Medium                                                               |
| **Recommended fix**  | Deduplicate into `@paon/ui`.                                         |
| **Estimated effort** | S–M                                                                  |
| **Current status**   | Open                                                                 |

---

## Overall status

**Code quality: Strong.** Critical debug path removed after the snapshot; residual debt is duplication and oversized modules.
