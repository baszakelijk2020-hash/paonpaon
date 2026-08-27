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

| Item | Recorded SHA | Candidate boundary | Result |
| --- | --- | --- | --- |
| 20.11 | `38a99dd` | `4118202` | stale |
| 20.12 | `a256373` | `4118202` | stale |
| 20.13 | `3325ee0` | `4118202` | stale |

## Required correction

Integrate only after fresh focused proof is run against the accepted final
commit and each evidence artifact records that exact SHA. Do not merge this
review as product acceptance.
