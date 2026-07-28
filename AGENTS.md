# AGENTS.md

This file exists so Codex and any other agent that looks for `AGENTS.md`
loads the same instructions Claude Code loads from `CLAUDE.md`.

**Read [CLAUDE.md](./CLAUDE.md) and [docs/PHASE.md](./docs/PHASE.md) before
doing anything.** They are the operating charter and the current scope
freeze. `CLAUDE.md` is the single source of truth for engineering rules —
this file is a pointer only and must never accumulate rules of its own,
because two charters that disagree is worse than one nobody reads.

If you have no MCP servers, you are not blocked — every deployment and
database operation has a CLI equivalent, and the tokens are in the
repository-root `.env.local`. See [docs/TOOLING.md](./docs/TOOLING.md).

Short version, so a session that ignores the links still behaves:

- Only three workstreams are in scope right now: the storefront template,
  the prospect Demo Studio, and the marketing site. See `docs/PHASE.md`.
- Anything outside those: say so and ask. Do not build it quietly.
- **Continuous mode (2026-07-28):** build, self-verify, commit, push, and
  advance the PHASE queue without waiting for founder review between
  increments. Hard stops only for out-of-freeze work, missing credentials,
  or ADR conflicts. See `docs/WORKING_AGREEMENT.md`.
- `strict` TypeScript, no `any`. Data access through a `@paon/database`
  repository. Mutations are Server Actions. Never duplicate a component or
  a business rule across apps.
- Done means checks pass, the tree is clean, and the change is **pushed** —
  no scratch files, no unpushed finished work left behind.
