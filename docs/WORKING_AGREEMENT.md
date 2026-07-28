# Working Agreement

How the founder and an engineering session (Claude Code, Codex, or any
other) work together on PAON. **Tier 0 — read every session.**

**Founder decision 2026-07-28:** reverse the stop-and-wait loop. Sessions
work continuously to completion — build, self-verify, iterate, commit,
push, pick up the next in-scope item — without pausing for founder review
after every increment. The earlier stop-and-wait rule fixed a real failure
(21 unpushed commits, 130 uncommitted files, no CI). Continuous mode keeps
the _discipline_ of that fix (small commits, green CI, no silent debt) and
drops the _human gate_ between increments. Quality is enforced by the
session verifying its own work (curl, browser, definition-of-done) and by
CI on every push — not by waiting for a click-through between tasks.

---

## The loop (continuous)

Every piece of work follows the same cycle. **Do not stop between
increments to wait for the founder.** Chain them until the current
PHASE.md queue item is done, then automatically start the next in-scope
item.

**1. Orient.** Read [PHASE.md](./PHASE.md). Take the next unfinished item
in the live queue / workstreams. Skip items blocked on founder credentials
(Stripe, Resend, etc.) — leave a one-line note in PHASE.md and move on.

**2. Plan briefly, then build.** State the intent in the commit message
and PHASE.md notes, not in a waiting message. One increment is still one
coherent change (one behaviour, one surface). If it needs the word "and"
more than once, split into sequential commits — but ship them back to back
without pausing.

**3. Self-verify.** Prefer verifying against the already-running `pnpm
dev` with curl / browser / Playwright. Do **not** run `pnpm build` against
a live `.next` the founder may be using. Before considering an increment
done, check the actual local URL and the interaction path. Fix what you
find; iterate until it works.

**4. Definition of done before push** (or when the hook requires it):

```
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Stop `pnpm dev` first if you must run `pnpm build`. All six green, or fix
until they are.

**5. Commit and push.** Do not leave work only on the laptop.

```
git add -A && git commit -m "<why, in plain language>" && git push origin main
```

Watch CI / Vercel. If red, **fix immediately** before the next feature.
Deploy is push-to-`main` (Hobby Vercel); do not invent a second deploy path.

**6. Advance.** Update PHASE.md if an item finished. Start the next
in-scope queue item in the same session. Keep going.

---

## What still stops the session (hard stops only)

Stop and ask the founder — do not proceed and report afterwards — only
when:

- The work would leave the three workstreams in [PHASE.md](./PHASE.md).
- Credentials or a third-party account only the founder can provision are
  required (live Stripe, Resend, etc.).
- A change would contradict an ADR in [DECISIONS.md](./DECISIONS.md)
  without writing a new ADR that records the reversal.
- Destructive irreversible ops on production data beyond the documented
  seed / demo teardown paths.

Outside those: **do not stop for routine progress, mid-increment
confirmation, or "please review."** Verify yourself, commit, push,
continue.

Drive-by fixes of unrelated bugs are still discouraged — park them in
PHASE.md or a short commit message follow-up note, then finish the current
item. Silent technical debt is still forbidden.

---

## Scope freeze (unchanged)

Only the three workstreams in PHASE.md. `ROADMAP.md` and
`COMPETITIVE_GAPS.md` are reference, not a free-for-all queue. Within the
freeze, PHASE.md's ordered queue is the work queue — advance it
automatically.

---

## Founder-designed surfaces (unchanged)

Port verbatim from `downloaded_pages/*.html` and
`apps/customer/app/r/[slug]/paon-template.html` (ADR-052). Never rebuild
those in Tailwind or `@paon/ui`. If a surface cannot be ported verbatim,
stop and ask.

---

## The founder's routine (lightweight)

You no longer need to gate every increment. When you sit down:

```
cd ~/Projects/PAON && nvm use && pnpm dev
```

Check `git log --oneline -10` and GitHub Actions / Vercel if you want the
story of what shipped while you were away. If CI is red, tell the session
to fix `main` first.

Paste when starting a fresh agent:

> Read docs/PHASE.md, docs/WORKING_AGREEMENT.md and docs/DESIGN_PORTS.md
> first. Continuous mode: build, self-verify, commit, push, advance the
> PHASE queue without waiting for me between increments. Scope freeze —
> three workstreams only. Founder-designed surfaces are verbatim ports
> (ADR-052). Hard stops only for out-of-freeze work, missing credentials,
> or ADR conflicts.

---

## Switching between Claude Code and Codex

They share no memory. Continuity is the repository: PHASE.md, commit
messages, green CI. Orient with `PHASE.md` + `git log --oneline -10`.
Prefer finishing a commit before switching tools so the handoff is clean.

---

## Environment discipline

**Match CI's Node.** `nvm use` from `.nvmrc`.

**Never rebuild `.next` under a live `pnpm dev`.** Verify with curl /
browser against the running server when possible.

**Name temporary files `_tmp-*`.** Delete them before the session ends.

**Leave the tree clean.** Uncommitted work at session end is still a
failure mode — continuous mode commits more often, not less.

---

## Decisions are not real until they are written

- Architectural choice or reversal → [DECISIONS.md](./DECISIONS.md) ADR.
- Change to what may be worked on → [PHASE.md](./PHASE.md).
- Working-mode change (this file) → keep CLAUDE.md / AGENTS.md in sync.

---

## What good looks like

A session that runs for a long stretch and ends with: multiple small
pushed commits, green CI, PHASE.md advanced, and concrete verified
URLs — without the founder having to approve each step.

A session that ends with thirty modified files and nothing committed is
still a failure.
