# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30.

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Schema source: 120 forward Supabase migrations plus generated TypeScript
  database types.

## Implemented baseline relevant to the programme

- Stages 0–5 complete. Stage 6 blocked.
- Stage 7 and Stage 8.0–8.3 complete under ADR-066/067.
- Stage 9.1 is `implemented_unverified`: canonical customer/product/stock/order
  write-through and one local operator browser pass landed, but PHASE
  verification waits on dependency Stage 8.4.
- Stage 9.2 is `implemented_unverified`: Shopify/Faden mapping, signature and
  read-only fixture foundations exist; executable connection/scheduling/
  webhook lifecycle and multi-role browser proof are missing. Live provider
  proof is additionally blocked on credentials.
- Stage 9.3 is demand-led and blocked on prospect evidence.
- Stage 10.1 is `implemented_unverified`: versioned library and pinned retailer
  copies exist; mapping/rehearsal, staff/customer activation, outcome/
  correction and multi-role browser proof are missing.

## Current handoff

Stage 8.4 remains `implemented_unverified` (demo-seed
`metadata_concept_kind`/`fabric` blocks its harness). Stage 9.1 write-through
may continue in parallel but is not dependency-complete/`verified_*` until
8.4 passes once. Next buildable work around that gate: keep repairing 8.4
seed, or independent slices that do not claim completion over unmet
dependencies. Preserve untracked Stage 10.2 WIP. Stage 6 and 9.3 remain
blocked; skip them.
