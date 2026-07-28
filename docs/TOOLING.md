# Tooling

What any agent or any machine needs to work on PAON. **Tier 1 — read when
setting up, or when a tool cannot reach something it expects to.**

Written because "the connections are built in" was only half true: the
knowledge is in the repository, but the credentials and CLIs are per-machine
and were nowhere documented.

## What is portable, and what is not

| Thing                             | Portable?        | How                                                                 |
| --------------------------------- | ---------------- | ------------------------------------------------------------------- |
| Instructions, decisions, runbooks | Yes              | `CLAUDE.md`, `AGENTS.md`, `docs/*` — committed                      |
| GitHub auth                       | Yes, per machine | The OS git credential store; every tool shelling to `git` shares it |
| Vercel + Supabase access          | Yes, per machine | CLIs plus tokens in the repo-root `.env.local`                      |
| MCP servers                       | Partly           | `.mcp.json` (see below) — Claude Code reads it; other tools may not |

The important consequence: **everything doable via MCP is also doable via
the CLIs.** A tool with no MCP support is not blocked — it uses `vercel` and
`supabase` directly, exactly as `scripts/seed-production.sh` does.

## Required CLIs

```
node        # 22.20.0 — see .nvmrc; run `nvm use` in the project
pnpm        # 9.15.0 via corepack; `corepack enable` after switching node
git
vercel      # npm i -g vercel        — deploys, env vars, logs
supabase    # brew install supabase/tap/supabase — project keys, db push
gh          # optional — CI status without opening a browser
```

`nvm use` matters. A developer machine drifts ahead of `.nvmrc`, and a
Node mismatch is what kept CI silently broken for months (see
`CLAUDE.md`, "Definition of done").

## Tokens

Copy `.env.example` to `.env.local` at the repository root and fill in:

- **`SUPABASE_ACCESS_TOKEN`** — <https://supabase.com/dashboard/account/tokens>.
  Lets `scripts/seed-production.sh` fetch project API keys through the CLI so
  no key is ever typed, pasted or echoed.
- **`VERCEL_TOKEN`** — <https://vercel.com/account/settings/tokens>. Lets the
  `vercel` CLI read and write project settings non-interactively.

`.env.local` is gitignored and must stay that way. `.env.example` is
tracked, and the `.gitignore` negation must remain **after** the `.env*`
wildcard — an earlier ordering silently ignored newly added example files.

## MCP

`.mcp.json` in the repository root registers Vercel's official MCP server
(`https://mcp.vercel.com`) so a Claude Code session gets deployment,
logs and project tools without per-machine setup. It is OAuth-gated —
approve it once per machine when prompted.

Deliberately not in `.mcp.json`: anything needing a secret in the config
file. Tokens belong in `.env.local`, never in a committed file.

If a tool does not support MCP, use the CLI equivalents:

| Instead of an MCP tool | Use                                            |
| ---------------------- | ---------------------------------------------- |
| deployment status      | `vercel ls`, `vercel inspect <url>`            |
| runtime errors         | `vercel logs <deployment-url>`                 |
| env vars               | `vercel env ls`, `vercel env add <NAME> <env>` |
| Supabase project keys  | `supabase projects api-keys --project-ref …`   |
| browser verification   | a throwaway Playwright script (`_tmp-*.ts`)    |

## Working across two tools

The founder alternates Claude Code and Codex as usage limits allow. That is
fine and the repository is built for it — `AGENTS.md` is a pointer to
`CLAUDE.md` so both load the same charter.

One rule makes it safe: **one writer at a time.** Finish the increment,
verify, commit, push, then switch. Two agents editing the same working tree
concurrently is how 130 uncommitted files happened. Sequential hand-off
through the repository is not the same risk, and is the intended workflow.

Orient an incoming tool with `docs/PHASE.md`, then `git log --oneline -10`
and `docs/NIGHT_LOG.md`. Commit messages are the handoff note.
