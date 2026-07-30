# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30.

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Schema source: forward Supabase migrations plus generated TypeScript
  database types.

## Implemented baseline relevant to the programme

- Stages 0–5 complete. Stage 6 blocked.
- Stage 7 and Stage 8.0–8.3 complete under ADR-066/067.
- Stage 8.4 is `verified_local`: completion evidence gate + multi-role
  Playwright harness with `docs/evidence/runs/8.4.json` (`status=passed`).
- Stage 9.1 write-through landed; verification status is asserted in
  `PHASE.md` / `docs/evidence/tranches/9.1.json` after the current seal.
- Stage 9.2 is `implemented_unverified`: Shopify/Faden mapping, signature and
  read-only fixture foundations exist; executable connection/scheduling/
  webhook lifecycle and multi-role browser proof are missing. Live provider
  proof is additionally blocked on credentials.
- Stage 9.3 is demand-led and blocked on prospect evidence.
- Stage 10.1 is `implemented_unverified`: versioned library and pinned retailer
  copies exist; mapping/rehearsal, staff/customer activation, outcome/
  correction and multi-role browser proof are missing.
- Stage 10.2 Honeymoon/Seven-Day WIP is preserved on branch
  `wip/stage-10-2-honeymoon` (not on `main`).

## Current handoff

See Resume Protocol in `PAON_INTELLIGENCE_PLATFORM.md` for the exact next
queue item after this seal. Stage 6 and 9.3 remain blocked; skip them.
