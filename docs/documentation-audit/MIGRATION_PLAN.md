# Migration Plan

Audit-only deliverable — **not executed**. Written so a single later Claude
Code session can execute it without re-deriving the reasoning in the other
12 audit files. Nothing here may run until the founder decisions in
`FOUNDER_QUESTIONS.md` marked "blocks execution" below are answered.
Everything else is pre-approved by virtue of following directly from
evidence, not opinion.

**Nothing is deleted at any step.** Every "archive" step is a copy/move
into `docs/archive/` with the original content fully preserved, per the
audit brief's explicit rule.

---

## Pre-flight checks (run first, abort migration if any fails)

1. `git status` clean, on a dedicated branch (e.g.
   `docs/documentation-audit-migration`), forked from the current
   `PHASE.md`-authorized task branch.
2. Confirm `docs/documentation-audit/` (this audit's 13 files) is present
   and was not modified by anything other than this plan's own later
   "cross-reference update" steps.
3. Re-run the specific greps this audit used as evidence, to catch drift
   between when the audit was written and when it is executed:
   - `grep -c "RELATIONSHIP_INTELLIGENCE_BLUEPRINT" docs/README.md` → expect `0` (if not, Change 1 may already be done — skip it)
   - `find packages/domain/src -maxdepth 1 -type d | wc -l` → expect `34` (if different, update `DOMAIN_MODEL.md`'s target count in Change 5 to match reality, not the number written in this plan)
   - `diff <(grep -A2 "FT-09" docs/FOUNDER_TOOL_BLUEPRINTS.md) <(grep -A2 "FT-09" docs/DESIGN_PORTS.md)` → informational, confirms whether the drift in `DOCUMENT_CONFLICTS.md` #2 is still present before attempting Change 4

---

## Step 1 — Change 1: Add `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` to `docs/README.md`

- **File to edit:** `docs/README.md`
- **Exact edit:** in the Rank table, add a row to Rank 2:
  `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` alongside `NORTH_STAR.md`,
  `FOUNDER_TOOL_BLUEPRINTS.md`, `DESIGN_PORTS.md`. In the Topic owners
  table, add: `Client & Relationship Intelligence module specification` →
  `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`.
- **Validation:** `docs/README.md` still parses as valid Markdown; every
  other row unchanged (diff should show only additions).
- **Blocks execution?** No — this is evidence-driven, not opinion (the
  blueprint already self-declares this rank; see `DOCUMENT_CONFLICTS.md` #1).

## Step 2 — Change 2: Cite two `docs/vision/` files at higher rank, no file move

- **File to edit:** `docs/README.md`
- **Exact edit:** Rank 3 row gains
  `docs/vision/PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md`.
  Rank 7 row gains
  `docs/vision/PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md`.
- **Files NOT moved:** both stay physically in `docs/vision/`.
- **Validation:** links resolve (relative path from `docs/README.md` to
  `docs/vision/...md` is valid).
- **Blocks execution?** No.

## Step 3 — Change 6: Add three topic-owner rows

- **File to edit:** `docs/README.md`
- **Exact edit:** add rows for `NIGHT_LOG.md` and `EXPERIENCE_REBUILD.md`
  as specified in `TARGET_DOCUMENTATION_ARCHITECTURE.md` Change 6.
- **Blocks execution?** No.

## Step 4 — Change 8: Forward-pointer from `docs/audits/` to this audit

- **File to edit:** `docs/audits/README.md`
- **Exact edit:** append one line at the end of the file (do not rewrite
  existing content): a pointer to `docs/documentation-audit/` with the
  execution date.
- **Blocks execution?** No.

## Step 5 — Change 5: Refresh `DOMAIN_MODEL.md`'s bounded-context list

- **File to edit:** `docs/DOMAIN_MODEL.md`
- **Exact edit:**
  1. Replace the named bounded-context list with the current
     `find packages/domain/src -maxdepth 1 -type d` output (re-run at
     execution time, do not hardcode the count from this plan).
  2. Add three short "pairing" notes near the top, one sentence each:
     House (product) = `Retailer` (code); Self-Portrait (product) =
     `CustomerFact` (code); Relationship Intelligence (product) =
     `Clienteling*` (code).
  3. Add one sentence disambiguating "proposal" per `TERMINOLOGY_AUDIT.md`.
- **Validation:** `packages/domain/src` module count in the doc matches
  `find` output exactly at commit time.
- **Blocks execution?** No.

## Step 6 — Change 4: Split `FOUNDER_TOOL_BLUEPRINTS.md` / `DESIGN_PORTS.md`

**This is the highest-value and highest-risk step — do it carefully, and
last among the non-founder-gated changes, so any mistake is easiest to spot
against a smaller remaining diff.**

1. In `docs/FOUNDER_TOOL_BLUEPRINTS.md`, for each of the 14 FT entries,
   identify the "current status" prose paragraph (the part that changes
   session to session — connected-slice descriptions, dated notes, "not
   built" lists framed as _current state_ rather than _contract_).
2. Move that prose verbatim into the corresponding row of
   `docs/DESIGN_PORTS.md`, merging with whatever is already there — where
   the two disagree (expected for FT-09/FT-13/FT-14 per
   `DOCUMENT_CONFLICTS.md` #2), **the more recently dated statement wins**;
   do not average or drop either without checking dates.
3. Leave in `docs/FOUNDER_TOOL_BLUEPRINTS.md` only: ID, name, one-paragraph
   job description, source fragment reference, founder-control section.
4. Add a one-line header to `docs/FOUNDER_TOOL_BLUEPRINTS.md`: "Current
   per-FT status lives in `DESIGN_PORTS.md` only — this document is the
   contract, not the status."
5. Bump `docs/DESIGN_PORTS.md`'s "Audited status" date to the execution
   date.

- **Validation:** grep both files for every `FT-0[1-9]|FT-1[0-4]` mention;
  confirm no status-sounding sentence (containing "connected," "verified,"
  "not built," "killed by founder decision," or a date) remains in
  `FOUNDER_TOOL_BLUEPRINTS.md` outside the founder-control section.
- **Blocks execution?** No — mechanical reorganization of already-approved
  content, no new decision being made.

## Step 7 — Change 9 (contingent, low priority): Archive the bootstrap prompt

1. Confirm `.claude/settings.json` and all three `.claude/agents/*.md`
   files still match every claim in
   `.claude/prompts/bootstrap-claude-environment.md` (re-run the same
   comparison this audit did).
2. Fold any net-new detail (should be none, per this audit's finding) into
   `AGENTS.md`'s "Claude Code agent configuration" section.
3. `git mv .claude/prompts/bootstrap-claude-environment.md docs/archive/bootstrap-claude-environment.md`
4. Add one line to `docs/archive/README.md`'s index noting what it is and
   why it was archived.

- **Blocks execution?** No, but **lowest priority of the 9 changes** — safe
  to defer to a later pass if the session runs long.

---

## Steps requiring founder confirmation first (see `FOUNDER_QUESTIONS.md`)

## Step 8 — Change 3: `CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`

**BLOCKS EXECUTION until `FOUNDER_QUESTIONS.md` Q1 is answered.**

- If **Option A (retire)**: replace the file's content with a 5-line
  pointer to `AGENTS.md` (mirroring root `CLAUDE.md`'s pattern exactly);
  `git mv docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md docs/CURSOR.md`;
  the original full content is preserved in git history, satisfying
  "nothing is deleted."
- If **Option B (keep, reconciled)**: `git mv` to `docs/CURSOR.md`
  unchanged in content, prepend a header stating it is Cursor-specific and
  subordinate to `AGENTS.md` on conflict; add to `docs/README.md` Rank 6.
- **Validation:** no other document links to the old
  `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` path after
  the move (grep the whole `docs/` tree for the filename and update any
  hit).

## Step 9 — Change 7: `EXPERIENCE_REBUILD.md`'s source-of-truth reference

**BLOCKS EXECUTION until `FOUNDER_QUESTIONS.md` Q2 is answered.**

- If the founder confirms `/Users/nguyen/Downloads/paon.html` is a real,
  distinct, committable artifact: copy it into
  `downloaded_pages/paon.html`, update `EXPERIENCE_REBUILD.md`'s citation
  to the new in-repo path.
- If the founder confirms it was actually built from `pag1/2/3.html` under
  a different working filename: correct `EXPERIENCE_REBUILD.md`'s citation
  to name those three files directly, remove the `Downloads/` reference.
- **Validation:** `EXPERIENCE_REBUILD.md` contains no path outside the
  repository after this step.

---

## Cross-reference updates required after Steps 1–9

Run a repository-wide grep for each renamed/moved file's old path and
update every hit:

| Old reference                                                                                 | New reference                                  | Search command                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`                                   | `docs/CURSOR.md`                               | `grep -rl "vision/CURSOR_UNIFIED" docs/`                 |
| `.claude/prompts/bootstrap-claude-environment.md`                                             | `docs/archive/bootstrap-claude-environment.md` | `grep -rl "bootstrap-claude-environment" .claude/ docs/` |
| Any per-FT status prose duplicated between `FOUNDER_TOOL_BLUEPRINTS.md` and `DESIGN_PORTS.md` | single source in `DESIGN_PORTS.md`             | manual diff per Step 6                                   |

## Authority headers to add

Every document gaining a new rank in Steps 1–2 should, at the point of
edit, also confirm it carries a clear one-line self-declaration of its own
authority near its top if it does not already (most already do, per
`DOCUMENT_INVENTORY.md`'s per-file "authority claim" column — no document
was found missing one entirely, so this is a spot-check, not a bulk add).

## Validation steps (run after all above)

1. Every internal `docs/`-relative Markdown link still resolves
   (`grep -roE '\]\(\.?/[^)]+\.md[^)]*\)' docs/**/*.md` and check each
   target exists — or use an existing link-checker if the repo has one;
   none was found in this audit's CI-workflow pass, so this may need to run
   manually).
2. `docs/README.md`'s rank table and topic-owner table are both internally
   consistent (every document named in one table is findable in the other
   if it should be).
3. Re-run the pre-flight greps from the top of this plan; confirm each now
   returns the expected post-migration state.
4. Run `pnpm format:check` (Markdown is covered by the repo's Prettier
   config per `.claude/settings.json`'s PostToolUse hook) to catch
   formatting drift introduced by manual edits.
5. Full manual read-through of `docs/README.md` end to end (it is short
   enough for this to be cheap, and it is the document every other change
   touches).

## Rollback strategy

- All work happens on a dedicated branch; if validation fails, `git reset
--hard` to the pre-migration commit on that branch (never on the shared
  task branch) and re-attempt the failing step in isolation.
- Because every step is either an additive edit (Steps 1–4, 6) or a
  `git mv` with full history preservation (Steps 7–8), no step is
  destructive — reverting any single commit fully restores prior state.
- If Step 6 (the blueprint/ports split) produces a merge conflict between
  two disagreeing status statements that cannot be resolved by "most
  recently dated wins" (e.g. both are undated), stop and flag it as a new
  `DOCUMENT_CONFLICTS.md`-style entry rather than guessing — do not let
  Step 6 block Steps 1–5, which are independent.

## Order of operations (summary)

1. Pre-flight checks
2. Step 1 (Rank 2 addition) — independent
3. Step 2 (Rank 3/7 citations) — independent
4. Step 3 (topic-owner rows) — independent
5. Step 4 (audits forward-pointer) — independent
6. Step 5 (`DOMAIN_MODEL.md` refresh) — independent
7. Step 6 (blueprint/ports split) — do after 1–5 so the surrounding
   `docs/README.md` state is already correct when this larger edit lands
8. Step 7 (archive bootstrap prompt) — independent, lowest priority, can be
   deferred entirely without blocking anything else
9. **Founder decision checkpoint** — Steps 8 and 9 only proceed once
   `FOUNDER_QUESTIONS.md` Q1/Q2 are answered; everything above is
   independently completable and valuable without waiting on this
10. Cross-reference updates
11. Full validation pass
12. Single commit (or a small number of logically-grouped commits — e.g.
    one for Steps 1–5, one for Step 6, one for Steps 8–9 once unblocked),
    each following the repository's normal commit-message conventions, on
    the dedicated migration branch, then normal PR/merge process — this
    audit does not authorize pushing to `main` or any shared task branch
    directly.
