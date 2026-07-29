# AGENTS.md

This file exists so Codex and any other agent that looks for `AGENTS.md`
loads the same instructions Claude Code loads from `CLAUDE.md`.

**Read [CLAUDE.md](./CLAUDE.md), [docs/PHASE.md](./docs/PHASE.md), and
[docs/WORKING_AGREEMENT.md](./docs/WORKING_AGREEMENT.md) before doing
anything.** They are the operating charter, the scope freeze, and the
working mode. `CLAUDE.md` is the single source of truth for engineering
rules — this file is a pointer only and must never accumulate rules of
its own, because two charters that disagree is worse than one nobody
reads.

If you have no MCP servers, you are not blocked — every deployment and
database operation has a CLI equivalent, and the tokens are in the
repository-root `.env.local`. See [docs/TOOLING.md](./docs/TOOLING.md).

Short version, so a session that ignores the links still behaves:

- **NON-NEGOTIABLE:** You are **not allowed to stop until REALLY ALL
  FINISHED** (founder request done + buildable queue empty + only hard
  blockers + pushed). Do **not** stop and check. Do **not** end a turn
  between batches. Do **not** close after a visual audit without fixing
  the gaps. Push **all the way**. Build → self-verify → commit → push →
  next item **in the same turn**. No "please review." Skip Stripe /
  Resend / silhouette (note + continue). "Test it" only when truly
  finished — never as a pause. See `docs/WORKING_AGREEMENT.md`.
- Only three workstreams are in scope right now: the storefront template,
  the prospect Demo Studio, and the marketing site. See `docs/PHASE.md`.
- Anything outside those: say so and ask. Do not build it quietly.
- Hard stops only: out-of-freeze work, ADR conflicts you cannot ADR, or a
  founder surface that cannot be ported verbatim.
- `strict` TypeScript, no `any`. Data access through a `@paon/database`
  repository. Mutations are Server Actions. Never duplicate a component or
  a business rule across apps.
- Done means checks pass, the tree is clean, and the change is **pushed** —
  no scratch files, no unpushed finished work left behind.
