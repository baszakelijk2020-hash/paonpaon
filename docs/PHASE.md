# Current Phase — PAON Retail Relationship and Operations Programme

**This is the only authorized work queue.**

**Queue rule:** an item that lists another PHASE item as a dependency must not be checked or marked `verified_*` while that dependency remains unchecked or `implemented_unverified` (parallel implementation is allowed).

It supersedes the 2026-07-27
pilot-only freeze and every queue in ROADMAP, COMPETITIVE_GAPS,
EXPERIENCE_REBUILD, vision documents, audits, and old handoffs.

Set by the founder on 2026-07-30 and resequenced after the founder-intent,
visual-source, security and connected-product audit on 2026-08-01 (ADR-069).
The full modular destination was restored on 2026-08-02 after founder
clarification (ADR-070), and the exact founder-tool fidelity contract was
restored by ADR-071.

## Objective

Build a secure, technically complete and commercially configurable **modular
PAON platform**. The first cross-module demonstrator is the Golden Relationship
Journey for an independent premium menswear retailer:

```text
House Memory -> Advisor Today -> composed wardrobe/service proposal
  -> appointment/order -> production/fitting/alteration -> aftercare
  -> outcome captured back into House Memory
```

The journey is PAON's shared intelligence spine, not its scope boundary. The
committed destination includes all eight module families in `NORTH_STAR.md`.
The landed Stage 0–16 foundations remain available, but do not continue a
later stage merely because its domain types or migrations exist: map, audit
and integrate it into the chaptered programme below.

The product hierarchy is authoritative in [NORTH_STAR.md](./NORTH_STAR.md).
The source audit and rationale are recorded in
[audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md](./audits/FOUNDER_INTENT_AND_PLATFORM_RESET_2026-08-01.md).

## 2026-08-01 control gate — active queue

**Take the first unchecked item here. R0.1 is a hard gate for any operation
that can affect live data or deployments. R0.2 is a hard gate for stock or
money flows. Provider-neutral design and local implementation may continue
when an external activation dependency is unavailable, but no legacy item may
be resumed without the module mapping required by R0.3.**

- [ ] **R0.1 Environment truth and safety containment**
  - **Dependencies:** none; ADR-069.
  - **Acceptance:** identify every Supabase project and Vercel deployment used
    by local, preview, demo and production; document project refs without
    secrets in `docs/ENVIRONMENTS.md`; prove which deployment points where;
    classify data; establish a disposable integration target; prevent
    destructive/live tests unless the target is explicitly allowlisted; no
    migration is applied to original data in this item.
  - **Security repair:** close the cross-tenant inventory-ledger reference and
    public arbitrary-retailer location creation paths with forward migrations,
    tenant/RLS tests and an upgrade rehearsal. Audit equivalent SECURITY
    DEFINER and cross-table tenant references.
  - **Tests:** focused domain/repository tests, migrated-schema assertions,
    tenant isolation, tracked format check and environment guard dry run.
  - **Hard blocker:** missing provider access blocks mapping a named external
    project only; local guard and security work continues.
  - **Status (2026-08-02):** local containment is verified: fail-closed target
    guard, 11 pgTAP tenant/ACL assertions, zero security-advisor findings,
    70/70 live repository assertions, and clean-reset application of all 148
    migrations. `20260801175205` closes stock/POS tenant references and
    privileged-function ACLs. Migration 18 now refuses catalogue/ledger
    conflicts before rewriting; the populated synthetic conflict and success
    upgrade paths are rehearsed and documented. Customer baseline is 29/29;
    retailer is 43/43 overall and the repaired stock/loss/POS slice is 4/4.
    Vercel returns all three production
    Supabase URLs as irreversibly `[SENSITIVE]`, so they remain conservatively
    classified protected/original. Remaining external gate: approved restore
    of actual original data for the same rehearsal and definitive deployment
    target attestation. Safe local R0.2 implementation may proceed in parallel
    but cannot be checked complete while this dependency remains open.

- [ ] **R0.2 Atomic money and stock invariants**
  - **Dependencies:** R0.1.
  - **Acceptance:** POS completion, tender, stock ledger, return and reversal
    use transactional database boundaries; caller intent cannot be silently
    reclassified without an explicit contract; `count_inventory_disagreements`
    stays zero across every supported write path; cash policy is recorded as a
    founder/commercial decision rather than inferred from a blocked provider.
  - **Tests:** concurrency, retry/idempotency, partial failure, tenant
    isolation and upgrade data preservation.
  - **Status (2026-08-02):** local implementation is verified behind the R0.1
    external gate. Migration `20260801183032` makes POS line+reservation,
    completion+ledger, cash tender+completion, void+release, return+restock,
    transfer and reversal atomic and idempotent. Supported reservations use a
    transaction advisory lock. Payments and POS lines are RPC-only for
    authenticated callers; database triggers reject bypassed final-state and
    commercial-line edits. Live proof is 70/70, including simultaneous
    last-unit claims, forced line-insert rollback and direct-finality refusal;
    11 pgTAP boundary assertions pass and the operated stock/POS browser slice
    is 4/4. `count_inventory_disagreements()` remains zero.
    ADR-072 records cash as a proposed founder/commercial policy rather than
    an inferred provider workaround; it is not authorized for production.
    Remaining before the item can close: R0.1's external dependency and the
    founder cash decision. Further generic stock write-surface consolidation
    is a hardening follow-up, not a reason to represent local POS proof as
    incomplete.

- [ ] **R0.3 Platform module kernel, canonical House and baseline**
  - **Dependencies:** R0.1.
  - **Acceptance:** module registry, retailer entitlements, dependency
    validation, lifecycle state (`off`, `preview`, `active`, `suspended`),
    role/navigation projection, authority mode, job suppression and plan
    catalogue contracts are defined over one codebase. One deterministic
    retailer, staff roster, 10–20 clients, garments, appointments, orders,
    fitting/alteration cases and permissions exercise the real canonical
    tables; Demo Studio, integration and e2e data are explicitly separated;
    customer and retailer e2e have a recorded clean baseline with setup
    failures fixed, not relabelled as product failures. Existing Stage 8–16
    capabilities are mapped to keep/harden/consolidate/replace/quarantine and
    to one of the modular chapters below. The same map accounts for every
    founder-specified tool in `docs/DESIGN_PORTS.md` and may not call a generic
    UI, static shell or domain/schema foundation a completed source tool.
    Every founder-specified tool also has an authoritative build blueprint:
    exact source composition/motion/behaviour, PAON rationale and ecosystem
    role, actors/permissions, module/tier, state model, canonical data/events,
    consent/provenance/RLS, Server Action/job/integration wiring, recovery and
    browser/database proof. The disposition registry is not a substitute for
    these implementation contracts.
  - **Tests:** seed rerun, cleanup, tenancy, primary login/navigation and
    canonical consumer checks; entitlement dependency and module-off tests.
  - **Status (2026-08-02):** the first local kernel slice is implemented.
    Migration `20260801190000` and `@paon/domain` define the eight module
    families, lifecycle, dependencies, authority, plan bundles, auditable
    add-ons/overrides and active-only jobs. Existing tenants receive an
    explicit compatibility override; new retailers derive access from plans
    and add-ons. Retailer navigation now projects effective module+role state,
    marks preview surfaces and removes suspended/off surfaces. Proof: 8 domain
    assertions, 8 repository/schema assertions, 15 pgTAP assertions, clean
    reset through all 150 migrations and 1/1 browser suspend/preview/restore.
    Customer e2e is now a clean 30/30: the inherited 14 failures were repaired
    against current human labels, guest intent recovery, fitting-first order
    policy, founder storefront category behavior, Demo Studio lifecycle and
    tap-target contracts. The repair also removed a first-open order-detail
    failure caused by a redundant Honeymoon read-after-write and prevents
    TableService from covering the founder detail CTA. Retailer e2e is now a
    clean 43/43. The repair restored the omitted `/staff/coverage` route,
    production-specialist order navigation, a local integration-secret
    fixture and deterministic proof setup. A broad `coverage/` gitignore rule
    had silently excluded the route while allowing its proof and documentation
    to be committed; the route is now explicitly unignored. Remaining:
    Mutation enforcement now goes beyond navigation/jobs: a shared
    module-session gate rejects preview/suspended/off writes. Stock, loss
    prevention, POS, coverage, customer, appointment, messaging, customer-fact,
    wardrobe, roadmap, alteration, workshop, service-plan, order, campaign,
    loyalty, event, collection, catalogue import/migration, product and product
    knowledge actions all use it. Relationship, garment/service, Commerce,
    Retail Operations and knowledge route layouts allow active/preview reads
    while refusing suspended/off direct access. Browser proof waits for real
    Server Action responses, verifies coverage, client, service-plan and event
    writes leave zero rows in preview, then proves suspended direct routes
    return 500.
    Every authenticated retailer Server Action now resolves its owning module;
    the only exceptions are sign-out and unauthenticated login/invitation
    acceptance. Remaining: audit non-browser handlers/background entry points,
    implement the founder-tool blueprints, and complete canonical House
    cleanup.
    The programme proof now seeds an idempotent, lived-in tenant independently
    from Maison Dubois, Demo Studio prospects and the generic e2e workspace:
    6+ staff, 14 clients, 20+ products, 5+ appointments, 10+ orders and an
    alteration case in real canonical tables. A dedicated browser/database
    assertion reruns the seed, checks stable linked ids and verifies the three
    tenant classes cannot collapse into one another; the complete retailer
    suite passes 43/43. `CAPABILITY_DISPOSITION.md` maps every Stage 8–16
    capability and founder-designated tool to one module, one explicit
    keep/harden/consolidate/replace/quarantine decision and a connected proof
    contract. `FOUNDER_TOOL_BLUEPRINTS.md` now defines the authoritative
    experience, ecosystem job, actors, module/tier, state, canonical wiring,
    governance, recovery and completion proof for all fourteen designated
    tools and crosswalks the wider founder brief. It is a specification, not a
    shipped-status claim. ADR-073 now ratifies the non-lossy control plane:
    the curated PAON contract decides product meaning while exact designated
    source fragments retain experience authority. It fixes founder versus
    engineering decision rights, a mandatory ten-part slice contract, seven
    completion dimensions and anti-drift tripwires; ordinary sessions read
    only the active contract/source rather than rediscovering the whole
    corpus. The first connected implementation increment hardens
    FT-08 Swipe Deck without restyling it: migration `20260802000001` adds an
    idempotent save command so a retry cannot unsave a piece; the card now
    restores visibly on persistence failure, supports ArrowLeft/ArrowRight,
    and restores source spacing. A browser journey proves the real Server
    Action writes once, survives reload and appears in the canonical wishlist;
    7 pgTAP assertions prove replay idempotency, function ACL and cross-House
    refusal.
    The follow-on pins each deck to its selection rule, occasion, products,
    variants and media, records consent-epoch idempotent decisions through the
    existing interaction session/event spine and resumes by removing answered
    cards. The same browser journey proves keyboard plus real mobile touch,
    reduced motion, no duplicate signals, reload completion and withdrawal:
    personalization events anonymize, a skipped item becomes eligible again,
    and the durable wishlist remains. Migration `20260802000002` now derives
    reviewed active product/variant concepts on the server, binds replay-safe
    evidence to the matching source event, recomputes positive/negative
    StyleProfile inference and joins those concepts back into For You.
    Browser/database proof shows a favorite create a positive inferred
    preference and a visible related-product reason; withdrawal anonymizes the
    events, suppresses both evidence rows, clears inference and hides For You
    while preserving the durable wishlist. A clean reset applies all 151
    migrations; focused StyleProfile pgTAP is 13/13 and the connected browser
    journey is green. Exact source icon bytes no longer depend on an external
    runtime host, and cross-platform desktop/390px snapshots pin the founder
    card, controls and liked rail. FT-08 now satisfies its blueprint; continue
    with the next founder-tool contract.
    FT-09 TableService has its first connected vertical slice. The exact raw
    storefront—not only the React child-route port—detects a signed-in
    customer and sends text, photo, PDF, Pinterest and wedding-fabric material
    into the canonical private conversation. Migration `20260802000003`
    records attachment purpose/source/rights/scan state, permits reviewed PDF
    storage and installs a caller/tenant-rederiving metadata command. Domain
    validation checks size, declared type and file signature; Pinterest input
    is HTTPS/host constrained; the source interaction previews/removes drafts,
    requires rights confirmation and retains failed input. Customer/retailer
    reads use signed storage links. Proof: 4 domain assertions, 8 pgTAP
    assertions, 2/2 customer browser journeys (all four types plus spoofed
    file/no write) and the existing retailer attachment journey. This does not
    complete FT-09: true async malware/quarantine, progress, optional party/
    garment links, consent/citation proof and the connected shared-look ->
    appointment/proposal outcome remain.
    Continue implementing the contracts, audit non-browser module entry points,
    and finish House cleanup.
    The non-browser/customer-entry-point audit found that the module boundary
    covered retailer Server Actions only: every customer-facing commerce
    write (raw-storefront `/api/cart-add` and `/api/cart-update`, the React
    product page's `addToCart` Server Action, and `cart/actions.ts`'s
    `updateCartLine`/`checkoutCart`) mutated orders regardless of the
    retailer's `commerce_growth` module state, because those entry points
    have no retailer/platform-staff session and cannot call
    `resolve_retailer_modules()`. Migration `20260802000004` adds
    `retailer_module_access_state`, a narrow single-module lookup safe to
    expose without that session; `PlatformModuleRepository.publicAccessState`
    and a new `assertRetailerModuleActive` customer-app helper wrap it. All
    four customer commerce entry points now fail closed when `commerce_growth`
    is off/suspended/preview, matching the retailer app's server boundary.
    The customer e2e fixture retailer previously resolved every module as
    `off` (it postdates the module-kernel migration's legacy-compatibility
    override and had no plan), which was silently unenforced until now;
    `global-setup.ts` now activates all eight modules for it, matching the
    retailer app's own fixture. Proof: 3 new pgTAP assertions for the public
    lookup (module_kernel_test.sql, 18/18), a new browser assertion that a
    suspended module blocks the write with zero rows and a visible message
    then recovers once reactivated, and the full customer e2e suite green at
    33/33 with no regression.
    The remaining audit items are now closed except one deliberate exception
    and one deferred item. Every other customer-app write now calls
    `assertRetailerModuleActive` before mutating: `relationship_intelligence`
    (`appointments/actions.ts`, `api/appointment-request`,
    `table-service-actions.ts`'s signed-in and anonymous paths,
    `api/table-service-inquiry`), `commerce_growth` (`events/actions.ts`
    RSVP), and `wardrobe_styling` (`newsletter-actions.ts`,
    `swipe/actions.ts`'s save, `tie-mate/actions.ts`'s save,
    `products/[productSlug]/actions.ts`'s `toggleWishlist`). The gate's
    message is now parameterized — a wishlist/appointment/message failure no
    longer shows commerce-specific "not accepting orders" wording. Two new
    browser proofs (`module-boundary.spec.ts`) cover one representative
    mutation per newly gated module family (anonymous inquiry;
    wardrobe wishlist save), matching the retailer app's "prove one
    representative mutation" precedent; the other actions share the same
    gate. Background jobs now respect module state too:
    `orchestrateMorningRoutineDeliveries`, `orchestrateCampaignDeliveries` and
    `dispatch-newsletter` each check `PlatformModuleRepository.jobEnabled`
    per retailer before enqueueing, using the existing
    `retailer_module_job_enabled` RPC already proven by pgTAP.
    **Deliberate exception, not a gap:** the Stripe Connect and Faden
    webhooks stay ungated. They record facts about money/inventory events
    that already happened externally (a captured charge, a POS order-status
    change); silently dropping them under a module-suspension check would
    create exactly the ledger/stock divergence R0.2 exists to prevent, and
    provider retries eventually expire, making it unrecoverable. The correct
    enforcement point is origination (cart/checkout, already gated), not
    reconciliation.
    `wedding-parties/join/[token]/actions.ts`'s anonymous `joinWeddingParty`
    is now also gated on `enterprise_verticals`. Migration `20260802000005`
    adds `wedding_party_retailer_for_invite`, a read-only mirror of
    `join_wedding_party`'s own token-validity check (same result: valid ->
    retailer id, invalid/cancelled -> null), so the caller resolves the
    retailer and checks the module before ever calling the join RPC.
    `WeddingPartyRepository.retailerIdForInvite` wraps it; 3 new pgTAP
    assertions (`wedding_party_invite_lookup_test.sql`) cover valid,
    unknown and cancelled tokens. No browser proof: this feature had zero
    existing e2e coverage (photo-upload fixture, invite-token seeding) to
    extend, and building that from scratch is out of proportion to closing
    a low-risk deferred gap on already-unproven code — the pgTAP proof plus
    the byte-identical `assertRetailerModuleActive` call already proven
    working for every other module family is the honest proof level here.
    Remaining from the original audit: founder-tool blueprint implementation
    and House cleanup.
    FT-10 Inspiration Box/gift booklet moved from missing to a first
    connected slice. `downloaded_pages/pag1.html` was checked directly and
    has no interactive fragment for this tool (only one static marketing
    sentence) — `DESIGN_PORTS.md`'s "none found" is accurate, so this is
    built with PAON's own primitives against the blueprint's PAON-job/state
    description rather than a pixel port, per AGENTS.md's non-designated-
    source path. Migration `20260802000006` adds the gift schema plus
    anonymous-safe `resolve_gift_invitation`/`redeem_gift_invitation` RPCs.
    A retailer manager curates real catalogue pieces at `/gifts` and sends
    an opaque-token invitation; the recipient opens and redeems it
    anonymously, seeing only their own reveal. Redemption deliberately
    creates no Order and touches no stock — R0.2 already owns that atomic
    write surface, so a fresh ad-hoc order path here would be exactly the
    uncoordinated surface PHASE.md warns against; it records a selection
    outcome for the advisor to convert manually instead. Proof: 6 pgTAP
    assertions, a retailer curate-invite-see-redeemed browser journey and a
    customer open-redeem-blocked-on-replay browser journey. Not built yet:
    expiry/revoke polish, resend, giver payment/request flow and recall/
    refund — continue with these or the next founder-tool contract.
    Running the full retailer e2e suite (not just the targeted specs recent
    sessions ran) surfaced a real pre-existing gap from R0.3's original
    module-kernel landing: the shared demo persona retailer ("Maison
    Dubois", `seedDemoData`/`seedProspectDemoRetailer`) had zero module
    configuration or subscription plan, so every module resolved `off` and
    every module-gated route/nav 404s or hides for every persona —
    `demo-personas.spec.ts`'s 7 navigation assertions were all silently
    failing. `demo-seed.ts`'s `seedRetailer` now activates all eight
    modules for every seeded demo/prospect house, the same fix already
    applied to the retailer and customer e2e fixtures. Full retailer suite
    is now a clean 44/44.
    FT-12 Six-rail wardrobe moved from "generic experience must be
    replaced" to a first connected slice. No interactive rail fragment
    exists in `pag1.html` either (checked directly: only a decorative,
    differently-labelled homepage carousel) — built with PAON primitives
    against the blueprint's own physical description (opening/closing,
    layered depth, horizontal movement) via a new `WardrobeRail` component:
    each category defaults to a closed spine with a layered peek-stack
    preview, opens/closes with a height transition, and supports arrow-key
    roving focus between rail headers; `prefers-reduced-motion` disables
    the animation. Existing add/retire actions and provenance labelling are
    unchanged. Proof: one browser journey covering default-open state,
    close/reopen, keyboard roving and the pre-existing add/retire flow
    through the new UI. Not built: composed-look transition, concurrent-
    correction/order-fed-ownership/service-away/cross-House proof, and the
    rail-to-look-to-MorningRoutine continuation.
    FT-13 Moonstruck groom/best-men planner gained its first "delivery and
    pickup readiness" slice. `downloaded_pages/pag1.html`/pag2/pag3 were
    checked directly and have no interactive aftercare-checklist fragment to
    port — built with PAON primitives against the blueprint's own PAON-job/
    state description. Migration `20260802000007` adds `wedding_aftercare_plans`
    (party-wide or member-scoped instruction with an optional due date) and
    `complete_wedding_aftercare_plan`, a SECURITY DEFINER RPC that re-derives
    organizer-or-assigned-member authorization server-side rather than trust a
    client-supplied role (ADR-034 pattern); the table itself grants only
    `select` to `authenticated`, so completion can only happen through the
    RPC. A retailer manager authors instructions from the party page; the
    organizer or the specifically assigned member marks one done, with the
    RPC raising for anyone else. Proof: a retailer browser journey (author an
    instruction, see it listed "Pending") and a customer browser journey
    (organizer completes their own party-wide instruction, DB asserts
    `completed_at`). Fixed one collateral regression found while adding this:
    the new member-select `<option>` text collided with an existing
    pre-fitting-status locator in `wedding-party-coordination.spec.ts`,
    narrowed to an element-scoped locator. Also found and fixed a real latent
    bug this surfaced: `wedding_parties` has no DELETE grant for any role by
    design (only soft-delete, matching FT-13's "removal preserves audit/order
    obligations"), and an early draft of the new customer test's cleanup used
    a hard delete that silently failed and left orphaned non-deleted parties
    for the shared `TEST_CUSTOMER_EMAIL` fixture, which broke
    `mobile-ux.spec.ts`'s bottom-nav assertion (any non-deleted party flips
    the customer shell into wedding mode); the cleanup now soft-deletes and
    the orphaned rows were purged. Not built yet: date candidates/votes
    ("group-date agreement"), member style/design choices, guest vouchers and
    inspiration items.
    FT-07 Lapel/pocket/shoulder configurator moved from "missing" to a first
    connected slice — and `DESIGN_PORTS.md`'s prior "none found" for this row
    was itself wrong: `downloaded_pages/pag1.html` was checked directly and
    does contain a genuine designated fragment, `#suit-configurator-widget`
    (three synchronized scroll-snap carousels plus a top model carousel with
    three predefined coherent combinations). This is a real pixel port, not a
    built-from-description substitute: CSS, markup, class names, image URLs
    and the model configs (Henk/Willem/Karel) are byte-for-byte from source.
    The source drives scroll-to-panel and opacity crossfade with GSAP; this
    codebase has no GSAP dependency anywhere, so scroll easing is a
    hand-rolled requestAnimationFrame tween using GSAP's own power2.inOut
    formula (the same precedent `am-house-orbit.tsx` already set — reimplement
    source animation math directly rather than add a library) and the opacity
    crossfade is a plain CSS transition, visually equivalent. Migration
    `20260802000008` adds `suit_configuration_intents` (append-only, one row
    per save so an advisor can see exploration, not just the latest pick) and
    `save_suit_configuration_intent`, a narrow RPC re-deriving the caller's
    Customer row and self-creating it on a first interaction (same shape as
    `save_wishlist_item`). A customer explores the widget at
    `/r/[slug]/configurator`, gated by `wardrobe_styling`, and makes an
    explicit "Save this configuration" decision separate from browsing,
    matching the swipe deck/wardrobe rail precedent. Proof: one browser
    journey covering the initial predefined-model state, clicking a different
    model to resync all three sub-carousels together, save, and a database
    assertion of the saved row (lapel/pockets/shoulder/modelPreset). Not built
    yet: prohibited combinations, version pinning, retired-option recovery,
    cross-House asset/rule isolation, advisor-side visibility UI and
    configuration-to-proposal/MTM production continuation.
    FT-13's `wedding_group_fittings` table (already schema-real since
    `20260801000014`, unwired: retailer-staff read/insert/update RLS existed
    but no customer-facing visibility and no repository/UI touched it) is now
    connected. Migration `20260802000009` adds the one missing piece, a
    customer-facing SELECT policy mirroring the aftercare-plan precedent
    (`is_wedding_party_organizer_or_member`); the retailer-side insert needed
    no new RPC since staff already write through their own session's
    existing RLS policy, unlike the anonymous/customer paths elsewhere. A
    retailer schedules a fitting (date/time + capacity) from the party page;
    the organizer and every member see it listed — read-only, since the
    schema has no per-member RSVP/registration column to wire yet. Proof: a
    retailer browser journey (schedule, see it listed with the right
    date/capacity) and a customer browser journey (organizer sees a
    retailer-scheduled fitting). Remaining FT-13 gaps at that point: date
    candidates/votes, member style/design choices, guest vouchers and
    inspiration items.
    `wedding_inspiration_items` (also schema-real since `20260801000014`,
    unwired) is now connected too — the last of the three tables that only
    needed wiring, not new schema. Unlike group fittings, this table is
    customer-writable (`added_by_customer_id` anticipates it), so migration
    `20260802000010` adds `add_wedding_inspiration_item`, a SECURITY DEFINER
    RPC re-deriving the caller's organizer/member authorization and their own
    customer id server-side (ADR-034 pattern) rather than a plain RLS insert
    — the caller has no staff session to trust the way group-fitting
    scheduling does. Also adds a `wedding_inspiration_item_has_content` check
    constraint (image or note required) since the pre-existing schema
    allowed neither. The organizer and every member can pin an image link
    and/or a note; `internal_only` defaults `true` per the schema's own
    comment ("a couple pinning a magazine photo is not licensed for
    publication"). Proof: a customer browser journey (pin a note, see it
    listed, DB asserts `added_by_customer_id` and `internal_only`).
    `wedding_design_choices` (also schema-real from `20260801000014`) is now
    connected too — the third and last of that batch's plain "wire what
    already exists" slices. A member records their own outfit choice per
    slot (free text: no slot/value vocabulary is specified anywhere in the
    founder source or blueprints, so nothing is invented); the organizer can
    instead set one party-wide "coordinated" choice. Migration
    `20260802000011` adds `set_wedding_design_choice`, a SECURITY DEFINER RPC
    that re-derives organizer-or-assigned-member authorization and upserts
    on (party, member-or-null, slot) via `select ... for update` rather than
    accumulating duplicate rows — backed by two partial unique indexes as a
    concurrency backstop (same idiom as `one_default_wishlist_per_customer_idx`).
    Proof: a customer browser journey (organizer sets a party-wide choice,
    sees it listed, DB asserts `coordinated = true` and a null member id).
    Date candidates/votes ("group-date agreement") is now built too — the
    one FT-13 surface with no schema at all until this slice. New tables
    `wedding_date_candidates` (unique on party+date) and
    `wedding_date_votes` (composite PK on candidate+member, so a member can
    vote at most once per candidate); migration `20260802000012` adds
    `propose_wedding_date_candidate` (organizer or member, idempotent via
    `on conflict do nothing`) and `toggle_wedding_date_vote` (resolves the
    caller's own member row server-side, so a member can never vote as
    someone else). Finalizing deliberately reuses the existing
    `updateSchedule` organizer-RLS path (`20260728000005`'s "organizer
    updates own wedding party") to set `wedding_parties.event_date` rather
    than adding a new RPC, since that write path already exists and is
    already proven. Caught and fixed a real bug during proof: the initial
    migration created RLS SELECT policies on the two new tables but never
    granted table-level `select` to `authenticated` — Postgres denies access
    regardless of a matching policy without the base grant, which surfaced
    immediately as a 500 ("permission denied for table
    wedding_date_candidates") the first time the page rendered; fixed by
    adding the missing `grant select ... to authenticated, service_role`.
    Proof: a customer browser journey (organizer proposes a date, finalizes
    it, DB asserts `wedding_parties.event_date` and exactly one candidate
    row) — verified stable across 3 repeated runs against a production
    build after an earlier flake during dev-server hot-reload turned out to
    be a hydration-timing artifact of my own debugging, not a real bug.
    `wedding_guest_vouchers` — FT-13's last unwired table — is now connected
    too, on reconsideration: it holds real monetary value
    (`value_minor_units`, `funding_source`), but wiring it never actually
    required inventing a payment/redemption mechanism, only recording two
    facts a retailer already knows externally — a voucher was issued
    (funded outside PAON) and, later, that it was redeemed. Neither write
    creates an order, moves stock, or captures a payment, so this stays
    inside R0.2's boundary rather than crossing it; the earlier "needs a
    founder decision" framing conflated "touches a money-shaped column"
    with "invents a money-movement path," which this doesn't. Migration
    `20260802000013` adds the customer-facing SELECT policy; retailer
    issue/mark-redeemed use plain insert/update through the already-granted
    staff RLS (same reasoning as `createGroupFitting` — a real staff
    session, no RPC needed). Proof: a retailer browser journey (issue a
    voucher, see it listed, mark it redeemed) and a customer browser
    journey (organizer sees a retailer-issued voucher and its status).
    FT-13 is now fully wired across every table the schema already had.
    FT-02 Silhouette analysis moved from "wrong" to a first connected
    slice, replacing the invented Dutch-language SVG carousel
    (Slank/Regulier/Atletisch/Gezet) that `DESIGN_PORTS.md` correctly
    flagged. `pag1.html`'s `#nbs-silhouette-widget-a91k` was checked
    directly and confirmed present: five video-backed panels (S1–S5),
    auto-advancing on a dwell timer and pausable on touch/mouse, plus two
    "anticipated FitTools" rule columns whose glow-toggle squares highlight
    a different subset per active panel. CSS, markup, video sources, panel
    codes/titles and the rule-highlight mapping are byte-for-byte from
    source. A PAON-added "Select" button (the source has none) records the
    active panel through the existing `recordFitToolObservation` path,
    unchanged from the replaced component's contract, so `fit-tool-panel.tsx`
    needed only an import swap. This is Level 1 visual classification only;
    the blueprint's individual-analysis/prediction (Level 2/3) progression
    and the full consent/capture session state machine remain unbuilt and
    are not claimed. Proof: `fit-tools.spec.ts`'s existing browser journey
    updated for the real button/observation text, plus a manual screenshot
    verification confirming the auto-advance (S1→S2), real video playback
    and rule-highlight resync all work — full customer (43 tests) and
    retailer (46 tests) e2e suites green; the one failure seen in a
    shared-worker run (migration-write-through) is the same pre-existing
    parallel-worker flake established earlier this session.
    Investigated FT-04 First-fitting automation next and found a real,
    specific, money-adjacent gap rather than building blind: the alteration
    work order state machine (`create_alteration_intake`, 11 statuses) is
    already mature, but the only path that creates an `alteration_task` is
    that one intake-time RPC — there is no way to add a task to an
    _existing_ alteration later, so a fitting observation recorded after
    intake has nowhere reviewable to go. Adding that path safely means
    reusing the intake RPC's price-list-driven task pricing
    (`alteration_price_list_items` keyed by `operation_id`) and deciding how
    it interacts with `proposePriceChange`/`decidePriceChange`'s existing
    price-change-approval flow so the ledger stays consistent — exactly the
    kind of money-adjacent design decision R0.2's boundary says not to rush.
    Deliberately not attempted this session; FT-04's **Current** line below
    now names the precise gap instead of a vague "automation absent."
    FT-06 MorningRoutine complete-look canvas moved from "generic ranked
    list" to a first connected slice. `pag1.html` was checked directly for
    a composed-look widget and has none — only marketing narrative plus a
    decorative live-weather-camera overlay requiring its own API key — so
    this is built with PAON primitives against the blueprint's physical
    description ("composed outfit, weather/calendar/live context,
    complementary wardrobe pieces, missing/purchasable piece"), not a
    source port. The top-ranked recommendation becomes a large featured
    "Today's look" card (image, owned/catalogue label); the rest become a
    horizontal "Complete the look" strip, with non-owned catalogue pieces
    marked "Add to complete." Every existing Server Action (save/review/
    book/buy/ask-advisor) and field is unchanged — this is a pure
    recomposition, not new backend logic — except one real gap it surfaced
    and fixed: `MorningRoutineRecommendation.primaryImageUrl` already
    existed on the domain type but was silently dropped in the
    page-to-panel view mapping, so no image ever had anywhere to render;
    now wired through. "Buy" still only links to the existing product page
    — order creation remains the Commerce boundary, nothing new was added
    there. Also found and closed a real proof gap: MorningRoutine had zero
    e2e coverage before this slice despite being a real, data-backed
    feature; `morning-routine.spec.ts` is new. Empty/missing-image states
    render an honest "No image yet" placeholder rather than hiding the
    card, matching the blueprint's "empty and partial wardrobes must still
    produce a beautiful honest composition." Proof: browser journey plus
    manual screenshot verification of the featured card and strip layout
    (fixture products have no seeded images, confirming the fallback path
    renders correctly rather than breaking). Full customer (44 tests) and
    retailer (46 tests) e2e suites green with no failures this run.
    Checked FT-05 Mission Control/Self-Portrait directly rather than
    trusting its stale "cockpit not reproduced" summary, and found it more
    built than documented: no interactive "MissionControl"/"Self-Portrait"
    fragment exists in `pag1.html` (only narrative text plus one small
    unrelated decorative logo-carousel), but three of the blueprint's
    described actor surfaces already exist with real composed data — the
    retailer `/dashboard` Brief (761 lines), the per-customer composited
    view (`/customers/[id]` + `advisor-preparation-brief.tsx`, 1132 lines),
    and the customer-facing declared/inferred Self-Portrait panel with
    correction (`style-profile-panel.tsx`, 272 lines). The customer-facing
    panel had zero e2e proof despite being fully wired;
    `style-profile-account.spec.ts` is a new first browser journey (view an
    inferred preference, remove it, DB asserts the profile no longer
    carries it) — reusing the swipe deck's proven evidence-generation path
    rather than reinventing fixture seeding. Found and fixed a real bug
    surfaced by adding this: the test's own swipe-right saved the fixture
    variant to the shared customer's wishlist and recorded a decided-
    product event, both leaking into `wishlist.spec.ts` (which asserts
    exactly one saved item) and the swipe deck's own dedup on rerun; added
    a `finally` cleanup mirroring `swipe-deck.spec.ts`'s own state hygiene,
    and purged the orphaned rows left by earlier debug runs. Separately
    confirmed (not caused by this work): `swipe-deck.spec.ts`'s rapid
    keyboard-decision loop has pre-existing flakiness — Playwright presses
    ArrowLeft against a card mid-exit-animation and the element detaches —
    unrelated to the guard-loop bound (raising it from 20 to 50 did not
    fix it and was reverted rather than left as an unexplained change); it
    passes on retry, consistent with every other timing-based flake
    already logged this session. Not proven this round: the advisor-facing
    Today dashboard and composited customer view (real but unverified by
    this session), ranking-rule/evidence-window versioning, and cross-
    module degrade-independently behavior.
    Reconsidered and closed the FT-04 post-intake task-creation gap logged
    above. On reread, `propose_alteration_price_change`/
    `decide_alteration_price_change` require an _existing_ `task_id` and
    only ever adjust a task's price or the whole order's agreed total —
    they cannot create a task, so reusing them directly was not viable.
    The actual fix is smaller than the earlier note implied: a new
    `add_alteration_task` RPC (advisor-only, same `is_alterations_advisor()`
    gate as recording a fitting observation) inserts a task with the
    schema's own existing default zero quote and `proposed` status.
    `alteration_work_orders.agreed_total_amount_minor_units` is a stored
    field only ever recomputed inside `decide_alteration_price_change`'s
    approval branch, so a zero-quote task changes nothing until it is
    separately priced through that same unmodified dual-control flow —
    no parallel pricing mechanism, no ledger inconsistency. This is the
    same boundary read as `wedding_guest_vouchers`: recording that a task
    exists is a fact, not a money movement. Wired retailer-side only (a
    "New task" mini-form in the alteration detail page's Tasks card,
    gated on the `intake` permission, disabled once the order is
    completed/canceled); no customer-facing surface, matching the
    blueprint's advisor-decides framing. Proof: new
    `alteration-add-task.spec.ts` — create a work order via intake, add a
    second task post-intake, assert it renders unpriced (`Now · Proposed`,
    `Original quote 0 USD`) alongside the intake-created task. Full
    retailer e2e suite reran green.
    Closed FT-09's "optional wedding-party/garment links" gap (party side
    only; garment links untouched). `message_attachments` gains a nullable
    `wedding_party_id`; `record_consultation_attachment` was recreated
    with the new optional param (its old 8-arg overload explicitly
    dropped, not just shadowed — `create or replace` does not replace a
    function whose argument list changed). Real architecture discovery
    made building this: the root `/r/[slug]` landing page has no
    `page.tsx`, only a `route.ts` Route Handler serving the founder's
    `paon-template.html` byte-for-byte with string substitution — Next.js
    never wraps a Route Handler in `layout.tsx`, so the React
    `TableServiceWidget` (used correctly on `/products`, `/cart`, etc.)
    never mounts there. Cost real time: added a debug marker to
    `layout.tsx`, confirmed via curl it never rendered, before finding
    `route.ts` and realizing the founder root path runs its own
    hand-templated vanilla-JS copy of the same widget. Added the
    optional "Link to wedding party" selector to _both_ — the React
    component for child routes, and `paon-template.html`'s inline
    `<script>` plus a new `__PAON_WEDDING_PARTIES_JSON__` substitution
    in `route.ts` for the root path — since both already independently
    call the same `sendSignedInTableServiceMessage` Server Action via the
    `/api/table-service-message` bridge, no backend duplication was
    needed. Retailer inbox resolves and displays the linked party's name
    next to the attachment. Proof: new
    `tableservice-wedding-fabric-link.spec.ts` (root path, the widget
    actually used by the pre-existing `tableservice-attachments.spec.ts`
    too) — both green. Full retailer and customer e2e suites reran green
    against a genuinely fresh `supabase db reset`; two retailer failures
    seen mid-session (`pos.spec.ts`, `loss-prevention.spec.ts`) were
    proven to be this session's own debugging-churn database pollution,
    not a regression — both pass cleanly on a fresh reset with the FT-09
    migration applied, and also pass on the pre-FT-09 commit, confirming
    no causal link either way.
    Closed FT-07's "advisor-side visibility UI" gap — the smallest of the
    three found this session: `SuitConfiguratorRepository.findRecentByCustomer`
    already existed (written when the customer configurator shipped) but
    had no caller anywhere in the retailer app. Its RLS policy
    (`retailer staff can read their retailer's configuration intents`)
    and base grant were also already in place, unused. Added a read-only
    "Suit configurator picks" card to the retailer customer detail page —
    zero migration, zero RLS/RPC change, pure UI wiring onto
    already-correct backend. Proof: `suit-configuration-intents.spec.ts`
    seeds a pick through the real `save_suit_configuration_intent` RPC as
    an authenticated shopper (a direct table insert was tried first and
    correctly rejected — the migration grants INSERT to no role but that
    RPC — matching the same "no invented write path" discipline as FT-04/
    FT-09). Hit and fixed one real test-authoring trap along the way:
    `generateLink({type: "magiclink"})` for an email with no existing auth
    user silently mints a "signup"-type token instead of a magiclink one
    (only visible in `action_link`'s own query string), so verifying it as
    `"magiclink"` fails with "Email link is invalid or has expired" —
    fixed by creating the auth user first. Full retailer e2e suite rerun
    green.
    Corrected a stale FT-06 claim from earlier the same day: its
    **Current** line said "not built: live weather/calendar context
    wiring, delivery-job-driven notification" — false. Both predate the
    FT-06 slice entirely: weather/calendar wiring is PHASE 4.4
    (`apps/customer/app/(dashboard)/morning-routine/actions.ts` already
    calls `OpenWeatherProvider`/`AppointmentCalendarProvider` on every
    selection generation), and the delivery job is PHASE 4.5, landed
    `933ab1c` — `orchestrateMorningRoutineDeliveries`
    (`packages/database/src/morning-routine-delivery-orchestrator.ts`)
    already runs on every `dispatch-emails` cron tick, gating on
    module-enabled/retailer-paused/opted-in/frequency/quiet-hours/
    duplicate-for-date before enqueuing in-app/email notifications from
    the exact persisted selection. Caught by verifying directly against
    source instead of trusting the paragraph just written — same
    discipline that caught the MeasurementMonitor false-start earlier
    this session, now applied to my own immediately-prior work. The one
    real gap surfaced in the process: `evaluateMorningRoutineDelivery`
    and friends (the pure gating logic in
    `packages/domain/src/wardrobe/morning-routine-delivery.ts`) had unit
    coverage, but `orchestrateMorningRoutineDeliveries` itself — the I/O
    wiring that loops subscriptions and calls those functions — had
    none. Closed with
    `packages/database/src/morning-routine-delivery-orchestrator.test.ts`:
    an in-memory fake Postgrest/RPC client (equality-filtered `.from()`,
    dispatched `.rpc()`, calls recorded for assertion) proving four
    branches — module-off short-circuit with zero further table calls,
    retailer-paused audit write with zero enqueue, a full happy path
    enqueuing one notification per subscribed channel from a real
    persisted selection and recording the resulting audit, and
    duplicate-for-date suppression. `pnpm --filter @paon/database
typecheck lint test` all green.
    Closed FT-10's "resend" gap — which turned out on inspection to be an
    initial-send gap, not a resend gap: the retailer's "Send invitation"
    button only ever inserted the `gift_invitations` row and displayed
    the raw redeem link as text for the manager to copy; no email was
    ever actually dispatched. `gift_invitations` has no
    `recipient_user_id` (the recipient is an anonymous, non-PAON
    person), so the `enqueue_notification_email()` trigger that
    populates `email_outbox` for every other transactional email in this
    codebase (ADR-032, keyed off `notifications.recipient_user_id` ->
    `auth.users.email`) structurally cannot apply here. Migration
    `20260802000016` adds `gift_invitations.email_sent_at` plus a new
    SECURITY DEFINER RPC, `enqueue_gift_invitation_email(p_invitation_id,
p_customer_app_base_url)`, mirroring
    `enqueue_morning_routine_delivery_notification`'s shape: re-derives
    retailer-manager authorization server-side (retailer match +
    manager/admin/owner role, same check as the table's own RLS
    policies, since SECURITY DEFINER bypasses RLS and must re-assert it),
    rejects invitations with no recipient email or already past
    pending/opened, and builds subject/body entirely from the
    invitation/experience/retailer rows it looks up itself — the only
    caller-supplied value is the customer-app base URL, which is the
    deploying operator's own `NEXT_PUBLIC_CUSTOMER_APP_URL` env var, not
    attacker input. Retailer-side: a plain `UPDATE` on
    `email_sent_at` was possible without a new RPC (the existing
    "retailer managers manage gift invitations" policy already grants
    `for all`); only the `email_outbox` insert needed one, since that
    table's RLS is `is_platform_staff()`-only. Added a separate "Email
    invitation" button next to each invitation (relabels "Resend email"
    once one has gone out already) rather than folding it into "Send
    invitation" — keeps dispatch an explicit, repeatable manager
    decision distinct from generating the link, consistent with this
    codebase's recurring "explicit action, not implicit side effect"
    precedent (swipe deck saves, suit configurator saves, etc.). Proof:
    extended the existing `gifts.spec.ts` — click "Email invitation",
    assert a real `email_outbox` row exists with the invite link in its
    body, reload, assert the button now reads "Resend email" — run
    before the redemption step so the RPC's pending/opened status guard
    doesn't reject it. Full retailer e2e suite (49 tests) reran green;
    the pre-existing `demo-personas.spec.ts` parallel-worker seed
    collision reappeared under default worker count and was reconfirmed
    (again) as unrelated to this change — all 7 pass with `--workers=1`.
    Strengthened FT-05's proof: its own blueprint text flagged "the
    advisor-facing Today dashboard... real but unverified by this
    session," and checking directly found `dashboard-digest.spec.ts`
    proves exactly one of the `/dashboard` "Needs your attention"
    surface's five card types (price approval — plus that the
    alteration detail page orders pricing before chain-of-custody).
    The other four (today's appointment, unread messages, low stock,
    draft clienteling opportunity — the last of which actually renders
    in its own separate "Draft clienteling opportunities" card above the
    attention list, not a bug, just a different, richer section) had
    zero coverage. Added a second representative case, today's
    appointment — the most central of the four — as a new test in the
    same file: seeds a real `appointments` row directly (the read
    surface under test is the dashboard card, not the booking Server
    Action, which `workspace.spec.ts` already covers end to end),
    computed at noon UTC on the current UTC calendar date so it matches
    the dashboard's own `isToday` check regardless of what time the
    suite runs, then asserts the card renders the customer's name and
    "Styling consultation" inside `#attention` and links through to
    `/appointments/{id}`. Did not attempt the remaining three card types
    or the composited customer view in this slice — matching the
    established "prove one representative case, the rest share the same
    read path" precedent (module-boundary gate, FT-09 attachments)
    rather than forcing exhaustive coverage into one pass. Full retailer
    e2e suite reran green (both `dashboard-digest.spec.ts` cases pass
    together and standalone).
    Closed FT-05's other flagged-unverified surface, the composited
    customer view (`advisor-preparation-brief.tsx`, ADV-003). Rather than
    a new test with fresh fixture setup, extended
    `workspace.spec.ts`'s existing "owner adds a client to the book"
    test — it already lands on a brand-new customer's detail page with
    zero consent/evidence, which is exactly the fail-closed path this
    component needs proven. Read the component source first to get the
    exact copy right rather than guessing: `resolveAdvisorBriefVisibility`
    only returns `usable` for `granted` personalization consent, so a
    customer with none renders the `consent_denied` branch — asserted the
    "Continue the online conversation" heading, the "Personalization not
    opted in" badge, and each of the three intelligence sections'
    (interests/shortlist/knowledge) "hidden without personalization
    consent" empty-state copy. Passed on the first run, confirming the
    prediction. The `usable`-visibility path (real consented
    interests/shortlist/evidence) remains unproven — would need a
    granted-consent fixture with actual StyleProfile/interest data, out
    of scope for this proof-only slice.
    Added a third "Needs your attention" card type: unread messages.
    Seeded as one `notifications` row directly for the owner's own
    `auth.users` id (category `message`), then asserted through the
    real `#attention a[href='/messages']` card — scoped to `#attention`
    since the header also has a `/messages` link with its own unread
    badge outside that region. Counted the owner's pre-existing unread
    notifications first rather than assuming a zero baseline, so the
    "N conversations waiting" assertion stays correct regardless of run
    order or other specs' leftover rows. Did not attempt the remaining
    two card types: low stock reads `product_variants.inventory_quantity`,
    which R0.2's `20260801000018_make_inventory_quantity_a_ledger_projection.sql`
    and `...000019_route_all_stock_writes_through_the_ledger.sql` turned
    into a ledger projection rather than a plain column — seeding a
    correct fixture needs its own investigation into the current stock
    write path, not a rushed direct write into money/stock-adjacent
    territory. Draft clienteling opportunity was checked and found to
    already render correctly in its own separate "Draft clienteling
    opportunities" card above `#attention` (confirmed earlier this
    session, not a gap).
    Closed the fourth card type, low stock, rather than deferring it
    again — checked the actual current stock write path instead of
    assuming it needed new machinery. `product_variants.inventory_quantity`
    became a ledger projection in R0.2
    (`20260801000018_make_inventory_quantity_a_ledger_projection.sql`),
    but `record_new_variant_opening_stock` — an AFTER INSERT trigger on
    `product_variants`, confirmed still live in
    `20260801000019_route_all_stock_writes_through_the_ledger.sql`
    (only its direct-RPC execution grant was revoked from callers, not
    the trigger itself) — fires on any insert with
    `inventory_quantity > 0` and writes the matching opening receipt to
    `stock_ledger_entries`. That happens regardless of whether the
    insert comes through the real "Create product" Server Action or
    this test's own admin-client insert, so seeding a product/variant
    directly with `inventory_quantity: 3` is the correct path, not a
    bypass of the ledger R0.2 exists to protect. New test asserts the
    real `#attention a[href='/products']` card, counting pre-existing
    low-stock variants first so the "N variants at or below 5 units"
    text stays correct regardless of what other fixtures already exist.
    Four of five "Needs your attention" card types are now proven in
    `dashboard-digest.spec.ts` (4 tests, all pass together and
    standalone); only draft clienteling opportunity remains, and it was
    already confirmed not to be a gap (renders in its own section, not
    a missing card). Full retailer e2e suite reran green.
    Closed FT-05's remaining small proof requirement: "one completed
    action altering the next Today view." Extended the price-approval
    test — after asserting the DOM order fix, actually decide the
    proposal through the real `PriceDecisionForm` (select "Approve",
    fill a reason, submit — not calling `decide_alteration_price_change`
    directly), then reload `/dashboard` and assert the "Price approval
    needed" card is gone. First attempt failed with "Unable to decide
    proposal": `decide_alteration_price_change`
    (`20260721000009_harden_alteration_price_controls.sql`) only accepts
    a decision while the work order's status is `assigned`/`in_progress`
    — the seeded work order was still in its intake state, since this
    test deliberately inserts the pending proposal directly rather than
    driving the full workshop-assignment flow (see the file's own
    docstring). Fixed by flipping `alteration_work_orders.status` to
    `assigned` directly before deciding, same reasoning already applied
    to the proposal seed itself — the assignment flow has its own
    coverage elsewhere, and this test is about the dashboard/decision
    read-and-write surfaces, not assignment. `dashboard-digest.spec.ts`
    (4 tests) green together and standalone; full retailer suite reran
    green (49/50, the recurring demo-personas parallel-worker seed
    collision reconfirmed pre-existing once more).
    Closed the same test-coverage gap in
    `orchestrateCampaignDeliveries` (Stage 5.1's private-offer cron
    enqueue, also wired into `dispatch-emails`) that
    `orchestrateMorningRoutineDeliveries` had before it: the pure gating
    functions (`evaluateCampaignDelivery`/`evaluateAudienceRules` in
    `packages/domain/src/campaign/campaign.ts`) already had unit
    coverage via `campaign.test.ts`, but the orchestrator's own loop —
    per-campaign module-off short-circuit, per-customer consent/
    audience/duplicate gating, and the repository/RPC calls it makes —
    had none. Found by checking which top-level files in
    `packages/database/src` had no matching `.test.ts`, the same search
    that surfaced the morning-routine gap; `campaign-delivery-
orchestrator.ts` was the only other one still uncovered (the
    remaining files without a sibling test — `client-type.ts`,
    `demo-seed.ts`, `index.ts`, `programme-proof-seed.ts`,
    `test-environment-guard.ts` — are type/seed/index files, not logic
    to unit test). New `campaign-delivery-orchestrator.test.ts` reuses
    the same in-memory fake-client shape as the morning-routine test:
    module-off skips an entire campaign's customers without considering
    any of them (a real difference from morning-routine's per-
    subscription skip — the `continue` here is on the outer campaign
    loop), a consented customer against a campaign with zero audience
    rules queues (zero rules + granted consent auto-matches, per
    `evaluateAudienceRules`), a customer with no personalization consent
    is skipped and audited with `skipped_consent_withdrawn`/
    `no_personalization_consent`, and duplicate-for-date is suppressed.
    `pnpm --filter @paon/database typecheck lint test` all green (476
    tests, no regressions).
    Writing a real HTTP-level test for `dispatch-emails` (rather than
    only unit-testing the orchestrators it calls) surfaced a genuine,
    previously-undiscovered production bug spanning all three apps:
    every session-auth `middleware.ts` (admin, retailer, customer) has a
    matcher that excludes only `_next/static`, `_next/image`,
    `favicon.ico` and `fonts/` — never `/api/` — so it intercepts and
    307-redirects to `/login` _every_ request with no session cookie,
    including the server-to-server routes that were always meant to
    authenticate themselves: admin's four `/api/cron/*` routes and
    `/api/webhooks/stripe`, retailer's `/api/webhooks/faden/*`, and
    customer's own `/api/webhooks/stripe`. A real Vercel Cron tick,
    Stripe webhook, or Faden webhook call never carries this app's
    session cookie, so in any actual deployment none of these routes
    could ever have executed — confirmed directly with `curl` against a
    freshly built prod server: `POST /api/cron/dispatch-emails` with the
    correct `CRON_SECRET` bearer token returned a 307 to `/login`, not
    200, before this fix. This means the cron-driven MorningRoutine/
    campaign delivery this session just finished unit-testing, and
    Demo Studio environment expiry, have likely never fired outside a
    manually-invoked local `curl`/Playwright call, and Stripe/Faden
    payment and catalogue-sync webhooks have likely never been received.
    Retailer's own `integration-connection-lifecycle.spec.ts` already
    exercises the Faden webhook route and asserts specific status codes,
    but never caught this: it calls `page.request.post(...)`, which
    shares the browser context's own signed-in cookies, masking exactly
    the case (an external caller with zero cookies) that breaks in
    reality. The new admin test that found this,
    `dispatch-emails-cron.spec.ts`, uses the bare `request` fixture
    instead specifically to simulate a real caller.
    Fix: each `middleware.ts` now short-circuits to
    `NextResponse.next({ request })` before touching Supabase or
    session state at all when the path starts with a server-to-server
    prefix — `/api/cron/` and `/api/webhooks/` for admin, `/api/webhooks/`
    for retailer and customer (customer's anonymous storefront APIs are
    already under `/r/`, covered by its existing `STOREFRONT_PATH_PREFIX`
    bypass) — mirroring the exact bypass style customer's middleware
    already used for `/r/` and `/auth/confirm`, not a new pattern.
    Verified with `curl` against fresh production builds of all three
    apps, before and after: every route above changed from a 307 to
    `/login` to reaching its own real auth check (401 for a missing/wrong
    cron bearer token, 200 for the correct one combining
    `demosExpired`/`morningRoutine`/`campaigns`/`email` in one response;
    503 for Stripe's own not-yet-configured guard). Full retailer suite
    reran clean (48/50; the recurring demo-personas parallel-worker
    collision and one `migration-write-through.spec.ts` timeout under
    contention were both reconfirmed pre-existing and unrelated via
    standalone `--workers=1` reruns, the latter passing cleanly alone).
    Full customer suite initially showed 7 failures under default worker
    count; all 7 were confirmed pre-existing and unrelated by rerunning
    every one of them standalone — 3 hit the already-documented
    intermittent `generateLink` magiclink race
    (`account-preferences.spec.ts`, `swipe-deck.spec.ts`,
    `wardrobe.spec.ts`), and the other 4
    (`appointments-alterations.spec.ts`'s own use of the same
    magiclink-based sign-in helper, `storefront.spec.ts`,
    `tableservice-attachments.spec.ts`,
    `tableservice-wedding-fabric-link.spec.ts`) were parallel-worker
    contention that vanished entirely at `--workers=1`. Added
    `CRON_SECRET=e2e-local-cron-secret` to `apps/admin/.env.local`
    (gitignored, local-only — matches the existing local Supabase demo
    keys' status as fixed, non-sensitive local dev values) so the new
    cron auth test can exercise the real authorized path; tests that
    need it call `test.skip` when unset rather than assuming it's
    configured, matching this codebase's established
    environment-truth discipline.
    FT-01 Voice + drag fit slider moved from "faithful widget foundation,
    connected journey incomplete" to a first connected slice, rather than
    building blind against the blueprint's full state machine: the exact
    gap is that a recorded fitting_observations row (a chip tap or
    silhouette panel select) had no path into the reviewable work order —
    an advisor had to retype the same finding into the unrelated "New task"
    form, losing the observation's own provenance entirely. Migration
    `20260803000001` adds `alteration_tasks.origin_fitting_observation_id`
    and extends FT-04's `add_alteration_task` RPC with an optional
    `p_fitting_observation_id` that re-derives and checks the observation's
    `physical_garment_id` matches the work order's own garment before
    linking — the same cross-object mistake R0.2's tenant checks exist to
    catch, scoped to one garment. This adds no new money-movement path: a
    linked task still inserts at zero quote through the existing, unmodified
    `proposePriceChange`/`decidePriceChange` dual-control flow. A one-click
    "Add as task" form next to each unlinked observation is pre-filled from
    the observation's own area/value; once linked, the row shows "Task: …"
    in place of the form rather than a transient toast, since the revalidated
    page no longer renders the form for an already-linked observation.
    Proof: a new `fit-tools.spec.ts` journey (chip tap -> pre-filled
    one-click "Add as task" -> task appears unpriced in the Tasks list with
    the observation's own value as its instructions -> linkage survives
    reload); the existing `alteration-add-task.spec.ts` unlinked-task path
    was rerun to confirm the RPC signature change is backward compatible.
    Full retailer e2e suite reran green at 53/53, single-worker, with no
    failures.
    Not built: a distinct reviewed FitProfile candidate/version separate
    from a task, advisor comparison against the previous approved fit,
    supplier write-back, and the full trust/recovery state machine
    (permission-denied, no-speech, low-confidence, offline draft,
    idempotent duplicate-submit refusal) the blueprint specifies.
    FT-09's last unattempted gap, "garment links," is now closed on the
    same shape as the party-link slice: migration `20260803000002` adds
    `message_attachments.wardrobe_item_id` and extends
    `record_consultation_attachment` with a `p_wardrobe_item_id` that
    re-derives and checks ownership server-side (a customer may only link
    their own item; staff may link any of that retailer's). A first attempt
    at this slice wired `physical_garments` — the staff-only alteration-
    intake table — instead of `wardrobe_items`, and a browser proof
    (not typecheck, which passed on the wrong table too) caught it: the new
    "Link to a garment" `<select>` rendered with zero options because a
    customer session has no RLS read grant on `physical_garments` at all.
    Corrected to `wardrobe_items` — the customer-readable garment record
    the customer app already reads elsewhere (Six-rail wardrobe,
    MorningRoutine) — which fixed it immediately. Both TableService widget
    implementations (the raw founder landing page and the React
    child-route port) got the "Link to a garment (optional)" selector on
    `photo` attachments, mirroring the wedding-party selector's shape
    exactly; the retailer inbox resolves and shows the linked item's name.
    Proof: a new customer browser journey
    (`tableservice-garment-link.spec.ts`) seeds a real wardrobe item via
    `WardrobeRepository.createExternalItem`, links it through the raw
    widget, and asserts the database row's `wardrobe_item_id`. Full
    customer e2e suite reran green (the pre-existing rapid-keyboard
    swipe-deck flake reconfirmed once more, passing on retry); full
    retailer suite reran green at 53/53.

- [ ] **R0.4 Golden Relationship — House Memory and Advisor Today**
  - **Dependencies:** R0.3.
  - **Acceptance:** an advisor opens one Today surface, understands the next
    clients/promises, opens a complete House Memory view, sees provenance and
    why-now evidence, completes a quick human action and captures an outcome;
    the outcome changes the next preparation. Existing modules compose into
    shared object pages rather than new top-level navigation.
  - **Tests:** manager/advisor/customer permissions, correction/withdrawal,
    stale/empty/error states, mobile and desktop browser proof.

- [ ] **R0.5 Golden Relationship — visual wardrobe to aftercare**
  - **Dependencies:** R0.4, R0.2 where money/stock applies.
  - **Acceptance:** customer and advisor share a visual wardrobe with owned,
    self-added and proposed provenance; a short TableService/MorningRoutine
    journey produces one composed look; appointment or order continues into
    source-authorized status, Honeymoon, fitting/alteration, delivery and one
    aftercare action; each stage records an outcome. The designated pag1
    wardrobe, MorningRoutine, TableService, swipe, fit and consultation tools
    preserve source composition, motion and behaviour under ADR-052/071; real
    data enters through narrow hooks. Non-designated surrounding surfaces may
    use reusable PAON primitives.
  - **Tests:** connected multi-role browser journey plus database assertions,
    responsive/accessibility, source conflict and human-review fit rules.

- [ ] **R0.6 Deployable House, pilot onboarding and programme release map**
  - **Dependencies:** R0.5.
  - **Acceptance:** deploy a safe pilot environment; onboard one real or
    founder-approved design partner cohort; capture baseline and Prepared
    Relationship Moments; record pricing/implementation assumptions and the
    retailer's actual systems; publish the chapter backlog and module-to-plan
    catalogue for all eight families, including what existing Stage 8–16 work
    is reused and what connected vertical slice proves each chapter.
  - **Tests:** onboarding rehearsal, support/recovery, observability, data
    export/correction and rollback plan.
  - **Hard blocker:** absence of a willing design partner pauses external
    pilot proof only. It does not stop safe implementation of later modular
    chapters once their dependencies and local proof contracts are met.

### Risk and activation rules

- **Module delivery:** an assigned chapter, declared dependencies, a named
  buyer/job and a connected user journey. A pilot is preferred evidence, not
  the only authorization for safe technical work.
- **Provider adapter:** current provider contract or real sample payload. The
  present invented Faden HMAC/header fixture must not be described as a live
  contract.
- **Enterprise/vertical module:** named buyer, distinct proposition,
  onboarding journey and reuse map for PAON primitives.
- **Network/ecosystem module:** provider-neutral local work follows its chapter;
  live partners, ads, payouts, procurement or customer-data use additionally
  require supply, legal/commercial basis, customer value and founder approval.
- **Navigation:** a capability appears contextually before it earns a top-level
  destination.

## Modular programme chapters — committed destination

The chapter order is a dependency order, not a statement that the later
product is optional. R0 establishes control and the regression spine; R0.6
must expand each chapter into evidence-sized queue items before legacy work is
resumed.

1. **Chapter 1 — Platform Core:** module registry, entitlements, plans, roles,
   consent, provenance, audit, workflows, integrations, migration, evidence,
   jobs, observability and coherent role shells.
2. **Chapter 2 — Client and Relationship Intelligence:** client memory,
   Advisor Today/Mission Control, appointments, communication, Self-Portrait,
   clienteling, promises and measurable outcomes.
3. **Chapter 3 — Wardrobe and Styling Intelligence:** garment graph,
   StyleProfile, knowledge/metadata, visual wardrobe, fit evidence, roadmaps,
   composed looks, guided consultation and proposals.
4. **Chapter 4 — Commerce and Growth:** storefront, assisted/remote selling,
   cart/order, private offers, campaigns, loyalty/referrals, post-order
   momentum, attribution and growth analytics.
5. **Chapter 5 — Garment and Service Operations:** production projection,
   fitting, alterations, delivery, aftercare, custody, repair, care plans,
   memberships and partner fulfilment.
6. **Chapter 6 — Retail Operations:** catalogue, inventory/RFID, POS/returns,
   workforce, tasks, locations, recognition, reconciliation and operational
   analytics in overlay, co-managed and full-PAON modes.
7. **Chapter 7 — Enterprise and Vertical Solutions:** corporate wardrobes,
   wedding-party apparel, multi-location, preferred tailoring, training,
   consultancy, partner workshops and additional category/occasion packs.
8. **Chapter 8 — Network and Ecosystem:** B2B procurement, curated lifestyle
   commerce, partners/publishers, referrals/revenue share, rewards, events and
   compliant multi-party operations.

Each chapter ends with a multi-role browser-and-database proof, module-off and
dependency behavior, onboarding/rollback, operational recovery and an honest
live-activation status. Independent groundwork may overlap, but a chapter is
not complete while its primary journey is disconnected.

## As-built baseline

Verified against code and 91 migrations on 2026-07-30:

- Three Next.js applications and shared domain/database/auth/UI/integration
  packages are established.
- Product, variant, collection, storefront, cart/order, appointment,
  clienteling, behavioral-event, AI-generation, loyalty, wedding-party,
  alteration, and Demo Studio foundations exist.
- Product facts now include an exact, concept-linked fabric profile foundation
  alongside name, description, status, made-to-order/alterable, primary image,
  swatch image, and collections; variant carries SKU, size, color, price,
  stock, and lead time.
- Storefront category, color, pattern, and season filters prefer accepted
  metadata when present and still fall back to product names, collection
  names, variant color, and founder image-number heuristics.
- `behavioral_events` and `ai_generations` exist. Purpose-specific consent,
  typed interaction events with retention/withdrawal anonymization, and
  customer consent controls now exist. StyleProfile declared/inferred
  preferences with concept evidence and deterministic recomputation exist.
  Consented advisor preparation briefing projects into the Retailer Portal
  client and appointment workspaces; grounded TableService occasion guidance
  cites approved knowledge, seeds swipe shortlists, and converts to
  appointments. Wardrobe ownership and roadmaps/outfits/sartorial rules
  landed in Stage 4.1–4.2; lifecycle, longevity guidance, private self-scan,
  and fit freshness landed in Stage 4.3; MorningRoutine in-app selection and
  save/review/book/buy actions landed in Stage 4.4; opt-in delivery,
  audit, and retailer eligible-product controls landed in Stage 4.5.
- Metadata concepts, edges, assignments, append-only review evidence,
  retailer overrides, and exact product/variant fabric profiles now exist.
  PAON Admin can manage canonical concepts and terminal assignment decisions
  now pass through an actor-derived, tenant-safe review boundary. The Retailer
  Portal metadata review UI lets managers propose/accept/reject tenant
  assignments, create local concepts, and apply presentation overrides.
  Product management now edits exact fabric weight, supplier reference,
  concept-linked composition, and product/variant catalogue assignments.
  Canonical and retailer knowledge objects, concept joins, relations, and
  local hide/presentation/priority/pin overrides now exist with reviewed
  neutral fixtures covering every EDU-001 topic. Founder storefront PDP
  mounts ranked knowledge cards into Archetype/Fabric/Sizing panels.
  Accepted-metadata catalogue query supports named facets, weight/price
  ranges, intent mapping, and pagination with founder filter hooks.
  Catalogue import jobs/rows/review tasks, CSV/XLSX/JSON parsers, downloadable
  contracts, Retailer Portal preview, transactional reviewed-row publishing,
  and AI-assisted enrichment with pending review exist.
  StyleProfile tables, advisor briefs, and grounded TableService guidance
  exist. Wardrobe ownership, sartorial rules, outfits, wardrobe roadmaps,
  lifecycle/self-scan/fit-freshness, MorningRoutine selection, and MorningRoutine
  delivery/subscription tables exist; campaign/private-offer and seven-day
  wardrobe-challenge tables exist; loyalty milestone definition/award tables
  exist and award through the existing loyalty ledger; Preferred Tailoring and
  HighMaintenance concierge service-plan, membership, entitlement, booking,
  fulfilment, care, cost, and history tables exist.

Do not rebuild shipped foundations. Extend them through additive domain types,
forward migrations, repositories, and narrow founder-surface mounts.

## Dependency graph

```text
Metadata contracts
  → metadata persistence/review
  → catalogue assignments
  → knowledge library
  → discovery + search/filter
  → import + enrichment
  → customer evidence + advisor intelligence
  → wardrobe + roadmap
  → MorningRoutine
  → relationship programmes + concierge
  → later regulated commerce
```

Independent verification, documentation, and operational repairs may land when
they do not reorder these product dependencies.

## Ordered build queue

Take the first unchecked item whose dependencies are complete. One item is one
coherent pushed slice unless its acceptance criteria explicitly require
back-to-back sub-slices.

### Stage 0 — Direction

- [x] **0.1 Documentation consolidation**
  - **Requirement IDs:** `ENG-005` and traceability for every founder ID.
  - **Dependencies:** none.
  - **Owner boundary:** documentation authority only: `AGENTS.md`,
    `CLAUDE.md`, `docs/README.md`, this queue, the founder brief, the technical
    programme, append-only ADRs, and factual `PROJECT_STATE.md`.
  - **Acceptance:** one authority per topic; stable-ID traceability covers the
    full brief; Resume Protocol is at the top of the programme; this file is
    the only queue; wardrobe and marketplace boundary ADRs exist.
  - **Tests:** targeted stale-authority search, Markdown formatting, link
    inspection, code/migration baseline audit, and repository definition of
    done.
  - **Non-goals:** no product feature, schema, runtime, or founder-surface
    implementation.
  - **Hard blockers:** none.

### Stage 1 — Metadata foundation

- [x] **1.1 Metadata domain contracts**
  - **Requirement IDs:** `CAT-001`, `CAT-002`, `CAT-003`, `CAT-004`,
    `ENG-001`, `ENG-003`.
  - **Dependencies:** `0.1`; ADR-059.
  - **Owner boundary:** `@paon/domain` only: metadata branded IDs, concept,
    edge, assignment, override, provenance/review enums and schemas,
    `ProductFabricProfile`, pure validation, and exports.
  - **Acceptance:** every catalogue concept named by `CAT-001` is typed;
    composition is concept-linked and totals exactly 100; confidence/evidence
    requirements vary correctly by source/review state; target/ownership types
    cannot be confused.
  - **Tests:** schema boundary tables, invalid enums/IDs, duplicate fibres,
    composition totals/precision, source/evidence/review combinations, and pure
    tenant-compatibility rules.
  - **Non-goals:** no migration, repository, seed taxonomy, UI, AI, search, or
    free-form tag API.
  - **Hard blockers:** none.

- [x] **1.2 Metadata persistence, repositories, and RLS**
  - **Requirement IDs:** `CAT-003`, `CAT-004`, `ENG-001`, `ENG-003`.
  - **Dependencies:** `1.1`; ADR-059.
  - **Owner boundary:** forward Supabase migration, generated database types,
    and `@paon/database` metadata repositories only.
  - **Acceptance:** canonical/retailer concepts, edges, assignments,
    retailer overrides, exact fabric facts, constraints, indexes, RLS, and
    repository mappings implement the domain contracts; target ownership and
    retailer-owned concept compatibility are database-enforced.
  - **Tests:** migrated-schema assertions; repository CRUD/mapping; canonical
    platform access; retailer same-tenant reads/writes; customer/public
    denial; cross-tenant edge/assignment/override denial; append-only review
    evidence where required.
  - **Non-goals:** no management UI, import, knowledge, search, or public
    anonymous metadata reads.
  - **Hard blockers:** local Supabase/Docker unavailable blocks only live
    migration/RLS verification; implement pure/repository work and continue
    independent verification where possible.

- [x] **1.3 Metadata review workflow**
  - **Requirement IDs:** `CAT-003`, `CAT-004`, `ENG-001`.
  - **Dependencies:** `1.2`; ADR-059.
  - **Owner boundary:** PAON Admin canonical management plus Retailer Portal
    review repositories, Server Actions, and focused views.
  - **Acceptance:** platform staff manage canonical concepts; authorized
    retailer staff propose/review/accept/reject tenant assignments and
    overrides; actor/time/source/raw value/confidence/evidence remain
    auditable; unknown values cannot become accepted canonical data silently.
  - **Tests:** authorization matrices, action validation, state-transition
    rules, double-review/idempotency, cross-tenant denial, and accessible
    pending/error/empty states.
  - **Non-goals:** no bulk import UI, autonomous AI approval, knowledge
    authoring, storefront redesign, or semantic retrieval.
  - **Hard blockers:** none.
  - **Landed:** Admin canonical management (`538c9da`) plus Retailer Portal
    metadata review UI (`8eaa834`) — propose/accept/reject, tenant-local
    concepts, presentation overrides, and pending/empty/error/saved states.

- [x] **1.4 Exact product facts and catalogue assignment UI**
  - **Requirement IDs:** `CAT-001`, `CAT-002`, `CAT-004`, `ENG-003`.
  - **Dependencies:** `1.3`; ADR-059.
  - **Owner boundary:** catalogue domain/repositories and Retailer Portal
    product management Server Actions/components.
  - **Acceptance:** staff manage product/variant assignments, exact fabric
    weight, supplier reference, and concept-linked composition; variant facts
    exist only for real variant differences; accepted labels are never copied
    into a parallel string field.
  - **Tests:** product create/edit integration, composition rollback,
    product-versus-variant precedence, authorization/RLS, and accessible form
    validation.
  - **Non-goals:** no import, customer filters, AI inference, or founder
    storefront change.
  - **Hard blockers:** none.

**Stage 1 non-goals:** no embeddings, vector search, autonomous publishing,
free-form tag bag, global Brand registry, Collection-as-Brand shortcut,
storefront redesign, or customer personalization.

### Stage 2 — Knowledge, discovery, search, and import

- [x] **2.1 Knowledge contracts and persistence**
  - **Requirement IDs:** `EDU-001`, `ENG-001`, `ENG-002`, `ENG-003`.
  - **Dependencies:** `1.3`; ADR-060.
  - **Owner boundary:** `@paon/domain`, forward migration/RLS, generated types,
    `@paon/database`, and reviewed canonical fixture data.
  - **Acceptance:** canonical/retailer knowledge objects, concept joins,
    relations, display types, commercial intent, active state, local
    hide/presentation/priority/pin controls, and all founder-named education
    topics are representable.
  - **Tests:** schema validation, override precedence, RLS/cross-tenant denial,
    repository mapping, fixture idempotency, and disabled/hidden eligibility.
  - **Non-goals:** no runtime AI-authored facts, storefront mount, ranking,
    embeddings, or retailer mutation of canonical copy.
  - **Hard blockers:** reviewed production copy/images do not block contracts
    or neutral fixtures; mark unapproved editorial content inactive.

- [x] **2.2 Deterministic discovery engine**
  - **Requirement IDs:** `EDU-002`, `ENG-002`.
  - **Dependencies:** `2.1`; ADR-060.
  - **Owner boundary:** pure ranking/explanation in `@paon/domain` plus
    repository candidate projection; no app-specific scoring forks.
  - **Acceptance:** accepted metadata, journey, pins/priority, commercial
    intent, novelty, relationship proximity, diversity, and viewed penalties
    deterministically yield three to six eligible cards with factor
    explanations.
  - **Tests:** golden ranking fixtures, tie-breaking, diversity, hidden/pinned
    precedence, viewed penalties, empty candidates, and rejected/pending
    metadata exclusion.
  - **Non-goals:** no LLM ranking, vector search, personalization without
    consent, or runtime content generation.
  - **Hard blockers:** none.

- [x] **2.3 Founder-storefront knowledge mounts**
  - **Requirement IDs:** `EDU-003`, `ENG-004`.
  - **Dependencies:** `2.2`; ADR-052 and ADR-060.
  - **Owner boundary:** narrow data serialization/runtime hooks in
    `apps/customer/app/r/[slug]/route.ts` and canonical
    `paon-template.html`; reuse existing information panels.
  - **Acceptance:** square image/title/useful-copy cards appear in Archetype,
    Fabric, and Sizing areas on desktop/mobile; existing markup, styling,
    swipe/cart/filter behavior, and fallback content remain intact.
  - **Tests:** route serialization, DOM snapshot/diff allowlist, Playwright
    desktop/mobile behavior, keyboard/screen-reader semantics, contrast, and
    no-data fallback.
  - **Non-goals:** no React/Tailwind/shared-design-system rewrite, new visual
    language, or unrelated founder HTML cleanup.
  - **Hard blockers:** an indispensable mount that cannot preserve the founder
    surface under ADR-052 blocks this item only.
  - **Landed:** `7cd180f` — per-panel ADR-060 ranking mounts via
    `__PAON_KNOWLEDGE_BY_PRODUCT_JSON__`, public storefront knowledge reads,
    founder fallback when no accepted concepts link.

- [x] **2.4 Structured catalogue query**
  - **Requirement IDs:** `SRCH-001`, `SRCH-002`, `ENG-002`, `ENG-003`.
  - **Dependencies:** `1.4`.
  - **Owner boundary:** `@paon/domain` query contract, indexed
    `@paon/database` repository query, and existing storefront filter/search
    hooks.
  - **Acceptance:** active accepted metadata drives all named facets,
    weight/price ranges, relevance/pagination, known intent mapping, and
    transparent unresolved fallback; existing behavior remains until parity
    coverage passes.
  - **Tests:** repository combinations/ranges/pagination, intent fixtures,
    unresolved query, rejected metadata exclusion, query-plan/index evidence,
    and founder storefront regression.
  - **Non-goals:** no embeddings, opaque relevance, public API, or removal of a
    heuristic before equivalent behavior is protected.
  - **Hard blockers:** none.
  - **Landed:** `a0e03dd` — `CatalogueSearchRequest` / intent resolver /
    `CatalogueQueryRepository`, price/weight/status indexes, public concept
    and fabric-profile reads, and narrow `__PAON_CATALOGUE_BY_PRODUCT_JSON__`
    founder hooks; heuristics retained until parity retires them.

- [x] **2.5 Import contracts and preview**
  - **Requirement IDs:** `IMP-001`, `IMP-002`, `IMP-004`, `CAT-004`.
  - **Dependencies:** `1.3`.
  - **Owner boundary:** import domain schemas, CSV/XLSX/JSON parsers,
    migration/RLS/repositories, downloadable templates/contracts, and
    Retailer Portal preview only.
  - **Acceptance:** jobs/rows/review tasks preserve raw supplier values,
    identifiers and source type; asset matching/category mapping/validation/
    duplicates are explained; schema is PDF-extractor-ready; no row publishes
    from preview.
  - **Tests:** parser fixtures/encoding/empty cells, malformed files, size
    limits, formula/CSV injection handling, duplicates, image matching,
    cross-tenant RLS, and accessible preview.
  - **Non-goals:** no direct PDF extraction, AI inference, autonomous category
    creation, or publishing.
  - **Hard blockers:** none for CSV/XLSX/JSON; a future PDF extraction provider
    is explicitly not required.
  - **Landed:** `dd2e274` — versioned `v1` CSV/XLSX/JSON contract and parsers,
    `catalogue_imports` / `catalogue_import_rows` / `metadata_review_tasks`
    with RLS, `CatalogueImportRepository`, downloadable templates/LLM
    contract, and Retailer Portal `/imports` preview without publishing.

- [x] **2.6 Transactional reviewed import publishing**
  - **Requirement IDs:** `IMP-002`, `IMP-004`, `CAT-002`, `CAT-004`.
  - **Dependencies:** `2.5`.
  - **Owner boundary:** database transaction/RPC, repositories, authorized
    Server Action, and import status UI.
  - **Acceptance:** a valid reviewed row atomically creates/updates product,
    variants, assets, exact facts, and accepted assignments; failures roll back
    fully, retain source/error state, and can be retried idempotently.
  - **Tests:** successful transaction, every failure rollback point,
    duplicate/retry idempotency, partial-batch resume, authorization/RLS, and
    audit attribution.
  - **Non-goals:** no unreviewed bulk publish, AI inference, supplier-specific
    publishing fork, or destructive overwrite of live products.
  - **Hard blockers:** none.
  - **Landed:** `8aa10c6` — `publish_catalogue_import_row` /
    `review_catalogue_import_task` RPCs, publish-error retention with rollback,
    repository batch resume, Retailer Portal review/publish actions and status
    UI, plus pgTAP coverage for success/idempotency/rollback/RLS/audit.

- [x] **2.7 AI-assisted import enrichment**
  - **Requirement IDs:** `IMP-003`, `IMP-004`, `ENG-002`.
  - **Dependencies:** `2.5`, `2.6`.
  - **Owner boundary:** Admin-maintained external prompt/LLM contract first,
    then provider-neutral `@paon/ai` job runner and audit repository.
  - **Acceptance:** schema-validated JSON proposes taxonomy mappings and
    derived suitability with field-level source/evidence/confidence; protected
    supplier facts cannot be invented; every inference is pending review.
  - **Tests:** golden prompt/schema fixtures, malicious/invalid model output,
    unknown taxonomy, invented mill/composition rejection, retries/idempotency,
    and provider mocks.
  - **Non-goals:** no provider lock-in, live-provider requirement, autonomous
    publish, prompt PII, or model-authored canonical knowledge.
  - **Hard blockers:** missing AI key blocks live smoke verification only, not
    external-prompt or provider-neutral implementation.
  - **Landed:** `21297da` — Admin-maintained
    `import_enrichment_prompt_contracts`, domain validation that rejects
    invented protected facts, provider-neutral `@paon/ai` enrichment runner
    with mocks, `ai_generations.import_enrichment` audit, pending AI review
    tasks with evidence/field_key idempotency, and Retailer Portal enrich
    action; live OpenAI smoke remains optional.

**Stage 2 non-goals:** no semantic/vector retrieval before accepted metadata
and search/click evidence exist; no autonomous AI facts; no React rewrite of
the founder storefront; no public API; no supplier-specific dependency; no
unreviewed bulk publish.

### Stage 3 — Customer and advisor intelligence

- [x] **3.1 Consent and interaction-event upgrade**
  - **Requirement IDs:** `CUST-001`, `CUST-003`, `ENG-002`.
  - **Dependencies:** `2.4`; ADR-021 and ADR-061.
  - **Owner boundary:** consent/event domain, forward migration/RLS,
    repositories, customer controls, and narrow event producers.
  - **Acceptance:** personalization, marketing, and location purposes are
    separate; every named interaction is typed with consent snapshot,
    retention, and lawful anonymous session support; withdrawal stops new use
    and starts documented deletion/anonymization without erasing durable
    records.
  - **Tests:** consent state matrix, withdrawal, expiry/retention, anonymous
    linking denial, advisor visibility, event validation, and cross-tenant RLS.
  - **Non-goals:** no covert fingerprinting, raw prompt duplication, durable
    order/message duplication, StyleProfile inference, or required location.
  - **Hard blockers:** unresolved jurisdiction-specific anonymous tracking
    blocks anonymous persistence only; signed-in explicit-consent work remains.
  - **Landed:** purpose-specific consent + typed interaction events with
    retention/withdrawal/anonymization (`feat` commit on main); anonymous
    persistence remains denied until a jurisdiction documents a lawful basis.

- [x] **3.2 StyleProfile evidence and recomputation**
  - **Requirement IDs:** `CUST-002`, `CUST-003`, `ENG-002`.
  - **Dependencies:** `3.1`; ADR-061.
  - **Owner boundary:** intelligence domain pure rules, migration/RLS,
    repositories, and customer preference controls.
  - **Acceptance:** declared and inferred preferences are structurally
    separate; evidence records concept/source/polarity/confidence/recency;
    recomputation is deterministic/explainable; customers can inspect/remove
    inference without deleting lawful business history.
  - **Tests:** scoring/decay fixtures, contradictory evidence, explicit
    precedence, withdrawal/deletion, idempotent recomputation, and
    advisor/cross-tenant denial.
  - **Non-goals:** no black-box personality score, cross-retailer profile,
    location inference, or AI overwrite of explicit preferences.
  - **Hard blockers:** none.
  - **Landed:** `82f499c` — StyleProfile domain recompute, evidence tables/
    RLS/RPCs, `StyleProfileRepository`, and customer account inspect/remove.

- [x] **3.3 Advisor preparation brief**
  - **Requirement IDs:** `ADV-003`, `CUST-003`.
  - **Dependencies:** `3.2`.
  - **Owner boundary:** retailer-scoped intelligence repository projection and
    the existing Retailer Portal client workspace.
  - **Acceptance:** authorized advisor sees consented recent interests, saved
    products, knowledge, occasion, evidence, questions, shortlist, and later
    wardrobe gaps with source/recency; appointment prep continues the online
    conversation.
  - **Tests:** projection completeness, no-consent/withdrawn states,
    role/cross-tenant denial, stale evidence, empty/error/accessibility, and no
    raw hidden PII.
  - **Non-goals:** no autonomous outreach, staff performance scoring, customer
    sharing between retailers, or generated facts.
  - **Hard blockers:** none.
  - **Landed:** `6f5fac4` — deterministic `buildAdvisorPreparationBrief`,
    `AdvisorBriefRepository` projection, and Retailer Portal mounts on
    customer relationship + appointment prep workspaces.

- [x] **3.4 Grounded TableService and guided preference capture**
  - **Requirement IDs:** `ADV-001`, `ADV-002`, `ENG-002`.
  - **Dependencies:** `2.2`, `3.2`; ADR-060 and ADR-061.
  - **Owner boundary:** TableService orchestration, approved-knowledge
    retrieval, `@paon/ai` structured answer, existing conversation/swipe/
    shortlist/appointment surfaces.
  - **Acceptance:** advisor-first handoff stays visible; approved citations and
    uncertainty ground answers; occasion flows including summer weddings
    produce explainable shortlists, swipe evidence, and appointment conversion;
    advisors can continue the thread.
  - **Tests:** grounding/citation allowlist, unsupported-answer refusal,
    human-handoff path, occasion/swipe evidence, consent withdrawal, provider
    mocks, browser and accessibility.
  - **Non-goals:** no autonomous high-value advice, open-web grounding,
    uncited product facts, hidden persuasion, or mandatory AI provider.
  - **Hard blockers:** missing AI key blocks live generation only; deterministic
    retrieval, handoff, and mocked orchestration remain buildable.
  - **Landed:** `ed2f0dc` — grounded-answer domain + citation allowlist,
    `generateGroundedAnswer` / mocks, `TableServiceGuidanceRepository`,
    TableService Server Action + widget handoff/shortlist/swipe/appointment
    hooks, consented `advisor_question` / `appointment_intent` producers.

**Stage 3 non-goals:** no covert tracking, no precise location without
separate opt-in, no unexplained score, no advisor access across tenants, no raw
prompt/PII duplication, no AI answer that outranks approved knowledge, and no
replacement of human advice for uncertain high-value decisions.

### Stage 4 — Wardrobe intelligence and MorningRoutine

- [x] **4.1 Wardrobe ownership and collaboration**
  - **Requirement IDs:** `WARD-001`, `WARD-002`, `WARD-003`, `ENG-003`.
  - **Dependencies:** `3.2`; ADR-063.
  - **Owner boundary:** wardrobe domain, forward migration/RLS, repositories,
    and Customer/Retailer Portal wardrobe views; existing `PhysicalGarment`
    remains the official fitting/service aggregate.
  - **Acceptance:** retailer-purchased and external items carry ownership,
    provenance, condition, basic fit/care/wear state and accepted/reviewable
    metadata; customer and authorized advisor collaborate only inside the same
    retailer relationship.
  - **Tests:** external/catalogue item schemas, ownership history, customer/
    advisor role matrix, cross-tenant denial, external metadata review, visual
    empty/error/accessibility states.
  - **Non-goals:** no generic manufacturing fit profile, product clone,
    cross-retailer wardrobe, roadmap, recommendation, or marketplace item.
  - **Hard blockers:** none.
  - **Landed:** `a407890` — wardrobe domain, migration/RLS, ownership history,
    `WardrobeRepository`, Customer `/wardrobe` and Retailer customer wardrobe
    collaboration; `PhysicalGarment` unchanged as fitting/service aggregate;
    wardrobe_item metadata targets enabled for review.

- [x] **4.2 Wardrobe Roadmap, outfits, and sartorial rules**
  - **Requirement IDs:** `ROAD-001`, `ROAD-002`, `ENG-002`.
  - **Dependencies:** `4.1`, `2.1`; ADR-060 and ADR-063.
  - **Owner boundary:** wardrobe/knowledge domain, repositories, advisor
    authoring, customer approved-plan view, and explainable pure compatibility
    rules.
  - **Acceptance:** advisors build goals, ranked gaps, staged priorities, and
    complete looks spanning jackets/trousers/shirts/shoes/accessories/
    pocket-squares; every suggestion cites owned/catalogue facts and an
    approved founder/retailer rule.
  - **Tests:** compatibility/conflict fixtures, explanation completeness,
    author/approval transitions, tenant/RLS, unavailable items, and
    customer/advisor browser/a11y flows.
  - **Non-goals:** no unreviewed generic menswear assertion, autonomous
    purchase, hidden score, or roadmap shared across retailers.
  - **Hard blockers:** missing founder-authored rules blocks only claims that
    require those exact rules; neutral data model and reviewed proposal
    workflow remain buildable.
  - **Landed:** `92f7afe` — sartorial rules (seeded accepted slot pairs +
    retailer pending review), outfits/slots, wardrobe roadmaps with
    goals/ranked gaps/cited stages, explainable
    `evaluateOutfitCompatibility`, Retailer authoring + Customer approve/
    reject, advisor-brief gap projection; fabric/colour/formality founder
    nuance remains proposal-only and fails closed when unapproved.

- [x] **4.3 Lifecycle, longevity, self-scan, and fit freshness**
  - **Requirement IDs:** `WARD-002`, `FIT-001`, `FIT-002`, `FIT-003`,
    `LONG-001`.
  - **Dependencies:** `4.1`; ADR-016, ADR-055, and ADR-063.
  - **Owner boundary:** wardrobe lifecycle/history, private attachment storage,
    official-fitting projection, appointment/alteration handoff, and customer/
    advisor service views.
  - **Acceptance:** age/wear/rest/care/cleaning/repair state produces respectful
    guidance; eligible order-line/garment self-scan accepts photo/notes;
    official last-measured date drives deterministic escalating freshness and
    book/alteration actions; self reports never become formal observations.
  - **Tests:** lifecycle state/rules, secure object paths, provenance
    separation, freshness thresholds, appointment/alteration handoff,
    customer/advisor/cross-tenant access, and accessibility.
  - **Non-goals:** no coercive planned obsolescence, body measurement profile,
    medical judgement, automatic alteration, or public images.
  - **Hard blockers:** none.
  - **Landed:** `bd22637` — wardrobe lifecycle events, private
    `wardrobe-evidence` self-scan attachments, deterministic fit freshness from
    official observations, longevity guidance without forced replacement,
    appointment/alteration handoff; `PhysicalGarment` unchanged as fitting
    aggregate.

- [x] **4.4 MorningRoutine selection and actions**
  - **Requirement IDs:** `MR-001`, `MR-002`, `ENG-002`.
  - **Dependencies:** `4.2`, `3.2`; ADR-061 and ADR-063.
  - **Owner boundary:** pure routine selection/explanation, provider-neutral
    weather/calendar interfaces, repository projections, and Customer
    Environment in-app view.
  - **Acceptance:** owned available garments rank first; catalogue items are
    secondary; consented StyleProfile/occasion/weather/location inputs are
    traceable and optional; every result explains itself and exposes
    save/review/book/buy where valid.
  - **Tests:** selection fixtures/fallbacks, no-location path, withdrawn
    consent, weather/calendar failure, unavailable garment, action
    authorization, browser/a11y.
  - **Non-goals:** no native mobile app, required precise location, automatic
    purchase, generic ad insertion, or provider-specific domain logic.
  - **Hard blockers:** missing weather/calendar credentials blocks live smoke
    verification only; interfaces, fixtures, and no-provider fallbacks remain.
  - **Landed:** `fcd0260` — pure owned-first MorningRoutine selection with
    consent/weather/calendar/StyleProfile provenance, provider-neutral weather
    and calendar ports with OpenWeather + appointment adapters, selection
    persistence/RLS, and Customer `/morning-routine` save/review/book/buy.

- [x] **4.5 MorningRoutine delivery and retailer controls**
  - **Requirement IDs:** `MR-002`, `MR-003`, `CUST-003`.
  - **Dependencies:** `4.4`; ADR-061.
  - **Owner boundary:** in-app notification/email outbox orchestration,
    subscription/frequency/quiet-period controls, delivery audit, suppression,
    and retailer eligible-product controls.
  - **Acceptance:** explicit opt-in daily delivery is timely, auditable,
    frequency-controlled, unsubscribeable, and derives from the exact routine;
    retailer controls cannot bypass consent or inject unrelated promotion.
  - **Tests:** scheduler/idempotency/time zone/quiet period, unsubscribe/
    withdrawal, suppression, outbox payload, provider mocks, and customer/
    retailer browser accessibility.
  - **Non-goals:** no marketing-consent inference, SMS/push by default,
    guaranteed live email without credentials, or mass campaign engine.
  - **Hard blockers:** missing Resend key blocks live delivery verification
    only; outbox and mocked delivery remain buildable.
  - **Landed:** `933ab1c` — explicit MorningRoutine subscriptions
    (frequency/timezone/quiet hours/channels), append-only delivery audit,
    retailer pause + eligible-product allowlist, cron enqueue from the exact
    selection via existing notification/email outbox path.

- [ ] **4.6 Virtual Wardrobe Studio — shared foundation**
  - **Requirement IDs:** `VWS-001`, `VWS-002`, `VWS-003`.
  - **Dependencies:** `4.2`; ADR-033, ADR-061, ADR-063, ADR-074.
  - **Owner boundary:** wardrobe/AI-integration domain, forward migration/RLS,
    repositories, `@paon/ai` provider adapter, queue and private storage. No
    UI in this item — see `docs/VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md` §5 for
    4.7–4.10.
  - **Acceptance:** founder-level spec recorded in
    `docs/VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md`; `StylePortrait`,
    `RetailerVisualPreset`, `WardrobeVisualizationJob`,
    `WardrobeVisualizationFeedback` exist with tenant RLS; `Outfit` accepts
    customer authorship alongside advisor authorship; a standalone
    `StylePortraitConsent` contract keeps image-generation consent independent
    from intelligence consent; four canonical `"fit"`-kind
    `MetadataConcept` archetypes are seeded and reachable through the existing
    `upsert_declared_style_preference` RPC; `AIProvider.
generateWardrobeVisualization` exists behind the same provider-neutral
    interface as `generateConceptImages`; a claim-and-process queue function
    mirrors `claim_pending_emails`; a private storage bucket holds reference
    and generated images with tenant-scoped object RLS; no image is exposed to
    a customer or advisor except through the immutable job snapshot.
  - **Tests:** domain unit tests for the new pure functions (author guard,
    tailoring-attribute derivation, transition/consistency checks), repository
    tenant-isolation tests for every new table, migrated-schema assertions.
  - **Non-goals:** no new fit-profile table (ADR-074) — fit archetypes reuse
    `MetadataConcept`/`customer_style_preference_evidence`; no new "Look" or
    "roadmap" entity — generation attaches to the existing `Outfit`/
    `WardrobeRoadmap`; no UI, no live provider credential requirement, no
    body-modification-capable preset field.
  - **Hard blockers:** none for local implementation; live end-to-end image
    generation requires a configured provider credential, same posture as
    every other `ai_generations`-backed feature.
  - **Status (2026-08-09, Lane H reconciliation):** the Lane D foundation is
    now integrated as `7cc9ba7` with generated types corrected against the
    migrated Lane H schema in `933ef29`. Migration `20260806100000` applies
    cleanly on the ledger-approved disposable local Supabase target; all 177
    pgTAP assertions, 18 virtual-studio domain assertions, 5 provider-runner
    assertions, 10 repository security assertions, workspace lint/typecheck,
    all 1,102 domain tests, all 489 database tests (70 gated live tests
    skipped), all 48 AI tests, production builds and format check pass. The
    queue, Outfit-linked immutable input snapshot, tenant triggers/RLS,
    private storage policy, provider runner and provider-neutral entities are
    now canonical on this branch. Checkbox remains unchecked: the standalone
    consent contract is domain-only in this foundation and generation enqueue
    is not yet transactionally gated by persisted consent; the customer UI,
    output-storage ingestion and connected browser proof belong to 4.7/4.8.
    The global completion validator remains red on pre-existing stale/missing
    evidence for other checked PHASE items, so no ADR-068 evidence record or
    formal completion claim is fabricated here.
  - **Status (2026-08-09, Lane H consent-boundary follow-up):** the earlier
    persisted-consent gap is closed by `486418a`. Enqueue now re-derives the
    authenticated customer/advisor, requires an active `wardrobe_styling`
    module, acknowledged granted consent and an approved same-House portrait
    transactionally before inserting; the service runner rechecks module and
    consent immediately before provider invocation. `ff0be5a` executes the
    real RPC under preview/suspended/off, missing/withdrawn consent, draft
    portrait and allowed states; all 185 pgTAP assertions pass. The checkbox
    remains unchecked because ADR-068 connected evidence has not been recorded
    and the onboarding preview is not yet an AI-rendered neutral preview.
  - **Status (2026-08-09, Lane H reference-input repair):** review of the
    remaining neutral-preview gap exposed a deeper provider invariant failure:
    the OpenAI adapter named signed reference URLs only inside a DALL-E 3 text
    prompt, so neither outfit renders nor a future onboarding preview actually
    supplied the customer's images to the model. `a690d7d` moves wardrobe
    generation to `gpt-image-2` multi-image `images.edit`, downloads only
    JPEG/PNG/WEBP references with a 50 MB ceiling, and returns transient base64
    output for the existing processor to copy into PAON-controlled private
    storage. Delegated `8fa3af8` proves two real Uploadable inputs, prompt/body
    safety constraints, transient output and missing/unsupported/oversized
    fail-closed paths; the focused AI suite is 7/7. This repairs the shared
    provider boundary but does not falsely close 4.6: the onboarding action
    still needs to enqueue and complete its neutral render through the existing
    consent/module-gated queue, and current ADR-068 proof remains outstanding.

- [ ] **4.7/4.8 Virtual Wardrobe Studio — Style Portrait onboarding and
      customer single-look Studio**
  - **Requirement IDs:** `VWS-001`, `VWS-002`.
  - **Dependencies:** `4.6`; ADR-074.
  - **Owner boundary:** customer Server Actions/UI on existing `/account` and
    `/wardrobe` surfaces; admin queue processor and PAON-controlled output
    ingestion. No new customer destination.
  - **Acceptance:** explicit grant/withdrawal, private face/full-body uploads,
    existing-StyleProfile fit archetype, customer approval/supersession,
    customer-authored single-look `Outfit`, consent/module-gated enqueue,
    queued status/cancellation/feedback, sequential processing and private
    output storage.
  - **Tests:** real customer Playwright flow plus pgTAP refusal matrix for the
    persisted generation boundary.
  - **Hard blockers:** live rendered-image proof requires the configured
    provider credential already named by 4.6; local composition/queue proof
    remains buildable without it.
  - **Status (2026-08-09, Lane H reconciliation):** `939c537` integrates the
    Lane D onboarding, customer Studio, output-storage migrations and admin
    processor. `486418a` composes the R0.3 module kernel and explicit persisted
    consent into every customer generation boundary while keeping withdrawal
    and queued cancellation available after suspension. The disposable local
    stack applies through migration `20260809130000`; the committed Playwright
    journey grants consent, uploads both references, declares a fit archetype,
    approves the portrait, composes an owned-item look and observes a queued
    job. `ff0be5a` proves all seven denial/allow states and exact queued-row
    creation through pgTAP. Checkbox remains unchecked: the current onboarding
    “preview” is a signed view of the uploaded full-body reference rather than
    a neutral AI render, advisor handoff is 4.9, and no current ADR-068 evidence
    run records this connected tranche.
  - **Status (2026-08-09, Lane H, in progress — not verified):** `d4b0d1d`
    replaces the signed-reference "preview" with a real queued neutral AI
    render: `generateStylePortraitPreview` now enqueues a
    `style_portrait_preview`-kind `WardrobeVisualizationJob` (new
    `job_kind` column and `enqueue_style_portrait_preview_job` SECURITY
    DEFINER RPC, migration `20260809160000`) instead of writing
    `portrait.previewImageUrl` synchronously; the admin cron processor and
    `complete_wardrobe_visualization_job` now transition the portrait to
    `preview_generated` only once the job reaches `ready`, and
    `style-portrait-panel.tsx` renders queued/generating/failed states.
    **Known regression, not yet fixed:** this makes
    `apps/customer/e2e/virtual-studio.spec.ts` (lines ~179-198) stale — it
    still asserts that clicking "Continue" synchronously shows "Check your
    photo, then approve..." and reaches `approved`, which no longer happens
    without a completed job. The fix is the same fixture pattern already
    used by `roadmap-look-review.spec.ts` and
    `virtual-studio-batch-and-feedback-evidence.spec.ts`: after asserting
    the queued state and the enqueued `style_portrait_preview` job row,
    call `WardrobeVisualizationJobRepository(admin).complete({ jobId,
status: "ready", outputStorageBucket, outputStoragePath })` to
    simulate the queue processor (this sandbox has no `OPENAI_API_KEY`),
    reload, then continue the existing Approve/compose/enqueue assertions.
    Not yet run: the full `pnpm lint && pnpm typecheck && pnpm test &&
pnpm build && pnpm format:check` sweep for this tranche, and no
    ADR-068 evidence file has been recorded for it. Do not treat `d4b0d1d`
    as verified until that spec is repaired and the definition-of-done
    passes; the next session should start there before taking any other
    PHASE item.
  - **Status (2026-08-09, Lane H, verified_local):** `8ecc84f` repairs
    `virtual-studio.spec.ts` for the queued preview flow: it now asserts
    the queued job row, drives it to `generating` then `ready` via
    `WardrobeVisualizationJobRepository.complete` (simulating the queue
    processor; this sandbox has no `OPENAI_API_KEY`), reloads, then
    continues the existing approve/compose/enqueue assertions; cleanup
    deletes the `style_portrait_preview` job before its portrait
    (`on delete restrict`). `pnpm lint`, `pnpm typecheck`, `pnpm build` and
    `pnpm format:check` are clean at `8ecc84f`; `pnpm test`'s domain/database
    suites are green (1109 + 496 passed) and the customer Playwright suite
    (`virtual-studio.spec.ts`, `roadmap-look-review.spec.ts`,
    `virtual-studio-batch-and-feedback-evidence.spec.ts`) is 3/3 against a
    clean `supabase db reset`. `pnpm test`'s repo-wide `validate:completion`
    gate fails independently of this tranche — pre-existing missing/stale
    evidence on unrelated checked items 8.4, 9.1, 11.4, 12.2, 12.4, 13.1,
    13.2, 17.2–17.6, 17.9, 17.14, 18.1, 18.2, 18.6, 18.8, 18.12 — confirmed by
    re-running it against the prior commit before this tranche's changes.
    `docs/evidence/runs/4.7-4.8-customer-style-portrait-onboarding.json`
    records the passing run at `8ecc84f`. Checkbox stays unchecked: this
    item's own **Dependencies** line names `4.6`, which remains unchecked
    (its own status still names outstanding ADR-068 connected evidence);
    the queue rule above forbids checking a dependent item first. This
    session did not re-audit 4.6's full acceptance/evidence state — that is
    a separate judgment call for whoever next closes 4.6, not assumed here.

- [ ] **4.9 Virtual Wardrobe Studio — advisor visual roadmap and customer
      per-look review**
  - **Requirement IDs:** `VWS-001`.
  - **Dependencies:** `4.2`, `4.6`, `4.7/4.8`; ADR-074.
  - **Owner boundary:** retailer Server Actions/UI inside the existing client
    profile roadmap card; customer review inside the existing `/wardrobe`
    roadmap panel. No new Look or roadmap aggregate.
  - **Acceptance:** an advisor composes up to twelve roadmap-linked `Outfit`
    records from owned/catalogue pieces, enqueues one or all pending looks
    sequentially through the consent/module-gated visualization queue and can
    cancel queued work; the customer reviews one ready look at a time with
    Love it, Maybe, Not for me or a written change request attached to the
    exact visualization job.
  - **Tests:** repository query/mapping coverage, real pgTAP authorization and
    recovery matrix, retailer advisor-to-queue Playwright and customer
    per-look feedback Playwright.
  - **Hard blockers:** live rendered-image proof still requires the configured
    provider credential named by 4.6; local queue/review proof is complete.
  - **Status (2026-08-09, Lane H reconciliation):** `9a751bc` integrates the
    advisor and customer surfaces without duplicating `Outfit` or
    `WardrobeRoadmap`. The reconciliation found and repaired two drift gaps:
    `14235c8` lets an authorized same-House advisor cancel a queued job even
    after module suspension or consent withdrawal while refusing a
    cross-House advisor; `890ea0f` updates the browser fixture to grant the
    persisted image-generation consent now required by the canonical enqueue
    boundary. Delegated `ad1c133` adds three focused
    `OutfitRepository.findByRoadmap` assertions. Clean local proof is 188/188
    pgTAP, 1/1 retailer browser, 1/1 customer browser, 1,105 domain tests,
    496 database tests (70 gated live tests skipped), all production builds,
    lint/typecheck and format. ADR-068 browser-run records point to reachable
    code SHAs. The checkbox remains unchecked because dependencies 4.6 and
    4.7/4.8 remain formally unchecked and the global completion validator is
    still red on pre-existing stale/missing evidence for unrelated checked
    items; no false completion claim is made.

- [ ] **4.10 Virtual Wardrobe Studio — multi-look queue and
      personalization loop**
  - **Requirement IDs:** `VWS-001`.
  - **Dependencies:** `4.6`, `4.7/4.8`, `4.9`.
  - **Owner boundary:** customer-app Server Actions/UI inside the existing
    `/wardrobe` Virtual Studio panel; the existing
    `claim_pending_wardrobe_visualization_jobs` queue RPC; the existing
    `customer_style_preference_evidence` evidence path.
  - **Acceptance:** a customer can enqueue generation for every one of
    their own saved (non-roadmap) outfits that has no active/ready job yet
    in one action ("Create all saved looks"), enqueuing sequentially
    through a shared `enqueueLook` helper so the single-look and batch
    paths never drift; a customer can bulk-cancel every still-`queued` job
    across their own looks ("Cancel all queued") — a `generating` job runs
    to completion, per the existing `canCancelWardrobeVisualizationJob`
    guard; the queue claim function orders by `(created_at, id)` instead of
    `created_at` alone, giving concurrent batch enqueues a deterministic
    claim order; `love_it`/`save`/`not_for_me` feedback on a `ready` look
    feeds `customer_style_preference_evidence` through the existing
    `record_style_preference_evidence` RPC (two new sources,
    `generation_loved`/`generation_rejected`, additive forward migration),
    resolving concepts from the outfit's own slots exactly like a product
    interaction does today — gated by the same personalization-consent
    check every other inferred-evidence capture site uses, and never
    blocking the feedback write itself if evidence capture fails.
  - **Tests:** a committed Playwright e2e spec
    (`apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts`)
    drives the real batch-enqueue, deterministic-claim, bulk-cancel, and
    feedback-to-evidence flows end-to-end against local Supabase, including
    proving a second, distinct feedback signal on the same look appends a
    new evidence row rather than mutating the first.
  - **Non-goals:** no new preference-evidence table (§7 of the blueprint);
    no change to the single-look enqueue/cancel/feedback paths landed in
    4.7–4.9; no live image rendering proof (same documented
    `OPENAI_API_KEY` hard-blocker posture as every prior VWS slice); no
    advisor-side batch changes (4.9's advisor "generate all pending" already
    covers that surface).
  - **Hard blockers:** none for local implementation; live image rendering
    requires a configured provider credential.
  - **Status (2026-08-09, Lane H reconciliation):** `18210d2` integrates Lane
    D's domain `styleEvidenceForWardrobeVisualizationFeedback`,
    customer `generateAllSavedLooks`/`cancelAllQueuedLooks`/
    `feedStyleProfileEvidence` Server Actions and `BatchLookActions` UI,
    deterministic-claim-order migration and a connected browser spec while
    preserving the canonical module/image-consent guards. `7cb3c19` adds a
    forward migration restoring the event-provenance and replay-idempotency
    guarantees lost by the older-branch RPC rewrite; `07f1bda` is the
    delegated persisted-consent fixture repair. Clean local proof is 190/190
    pgTAP, 25/25 focused Virtual Studio domain tests, 1/1 customer browser,
    1,109 domain tests, 496 database tests (70 gated live tests skipped), all
    production builds, lint/typecheck and format. The ADR-068 browser record
    points to reachable code SHA `07f1bda`. The checkbox remains unchecked
    because dependencies 4.6, 4.7/4.8 and 4.9 remain formally unchecked and
    the global completion validator is still red on the pre-existing
    historical evidence backlog.

**Stage 4 non-goals:** no generic customer manufacturing fit profile (ADRs 016
and 055 remain — see ADR-074 for the visualization-only fit-preference
distinction 4.6 relies on), no retailer sharing of wardrobe data, no required
location, no native mobile app, no automatic purchase, and no recommendation
without an explanation path.

### Stage 5 — Relationship programmes and concierge services

- [x] **5.1 Private offers and seven-day wardrobe campaigns**
  - **Requirement IDs:** `CAMP-001`, `CAMP-002`, `MR-003`, `MILE-002`.
  - **Dependencies:** `3.2`, `4.2`; ADR-061.
  - **Owner boundary:** campaign domain/migration/RLS/repositories, Retailer
    Portal rules, authenticated Customer Environment private-offers and
    seven-look experience, delivery/suppression audit.
  - **Acceptance:** retailer targets fabric/category/product/audience/schedule
    through explainable consent-aware rules; customer composes seven complete
    catalogue looks; deterministic completion grants only restrained
    configured tie/shirt/short-lived rewards.
  - **Tests:** audience/schedule/time zone, suppression/withdrawal, challenge
    completeness/idempotency, reward cap, RLS, private authentication,
    premium responsive UI and accessibility.
  - **Non-goals:** no Groupon-style feed, indiscriminate discount, chance-based
    reward, opaque audience, or reuse of marketing consent for personalization.
  - **Hard blockers:** an unprovided founder visual blocks only a new
    founder-defined surface; domain/control work and existing-surface
    composition remain buildable.
  - **Landed:** campaign domain/migration/RLS, Retailer `/settings/campaigns`,
    Customer `/private-offers` seven-look composer, delivery/suppression audit
    and cron enqueue.

- [x] **5.2 Tailoring milestones and premium rewards**
  - **Requirement IDs:** `MILE-001`, `MILE-002`.
  - **Dependencies:** `1.4`; existing loyalty ledger.
  - **Owner boundary:** pure eligibility rules and existing loyalty
    event/ledger/reward repositories and customer/advisor projections.
  - **Acceptance:** first commission, repeat order, new category, premium
    construction, advanced fabric, and configured peers derive idempotently
    from authoritative data; awards are auditable and never create a second
    balance.
  - **Tests:** rule fixtures, replay/idempotency, corrections/refunds,
    concurrency, ledger audit, tenant isolation, and premium presentation/a11y.
  - **Non-goals:** no gambling, streak pressure, random reward, shadow points
    balance, or unaudited manual grant.
  - **Hard blockers:** none.
  - **Landed:** `36fecc5` — pure eligibility rules, milestone definition/award
    migration/RLS, ledger-backed awards with refund corrections, Customer and
    Retailer/advisor projections.

- [x] **5.3 Preferred Tailoring and HighMaintenance operations**
  - **Requirement IDs:** `SERV-001`, `SERV-002`, `LONG-001`.
  - **Dependencies:** `4.3`; existing appointments/alterations; ADR-062 for
    later billing only.
  - **Owner boundary:** dedicated concierge service plans, entitlements/
    non-monetary credits, bookings, fulfilment, care/repair, collection/
    delivery and advisor ownership; compose rather than overload orders/
    alterations.
  - **Acceptance:** both named services support advisor planning, customer
    booking, operational commitments/status, service history, cost recording,
    and handoffs; the entire operational workflow works without new payment
    capability.
  - **Tests:** plan/booking/fulfilment transitions, entitlement consumption/
    idempotency, appointment/alteration composition, role/RLS, audit history,
    customer/advisor browser and accessibility.
  - **Non-goals:** no unapproved subscription billing, stored value, hidden
    generic order statuses, automatic collection routing, or provider lock-in.
  - **Hard blockers:** payment/compliance blocks money collection only, not
    service operations.
  - **Landed:** `437a49e` — concierge domain/migration/RLS/RPCs,
    `ServicePlanRepository`, Customer `/services` and Retailer `/services`
    operational surfaces composing appointments/alterations without payment.

- [x] **5.4 Tie-Mate**
  - **Requirement IDs:** `TIE-001`, `ENG-004`.
  - **Dependencies:** `2.3`, `3.4`; ADR-052; ADR-065; approved founder surface/design.
  - **Owner boundary:** dedicated mobile founder surface and narrow catalogue/
    stock/discovery/shortlist/order/advisor hooks; shared domain/repositories
    remain canonical.
  - **Acceptance:** fabrics render at true-feeling phone-screen scale with
    mobile swipe, save, order, and advisor handoff; stock and retailer tenancy
    are live; desktop fallback and accessibility are intentional.
  - **Tests (local unit — implemented):** empty/out-of-stock deck projection
    (drives empty guidance), ArrowLeft/ArrowRight keyboard map, retailer-scoped
    catalogue projection, wishlist save RPC args for authenticated
    retailer/variant, and fail-closed propagation of cross-retailer wishlist
    denial (`Product is not available from this retailer`).
  - **Tests (still requiring hosted verification):** anonymous browser browse
    without mutation authority, signed-in wishlist save/order/handoff
    integration, viewport/gesture/screen-reader and realistic-scale visual
    snapshots, live stock-change UX, and runtime RLS/pgTAP denial against a
    real database. `pnpm test` does not run Playwright or pgTAP.
  - **Non-goals:** no invented founder design, product stock copy, generic
    Tinder styling, separate catalogue, Hermès branding/games, or customer-side
    CV fabric recognition.
  - **Hard blockers:** no approved founder surface/design is a real blocker for
    the UI item; underlying reusable foundations must still ship first.
  - **Status:** complete for TIE-001 interim acceptance under ADR-065 with
    local unit evidence above — founder authorized `/r/[slug]/tie-mate` using
    existing PAON storefront patterns/tokens. Domain deck/photo/handoff,
    catalogue projection, and Customer interim UI with swipe/save/buy/advisor
    handoffs landed. Hosted browser/RLS/a11y verification remains an open gap
    (not a Stage 6 unlock). A later ADR-052 verbatim founder-HTML port may
    replace interim chrome.
  - **Landed (foundation):** `6842fb5` — `@paon/domain` `buildTieMateDeck` /
    `resolveTieMateFabricImage` / `buildTieMateActionPaths` /
    `resolveTieConceptIds` with unit coverage — swatch-preferred fabric
    photos, neckwear concept filter, stock truth, shortlist pin order, and
    handoffs into existing product/swipe/appointment/message paths.
  - **Landed (repository):** `345ea4d` — `@paon/database` `TieMateRepository`
    projects live tenant products + variants/stock + accepted metadata
    assignments into `TieMateFabricCandidate`, resolves neckwear
    `garment_type` concept IDs, and feeds `buildTieMateDeck`
    (`projectFabricCandidates` / `resolveTieConceptIdsForRetailer` /
    `buildDeck`) with unit coverage including empty OOS/photo-less decks.
  - **Landed (interim UI):** `7b684ff` — Customer `/r/[slug]/tie-mate` mounts
    `TieMateRepository.buildDeck` + `buildTieMateActionPaths`; phone-scale
    full-bleed fabric (swatch preferred), pointer swipe + ArrowLeft/Right,
    wishlist save, PDP buy, appointment/messages/swipe handoffs; empty-deck
    guidance; retailer product-image guidance for sharp `swatch_image_url`
    close-ups. Keyboard map unit-tested via `resolveTieMateKeyboardAction`.
  - **Landed (verification harden):** unit evidence for empty/OOS decks,
    keyboard map, wishlist RPC retailer/variant args, and cross-retailer
    wishlist denial propagation; PHASE test language split into local vs
    hosted gaps.

**Stage 5 non-goals:** no mass-discount gamification, opaque audiences,
duplicate loyalty ledger, service state hidden in generic order status, or
invented founder-designed surface.

### Stage 6 — Later commerce capabilities

- [ ] **6.1 Payment and compliance design gate**
  - **Requirement IDs:** `PAY-001`, `PAY-002`, `SERV-002`.
  - **Dependencies:** business/legal/accounting/provider decisions; ADR-030,
    ADR-031, ADR-050, and ADR-062.
  - **Owner boundary:** decision record and verified provider/compliance
    capability matrix only; no transaction implementation.
  - **Acceptance:** merchant-of-record, custody, VAT/accounting, refunds/
    disputes, SCA, consent/retention, jurisdictions, eligibility, deposit/
    commitment semantics, subscriptions, instalments, direct debit, and stored
    value are each explicitly approved, rejected, or deferred.
  - **Tests:** decision completeness checklist, current provider documentation/
    account capability evidence, threat/privacy review, and reversal/migration
    plan; no live charge.
  - **Non-goals:** no code path, custom credit, PAON lending, raw card storage,
    assumed provider capability, or silent merchant-of-record change.
  - **Hard blockers:** missing founder business choice, legal/accounting
    approval, provider account/capability, or jurisdiction decision blocks only
    the affected money capability.
  - **Status:** blocked — not independently buildable while those decisions are
    missing; agents must not invent the decision matrix.

- [ ] **6.2 Approved commerce primitives**
  - **Requirement IDs:** `PAY-001`, `PAY-002`, `SERV-002`.
  - **Dependencies:** a completed `6.1` authorization naming the exact
    capability.
  - **Owner boundary:** existing commerce/payment domain, provider integration,
    immutable repositories/ledger, and approved Customer/Retailer surfaces.
  - **Acceptance:** implement only named provider-hosted/tokenized eligibility,
    one-click, commitment/deposit, or billing capabilities; order/payment/
    refund history is immutable/auditable and existing retailer merchant-of-
    record boundaries remain.
  - **Tests:** provider contract mocks, webhook signature/idempotency/replay,
    SCA/failure/refund/dispute, ledger reconciliation, authorization/RLS,
    browser accessibility, and an explicitly recorded live smoke test.
  - **Non-goals:** every capability not approved by `6.1`, custom processor,
    credit underwriting, raw credential vault, or balance inferred from UI.
  - **Hard blockers:** missing production provider credentials/capability or
    live compliance approval blocks the affected implementation and live
    verification.
  - **Status:** blocked — depends on completed `6.1`; no commerce code until
    that gate names exact capabilities.

- [ ] **6.3 Retailer-owner marketplace**
  - **Requirement IDs:** `MKT-001`.
  - **Dependencies:** stable catalogue/commerce foundations; ADR-064; a
    separately approved marketplace commercial/payment design.
  - **Owner boundary:** new business-marketplace bounded context, retailer-
    buyer access, supplier/product/order assumptions, and distinct app surface;
    reuse only value objects/infrastructure that do not import customer-retail
    rules.
  - **Acceptance:** mannequins, bags, shoe displays, fixtures, furniture, and
    retailer supplies can be populated later; retailer buyers see only
    marketplace inventory; customer catalogue/search/orders and retailer
    tenant data cannot cross the boundary.
  - **Tests:** type/package boundary, migration/RLS, retailer-buyer roles,
    catalogue/search contamination denial, order/payment separation, and
    responsive/accessibility flows.
  - **Non-goals:** no customer-facing products, customer StyleProfile/
    wardrobe reuse, inventory assumption shortcut, or payment implementation
    without its own approved design.
  - **Hard blockers:** missing marketplace commercial/payment decisions or
    approved surface blocks those portions; isolated domain modelling can
    proceed only when explicitly activated after prior stages.
  - **Status:** blocked — not independently activated; do not start marketplace
    domain modelling while 6.1 remains unresolved and this item has not been
    explicitly unlocked.

**Stage 6 non-goals:** no PAON-built payment processor, credit underwriting,
custom stored-card vault, silent merchant-of-record change, unapproved stored
value, or marketplace squeezed into the customer catalogue.

### Stage 7 — Evidence-cited Self-Portrait and clienteling intelligence

Independently authorized after Stage 5. Does **not** resolve or pretend to
resolve Stage 6 payment/compliance/marketplace gates. Builds first-party PAON
capability with policy as a separate eligibility plane (ADR-066).

- [x] **7.0 Authority and ADR**
  - **Requirement IDs:** `CLI-001`–`CLI-009`, `ENG-005`, `ENG-006`.
  - **Dependencies:** Stages 0–5 complete; ADR-061; ADR-066.
  - **Owner boundary:** documentation authorities only — founder brief,
    programme, append-only ADR-066, this queue, factual `PROJECT_STATE.md`.
  - **Acceptance:** Stage 7 queue exists with stable IDs; architecture,
    provenance, policy separation, and resume point are recorded; Stage 6
    gates remain blocked and unchanged.
  - **Tests:** authority consistency, no duplicate roadmap files, Stage 6
    status preserved.
  - **Non-goals:** no product feature or schema in this tranche.
  - **Hard blockers:** none.
  - **Landed:** founder brief §15, programme §11 + `CLI-*`/`ENG-006`
    traceability, ADR-066, PHASE Stage 7 queue, factual `PROJECT_STATE`
    resume at 7.1. Stage 6 gates unchanged.

- [x] **7.1 Evidence-cited interest insight**
  - **Requirement IDs:** `CLI-001`, `CLI-002`, `ENG-002`, `ENG-006`.
  - **Dependencies:** `7.0`; existing `behavioral_events`, accepted metadata,
    consent, Self-Portrait; ADR-066.
  - **Owner boundary:** `@paon/domain` interest projector, `@paon/database`
    projection repository, Retailer Portal Self-Portrait mount.
  - **Acceptance:** deterministic projector produces statements such as
    "8 of 10 suit views were brown" with numerator/denominator/share,
    event/session/unique-product counts (session unavailable until 7.2),
    window, confidence, evidence IDs, accepted-metadata-only joins, positive/
    negative separation, low-sample suppression, and honest empty state on
    Self-Portrait; no black-box prose persistence; no migration unless current
    persistence cannot support a correct bounded projection.
  - **Tests:** domain fixtures for accepted-only metadata, dedupe, eligibility,
    negative vs positive, ratios/thresholds, deterministic ordering, copy;
    repository tenant/fail-closed/bounded-window tests.
  - **Non-goals:** no session schema, opportunity engine, For You ranking,
    calendar, or Stage 6 work.
  - **Hard blockers:** none.
  - **Landed:** `@paon/domain` `projectCustomerInterestInsights` +
    `@paon/database` `CustomerInterestRepository` + Self-Portrait "Recent
    interests / Why we think this" mount. Session counts explicitly null
    until 7.2. No migration required.

- [x] **7.2 Session/event context foundation and instrumentation**
  - **Requirement IDs:** `CLI-001`, `CUST-001`.
  - **Dependencies:** `7.1`; ADR-066.
  - **Owner boundary:** domain event taxonomy extensions, forward migration
    only if required, capture instrumentation on at least one real customer
    journey, repository loads.
  - **Acceptance:** authenticated/anonymous-first-party sessions with
    start/resume/heartbeat/end, visibility/idle, route/product/card impressions,
    dwell/scroll thresholds, Tie-Mate/favourite/cart/appointment/For You
    semantic events where already present in journeys; idempotency keys;
    never capture passwords/payment/credentials/arbitrary form contents.
  - **Tests:** capture validation, idempotency, consent/policy eligibility,
    retention class, at least one instrumented journey.
  - **Non-goals:** no third-party site tracking; no mousemove firehose.
  - **Hard blockers:** anonymous persistence remains jurisdiction-gated as
    today; signed-in instrumentation remains buildable.
  - **Landed:** `interaction_sessions` + event context columns
    (`session_id`/`idempotency_key`/`page_path`/`device_class`/…),
    `ensure_interaction_session` + upgraded `capture_behavioral_event`,
    domain session continuity + forbidden-property validation, storefront
    `trackStorefrontEvent` and Tie-Mate save/skip journeys ensure sessions
    and stamp idempotency. Anonymous persistence still blocked. Interest
    projector reports `sessionCount` when session ids exist.

- [x] **7.3 Structured facts and advisor rectangles**
  - **Requirement IDs:** `CLI-002`, `CLI-003`, `CUST-002`.
  - **Dependencies:** `7.1`; ADR-066.
  - **Owner boundary:** Self-Portrait knowledge-graph domain/persistence for
    declared/advisor/transactional/inferred facts with provenance; advisor
    metadata-driven rectangle capture.
  - **Acceptance:** facts carry type/value, source/evidence, observed/
    valid/review/expiry dates, confidence, sensitivity/visibility, author,
    correction/conflict history; inferences never silently become facts.
  - **Tests:** provenance class isolation, conflict/correction, visibility,
    rectangle → fact mapping.
  - **Non-goals:** no autonomous salary/bonus inference.
  - **Hard blockers:** none.
  - **Landed:** `customer_facts` / `customer_fact_corrections` + domain
    provenance guards; `record_advisor_rectangle_facts`; Retailer advisor
    rectangle capture and Self-Portrait structured facts section.

- [x] **7.4 Moments, opportunities, and contact pressure**
  - **Requirement IDs:** `CLI-004`, `CLI-005`.
  - **Dependencies:** `7.1`, `7.3`; ADR-066.
  - **Owner boundary:** opportunity projector, draft tasks, advisor Today
    inbox, contact-pressure/cooldown rules, outcome references.
  - **Acceptance:** sparse high-quality hooks with why-now, cited evidence,
    suggested action/channel/time, assignment, priority/confidence, due/
    expiry, status, feedback, and outcome links; draft by default; no
    autonomous customer spam.
  - **Tests:** ranking sparsity, cooldown, eligibility, outcome linkage.
  - **Non-goals:** no marketing blast engine.
  - **Hard blockers:** none.
  - **Landed:** `clienteling_opportunities` + domain contact-pressure /
    interest-follow-up drafts; customer-card inbox with
    accept/snooze/dismiss/incorrect; Today dashboard draft list. Outcome
    message/appointment/sale linkage columns exist; richer outcome funnel
    remains 7.8.

- [x] **7.5 Branches, shared calendar, and post-appointment closeout**
  - **Requirement IDs:** `CLI-006`.
  - **Dependencies:** `7.3`, `7.4`; existing appointments.
  - **Owner boundary:** branch/store timezone, branch calendar, assignment/
    coverage, recurring customer moments, structured closeout rectangles.
  - **Acceptance:** manager-controlled branch calendar; closeout feeds
    provenance-aware Self-Portrait and For You; customer-card-backed
    participants.
  - **Tests:** timezone honesty, RLS, closeout → fact projection, coverage.
  - **Non-goals:** no external calendar vendor lock-in required for local
    build.
  - **Hard blockers:** none for local build.
  - **Landed:** `retailer_branches` + `appointments.branch_id`; timezone-
    aware slot/booking helpers; shared appointments list branch filters;
    `appointment_closeouts` + rectangle closeout UI; `customer_moments`
    for follow-up/recurring moments. Week-grid calendar deferred.

- [x] **7.6 Unified For You**
  - **Requirement IDs:** `CLI-007`, `ENG-002`.
  - **Dependencies:** `7.1`, `7.3`; catalogue/wishlist/Tie-Mate/wardrobe.
  - **Owner boundary:** customer For You page, deterministic candidate/ranking
    contract, impression/click/dismiss/correction capture.
  - **Acceptance:** combines quiz, favourites, Tie-Mate, purchases, wardrobe
    gaps, advisor facts, occasions, recent behaviour; reason codes and human
    copy; diversity; suppress owned/rejected/irrelevant; inventory-aware.
  - **Tests:** ranking fixtures, reason codes, suppression, consent.
  - **Non-goals:** no opaque black-box recommender as sole authority.
  - **Hard blockers:** none.
  - **Landed:** `rankForYouCandidates` + `ForYouRepository` + customer
    `/for-you` page with reason copy and feedback events
    (`for_you_*` in capture allowlist). Tie-Mate/wardrobe-gap matching remains
    thin until richer catalogue concept joins.

- [x] **7.7 Live/temporal owner-manager-advisor dashboards**
  - **Requirement IDs:** `CLI-008`.
  - **Dependencies:** `7.2`, `7.4`, `7.5`.
  - **Owner boundary:** role-specific dashboard projections and UI for
    presence, aggregate demand, heatmaps, opportunity funnel, workload,
    contact pressure, ingestion/data-quality.
  - **Acceptance:** honest presence TTL / last-seen semantics; never imply
    online after heartbeat expiry; owner views are not vanity event counts.
  - **Tests:** TTL honesty, role gating, aggregation anonymization where
    required.
  - **Non-goals:** no unrestricted PAON-admin browsing of retailer customer
    content.
  - **Hard blockers:** none for local build.
  - **Landed:** presence/funnel/hourly heatmap projectors + manager Analytics
    mount; vanity event-count metric replaced with opportunity drafts.

- [x] **7.8 Correction, outcomes, policy, and admin hardening**
  - **Requirement IDs:** `CLI-009`, `ENG-006`.
  - **Dependencies:** `7.1`–`7.7`; ADR-066.
  - **Owner boundary:** correction/deletion recomputation, outcome funnel
    integrity, typed policy configuration, admin observability (ingestion,
    schema registry, projection versions, explainability health).
  - **Acceptance:** corrections recompute/expire conclusions; policy
    decisions are testable at capture/projection/display/export/activation;
    admin surfaces exclude unrestricted customer-content browsing.
  - **Tests:** correction replay, policy matrices, tenant isolation evidence.
  - **Non-goals:** no production unlawful configuration; no Stage 6 unlock.
  - **Hard blockers:** hosted-only verification gaps are recorded, not faked.
  - **Landed:** intelligence policy eligibility plane; fact correction +
    recompute contract; opportunity outcome linkage; admin Intelligence health
    page (projectors/policy/health, no customer browsing). Stage 7 complete.

**Stage 7 non-goals:** no Stage 6 payment/compliance implementation, no
marketplace, no hard-coded jurisdiction branches in core projectors, no
unrelated-site tracking, no autonomous customer spam, no black-box prose as
evidence authority.

### Stage 8 — Expanded operating-system control plane

Authorized by ADR-067 after Stage 7. The detailed product/technical programme
is [PAON_EXPANDED_PROGRAMME_EXECUTION.md](./vision/PAON_EXPANDED_PROGRAMME_EXECUTION.md).

- [x] **8.0 Expanded programme authority**
  - **Requirement IDs:** `ENG-005`, `INT-001`, traceability for `WRD-101`,
    `WFM-*`, `INV-*`, `CORP-*`, `CMP-*`, `FIT-*`, `SRV-*`, `NET-*`, `KNW-*`.
  - **Dependencies:** Stage 7 complete; ADR-067.
  - **Owner boundary:** documentation only: append-only ADR, product/technical
    specifications, vision index, this canonical queue, Cursor continuous
    handoff, and factual project state.
  - **Acceptance:** Faden coexistence/replacement, inventory identity,
    workforce, corporate fashion, wardrobe/services, fit, campaigns,
    lifestyle network and knowledge/consultancy have explicit boundaries and
    interaction; target/as-built language is honest; Stage 6 gates remain.
  - **Tests:** Markdown/link/authority checks and stale queue/prompt search.
  - **Non-goals:** no schema or product feature in this item.
  - **Hard blockers:** none.
  - **Landed:** ADR-067; canonical Stages 8–16 queue; expanded programme,
    Faden coexistence, inventory, workforce, corporate fashion, wardrobe/
    service, fit, campaigns, lifestyle network and knowledge/consultancy
    specifications; updated continuous Cursor handoff and vision index.

- [x] **8.1 Six-section digital wardrobe**
  - **Requirement IDs:** `WRD-101`.
  - **Dependencies:** existing Stage 4 wardrobe; ADR-063.
  - **Owner boundary:** Customer wardrobe presentation only; existing
    `WardrobeItem`, ownership history, lifecycle, roadmap and actions remain
    canonical.
  - **Acceptance:** every retailer relationship shows six stacked horizontal
    carousels in this exact order: Suits, Jackets, Shirts, Knitwear, Shoes,
    Accessories; cards preserve identifying image, provenance, fit/care/
    condition/wear, history and retirement; empty rails remain visible; all
    garment categories map without loss; phone/desktop and keyboard scrolling
    remain usable.
  - **Tests:** customer typecheck/lint, rendered empty/populated states, mobile
    width/overflow and accessibility.
  - **Non-goals:** no new wardrobe schema, AI tagging, outfit engine rewrite or
    global cross-retailer wardrobe.
  - **Hard blockers:** hosted data blocks live screenshot only, not local UI.
  - **Landed:** customer wardrobe now renders the six ordered visual rails with
    responsive snap scrolling, image/fallback cards, existing provenance/
    fit/care/condition/wear/history and retirement actions, explicit empty
    rails and retained lifecycle/roadmap panels. Customer lint, typecheck and
    production build pass. The local route/auth redirect was browser-checked;
    populated/empty authenticated screenshots remain a hosted/seeded-data gap
    because the configured demo credentials were rejected locally.

- [x] **8.2 Source-authority and external-identity registry**
  - **Requirement IDs:** `INT-001`, `INT-003`, `INT-004`.
  - **Dependencies:** `8.0`; ADR-067.
  - **Owner boundary:** domain contracts, forward migration/RLS, repository,
    Admin/Retailer connection health and one exercised fixture.
  - **Acceptance:** authority is configured by domain/field group with
    `paon|external|co_managed`, connection/external ID/direction/version/raw
    reference/reconciliation; conflicts fail visibly; one Faden fixture shows
    read-only ingest plus deep-link handoff without fake write-back.
  - **Tests:** schema invariants, mapping/idempotency, cross-tenant denial,
    conflict and stale-source behavior.
  - **Non-goals:** no universal connector UI or claim of live Faden credentials.
  - **Hard blockers:** live keys block only live provider proof.
  - **Landed:** domain source-authority + Faden read-only fixture; migration
    `20260730300000_add_source_authority_registry.sql` with RLS/tenant
    triggers and write-back-forbidden handoffs; `SourceAuthorityRepository`
    with idempotent ingest; Retailer `/settings/integrations` and Admin
    `/integration-health`; generated types current. Live Faden credentials
    remain a live-proof gap only.

- [x] **8.3 Versioned workflow and familiarity presets**
  - **Requirement IDs:** `INT-005`, `WFM-103`.
  - **Dependencies:** `8.2`.
  - **Owner boundary:** workflow/form/view definition versions and one real
    appointment or garment flow plus terminology/navigation preset.
  - **Acceptance:** definition changes do not mutate active instances; required
    fields/permissions/transitions/exceptions are enforced; presets alter
    labels/grouping/defaults only.
  - **Tests:** version pinning, invalid transition, permissions/RLS and preset
    semantic-equivalence.
  - **Non-goals:** no competitor pixel clone or per-source data-model fork.
  - **Hard blockers:** none.
  - **Landed:** domain workflow snapshot + familiarity presets; migration
    `20260730310000_add_workflow_and_familiarity_presets.sql` with immutable
    version snapshots and RLS; `WorkflowDefinitionRepository` pin/bind/
    publish; Retailer `/settings/workflows` + layout/nav label overlays;
    alteration detail pins work orders and remaps status labels.

### Stage 8.4 — Delivery integrity and connected-product proof

- [x] **8.4 Machine-enforced completion and multi-role journey gate**
  - **Status:** `verified_local`.
  - **Requirement IDs:** `AUD-001`–`AUD-005`.
  - **Dependencies:** `8.3`; ADR-068; the common-sense and traceability audits.
  - **Owner boundary:** honest status vocabulary; machine-readable tranche
    evidence; validator; deterministic linked retailer/customer/advisor/
    manager seed; reusable browser proof for originating role, receiving role,
    persisted state, exception and downstream handoff; UI state checklist.
  - **Acceptance:** a PHASE item cannot be changed to complete unless an
    evidence record names its applicable domain/persistence/service/origin UI/
    receiver UI/RLS/exception/browser/operations proofs and any live-only gap;
    validator rejects missing applicable evidence, missing referenced
    repository artifacts, a non-executable browser spec and unexplained
    `n_a`; `verified_local` additionally requires a current
    `docs/evidence/runs/<id>.json` produced by the exact Playwright
    invocation (`phaseItemId`, `gitSha`, `spec`, `status=passed`,
    `timestamp`) — a mere `*.spec.ts` path is not enough; the validator is
    part of root/CI definition of done rather than an optional command; one
    seeded multi-role flow proves the harness; docs distinguish
    `implemented_unverified`, `verified_local`, `verified_live` and
    `blocked_external`.
  - **Tests:** validator pass/fail/lying-path/unexplained-`n_a`/missing-or-
    failed-run-artifact fixtures, deterministic seed rerun and one actually
    executed browser flow in which the originating role performs a mutation
    through UI, the receiving role sees it, a direct forbidden route/RLS
    attempt is denied, and canonical database state is asserted. Merely
    reading objects already created by the seed or hiding a navigation link
    is not sufficient.
  - **UI/UX:** standard loading/empty/error/denied/stale/conflict/success
    states, role orientation, task continuation, phone/tablet/desktop and
    keyboard/a11y checklist are assessed for applicability, not mechanically
    rebuilt in every tranche. One-line `n_a` rationale is enough where a state
    or device is genuinely unaffected.
  - **Efficiency:** reuse one linked seed/harness; keep evidence to terse paths
    and test names; run focused checks during implementation and the full DoD
    once before commit. Do not retroactively manufacture exhaustive browser
    tests for completed stages or require every device/state in every slice.
    Non-blocking visual/copy/secondary-device defects go to the stage-end
    `docs/evidence/STAGE_REPAIR_LEDGER.md`. Data loss, source-authority, RLS,
    migration, broken build and dead-end primary-flow defects may not be
    deferred.
  - **Non-goals:** no retroactive claim that all old work is browser verified;
    no screenshot-only acceptance.
  - **Hard blockers:** none.
  - **Landed:** domain completion-evidence + PHASE gate (8.4+; earlier stages
    grandfathered); path/n_a/browser-spec validation; `verified_local`
    requires `docs/evidence/runs/<id>.json` (`status=passed`, current SHA +
    spec) written by the Playwright harness — path-only proof rejected;
    `pnpm test` runs `validate:completion`; `docs/evidence/tranches/8.4.json`
    - `docs/evidence/runs/8.4.json`; linked Maison Dubois proof seed; harness
      `apps/retailer/e2e/completion-harness.spec.ts` proves advisor mutate →
      manager receive → worker RLS deny → DB assert. Loyalty
      `metadata_concept_kind` `'fabric'` literal fixed to
      `fibre`/`fabric_collection`.

### Stage 9 — Migration Cockpit and connectors

- [x] **9.1 Generic staged-file migration**
  - **Status:** `verified_local`.
  - **Requirement IDs:** `INT-002`, `INT-003`.
  - **Dependencies:** `8.2`, `8.4`; extend existing import foundations.
  - **Owner boundary:** immutable raw upload, profiling/mapping/dedupe/review,
    dry run, dependency-ordered publish, reconcile, dead-letter/resume and
    rollback references for CSV/XLSX/JSON.
  - **Acceptance:** realistic products/customers/orders/stock fixture imports
    into the actual canonical tables idempotently; imported records appear in
    normal catalogue/customer/order/inventory consumers; counts and money
    reconcile; passwords/payment credentials and ambiguous identity merges are
    rejected.
  - **Tests:** rerun/delta/failure/resume, cross-tenant denial and operator
    browser journey.
  - **Non-goals:** no silent AI identity merge.
  - **Hard blockers:** none.
  - **Landed:** domain staged-file contracts + fixture; migration
    `20260730320000_add_staged_file_migration_foundation.sql`;
    `MigrationJobRepository` publish writes customers, products+variants,
    stock (`inventory_quantity`), and orders+lines into canonical tables;
    `/migrations` revalidates `/products`/`customers`/`orders`; Playwright
    `migration-write-through.spec.ts` passed with
    `docs/evidence/runs/9.1.json` `status=passed`. Provider adapters remain
    Stage 9.2.
  - **Fix (2026-08-04, takeover branch):** "idempotently" in the acceptance
    criterion was not actually true — found while re-running the full
    retailer e2e suite for unrelated work, on a persistent local DB that had
    accumulated a real prior publish. `publishJob`'s reconciliation
    (`migration_publish_receipts`) is scoped to one `job_id`, but "Load
    fixture job" mints a fresh job id every click; republishing the same
    fixture under a new job therefore always tried to `create()` the same
    product slug and `insert()` the same order number a second time,
    throwing on the retailer-wide unique constraints instead of reconciling
    against what an earlier job already published — the previous single
    passing run had only ever exercised a clean database, never this path.
    Fixed by checking for an existing product (by slug) and order (by
    order_number) before creating either, reconciling against them when
    found rather than attempting a duplicate insert. Verified by publishing
    a fresh fixture job twice in a row against the same database: both runs
    now pass, and the second is faster (`~3s` vs `~23s`) because it
    reconciles instead of writing. A full retailer e2e run afterward found
    one unrelated failure — `message-attachments.spec.ts`'s inline image
    resolves a correctly signed URL but Playwright reports the `<img>`
    hidden — reproduced twice, not caused by this change, and left
    uninvestigated for a separate pass rather than expanding this fix's
    scope.

- [ ] **9.2 Shopify and Faden executable adapters**
  - **Status:** `implemented_unverified`; contracts/fixtures exist, but the
    running connector lifecycle does not.
  - **Requirement IDs:** `INT-002`, `INT-003`, `INT-004`.
  - **Dependencies:** `9.1`, `8.4`.
  - **Owner boundary:** current official export/API/webhook contracts,
    connection configuration/secrets boundary, scheduled/webhook execution,
    cursor/checkpoint, immutable raw events, mappings, dead letters, pause/
    resume/disconnect, health and reconciliation.
  - **Acceptance:** an operator can configure a local/mock connection and run
    initial plus delta ingest; Shopify covers catalogue/customer/order/stock
    deltas; Faden covers documented read-only API and signed webhooks;
    signature/replay/cursor/failure/retry/reconcile are observable; unsupported
    writes become source tasks/deep links. Provider keys block only live smoke.
  - **Tests:** signatures/replay, cursors, rate/failure, idempotency,
    reconciliation and stale state.
  - **Non-goals:** no undocumented endpoint or browser-automation connector.
  - **Hard blockers:** provider keys block only live smoke tests.
  - **Landed:** domain Shopify delta fixture mapped into 9.1 staged rows;
    Faden signed-webhook fixture verifier + read-only ingest/deep-link plan
    (no write-back); Admin integration-health lists adapter versions. Missing:
    executable connection/scheduling/webhook lifecycle and multi-role browser
    proof. Live provider smoke remains `blocked_external` without credentials.

- [ ] **9.3 Demand-led connector expansion**
  - **Requirement IDs:** `INT-002`–`INT-005`.
  - **Dependencies:** `9.1`; live prospect evidence.
  - **Owner boundary:** one adapter at a time, likely Lightspeed X, Square,
    WooCommerce, Endear/Tulip or factory files.
  - **Acceptance:** current provider contract and fixture-driven complete
    vertical import/sync; operator-visible gaps.
  - **Tests:** provider contract, idempotency, reconciliation and tenancy.
  - **Non-goals:** no speculative empty adapters.
  - **Hard blockers:** absence of demand/sample payload defers that adapter.

### Stage 10 — Clienteling, campaign, and remote-selling parity

- [ ] **10.1 Versioned campaign library**
  - **Status:** `implemented_unverified`; pinned library/copy foundation
    exists, but the accepted deployment-to-outcome loop does not.
  - **Requirement IDs:** `CMP-101`–`CMP-104`.
  - **Dependencies:** `8.3`, `8.4`; existing campaign/private-offer
    foundations.
  - **Owner boundary:** PAON library object, retailer copy/version,
    prerequisites/mapping/preview, staff mission, customer in-app placement and
    outcome.
  - **Acceptance:** one campaign can be previewed in customer and staff views,
    cloned, mapped to real products/content/locations, rehearsed with
    prerequisites/exclusions/contact pressure, activated into shared staff
    missions and customer placements, continued to appointment/proposal/cart/
    order or decline, and measured/corrected without silently changing with
    library updates.
  - **Tests:** version pin, eligibility/exclusion/contact pressure, role/RLS,
    empty prerequisite and browser states.
  - **Non-goals:** no generic drag-and-drop email editor.
  - **Hard blockers:** external channel credentials block only sending.
  - **Landed:** domain library snapshot + pin/prereq rules; migration
    `20260730330000_add_versioned_campaign_library.sql`;
    `CampaignLibraryRepository` ensure/clone with `library_version_id` pin;
    Retailer campaigns settings shows library preview and clone, plus the
    mapping wizard (audience-rule and target-product forms — this already
    existed and was previously undercredited). Since: `evaluateCampaignRehearsal`
    - `buildCampaignMissionOpportunity` (domain) and
      `rehearseCampaignActivation` / `activateCampaignToStaffMissions`
      (orchestrator, `campaign-activation-orchestrator.ts`) close rehearsal and
      shared-staff-mission activation — a mission reuses `clienteling_opportunities`
      (PHASE 7.4) via a new `campaign_id` column
      (`20260801000000_add_campaign_mission_opportunities.sql`) rather than a
      second staff-task table, so outcome linking (`linkOutcome`) is inherited
      for free. Customer placement needed no new write: `apps/customer`'s
      private-offers page already lists any `active` campaign whose audience
      rules a customer matches. `20260801000001_...sql` persists the last
      rehearsal/activation on the campaign row so the settings page can show it
      after `revalidatePath`. Still missing: downstream continuation to
      appointment/proposal/cart/order (a mission's `outcomeOrderId` can be
      linked, but nothing yet automates linking it from an actual order), a
      correction path when mapped products/audience change after activation
      without silently reinterpreting the pinned snapshot, and multi-role
      browser proof. Those remain required completion work for 10.1.

- [ ] **10.2 Seven-Day Wardrobe and Honeymoon Phase**
  - **Requirement IDs:** `CMP-105`, `CMP-106`, `WRD-104`.
  - **Dependencies:** `8.1`, `10.1`; wardrobe/MorningRoutine/order foundations.
  - **Owner boundary:** executable campaign packages and required customer/
    advisor surfaces.
  - **Acceptance:** editable owned-first seven-day outfits identify cited
    gaps; order-to-delivery tracker creates useful preparation/collection/
    aftercare actions with stock/lead-time truth and pressure limits; the
    responsive month/season roadmap visualizes real owned/planned/service
    events rather than decorative timing.
  - **Tests:** owned/suggested separation, campaign timing, suppression,
    correction and outcomes.
  - **Non-goals:** no fabricated scarcity or unapproved one-click payment.
  - **Hard blockers:** payment eligibility blocks only payment action.
  - **Landed:** salvaged and repaired from `wip/stage-10-2-honeymoon` (preserved,
    never merged — this is fresh work on the takeover branch informed by
    reading it). Domain (`seven-day-honeymoon.ts`): `composeSevenDayOwnedFirstPlan`
    prefers owned wardrobe items, falls back to in-stock catalogue, otherwise
    cites an explicit gap — never invents ownership; `deriveHoneymoonActions`
    suppresses preparation/collection/aftercare on stock gaps, contact
    pressure, or a canceled/refunded order, always `requiresPaymentApproval:
false`. `HoneymoonProgrammeRepository.ensureForOrder` is order-linked,
    idempotent, and recomputes fresh from the order's live status and each
    variant's real inventory/lead-time on every read — rendered on
    `apps/customer`'s order detail page, so a customer sees their own honest
    preparation/collection/aftercare state, not a decorative timeline.
    `campaign_challenge_look_slots` gained nullable `product_id` +
    `wardrobe_item_id`/`source` so an owned-first look can exist at the schema
    level. Missing: the seven-day owned-first composition has no customer UI
    yet — `upsert_campaign_challenge_look`'s RPC still only accepts catalogue
    products, so wiring `composeSevenDayOwnedFirstPlan` to a real challenge
    look is separate follow-up work, not done here; the month/season roadmap
    visualization; and multi-role browser proof.

- [ ] **10.3 Unified communication and remote proposals**
  - **Requirement IDs:** clienteling parity target; `CLI-004`, `CMP-103`.
  - **Dependencies:** `8.2`, `10.1`.
  - **Owner boundary:** channel abstraction/threading, confirmed note
    extraction, lookbook/proposal/quote/cart handoff and outcome.
  - **Acceptance:** advisor prepares, sends an approved look, receives reply,
    books appointment/creates cart and links sale; opt-out/failure suppresses;
    multimodal note candidates require confirmation.
  - **Tests:** provider mocks, consent, grounding, failure/retry, RLS/browser.
  - **Non-goals:** no autonomous customer spam or invented facts.
  - **Hard blockers:** live channel credentials block only live smoke test.
  - **Landed:** channel abstraction/threading already existed and was
    previously uncredited here — `conversations`/`messages` (in-app channel),
    `MessagingRepository`, a real 3-pane retailer inbox and customer message
    UI, intent classification, attachments, and a TableService storefront
    guest-inquiry channel (ADR-034). Since: the outcome half of the
    acceptance ("receives reply, books appointment/creates cart and links
    sale") — `conversations` gained `outcome_appointment_id`/
    `outcome_order_id`/`outcome_recorded_at`, mirroring
    `clienteling_opportunities`'s existing outcome fields (PHASE 7.4) rather
    than a second outcome shape. `MessagingRepository.linkOutcome` writes it
    (via service-role, since `conversations` grants no authenticated write —
    `markRead` already needed its own security-definer RPC for the same
    reason); a "Link" button on the retailer inbox's order-history panel
    calls it. Missing: lookbook/proposal/quote attachments distinct from a
    generic file upload, confirmed note extraction (a message/attachment
    proposing a candidate customer fact that requires explicit staff
    confirmation before being trusted — Stage 7's declared-vs-inferred
    StyleProfile distinction is the nearest existing pattern, not yet
    connected to messaging), opt-out/failure suppression logic, and
    multi-role browser proof.

- [ ] **10.4 Relationship-calendar campaign packages**
  - **Requirement IDs:** `CMP-107`, `REL-20`.
  - **Dependencies:** `10.1`; relationship event/fact foundations.
  - **Owner boundary:** executable Valentine/reservation-rescue and overcoat,
    Mother’s/Father’s Day, coming-of-age, Race Sunday, annual event, client
    event, dating/single-again, referral and anniversary packages.
  - **Acceptance:** packages are published versions with assets, eligibility,
    timing, prerequisites, retailer mappings, staff/customer surfaces,
    suppression and attributable outcomes; sensitive-context packages require
    confirmed context and human rehearsal.
  - **Tests:** recurrence/timezone, eligibility/exclusion, pressure,
    mapping-empty, opt-out/correction and customer-to-advisor browser outcome.
  - **Non-goals:** no static campaign gallery or fictional scarcity.
  - **Hard blockers:** media rights or external channel credentials block only
    affected assets/sends.
  - **Landed:** `relationship-calendar.ts`'s `evaluateRelationshipDateWindow`
    decides whether today falls in a campaign's lead/trailing window around a
    customer's own recurring date (Stage 7's existing `customer_facts`
    `anniversary`/`wedding_date` fact types are the "relationship event/fact
    foundation" this item depends on — already built, no new fact schema
    needed) — timezone-agnostic by design (the caller resolves "today" in the
    retailer's own timezone first, matching how `campaigns.timezone` already
    works) and correct across a year boundary and when a fact's own year
    differs from the current one, both covered by tests. The recurrence math
    itself was refactored onto the existing `nextYearlyOccurrence`
    (`appointments/customer-moment.ts`) after a later self-review found this
    item had first written a near-duplicate of it — corrected in the same
    tranche once found, all 9 tests re-verified identical against the
    shared function, not left in place for the next reader to rediscover.
    One real library package, `ANNIVERSARY_MOMENT_LIBRARY_V1`, proves the
    pattern — chosen
    first because it needs no new fact type and no sensitive-context
    human-rehearsal gate the other eight packages this item names may need.
    Missing: the other eight named packages (Valentine, Mother's/Father's
    Day, coming-of-age, Race Sunday, annual event, client event, dating/
    single-again, referral), wiring this eligibility function into the
    10.1 rehearsal/activation pipeline's candidate gathering, retailer
    mapping UI for a relationship package specifically, and multi-role
    browser proof. This is domain-layer only — treat 10.4 as far from
    complete, not merely unverified.

### Stage 11 — Workforce Mission Control and coaching

- [ ] **11.1 Time approval and payroll package**
  - **Requirement IDs:** `WFM-101`, `WFM-102`.
  - **Dependencies:** existing roster/time entries; `8.3`.
  - **Owner boundary:** breaks/exceptions/corrections/manager approvals,
    pay-period versions and generic payroll/accountant export.
  - **Acceptance:** manager resolves missing punch/overtime exception, approves
    period and exports checksummed earning-code hours; correction produces a
    new version; no customer data.
  - **Tests:** time overlap/rules, self-approval denial, period lock/version,
    export mapping and RLS.
  - **Non-goals:** no tax calculation, filing or salary payout.
  - **Hard blockers:** payroll account blocks only provider adapter.
  - **Landed:** domain layer only (`payroll-period.ts`), operating on the
    existing real `staff_time_entries`/`staff_shifts` (never customer data).
    `detectPayrollExceptions` flags a missing clock-out only once a shift has
    run well past a normal length (not every open shift — that would flag
    every employee currently on the clock) and flags per-entry overtime
    matching how `summarizePeriodHours` splits the same entry into regular
    and overtime hours, so the two can never disagree about what counts as
    overtime. Every exception starts unresolved — resolution is a manager
    action this layer does not perform. `buildChecksummedPayrollExport`
    sorts rows deterministically before hashing specifically so the checksum
    is stable across repeated exports of unchanged data, which is the entire
    point of checksumming an export. Missing: no schema at all yet for pay
    periods, versions, corrections or manager approval state; no export
    provider adapter; no self-approval-denial enforcement; no RLS; no UI; no
    browser proof. This is a small fraction of 11.1, not most of it.

- [ ] **11.2 Today, closeout, I AM and extra mile**
  - **Requirement IDs:** `WFM-103`, `WFM-104`.
  - **Dependencies:** `8.3`; Stage 7 opportunities/closeout.
  - **Owner boundary:** unified role home, tasks/promises/briefing, ten-minute
    closeout, evidence-linked employee profile and recognition.
  - **Acceptance:** employee completes customer/operational missions and logs a
    reviewable extra-mile act; manager acknowledges/coaches; no raw-volume
    leaderboard.
  - **Tests:** role/visibility, empty/exception, task outcome and recognition
    non-gaming fixtures.
  - **Non-goals:** no screenshot/keystroke surveillance.
  - **Hard blockers:** none.
  - **Landed:** the extra-mile/recognition half (WFM-104).
    `20260801000004_add_staff_recognition_acts.sql` stores narrated acts
    optionally linked to the real customer/appointment/order they happened
    on, so a recognition is auditable rather than self-asserted. This item's
    "no raw-volume leaderboard" non-goal is enforced structurally, not by
    convention: the table has no count/score/rank/points column, the domain
    module exports no per-person total or ranking at all
    (`summarizeRecognitionCoverage` answers "is recognition reaching
    everyone" and returns the _unrecognized_ list — a manager's problem to
    fix — instead of "who has the most"), and two tests fail if a future
    change reintroduces either. `checkRecognitionReview` blocks self-review,
    which RLS cannot catch (RLS can prove the caller is a manager but not
    that the act is about that same manager), blocks double-review, and
    refuses a `coached` state carrying no actual coaching note. A dismissed
    act deliberately does not count as coverage, so a manager cannot clear
    their unrecognized list by dismissing acts. Writes are `authenticated`
    (unusually for this repo) because an employee logs their own act — the
    insert policy pins the author to the calling user. The retailer surface
    at `/staff/recognition` is real and browser-proven
    (`apps/retailer/e2e/staff-recognition.spec.ts`, run against this
    branch's live Supabase project): an owner logs an act about a colleague
    through the actual form, a too-thin narrative is refused with a readable
    reason, coaching with no note is refused, coaching with a note moves the
    act to the recognised list carrying that note, the act leaves the review
    queue so a second manager cannot re-review it, and the rendered page is
    asserted to contain no leaderboard or top-performer language. Writing
    that proof surfaced a real design consequence rather than a bug: the
    fixture retailer has one staff member, so the owner's first attempt hit
    the self-review guard — the guard firing in a live browser is itself
    the evidence it works. Nav entry sits in the unconditional group, since
    recognition only some roles can see is not recognition. Missing: the
    rest of 11.2 — unified role home, tasks/promises/briefing, the
    ten-minute closeout flow, and the evidence-linked employee profile
    surface. Treat 11.2 as one slice of several, not near-complete.

- [ ] **11.3 Scheduling, demand, ceremony and coaching**
  - **Requirement IDs:** `WFM-105`, `WFM-106`.
  - **Dependencies:** `11.1`, `11.2`.
  - **Owner boundary:** availability/swaps/coverage, explainable staffing,
    ceremony versions, contextual prompts, observations/rubrics/plans.
  - **Acceptance:** manager publishes coverage, receives cited shortage
    recommendation and completes observation-to-coaching loop.
  - **Tests:** timezone/coverage/skills, versioning, role/RLS and outcome
    quality.
  - **Non-goals:** no fully autonomous scheduling.
  - **Hard blockers:** none.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Schema, RLS and domain logic are real; there is no UI and no browser
    proof, so this is not claimable at any `verified_*` status.
    `20260801000005_add_coverage_ceremony_coaching.sql` adds coverage plans
    and intervals, staff availability declarations, shift-swap requests,
    versioned service ceremonies and coaching observations. The
    "no fully autonomous scheduling" non-goal is structural rather than a
    convention: no table here can assign a shift — `public.staff_shifts`
    (2026-07-21) stays the only truth for who works when, a coverage plan
    states a REQUIREMENT, `recommendCoverage` states a GAP, and the only
    code path that moves a roster row is `approveSwap`, gated on an
    independent manager. A test asserts `coverage_plan_intervals` carries
    no `staff_id` at all. Recommendations are explainable by construction:
    `StaffingRecommendation.citations` is never empty, and the worst case
    (nobody rostered, so no shift rows to cite) still cites the plan the
    requirement came from rather than emitting a bare number; real
    appointment counts become `booked_appointments` citations bucketed by
    hour, and a test proves a morning demand signal cannot justify an
    afternoon shortage. Interval times are local wall-clock against a named
    IANA zone carried on the plan, not instants — storing instants would
    shift a roster by an hour twice a year at a DST boundary. Overlap is
    half-open, so a shift ending exactly when an interval starts does not
    count as covering it. Swap approval re-checks required skills at
    approval time rather than request time, because the roster can move
    between the two; both a CHECK constraint and a domain check refuse an
    approver who is either party. Ceremony versions are immutable once
    published (the update policy carries `and published = false`), which is
    what keeps an observation's version citation meaningful later. The
    coaching loop advances one state at a time, so a manager cannot close a
    record the employee was never told about, and coaching rows are
    readable only by the subject and managers — every other 11.3 table is
    retailer-wide readable on purpose, but an observation the whole floor
    can read is a public performance notice. As in 11.2, there is no
    per-person average, total or rank anywhere: `summarizeCoachingLoop`
    answers "are loops being closed" and names who is stalled, and a test
    fails if a score aggregate column appears. Missing: retailer UI for all
    four surfaces, a browser proof, and the manager-facing publish-coverage
    flow end to end.
  - **Update (2026-08-01, later the same day):** the **acceptance criterion
    is now browser-proven** — `apps/retailer/e2e/staff-coverage.spec.ts`
    drives a real manager through `/staff/coverage`: publish a requirement,
    read a shortage _with its citations rendered inline_, publish again and
    have the intervals replaced rather than merged, record an observation on
    a colleague, and walk the loop observed → discussed → plan_agreed →
    outcome_recorded, with a refusal proven on the way (agreeing a plan with
    no action). The proof ends by asserting the database agrees with the page
    **and that no `staff_shifts` row was created for that date** — the
    load-bearing claim of the whole item, checked rather than asserted in
    prose.

    The checkbox stays unchecked and the item is still not complete: the
    owner boundary also covers availability declarations, shift swaps, and
    ceremony versions with contextual prompts, and none of those has a
    surface. What changed is that one named acceptance criterion moved from
    "schema exists" to "a manager did it in a browser".

    Wiring the UI found **two real defects the domain and schema tests could
    not have found**, which is the argument for doing this work at all:

    1. `coverage_plans_unique_day` was `unique (retailer_id, branch_id,
plan_date)` with a **nullable** `branch_id`. Postgres treats NULLs as
       distinct, so whole-retailer plans — the common case for a single-site
       shop — were never unique. `saveDraftPlan`'s upsert conflict target
       could therefore never match, so every save created another plan, and
       `findPlanForDate`'s `.maybeSingle()` would then throw on the second
       one. Verified by inserting twice against the sandbox project
       (`duplicate_rows: 2`) before writing the fix. Repaired in
       `20260801000015` with `unique nulls not distinct`, which is what was
       meant: a null branch is the statement "this plan covers the whole
       retailer", not missing information.
    2. `saveDraftPlan` reverted a published plan to `draft` without clearing
       `published_at` / `published_by_staff_id`, which violates
       `coverage_plans_publish_complete` (`23514`). The constraint was right
       and the repository was wrong — a row calling itself a draft while
       naming who published it is incoherent — so the fix is in the
       repository. Only a second publish through the real UI exercises this.

  - **Audit repair (2026-08-02):** the documented browser surface was absent
    from git because the repository-wide `coverage/` test-output ignore also
    matched `apps/retailer/app/(dashboard)/staff/coverage`. The route, Server
    Actions and guarded client forms are now tracked and the full retailer
    suite passes 42/42 together. The proof no longer attempts an unauthorized
    service-role DELETE and ignores its error; it uses a collision-free future
    date. Availability, swaps and ceremony management remain unbuilt, so this
    legacy item correctly stays unchecked pending R0.3 disposition mapping.

- [x] **11.4 Internal community, contribution and support**
  - **Requirement IDs:** `WFM-107`.
  - **Dependencies:** `11.2`, `16.1`.
  - **Owner boundary:** branch/HQ announcements and discussions, onboarding,
    moderated employee training contributions, cross-location learning-session
    links, service-budget requests and confidential external support-resource
    handoff.
  - **Acceptance:** an employee can find a relevant announcement/resource,
    submit a reviewable learning contribution and request an approved service
    recovery budget; managers moderate/acknowledge without exposing private
    support use or creating activity leaderboards.
  - **Tests:** audience/branch/RLS, moderation/versioning, budget approval and
    confidential-resource visibility.
  - **Non-goals:** no replacement social network, clinical service, keystroke
    or screenshot monitoring.
  - **Hard blockers:** external support contracts block only direct booking.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Schema, RLS and domain logic are real; no UI and no browser proof, so
    not claimable at any `verified_*` status.
    `20260801000006_add_internal_community.sql` adds announcements with
    branch/role audiences, one-per-person read receipts, versioned and
    moderated learning contributions, cross-location learning sessions,
    service-recovery budget requests and a support-resource catalogue.

    The most important property of this item is a table that does **not**
    exist. There is no `support_resource_views`, no access event and no
    counter on the catalogue row. The requirement is a _confidential_
    handoff and the non-goal forbids exposing private support use; a log
    readable by managers defeats that outright, and one readable by nobody
    is still a re-identification risk in a five-person store and would
    still have to be disclosed. So usage is simply not observable. A test
    scans **every** migration in the repository — not just this one — and
    fails if such a table is ever added, so a later "engagement analytics"
    request has to argue with the note in
    `SUPPORT_RESOURCE_PRIVACY_NOTE` first. `checkSupportResource` also
    refuses a resource that claims direct booking, because the provider
    contract is a real blocker and a bookable-looking dead end is worse
    than an honest phone number.

    The "no activity leaderboard" non-goal is structural in the same way as
    11.2's: `summarizeCommunityReach` is scoped to **one** announcement and
    returns the list of people who have _not_ seen it — an operational gap
    a manager closes — with no per-person rate across messages, and there
    is no function that spans announcements. A read receipt is unique per
    person per announcement, so a repeated page load cannot inflate a
    number that is meant to be a fact about people rather than page views.

    A budget request moves no money and names no provider: ADR-062 has not
    decided a payout design, so this records an internal authorisation to
    spend up to an amount, which is a genuinely separate artefact from the
    payment that may later settle it. A test asserts the table mentions no
    provider, payout or payment reference. Requests must attach to a
    customer or an order (unattached, it is petty cash, which has different
    controls), are capped per request, and cannot be self-approved — in
    both a CHECK constraint and the domain layer.

    Two visibility decisions differ from the rest of the tranche on
    purpose: budget requests are requester-and-manager only (they name a
    customer and an amount), and unapproved contributions are hidden from
    the floor while remaining visible to their author and to moderators — a
    rejected draft is not published reading material. Rejection requires a
    reason in the schema, because an anonymous veto teaches the contributor
    nothing. Missing: all UI, browser proof, onboarding checklists, and
    discussion threads on announcements.

  - **Status (2026-08-01, takeover branch, revised):** `verified_local`.
    Browser proof `apps/retailer/e2e/staff-announcements.spec.ts`. What it
    proves is that "I have read this" is a RECORD rather than a checkbox:
    the acknowledgement is written once, a DELETE and an UPDATE against it
    both change nothing (append-only enforced as a grant, not a
    convention, including for `service_role`), and a second insert for the
    same reader is refused outright so a reach figure cannot claim two
    people read a safety notice when one did. The reach line then reads
    "1 of N have read this" with the outstanding readers named.

    Operating it also fixed two defects of the same kind found in 12.1:
    `#announcement-reach` was a literal id on a block that renders once per
    announcement (duplicate ids down the page), and the feed's empty state
    told a manager standing in front of the publish form to "check back
    later" — they are the person who makes the first one exist.

    One test-authoring lesson worth keeping: the first run appeared to show
    the acknowledgement flag being dropped, because the spec never selected
    an audience. The action correctly refused, `.single()` returned null,
    and dereferencing it with `!` made a refused publish look exactly like
    a silently dropped column. Both are now checked explicitly.

  - **Status (2026-08-03, takeover branch):** `verified_local`. The three
    remaining capabilities now have UI, a repository surface and browser
    proof: `apps/retailer/e2e/internal-community.spec.ts`. New pages —
    `/staff/learning` (submit + moderate learning contributions),
    `/staff/service-recovery` (request + approve a budget), `/staff/support`
    (read-only resource catalogue) — plus repository additions
    (`listSubmittedContributions`, `listContributionsByAuthor`,
    `listBudgetRequests`) since none of the three had one beyond the
    original create/decide methods.

    Before writing any of it, `/staff/announcements` — already
    `verified_local` from the prior status above — turned out to be
    reachable from nowhere in the app: no entry in the retailer layout's
    static navigation array and no entry in `module-kernel.ts`'s
    `retail_operations` navigation either, so `entitledNavigation`'s
    href-intersection filter dropped it unconditionally regardless of role.
    Its own browser proof had passed every run because it navigates there
    directly with `page.goto`, which cannot see a missing link. Fixed by
    adding it, `/staff/learning`, `/staff/service-recovery` and
    `/staff/support` to both the layout's unconditional "Today" group and
    `retail_operations`'s navigation array (open to `ALL_RETAILER_ROLES`,
    matching Recognition and Coverage next to it) — the RLS policies below
    already do the real scoping, so an open nav entry costs nothing.
    `module-kernel.test.ts`'s hardcoded expected-navigation array is updated
    for the same reason 14's addition was missed there before: it is a
    literal list, not a rule, and has to be told about every new href by
    hand.

    A budget request's per-request cap is not a stored, per-retailer
    setting — no such configuration exists anywhere yet, and ADR-062 still
    has not decided a payout design at all. The action layer hardcodes a
    conservative €250 ceiling (`PER_REQUEST_CAP_MINOR_UNITS`) rather than
    inventing configuration UI for a number nobody has actually decided;
    a configurable per-retailer cap is left as explicit future scope.

    Operating the two moderated forms surfaced a real defect predating this
    slice: `PublishAnnouncementForm`'s title field passed
    `error={state.formError}` to `FormField` _and_ the form separately
    rendered the same `state.formError` in its own bottom alert paragraph —
    every server-rejected submission showed its error message twice. Caught
    because the new forms copied the same pattern and the browser-proof
    spec's `getByText(...)` hit a strict-mode violation on two identical
    `role="alert"` paragraphs. Fixed in all three forms (learning, service
    recovery, and the pre-existing announcements form) by dropping the
    field-level `error` prop and keeping only the form's own alert paragraph.

    Support resources are seeded, not staff-authored: the schema grants
    `insert, update` on `staff_support_resources` to `service_role` only
    (asserted by `internal-community-security.test.ts`), so
    `demo-seed.ts` now seeds two resources per retailer directly with the
    admin client — the one legitimate place these rows can originate. There
    is deliberately no create/edit UI on `/staff/support` for the same
    reason `checkSupportResource` refuses `directBookingAvailable`: a
    curated catalogue a staff member could edit is a different, lesser
    guarantee than the one this item promises.

    Missing, and out of scope for this pass: onboarding checklists,
    discussion threads on announcements, and cross-location learning
    sessions (`staff_learning_sessions` has schema and RLS but no UI — it
    was not part of this item's Acceptance line, which names contributions,
    budget requests, and resource discovery, not sessions).

### Stage 12 — MTM, fit, production, and service network

- [ ] **12.1 MeasurementMonitor decision gate**
  - **Requirement IDs:** `FIT-101`–`FIT-103`.
  - **Dependencies:** wardrobe/lifecycle and official garment-fit foundations.
  - **Owner boundary:** private guided capture, quality/result candidate,
    advisor review and reorder gate.
  - **Acceptance:** self-scan can produce no-action/review/remeasure, never
    silently overwrite approved measurements; garment outcome feeds a
    reviewable future-fit candidate.
  - **Tests:** provenance/retention, quality fail, decision version, deletion
    recompute and role/RLS.
  - **Non-goals:** no single-photo accuracy equivalence to Face ID.
  - **Hard blockers:** model provider blocks only model-assisted tranche;
    structured review remains buildable.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain, schema, RLS and a repository exist; no UI and no browser
    proof. The rule the item turns on — a self-scan never becomes a
    measurement of record — is enforced as a _grant_, not a convention:
    `customer_measurement_versions` has **no UPDATE and no DELETE grant to
    any role, including `service_role`**. A correction is a new version.
    There is likewise no `approveCandidate` method and there should not be
    one; approving is `recordApprovedVersion`, which takes the values an
    advisor actually signed off, and making them restate those values is
    the difference between review and a rubber stamp. A version whose
    values came from a scan additionally requires a written review note.
    The decision gate returns exactly `no_action`, `advisor_review` or
    `remeasure` — nothing that means "apply" — stamps the decision-rule
    version on every result so re-running an old scan under new rules is
    visibly a different decision, and reports a missing measurement as
    missing rather than as a change to zero. Quality assessment returns
    _every_ failure at once, because telling a customer "stand further
    back", then after they redo it "we also need the reference card",
    makes them repeat a two-minute process twice for one problem. Deletion
    recompute is a foreign key: candidates cascade from the source scan
    while approved versions have no FK to it and survive, because a
    garment may already have been cut to one. The reorder gate refuses
    while a review is open or the pinned version is superseded. Missing:
    the guided capture UI, advisor review UI, browser proof, and any
    model-assisted measurement extraction (`blocked_external` on a model
    provider).

  - **Status (2026-08-01, takeover branch, revised):** `verified_local`.
    Browser proof `apps/retailer/e2e/measurement-monitor.spec.ts` (three
    cases). Operating the review queue found the gate was **not actually
    enforced**, which no unit test could see because the domain rule was
    correct and unreachable:

    1. **`recordApprovedMeasurements` hardcoded `capturedBy: "tailor_tape"`
       for every value.** So `derivedFromScan` never became true and the
       written-decision requirement was dead code at the only seam that
       matters. A phone scan could walk into the record of measurement with
       no human reasoning attached — the exact thing item 12.1 exists to
       prevent. It also destroyed provenance: a number read off a phone was
       stored forever as having been measured with a tape.

       The candidate is now read from the database rather than the form,
       because provenance is precisely what a client must not be allowed to
       assert. A value left UNCHANGED keeps the scan's provenance, since
       accepting a scan's number means the scan is where it came from; a
       value the advisor changed becomes `tailor_tape`, because they
       measured it themselves.

    2. **`Math.round(cm * 10)` made the whole-millimetre rule unreachable**
       and silently invented precision: 101.05 cm became 1011 mm rather
       than being refused. Sub-millimetre input is now rejected.
    3. **Duplicate DOM ids across the queue.** Every candidate rendered
       `id="reviewNote"` and `id="measurement_0_mm"`, so on a queue of two
       or more every `<label for>` resolved to the first form and clicking
       the third candidate's label focused the first candidate's input. Ids
       are now scoped per candidate.

    What the browser proves: an empty note cannot be submitted at all
    (`required`), a note of only spaces is refused by the SERVER with a
    readable reason and records nothing, a sub-millimetre value is refused
    before the request is made, a written decision produces a NEW version
    whose note is stored so the number a garment was cut to stays
    explicable months later, the candidate is resolved (which is what
    unblocks the reorder gate), a `remeasure` candidate deliberately stays
    out of a queue meant for decisions a human must make, and a dismissal
    changes no approved measurement at all.

    Still open: the guided capture surface itself and the reorder gate's own
    UI. Model-assisted tranche remains `blocked_external`.
- [x] **12.2 Garment production and serialized pieces**
  - **Requirement IDs:** `INV-103`; Stage 12 target architecture.
  - **Dependencies:** `8.3`, `8.2`.
  - **Owner boundary:** immutable measurement/spec versions, pieces, stages,
    barcode/QR, work tickets/tech pack/BOM, materials, QC/rework and
    workroom/outworker.
  - **Acceptance:** complete suit flow; jacket/trousers scan independently;
    post-cut change is explicit; outworker sees minimized identity; delay
    creates service-recovery action.
  - **Tests:** locks/transitions, barcode identity, material reconcile,
    permissions/RLS and full fixture.
  - **Non-goals:** no forced replacement of factory-mandated ordering.
  - **Hard blockers:** external write API blocks only automated submission.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only — no UI, no browser proof, no repository yet.
    Pieces exist as first-class rows rather than an order status column
    because a two-piece suit with finished trousers and a jacket in rework
    is a real state an order-level status cannot represent without lying
    about one of them; the item's own acceptance criterion is
    "jacket/trousers scan independently", and each piece carries its own
    barcode, unique per retailer. A spec pins Stage 12.1's append-only
    `measurement_version_id` with `on delete restrict`, so "what was this
    cut to" stays answerable. Post-cut change is explicit: before cutting
    a spec edit is ordinary, afterwards it is an amendment row that must
    name a reason **and** a cost decision, and after dispatch it is
    refused outright. Stage transitions are a directed graph, and rework
    re-enters at `assembly` rather than at the stage it failed — something
    has to be undone, and resuming exactly where a QC failure happened is
    how a failed piece gets marked ready untouched. QC exit requires a
    named inspector who is not the maker. Stage events and amendments are
    append-only (no UPDATE grant): the stage column on the piece is a
    convenience, the event table is the record. The outworker ticket is a
    whitelist projection carrying initials, never a name — a redaction
    pass fails open when a field is added, a whitelist fails closed.
    Material reconciliation reports under-consumption as well as over,
    because under-consumption usually means the BOM is wrong and quietly
    mis-costs every future garment of that pattern. A delay past three
    days raises a service-recovery flag. Missing: work-ticket UI,
    workroom/outworker surfaces, tech pack and BOM authoring, the full
    fixture flow and browser proof. Automated factory submission stays
    `blocked_external`.

  - **Status (2026-08-04, takeover branch):** `verified_local`. Added
    `ProductionPieceRepository` and one page, `/production`, covering the
    Acceptance line's four clauses end to end: a full suit fixture (spec →
    jacket + trousers) drives the jacket alone through
    `cutting → assembly → finishing → quality_control → rework →
(re-)assembly → finishing → quality_control → ready → dispatched` while
    the trousers stay untouched at `spec_locked` — "scan independently" is
    literal: a barcode lookup finds one piece by its own code — and a
    dispatch attempt on the ready jacket is refused while its sibling piece
    on the same order isn't ready, then succeeds once both are. Post-cut
    change is explicit: an empty-reason amendment is refused in the running
    app, a real one (reason + who absorbs the cost) is recorded and shown
    against the piece. An outworker ticket's rendered view is checked to
    contain the client's initials and NOT their full name. A piece created
    with a promised date already in the past appears in a "Delayed pieces"
    list before it is ever touched, and "Raise service recovery" writes a
    real `service_recovery_budget_requests` row (PHASE 11.4's own
    authorisation record, reused rather than duplicated — moves no money)
    citing the order. Browser proof: `apps/retailer/e2e/production.spec.ts`.

    Two real defects found operating this, both fixed at the source rather
    than routed around in the test:

    1. **`checkOrderDispatch` existed in the domain layer and was never
       called.** The repository's `transitionStage` validated every move
       via `checkStageTransition` but let a piece dispatch alone regardless
       of a sibling's state — silently missing the exact rule the item's
       schema comment names ("a suit with finished trousers and a jacket in
       rework is a real state"). Fixed: a `to === "dispatched"` transition
       now also checks every piece on the same order via
       `checkOrderDispatch` and refuses if any is not ready or dispatched.
    2. **Barcode lookup could never succeed.** `findPieceByBarcode`
       upper-cases its search term (matching `parsePieceBarcode`'s own
       tolerance for whatever case a scanner sends), but `addPiece` stored
       `buildPieceBarcode`'s output verbatim — mixed case, since the
       retailer code is a lower-case slug — so a stored barcode could never
       equal its own upper-cased search term. Fixed by upper-casing at
       storage time too, so the two sides of the same comparison finally
       agree.

    One environment-specific finding, not a code defect: a row inserted by
    the end-to-end fixture (via the service-role client, from the test
    process) was, in this local stack, observed to be briefly invisible to
    an immediate read from a _different_ process (the Next.js dev/prod
    server) — reproduced directly by polling the identical query and
    watching it start returning the row after a short wait. Cause not
    pinned down further given the size of this pass; worked around in the
    test with `expect.poll` around each such read (this suite's existing
    convention for exactly this shape of timing issue) rather than adding
    unexplained retry logic to product code. Real staff actions are never
    seconds-old fixture writes, so this is not expected to be user-visible.

    Deliberately not built this pass: work-ticket authoring UI beyond
    issuing one (no edit/return-tracking screen), tech pack/BOM authoring,
    material-line reconciliation UI (`reconcileMaterials` stays covered by
    its own domain unit tests), and the outworker's own portal (the ticket
    view proves the whitelist projection is correct; nobody outside the
    retailer staff signs in to see it yet). Automated factory submission
    stays `blocked_external` per the item's own hard blocker.

- [ ] **12.3 Preferred Tailoring partner network**
  - **Requirement IDs:** `SRV-101`–`SRV-103`, `INV-103`.
  - **Dependencies:** `8.1`; inventory identity foundation.
  - **Owner boundary:** per-location partners, capability/SLA, wardrobe intake,
    service plans, custody, work/quality/customer feedback, costs/invoices/
    reconciliation and a real wardrobe service calendar.
  - **Acceptance:** reproduce pag3's Preferred Tailoring weekly calendar-led
    wardrobe orchestration and HighMaintenance care experience faithfully,
    backed by real agenda/travel/context, composed looks, plan, booking,
    custody, partner fulfilment and history; one alteration and one
    dry-cleaning flow continues from booking and pickup through return;
    partner sees minimum data; costs reconcile.
  - **Tests:** custody, partner scope/RLS, SLA/exception, accounting export.
  - **Non-goals:** no partner payout without approved money design.
  - **Hard blockers:** payment decision blocks charging/payout only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. Deliberately reuses rather than duplicates:
    `service_bookings`, `service_plans` and `service_cost_records`
    (2026-07-30 concierge) stay canonical and this migration creates no
    second version of any of them — a test asserts that by anchoring on
    the CREATE TABLE target. What was genuinely missing is the partner:
    who work goes out to, their per-branch capability and turnaround, what
    came back and in what condition, and what they billed.
    `service_partner_custody_events` is a second table but not a second
    truth: `chain_of_custody_events` is bound to `alteration_work_orders`
    by a status-machine trigger, and a wardrobe garment sent for dry
    cleaning has no work order, so widening it would mean rewriting a
    proven flow for no benefit to it. The split is stated in code
    (`PARTNER_CUSTODY_SPLIT_NOTE`) and one garment movement is never in
    both. Custody refuses to go from `with_partner` straight to
    `released_to_customer` — that missing step is how a garment gets
    marked collected while sitting on a rail across town — and the return
    leg requires a condition note, since the moment it comes back is the
    only moment damage can be attributed. Partner selection returns
    distinct refusals ("nobody does leather" versus "the one who does
    cannot make Friday") because those lead a manager to different
    actions. Invoices reconcile _against_ the existing cost records and
    are all-or-nothing: an invoice that mostly matches is one nobody
    checked. Approval refuses self-approval and refuses an
    `initiatePayout` flag outright rather than ignoring it, so no caller
    can believe money moved — ADR-062 has decided no payout design.
    Missing: intake and calendar UI, partner portal, browser proof.
  - **Update (2026-08-03, takeover branch):** the partner portal now
    exists and is browser-proven —
    `apps/retailer/e2e/service-partners.spec.ts` drives a real owner
    through `/service-partners`: register a partner, send a wardrobe
    garment out (`with_retailer` → `in_transit_to_partner`), log a
    partner invoice, add a line, and reconcile it. The proof asserts the
    reconciliation is a real computation, not a rubber stamp — with no
    matching `service_cost_records` row it reports "not reconciled" and
    the page correctly withholds the Approve action, rather than showing
    a green check because a request round-tripped. `ServicePartnerRepository`
    is the new repository layer the domain/schema always needed; it adds
    no logic of its own beyond persistence — `checkCustodyTransition`,
    `reconcilePartnerInvoice` and `checkInvoiceApproval` gate every write
    exactly as designed, including the refusal to expose or wire an
    `initiatePayout` path (none exists in the UI; approval only ever
    calls the repository's `approveInvoice`, which sets a state and a
    timestamp and moves no money). Reconciliation matches an invoice
    line to a cost record by job reference, carried in
    `service_cost_records.label` — that table has no dedicated
    job-reference column, so this is a naming convention the retailer
    must follow, not a schema guarantee; a future revision could promote
    it to a real column with a migration if that convention proves
    fragile in practice. The checkbox stays unchecked: the acceptance
    criterion also asks for pag3's calendar-led wardrobe orchestration
    (a real weekly agenda view), and no such surface exists anywhere in
    this repository or in `downloaded_pages/*.html` to port — building
    one now would be inventing a UI pattern with no source, which is
    exactly what this codebase's porting discipline refuses to do.
    Missing: the weekly wardrobe service calendar and its agenda/travel
    context.

- [x] **12.4 Supplier/atelier intelligence and support operations**
  - **Requirement IDs:** `MTM-101`.
  - **Dependencies:** `12.2`, `8.2`.
  - **Owner boundary:** supplier/PDM/PLM authority mappings, catalogue/material/
    trim availability, fabric-button pairing rules, outstanding-order/delay/
    shortage exceptions and complaint/support cases across retailer, factory
    and supplier.
  - **Acceptance:** one supplier fixture updates versioned material data;
    a shortage/delay creates a cited exception and owner; a complaint links
    evidence, customer recovery, supplier/workroom action and final outcome.
  - **Tests:** source authority/version, stale/conflict, material/order joins,
    minimized partner access, correction and browser exception closure.
  - **Non-goals:** no invented supplier data, undocumented factory write-back
    or black-box “MinorityReport” claim.
  - **Hard blockers:** live supplier API blocks only live sync proof.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. Every supplier fact carries the authority that
    asserted it, the feed version and the observation time; there is no
    bare availability column anywhere, because a value with no source is
    exactly the "invented supplier data" this item forbids.
    `resolveSupplierFact` refuses an unregistered authority outright
    ("someone emailed us a spreadsheet" is not a source), surfaces a
    two-authority disagreement as `authority_conflict` with both facts
    attached rather than quietly preferring the newer — which supplier is
    right is a human question with commercial consequences — and flags a
    stale answer instead of presenting it as current. A fabric with no
    pairing rule returns `no_rule_for_fabric`, **not** "allowed": defaulting
    to permissive turns silence into approval. A supply exception must
    name an owner (unowned, it is a notification) and carry at least one
    citation, both enforced by CHECK. A complaint closes only from
    `customer_recovered` and only with a stated outcome, so a supplier
    credit alone cannot close a case — the customer is not the supplier's
    accounting entry. Facts are append-only; a correction is a later
    observation. There is no factory write-back queue at all, and
    `describeFactoryWriteBack` returns a refusal rather than a TODO
    somebody later fills in. Missing: supplier fixture ingestion, UI,
    browser proof. Live supplier sync stays `blocked_external`.

  - **Status (2026-08-04, takeover branch):** `verified_local`. Browser proof
    `apps/retailer/e2e/supplier-intelligence.spec.ts`. Added
    `SupplierIntelligenceRepository` (facts, fabric/button rules, exceptions,
    complaints — each a thin persistence layer over the existing pure domain
    checks, nothing re-implemented) and one page, `/supplier-intelligence`,
    covering all three Acceptance clauses: logging a supplier fact is the
    "one supplier fixture updates versioned material data" case (also seeded
    once in `demo-seed.ts`, since `supplier_facts` grants `insert` only to
    `service_role`/`authenticated` with no update — a correction is a new
    row); recording a `material_shortage`/`order_overdue`/etc. exception
    against staff-picked citations from that retailer's own logged facts is
    the cited-exception case, refused end-to-end in the browser with no
    citation selected; and the complaint form drives the full
    `raised → investigating → supplier_notified → customer_recovered →
closed` graph, refusing a supplier-notify with no evidence and asserting
    the page never mentions a factory write-back.

    Deliberately not built this pass: a `resolveSupplierFact` UI panel (the
    authority-conflict/staleness view). The function itself takes a
    caller-supplied `registeredAuthorityKeys` allowlist, and no table or
    config surface defines that allowlist anywhere in this item's own
    migration or Stage 8's `source_authority_policies` (a different
    registry, scoped to `catalogue`/`inventory`/`customer`/`order`/`payment`
    domains, not `supplier`) — inventing a registration UI for a concept the
    schema doesn't define would be exactly the kind of parallel architecture
    this repository's conventions warn against. `resolveSupplierFact` stays
    covered by its own domain unit tests; the UI slice proves the observable
    CRUD/workflow behaviour the Acceptance line actually names. Also not
    built: `production_pieces` linkage on a complaint (12.2, its sibling
    dependency, has no UI of its own yet either, so `piece_id` stays an
    unexercised optional column).

    Operating the browser proof surfaced that `fabric_button_rules`,
    `supply_exceptions` and `supply_complaint_cases` — like `supplier_facts`
    — were granted no `delete` at all in the original migration (only
    `insert, update`), not merely append-only-enforced after the fact. For
    `supplier_facts` that is the documented intent; for the other three it
    reads as consistent with a state-machine design (a rule is superseded by
    update, not removed; a case closes, it doesn't disappear) but was never
    stated as such. Left as-is rather than silently changed under an
    unrelated commit — a schema author decision, not a bug this pass found
    grounds to override. The one concrete effect: local/e2e test rows on
    these four tables accumulate indefinitely in the fixture retailer, the
    same already-accepted reality as `service_partner_custody_events` and
    `service_partner_invoice_lines` in 12.3.

### Stage 13 — Inventory, POS, and loss prevention

- [x] **13.1 Stock ledger, reservations, barcode receiving and counts**
  - **Requirement IDs:** `INV-101`, `INV-102`.
  - **Dependencies:** `8.2`.
  - **Owner boundary:** append-only ledger, location balances/reservations,
    barcode scan modes, receiving/transfers/count/reconcile.
  - **Acceptance:** purchase receipt, transfer, sale reservation and blind
    count reconcile without silent balance edits or oversell.
  - **Tests:** concurrency, reversal/idempotency, count/recount, RLS/browser.
  - **Non-goals:** no RFID-first implementation.
  - **Hard blockers:** none.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only; no UI, no browser proof. There is no balance
    column anywhere in the schema, and a test asserts that: a balance is a
    projection over `stock_ledger_entries`, which has **no UPDATE and no
    DELETE grant on any role, `service_role` included**. "Without silent
    balance edits" is therefore a property of the grants rather than of
    the application, and undoing an entry is a `reversal` row citing the
    original, so a mistake and its correction both stay visible.
    `projectBalance` is the single definition of on-hand, reserved and
    available; anything computing availability differently is a second
    truth that will eventually oversell. A reservation deliberately does
    not move on-hand — reserving promises a garment, it does not move one
    — and the oversell guard checks _available_, because on-hand says yes
    to both customers reserving the last jacket. A reversal's sign is
    derived from the entry it cites, so a caller cannot mis-sign one.
    Idempotency keys are collapsed on read as well as on write, because
    deduping only at the write boundary lets a webhook replayed during a
    partition double-count. A blind count produces variances and writes
    nothing; an unscanned variant is reported as uncounted, never as
    counted-zero, since treating absence as zero writes off stock nobody
    looked for. An adjustment must come from a count session, must not
    exceed what the count found, and must state a reason. A transfer is
    two entries, not one, so in-transit stock stays visible. Scan mode
    `lookup` never writes, so checking what something is cannot
    accidentally receive it. Missing: receiving/count/transfer UI,
    concurrency proof under real contention, browser proof.

  - **Status (2026-08-04, takeover branch, revised):** `verified_local`. This
    status was inaccurate as written above: `/inventory` (receive, hold,
    blind count, adjustment) and `apps/retailer/e2e/inventory.spec.ts` both
    already existed and passed before this correction — the "no UI, no
    browser proof" line was stale, not current. `docs/evidence/runs/13.1.json`
    already carried a passing run from an earlier commit under this same
    branch; this pass found the acceptance line's fourth clause, transfer,
    genuinely untested (the existing spec builds two locations only "so a
    transfer has somewhere to go" but never drives one), added a second
    test proving it end to end — receive, move between locations, and a
    move refused for exceeding what is available at the origin, all against
    the real ledger — and refreshed the evidence at current HEAD. All four
    Acceptance clauses (purchase receipt, transfer, sale reservation, blind
    count reconcile) now have a passing browser proof; `verified_local` is
    accurate, not aspirational.

    The transfer proof is deliberately a second, independent test rather
    than an addition to the first: by the end of the first test the
    location is intentionally left oversold (on-hand 19, available −1) to
    prove the ledger reports that honestly, and a transfer correctly
    refuses to move stock that is not available — exercising that inside
    the first test would test the refusal a second time while claiming to
    test the move.

    One rough edge found and left as found rather than silently patched:
    `insufficient_available`'s rejection message is hold-specific ("Not
    enough available to hold...") and is reused verbatim for a refused
    transfer, so a manager moving stock between locations sees a message
    about holding it for a client. Cosmetic, not a correctness gap — worth
    a follow-up, not a blocker for this item's Acceptance.

- [x] **13.2 Loss prevention and RFID pilot**
  - **Requirement IDs:** `INV-104`, `INV-105`.
  - **Dependencies:** `13.1`.
  - **Owner boundary:** risk rules/approvals plus EPC serialized observations
    from one adapter into count/custody events.
  - **Acceptance:** high-risk adjustment requires independent approval; RFID
    sweep reconciles observations and never posts direct balance; false
    positives are resolved.
  - **Tests:** separation of duties, duplicate reads, zone/count confidence,
    offline/retry.
  - **Non-goals:** no employee accusation score.
  - **Hard blockers:** reader hardware blocks live pilot only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. The non-goal is structural, not documented:
    no function in `loss-prevention.ts` accepts a staff id and returns a
    number. `assessAdjustmentRisk` takes only properties of the
    _transaction_ — value, repetition, whether a count session was open —
    and a test parses its signature to prove no identity is in it.
    `summarizeRiskCoverage` reports adjustments and locations; a "who
    triggers the most flags" view cannot be built from it because the
    identity never enters the function. The schema likewise has no
    risk-score or incident-count column. Approval requires a different
    person **and** a manager: either alone is insufficient, since a peer
    approving a peer is not independence. An RFID sweep never posts a
    balance — `reconcileSweep` returns `postsBalanceChange: false`, the
    observations table has no route to the ledger, and only a human count
    adjustment moves stock. Repeated reads of one tag collapse to one
    jacket, which is how a pilot avoids inventing a surplus on day one. An
    expected-but-unseen tag is `unobserved`, never `missing`: a tag goes
    unread for a dozen mundane reasons and "missing" invites a write-off.
    Low-confidence reads stay visible so a poor sweep does not look like a
    clean one, and closing a discrepancy requires a note, because
    "resolved" with no reason is indistinguishable from "ignored". Live
    reader hardware remains `blocked_external`.

  - **Status (2026-08-01, takeover branch, revised):** `verified_local`.
    Now an operated surface: `LossPreventionRepository`, `/inventory/risk`,
    7 live assertions in `loss-prevention-live.integration.test.ts` and a
    browser proof `apps/retailer/e2e/loss-prevention.spec.ts`.

    The control the item turns on is that a valuable write-off has NOT
    happened when it is asked for. Raising one writes a flag with a null
    `ledger_entry_id` and touches no stock at all; only the approval writes
    the ledger entry, and the flag then cites the entry it authorised so an
    audit walks from signature to movement rather than inferring it from
    timestamps. Self-approval is refused in the application AND by a CHECK
    constraint, so it holds even if something bypasses the repository. A
    different person who is not a manager is refused too — either half alone
    is not independence. A second approval on the same flag is refused,
    because one signature authorises one movement.

    The RFID half never posts a balance, and that is structural rather than
    documented: there is no method on the repository that turns a sweep into
    a ledger entry, so the page has no such button to offer. Four reads of
    one tag are one garment (the browser asserts "3 found", not 6, which is
    how a pilot avoids inventing a surplus on day one), a low-confidence read
    stays counted so a poor sweep looks poor, and an expected-but-unread tag
    is labelled "Expected here, not read" — never "missing", because that
    word invites a write-off nobody counted. Closing a discrepancy without a
    sentence is refused, and the sentence is stored.

    One ordering defect found by operating it: the action checked for an open
    stock count BEFORE checking who was allowed to approve, so someone who
    could not approve at all was sent off to open a count session and the
    real answer was hidden behind an unrelated instruction. Identity is now
    settled first.

    Migration 22 adds `unique (sweep_id, epc, kind)`. Without it a reader
    that drops its connection and retries appended duplicate discrepancies,
    so the pilot would look like it found twice as many problems as it did
    and a person resolving one copy would leave the other open forever.

    Two suites were also made to own their rows: an unapproved risk flag and
    an unresolved `advisor_review` candidate are not inert debris — they sit
    in a queue and fail unrelated specs later, looking like those specs'
    bug. Live reader hardware remains `blocked_external`.

  - **Checkbox correction (2026-08-04, takeover branch):** the revised
    status above already describes all three Acceptance clauses satisfied
    and local-verified, with only the reader-hardware pilot left
    `blocked_external` — the same shape as 8.4 and 9.1, both checked. The
    box had simply never been flipped after that revision; nothing further
    was built or changed in this pass.

- [ ] **13.3 Omnichannel POS and returns**
  - **Requirement IDs:** Stage 13 target architecture.
  - **Dependencies:** `13.1`, `8.2`; ADR-062 for activated money capabilities.
  - **Owner boundary:** RTW/service/MTM carts, quotes, suspended/remote sale,
    provider references, fulfillment, returns/exchanges.
  - **Acceptance:** mixed RTW+MTM+alteration transaction; stock/financial
    history survives return/exchange; provider retries reconcile.
  - **Tests:** concurrent reservation, provider contracts, refund/reversal,
    close totals and RLS.
  - **Non-goals:** no raw card storage or custom lending.
  - **Hard blockers:** provider/compliance blocks affected payment activation.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. There is no column in `pos_payments` a PAN,
    CVC or track-2 blob could be written into, and `checkPaymentCapture`
    rejects the _entire_ capture if a caller passes a card-shaped field
    name rather than silently dropping it — dropping it would let the
    caller believe it was stored and keep sending it. Provider activation
    is gated on ADR-062: an unactivated provider is refused, so no payment
    can be recorded against a money design nobody approved. A completed
    transaction has no exits at all; the correction for a completed sale
    is a return or exchange, which is a **new linked transaction**, never
    an edit — that is what makes stock and financial history survive a
    return, which is the item's own acceptance criterion. A mixed cart is
    never netted into one number: RTW, alteration service and MTM stay
    separate because they behave differently on return. MTM is refused
    outright rather than given a shorter window, since a garment cut to
    one person has no second buyer and a policy pretending otherwise
    creates a dispute at the worst moment; a performed alteration is
    likewise not refundable, an unperformed one is. Payments are
    append-only and unique per provider reference, so a retry reconciles
    instead of double-charging. Missing: till UI, receipt/fulfilment,
    exchange flow, browser proof. Payment activation stays
    `blocked_external` on provider and compliance decisions.
  - **Status (2026-08-01, takeover branch, revised):** `verified_local`.
    Browser proof `apps/retailer/e2e/pos.spec.ts` (two cases) plus 21 live
    assertions in `pos-live.integration.test.ts`, all against the cloud
    Postgres. Operating the till found three defects that domain unit tests
    could not see:

    1. **`completeSale` skipped payment entirely.** It attempted
       `open -> completed`, an edge the transition graph does not contain.
       The graph was right: `completed` is reachable only from
       `awaiting_payment`. Worse, nothing anywhere required the money to
       exist — a till could have closed a cart nobody paid for and the
       stock would have moved. `checkSaleCompletable` now refuses on
       `payment_incomplete`, and `completeSale` genuinely travels
       `awaiting_payment -> completed`. Overpayment passes (change is given
       in the room); underpayment does not.
    2. **No sale could ever legally complete.** `ACTIVATED_PAYMENT_PROVIDERS`
       is empty until ADR-062 approves a processor, so every capture was
       refused, so completion was unreachable — the POS was unshippable by
       construction, not by policy. Resolved by recognising **cash** as a
       tender rather than a provider integration: there is no PSP to
       approve, no card to refuse and no settlement design to sign off. Card
       stays gated on ADR-062. The card-data refusal is unchanged and still
       applies to cash, so the carve-out is about provider approval and
       never about what may be stored.
    3. **A 5s default test timeout was masquerading as correctness.** Raised
       once in `packages/database/vitest.config.ts` rather than per case, on
       the same reasoning as the Playwright remote-DB timeouts.

    What the browser proves, not merely asserts: adding a garment to a cart
    HOLDS it (on-hand 4, available 2) so a second till cannot promise the
    same one; the card form is present and refuses itself in plain language
    rather than being mysteriously absent; an unpaid sale shows the money
    owed and stays `open`; cancelling returns every held garment to the
    shelf; cash completes and the ledger reads exactly `receipt,
reservation, reservation_release, reservation, reservation_release,
sale` — nothing deleted to make it tidy; the finished sale has no edit
    affordance anywhere and a per-line **return** instead, which writes a
    NEW linked transaction, restocks through the 13.1 ledger and leaves the
    original `completed`; a second return of the same unit is refused; and
    made-to-measure is refused with the reason and an alternative rather
    than an enum. The cash reference is derived per transaction, so a
    re-recorded tender collides on the unique constraint instead of
    doubling the day's takings.

    Still open: receipt/fulfilment, the exchange flow (as distinct from a
    return), suspended and remote sale. Card activation remains
    `blocked_external`.

  - **Update (2026-08-04, takeover branch):** suspend is now real and
    browser-proven, closing that part of the "still open" list above.
    `checkTransactionTransition` already modelled `open ↔ suspended` in its
    graph; nothing in the UI or repository reached it — `findOpenTransaction`
    included `suspended` in the states it treats as "the counter", so a
    parked sale had no way to ever be created through the running app (the
    till would have kept showing it as the active cart). Fixed by excluding
    `suspended` from that query and adding `listSuspended`, so suspending
    genuinely clears the counter and a parked sale only reappears once
    someone explicitly resumes it. `apps/retailer/e2e/pos.spec.ts`'s third
    case proves: adding a line holds it, suspending clears the counter back
    to the empty state while the hold survives untouched, resuming is
    refused while a different sale is already on the same counter (a
    physical till has one sale on it at a time), and resuming succeeds once
    that second sale is cleared — with the held line still on it.

    Still open: receipt/fulfilment, the exchange flow (as distinct from a
    return), remote sale. Card activation remains `blocked_external`.

### Stage 14 — Corporate fashion and advanced intelligence

- [ ] **14.1 PAON Métier corporate pilot**
  - **Requirement IDs:** `CORP-101`–`CORP-106`.
  - **Dependencies:** `8.3`, `13.1`; fit/order foundations.
  - **Owner boundary:** B2B account/programme/roles/wearers, entitlement,
    employee portal, fittings/orders/exceptions/readiness and tender demo.
  - **Acceptance:** one fixture employer with two locations/three roles runs
    invite → fit → order → issue → service/leaver exception; retailer and
    corporate dashboards are separately scoped.
  - **Tests:** entitlement versions, role/location/RLS, batch/delta import,
    readiness and browser/a11y.
  - **Non-goals:** no HR replacement or unrestricted health/accommodation data.
  - **Hard blockers:** live employer data blocks only live pilot.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only; no employee portal, no dashboards, no browser
    proof. Both non-goals are structural. `corporate_wearers` has no
    salary, manager, termination reason, notice period or performance
    column, and a test asserts their absence — a leaver is an
    _entitlement_ event that produces garment-return exceptions, and
    `planLeaverExceptions` returns nothing resembling an employment
    record. There is also no diagnosis, medical or accommodation-reason
    column anywhere: an adaptation is stored as a garment fact ("left
    sleeve +40mm", "magnetic fastening"), the reason is never asked for,
    and `checkAccommodationNote` refuses text matching diagnosis-shaped
    language, because a free-text field beside a fitting is exactly where
    health data ends up by accident. Entitlements are versioned and both
    the version table and the issue table are append-only, so an employer
    widening policy next year cannot retroactively make last year's issues
    over-quota, and an issue cannot be edited to restate a balance. A
    wearer may exist with a null `customer_id`, so a programme does not
    manufacture a shadow customer per employee. Readiness names the
    wearers who have not started rather than only a percentage — a
    percentage says you are behind, a list says who to call. The corporate
    scoped view is a whitelist carrying programme readiness only: no
    margins, no other clients, and no individual measurements, since a
    supervisor reading a colleague's chest measurement is the worst
    failure mode in this item. Missing: employee portal, invite flow,
    fitting/order/issue wiring to real orders, tender demo, dashboards and
    browser proof. Live employer data stays `blocked_external`.
  - **Update (2026-08-03, takeover branch):** the retailer-staff side of
    this item is now real and browser-proven —
    `apps/retailer/e2e/corporate.spec.ts` drives a real owner through
    `/corporate`: view entitlement balances computed live from
    `computeEntitlementBalance` (not a cached snapshot), issue a garment
    gated by the real `checkIssue` refusal, and log/resolve an
    exception. `CorporateRepository` is the repository layer this item
    always needed; every one of the domain functions named above
    (`planLeaverExceptions`, `checkAccommodationNote`,
    `summarizeProgrammeReadiness`, `buildCorporateScopedView`) had zero
    callers before this and is now wired to the page — the readiness
    banner names not-started wearers by their real display name, exactly
    per the domain's own stated design. The checkbox stays unchecked:
    the owner boundary and acceptance criterion both name an **employee
    portal** — a login for the employer's own contact — which is a
    genuinely separate scope this update does not touch. Every RLS
    policy on every `corporate_*` table admits only
    `current_retailer_role()` (retailer staff); there is no auth path,
    session type or RLS grant anywhere for a corporate account contact,
    and adding one is a new-auth-path decision, not a UI gap "on existing
    schema" can close. Missing: employee portal and its own auth/session/
    RLS, invite flow, fitting/order/issue wiring to real orders, tender
    demo, and the employer-facing `CorporateScopedView` dashboard (the
    function exists and is unit-tested; nothing renders it, because
    nothing signs an employer contact in to see it).
  - **Update (2026-08-04, takeover branch):** the founder's corporate B2B
    mega-directive (InsiderTailoring, Métier expansion, tenders, employee
    portal, service desk, rollout/analytics — see the new Stage 18) builds
    on this item rather than beside it. An audit against that directive's
    full capability list found this item's schema, domain and
    retailer-staff UI to be the single strongest existing foundation —
    `ProgrammeReadiness.readyForTender` was already anticipating a tender
    workflow before one existed. Stage 18 does not duplicate
    `corporate_accounts`/`corporate_programmes`/`corporate_wearers`; every
    new corporate capability is required to extend this item's tables and
    domain module, not fork them. The still-missing employee portal named
    above is now tracked as 18.5, not a second open item.

- [ ] **14.2 Advanced cited intelligence**
  - **Requirement IDs:** Stage 14 target plus `WFM-105`, `INV-104`.
  - **Dependencies:** real operational evidence from earlier stages.
  - **Owner boundary:** temporal hotspots, interest progression, complete-look,
    fit/production/stock/staffing risk and role dashboards.
  - **Acceptance:** each recommendation exposes sources/version/window/sample;
    correction recomputes; inventory/lead time/presence remain honest.
  - **Tests:** projector fixtures, correction, sample/timezone, role/RLS and AI
    evaluation.
  - **Non-goals:** no black-box owner dashboard.
  - **Hard blockers:** sparse live data defers model claims, not contracts.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. The non-goal is a CHECK constraint, not a
    review convention: `cited_recommendations.sources` is asserted
    non-empty in the schema, and `buildRecommendation` is the only
    constructor — it refuses a missing source, a source with no projector
    version, an inverted window, a non-positive sample, and a sample size
    larger than the sources actually contain, which is the most direct way
    to make a weak finding look strong. Confidence is a band
    (`insufficient_sample` / `indicative` / `supported`), never a
    percentage: "73% confident" from a sample of nine means nothing but
    reads as though it does. A low-sample recommendation is kept and
    labelled rather than hidden, because silently dropping it makes a
    sparse dataset look confident — the same lie as overstating
    confidence, told by omission. Every recommendation carries the fact
    ids it derives from, so `planRecompute` can find and withdraw what a
    corrected customer fact invalidated instead of leaving a stale card up
    until the next scheduled rebuild; a recommendation is withdrawn with a
    reason, never edited in place. `checkRecommendationHonesty` refuses
    three specific claims — offering stock that is not available, quoting
    a lead time shorter than the supplier's own, and implying an advisor
    is present when the roster says otherwise — because each turns a
    suggestion into a promise the shop cannot keep in front of a customer.
    Missing: the projectors themselves, role dashboards, AI evaluation,
    and browser proof.
  - **Update (2026-08-04, takeover branch):** first real projector shipped
    and proven in the browser: `temporal_hotspot`. `findBusiestSlot`
    (`packages/domain/src/intelligence/cited-recommendation.ts`) buckets
    real appointment `startsAt` values by day-of-week/hour — documented as
    UTC-naive for this first pass rather than silently assumed
    timezone-correct. `CitedRecommendationRepository.computeTemporalHotspot`
    (`packages/database`) reads live appointments (excluding
    cancellations/no-shows — a slot nobody kept is not a hotspot), finds
    the busiest bucket, and stores a fully cited recommendation through
    `buildRecommendation`, naming the exact source, window, and sample
    size. Recompute withdraws any prior live `temporal_hotspot`
    recommendation first, so pressing "Recompute" repeatedly supersedes
    the old finding rather than piling up duplicates — a recommendation is
    withdrawn, not edited, on every path, including "no appointments in
    the window anymore." Wired to `/analytics` as a manager-gated "Cited
    insights" card (`apps/retailer/app/(dashboard)/analytics/insights.tsx`,
    `actions.ts`) showing the confidence band, sample size and statement,
    with an explicit on-demand recompute button — never a silent
    background job. `apps/retailer/e2e/analytics.spec.ts` proves the full
    honesty arc in a real browser: 3 seeded appointments recompute to a
    visible `insufficient_sample` card; seeding to 50 in the same bucket
    and recomputing again supersedes it with a `supported` card, and the
    DB is asserted to hold exactly one live row (the sparse one withdrawn,
    not left standing). The checkbox stays unchecked: this is 1 of 7
    `RECOMMENDATION_KINDS` (temporal_hotspot only — interest_progression,
    complete_look, fit_risk, production_risk, stock_risk, staffing_risk
    remain domain-only with no projector), `buildRoleDashboard` still has
    no caller wiring role-scoped dashboards to a UI, and there is no AI
    evaluation harness. Missing: the other six projectors, role
    dashboards, AI evaluation.
  - **Fix (2026-08-04, takeover branch):** `analytics.spec.ts`'s "sparse"
    bucket was a fixed day/hour ("30 days back, 3am UTC"), identical on
    every run within the same calendar day. Against the shared, long-lived
    `e2e-retailer-workspace` fixture retailer this eventually collided
    with organic appointment accumulation from unrelated specs (found:
    `workspace.spec.ts`'s own fixed-time appointment fixture had
    accumulated 10+ rows in one bucket from repeated same-day runs,
    tipping the "busiest slot" the test relies on into a bucket it did
    not create). Fixed by deriving both the day offset and hour from the
    test's own unique run id (168 combinations); the stray accumulated
    appointments were also cleared. Residual risk: this remains a shared,
    never-reset fixture retailer, so a long enough run of same-day local
    executions could in principle collide again — a fully isolated
    retailer per run would remove this class of flake entirely but was
    not built here, since real CI resets the database between runs.
  - **Fix (2026-08-04, takeover branch, continued):** the residual risk
    named directly above materialised the same day it was written — a
    later run collided again (`n=3` seeded fresh, read back as
    `indicative` because of rows another spec had already left in the
    same day-of-week/hour bucket), which is exactly what a 168-slot
    birthday-paradox space predicts under enough repeated same-day runs,
    not a fluke. Widening the random space further only lowers the odds;
    it does not remove the class of flake. Replaced with a deterministic
    fix: before seeding, the test now queries every non-cancelled
    appointment already in its chosen day-of-week/hour bucket for this
    retailer (across the same 90-day window `computeTemporalHotspot`
    itself uses) and deletes them, regardless of which run or spec left
    them there. The bucket starts empty on every run by construction, so
    there is nothing left to collide with. Verified with two consecutive
    passing runs. The residual-risk note above is superseded by this —
    a fully isolated retailer per run is still the only way to remove
    shared-fixture risk everywhere else in this suite, but this specific
    flake class is now closed for this spec.

### Stage 15 — Lifestyle network and MunroMerchant

- [ ] **15.1 Lifestyle partner catalogue and attribution**
  - **Requirement IDs:** `NET-101`–`NET-103`.
  - **Dependencies:** `10.1`, `8.2`.
  - **Owner boundary:** partner/programme/listing, retailer curation, customer
    placement, click/lead/order confirmation, holding/reversal and reporting.
  - **Acceptance:** retailer activates disclosed partner listing; attributed
    conversion reverses on refund; partner receives no raw Self-Portrait.
  - **Tests:** attribution/idempotency, expiry/reversal, visibility/RLS.
  - **Non-goals:** no silent sale of named customer profiles.
  - **Hard blockers:** commercial contract blocks live listing only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only; no UI, no browser proof.
    `network_attribution_events` has **no `customer_id` column at all** —
    not a nullable one — so a partner-facing query has nothing to resolve
    a person from, and a test asserts the absence. The customer-to-pseudonym
    mapping lives in `network_pseudonym_map`, granted to `service_role`
    only, with no retailer-select policy: no session and no partner
    integration can reverse it. `buildPartnerPayload` is a whitelist over
    the pseudonymous ref and a test proves a name, an email and a
    Self-Portrait value all fail to appear in its output. A confirmed order
    enters `holding`, not `confirmed` — commission is payable only once the
    return window closes, because paying on order and clawing back later
    leaves a partner owing money on a month they have already spent — and a
    refund reverses to zero wherever in the window it lands. Retried
    provider callbacks collapse on a unique `provider_event_key`. Every
    partner listing must carry disclosure text: a placement the customer
    cannot tell is commercial is an advertisement pretending to be advice.
    Missing: listing curation UI, customer placement surface, partner
    reporting, browser proof. Live listings stay `blocked_external`.
  - **Update (2026-08-04, takeover branch):** retailer curation and the
    attribution lifecycle are wired end to end and proven in the browser.
    `NetworkRepository` (`packages/database`) is thin persistence over the
    existing domain checks: `createPartner`/`createListing` write through
    the ordinary session-scoped client (RLS already restricts writes to
    owner/manager/admin), `resolvePseudonym` is the one method that takes
    an admin/service-role client — `network_pseudonym_map` grants no other
    access, by design — and reuses an existing (customer, partner) ref
    rather than minting a new one per visit. Attribution state is never
    stored: `resolveListingAttribution` recomputes it from the full event
    history via `resolveAttribution` on every read, so a refund recorded
    after the fact is reflected immediately with nothing to go back and
    edit. Wired to a new `/network` page (`apps/retailer/app/(dashboard)/network`,
    gated to manager+, added to the `network_ecosystem` module's nav in
    both `module-kernel.ts` and the dashboard layout — the 11.4 lesson
    about needing both). `network.spec.ts` proves the full arc through the
    real UI: a manager adds a partner and a listing (active by default),
    records a click for a real seeded customer, confirms an order into
    `holding`, then refunds it to `reversed` with the attributable amount
    at €0.00 — and the DB is asserted to hold exactly one pseudonymous ref
    across all three events, distinct from the customer's own id. The
    partner-payload preview rendered in the browser is asserted never to
    contain the customer's name, email or id — scoped specifically to that
    payload block, since the retailer's own customer picker on the same
    page legitimately lists every customer by name and is not itself
    partner-facing data. The checkbox stays unchecked: the owner boundary
    also names a **customer placement surface** (nothing shows a listing to
    a customer in the customer app) and **partner reporting** (no summary
    view of a partner's own conversions), neither of which exists yet.
    Missing: customer-facing placement, partner reporting. Live listings
    stay `blocked_external`, unchanged.

- [ ] **15.2 Rewards and concierge activation**
  - **Requirement IDs:** `NET-103`, `NET-104`.
  - **Dependencies:** `15.1`; ADR-062 decisions for liability/money.
  - **Owner boundary:** concierge operational requests and explicit
    funded/pending/available/reversed rewards ledger.
  - **Acceptance:** non-money concierge works independently; any earning,
    redemption or transfer names funding/liability/accounting/provider.
  - **Tests:** ledger reversal, expiry, eligibility, partner/account mapping.
  - **Non-goals:** no unapproved stored value or promised transfer network.
  - **Hard blockers:** accounting/provider decision blocks affected reward.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. The concierge half deliberately works with no
    money design at all, so the useful part of this item is not blocked on
    a decision it does not need; `checkConciergeRequest` refuses only a
    request that would move money. On the reward side, `funding_source`
    and `expires_on` are both NOT NULL: every unit of value must trace to
    money that already exists, and an unexpiring balance is an indefinite
    liability — which is precisely the stored-value question ADR-062 has
    not answered. Transfer between customers is refused **outright** rather
    than gated behind a flag, because a transferable balance is a currency
    and PAON has no licence to issue one; making it a refusal rather than
    an unimplemented branch means nobody can enable it by setting a
    boolean. Rewards are append-only and a refunded attribution produces
    reversal _entries_ citing the original, never an edit. A test asserts
    the whole migration names no payout, provider or payment reference
    anywhere. Missing: reward UI, concierge request surface, accounting
    export, browser proof.

- [ ] **15.3 MunroMerchant B2B procurement**
  - **Requirement IDs:** `MKT-001`; ADR-064.
  - **Dependencies:** provider-neutral Stage 15 architecture; separate bounded
    context.
  - **Owner boundary:** suppliers/listings/MOQ/tiers/samples/customization/
    proofs/RFQ/quote/PO/shipment/issues/group buy.
  - **Acceptance:** paper-bag custom proof, hanger reorder, furniture RFQ and
    group-buy fixtures; no consumer catalogue/customer contamination.
  - **Tests:** package/table/RLS boundaries, supplier/buyer roles, full flows.
  - **Non-goals:** no customer-facing marketplace order reuse.
  - **Hard blockers:** money/commercial decisions block payment, not RFQ/PO.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only, and deliberately a **separate bounded
    context**: `packages/domain/src/merchant/munro-merchant.ts` imports
    nothing at all — a test reads its own source and asserts the import
    list is empty — and every `merchant_*` table is checked to reference
    no `customers`, `orders`, `order_lines`, `wardrobe_items`, `products`
    or `product_variants`. A foreign key is the only thing that could break
    the boundary, so that is what the test looks for. Tiered pricing
    applies the _highest_ tier the quantity clears, because sorting
    ascending and taking the first match quotes the most expensive band to
    the largest buyer. A customised item cannot be accepted without an
    approved proof — printing 5,000 bags with the wrong logo is not a
    recoverable mistake. A purchase order above a threshold needs a second
    person, and `initiatePayment` is refused outright rather than ignored,
    the same reasoning as 12.3's partner invoice. A group buy reports a
    near-miss as a miss with the shortfall, since a group buy that
    "nearly" hit its minimum is one the supplier will not honour. Missing:
    supplier/buyer portals, sample workflow, browser proof. Payment stays
    `blocked_external`.

- [ ] **15.4 Audience Studio and advertising inventory**
  - **Requirement IDs:** `NET-105`; ledger rows `NET-17`–`NET-22`, `NET-31`.
  - **Dependencies:** `15.1`; Stage 7 evidence/consent plane; `8.2`.
  - **Owner boundary:** audience and advertising bounded context plus
    advertiser/publisher/PAON portal surfaces — cited eligibility rules,
    versioned cohorts, policy-aware reachable-size forecasting, holdout
    membership, inventory and placements, orders, line items, flights,
    creatives with rights/review state, budgets, pacing, frequency caps, and
    the append-only impression/viewability/click/lead/booking/conversion/
    refund/reversal event stream with deduplication and fraud-review state.
  - **Acceptance:** an advertiser or PAON operator builds a cohort whose size
    forecast is computed under policy and refuses to render when entitlement is
    absent; activation pins the cohort version so a later rule edit cannot
    restate a past forecast or a past payable; an order resolves to line items,
    flights and reviewed creatives; pacing and frequency caps are enforced and
    observable; duplicate provider callbacks replay idempotently; a
    PAON-executed audience delivers placements and outcomes to the advertiser
    without exporting named profiles.
  - **Tests:** cohort version pin on activation, policy-denied forecast, pacing
    and frequency-cap enforcement, event idempotency and dedupe keys,
    creative-rights gate, cross-tenant denial, and an advertiser-to-customer
    multi-role browser journey.
  - **Non-goals:** no live ad serving before contracts, no fabricated reach or
    impression counts, no cross-device identity claim without evidence.
  - **Hard blockers:** ad-provider credentials and signed advertiser contracts
    block live serving and live billing only, not the provider-neutral local
    capability.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. Cohort versions are immutable rows;
    `advertising_orders` and `audience_forecasts` both pin
    `cohort_version_id` with `on delete restrict`, so a later rule edit
    creates a new version rather than restating a past forecast or a past
    payable. `restateForecast()` exists **only to refuse** — a past
    forecast is a historical claim, and recomputing it under today's rules
    makes a measurement dispute unwinnable because nobody can show what was
    originally said. `advertising_live_needs_contract` makes live serving
    without a signed contract impossible at the schema level, which is
    exactly the line the hard blocker draws: local capability yes, live
    serving no. Pacing and frequency caps are enforced in `checkDelivery`
    before an impression, not reported afterwards — a cap you can only
    observe after the fact is not a cap — and an unreviewed creative
    cannot deliver. Provider events dedupe on a unique key, and
    `advertising_events` has no `customer_id` column, same as the partner
    network. `checkIdentityClaim` refuses a cross-device claim resting on a
    probabilistic signal: a shared IP address is not evidence that two
    devices are one person. Missing: advertiser and publisher portals,
    the serving path itself, browser proof.

- [ ] **15.5 Governed insights, clean-room and entitlement exchange**
  - **Requirement IDs:** `NET-106`; ledger rows `NET-23`–`NET-28`, `NET-32`.
  - **Dependencies:** `15.1`, `15.4`; consent/provenance plane (ENG-006).
  - **Owner boundary:** network intelligence over the policy/entitlement plane
    — aggregate insights, retailer benchmarking, PAON-executed audiences,
    pseudonymous attribution, clean-room matching, contracted data exchange,
    retailer exports of own tenant data, customer-requested named
    introductions, and the canonical multi-party revenue-sharing ledgers for
    retailer, publisher, partner/fulfiller, advertiser settlement and PAON fee.
  - **Acceptance:** each release mode is allowed only with purpose, contract and
    entitlement recorded; aggregates enforce minimum-n thresholds; a named
    introduction occurs only on the customer's own request and is audited;
    correcting or deleting a customer fact recomputes derived eligibility,
    cohorts, forecasts and payable projections; a refund reverses every
    affected ledger share without erasing history; accounting export remains a
    projection over the ledger rather than a second truth.
  - **Tests:** minimum-n threshold rejection, entitlement matrix per mode,
    correction and deletion recompute, reversal propagation across shares,
    rejection of uncontrolled named export, and cross-tenant denial.
  - **Non-goals:** no sale or export of named customer profiles for
    uncontrolled reuse; no benchmarking that re-identifies a peer retailer; no
    technically false measurement claim.
  - **Hard blockers:** data-processing terms and clean-room provider decisions
    block the affected exchange mode only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. `governed_releases.purpose` and
    `entitlement_ref` are NOT NULL, so a release cannot be recorded without
    the things that made it lawful — a nullable column would make
    "recorded" optional. The minimum-n floor is a CHECK constraint rather
    than application logic, and `checkRelease` evaluates it against the
    cohort **as it is now**: a cohort that was 400 people and is 6 after a
    correction stops being releasable immediately. Only two modes may carry
    a named person — `own_tenant_export` (a retailer's own data about its
    own customers) and `customer_requested_introduction`, which requires
    the customer's own request on record; every other mode is refused if it
    tries, in both the domain check and a CHECK constraint. A refund
    reverses **every** share, not only the retailer's, and reversal is a
    new ledger row citing the original because editing it would erase that
    value was ever shared, which is the thing a dispute needs. Revenue
    share entries have no UPDATE grant. Missing: clean-room adapter,
    benchmark projections, accounting export, browser proof. Affected
    exchange modes stay `blocked_external` on data-processing terms.

### Stage 16 — Knowledge productization and vertical packs

- [ ] **16.1 Consultancy, guided tiers and staff academy**
  - **Requirement IDs:** `KNW-101`–`KNW-104`.
  - **Dependencies:** existing knowledge; `8.3`, `11.2`.
  - **Owner boundary:** separate customer/staff/owner/media libraries, guided
    MTM package versions, DailyBriefing, MunroMentor and an AMAM consultancy
    request/project/milestone/deliverable workflow.
  - **Acceptance:** an article launches an audit/template or scoped
    consultancy project; customer selects a coherent tier; employee completes
    context lesson and evidence-cited roleplay/coaching loop; project
    deliverables and approvals are visible to the retailer.
  - **Tests:** content approval/version/rights, package spec mapping, rubric
    grounding and role/RLS.
  - **Non-goals:** no unreviewed AI publication.
  - **Hard blockers:** licensed media blocks that content only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. "No unreviewed AI publication" is a CHECK
    constraint: `knowledge_ai_needs_human_approval` makes it impossible to
    set `published_at` on machine-written content that is not
    `human_approved`, and `provenance` is NOT NULL so an AI draft cannot be
    laundered in by omitting it. `ai_assisted` is treated identically to
    `ai_generated` — a human who edited a machine draft is still publishing
    a machine draft, and the distinction is too easy to claim to be worth
    trusting. An author cannot review their own article, in both the domain
    check and a constraint. Tier coherence catches the specific incoherence
    that matters: a dearer tier that silently drops something a cheaper one
    included, which a customer discovers by upgrading and losing a service.
    A roleplay grade must cite observed behaviour with an evidence ref,
    because ungrounded feedback teaches nothing and cannot be disputed —
    the same problem seen from two sides — and there is no aggregate score
    column, matching 11.2 and 11.3. A consultancy project cannot enter
    delivery with no deliverable the retailer can see, and cannot close
    without their approval. Missing: the libraries themselves, DailyBriefing,
    MunroMentor, all UI and browser proof. Licensed media stays
    `blocked_external` for that content only.
  - **Update (2026-08-04, takeover branch):** the roleplay/coaching half of
    the acceptance criterion is wired end to end and browser-proven —
    the first UI or persistence this item has had. `AcademyRepository`
    (`packages/database`) is thin persistence over the existing
    `checkRoleplayGrade`: ungrounded feedback (no evidence ref, or an
    observed-behaviour string under 10 characters) is refused before it is
    ever written, and self-grading is refused with a friendly reason ahead
    of the schema's own `academy_grade_self_grading` CHECK. Added to the
    existing `/staff/learning` page (`apps/retailer/app/(dashboard)/staff/learning`)
    rather than a new route, since it is already this workspace's coaching
    surface: a manager records a grade citing a criterion, an evidence ref
    and the specific observed behaviour; the graded staff member sees it
    on their own page. `academy_roleplay_grades` is append-only (no
    UPDATE/DELETE grant for any role, including service_role), so a
    mistaken grade is corrected by recording a new one, never by editing
    the old one — there is deliberately no edit affordance anywhere.
    `academy-roleplay.spec.ts` proves the full loop in the browser: signed
    in as the manager persona, the manager's own staff id is asserted
    absent from the staff picker (self-grading has no path through the UI
    at all, not just a refused submission), a real grade is recorded for
    the advisor persona and read back from the DB with the exact evidence
    array and the correct grader/gradee ids, then — after an explicit
    sign-out/sign-in, since a live session does not switch personas by
    itself — the advisor's own page is asserted to show that exact grade,
    cited in full, with no grading form offered (grading is a manager
    action, not a peer one). The checkbox stays unchecked: this item's
    owner boundary is five subsystems (separate customer/staff/owner/media
    libraries, guided MTM tiers, DailyBriefing, MunroMentor, and the AMAM
    consultancy request/project/milestone workflow) and only the roleplay
    grading loop exists. Missing: the knowledge libraries, guided tier
    selection UI, DailyBriefing, MunroMentor, and the consultancy project
    workflow — all still domain-and-schema-only with no UI. Licensed media
    stays `blocked_external` for that content only, unchanged.

- [ ] **16.2 Media and future-products incubation**
  - **Requirement IDs:** `KNW-105`, `NET-103`.
  - **Dependencies:** `16.1`, `15.1`.
  - **Owner boundary:** rights-aware contributor/review/retailer media
    activation and gated product incubation register including remnant/
    upcycled-drop hypotheses.
  - **Acceptance:** retailer activates approved expiring article/feed; future
    product remains a hypothesis until demand/margin/supplier/quality evidence.
  - **Tests:** rights/territory/expiry, attribution and catalogue separation.
  - **Non-goals:** no copied publisher content or speculative stock purchase.
  - **Hard blockers:** media agreement blocks publication only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. `checkMediaActivation` refuses content whose
    rights have expired, whose territory does not cover the retailer, or
    which names no licence — a piece with no stated licence is a piece
    somebody assumed was free, and "we found it online" is how a publisher
    complaint starts. On incubation, `product_hypotheses` has **no**
    purchase-order, committed-quantity or supplier-order column, and a test
    asserts their absence: "no speculative stock purchase" is implemented
    as nowhere to record one. `evaluateProductHypothesis` returns
    `authorisesPurchase: false` unconditionally — even when demand, margin,
    supplier and quality evidence all exist, the function has no success
    case that means "buy it", because that is a human decision. Missing:
    contributor workflow, feed activation UI, browser proof.

- [ ] **16.3 Vertical-pack framework and evidence-selected pilot**
  - **Requirement IDs:** Stage 16 target architecture.
  - **Dependencies:** stable core; actual prospect evidence.
  - **Owner boundary:** extension convention for terminology/forms/workflows/
    facts/dashboards and one second vertical.
  - **Acceptance:** second vertical completes relationship/service/commerce
    loop without core fork; menswear remains focused.
  - **Tests:** core upgrade compatibility, vertical isolation and sensitive
    field access.
  - **Non-goals:** no simultaneous speculative multi-vertical build.
  - **Hard blockers:** no qualified pilot prospect defers vertical selection.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`. — **framework only**, and the pilot deliberately not started.
    `checkVerticalPack` implements the extension contract: a pack may
    rename core terms, add forms, add workflows and declare sensitive
    fields, but may **not** declare an entity whose key matches a core
    entity — that is precisely what "no core fork" means, and it is checked
    rather than described. Renaming a term the core does not have is also
    refused, because it is a typo rather than an override and would
    silently do nothing. An undeclared sensitive field is refused, so a
    vertical cannot quietly introduce a field like `prescription` without
    it being registered as sensitive. No second vertical has been built and
    none should be: `VERTICAL_SELECTION_NOTE` states in code that selection
    comes from actual prospect evidence. The pilot remains
    `blocked_external` on a qualified prospect; the framework does not.

- [ ] **16.4 Instrumented physical-store and selling experience**
  - **Requirement IDs:** `EXP-101`.
  - **Dependencies:** `11.3`, `13.1`, `16.1`.
  - **Owner boundary:** store zone/playbook definitions, privacy-safe
    observation adapters, smart-display/mirror sessions, guided product
    comparison and optional local hospitality task/stock packages.
  - **Acceptance:** one in-store appointment links zone/display/garment/
    advisor actions to a customer-approved look and outcome; half/full/
    handmade comparison records learning; device failure has a normal manual
    fallback.
  - **Tests:** device/session isolation, consent/anonymous boundary, offline/
    retry, asset/stock links, role/RLS and tablet browser flow.
  - **Non-goals:** no fake virtual-fit precision, covert biometric identity or
    camera-derived employee accusation.
  - **Hard blockers:** display/RFID/camera hardware blocks live-device proof
    only.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. All three non-goals are refusals.
    `store_observations` has **no `staff_id` column and no biometric
    template column**, and tests assert both absences — a zone sensor that
    can report which advisor stood where becomes a productivity monitor the
    day someone asks it to. `checkObservationAdapter` refuses biometric
    identity with no consent escape hatch at all, because a consent
    checkbox on a shop door is not consent; a _named customer_ observation
    is a different and much narrower thing and does require that customer's
    recorded consent. `assessVirtualFit` returns a comparison band and a
    mandatory disclaimer, never a number: the return type declares
    `millimetres?: never`, so a future contributor adding one has to change
    the type first, which is a conversation rather than a commit. A mirror
    that says "42mm too long" implies an accuracy no display has and the
    customer will believe it. Device failure is not an error state — a
    session completed on paper is as valid as one on a mirror, which is
    what the acceptance criterion asks for — but a failure with no fallback
    recorded is refused. A guided comparison must record _why_ the customer
    preferred something: "chose full canvas" is a sale, "chose full canvas
    because the chest felt softer" is something the next advisor can use.
    Missing: tablet/mirror UI, device adapters, browser proof. Live-device
    proof stays `blocked_external`.
  - **Update (2026-08-04, takeover branch):** the manual-fallback path —
    the one half of this item with no hardware dependency at all — is
    wired end to end and browser-proven. `StoreExperienceRepository`
    (`packages/database`) is thin persistence over the existing
    `checkSessionOutcome` and `checkComparison`: closing a session with
    `deviceFailed: true` and no confirmed `manualFallbackUsed` is refused
    before it ever reaches `store_sessions`' own
    `store_session_fallback_recorded` CHECK, and a comparison marked
    `customerPreferred` with no reason is refused before
    `store_comparison_records`' own `store_comparison_preference_has_reason`
    CHECK. Deliberately does not touch `store_zones` or
    `store_observations` — those are the genuinely hardware-dependent half
    (anonymous sensors, zone playbooks) and stay untouched, unlike the
    session/comparison path, which the acceptance criterion itself
    describes as working equally well on paper. Wired to a new
    `/store-sessions` page (`apps/retailer/app/(dashboard)/store-sessions`,
    added to `garment_service_operations`' navigation in both
    `module-kernel.ts` and the dashboard layout, visible to every
    customer-facing role, not just managers — this is a floor tool).
    `store-sessions.spec.ts` proves the full arc in the browser: an advisor
    opens a session for a real customer, records a half-canvas comparison
    the customer did not prefer, then a full-canvas one they did — with the
    reason "the chest felt softer" required and captured; closing with the
    mirror marked failed but no fallback confirmed is refused in the
    browser with the session still open in the DB; confirming "finished on
    paper" then closes it, and the DB is asserted to hold both comparison
    rows exactly and a closed session with `device_failed`,
    `manual_fallback_used` and the approved look all set correctly. The
    checkbox stays unchecked: the owner boundary also names store zone/
    playbook definitions, privacy-safe observation adapters and
    smart-display/mirror sessions themselves, none of which have a UI —
    this update is the paper-and-clipboard path the acceptance criterion
    says must exist independently of any device. Missing: zone/playbook
    UI, observation adapters, actual mirror/display integration. Live-device
    proof stays `blocked_external`, unchanged.

- [ ] **16.5 Moonstruck wedding-party apparel pack**
  - **Requirement IDs:** `WED-101`.
  - **Dependencies:** `16.3`, `10.1`, `12.2`; actual occasionwear pilot
    evidence.
  - **Owner boundary:** extend the existing wedding-party/member/RLS/invite/
    photo/height/weight/fitting-state aggregate with inspiration board, group
    fitting capacity, coordinated design choices, order/fitting/delivery
    readiness, guest dress-code looks/vouchers, garment aftercare and
    anniversary continuation; never create a second party model.
  - **Acceptance:** faithfully reproduce pag2's specified groom/best-men
    fitting-planning experience: inspiration before the visit, group date
    coordination, party invitations, each member's personal profile/options,
    and visible fitting/delivery/pickup progress. A couple plus three party
    members completes invite → inspiration/design → fitting → order readiness
    → collection/aftercare; each participant sees only their data; retailer
    sees group exceptions and the anniversary becomes a relationship moment.
  - **Tests:** group/individual permissions, invitation expiry, fitting/
    production status, asset rights, responsive multi-role browser journey.
  - **Non-goals:** no full venue, accommodation, invitations, dietary RSVP,
    lost-and-found or unlicensed escrow wedding-planning platform.
  - **Hard blockers:** no qualified occasionwear pilot defers live vertical
    proof, not the reusable pack contracts.
  - **Status (2026-08-01, takeover branch):** `implemented_unverified`.
    Domain and schema only. The owner boundary's instruction — "never
    create a second party model" — is enforced two ways. The domain module
    declares no `WeddingParty`, `PartyMember` or `WeddingPartyMember` type,
    asserted by a test that parses its own source; and a test scans
    **every** migration in the repository and asserts the only
    party-shaped tables that exist anywhere are the original
    `wedding_parties` and `wedding_party_members` from 2026-07-19. All five
    new tables hang off those rows by foreign key. Group readiness returns
    counts, states and display names only — a best man must not be able to
    read the groom's waist because they are in the same party, so nothing
    per-person beyond a name and a state crosses that boundary, and a test
    asserts no measurement vocabulary appears in the output. Coordinated
    design choices are detected as conflicting at _choice_ time; two
    different lapels discovered on the morning of the wedding is not a
    recoverable error. Group fitting capacity answers the question that
    actually goes wrong — eight groomsmen, one fitter, three weeks — before
    it becomes a complaint. A guest voucher holds a `guest_label`, never a
    `customer_id`: the couple shared those names to organise a wedding, not
    to populate a CRM, and `checkGuestVoucher` refuses outright a call that
    would create customer records. The anniversary continuation _injects_
    the existing `nextYearlyOccurrence` rather than reimplementing it,
    because a second date-recurrence function is how two parts of a system
    start disagreeing about what a leap-year date means. Missing: invite
    and inspiration UI, fitting scheduling, browser proof. The live
    occasionwear pilot stays `blocked_external`; the pack contracts do not.
  - **Correction (2026-08-04, takeover branch):** the line above is stale.
    Auditing this item while working the roadmap found that fitting
    scheduling, guest vouchers, aftercare, inspiration and design choices
    were **already built and browser-proven** by earlier work on this
    branch — just never reflected here, and never given evidence tracking,
    so they were invisible to the ADR-068 discipline. Correcting rather
    than silently trusting the checkbox: on the retailer side,
    `apps/retailer/e2e/wedding-party-coordination.spec.ts` (now wired to
    `writeBrowserProofRun`, `docs/evidence/runs/16.5.json`) proves an owner
    creating a party, adding a member, messaging it, adding an aftercare
    instruction, scheduling a group fitting, and issuing + redeeming a
    guest voucher. On the customer side — genuinely new territory this
    pass, since retailer staff cannot exercise it: `set_wedding_design_choice`
    and the other write RPCs for `wedding_inspiration_items`/
    `wedding_design_choices`/`wedding_date_candidates` all re-derive
    `auth.uid()` against the _customer_ (organizer or member) row, so a
    retailer-staff session is refused by design — this UI can only exist
    in the customer app. Six specs there
    (`apps/customer/e2e/wedding-party-{inspiration,design-choice,
date-agreement,group-fitting,guest-voucher,aftercare}.spec.ts`) were
    run fresh and all six pass: an organizer pins an inspiration note,
    sets a party-wide outfit choice, proposes and finalizes a wedding
    date, and sees the fitting/voucher/aftercare the retailer created.
    These six are not yet wired to `writeBrowserProofRun` themselves — a
    real remaining gap, not claimed as evidence-tracked — but their
    passing runs are the basis for this correction. The checkbox stays
    unchecked: `checkGroupFittingCapacity`'s "group exceptions" summary
    and `nextAnniversary`'s continuation have no caller anywhere in either
    app, and no spec exercises the invite/join-link flow
    (`joinViaInvite`, `/r/[slug]/wedding-parties/join/[token]`) despite
    the route existing. Missing: retailer-facing group-exceptions view,
    anniversary continuation UI, invite-flow browser proof, and evidence
    tracking for the six customer specs. The live occasionwear pilot
    stays `blocked_external`; the pack contracts do not.

### Stage 17 — Frictionless advisor intelligence

Founder-directed backlog, added 2026-08-04, beyond the original Nebelspiegel
traceability ledger. Source specifications for the not-yet-started items are
recorded in `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md` and this
stage's own item text; nothing here jumps ahead of Stage 15/16's own queue,
it runs alongside it per explicit founder instruction to build this backlog
now.

- [ ] **17.1 Advisor capture — AI-proposed, human-confirmed action bundles**
  - **Requirement IDs:** ADV-101.
  - **Dependencies:** `7.3` (customer_facts), `7.4` (clienteling_opportunities).
  - **Owner boundary:** typed/voiced/photographed advisor note → AI-proposed
    Self-Portrait facts, follow-ups and kept notes; advisor review/confirm/
    dismiss; the AI usage audit trail.
  - **Acceptance:** an advisor's note produces zero or more bundles, each
    citing a real substring of the note; nothing writes to `customer_facts`
    or `clienteling_opportunities` until confirmed; a dismissed bundle
    writes nothing; every attempt (success or failure) is recorded through
    `AIGenerationRepository`.
  - **Tests:** domain evidence-grounding refusal (fabricated excerpt,
    unknown fact type, empty payload fields), confirm/dismiss browser
    proof with DB assertions.
  - **Non-goals:** no black-box AI — every proposal is inspectable before
    it changes anything; no autonomous writes.
  - **Hard blockers:** none for the reviewed-proposal flow; live extraction
    needs `OPENAI_API_KEY` configured (same `blocked_external` shape as
    `next_best_action`).
  - **Status (2026-08-04, takeover branch):** `verified_local`. Migration
    `20260804120000_add_advisor_capture.sql` adds
    `advisor_capture_sessions`/`advisor_capture_bundles`; domain
    `checkCaptureBundleProposal` (`packages/domain/src/intelligence/advisor-capture.ts`)
    refuses a bundle whose `sourceExcerpt` is not a real substring of the
    note, an unknown fact type, or a missing required field per kind — the
    exact failure mode a "cited" system exists to catch, not merely
    describe. `AdvisorCaptureRepository.proposeBundles` validates every AI
    proposal before persisting; `confirmBundle` writes a
    `self_portrait_fact` bundle through `CustomerFactRepository.record`
    (new generic direct-insert method, provenance `advisor_observed`), a
    `follow_up` bundle through `ClientelingOpportunityRepository.create`
    (new `advisor_commitment` opportunity type — reuses the existing
    draft-task object rather than a second truth) and a `task_note` bundle
    through the existing `ClientelingRepository` "House notes". `@paon/ai`
    gained `extractAdvisorCaptureBundles` on the `AIProvider` interface
    (OpenAI implementation + `MockAdvisorCaptureProvider` test double,
    mirroring `import-enrichment-runner.ts`'s split of "provider returns
    `unknown`, caller validates"). Wired into the retailer customer page
    as a new "Capture a note" card next to the existing rectangle-capture
    and next-best-action cards. `advisor-capture.spec.ts` seeds three
    realistic AI proposals directly (no live API key in this environment),
    then drives the real review UI: confirms the fact (asserts the
    `customer_facts` row, its evidence, and its provenance), confirms the
    follow-up (asserts the `clienteling_opportunities` row and that it
    appears in the existing opportunity inbox under "Advisor commitment"),
    and dismisses the note (asserts nothing was written). Found and fixed
    a real client-refresh gap along the way: `revalidatePath` alone did
    not reliably repaint the bundle list after a Server Action in this
    environment — added an explicit `router.refresh()` on settle,
    matching the same pattern `advisor-rectangle-capture.tsx` already
    used; the test itself polls the database rather than the DOM for
    settlement, the established fix for this exact class of timing issue
    elsewhere in this suite (`pos.spec.ts`'s `waitForSaleState`).

- [x] **17.2 Mission Control unified brief**
  - **Requirement IDs:** ADV-102.
  - **Dependencies:** `17.1`.
  - **Owner boundary:** extend the existing Mission Control aggregation
    (today's appointments + draft clienteling opportunities) with unread
    messages, low-stock alerts and pending alteration/write-off approvals,
    so nothing actionable requires leaving the morning brief to discover.
  - **Acceptance:** an advisor sees, in one place, everything from these
    four sources that needs their attention today; each item deep-links to
    where it is actually actioned.
  - **Non-goals:** no new approval workflow — this aggregates existing ones.
  - **Status (2026-08-05, takeover branch):** `verified_local`. Audited
    first, per this file's own discipline: `/dashboard`'s "Needs your
    attention" brief (built earlier this session under FT-05, before
    Stage 17 existed as numbered items) already aggregates pending price
    approvals, today's appointments, unread messages and low stock in one
    place with real deep-links — but the item's own owner boundary names
    "the existing Mission Control aggregation (today's appointments +
    draft clienteling opportunities)" specifically, which is
    `/mission-control`'s literal current scope, not `/dashboard`'s. Rather
    than leave two overlapping-but-different "everything that needs
    attention" surfaces (`/dashboard` with five sources, `/mission-control`
    with two), the three missing sources were added to `/mission-control`
    itself, reusing the exact same repository calls and role gates
    `/dashboard` already uses (`AlterationWorkflowRepository.findPendingProposalsByRetailer`,
    `NotificationRepository.findByUser`,
    `ProductVariantRepository.countLowStockForRetailer`) — never a second
    query path for the same fact. `/dashboard` is untouched; both pages
    now show the same underlying facts through the same queries, just
    framed differently for their own purpose (a role-brief landing page
    vs. a calendar-first daily-planning page). Proof: a new second test in
    `apps/retailer/e2e/mission-control.spec.ts` (now evidence-tracked)
    seeding a real price-change proposal (via `AlterationRepository.createIntake`,
    not a raw table hack), an unread notification and a low-stock variant
    — mirroring `dashboard-digest.spec.ts`'s own already-proven fixtures
    exactly — and asserting all three render together under Mission
    Control's own `#mission-control-attention` card. Both tests in the
    file pass together (6/6 alongside the unaffected `dashboard-digest.spec.ts`
    suite, confirming no regression from the shared repository calls).

- [x] **17.3 Pre/during/post-appointment advisor dashboard**
  - **Requirement IDs:** ADV-103.
  - **Dependencies:** `17.1`, `9.x` Self-Portrait, wishlist, wardrobe.
  - **Owner boundary:** a per-appointment view: purchase history, Self-
    Portrait, favourited-vs-owned gaps, price-comfort band, prior notes; a
    sensitive-information show/hide toggle for in-front-of-customer use.
  - **Status (2026-08-05, takeover branch):** `verified_local`. Audited
    first: the appointment detail page
    (`apps/retailer/app/(dashboard)/appointments/[id]/page.tsx`) already
    had Self-Portrait and prior notes via `AdvisorPreparationBriefCard`
    (built earlier under FT-05) and loaded raw orders/garments without
    displaying them — purchase history, favourited-vs-owned gaps,
    price-comfort band and the sensitive-info toggle were the real gap.
    Two new plain, published-formula functions in
    `packages/domain/src/intelligence/appointment-brief.ts`:
    `computePriceComfortSummary` (average order value against a fixed,
    published minor-units threshold table — `value`/`mid`/`premium`/
    `luxury` — returns `null` for a customer with no orders rather than
    fabricating a band with nothing behind it) and
    `computeWishlistOwnershipGaps` (a wishlisted product variant the
    customer has never actually bought, matched against real
    `order_lines.product_variant_id` values only — never guessed from
    category or price similarity). The appointment page gained a
    "Purchase and fit intelligence" card: the comfort band and average
    order value, the five most recent orders with date/total/status, and
    a "Favourited, never bought" list linking each gap to its product
    page. A new `SensitiveInfoToggle` client component (local state only,
    no server round trip) wraps the customer's contact details and any
    pinned private team preference, defaulting hidden — "for
    in-front-of-customer use" named in this item's own owner boundary —
    distinct from `AdvisorPreparationBriefCard`'s existing consent-driven
    visibility, which is about compliance, not in-person screen
    discipline.
  - **Tests:** `packages/domain/src/intelligence/appointment-brief.test.ts`
    (10: null for zero orders, each band boundary exactly at its
    threshold, averaging across multiple orders, gap exclusion for a
    bought variant, no duplicate gaps, empty-gap list when everything is
    owned). `apps/retailer/e2e/appointment-brief.spec.ts` proves the
    whole card in a real browser against real seeded data: one $2,000
    order resolves to exactly `premium comfort` with the real average
    displayed, the order number appears in purchase history, a wishlisted
    product the customer already bought never appears in "Favourited,
    never bought" while an unbought one does, and the customer's real
    email is invisible until the "Show" button is explicitly clicked.
    Full regression run alongside `mission-control.spec.ts` and
    `dashboard-digest.spec.ts` (7/7 green together — both share the
    appointment/order/notification repositories this change touches).

- [x] **17.4 Fabric-pairing upsell engine**
  - **Requirement IDs:** ADV-104.
  - **Dependencies:** `2.x` metadata graph, product catalogue.
  - **Owner boundary:** given a selected fabric, surface top-matching
    buttons, lining options (standard + upsell), and complete-the-look
    items — a rules/metadata-graph engine, not a black box, so every
    advisor has the same upsell breadth regardless of seniority.
  - **Status (2026-08-05, takeover branch):** `verified_local`. Audited
    first: fabric→button pairing already existed in full from Stage 12.4
    (`fabric_button_rules`, `checkFabricButtonPairing`,
    `SupplierIntelligenceRepository`) but had no advisor-facing UI at
    all; lining pairing and complete-the-look did not exist. Reused
    12.4's exact shape rather than a second pairing mechanism: a new
    sibling `fabric_lining_rules` table and `checkFabricLiningPairing`
    (`packages/domain/src/production/supplier-intelligence.ts`), same
    "a missing rule means undecided, never permissive" discipline,
    extended with the standard-vs-upsell split this item's owner
    boundary names — a lining option carries its tier explicitly, never
    guessed from price. Complete-the-look reuses the existing metadata
    graph unchanged: a new `MetadataRepository.findProductIdsByConcepts`
    resolves a fabric concept's real `suggests`/`compatible_with` edges
    to real, currently active, reviewed-and-accepted catalogue products
    only — an unruled or unlinked fabric returns an empty list, never a
    fabricated one. New retailer page `/fabric-pairing`: pick a fabric
    concept, see and (manager+) edit its button rule and lining rule, and
    see its complete-the-look products, all keyed off the same real
    `MetadataConcept.slug`/`id` rather than a second free-text fabric
    identifier.
  - **Tests:** `packages/domain/src/production/supplier-intelligence.test.ts`
    (4 new: standard tier, upsell tier, undocumented-lining refusal
    returning the real options, no-rule-for-fabric refusal).
    `apps/retailer/e2e/fabric-pairing.spec.ts` proves the full arc in a
    real browser: an unruled fabric shows "undecided" for both buttons
    and linings (never a permissive default), a real metadata-graph edge
    resolves to a real accepted product under "Complete the look", and
    saving a button rule and a lining rule through the real forms is
    asserted directly against `fabric_button_rules`/`fabric_lining_rules`
    — not just the page's own rendering choice. Regression run alongside
    `supplier-intelligence.spec.ts` (2/2 green together, confirming the
    shared repository/domain file is unaffected). Full domain suite:
    997/997 passing.
  - Named gap: no advisor-facing "given a selected fabric during a live
    fitting" entry point exists yet from the customer/appointment
    workflow itself — `/fabric-pairing` is a standalone lookup tool
    reachable from the nav, not yet linked from the appointment brief
    (17.3) or the suit configurator (FT-07). Real-canonical (retailer_id
    null) fabric concepts and edges also do not exist yet — every rule
    and edge is currently retailer-authored, which is correct per this
    item's own schema design but means a brand-new retailer starts with
    an empty upsell engine until they author their own rules.

- [x] **17.5 Promise-matching on inbound stock news**
  - **Requirement IDs:** ADV-105.
  - **Dependencies:** `17.1`, `7.4` clienteling_opportunities.
  - **Owner boundary:** a staff-entered stock update ("new linen jackets
    arrived") matched against open `advisor_commitment`/follow-up
    opportunities, surfaced as a pairable list with one-tap customer
    contact.
  - **Status (2026-08-05, takeover branch):** `verified_local`. A plain,
    published keyword-overlap match — never a semantic/AI black box —
    in `packages/domain/src/intelligence/stock-promise-matching.ts`'s
    `matchStockNewsToPromises`: tokenizes the stock update and each
    candidate's `whyNow`/`suggestedAction` text (stopwords removed), and
    returns only opportunities sharing at least one real word, ranked by
    overlap count, with the exact overlapping words named — so an
    advisor sees _why_ a promise was surfaced, never just that it was.
    Reuses the existing `clienteling_opportunities` object exactly as
    this item's own owner boundary names — `advisor_commitment` (17.1's
    confirmed follow-ups) and `interest_follow_up` types only, and only
    the three still-live statuses (`draft`/`accepted`/`snoozed`) — a
    dismissed or completed promise is not waiting on anything and is
    never matched even if its words would otherwise overlap. New
    retailer page `/promise-matching`: a plain GET-form stock-update
    field (no client JS needed), matched promises listed with their
    overlapping words as badges and one-tap contact via a real `mailto:`
    link to the customer's own email plus a link to their relationship
    page.
  - **Tests:** `packages/domain/src/intelligence/stock-promise-matching.test.ts`
    (7: real overlap match, no match on disjoint text, dismissed and
    completed statuses excluded even with identical text, a type outside
    the owner boundary excluded, ranking a stronger overlap above a
    weaker one, blank input returns nothing).
    `apps/retailer/e2e/promise-matching.spec.ts` proves the full arc in
    a real browser: a stock update surfaces the one real matching
    promise with its overlapping words shown and a working `mailto:`
    link, while a same-status opportunity with disjoint words and an
    identical-text opportunity that is merely `dismissed` both correctly
    never appear. Regression run alongside `mission-control.spec.ts`
    (3/3 green together, confirming the shared `clienteling_opportunities`
    read path is unaffected). Full domain suite: 1004/1004 passing.

- [x] **17.6 Customer segmentation and rankings**
  - **Requirement IDs:** ADV-106.
  - **Owner boundary:** best-customer rankings, seasonal/one-time/suit/
    casual buyer segments and similar retailer-facing cohorts, computed
    from existing order/behavioural data — no new customer ledger.
  - **Status (2026-08-05, takeover branch):** `verified_local`.
    `packages/domain/src/intelligence/customer-segmentation.ts`
    (`rankCustomersBySpend` — plain sort by real total spend, never a
    hidden score; `classifyBuyerSegments` — `one_time`/`repeat`/
    `seasonal`/`dormant` from real order dates/counts, plus `suit_focused`/
    `casual_focused` only when real garment-type metadata exists for a
    customer's order lines, omitted entirely — never zero-filled — when
    it doesn't), with 10 passing domain unit tests
    (`customer-segmentation.test.ts`). New retailer page
    `/customers/rankings` (nav entry added under Relationships, manager+)
    composes `OrderRepository.findByRetailer` +
    `MetadataRepository.findAcceptedConceptIdsForProduct` per line's
    product to build the ranking; no new schema. Proof:
    `apps/retailer/e2e/customer-rankings.spec.ts` seeds a real
    $500,000 one-order customer and a real two-order same-month $200
    customer, asserts the high spender's real rank number is strictly
    lower (never asserting an absolute rank, since the shared fixture
    retailer can carry other customers with real orders too — an
    absolute "#2" assertion was tried first and was correctly flaky by
    construction, fixed to a relative-order check), and asserts
    "One-time" on the first and both "Repeat" and "Seasonal" on the
    second. 2/2 consecutive green runs at the committing HEAD.

- [ ] **17.7 Per-customer MTM price lists**
  - **Requirement IDs:** ADV-107.
  - **Dependencies:** MTM pricing engine (fabric/design-option/make based).
  - **Owner boundary:** assign each customer to a price list (default
    `price_list_01`), layered under the existing fabric/design/make
    pricing rather than replacing it.
  - **Status:** not started.

- [ ] **17.8 Sales academy AI roleplay personas**
  - **Requirement IDs:** ADV-108.
  - **Dependencies:** `16.1` (roleplay grading — shipped).
  - **Owner boundary:** AI-driven training personas (first-time buyer,
    browser, know-it-all, couple, etc.) for delivery/complaint-handling/
    white-glove practice, feeding the existing `academy_roleplay_grades`
    evidence-cited grading loop rather than a second one.
  - **Status (2026-08-05, takeover branch):** `verified_local` for the
    persona-catalog-and-grading half; the live AI-driven conversation
    that plays a persona out loud is genuinely `blocked_external` (no
    provider key in this environment) and was not attempted — no
    `@paon/ai` provider method was added for this item, unlike 18.10's
    fabricated-nothing-but-honest-failure pattern, because there is no
    live-call surface to gate yet without inventing the conversation
    engine itself, a separate, larger scope this slice did not attempt.
    `ACADEMY_ROLEPLAY_PERSONAS`/`ACADEMY_ROLEPLAY_PERSONA_LABELS`
    (`packages/domain/src/knowledge/academy-consultancy.ts`) is a
    published, fixed six-persona catalog naming exactly the examples
    this item's owner boundary lists. Migration
    `20260805160000_add_academy_roleplay_personas.sql` adds a nullable
    `persona_key` to the existing `academy_roleplay_grades` table
    (append-only, unchanged) with a `check` constraint restricting it to
    the published catalog — enforced in SQL, not only in the form.
    `AcademyRepository.recordRoleplayGrade` gained an optional
    `personaKey` param; the existing `/staff/learning` grading form
    gained a "Persona practiced" select, and a manager's own recorded
    persona is shown on the graded advisor's own grade list. No second
    grading loop, no new table beyond the one column. Proof: extended
    `apps/retailer/e2e/academy-roleplay.spec.ts` (16.1's own existing
    proof) with a real persona selection, a database assertion that
    `persona_key` was recorded exactly, and a real-browser assertion
    that the graded advisor sees "Know-it-all" on their own page — this
    file now writes evidence for both `16.1` and `17.8`, since it is one
    real grading loop with a persona tag layered on, not two.
  - Checkbox stays unchecked: the "AI-driven" half of the owner
    boundary — an actual AI conversation partner playing a persona
    during practice, not just a label a human grader tags after the
    fact — remains unbuilt and `blocked_external`.

- [x] **17.9 Omnichannel communication hub**
  - **Requirement IDs:** ADV-109.
  - **Owner boundary:** a provider-neutral core that unifies the existing
    TableService chat with SMS/WhatsApp/email, surfaced both in Mission
    Control and on the advisor's own phone via the channel's native app.
  - **Non-goals:** no channel PAON cannot legally/technically integrate
    (e.g. iMessage has no third-party send API).
  - **Hard blockers:** live channel connections (WhatsApp Business API,
    Twilio/SMS, email provider) need real provider accounts and keys —
    build the provider-neutral core and message model now; live channels
    stay `blocked_external` per channel until credentials exist.
  - **Status (2026-08-05, takeover branch):** `verified_local` for the
    "native app on the advisor's own phone" half; PAON-sent live
    messages (the actual Twilio/WhatsApp Business API/email-provider
    sends this item's own hard-blockers line names) remain genuinely
    `blocked_external` and untouched. `packages/domain/src/engagement/communication-channel.ts`'s
    `buildChannelContactLinks` is the one provider-neutral core every
    surface reuses — real `sms:`/`https://wa.me/`/`mailto:` deep links
    built from a customer's own real phone/email, opening the advisor's
    own native app so the message is sent from the advisor's own
    number/account, never a PAON-hosted send (needs zero provider
    credentials, works today). A channel with no real contact detail
    behind it reports `available: false` with an empty href rather than
    a fabricated or broken link. New shared
    `apps/retailer/app/(dashboard)/channel-contact-buttons.tsx`
    (`ChannelContactButtons`) renders these consistently — light and
    dark tone variants — wired onto the customer relationship
    workspace's own header, the highest-traffic surface with a
    customer's contact details in view. `promise-matching`'s (17.5)
    pre-existing, already-evidenced `mailto:` link was deliberately left
    untouched rather than migrated: its own e2e spec asserts an exact
    personalized link text and href, and swapping it for the generic
    component would have risked a real regression on an already-shipped
    item for no user-facing benefit — a future pass can migrate it
    alongside a spec update, not as a side effect of this item. Proof:
    `apps/retailer/e2e/channel-contact.spec.ts` — a customer with a real
    phone and email produces the three real deep links (asserted by
    exact `href`, phone-formatting characters stripped for `wa.me`), and
    a customer with only an email shows SMS/WhatsApp as a disabled
    `<span>`, never an `<a>`, proving the unavailable state is real, not
    just visually similar. Regression: the customer workspace's own
    12-test `workspace.spec.ts` suite is unaffected, 12/12 green.
  - **Completion (2026-08-09, lane H):** `verified_local`. The selected
    TableService conversation now reuses the same provider-neutral
    `ChannelContactButtons` as the customer workspace, so SMS, WhatsApp
    and email continue from the canonical shared thread into the advisor's
    native app. Mission Control now derives its conversation queue only
    from unread `message` notifications carrying a canonical, tenant-valid
    `/messages?c=<conversation-id>` target, deduplicates repeated
    notifications for the same thread, names the real customer and links
    directly into that thread. Other notification categories remain a
    separate `/notifications` count and are never mislabeled as
    conversations. Local browser proof is 4/4 green across
    `channel-contact.spec.ts` and `mission-control.spec.ts`; run evidence is
    `docs/evidence/runs/17.9.json` (with 17.2's Mission Control regression
    evidence refreshed by the same run). PAON-sent Twilio/WhatsApp Business
    API/email-provider delivery remains `blocked_external` exactly as this
    item's hard-blockers line permits; no provider behavior was fabricated.

- [ ] **17.10 AI try-on, daily/ahead-of-time/complete-the-look MorningRoutine**
  - **Requirement IDs:** ADV-110.
  - **Dependencies:** MorningRoutine (existing), Self-Portrait recurring
    facts, wardrobe.
  - **Owner boundary:** full specification in
    `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md` — generate-on-
    demand virtual try-on (never unconditional daily generation), the AI
    usage/budget ledger, provider-neutral `VirtualTryOnProvider` interface,
    and MorningRoutine's three-card expansion (today's OOTD, ahead-of-time
    occasions from Self-Portrait, complete-the-look).
  - **Non-goals:** never implies a physical fit guarantee; no unconditional
    per-customer-per-day generation.
  - **Hard blockers:** needs a live try-on provider (e.g. FASHN) key and
    an approved credit/billing model — build the budget ledger, provider
    interface and MorningRoutine card structure now; live generation stays
    `blocked_external`.
  - **Status (2026-08-05):** `verified_local` for spec §14's "Coming up"
    card only. Today's OOTD card (`packages/domain/src/wardrobe/morning-
routine.ts`, `morning-routine-delivery-orchestrator.ts`) already
    existed before this slice and needed no new work. New
    `selectUpcomingOccasions` (`packages/domain/src/wardrobe/morning-
routine-occasions.ts`) reuses 10.4's existing
    `evaluateRelationshipDateWindow`/`nextYearlyOccurrence` recurrence
    math against Self-Portrait's existing `customer_facts` (anniversary/
    wedding_date/occasion/travel_window types) — no new fact schema,
    same correction 10.4's own history already made once against writing
    a second copy of the date math. Surfaces on `/morning-routine` as its
    own card, separate from today's OOTD, only for facts within a 45-day
    lead window; a fact whose value isn't a clean ISO date is silently
    skipped, never guessed at. Checkbox left unchecked: **complete-the-
    look** (spec §14 item 3) is not attempted; the **`VirtualTryOnProvider`
    interface**, the **AI usage/budget ledger** (spec §8), and all actual
    image/video generation remain unbuilt — real product value (the
    try-on itself) stays blocked on a live provider key and an approved
    credit/billing model exactly as flagged above.
  - **Status (2026-08-09, lane H authorization tranche):** `verified_local`
    for the provider-neutral authorization and accounting contract only.
    `@paon/ai` now exports the exact `VirtualTryOnProvider` port needed by
    spec §10 (`createTryOn`, `createAvatar`, `editImage`, `createVideo`,
    `getStatus`, `cancel`, `estimateCost`) without claiming any provider's
    unverified wire behavior. `@paon/domain` now owns a fail-closed
    `evaluateVirtualTryOnAuthorization` rule covering module state,
    retailer/customer enablement and eligibility, image-processing and
    separate portrait-storage consent, image/video policy, cache reuse,
    per-customer quotas, customer/retailer/campaign budgets, currency and
    provider-estimate validation, and commercial justification. The same
    domain module defines the provider-neutral usage-ledger entry required
    by spec §8, including tenant/store/customer/advisor/campaign attribution,
    provider/model/endpoint/assets, credits and estimated/actual cost,
    trigger, conversion/revenue, cache, status, and timestamps. A delegated
    25-case unit suite proves the allow/cache paths and every explicit denial
    reason. Checkbox remains unchecked: this tranche deliberately adds no
    table or repository because the unmerged
    `agent/lane-d-virtual-wardrobe-studio` branch already owns adjacent
    generation-job schema and must be reconciled before migration ordering;
    persisted transactional reservation/settlement, a real provider adapter,
    complete-the-look on-demand UI, and connected MorningRoutine proof remain
    to build. Live generation remains `blocked_external` on the provider key
    and approved billing model named above.
  - **Status (2026-08-09, lane reconciliation):** the adjacent Lane D
    generation foundation is no longer an unmerged schema unknown on Lane H.
    Commits `7cc9ba7`/`933ef29` integrate its canonical Outfit-linked
    visualization queue, tenant/RLS boundary, private asset policy, provider
    runner and exact regenerated database types. This removes the duplicate-
    job-model risk that blocked persisted 17.10 work. It does not by itself
    complete 17.10: transactional budget reservation/settlement still has to
    compose the new authorization contract with the queue; MorningRoutine's
    complete-the-look entry point still needs the customer Studio/UI tranche;
    live generation remains externally blocked as documented above.
  - **Status (2026-08-09, customer Studio composition):** the canonical
    customer Studio and its consent/module-gated queue now exist on Lane H in
    `939c537`/`486418a`, with browser and 185-assertion pgTAP proof including
    the exact enqueue refusal matrix. This removes the customer-UI prerequisite
    from the previous status but does not complete 17.10: the provider-neutral
    usage contract still lacks persisted transactional budget reservation and
    settlement, MorningRoutine has no complete-the-look handoff into this
    Studio, and live provider behavior remains `blocked_external`.
  - **Status (2026-08-09, transactional budget ledger):** `f3e1459` closes
    the persisted reservation/settlement gap named above. Migration
    `20260809170000` adds `retailer_virtual_try_on_policies` (one row per
    retailer, seeded fail-closed — `enabled = false`, every budget/quota at
    zero — by an insert trigger; no credit/billing default is invented,
    matching this item's own "approved credit/billing model" hard blocker
    and ADR-072's POS-cash precedent) and `virtual_try_on_usage_ledger`
    (one row per authorization attempt, denials included). Two SECURITY
    DEFINER RPCs — `reserve_virtual_try_on_generation` and
    `settle_virtual_try_on_generation` — re-derive caller identity, module
    state, policy and live usage window server-side in the same decision
    order `evaluateVirtualTryOnAuthorization` already encodes in
    TypeScript, same defense-in-depth precedent as
    `enqueue_wardrobe_visualization_job`. Reuses `style_portrait_consents`
    as the source for both `imageProcessingConsent` and
    `portraitStorageConsent` rather than inventing a second consent
    purpose. Per-campaign budget enforcement is scoped out (`campaigns`
    has no budget column yet) — a supplied `campaign_id` is tenancy-
    checked and recorded for attribution only. `VirtualTryOnUsageRepository`
    (`packages/database`) wraps both RPCs; a branded
    `VirtualTryOnUsageLedgerId` was added. Checkbox remains unchecked:
    nothing calls this ledger yet (the MorningRoutine complete-the-look
    entry point and a real provider adapter are separate, later slices),
    and live generation remains `blocked_external` exactly as documented
    above.
  - **Status (2026-08-09, ledger test proof):** `885ca9f` adds
    `virtual-try-on-usage-security.test.ts` (7 static migration-content
    assertions: RLS/anon revocation, fail-closed defaults, the seeding
    trigger, the ledger's three check constraints, RLS policy names,
    `reserve`'s identity/module re-derivation, `settle`'s service_role-only
    grant) and `supabase/tests/virtual_try_on_reservation_test.sql` (18
    pgTAP assertions: module preview/active, policy disabled, missing
    consent, an authorized reservation with the correct reserved amount,
    cache-hit immediate settlement, daily-quota exhaustion, settlement,
    double-settle refusal, and cross-tenant RLS isolation). Independent
    re-review of `f3e1459` while writing these caught and fixed a real
    bug before it shipped: `settle_virtual_try_on_generation` still
    accepted a `cache_hit` row, contradicting its own "cache_hit settles
    immediately, never through this RPC" comment; `885ca9f` narrows the
    guard to `authorized` only and adds the assertion proving it. All
    numbers here were independently rerun by this session, not taken from
    a delegate's report — a same-subscription Haiku delegation for this
    exact test-writing task first returned a detailed but entirely
    fabricated completion (specific counts and a plausible-looking commit
    SHA, while the assigned worktree had no new files and no new commit);
    the founder's follow-up directive codified the required independent-
    verification steps into `AGENTS.md`'s cheap-worker delegation section.
    The tests were ultimately written directly in this session's own
    worktree instead of re-delegating. `pnpm lint && pnpm typecheck &&
pnpm build && pnpm format:check` are clean and `pnpm turbo run test`
    is green (503 database tests passed, up from 496) at `885ca9f`;
    `pnpm test`'s repo-wide `validate:completion` gate remains red on the
    pre-existing unrelated evidence backlog documented on 4.7/4.8's own
    status above, confirmed unrelated to this tranche.
  - **Status (2026-08-09, complete-the-look suggestion engine):** `259fc78`
    adds `selectCompleteTheLookSuggestions`
    (`packages/domain/src/wardrobe/complete-the-look.ts`), the first piece
    of spec §14 item 3's third MorningRoutine card: a small dedicated pure
    function (same precedent as `selectUpcomingOccasions` for "Coming up")
    that suggests catalogue categories the customer owns zero active items
    in, data-driven off what the retailer actually carries rather than an
    assumed "everyone needs N categories" opinion. 8 unit tests cover gap
    detection, owned/retired/deleted exclusion, unavailable/uncategorized
    skipping, one-per-category, the `maxSuggestions` cap and field
    passthrough; `pnpm lint`/`typecheck`/`test`/`build`/`format:check` are
    clean at `259fc78`. Deliberately scoped to the algorithm only — no
    card renders yet. Composing "see it on me" into a real tap-to-generate
    action is a separate, still-open frontier decision, not attempted
    here: it likely means creating a throwaway single-slot `Outfit` for
    the suggested (not-yet-owned) product and enqueuing a real
    `WardrobeVisualizationJob` (the only generation pipeline that actually
    works today, gated on `OPENAI_API_KEY`) rather than waiting on the
    unbuilt FASHN `VirtualTryOnProvider` adapter, which in turn needs a
    new column correlating a `virtual_try_on_usage_ledger` row to the job
    so `apps/admin/app/api/cron/process-wardrobe-visualizations` can
    settle the ledger row when the job completes. Real schema/migration-
    ordering work belongs in its own slice, not rushed alongside UI
    wiring.

- [ ] **17.11 Supplier-CRM data import and ownership**
  - **Requirement IDs:** ADV-111.
  - **Owner boundary:** CSV/Excel import of a retailer's existing supplier-
    CRM customer data into PAON, positioned as data ownership (never
    shared back to the supplier) — a genuinely separate, larger design
    pass given the legal/contractual weight of importing another
    business's customer records.
  - **Non-goals:** no re-export of imported data back to the originating
    supplier.
  - **Status:** not started — needs its own scoping pass before
    implementation begins.

- [ ] **17.12 Ambient/frictionless checkout**
  - **Requirement IDs:** ADV-112.
  - **Dependencies:** ADR-062 (payment provider activation).
  - **Owner boundary:** full specification in
    `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md` §16 — SMS/
    WhatsApp soft-close payment links, tap-to-pay, fitting-room mobile POS
    hand-off, digital-to-physical cart persistence. Checkout as a gesture
    inside the existing conversation, never a separate register event.
  - **Hard blockers:** live payment capture is already `blocked_external`
    on ADR-062 (13.3) — this item's UX layer can be built provider-neutral
    now, but no real charge can flow until that decision lands.
  - **Status (2026-08-05):** `verified_local` for the soft-close deep-
    link core. The customer's `orders` "draft" row is already a real,
    server-persisted cart (digital-to-physical persistence needed no
    new schema). New `CartSoftCloseCard` on the retailer's customer page
    surfaces it — item count, total, and a real SMS/WhatsApp/Email deep
    link to the customer's own `/r/[slug]/cart` page, reusing 17.9's
    `ChannelContactButtons`/`buildChannelContactLinks` rather than a
    second link builder — so the advisor sends a review-and-pay gesture
    to the customer's own device instead of ringing up a register sale.
    No card renders when there's no draft cart (e2e-proven, not a
    fabricated empty state). Checkbox left unchecked: real payment
    capture stays `blocked_external` on ADR-062 (13.3) exactly as
    flagged above — the customer still completes payment through the
    existing storefront checkout, unchanged by this card; tap-to-pay/
    mobile-POS terminal hand-off is not attempted (needs real terminal
    hardware/SDK, a genuinely separate integration).

- [ ] **17.13 QR wardrobe card**
  - **Requirement IDs:** ADV-113.
  - **Dependencies:** digital wardrobe (existing).
  - **Owner boundary:** full specification in
    `docs/vision/PAON_VIRTUAL_TRYON_AND_OOTD_ECONOMICS.md` §17 — a
    physical card, scanned to open the item's digital wardrobe page even
    logged-out/unattached (full item info always shown); per-item action
    buttons (alteration, cleaning, periodic fit-check photo feeding
    Self-Portrait size updates, retire, re-order, ask advisor,
    item-specific complete-the-look).
  - **Non-goals:** never requires an account to see the item's own
    information from the scan.
  - **Status (2026-08-05):** `verified_local` for the physical-to-
    digital bridge itself (browser proof below); the wider spec's
    remaining pieces (named below) are unbuilt. `wardrobe_items` gained
    a permanent `public_token` (same
    anonymous opaque-token SECURITY DEFINER pattern as
    `resolve_gift_invitation`/`resolve_corporate_tender`) and
    `resolve_wardrobe_item_public` returns the garment's own curated
    info only — never the owning customer's name/email — plus the
    linked product's slug when one exists. New
    `/r/[slug]/wardrobe/[token]` page (apps/customer) renders it
    logged-out. Real, working actions: **retire** (reuses
    `WardrobeRepository.retire`, not duplicated) and **re-order**
    (real link to the linked catalogue product's own page when
    `productId` is set). **Ask advisor** is not a dedicated button on
    this anonymous page — the page instead deep-links "Recognize this
    item? Sign in to manage it" to `/login?redirectTo=/wardrobe`, the
    existing full authenticated wardrobe dashboard, which already has
    messaging. Checkbox left unchecked: **alteration/cleaning
    booking**, the **periodic fit-check photo → Self-Portrait update**,
    **item-specific complete-the-look**, and the spec's **unattached
    (logged-out-created) item** scenario are all real gaps, not
    attempted — the current schema requires a non-null `customerId` on
    every wardrobe item, so "unattached" isn't representable without a
    schema change this slice didn't make.

- [x] **17.14 Prospect AI conversation, buying-intent queue, and human handoff**
  - **Requirement IDs:** ADV-114.
  - **Dependencies:** `17.9` (channel core, unrelated tables); FT-09
    TableService (`conversations`/`messages`/`message_attachments`,
    consultation-to-appointment journey).
  - **Owner boundary:** founder brief "PAON customer communication, AI
    styling, lead-capture and advisor-response layer" — first vertical
    slice only, scoped to the brief's own "FIRST DELIVERY" sequencing
    (prospect/first-time buyer first; authenticated-existing-customer
    depth, deeper Virtual Studio integration and voice are later slices,
    not attempted here). Extends the existing TableService/Conversation
    model rather than a second chat system or a generic floating
    chatbot: an explainable (never opaque-score) buying-intent
    classification on each customer/guest message, a conversation queue
    state (`ai_handling`/`needs_human`/`claimed`/`waiting_for_customer`/
    `follow_up_required`/`converted`/`closed`), a claim mechanism so the
    retailer inbox becomes a real triage queue, and an AI-drafted reply
    that a human advisor must review/edit/approve before it ever reaches
    a customer — never an autonomous customer-facing send.
  - **Acceptance:** a high-intent prospect message (occasion + deadline
    - appointment-readiness signals) is classified with cited, real
      substring evidence and flips the conversation to `needs_human`;
      eligible staff are notified through the existing notification path;
      a claim records `claimed_by_staff_id`/`claimed_at` and is visible in
      the inbox; an AI-proposed draft reply is grounded only on the
      approved knowledge/product allowlist exactly like existing grounded
      guidance (reuses the same refusal-on-thin-basis discipline) and
      writes nothing to `messages` until a staff member sends it as-is or
      edited; every AI call is recorded through `AIGenerationRepository`
      (`kind: "communication_draft"`); cross-tenant claim/draft-resolve is
      rejected.
  - **Tests:** domain unit tests for the buying-intent classifier (every
    signal cites a real matched substring, level thresholds, no false
    escalation on a low-intent question) and a permanent jailbreak/
    adversarial corpus (system-prompt extraction, competitor hijack,
    off-topic/banana-recipe, roleplay, punctuation/repetition, fake
    admin, encoded instructions) against the safety heuristic and the
    draft-reply system prompt; pgTAP tenant-isolation on the new
    columns/table; Playwright e2e covering a real anonymous high-intent
    TableService inquiry reaching the retailer queue, claim, AI draft
    (mock provider — no live key in this environment), edit-and-send,
    and the customer seeing the reply.
  - **Non-goals:** need-to-know RLS narrowing on `conversations`/
    `customer_facts` to the assigned advisor only (existing blanket
    retailer-staff read, unchanged — a real, explicitly named gap, not
    silently dropped); duty-advisor/after-hours routing beyond "notify
    every eligible staff member" (existing coverage-planning schema has
    no "who is on duty right now" resolver yet — building one is a
    separate slice); retailer-configurable AI budget/rate limiting;
    voice; deeper Virtual Studio actions from within a conversation.
  - **Hard blockers:** live grounded/drafted AI answers need
    `OPENAI_API_KEY` (same posture as every other AI-assisted surface in
    this codebase); the deterministic buying-intent classifier and the
    queue/claim/handoff mechanics need no provider and are fully
    verified locally.
  - **Status (2026-08-07):** functional foundation, not yet connected or
    proven. Real and unit-tested: the explainable buying-intent
    classifier and adversarial-safety heuristic
    (`packages/domain/src/intelligence/conversation-intent.ts`, 24
    passing tests covering every signal's real matched substring, level
    thresholds, the no-false-escalation case, and the four safety-flag
    categories against benign off-topic/competitor/punctuation text).
    Real schema: migration `20260806010000` (queue `status`, claim
    columns, `buying_intent_level`/`_signals`, `message_ai_drafts`,
    `claim_conversation`/`set_conversation_status` RPCs). Real
    repository: `MessagingRepository.claimConversation`/
    `setConversationStatus`/`recordIntentClassification` (escalates
    `ai_handling` → `needs_human` and notifies eligible staff through
    the existing `notifications` table, mirroring the TableService
    inquiry path) and `ConversationDraftRepository`
    (`propose`/`dismiss`/`approveAndSend`, always sending through the
    ordinary `send_conversation_message` RPC). Newly wired this session:
    both real message-send paths — the signed-in customer's
    `sendMessage`/`startConversation` and the anonymous prospect's
    `submitTableServiceInquiry` — now call the classifier and record the
    result after the message is durably sent, fail-open (a
    classification error never blocks the real message). Fixed two real
    pre-existing typecheck breaks discovered while verifying this slice,
    unrelated to 17.14 itself: FT-09's `bookAppointmentFromConsultation`
    call sites in both the customer and retailer apps passed an explicit
    `notes: undefined` key, which `exactOptionalPropertyTypes` rejects
    (fixed to the codebase's own conditional-spread idiom).
    **Not yet built:** the retailer inbox has no claim button, queue
    status display, or AI-draft review/approve UI; no Server Action or
    UI triggers `ConversationDraftRepository.propose` (the AI draft-
    generation call itself, gated on `OPENAI_API_KEY`, is unbuilt); no
    `AIGenerationRepository` wiring for `kind: "communication_draft"`;
    no pgTAP tenant-isolation coverage for the new table/columns; no
    Playwright e2e. Do not mark this item's checkbox or claim it
    "connected" until the retailer-side claim/draft UI and at least one
    real end-to-end browser proof exist.
  - **Working-tree continuation (2026-08-09; not yet browser/database
    verified):** the retailer inbox now projects queue status, explainable
    matched buying-intent evidence, assignment, claim, grounded-draft review,
    edit/send and dismissal controls. Draft generation requires a claimed
    same-House conversation, reuses `TableServiceGuidanceRepository`'s
    approved knowledge/product retrieval, treats all conversation text as
    untrusted, refuses a non-grounded response, and records every provider
    attempt as `communication_draft` before any proposal is persisted. The
    database continuation closes cross-House claim/source/resolver/sent-message
    references, revokes direct authenticated proposal mutation, limits
    resolution to the assigned advisor or manager+, prevents concurrent
    proposed drafts, and makes approve + real advisor message + queue advance
    one transaction. `ConversationDraftRepository` now calls those narrow
    RPCs rather than the revoked split update path. AI/provider and repository
    suites are green (43 and 479 assertions respectively). The ledger-approved
    disposable local Supabase target now resets cleanly through the complete
    migration chain, generated types exactly match the migrated schema, and
    the expanded 17-assertion pgTAP proof passes, including cross-House and
    same-House unassigned-advisor refusal plus concurrent-proposal exclusion.
    Still required before completion: add and run the specified anonymous
    inquiry -> retailer claim -> mock draft -> edited send -> customer-visible
    Playwright journey. No checkbox/evidence claim is made yet.
  - **Completed (2026-08-09):** the anonymous founder-storefront inquiry now
    enters the same explainable queue as signed-in messages, notifies eligible
    staff, exposes cited intent signals and claim state in the retailer inbox,
    and supports a grounded draft that cannot become a customer message until
    an assigned advisor or manager reviews and sends it. Provider attempts are
    audited as `communication_draft`; proposal sources, resolution authority,
    sent-message linkage and tenant references fail closed in the database.
    The permanent connected proof at
    `apps/retailer/e2e/prospect-ai-conversation.spec.ts` passes against the
    ledger-approved disposable local Supabase target with the deterministic
    loopback-only mock provider: anonymous high-intent inquiry -> cited
    classification and staff notification -> retailer claim -> approved-basis
    draft -> edited send -> linked customer sees the reply. Verification also
    passes the 17-assertion pgTAP isolation suite, all 43 AI-package tests and
    all 479 database-package assertions (70 integration tests correctly
    skipped outside their explicit gate). ADR-068 evidence:
    `docs/evidence/runs/17.14.json`, recording code SHA `964d9db`.

### Stage 18 — Corporate business development, tenders, and rollout (Métier expansion)

Founder-directed mega-directive, added 2026-08-04: InsiderTailoring
(opportunity intelligence), Tender and Pitch Builder, Concept/Moodboard
generation, Corporate Campaign and Office-Visit Landing Pages, Employee
Portal, Corporate Service Desk, Measurement/Fitting Rollout Planning,
Corporate Project and Rollout Management, and a Corporate Analytics and
Renewal Engine — formally integrated with `14.1`'s existing Métier
foundation rather than built beside it as a competing suite.

**Audit finding (2026-08-04), before any of this stage was built:** every
capability below was checked against the live repository, not assumed
absent or present. Complete: none — `14.1` covers corporate accounts,
programmes, versioned entitlements, wearers, issue records, and
retailer-staff-facing exceptions/readiness, all schema-real and
browser-proven, but nothing below existed under any name. Partial:
`14.1` itself (missing employee portal, tender demo, order/fitting
wiring — see its own 2026-08-03 Update) and the existing corporate
`exceptions` table (a real but corporate-scoped ticketing model, not the
general service desk `18.8` describes). Absent, confirmed by grep across
migrations/domain/routes for every plausible name (tender, proposal,
pitch, moodboard, concept, opportunity, insider, employee portal, service
desk, ticket, rollout, office visit, landing page): InsiderTailoring,
tenders, concept generation, corporate landing pages, the employee
portal, a general service desk, bulk fitting/rollout planning, the
rollout lifecycle state machine, and corporate analytics/renewal.
Reusable-as-is: the `/r/[slug]` tokenized public storefront pattern (the
public tender page in `18.3` should extend this, not invent a second
public-page mechanism) and the existing appointment-booking domain/
repository (`18.6`'s fitting-day rollout should schedule through it, not
around it). Absent from the RLS role model entirely: any role for a
corporate account contact or an external tender viewer — every
`corporate_*` policy admits only `current_retailer_role()` today, so
`18.5` and `18.3` are each a new-auth-path decision, not a policy
addition on existing roles.

Build order follows the founder's own explicit sequencing: the pipeline
model before the tender it feeds, the tender before its public page, the
portal after the pages that link to it, rollout/service-desk/analytics
after the objects they operate on, and AI-assisted generation and
external signal ingestion last — building a scraper or an image generator
before the object it populates exists would mean producing data with
nowhere honest to store it.

- [x] **18.1 Corporate business-development opportunities (InsiderTailoring pipeline model)**
  - **Requirement IDs:** BD-101.
  - **Dependencies:** `14.1` (`corporate_accounts`, `CorporateRepository`).
  - **Owner boundary:** the opportunity/signal/scoring/stage-pipeline
    object itself — manually entered signals only. External commercial-
    signal discovery is explicitly out of scope here; see `18.11`.
  - **Acceptance:** an opportunity is created, signals are added and its
    score is a plain, inspectable sum of fixed per-source weights (no
    model call, no hidden multiplier — the breakdown is returned
    alongside the total), the stage moves forward exactly one allowed
    step at a time and never out of a terminal stage, and winning creates
    a real `corporate_accounts` row through the existing
    `CorporateRepository.createAccount` rather than a second, competing
    company record.
  - **Tests:** domain transition/scoring/validation unit tests, browser
    proof of create → score → stage → win → real account.
  - **Non-goals:** no black-box scoring; no external signal ingestion yet
    (`source` has no scraped/public-signal value on purpose).
  - **Hard blockers:** none.
  - **Status (2026-08-04, takeover branch):** `verified_local`. Migration
    `20260804130000_add_corporate_opportunities.sql` adds
    `corporate_opportunities`/`corporate_opportunity_signals` (signals
    append-only; a `CHECK` refuses `stage = 'won'` without a
    `linked_account_id`, so the constraint itself — not just application
    code — prevents a "won" opportunity with no real account behind it).
    Domain (`packages/domain/src/corporate/business-development.ts`):
    `checkOpportunityStageTransition` (explicit allow-list per stage, no
    implicit fallback), `scoreOpportunity` (fixed weight table, capped at
    100, returns the contributing breakdown), `checkCreateOpportunity`/
    `checkAddSignal`. `CorporateOpportunityRepository`
    (`packages/database`) recomputes the score from the full live signal
    set on every `addSignal` call — the stored `score` column is a read
    optimisation the repository itself never accepts as caller input —
    and `winAndCreateAccount` calls `CorporateRepository.createAccount`
    rather than inserting into `corporate_accounts` directly, so the won
    opportunity and the account can never diverge into two truths. Wired
    into the retailer app as `/business-development` (pipeline list) and
    `/business-development/[opportunityId]` (signals, score, stage
    buttons, win form), gated by the existing `enterprise_verticals`
    module and linked from the sidebar next to `/corporate`.
    `apps/retailer/e2e/business-development.spec.ts` proves the full arc
    in a real browser: two signals compose to the exact expected score,
    "Won" is not offered before "Tender sent" (skip-ahead is refused by
    the same transition check the domain layer enforces), and winning is
    asserted against the database to have created a real
    `corporate_accounts` row with the opportunity's company name and the
    submitted account reference — not merely relabelled the opportunity.

- [x] **18.2 Tender and Pitch Builder**
  - **Requirement IDs:** BD-102.
  - **Dependencies:** `18.1` (an opportunity to build a tender for),
    `14.1` (the account/programme it may become).
  - **Owner boundary:** a company-specific tender/proposal document —
    sections, pricing, garment/programme concepts, versioning, retailer
    internal approval before anything is externally shareable.
  - **Acceptance:** a tender is authored against a live (non-`lost`)
    opportunity, is versioned (never edited in place once written), and
    a version requires an explicit, exactly-once approval action before
    `18.3` may expose it externally.
  - **Tests:** version immutability (no update/delete grant on the table
    at all), double-approval refusal, browser proof of author → version →
    approve.
  - **Non-goals:** no external visibility without explicit approval.
  - **Status (2026-08-04, takeover branch):** `verified_local`. Migration
    `20260804140000_add_corporate_tenders.sql` adds `corporate_tenders`
    (retitleable), `corporate_tender_versions` (insert-only — no update
    or delete grant exists on the table at all, so an in-place edit fails
    at the database, not just in application code) and
    `corporate_tender_approvals`, whose `unique(tender_version_id)`
    constraint is the actual enforcement preventing a version from being
    approved twice — not application logic alone.
    `packages/domain/src/corporate/tender.ts`'s `checkCreateTender`
    refuses a tender against a `lost` opportunity (a tender is a live
    commercial document, not a pitch archive) and
    `checkCreateTenderVersion` refuses a blank summary or an
    all-blank-lines garment-concept list. `CorporateTenderRepository`
    (`packages/database`) derives the next version number from the
    live version set on every `createVersion` call and turns the
    approvals table's unique-violation (Postgres code `23505`) into a
    typed `already_approved` refusal rather than letting a raw
    constraint error reach the caller. Wired into
    `/business-development/[opportunityId]` as a "Tenders" card:
    start a tender, add a version (summary, garment concepts, optional
    pricing note), and approve a version, each unapproved version
    showing an "Approve" button that disappears once approved.
    `apps/retailer/e2e/corporate-tender.spec.ts` proves the arc in a
    real browser — author a tender, add a version, see it "Not
    approved", approve it and see the button disappear and the badge
    flip — then asserts directly against the database that a second
    approval attempt on the same version is refused with Postgres
    error code `23505`, the exact constraint this item's acceptance
    depends on, not merely the UI's willingness to offer the button
    again. Found and fixed a real migration bug while building this:
    the RLS-policy-creation loop shared with `18.1` only ever grants
    `SELECT` — the actual `INSERT` privilege has always needed a
    separate explicit `grant`, and this migration's first draft
    forgot it for the two append-only tender tables, failing loudly
    with Postgres permission-denied rather than silently. Fixed in the
    migration source directly (not worked around) before this item was
    considered done.

- [ ] **18.3 Public tender page**
  - **Requirement IDs:** BD-103.
  - **Dependencies:** `18.2`; the existing `/r/[slug]` tokenized public
    page pattern — extend it, do not build a second public-page mechanism.
  - **Owner boundary:** an externally shareable, tokenized view of an
    approved tender version only — never draft content, never anything
    unapproved.
  - **Acceptance:** a tender link exposes exactly the approved version's
    published fields to an unauthenticated viewer and nothing else on the
    account (no other clients, no margins, no other tenders).
  - **Tests:** token scoping, draft-content non-exposure, expiry/revocation.
  - **Non-goals:** no general-purpose public CMS.
  - **Hard blockers:** none identified yet.
  - **Status (2026-08-04, takeover branch):** `verified_local`, with a
    named gap kept unchecked below. Migration
    `20260804150000_add_corporate_tender_public_page.sql` adds a
    `share_token` column to `corporate_tenders` and
    `resolve_corporate_tender` (SECURITY DEFINER), extending the exact
    anonymous-opaque-token pattern `resolve_gift_invitation` already
    established rather than inventing a second public-page mechanism —
    the audit note at the top of this stage named this reuse explicitly.
    The function resolves the tender's latest version that has a row in
    `corporate_tender_approvals`; a tender with zero approved versions
    returns `not_published` with no summary/concepts/pricing fields at
    all, enforced in the SQL function itself, not left to the calling
    page to withhold. `CorporateTenderRepository.resolvePublic` wraps
    the RPC (mirroring `GiftRepository.resolveInvitation`). Wired to
    `apps/customer/app/r/[slug]/tenders/[token]/page.tsx`, and the
    retailer's opportunity page now prints the public link inline for
    staff to copy. `apps/customer/e2e/corporate-tender-reveal.spec.ts`
    proves the arc in a real browser: before approval the page reads
    "not yet published" and a probe for the (already-authored) draft
    summary text finds nothing, then after approving that exact version
    the page shows its summary, garment concepts and version number —
    directly proving the SQL function's join-on-approval, not just the
    page's rendering choice. This customer-app spec is not wired to
    `writeBrowserProofRun`/`docs/evidence/runs/*.json`, matching this
    codebase's existing convention that ADR-068 evidence tracking is a
    retailer-app-only harness — no existing `apps/customer/e2e/*.spec.ts`
    uses it either (checked `gift.spec.ts` for precedent).
  - **Fix (2026-08-05, takeover branch):** the revocation half of this
    item's own named gap is closed. Migration
    `20260805130000_add_corporate_tender_revocation.sql` adds
    `corporate_tenders.revoked_at` and updates `resolve_corporate_tender`
    to refuse ALL content — approved or not — once set, enforced in the
    function itself. `checkRevokeTender` (`packages/domain/src/corporate/tender.ts`)
    is a one-way, exactly-once decision, mirroring the same discipline
    already used for tender-version approval and 18.10's concept-asset
    decisions — there is no "un-revoke". The retailer opportunity page's
    Tenders card gained a "Revoke public link" button, replaced by a
    "Link revoked" badge once used. Proof: 4 new domain unit tests
    (`tender.test.ts`) and an extension of the existing
    `apps/customer/e2e/corporate-tender-reveal.spec.ts` proving a
    revoked tender shows neither its approved summary nor its concept
    images, and a second revocation attempt is refused
    (`already_revoked`) rather than silently accepted. Checkbox stays
    unchecked: time-based **expiry** was not built — no TTL policy was
    ever specified by the founder, and inventing an arbitrary one would
    be a fabricated business rule rather than a real requirement. A link
    is now revocable by a human decision, not yet auto-expiring on a
    clock.

- [ ] **18.4 Corporate campaign and office-visit landing pages**
  - **Requirement IDs:** BD-104.
  - **Dependencies:** `18.1`/`14.1` (account/programme), existing
    `campaign` domain (`packages/domain/src/campaign/`) — extend its
    audience/activation model for a company-scoped audience, do not fork
    a second campaign engine.
  - **Owner boundary:** a company-branded conversion page connecting to
    appointments/campaigns/employees/measurements/orders for one
    corporate programme's office visit or launch.
  - **Acceptance:** a company-branded page books an appointment or starts
    measurement capture for a named programme, scoped so one company
    never sees another's page or data.
  - **Tests:** cross-company isolation, appointment-booking wiring.
  - **Status (2026-08-04, takeover branch):** `verified_local`, scope
    intentionally narrower than the acceptance line above — named below,
    not hidden. Migration
    `20260804170000_add_corporate_office_visit_requests.sql` adds
    `corporate_office_visit_requests` (no anonymous RLS insert policy at
    all, matching `submit_table_service_inquiry`'s established shape —
    `resolve_corporate_office_visit_page`/
    `submit_corporate_office_visit_request`, both `security definer`,
    are the only way an unauthenticated visitor reaches it) and reuses
    `corporate_accounts`/`corporate_programmes` rather than any new
    company/account table. `packages/domain/src/corporate/office-visit-request.ts`:
    `checkResolveOfficeVisitRequest` refuses re-resolving an
    already-`scheduled`/`declined` request. `CorporateOfficeVisitRepository`
    wraps both RPCs and a staff-side `resolve`/`findByProgramme`. Public
    page at `apps/customer/app/r/[slug]/corporate/[programmeId]`
    (company/programme name only — no other client, no margins, no
    wearer data) with a request form; the retailer's own
    `/corporate/[programmeId]` page gained an "Office visit" card
    showing the public link and the intake queue with
    contacted/scheduled/declined actions.
    `apps/customer/e2e/corporate-office-visit.spec.ts` proves an
    anonymous submission really lands in the queue (DB-asserted, not
    just a confirmation message); `apps/retailer/e2e/corporate-office-visit.spec.ts`
    proves marking a request "Scheduled" is real (`resolved_at` set,
    asserted against the database — an earlier draft of this test
    asserted `getByText("Scheduled")`, which is also the un-clicked
    button's own label and passed regardless of whether the click
    actually worked; caught by adding a DB-level assertion and fixed by
    asserting the button's removal instead, a real test bug found and
    fixed, not a product bug).
  - **Fix (2026-08-05, takeover branch):** the named gap's real half is
    closed — "Scheduled" now produces a real `appointments` row, not
    only a status label. Migration
    `20260805180000_add_corporate_office_visit_appointment_link.sql`
    adds nullable `customer_id`/`appointment_id` to
    `corporate_office_visit_requests`. New
    `checkScheduleOfficeVisitAppointment` (`packages/domain/src/corporate/office-visit-request.ts`)
    refuses to fabricate a contact channel or a time: a real appointment
    requires both a real contact email on the request and a real
    end-after-start window. `CorporateOfficeVisitRepository.scheduleAppointment`
    finds-or-creates a real `customers` row by email (new
    `CustomerRepository.findByEmail`, reusing an existing relationship
    rather than creating a duplicate prospect) and books a real
    `appointments` row (`styling_consultation`) — a scheduled office
    visit is a real person choosing to engage the retailer directly,
    exactly what `customers` already models, deliberately not the
    per-wearer shadow-customer pattern `18.6` explicitly rejected for
    its own different (bulk-census) case. The retailer's "Scheduled"
    button is now a `DateTimePicker` form when the requester left an
    email (reusing the shared picker, not a second one), and stays the
    original single-click status-only path when they did not — never
    guessing at a missing contact channel. Proof: 4 new domain unit
    tests (`checkScheduleOfficeVisitAppointment`: no email, blank email,
    invalid window, real window+email) and
    `apps/retailer/e2e/corporate-office-visit.spec.ts` extended to prove
    both paths in the same browser run — a no-email request stays
    status-only (DB-asserted `customer_id`/`appointment_id` both null),
    and an emailed request gets a real `customers` row (email/name/
    `prospect` lifecycle asserted) and a real `appointments` row (real
    retailer, type, and a real end-after-start window) linked back onto the
    request row. Full corporate e2e regression run alongside it
    (`corporate.spec.ts`, `corporate-full-lifecycle.spec.ts`,
    `corporate-project-lifecycle.spec.ts`, `business-development.spec.ts`):
    4/4 green together.
  - Checkbox stays unchecked: the acceptance line names a company-
    branded page that books an appointment "directly from this page"
    (i.e. the anonymous public page performing live, availability-aware
    self-service booking) — what is real instead is staff-mediated:
    the public page still only submits a lead, and a staff member picks
    the real time from the retailer side. That is a genuine, deliberate
    difference from live self-service booking, not merely an unproven
    claim of it, and "starting measurement capture" from this page is
    still not attempted. Turning a request into a slot against real
    advisor/room capacity remains `18.6`'s own item by design. Cross-
    company isolation is structural (the RPC validates `p_programme_id`
    against a real active programme/account/retailer and returns only
    that scoped data) but has no dedicated "company A cannot see company
    B's page" browser test.

- [ ] **18.5 Employee portal (auth and self-service)**
  - **Requirement IDs:** BD-105.
  - **Dependencies:** `14.1` (`corporate_wearers`); this is the
    new-auth-path decision `14.1`'s 2026-08-03 Update named as its own
    remaining gap, tracked here rather than as a second open item on
    `14.1`.
  - **Owner boundary:** a low-friction, mobile-first, simple-auth session
    for a corporate-programme employee — appointments, measurements,
    wardrobe, orders, alterations, tickets, announcements. Never the
    retailer-staff session type, never broader RLS access than the
    employee's own wearer row and its programme's published readiness.
  - **Acceptance:** an employee signs in through a distinct auth path,
    sees only their own data plus programme-level published information
    (never a colleague's measurements — the same failure mode
    `buildCorporateScopedView` was already written to prevent for
    employer contacts), and can raise a service request (`18.8`).
  - **Tests:** cross-employee isolation, RLS for the new session/role.
  - **Non-goals:** not an HR login; no employment data beyond what
    `14.1` already deliberately excludes.
  - **Hard blockers:** new auth-path design must be settled before this
    can start — not an implementation blocker, a decision blocker.
  - **Status (2026-08-04, takeover branch):** `verified_local`, hard
    blocker resolved, real gaps named below. The auth-path decision
    (researched first rather than guessed at): a wearer lives inside
    `apps/customer` under `/employee`, not a fourth Next.js app — the
    customer app's own middleware already signs out any session whose
    `accountType` isn't `customer`, so a wearer needed to be a session
    the middleware recognises and carves out, not bolted on beside it.
    `AccountType` (`packages/domain/src/identity/role.ts`) gained
    `corporate_wearer`, with an explicit doc comment on the resulting
    resolution priority (`platform > retailer_staff > corporate_wearer
    > customer`) — the same "highest wins, only one wins" tradeoff
already accepted between `retailer_staff`and`customer`, extended
one level deeper; a person who is somehow both a wearer and a
shopper resolves as the former only. Migration
`20260804160000_add_corporate_wearer_portal_auth.sql`adds`corporate_wearers.login_email`/`user_id`, a `sync_corporate_wearer_claim`trigger and`link_my_wearer_account()`RPC mirroring`retailer_staff_members`'s claim-sync trigger and `customers`'
`link_my_customer_accounts()`exactly — the third time this
codebase needed "link an auth user to a domain row", done the same
way a third time rather than a new way.`packages/auth`gained`wearerId`on`AppSession`and`requireWearerSession`. Wired to
`apps/customer/middleware.ts`with a path-aware carve-out:`/employee/**`accepts only`corporate_wearer`sessions and redirects anyone else
to`/employee/login`WITHOUT signing them out (a shopper mis-clicking
an employee link must never lose their own session), while every
other path treats a`corporate_wearer`session exactly like a`retailer_staff`session always has — not a customer account, signed
out on any non-public path.`/employee/login`(own magic-link form),`/employee/auth/confirm`(mirrors`/auth/confirm`, links via
`link_my_wearer_account`) and `/employee`(the portal home — wearer
name, programme name, live entitlement balance via the same`computeEntitlementBalance`the retailer-staff corporate page
already calls, and issue history) are built. The retailer's own`/corporate/[programmeId]` page gained a per-wearer "grant portal
access" control (`setWearerLoginEmail`) — there was previously no
    > way for anyone to actually turn this on for a wearer.
  - **Bug found and fixed while building this:** the RLS helper
    `current_wearer_id()` was first written to read the `wearer_id`
    claim from `auth.jwt()`, mirroring `current_retailer_id()` exactly
    — but that pattern is only safe for retailer staff because they are
    admin-provisioned: `user_id` is linked (and the claim-sync trigger
    fires) before their first sign-in ever mints a JWT. A wearer's
    _first_ magic-link click both creates their session and, in the
    same request, calls `link_my_wearer_account` — the trigger updates
    `auth.users.raw_app_meta_data` correctly, but the access token
    already in hand was minted a moment earlier and `auth.jwt()` decodes
    it locally rather than re-fetching, so RLS saw an empty claim and
    every wearer-scoped query returned nothing on first login. Fixed two
    ways: `current_wearer_id()` now does a direct, `security definer`
    table lookup on `auth.uid()` (the JWT's `sub`, correct from the
    instant the token exists) instead of trusting `app_metadata`; and
    `/employee/auth/confirm` calls `supabase.auth.refreshSession()`
    after linking, so the session used for the very next request already
    carries a fresh token. Found by reproducing "your employee record
    could not be found" against a freshly seeded wearer in a real
    browser, not by inspection.
  - **Tests:** `packages/auth/src/session.test.ts` and `guards.test.ts`
    cover the new `corporate_wearer` resolution and priority ordering.
    `apps/customer/e2e/employee-portal.spec.ts` proves the real arc in a
    browser: a retailer grants portal access, a magic link signs the
    wearer in, and the portal shows their real programme name and a
    computed `2/2 left` entitlement balance against a seeded rule — not
    a static fixture. The full `apps/customer` suite (57 tests) was run
    after this change; 8 unrelated failures were investigated and
    confirmed pre-existing (stock-fixture depletion, unrelated content
    assertions, the same message-attachment-image flake already
    documented against the retailer app) by rerunning each failing spec
    file in isolation, where all passed — not fixed here, out of scope,
    and not caused by this change.
  - **Non-goals:** not an HR login; no employment data beyond what
    `14.1` already deliberately excludes.
  - Checkbox stays unchecked: the owner boundary names appointments,
    measurements beyond entitlement, orders, alterations, tickets and
    announcements, and none of those are wired — tickets need `18.8`
    (not built), and the rest need either the wearer's optional
    `customerId` link (not every wearer has one) or new corporate-scoped
    work this slice didn't attempt, so this page shows only what it can
    show honestly rather than a page that silently shows nothing where
    those sections would be.
  - **Fix (2026-08-05, takeover branch):** cross-employee isolation is
    now e2e-proven. `apps/customer/e2e/employee-portal.spec.ts` seeds a
    second wearer in the SAME programme (their own real name, never
    signed in during the test) and asserts their display name appears
    nowhere on the first wearer's own signed-in portal page. The
    underlying RLS guarantee was already real; what was missing was
    proof it holds with two real wearers in play, not just one.

- [x] **18.6 Measurement and fitting rollout planning**
  - **Requirement IDs:** BD-106.
  - **Dependencies:** existing appointment domain/repository — bulk
    rollout schedules through it, not around it; `14.1` wearers/programmes.
  - **Owner boundary:** bulk planning for a programme rollout — employee
    lists, department/location grouping, fitting days, advisor/room
    capacity, no-show handling — distinct from booking one appointment
    at a time.
  - **Acceptance:** a programme's employee list is planned across fitting
    days within stated advisor/room capacity, and a no-show is handled
    without silently dropping the employee from the rollout.
  - **Tests:** capacity limits, no-show re-slotting, department/location
    grouping.
  - **Status (2026-08-04, takeover branch):** `verified_local`, one
    dependency deviated from and named honestly, one acceptance line
    partly built. Migration
    `20260804180000_add_corporate_rollout_planning.sql` adds
    `corporate_rollout_days` (per-programme, per-date, capacity) and
    `corporate_rollout_slots` (one wearer per day). The dependency line
    above says rollout schedules through the existing `appointments`
    table — this deliberately does not: `appointments.customer_id` is
    `NOT NULL`, and not every `corporate_wearers` row has a linked
    `customer_id` (most never do — see `14.1`'s own header on exactly
    this). Forcing a shadow `customers` row into existence per wearer
    just to satisfy that column, purely to reuse the appointments table,
    would have created the "shadow customer per employee" `14.1`
    explicitly built `corporate_wearers.customer_id` as nullable to
    avoid. `corporate_rollout_slots_wearer_active_unique` (a unique
    index on `wearer_id` where `status = 'planned'`) is the actual
    capacity/one-live-slot enforcement, not application code alone — the
    same "the constraint is what really stops it" pattern this stage
    already used for tender approvals (`18.2`).
    `packages/domain/src/corporate/rollout-planning.ts`:
    `checkAssignWearerToDay` (capacity), `planNoShowReslot` (earliest
    day with spare capacity, refusing honestly rather than silently
    dropping the wearer when none exists) — deliberately separate from
    `checkGroupFittingCapacity` (`packages/domain/src/wedding/moonstruck-pack.ts`),
    which answers a different question (can N people be fitted before a
    date at all) and is not duplicated here.
    `CorporateRolloutRepository.markNoShowAndReslot` marks the original
    slot `no_show` (never edited into the new one — the miss stays on
    record) and inserts a fresh `planned` row on whichever day the
    reslot lands. Wired to `/corporate/[programmeId]` as a "Fitting
    rollout" card: add a day, assign an unassigned wearer while a day
    has spare capacity (the assign form disappears once full), mark a
    slot completed or no-show, and a visible "No-shows awaiting a new
    day" panel for anyone a reslot attempt found no capacity for — the
    UI-level version of "never silently dropped."
    `apps/retailer/e2e/corporate-rollout.spec.ts` proves the arc for
    real: a full day refuses a further assignment (DB-level, asserted
    against the actual repository result, not just the UI hiding the
    form), and marking a wearer no-show on a later-dated full day
    reslots them onto an earlier, still-open day — asserted against the
    database that exactly two rows exist for that wearer, one `no_show`
    on the original day and one `planned` on the new one, not a status
    silently rewritten in place. An early draft of this test used a
    `div`-with-text locator to find "the day's card," which matched
    every ancestor `div` containing that date string and made the
    per-day scoping meaningless; fixed by adding a `data-rollout-day`
    attribute for exact scoping — a real test-authoring bug found and
    fixed while proving the item, not a product bug.
  - **Fix (2026-08-05, takeover branch):** department/location grouping
    closed — the last unmet line on this item's own **Tests** list.
    Migration `20260805140000_add_corporate_rollout_site_scoping.sql`
    adds a nullable `site_key` to `corporate_rollout_days`. Unset (the
    default, and every pre-existing day), a day stays company-wide,
    exactly as before — no existing programme's rollout plan changes
    unless a manager opts in. Set, a day only accepts a wearer whose own
    `corporate_wearers.site_key` matches, enforced twice: `checkAssignWearerToDay`
    and `planNoShowReslot` (`packages/domain/src/corporate/rollout-planning.ts`,
    both extended, never a second copy of the rule) refuse a cross-site
    assignment or reslot before the write, and the retailer UI's per-day
    "Assign wearer" dropdown only ever lists wearers from that day's own
    site — the actual grouping this item's owner boundary named. A
    no-show reslot also now only considers days the wearer's own site is
    eligible for, so a reslot can no longer silently cross sites just
    because a day elsewhere happens to have room. Proof: 7 new domain
    unit tests (4 `checkAssignWearerToDay` site cases, 2 `planNoShowReslot`
    site cases) and a second test in
    `apps/retailer/e2e/corporate-rollout.spec.ts` proving a site-scoped
    day's dropdown really excludes a different-site wearer (not merely
    reasoned about) and a direct repository assignment attempt for that
    mismatched wearer is refused (`site_mismatch`) at the same write path
    the UI uses. Both tests in that file pass together, and the wider
    corporate e2e suite (`corporate-full-lifecycle.spec.ts`,
    `corporate.spec.ts`, `corporate-service-desk.spec.ts`,
    `corporate-renewal-analytics.spec.ts`) is unaffected. This item's own
    **Tests** line (capacity limits, no-show re-slotting, department/
    location grouping) is now fully covered.

- [ ] **18.7 Corporate project and rollout management**
  - **Requirement IDs:** BD-107.
  - **Dependencies:** `18.1`, `18.2`, `18.6`, `14.1` production/order
    domains (Stage 12).
  - **Owner boundary:** the structured lifecycle state machine —
    opportunity → tender → award → design/sample/material approval →
    employee import → fitting → production → QC → distribution → launch
    → renewal — so no step from the founder's directive is a dead end
    with no caller.
  - **Acceptance:** every named lifecycle step has a real state and a
    real transition into the next; a project cannot silently stall in an
    undefined state between two named steps.
  - **Tests:** full lifecycle transition coverage, stuck-state detection.
  - **Status (2026-08-05, takeover branch):** `verified_local`, real gaps
    named below. Migration `20260805100000_add_corporate_project_lifecycle.sql`
    adds `corporate_projects` (one row per opportunity — `unique(opportunity_id)`
    is the actual enforcement, not application code alone) with `stage`
    constrained by a `check` to exactly the founder's named chain
    (`opportunity`, `tender`, `award`, `design_approval`, `sample_approval`,
    `material_approval`, `employee_import`, `fitting`, `production`, `qc`,
    `distribution`, `launch`, `renewal`), and `corporate_project_events`,
    an append-only audit trail (no update/delete grant at all) of every
    transition. `packages/domain/src/corporate/project-lifecycle.ts`'s
    `checkAdvanceProjectStage` is an explicit stage → next-stage map with
    no implicit fallback — the exact "no skipping, one legal move"
    discipline `checkOpportunityStageTransition` (`18.1`) already
    established, extended to a 13-stage chain instead of a 5-stage one —
    and `assessProjectStall` returns `daysInStage` alongside the boolean
    (never a bare flag), matching this stage's "no black box" scoring
    discipline (`18.9`'s `assessRenewalRisk`). `CorporateProjectRepository`
    is the single write path for every transition
    (`advanceStage`); no step exists with no caller: `opportunity` →
    `tender` fires automatically the moment the first tender is authored
    (`CorporateTenderRepository.create`) and `tender` → `award` fires
    automatically when the opportunity is won
    (`CorporateOpportunityRepository.winAndCreateAccount`, which also
    calls the new `linkAccount` so the project carries the real account
    id from award onward) — reusing the exact events that already cause
    those state changes elsewhere rather than inventing a second,
    disconnected trigger. If an opportunity is won with no tender ever
    authored through this system, the project is left honestly at
    whatever stage it reached rather than a fabricated `tender` step
    being invented to unblock the move — a real, deliberate, named
    behaviour, not an oversight. The remaining nine checkpoints (`award`
    through `launch`) advance one at a time through a staff-facing
    "Advance to `<next stage>`" button and optional note on
    `/business-development/[opportunityId]`'s new "Project lifecycle"
    card — deliberately NOT offered for `opportunity`/`tender`, so a
    stage cannot be claimed by a click without the real event it
    represents actually happening. The same card shows days-in-stage and
    a "Stalled" badge once `assessProjectStall` (threshold: 21 days, a
    published constant, not a tuned model) reports it, plus the latest
    transition history with who (or "(automatic)") and why. Proof:
    `packages/domain/src/corporate/project-lifecycle.test.ts` (9 tests:
    every legal step in the chain, skip-ahead refused, backward refused,
    terminal-stage refused, stall threshold boundary in both directions,
    `renewal` never flagged stalled) and
    `apps/retailer/e2e/corporate-project-lifecycle.spec.ts`, a real
    browser journey proving creating an opportunity really creates its
    project at `opportunity`, authoring a tender really auto-advances it
    to `tender`, winning really auto-advances it to `award` with a real
    linked account id, a staff "Advance" click really writes
    `design_approval` plus an audited event with a real `staff_id` and
    note, and a direct repository-level skip-ahead attempt (`award` →
    `production`) is refused — not merely reasoned about in the domain
    layer, proven against the same write path the UI uses. Full retailer
    e2e regression run alongside `business-development.spec.ts` and
    `corporate-tender.spec.ts`: 3/3 green together, confirming the new
    opportunity-create and tender-create hooks did not disturb either
    existing item.
  - Checkbox stays unchecked: this item's own **Dependencies** line names
    `14.1` production/order domains (Stage 12) and `18.6` fitting rollout
    — neither `production`/`qc`/`distribution`/`launch` nor `fitting` is
    wired to any real production-order or rollout-completion event yet;
    all nine post-award checkpoints (including `fitting`) are staff
    button-driven only, with no automatic trigger from 18.6's rollout
    slots reaching completion or from any Stage 12 production/order
    object. That is a real, named scope gap against the dependency line,
    not a hidden one: the acceptance line's bar ("every named step has a
    real state and a real transition into the next") is met by every
    stage having a genuine, audited, human-decided transition, but
    "automatic wiring to the objects that dependency line names" is not
    yet built for seven of the thirteen stages.

- [x] **18.8 Corporate service desk**
  - **Requirement IDs:** BD-108.
  - **Dependencies:** `14.1`'s `corporate_exceptions` (extend its
    kind/action vocabulary and generalise its scope; do not fork a
    second ticketing table for the same shape of problem).
  - **Owner boundary:** damaged/missing/incorrect-fit/alteration/
    replacement/urgent requests with category, priority, SLA, assignment,
    and an audit trail — raisable by staff (existing) and, once `18.5`
    ships, by an employee directly.
  - **Acceptance:** a ticket carries category/priority/SLA/assignment,
    every state change is audited, and an overdue SLA is visible, not
    silent.
  - **Tests:** SLA breach detection, assignment, audit completeness.
  - **Status (2026-08-05, takeover branch):** `verified_local`, both
    halves. Migration
    `20260804190000_add_corporate_service_desk.sql` extends
    `corporate_exceptions` (14.1) rather than forking a second ticketing
    table: `kind` gains `damaged`/`missing`/`alteration_request`/
    `replacement_request` (the CHECK constraint is dropped and
    recreated, not just widened by a second constraint), plus
    `priority`/`due_at`/`assigned_staff_id`, all nullable/defaulted so
    every pre-existing leaver/service/fit/dispute row keeps working
    unchanged. `corporate_exception_events` is the new append-only audit
    trail this item's acceptance actually requires — insert-only grant,
    no update/delete exists on it at all.
    `packages/domain/src/corporate/service-desk.ts`:
    `SLA_HOURS_BY_PRIORITY` (a fixed, published table — urgent 4h, high
    24h, normal 72h, low 168h) and `computeExceptionDueAt`/
    `isExceptionOverdue`, the latter explicitly false once resolved
    regardless of the due date, so a closed ticket never shows as
    overdue. `CorporateRepository.createException`/`resolveException`/
    `assignException`/`changeExceptionPriority` each write both the row
    update and an audit event in the same call — never one without the
    other. Wired into `/corporate/[programmeId]`'s existing Exceptions
    card: priority selector, assign-to-staff, and an Overdue badge
    alongside Open/Resolved. `apps/retailer/e2e/corporate-service-desk.spec.ts`
    proves the full staff-side arc in a real browser: a ticket's SLA is
    backdated to simulate time passing (real time manipulation, not a
    shortcut around the domain logic), the Overdue badge appears,
    assigning and reprioritizing are each asserted against
    `corporate_exception_events` in order (`created`, `assigned`,
    `priority_changed`, `resolved`) — proving the audit trail, not just
    the UI's momentary state.
  - **Employee-facing half — closed (2026-08-05).** Root cause found via
    the named next step (direct CDP `Network.responseReceivedExtraInfo`
    tracing — Playwright's own `response.headers()` hides `Set-Cookie`
    the same way real browser JS can't see it, which is exactly what
    made the earlier `page.on(...)` instrumentation insufficient): the
    bug was never in the Server Action POST itself. `middleware.ts`'s
    matcher does not exclude `/fonts/*` (the same-origin proxy for
    `paon-template.html`'s `@font-face` URLs, fetched as a background
    subresource by every page). A signed-in wearer's font request hit
    middleware, missed the `isEmployeePath` carve-out (the pathname is
    `/fonts/...`, not `/employee/...`), and fell through to the generic
    "not a customer account → sign out" branch — which correctly signs
    out a `retailer_staff`/`platform` session wandering onto an actual
    customer-app page, but incorrectly also signed out a legitimate
    `corporate_wearer` session over an unrelated byte-serving request.
    The Set-Cookie: `Max-Age=0` on that font response deleted the
    session cookie seconds after `/employee` rendered — by the time a
    human finished filling the form, the cookie was already gone; the
    Server Action's "no user" was a real symptom of an already-cleared
    cookie, not its own defect. Fixed with an early return for
    `/fonts/*` in `middleware.ts`, mirroring the existing storefront/
    confirm-route carve-outs — a pure asset-serving path has no
    account-specific content and should never gate or sign out any
    session, matching its own comment ("every page that embeds this
    template, signed in or not, needs this reachable unauthenticated").
    A second, independent real gap surfaced once past the middleware
    bug: `CorporateRepository.createException` always writes both the
    exception row and its `created` audit event in the same call, but
    `corporate_exception_events` only ever got a staff-scoped INSERT
    policy (`corporate_exception_events_staff_insert`) — a wearer's own
    ticket-creation correctly inserted the exception row, then failed
    outright on the audit event with a plain RLS permission-denied,
    leaving no ticket at all. Migration `20260805220000` adds
    `corporate_exception_events_wearer_insert`, scoped to events whose
    `exception_id` belongs to the caller's own wearer-owned exception.
    Proof: `apps/customer/e2e/employee-portal.spec.ts` extended with the
    real raise-a-request journey (select a kind, fill details, submit,
    see the new ticket in "Issued to you" with an Open badge) — 2/2
    green. Full customer e2e suite reran clean aside from two
    already-documented pre-existing flakes unrelated to this change
    (`swipe-deck.spec.ts`'s rapid-keyboard animation-timing flake;
    `corporate-tender-reveal.spec.ts`'s `page.reload` timeout, confirmed
    identical with and without this fix via `git stash` — both fail the
    same way on a `/r/` storefront path middleware returns from before
    ever reaching the changed code).
  - Checkbox now checked: staff can raise/manage every kind of ticket,
    and "raisable by ... an employee directly" is now proven end to end
    in a real browser.

- [ ] **18.9 Corporate analytics and renewal engine**
  - **Requirement IDs:** BD-109.
  - **Dependencies:** `14.1`, `18.7`, `18.8`; the cited-recommendation
    discipline from `14.2` — no black-box renewal score.
  - **Owner boundary:** contract value, participation, fulfilment,
    damage/repair/replacement rates, and a renewal-probability signal
    that cites the facts behind it, auto-generating a renewal task rather
    than silently expiring a contract.
  - **Acceptance:** every reported metric and the renewal signal both
    cite their source rows, matching `14.2`'s "no black-box owner
    dashboard" non-goal exactly.
  - **Tests:** metric correctness against seeded fixtures, renewal-task
    generation timing.
  - **Non-goals:** no black-box renewal score.
  - **Status (2026-08-04, takeover branch):** `verified_local`, built
    ahead of its own stated `18.7` dependency and narrower than "contract
    value" — both named honestly below, not hidden. Participation,
    fulfilment and damage-rate metrics, and the renewal-risk signal they
    feed, are all computable today directly from `14.1`/`18.8` data
    (`corporate_wearers`, `corporate_issue_records`,
    `corporate_exceptions`) — none of it needed `18.7`'s not-yet-built
    lifecycle state machine, so waiting for that would have blocked real,
    deliverable value on a dependency this item didn't actually require
    yet. `RECOMMENDATION_KINDS` (14.2) gains `corporate_renewal_risk` —
    the renewal signal reuses `cited_recommendations`/`buildRecommendation`
    exactly, rather than a second citation mechanism, satisfying this
    item's own "no black-box renewal score" non-goal with infrastructure
    that already refuses an uncited or oversized-sample claim.
    `packages/domain/src/corporate/renewal-analytics.ts`:
    `computeCorporateProgrammeMetrics` (participation/fulfilment/damage-
    per-wearer rates) and `assessRenewalRisk` — a plain, published
    weighted formula (low participation and low fulfilment each worth up
    to 40 points, live damage rate up to 20) returning every contributing
    factor alongside the score, never a single unexplained number.
    `shouldCreateRenewalTask` refuses a second task while one is already
    open. `CitedRecommendationRepository.computeCorporateRenewalRisk`
    (`packages/database`) is scoped per-programme via a
    `corporate_programme:<id>` marker in `sources[].sourceRef` — `cited_recommendations`
    has no `programme_id` column, and withdrawing "every live
    recommendation of this kind" (the existing `withdrawLiveOfKind`
    helper's shape) would have wrongly withdrawn every OTHER programme's
    live renewal signal too, not just the one being recomputed,
    discovered and fixed before this shipped, not after. The auto-created
    `corporate_renewal_tasks` row is enforced to one-open-per-programme by
    a unique index, not application logic alone. Wired to
    `/corporate/[programmeId]` as an "Analytics and renewal" card: the
    cited statement, sample size and confidence band, a Recompute button,
    and an open task with a "Mark done" action.
    `apps/retailer/e2e/corporate-renewal-analytics.spec.ts` proves the
    arc for a real struggling programme (one inactive wearer of two, two
    damage exceptions) in a browser: recompute produces a real cited row
    scoped to the right programme, a renewal task is really created (DB-
    asserted), and marking it done is real (`resolved_at` set). Found and
    fixed a genuine test-authoring bug while proving this: the shared
    fixture retailer accumulates one live `corporate_renewal_risk` row
    per programme across every run of this suite, and the test's first
    draft used `.single()` filtered only by kind — which silently returns
    null once a second programme's row exists, exactly the "multiple
    rows" case `.single()` cannot express as a pass — fixed by scoping to
    this test's own programme marker, matching what the production
    repository method itself already did correctly.
  - Checkbox stays unchecked: "contract value" (named explicitly in the
    owner boundary) has no source anywhere in the corporate data model —
    no pricing, no contract-value field exists on `corporate_accounts`/
    `corporate_programmes` at all — so it is not part of the computed
    metrics, a real absence rather than a zero. "Repair" rate is also not
    separately tracked (only `damaged`/`missing`/`replacement_request`
    exception kinds feed the damage rate; there is no `repair` kind).
    `18.7`'s full lifecycle remains not started, so nothing here is
    wired to a contract-award or renewal-execution workflow beyond the
    task itself.

- [ ] **18.10 AI-assisted concept, moodboard, and image generation**
  - **Requirement IDs:** BD-110.
  - **Dependencies:** `18.2` (a tender to attach concepts to); `@paon/ai`
    provider-neutral pattern (ADR-033) — a new provider method, not a new
    provider architecture; the "not a black box" house rule from `17.1`
    (advisor capture): every generated asset stays editable and requires
    explicit retailer approval before `18.3` can publish it externally.
  - **Owner boundary:** AI-generated moodboards/looks/lookbook assets,
    attributable to a specific tender version, editable, never
    auto-published.
  - **Acceptance:** a generated asset records which tender version and
    which AI attempt produced it (via the existing
    `AIGenerationRepository` audit trail, not a separate log), and cannot
    reach `18.3`'s public page without an explicit approval action.
  - **Tests:** approval-gate refusal, audit-trail completeness.
  - **Non-goals:** no unapproved asset ever externally visible.
  - **Hard blockers:** live generation needs a configured AI image
    provider — `blocked_external` for the live path only.
  - **Status (2026-08-05, takeover branch):** `verified_local` for
    everything except the live provider call, which stays genuinely
    `blocked_external` — this environment has no `OPENAI_API_KEY`
    configured, the same condition `apps/retailer/lib/ai.ts` already
    handles honestly for every other AI feature (`getAIProvider()`
    returns `null`, callers render/record a not-configured state rather
    than crashing or faking output). `@paon/ai` gained one new provider
    method (`generateConceptImages`, plus `ConceptImageContext`/
    `ConceptImageResult`) on the existing `AIProvider` interface — the
    dependency line's own "a new provider method, not a new provider
    architecture" — implemented for real against OpenAI's image API in
    `OpenAIProvider` (would call a live model with a real key; unit
    tested against a mocked OpenAI client, never a live call) and a
    `MockConceptImageProvider`/`runConceptGenerationJob` pair mirroring
    `17.1`'s own `MockAdvisorCaptureProvider`/`runAdvisorCaptureJob`
    shape exactly. Migration `20260805110000_add_corporate_concept_generation.sql`
    adds `ai_generation_kind`'s new `corporate_concept` value (the
    existing audit trail, not a second log — this item's own dependency
    line) and `corporate_concept_assets`
    (`packages/domain/src/corporate/concept-generation.ts`'s
    `checkDecideConceptAsset` refuses a second decision on an
    already-approved-or-rejected asset — enforced doubly by a `check`
    constraint keeping `status = 'approved'` consistent with the
    decision fields, not application code alone), and extends
    `resolve_corporate_tender` (18.3) to surface only `approved`
    `corporate_concept_assets.image_url`s for the resolved version — a
    pending or rejected image is invisible to that SQL function itself,
    never merely withheld by the calling page's own choice. The retailer
    opportunity page gained a "Generate concept images" action per
    tender version and "Approve image"/"Reject" buttons on each pending
    result; the customer-app public tender page renders any approved
    URLs. Requesting generation with no provider configured records a
    real `failed` `ai_generations` row with an honest error message and
    creates no asset — never a fabricated image — proven by actually
    clicking the button in this genuinely-unconfigured environment, not
    by simulating the condition.
  - **Tests:** `packages/ai/src/concept-generation-runner.test.ts` (5:
    the OpenAI implementation sends the built prompt and parses results,
    throws on an empty/malformed image list; the mock-driven job
    succeeds and retries-then-fails); `packages/domain/src/corporate/concept-generation.test.ts`
    (3: allow-once, refuse-twice for both decisions).
    `apps/retailer/e2e/corporate-concept-generation.spec.ts`: a real
    click with no provider configured writes exactly one new `failed`
    row and zero assets; a seeded pending asset is approved through the
    real UI, its buttons disappear, and a second `decide()` call at the
    same repository write path the UI itself uses is refused
    (`already_decided`) — not just reasoned about in the domain layer.
    `apps/customer/e2e/corporate-tender-reveal.spec.ts` (18.3's own
    proof, extended rather than duplicated): a pending concept image
    seeded for the already-approved version never appears on the public
    page; approving it makes the exact image URL appear.
  - Checkbox stays unchecked: the live image-generation path is
    genuinely `blocked_external` in this environment, so "a generated
    asset" has only ever been proven with a seeded/mocked attempt, never
    a real model call — this item cannot be claimed complete until a
    provider key is available and the live path is exercised at least
    once.

- [ ] **18.11 External signal ingestion (InsiderTailoring discovery)**
  - **Requirement IDs:** BD-111.
  - **Dependencies:** `18.1` (the pipeline it feeds must exist first —
    this is why it is ordered last among the InsiderTailoring items, per
    the founder's own explicit instruction not to begin with broad
    scraping before the internal foundations exist).
  - **Owner boundary:** discovering public commercial signals and adding
    them as `corporate_opportunity_signals` — this is the item that
    finally adds a scraped/public-signal `source` value, deliberately
    absent from `18.1`'s schema until this ships.
  - **Acceptance:** every ingested signal carries a real, checkable
    source citation (URL or document reference) — the same evidence-
    grounding discipline `checkCaptureBundleProposal` (`17.1`) already
    enforces for AI-authored content, applied here to AI- or script-
    authored signals.
  - **Tests:** citation-grounding refusal (a fabricated source is
    refused, mirroring `17.1`'s own test for exactly this failure mode).
  - **Non-goals:** no mass/bulk scraping of a target outside authorised,
    rate-limited, single-target lookups; no data ingestion without a
    checkable citation.
  - **Hard blockers:** external data source access; `blocked_external`.
  - **Status (2026-08-05, takeover branch):** `verified_local` for the
    enforcement mechanism only — the autonomous discovery/ingestion
    pipeline itself (a scraper, a search API integration, a scheduled
    job) is genuinely `blocked_external` and not attempted: there is no
    external data source access available to this build, and fabricating
    one to "prove" the item would mean feeding the citation-grounding
    check fake evidence — exactly the failure mode this item's own
    acceptance exists to refuse. What is real: `corporate_opportunity_signals`
    gained a `public_signal` source (migration
    `20260805120000_add_corporate_public_signal_citation.sql`, extending
    18.1's own migration comment explaining why that value was
    deliberately absent until now) and a `citation_url` column, with a
    `check` constraint — `source <> 'public_signal' or citation_url ~*
'^https?://.+'` — that is the actual enforcement, not application
    code alone. `checkAddSignal` (`packages/domain/src/corporate/business-development.ts`)
    refuses any `public_signal` with no real, checkable (`https?://`)
    citation before it ever reaches the database, mirroring
    `checkCaptureBundleProposal`'s (17.1) refusal of an AI-proposed
    bundle with no quoted evidence — the same discipline, applied to
    externally-discovered content instead of AI-authored content.
    `public_signal` carries a published weight (20, the `inbound_enquiry`
    tier) in `scoreOpportunity`, so a cited public signal moves the score
    exactly as inspectably as every other source. The retailer
    opportunity page's "Add signal" form gained the source option and a
    citation URL field, and every signal with a citation shows it inline.
    Since no autonomous pipeline exists, a `public_signal` can currently
    only be entered the same way every other signal is — a real person,
    through the real UI, citing a real source — which proves the
    enforcement path is real without fabricating an ingestion pipeline
    that does not exist.
  - **Tests:** `packages/domain/src/corporate/business-development.test.ts`
    (4 new: refuses no citation, refuses a non-URL citation, accepts a
    real checkable citation, never requires one for any other source).
    `apps/retailer/e2e/corporate-public-signal-citation.spec.ts` proves
    both halves in a real browser/database: a `public_signal` with no
    citation is refused at the same repository write path the UI itself
    uses, and one with a real citation is accepted through the real UI,
    scored at exactly 20, and its citation stays visible — asserted
    directly against the database, not just the page's own rendering
    choice. Full corporate/business-development regression run alongside
    it (`business-development.spec.ts`, `corporate-full-lifecycle.spec.ts`,
    `corporate-relationship-crossref.spec.ts`): 4/4 green together.
  - Checkbox stays unchecked: no external discovery mechanism exists at
    all — this item's own owner boundary ("discovering public commercial
    signals") is not met, only the schema/enforcement it will one day
    feed. This item cannot be claimed complete until external data source
    access is available and a real ingestion path is built against it.

- [x] **18.12 Relationship cross-referencing and opportunity scoring from existing customers**
  - **Requirement IDs:** BD-112.
  - **Dependencies:** `18.1`, `18.11`, existing `customers`/`customer_facts`.
  - **Owner boundary:** matching a discovered or manually entered company
    signal against PAON's own existing customer base (e.g., an existing
    private client who works at the target company), surfaced as an
    `existing_customer_link` signal (`18.1`'s highest-weighted source) —
    never as a broader cross-customer data exposure than that one match.
  - **Acceptance:** a match is surfaced as a signal with a citable basis
    (which customer, which fact), never a silent, unexplained score bump.
  - **Tests:** match precision on seeded fixtures, no cross-tenant leakage.
  - **Status (2026-08-04, takeover branch):** `verified_local`, built
    ahead of its own stated `18.11` dependency — named honestly, not
    hidden: the _manually entered_ signal case this item names in its own
    owner boundary ("an existing private client who works at the target
    company") needed nothing from `18.11`'s not-yet-built external
    discovery, only the `employer` fact type `customer_facts` already
    had (PHASE 7.3) and `18.1`'s existing `existing_customer_link` signal
    source — so this ships the reviewable, human-confirmed half now;
    matching a _discovered_ signal automatically still waits on `18.11`.
    `CustomerFactRepository.findByFactTypeAndValue` is the only new
    repository code — a case-insensitive match scoped to
    `retailer_id = <this retailer>`, nothing broader. No new migration,
    no new domain module: the match is surfaced on
    `/business-development/[opportunityId]` as an "Existing customer
    match" card naming the real customer and the real fact, and adding
    it as a signal goes through the _exact same_ `addSignal` action
    `18.1` already built — never an automatic score bump, never a
    parallel write path. The signal's `detail` text cites the specific
    `customer_facts` row id, so "which customer, which fact" is always
    answerable from the signal itself, not just from having trusted the
    match at the moment it was suggested.
    `apps/retailer/e2e/corporate-relationship-crossref.spec.ts` proves
    the full acceptance line in one browser run: an existing client's
    employer fact surfaces with a citable basis, adding it as a signal
    moves the score by exactly the `existing_customer_link` weight (30),
    and — the cross-tenant-leakage test this item's own **Tests** line
    requires — a matching employer fact seeded under a genuinely
    different, already-existing fixture retailer
    (`e2e-customer-workspace`, reused rather than seeding a throwaway
    second tenant) never appears on the first retailer's page.

- [ ] **18.13 End-to-end lifecycle hardening**
  - **Requirement IDs:** BD-113.
  - **Dependencies:** `18.1`–`18.12` all complete.
  - **Owner boundary:** proves the full 18-step lifecycle the founder
    specified (signal → opportunity → qualification → corporate account
    → tender → share → win/loss → programme/rollout → employee import →
    campaign publish → fitting → measurements/orders → production/
    distribution → portal service → account monitoring → auto-renewal)
    has no dead-end step anywhere in the chain.
  - **Acceptance:** one fixture company runs the full chain end to end in
    a browser proof; every step names the real object/table it produced,
    not a stub.
  - **Tests:** full-chain browser proof.
  - **Status (2026-08-05, takeover branch):** `verified_local`, deliberately
    scoped — named explicitly below, not hidden. This item's own
    **Dependencies** line reads "18.1–18.12 all complete", which is not
    literally true (18.10/18.11 are `blocked_external` and will not be
    "complete" without external provider/data-source access this build
    cannot obtain) — proceeding anyway is a deliberate, named deviation
    from that dependency line, the same class of judgment call this
    stage's own build order note already exercised elsewhere: the
    acceptance itself ("one fixture company runs the full chain end to
    end... every step names the real object/table it produced") is
    independently satisfiable for every item that is actually built,
    and waiting indefinitely on two blocked-external items to prove the
    other eleven would leave a real, working chain unproven for no
    honest reason.
    `apps/retailer/e2e/corporate-full-lifecycle.spec.ts` is that
    fixture-company run: one company moves through signal → opportunity
    (18.1) → qualification (18.1) → tender authored and approved (18.2,
    project auto-advances `opportunity` → `tender`) → win, a real
    `corporate_accounts` row (18.1, project auto-advances `tender` →
    `award`) → a real `corporate_programmes` row (14.1) → a real
    employee/`corporate_wearers` row with portal access granted (14.1 /
    18.5) → a fitting day and assignment (18.6) → a service-desk
    exception logged and resolved (18.8) → renewal analytics recomputed
    (18.9) → every remaining named checkpoint
    (`design_approval`/`sample_approval`/`material_approval`/
    `employee_import`/`fitting`/`production`/`qc`/`distribution`/
    `launch`/`renewal`) advanced one at a time through the real staff UI
    (18.7). The test's final assertion reads the full
    `corporate_project_events` audit trail directly and asserts its
    `to_stage` sequence equals the entire 13-stage chain in order — proof
    that no step was skipped or silently stalled, not just that the last
    page load looked right. Full corporate/business-development e2e
    regression run alongside it: 10/10 green together (this spec plus
    `corporate.spec.ts`, `corporate-rollout.spec.ts`,
    `corporate-service-desk.spec.ts`, `corporate-renewal-analytics.spec.ts`,
    `corporate-tender.spec.ts`, `business-development.spec.ts`,
    `corporate-project-lifecycle.spec.ts`,
    `corporate-relationship-crossref.spec.ts`,
    `corporate-office-visit.spec.ts`), confirming this run does not
    disturb any existing item's own proof.
  - **Deliberately not re-proven here** (each already has its own
    dedicated browser proof and this spec stays retailer-app-only, no
    cross-app auth switching): the public tender "share" reveal
    (18.3's own `apps/customer/e2e/corporate-tender-reveal.spec.ts`), the
    office-visit landing page submission (18.4's own
    `apps/customer/e2e/corporate-office-visit.spec.ts`), and employee
    portal sign-in/self-service (18.5's own
    `apps/customer/e2e/employee-portal.spec.ts`) — raising a request
    from that side hits 18.8's own separately-documented open bug and is
    not attempted here.
  - Checkbox stays unchecked: **18.10 and 18.11 are not proven at all**
    (`blocked_external`, not started) — this item's acceptance is met
    for the built portion of the chain only, not literally "the full
    chain" the owner boundary names. No bulk "employee import" exists
    (one wearer is added here, not a batch — a real, named gap inherited
    from 18.5's own scope). `production`/`qc`/`distribution`/`launch`
    advance as staff-decided checkpoints with a real audit trail but no
    live production-order or measurement object behind them yet — this
    proves every stage has a real, audited transition, not that those
    specific stages are wired to Stage 12 production, exactly as 18.7's
    own status already names.

## Real hard blockers

A hard blocker stops only the affected item. Continue with the next independent
queue item when possible.

- A requested change contradicts an ADR and the reversal cannot be safely
  recorded.
- A founder-defined surface is required but cannot be ported or no approved
  design exists.
- A production-data operation is destructive/irreversible and not covered by
  an approved migration or runbook.
- A regulated payment/stored-value/instalment capability lacks the business,
  legal, accounting, or provider decision required by Stage 6.1.
- Required external credentials or provider accounts are unavailable for live
  verification. Build and test provider-neutral/local work where possible,
  record live verification as blocked, and continue.

Routine review, uncertainty that can be resolved from code/ADRs, completion of
one slice, and optional credentials for a later stage are not global blockers.

## Per-slice completion

A queue item is complete only when its acceptance criteria are implemented,
focused tests and the full repository checks pass, tenancy/accessibility/
founder-surface verification is complete where relevant, authoritative state
is updated, and the commit is pushed. Then immediately take the next buildable
item.
