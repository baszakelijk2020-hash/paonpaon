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

Lane H snapshot (2026-08-09):
`agent/lane-h-customer-ai-conversation` advanced Stage 17.10 from `c1121a3`.
The frontier-authored virtual-try-on authorization/ledger contract is in
`aacf40f`; bounded tests were delegated to
`agent/lane-delegate-17-10-20260809114417`, independently reviewed, and
accepted as `cbc3df6`. The 25-case domain suite, workspace lint/typecheck,
build, and format check are green. The completion-evidence validator remains
red on historical stale/missing checked-item records, so 17.10 is not claimed
complete and no evidence record was fabricated. Persisted usage settlement
must first reconcile the adjacent generation-job schema already present on
the unmerged `agent/lane-d-virtual-wardrobe-studio` branch; no migration was
authored in lane H.

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
