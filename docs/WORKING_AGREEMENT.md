# Working Agreement

How the founder and an engineering session (Claude Code, Codex, Cursor,
or any other) work together on PAON. **Tier 0 — read every session.**

---

## NON-NEGOTIABLE (founder, 2026-07-28 — restated 2026-07-29: NEVER STOP EARLY)

**You are not allowed to stop until you are REALLY ALL FINISHED.**

"Really all finished" means **every** of the following is true:

1. The active founder request for this session is complete (not half-audited,
   not "shipped one polish pass and reported"), **and**
2. The PHASE.md buildable queue has no remaining agent-doable items, **and**
3. Only hard blockers remain (Stripe / Resend / silhouette / missing founder
   design / out-of-freeze ask), **and**
4. Finished work is committed **and** pushed to `origin/main`.

Anything less is unfinished. Do not stop and check. Do not pause for
review. Do not end a turn between finished batches. Do not treat a visual
verdict, a progress summary, or a "Test it" list as a session closer while
actionable polish or queue work remains. Push all the way to finish.

This is not optional soft guidance. Sessions that stop after one
increment, ask "please review," wait for a click-through, end with
"Test it / tell me when to continue," **close a reply after shipping a
batch while work remains**, or declare "queue exhausted" while the
founder's latest instruction still has open follow-through, are
**violating this agreement.**

| Forbidden                                                          | Required                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Stop after a commit to wait for founder confirmation               | Commit → push → immediately start the next in-scope item                                    |
| End the agent turn / reply after a finished batch or feature       | Chain the next unfinished item in the **same turn** until truly finished                    |
| "Please review" / "does this look right?" / "ready for your check" | Self-verify with curl / browser / Playwright, then keep going                               |
| Ending because one queue item or one audit shipped                 | Keep going until the founder request + PHASE buildable queue are both done                  |
| Treating "queue exhausted" as done while founder work remains      | Founder-requested in-scope work overrides a stale "exhausted" note — finish that work first |
| Treating a "Test it" section as a gate or a session closer         | Write "Test it" only when REALLY ALL FINISHED; never as the last act before waiting         |
| Halting the whole session on Stripe / Resend / silhouette          | Note the block in PHASE.md in one line, **skip**, take the next item                        |
| Leaving finished work uncommitted or unpushed                      | Every coherent increment is committed and pushed before the next begins                     |
| Summarizing progress and stopping while work remains               | Progress notes are fine mid-flight; stopping is not                                         |
| Reporting a visual audit without fixing the P0/P1 gaps found       | Audit → fix → verify → commit → push → next gap, in the same turn                           |

The earlier stop-and-wait rule fixed a real failure (21 unpushed commits,
130 uncommitted files, no CI). Continuous mode keeps that **discipline**
(small commits, green CI, no silent debt) and deletes the **human gate**
between increments. Quality is enforced by self-verify + CI on every push —
never by waiting for the founder between tasks.

If you are about to write a message whose purpose is to get permission,
a visual check, or a "continue?" before the next in-scope change: **do
not send it — do the next change instead.** Finishing a batch is not
permission to idle. Declaring yourself done when P0/P1 gaps from the
same request are still open is a process failure.

---

## The loop (continuous — run until REALLY ALL FINISHED)

Every piece of work follows the same cycle. **Chain until the founder
request and the PHASE.md buildable queue are both done** (or only
founder-blocked items remain). Do not stop between increments. Do not
end the reply early to "hand off" or summarize while actionable work
remains.

**1. Orient.** Read [PHASE.md](./PHASE.md). Take the next unfinished
in-scope item. If it is blocked on founder credentials or missing design
(Stripe, Resend, silhouette home, …): one-line note in PHASE.md, **skip,
continue**.

**2. Plan briefly, then build.** Intent lives in the commit message and
PHASE notes — not in a waiting chat message. One increment = one coherent
behaviour. If it needs "and" more than once, split into sequential
commits and ship them **back to back with no pause**.

**3. Self-verify.** Prefer the already-running `pnpm dev` with curl /
browser / Playwright. Do **not** run `pnpm build` against a live `.next`
the founder may be using. Fix until it works. Your verification replaces
founder review between increments.

**4. Definition of done before push** (or when the hook requires it):

```
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Stop `pnpm dev` first if you must run `pnpm build`. All six green, or fix
until they are.

**5. Commit and push.**

```
git add -A && git commit -m "<why, in plain language>" && git push origin main
```

Watch CI / Vercel. If red, **fix immediately**, then continue the queue.
Deploy is push-to-`main` (Hobby Vercel).

**6. Advance without asking.** Update PHASE.md if an item finished.
**Immediately** start the next in-scope item in the same session. Repeat
until REALLY ALL FINISHED (founder request done + buildable queue empty +
only hard blockers + pushed). That is what "push all the way to finish"
means. A PHASE note that says "queue exhausted" does **not** authorize
stopping while the founder's latest message still has open work.

---

## What still stops the session (narrow hard stops only)

**Stop and ask — and wait — only when:**

- The work would leave the three workstreams in [PHASE.md](./PHASE.md)
  (out of freeze).
- A change would contradict an ADR in [DECISIONS.md](./DECISIONS.md)
  and you cannot record a new ADR that documents the reversal.
- A founder-designed surface cannot be ported verbatim (ADR-052) — do
  not invent a substitute.
- Destructive irreversible ops on production data beyond documented
  seed / demo teardown paths.

**These are NOT hard stops (skip and continue):**

- Missing Stripe / Resend / other founder-only API keys.
- Silhouette carousel (or any port blocked on a missing founder-designed
  mount — e.g. do not extend invented `/alterations/*`).
- Uncertainty about visual polish the founder might prefer differently —
  ship the in-scope increment, note follow-ups in PHASE.md, keep going.
- Finishing one increment — that is a signal to start the next, not to
  stop.

Outside the hard-stop list: **never** stop for routine progress,
mid-increment confirmation, or "please review."

Drive-by fixes of unrelated bugs are still discouraged — park them in
PHASE.md, then finish the current item. Silent technical debt is still
forbidden.

---

## Scope freeze (unchanged)

Only the three workstreams in PHASE.md. `ROADMAP.md` and
`COMPETITIVE_GAPS.md` are reference, not a free-for-all queue. Within the
freeze, PHASE.md's ordered queue is the work queue — advance it
automatically until it is done.

---

## Founder-designed surfaces (unchanged)

Port verbatim from `downloaded_pages/*.html` and
`apps/customer/app/r/[slug]/paon-template.html` (ADR-052). Never rebuild
those in Tailwind or `@paon/ui`. If a surface genuinely cannot be ported
verbatim, that is a hard stop — ask. Do not invent.

---

## The founder's routine (lightweight)

You do not gate increments. When you sit down:

```
cd ~/Projects/PAON && nvm use && pnpm dev
```

Check `git log --oneline -10` and GitHub Actions / Vercel for what shipped
while you were away. If CI is red, tell the session to fix `main` first —
then continue the queue.

Paste when starting a fresh agent:

> Read docs/PHASE.md, docs/WORKING_AGREEMENT.md and docs/DESIGN_PORTS.md
> first. NON-NEGOTIABLE continuous mode: do NOT stop and check with me.
> Do NOT end a turn between finished batches. Build, self-verify, commit,
> push, advance the PHASE queue all the way until only hard blockers
> remain — chain the next item in the same turn. Skip Stripe/Resend/
> silhouette — note and continue. Scope freeze — three workstreams only.
> Founder-designed surfaces are verbatim ports (ADR-052). Hard stops
> only for out-of-freeze work, ADR conflicts you cannot ADR, or surfaces
> that cannot be ported verbatim.

---

## Switching between Claude Code and Codex

They share no memory. Continuity is the repository: PHASE.md, commit
messages, green CI. Orient with `PHASE.md` + `git log --oneline -10`.
Prefer finishing a commit before switching tools so the handoff is clean.
The next tool continues the queue immediately — it does not wait for a
founder briefing beyond those files.

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

A session that runs for a long stretch and ends only when the in-scope
PHASE queue is exhausted (or only hard blockers remain): many small
pushed commits, green CI, PHASE.md advanced, concrete verified URLs —
**without** the founder having approved each step.

A session that ships one increment and then waits for review is a
**failure**, even if the code is good.

A session that ends with thirty modified files and nothing committed is
still a failure.
