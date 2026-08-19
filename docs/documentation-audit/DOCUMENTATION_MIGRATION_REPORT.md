# Documentation Migration Report

Executed 2026-08-06, on branch `_integration-check`, **not committed** (per
the execution instructions). Implements `docs/documentation-audit/MIGRATION_PLAN.md`
Steps 1–9, with the founder decisions recorded in
`docs/documentation-audit/FOUNDER_ANSWERS.md` (Q4, Q5) and one documented
deviation (Step 6 — see below). All 12 prior audit deliverables plus this
report and `FOUNDER_ANSWERS.md` make **14 files** in
`docs/documentation-audit/`.

---

## Files created

| Path                                                                                                                 | What it is                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/documentation-audit/FOUNDER_ANSWERS.md`                                                                        | Founder's Q4/Q5 decisions, recorded verbatim                                                                                                                        |
| `docs/CURSOR.md`                                                                                                     | New thin, subordinate Cursor startup wrapper (replaces the independently-maintained prompt formerly at `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`) |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/README.md`                                                 | Index of the 8 pre-edit snapshots below, each with why-archived / what-replaced-it / migration-date / historical-value                                              |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/README.md`                                            | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/DOMAIN_MODEL.md`                                      | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/FOUNDER_TOOL_BLUEPRINTS.md`                           | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/DESIGN_PORTS.md`                                      | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/audits/README.md`                                     | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/EXPERIENCE_REBUILD.md`                                | Pre-edit snapshot                                                                                                                                                   |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` | Pre-edit snapshot (full 471-line original)                                                                                                                          |
| `docs/archive/pre-documentation-rearchitecture-2026-08-06/.claude/prompts/bootstrap-claude-environment.md`           | Pre-removal snapshot                                                                                                                                                |
| `docs/documentation-audit/DOCUMENTATION_MIGRATION_REPORT.md`                                                         | This report                                                                                                                                                         |

All 8 snapshots were verified byte-identical to the pre-edit committed (or,
for the untracked bootstrap prompt, pre-removal) state before any edit
landed — see "Validation" below.

## Files rewritten (edited in place, not moved)

| Path                              | What changed                                                                                                                                                                                                                                                                                                                             | Metadata header added?                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `docs/README.md`                  | Rank 2 gained `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`; Rank 3 gained the Nebelspiegel traceability ledger; Rank 6 gained `CURSOR.md`; Rank 7 gained the Common-Sense Coherence audit; 4 new topic-owner rows; 1 new constitution rule (repository authority exists exactly once); on-demand reference row split into contract-vs-status | Yes                                                             |
| `docs/DOMAIN_MODEL.md`            | Bounded-context table expanded from 11 named contexts to the actual 34 `packages/domain/src` modules; added House=Retailer / Self-Portrait=`CustomerFact` / Relationship Intelligence=`Clienteling*` pairing notes; added a "Proposal, Referral and other ambiguous terms" disambiguation section                                        | Yes                                                             |
| `docs/FOUNDER_TOOL_BLUEPRINTS.md` | Header + a "Single canonical source for contract and status" note added. **Body of all 14 FT-\* sections is untouched — verified byte-identical to the pre-migration version** (see Validation)                                                                                                                                          | Yes                                                             |
| `docs/DESIGN_PORTS.md`            | Reframed as a derived summary of `FOUNDER_TOOL_BLUEPRINTS.md`; refreshed 5 rows found drifted (FT-01, FT-09, FT-10, FT-13, FT-14) to match current status; re-dated                                                                                                                                                                      | Yes                                                             |
| `docs/audits/README.md`           | One-line forward-pointer appended to `docs/documentation-audit/`                                                                                                                                                                                                                                                                         | No (append-only pointer, not a ranked document)                 |
| `docs/EXPERIENCE_REBUILD.md`      | Source-of-truth citation corrected from `/Users/nguyen/Downloads/paon.html` to committed `apps/customer/app/r/[slug]/paon-template.html` + `downloaded_pages/pag1.html`, per founder Q5                                                                                                                                                  | Yes                                                             |
| `docs/ROADMAP.md`                 | One preserving footnote added next to its own (unedited) historical citation of the same out-of-repo path — see Deviation 2 below                                                                                                                                                                                                        | No (historical text preserved as-written)                       |
| `docs/archive/README.md`          | One index row added for the new dated archive folder                                                                                                                                                                                                                                                                                     | No (index file)                                                 |
| `AGENTS.md`                       | "Claude Code agent configuration" section gained the plugin list (previously only in the now-archived bootstrap prompt) and a note that this section is now the single source for that configuration                                                                                                                                     | No (this is the Rank-6 charter itself, already self-describing) |

## Files moved

| Source                                                      | Destination      | Note                                                                                                                                                                |
| ----------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` | `docs/CURSOR.md` | `git mv`, then content fully replaced with the thin wrapper described above. Full original content preserved at the archive path and in git history via the rename. |

## Files removed from their live location (content fully preserved elsewhere)

| Removed from                                      | Preserved at                                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/prompts/bootstrap-claude-environment.md` | `docs/archive/pre-documentation-rearchitecture-2026-08-06/.claude/prompts/bootstrap-claude-environment.md`, and its net-new content (the plugin list) folded into `AGENTS.md` |

**No document was permanently deleted.** Every piece of content that moved
or was rewritten has its prior state fully recoverable from the dated
archive folder, and additionally from git history for every file that was
already tracked.

---

## Source → destination mapping

```text
docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md
  → docs/CURSOR.md (new thin content)
  → docs/archive/pre-documentation-rearchitecture-2026-08-06/docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md (full original, preserved)

.claude/prompts/bootstrap-claude-environment.md
  → AGENTS.md §"Claude Code agent configuration" (net-new content folded in)
  → docs/archive/pre-documentation-rearchitecture-2026-08-06/.claude/prompts/bootstrap-claude-environment.md (full original, preserved)

docs/FOUNDER_TOOL_BLUEPRINTS.md (per-FT status prose)
  → stays in docs/FOUNDER_TOOL_BLUEPRINTS.md, unchanged (Deviation 1)
  → docs/DESIGN_PORTS.md (concise, actively-refreshed summary — 5 rows refreshed this pass)

docs/EXPERIENCE_REBUILD.md ("/Users/nguyen/Downloads/paon.html" citation)
  → apps/customer/app/r/[slug]/paon-template.html + downloaded_pages/pag1.html (committed, reproducible)
```

---

## Founder decisions applied

| Question                                             | Decision                                                                                                                          | Where applied                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Q4 — `CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` | Option 2: thin, subordinate wrapper delegating to `AGENTS.md`; must never become an independent operating spec                    | `docs/CURSOR.md` (new content), `docs/README.md` Rank 6 + Constitution rule 9, archive of the full original      |
| Q5 — `/Users/nguyen/Downloads/paon.html`             | Option 2: treat as local working copy, not a documentation authority; correct `EXPERIENCE_REBUILD.md` to cite committed artifacts | `docs/EXPERIENCE_REBUILD.md`'s source-of-truth correction; `docs/ROADMAP.md`'s preserving footnote (Deviation 2) |

---

## Migration deviations

### Deviation 1 — `FOUNDER_TOOL_BLUEPRINTS.md`/`DESIGN_PORTS.md` split not executed mechanically

`MIGRATION_PLAN.md` Step 6 called for physically moving each FT's
`**Current:**`/`**Fix (…):**` status prose out of `FOUNDER_TOOL_BLUEPRINTS.md`
and into `DESIGN_PORTS.md`, leaving only contract fields behind. On
inspection, that status prose is interleaved inline within dense,
technically precise paragraphs — exact migration IDs, RPC names, specific
bug narratives (e.g. FT-01's three-bug fix chain, FT-13's cross-tenant RLS
fix) — not cleanly separable paragraphs in every case. Manually excising it
across all 14 sections risked exactly the information loss the execution
instructions explicitly forbade ("never simplify founder intent," "never
remove implementation caveats").

**Smallest correction applied instead:** `FOUNDER_TOOL_BLUEPRINTS.md` remains
the single, complete, unedited source for both contract _and_ status (its
14 FT-\* section bodies are verified byte-identical to the pre-migration
version — see Validation). `DESIGN_PORTS.md` is now explicitly documented
as a derived, actively-refreshed summary of that document rather than an
independent parallel source, and the 5 rows this audit found drifted
(FT-01, FT-09, FT-10, FT-13, FT-14) were refreshed to match. This satisfies
"no two active documents own the same concept" through subordination
rather than physical separation, at zero risk to founder-authored content.

### Deviation 2 — a second, previously unflagged instance of the same stale citation

While updating cross-references, `docs/ROADMAP.md` was found to contain the
identical `/Users/nguyen/Downloads/paon.html` citation `EXPERIENCE_REBUILD.md`
had (Q5). This instance was not named in the original audit's
`DOCUMENT_CONFLICTS.md` #3 or in `MIGRATION_PLAN.md` Step 9. Because the
surrounding `docs/ROADMAP.md` section is explicitly self-labeled historical
("preserve the material below as rationale only... not a current gate or
queue"), rewriting it would misrepresent the historical record it exists to
preserve. **Smallest correction applied:** the historical paragraph was left
completely unedited, and a dated, clearly-marked note was appended
immediately after it pointing to the corrected live document, rather than
altering the historical text itself.

### Deviation 3 — pre-existing, unrelated working-tree state (not part of this migration)

Two categories of uncommitted changes existed in the working tree that were
**not created by this migration and were not touched by it**:

- `docs/DEPLOYMENT.md` (+1 line) — present since before this session began
  (the user had this file open in their IDE); never opened with Edit/Write
  by this migration.
- `packages/domain/src/production/production.ts` and
  `packages/domain/src/shared/branded-id.ts` — pure Prettier-style
  reformatting (union-type line wrapping), no semantic change; this
  migration never edited, wrote to, or ran any formatting tool against
  either file. Their presence was verified via `git diff` before and after
  every substantive step of this migration and found unchanged throughout.

These are called out explicitly so the rollback procedure below does not
accidentally imply they should be reverted as part of undoing this
migration — they aren't part of it.

### Deviation 4 — formatting pass

Every Markdown file created or edited by this migration (10 live documents
plus the 14 files in `docs/documentation-audit/`) was run through
`pnpm exec prettier --write` and re-verified with `--check` before this
report was written. This matches the repository's own standard practice
(`.claude/settings.json`'s `PostToolUse` hook runs the same formatter after
every edit) and changed only whitespace/line-wrapping — no wording was
altered by this step. `pnpm exec prettier --check` now passes clean on
every file this migration touched.

---

## Validation summary

- **Content-preservation check:** all 14 `## FT-*` section bodies in
  `docs/FOUNDER_TOOL_BLUEPRINTS.md` diffed byte-for-byte against the
  pre-migration committed version — **zero differences** in all 14
  sections.
- **Archive-completeness check:** all 8 dated snapshots in
  `docs/archive/pre-documentation-rearchitecture-2026-08-06/` diffed
  byte-for-byte against their pre-edit state — **zero differences** in all 8.
- **Link-integrity check:** every relative Markdown link in every document
  touched by this migration resolves to an existing file (scripted check,
  zero broken links found); the two new file-path citations added to
  `docs/EXPERIENCE_REBUILD.md` (`apps/customer/app/r/[slug]/paon-template.html`,
  `downloaded_pages/pag1.html`) confirmed to exist on disk.
- **Cross-reference check:** repository-wide grep for the old
  `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` path and the
  old `.claude/prompts/bootstrap-claude-environment.md` path found no
  remaining live references outside `docs/documentation-audit/`'s own
  historical audit record (which correctly describes pre-migration state
  and was not rewritten) and the intentional archive/pointer references
  this migration added.
- **No two active documents own the same concept:** re-verified against
  `docs/README.md`'s rank table — every Rank-2 status question now has
  exactly one canonical source (`FOUNDER_TOOL_BLUEPRINTS.md`) and one
  clearly-subordinate summary (`DESIGN_PORTS.md`); the Cursor/`AGENTS.md`
  duplication is resolved by Constitution rule 9 and `CURSOR.md`'s new
  content.
- **Formatting:** `pnpm exec prettier --check` passes on every file this
  migration touched.
- **No application code modified:** confirmed via `git diff` — the only
  non-Markdown files showing as modified (`production.ts`, `branded-id.ts`)
  are the pre-existing, unrelated drift described in Deviation 3, unchanged
  by any command this migration ran.
- **Not committed:** confirmed — no `git commit` was run at any point in
  this migration, per the execution instructions.

No contradictions were found between any two active documents after this
pass.

---

## Rollback procedure

Nothing was committed, so rollback is a working-tree operation. **Two
commands below intentionally exclude `docs/DEPLOYMENT.md` and the two
`packages/domain/src` files**, since those predate this migration and
reverting them would destroy unrelated work that isn't this migration's to
discard.

**Full rollback of this migration only:**

```bash
# Restore every file this migration edited in place
git checkout -- \
  AGENTS.md \
  docs/DESIGN_PORTS.md \
  docs/DOMAIN_MODEL.md \
  docs/EXPERIENCE_REBUILD.md \
  docs/FOUNDER_TOOL_BLUEPRINTS.md \
  docs/README.md \
  docs/ROADMAP.md \
  docs/archive/README.md \
  docs/audits/README.md

# Undo the move (git mv is tracked as a rename; this restores the original path)
git mv docs/CURSOR.md docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md
git checkout -- docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md

# Restore the removed bootstrap prompt from its archive copy
mkdir -p .claude/prompts
cp docs/archive/pre-documentation-rearchitecture-2026-08-06/.claude/prompts/bootstrap-claude-environment.md \
   .claude/prompts/bootstrap-claude-environment.md

# Remove the new archive snapshot and the audit-plus-report directory
# (only if a full rollback including the audit record itself is wanted —
# normally leave docs/documentation-audit/ in place even on rollback,
# since it is the audit record, not the migration's effect)
rm -rf docs/archive/pre-documentation-rearchitecture-2026-08-06/
```

**Partial rollback (undo only the risky/deviated step):** to keep every
other change but revert just the `FOUNDER_TOOL_BLUEPRINTS.md`/`DESIGN_PORTS.md`
subordination decision, `git checkout -- docs/FOUNDER_TOOL_BLUEPRINTS.md
docs/DESIGN_PORTS.md` and reapply the rest by hand from this report's
per-file change list.

---

## Files retained (no change)

Every one of the other 103 documents inventoried in
`docs/documentation-audit/DOCUMENT_INVENTORY.md` was left untouched — this
migration executed only the 9 changes named in `MIGRATION_PLAN.md`, per its
explicit "never broaden scope" instruction.

## Authority hierarchy status

Complete. All 14 ranks in `docs/README.md` now have every document this
audit found load-bearing named at the correct rank, including the three
additions (`RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`, the Nebelspiegel
traceability ledger, the Common-Sense Coherence audit) and the
Cursor-subordination rule (Constitution rule 9).

## Canonical document count

- Pre-migration: 112 maintained documents (per `DOCUMENT_INVENTORY.md`) + 0
  audit deliverables.
- Post-migration: 112 maintained documents (net-zero — one moved, one
  removed-and-folded-in, twelve archived-in-place-as-snapshots which are
  new files but not part of the "maintained" count since they are frozen
  historical snapshots) + 14 files in `docs/documentation-audit/` (13 audit
  deliverables + this report) + 1 new dated archive index +
  8 archive snapshots.
- No document was retired. No document was force-consolidated. Every
  disposition in `DOCUMENT_INVENTORY.md` that said "keep authoritative" or
  "keep operational" remains exactly that.
