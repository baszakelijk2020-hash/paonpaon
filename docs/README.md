# PAON Documentation Constitution

**This file is the single navigation and authority map for the document
set.** Do not read the docs end to end (~6,000+ lines). Read by tier and
by authority. An unindexed document is unconstitutional — add it here or
archive it.

Last constitution pass: 2026-07-29 (ADR-057).

---

## Authority hierarchy (one source per topic)

Higher rows beat lower rows when they conflict. **Code and migrations
always beat every document** for what is actually implemented.

| Rank | Authority                                   | Documents                                                                                                                                                          | Decides                                                        |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 0    | **Implementation**                          | `apps/`, `packages/`, `supabase/migrations/`, generated types                                                                                                      | What exists                                                    |
| 1    | **Scope gate**                              | [PHASE.md](./PHASE.md)                                                                                                                                             | What may be built _right now_                                  |
| 2    | **Engineering constitution**                | [../CLAUDE.md](../CLAUDE.md), [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md), [PRINCIPLES.md](./PRINCIPLES.md), [AGENTS.md](../AGENTS.md)                          | How to work; hard rules                                        |
| 3    | **Decisions**                               | [DECISIONS.md](./DECISIONS.md) (append-only ADRs)                                                                                                                  | Why the system is shaped this way                              |
| 4    | **Company / product direction**             | [NORTH_STAR.md](./NORTH_STAR.md), [VISION.md](./VISION.md), [PRODUCT.md](./PRODUCT.md), [NON_GOALS.md](./NON_GOALS.md)                                             | Mission, surfaces, deferrals — **do not authorize build**      |
| 5    | **Architecture & domain (intended design)** | [ARCHITECTURE.md](./ARCHITECTURE.md), [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md), [ACCESS_MODEL.md](./ACCESS_MODEL.md) | How the system _should_ be layered — verify vs Rank 0          |
| 6    | **Experience & design**                     | [DESIGN_PORTS.md](./DESIGN_PORTS.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)                                               | Founder ports + portal design                                  |
| 7    | **Operations**                              | [DEPLOYMENT.md](./DEPLOYMENT.md), [TOOLING.md](./TOOLING.md)                                                                                                       | Live IDs, env, CLIs                                            |
| 8    | **Destination (not shipped)**               | [vision/](./vision/)                                                                                                                                               | Lifelong wardrobe intelligence — ADR-056                       |
| 9    | **As-built inventory**                      | [ai_snapshot/](./ai_snapshot/)                                                                                                                                     | Dated factual snapshot — regenerate when stale                 |
| 10   | **Sequencing / sales reference**            | [ROADMAP.md](./ROADMAP.md), [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md), [EXPERIENCE_REBUILD.md](./EXPERIENCE_REBUILD.md)                                         | **Not work queues** during freeze                              |
| 11   | **Status narrative**                        | [PROJECT_STATE.md](./PROJECT_STATE.md)                                                                                                                             | Historical “shipped” prose — **verify before trust** (ADR-051) |
| 12   | **Archive**                                 | [archive/](./archive/)                                                                                                                                             | Obsolete — never a work queue                                  |

### Topic → single authoritative source

| Topic                      | Authoritative source                  | Not authoritative                                |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| What to build today        | PHASE.md                              | ROADMAP, vision, COMPETITIVE_GAPS, PROJECT_STATE |
| Agent/engineer process     | CLAUDE.md + WORKING_AGREEMENT         | archive handoffs                                 |
| Why a past choice was made | DECISIONS.md (specific ADR)           | PROJECT_STATE narrative                          |
| Entity shape (intended)    | DOMAIN_MODEL.md + `@paon/domain` code | Vision pillars                                   |
| Tables / RLS               | migrations + DATABASE.md rules        | DOMAIN_MODEL alone                               |
| As-built feature presence  | code + ai_snapshot (dated)            | PROJECT_STATE without verification               |
| Long-term category         | vision/ + VISION.md                   | PHASE                                            |
| Founder HTML surfaces      | DESIGN_PORTS.md + committed HTML      | DESIGN_SYSTEM rewrite impulse                    |
| Live deploy IDs            | DEPLOYMENT.md                         | Guessed URLs                                     |

---

## Tier 0 — every session, always

| Document                                       | Role                      |
| ---------------------------------------------- | ------------------------- |
| [PHASE.md](./PHASE.md)                         | Scope freeze / work queue |
| [../CLAUDE.md](../CLAUDE.md)                   | Operating charter         |
| [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md) | Continuous mode           |
| [PRINCIPLES.md](./PRINCIPLES.md)               | Engineering principles    |

If Tier 0 answers the question, stop and work.

## Tier 1 — read only what you touch

| Touching...                    | Read                                                 |
| ------------------------------ | ---------------------------------------------------- |
| Entities, business logic       | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) + code          |
| Repo shape, layering           | [ARCHITECTURE.md](./ARCHITECTURE.md)                 |
| Schema, RLS, migrations        | [DATABASE.md](./DATABASE.md) + `supabase/migrations` |
| Components, tokens             | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)               |
| Interaction, layout            | [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)               |
| Server Actions, Route Handlers | [API.md](./API.md)                                   |
| Roles, permissions             | [ACCESS_MODEL.md](./ACCESS_MODEL.md)                 |
| Product surfaces               | [PRODUCT.md](./PRODUCT.md)                           |
| Founder-designed screens       | [DESIGN_PORTS.md](./DESIGN_PORTS.md)                 |
| Deploy / env                   | [DEPLOYMENT.md](./DEPLOYMENT.md)                     |
| CLIs / MCP                     | [TOOLING.md](./TOOLING.md)                           |

## Tier 1.5 — destination (orientation only)

| Document             | Role                                                      |
| -------------------- | --------------------------------------------------------- |
| [vision/](./vision/) | Wardrobe intelligence pillars. **Never overrides PHASE.** |

## Tier 2 — search, never bulk-read

| Document                                         | Role                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| [DECISIONS.md](./DECISIONS.md)                   | ADRs                                              |
| [ai_snapshot/](./ai_snapshot/)                   | As-built inventory                                |
| [ROADMAP.md](./ROADMAP.md)                       | Sequencing / Horizons                             |
| [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md)     | Sales blockers                                    |
| [NON_GOALS.md](./NON_GOALS.md)                   | Explicit deferrals                                |
| [EXPERIENCE_REBUILD.md](./EXPERIENCE_REBUILD.md) | Experience acceptance (paused by freeze)          |
| [PROJECT_STATE.md](./PROJECT_STATE.md)           | Unverified status log — prefer ai_snapshot + code |
| [NIGHT_LOG.md](./NIGHT_LOG.md)                   | Overnight run trail                               |

## Orientation (read once)

[NORTH_STAR.md](./NORTH_STAR.md) · [VISION.md](./VISION.md) · root [README.md](../README.md)

---

## Classification of the document set

| Category                  | Documents                                                       |
| ------------------------- | --------------------------------------------------------------- |
| Constitutional            | This file, PHASE, CLAUDE, AGENTS, WORKING_AGREEMENT, PRINCIPLES |
| Architecture              | ARCHITECTURE, API, ACCESS_MODEL, DESIGN_PORTS                   |
| Engineering               | PRINCIPLES, TOOLING, UX_PHILOSOPHY, DESIGN_SYSTEM               |
| Product                   | PRODUCT, NON_GOALS, COMPETITIVE_GAPS                            |
| Vision / destination      | VISION, NORTH_STAR, vision/\*                                   |
| ADR                       | DECISIONS                                                       |
| Domain                    | DOMAIN_MODEL                                                    |
| Database                  | DATABASE, supabase/migrations (implementation)                  |
| Operational / Deployment  | DEPLOYMENT, TOOLING                                             |
| As-built / AI inventory   | ai_snapshot/\*                                                  |
| Sequencing                | ROADMAP, EXPERIENCE_REBUILD                                     |
| Historical / unverified   | PROJECT_STATE, NIGHT_LOG                                        |
| Obsolete                  | archive/\*\*                                                    |
| Design sources (not docs) | downloaded_pages/\*.html                                        |

---

## Constitution rules

1. **Code wins.** Fix the document; do not “fix” reality in prose.
2. **DECISIONS.md is append-only.** Supersede with a new ADR; never rewrite history.
3. **Design ≠ shipped.** First line must say if a doc is destination-only (vision, some ADRs).
4. **No document without an index row here.** Orphans become archive or get deleted.
5. **One source of truth per topic** (table above). Improve the existing doc; do not fork.
6. **PHASE subordinates** ROADMAP, vision, COMPETITIVE_GAPS, EXPERIENCE_REBUILD, ai_snapshot recommendations.
7. **Archive, don’t confuse.** Obsolete material lives under `archive/` with an obsolete banner.
8. **As-built snapshots age.** Prefer regenerating `ai_snapshot/` over treating it as eternal truth.

---

## Archive map

| Path                                                 | Contents                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [archive/](./archive/)                               | Early false “implemented” proposals; old handoff                                      |
| [archive/made-to-munro/](./archive/made-to-munro/)   | Root Made-to-Munro ROADMAP / CURRENT_STATE / AUDIT_LOG / plans that contradicted PAON |
| [archive/dead-scaffolds/](./archive/dead-scaffolds/) | Unused Prisma schema + SQL dump — **not** the live database                           |
