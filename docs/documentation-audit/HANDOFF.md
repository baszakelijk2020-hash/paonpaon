# Handoff — Documentation Audit + Rearchitecture (2026-08-06)

Written to persist state before it's lost. **Nothing described here is
committed.** Read this first in any session that continues this work.

---

## What happened, in order

1. **Full documentation/ontology/architecture audit** of the PAON
   repository. Produced 13 files in `docs/documentation-audit/`
   (`DOCUMENT_INVENTORY.md`, `DOCUMENT_AUTHORITY_PROPOSAL.md`,
   `DOCUMENT_CONFLICTS.md`, `DUPLICATION_AND_CONSOLIDATION.md`,
   `TERMINOLOGY_AUDIT.md`, `ONTOLOGY_AUDIT.md`, `ARCHITECTURE_AUDIT.md`,
   `SYSTEM_INTERACTION_AUDIT.md`, `FEATURE_INTERACTION_MATRIX.md`,
   `IMPLEMENTATION_AUDIT.md`, `AI_CONTEXT_AUDIT.md`,
   `TARGET_DOCUMENTATION_ARCHITECTURE.md`, `MIGRATION_PLAN.md`,
   `FOUNDER_QUESTIONS.md`). No files modified during this phase.
2. **Founder answered the 2 blocking questions** (Q4 — Cursor prompt;
   Q5 — the out-of-repo `paon.html` path). Saved verbatim to
   `docs/documentation-audit/FOUNDER_ANSWERS.md`.
3. **Migration executed** per `MIGRATION_PLAN.md`, with one documented
   deviation (see `DOCUMENTATION_MIGRATION_REPORT.md`). Every step
   validated: byte-identical archive snapshots, byte-identical
   `FOUNDER_TOOL_BLUEPRINTS.md` FT-\* bodies, zero broken links, Prettier
   clean.
4. **Stopped without committing**, as instructed. Full results are in
   `docs/documentation-audit/DOCUMENTATION_MIGRATION_REPORT.md`.

Read `DOCUMENTATION_MIGRATION_REPORT.md` for the complete file-by-file
record. This handoff is the short version plus what's still open.

---

## Exact current working-tree state

```text
 M AGENTS.md
 M docs/DEPLOYMENT.md                    ← NOT mine, pre-existing, do not touch
 M docs/DESIGN_PORTS.md
 M docs/DOMAIN_MODEL.md
 M docs/EXPERIENCE_REBUILD.md
 M docs/FOUNDER_TOOL_BLUEPRINTS.md
 M docs/README.md
 M docs/ROADMAP.md
 M docs/archive/README.md
 M docs/audits/README.md
 M packages/domain/src/production/production.ts   ← NOT mine, pre-existing, do not touch
 M packages/domain/src/shared/branded-id.ts        ← NOT mine, pre-existing, do not touch
RM docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md -> docs/CURSOR.md
?? .claude/
?? .vscode/
?? docs/archive/pre-documentation-rearchitecture-2026-08-06/
?? docs/documentation-audit/
?? image.png
?? scripts/claude-stop-check.sh
```

Branch: `_integration-check`. Nothing pushed. Nothing committed.

**The three lines marked "NOT mine"** predate this entire workstream (one
is the user's own IDE edit to `DEPLOYMENT.md`; two are pre-existing
Prettier-style formatting drift in `production.ts`/`branded-id.ts`, present
before this session started). They are not part of this migration —
verified via `git diff` repeatedly throughout, unchanged by anything this
work did. Leave them alone unless separately asked to handle them.

`.claude/`, `.vscode/`, `image.png`, `scripts/claude-stop-check.sh` are
also pre-existing untracked files unrelated to this workstream.

---

## What is NOT done yet

1. **Commit and push.** Nothing has been committed. `DOCUMENTATION_MIGRATION_REPORT.md`
   has the exact rollback commands if a full or partial revert is ever
   wanted instead.
2. **Three non-blocking founder questions remain open** (they don't block
   the migration, but they're real product/ontology decisions surfaced by
   the audit):
   - **Q1** — what "Mission Control" actually is (three source documents
     currently assign it three different scopes).
   - **Q2** — whether the golden-journey "composed proposal" step needs a
     tracked entity.
   - **Q3** — whether the loyalty `Referral` and the proposed BD
     "introduction candidate" should ever unify.
     Full detail in `docs/documentation-audit/FOUNDER_QUESTIONS.md`.
3. **Routine engineering follow-ups noted but not executed** (none are
   documentation-authority questions, so none blocked the migration):
   - Re-verify RLS/tenancy for 5 flagged tables (`wishlists`, `messages`,
     `commercial_inquiries`, `commercial_prospects`, +1) —
     `ARCHITECTURE_AUDIT.md`.
   - Trace `analytics-repository.ts`'s actual query sources to confirm
     whether the proposed 12-KPI set is computed live — `IMPLEMENTATION_AUDIT.md`,
     `FEATURE_INTERACTION_MATRIX.md`.
   - Line-by-line re-verification of two specific claims a prior
     (2026-07-29) audit flagged in `ROADMAP.md`/`COMPETITIVE_GAPS.md` that
     were never independently re-checked — `DOCUMENT_CONFLICTS.md` #6.

---

## Recommended next steps (pick one)

- **A — Just commit what's done.** Review the diff, write a commit message
  describing the documentation rearchitecture, commit and push per the
  repo's normal `AGENTS.md` workflow. Nothing further required first.
- **B — Resolve Q1–Q3 first, then commit everything together.** Higher
  cost, more complete.
- **C — Hand this off cold to a new session** using the starter prompt
  below.

---

## Starter prompt for a new session

Copy-paste this verbatim to resume in a fresh session:

```text
Read docs/documentation-audit/HANDOFF.md first — it's the state of an
in-progress documentation rearchitecture for this repo, executed but not
committed. Then read docs/documentation-audit/DOCUMENTATION_MIGRATION_REPORT.md
for the full file-by-file record.

Current git status should match what HANDOFF.md's "Exact current
working-tree state" section says. If it doesn't match, stop and tell me
what's different before doing anything else — don't assume either the
handoff or the working tree is stale, surface the discrepancy.

Do not touch docs/DEPLOYMENT.md, packages/domain/src/production/production.ts,
or packages/domain/src/shared/branded-id.ts — those predate this work and
aren't part of it.

Then: [review the diff with me and commit it as-is / resolve
FOUNDER_QUESTIONS.md Q1–Q3 first / <your actual instruction here>].
```

Fill in the bracketed last line with whichever of options A/B/C (or
something else) you actually want before sending it.
