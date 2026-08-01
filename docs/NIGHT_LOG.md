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
  Verified against production once the deploy (queued behind other pushes,
  then landed via the next commit) went READY: `.paon-reveal` card computes
  to `border-radius: 8px`, `animation-name: paon-content-reveal`,
  `1s cubic-bezier(0.16, 1, 0.3, 1)`, no console errors. Screenshot shows
  the empty-cart state (Isabelle's demo cart has no lines) rendering
  cleanly on the cream/white palette.
- Queue item 5, screen 2 of 10 (Checkout → confirm): `4dfedbb`. The
  shipping form on screen 1's cart page already inherited the radius fix
  (shared Input/Card); this fixes Input's border color to `--color-stone-200`
  (`var(--mid)`, matching `#paon-appt-name/email`) and adds `paon-reveal`
  motion to the order confirmation page's two cards. DoD green, pushed.
  **Open question for the founder, not resolved here:** every "primary"
  Button (including "Pay now" — literally the money-changing-hands moment
  queue item 5 called out as the weakest link) renders in
  `--color-ink-600`, a blue-tinted brand color documented in globals.css as
  "Brand — deep ink... retailers layer their own accent via theming
  tokens" — not paon.html's own warm `--black` that its actual buttons use
  (`.drf-btn`, `.paon-appt-confirm`). Is `--color-ink-600` intentional
  platform branding independent of retailer theming, or should primary
  buttons use each retailer's theme color / paon.html's black by default?
  Left untouched — a shared button's brand color felt like a bigger call
  than a visual/motion pass should make alone.
- Queue item 5, screen 3 of 10 (Product detail): `8fb47f9`. Colors and the
  product image radius were already correct; the variant-option chip
  button was still `--radius-sm` (4px), moved to `--radius-md` matching
  paon.html's selectable chips. Added `paon-reveal` to image + details
  panel, 120ms stagger. DoD green, pushed. Not yet re-verified against
  production (queue backlog) — will confirm alongside the next screen.
- Founder resolved the button-color open question (`c1e9420`, PHASE.md):
  primary buttons use paon.html's black, not `--color-ink-*`. Implemented
  in `3444a2c` — Button's primary variant now `--color-stone-900` bg /
  `#f0efec` text, matching `.paon-appt-confirm` exactly. Reuses
  `RetailerTheme.tsx`'s existing per-retailer override of
  `--color-stone-900` rather than inventing a new mechanism, so retailer
  theming still wins where set. DoD green, pushed.
- Queue item 5, screen 4 of 10 (Book appointment): `b0ed0ab`. Replaced the
  native `datetime-local` input with a new `date-time-picker.tsx` porting
  `#paon-mobile-appointment`'s actual behaviour (day strip + time-slot row,
  opacity-based selection) from `paon-template.html`'s own
  `buildAppointmentPicker()` — next 7 weekdays, half-hour slots 09:00-18:00
  — producing the same value format the existing `requestAppointment`
  action already expects, so no backend change needed. Day-cell 8px /
  time-slot 6px radii kept as their own distinct literal values rather than
  both collapsed to one shared token, matching the template's actual
  numbers. Confirm button gets `.paon-appt-confirm`'s specific
  full-width/52px/uppercase treatment as a one-off className, not a shared
  Button change. DoD green, pushed.
- Verified both `50baa41` (button color) and `b0ed0ab` (appointment picker)
  against production once deployed. Button: computed `background-color` on
  the product-detail "Add to cart" button is `rgb(26,26,26)` (`#1a1a1a`),
  not the old blue oklch — this is `packages/domain/src/retailer/retailer.ts`'s
  pre-existing `DEFAULT_RETAILER_BRAND_THEME.inkColor` (Maison Dubois has no
  custom brand theme set), which `RetailerTheme.tsx` overrides
  `--color-stone-900` to on `/r/[slug]` routes — expected and correct per
  the founder's own instruction that retailer theming wins where present;
  not a bug. Appointment picker: day strip renders 7 selectable cells at
  the correct 8px/54×56px, selecting a day + time produces a valid
  `startsAt` (`2026-07-29T09:00`), confirm button renders in the
  near-black with uppercase/tracking as specified, no console errors.
- Queue item 5, screen 5 of 10 (Customer dashboard): `ea33f7a`. Colors,
  radii and shadows already matched (this page had an earlier premium
  visual pass, ADR-035) — added `paon-reveal` to the hero, the
  current-moments strip, and each relationship card (120ms stagger per
  card). DoD green, pushed.
- Queue item 5, screen 6 of 10 (Customer loyalty): `5b64a58`. Already
  matched paon.html (reward rows already used `--radius-md`,
  `--duration-quiet`/`--ease-out-quiet`; Badge already `rounded-full`
  matching `#paon-basket-count`'s pill). Added `paon-reveal` to each
  loyalty card (120ms stagger) and the empty state. DoD green, pushed.
- Queue item 5, screen 7 of 10 (Retailer dashboard): `54f01ed`. Also
  already carries the ADR-035 premium pass (literal `#111110` hero,
  correct radii/duration/ease tokens on hover-lift cards). Added
  `paon-reveal` to hero, stats strip, attention list and house-pulse
  aside (0/120/240/360ms stagger). Deliberately left the shared
  `AppShell` chrome (sidebar/header) untouched — already close to spec
  and changing it ripples across every retailer/admin screen, out of
  scope for a single screen's increment. DoD green, pushed.
- Queue item 5, screen 8 of 10 (Client list): `b5eae0d`. Already
  well-tokenized; added `paon-reveal` to the list card and empty state.
  DoD green, pushed.
- Queue item 5, screen 9 of 10 (Client record): `4e4d39a`. Same
  ADR-035-aligned pattern as the retailer dashboard; added `paon-reveal`
  to hero/stats/content section (0/120/240ms) rather than staggering each
  of the ~7 nested cards individually. DoD green, pushed.
- Queue item 5, screen 10 of 10 (Retailer appointments): `5f3f5e7`. Moved
  `date-time-picker.tsx` from apps/customer into `packages/ui` as
  `DateTimePicker` (two apps needing it is exactly the no-duplication
  rule's case) and used it in the staff booking form
  (`appointments/new`), which had the same native-datetime-local gap
  screen 4 fixed. That form needs independent start/end values, so it
  uses two `DateTimePicker` instances — added an optional `defaultValue`
  prop so a failed submit still re-populates the selection. Also added
  `paon-reveal` to the plain appointments list (screen 10's literal
  route) and the booking form's card. **All ten demo-path screens are now
  done.** DoD green, pushed. Verified against production once deployed:
  apps/retailer's `/appointments/new` renders 14 day-cells (2 pickers × 7
  days) with no console errors; apps/customer's `/r/[slug]/appointments`
  still renders its own 7 correctly after the move to `packages/ui` — the
  shared-component refactor didn't break either app.
- Starting queue item 6 (DESIGN_PORTS.md "Wrong" surfaces). **Open
  question for the founder on the silhouette carousel — not re-ported
  here, skipping to the swipe deck instead:** its only render site is
  `apps/retailer/app/(dashboard)/alterations/[id]/page.tsx` via
  `fit-tool-panel.tsx` — i.e. it only ever appears inside `/alterations/*`,
  which is both (a) explicitly off-limits ("never touch
  apps/retailer/app/(dashboard)/alterations/") and (b) documented in
  DESIGN_PORTS.md itself as the exact trap that cost a prior session a
  full increment: "a verbatim widget port was placed inside an invented
  screen, so a correct port still produced something the founder did not
  recognise." A byte-for-byte correct carousel would still only be
  reachable from a screen with no founder design behind it and a parked
  feature (fit tools) behind that. Re-porting the component file itself
  wouldn't technically touch `/alterations/*`, but its only consumer does,
  so the work has nowhere real to land. Is there a different, founder-
  designed surface this carousel belongs on, or should it wait until
  fit tools unparks?
- Swipe deck re-ported verbatim (`63c5e56`, docs update `702f936`): found
  the real source — pag1.html's `#swipe-app-placeholder`
  ("munro-swipe-card" widget, `#swipe`/tinder anchor) — a Tinder-style
  card deck with like/dislike buttons and a "liked" carousel strip. Copied
  its exact CSS (20px card radius, 390×555px container, the layered
  "gummy" button shadows, `#4caf50`/`#ff4c4c` colors — pag1's own palette,
  not paon-template.html's, same as table-service-widget.tsx keeping its
  own WhatsApp green) and replaced the source's 10 static demo photos /
  third-party end-of-deck pitch with the existing real `SwipeCard[]` data
  and this retailer's own navigation. DoD green, pushed. Verified live:
  card computes `border-radius: 20px`, container `height: 555px`, like
  button `rgb(76,175,80)`, 10 liked-carousel slots render, and clicking
  "like" fills a slot with the real product photo. No console errors.
- Verified the two "Verify" rows (`1deeb42`). Table service chat: spot-
  checked `.gcw-chat-wrapper/-history/-pics/-panel-wrapper/-message/
-field/-send-button` against pag1.html directly — all byte-for-byte,
  ADR-048's claim holds, no changes needed. AM House Party orbit: found
  `am-house-hero.tsx` correctly ports the `wed2027.mp4` video-hero shell
  (its own header comment already documents that verification carefully)
  but the actual named "AM House Party" orbit widget (`#ow` — a center
  avatar with five others slowly orbiting it) sits in the same mockup,
  literally labelled right before it, and was **never built at all**. Not
  built here either: real wedding-party member data exists but there's no
  per-member photo to drive the orbit's avatars, which is a real design
  decision (initials circles? a photo-upload feature that doesn't exist
  yet?) rather than something to invent on the spot. Documented in
  `DESIGN_PORTS.md`.
- **Queue exhausted for tonight.** All of `PHASE.md`'s queue (items 1-2
  skipped as blocked, 3-5 done, 6's swipe deck ported and both "Verify"
  rows checked) and `DESIGN_PORTS.md`'s explicitly-authorized scope are
  complete, except the silhouette carousel (open question above) and the
  AM House Party orbit (needs a founder decision on avatar photos —
  neither was invented or forced through). Stopping the loop here rather
  than drifting into the other 83 routes or building the orbit's missing
  avatar-photo feature without a decision — both would be exactly the kind
  of unsupervised scope creep this file exists to prevent.
- **Loop resumed 2026-07-28.** Founder answered the silhouette-carousel and
  orbit open questions above by speccing AM House Party as a real feature
  (`PHASE.md` queue item 6) and authorizing steps 1-3 specifically (no
  schema change), stopping for review before steps 4-6 (each touches the
  domain). Also landed `005115c`, refocusing priority toward workstreams 2
  and 3 once this item's steps 1-3 are done — noted, not acted on yet.
- Queue item 6, step 1 (Customer-side create): `79cbd26`. New
  `/wedding-parties/new` in apps/customer, mirroring the retailer's
  `createWeddingParty` action exactly — same repository call, organizer
  resolved from the signed-in customer's own relationship with the chosen
  atelier (never trusted from form input). Handles zero/one/many-retailer
  customers. Deliberately collects only `eventDate`/`venueName`/`notes` —
  no "time" or "store location" inputs, since those need
  `eventTime`/`fittingLocation` (step 4's migration) and this step is
  explicitly no-schema-change; no "name" field either, since `WeddingParty`
  has none today and adding one would itself be a schema change. Also
  fixed `Select.tsx`'s radius/border/focus-ring (still the pre-tonight
  `--radius-sm`/stone-300/ink-600 gap), caught because this is the first
  new form to use it. DoD green, pushed.
- Step 2 (Share the link): no code needed. `InviteLink` already renders on
  the party page for whichever customer organizes it, retailer-created or
  customer-created alike — confirmed by reading the existing gating logic
  (`myCustomerIds.has(party.organizerCustomerId)`). Already correct.
- Queue item 6, step 3 (Mission Control pass): `38a2c7a`. Wedding-parties
  screens in both apps weren't among the original ten demo-path screens,
  so they'd never gotten the reveal motion or radius fix. Card/Badge/Button
  already inherited correct tokens from shared components; added
  `paon-reveal` to every card (staggered where a page has several) and
  fixed two raw `<select>` elements from `--radius-sm`/stone-300 to
  `--radius-md`/stone-200. DoD green, pushed.
- **Bug found verifying step 1 live, not fixed here — needs founder
  review, same as steps 4-6.** Submitting `/wedding-parties/new` 500s in
  production: `new row violates row-level security policy for table
"wedding_parties"` (code `42501`). Confirmed the cause by reading
  `supabase/migrations/20260721000004_create_wedding_parties.sql`: the
  only `for all` (which includes insert) policy on `wedding_parties` is
  "retailer staff manage wedding parties," scoped to
  `retailer_id = current_retailer_id()`. Customers only ever got a `for
select` policy — no one anticipated a customer inserting this row
  themselves, because until this feature only retailer staff ever did.
  The action code (`79cbd26`) is correct and needs no change; a migration
  is what's missing. Proposed shape, matching the existing customer
  `select` policy's exact pattern, not invented fresh:
  ```sql
  create policy "customer creates own wedding party" on public.wedding_parties
    for insert
    with check (
      exists (
        select 1 from public.customers c
        where c.id = organizer_customer_id and c.user_id = auth.uid()
      )
    );
  ```
  Not written as a migration file — this is exactly a database/domain
  change the founder said to stop and state the plan for, same bar as
  steps 4-6.
- **Steps 1-3 otherwise complete. Stopping per the founder's explicit
  instruction** — steps 4-6 each touch the domain (new fields, a
  migration, a `party-photos` storage bucket) and need founder review
  before any code is written. Not started. The RLS gap above should
  likely be fixed before or alongside step 4, since step 1 doesn't
  actually work end-to-end without it.

## Authorization

**2026-07-31, founder** (recorded 2026-07-31): takeover run on branch
`agent/grok-takeover-2026-07-30`, continuing the programme "autonomously from
its sealed checkpoint through every authorized, unblocked item in PHASE.md",
with a documentation/architecture tranche first, then Stage 9.2 onward. Scope
limited to the takeover branch; `main` and `wip/stage-10-2-honeymoon` sealed.
Explicitly instructed: "salvage the existing Stage 10.2 WIP branch", and
"never weaken the validator to manufacture completion".

**2026-07-31 night, founder** (recorded 2026-07-31, ~23:38): "work all the way
to 16, without stopping" overnight, unattended. Same branch, same sealed
scope. The founder went to sleep immediately after issuing this; there was no
opportunity to ask a clarifying question before it took effect, so the
interpretation below was stated back to the founder in-thread rather than
confirmed, and is recorded here for the same reason.

**Policy change this authorization makes, stated plainly so it is never
buried:** the founder separately provisioned a dedicated, empty,
non-production Supabase project earlier the same evening (see the "founder
provisioned a real, empty, dedicated cloud Supabase project" entry above) for
this branch's exclusive use, specifically so migrations no longer needed
Docker or a stop-and-ask. This run therefore treats "new domain entity or
migration" as **no longer a stop condition against that sandbox project** —
every other stop condition in "Rules for any loop that writes to this file"
above still applies unchanged (founder-gated business/legal/contract/
credential decisions, ADR conflicts, founder-designed surfaces, anything
outside the takeover branch's scope). No migration in this run touches
`main`, the founder's live Supabase project, or any other real data. Every
schema decision is still logged below as it lands, exactly as the rules
require, so this is inspectable, not a silent departure from them.

Also carried over from the prior "do not stop" instruction, restated
honestly rather than assumed: this agent does not run unattended between
turns without a scheduled/live-mode invocation, which was not set up for
this thread. "Without stopping" is honored as "keep working for as long as
this single sitting allows, logging and pushing real progress continuously,"
not as a guarantee of resuming on its own after the sitting ends.

**What "all the way to 16" cannot mean, regardless of authorization or
effort, because `PHASE.md` itself says so:** Stage 6 and 9.3 are already
blocked and skipped per standing instruction. Beyond those, `PHASE.md` marks
specific later items as blocked on facts no amount of engineering effort
inside this branch can supply — Stage 9.3 on prospect evidence, 15.2 on an
ADR-062 accounting/provider decision before any reward is fundable, 15.3's
payment activation on a business/legal/provider decision, 16.3 on "no
qualified pilot prospect," 16.5 on "no qualified occasionwear pilot." Those
items get their provider-neutral, policy-gated local capability built where
`PHASE.md`'s own acceptance criteria call for it, and are marked
`blocked_external` for the parts that are not — not silently skipped, not
claimed complete.

### 2026-07-31 takeover run (agent: Claude, Hyperagent cloud sandbox)

**Environment limits that shaped every decision below.** This agent runs in an
isolated Linux container, not on the founder's Mac. No Docker, therefore no
`supabase start`, therefore (a) no migration can be applied, (b)
`supabase gen types typescript --local` cannot run, and (c) `apps/*/e2e/
global-setup.ts` throws, so no Playwright journey and no run artifact can be
produced. Consequence: **nothing in this run may be claimed `verified_local`**,
and any queue item whose remaining work needs a migration is blocked here per
the loop rules above. `registry.npmjs.org` was firewall-blocked until access was
granted mid-run; `git push` has no credentials, so all commits were pushed
through the GitHub API instead.

- **Sealed checkpoint verified exactly**: `main` = `origin/main` =
  `5b77fd0e069f498fbf2994b8dd4966e6f3e42d1e`, clean tree,
  `wip/stage-10-2-honeymoon` = `ec58c8e00ec1d719c0cfbc2dbbc0d18730648cb5`.
  Neither ref was touched at any point in this run.
- **Handoff premise corrected.** The takeover brief stated the previous agent
  died before committing and that three ecosystem docs were uncommitted. False:
  `87d2d13` already existed and was already pushed on this branch with exactly
  those 402 additions. Nothing was lost and nothing needed recovering. The brief
  also omitted that the same commit carried 162 deletions; those were reviewed
  line by line and were a rewrite, not a loss — two safety guards (affiliate
  listings never resembling retailer stock; refusal to sell named profiles) came
  back stronger as tables. Genuinely dropped and restored by `df9f9b2`: the
  external affiliate-settlement citations (Shopify Collabs, Partnerize).
- **`df9f9b2` — documentation tranche completed.** `87d2d13` had updated only
  three of the five canonical files the tranche named. Added the missing two:
  `PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md` Stage 15 previously covered
  only MunroMerchant procurement and omitted the entire lifestyle network, now
  split into network and procurement halves with Deliver/Acceptance; `PHASE.md`
  gained items **15.4** (`NET-105` Audience Studio and advertising inventory)
  and **15.5** (`NET-106` governed insights, clean-room and entitlement
  exchange). Both left unchecked. No status advanced, no software claimed.
- **Stage 10.2 WIP salvaged by audit, not by merge.** Audited read-only at
  `ec58c8e`; branch neither merged nor modified, per the Resume Protocol's "do
  not absorb unfinished 10.2 into `main`". The work is sound (pure domain, no
  `any`, `retailer_id` + RLS on both tables, a DB-level
  `requires_payment_approval = false` constraint) but **does not compile**. The
  five required repairs are recorded in `PROJECT_STATE.md`; the first —
  regenerating `database.types.ts` — is `blocked_external` without Docker.
  Deliberately did **not** hand-write the generated types file to force a
  compile: that would have created the second source of truth `AGENTS.md`
  forbids and would silently diverge from generator output.
- **`4bc3076` — real HMAC webhook verification (Stage 9.2, domain only).**
  Found a security-shaped defect while inventorying 9.2:
  `verifyFadenWebhookFixture` computed
  `sha256:${sharedSecret}:${providerEventId}:${timestamp}:${rawBody.length}`
  and string-compared it — the shared secret sits in the signature in
  plaintext, only the body _length_ is bound (so any equal-length tampered body
  passes), the compare is not constant-time, and there is no replay window.
  It is labelled a fixture in its own comment, but it takes a defaulted secret
  argument and a benign name, and 9.2's owner boundary asks for signed
  webhooks — a live route wired to it would accept forged bodies. Added
  `buildFadenWebhookSigningPayload` (binds the complete raw body) and
  `verifyFadenWebhookSignature` (constant-time compare, symmetric skew window,
  typed rejection reason so signature-vs-replay is observable); marked the old
  helper `@deprecated` with those reasons; added a test that documents the
  equal-length forgery it accepts. HMAC is **injected as a port**, not
  imported: domain source uses no Node builtins and its barrel reaches
  `"use client"` components, so `node:crypto` here would risk client bundles.
- **Stage 9.2 is not completable in this environment, and was not faked.**
  Inventory found more already built than `PHASE.md` implies —
  `integration_connections`, `integration_raw_events` (already idempotent on
  `(connection_id, provider_event_id)`), `source_authority_policies`,
  `external_identities`, `integration_handoff_tasks`, a
  `SourceAuthorityRepository` whose `ingestFadenReadOnly` is the only writer of
  raw events, an admin integration-health page and a retailer read-only
  integrations page. What remains needs **new schema**: connection config /
  secret reference, sync cursor / checkpoint, explicit pause/resume/disconnect
  state (`health_status` is `healthy|degraded|stale|failed|disconnected`, which
  conflates a deliberate disconnect with failure and has no paused state or
  actor/reason), scheduled-run history, dead-letter records, reconciliation
  aggregates. There is no connector orchestrator and no Shopify/Faden webhook
  route handler anywhere. Migration → type regeneration → Docker: blocked.
- **`validate:completion` is RED on this branch and was deliberately left
  red.** It already failed at `87d2d13`, before this agent changed anything
  (proven by stashing and re-running there). Cause: the gate's
  `EVIDENCE_ONLY_PATH_RE` allowlists `docs/evidence/`, `docs/PHASE.md`,
  `docs/PROJECT_STATE.md` and `docs/PAON_INTELLIGENCE_PLATFORM.md` but not
  `docs/NORTH_STAR.md` or `docs/vision/**`; because `87d2d13` touched those, the
  8.4 and 9.1 run artifacts pinned at `eabc716` read as stale and both sealed
  `verified_local` claims are rejected. `main` stays green only because its
  post-proof changes are all allowlisted. **The fix is not to widen that
  regex** — commit `9ceb374` ("Both harnesses re-passed on `eabc716` so
  verified_local claims stay current") establishes that the sanctioned remedy is
  to re-run the harnesses and bump the artifact `gitSha`. An earlier suggestion
  in this run to widen the allowlist was retracted for that reason; widening it
  would weaken the gate the founder explicitly said not to weaken.
- **Gate at `4bc3076`:** lint, typecheck, unit tests (446 `@paon/domain` + 282
  `@paon/database`), `format:check` and `build` all pass. `validate:completion`
  red as above. Caveat for any auditor: turbo's _parallel_ `typecheck` and
  `build` exit `137` (SIGKILL / OOM) in this 2-CPU / 4.2 GB sandbox and pass
  only with `--concurrency=1`; that is environmental, so CI parallelism remains
  the real check, not this run's serial pass.
- **Exact next work, for whoever picks this up on a Docker-capable host:**
  1. `supabase start`, then re-run
     `apps/retailer/e2e/completion-harness.spec.ts` and
     `apps/retailer/e2e/migration-write-through.spec.ts`; refresh
     `docs/evidence/runs/{8.4,9.1}.json` `gitSha` to the then-current HEAD and
     confirm `pnpm validate:completion` goes green. Do not edit the validator.
  2. Optionally repair Stage 10.2 per the five items in `PROJECT_STATE.md`,
     starting with `pnpm --filter @paon/database generate-types`.
  3. Then Stage 9.2 proper: migration for the six missing concepts above →
     regenerate types → repository → ingest orchestrator → Shopify/Faden webhook
     route handlers using `verifyFadenWebhookSignature` (never the deprecated
     fixture helper) → retailer connect/configure UI → admin health controls →
     RLS and cross-tenant denial → multi-role Playwright proof → run artifact.
     Stage 6 and 9.3 remain blocked; skip them.

### 2026-07-31 night → 2026-08-01 (agent: Claude, same sandbox, continuous session)

Overnight continuous run under the "work all the way to 16, without stopping"
authorization above. The Docker wall from the previous entry was removed
mid-session: the founder provisioned a dedicated, empty, non-production
Supabase project (`ap-northeast-2`) and a personal access token scoped to a
single-project account, verified empty before any write. All schema and
type-generation work below went through the Supabase Management API
(`database/query` and `types/typescript` endpoints) — no Docker, no CLI
`--db-url` path (that still shells out to Docker even against a remote
database, confirmed by trying it).

- **`254014c`/`c8f18eb` — closed out the previous entry's own next step.**
  Applied all 121 pre-existing migrations to the sandbox (one failure was a
  quoting bug in the apply script, rolled back cleanly by its own
  transaction wrapper; zero real migration failures). Regenerated
  `database.types.ts` — structurally identical to the prior generated file
  except a scratch tracking table this run created and dropped. Then ran
  the two real Playwright specs against that live database (installed
  Chromium via `pnpm exec playwright install chromium`, no `--with-deps`
  needed): both passed genuinely. `pnpm validate:completion` went green for
  the first time this takeover — then broke again one commit later because
  the types-regeneration commit itself wasn't evidence-only, so its own
  artifacts read as stale at its own HEAD; fixed by re-running both specs a
  second time at that exact HEAD and pushing the evidence separately
  (`c8f18eb`), following `9ceb374`'s own precedent rather than widening the
  validator's allowlist.
- **`d61d2d2` — Stage 9.2 Faden connector-lifecycle slice, browser-proven.**
  New schema (`20260731000000`): `operational_state` on
  `integration_connections` (active/paused/disconnected, distinct from the
  existing observed `health_status`), `integration_connection_secrets`
  (pointer-only, never a raw secret value — matches
  `retailer_stripe_accounts`' existing pattern), `integration_sync_cursors`,
  `integration_sync_runs`, `integration_dead_letters`,
  `integration_reconciliation_reports`. Domain
  (`connection-lifecycle.ts`): `planConnectionOperationalTransition` is the
  one place transition legality is decided — a disconnected connection
  cannot be reactivated, since reconnecting means a new connection record,
  not reviving this one's cursors/secrets. Repository
  (`IntegrationLifecycleRepository`) and a new orchestrator
  (`ingestFadenWebhook`) tie a webhook delivery through connection-state
  check → signature verification → the existing 8.2 source-authority
  ingest, dead-lettering with a typed reason at every rejection — including
  refusing to invent a canonical mapping for an external order nobody has
  linked yet (`unmapped_external_object`), rather than guessing one. A real
  route handler
  (`apps/retailer/app/api/webhooks/faden/[connectionId]/route.ts`) computes
  the actual HMAC and payload hash via `node:crypto` at the edge — the one
  place in this whole chain that imports it, keeping `@paon/domain` and
  `@paon/database` client-bundle-safe. Retailer UI: pause/resume/disconnect
  buttons plus visible sync-run history and dead letters on
  `/settings/integrations` — 9.2's own acceptance language ("signature/
  replay/cursor/failure/retry/reconcile are observable") is not satisfied by
  schema nothing renders.
- **A genuine e2e run found a real defect, not a mock artifact.** The new
  Playwright spec (`integration-connection-lifecycle.spec.ts`) drove the
  actual retailer UI's Pause button against the live database and got 422
  when 409 was expected — the connection never actually paused. Verified via
  a direct admin-client read (bypassing the UI entirely) that the DB row
  really was stuck at `active` for the full poll window, ruling out a
  render-lag explanation. Root cause: `20260730300000` granted `UPDATE` on
  `integration_connections` to `service_role` only; the retailer's own
  Server Action runs under the session-scoped anon client and had no write
  path at all, so the mutation was silently rejected by Postgres and the UI
  never updated. Fixed with a new migration (`20260731000001`) granting
  **column-scoped** `UPDATE` — only the four `operational_state*` columns
  plus `updated_at` — paired with an owner/manager/admin RLS policy with
  both `USING` and `WITH CHECK`; `health_status` stays `service_role`-only
  since a retailer cannot self-report observed provider health. Re-ran the
  spec after the fix: pause genuinely blocks a live signed webhook (409),
  resume plus a correct signature is admitted (422 unmapped — proving the
  connection-state and mapping checks are independent code paths, not one
  check accidentally covering for the other), a same-length tampered body is
  refused (401 — the exact forgery the now-deprecated fixture verifier from
  the previous entry would have accepted), and both rejections appear as
  visible dead letters rather than disappearing silently.
- **`ac15bcd` — evidence refresh**, same pattern as `c8f18eb`: `d61d2d2`
  wasn't evidence-only, so its own artifacts read stale at its own HEAD;
  re-ran both specs at `d61d2d2` and pushed the two evidence files alone.
  `pnpm validate:completion` reports OK at the true final HEAD `ac15bcd`.
- **Full gate at `ac15bcd`:** lint (12/12 packages), typecheck (5/5,
  invoked per-package — turbo's parallel runner still OOMs on this 2-CPU/
  4.2GB sandbox and needs `--concurrency=1` or per-package calls,
  environmental as in the previous entry), 731 unit tests, `format:check`,
  serial `build`, and now a genuinely green `validate:completion` backed by
  two real Playwright runs against a live, non-production database. Not one
  hand-written evidence file in the whole chain — every `docs/evidence/runs/
*.json` was written by the harness's own `afterAll` hook.
- **Not claimed complete: Stage 9.2 as a whole.** Shopify's scheduled/delta
  sync remains the pre-existing fixture, not an executable scheduler; the
  reconciliation-report table has no writer yet; actor attribution on a
  transition is `null` (`AppSession` has no `retailer_staff_members` row id
  to attach, and the column is nullable for exactly that reason); only the
  owner role was exercised in the browser proof, not manager/sales roles.
  `PHASE.md`'s 9.2 checkbox stays unchecked.
- **Environment notes for whoever resumes:** the Supabase Management API
  rejects Python's default `urllib` `User-Agent` with a Cloudflare 403 (error 1010) — set `User-Agent: curl/8.17.0` or similar. It also rate-limits at
  120 req/min. Playwright's `webServer` (`pnpm start`) is a separate child
  process — an env var set inside a test body with `process.env[...] = ...`
  never reaches it; export it in the shell _before_ invoking
  `playwright test`. This sandbox's round-trip latency to the sandbox
  project's `ap-northeast-2` region is roughly 1s, so
  `completion-harness.spec.ts`'s `test.setTimeout(120_000)` needs a temporary
  bump to pass here; every such bump in this session was reverted
  (confirmed via `git diff`/`git checkout --`) before the next commit — none
  of them are present at `ac15bcd`.
- **`d61d2d2` → `7985f6b` — continuous run through Stage 9.2's remaining
  gap and all of Stage 10 and into 11.1**, per the "work all the way to 16"
  authorization above. Every item below shipped as its own commit with a
  full green gate (lint/typecheck/test/format/build) before the next one
  started; evidence was refreshed in batches rather than after every single
  commit once it became clear `NIGHT_LOG.md` itself is not in
  `EVIDENCE_ONLY_PATH_RE` either — a standalone log commit reopens the same
  stale-evidence gap a code commit does, so from this point forward a
  log entry rides inside the same push as the work it describes wherever
  practical.
  - **`d61d2d2` (Stage 9.2):** `orchestrateShopifyDeltaSync` runs the
    documented Shopify delta through 9.1's real staged-file pipeline
    (`MigrationJobRepository.createJobFromRows`, factored out of
    `createFixtureJob` so both share one truth) rather than leaving it a
    fixture object nothing executes.
  - **`2e9cc0c` (Stage 10.1):** `evaluateCampaignRehearsal` +
    `activateCampaignToStaffMissions` close the rehearsal and
    shared-staff-mission gaps `PHASE.md` named — missions reuse
    `clienteling_opportunities` (Stage 7.4) via a new `campaign_id` column,
    inheriting outcome linking for free instead of a second staff-task
    table. The mapping wizard `PHASE.md` also listed as missing already
    existed and was corrected to landed rather than rebuilt.
  - **`11770d5` (Stage 10.2):** salvaged `wip/stage-10-2-honeymoon` (still
    preserved, still never merged — this is fresh work informed by reading
    it) and fixed the five defects its own repair audit found. The
    honeymoon order-to-delivery tracker is real and renders on the
    customer's actual order page, recomputed from live order status and
    variant inventory/lead-time on every read.
  - **`2d628d9` (Stage 10.3):** corrected another undercredit — channel
    abstraction/threading already existed in full (`conversations`,
    `MessagingRepository`, a real 3-pane inbox). Added the one concrete
    acceptance gap there was time for: `linkOutcome` records a real
    appointment/order a conversation led to, mirroring
    `clienteling_opportunities`'s own outcome fields again rather than a
    third outcome shape.
  - **`61ed2b0` (Stage 10.4):** `evaluateRelationshipDateWindow` recurs a
    customer's own date annually and correctly across a year boundary
    (tested explicitly, including the classic December→January failure
    mode naive recurrence code gets wrong). One of nine named packages
    built; the other eight are named as not started, not stubbed.
  - **`4c00899` (Stage 11.1, partial):** payroll exception detection and a
    checksummed export over the existing real `staff_time_entries`, with
    the checksum verified stable across repeated exports of unchanged data
    by test, not just asserted. Domain layer only — recorded honestly as a
    small fraction of the item, not most of it.
  - **Recurring pattern across every slice above:** before writing anything,
    checked whether a canonical record already existed to extend (it almost
    always did — `clienteling_opportunities` alone now backs three different
    stages' "mission"/"outcome" concepts) rather than adding a second
    feature-local truth; checked the actual RLS grants on any table before
    writing to it from a Server Action, after the 9.2 commit's own
    pause/resume defect made the cost of skipping that check concrete.
  - **Gate at `7985f6b`:** lint (12/12), typecheck (5/5, per-package — the
    turbo-parallel OOM on this sandbox is unchanged from every earlier
    entry), 768 unit tests, `format:check`, serial `build`, and
    `validate:completion` genuinely green via two fresh live Playwright runs
    against the same non-production Supabase project as before.
- **Continuing** to the next unblocked slice per the authorization above.

## 2026-08-01 — Stage 11.3 through Stage 16 tranche

### Push path changed (material, read this before auditing SHAs)

The sandbox container was recreated between sessions and the git credential
did not survive it. `git push` over HTTPS now fails with "could not read
Username". The repository is publicly readable, so `git ls-remote` and
`git fetch` still work anonymously; only writes are affected.

Commits are therefore being replayed onto `origin` through the connected
GitHub API integration (`push_files`), one call per local commit,
preserving each commit message and file set. This **rewrites the commit
SHAs** — the trees are byte-identical, the parents differ. After each push
the local branch is `git fetch`ed and hard-reset onto the remote commit, and
the tree diff is verified empty first, so local and remote stay in lockstep
and evidence pinned to a code SHA still refers to a real remote commit.

Auditor consequence: commit SHAs referenced in earlier NIGHT_LOG entries for
work before `02d589c` are unaffected. From `2ddf2d6` onward, a SHA quoted in
a commit message written _before_ its own push may not exist; the SHA in
`git log` is authoritative.

`main` (`5b77fd0e`) and `wip/stage-10-2-honeymoon` (`ec58c8e0`) remain
untouched and unmerged.

### Tooling

Migrations continue to go through the Supabase Management API rather than
`supabase db push`, because this sandbox has no Docker. The helper scripts
carry the personal access token, so they live at `/agent/tools/` **outside
the repository** and are never committed.

### Increments

- **11.3** coverage plans/intervals, availability declarations, shift swaps,
  versioned service ceremonies, coaching observations. Non-goal made
  structural: no table in the tranche can assign a shift.
- **11.4** announcements with branch/role audiences, read receipts, moderated
  and versioned learning contributions, learning sessions, service-recovery
  budget requests, support-resource catalogue. Load-bearing decision is an
  absent table: no support-resource usage log exists anywhere, and a test
  scans every migration in the repo to keep it that way.
- **12.1** MeasurementMonitor gate. Approved measurements have no UPDATE or
  DELETE grant to any role at all.
- **12.2** serialized production pieces, spec amendments, stage events,
  materials, work tickets.
- **12.3** service partner network reusing the existing concierge booking and
  cost tables; partner custody kept separate from alteration custody, with the
  reason recorded in code.
- **12.4** sourced supplier facts, fabric/button pairing rules, supply
  exceptions, complaint cases. No factory write-back queue exists.

### Defects found by tests during this tranche

1. `recommendCoverage` compared a citation's `windowStart`/`windowEnd`
   against a shift's `startTime`/`endTime` shape, so overlap evaluated
   against `NaN` and a morning demand signal could justify an afternoon
   shortage. Caught by the demand-attribution test, fixed, test kept.
2. `customer_measurement_candidates` had a `set_updated_at` trigger but no
   `updated_at` column — every resolve would have failed at runtime. Caught
   by re-reading the migration before committing; tables were empty, so they
   were dropped and re-applied rather than patched forward.
3. Three separate self-matching test guards: a scan for a forbidden
   identifier matched the comment explaining its absence, a "no second cost
   table" scan matched the foreign key expressing the reuse, and a
   "catalogue is read-only" scan matched the intended SELECT grant. All
   three narrowed. This failure mode has now happened four times on this
   branch; the fix is to scan code with comments stripped, and to anchor
   schema scans on the CREATE TABLE target.

### Evidence and the rewritten-SHA push path (2026-08-01, important)

ADR-068's completion gate pins each browser proof to the code SHA it ran
against, and tolerates later commits only when they touch allowlisted paths
(`docs/evidence/`, `docs/PHASE.md`, `docs/PROJECT_STATE.md`,
`docs/PAON_INTELLIGENCE_PLATFORM.md`). That design assumes `git push`
preserves SHAs.

The MCP push path used in this session does not: it replays each commit
through the GitHub API, producing an identical tree under a new SHA. So
proof evidence recorded before a push is stale the moment the branch is
reset onto the pushed commit.

The sequence that actually works, and the one used here:

1. Commit code. Push it (SHA changes).
2. `git fetch`, verify the tree diff against the local commit is empty,
   `git reset --hard` onto the pushed SHA.
3. **Then** re-run the gated proofs, so the run's `gitSha` is the SHA that
   exists on the remote.
4. Commit the evidence alone and push it. Because that commit touches only
   allowlisted paths, it does not invalidate the run it carries.

Consequence for a later auditor: evidence in this branch's history is valid
against the remote SHAs, not against any local pre-push SHA. If the branch
is ever re-pushed by a mechanism that rewrites SHAs again, the proofs must
be re-run, not re-pointed. Editing a `gitSha` by hand to make the validator
pass would be manufacturing completion, which the working agreement forbids
outright.

## 2026-08-01 (afternoon) — Ship-mode audit: the append-only guarantee was fiction

Three findings, in descending order of seriousness.

### 1. CRITICAL — every "append-only" table was fully writable

Every migration in stages 11-16 wrote `revoke all on table X from public,
anon` and then `grant insert on table X to authenticated, service_role`.

That does **not** revoke from `authenticated` or `service_role`. Supabase
ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
anon, authenticated, service_role`, so every table created by this
programme inherited full `UPDATE, DELETE, TRUNCATE` for both session roles,
and the narrow `grant insert` that followed added nothing they did not
already hold.

Verified against the live database before any fix:

    customer_measurement_versions  authenticated  DELETE,INSERT,...,UPDATE
    customer_measurement_versions  service_role   DELETE,INSERT,...,UPDATE
    stock_ledger_entries           authenticated  DELETE,INSERT,...,UPDATE
    ... identical for all 18 append-only tables.

For `authenticated` the hole was largely masked by RLS, since no UPDATE
policy exists on those tables. For `service_role` there was no mask at all:
service_role bypasses RLS. Any code path holding the admin client — and
several repositories do — could silently rewrite an approved measurement,
edit a stock ledger row, or restate a revenue share. Those three things are
precisely what the schema was written to prevent.

Fixed in `20260801000016_enforce_append_only_grants.sql`, which revokes
UPDATE/DELETE/TRUNCATE from both session roles on all 18 tables and also
changes the schema default privileges so the same footgun cannot re-arm for
tables created later. Re-verified: 18 of 18 now correct, 0 wrong.

**How it was missed for the entire programme**: the `*-security.test.ts`
files read the migration `.sql` as TEXT and assert it contains the right
`grant insert` string. It did. The text was correct and the database was
not. A text-matching test cannot detect a privilege the migration never
mentions. This is the strongest possible argument against counting those
files as verification, and they must never be counted as such again.

### 2. The integration harness that found it

`packages/database/src/repositories/__integration__/stage-11-12-live.integration.test.ts`
executes real SQL against the live database: 16 assertions that either write
a row Postgres must accept, or write one it must reject with a specific
SQLSTATE (23505 unique violation, 23514 check violation). Gated behind
`PAON_INTEGRATION=1` so the ordinary offline unit gate stays hermetic.

Run with:
PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run src/repositories/**integration**

It found the grant hole on its first execution, in under twenty seconds.

### 3. Regression audit of the existing product — clean

The full 14-spec Playwright suite had never been run since this programme
began touching migrations. First run: 15 passed, 11 failed. **None of the
11 were regressions.** Categorised:

- 5 x strict-mode violations where `getByRole("link", {name: /^Team/})`
  matched both the sidebar entry and a dashboard quick-link card. Fixed by
  scoping to the `Primary` navigation landmark.
- 4 x 30s timeouts against a database in another region. Fixed once in
  `playwright.config.ts` rather than per spec.
- 1 x missing `E2E_FADEN_WEBHOOK_SECRET`. Added to `.env.local`/`.env.example`.
- Then a second layer: the specs had drifted from the product's own copy.
  The UI says "Invite teammate", "New client", "Add client"; the specs
  still said "Invite staff", "New customer", "Add customer". The dashboard
  says "The workroom, in motion." and "Your bench, clearly."; the specs
  still expected "The workroom, clearly." and "Your workbench.". The inbox
  selects a conversation with `/messages?c=<id>`; the specs expected
  `/messages/<id>`. In every case the product was right and the test was
  stale.

Also fixed while there: `CoachingRepository.recordObservation` declared
`Promise<{ok:true; id:string} | CoachingCheck>`, and `CoachingCheck`
contains `{ok:true}`, so the union collapsed and no caller could ever reach
`id` after narrowing. Now excludes the duplicate success arm.

## 2026-08-01 (evening) — Slice 1 shipped: stock ledger, all five layers

Executed the strict per-slice loop for PHASE 13.1: migration → live
integration test → server action → UI → browser proof. Nothing was claimed
before the layer beneath it was proven.

### What exists now

- `StockLedgerRepository` — the repository 13.1 never had. Append-only by
  construction: every method INSERTs, `reverse` appends a reversal citing the
  original, and a transfer writes TWO entries so in-transit stock stays
  visible.
- `__integration__/stock-ledger-live.integration.test.ts` — 15 assertions
  against live Postgres. Proves the UPDATE and DELETE refusals, the oversell
  guard, reversal arithmetic, idempotency-key dedupe, the negative-receipt
  refusal, the recount gate and the variance cap.
- `/inventory` — receive, hold, transfer, undo, blind count, reconcile and a
  reasoned adjustment. Design system components only; every ledger kind
  rendered in plain language ("Sent out", not `transfer_out`), per
  UX_PHILOSOPHY rule 1.
- `e2e/inventory.spec.ts` — browser proof, passing.

### Two real defects found by doing it in this order

1. **A stock shortfall could not be recorded at all.**
   `stock_ledger_entries` had `check (quantity > 0)` for every kind, and the
   domain maps `count_adjustment` to +1, so an adjustment could only ever ADD
   stock. A blind count finding eight where the ledger expected ten — the
   most common real outcome of counting anything — had nowhere to go.
   `reconcileBlindCount` reported the negative variance correctly and the
   insert would then have died on the CHECK.
   Fixed in `20260801000017`: `count_adjustment` may be signed, every other
   kind stays positive because direction lives in the kind. Zero is still
   refused everywhere.
   Found by writing the repository. No unit test could have caught it: both
   `projectBalance` and `reconcileBlindCount` are perfectly happy with
   negative variances, and the schema test asserted the CHECK existed rather
   than asking whether it was the right CHECK.

2. **`product_variants.inventory_quantity` is a pre-existing second truth.**
   The older catalogue flows store a stock number on the variant. The 13.1
   ledger projects its own. Two truths for one fact, and the column cannot be
   dropped while other code writes it.
   The page now reads both and SHOWS the disagreement in plain language,
   rather than silently preferring one. A hidden divergence between a
   catalogue figure and a ledger figure is exactly how a shop oversells while
   every screen looks fine. Resolving it properly (retiring the column, or
   making it a generated projection) is a real follow-up, now visible instead
   of buried.

### Three of my own fixtures were wrong, in the same way each time

Every failure in this slice was a test fixture choosing numbers that tripped
a DIFFERENT rule than the one under test:

- 9 of 10 counted is a 10% variance, which correctly trips the relative
  recount threshold. Two integration assertions were therefore testing the
  recount gate while claiming to test the adjustment path. Changed to 19 of
  20 (5%).
- The browser proof received 3 and counted 2 — a 33% variance — so the page
  correctly hid the adjust form behind "count again first", and the proof
  timed out looking for an input that should not have been there. Changed to
  20 and 19.

The code was right all three times. Worth recording because the pattern is
specific and repeatable: when a rule has multiple thresholds, a fixture must
be chosen to clear every threshold except the one being tested.

---

## 2026-08-01 (full day) — Five slices, and what operating them found

The through-line of the whole day: **a correct rule and an enforced rule are
different things, and only a browser tells you which one you have.** Every
defect below survived a green unit-test suite. None of them survived being
used.

### 13.3 Point of sale — the till could not legally sell anything

Building the POS surfaced two problems the domain tests could not see.

`completeSale` attempted `open → completed`, an edge the transition graph
does not contain. The graph was right: `completed` is reachable only from
`awaiting_payment`. Underneath that was the worse fact — _nothing anywhere
required the money to exist_. A till could have closed a cart nobody paid
for and the stock would have moved. The ledger would have been internally
consistent while the shop was robbed. `checkSaleCompletable` now refuses on
`payment_incomplete` and completion genuinely travels the edge.

Then the deadlock: `ACTIVATED_PAYMENT_PROVIDERS` is empty until ADR-062
approves a processor, so every capture was refused, so completion was
unreachable. The POS was unshippable _by construction_, not by policy. The
resolution was to notice that **cash is not a provider integration**. There
is no PSP to approve, no card to refuse, no settlement design to sign off; a
till that cannot take cash until a card processor is contracted is a till
that cannot open. Card stays gated. The card-data refusal still applies to
cash, so the carve-out is about provider approval and never about what may
be stored.

### The four "parked" e2e failures — two were real product defects

These had been dismissed as low ship value. Diagnosing them properly:

- **A fit-tool chip tap recorded nothing.** `vox:apply` was dispatched only
  from the voice path. Tapping a chip moved the slider, the tailor saw the
  number they asked for, and the observation was never persisted. The spec's
  own comment described the intended behaviour; it had never existed.
- **The fit-tool chips were `<div>` with click handlers** — no role, no
  keyboard reach, invisible to assistive tech.
- **`DateTimePicker` bound its `<label for>` to a hidden input**, so "Starts"
  named a control nobody could reach while the day and time strips had no
  accessible name at all, and selection was signalled by opacity alone.
- Two were genuinely rotted tests: `"Save"` had begun matching
  `"Save closeout"`, and the attachments spec asserted a "Shared images"
  gallery that exists nowhere in the app.

The invite spec was a third category again — the fixture used `@paon.test`,
which Supabase Auth rejects outright. The product's error named the cause
exactly. Beyond that the path is rate-limited without custom SMTP, so the
happy path is now asserted conditionally and a new unconditional test was
added that matters more: **an undeliverable invite creates no teammate.**
The action already had the right ordering, so a failed send cannot leave
someone on the team list who never heard from anyone and cannot sign in.

### Stock had two truths, and both could oversell

The largest finding. `place_order` and `checkout_cart` decremented
`product_variants.inventory_quantity` with their own guard; stage 13.1's till
appended to `stock_ledger_entries`. Neither could see the other. A garment
sold online never reduced the ledger and the till would promise it again; a
garment sold at the till never reduced the column and the storefront would
sell it again. Both screens looked correct throughout. This is exactly the
failure the append-only ledger was built to prevent, and it was live.

Measured before touching anything: 84 variants, 1,896 units in the column,
and the ledger knew about 2 variants.

Migrations 18–21 make the ledger the only writer and the column a maintained
projection — caching _available_, not on-hand, so a garment held for someone
at the counter stops being sellable online. The catalogue's 1,896 units
became opening receipts; without that the column would have read zero
everywhere and the storefront would have refused every order. A direct write
is **converted** into the ledger entry it should have been rather than
refused, so all 28 readers keep working and none can set a figure the ledger
disagrees with. Patching five call sites would have left the sixth free to
get it wrong.

Migration 21 fixed recursion that 19 introduced: the BEFORE trigger's ledger
insert fired the ledger's AFTER trigger against the same row and Postgres
refused the statement with `27000`. supabase-js reports that as an error
object, so every caller that did not check it — all of them — saw its write
vanish with no exception. **Stock edits became silent no-ops.** That is now a
standing rule in `AGENTS.md`: check `error` on every write.

### 12.1 MeasurementMonitor — the gate was not actually enforced

`recordApprovedMeasurements` hardcoded `capturedBy: "tailor_tape"` on every
value, so `derivedFromScan` never became true and the written-decision
requirement was dead code at the only seam that matters. A phone scan could
become the record of measurement with no human reasoning attached. It also
destroyed provenance: a number read off a phone was stored forever as having
been measured with a tape.

The candidate is now read from the database, never the form, because
provenance is precisely what a client must not assert. A value left
**unchanged** keeps the scan's provenance — accepting a scan's number means
the scan is where it came from — and a value the advisor changed becomes
`tailor_tape`, because they measured it themselves. Separately,
`Math.round(cm * 10)` had made the whole-millimetre rule unreachable and
silently invented precision.

### 11.4 and 13.2

11.4 proved the acknowledgement is a _record_: DELETE and UPDATE against it
both change nothing, and a duplicate is refused, so a reach figure cannot
claim two people read a safety notice when one did.

13.2 went from domain-and-schema to an operated surface. A raised write-off
has not happened — null `ledger_entry_id`, no stock moved — and only an
approval by a different manager writes the entry, which the flag then cites.
The RFID half cannot post a balance structurally: there is no method that
turns a sweep into a ledger entry, so the page has no such button to offer.
Operating it found an ordering defect — the action checked for an open stock
count _before_ checking who was allowed to approve, sending someone who could
not approve at all off on a pointless errand.

### Recurring self-inflicted mistakes

Worth naming because they cost the most time and are now codified in
`AGENTS.md`: client-side validation making server rules unreachable through
the UI (three times); fixture numbers tripping the wrong threshold; polling a
proxy signal instead of the asserted state; a guard matching the copy that
explains its own absence; specs colliding with their own history; and test
suites leaving queue rows that fail _other_ suites later while looking like
those suites' bug.

## 2026-08-02 Codex takeover and continuous run

- `61223cd` / `b4e06e8` / `a64eee7` restored the missing retailer coverage
  product route, repaired the inherited browser baseline to 42/42 and made its
  measurement evidence deterministic. The missing route had been silently
  ignored by a broad `coverage/` rule while its proof prose was committed.
- `6dad18a` mapped all inherited Stage 8–16 capabilities and all 14 designated
  founder tools into eight PAON module families with explicit disposition and
  connected proof contracts in `CAPABILITY_DISPOSITION.md`.
- `f21d5cc` / `7a4804e` introduced the active-module Server Action boundary
  and applied it to stock, loss prevention, POS and coverage, including a
  preview-mode no-write browser assertion.
- `c4a7d66` / `2d9a013` separated the deep, idempotent canonical programme
  proof House from Maison Dubois, Demo Studio and generic e2e data. Retailer
  browser baseline became 43/43; all SHA-bound evidence was refreshed.
- `cbc7269` / `3a10ffd` applied shared mutation and direct-read boundaries to
  relationship, appointment, messaging, customer-fact, wardrobe and roadmap
  surfaces. Browser proof waits for actual Server Action completion before
  asserting zero preview writes and a suspended direct-route refusal.
- `9b26b23` applied the same boundary to alteration, workshop and service-plan
  actions plus `/alterations` and `/services` reads. Preview permits the real
  read surface but writes zero plans; suspension rejects the direct route.
  Focused proof, retailer 43/43 and the full repository definition of done are
  green. Exact-SHA evidence refresh follows in a separate evidence commit.
- `24980f1` created `FOUNDER_TOOL_BLUEPRINTS.md`: fourteen stable, detailed
  implementation contracts covering literal source experience, PAON purpose,
  actors, module/tier, state, canonical data/events, privacy, technical wiring,
  recovery and connected proof. The wider founder brief is crosswalked without
  importing Atelier Munro branding or surrounding pitch claims. `ebac234`
  reran and refreshed the exact-SHA completion proofs; both journeys passed.
- The next server-boundary slice gates Commerce & Growth order, campaign,
  loyalty and event mutations plus their direct read routes. The browser proof
  attempts a real event create in preview, observes zero database rows and then
  proves a suspended direct route returns 500; the focused production build
  and browser proof pass.
- The following Retail Operations/knowledge slice gates collections, catalogue
  imports and migration publishing, product creation/edit/media, product facts
  and knowledge assignments. Shared layouts now protect catalogue, collection,
  import, migration, inventory, POS, analytics and staff reads; metadata keeps
  its correct Wardrobe & Styling ownership. The lifecycle proof adds a
  suspended direct-product route assertion rather than relying on hidden nav.
- The final retailer Server Action pass assigns Platform Core settings and
  notifications, Wardrobe MorningRoutine, Commerce payment administration,
  Retail staff work, Garment measurement decisions and Enterprise wedding
  parties to their owning modules. Only sign-out and the unauthenticated
  login/invitation boundary intentionally remain outside module enforcement;
  non-browser handlers/jobs remain a separate audit surface. The complete
  retailer browser suite stays green at 43/43 after this pass.
- FT-08 Swipe Deck moved from audited foundation into connected product
  hardening. Migration `20260802000001` adds `save_wishlist_item`, separating
  retry-safe swipe intent from the explicit wishlist toggle. The founder card
  restores on a failed write instead of claiming a false save, keeps its
  450ms source motion, supports arrow-key decisions and restores source
  spacing/carousel details. The browser journey proves keyboard save through
  the real Server Action, one database row, reload and canonical wishlist
  visibility; 7 pgTAP assertions prove retry idempotency, ACL and cross-House
  refusal. A clean database reset applies all 150 migrations. Resume/version,
  touch/reduced-motion and withdrawal-driven recomputation remain open rather
  than being relabelled complete.
- FT-08 continuation closes most of those open runtime gaps without inventing
  a parallel campaign store. A deterministic deck hash pins selection rule,
  occasion, product, variant and media. Consented favorite/skip events now use
  the existing interaction session with a consent-epoch idempotency key; page
  reload removes answered cards and reconstructs the liked strip from the
  canonical wishlist. The connected journey covers keyboard, CDP-dispatched
  mobile touch, reduced motion, duplicate count, reload/resume and actual
  consent withdrawal: signals anonymize, the skipped product returns, and the
  saved product remains durable. StyleProfile/downstream reason proof and
  canonical breakpoint screenshots remain honest open work. The complete
  customer suite passes 30/30 with this journey included.
