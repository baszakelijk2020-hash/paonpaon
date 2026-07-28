# Night Log

Append-only log for one specific thing: an **explicitly authorized,
unattended overnight run**, where the founder has deliberately traded the
normal one-increment-then-review cycle in
[WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md) for a bounded, logged loop
instead. That trade is the exception, not the default — read
`WORKING_AGREEMENT.md` first. It exists because a past session was told to
"continue autonomously and do not stop for routine implementation decisions
or progress summaries" with nothing logged, and it produced 21 unpushed
commits and 130 uncommitted files that took a full session to recover from.
This file is how the same trade is made safely: every increment still runs
the full [definition of done](../CLAUDE.md#definition-of-done), still
commits and pushes individually, and still leaves a one-line trail a human
can audit in the morning without reading the whole session.

## Rules for any loop that writes to this file

- Never commit red. If the definition-of-done command fails, try to fix it;
  if the same increment still fails a second time, `git checkout -- .` to
  discard it and move to the next queue item rather than force a commit or
  get stuck.
- One line per increment, appended as it lands, not batched at the end.
- Stop, don't guess, on anything gated on a founder decision (see the
  `PHASE.md` queue — the visual-pass design direction, Stripe/Resend
  credentials), anything needing a secret or a dashboard click, anything
  needing a new domain entity or migration, anything contradicting an ADR,
  or anything outside the three in-scope workstreams / the queue.
- Never touch `apps/retailer/app/(dashboard)/alterations/`, rewrite a
  founder-designed surface in Tailwind/`@paon/ui`, or reintroduce Inter or a
  grey palette (ADR-052).
- Don't redeploy or touch Vercel/Supabase config — all three apps are
  already live and verified — unless something this loop changed broke it.
- A run against this file is only valid for the authorization logged below
  it, for the scope stated — not a permanent standing instruction for every
  future session.

## Authorization

**2026-07-27, founder** (recorded 2026-07-28): run the continuous loop
against the queue in `PHASE.md` until exhausted, then the surfaces marked
"Wrong" in `DESIGN_PORTS.md` (silhouette carousel, then swipe deck), ported
verbatim per ADR-052. Per increment: state the one-line change, make one
reviewable change, run the full definition-of-done command, commit and push
if green, append one line here, then start the next. Stop-and-log instead
of proceeding on any of the conditions above.

## Log

- Authorization recorded; loop starting from the top of the `PHASE.md`
  queue (Stripe live — expected immediate stop, no credentials).
