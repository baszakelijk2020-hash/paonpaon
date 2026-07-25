# PAON Documentation

This is the permanent source of truth for PAON. Read in this order for
full context; each document links forward to the ones that build on it.

1. [NORTH_STAR.md](./NORTH_STAR.md) — the mission, in one sentence
2. [VISION.md](./VISION.md) — the problem, the market, the time horizon
3. [PRODUCT.md](./PRODUCT.md) — the three apps and their feature scope
4. [ARCHITECTURE.md](./ARCHITECTURE.md) — repo shape, layering, tech stack
5. [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) — entities, relationships, bounded contexts
6. [DATABASE.md](./DATABASE.md) — schema, RLS, migrations, type generation
7. [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — tokens, components, theming
8. [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) — interaction principles per app
9. [API.md](./API.md) — Server Actions, Route Handlers, future public API
10. [PRINCIPLES.md](./PRINCIPLES.md) — the standing engineering rules
11. [DECISIONS.md](./DECISIONS.md) — architecture decision log (ADRs)
12. [NON_GOALS.md](./NON_GOALS.md) — what we deliberately aren't building yet
13. [ROADMAP.md](./ROADMAP.md) — build order, phase by phase
14. [PROJECT_STATE.md](./PROJECT_STATE.md) — what's actually built right now, and what's next — read this first when resuming work
15. [EXPERIENCE_REBUILD.md](./EXPERIENCE_REBUILD.md) — the commercial/prospect/demo-studio initiative's own checkpoint log (Foundation/Accepted status per route) — real, disciplined, but written outside this index; cross-check against PROJECT_STATE.md's "Shipped: Commercial prospects..." section for what's actually live
16. [PROPOSAL_GENERATION.md](./PROPOSAL_GENERATION.md) — **caution**: describes a proposal-generation feature whose implementation was broken (failed typecheck, unreferenced anywhere, a colliding duplicate route tree) and was deleted during incident recovery (2026-07-25). Treat as an unbuilt design sketch, not a description of working code, until someone rebuilds it deliberately.
17. [ACCESS_MODEL.md](./ACCESS_MODEL.md) — who can see and change what: the retailer role hierarchy, platform roles, the four visibility tiers (public/customer/staff/platform), and where RLS was spot-checked for drift

The root [CLAUDE.md](../CLAUDE.md) is the operating charter for AI-assisted
work in this repository and points back into this set.

If a future change conflicts with something written here, the
architecture wins — update these documents deliberately, as a decision
([DECISIONS.md](./DECISIONS.md)), not as a side effect of a feature PR.
