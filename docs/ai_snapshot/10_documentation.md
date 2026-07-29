# 10 — Documentation

**Snapshot date: 2026-07-29.**

## Tier 0 (authoritative process)

| Doc                                                         | Purpose                | Authoritative?    | Status                   |
| ----------------------------------------------------------- | ---------------------- | ----------------- | ------------------------ |
| [PHASE.md](../PHASE.md)                                     | What may be built now  | **Yes** for scope | Active freeze            |
| [CLAUDE.md](../../CLAUDE.md) / [AGENTS.md](../../AGENTS.md) | Engineering charter    | Yes for agents    | Active                   |
| [WORKING_AGREEMENT.md](../WORKING_AGREEMENT.md)             | How to work            | Yes               | Active (continuous mode) |
| [PRINCIPLES.md](../PRINCIPLES.md)                           | Engineering principles | Yes               | Active                   |

## Orientation

| Doc                               | Purpose                | Notes                         |
| --------------------------------- | ---------------------- | ----------------------------- |
| [NORTH_STAR.md](../NORTH_STAR.md) | Mission                | Does not authorize work       |
| [VISION.md](../VISION.md)         | Product vision         | Links wardrobe intelligence   |
| [PRODUCT.md](../PRODUCT.md)       | App surfaces           | Mix of present + future table |
| [vision/](../vision/)             | Destination pillars    | ADR-056; **not** work queue   |
| [ai_snapshot/](./README.md)       | This factual inventory | Code wins on conflict         |

## Architecture / implementation reference (Tier 1)

| Doc                                     | Purpose            | Authoritative for                 |
| --------------------------------------- | ------------------ | --------------------------------- |
| [DOMAIN_MODEL.md](../DOMAIN_MODEL.md)   | Entities           | Intended model; verify vs code    |
| [ARCHITECTURE.md](../ARCHITECTURE.md)   | Layering           | Style                             |
| [DATABASE.md](../DATABASE.md)           | Schema/RLS rules   | Rules; migrations win for columns |
| [API.md](../API.md)                     | Mutation patterns  | Patterns                          |
| [ACCESS_MODEL.md](../ACCESS_MODEL.md)   | Roles              | Access                            |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | Tokens/UI          | Portals                           |
| [DESIGN_PORTS.md](../DESIGN_PORTS.md)   | Verbatim HTML rule | Founder surfaces                  |
| [UX_PHILOSOPHY.md](../UX_PHILOSOPHY.md) | UX                 | Guidance                          |
| [DEPLOYMENT.md](../DEPLOYMENT.md)       | Live IDs/env       | Ops                               |
| [TOOLING.md](../TOOLING.md)             | CLIs/MCP           | Ops                               |

## Tier 2 / logs (search, don’t bulk-read)

| Doc                                               | Purpose                  | Caution                            |
| ------------------------------------------------- | ------------------------ | ---------------------------------- |
| [DECISIONS.md](../DECISIONS.md)                   | ADRs 001–056             | Append-only; check code reflection |
| [PROJECT_STATE.md](../PROJECT_STATE.md)           | Feature status narrative | **Self-disclaimed**; verify        |
| [ROADMAP.md](../ROADMAP.md)                       | Sequencing               | Subordinate to PHASE               |
| [COMPETITIVE_GAPS.md](../COMPETITIVE_GAPS.md)     | Sales blockers           | Not a work queue                   |
| [EXPERIENCE_REBUILD.md](../EXPERIENCE_REBUILD.md) | Experience acceptance    | Largely paused by freeze           |
| [NON_GOALS.md](../NON_GOALS.md)                   | Explicit deferrals       | Active                             |
| [NIGHT_LOG.md](../NIGHT_LOG.md)                   | Overnight run log        | Historical                         |

## Archive (`docs/archive/`)

`SUMMARY.md`, `PROPOSAL_GENERATION.md`, `CLAUDE_HANDOFF.md` — **obsolete /
archived**; do not treat as current.

## Root orphans (outside `docs/`)

| File                   | Status                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| `/ROADMAP.md`          | Stale Made-to-Munro plan — **duplicates/conflicts** with `docs/ROADMAP.md` |
| `/CURRENT_STATE.md`    | Stale Phase 0 tracker — **obsolete**                                       |
| `/AUDIT_LOG.md`        | Tiny stub — low value                                                      |
| `prisma/schema.prisma` | Dead schema — not documentation but confuses architecture readers          |

## Owner

No formal CODEOWNERS split observed for docs; founder + engineering agents
maintain per WORKING_AGREEMENT / CLAUDE.md.

## Merge recommendations (documentation only)

1. **Delete or clearly quarantine** root `ROADMAP.md` + `CURRENT_STATE.md` (or
   move to `docs/archive/` with banner) — they contradict live docs.
2. Treat `PROJECT_STATE` “Shipped:” sections as needing a verification pass
   (ADR-051) rather than merging into VISION.
3. Keep `docs/vision/` separate from `docs/ai_snapshot/` (destination vs as-built).
4. Do **not** merge ADRs; they are append-only by rule.
5. EXPERIENCE_REBUILD vs PHASE: leave both; PHASE already subordinates rebuild.
