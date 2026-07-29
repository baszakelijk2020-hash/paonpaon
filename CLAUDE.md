# PAON — Claude Code Entry Point

`AGENTS.md` is PAON's single cross-agent operating charter. Read it first and
follow it in full. This file exists because Claude Code loads `CLAUDE.md`
automatically; it must not become a competing rule set.

Then read:

1. `docs/PHASE.md` — the ordered, authorized queue.
2. `docs/PAON_INTELLIGENCE_PLATFORM.md` — the active product and technical
   specification.
3. The ADR named by the current queue item.
4. The relevant code and migrations, which are the truth for what exists.

The mandatory loop is:

> inspect → implement one coherent slice → test → repair → update
> authoritative state → commit → push → immediately take the next queue item

Do not stop for routine review, confirmation, strategy reopening, or an
intermediate handoff. Continue until the active founder request and every
buildable queue item are finished and pushed, or only real hard blockers from
`docs/PHASE.md` remain.
