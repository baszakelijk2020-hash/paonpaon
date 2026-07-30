# Stage-end repair ledger

Non-blocking visual/copy/secondary-device defects deferred from tranche evidence
live here. Blocking defects (data loss, source-authority, RLS, migration,
broken build, dead-end primary flow) may not be deferred.

## Stage 8 (through 8.4)

- **Integrity repair (8.4 gate):** `verified_local` now requires
  `docs/evidence/runs/<id>.json` (`phaseItemId`, `gitSha`, `spec`,
  `status=passed`, `timestamp`) from the exact Playwright invocation; a
  `*.spec.ts` path alone is rejected. Until a current passed `runs/8.4.json`
  exists, 8.4 and dependent 9.1 stay `implemented_unverified`.
- **Blocker (8.4 browser proof):** local
  `pnpm exec playwright test e2e/completion-harness.spec.ts` failed in
  `ensureProgrammeProofSeed` / demo seed with
  `invalid input value for enum public.metadata_concept_kind: "fabric"`.
  No advisor UI mutation ran. Fix seed/enum alignment, re-run that one spec
  (writes the run artifact), then re-claim `verified_local`.
- Phone/tablet/keyboard-a11y matrix for the completion harness marked `n_a`
  with rationale; revisit in one stage-end sweep rather than per-tranche
  device farms.
- Customer-detail House notes empty-state copy and secondary visual polish
  outside the advisor→manager mutation path: sweep later if still open.
