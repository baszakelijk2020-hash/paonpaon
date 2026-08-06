# Cursor Startup Prompt

> **Status:** Active. **Authority:** Rank 6 — Agent process, subordinate to
> `AGENTS.md` (per `docs/README.md` Constitution rule 9). **Purpose:**
> Cursor-specific execution and startup mechanics only — copy/paste
> behavior, autonomy framing, and where to point Cursor's first read. Never
> a second copy of PAON's substantive rules. **Audience:** Cursor Agent
> sessions specifically. **Canonical scope:** how to start and run a Cursor
> session — nothing about product destination, architecture, sequencing, or
> completion standards, all of which live one hop away in `AGENTS.md` and
> the documents it points to. **Depends on:** `AGENTS.md` (this document
> delegates to it for everything substantive). **Supersedes:** its own
> pre-2026-08-06 version, which independently restated Stage sequencing,
> core-architecture rules, connector order, working method, usage
> discipline, real-blockers policy and a completion standard — all now
> removed from this file per founder decision (see
> `docs/documentation-audit/FOUNDER_ANSWERS.md` Q4) because repository
> authority must exist exactly once. The full prior version is preserved at
> `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`.
> **Related documents:** `AGENTS.md`, `CLAUDE.md` (the equivalent thin
> wrapper for Claude Code — same pattern). **Implementation verification
> date:** 2026-08-06.

Copy everything below the line into Cursor Agent to start or resume a
session. This is one continuous instruction, not a sequence of prompts.

---

You are working in the PAON repository. `AGENTS.md` is the single
cross-agent operating charter — it is not Claude-Code-specific or
Cursor-specific, and this file must never restate, fork, or fall behind
what it says. Read `AGENTS.md` in full now, then follow its "Minimum
context" reading path exactly as written (currently: `AGENTS.md` itself,
the active item at the top of `docs/PHASE.md`, the Resume Protocol at the
top of `docs/PAON_INTELLIGENCE_PLATFORM.md`, the ADR named by the item, and
directly relevant code/tests/repository/migration). Use `docs/README.md`
for the full documentation authority hierarchy whenever a task crosses a
topic boundary.

Everything about _what_ to build, in _what order_, under _what
architecture_, to _what completion standard_, and what counts as a _real
blocker_ is governed by `AGENTS.md`, `docs/PHASE.md`, and the authority
hierarchy in `docs/README.md` — never by this file. If any of that seems
unclear from those sources, that is a documentation gap in them, not
license to re-derive or restate the rule here.

**Cursor-specific execution behavior** (this is the only substantive
content this file adds beyond `AGENTS.md`):

- Work autonomously and continuously through the authorized queue in
  `docs/PHASE.md`, following `AGENTS.md`'s continuous-build contract
  (inspect → implement one coherent slice → test → repair → update
  authoritative state → commit → push → take the next item). Do not stop
  after one tranche merely to ask whether to continue — `AGENTS.md`
  already defines the hard-blocker conditions that do warrant stopping.
- Before editing, inspect `git status`, recent commits, and remote
  divergence — the worktree may contain founder or concurrent-agent
  changes; preserve them, per `AGENTS.md`'s environment-safety and
  multi-lane rules.
- Spend model usage on the first unchecked, dependency-complete item in
  `docs/PHASE.md` — not on re-deriving strategy or architecture that is
  already recorded in the documents `docs/README.md` indexes.

If a Cursor-specific startup quirk or execution behavior is discovered
that genuinely doesn't fit in `AGENTS.md` (which is written to be
tool-neutral), add it here as a short, explicitly-labeled addition — never
as a restatement of a rule that already exists elsewhere.
