# Stage-end repair ledger

Non-blocking visual/copy/secondary-device defects deferred from tranche evidence
live here. Blocking defects (data loss, source-authority, RLS, migration,
broken build, dead-end primary flow) may not be deferred.

## Stage 8 (through 8.4)

- **Integrity repair (8.4 gate):** `verified_local` now requires
  `docs/evidence/runs/<id>.json` (`phaseItemId`, `gitSha`, `spec`,
  `status=passed`, `timestamp`) from the exact Playwright invocation; a
  `*.spec.ts` path alone is rejected. Until a current passed `runs/8.4.json`
  lands with the verified claim, 8.4 and dependent 9.1 stay
  `implemented_unverified`.
- **Fixed (8.4 seed):** `sync_loyalty_milestones_for_order` used invalid enum
  literal `'fabric'` on `metadata_concept_kind` (forward migration + domain
  use `fibre` / `fabric_collection`). Demo seed and harness mutation path
  unblocked.
- Phone/tablet/keyboard-a11y matrix for the completion harness marked `n_a`
  with rationale; revisit in one stage-end sweep rather than per-tranche
  device farms.
- Customer-detail House notes empty-state copy and secondary visual polish
  outside the advisor→manager mutation path: sweep later if still open.
