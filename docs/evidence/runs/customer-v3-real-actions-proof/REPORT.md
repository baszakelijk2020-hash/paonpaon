# V3 real-action proof — Wardrobe & Morning Routine

Branch `release-integration-lane-h`, base `8a2825f`.
Focused E2E: `PAON_E2E_PORT=3301`, `PAON_NEXT_DIST_DIR=.next-e2e-realactions5-3301`,
`PAON_E2E_WEBSERVER_TIMEOUT_MS=420000` (C1 fix `383276f`). No existing
`.next-e2e-*` directory was deleted.

Result: **3 tests, 3 passed.**

| #   | Spec                                                        | Test                                                                                   |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `apps/customer/e2e/wardrobe-real-actions-v3.spec.ts`        | owned-card deck: repair, cleaning, ask-advisor, reorder-via-advisor, self-scan, retire |
| 2   | `apps/customer/e2e/wardrobe-real-actions-v3.spec.ts`        | roadmap review control is real and wired (customer-side write blocked — see below)     |
| 3   | `apps/customer/e2e/morning-routine-real-actions-v3.spec.ts` | today / save / mark-reviewed / ask-advisor / buy / delivery                            |

`pnpm --filter @paon/customer lint` — clean.
`pnpm --filter @paon/customer typecheck` — clean.

Every action was signed in as the real fixture customer
(`e2e-shopper@paon.test`, magic-link, `[data-customer-shell]` visible), and
every persisted row was re-read with the service-role client and asserted
to carry that customer's own `customer_id` **and** `retailer_id`. No route,
result, booking, upload, price, advisor, or state was fabricated.

---

## Real actions proven (persisted DB row, tenant-scoped)

### Wardrobe — owned-card `Actions +` deck (`wardrobe-panel.tsx`)

| Action              | Control (file:line)                                                                        | Server Action                                                                          | Persisted proof                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Request a repair    | "Book a repair" — `wardrobe-panel.tsx:302-315`                                             | `requestWardrobeItemService` (`actions.ts:161`, `kind=repair`)                         | new `messages` row in the customer's `conversations` row (customer_id + retailer_id asserted); UI shows "Request sent to your advisor." |
| Request a cleaning  | "Book a cleaning" — `wardrobe-panel.tsx:302-315`                                           | `requestWardrobeItemService` (`kind=cleaning`)                                         | second `messages` row (count +1)                                                                                                        |
| Ask an advisor      | Deck → "Ask your advisor" → "Request a fit-check" — `wardrobe-panel.tsx:562-599`           | `askAdvisorAboutWardrobeItem` (`ask-advisor-actions.ts:51`, `starterPrompt=fit_check`) | `messages` row (count +1)                                                                                                               |
| Reorder via advisor | Order again → "Ask your advisor to reorder" (unlinked item) — `wardrobe-panel.tsx:408-421` | `requestWardrobeItemReorderViaAdvisor` (`actions.ts:229`)                              | `messages` row (count +1); UI shows "Request sent to your advisor."                                                                     |
| Self scan           | Deck → "Do a fit-check in app" — form `wardrobe-panel.tsx:454-530`                         | `submitWardrobeSelfScan` (`lifecycle-actions.ts:85` → RPC `submit_wardrobe_self_scan`) | new `wardrobe_self_scans` row for the item, `customer_id` + `retailer_id` asserted; UI shows "Fit-check submitted to your advisor."     |
| Retire              | Deck → "Retire" → confirm screen → "Confirm retire" — `wardrobe-panel.tsx:533-559`         | `retireWardrobeItem` (`actions.ts:97`)                                                 | `wardrobe_items.retired_at` set (string), `customer_id` + `retailer_id` asserted                                                        |

Navigation target also asserted: **"Request a fit-check in store"** href =
`/appointments?prefillReason=service_size_check&prefillWardrobeItemId=<id>`
(`wardrobe-panel.tsx:392-397`) — real prefill route, proven end-to-end in
`098fe2b`.

### Morning Routine (`routine-panel.tsx`, `delivery-panel.tsx`)

| Action                 | Control                                                                         | Server Action                                                                                           | Persisted proof                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save                   | "Save" (recommendation) — `routine-panel.tsx:102-127`                           | `runMorningRoutineAction` (`actions.ts:139`, `action=save`)                                             | `morning_routine_selections.review_status = 'saved'`, customer_id + retailer_id asserted                                                                                                                                                                                                                            |
| Mark reviewed          | "Mark reviewed" — `routine-panel.tsx:131-148`                                   | `runMorningRoutineAction` (`action=review`)                                                             | `morning_routine_selections.review_status = 'reviewed'`                                                                                                                                                                                                                                                             |
| Ask advisor            | "Ask advisor" — `routine-panel.tsx:150-166`                                     | `startConversation` (`messages/actions.ts`)                                                             | new `messages` row in the customer's `conversations` row (count +1)                                                                                                                                                                                                                                                 |
| Buy                    | "Buy" — `routine-panel.tsx:190-221`                                             | `runMorningRoutineAction` (`action=buy`)                                                                | fixture customer has **no** saved shipping address, so the real handler correctly refuses: UI shows "Turn on 1-Tap Checkout first — no saved address." and **zero** new `orders` rows (asserted `orders` count unchanged). The honest refusal is the proof; no shipping address was fabricated to force a checkout. |
| Seven-day delivery     | delivery panel form → "Save delivery preferences" — `delivery-panel.tsx:52-160` | `saveMorningRoutineSubscription` (`delivery-actions.ts:37` → RPC `upsert_morning_routine_subscription`) | new `morning_routine_subscriptions` row: `opted_in=true`, `frequency='weekly'`, `channels` contains `email`, customer_id + retailer_id asserted                                                                                                                                                                     |
| Select / Refresh today | "Refresh today" / "Select today" — `routine-panel.tsx:278-289`                  | `generateMorningRoutineSelection` (`actions.ts:68` → RPC `persist_morning_routine_selection`)           | a `morning_routine_selections` row for today, scoped to customer + retailer, with no error alert                                                                                                                                                                                                                    |

Navigation target also asserted: **"Book"** href =
`/r/e2e-customer-workspace/appointments` (`routine-panel.tsx:169-189`).

---

## RESOLVED — Roadmap review — "Approve" / "Request changes"

**Update:** the defect this section originally documented is now repaired
by candidate branch `agent/c2-roadmap-approval-rls`
(`supabase/migrations/20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql`).
See `docs/evidence/runs/customer-v3-roadmap-approval-rls/REPORT.md` for the
full fix, pgTAP/E2E proof, and authorization guarantees. That candidate is
**not merged into release** as of this writing — this section is left
below as the original findings for history; the corrected E2E proof lives
in `apps/customer/e2e/roadmap-approval-rls-v3.spec.ts` and the corrected
`wardrobe-real-actions-v3.spec.ts` (no longer expects "Could not update
roadmap." or a stuck `pending_approval` status).

- **Control:** pending-approval banner on `/wardrobe`,
  `apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx:872-885`
  (two `<form action={decideWardrobeRoadmap-adapter}>` with hidden
  `roadmapId` + `action` = `approve` / `reject`).
- **Route:** `/wardrobe`.
- **Server Action:** `decideWardrobeRoadmap`,
  `apps/customer/app/(dashboard)/wardrobe/roadmap-actions.ts:35`
  → `WardrobeRoadmapRepository.transition(..., { kind: "customer", ... })`,
  `packages/database/src/repositories/wardrobe-roadmap-repository.ts:335`.
- **Original symptom (pre-fix):** a real customer clicking "Approve" got
  the form error **"Could not update roadmap."**; the roadmap stayed
  `pending_approval`.
- **Root cause (reproduced directly in Postgres):** the
  `enforce_wardrobe_roadmap_tenancy()` trigger
  (`supabase/migrations/20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql:421-445`)
  was `BEFORE INSERT OR UPDATE` and, on every UPDATE, re-ran
  `select staff.retailer_id from public.retailer_staff_members where staff.id = new.authored_by_staff_id`.
  The function is `SECURITY INVOKER`, so under a customer session that
  sub-select was filtered by RLS (customers cannot read
  `retailer_staff_members`), returned 0 rows, and the trigger raised
  `Roadmap author does not belong to the retailer`.
- **Fix applied:** `enforce_wardrobe_roadmap_tenancy()` now runs the
  `retailer_staff_members` lookup only on INSERT. `authored_by_staff_id`
  and `retailer_id` are already immutable after creation
  (`protect_wardrobe_roadmap_identity_on_update`, untouched), so an
  UPDATE never needs to re-verify them — see
  `customer-v3-roadmap-approval-rls/REPORT.md` for the full authorization
  analysis (still explicit `security invoker`, never `security definer`;
  no grant added on `retailer_staff_members`; every tenancy/ownership/
  staff-authorization guarantee preserved and pgTAP-proven).
- **Separately discovered, still open:** the "Request changes" control has
  no note-input UI field — a customer can submit a rejection but cannot
  type a reason through the current UI, even though the Server Action and
  DB column both support one. See "Unsupported / recorded control" in
  `customer-v3-roadmap-approval-rls/REPORT.md`.

### "Discuss with advisor" (advisor-selection card)

- **Control:** `wardrobe-panel.tsx:705-722` — real
  `<form action={askAdvisorAboutWardrobeItem}>` with
  `starterPrompt=discuss_roadmap_gap` + `roadmapGapTitle`.
- **Handler:** `askAdvisorAboutWardrobeItem`
  (`ask-advisor-actions.ts:51`) — a **real, wired** handler that would
  persist a `messages` row exactly like the deck's "Ask your advisor".
- **Why not asserted end-to-end:** the advisor-selection card only renders
  for an **approved** roadmap's open gap
  (`apps/customer/app/(dashboard)/wardrobe/page.tsx` — `approvedRoadmap` /
  `openGaps`). The only way for a customer to approve a roadmap is the
  button above, which is broken (previous entry). Seeding
  `wardrobe_roadmaps.status='approved'` via the service role did not
  produce a rendered advisor-selection card in the run (the gap→stage→
  suggested-product wiring needed by `page.tsx` was not reproduced), so
  this action could not be exercised without an unverified fixture.
  Recorded here rather than asserted.

---

## Rendered controls with no mutation handler (navigation / display only — not a defect)

| Control                                                                   | file:line                                                              | Nature                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Complete the look" (deck)                                                | `wardrobe-panel.tsx:284-287` → screen `complete-the-look` (`:366-388`) | Displays real `completeTheLookSuggestions` (read-only). Each suggestion tile is a real "see it on me" generate control (`SuggestedLookTile`), not a wardrobe mutation.                                                                  |
| "Order again" (deck)                                                      | `wardrobe-panel.tsx:288-291`                                           | Sub-menu navigation only; its real leaf actions ("The size is perfect" nav, "Ask your advisor to reorder") are covered above / in `wardrobe-size-perfect-remediation-v3.spec.ts`.                                                       |
| "Explore alternatives" (advisor card)                                     | `wardrobe-panel.tsx:729-735`                                           | Local `showAlternatives` state toggle; reveals a read-only list of real same-category catalogue products. No mutation.                                                                                                                  |
| "Buy" / "Add to Digital Fitting Room" / "Proceed in store" (advisor card) | `wardrobe-panel.tsx:697-728`                                           | Real navigation links to real routes (`/r/{retailer}/products/{slug}`, `/digital-fitting-room?productSlug=…`, `/appointments?prefillRoadmapGapId=…`). No mutation. Not reachable in this run (advisor card did not render — see above). |

## Screenshots

None captured — these proofs are DB-row assertions, not visual. The
consolidated pass log is `../../../scratchpad`-local and reproduced by
`pnpm exec playwright test wardrobe-real-actions-v3 morning-routine-real-actions-v3`.
