# PAON Documentation

**Do not read this set end to end.** It is roughly 6,000 lines and most of
it is reference. Reading it all was the old instruction and it wasted a
great deal of agent time. Read by tier.

## Tier 0 — every session, always (~250 lines)

| Document                                       | What it gives you                                 |
| ---------------------------------------------- | ------------------------------------------------- |
| [PHASE.md](./PHASE.md)                         | What you are allowed to work on right now         |
| [../CLAUDE.md](../CLAUDE.md)                   | Operating charter, hard rules, definition of done |
| [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md) | How to work: increments, review, when to stop     |
| [PRINCIPLES.md](./PRINCIPLES.md)               | The standing engineering rules                    |

If Tier 0 answers your question, stop there and start work.

## Tier 1 — read the one that covers what you are touching

| Touching...                           | Read                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Entities, business logic              | [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)                                       |
| Repo shape, layering, rendering       | [ARCHITECTURE.md](./ARCHITECTURE.md)                                       |
| Schema, RLS, migrations               | [DATABASE.md](./DATABASE.md)                                               |
| Components, tokens, theming           | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)                                     |
| Interaction, layout, mobile           | [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)                                     |
| Server Actions, Route Handlers        | [API.md](./API.md)                                                         |
| Roles, permissions, visibility        | [ACCESS_MODEL.md](./ACCESS_MODEL.md)                                       |
| Product surface, app boundaries       | [PRODUCT.md](./PRODUCT.md)                                                 |
| Any founder-designed screen or widget | [DESIGN_PORTS.md](./DESIGN_PORTS.md) — **port verbatim, never rewrite**    |
| Deploying, Vercel, Supabase, env vars | [DEPLOYMENT.md](./DEPLOYMENT.md) — live IDs, what a session may set itself |

## Tier 2 — reference. Search, never read whole.

These are long append-only logs and inventories. Grep them for the specific
thing you need; do not load them into context wholesale.

| Document                                                | Use it to find                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| [DECISIONS.md](./DECISIONS.md) (~2,200 lines)           | Why something is the way it is. Search by ADR number or keyword |
| [PROJECT_STATE.md](./PROJECT_STATE.md) (~1,700)         | Whether a given feature is actually built                       |
| [EXPERIENCE_REBUILD.md](./EXPERIENCE_REBUILD.md) (~700) | Per-route acceptance status for the rebuild                     |
| [ROADMAP.md](./ROADMAP.md)                              | Sequencing intent. **Not a work queue** — see PHASE.md          |
| [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md)            | What blocks a sale. **Not a work queue** — see PHASE.md         |
| [NON_GOALS.md](./NON_GOALS.md)                          | What is deliberately not being built yet                        |

## Why PAON exists

[NORTH_STAR.md](./NORTH_STAR.md) and [VISION.md](./VISION.md). Read once,
for orientation. Neither authorizes work — PHASE.md does that.

## Rules for this document set

1. **The code wins.** If a document and the code disagree, the code is
   correct and the document is stale. Fix the document.
2. **DECISIONS.md is append-only.** Never edit or delete a past ADR to
   reflect a later change; add a new entry that supersedes it.
3. **Do not write a document describing code that does not exist.** This has
   happened twice (`PROPOSAL_GENERATION.md`, `SUMMARY.md`, both archived) and
   both times a later session trusted the document and built on a lie. If you
   are documenting a design rather than an implementation, say so in the
   first line.
4. **Do not add a document without adding it here, in a tier.** An unindexed
   document is one nobody reads and everybody eventually contradicts.
