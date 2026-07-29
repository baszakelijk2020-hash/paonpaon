# Architecture Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Verdict:** Boundaries largely match `ARCHITECTURE.md`. Drift is concentrated in inline Supabase leaks, cross-app UI clones, oversized out-of-freeze pages, and dual UI systems (intentional ADR-052).

---

## Findings

### A1 — Package / app shape matches charter

| Field                | Value                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Three apps + packages `domain`, `database`, `auth`, `ui`, `utils`, `payments`, `email`, `sms`, `ai`, configs. No app→app imports. Domain has no workspace deps. ~41 repositories in `@paon/database`. |
| **Evidence**         | `apps/`, `packages/` listing; dependency graph sampling.                                                                                                                                              |
| **Severity**         | None (positive)                                                                                                                                                                                       |
| **Recommended fix**  | None                                                                                                                                                                                                  |
| **Estimated effort** | —                                                                                                                                                                                                     |
| **Current status**   | Healthy                                                                                                                                                                                               |

### A2 — Inline Supabase queries in apps

| Field                | Value                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Charter: data access via repositories. Exceptions: storefront `route.ts` queries prospect demo tables; Demo Studio storage upload; **retailer session debug** queries.                   |
| **Evidence**         | `apps/customer/app/r/[slug]/route.ts` `.from("prospect_demo_*")`; `apps/admin/.../studio/actions.ts` storage; `apps/retailer/lib/session.ts` admin `.from` (see runtime-audit Critical). |
| **Severity**         | High (session) / Medium (route/studio)                                                                                                                                                   |
| **Recommended fix**  | Repository methods for demo config; delete session debug; optional storage helper.                                                                                                       |
| **Estimated effort** | S–M                                                                                                                                                                                      |
| **Current status**   | Open                                                                                                                                                                                     |

### A3 — Duplicate UI across apps

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Byte-identical status badges (alterations, appointments, retailer status pairs) and identical `party-schedule-form.tsx` customer↔retailer. |
| **Evidence**         | MD5 matches across app files; 8 `status-badge.tsx` files.                                                                                  |
| **Severity**         | Medium                                                                                                                                     |
| **Recommended fix**  | Move shared badges/forms to `@paon/ui` (or shared module) using domain label maps.                                                         |
| **Estimated effort** | S–M                                                                                                                                        |
| **Current status**   | Open (freeze: only if touching those files)                                                                                                |

### A4 — Dual UI systems (portals vs HTML storefront)

| Field                | Value                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Founder HTML ports are isolated and must not be rebuilt in Tailwind/`@paon/ui`. Portals use design system tokens. |
| **Evidence**         | ADR-052; `DESIGN_PORTS.md`; `paon-template.html` ~16.8k lines.                                                    |
| **Severity**         | Medium accepted debt                                                                                              |
| **Recommended fix**  | Do not unify; keep ports verbatim.                                                                                |
| **Estimated effort** | —                                                                                                                 |
| **Current status**   | By design                                                                                                         |

### A5 — Scope breadth vs freeze

| Field                | Value                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Large alterations / CRM / production-adjacent surfaces remain in tree while freeze allows only three workstreams (+ back-env polish exception). |
| **Evidence**         | Retailer alterations detail ~953 lines; PHASE founder-block on alterations invent.                                                              |
| **Severity**         | High (product risk if extended)                                                                                                                 |
| **Recommended fix**  | Do not extend out-of-freeze; await founder design.                                                                                              |
| **Estimated effort** | Blocked                                                                                                                                         |
| **Current status**   | Parked                                                                                                                                          |

### A6 — ADR-052 port status

| #    | Surface                                      | Status                                  |
| ---- | -------------------------------------------- | --------------------------------------- |
| 1    | Fit sliders                                  | Ported, **Parked**                      |
| 2    | Silhouette carousel                          | **Wrong** (only on blocked alterations) |
| 3    | Swipe deck                                   | Ported                                  |
| 4    | Table service                                | Verified                                |
| 5    | AM House Party orbit                         | Done                                    |
| 6–10 | Globe / lapel / gift / vouchers / photo grid | Not started (out of freeze)             |

| Field                | Value                                                           |
| -------------------- | --------------------------------------------------------------- |
| **Findings**         | Silhouette wrong-port is design debt; mount is founder-blocked. |
| **Evidence**         | `DESIGN_PORTS.md`; PHASE queue 7.                               |
| **Severity**         | High design debt / blocked for fix                              |
| **Recommended fix**  | Skip until founder-designed home.                               |
| **Estimated effort** | Blocked                                                         |
| **Current status**   | Wrong / blocked                                                 |

### A7 — Domain without persistence

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Findings**         | `ProductionOrder` and similar domain types lack matching tables/repos. |
| **Evidence**         | `packages/domain/src/production/`; no production-order repository.     |
| **Severity**         | Medium (roadmap, not freeze)                                           |
| **Recommended fix**  | Do not build until PHASE lifts freeze.                                 |
| **Estimated effort** | L later                                                                |
| **Current status**   | Known / deferred                                                       |

### A8 — Large files

| File                    |  Lines | Note                     |
| ----------------------- | -----: | ------------------------ |
| `paon-template.html`    | ~16850 | Canonical ADR-052        |
| `database.types.ts`     |  ~5912 | Generated                |
| `demo-seed.ts`          |  ~2094 | Split candidate          |
| alterations detail page |   ~953 | Out of freeze            |
| retailer dashboard      |   ~703 | Back-env                 |
| storefront `route.ts`   |   ~665 | Freeze — extract loaders |

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Severity**         | Medium (maintainability)                                         |
| **Recommended fix**  | Modularize seed + route.ts when next touching; leave HTML alone. |
| **Estimated effort** | M                                                                |
| **Current status**   | Open                                                             |

### A9 — Auth package depends on database

| Field                | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **Findings**         | `@paon/auth` depends on `@paon/database` (not drawn clearly in all diagrams). |
| **Evidence**         | `packages/auth/package.json`                                                  |
| **Severity**         | Low                                                                           |
| **Recommended fix**  | Note in ARCHITECTURE if intentional.                                          |
| **Estimated effort** | 15 min docs                                                                   |
| **Current status**   | Acceptable                                                                    |

---

## Architectural drift summary

| Area                        | Drift?                                |
| --------------------------- | ------------------------------------- |
| Layering apps → packages    | Low                                   |
| Repository-only data access | Medium (known leaks)                  |
| No duplicate business rules | Low–Medium (UI clones)                |
| Tenant RLS                  | Low (healthy)                         |
| Freeze vs codebase breadth  | High (presence ≠ permission to build) |
| Vision wardrobe system      | None shipped (correct)                |

---

## Overall status

**Architecture health: Good with known leaks.** Safe to continue freeze work if session debug is removed and repository boundaries are respected on new code.
