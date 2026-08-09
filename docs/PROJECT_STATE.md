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
complete and no evidence record was fabricated.

Lane D's already-authored Virtual Wardrobe Studio foundation is now reconciled
into Lane H as `7cc9ba7`; `933ef29` regenerates database types from the exact
Lane H migrated schema. Migration `20260806100000` has no filename collision,
applies cleanly on disposable local Supabase, and passes 177/177 pgTAP plus
the focused 58 domain/AI/database assertions. Workspace lint/typecheck, all
unit suites, all three production builds and format check pass. The global
completion validator remains red on historical stale/missing evidence for
unrelated checked items, so neither 4.6 nor 17.10 is falsely checked complete.
Lane D's 4.7/4.8 customer tranche is now reconciled as `939c537`; `486418a`
adds the R0.3 module and persisted-consent boundary at enqueue and immediately
before provider invocation. `ff0be5a` adds eight real RPC authorization
assertions, bringing disposable-local pgTAP to 185/185, and the committed
customer Playwright journey passes from consent/private uploads through an
approved portrait, owned-item composition and queued generation. Formal 4.6,
4.7/4.8 and 17.10 completion remains unclaimed: the onboarding preview is not
yet an AI-rendered neutral preview, no current ADR-068 connected evidence run
exists for this tranche, and 17.10 still needs persisted budget reservation/
settlement plus MorningRoutine complete-the-look composition.

The next Virtual Wardrobe Studio tranche is reconciled on Lane H as
`9a751bc`: advisors compose and enqueue up to twelve roadmap-linked Outfits,
and customers review each generated look through the existing wardrobe
roadmap. `14235c8` closes the same-House advisor cancellation boundary,
delegated `ad1c133` covers roadmap repository filtering/mapping, and `890ea0f`
keeps the real browser fixture aligned with persisted image-generation
consent. Local proof is 188/188 pgTAP plus both 4.9 browser journeys; the
formal checkbox remains open behind 4.6/4.7/4.8 dependency state and the
repository-wide historical evidence backlog.

Virtual Wardrobe Studio 4.10 is also reconciled on Lane H as `18210d2`:
customer batch enqueue/cancel and consented feedback-to-StyleProfile evidence
now compose with the canonical 4.7–4.9 boundaries. `7cb3c19` restores the
pre-existing event-provenance/replay guarantees after the older Lane D RPC
rewrite, and delegated `07f1bda` grants the persisted generation consent in
the browser fixture. Clean local proof is 190/190 pgTAP and 1/1 connected
customer browser; the formal checkbox remains open behind the unchecked VWS
dependency chain and repository-wide historical evidence backlog.

The provider invariant found while closing the neutral Style Portrait preview
is repaired in `a690d7d`/`8fa3af8`: `gpt-image-2` now receives the signed
customer references as actual multi-image edit inputs instead of seeing their
URLs only as text in a DALL-E 3 prompt. Supported type/size validation, transient
base64 output and the existing private-storage ingestion boundary are covered
by 7 focused AI assertions. The next buildable VWS unit is still the
consent/module-gated onboarding preview job itself; no 4.6/4.7 completion claim
has been made.

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
