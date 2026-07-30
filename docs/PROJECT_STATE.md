# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30.

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Schema source: 119 forward Supabase migrations plus generated TypeScript
  database types.

## Implemented baseline relevant to the programme

- Stages 0–5 complete. Stage 6 blocked.
- Stage 7.0–7.8 complete (ADR-066).
- Stage 8.0–8.3 complete (ADR-067).
- Stage 9.1 complete locally: staged-file migration cockpit with dry-run,
  dependency-ordered publish, reconcile, dead-letter rejection, and resume.

## Current handoff

Stage 9.2 is the next dependency-complete tranche: Shopify and Faden adapters.
Stage 6 remains blocked; skip it.
