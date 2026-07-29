# PAON Documentation Authority Map

This file maps each topic to one authority. It is navigation, not a plan.
Code and migrations always win for what is implemented.

## Minimum reading path

Every coding session follows:

```text
AGENTS.md
  → PHASE.md
  → PAON_INTELLIGENCE_PLATFORM.md
  → relevant ADR
  → current code and migrations
```

Read another document only when the active slice needs its topic.

## Authority hierarchy

| Rank | Authority                      | Source                                                                                                                   | Decides                                         |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 0    | Implementation                 | `apps/`, `packages/`, `supabase/migrations/`, generated types                                                            | What exists                                     |
| 1    | Active queue                   | [PHASE.md](./PHASE.md)                                                                                                   | What is authorized and what comes next          |
| 2    | Active programme specification | [PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md)                                                         | Product intent, target architecture, acceptance |
| 3    | Decisions                      | [DECISIONS.md](./DECISIONS.md)                                                                                           | Why load-bearing choices were made              |
| 4    | Agent process                  | [../AGENTS.md](../AGENTS.md), [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md)                                             | How work advances                               |
| 5    | Standing engineering rules     | [PRINCIPLES.md](./PRINCIPLES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md) | Cross-program invariants                        |
| 6    | Current domain description     | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) and `@paon/domain`                                                                  | Current bounded contexts and relationships      |
| 7    | Product direction              | [NORTH_STAR.md](./NORTH_STAR.md), [VISION.md](./VISION.md), [PRODUCT.md](./PRODUCT.md), [NON_GOALS.md](./NON_GOALS.md)   | Durable mission and exclusions                  |
| 8    | Design and experience          | [DESIGN_PORTS.md](./DESIGN_PORTS.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)     | Visual authorities and interaction rules        |
| 9    | Operations                     | [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                                                             | Live environments, CLIs, and runbooks           |
| 10   | Reference and history          | `vision/`, `ai_snapshot/`, `audits/`, [ROADMAP.md](./ROADMAP.md), [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md)           | Inputs and dated analysis; never queues         |
| 11   | Factual handoff                | [PROJECT_STATE.md](./PROJECT_STATE.md)                                                                                   | Compact verified snapshot; never authority      |
| 12   | Archive                        | [archive/](./archive/)                                                                                                   | Obsolete material                               |

When two documents conflict, the higher-ranked source wins. Fix the lower
source in the same documentation slice instead of preserving ambiguity.

## Topic owners

| Topic                                                  | Authority                                          |
| ------------------------------------------------------ | -------------------------------------------------- |
| Current queue, dependencies, stage non-goals, blockers | `PHASE.md`                                         |
| Intelligence Platform product and technical design     | `PAON_INTELLIGENCE_PLATFORM.md`                    |
| Agent operating loop                                   | `AGENTS.md`; detail in `WORKING_AGREEMENT.md`      |
| Architectural decisions and reversals                  | `DECISIONS.md`                                     |
| Current entity shapes                                  | code, then `DOMAIN_MODEL.md`                       |
| Tables, migrations, RLS                                | migrations, then `DATABASE.md`                     |
| Server Actions and Route Handlers                      | `API.md`                                           |
| Founder-authored HTML surfaces                         | committed HTML + `DESIGN_PORTS.md`                 |
| Deployment and provider setup                          | `DEPLOYMENT.md`                                    |
| Compact resume state                                   | Resume Protocol in `PAON_INTELLIGENCE_PLATFORM.md` |

## Constitution rules

1. Code and migrations are factual truth; documents never declare unbuilt
   schema shipped.
2. `PHASE.md` is the only work queue.
3. `PAON_INTELLIGENCE_PLATFORM.md` is the only active programme specification.
4. `DECISIONS.md` is append-only. Supersede an ADR with a newer ADR.
5. `PROJECT_STATE.md` is concise factual context, not a queue, plan, or
   authority.
6. Reference documents may inform a slice but cannot authorize it.
7. Every maintained document is indexed here; obsolete material belongs in
   `archive/`.
8. Do not duplicate the continuous-build contract or product plan into new
   files.

## On-demand references

| Working on                  | Read                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| Domain types and validation | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), relevant `packages/domain/src`           |
| Schema or tenancy           | [DATABASE.md](./DATABASE.md), relevant migrations                              |
| App/repository boundaries   | [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md)                       |
| Roles and permissions       | [ACCESS_MODEL.md](./ACCESS_MODEL.md)                                           |
| Founder-designed surfaces   | [DESIGN_PORTS.md](./DESIGN_PORTS.md), canonical HTML                           |
| UI primitives               | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) |
| Deployments or credentials  | [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                   |
| Historical rationale        | [DECISIONS.md](./DECISIONS.md), then git history                               |
