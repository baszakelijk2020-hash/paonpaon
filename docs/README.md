# PAON Documentation Authority Map

This file maps each topic to one authority. It is navigation, not a plan.
Code and migrations always win for what is implemented.

## Minimum reading path

An ordinary coding session follows:

```text
AGENTS.md
  → PHASE.md
  → Resume Protocol at the top of PAON_INTELLIGENCE_PLATFORM.md
  → active queue-item acceptance contract
  → relevant ADR
  → current code and migrations
```

Read another document only when the active slice needs its topic.

## Context levels

- **Level 1 — every implementation turn:** the minimum path above plus the
  directly relevant code, test, repository, and migration.
- **Level 2 — cross a boundary:** read `DOMAIN_MODEL.md` for shared domain
  rules, `DATABASE.md` for migration/RLS work, `API.md` for Server Actions or
  Route Handlers, `ARCHITECTURE.md` for package boundaries, or
  the relevant `FT-*` contract in `FOUNDER_TOOL_BLUEPRINTS.md` +
  `DESIGN_PORTS.md` + the exact `downloaded_pages`/founder HTML fragment +
  ADR-052/071 for a founder surface. Read the linked founder-brief requirement
  only for product ambiguity and only the ADR named by the queue item.
- **Product decision:** read `NORTH_STAR.md`, then `PRODUCT.md`. Use the dated
  founder-source audit only to trace why a concept was kept, narrowed, gated or
  rejected.
- **Level 3 — conflict or audit only:** use targeted search across docs and
  code. Read whole documents only when targeted inspection cannot resolve the
  conflict.

The Resume Protocol is normal-session memory; the requirement traceability
table is permanent programme memory. Do not create a second handoff or
current-state document.

## Authority hierarchy

| Rank | Authority                      | Source                                                                                                                                                                                                                 | Decides                                                                                                                                            |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Implementation                 | `apps/`, `packages/`, `supabase/migrations/`, generated types                                                                                                                                                          | What exists                                                                                                                                        |
| 1    | Active queue                   | [PHASE.md](./PHASE.md)                                                                                                                                                                                                 | What is authorized and what comes next                                                                                                             |
| 2    | Ratified PAON product contract | [NORTH_STAR.md](./NORTH_STAR.md), [FOUNDER_TOOL_BLUEPRINTS.md](./FOUNDER_TOOL_BLUEPRINTS.md), [DESIGN_PORTS.md](./DESIGN_PORTS.md), [RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md](./RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md) | Curated PAON destination; fixed founder-tool experience/system contracts; Client & Relationship Intelligence module specification; decision rights |
| 3    | Preserved founder input        | [PAON_FOUNDER_INTELLIGENCE_BRIEF.md](./PAON_FOUNDER_INTELLIGENCE_BRIEF.md), committed founder HTML                                                                                                                     | Complete non-lossy source intent and designated experience authority; never sequencing or silent reinterpretation                                  |
| 4    | Active engineering programme   | [PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md), [CAPABILITY_DISPOSITION.md](./CAPABILITY_DISPOSITION.md)                                                                                             | Traceability, target architecture, inherited-capability disposition, acceptance and resume state                                                   |
| 5    | Decisions                      | [DECISIONS.md](./DECISIONS.md)                                                                                                                                                                                         | Why load-bearing choices were made                                                                                                                 |
| 6    | Agent process                  | [../AGENTS.md](../AGENTS.md), [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md)                                                                                                                                           | How work advances                                                                                                                                  |
| 7    | Standing engineering rules     | [PRINCIPLES.md](./PRINCIPLES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md)                                                                                               | Cross-program invariants                                                                                                                           |
| 8    | Current domain description     | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) and `@paon/domain`                                                                                                                                                                | Current bounded contexts and relationships                                                                                                         |
| 9    | Product direction              | [VISION.md](./VISION.md), [PRODUCT.md](./PRODUCT.md), [NON_GOALS.md](./NON_GOALS.md)                                                                                                                                   | Supporting durable direction, surfaces and exclusions                                                                                              |
| 10   | Design system                  | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)                                                                                                                                         | Non-designated visual primitives and interaction rules                                                                                             |
| 11   | Operations                     | [ENVIRONMENTS.md](./ENVIRONMENTS.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                                                                                                                     | Environment identity, deployments, CLIs, and runbooks                                                                                              |
| 12   | Reference and history          | `vision/`, `ai_snapshot/`, `audits/`, [ROADMAP.md](./ROADMAP.md), [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md)                                                                                                         | Dated inputs and analysis; never queues                                                                                                            |
| 13   | Factual handoff                | [PROJECT_STATE.md](./PROJECT_STATE.md)                                                                                                                                                                                 | Compact verified snapshot; never authority                                                                                                         |
| 14   | Archive                        | [archive/](./archive/)                                                                                                                                                                                                 | Obsolete material                                                                                                                                  |

When two documents conflict, the higher-ranked source wins. Code outranks
documents only about what currently exists, never about what the product ought
to become. The raw founder brief is deliberately non-lossy input; the later
ratified PAON contract decides its curated meaning. A perceived conflict
between the ratified contract and an exact designated source interaction is a
founder-decision issue under ADR-073, not licence for an agent to choose one.
Fix a genuinely stale lower source in the same documentation slice instead of
preserving ambiguity.

## Topic owners

| Topic                                                   | Authority                                          |
| ------------------------------------------------------- | -------------------------------------------------- |
| Current queue, dependencies, stage non-goals, blockers  | `PHASE.md`                                         |
| Complete founder requirements                           | `PAON_FOUNDER_INTELLIGENCE_BRIEF.md`               |
| Intelligence Platform technical design and traceability | `PAON_INTELLIGENCE_PLATFORM.md`                    |
| Agent operating loop                                    | `AGENTS.md`; detail in `WORKING_AGREEMENT.md`      |
| Architectural decisions and reversals                   | `DECISIONS.md`                                     |
| Current entity shapes                                   | code, then `DOMAIN_MODEL.md`                       |
| Tables, migrations, RLS                                 | migrations, then `DATABASE.md`                     |
| Server Actions and Route Handlers                       | `API.md`                                           |
| Founder-authored HTML surfaces                          | committed HTML + `DESIGN_PORTS.md`                 |
| Stage 8–16 and founder-tool disposition                 | `CAPABILITY_DISPOSITION.md`                        |
| Founder-tool product and technical build contracts      | `FOUNDER_TOOL_BLUEPRINTS.md`                       |
| Deployment and provider setup                           | `DEPLOYMENT.md`                                    |
| Compact resume state                                    | Resume Protocol in `PAON_INTELLIGENCE_PLATFORM.md` |
| Client & Relationship Intelligence module specification | `RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md`           |

## Constitution rules

1. Code and migrations are factual truth; documents never declare unbuilt
   schema shipped.
2. `PHASE.md` is the only work queue.
3. `PAON_FOUNDER_INTELLIGENCE_BRIEF.md` preserves complete product input;
   `NORTH_STAR.md` and `FOUNDER_TOOL_BLUEPRINTS.md` are its ratified PAON
   interpretation; `PAON_INTELLIGENCE_PLATFORM.md` traces that contract into
   engineering acceptance.
4. `DECISIONS.md` is append-only. Supersede an ADR with a newer ADR.
5. `PROJECT_STATE.md` is concise factual context, not a queue, plan, or
   authority.
6. Reference documents may inform a slice but cannot authorize it.
7. Every maintained document is indexed here; obsolete material belongs in
   `archive/`.
8. Do not duplicate the continuous-build contract or product plan into new
   files.

## On-demand references

| Working on                    | Read                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Domain types and validation   | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), relevant `packages/domain/src`                                               |
| Schema or tenancy             | [DATABASE.md](./DATABASE.md), relevant migrations                                                                  |
| App/repository boundaries     | [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md)                                                           |
| Roles and permissions         | [ACCESS_MODEL.md](./ACCESS_MODEL.md)                                                                               |
| Founder-designed surfaces     | [DESIGN_PORTS.md](./DESIGN_PORTS.md), [FOUNDER_TOOL_BLUEPRINTS.md](./FOUNDER_TOOL_BLUEPRINTS.md), canonical HTML   |
| Inherited capability mapping  | [CAPABILITY_DISPOSITION.md](./CAPABILITY_DISPOSITION.md)                                                           |
| Founder-source interpretation | [audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md](./audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md) |
| UI primitives                 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)                                     |
| Browser/live proof            | [runbooks/BROWSER_PROOF.md](./runbooks/BROWSER_PROOF.md)                                                           |
| Environment or live tests     | [ENVIRONMENTS.md](./ENVIRONMENTS.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                 |
| Historical rationale          | [DECISIONS.md](./DECISIONS.md), then git history                                                                   |
| Product ambiguity             | [PAON_FOUNDER_INTELLIGENCE_BRIEF.md](./PAON_FOUNDER_INTELLIGENCE_BRIEF.md)                                         |
