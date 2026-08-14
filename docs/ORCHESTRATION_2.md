# PAON Orchestration 2.0 — post-ground-zero execution plan

Written 2026-08-15 against `main` = `origin/main` =
`698f3e207377824b23cde49350b52c6c68740374`.

This file defines **how** the work identified in `GROUND_TRUTH.md` section 10
is executed. It does not authorize any of it to start. Fleet is frozen and
stays frozen until section 11 of this file is satisfied.

`GROUND_TRUTH.md` records what is true. This file records what happens next,
in what order, by whom, and under which gates.

## 1. The governing discovery

The seven "remaining legacy branches" are **not seven branches**. They are
five distinct tips over one shared 28-commit base:

```
main (698f3e2) ── merge-base 6ca3611
                      │
                      └── 28 commits ── _integration-check (934b540)
                                        ≡ feature/conversation-intelligence
                                             ├── +10 → lane-d-virtual-wardrobe-studio
                                             ├── +2  → feature/voice-intelligence
                                             ├── +2  → lane-h-customer-security-boundary
                                             └── +4  → lane-e-core-roadmap
                                                        └── +2 → lane-f ≡ lane-g
```

48 distinct commits, not the 225 the per-branch counts imply. The conflict
problem is **one** shared base, not seven independent merges.

**Consequence for planning:** nothing in Orchestration 2.0 merges, rebases or
cherry-picks any legacy branch. Every salvage is re-created as a **small
forward patch against current `main`**, authored fresh, with its own new
migration prefix and its own new proof. The legacy branches are read-only
sources of intent, never merge sources.

## 2. Ordered tranches and dependency order

Strictly sequential. A tranche starts only when the previous one is merged to
`origin/main` and its gates are green.

| #      | Tranche                                                     | Depends on | Route                                | Blocking?                   |
| ------ | ----------------------------------------------------------- | ---------- | ------------------------------------ | --------------------------- |
| **3**  | Repair the live `20260814000000` prefix collision on `main` | —          | FRONTIER                             | **Blocks everything below** |
| **4**  | Cross-tenant composite-FK integrity (3 fixes + pgTAP)       | 3          | FRONTIER + security gate             | Blocks 9                    |
| **5**  | Founder-authority document salvage                          | 3          | LIGHT                                | no                          |
| **6**  | ADR-074 customer relationship access boundary               | 3, 4       | FRONTIER + dedicated security review | no                          |
| **7**  | FT-14 disposition (weekly plan vs monthly grid)             | —          | FOUNDER DECISION                     | no                          |
| **8**  | `lane-g` worktree salvage triage                            | 3          | IMPLEMENTER                          | no                          |
| **9**  | Browser-proof refresh, all 16 evidence files                | 3, 4, 6    | IMPLEMENTER                          | Gate for unfreeze           |
| **10** | Branch and worktree retirement                              | 3–9        | FOUNDER DECISION                     | no                          |

Tranche 3 is first because **`supabase db reset` is currently broken on
`main`**: four migrations share the prefix `20260814000000`. Until that is
repaired, no local database can be built, so no pgTAP runs, no browser proof
runs, and no evidence file can be regenerated. Every other tranche depends on
it.

## 3. The single frontier writer

One writer at a time, in `/private/tmp/paon-main-tranche`, on `main`.

- The frontier is the **only** session permitted to commit to `main`.
- No other agent may write to `/private/tmp/paon-main-tranche` at all.
- Before any tranche the frontier verifies, and refuses to proceed unless all
  four hold:

```bash
cd /private/tmp/paon-main-tranche
git status --short --branch          # must be clean, tracking origin/main
git rev-parse HEAD                   # must equal origin/main
git rev-parse origin/main
scripts/fleet/paon-fleet status      # claimed: 0
```

- Handoff between frontier sessions happens only through this file and
  `GROUND_TRUTH.md`. A new frontier session trusts neither prior conversation
  nor prior claims; it re-verifies from Git.

## 4. Disjoint path leases

Each tranche owns an exclusive path set. Two tranches never hold overlapping
leases, and no tranche is started while another holds a lease it needs.

| Tranche | Owned paths                                                                                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3       | `supabase/migrations/**` (rename only)                                                                                                                                                                                                                               |
| 4       | `supabase/migrations/**`, `supabase/tests/**`                                                                                                                                                                                                                        |
| 5       | `docs/**` except `docs/PHASE.md`                                                                                                                                                                                                                                     |
| 6       | `supabase/migrations/**`, `supabase/tests/**`, `packages/database/src/repositories/{clienteling,customer,audit,advisor-capture}-repository.ts`, `packages/domain/src/customer/**`, `packages/domain/src/engagement/**`, `apps/retailer/app/(dashboard)/customers/**` |
| 8       | `packages/domain/src/corporate/**`, `supabase/tests/**`                                                                                                                                                                                                              |
| 9       | `docs/evidence/**`, `docs/PHASE.md`                                                                                                                                                                                                                                  |

**Permanently out of lease — never modified by Orchestration 2.0:**
`AGENTS.md`, `.claude/settings.json`, `.claude/hooks/**`, and anything under
`/Users/nguyen/Projects/PAON`.

## 5. Routing — LIGHT, IMPLEMENTER, FRONTIER

| Route           | Model                           | Owns                                                                                                  | Never does                                             |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **LIGHT**       | Haiku                           | read-only recon, path inventory, call-site enumeration, doc transcription, evidence-file field checks | decide anything; write outside `docs/**`               |
| **IMPLEMENTER** | Sonnet, `isolation: "worktree"` | settled mechanical work — contracts and acceptance already fixed by the frontier                      | architecture, RLS, tenancy, security, migration design |
| **FRONTIER**    | Opus, single writer             | schema, RLS, tenancy, auth, money, migration design, all dispositions, all merges to `main`           | delegate any security judgment                         |

Rules that bind every route:

- Security, RLS, tenancy and money decisions are **FRONTIER only** and are
  never delegated, per `AGENTS.md` rule 6.
- A subagent that cannot prove a claim reports
  `unknown — exact evidence missing`. It never guesses.
- Every subagent conclusion is independently re-verified by the frontier
  before it enters `GROUND_TRUTH.md`. In this audit, three subagent claims
  were wrong on first report and were corrected only by re-verification.

## 6. Verification commands

Run in `/private/tmp/paon-main-tranche` with `TURBO_FORCE=1` — the turbo cache
is shared across worktrees and an unforced run replays another checkout's
logs.

```bash
git diff --check
pnpm format:check
TURBO_FORCE=1 pnpm lint
TURBO_FORCE=1 pnpm typecheck
TURBO_FORCE=1 pnpm build
TURBO_FORCE=1 pnpm --filter @paon/domain test
pnpm --filter @paon/domain validate:completion
```

Database and proof gates, valid only after tranche 3:

```bash
supabase db reset --local          # must succeed; today it does not
supabase test db                   # pgTAP
pnpm --filter <app> exec playwright test <spec>
```

A tranche is done only when its acceptance command was **run and seen to
pass** in this checkout. A cached, inherited or asserted pass is not a pass.

## 7. Independent integration review

Every tranche gets a fresh reviewer that did not author the change:

1. Author completes the slice and runs section 6.
2. A **fresh** subagent reviews the diff with no authoring context — Haiku for
   docs-only, Sonnet for anything else.
3. Tranches 4 and 6 additionally require the `security-reviewer` agent.
4. Findings are fixed and the loop repeats. Only when both deterministic
   checks and the independent review are clean does the frontier commit.
5. The reviewer must state explicitly what the change **fails** to prove, not
   only what it proves.

## 8. Security and RLS gates

A change passes the security gate only when every item is affirmatively
answered with evidence:

- Does it add or alter a table, policy, `SECURITY DEFINER` function, grant,
  Server Action, Route Handler, or payment path?
- Is every `SECURITY DEFINER` function `set search_path` pinned, and does it
  derive tenant identity from the session, never from client input?
- Is there a **negative** pgTAP case: a real cross-tenant attempt that must
  fail, not merely a positive-path assertion?
- Does any column default or backfill move existing rows to a **more exposed**
  state? Backfills must preserve or narrow exposure, never widen it.
- Does the change revoke anything current `main` code still calls? Every
  affected call site must be enumerated and updated or consciously accepted.
- Is the audit trail append-only **at the grant layer**, not merely under RLS?
  `service_role` bypasses RLS entirely.

Tranche 6 additionally may not merge until the two findings recorded in
`GROUND_TRUTH.md` §10.6 are closed, and until a behavioural tenant proof
exists that asserts on relationship-intelligence content — loyalty account,
interest projection, customer facts, AI history — for an unassigned associate,
not merely on note text and phone masking.

## 9. Migration-prefix allocation

The `YYYYMMDDHHMMSS` convention is enforced. Two rules, both learned from
real failures in this repository:

1. **A prefix is claimed the moment it exists on `main`.** `20260806110000` is
   held on `main` by `add_style_portrait_consent.sql`. Any future
   `add_service_weekly_plans.sql` must be renamed forward; it may never
   reclaim that prefix.
2. **Never reuse a timestamp already on `main`.** Four migrations currently
   share `20260814000000`, which is exactly why `supabase db reset` fails.

Reserved forward block for Orchestration 2.0, one prefix per migration, never
shared:

| Tranche | Reserved prefixes                                    |
| ------- | ---------------------------------------------------- |
| 3       | renames within `20260814000000`–`20260814000003`     |
| 4       | `20260815000000`, `20260815000010`, `20260815000020` |
| 6       | `20260815010000`                                     |
| 8       | `20260815020000`                                     |

Before adding any migration:

```bash
git ls-tree main supabase/migrations/ --name-only \
  | sed 's|.*/||' | cut -d_ -f1 | sort | uniq -d   # must print nothing
```

## 10. Final browser-proof refresh

Deferred to tranche 9 on purpose.

`validate:completion` does **not** test ancestry. It calls `isCurrentGitSha`
(`packages/domain/src/programme/completion-evidence.ts:309-315`) and demands
the run's `gitSha` equal the **current** checkout SHA. All nine SHAs behind the
16 evidence files are already ancestors of `main`. They fail only because they
are not `HEAD`.

Therefore **every commit to `main` invalidates all 16 evidence files again.**
Regenerating proofs before integration stabilizes is wasted work by
construction. Tranche 9 runs once, last, after tranches 3–6 have landed, and
regenerates artifacts by re-running the specs so their `afterAll` hooks write
them. Evidence is never hand-edited or re-dated — ADR-068.

Two defects to fix in tranche 9, both already diagnosed:

- `docs/evidence/runs/18.5.json` has **no producer**: every 18.5 spec declares
  a suffixed `PHASE_ITEM_ID`, so the bare id the validator reads can never be
  regenerated. Fix is a one-line `PHASE_ITEM_ID` change in
  `apps/customer/e2e/**`.
- `validate-phase-completion.ts:97-102` emits a hardcoded "status X is not a
  verified completion claim" for **any** failure, masking the real `issues[]`.
  It should report the actual issues.

## 11. Conditions for unfreezing Fleet

Fleet stays frozen until **all** hold:

1. Tranche 3 merged; `supabase db reset --local` succeeds on `main`.
2. Tranche 4 merged; the three cross-tenant composite FKs exist on `main` with
   passing negative pgTAP cases.
3. Tranche 6 either merged under a completed dedicated security review, or
   explicitly deferred by the founder and recorded here.
4. Tranche 9 complete; `pnpm --filter @paon/domain validate:completion`
   passes, or every remaining failure is individually recorded and accepted.
5. The queue seeder is fixed to exclude founder-parked scope. It currently
   auto-queues Stage 13, Stage 15, 16.2, 16.3, 16.5, 18.9 and 18.10, all
   founder-parked or deleted — 16 of 41 tasks are blocked largely for this
   reason.
6. The founder explicitly lifts the freeze. No agent may lift it.

Unfreezing is `scripts/fleet/paon-fleet unfreeze`. It is a **founder action**.

## 12. The exact first execution tranche

**Tranche 3 — repair the `20260814000000` duplicate migration prefix.**

Scope, and nothing else:

```
supabase/migrations/20260814000000_add_ft04_alteration_grid_snapshots.sql
supabase/migrations/20260814000000_add_gift_invitation_expiry_revoke_refund.sql
supabase/migrations/20260814000000_add_retailer_branch_location_details.sql
supabase/migrations/20260814000000_add_store_feedback_signals.sql
```

Four migrations share one prefix. `supabase db reset --local` fails with
`duplicate migration version 20260814000000`, which is why three evidence
tranches (17.2, 17.9, 17.14) cannot be regenerated and why
`evidence-stale-sha` is blocked.

Procedure:

1. Verify the collision:
   `git ls-tree main supabase/migrations/ --name-only | sed 's|.*/||' | cut -d_ -f1 | sort | uniq -d`
2. Determine true authorship order with `git log --diff-filter=A --format=%ci`
   on each of the four files. **Preserve that order** — renaming must not
   reorder DDL that depends on earlier DDL. Note
   `20260814000000_add_store_feedback_signals.sql:6` creates
   `customers_id_retailer_id_key`, which tranche 4 depends on; it must keep a
   prefix earlier than tranche 4's migrations.
3. `git mv` three of the four forward to `20260814000001`, `20260814000002`,
   `20260814000003`, keeping the earliest-authored file on `20260814000000`.
   Content is **not** edited — rename only.
4. `supabase db reset --local` must now succeed.
5. `supabase test db` must pass.
6. Section 6 gates, then independent review, then commit.

Acceptance: `supabase db reset --local` succeeds on a clean `main` checkout,
and `uniq -d` over migration prefixes prints nothing.

Why this and not the security fixes first: the composite-FK work in tranche 4
cannot be proven without a working local database, and an unprovable security
fix is not a security fix.

## 13. What Orchestration 2.0 explicitly refuses

- No merge, rebase or cherry-pick of any legacy branch. Forward patches only.
- No branch or worktree deletion until the founder confirms tranche 10.
- No modification of `AGENTS.md`, Claude settings or hooks.
- No modification of `/Users/nguyen/Projects/PAON`, which stays read-only with
  its unfinished merge intact.
- No evidence file hand-edited or re-dated. Proofs are re-run, never rewritten.
- No new feature development. Orchestration 2.0 is reconciliation only.
