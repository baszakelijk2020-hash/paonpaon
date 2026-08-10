# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

## How to use this file

This file is a short pointer, not a diary. It previously accumulated one
verbose dated section per session (10+ stacked "supersedes everything below"
handoffs, 1500+ lines) that were never removed, so a full read cost tokens
without adding information the Resume Protocol, `PHASE.md`'s per-item status,
or `git log` didn't already carry. That history is not lost — it is intact in
`git log`, in each session's own commits, and in `docs/evidence/runs/`. It was
removed from here on 2026-08-07 per this file's own rule ("factual snapshot,"
never an archive) and `WORKING_AGREEMENT.md`'s "keep `PROJECT_STATE.md`
factual and short."

Going forward: **overwrite this file on each meaningfully different session;
do not append a new dated section below the last one.** If a fact here is
superseded, replace it in place. `PHASE.md`'s item status lines are
authoritative for what is built; `git log --oneline` and
`docs/evidence/runs/` are authoritative for when and how.

## Current snapshot

Lane H snapshot (2026-08-10): this session hardened Claude Code's own
Route-A delegation enforcement (see `AGENTS.md`'s Hard delegation invariant
and `scripts/delegation-gate.sh` — a PreToolUse hook, not just prose), then
resumed material PAON work. Seven feature commits landed on top of that,
each independently typechecked/linted/browser-proven before push:

1. **FT-01 fit-profile candidate review** (`d0b8ea1`, `50785f6`) — staff
   propose a fit-profile candidate from a fitting observation, an advisor
   approves/rejects from the customer detail page. Migration, repository,
   Server Actions, UI, e2e, and a pgTAP tenant-isolation test all new.

2. **PHASE 11.3** (`a2f4064`, `0505e82`, `71a90a1`, `0ba63f0`) — closed out
   end-to-end. Coverage/coaching already existed; this session added
   availability declarations, shift-swap requests, service-ceremony
   version publishing, and contextual ceremony prompts (wired into the
   PHASE 17.3 appointment-brief page via `promptsForContext`, keyed by
   `appointment.type`). Still unchecked: the publish form has no UI for a
   step's `appliesWhen` trigger, so every published step applies
   unconditionally — a narrower, explicitly named remaining gap, not a
   missing capability.

3. **PHASE 15.2** (`7f533b5`) — concierge request surface. Reward UI and
   accounting export remain genuinely blocked on ADR-062 (stored-value
   decision); concierge requests were never blocked on that (own docblock
   says so) and just needed wiring — reuses `MessagingRepository`
   verbatim, no new table, same precedent as PHASE 17.13's alteration/
   cleaning booking below.

**PHASE 17.13 investigated but NOT built** — its two remaining named gaps
both turned out to need a real architecture decision, not wiring, so this
session deliberately stopped rather than rush them at the tail end of a
long run:

- _Unattached (logged-out-created) item_: `wardrobe_items.customer_id` is
  `not null` (`20260730160000_add_wardrobe_ownership.sql:12`); making it
  nullable cascades into RLS/triggers across the table.
- _Periodic fit-check photo → Self-Portrait update_: the MeasurementMonitor
  decision gate (`packages/domain/src/fit/measurement-monitor.ts`,
  `decideMeasurementOutcome`) can only classify a candidate against
  **numeric millimetre values** compared to the approved version — a photo
  alone produces no numbers, so representing "customer flagged via photo,
  needs human judgment" honestly requires a schema/domain extension (a
  non-numeric candidate type), not a new Server Action calling existing
  methods. Fabricating placeholder values to force it through the existing
  pipeline would violate that module's own explicit anti-fabrication
  design (see its docblock).

Recurring monitor cron paused by explicit founder request 2026-08-10 —
**do not re-enable autonomous continuation on this lane without being
asked.**

Stage 17.10 (AI try-on / MorningRoutine) remains unchecked: the ledger is
deliberately **not wired to gate today's generation path** — every
retailer's policy row seeds `enabled = false` by design, so wiring the gate
now would silently block all existing generation. This is a founder-
controlled billing decision, not an oversight; do not wire it without that
decision (17.10's own "Hard blockers" line documents this).

Repository-wide: the completion-evidence validator (`pnpm validate:completion`)
remains red on a pre-existing historical backlog unrelated to any of the
above — stale/missing evidence on already-checked 8.4, 9.1, 11.4, 12.2, 12.4,
13.1, 13.2, 17.1–17.6, 17.9, 17.14, 18.1, 18.2, 18.6, 18.8, 18.12. This is
documented across many prior sessions' own status text as out of scope for
whichever capability they were closing; re-verify before assuming it's still
accurate.

Several stale delegated worktrees exist under `.claude/worktrees/` (lanes
a/b/c/e/f/g and various `delegate-*`) from earlier takeover sessions,
mostly last touched 2026-08-07 or older. They are not active concurrent
writers — check each lane's own last-commit date before assuming otherwise,
per AGENTS.md §36.

Last hand-maintained update: 2026-08-05 (FT-02 silhouette analysis
consent/capture state machine landed on `agent/grok-takeover-2026-07-30`).
Commits since then — including FT-09's consultation-to-appointment journey —
are real and pushed but not re-summarized here; check `git log --oneline -20`
and the relevant `FT-*`/stage entry in `PHASE.md` directly rather than
trusting a stale narrative paragraph.

Known-open items as of the last hand-maintained update, per their own
`PHASE.md` status text (re-verify each before acting on it, since later
sessions may have closed some of these):

- FT-01 (voice recognition), FT-13 (planner workflow gaps), FT-14
  (customer/advisor/partner journey) — each still large.
- Stage 17.7 (parked, no MTM pricing engine), 17.11 (needs its own scoping
  pass), 18.3 (no TTL policy specified), 18.4's public self-service-booking
  remainder, 18.7 (needs a founder decision on order granularity), 18.9 (no
  `contract_value`/`repair` schema field).
- Everything blocked on external credentials (OpenAI key, live
  signal-source access, Vercel production project confirmation).

`ENVIRONMENTS.md` is the project ledger for Supabase/Vercel targets — read it
directly rather than trusting a cached description here. Two Supabase
projects existed as of the 2026-08-01 takeover (original vs. a dedicated
non-production project); confirm which one the current environment points at
before running integration tests or migrations, per `AGENTS.md`'s
environment-safety rules.
