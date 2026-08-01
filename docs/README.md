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
  `DESIGN_PORTS.md` + the relevant `downloaded_pages`/founder HTML + ADR-052
  for a founder surface. Read the linked founder-brief requirement only for
  product ambiguity and only the ADR named by the queue item.
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

| Rank | Authority                    | Source                                                                                                                   | Decides                                                     |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 0    | Implementation               | `apps/`, `packages/`, `supabase/migrations/`, generated types                                                            | What exists                                                 |
| 1    | Active queue                 | [PHASE.md](./PHASE.md)                                                                                                   | What is authorized and what comes next                      |
| 2    | Founder product intent       | [PAON_FOUNDER_INTELLIGENCE_BRIEF.md](./PAON_FOUNDER_INTELLIGENCE_BRIEF.md)                                               | Complete founder requirements; never sequencing             |
| 3    | Active engineering programme | [PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md)                                                         | Traceability, target architecture, acceptance, resume state |
| 4    | Decisions                    | [DECISIONS.md](./DECISIONS.md)                                                                                           | Why load-bearing choices were made                          |
| 5    | Agent process                | [../AGENTS.md](../AGENTS.md), [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md)                                             | How work advances                                           |
| 6    | Standing engineering rules   | [PRINCIPLES.md](./PRINCIPLES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md) | Cross-program invariants                                    |
| 7    | Current domain description   | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) and `@paon/domain`                                                                  | Current bounded contexts and relationships                  |
| 8    | Product direction            | [NORTH_STAR.md](./NORTH_STAR.md), [VISION.md](./VISION.md), [PRODUCT.md](./PRODUCT.md), [NON_GOALS.md](./NON_GOALS.md)   | Durable mission, layers, surfaces and exclusions            |
| 9    | Design and experience        | [DESIGN_PORTS.md](./DESIGN_PORTS.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)     | Visual authorities and interaction rules                    |
| 10   | Operations                   | [ENVIRONMENTS.md](./ENVIRONMENTS.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                       | Environment identity, deployments, CLIs, and runbooks       |
| 11   | Reference and history        | `vision/`, `ai_snapshot/`, `audits/`, [ROADMAP.md](./ROADMAP.md), [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md)           | Dated inputs and analysis; never queues                     |
| 12   | Factual handoff              | [PROJECT_STATE.md](./PROJECT_STATE.md)                                                                                   | Compact verified snapshot; never authority                  |
| 13   | Archive                      | [archive/](./archive/)                                                                                                   | Obsolete material                                           |

When two documents conflict, the higher-ranked source wins. Fix the lower
source in the same documentation slice instead of preserving ambiguity.

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
| Deployment and provider setup                           | `DEPLOYMENT.md`                                    |
| Compact resume state                                    | Resume Protocol in `PAON_INTELLIGENCE_PLATFORM.md` |

## Constitution rules

1. Code and migrations are factual truth; documents never declare unbuilt
   schema shipped.
2. `PHASE.md` is the only work queue.
3. `PAON_FOUNDER_INTELLIGENCE_BRIEF.md` preserves complete product intent;
   `PAON_INTELLIGENCE_PLATFORM.md` traces it into engineering acceptance.
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
| Founder-designed surfaces     | [DESIGN_PORTS.md](./DESIGN_PORTS.md), canonical HTML                                                               |
| Founder-source interpretation | [audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md](./audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md) |
| UI primitives                 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)                                     |
| Browser/live proof            | [runbooks/BROWSER_PROOF.md](./runbooks/BROWSER_PROOF.md)                                                           |
| Environment or live tests     | [ENVIRONMENTS.md](./ENVIRONMENTS.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                 |
| Historical rationale          | [DECISIONS.md](./DECISIONS.md), then git history                                                                   |
| Product ambiguity             | [PAON_FOUNDER_INTELLIGENCE_BRIEF.md](./PAON_FOUNDER_INTELLIGENCE_BRIEF.md)                                         |
