# AGENTS.md

This file exists so Codex and any other agent that looks for `AGENTS.md`
loads the same instructions Claude Code loads from `CLAUDE.md`.

**Read [CLAUDE.md](./CLAUDE.md) and [docs/PHASE.md](./docs/PHASE.md) before
doing anything.** They are the operating charter and the current scope
freeze. `CLAUDE.md` is the single source of truth for engineering rules —
this file is a pointer only and must never accumulate rules of its own,
because two charters that disagree is worse than one nobody reads.

Short version, so a session that ignores the links still behaves:

- Only three workstreams are in scope right now: the storefront template,
  the prospect Demo Studio, and the marketing site. See `docs/PHASE.md`.
- Anything outside those: say so and ask. Do not build it quietly.
- `strict` TypeScript, no `any`. Data access through a `@paon/database`
  repository. Mutations are Server Actions. Never duplicate a component or
  a business rule across apps.
- Done means `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all
  pass, and the tree is committable — no scratch files left behind.
- Stop and ask rather than running unsupervised for long stretches.
