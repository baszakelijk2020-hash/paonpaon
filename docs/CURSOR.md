# Cursor Startup Prompt

Rank 6 — Agent process, subordinate to [../AGENTS.md](../AGENTS.md) (see
[README.md](./README.md) Constitution rule 9). This file carries
Cursor-specific startup and execution mechanics only. It is never a second
copy of PAON's substantive rules, and it never forks them: what to build, in
what order, under what architecture, to what completion standard, and what
counts as a real blocker are governed by `AGENTS.md`, `docs/PHASE.md` and the
authority hierarchy in `docs/README.md`. `CLAUDE.md` is the equivalent thin
wrapper for Claude Code — same pattern.

The founder ruling this file implements is Q4 of the 2026-08-06 documentation
audit, readable at
`git show 934b540:docs/documentation-audit/FOUNDER_ANSWERS.md`: keep the
long-form Cursor prompt but convert it into a thin, explicitly subordinate
tool-specific wrapper, because repository authority must exist only once.

`docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` remains in place
as dated reference material under Rank 12. It is not an operating
specification and does not authorize work; where it differs from `AGENTS.md`,
`AGENTS.md` wins without exception.

Copy everything below the line into Cursor Agent to start or resume a session.
This is one continuous instruction, not a sequence of prompts.

---

You are working in the PAON repository. `AGENTS.md` is the single cross-agent
operating charter — it is not Claude-Code-specific or Cursor-specific, and
this file must never restate, fork, or fall behind what it says. Read
`AGENTS.md` in full now, then follow its "Minimum frontier context" reading
path exactly as written (currently: the charter itself, the active PHASE
contract, the Resume Protocol at the top of
`docs/PAON_INTELLIGENCE_PLATFORM.md` when genuinely needed, the ADR named by
the item, and directly relevant implementation state). Use `docs/README.md`
for the full documentation authority hierarchy whenever a task crosses a topic
boundary.

If any of that seems unclear from those sources, that is a documentation gap
in them, not license to re-derive or restate the rule here.

**Cursor-specific execution behavior** (the only substantive content this file
adds beyond `AGENTS.md`):

- Work autonomously and continuously through the authorized queue in
  `docs/PHASE.md`, following the charter's automatic-continuation and
  default-autonomous-loop chapters (inspect → implement one coherent slice →
  test → repair → update authoritative state → commit → push → take the next
  item). Do not stop after one tranche merely to ask whether to continue —
  `AGENTS.md` already defines the genuine stop conditions that do warrant
  stopping.
- Before editing, inspect `git status`, recent commits, and remote divergence
  — the worktree may contain founder or concurrent-agent changes; preserve
  them, per the charter's environment-safety and multi-lane ownership rules.
- Spend model usage on the first unchecked, dependency-complete item in
  `docs/PHASE.md` — not on re-deriving strategy or architecture already
  recorded in the documents `docs/README.md` indexes.

If a Cursor-specific startup quirk or execution behavior is discovered that
genuinely doesn't fit in `AGENTS.md` (which is written to be tool-neutral),
add it here as a short, explicitly-labeled addition — never as a restatement
of a rule that already exists elsewhere.
