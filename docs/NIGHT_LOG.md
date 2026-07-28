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
- Queue items 1–2 (Stripe, Resend) skipped — both require founder-provided
  credentials, already documented as blocked in `PHASE.md`. No commit.
- `9f5e197` — queue item 3: expanded Maison Dubois's client book from 3 to
  12 customers (all five lifecycle stages, 6 with portal access instead of
  2). DoD green. Landed in the founder's own concurrent commit alongside
  their live `PHASE.md` edit (queue item 5 unblocked) rather than a
  separate one — same working tree, no conflict.
- Re-ran `scripts/seed-production.sh` against the live Supabase project so
  the expanded client book is actually live, not just in source. Script
  output confirmed all 6 new/existing portal customers created
  (Isabelle, Marc, Julien, Camille, Nathalie, Thomas).
- Queue item 4: mobile-viewport Playwright pass (read-only — no test
  appointments/orders created against production) against all three live
  apps. Found one real bug: `fc28152` fixed a CORS-blocked font fetch on
  the storefront (a leftover duplicate `@font-face` in `paon-template.html`
  pointed at the founder's own domain instead of this app's font proxy).
  DoD green; re-checked against production once `fc28152` deployed — no
  console errors, `body` computed font-family is `OptimaKlein, serif`.
- Queue item 5 (demo-path visual pass), screen 1 of 10 (Cart): `372dbb9`.
  Measured `.drf-btn` (6px), `#paon-basket-rect`/`#paon-appt-name` (8px) in
  `paon-template.html` directly rather than guessing; moved Button/Input
  from `--radius-sm` (4px) to `--radius-md` (8px), Card from `--radius-lg`
  (12px) to the same. Added a `paon-reveal` utility (new
  `--ease-out-expo`/`--duration-reveal` tokens + keyframe) for the
  founder's own card-entrance animation, applied to the cart's two cards
  with a 120ms stagger, `prefers-reduced-motion`-safe. DoD green, pushed.
  Vercel's deploy queue is backed up (many pushes tonight from both sides)
  — production screenshot verification pending, will confirm once it
  clears rather than block the loop on it.
