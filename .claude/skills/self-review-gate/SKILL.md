---
name: self-review-gate
description: Mandatory verification gate for every PAON implementation slice before commit/push — run deterministic checks, then get a fresh independent subagent review (Haiku for normal changes, Sonnet for auth/RLS/security/migrations/payments/high-risk architecture), fix and reloop on findings, only commit/push once both pass. Use after implementing any bounded slice (worker task, delegated fix, direct edit) and before running `git commit`/`git push` on it.
---

# PAON self-review gate

Non-authoritative: this is a Claude-side convenience layer, the same status
as `feature-slice-delegation`. It does not replace AGENTS.md's delegation
rules or chapter 20's worker-verification checklist — it adds an
independent-reviewer step on top of both, for every implementation slice
this session produces, not just delegated worker output.

Never satisfy this gate by asking the user, ChatGPT, or any tool outside
Claude Code's own Agent tool to review the diff. The whole point is that
routine review does not require a human or an external service — see step 3.

## When to run this

After implementing a bounded slice (a worktree/branch's worth of changes)
and before committing it. Every task this session produces that ends in a
`git commit` on an implementation branch goes through this gate first,
whether the code was written directly or by a delegated worker.

## Step 1 — Deterministic checks (must pass before review starts)

In the actual worktree the slice lives in:

1. `pnpm install --frozen-lockfile` if dependencies could have moved.
2. `pnpm typecheck` (or the scoped `--filter` equivalent for the touched
   packages, plus a full run at least once before commit).
3. `pnpm lint` (same scoping rule).
4. The relevant test files/suites for what changed — not just the new
   tests, the existing suite for any touched repository/domain module too,
   run uncached (`vitest run --no-cache` or equivalent) so a stale cache
   can't mask a real failure.
5. `pnpm build --filter=<affected app(s)>` when the slice touches app code
   (server actions, pages, routes) rather than only a library package.

If Docker/local Supabase is unavailable and the slice includes a new
migration, pgTAP test, or Playwright spec, say so explicitly rather than
claiming it passed — this gate does not require fabricating a live-DB
result, it requires being honest that one is outstanding.

If anything fails, fix it and rerun this whole step until it is clean. Do
not proceed to step 2 with known-failing checks.

## Step 2 — Classify risk to choose the reviewer's model tier

Read your own diff (`git diff` against the slice's base SHA) and check
whether it touches any of:

- authentication/authorization logic (session/role checks, `requireSession`,
  `requireModuleSession`, `requireRetailerRole`, or equivalents)
- Row Level Security policies, `security definer` functions, or anything
  granting/revoking `execute`/table privileges
- a new or altered migration under `supabase/migrations/`
- payments, money movement, order/inventory state, or anything the
  Stage 6 payment gate would care about
- a genuinely novel architecture decision (a new cross-cutting pattern, not
  a mechanical extension of an existing one)

**Any one of those present → high-risk.** Spawn the reviewer with a Sonnet
model tier (or the `security-reviewer` agent specifically when RLS/tenancy
is the concern — it is scoped for exactly this).

**None present → normal.** Spawn the reviewer with the Haiku model tier
(cheapest capable model that can read a diff and reason about correctness;
use `general-purpose` or `paon-explorer`-style agent framing with
`model: "haiku"` in the `Agent` call).

## Step 3 — Spawn a FRESH independent reviewer subagent

Use the `Agent` tool (not a second opinion from yourself, not a tool call
that reuses an existing agent/conversation with prior context). The
reviewer must not have seen your reasoning about _why_ the change is
correct — only the diff and the task it was meant to accomplish, so it can
find problems your own framing might hide from you.

Prompt shape:

- What the slice was supposed to do (one or two sentences, no editorializing
  about why it's correct).
- The base SHA and the diff itself (or exact file paths to read plus
  `git diff <base>..HEAD`), not a summary of the diff.
- Explicit ask: find correctness bugs, tenancy/authorization gaps, fabricated
  or optimistic-only results (UI claiming success without a real backend
  round trip), and anything that contradicts the stated acceptance criteria.
  Refuse to rubber-stamp — default to skeptical.
- For high-risk slices, also ask explicitly: does this weaken RLS, trust
  client-supplied tenant/ownership data, or create a privilege the caller
  shouldn't have?

Prefer the `ReportFindings`-style output (a list of findings, empty if
none) so the result is easy to act on mechanically rather than free text
you have to re-interpret.

## Step 4 — Fix, reverify, and get a NEW reviewer

If the reviewer reports any findings:

1. Fix them in the worktree.
2. Rerun Step 1 in full (not just the parts that touched the fix — a fix
   can regress something else).
3. Spawn **another fresh** reviewer subagent (a new `Agent` call, not the
   same one continued) at the same model tier as Step 2. Do not treat a
   fix as self-certifying just because it addresses the specific finding —
   an independent pass needs to actually re-run against the new diff.

Repeat until a review pass reports zero findings. There is no cap on
iterations here — a slice that keeps finding real problems keeps looping
until it doesn't, the same way `pnpm lint` would.

## Step 5 — Commit and push only once both gates are clean

Only after Step 1's deterministic checks AND a Step 3/4 review pass with
zero findings: `git commit` the slice, then push its own worker branch.
Do not commit "to save progress" mid-loop — an in-progress, still-failing
slice belongs in the working tree until it clears both gates.

## What this does not replace

- AGENTS.md chapter 20's independent verification of a _delegated worker's_
  output (expected files changed, no unrelated scope, SHA resolves) still
  applies before you even reach Step 1 for worker-produced slices.
- This gate is about the content of the diff being correct and safe, not
  about integration into the authoritative branch — integrating a
  self-reviewed slice into another branch is a separate decision with its
  own rules (verify base compatibility, no PHASE.md changes without
  justification, etc.), covered elsewhere.
