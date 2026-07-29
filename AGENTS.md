# PAON Agent Charter

This is the cross-agent entry point for Codex, Cursor, Claude Code, and any
other coding agent. `CLAUDE.md` is a Claude-specific pointer to this file, not
a second charter.

## Read in this order

Read only the smallest authoritative set needed to work:

1. `AGENTS.md`
2. `docs/PHASE.md`
3. `docs/PAON_INTELLIGENCE_PLATFORM.md`
4. the ADR named by the active queue item
5. the relevant code and migrations

Use `docs/README.md` only when you need to find another authority. Code and
migrations are the truth for what exists. `docs/PHASE.md` is the ordered work
queue. `docs/PAON_INTELLIGENCE_PLATFORM.md` is the product and technical
specification for the active programme.

## Continuous-build contract

Work continuously through the ordered queue:

> inspect → implement one coherent slice → test → repair → update
> authoritative state → commit → push → immediately take the next queue item

Never stop for routine review, confirmation, strategy reopening, or an
intermediate handoff. Do not end a turn merely because one slice shipped.
Stop only at a hard blocker defined in `docs/PHASE.md`, and skip a blocked
item when a later independent item remains buildable.

Every completed slice must leave authoritative state current, checks green,
and the commit pushed. `PROJECT_STATE.md` is a factual snapshot only; it is
never a queue or authority.

## Engineering invariants

- `strict` TypeScript; no `any`.
- Business concepts and pure rules live in `@paon/domain`.
- Supabase access lives behind `@paon/database` repositories.
- Every tenant-owned row carries `retailer_id` and is protected by RLS.
- Browser mutations are Server Actions. Route Handlers are for non-browser
  callers, webhooks, scheduled jobs, and the existing founder-HTML exception.
- Reuse shared components and rules. Do not duplicate them across apps.
- Founder-authored surfaces remain verbatim ports per ADR-052. Mount new data
  through narrow hooks; do not re-express the design.
- New schema changes are forward migrations with generated database types,
  repository coverage, and tenant-isolation verification.

## Definition of done

Run the checks CI runs:

```text
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Stop any live `pnpm dev` process before `pnpm build`. Commit intentionally and
push to `origin/main`. A slice is not complete while its finished work is
uncommitted, unpushed, or leaves the authoritative queue stale.
