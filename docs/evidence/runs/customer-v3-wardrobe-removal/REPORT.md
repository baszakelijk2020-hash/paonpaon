# Phase 20.17 — customer removal of an advisor selection from the wardrobe plan

Branch `agent/c2-roadmap-approval-rls`, isolated worktree
`/Users/nguyen/Projects/PAON-c2-roadmap-approval-rls`, base
`release-integration-lane-h` @ `ee33970`. **Not merged or cherry-picked into
release.**

CENV-WARDROBE-REMOVE-001 / CUSTOMER_ENVIRONMENT_REBUILD_V3 §5.5: an approved
roadmap's unfilled gap renders in the wardrobe as an "Advisor selection"
card; one of its actions must be "Remove from wardrobe plan", and "Remove
updates the real roadmap / selection state and requires confirmation."

## Commits (exact SHAs)

| #   | SHA         | Contents                                                                                                                                                                                                                                                                   |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `b114e05`   | `supabase/migrations/20260828185506_add_wardrobe_roadmap_gap_dispositions.sql` (new, CLI-generated), `supabase/tests/roadmap_gap_disposition_rls_test.sql` (new, plan(24)), `packages/database/src/repositories/wardrobe-roadmap-security.test.ts` (+12 static assertions) |
| 2   | `4daa18c`   | `WardrobeRoadmapRepository` methods, `removeAdvisorSelectionFromPlan` Server Action, `wardrobe/page.tsx` gap filter, `AdvisorSelectionCard` confirm/cancel UI, `database.types.ts` (new table only), `apps/customer/e2e/wardrobe-removal-v3.spec.ts` (new)                 |
| 3   | this commit | this report + 10 screenshots                                                                                                                                                                                                                                               |

## Could existing schema represent this safely? No.

`wardrobe_roadmap_gaps` has no customer-writable column. Its only mutation
is `filled_by_product_id` / `filled_by_wardrobe_item_id` — an advisor-owned
"this gap is now filled" signal, not "the customer dismissed this
suggestion". Reusing it would (a) let a customer write advisor-owned fields
they otherwise cannot, and (b) conflate two distinct meanings. Hard-deleting
the gap / stage / roadmap is forbidden — the advisor keeps their authored
plan and its history.

**Chosen representation:** a new customer-scoped, one-way disposition table
`public.wardrobe_roadmap_gap_dispositions`. A row means "this customer
removed this advisor selection from their own wardrobe-plan presentation".
The wardrobe page filters out any gap the customer has a disposition for;
nothing on the advisor-authored roadmap changes.

## Exact tenant / authorization guarantees

Tenancy is pinned three ways, **no `SECURITY DEFINER`**:

1. **Composite FK** `(customer_id, retailer_id) references public.customers
(id, retailer_id)` — the customer and retailer on a disposition must be
   a real same-tenant pair.
2. **`BEFORE INSERT` trigger**
   `enforce_wardrobe_roadmap_gap_disposition_tenancy()` — explicit
   `SECURITY INVOKER`, `set search_path = ''`, `revoke all … from public`.
   It re-derives gap → roadmap and rejects unless
   `new.roadmap_id` / `new.retailer_id` / `new.customer_id` all match the
   gap's roadmap **and** the roadmap is the caller's own **approved**,
   non-deleted roadmap. It reads only `wardrobe_roadmap_gaps` and
   `wardrobe_roadmaps` — tables the customer's RLS session can already see —
   and **never** `retailer_staff_members` (unlike
   `enforce_wardrobe_roadmap_tenancy`).
3. **INSERT RLS policy** `"customers create own gap dispositions"` repeats
   the ownership check (`customers.user_id = (select auth.uid())`) and the
   approved-roadmap join, so a direct PostgREST call cannot bypass the
   Server Action.

- `disposition` is `not null default 'removed_from_plan' check (disposition
in ('removed_from_plan'))` — one value, one direction.
- **No `UPDATE` or `DELETE` policy or grant** for any authenticated caller.
  The row is append-only from every caller's perspective; identity columns
  are additionally frozen by a `BEFORE UPDATE` trigger
  (`protect_wardrobe_roadmap_gap_disposition_identity()`,
  `SECURITY INVOKER`, `search_path = ''`) that guards `service_role` /
  support tooling too.
- `revoke all on table … from anon`; anon has no grant → anon reads and
  writes raise `42501`.
- Staff of the owning tenant may **read** tenant dispositions
  (`"retailer staff read tenant gap dispositions"`, gated on
  `current_retailer_id()` + `current_retailer_role()`); they have no write
  path. Cross-tenant staff read zero rows.
- No grant is added on `retailer_staff_members` or any other unrelated
  table. A customer session still reads zero rows of
  `retailer_staff_members` (pgTAP #24).
- The advisor-authored roadmap approval / rejection RLS and the
  `protect_wardrobe_roadmap_identity` trigger from
  `20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql` are not
  touched; this is a forward-only migration.

## Verification (in order)

| #   | Step                                                                   | Result                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `supabase db reset --local`                                            | clean apply; migration `20260828185506` applied                                                                                                                                                                                                                                                                                                                      |
| 2   | `supabase test db supabase/tests/roadmap_gap_disposition_rls_test.sql` | **24/24 pass**                                                                                                                                                                                                                                                                                                                                                       |
| 3   | `supabase test db` (full local pgTAP)                                  | **51 files, 559 tests, PASS** — zero regressions (C2 baseline was 50 files / 535 tests; +1 file / +24 tests)                                                                                                                                                                                                                                                         |
| 4   | `supabase db advisors --local --type security --fail-on error`         | 5 pre-existing `security_definer_view` findings (`worker_alteration_*`, `customer_alteration_*`) + 2 pre-existing `function_search_path_mutable` WARNs (`generate_concept_scan_code`, `prevent_alteration_grid_snapshot_mutation`) — **none reference this migration**. Both new trigger functions carry `set search_path = ''` and are not flagged. No new finding. |
| 5   | `pnpm --filter @paon/database test`                                    | **573 pass** (incl. the 12 new static assertions in `wardrobe-roadmap-security.test.ts`)                                                                                                                                                                                                                                                                             |
| 6   | `pnpm --filter @paon/database lint` / `typecheck`                      | clean                                                                                                                                                                                                                                                                                                                                                                |
| 7   | `pnpm --filter @paon/customer lint` / `typecheck`                      | clean (verified with the E2E spec present; the pre-commit `turbo run typecheck` re-ran `@paon/customer` from a cache miss and passed)                                                                                                                                                                                                                                |
| 8   | `pnpm --filter @paon/customer build` (production)                      | **exit 0**; `/wardrobe` compiled                                                                                                                                                                                                                                                                                                                                     |
| 9   | `apps/customer/e2e/wardrobe-removal-v3.spec.ts`                        | **2/2 pass** — desktop 1512×982 + mobile 390×844                                                                                                                                                                                                                                                                                                                     |
| 10  | console / page errors during E2E                                       | **zero** — `attachUnfilteredConsole` applies no filter (not React #418, not weather/camera noise, nothing)                                                                                                                                                                                                                                                           |

E2E infra: `PAON_E2E_PORT=3322`,
`PAON_NEXT_DIST_DIR=.next-e2e-removal-3322`,
`PAON_E2E_WEBSERVER_TIMEOUT_MS=420000`. No existing `.next-e2e-*` directory
was deleted. Exclusive local Supabase / Playwright access held via the
live-PID lock `/tmp/paon-v3-integration-resources.lock` for every
`supabase` / `playwright` command.

(First E2E attempt: desktop hit the same transient cold-webServer-start
`/login?error=invalid_invite` auth flake C2 documented, and the mobile seed
gap had no `categoryCode` so it matched no wardrobe rail. Both fixed — the
gap seed now sets `categoryCode: "jacket"`; the rerun is 2/2 green.)

## What the E2E proves (real UI, real authenticated customer)

Signed in as the fixture customer (`e2e-shopper@paon.test`, magic-link,
`[data-customer-shell]` visible). The service-role client only seeds/cleans
fixtures and reads DB postconditions — it never performs the removal.

1. **Card renders.** An approved roadmap (advisor authors + submits; the
   customer approves via the real `transition`) with one unfilled
   `categoryCode: "jacket"` gap renders exactly one advisor-selection
   `<article>` (badge "Advisor selection") — `desktop-advisor-card.png`,
   `mobile-advisor-card.png`.
2. **Confirmation is required.** `Actions +` → `Remove from wardrobe plan`
   opens a confirm screen with `Confirm removal` + `Cancel`; no row is
   written yet — `desktop-remove-confirm.png`, `mobile-remove-confirm.png`.
3. **Cancel is a no-op.** `Cancel` → `Close` leaves the card visible and
   `wardrobe_roadmap_gap_dispositions` still holds zero rows for the gap —
   `desktop-cancel-kept.png`, `mobile-cancel-kept.png`.
4. **Confirm removes.** `Confirm removal` writes **exactly one** row:
   `{ disposition: "removed_from_plan", customer_id: <this customer>,
retailer_id: <this retailer>, roadmap_gap_id: <this gap>, roadmap_id:
<this roadmap> }`. The card disappears — `desktop-removed.png`,
   `mobile-removed.png`.
5. **No hard delete.** After removal the `wardrobe_roadmaps` row is still
   `status: "approved"`, the `wardrobe_roadmap_gaps` row still exists
   (count 1), and the `wardrobe_roadmap_stages` row still exists (count 1).
6. **Persists across reload.** A fresh `GET /wardrobe` (HTTP 200) still
   shows no advisor-selection card for the removed gap —
   `desktop-removed-after-reload.png`, `mobile-removed-after-reload.png`.
   (Persistence across a new session follows from the same durable row +
   the reload proof; the row is not deletable by the customer — pgTAP
   #19-21.)
7. **Console clean.** `expect(consoleErrors).toEqual([])` — nothing
   filtered.

## pgTAP coverage (`roadmap_gap_disposition_rls_test.sql`, plan(24))

Owner removes + persists (1-3); advisor roadmap/gap/stage untouched, no
hard delete, no `filled_by` write (4-6); duplicate removal rejected by the
unique `(roadmap_gap_id, customer_id)` (7); cross-customer of the same
retailer sees zero rows and cannot write (8-10); cross-retailer customer
sees zero rows and cannot write (11-13); anonymous cannot read or write —
`42501` (14-15); same-tenant staff read but cannot INSERT (16-17);
cross-tenant staff read zero rows (18); owning customer cannot UPDATE or
DELETE — no grant, no policy — and the row is durable (19-21); identity
columns immutable (22); both new trigger functions `SECURITY INVOKER`, never
`SECURITY DEFINER` (23); customer session still reads zero
`retailer_staff_members` rows (24).

## Files (all within the task's Allowed files, plus the generated types)

- `supabase/migrations/20260828185506_add_wardrobe_roadmap_gap_dispositions.sql` (new, CLI-generated)
- `supabase/tests/roadmap_gap_disposition_rls_test.sql` (new)
- `packages/database/src/repositories/wardrobe-roadmap-security.test.ts` (extended)
- `packages/database/src/repositories/wardrobe-roadmap-repository.ts` (2 methods)
- `packages/database/src/generated/database.types.ts` — the new table's
  Row/Insert/Update/Relationships block only. A full `supabase gen types`
  regen on the local CLI (2.115.0) rewrites the whole 25k-line file with
  cosmetic semicolon/formatting churn and only ~111 real net lines; the
  hand-added block is the minimal correct change and is required for
  typecheck + production build.
- `apps/customer/app/(dashboard)/wardrobe/roadmap-actions.ts` (Server Action)
- `apps/customer/app/(dashboard)/wardrobe/page.tsx` (gap filter)
- `apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx` (`AdvisorSelectionCard` confirm/cancel)
- `apps/customer/e2e/wardrobe-removal-v3.spec.ts` (new)
- `docs/evidence/runs/customer-v3-wardrobe-removal/` (this report + 10 screenshots)

## Not invented

No fake status, product, route, advisor, or confirmation. The seeded
roadmap uses the real fixture retailer / customer / staff / product and the
real `WardrobeRoadmapRepository.createDraft` + `transition` path. The
removal executes through the real Server Action under the real customer
session. The only value the disposition can carry is `removed_from_plan`.
