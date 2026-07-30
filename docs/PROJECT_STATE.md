# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30.

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Monorepo: pnpm 9 + Turborepo.
- Applications: PAON Admin, Retailer Portal, Customer Portal.
- Shared packages include domain, database, auth, UI, utils, payments, email,
  SMS, and AI.
- Schema source: 109 forward Supabase migrations plus generated TypeScript
  database types.
- CI definition of done: frozen install, lint, typecheck, unit tests, build,
  and format check.

## Implemented baseline relevant to the programme

- Stages 0–5 complete through Tie-Mate interim Customer UI.
- Stage 6 payment/compliance/marketplace gates remain blocked.
- Stage 7.0 authority recorded (`4a3881b`, ADR-066).
- Stage 7.1 evidence-cited interest insight: pure
  `projectCustomerInterestInsights`, `CustomerInterestRepository`, and
  Retailer Self-Portrait "Recent interests / Why we think this" (session counts
  null until 7.2). No migration required.

## External systems

- Deployment architecture and live project identifiers are documented only in
  `DEPLOYMENT.md`.
- Local root environment does not currently contain Stripe, Resend, OpenAI,
  Twilio, or OpenWeatherMap credentials. Provider-dependent code must not be
  described as live-verified without separate evidence.

## Current handoff

Next buildable item: PHASE `7.2 Session/event context foundation and
instrumentation`. Resume from `packages/domain/src/intelligence/interaction-event.ts`
and storefront/Tie-Mate capture paths. Skip Stage 6.
