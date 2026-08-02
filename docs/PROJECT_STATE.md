# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-08-01 (takeover branch `agent/grok-takeover-2026-07-30`).
The 2026-07-30 save-game seal below still describes `main`; the section
**"2026-08-01 takeover-branch snapshot"** at the end of this file describes
what is true on the takeover branch and supersedes it there.

## 2026-08-02 Codex audit correction

This correction supersedes conflicting status and handoff claims below:

- Active queue: R0.1 at the top of `PHASE.md`; ADR-070 restores the full
  modular destination while requiring legacy 9.2 and Stage 10–16 work to be
  mapped through R0.3 before it resumes.
- The takeover branch has 152 migrations and all apply from zero locally. A
  populated synthetic pre-18 database now proves both transactional refusal
  of catalogue/ledger conflicts and a quantity-preserving clean upgrade
  through migration 22 plus R0.1 hardening. An approved restore of actual
  original data is still required. Current Vercel production is classified
  protected/original infrastructure and its customer app is broken by
  code/schema drift.
- Faden documents a read-only API and webhooks publicly, but nothing found in
  the provider contract establishes the implemented HMAC scheme or
  `x-faden-*` headers. Treat them as fixtures, not provider facts.
- Audit reproduction found a cross-tenant inventory-ledger mutation path, a
  public SECURITY DEFINER arbitrary-retailer location path, and non-atomic POS
  completion/returns. These precede further feature work.
- Customer e2e is now 29/29 on the takeover branch. The inherited 15/29
  baseline mixed stale assertions with real storefront collision,
  accessibility and order-detail read-after-write defects; all 14 scenarios
  now pass together against disposable local Supabase.
- Retailer e2e is now 43/43 on the takeover branch. The audit restored the
  missing `/staff/coverage` UI and coaching loop, production-specialist order
  navigation, a local-only webhook secret fixture, deterministic measurement
  version setup, and invalid-invite/network-idle proof assumptions. The route
  had been silently excluded by the generic `coverage/` gitignore rule even
  though its browser proof and completion prose were committed.
- The live repository suite initially reproduced only 8 passes and 59 skips.
  Its fixture now provisions one coherent disposable tenant and the suite
  executes 70/70 assertions after a clean reset.
- Existing evidence artifacts describe their historical SHAs, not the new R0
  gate.
- R0.1 read-only inventory now records the exact projects in
  `ENVIRONMENTS.md`. All local app env files point to disposable local
  Supabase; the CLI remains linked to protected original project
  `hngxrczavwywsnfceppb`; the Hyperagent sandbox is not accessible with the
  current token. Customer production is HTTP 500 on an older schema missing
  `entity_metadata_assignments`; admin and retailer login return 200.
- Migration `20260801175205_harden_stock_tenant_boundaries.sql`, the shared
  test-target guard, and retailer-scoped operational variant queries are
  verified locally. The latter fixed a real cross-retailer inventory/POS UI
  path exposed by the new constraint. No hosted migration, test, seed,
  deployment, or data write was performed.
- R0.2 migration `20260801183032_make_pos_money_and_stock_atomic.sql` replaces
  sequential POS/stock seams with transactional RPCs. Authenticated payment
  and POS-line writes are RPC-only, and final-state/line triggers prevent
  direct bypass even by privileged fixture clients. The live suite is now
  70/70; pgTAP is 11/11; clean reset applies all 149 migrations; the
  stock/loss/POS browser slice remains 4/4. Cash remains a proposed policy in
  ADR-072, not a production activation.
- R0.3 now has a local module kernel: eight family contracts, plan bundles,
  effective retailer lifecycle/authority resolution, dependency rollback,
  audit history, active-only jobs and role-aware navigation projection.
  Module proof is 8 domain + 8 repository/schema + 15 pgTAP + 1 browser
  assertion. Customer e2e is a clean 29/29 and retailer e2e is a clean 43/43.
  Preview/suspended/off now fail closed at the server-session boundary for
  stock, loss prevention, POS, coverage, customer, appointment, messaging,
  customer-fact, wardrobe, roadmap, alteration, workshop and service-plan
  mutations. Relationship and garment/service route layouts also refuse
  suspended/off direct reads while allowing preview reads. Browser proof waits
  for all preview-mode Server Actions, verifies no rows are written, and
  asserts suspended direct client and service routes return 500. The gate is
  not yet universal across every module surface. The canonical proof House is now
  idempotently seeded as a tenant distinct from Maison Dubois, Demo Studio and
  the generic e2e workspace, with 6+ staff, 14 clients, 20+ products, 5+
  appointments, 10+ orders and an alteration case. R0.3 still needs canonical
  House cleanup and complete server/read guards. `CAPABILITY_DISPOSITION.md` classifies every
  inherited Stage 8–16 capability and founder-designated tool by module,
  keep/harden/consolidate/replace/quarantine decision and connected proof.
- FT-08 is connected and proven. FT-09 now has a connected attachment slice
  on the exact raw founder storefront as well as the React child-route port:
  text/photo/PDF/Pinterest/wedding-fabric inputs reach the canonical private
  thread with purpose, source, rights and honest `basic_validated` state.
  Customer 2/2 attachment browser proof, retailer 1/1 regression proof, 4
  domain assertions and 8 pgTAP assertions pass. Async malware/quarantine,
  progress, party/garment links, consent/citation proof and the full
  conversation-to-outcome journey remain open.
- The non-browser module-boundary audit found the customer app's commerce
  writes (raw-storefront cart routes, the React PDP's `addToCart`,
  `cart/actions.ts`) entirely unenforced against `commerce_growth` state —
  they have no retailer/staff session to call `resolve_retailer_modules()`.
  Migration `20260802000004` adds a narrow public `retailer_module_access_state`
  lookup; all four customer commerce entry points now fail closed when the
  module is off/suspended/preview. Proof: 3 new pgTAP assertions (18/18) and
  a browser assertion of block-then-recover; full customer e2e suite 33/33.
- The rest of the audit is closed except one deliberate exception and one
  deferred item. Every remaining customer write now gates on its module:
  `relationship_intelligence` (appointments, TableService signed-in/anonymous),
  `commerce_growth` (event RSVP), `wardrobe_styling` (newsletter, swipe/
  tie-mate/product-page wishlist saves). Background jobs (MorningRoutine
  delivery, campaign activation, newsletter dispatch) check
  `PlatformModuleRepository.jobEnabled` per retailer before enqueueing.
  Stripe Connect and Faden webhooks stay deliberately ungated — they record
  externally-already-happened money/inventory facts, and dropping them under
  a module-suspension check would create the ledger/stock divergence R0.2
  exists to prevent. Proof: 2 new browser assertions (`module-boundary.spec.ts`),
  full customer e2e suite green at 35/35.
- `joinWeddingParty`'s anonymous invite-token path is now gated on
  `enterprise_verticals` too, closing the R0.3 non-browser audit entirely.
  A new read-only `wedding_party_retailer_for_invite` RPC (migration
  `20260802000005`) mirrors `join_wedding_party`'s own token-validity check
  without performing the join, so the caller can gate before writing;
  `WeddingPartyRepository.retailerIdForInvite` wraps it. Proof: 3 pgTAP
  assertions (valid/unknown/cancelled token). No browser proof — this
  feature has no existing e2e fixture (photo upload, invite seeding) to
  extend, and building one from scratch was judged disproportionate to
  closing an already-low-risk deferred gap on previously-unproven code.
- FT-10 Inspiration Box/gift booklet moved from missing to a first
  connected slice, reusing this session's module-gate infrastructure.
  `pag1.html` was checked directly and has no interactive fragment to
  port, so this is built with PAON primitives, not a source port. Migration
  `20260802000006` adds `gift_experiences`/`gift_curated_items`/
  `gift_invitations` plus anonymous-safe `resolve_gift_invitation`/
  `redeem_gift_invitation` RPCs (ADR-034 narrow-RPC pattern). A retailer
  manager curates 1-12 real catalogue pieces at `/gifts` and sends an
  opaque-token invitation; the recipient opens/redeems anonymously,
  seeing only their own reveal with live catalogue price. Redemption
  creates no Order and touches no stock by design — R0.2 already owns
  that atomic write surface, so this records a selection outcome for the
  advisor to convert manually rather than adding an uncoordinated order
  path. Proof: 6 pgTAP assertions (token isolation, no-double-redeem,
  item-must-belong-to-experience) and two browser journeys — retailer
  curate/invite/see-redeemed, customer open/redeem/blocked-on-replay.
  Remaining: expiry/revoke UI polish, resend, giver payment/request flow,
  recall/refund.
- Running the full retailer e2e suite (rather than only targeted specs)
  surfaced a real R0.3 regression: the shared demo persona retailer had no
  module configuration/subscription, so every module resolved `off` and
  `demo-personas.spec.ts`'s 7 navigation checks were silently failing.
  `demo-seed.ts` now activates all eight modules for every seeded demo/
  prospect house. Full retailer suite is a clean 44/44.
- FT-12 Six-rail wardrobe now has a first connected slice. No interactive
  rail fragment exists in `pag1.html` either (checked directly), so
  `WardrobeRail` replaces the six generic card sections with a closed
  spine + layered peek-stack preview, click-to-open height transition,
  arrow-key roving focus and `prefers-reduced-motion` support, built
  against the blueprint's physical description rather than guessed
  pixels. Existing add/retire/provenance behavior is unchanged. Proof: one
  browser journey (default-open, close/reopen, keyboard roving, add/retire
  through the new UI). Composed-look transition, concurrent-correction/
  order-fed-ownership/service-away/cross-House proof and the rail-to-look-
  to-MorningRoutine continuation remain.
- FT-13 Moonstruck groom/best-men planner now has a first "delivery and
  pickup readiness" slice. No interactive aftercare-checklist fragment
  exists in `pag1.html`/pag2/pag3 either (checked directly), so it is built
  with PAON primitives against the blueprint's job/state description.
  Migration `20260802000007` adds `wedding_aftercare_plans` (party-wide or
  member-scoped, optional due date) and `complete_wedding_aftercare_plan`, a
  SECURITY DEFINER RPC re-deriving organizer-or-assigned-member
  authorization server-side (ADR-034 pattern); the table grants only
  `select` to `authenticated`, so completion only happens through the RPC.
  A retailer manager authors instructions; the organizer or the assigned
  member completes one. Proof: a retailer browser journey (author, see
  "Pending") and a customer browser journey (organizer completes their own
  instruction, DB asserts `completed_at`). Surfaced and fixed a latent bug:
  `wedding_parties` has no DELETE grant for any role by design (soft-delete
  only); an early test-cleanup draft's hard delete silently failed and left
  orphaned parties for the shared customer e2e fixture, breaking
  `mobile-ux.spec.ts`'s bottom-nav assertion — fixed to soft-delete,
  orphaned rows purged. Date candidates/votes, member design choices, guest
  vouchers and inspiration items remain unwired.
- FT-07 Lapel/pocket/shoulder configurator moved from missing to a first
  connected slice, correcting a wrong `DESIGN_PORTS.md` entry: `pag1.html`
  was checked directly and does contain a designated
  `#suit-configurator-widget` fragment (three synchronized carousels plus a
  model carousel with three predefined combinations), so this is a real
  pixel port — CSS, markup, image URLs and model configs are byte-for-byte
  from source. GSAP scroll/opacity tweening is reimplemented with a
  hand-rolled requestAnimationFrame tween (GSAP's power2.inOut formula) and
  a CSS transition, since this codebase has no GSAP dependency. Migration
  `20260802000008` adds `suit_configuration_intents` (append-only) and
  `save_suit_configuration_intent`, a narrow RPC re-deriving/self-creating
  the caller's Customer row (same shape as `save_wishlist_item`). Customers
  explore at `/r/[slug]/configurator` (gated by `wardrobe_styling`) and make
  an explicit save decision. Proof: a browser journey covering initial
  predefined-model state, model-click resync of all three sub-carousels,
  save, and a database assertion. Prohibited combinations, version pinning,
  retired-option recovery, cross-House isolation, advisor-side visibility
  and configuration-to-proposal/MTM continuation remain.
- FT-13's `wedding_group_fittings` (schema already real since
  `20260801000014`, unwired) is now connected. Migration `20260802000009`
  adds the missing customer-facing SELECT RLS (mirroring the aftercare-plan
  pattern); the retailer insert needed no new RPC since staff already write
  through their own session's existing RLS. A retailer schedules a
  date/time + capacity fitting; the organizer and every member see it
  listed (read-only — no per-member RSVP column exists yet). Proof: a
  retailer and a customer browser journey.
- `wedding_inspiration_items` (also schema-real since `20260801000014`) is
  now connected too. Unlike group fittings, this table is customer-writable
  (`added_by_customer_id`), so migration `20260802000010` adds
  `add_wedding_inspiration_item`, a SECURITY DEFINER RPC re-deriving
  organizer/member authorization and the caller's own customer id, plus a
  check constraint (image or note required) the original schema lacked. The
  organizer and every member pin an image link and/or note; `internal_only`
  defaults true. Proof: a customer browser journey with a DB assertion.
- `wedding_design_choices` (also schema-real) is now connected too: a member
  records their own outfit choice per slot (free text, no vocabulary
  specified in the source), or the organizer sets one party-wide
  "coordinated" choice, via migration `20260802000011`'s
  `set_wedding_design_choice` RPC, which upserts on (party, member-or-null,
  slot) rather than accumulating duplicate rows.
- "Group-date agreement" is connected too — the one FT-13 surface with no
  schema at all until migration `20260802000012` added
  `wedding_date_candidates`/`wedding_date_votes`. The organizer or any
  member proposes a candidate date (idempotent); every member votes at most
  once (`toggle_wedding_date_vote` resolves the caller's own member row
  server-side); the organizer finalizes by reusing the existing
  organizer-RLS `updateSchedule` path, not a new RPC. Caught a real bug
  during proof: the migration's RLS SELECT policies had no matching
  table-level `select` grant, which 500'd immediately — fixed by adding it.
  `wedding_guest_vouchers` is now connected too: it holds real monetary
  value, but wiring it never required a payment/redemption mechanism, only
  recording that a voucher was issued (funded outside PAON) and later
  redeemed — neither write creates an order, moves stock, or captures a
  payment. Migration `20260802000013` adds the customer read policy;
  retailer issue/mark-redeemed use plain insert/update through
  already-granted staff RLS, no RPC. FT-13 is now fully wired across every
  table the schema already had.
- Closed FT-05's other "unverified" gap, the composited customer view
  (`advisor-preparation-brief.tsx`): extended `workspace.spec.ts`'s
  existing fresh-customer test to assert its fail-closed, no-consent
  empty state renders honestly rather than crashing or showing nothing.
  The `usable`-visibility (real consented evidence) path remains
  unproven.
- Strengthened FT-05's advisor Today dashboard proof: `dashboard-digest.
spec.ts` proved exactly one of five "Needs your attention" card types
  (price approval); added a second — today's appointment, seeded
  directly and asserted through the real card (customer name, type
  label, link-through) — following the same "prove one representative
  case" precedent used for the module-boundary gate rather than testing
  all five card types in one slice.
- Closed FT-10's "resend" gap, which turned out on inspection to be an
  initial-send gap: "Send invitation" only ever created the DB row and
  showed the raw redeem link as text for the manager to copy — nothing
  was ever actually sent. `gift_invitations` has no `recipient_user_id`
  (the recipient is anonymous, not a PAON user), so the standard
  notifications-insert trigger that populates `email_outbox` for every
  other transactional email (ADR-032) can't apply. Migration
  `20260802000016` adds `email_sent_at` plus
  `enqueue_gift_invitation_email`, a SECURITY DEFINER RPC mirroring
  `enqueue_morning_routine_delivery_notification`'s shape — re-derives
  retailer-manager authorization and builds the email entirely from the
  invitation/experience/retailer rows, never trusting caller input, then
  queues into the same outbox the `dispatch-emails` cron already drains.
  A separate "Email invitation" button (relabels to "Resend email")
  keeps sending an explicit decision, not a side effect of creating the
  link. Proof: extended `gifts.spec.ts` with a real `email_outbox`
  assertion and the button-relabel check.
- Corrected a stale FT-06 doc claim the same day it was written: "not
  built: live weather/calendar context wiring, delivery-job-driven
  notification" was false — both predate the FT-06 slice (PHASE 4.4/4.5,
  the latter landed `933ab1c`) and are already live in production, driven
  by the `dispatch-emails` cron via `orchestrateMorningRoutineDeliveries`.
  Caught by verifying directly against source rather than trusting the
  paragraph just written, same discipline as the MeasurementMonitor
  false-start. The one real gap found in the process: that orchestrator's
  own I/O wiring (module-off short-circuit, retailer-pause audit, per-
  channel enqueue, duplicate-for-date suppression) had zero test coverage
  — sibling pure gating functions were unit-tested, the orchestration
  loop itself was not. Closed with
  `packages/database/src/morning-routine-delivery-orchestrator.test.ts`.
- FT-02 Silhouette analysis moved from "wrong" to a first connected slice,
  replacing the invented Dutch-language SVG carousel that `DESIGN_PORTS.md`
  correctly flagged. `pag1.html`'s `#nbs-silhouette-widget-a91k` was
  checked directly and confirmed present: five video-backed panels (S1–S5)
  auto-advancing on a dwell timer, pausable on touch/mouse, with two
  "anticipated FitTools" rule columns whose glow-toggle squares highlight a
  different subset per panel — CSS, markup, video sources and the
  rule-highlight mapping are byte-for-byte from source. A PAON-added
  "Select" button records the active panel through the existing
  `recordFitToolObservation` path. Level 1 visual classification only — the
  blueprint's Level 2/3 individual-analysis/prediction progression and full
  consent/capture session state machine remain unbuilt. Proof: the existing
  `fit-tools.spec.ts` journey (updated for the real button/observation
  text) plus manual verification of auto-advance, video playback and
  rule-highlight resync.
- Investigated FT-04 First-fitting automation and found, then closed, a
  precise post-intake task-creation gap: the alteration state machine
  (`create_alteration_intake`, 11 statuses) was mature, but it was the
  only path that ever created a task. Reusing
  `proposePriceChange`/`decidePriceChange` directly was not viable — they
  require an existing `task_id` and only ever adjust a price, never
  create one. Instead, a new `add_alteration_task` RPC (advisor-only)
  inserts a task at the schema's own default zero quote and `proposed`
  status; `agreed_total_amount_minor_units` is only ever recomputed
  inside the unmodified approval flow, so an unpriced task changes
  nothing until it goes through that same dual-control pricing — no new
  money-movement path, same boundary read as `wedding_guest_vouchers`.
  Wired retailer-side with a "New task" form on the alteration detail
  page; proof: `alteration-add-task.spec.ts`.
- Closed FT-09's optional wedding-party attachment link (party side only,
  garment links untouched): `message_attachments.wedding_party_id`
  (nullable) plus a `record_consultation_attachment` signature change
  (old 8-arg overload explicitly dropped). Discovered the root `/r/[slug]`
  page has no `page.tsx` — only a `route.ts` Route Handler serving the
  founder's `paon-template.html` via string substitution, which Next.js
  never wraps in `layout.tsx` — so the React `TableServiceWidget` never
  mounts there; the founder page runs its own hand-templated vanilla-JS
  widget copy instead, calling the same Server Action through an API
  bridge. Added the same optional "Link to wedding party" selector to
  both surfaces. Retailer inbox now resolves and shows the linked party's
  name. Proof: `tableservice-wedding-fabric-link.spec.ts`, run against
  the actual root path used by the pre-existing
  `tableservice-attachments.spec.ts`.
- Closed FT-07's advisor-side visibility gap: `SuitConfiguratorRepository
.findRecentByCustomer` already existed with no caller, and its
  retailer-staff RLS policy/grant were already in place, unused. Added a
  read-only "Suit configurator picks" card to the retailer customer
  detail page — no migration, no RLS/RPC change. Proof:
  `suit-configuration-intents.spec.ts`, seeding through the real
  `save_suit_configuration_intent` RPC as an authenticated shopper (a
  direct table insert was tried and correctly rejected — no role has
  INSERT on that table but the RPC). Fixed one real test-authoring trap:
  `generateLink({type: "magiclink"})` for a brand-new email silently
  mints a signup-type token, not a magiclink one; verifying it as
  magiclink then fails — fixed by creating the auth user first.
- FT-06 MorningRoutine moved from a generic ranked list to a first
  connected slice. `pag1.html` has no composed-look widget (checked
  directly — only narrative plus a decorative weather-camera overlay), so
  this is built with PAON primitives against the blueprint's physical
  description. The top recommendation is now a large featured "Today's
  look" card; the rest form a horizontal "Complete the look" strip with
  non-owned pieces marked. Every Server Action/field is unchanged — a pure
  recomposition — except one real gap fixed: `primaryImageUrl` existed on
  the domain type but was dropped in the view mapping, so no image ever
  rendered. First e2e coverage added for a feature that had zero before.
  "Buy" still only links to the existing product page; order creation
  remains the Commerce boundary.
- Checked FT-05 Mission Control/Self-Portrait directly rather than trusting
  its stale summary and found it more built than documented: no
  interactive fragment exists in `pag1.html` (only narrative plus one
  unrelated decorative logo-carousel), but three real actor surfaces
  already exist — the retailer `/dashboard` Brief, the per-customer
  composited view, and the customer-facing Self-Portrait facts panel with
  correction. That customer-facing panel had zero e2e proof despite being
  fully wired; `style-profile-account.spec.ts` is a new first browser
  journey. Found and fixed a real bug it surfaced: the test's own swipe
  leaked a wishlist item and a decided-product event into other specs;
  added cleanup mirroring `swipe-deck.spec.ts`'s own hygiene. Separately
  confirmed (not caused by this work) that `swipe-deck.spec.ts`'s
  keyboard-decision loop has pre-existing card-detachment flakiness
  unrelated to guard-loop size — passes on retry, consistent with other
  logged flakes.

## Repository

- Branch: `agent/grok-takeover-2026-07-30`; remote: `origin`
  (`baszakelijk2020-hash/paonpaon`).
- Schema source: forward Supabase migrations plus generated TypeScript
  database types.

## Implemented baseline relevant to the programme

- Stages 0–5 complete. Stage 6 blocked.
- Stage 7 and Stage 8.0–8.3 complete under ADR-066/067.
- Stage 8.4 is `verified_local` (completion harness + `runs/8.4.json`).
- Stage 9.1 is `verified_local` (migration write-through + `runs/9.1.json`).
- Stage 9.2 is `implemented_unverified` (takeover branch only — not on `main`):
  the Faden webhook half of the connector lifecycle is now real and
  browser-proven against a dedicated non-production Supabase project — real
  HMAC signature verification (`verifyFadenWebhookSignature`, constant-time,
  replay-windowed), connection pause/resume/disconnect with a
  retailer-facing UI, sync cursors, run history, dead letters and
  reconciliation-report schema, and a route handler
  (`apps/retailer/app/api/webhooks/faden/[connectionId]/route.ts`) that
  refuses to invent a canonical mapping for an unseen external order. A
  genuine e2e run (`integration-connection-lifecycle.spec.ts`) found and
  fixed a real defect along the way: the retailer's pause/resume action was
  silently failing because `integration_connections` never granted
  `authenticated` write access at all (fixed in
  `20260731000001_grant_connection_lifecycle_transitions.sql`, a
  column-scoped grant covering only the four lifecycle columns). Shopify's
  delta sync is now executable, not just a fixture object:
  `orchestrateShopifyDeltaSync` drives the current documented delta through
  9.1's real staged-file pipeline (dry-run → publish → canonical tables via
  `MigrationJobRepository.createJobFromRows`, factored out of
  `createFixtureJob` so both paths share one truth), checks
  `connectionAcceptsIngestNow` first, records a sync run and advances a
  cursor, and dead-letters on failure — triggerable from the retailer's own
  "Run Shopify sync" button. The delta content itself is documented fixture
  data, not a live Shopify Admin API call (live credentials would replace
  only the fetch step). Still missing before the whole item can be claimed:
  the reconciliation-report aggregate has no writer yet, and only the owner
  role has been exercised in a browser proof. Live provider proof is
  additionally blocked on credentials.
- Stage 9.3 is demand-led and blocked on prospect evidence.
- Stage 10.1 is `implemented_unverified` (takeover branch only — not on
  `main`): versioned library, pinned retailer copies, and the retailer
  mapping wizard (audience rules + target products) exist. Since: rehearsal
  (`rehearseCampaignActivation`) and activation into shared staff missions
  (`activateCampaignToStaffMissions`) are real, reusing `clienteling_opportunities`
  (PHASE 7.4) for missions via a new `campaign_id` column rather than a
  second staff-task table — outcome linking is inherited from that reuse.
  Customer placement already worked via the existing private-offers page
  once a campaign is active; no new write was needed there. Still missing:
  automated order-to-mission outcome linking, a correction path for
  post-activation mapping changes, and multi-role browser proof.
- Stage 10.2 is `implemented_unverified` (takeover branch only — not on
  `main`): the honeymoon order-to-delivery tracker is real — order-linked,
  idempotent, recomputed from live order status and variant inventory/lead
  time on every read, rendered on the customer's own order page. The
  owned-first seven-day domain logic (`composeSevenDayOwnedFirstPlan`) is
  real and tested but has no customer UI yet, since the existing
  `upsert_campaign_challenge_look` RPC still only accepts catalogue products
  — wiring it to owned wardrobe items is separate follow-up. The original
  `wip/stage-10-2-honeymoon` branch remains preserved and untouched at
  `ec58c8e00ec1d719c0cfbc2dbbc0d18730648cb5`; this work is a fresh port
  informed by reading it, not a merge of it.
- Stage 10.3 is `implemented_unverified` (takeover branch only — not on
  `main`): channel abstraction/threading already existed
  (`conversations`/`messages`, `MessagingRepository`, a real 3-pane retailer
  inbox, TableService guest channel) and was previously uncredited. Since:
  `MessagingRepository.linkOutcome` records a real appointment/order a
  conversation led to, mirroring `clienteling_opportunities`'s outcome
  fields. Missing: lookbook/proposal/quote attachments, confirmed note
  extraction, opt-out/failure suppression, multi-role browser proof.
- Stage 10.4 is domain-layer only, far from complete (takeover branch only —
  not on `main`): `evaluateRelationshipDateWindow` correctly recurs a
  customer's own date annually, across a year boundary, timezone-agnostic by
  design. One of nine named packages (`ANNIVERSARY_MOMENT_LIBRARY_V1`) is
  real; the other eight, UI wiring, and browser proof are not started.
- Stage 11.1 is domain-layer only, a small fraction of the item (takeover
  branch only — not on `main`): exception detection and a checksummed
  payroll export over the existing real `staff_time_entries`/`staff_shifts`.
  No pay-period/version/approval schema, export provider, RLS, UI or browser
  proof exist yet.
- Stage 11.2 is one slice of several (takeover branch only — not on `main`):
  the extra-mile recognition half is real, with schema, RLS (author pinned
  to the calling user; review restricted to manager+), domain checks
  (self-review, double-review and empty-coaching all refused) and a
  structurally-enforced absence of any leaderboard, plus a real
  `/staff/recognition` surface with a passing browser proof against the
  sandbox project. Missing: unified role home, tasks/promises/briefing,
  ten-minute closeout, and the employee profile surface.

## Stage 10.2 WIP salvage audit (2026-07-31)

Audited read-only at `ec58c8e`; the branch was neither merged nor modified.
Contents: migration `20260730340000_add_seven_day_and_honeymoon_packages.sql`,
pure domain `packages/domain/src/campaign/seven-day-honeymoon.ts` (+ tests),
`packages/database/src/repositories/honeymoon-programme-repository.ts` (+ unit
and security tests). The domain layer is pure with no `any`; the migration
carries `retailer_id` on both new tables, enables RLS, revokes from
`public`/`anon`, and hard-constrains `requires_payment_approval = false`.

The work is sound but **does not compile as-is**. It must not be merged until
repaired:

1. `packages/database/src/generated/database.types.ts` is unchanged, so
   `Database["public"]["Tables"]["honeymoon_programmes"]` and
   `…["honeymoon_programme_actions"]` do not exist and the repository fails
   typecheck. Regeneration needs `supabase gen types typescript --local`, which
   requires a running local Supabase (Docker) — `blocked_external` in any
   environment without it.
2. `packages/domain/src/index.ts` does not export `seven-day-honeymoon`, so
   `deriveHoneymoonActions` / `HoneymoonAction` / `HoneymoonLineTruth` are
   unreachable from `@paon/domain`.
3. `packages/database/src/index.ts` does not export
   `honeymoon-programme-repository`.
4. `CAMPAIGN_LIBRARY_KEYS` in `packages/domain/src/campaign/campaign-library.ts`
   still lists only `private_offer_member_fabric`, while the migration's CHECK
   constraint adds `seven_day_wardrobe` and `honeymoon_phase`.
5. `honeymoon_programme_actions` has no index on `(programme_id, retailer_id)`,
   so scoped action lookups sequential-scan.

Absent layers beyond the above: service/application layer, retailer UI,
customer UI, events/outbox, audit writes, and any browser proof. Stage 10.2
therefore remains **not started on `main`** and is not claimable at any
`verified_*` status. Its dependency Stage 10.1 is still
`implemented_unverified`, though the honeymoon tracker hangs off `orders` and
`customers` with a nullable `library_version_id`, so a repaired 10.2 could be
exercised without a pinned library version if its scope is limited to programme
tracking.

## Stages 11.3 through 16.5 (2026-08-01, takeover branch only)

Every remaining unblocked queue item from 11.3 to 16.5 now has a real
domain layer, real schema with RLS, and focused tests, and **none of them
has a UI or a browser proof**. All are recorded in `PHASE.md` as
`implemented_unverified`, and none is claimable at any `verified_*` status.
Read that as: the rules are enforceable and enforced, and nobody has yet
operated any of it through a browser.

Items: 11.3 coverage/swaps/ceremony/coaching; 11.4 announcements,
contributions, budgets, support catalogue; 12.1 MeasurementMonitor gate;
12.2 serialized production; 12.3 partner network; 12.4 supplier
intelligence; 13.1 stock ledger; 13.2 loss prevention; 13.3 POS and
returns; 14.1 corporate programmes; 14.2 cited recommendations; 15.1/15.2
partner attribution and rewards; 15.3 MunroMerchant; 15.4 audience studio;
15.5 governed release; 16.1/16.2 academy and media; 16.3 vertical-pack
framework (framework only — the pilot is deliberately not started, pending
prospect evidence); 16.4 store instrumentation; 16.5 Moonstruck.

Eight forward migrations were added (`20260801000005` through
`20260801000014`), all applied to the dedicated non-production Supabase
project via the Management API, with `database.types.ts` regenerated after
each.

The through-line worth knowing before reading any of it: in this tranche
most non-goals are enforced by **grants, CHECK constraints, absent columns
and absent tables** rather than by convention. Concretely —
`stock_ledger_entries` and `customer_measurement_versions` have no UPDATE
or DELETE grant on any role including `service_role`;
`network_attribution_events` and `advertising_events` have no `customer_id`
column at all; there is no support-resource usage log anywhere in the
repository and a test scans every migration to keep it that way;
`store_observations` has no `staff_id` and no biometric column;
`product_hypotheses` has no purchase-order column; `pos_payments` has
nowhere to put a card number; and the only party-shaped tables in the whole
schema are still the original two from 2026-07-19.

Test counts at this snapshot: domain 877, database 440, payments 26,
auth 22, ai 18, sms 3, email 2, utils 1 — **1,389 total**, up from 890.
Lint 12/12, typecheck 12/12, `format:check` clean, serial build clean.

## Current handoff

Next queue item on the authorized takeover branch: **R0.1 Environment truth
and safety containment**. Do not continue Stage 9.2 by default. See the Resume
Protocol and ADR-070.

On the takeover branch the queue is exhausted through 16.5, so the next
useful work is **depth, not breadth**: convert these slices into operated
features with browser proofs, starting with whichever surface a real user
will touch first. Stage 11.2's `/staff/recognition` is the only surface in
stages 11-16 that has one.

## 2026-08-01 takeover-branch snapshot

Everything in this section is true on `agent/grok-takeover-2026-07-30` only.
`main` is untouched at `5b77fd0e` and `wip/stage-10-2-honeymoon` at
`ec58c8e0`. **Work only on the takeover branch.** The charter's
"push to `origin/main`" line does not apply while this takeover is in force.

### Environments — TWO Supabase projects, and what that means

This is the most consequential thing to understand before touching anything.

**Stages 0 through roughly 9 were built and verified against the ORIGINAL
Supabase project. Everything from stage 10 onward — including every
`verified_local` claim on this branch — was built and proven against a
SECOND, dedicated, non-production project** (`lowlzpktpayiglckvfpi`,
ap-northeast-2), provisioned empty specifically for the takeover.

The credentials live in `apps/retailer/.env.local`, which is **gitignored**.
A fresh clone therefore has no database at all and no record that two exist.
Ask the founder for the project to point at before running anything.

Consequences, in order of how badly they can bite:

1. **The two schemas have diverged.** All 146 migrations were applied to the
   sandbox from empty. The original project has only the earlier ones. Do not
   assume a migration that is "in the repo" has run against whichever database
   you are pointed at.
2. **Clean-database proof is not incremental-upgrade proof.** The sandbox
   proves migrations 18–22 work on an empty database. It does NOT prove they
   apply safely on top of the original project's real data.
   `20260801000018` is the one to be careful with: it carries a **data
   backfill** (turning every `inventory_quantity` into an opening ledger
   receipt) plus triggers that rewrite a caller's write. It is guarded by
   `not exists` and an `idempotency_key` with `on conflict do nothing`, so a
   re-run should be inert — but it is still a one-way data event and deserves
   a dry run against a restored copy before it touches anything real.
3. **The test suites write real rows into whatever project the env points
   at.** The live integration and Playwright suites create locations,
   candidates, risk flags, sweeps and sales. On the sandbox this is fine and
   deliberate. **Pointing them at the original or production project would
   pollute it.** Check `NEXT_PUBLIC_SUPABASE_URL` before running
   `PAON_INTEGRATION=1` or Playwright, every time.
4. **Which project production/Vercel uses was never confirmed during the
   takeover.** Establish this before rotating any key or applying any
   migration, rather than inferring it.
5. **Migrations were applied with helper scripts at `/agent/tools/`, outside
   the repository**, because they carry a management token. Those scripts do
   not exist in a normal checkout. Use the Supabase CLI (`supabase db push`)
   or the dashboard SQL editor instead, and never commit a token.

### What is browser-proven

Eight items carry a `passed` browser proof plus live database assertions:
8.4, 9.1, 11.2, 11.3, 11.4, 12.1, 13.1, 13.2, 13.3. Only 8.4 and 9.1 are
checked `- [x]` in `PHASE.md`; the rest are `verified_local` with scope
deliberately still open, and a checked box is a completion claim requiring a
tranche evidence file.

Totals: ~1,400 unit tests, 67 live integration assertions across five suites
(`PAON_INTEGRATION=1`), 12 browser cases, lint/typecheck/format green.

### Stock is now one truth

`product_variants.inventory_quantity` used to be decremented independently by
`place_order` / `checkout_cart` while the till appended to
`stock_ledger_entries`, so a garment sold online was still promisable at the
counter and vice versa. Migrations 18–21 make the ledger the only writer and
the column a maintained projection of it (available across all locations,
clamped at zero). A direct write to the column is converted into the ledger
entry it should have been, so all 28 readers keep working and none can set a
figure the ledger disagrees with. `count_inventory_disagreements()` must
return 0 forever; non-zero means a new write path is bypassing the ledger.

### Known open, in rough priority order

- **The customer app's e2e suite has ~13 pre-existing rotted specs.** Verified
  unrelated to the stock work: the storefront product data is correct and the
  cart contains the expected item. The failures are drift between the
  founder's HTML template and what the specs expect, plus shared-context
  pollution. Needs its own pass.
- `/staff/roster` and `/services` are built but have never been operated.
  Every page operated so far has yielded at least one real defect.
- 12.2, 12.3, 12.4, 14.x, 15.x, 16.x remain domain-and-schema only.
- Four e2e specs use `@paon.test` addresses on paths that reach Supabase Auth;
  Auth rejects the reserved `.test` TLD. Use `AUTH_DELIVERABLE_DOMAIN` from
  the e2e fixtures for anything that sends mail.

### Blocked externally

- **Card payment activation** (ADR-062). `ACTIVATED_PAYMENT_PROVIDERS` is
  empty by design, so every card capture is refused. Cash is implemented as a
  tender rather than a provider integration — no PSP to approve, no card to
  refuse — which is what lets a shop trade today. The card-data refusal still
  applies to cash; the carve-out concerns provider approval, never what may
  be stored.
- **Supabase Auth email rate limits** without custom SMTP. Staff invites
  succeed or are refused with a rate-limit message; the spec asserts the happy
  path conditionally and annotates `blocked_external`.
- **RFID reader hardware** for a live 13.2 pilot.

### Security

The Supabase secret key was pasted into a chat transcript on 2026-08-01 and
**must be rotated**. Rotating it also requires updating the Vercel environment
variables or production breaks. This is hygiene only; nothing in the build
depends on the current value.
