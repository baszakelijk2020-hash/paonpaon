---
name: feature-slice-delegation
description: Compose a context-optimized delegation prompt for a large new PAON feature/vision (e.g. a security, compliance, or cross-cutting capability request), split into a frontier-judgment slice and a cheap-worker-delegable remainder. Use when the founder hands you a product/security vision document rather than a literal spec, and the resulting work is too large for one PHASE.md item.
---

# Feature-slice delegation

Turns a vision-level founder prompt into PAON work without re-deriving
AGENTS.md's context and delegation rules from scratch each time, and without
burning a frontier session on work that doesn't need frontier judgment.

Non-authoritative: this is a Claude-side convenience layer only. The
binding rule any frontier agent (Claude, Codex, or otherwise) must follow —
classify every bounded unit as Route A/B/C, delegate A/B via a light or
implementation worker, inspect the result itself, continue without founder
intervention — lives in AGENTS.md's "Hard delegation invariant" through
"Claude Route-A adapter" chapters, not here. Codex or another
frontier seat with no access to this skill file must still follow that rule
correctly from AGENTS.md alone.

## 0. Dispatch the explorer before you investigate

Before doing any Route-A investigation yourself to understand the vision's
blast radius (locating existing patterns, call sites, schema shape,
implementation completeness), dispatch the `paon-explorer` agent (Haiku) —
or `paon-test-investigator` for test/lint/type-failure diagnosis. This is
enforced, not optional: `scripts/delegation-gate.sh` (a PreToolUse hook)
rejects sustained un-delegated Read/Grep/Glob/Bash investigation past a
small budget and only resets it once an `Agent` delegation is recorded in
`.claude/delegation-state.json`. Only read files yourself when the read is
the narrow inspection needed for the Route-C judgment itself (e.g. the one
migration whose RLS shape you're about to design), not to survey the
repository.

## 1. Load, don't re-derive

Read AGENTS.md's "Minimum frontier context" and "Hard delegation invariant"
sections directly — do not restate their rules in the outgoing prompt. Load only:
`AGENTS.md`, the active gate/item in `docs/PHASE.md`, the Resume Protocol,
the ADR/blueprint the item names, and the directly-affected code/tests. Do
not audit the whole repository or reread unrelated Markdown — same rule
AGENTS.md already states for every ordinary turn.

## 2. Translate vision to slices

Restate the founder's vision as an ordered list of coherent slices (a
security/access model, a workflow, a data-sensitivity taxonomy — whatever
the vision actually decomposes into). Each slice needs its own Acceptance
and Tests, matching `PHASE.md`'s existing item shape, so it can become a
`PHASE.md` item or sub-item on completion.

## 3. Classify every slice as Route A/B/C before doing any of it

For each slice, decide up front (AGENTS.md's Route classification chapters):

- **Route C — frontier-only** (do it yourself, this session): architecture,
  RLS/tenant isolation authorship, money/stock/tenant migrations,
  AI-authorization or prompt/grounding design, a founder-decision item, or
  any other judgment call from AGENTS.md's Route C list.
- **Route A — light-worker mandatory**: read-only investigation, symbol/file
  location, evidence refresh, existing-pattern lookup, mechanical
  cleanup — dispatch `paon-explorer` or `paon-test-investigator` (Haiku).
- **Route B — implementation-worker mandatory once its shape is settled**:
  repetitive repository/RPC wiring, fixtures, tests that follow an
  established pattern, UI wiring against an already-tested repository
  method, evidence-file updates. These do not need a frontier session even
  if they sit inside an otherwise frontier-only feature — carve them out.

A single feature vision is almost never 100% one route. Do the Route C
slice(s) first (they usually establish the schema/RLS/policy shape the
delegable slices depend on), then hand each Route B remainder to
`pnpm paon:delegate -- --item <ID> --scope "<bounded task, one paragraph>"`
(or the `paon-mechanical-worker` agent for a smaller bounded slice) per
AGENTS.md's existing procedure — do not do delegable work inline in the
frontier session just because it's convenient; that's the budget leak.

## 4. Sequencing discipline

Do not attempt every slice superficially in one pass. Implement the first
coherent slice fully — adversarially tested, committed, definition-of-done
green — before starting the next. Do not finish with documentation or TODOs
instead of working controls. If the founder's proposed order is contradicted
by what the code actually looks like once you're in it, resequence and say
so; don't force the original order.

## 5. What NOT to duplicate in the outgoing prompt

Do not re-paste AGENTS.md's rules, the Resume Protocol, or the definition-of-
done command into a prompt for yourself or a delegated worker — reference
them by name. A prompt that reconstructs process instructions from scratch
is exactly the token cost this skill exists to remove.
