# Target Documentation Architecture

Audit-only deliverable — a design, not an execution. `MIGRATION_PLAN.md`
turns this into exact file operations.

## Design principle

The existing `docs/README.md` 14-rank hierarchy works and should not be
demolished. This target architecture is a set of **targeted corrections**
(9 changes total) to the existing tree, not a rewrite. Every change traces
to a specific finding in `DOCUMENT_INVENTORY.md`, `DOCUMENT_CONFLICTS.md`,
`DUPLICATION_AND_CONSOLIDATION.md`, or `AI_CONTEXT_AUDIT.md`. Stable
documents (rarely change) are kept separate from volatile documents
(change every session) wherever the audit found them currently mixed.

---

## Change 1 — Add `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` to `docs/README.md`

- **Path:** `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` (no file move)
- **Authority level:** Rank 2 — Ratified PAON product contract
- **Change:** add to the rank table and topic-owner table
- **Replaces:** nothing
- **References:** `NORTH_STAR.md`, `VISION.md`, `PRODUCT.md`, `DOMAIN_MODEL.md`
- **Update ownership:** founder + product, same cadence as `NORTH_STAR.md`
- **Review cadence:** on founder-directed change only (ratified contract, not a living log)

## Change 2 — Promote two `docs/vision/` files by reference, no move

- `docs/vision/PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md`
  → cited at Rank 3 alongside `PAON_FOUNDER_INTELLIGENCE_BRIEF.md` in
  `docs/README.md` (file itself stays physically in `docs/vision/` — moving
  it would break its own internal cross-references to sibling vision
  pillars, and physical location does not need to match authority rank).
- `docs/vision/PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md` → cited at
  Rank 7 alongside `PRINCIPLES.md`/`ARCHITECTURE.md`.
- **Update ownership:** engineering/architecture; **review cadence:**
  quarterly or on major ADR change (these define the status vocabulary and
  completion-dimension framework other documents depend on).

## Change 3 — Relocate `CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`

- **Contingent on founder decision** (`FOUNDER_QUESTIONS.md`). Two
  concrete target states, pick one:
  - **Option A (retire):** delete the file's independent content; replace
    with a 5-line pointer to `AGENTS.md`, matching the pattern of root
    `CLAUDE.md`. New path: `docs/CURSOR.md` (out of `vision/`, since it is
    not vision content).
  - **Option B (keep, but reconciled):** move to `docs/CURSOR.md`,
    add a header stating "this is a Cursor-specific restatement of
    `AGENTS.md`; on conflict, `AGENTS.md` wins," and add it to
    `docs/README.md` Rank 6 alongside `AGENTS.md`/`WORKING_AGREEMENT.md`.
  - Either option removes it from `docs/vision/`, since — whichever
    option — it is agent-process content, not product-vision content.

## Change 4 — Split `FOUNDER_TOOL_BLUEPRINTS.md`'s stable contract from volatile status

- **New/changed document A:** `docs/FOUNDER_TOOL_BLUEPRINTS.md` (kept,
  narrowed) — **Purpose:** the 14 FT-* build _contracts_ only: source
  fragment, founder-control section (what needs a dated ADR to change),
  completion-dimension checklist. **Authority:** Rank 2. **Sections per
  FT:** ID/name, one-paragraph job, source fragment reference,
  founder-control rule. **Update ownership:** founder-decision-gated
  (content here should change rarely — only on a new ADR). **Review
  cadence:** on ADR change only.
- **New/changed document B:** `docs/DESIGN_PORTS.md` (kept, becomes the
  **sole** status table) — **Purpose:** current per-FT status
  (Missing/Shell/Wrong/Functional/Faithful/Connected/Verified), updated
  every session that touches a founder tool. **Authority:** Rank 2
  (status), but explicitly the _only_ place status is recorded —
  `FOUNDER_TOOL_BLUEPRINTS.md` no longer carries a parallel prose status
  paragraph per FT once this split lands. **Sections:** FT ID, target
  route, status, what's proven, what's not. **Update ownership:** whichever
  agent/session last touched that FT. **Review cadence:** every session
  touching a founder tool (this is exactly the volatile half).
- **Consolidates:** the current duplicate status prose spread across both
  files (`DOCUMENT_CONFLICTS.md` #2).
- **This is the single highest-value structural change in this
  architecture** — it directly fixes the one confirmed _drifting_
  duplication found in the whole audit.

## Change 5 — Refresh `DOMAIN_MODEL.md`'s bounded-context list

- **Path:** `docs/DOMAIN_MODEL.md` (no move)
- **Change:** update the named bounded-context list from 9–11 to the actual
  34 `packages/domain/src` modules (see `ARCHITECTURE_AUDIT.md`); add the
  three explicit term-pairing notes from `TERMINOLOGY_AUDIT.md` (House =
  Retailer, Self-Portrait = `CustomerFact`, Relationship Intelligence =
  `Clienteling*`); add the "proposal" disambiguation note.
- **Authority:** unchanged, Rank 8.
- **Review cadence:** whenever a new top-level `packages/domain/src` module
  is added (recommend a lint/CI check that fails if the module count in the
  doc doesn't match `find packages/domain/src -maxdepth 1 -type d | wc -l`,
  which would make this self-maintaining rather than manually tracked —
  flagged as an implementation idea, not required by this audit).

## Change 6 — Add three missing rows to `docs/README.md`'s topic-owner table

- `NIGHT_LOG.md` → "Authorized unattended-run history"
- `EXPERIENCE_REBUILD.md` → "Experience acceptance checkpoints and
  screen-by-screen visual acceptance"
- `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` → covered in Change 1

## Change 7 — Fix `EXPERIENCE_REBUILD.md`'s external source-of-truth reference

- **Contingent on founder confirmation** (`FOUNDER_QUESTIONS.md`): either
  commit `/Users/nguyen/Downloads/paon.html` into `downloaded_pages/` as a
  fourth reference fragment, or correct the document's citation to point at
  the actual committed `pag1/2/3.html` fragments it was really built
  against.

## Change 8 — Add a forward-pointer from `docs/audits/` to this audit

- **Path:** `docs/audits/README.md` (append, don't rewrite)
- **Change:** add one line: "A newer, broader audit exists at
  `docs/documentation-audit/` (dated [migration date]) — check there first
  for anything touching documentation architecture, ontology, or
  cross-module system interaction."
- **Rationale:** directly addresses `DOCUMENT_CONFLICTS.md` #4's residual
  risk (a snapshot directory with no forward-pointer to newer state).

## Change 9 — Archive `.claude/prompts/bootstrap-claude-environment.md` once absorbed

- **Contingent, low priority.** Fold its 9-step target state into
  `AGENTS.md`'s existing "Claude Code agent configuration" section (which
  already states the model assignments this file also specifies), then
  move the original to `docs/archive/` with a one-line note that it is the
  historical setup recipe.

---

## Full target tree (unchanged files omitted; only touched/new/moved shown)

```text
docs/
├── README.md                              [MODIFIED — Changes 1, 2, 6]
├── DOMAIN_MODEL.md                         [MODIFIED — Change 5]
├── FOUNDER_TOOL_BLUEPRINTS.md              [MODIFIED — Change 4A: contract only]
├── DESIGN_PORTS.md                         [MODIFIED — Change 4B: sole status table]
├── RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md  [UNCHANGED, newly ranked]
├── EXPERIENCE_REBUILD.md                   [MODIFIED — Change 7]
├── CURSOR.md                               [NEW — Change 3, moved from vision/]
├── audits/
│   └── README.md                           [MODIFIED — Change 8]
├── vision/
│   ├── CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md  [REMOVED — moved to docs/CURSOR.md]
│   ├── PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md  [UNCHANGED, newly ranked]
│   ├── PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md     [UNCHANGED, newly ranked]
│   └── … (29 other files, unchanged)
├── archive/
│   └── bootstrap-claude-environment.md     [NEW — Change 9, moved from .claude/prompts/, contingent]
└── documentation-audit/                    [THIS DELIVERABLE — new, permanent]
    └── (13 files, this audit)

.claude/
└── prompts/
    └── bootstrap-claude-environment.md     [REMOVED once Change 9 executes]
```

## What this deliberately does not do

- Does not touch `PHASE.md`, `DECISIONS.md`, `PROJECT_STATE.md`,
  `NIGHT_LOG.md`, or any evidence file — all confirmed working as designed.
- Does not consolidate the 13 numbered `docs/vision/01–13` pillar files —
  per `DUPLICATION_AND_CONSOLIDATION.md`, they are read-reference, not
  primary authority, and forcing them into `PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md`
  would lose their per-pillar addressability for a document-count reduction
  that isn't the goal (the audit brief explicitly says "do not optimize for
  fewer files alone").
- Does not rename any product term found in `TERMINOLOGY_AUDIT.md` — the
  recommendation there is pairing notes, not renames, except where a
  founder question is open (Mission Control).
- Does not create a `docs-v2` tree, per the audit brief's explicit
  instruction.

## Ongoing maintenance ownership and cadence, by category

| Category                    | Example documents                                                                                       | Owner                             | Cadence                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Constitution/founder intent | `NORTH_STAR.md`, `FOUNDER_TOOL_BLUEPRINTS.md` (contract half), `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` | Founder + product                 | On founder-directed change only                                                   |
| Active queue/decisions      | `PHASE.md`, `DECISIONS.md`                                                                              | Whichever agent/session is active | Every session (append-only)                                                       |
| Volatile status             | `DESIGN_PORTS.md` (post-split), `PROJECT_STATE.md`, `NIGHT_LOG.md`                                      | Whichever agent/session is active | Every session touching that area                                                  |
| Standing engineering rules  | `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DOMAIN_MODEL.md`                                           | Engineering                       | On structural change (new module, new layering rule)                              |
| Reference/history           | `docs/vision/*`, `docs/ai_snapshot/*`, `docs/audits/*`                                                  | Whoever produces the snapshot     | Point-in-time; never edited after the fact, only superseded by a newer dated file |
| Archive                     | `docs/archive/*`                                                                                        | Nobody (frozen)                   | Never                                                                             |
