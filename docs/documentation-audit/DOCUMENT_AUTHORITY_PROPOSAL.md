# Document Authority Proposal

Audit-only deliverable. `docs/README.md` already implements a working
14-rank authority hierarchy that this audit independently verified is
followed in practice (lower-rank documents consistently defer upward;
no document claims authority it wasn't given). **This proposal does not
replace that hierarchy — it closes three concrete gaps found while
auditing every document against it**, and states explicitly, per rank,
which document wins on conflict.

## Baseline: the existing hierarchy is sound

`docs/README.md`'s 14 ranks (Implementation → Active queue → Ratified
contract → Preserved founder input → Active engineering programme →
Decisions → Agent process → Standing engineering rules → Domain description
→ Product direction → Design system → Operations → Reference/history →
Factual handoff → Archive) correctly separate "what exists" from "what is
authorized" from "what is intended" from "why a choice was made." Nothing in
this audit found a reason to restructure it. The gaps are additions and
placements, not redesigns.

## Gap 1 — `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` is unranked

Added 2026-08-06, self-declared "authoritative founder-level product
specification," already cited by `NORTH_STAR.md` as "the founder-level
specification of this module's post-appointment intelligence, SOP engine,
advisor dashboard, KPI platform, AI business analysis" — but absent from
both the rank table and the topic-owner table in `docs/README.md`.

**Proposed placement: Rank 2 — Ratified PAON product contract**, alongside
`NORTH_STAR.md`, `FOUNDER_TOOL_BLUEPRINTS.md`, `DESIGN_PORTS.md`. Rationale:
it is written and gated exactly like those three documents (self-declared
authoritative, explicitly not a queue, explicitly deferring sequencing to
`PHASE.md`), and it is already load-bearing for a document one rank below it
in the existing table (`NORTH_STAR.md` points down to it, which is backwards
if it stays unranked).

## Gap 2 — `docs/vision/` is a single Rank-12 line hiding load-bearing content

Two of the 31 files inside `docs/vision/` do work that the rest of the
directory does not:

- `PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md` — the only
  document in the repository that maps every founder-source concept
  (Nebelspiegel HTML, internal briefs, the 2026-07-30 expansion
  instructions) to a current status and destination stage. This is the
  connective tissue between "preserved founder input" (Rank 3) and "active
  queue" (Rank 1) that no other document provides.
- `PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md` — defines the status
  vocabulary (`verified_local`/`verified_live`/`blocked_external`/etc.) that
  `PHASE.md` and `CAPABILITY_DISPOSITION.md` now use verbatim, and the
  completion-dimension framework that ADR-068 later ratified.

Both currently rank no higher than "dated inputs and analysis; never
queues," identical to a 55-line pre-`PHASE.md` pillar sketch like
`docs/vision/07_wardrobe_scoring.md`. That is not a factual error — neither
document outranks `PHASE.md` — but it under-signals their importance to any
agent doing a targeted read.

**Proposed placement:**

- `PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md` →
  **Rank 3 — Preserved founder input**, named explicitly alongside
  `PAON_FOUNDER_INTELLIGENCE_BRIEF.md` (same tier as the brief it traces).
- `PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md` → **Rank 7 — Standing
  engineering rules**, named explicitly alongside `PRINCIPLES.md`/
  `ARCHITECTURE.md` (its completion-dimension framework is exactly that kind
  of cross-programme invariant).
- The remaining 29 `docs/vision/` files stay at Rank 12, but see
  `TARGET_DOCUMENTATION_ARCHITECTURE.md` for a proposed physical
  reorganization (moving `PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md` out
  of a folder literally named "vision" once it is functioning as governance).

## Gap 3 — three operational/experience documents fell through the topic-owner table

`docs/README.md`'s rank table places every document somewhere, but its
**topic-owner table** (the practical "what do I read for X" index) omits
three documents this audit found in active use:

| Document                                      | Missing topic entry                                                                                   | Proposed addition                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `docs/NIGHT_LOG.md`                           | No entry for "record of an authorized unattended build episode"                                       | Add row: _Authorized unattended-run history_ → `NIGHT_LOG.md`                                                  |
| `docs/EXPERIENCE_REBUILD.md`                  | No entry for "governing product-_experience_ document" (distinct from `PRODUCT.md`'s functional spec) | Add row: _Experience acceptance checkpoints and screen-by-screen visual acceptance_ → `EXPERIENCE_REBUILD.md`  |
| `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` | See Gap 1                                                                                             | Add row: _Client & Relationship Intelligence founder specification_ → `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` |

## What wins on conflict — restated per rank, with the three additions folded in

| Rank | Authority                      | Source (additions in **bold**)                                                                                                                | Decides                                                                                        |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 0    | Implementation                 | `apps/`, `packages/`, `supabase/migrations/`, generated types                                                                                 | What exists                                                                                    |
| 1    | Active queue                   | `PHASE.md`                                                                                                                                    | What is authorized and what's next                                                             |
| 2    | Ratified PAON product contract | `NORTH_STAR.md`, `FOUNDER_TOOL_BLUEPRINTS.md`, `DESIGN_PORTS.md`, **`RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`**                                | Curated PAON destination; fixed founder-tool contracts; module specifications; decision rights |
| 3    | Preserved founder input        | `PAON_FOUNDER_INTELLIGENCE_BRIEF.md`, committed founder HTML, **`docs/vision/PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md`** | Non-lossy source intent and designated experience authority; never sequencing                  |
| 4    | Active engineering programme   | `PAON_INTELLIGENCE_PLATFORM.md`, `CAPABILITY_DISPOSITION.md`                                                                                  | Traceability, target architecture, acceptance/resume state                                     |
| 5    | Decisions                      | `DECISIONS.md`                                                                                                                                | Why load-bearing choices were made                                                             |
| 6    | Agent process                  | `AGENTS.md`, `WORKING_AGREEMENT.md`                                                                                                           | How work advances                                                                              |
| 7    | Standing engineering rules     | `PRINCIPLES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `ACCESS_MODEL.md`, **`docs/vision/PAON_COMMON_SENSE_COHERENCE_AND_UX_AUDIT.md`** | Cross-programme invariants; completion-dimension framework                                     |
| 8    | Current domain description     | `DOMAIN_MODEL.md` and `@paon/domain`                                                                                                          | Current bounded contexts and relationships                                                     |
| 9    | Product direction              | `VISION.md`, `PRODUCT.md`, `NON_GOALS.md`                                                                                                     | Durable direction, surfaces, exclusions                                                        |
| 10   | Design system                  | `DESIGN_SYSTEM.md`, `UX_PHILOSOPHY.md`                                                                                                        | Non-designated visual primitives and interaction rules                                         |
| 11   | Operations                     | `ENVIRONMENTS.md`, `DEPLOYMENT.md`, `TOOLING.md`                                                                                              | Environment identity, deployments, CLIs, runbooks                                              |
| 12   | Reference and history          | remaining `docs/vision/*`, `docs/ai_snapshot/*`, `docs/audits/*`, `ROADMAP.md`, `COMPETITIVE_GAPS.md`                                         | Dated inputs and analysis; never queues                                                        |
| 13   | Factual handoff                | `PROJECT_STATE.md`, **`NIGHT_LOG.md`**, **`EXPERIENCE_REBUILD.md`**                                                                           | Compact verified snapshot / experience-acceptance status; never authority                      |
| 14   | Archive                        | `docs/archive/`                                                                                                                               | Obsolete material                                                                              |

**Standing rule (unchanged from `docs/README.md`, restated for
completeness):** when two documents conflict, the higher-ranked source wins.
Code (Rank 0) outranks documents only about _what currently exists_, never
about _what the product ought to become_. A perceived conflict between the
Rank-2 ratified contract and an exact Rank-3 designated founder-source
interaction is a founder-decision issue (per ADR-073), not license for an
agent to pick one — it goes in `FOUNDER_QUESTIONS.md`.

## What this proposal deliberately does not do

- It does not touch `PHASE.md`'s status as sole queue, `DECISIONS.md`'s
  append-only status, or any of `AGENTS.md`'s process rules — those are
  working as designed.
- It does not propose ranking `docs/vision/PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md`
  (the largest single vision document, ~1,678 lines) above Rank 12, despite
  its size, because it explicitly self-states "does not alter active queue
  in `docs/PHASE.md`" and its content is a superset already substantially
  traced by `PAON_NEBELSPIEGEL_FEATURE_TRACEABILITY_AND_OMISSION_LEDGER.md`
  (which this proposal does rank up). Promoting it further would blur the
  line between "target architecture that has been reconciled into the
  ratified contract" and "target architecture still being reconciled" —
  that reconciliation status is exactly what `CAPABILITY_DISPOSITION.md`
  (Rank 4) already exists to record.
- It does not resolve whether `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`
  should be retired, rewritten, or kept — that is a founder decision (does a
  Cursor session get its own operating prompt, or does it read `AGENTS.md`
  like every other agent?) tracked in `FOUNDER_QUESTIONS.md`.
