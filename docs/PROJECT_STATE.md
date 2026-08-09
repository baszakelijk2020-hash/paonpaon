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

Lane H snapshot (2026-08-09, `73f9480`): Stage 4's Virtual Wardrobe Studio
chain (4.6, 4.7/4.8, 4.9, 4.10) is now checked complete with ADR-068 evidence
(`docs/evidence/tranches/4.6.json`, `4.7.json`, `4.9.json`, `4.10.json`) —
all four items were already functionally done across many prior sessions
(transactionally consent-gated enqueue, `gpt-image-2` multi-image provider
adapter, claim-and-process queue, tenant RLS, private storage, advisor
roadmap composition, customer batch queue and StyleProfile feedback loop)
but stayed unchecked purely on missing connected evidence and the resulting
dependency-chain gate. Re-verified at `73f9480` itself: fresh
`supabase db reset`, 208/208 pgTAP, 509 database tests, all four owning
Playwright specs (`virtual-studio`, `roadmap-look-review`,
`virtual-studio-batch-and-feedback-evidence`, `visual-roadmap`) passing,
`pnpm lint`/`typecheck`/`build`/`format:check` clean. Live rendered-image
proof remains `blocked_external` on `OPENAI_API_KEY`.

Stage 17.10 (AI try-on / MorningRoutine) remains unchecked: the provider-
neutral authorization contract, persisted budget-reservation/settlement
RPCs (`reserve_virtual_try_on_generation`/`settle_virtual_try_on_generation`,
migration `20260809170000`) and complete-the-look tap-to-generate UI
(wardrobe-level and item-specific, 17.13) all exist and are proven
(`885ca9f`, `259fc78`, `581fde7`, `7999202`, `7ba5e45`), but the ledger is
deliberately **not wired to gate today's generation path**
(`enqueueLook`/`WardrobeVisualizationJobRepository`) — every retailer's
policy row seeds `enabled = false` by design (no invented billing default),
so wiring the gate now would silently block all existing generation for
every retailer. This is a real founder-controlled product decision (an
approved credit/billing model), not an oversight — do not wire it without
that decision. 17.10's own "Hard blockers" line already documents this.

Stage 17.14 (prospect AI conversation/buying-intent queue/human handoff) is
checked complete with connected evidence
(`docs/evidence/runs/17.14.json`, code SHA `964d9db`).

Repository-wide: the completion-evidence validator (`pnpm validate:completion`)
remains red on a pre-existing historical backlog unrelated to any of the
above — stale/missing evidence on already-checked 8.4, 9.1, 11.4, 12.2, 12.4,
13.1, 13.2, 17.1–17.6, 17.9, 17.14, 18.1, 18.2, 18.6, 18.8, 18.12. This is
documented across many prior sessions' own status text as out of scope for
whichever capability they were closing; re-verify before assuming it's still
accurate.

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
