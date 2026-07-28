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

- Never commit red. If the definition-of-done command fails, fix it or stop
  — do not log a failure and move on to the next item.
- One line per increment, appended as it lands, not batched at the end.
- Stop, don't guess, on anything gated on a founder decision (see the
  `PHASE.md` queue — the visual-pass design direction, Stripe/Resend
  credentials) or anything outside the three in-scope workstreams.
- Never touch `apps/retailer/app/(dashboard)/alterations/` or rewrite a
  founder-designed surface in Tailwind/`@paon/ui` (ADR-052).
- A run against this file is only valid for the authorization logged below
  it, for the scope stated — not a permanent standing instruction for every
  future session.

## Authorization

_(Empty until the founder explicitly re-issues the overnight instruction
with this file in place. Record the date and what was authorized here
before the first loop iteration runs.)_

## Log

_(One line per increment: commit hash, one-line summary, DoD result.)_
