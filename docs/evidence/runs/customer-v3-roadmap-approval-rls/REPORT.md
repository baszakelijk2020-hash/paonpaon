# C2 — Roadmap approval RLS repair (isolated candidate)

Branch `agent/c2-roadmap-approval-rls`, isolated worktree
`/Users/nguyen/Projects/PAON-c2-roadmap-approval-rls`, base
`release-integration-lane-h` @ `ee33970`. **Not merged or cherry-picked into
release.**

## The defect

`release-integration-lane-h` @ `ee33970`
(`apps/customer/e2e/wardrobe-real-actions-v3.spec.ts`,
`docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md`) proved that a
real, authenticated customer clicking **Approve** or **Request changes** on
their own pending wardrobe roadmap always failed with the Server Action
error `"Could not update roadmap."`.

Root cause: `public.enforce_wardrobe_roadmap_tenancy()` — a `BEFORE INSERT
OR UPDATE` trigger on `public.wardrobe_roadmaps`, `security invoker` — ran
the same author-belongs-to-retailer lookup against
`public.retailer_staff_members` on **every** UPDATE, not only INSERT. A
customer session cannot read `retailer_staff_members` under RLS, so the
lookup always returned no row and the trigger raised `'Roadmap author does
not belong to the retailer'`.

## The fix

`supabase/migrations/20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql`
(CLI-generated via `supabase migration new
fix_wardrobe_roadmap_tenancy_update_author_recheck`).

`create or replace function public.enforce_wardrobe_roadmap_tenancy()` —
the `retailer_staff_members` lookup now runs only when `tg_op = 'INSERT'`.
On UPDATE the function returns immediately without touching that table.

This is safe because `retailer_id`, `customer_id`, and
`authored_by_staff_id` are already immutable after creation, independently
enforced by the untouched `protect_wardrobe_roadmap_identity_on_update`
trigger. An UPDATE can never actually change who authored a roadmap or
which retailer it belongs to, so there is nothing left for the tenancy
trigger to re-verify on UPDATE — the row already passed this exact check
the moment it was inserted.

### Exact authorization guarantees preserved

- `enforce_wardrobe_roadmap_tenancy()` stays explicit `security invoker`
  (verified: `pg_proc.prosecdef = false`, pgTAP #15). Never `security
definer` — this is exactly the shortcut
  `20260825190000_fix_wardrobe_tenancy_trigger_security_definer.sql` took
  and that AGENTS.md / the V3 contract explicitly forbid recreating.
- `set search_path = ''` and `revoke all ... from public` unchanged.
- INSERT still resolves `authored_by_staff_id` through an **active**
  (`deleted_at is null`) `retailer_staff_members` row and still requires
  that staff member's `retailer_id` to equal `new.retailer_id` (pgTAP #8:
  a wrong-retailer author INSERT still throws).
- `protect_wardrobe_roadmap_identity_on_update` is byte-for-byte untouched;
  `retailer_id`, `customer_id`, `authored_by_staff_id` remain immutable
  after creation (pgTAP #10-13: each identity-field UPDATE still throws
  `'Wardrobe roadmap identity fields are immutable'`, and the row is left
  completely unchanged).
- The "customers update pending wardrobe roadmaps" RLS policy's
  `USING`/`WITH CHECK` ownership and status conditions are byte-for-byte
  untouched.
- No grant is added on `retailer_staff_members`, to `authenticated` or any
  other role (static check on the migration's executable SQL, comment-
  stripped, in `wardrobe-roadmap-security.test.ts`). The table's
  pre-existing staff-facing grant is untouched; the actual boundary a
  customer relies on is row-level — a customer session reads zero rows of
  `retailer_staff_members` (pgTAP #14).
- Cross-tenant customer, cross-tenant staff, and anonymous sessions each
  read and update **zero rows** of the target roadmap (pgTAP #5-7).
- Staff/tenant/customer authorization elsewhere in the schema, and the
  original migration `20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql`,
  are not touched.

## Verification (in order)

| #   | Step                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `supabase --version`                                             | 2.115.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | `supabase db reset/test/advisors/migration --help`               | reviewed, flags confirmed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3   | `supabase db reset --local`                                      | clean apply, migration `20260828155029` applied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | `supabase migration list --local`                                | `20260828155029` local = remote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5   | `supabase test db supabase/tests/roadmap_approval_rls_test.sql`  | **20/20 pass**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | `supabase test db` (full local pgTAP)                            | **50 files, 535 tests, PASS** — zero regressions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | `supabase db advisors --local --type security --fail-on error`   | exit 1 — **5 pre-existing** `security_definer_view` findings (`worker_alteration_work_orders`, `worker_alteration_tasks`, `customer_alteration_work_orders`, `customer_alteration_status_history`, `customer_alteration_fulfillment`) — **none reference `wardrobe_roadmaps` or this migration**; confirmed this migration's own SQL creates zero views and contains zero `security definer` outside its own explanatory comments (comment-stripped grep = 0). Baseline condition, out of this candidate's scope (not in Allowed files). |
| 8   | `pnpm --filter @paon/database test -- wardrobe-roadmap-security` | **11/11 pass**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | `pnpm --filter @paon/database lint` / `typecheck`                | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 10  | `apps/customer/e2e/roadmap-approval-rls-v3.spec.ts`              | **4/4 pass** (desktop + mobile × approve + reject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | `apps/customer/e2e/wardrobe-real-actions-v3.spec.ts` (corrected) | **2/2 pass**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | `pnpm --filter @paon/customer lint`                              | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13  | `pnpm --filter @paon/customer typecheck`                         | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 14  | authenticated desktop 1512×982 proof                             | captured, both flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 15  | authenticated mobile 390×844 proof                               | captured, both flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 16  | console/page errors                                              | **zero** — no filter applied for any roadmap-approval test (not React #418, not weather/camera noise, nothing)                                                                                                                                                                                                                                                                                                                                                                                                                           |

Combined focused customer E2E run: `PAON_E2E_PORT=3311`,
`PAON_NEXT_DIST_DIR=.next-e2e-c2-3311`,
`PAON_E2E_WEBSERVER_TIMEOUT_MS=420000` — **6/6 tests pass** (1 transient
cold-webServer-start auth flake on the very first request of the very
first run reproduced as a real bug candidate, then isolated-retested 2/2
green immediately after; treated as environmental, not a defect — the fix
itself, the migration, and every other run were unaffected).

Also regenerated types (`pnpm --filter @paon/database generate-types`) to
confirm no real schema drift: the diff was pure whitespace/semicolon-style
reformatting from a newer local Supabase CLI, not a real change (this
migration alters only a trigger function body — no table, column, or RPC
signature changed). Discarded, not committed.

## Repository state discipline

- No existing `.next-e2e-*` build directory was deleted (this worktree had
  none prior to this session; `.next-e2e-c2-3311` is newly created).
- `/Users/nguyen/Projects/PAON` (the shared release worktree) and every
  other worktree were never touched.
- Exclusive local Supabase/Playwright access was held via a live-PID lock
  at `/tmp/paon-v3-integration-resources.lock` for the duration of every
  `supabase`/`playwright` command in this session (mkdir-based mutex,
  30s wait-and-recheck against the lock owner's PID liveness, held by a
  detached background process with a `trap ... EXIT TERM INT` release —
  no semantic marker files from other workers were waited on).
- `/tmp/paon-c3-signout-proof.passed` — the marker this lane was
  originally told to gate on — was explicitly stopped watching per the
  correcting instruction; this candidate does not depend on it.

## Unsupported / recorded control (found during this repair, not fixed here)

**"Request changes" has no note-input UI.** The rendered pending-approval
banner's "Request changes" button
(`apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx`) is a bare
`<form>` submitting only hidden `roadmapId` + `action=reject` fields — no
textarea or other field exists anywhere in that form for a customer to
type a rejection reason. `decideWardrobeRoadmap` (the Server Action) and
`customer_decision_note` (the DB column) both already support a note; only
the UI affordance to enter one is missing. `roadmap-approval-rls-v3.spec.ts`
and the corrected `wardrobe-real-actions-v3.spec.ts` prove the real,
complete action a customer can currently take — clicking the button with
no note — and assert `customer_decision_note is null` as the honest
postcondition, rather than fabricating a note through the admin client
(which would not have executed under the customer session) or via a
nonexistent form field. Adding that UI field is application code, outside
this candidate's Allowed files, and is not part of the security repair
this candidate closes.

## Files touched (all within Allowed files)

- `supabase/migrations/20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql` (new, CLI-generated)
- `supabase/tests/roadmap_approval_rls_test.sql` (new, pgTAP plan(20))
- `packages/database/src/repositories/wardrobe-roadmap-security.test.ts` (extended)
- `apps/customer/e2e/roadmap-approval-rls-v3.spec.ts` (new)
- `apps/customer/e2e/wardrobe-real-actions-v3.spec.ts` (corrected — the
  stale "Could not update roadmap" / `pending_approval` expectations
  removed; now proves the real success path through the real UI)
- `docs/evidence/runs/customer-v3-roadmap-approval-rls/` (this report + 6 screenshots)
- `docs/evidence/runs/customer-v3-real-actions-proof/REPORT.md` (stale
  "Broken backing behaviour" claim replaced — see that file's own updated
  section)

## Commit sequence

1. `1a3104f` — migration + pgTAP + static security test
2. corrected browser tests (this commit)
3. this evidence report + screenshots + the REPORT.md correction (this commit)

On full green: `/tmp/paon-c2-roadmap-security.passed` created.
