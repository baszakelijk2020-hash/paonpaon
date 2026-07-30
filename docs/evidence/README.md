# Tranche completion evidence

Machine-readable evidence for ADR-068 / Stage 8.4+. Each checked PHASE item
from `8.4` onward must have a matching `tranches/<id>.json` that
`pnpm validate:completion` accepts as `verified_local` or `verified_live`.

`verified_local` / `verified_live` also require one current Playwright run
artifact at `runs/<id>.json` (`phaseItemId`, `gitSha`, `spec`,
`status=passed`, `timestamp`) written by that exact browser invocation.
Existence of the `*.spec.ts` path alone is not sufficient. No screenshots or
device matrix.

Stages `0`–`8.3` are grandfathered and do not require retroactive evidence.
