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

Lane H snapshot (2026-08-09): AGENTS.md gained a binding "Material-progress
gate" — classify every candidate task as BLOCKER/MATERIAL_BUILD/
MATERIAL_INTEGRATION/ADMINISTRATION; formal PHASE checkbox closure is
subordinate to material product progress. `docs/PHASE.md`'s control-gate
instruction now points at this classification instead of raw document order.

Under that gate, two real capabilities were built this session:

1. **PHASE 17.8** — the AI sales-roleplay conversation partner that was
   genuinely missing (persona catalog/grading loop already existed; the
   actual AI conversation itself did not). New `academy_roleplay_sessions`/
   `academy_roleplay_messages` tables, three identity-re-deriving RPCs,
   `@paon/ai`'s `generateAcademyRoleplayReply` provider capability, a
   `/staff/learning` practice UI, and grading integration
   (`roleplay_session_id`). Checked complete with evidence.

2. **PHASE 18.5** — closed the long-named gap: `corporate_wearers.
customer_id` existed since 20260801000012 with no write path and no read
   path in either direction. Added the tenant-invariant link trigger,
   additive RLS on appointments/orders/alteration views/measurement
   versions (keyed off the wearer's own `corporate_wearers` row, since a
   wearer's Employee Portal login and their linked customer's login can be
   different auth users for the same real person), a staff-driven link-by-
   email UI, a safe silent auto-link for the same-login case, and four new
   read sections on `/employee`. Checkbox remains unchecked: wardrobe,
   announcements and write-capable self-service (booking, not just
   reading) are real, unattempted gaps. **A more complete design already
   exists but was never implemented**: `agent/lane-g-employee-portal-
linking` (stale since 2026-08-07,
   `docs/EMPLOYEE_PORTAL_SELF_SERVICE_BLUEPRINT.md`) independently proposed
   the same auto-link mechanism plus opt-in customer-account creation and a
   write-capable booking form — read it before extending this area further.

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
