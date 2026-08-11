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

Lane H (branch `agent/lane-h-customer-ai-conversation`), updated 2026-08-11.
Governance: AGENTS.md ch.50 (Product-readiness convergence gate), ch.51
(Never-stop material execution), ch.53 (Visual Wardrobe Precision
Authority), ch.54 (Claude quota/parallel-execution policy) all active. A
15-minute session cron enforces ch.51 as a safety net — resumes if the
active run idles/stops/gets stuck on one blocker, stays out of the way
otherwise. Founder-enabled 2026-08-10, remains enabled until explicitly
paused.

**PHASE items closed this session, each independently verified (not just
worker-claimed) before merge:**

1. **11.3** (`718f9d9`) — `CeremonyForm` exposes the `appliesWhen` trigger
   per step; closed the item's last named gap.
2. **10.1** (`ae329ad`) — versioned campaign library: order-outcome
   auto-linking, post-activation correction-via-clone, multi-role browser
   proof. Independent verification found the auto-link silently no-op'd
   under real customer RLS (the delegated build only tested with an admin
   client) and that `placeOrder` — the only method wired — isn't what
   `apps/customer`'s real cart checkout calls (`checkoutCart` is); both
   fixed.
3. **11.2 partial** (`e54ecba`) — ten-minute shift closeout flow
   (`staff_shift_closeouts`). Verification found an over-broad RLS SELECT
   policy (any staff role could read any colleague's closeout notes) and
   an unvalidated cross-tenant `extra_mile_act_id` reference; both fixed.
   Checkbox stays unchecked — unified role home and WFM-103's tasks/
   promises/briefing architecture remain.
4. **12.1** (`00f71c2`) — guided self-measurement capture (customer app)
   and reorder-gate status surface. Verification found the original
   migration only granted staff INSERT on `customer_measurement_candidates`
   (customers had no path to self-insert at all) and that
   `customer_measurement_versions`' deliberate immutability meant e2e
   tests polluting the shared seed customer would do so permanently; both
   fixed (new customer-scoped insert policy; tests use dedicated throwaway
   customers).
5. **9.2 partial** (`441f168`) — connector connection-creation UI. Most of
   the item's retailer lifecycle surface (pause/resume/disconnect, manual
   sync, sync-runs/dead-letters) already existed and worked before this
   slice; only creation had no UI. The delegated first pass silently
   rewrote the page instead of extending it, deleting that pre-existing,
   already-tested functionality — caught by the pre-existing "pause blocks
   a live webhook" e2e test failing on independent verification, reverted
   and re-applied minimally. Also found `integration_connections` grants
   INSERT to `service_role` only; fixed using this codebase's own
   established admin-client-for-authorized-write precedent
   (`rehearseCampaign`/`activateCampaignToStaffMissions`).

**Recurring pattern worth naming:** every one of the above had a real,
independently-found defect the delegated build either introduced or missed
— stale/broken RLS assumptions, wrong client scoping, or (once) an outright
regression from an unrequested rewrite. Trust the verification step, not
worker narration, per AGENTS.md ch.20.

**PHASE 15.2** (`7f533b5`, prior session) — concierge request surface done;
reward UI/accounting export remain genuinely blocked on ADR-062.

**PHASE 17.13 investigated but NOT built** (prior session) — its two
remaining named gaps both need a real architecture decision, not wiring:

- _Unattached (logged-out-created) item_: `wardrobe_items.customer_id` is
  `not null` (`20260730160000_add_wardrobe_ownership.sql:12`); making it
  nullable cascades into RLS/triggers across the table.
- _Periodic fit-check photo → Self-Portrait update_: the MeasurementMonitor
  decision gate can only classify against **numeric millimetre values** —
  a photo alone produces no numbers, so this needs a schema/domain
  extension (a non-numeric candidate type), not a new Server Action.

Known blockers this lane routes around per ch.51, not stopping for: PHASE
15.2's reward UI/accounting export (ADR-062); PHASE 17.13's two gaps
(architecture decisions above); PHASE 17.10's live try-on gate (founder
billing decision — wiring it now would silently block all existing
generation). None block other lane-H work.

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
