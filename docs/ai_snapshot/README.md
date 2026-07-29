# AI / engineer architecture snapshot

**Status: repository-derived inventory as of 2026-07-29.**  
**Purpose:** factual context for senior engineers and AI systems.  
**Not a work queue.** Does not override [PHASE.md](../PHASE.md).  
**Authority:** if this folder disagrees with code or migrations, the code wins —
update this snapshot. Documentation constitution: [../README.md](../README.md)
(ADR-057). This folder is **as-built inventory**, not a work queue and not a
competing charter.

This set inspects the monorepo as it exists today. It does not invent
architecture. Vision destinations live in [../vision/](../vision/) and are
compared only in [15_current_vs_vision.md](./15_current_vs_vision.md).

## Read order

1. [01_project_overview.md](./01_project_overview.md)
2. [02_repository_structure.md](./02_repository_structure.md)
3. [03_domain_map.md](./03_domain_map.md)
4. [04_database.md](./04_database.md)
5. Then the topic you need

## Contents

| #   | Document                                                       | Topic                          |
| --- | -------------------------------------------------------------- | ------------------------------ |
| 01  | [01_project_overview.md](./01_project_overview.md)             | Purpose, stack, maturity, debt |
| 02  | [02_repository_structure.md](./02_repository_structure.md)     | Folders, packages, tooling     |
| 03  | [03_domain_map.md](./03_domain_map.md)                         | Implemented domains            |
| 04  | [04_database.md](./04_database.md)                             | Postgres / Supabase schema     |
| 05  | [05_api.md](./05_api.md)                                       | Server Actions, Route Handlers |
| 06  | [06_frontend.md](./06_frontend.md)                             | Apps, UI, routing              |
| 07  | [07_metadata.md](./07_metadata.md)                             | Metadata system status         |
| 08  | [08_ai.md](./08_ai.md)                                         | AI features                    |
| 09  | [09_search.md](./09_search.md)                                 | Search / filter                |
| 10  | [10_documentation.md](./10_documentation.md)                   | Doc inventory                  |
| 11  | [11_architecture_decisions.md](./11_architecture_decisions.md) | ADR summary                    |
| 12  | [12_feature_inventory.md](./12_feature_inventory.md)           | Feature maturity               |
| 13  | [13_dependency_graph.md](./13_dependency_graph.md)             | Package graph                  |
| 14  | [14_code_health.md](./14_code_health.md)                       | Debt, tests, risks             |
| 15  | [15_current_vs_vision.md](./15_current_vs_vision.md)           | Gap vs `docs/vision/`          |
| 16  | [16_recommendations.md](./16_recommendations.md)               | Repo-derived priorities        |

## Method

Sources: `apps/`, `packages/`, `supabase/migrations/`, generated
`database.types.ts`, `docs/*.md`, ADRs, CI config. Counts and file lists
were taken from the tree on 2026-07-29; they will drift.
