# PAON Agent Charter

This is the cross-agent entry point for Codex, Cursor, Claude Code, and any
other coding agent. `CLAUDE.md` is a Claude-specific pointer to this file, not
a second charter.

## Read in this order

For an ordinary implementation turn, read only:

1. `AGENTS.md`
2. `docs/PHASE.md`, including the active item's acceptance contract
3. the Resume Protocol at the top of
   `docs/PAON_INTELLIGENCE_PLATFORM.md`
4. the ADR named by the active item
5. the directly relevant code, tests, repository, and migration

Use `docs/README.md` to cross a topic boundary. Read the founder brief or the
full programme only for a product ambiguity, conflict, or audit. Code and
migrations are the truth for what exists; `docs/PHASE.md` is the only ordered
work queue.

## Continuous-build contract

Work continuously through the ordered queue:

> inspect → implement one coherent slice → test → repair → update
> authoritative state → commit → push → immediately take the next queue item

Never stop for routine review, confirmation, strategy reopening, or an
intermediate handoff. Do not end a turn merely because one slice shipped.
Stop only at a hard blocker defined in `docs/PHASE.md`, and skip a blocked
item when a later independent item remains buildable.

Every completed slice must leave authoritative state current, checks green,
and the commit pushed. `PROJECT_STATE.md` is a factual snapshot only; it is
never a queue or authority.

## Engineering invariants

- `strict` TypeScript; no `any`.
- Business concepts and pure rules live in `@paon/domain`.
- Supabase access lives behind `@paon/database` repositories.
- Every tenant-owned row carries `retailer_id` and is protected by RLS.
- Browser mutations are Server Actions. Route Handlers are for non-browser
  callers, webhooks, scheduled jobs, and the existing founder-HTML exception.
- Reuse shared components and rules. Do not duplicate them across apps.
- Founder-authored surfaces remain verbatim ports per ADR-052. Mount new data
  through narrow hooks; do not re-express the design.
- New schema changes are forward migrations with generated database types,
  repository coverage, and tenant-isolation verification.
- Preserve unrelated user or other-agent work. Inspect a dirty tree before
  editing; never reset, discard, or overwrite changes to make a slice easier.

## Definition of done

Run the checks CI runs:

```text
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Stop any live `pnpm dev` process before `pnpm build`. Commit intentionally and
push to `origin/main`. A slice is not complete while its finished work is
uncommitted, unpushed, or leaves the authoritative queue stale.

## Proving a slice in a browser

A slice is not done when the domain rule is correct. It is done when the rule
fires for a person using the product. These are the failure modes that keep
recurring; each one below was hit more than once, and every one produced a
green test suite over a broken product or a red suite over a working one.

**Build the layers in this order, and never skip one.** Migration → live
integration test against the real database → server action → UI → browser
proof. Connecting one repository to a UI has found a real defect nearly every
time; a domain unit test has never found one on its own, because a pure
function tested in isolation is correct exactly as often as it is unreachable.

- **A correct rule can be unreachable.** `recordApprovedMeasurements`
  hardcoded `capturedBy: "tailor_tape"`, so the self-scan review gate was
  dead code while its unit tests passed. Check that the caller actually
  reaches the branch you are relying on.
- **Client validation hides server rules.** `required`, `minLength` and
  `step` stop a submission before the action runs, so the server's message is
  not reachable through the UI. Assert `validity.valueMissing` /
  `tooShort` / `stepMismatch` for the client half, and reach the server half
  with input that passes the attribute but fails the rule (whitespace beats
  `required`). Never assert a server message the browser cannot produce.
- **An unchecked supabase-js write error is invisible.** `.update()` returns
  an error object, not a throw. A failing write and a silent no-op look
  identical. Check `error` on every write in a test.
- **Per-item forms need per-item ids.** A literal `id="reviewNote"` rendered
  once per queue row means every `<label for>` resolves to the first form.
  Scope ids by the row's id.
- **Choose fixture numbers that clear every threshold except the one under
  test.** 2-of-3 is a 33 % variance and trips the recount gate; 19-of-20 is
  5 % and reaches the adjustment path. Five separate tests claimed to test
  one rule while exercising another.
- **Poll the exact state you are about to assert.** Not a substring of a
  button label, not "a row exists". Add a `data-*` attribute carrying the
  machine-readable state and poll that.
- **Do not let a guard match its own explanation.** A scan for a forbidden
  word matched the copy explaining why the word is absent. Scope the
  assertion to the element under test.
- **Make identifiers unique per run.** A fixed message body or EPC collides
  with rows left by earlier runs of the same spec, and the assertion fails in
  strict mode on its own history.
- **A spec owns the rows it creates.** An unapproved risk flag or an
  unresolved `advisor_review` candidate is not inert: it sits in a queue,
  blocks a reorder, and fails an unrelated suite later while looking like
  that suite's bug. Clean up in `afterAll`.
- **Suspect the test before the product.** In this repo the product has been
  right far more often than the spec. Read the failure and the product copy
  before changing either.

## Environment facts

- Supabase is a **cloud** project; there is no Docker in the sandbox. Apply
  migrations with the helper scripts in `/agent/tools/`, which live **outside
  the repository** because they carry credentials and must never be committed.
- Turbo OOMs on a 2-CPU sandbox. Export
  `TURBO_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=3072`.
- Playwright's `webServer` runs `pnpm start`, a **production build**. Rebuild
  the app after any source change or the suite silently tests the old build.
- Integration and e2e suites talk to a database several regions away. Timeouts
  are set once in `playwright.config.ts` and `vitest.config.ts`; a per-test
  timeout is how a real failure ends up looking like a slow network.
- Live integration suites are gated on `PAON_INTEGRATION=1` and are skipped
  otherwise, so `pnpm test` alone does not exercise them.

## Evidence discipline (ADR-068)

`docs/evidence/runs/<item>.json` must carry a `passed` run whose `gitSha` is
reachable from `HEAD` by **evidence-only** changes. So:

1. commit the code,
2. run the proof (the artifact records the new SHA),
3. commit the evidence on its own.

Committing anything else alongside the evidence invalidates it —
`docs/NIGHT_LOG.md` is deliberately **not** on the allowlist, so log before
proving, never with. Changing product code makes every earlier proof stale;
re-run them rather than re-dating them. Never weaken the validator to
manufacture completion.

A checked `- [x]` box in `docs/PHASE.md` is a formal completion claim and
requires a tranche evidence file. `verified_local` in a status line is not
that claim: several items are browser-proven but deliberately left unchecked
because scope remains.
