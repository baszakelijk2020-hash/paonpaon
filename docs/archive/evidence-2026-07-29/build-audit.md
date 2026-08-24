# Build Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Node pin:** `.nvmrc` → `22.20.0` (CI); local shell may be newer — audit used Node 22.20.0 via nvm.  
**Verdict:** Buildable. All six CI verify steps green on tip; local install/lint/typecheck/test/format green.

---

## Findings

### B1 — Full CI verify green on tip

| Field                | Value                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | GitHub Actions CI on `e75de84` succeeded: install (frozen lockfile), lint, typecheck, unit tests, build, format check. Deploy jobs also succeeded.                                                                                      |
| **Evidence**         | Run [30444939257](https://github.com/baszakelijk2020-hash/paonpaon/actions/runs/30444939257) — job “Lint, typecheck, test, build” conclusion `success`; Build step ~1m31s. Deploy production for admin/customer/retailer all `success`. |
| **Severity**         | None (positive)                                                                                                                                                                                                                         |
| **Recommended fix**  | None                                                                                                                                                                                                                                    |
| **Estimated effort** | —                                                                                                                                                                                                                                       |
| **Current status**   | Green                                                                                                                                                                                                                                   |

### B2 — Local verify (sans build) green

| Field                | Value                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Local `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` all exit 0 on Node 22.20.0.                                           |
| **Evidence**         | Audit session logs: lint 12/12 tasks; typecheck 12/12; test 8 packages including domain 108 tests + database 113 tests; prettier “All matched files use Prettier code style!” |
| **Severity**         | None (positive)                                                                                                                                                               |
| **Recommended fix**  | None                                                                                                                                                                          |
| **Estimated effort** | —                                                                                                                                                                             |
| **Current status**   | Green                                                                                                                                                                         |

### B3 — Local `pnpm build` not re-run during audit

| Field                | Value                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | Local production build was **not** re-executed in this audit session to avoid corrupting live `.next` directories (CLAUDE.md footgun). Build correctness is evidenced by CI on the same SHA. |
| **Evidence**         | CLAUDE.md: “Stop `pnpm dev` before [build] runs”; local Next PIDs already dead at audit time, but CI Build step succeeded on `e75de84`.                                                      |
| **Severity**         | Info (methodology)                                                                                                                                                                           |
| **Recommended fix**  | Optional: stop any leftover Next processes and run full six-command chain before next release cut.                                                                                           |
| **Estimated effort** | 5–10 min                                                                                                                                                                                     |
| **Current status**   | Accepted; CI covers build                                                                                                                                                                    |

### B4 — No dependency / lockfile conflicts observed

| Field                | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **Findings**         | Frozen lockfile install succeeds; no resolution conflicts reported.             |
| **Evidence**         | `pnpm install --frozen-lockfile` → “Lockfile is up to date… Already up to date” |
| **Severity**         | None (positive)                                                                 |
| **Recommended fix**  | None                                                                            |
| **Estimated effort** | —                                                                               |
| **Current status**   | Clean                                                                           |

### B5 — Apps and packages typecheck individually

| Field                | Value                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | All workspace packages with typecheck scripts pass (`admin`, `retailer`, `customer`, `domain`, `database`, `auth`, `ui`, `utils`, `payments`, `email`, `sms`, `ai`). |
| **Evidence**         | Turbo typecheck: 12 successful, 12 total.                                                                                                                            |
| **Severity**         | None (positive)                                                                                                                                                      |
| **Recommended fix**  | None                                                                                                                                                                 |
| **Estimated effort** | —                                                                                                                                                                    |
| **Current status**   | Clean                                                                                                                                                                |

### B6 — E2E not part of automatic build gate

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Findings**         | Playwright e2e job is skipped on push (workflow_dispatch only). Build health does not include browser journeys.                            |
| **Evidence**         | CI run 30444939257 job “End-to-end tests” conclusion `skipped`; `.github/workflows/ci.yml` `if: github.event_name == 'workflow_dispatch'`. |
| **Severity**         | Medium (quality gate gap — see testing-audit.md)                                                                                           |
| **Recommended fix**  | Re-enable e2e on push after Supabase-on-runner fix; until then run freeze e2e locally before pilot.                                        |
| **Estimated effort** | 1–2 days infra                                                                                                                             |
| **Current status**   | Known intentional                                                                                                                          |

---

## Per-application build matrix

| App / package    | Lint | Typecheck | Unit test         | Build (CI)      |
| ---------------- | ---- | --------- | ----------------- | --------------- |
| `@paon/admin`    | Pass | Pass      | N/A (e2e only)    | Pass            |
| `@paon/retailer` | Pass | Pass      | N/A               | Pass            |
| `@paon/customer` | Pass | Pass      | N/A               | Pass            |
| Shared packages  | Pass | Pass      | Pass (~284 cases) | Via turbo build |

---

## Overall status

**Buildable.** Compiler and type systems are clean. No missing imports or package version conflicts detected in this pass. Residual risk is e2e not gating `main`.
