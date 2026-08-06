# Document Conflicts

Audit-only deliverable. Every entry below is a _material_ conflict —
something an agent could act on differently depending on which document it
read. Wording differences and intentional summaries are not listed here;
see `DUPLICATION_AND_CONSOLIDATION.md` for that distinction.

---

## Conflict 1 — `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` is cited as authoritative but absent from the authority map

- **Source A:** `docs/NORTH_STAR.md` (Rank 2), which cites
  `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` by name as "the founder-level
  specification of this module's post-appointment intelligence, SOP engine,
  advisor dashboard, KPI platform, AI business analysis."
- **Source B:** `docs/README.md`'s authority-rank table and topic-owner
  table, neither of which mentions `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
  anywhere.
- **Concept involved:** whether the blueprint's contents (Relationship
  Graph, Insider Tailoring, AI Business Analysis recommendation kinds, the
  "cut or hard-constrained" list — no medical data, no NPS-as-headline-KPI,
  no composite relationship-strength scores, no automatic outreach) are
  ratified product contract or unranked supplementary material.
- **Nature of conflict:** structural gap, not a content contradiction — the
  blueprint's own status line ("authoritative founder-level product
  specification... extending `NORTH_STAR.md`") is consistent with Rank 2,
  it simply was never added to the table after being committed 2026-08-06.
- **Implementation evidence:** none of the blueprint's proposed entities
  (Relationship Graph, SOP Definition, Product Visibility Profile) exist yet
  in `packages/domain/src` or `supabase/migrations` — confirmed by the
  ontology-audit code pass. The blueprint is explicit that this is expected
  ("nothing here is built until `PHASE.md` sequences it").
- **Likely resolution:** add to Rank 2 per `DOCUMENT_AUTHORITY_PROPOSAL.md`
  Gap 1. This is a documentation-hygiene fix, not a product decision.
- **Founder confirmation required:** **No** — the blueprint already
  self-declares its authority level; this is a map-completeness fix.

---

## Conflict 2 — `DESIGN_PORTS.md`'s per-FT status table is one audit-cycle behind `FOUNDER_TOOL_BLUEPRINTS.md`'s prose

- **Source A:** `docs/DESIGN_PORTS.md`, self-dated "Audited status —
  2026-08-02."
- **Source B:** `docs/FOUNDER_TOOL_BLUEPRINTS.md`, whose per-FT prose
  entries carry later dated notes (FT-09's conversation-to-appointment
  closure and FT-13's cross-tenant RLS fix, both dated 2026-08-06 in the
  blueprint text) that are not reflected in `DESIGN_PORTS.md`'s status
  column, which both documents agree is supposed to be the authoritative
  "correction map for R0.3."
- **Concept involved:** current per-FT porting completeness.
- **Nature of conflict:** implementation drift ahead of documentation — a
  real slice landed and was recorded in one authoritative document
  (`FOUNDER_TOOL_BLUEPRINTS.md`) but not propagated to the sibling document
  that is supposed to be the concise status table.
- **Implementation evidence:** `apps/retailer/e2e/services.spec.ts` and the
  wedding-party cross-tenant FK migration referenced in
  `FOUNDER_TOOL_BLUEPRINTS.md`'s FT-13/FT-14 entries exist in the repository
  and are newer than 2026-08-02.
- **Likely resolution:** re-run the `DESIGN_PORTS.md` audit pass and bump
  its date; this is routine documentation maintenance, not a decision.
- **Founder confirmation required:** **No.**

---

## Conflict 3 — `docs/EXPERIENCE_REBUILD.md`'s stated visual source of truth is outside the repository

- **Source A:** `docs/EXPERIENCE_REBUILD.md`: "The original
  `/Users/nguyen/Downloads/paon.html` is the visual source of truth."
- **Source B:** every other founder-tool document (`AGENTS.md`,
  `docs/README.md`, `FOUNDER_TOOL_BLUEPRINTS.md`, `DESIGN_PORTS.md`,
  `.claude/agents/paon-frontend-reviewer.md`) which treat the three
  _committed_ files (`downloaded_pages/pag1.html`, `pag2.html`, `pag3.html`)
  as the sole source-of-truth fragments, precisely because they are
  reproducible from the repository.
- **Concept involved:** what counts as the reproducible visual-fidelity
  reference for the Experience Rebuild checkpoints.
- **Nature of conflict:** naming drift with a real reproducibility
  consequence — `/Users/nguyen/Downloads/paon.html` is a path on one
  machine, not a committed artifact. Anyone without access to that exact
  local file cannot verify `EXPERIENCE_REBUILD.md`'s visual claims.
- **Implementation evidence:** `downloaded_pages/` contains only
  `pag1.html`, `pag2.html`, `pag3.html` — no `paon.html` and no
  `paon-template.html` at the repository root (though
  `docs/FOUNDER_TOOL_BLUEPRINTS.md`'s FT-09 entry separately references a
  `paon-template.html` Route Handler inside `apps/customer`, which is a
  different, in-repo artifact — not the same file `EXPERIENCE_REBUILD.md`
  points to in `Downloads/`).
- **Likely resolution:** either commit the referenced file into
  `downloaded_pages/` (making it reproducible) or correct
  `EXPERIENCE_REBUILD.md` to cite the actual in-repo fragments it was
  really built against.
- **Founder confirmation required:** **Yes, narrowly** — only to confirm
  which file is actually authoritative (is `Downloads/paon.html` a superset
  of `pag1/2/3.html`, e.g. the full storefront mockup they were extracted
  from, or a separate artifact?). Tracked in `FOUNDER_QUESTIONS.md`.

---

## Conflict 4 — production regression not reflected in the "all green" prior audit

- **Source A:** `docs/audits/runtime-audit.md` (2026-07-29): "Production
  HTTP 200 on all surfaces."
- **Source B:** `docs/DEPLOYMENT.md`'s 2026-08-02 safety correction: the
  customer-portal production URL now returns HTTP 500 because deployed code
  expects `entity_metadata_assignments`, a table the deployed database
  schema does not contain; and `docs/ENVIRONMENTS.md`'s matching current
  blocker entry.
- **Concept involved:** current production health of the customer app.
- **Nature of conflict:** none of the involved documents disagree with each
  other once dated correctly — this is a real regression between two
  correctly-dated snapshots, not a documentation error. Flagged here because
  an agent reading only `docs/audits/runtime-audit.md` without checking its
  date would form a false picture of current production health.
- **Implementation evidence:** `docs/DEPLOYMENT.md` and
  `docs/ENVIRONMENTS.md` both independently and consistently describe the
  same incident with matching cause and matching "do not repair by pushing
  the full migration chain" guidance.
- **Likely resolution:** none needed in the documents themselves — both are
  correctly dated. The residual risk is that `docs/audits/` is a
  **snapshot directory with no forward-pointer** telling a reader "this is
  2026-07-29; check `DEPLOYMENT.md`/`ENVIRONMENTS.md` for current state."
  Recommend adding that pointer (see `MIGRATION_PLAN.md`).
- **Founder confirmation required:** **No.** The underlying production
  outage itself is an operational matter outside this audit's scope (it is
  not a documentation-architecture question — both documents describing it
  are correctly dated and internally consistent), so it is not elevated to
  `FOUNDER_QUESTIONS.md`. Noted here only so a reader of
  `docs/audits/runtime-audit.md` doesn't mistake its "HTTP 200" snapshot for
  current status, and so that anyone relying on `COMPETITIVE_GAPS.md`'s
  "beta-ready for storefront" framing knows to check current deployment
  health first — an operational follow-up, not a documentation fix.

---

## Conflict 5 — `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` is a second operating charter

- **Source A:** `AGENTS.md`, the stated "single cross-agent entry point for
  Codex, Cursor, Claude Code and other builders."
- **Source B:** `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`,
  which contains its own Stage 8–16 sequencing, its own core-architecture
  rules, and its own working-method/usage-discipline instructions, written
  specifically to be pasted into a Cursor session as a continuous operating
  prompt.
- **Concept involved:** which document a Cursor session should treat as its
  operating charter.
- **Nature of conflict:** two valid contexts that were never explicitly
  reconciled — `AGENTS.md` predates or postdates this file without either
  one explicitly deferring to or retiring the other. In practice the two
  documents' _content_ mostly agrees (both were written against the same
  underlying Stage structure), but an agent following only the Cursor prompt
  would not pick up `AGENTS.md`'s later additions (multi-lane rules, the
  ADR-069→073 sequencing reversal, the Claude Code model-assignment table)
  unless the Cursor prompt is kept in lockstep by hand.
- **Implementation evidence:** not applicable — this is a process-authority
  question, not an implementation-vs-documentation one.
- **Likely resolution:** either (a) retire the Cursor-specific prompt and
  route Cursor sessions to `AGENTS.md` directly, accepting that Cursor loses
  a tool-specific "continuous, don't-ask-again" framing `AGENTS.md` doesn't
  provide, or (b) keep it but make it a thin pointer to `AGENTS.md` the same
  way root `CLAUDE.md` is a thin pointer, rather than a parallel restatement
  that can drift.
- **Founder confirmation required:** **Yes** — this is a decision about how
  a _different_ AI tool is instructed, not something inferable from the
  repository. Tracked in `FOUNDER_QUESTIONS.md`.

---

## Conflict 6 — `docs/audits/documentation-audit.md`'s open findings were never marked resolved or carried forward

- **Source A:** `docs/audits/documentation-audit.md` (2026-07-29): flags
  `ROADMAP.md` "body contradicts header" and `COMPETITIVE_GAPS.md`
  "overclaims email proof."
- **Source B:** neither `docs/ROADMAP.md` nor `docs/COMPETITIVE_GAPS.md`
  (both re-read in full for this audit) contains any visible marker of
  those specific findings having been addressed or explicitly deferred.
- **Concept involved:** whether those two specific claims are still live
  defects.
- **Nature of conflict:** unresolved — the prior audit's findings were
  neither fixed nor explicitly triaged as accepted risk. This audit did not
  independently re-derive the body/header contradiction in `ROADMAP.md`
  line-by-line (it reads as a coherent, correctly-superseded historical
  document on a full read) or re-verify every "PAON does not have X" claim
  in `COMPETITIVE_GAPS.md` against current code — that would require the
  line-by-line diff the original audit performed, which is out of this
  pass's scope.
- **Implementation evidence:** none gathered independently for this specific
  claim; flagged as unresolved rather than re-asserted or dismissed.
- **Likely resolution:** a targeted line-by-line pass against
  `docs/audits/documentation-audit.md`'s two specific findings.
- **Founder confirmation required:** **No** — this is a mechanical
  verification task, not a decision. Recorded here so it isn't silently
  dropped between the old audit and this one.

---

## Non-conflicts explicitly checked and ruled out

To avoid the audit brief's warning against inventing conflicts, three
plausible-looking tensions were checked and found **not** to be material
conflicts:

- **`VISION.md` vs. `PRODUCT.md` vs. `NORTH_STAR.md` on product direction** —
  no contradiction. They operate at three deliberately different altitudes
  (thesis → ratified contract → implementation-surface definition) and use
  consistent language throughout (e.g. all three independently state "no
  tier should create a forked codebase" / "roadmap commits to all eight
  module families" / "restraint over cleverness").
- **`CAPABILITY_DISPOSITION.md` vs. `FOUNDER_TOOL_BLUEPRINTS.md`** — not an
  overlap. `CAPABILITY_DISPOSITION.md` explicitly states the division of
  labor in its own text ("this table remains the concise source-fidelity
  status; the blueprint is the build contract") and the two documents'
  content is genuinely complementary, not duplicated.
- **`ai_snapshot/15_current_vs_vision.md`'s "Metadata Graph does not exist"
  finding vs. current code** — not stale. Independently re-confirmed: no
  `packages/domain/src` module or migration implements a general-purpose
  metadata graph beyond the narrower `metadata_concepts`/
  `metadata_concept_edges` review workflow. The finding still holds.
