# Testing Audit

**Snapshot:** 2026-07-29T11:28:23Z  
**HEAD:** `e75de84`  
**Verdict:** Package Vitest healthy (~57 files / ~284 cases). Playwright covers freeze journeys but is **manual-only in CI**. No coverage tooling. Apps have zero unit tests.

---

## Findings

### T1 — Unit tests green locally and in CI

| Field                | Value                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | All package unit tests pass.                                                                                                                                   |
| **Evidence**         | Local `pnpm test`: domain 19 files / 108 tests; database 27 files / 113 tests; plus auth/payments/ai/email/sms/utils. CI Unit tests step success on `e75de84`. |
| **Severity**         | None (positive)                                                                                                                                                |
| **Recommended fix**  | None                                                                                                                                                           |
| **Estimated effort** | —                                                                                                                                                              |
| **Current status**   | Green                                                                                                                                                          |

### T2 — E2E gated off automatic CI

| Field                | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Findings**         | 28 Playwright specs (~59 tests) across three apps never run on push/PR.                                                                        |
| **Evidence**         | `.github/workflows/ci.yml` e2e `if: workflow_dispatch`; run 30444939257 e2e job `skipped`. Comment cites `supabase start` exit 254 on runners. |
| **Severity**         | **High**                                                                                                                                       |
| **Recommended fix**  | Fix runner Supabase; re-enable on push before paid pilot. Until then: local ritual for freeze specs.                                           |
| **Estimated effort** | 1–2 days                                                                                                                                       |
| **Current status**   | Intentional workaround                                                                                                                         |

### T3 — No app-level unit tests

| Field                | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Findings**         | Apps have only `test:e2e`; Server Actions / route handlers untested at unit level. |
| **Evidence**         | `find apps -name '*.test.ts'` → 0; app package.json scripts.                       |
| **Severity**         | Medium                                                                             |
| **Recommended fix**  | Prefer testing logic in packages; add repo tests for Studio-critical paths.        |
| **Estimated effort** | M                                                                                  |
| **Current status**   | Open                                                                               |

### T4 — CommercialProspectRepository untested

| Field                | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Findings**         | Demo Studio depends on commercial prospect repository; no companion `*.test.ts`. Schemas are tested. |
| **Evidence**         | Schema tests exist; repository file lacks test twin (unlike most other repos).                       |
| **Severity**         | High (freeze ROI)                                                                                    |
| **Recommended fix**  | Add repository unit tests (create/version/publish/expire).                                           |
| **Estimated effort** | S–M                                                                                                  |
| **Current status**   | Gap                                                                                                  |

### T5 — No skipped tests in source

| Field                | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Findings**         | No `test.skip` / `describe.skip` / `xit` found. Playwright `forbidOnly` set for CI. |
| **Evidence**         | Grep empty.                                                                         |
| **Severity**         | None (positive)                                                                     |
| **Recommended fix**  | Keep                                                                                |
| **Estimated effort** | —                                                                                   |
| **Current status**   | Clean                                                                               |

### T6 — No coverage tooling

| Field                | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Findings**         | No c8 / Istanbul / `@vitest/coverage-*` configured.              |
| **Evidence**         | Package vitest configs lack coverage block; no coverage scripts. |
| **Severity**         | Low                                                              |
| **Recommended fix**  | Optional package-only coverage later; don’t gate freeze on %.    |
| **Estimated effort** | S                                                                |
| **Current status**   | Absent                                                           |

### T7 — Freeze e2e map (when run)

| Workstream  | Specs                                                                 | Gaps                                             |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| Storefront  | `storefront`, `landing-page`, `catalogue`, `collections`, `mobile-ux` | Some purchase paths use `?legacy=1`              |
| Demo Studio | `demo-studio`, `demo-experience`, `private-demo`                      | Repo/actions unit gap                            |
| Marketing   | `marketing` (`/`, `/pricing`, `/demo-request`)                        | `/founder`, `/pilot`, `/consultation` not smoked |

| Field                | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Severity**         | Medium                                          |
| **Recommended fix**  | Retarget legacy assertions; smoke founder page. |
| **Estimated effort** | S                                               |
| **Current status**   | Partial                                         |

### T8 — Unit suite skewed to out-of-freeze domains

| Field                | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| **Findings**         | Many alterations/payments tests — healthy for later, not freeze-critical. |
| **Evidence**         | Database test file names.                                                 |
| **Severity**         | Info                                                                      |
| **Recommended fix**  | Don’t expand alterations tests during freeze.                             |
| **Estimated effort** | —                                                                         |
| **Current status**   | Acceptable                                                                |

---

## Approximate coverage judgment

| Area                                                  | Confidence                 |
| ----------------------------------------------------- | -------------------------- |
| Domain schemas                                        | High                       |
| Most database repos                                   | Medium–High                |
| Freeze storefront / Studio / marketing in **auto CI** | Low                        |
| Same journeys when e2e run locally                    | Medium                     |
| App UI / `@paon/ui`                                   | Near zero                  |
| Guess overall                                         | ~15–30% packages; ~0% apps |

---

## Overall status

**Testing health: Adequate for continuous package safety; weak for freeze regression detection on `main`.** Highest leverage: re-enable e2e + test `CommercialProspectRepository`.
