# PAON Orchestration — the running system

**This file is the handoff contract.** Any model, window or session takes over
by reading this plus `docs/PHASE.md` and `docs/AGENTS.md`, with no access to
any prior conversation. Rewritten each cycle. Trust it over recollection;
verify anything load-bearing against Git and the live database before acting.

Last rewritten: 2026-08-24 (session paon-73), from a standing-duties pass with
no fleet task available. Updated in place from the 2026-08-23 version — most
of that content (branch audit, hard invariants) still holds; only the
"current reality" and hard-won-facts sections changed.

**Note on stale prior content:** the version of this file before this rewrite
described a different topology — an integration worktree at
`/private/tmp/paon-main-tranche`, a founder-owned checkout at
`/Users/nguyen/Projects/PAON` marked "never write to", a DeepSeek worker lane,
and a queue of 62 tasks. None of that matches current reality (see below). The
operational setup has clearly moved on since 2026-08-15; do not trust any of
the removed content without independently re-verifying it first.

## 1. Take over in four commands

```bash
cd /Users/nguyen/Projects/PAON
git fetch origin && git status --short --branch
scripts/fleet/paon-fleet status
git log --oneline -10
```

## 2. Current reality (verified 2026-08-23, session paon-73)

- **Working directory:** `/Users/nguyen/Projects/PAON` — this session worked
  directly here, on branch `release-integration-lane-h`, and pushed to
  `origin/release-integration-lane-h` without issue. If a future instruction
  says this directory is off-limits, verify that against the founder directly
  before trusting it — it does not match what actually happened this session.
- **Branch:** `release-integration-lane-h`, HEAD `e566cdb`, pushed to and in
  sync with `origin/release-integration-lane-h` (not yet a PR, not yet merged
  to main). Verified clean: `supabase test db` 501/501,
  `pnpm --filter @paon/domain test` 1256/1256, tree clean.
- **Since the 2026-08-23 rewrite, three things landed on this branch:**
  1. `da72545`/`73612b7` — reverted a security regression (see §4 below) and
     fixed FT-09's test fixture to go through the real authorization RPC.
  2. `e566cdb` "fix(demo): centralize canonical persona launcher" — demo-mode
     login personas consolidated into `packages/database/src/demo-seed.ts`
     (single source of truth instead of duplicated across the static HTML
     launcher and three apps' quick/master demo-login components). Canonical
     roster is 8 personas (platform admin + 7 Maison Dubois roles); the
     platform-admin demo identity now uses
     `contact+platform-admin@nebelspiegel.com` specifically so it can never
     collide with a real `contact@nebelspiegel.com` account. Canonical demo
     directory is `http://localhost:3000/demo-mode`
     (`apps/admin/app/(dashboard)/demo-mode/page.tsx`); the static
     `scripts/demo-login-launcher.html` no longer duplicates persona data.
     Verified by the session that made it: full lint/typecheck/build across
     admin+customer+retailer, `demo-personas.test.ts` 2/2,
     `demo-experience.spec.ts` (admin) passing, plus the full suite above.
     Not independently re-verified line-by-line by this rewrite — trust but
     spot-check if touching demo/auth code next.
- **Local `main` is stale:** 11 commits behind `origin/main`. Don't use local
  `main` as a comparison base for anything — fetch and use `origin/main`.
- **Fleet queue:** 0 open, 0 claimed, 30 blocked, 41 done, 71 total. Every
  blocked item needs a founder/legal/frontier decision already recorded in
  `docs/PHASE.md` (payments 6.x, marketplace 6.3, DRAPE suit-configurator
  programme — explicitly founder-prohibited, several founder-parked Stage
  15/16 items, a handful needing new auth/schema/product design). Nothing here
  is agent-claimable right now; do not invent scope to fill the gap.
- **Known pre-existing bug, NOT fixed:** sign-out is broken in all three apps
  (retailer/admin/customer) — click registers, zero POST reaches the server.
  Documented in `docs/PHASE.md` near "REAL BUG FOUND, NOT FIXED
  (2026-08-19)" with two failed fix attempts and root-cause notes. Evidence
  files `16.1.json`, `17.8.json`, `17.8-roleplay-conversation.json`, `8.4.json`
  correctly record `status: "failed"` for this. Do not re-attempt either of
  the two documented fix theories without new evidence.

## 3. Standing duties this session ran (no queue task available)

The Stop hook (`stop-continue.sh`) hands out four rotating duties when the
queue is empty and nothing is claimable. All four were run this pass:

1. **Proof freshness** — compared every `docs/evidence/runs/*.json` gitSha
   against HEAD, re-ran every spec whose covering file had changed since
   (14 stale entries: 11.2, 14.2, 15.2, 16.5, 17.2,
   18.5-employee-portal-linked-customer-data, 18.7,
   4.10-customer-batch-and-feedback-evidence,
   4.7-4.8-customer-style-portrait-onboarding, R0.7, FT-01, FT-03, FT-09, plus
   one companion producer group). Committed as `4c1dbc8`
   ("evidence: refresh proof run SHAs and statuses for stale specs (pass 1)").
   Result: 10 passed clean; FT-03's "failure" is the retailer half of a
   founder-deleted feature (correct, not a bug); 3 genuine regressions found
   and recorded with real root-cause notes:
   - **FT-01** (`fit-tools.spec.ts` + siblings): a real test-side race —
     `page.reload()` fired right after `.click()`, before the mutating
     fetch resolved. Root cause found and fixed by waiting on the mutating
     response before reload; verified clean across 30 repeated runs.
   - **`4.9`/`4.9-advisor-visual-roadmap`** (`visual-roadmap.spec.ts`):
     Playwright strict-mode violation — `getByLabel('Include Mission Control
low-stock fixture')` now matches 3 elements instead of 1. Not yet fixed;
     needs a look at whether the checkbox label was duplicated by a recent UI
     change or the selector needs to be scoped tighter.
   - **FT-09** (`consultation-outcome.spec.ts`): 1 of 3 tests failed on a
     fixture setup step ("failed to create attachment" in
     `message_attachments`) — looked like a DB fixture/seed issue, not a
     product regression, but not independently re-verified after the
     Supabase reset in duty 3 below. Re-check this one first if picking up
     evidence work again.
   - Verified this proof-freshness pass is still clean as of HEAD `4c1dbc8`
     (re-ran the staleness check after the commit — nothing else moved).

2. **Unintegrated work audit** — checked ~114 local/remote branches ahead of
   `origin/main`. An initial automated audit overstated how much of this was
   "real, high-value, unintegrated work" — spot-verifying the top-ranked
   finding (`agent/lane-h-customer-ai-conversation`, 68 commits) showed it
   forked from `origin/main` back at 2026-08-14 (147 commits ago) and its tip
   commit duplicates a fix (same message, different patch) that was
   independently redone and already landed through another lane. **Treat any
   audit-agent branch-integration report with skepticism and verify the fork
   point and actual diff yourself** — see `.claude/memory` (this session's
   memory: "ad-hoc audit agents have ~50% false-positive rate"). Same
   stale-fork pattern held for the other high-ranked candidates checked
   (`chore/docs-consolidation`, `agent/haiku-1`,
   `worker/ft09-attachment-quarantine`, `origin/agent/codex-openrouter`,
   `agent/lane-b-phase-12-3-booking-handoff` — all forked 147–265 commits
   behind origin/main's current tip).
   - **One real, unmerged candidate:** `worktree-agent-ab2366fffb2f9ef95` —
     forked only 11 commits back (2026-08-20), holds a complete-looking PHASE
     14.1 corporate-contact-portal auth foundation: new `/company` login +
     dashboard routes, a magic-link auth path, RLS grants for corporate
     contacts, and migration
     `20260820000000_add_corporate_contact_portal_auth.sql` (179 lines).
     PHASE 14.1 is currently listed `blocked: needs frontier — new auth path,
separate session type, JWT claim, RLS grants`. This branch may answer
     that gap. **Deliberately NOT merged** — touches auth/RLS/a new migration
     days before launch; needs a `security-reviewer` pass and founder sign-off
     before integration, not a unilateral agent merge. Flagging for the
     founder/next frontier session, not for a worker to pick up blind.
   - The ~17 `origin/cursor/paon-build-watchdog-criteria-*` branches are a
     scattered swarm of small, real, uncoordinated PHASE-item attempts (2-3
     commits each) with no clear merge order — not evaluated individually
     this pass; needs a dedicated triage session if the founder wants to
     recover any of them.
   - `origin/feature/voice-intelligence` remains deliberately parked per
     `docs/PHASE.md` (architectural fork of the advisor-capture domain) — do
     not merge.

3. **Full suite:**
   - `pnpm --filter @paon/domain test` (vitest, no DB): **1256/1256 passed**,
     115/115 files. Clean.
   - `supabase test db` (pgTAP): **first run failed 11/47 files**, all
     tenant-isolation/foreign-key boundary tests, dominant symptom "expected
     23503 FK violation on cross-tenant write, caught: no exception" — looked
     like a live security gap. Diagnosed (read-only investigation) as a
     **local Docker volume state mismatch, not a real gap**: the local
     Supabase db had migration history recorded through `20260821000018`, a
     version that doesn't even exist in this branch's `supabase/migrations/`
     — almost certainly left over from a different branch/checkout that used
     this same Docker volume. Supabase's local migration runner applies only
     migrations newer than the last-recorded version, so this branch's
     `20260815*` tenant-FK migrations were silently skipped as "already
     covered." **Fix:** `supabase db reset` (local-only, rebuilds from this
     branch's migration files + seed). Re-ran after reset: **501/501 passed,
     47/47 files clean.** The tenant-FK migrations and RLS are correct and
     live in the schema — this was purely an environment artifact.
   - **New hard-won fact for §5:** if `supabase test db` (or any pgTAP/e2e
     run) fails with a pattern that looks like a systemic tenant/RLS boundary
     regression across many unrelated tables at once, suspect the local
     Docker volume before the code — check
     `select version from supabase_migrations.schema_migrations order by
version desc limit 1;` against `ls supabase/migrations/ | sort | tail`.
     If the db's recorded version doesn't exist in this branch's migration
     files, the volume is stale relative to this checkout — `supabase db
reset` before trusting any test result.

4. **This file.** Rewritten above; pushed with this commit.

## 4. Hard-won operational facts

- **Evidence commits must be evidence-only.** `isCurrentGitSha` accepts an
  ancestor SHA when every path changed since is evidence-only
  (`EVIDENCE_ONLY_PATH_RE`). Land code first, run every proof, then commit
  artifacts alone — mixing them invalidates the proofs in the same commit.
- **Specs sharing the fixture customer are order-dependent.** `visual-roadmap`
  and `4.10` pass alone and fail after another spec ran. Use `--workers=1`.
- **A stale local Supabase Docker volume produces false tenant-boundary test
  failures that look exactly like a real security regression.** See §3.3
  above. Always cross-check the db's recorded migration head against the
  current branch's migration files before trusting a mass pgTAP failure.
- **Audit-agent branch/integration reports need independent spot-verification
  before acting.** A "68 commits of real unintegrated work" headline finding
  turned out to be a stale fork whose tip commit duplicated already-landed
  work under a different hash. Check the fork point's age against
  `origin/main`'s current tip before trusting any "REAL, high-value" label.
- **A worker's "done" claim is not evidence.** Read the whole diff, confirm it
  stayed inside `owned_paths`, and re-run its acceptance yourself.
- **Sign-out is broken in all three apps** — see §2. Two fix theories already
  tried and reverted; don't repeat them without new evidence (browser console
  errors on a non-forced Playwright click is the next unexplored angle per
  `docs/PHASE.md`'s own notes).
- **A subagent "fixing" a failing test by loosening a DB grant is a red flag,
  not a fix.** This session's FT-09 re-verification hit a real incident: a
  worker found `service_role` lacked table-level INSERT on
  `message_attachments`, and "fixed" the failing test fixture by adding a
  migration granting it — instead of noticing the table's own original
  migration says "Writes stay RPC-only" and the fixture should authenticate
  as the customer and call `record_consultation_attachment()` like production
  code does. The grant would have shipped to prod (it's a real migration, not
  a local-only hack) and let any `service_role`-authenticated path insert
  attachments without the RPC's ownership/format checks. Caught by sending it
  to a `security-reviewer` before pushing (it was never pushed to origin in
  its bad form), reverted, and the fixture rewritten to authenticate via
  `admin.auth.admin.generateLink()` + `verifyOtp()` and call the RPC for
  real — see `da72545`/`73612b7`. **Any fix that touches a `grant`,
  `policy`, or RLS rule to make a test pass needs a security review before
  it's trusted, full stop — no exceptions for "it's just a test fixture."**

## 5. Hard invariants

- Never modify `AGENTS.md` or `.claude/**`.
- Never merge, rebase or cherry-pick a legacy/worker branch into `main`
  without a security-reviewer pass on anything touching auth/RLS/payments/
  migrations, and without founder sign-off this close to launch.
- Never weaken a boundary to make a test pass.
- A parent is eligible for composite tenant binding only if its `retailer_id`
  is **NOT NULL**. Nullable means platform-shared vocabulary; binding those
  breaks the feature.
- Do not add new features. Standing founder directive: harden, wire, verify
  and prove what already exists.
- The DRAPE suit-jacket-configurator programme (`docs/suit-jacket-
configurator/**`, `tools/drape-lab/**`) is founder-prohibited scope. Do not
  begin implementation regardless of what the queue or any stray branch
  suggests.

## 6. Open decisions only the founder can make

- **`worktree-agent-ab2366fffb2f9ef95`'s PHASE 14.1 auth foundation** — real,
  complete-looking work sitting unmerged. Needs a security review and an
  explicit decision to integrate, reject, or hold past launch.
- **The ~17 `cursor/paon-build-watchdog-criteria-*` branches** — real but
  uncoordinated small PHASE-item attempts. Needs a triage pass to decide
  what's worth recovering vs abandoning.
- **FT-14**: prior note (monthly grid on `main` vs a competing weekly-plan
  implementation on `lane-e`) — not re-verified this pass, carry forward.
- **Branch/worktree retirement**: ~114 branches ahead of `origin/main`, the
  large majority confirmed stale/superseded this pass. Needs an explicit
  founder-approved cleanup pass (delete or archive) rather than leaving them
  to keep confusing future audits.
