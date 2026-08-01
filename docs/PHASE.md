# Current Phase — PAON Retail Relationship and Operations Programme

**This is the only authorized work queue.**

**Queue rule:** an item that lists another PHASE item as a dependency must not be checked or marked `verified_*` while that dependency remains unchecked or `implemented_unverified` (parallel implementation is allowed).

It supersedes the 2026-07-27
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

- [ ] **11.4 Internal community, contribution and support**
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

- [ ] **12.3 Preferred Tailoring partner network**
  - **Requirement IDs:** `SRV-101`–`SRV-103`, `INV-103`.
  - **Dependencies:** `8.1`; inventory identity foundation.
  - **Owner boundary:** per-location partners, capability/SLA, wardrobe intake,
    service plans, custody, work/quality/customer feedback, costs/invoices/
    reconciliation and a real wardrobe service calendar.
  - **Acceptance:** one alteration and one dry-cleaning flow from booking and
    pickup through return; partner sees minimum data; costs reconcile.
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

- [ ] **12.4 Supplier/atelier intelligence and support operations**
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

- [ ] **16.5 Moonstruck wedding-party apparel pack**
  - **Requirement IDs:** `WED-101`.
  - **Dependencies:** `16.3`, `10.1`, `12.2`; actual occasionwear pilot
    evidence.
  - **Owner boundary:** extend the existing wedding-party/member/RLS/invite/
    photo/height/weight/fitting-state aggregate with inspiration board, group
    fitting capacity, coordinated design choices, order/fitting/delivery
    readiness, guest dress-code looks/vouchers, garment aftercare and
    anniversary continuation; never create a second party model.
  - **Acceptance:** a couple plus three party members completes invite →
    inspiration/design → fitting → order readiness → collection/aftercare;
    each participant sees only their data; retailer sees group exceptions and
    the anniversary becomes a relationship moment.
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
