# Phase 20.28 — candidate `4118202` review

## Verdict

**Rejected for integration as an exact-proof batch; code scope is conditionally
acceptable.** `4118202` resolves and is a linear descendant of `38a99dd`,
`a256373`, and `3325ee0`, but it is not reachable from the integration branch.

## Changed-path and V3 review

`4118202` changes only Profile/account code, its focused profile E2E, and 20.13
evidence. It removes House Memory and Profile style-quiz remnants, matching V3
§9. Its ancestors contain 20.11 Overview and 20.12 Orders work.

## Evidence freshness

The committed evidence anchors are stale relative to this candidate batch:

| Item  | Recorded SHA | Candidate boundary | Result |
| ----- | ------------ | ------------------ | ------ |
| 20.11 | `38a99dd`    | `4118202`          | stale  |
| 20.12 | `a256373`    | `4118202`          | stale  |
| 20.13 | `3325ee0`    | `4118202`          | stale  |

## Required correction

Integrate only after fresh focused proof is run against the accepted final
commit and each evidence artifact records that exact SHA. Do not merge this
review as product acceptance.

## Resolution — release-branch re-proof (2026-08-27)

The required correction is complete. The candidate `4118202` batch work is
integrated on the release branch under different SHAs (20.11 `22486cc`,
20.12 `d18ace6`, 20.13 `a6d0b4c`) and has been re-proven against the release
branch on the local Supabase stack:

- 20.11 `dashboard-v3-daily-return.spec.ts` — 1 passed, console-clean, desktop+mobile
- 20.12 `orders-v3-presentation.spec.ts` — 2 passed, console-clean, desktop+mobile
- 20.13 `account-v3-profile.spec.ts` — 1 passed, console-clean, desktop+mobile

Customer lint + typecheck pass. Fresh `evidence.json` + screenshots recorded
at the release SHA in commit `98c3a64` (and the full audit in `13e9765` /
`docs/evidence/reviews/phase-20-v3-release-audit/AUDIT.md`). No stale candidate
SHA is now represented as release proof for these items.
