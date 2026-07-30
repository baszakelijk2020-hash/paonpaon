# Current Phase — PAON Retail Relationship and Operations Programme

**This is the only authorized work queue.** It supersedes the 2026-07-27
pilot-only freeze and every queue in ROADMAP, COMPETITIVE_GAPS,
EXPERIENCE_REBUILD, vision documents, audits, and old handoffs.

Set by the founder on 2026-07-30.

## Objective

Turn PAON's existing RetailOS into an explainable relationship and operations
platform for independent premium menswear retailers. Stages 0–7 established
the intelligence foundation:

1. establish a reviewed, metadata-driven catalogue and reusable knowledge
   system;
2. use it for discovery, search, filters, imports, and client education;
3. add consented customer signals and advisor intelligence;
4. build wardrobe intelligence and MorningRoutine on the same concepts; and
5. add campaigns, milestones, concierge services, and compliant commerce only
   after their foundations exist.

Stages 8–16 now extend that foundation into one Mission Control across
interoperability, migration, clienteling/campaigns, workforce, MTM/fit/
production, inventory/POS, corporate fashion, lifestyle network commerce,
MunroMerchant, knowledge/training, and later vertical packs. Retailers can use
PAON as an overlay, co-managed system or full authority by domain; replacement
is not required at onboarding.

The complete product and technical specification is
[PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md). Existing
founder-designed surfaces remain authoritative wherever they define the UI.
The expanded successor specification is
[PAON_EXPANDED_PROGRAMME_EXECUTION.md](./vision/PAON_EXPANDED_PROGRAMME_EXECUTION.md).

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

**Stage 4 non-goals:** no generic customer manufacturing fit profile (ADRs 016
and 055 remain), no retailer sharing of wardrobe data, no required location,
no native mobile app, no automatic purchase, and no recommendation without an
explanation path.

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

### Stage 9 — Migration Cockpit and connectors

- [x] **9.1 Generic staged-file migration**
  - **Requirement IDs:** `INT-002`, `INT-003`.
  - **Dependencies:** `8.2`; extend existing import foundations.
  - **Owner boundary:** immutable raw upload, profiling/mapping/dedupe/review,
    dry run, dependency-ordered publish, reconcile, dead-letter/resume and
    rollback references for CSV/XLSX/JSON.
  - **Acceptance:** realistic products/customers/orders/stock fixture imports
    idempotently; counts and money reconcile; passwords/payment credentials and
    ambiguous identity merges are rejected.
  - **Tests:** rerun/delta/failure/resume, cross-tenant denial and operator
    browser journey.
  - **Non-goals:** no silent AI identity merge.
  - **Hard blockers:** none.
  - **Landed:** domain staged-file contracts + fixture; migration
    `20260730320000_add_staged_file_migration_foundation.sql`;
    `MigrationJobRepository` dry-run/publish/reconcile/resume; Retailer
    `/migrations` cockpit. Product/stock/order publish receipts reconcile
    money/units; customers are created for real. Full catalogue/product
    write-through and Playwright journey remain follow-ons; provider adapters
    are Stage 9.2.

- [x] **9.2 Shopify and Faden adapters**
  - **Requirement IDs:** `INT-002`, `INT-003`, `INT-004`.
  - **Dependencies:** `9.1`.
  - **Owner boundary:** current official export/API/webhook contracts, raw
    adapters, mappings, health and reconciliation.
  - **Acceptance:** Shopify fixture covers catalogue/customer/order/stock
    deltas; Faden fixture covers documented read-only API and signed webhooks;
    unsupported writes become source tasks/deep links.
  - **Tests:** signatures/replay, cursors, rate/failure, idempotency,
    reconciliation and stale state.
  - **Non-goals:** no undocumented endpoint or browser-automation connector.
  - **Hard blockers:** provider keys block only live smoke tests.
  - **Landed:** domain Shopify delta fixture mapped into 9.1 staged rows;
    Faden signed-webhook fixture verifier + read-only ingest/deep-link plan
    (no write-back); Admin integration-health lists adapter versions. Live
    provider smoke remains blocked without credentials.

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

- [x] **10.1 Versioned campaign library**
  - **Requirement IDs:** `CMP-101`–`CMP-104`.
  - **Dependencies:** `8.3`; existing campaign/private-offer foundations.
  - **Owner boundary:** PAON library object, retailer copy/version,
    prerequisites/mapping/preview, staff mission, customer in-app placement and
    outcome.
  - **Acceptance:** one campaign can be previewed, cloned, mapped, rehearsed,
    activated and measured without silently changing with library updates.
  - **Tests:** version pin, eligibility/exclusion/contact pressure, role/RLS,
    empty prerequisite and browser states.
  - **Non-goals:** no generic drag-and-drop email editor.
  - **Hard blockers:** external channel credentials block only sending.
  - **Landed:** domain library snapshot + pin/prereq rules; migration
    `20260730330000_add_versioned_campaign_library.sql`;
    `CampaignLibraryRepository` ensure/clone with `library_version_id` pin;
    Retailer campaigns settings shows library preview and clone. Full mapping
    wizard, rehearsal, and CMP-104 funnel metrics remain follow-ons.

- [ ] **10.2 Seven-Day Wardrobe and Honeymoon Phase**
  - **Requirement IDs:** `CMP-105`, `CMP-106`, `WRD-104`.
  - **Dependencies:** `8.1`, `10.1`; wardrobe/MorningRoutine/order foundations.
  - **Owner boundary:** executable campaign packages and required customer/
    advisor surfaces.
  - **Acceptance:** editable owned-first seven-day outfits identify cited
    gaps; order-to-delivery tracker creates useful preparation/collection/
    aftercare actions with stock/lead-time truth and pressure limits.
  - **Tests:** owned/suggested separation, campaign timing, suppression,
    correction and outcomes.
  - **Non-goals:** no fabricated scarcity or unapproved one-click payment.
  - **Hard blockers:** payment eligibility blocks only payment action.

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

- [ ] **12.2 Garment production and serialized pieces**
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

- [ ] **12.3 Preferred Tailoring partner network**
  - **Requirement IDs:** `SRV-101`–`SRV-103`, `INV-103`.
  - **Dependencies:** `8.1`; inventory identity foundation.
  - **Owner boundary:** per-location partners, capability/SLA, wardrobe intake,
    custody, work/quality, costs/invoices/reconciliation.
  - **Acceptance:** one alteration and one dry-cleaning flow from booking and
    pickup through return; partner sees minimum data; costs reconcile.
  - **Tests:** custody, partner scope/RLS, SLA/exception, accounting export.
  - **Non-goals:** no partner payout without approved money design.
  - **Hard blockers:** payment decision blocks charging/payout only.

### Stage 13 — Inventory, POS, and loss prevention

- [ ] **13.1 Stock ledger, reservations, barcode receiving and counts**
  - **Requirement IDs:** `INV-101`, `INV-102`.
  - **Dependencies:** `8.2`.
  - **Owner boundary:** append-only ledger, location balances/reservations,
    barcode scan modes, receiving/transfers/count/reconcile.
  - **Acceptance:** purchase receipt, transfer, sale reservation and blind
    count reconcile without silent balance edits or oversell.
  - **Tests:** concurrency, reversal/idempotency, count/recount, RLS/browser.
  - **Non-goals:** no RFID-first implementation.
  - **Hard blockers:** none.

- [ ] **13.2 Loss prevention and RFID pilot**
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

### Stage 16 — Knowledge productization and vertical packs

- [ ] **16.1 Consultancy, guided tiers and staff academy**
  - **Requirement IDs:** `KNW-101`–`KNW-104`.
  - **Dependencies:** existing knowledge; `8.3`, `11.2`.
  - **Owner boundary:** separate customer/staff/owner/media libraries, guided
    MTM package versions, DailyBriefing and MunroMentor.
  - **Acceptance:** an article launches an audit/template; customer selects a
    coherent tier; employee completes context lesson and evidence-cited
    roleplay/coaching loop.
  - **Tests:** content approval/version/rights, package spec mapping, rubric
    grounding and role/RLS.
  - **Non-goals:** no unreviewed AI publication.
  - **Hard blockers:** licensed media blocks that content only.

- [ ] **16.2 Media and future-products incubation**
  - **Requirement IDs:** `KNW-105`, `NET-103`.
  - **Dependencies:** `16.1`, `15.1`.
  - **Owner boundary:** rights-aware retailer media activation and gated
    product incubation register.
  - **Acceptance:** retailer activates approved expiring article/feed; future
    product remains a hypothesis until demand/margin/supplier/quality evidence.
  - **Tests:** rights/territory/expiry, attribution and catalogue separation.
  - **Non-goals:** no copied publisher content or speculative stock purchase.
  - **Hard blockers:** media agreement blocks publication only.

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
