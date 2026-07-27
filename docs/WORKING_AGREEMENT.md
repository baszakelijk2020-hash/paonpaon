# Working Agreement

How the founder and an engineering session (Claude Code, Codex, or any
other) work together on PAON. **Tier 0 — read every session.**

This exists because of a specific, documented failure. Before 2026-07-27
the repository had accumulated 21 unpushed commits and 130 uncommitted
files, CI had never once run, Codex had no instructions file at all, and
`docs/CLAUDE_HANDOFF.md` explicitly told agents to "continue autonomously
and do not stop for routine implementation decisions or progress
summaries." The result was months of work nobody could review, revert, or
verify. None of that was caused by bad code. It was caused by working in
units too large to inspect.

The whole agreement below is one idea: **work in increments small enough
that a non-engineer can confirm each one before the next begins.**

---

## The founder's routine

Written for the founder, not for a session. If you have lost the thread,
start here.

### Every time you sit down

Open VS Code, open a terminal (`Ctrl` + `Shift` + `` ` ``), and run:

```
cd ~/Projects/PAON && nvm use && pnpm dev
```

`nvm use` puts you on the same Node CI uses. `pnpm dev` starts the three
apps: admin on `localhost:3000`, retailer on `:3001`, customer on `:3002`.
Leave that tab running all day. Open a **second** tab for every other
command.

### Every time you ask an agent for work

Paste this first, in Claude Code or Codex:

> Read docs/PHASE.md and docs/WORKING_AGREEMENT.md first. You are the
> principal engineer for PAON. Before writing code, tell me what you plan to
> change and why, and stop if it falls outside the scope freeze. Build one
> reviewable increment, run the full definition-of-done command, then stop
> and wait for me.

Then: it proposes → you say go → it builds one thing and stops → you
review → you commit. Never let it start a second thing before you have
committed the first.

### Every time it finishes something

1. Look at VS Code's Source Control panel (branch icon, left bar). Does the
   list of changed files roughly match what it said it would change?
2. Open the URL from its **Test it** section. Click through. Does it work?
3. In your second terminal tab:

```
git add -A && git commit -m "plain description of what changed" && git push origin main
```

4. Open `github.com/baszakelijk2020-hash/paonpaon/actions`. Wait for green.

If CI goes red, stop and fix it before starting anything new. A red `main`
means the next change is built on a broken foundation.

### Before you stop for the day

In your second tab:

```
git status --short
```

Empty output means everything is committed and safe. Anything listed is
work that exists nowhere but your laptop — commit it or delete it. Do not
leave it overnight; that is how 130 uncommitted files happened.

### That is the whole routine

Three commands to start, one to commit, one to check. Everything else in
this document explains _why_ — you do not need to re-read it daily.

---

## The loop

Every piece of work follows the same five steps. No step is skipped, and
the session stops at step 5 rather than rolling into the next increment.

**1. Plan, before writing code.** The session states, in plain language:
what it intends to change, which files, and why it serves the current
objective in [PHASE.md](./PHASE.md). If the answer involves anything
outside the three in-scope workstreams, it stops here and asks.

**2. The founder confirms or redirects.** This costs a minute and is the
entire control mechanism. Do not skip it because the plan sounds sensible —
plans that sound sensible are exactly how scope crept before.

**3. Build one increment.** One increment is a change the founder can look
at and judge on its own: one page, one component, one behaviour. Not "the
storefront." Not "the marketing site." If describing it needs the word
"and" more than once, it is too big — split it.

**4. Verify.** The session runs the full definition-of-done command from
[CLAUDE.md](../CLAUDE.md) and reports the actual result, not an assumption:

```
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Then it writes a **Test it** section — exact local URL and port, what must
already be running, how to get past sign-in, the exact click path, and what
was already checked automatically versus what only a human eye can confirm.

**5. Stop.** The session waits. The founder reviews and commits. Only then
does the next increment start.

---

## The founder's review, concretely

Reviewing does not require reading code. Three checks, two minutes:

**Look at what changed.** VS Code's Source Control panel (the branch icon
in the left bar) lists every modified file. Click one to see old and new
side by side. You are not auditing logic — you are asking: does this touch
roughly the files the plan said it would? A change to twelve files when the
plan described one page is the signal to stop and ask why.

**Follow the Test it section.** Open the URL. Click the path. Look at it.
If the session says something works and it does not, that is worth knowing
now rather than three increments later.

**Commit before continuing.** An unreviewed, uncommitted increment sitting
in the working tree while a second one starts on top of it is precisely the
state that caused the incident above.

```
git add -A && git commit -m "<what changed, in plain language>" && git push origin main
```

Then check the Actions tab is green. CI is the only thing that verifies on
a clean machine rather than yours.

---

## Never run unsupervised

The session stops and asks — it does not proceed and report afterwards —
when any of these is true:

- The work would touch anything outside the three workstreams in
  [PHASE.md](./PHASE.md).
- It needs a new domain entity, a migration, or a new shared package.
- It would contradict an ADR in [DECISIONS.md](./DECISIONS.md).
- It has been working long enough that the founder has not seen output.
- It is about to delete or rewrite something it did not create.
- It finds an existing problem unrelated to the current task. Report it,
  write it down, do not fix it in passing. Drive-by fixes are how a
  reviewable change becomes an unreviewable one.

"It seemed reasonable and in the spirit of the goal" is not a reason to
proceed. It is the exact failure mode this document exists to prevent.

---

## Switching between Claude Code and Codex

The founder alternates between the two as usage limits allow. They share no
memory whatsoever. The only continuity is the repository.

**Both read the same charter.** `AGENTS.md` at the repository root exists so
Codex loads the same instructions Claude does. It is a pointer to
`CLAUDE.md` and must never accumulate rules of its own — two charters that
disagree is worse than one nobody reads.

**Never switch mid-increment.** Finish the loop, verify, commit, then
switch. Handing a half-finished change to an agent with no idea what was
intended produces the worst output of any situation in this document.

**Orient the incoming session** by having it read `PHASE.md`, then
`git log --oneline -10` to see what just happened. Recent commit messages
are the handoff note. Write them for that purpose.

---

## Environment discipline

**Match CI's Node.** CI pins Node from `.nvmrc` (22.20.0). A developer
machine drifts ahead — the founder's was on 26 while CI ran 20.9.0, which
is why CI sat broken and invisible for months. Run `nvm use` in the project
folder at the start of each day. If `nvm` is not installed, install it; the
alternative is local green that predicts nothing.

**Never build against a live dev server.** `pnpm build` rebuilds `.next`
and has corrupted a running `pnpm dev` twice. Stop the dev server first, or
verify against the already-running server with `curl` or a throwaway
Playwright script instead.

**Name temporary files `_tmp-*`.** `.gitignore` catches that prefix, so
scratch verification scripts cannot be committed by accident. Delete them
anyway before the session ends.

---

## Decisions are not real until they are written

Anything agreed in a chat window and not committed to a file is lost the
moment the session ends. This is not a limitation to work around; it is the
single most important habit on this list.

- Architectural choice, or a reversal of a past one →
  [DECISIONS.md](./DECISIONS.md), as a new ADR. Never edit an old one.
- Change to what may be worked on → [PHASE.md](./PHASE.md).
- Commercial or positioning judgement →
  [COMPETITIVE_GAPS.md](./COMPETITIVE_GAPS.md).
- A shortcut taken under time pressure → written down somewhere, always.
  Silent debt is the one thing this codebase cannot accumulate and survive.

If a session proposes something significant and does not offer to record
it, ask it to. If the founder decides something significant in
conversation, it is the session's job to write it down as part of the same
increment.

---

## What good looks like

A session that ends with: one reviewed increment, six green checks, a
committed and pushed change, a green CI run, and a one-paragraph statement
of what is now true that was not true before.

A session that ends with thirty modified files, a confident summary, and
nothing committed is a failure regardless of how good the code is.
