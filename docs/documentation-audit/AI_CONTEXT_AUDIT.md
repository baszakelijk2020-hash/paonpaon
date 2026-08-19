# AI and Agent Knowledge Efficiency Audit

Audit-only deliverable. Assesses how Claude Code, Codex, Cursor, Gemini and
future agents currently learn PAON, grounded in a direct read of
`AGENTS.md`, `docs/README.md`, `.claude/settings.json`,
`.claude/agents/*.md`, `.claude/prompts/bootstrap-claude-environment.md`,
and `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`.

---

## Required entry documents (as currently specified)

`AGENTS.md` §"Minimum context" already defines a deliberately small
ordinary-turn reading path:

1. `AGENTS.md` itself
2. the active gate/item at the top of `docs/PHASE.md`
3. the Resume Protocol at the top of `PAON_INTELLIGENCE_PLATFORM.md`
4. the ADR named by the item
5. directly relevant code, tests, repository, migration

`docs/README.md`'s "minimum reading path" restates the same five-step chain
independently, near-verbatim. This is the one piece of process
documentation the repository is most disciplined about keeping small — both
documents explicitly warn against re-reading the full programme "unless a
conflict requires it."

**Assessment: this is already well-designed and does not need
restructuring.** The recommendations below are about what surrounds this
core path, not about replacing it.

## Excessive context

- **`docs/PHASE.md` (~5,500 lines) and `docs/DECISIONS.md` (~3,300 lines)**
  are both named in the minimum path, but only _the active item_ /
  _the ADR named by the item_ respectively are meant to be read — not the
  whole file. Both documents are structured to support this (dated,
  numbered, individually addressable entries), and this audit's own
  research agents were able to extract "just the current item" and "just
  ADR-052/068/070/071/073" without reading either file linearly start to
  end. **No change needed** — the size is appropriate for what is a
  genuinely large, append-only project log, and the access pattern already
  supports partial reads.
- **`docs/FOUNDER_TOOL_BLUEPRINTS.md` (~1,300 lines) and
  `docs/PAON_INTELLIGENCE_PLATFORM.md` (~1,250 lines)** are each read in
  full more often than `PHASE.md`/`DECISIONS.md` because their internal
  addressability is coarser (14 FT contracts vs. hundreds of dated line
  items; the Resume Protocol is a clearly-marked top section but the rest
  of the file is prose, not entries). `PAON_INTELLIGENCE_PLATFORM.md`
  already mitigates this correctly — the Resume Protocol is explicitly
  positioned as "read this, not the rest, unless a conflict requires it."
  `FOUNDER_TOOL_BLUEPRINTS.md` has no equivalent "read only your active
  FT" pointer; an agent working FT-09 currently has no documented shortcut
  to just that section. **Recommend**: a short index at the top of
  `FOUNDER_TOOL_BLUEPRINTS.md` linking each FT-ID to its section, mirroring
  the Resume Protocol pattern.

## Repeated instructions

Per `DUPLICATION_AND_CONSOLIDATION.md`, the founder-tool-fidelity rule (ADR-052/071)
is independently restated in 6 places, all consistent and all citing the
ADR. This repetition is appropriate given how load-bearing the rule is and
how costly a violation would be (per ADR-071's own account of what happened
the last time this rule was treated as "loose inspiration": generic
Tailwind scaffolds reported as built). **Not flagged as wasteful** — this
is the one rule in the repository where redundant reinforcement across
every layer (ADR, charter, subagent, blueprint, porting table) has a clear
cost/benefit case in its favor.

The "what counts as complete" rule, by contrast (ADR-068 vs. ADR-073 vs.
`PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md`'s 12-dimension list vs.
`FOUNDER_TOOL_BLUEPRINTS.md`'s founder-control section), is repeated at
**four different granularities that don't fully nest into each other** —
this is the one repeated-instruction case flagged as a real efficiency
problem in `DUPLICATION_AND_CONSOLIDATION.md`, because an agent satisfying
the shortest version could genuinely believe it is done while missing
dimensions only the longest version names.

## Conflicting instructions

**One found:** `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`
is a second, independently-maintained operating charter for a different
tool (Cursor), covering the same ground as `AGENTS.md` (Stage sequencing,
core-architecture rules, working method) without a stated relationship to
it. See `DOCUMENT_CONFLICTS.md` #5. This is the audit's only confirmed
instance of genuinely conflicting (not just repeated) agent instructions.

**No other conflicts found.** `.claude/agents/*.md` (repository-explorer,
security-reviewer, paon-frontend-reviewer) were each cross-checked against
`AGENTS.md`'s "Claude Code agent configuration" section for model
assignment (Haiku/Sonnet/Sonnet respectively) and found to match exactly.

## Missing authority rules

- **`RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`'s absence from `docs/README.md`**
  (`DOCUMENT_CONFLICTS.md` #1) means an agent following only the documented
  reading paths would never discover it exists unless another document
  (like `NORTH_STAR.md`) happens to link to it. This is the most concrete
  instance of "missing authority rule causing wasted or misdirected work"
  found in the audit — an agent could easily duplicate blueprint content
  because the map doesn't say to check it.
- **No authority rule states how a Cursor session should relate to
  `AGENTS.md` vs. the Cursor-specific prompt** — see above.

## Agent-specific knowledge that should be shared

- **The five-tier design-authority order in
  `.claude/agents/paon-frontend-reviewer.md`** (founder HTML → design
  system → `@paon/ui` tokens → live ecommerce apps → founder-tool
  blueprints) is genuinely useful general knowledge — any agent building UI
  would benefit from it, not just the frontend-reviewer subagent. Currently
  it exists only inside that one agent definition file, not in
  `docs/DESIGN_SYSTEM.md`, `docs/UX_PHILOSOPHY.md`, or `AGENTS.md`'s
  "Frontend implementation rules" section (which states the _rules_ but not
  this specific _authority ordering_). **Recommend promoting the five-tier
  order into `AGENTS.md`'s Frontend implementation rules section**, with
  the subagent file continuing to reference it rather than being its sole
  location.
- **`.claude/agents/security-reviewer.md`'s review checklist** (RLS
  scoping, cross-house leakage, SECURITY DEFINER scope, grant hygiene,
  storage bucket policy, webhook idempotency) is currently agent-specific
  and appropriately so — it is a review procedure, not a standing rule a
  main-implementation session needs loaded by default.

## Shared knowledge incorrectly buried in `.claude`

**None found.** `.claude/agents/*.md` content is appropriately
agent-specific (review checklists, search discipline) rather than shared
product knowledge that belongs in `docs/`. The one item flagged above
(the frontend-reviewer's authority ordering) is a borderline case, not a
clear miscategorization.

## Obsolete prompts

- **`.claude/prompts/bootstrap-claude-environment.md`** — a one-time setup
  recipe whose target state now fully exists in `.claude/settings.json`
  and the three agent files. Not causing active harm (confirmed still
  consistent with current state), but has no further role once its 9 steps
  are complete, and nothing would notice if it silently went stale.
  **Recommend archiving once its content is folded into `AGENTS.md`'s
  existing "Claude Code agent configuration" section**, per
  `DOCUMENT_INVENTORY.md`'s disposition for this file.

## Instructions that cause wasted work

- _*The FT-* status drift between `FOUNDER_TOOL_BLUEPRINTS.md` and
  `DESIGN_PORTS.md`_* (`DOCUMENT_CONFLICTS.md` #2) is the clearest
  candidate: an agent that reads only `DESIGN_PORTS.md` (which is
  explicitly framed as "the correction map for R0.3" and is shorter, so a
  time-pressed agent might reach for it first) would work from a status one
  cycle behind the more current `FOUNDER_TOOL_BLUEPRINTS.md` prose,
  potentially re-doing work already completed or missing a fix already
  landed.

## Documentation likely to produce architectural drift

- **`docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`** again —
  the specific risk named in the audit brief ("documentation likely to
  produce architectural drift") is exactly what a second, independently-
  maintained charter risks: if `AGENTS.md` gains a new invariant (e.g. the
  multi-lane branching rules) and the Cursor prompt is not updated in
  lockstep, a Cursor-driven session could violate a rule a Claude Code
  session would never break, simply because it never read the document that
  states it.

## Documents too large to be routinely loaded

- `docs/PHASE.md`, `docs/DECISIONS.md` — already addressed above; large but
  correctly addressable in slices, not recommended for splitting.
- `docs/vision/PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md` (~1,678
  lines) — the largest single vision document, with no internal index or
  "read only section X for topic Y" pointer the way `PAON_INTELLIGENCE_PLATFORM.md`'s
  Resume Protocol provides. Given its Rank-12 status (reference, not
  authority), this is lower priority than the Rank 1–5 documents, but worth
  an index if it is ever promoted per `DOCUMENT_AUTHORITY_PROPOSAL.md`.

## Documents that should split stable core from volatile implementation state

- **`docs/FOUNDER_TOOL_BLUEPRINTS.md`** mixes the stable part (each FT's
  contract: source fragment, founder-control section, what may/may not be
  changed without an ADR) with the volatile part (each FT's current
  connected-status prose, which changes every few sessions). This is the
  single clearest split candidate in the repository — see
  `TARGET_DOCUMENTATION_ARCHITECTURE.md` for the proposed structure
  (contract stays in the blueprint; status moves to a table that is the
  _only_ place status is recorded, replacing `DESIGN_PORTS.md`'s
  now-drifting duplicate).

---

## Proposed minimal required startup reading set

Unchanged from the current `AGENTS.md`/`docs/README.md` five-step minimum
path — this audit found it already well-calibrated. The one addition:

6. **`RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`'s existence should be
   discoverable from `docs/README.md`'s topic-owner table** (not necessarily
   read every turn, but findable) — see `DOCUMENT_AUTHORITY_PROPOSAL.md`.

## Proposed task-specific reading routes

`docs/README.md`'s existing "Level 2 — cross a boundary" and "on-demand
references" tables already implement this pattern well. One addition
recommended: a row for "founder-tool status specifically" pointing to
`FOUNDER_TOOL_BLUEPRINTS.md` only (not `DESIGN_PORTS.md`), once the split
above is executed.

## Proposed permanent AI bootstrap contract

No new contract needed — `AGENTS.md` already functions as this, and this
audit found it internally coherent and consistently followed by the
`.claude/agents/*.md` definitions. The one gap is process-external: nothing
defines the equivalent contract for **Cursor** specifically (see
`FOUNDER_QUESTIONS.md`).

## What belongs in `AGENTS.md` vs. shared docs vs. Claude-specific vs. tool-specific

| Content                                                                               | Current location                                                                           | Recommended location                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuous-build loop, engineering invariants, environment safety, definition of done | `AGENTS.md`                                                                                | Correct as-is — genuinely cross-tool                                                                                                                                                                    |
| Claude Code model assignments, hook behavior                                          | `AGENTS.md` §"Claude Code agent configuration" + `.claude/settings.json`                   | Correct as-is — Claude-specific, appropriately scoped within the shared charter                                                                                                                         |
| Frontend design-authority five-tier ordering                                          | `.claude/agents/paon-frontend-reviewer.md` only                                            | Promote the ordering itself into `AGENTS.md`; keep the subagent's review procedure Claude-specific                                                                                                      |
| Cursor-specific continuous-prompt framing                                             | `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`, unreconciled with `AGENTS.md` | Founder decision needed — either retire in favor of `AGENTS.md` directly, or make it an explicitly-dated, thin, Cursor-specific pointer the same way root `CLAUDE.md` is a thin Claude-specific pointer |
