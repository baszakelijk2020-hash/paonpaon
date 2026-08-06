# Founder Questions

Audit-only deliverable. Every genuinely unresolved decision surfaced across
the other 12 audit files, collected here. Questions whose answer could be
determined from the repository were resolved in place in the relevant
document and are **not** repeated here (e.g. the `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`
authority-map gap is fixable from evidence alone — see
`DOCUMENT_AUTHORITY_PROPOSAL.md` and `MIGRATION_PLAN.md` Step 1 — and is not
listed as a question below).

Five questions met the bar. They are grouped by category per the audit
brief; categories with no genuinely unresolved question (architecture,
implementation priority, archive decisions) are omitted rather than padded
with a manufactured entry.

---

## Product intent

### Q1 — What is "Mission Control," and does it need to become one thing?

**The conflict:** three ratified-or-near-ratified documents each describe
"Mission Control" as a different scope, sharing the same route
(`/mission-control`, retailer app):

- `docs/vision/PAON_WORKFORCE_MISSION_CONTROL.md`: the **leadership↔workforce
  operating layer** — scheduling, clock/break/exception approval, daily
  briefing/closeout ritual, coaching.
- `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §10 (Rank 2, newest,
  2026-08-06): the surface that **publishes campaigns and knowledge cards**
  to advisors — a leadership-to-advisor content channel. This document
  itself notes Mission Control "already exists as a concept in
  `PRODUCT.md`" and is a "partial build (Stage 17.2)," implying it is aware
  of the overlap but does not resolve it.
- `docs/FOUNDER_TOOL_BLUEPRINTS.md` FT-05 (Rank 2): bundles Mission Control
  together with Self-Portrait as a **per-customer advisor cockpit** —
  "who needs attention, why now, what is known vs. inferred."

**Relevant files:** `docs/vision/PAON_WORKFORCE_MISSION_CONTROL.md`,
`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §10,
`docs/FOUNDER_TOOL_BLUEPRINTS.md` FT-05, `docs/PRODUCT.md`.

**Implementation evidence:** the live `/mission-control` route is currently
backed by `clienteling-dashboard-repository.ts`,
`clienteling-opportunity-repository.ts`, and `advisor-brief-repository.ts`
— closest in shape to the FT-05 customer-cockpit reading. No workforce-
scheduling or campaign-publishing code was found wired into that specific
route (workforce scheduling exists as its own `staff_shifts`/
`staff_time_entries` primitives, not surfaced there; campaign/knowledge
publishing has no dedicated surface at all yet).

**Available interpretations:**

1. **One screen, three tabs** — Mission Control becomes a single surface
   with workforce-ops, content-publishing, and per-customer-cockpit as
   distinct tabs or sections, unifying the name.
2. **One name, three surfaces** — retire "Mission Control" as a single
   route; keep three separately-named, separately-routed surfaces (e.g.
   workforce ops stays `/staff/roster`-adjacent, campaign publishing gets
   its own route, the customer cockpit keeps today's `/mission-control`
   URL under the FT-05 reading only).
3. **Customer cockpit is the real Mission Control; the other two documents
   are describing future extensions of the same screen, not separate
   things** — i.e. today's implementation (FT-05 reading) is correct and
   permanent, and the workforce/campaign documents should be re-read as
   "things that will eventually surface inside this same cockpit," not
   competing definitions.

**Consequence of each interpretation:** (1) risks the screen becoming
overloaded and losing the "one calm picture" principle
`docs/EXPERIENCE_REBUILD.md` states as a core experience rule; (2) is
cleanest architecturally but means "Mission Control" stops being a single
citable concept in product documents, requiring an edit pass across
`NORTH_STAR.md`/the blueprint/the vision doc; (3) requires no code change
at all right now, only a documentation clarification, but risks the
workforce and campaign-publishing documents' authors (whoever wrote them)
having genuinely meant something structurally different that gets quietly
flattened.

**Recommended default:** none offered — the evidence does not favor one
interpretation over another; this is a product-shape decision, not a
documentation gap.

---

### Q2 — Should "Proposal" (the golden-journey step) become a tracked entity?

**The conflict:** `NORTH_STAR.md`'s golden-journey spine names "composed
proposal" as its own step, distinct from the order that may follow it. No
domain type currently tracks a proposal's own lifecycle
(draft→sent→viewed→revised→accepted→expired) independent of whether an
order results. The three code types that share the word "proposal"
(`CaptureBundleProposal`, `PriceChangeProposal`,
`ImportEnrichmentFieldProposal`) solve unrelated problems and were
confirmed not to be a fit for this.

**Relevant files:** `NORTH_STAR.md` (golden-journey spine),
`packages/domain/src/intelligence/advisor-capture.ts`,
`packages/domain/src/production/production.ts`,
`packages/domain/src/import/import-enrichment.ts`.

**Implementation evidence:** `SYSTEM_INTERACTION_AUDIT.md` Journey 3
traced this step and found it realized only as ordinary recommendation
composition + eventual order-line creation, with no persisted intermediate
state.

**Available interpretations:** (1) this is intentional — a "proposal" is
just "the recommendation set currently under discussion," ephemeral by
design, never meant to be a queryable object with its own status; (2) this
is a genuine gap — the product needs to answer "which proposals are open,
which expired unaccepted, what's our proposal-to-order conversion rate,"
none of which are answerable today without a dedicated entity.

**Consequence of each interpretation:** (1) no action needed; (2) requires
a new domain aggregate and migration, non-trivial scope, and would need its
own `PHASE.md` item.

**Recommended default:** none — this is a real product-scope question,
not resolvable from what exists today.

---

## Ontology

### Q3 — Should the loyalty `Referral` and the proposed BD "introduction candidate" be the same concept?

**The conflict:** `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12
describes "introduction candidates" as an evidence-backed
business-development suggestion inside the (unbuilt) Relationship Graph.
The only implemented "referral" concept today (`Referral`,
`ReferralStatus` in `packages/domain/src/loyalty`) is a narrow consumer
loyalty-reward mechanic, unrelated in code to the corporate/BD pipeline.

**Relevant files:** `packages/domain/src/loyalty/loyalty.ts`,
`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §12,
`packages/domain/src/corporate/*`.

**Implementation evidence:** confirmed via direct code search — zero
cross-references between the `loyalty` module's `Referral` type and the
`corporate` module's opportunity/signal types.

**Available interpretations:** (1) keep them permanently separate — a
consumer referring a friend for a reward is a genuinely different business
event from a BD-sourced warm introduction to a company; (2) unify under one
`Referral`/`Introduction` concept with a `channel` or `context` field
distinguishing consumer-loyalty from BD-sourced, so reporting can see both
in one place.

**Consequence of each interpretation:** (1) no action needed, but the
Relationship Graph, once built, introduces a second "referral"-shaped
concept a reader must learn to distinguish from the loyalty one; (2) is a
larger unification effort touching two currently-independent modules for a
benefit (unified reporting) that hasn't been explicitly requested anywhere
in the founder documents read.

**Recommended default:** keep separate (lower-risk, no evidence anyone has
asked for unification), but flagged as a question rather than resolved
outright because the audit found no explicit founder statement either way.

---

## Terminology and document authority

### Q4 — Should `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md` be retired or reconciled?

**The conflict:** this file is a second, independently-maintained operating
charter — written for the Cursor tool specifically — covering the same
ground as `AGENTS.md` (Stage sequencing, core-architecture rules, working
method) with no stated relationship between the two. See
`DOCUMENT_CONFLICTS.md` #5.

**Relevant files:** `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`,
`AGENTS.md`.

**Implementation evidence:** not applicable — this is a process-authority
question, not an implementation-vs-documentation one. Both documents'
_content_ was found broadly consistent as of this audit (same underlying
Stage structure), but nothing keeps them in sync if either changes.

**Available interpretations:**

1. **Retire it** — route Cursor sessions to `AGENTS.md` directly, the same
   as every other tool. Loses the "continuous, don't-ask-again" framing
   this file provides that `AGENTS.md` doesn't explicitly offer, but
   removes the drift risk entirely.
2. **Keep it, but make it a thin, explicitly-subordinate pointer** — same
   pattern as root `CLAUDE.md` → `AGENTS.md`, so Cursor gets its
   tool-specific framing without an independent copy of the substantive
   rules.
3. **Keep it as-is, actively maintained in parallel** — accept the
   maintenance burden of updating two documents whenever a cross-tool rule
   changes.

**Consequence of each interpretation:** (1) simplest, but if Cursor
sessions specifically benefit from the continuous-prompt framing for
unattended work, that capability is lost; (2) preserves the benefit with
minimal drift risk, requires one editing pass now; (3) is the status quo
and carries the drift risk already observed in `AI_CONTEXT_AUDIT.md`.

**Recommended default: Option 2**, on the strength of the precedent already
set by root `CLAUDE.md`'s identical pattern for Claude Code — this is the
one question in this list where the repository's own existing convention
points fairly clearly at an answer, though the founder should still
confirm before it's executed since it governs how a different AI tool is
instructed.

---

### Q5 — Is `/Users/nguyen/Downloads/paon.html` a real, distinct artifact that should be committed?

**The conflict:** `docs/EXPERIENCE_REBUILD.md` names
`/Users/nguyen/Downloads/paon.html` — a path outside the repository, on one
machine — as "the visual source of truth," while every other founder-tool
document treats the three committed `downloaded_pages/pag1/2/3.html`
fragments as the sole reproducible source. See `DOCUMENT_CONFLICTS.md` #3.

**Relevant files:** `docs/EXPERIENCE_REBUILD.md`, `downloaded_pages/*.html`.

**Implementation evidence:** `downloaded_pages/` contains only
`pag1.html`, `pag2.html`, `pag3.html` — confirmed via direct listing. No
`paon.html` or `paon-template.html` exists at the repository root (a
`paon-template.html` _does_ exist as an in-repo Route Handler referenced by
FT-09, which is a different, already-committed artifact from the one
`EXPERIENCE_REBUILD.md` cites).

**Available interpretations:** (1) `Downloads/paon.html` is a genuine
fourth artifact — e.g. the full original storefront mockup `pag1/2/3.html`
were extracted from — that should be committed for reproducibility; (2) it
was a local working copy of material already captured in `pag1/2/3.html`
or `paon-template.html`, and the citation in `EXPERIENCE_REBUILD.md` should
simply be corrected to point at the real in-repo files.

**Consequence of each interpretation:** (1) requires committing a
potentially large new file and updating the citation; (2) requires only a
documentation correction, no new commit.

**Recommended default:** none — only the founder (or whoever has access to
that local file) can confirm which it is.

---

## Summary

| #   | Category           | Question                                                                | Blocks migration execution?                                                              |
| --- | ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Q1  | Product intent     | What is Mission Control, and should it unify?                           | No — does not block any `MIGRATION_PLAN.md` step; informs future `PHASE.md` scoping only |
| Q2  | Product intent     | Does the golden-journey "composed proposal" step need a tracked entity? | No — informational, no migration step depends on it                                      |
| Q3  | Ontology           | Should loyalty Referral and BD introduction-candidate unify?            | No                                                                                       |
| Q4  | Document authority | Retire or reconcile the Cursor-specific operating prompt?               | **Yes — `MIGRATION_PLAN.md` Step 8**                                                     |
| Q5  | Document authority | Is `Downloads/paon.html` real and committable?                          | **Yes — `MIGRATION_PLAN.md` Step 9**                                                     |

Only Q4 and Q5 block any part of the migration plan; Q1–Q3 are product and
ontology questions that inform future roadmap/`PHASE.md` decisions but do
not gate any documentation-hygiene action this audit recommends.
