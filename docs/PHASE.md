# Current Phase — PAON Intelligence Platform Programme

**This is the only authorized work queue.** It supersedes the 2026-07-27
pilot-only freeze and every queue in ROADMAP, COMPETITIVE_GAPS,
EXPERIENCE_REBUILD, vision documents, audits, and old handoffs.

Set by the founder on 2026-07-30.

## Objective

Turn PAON's existing RetailOS into an explainable intelligence platform for
independent premium menswear retailers:

1. establish a reviewed, metadata-driven catalogue and reusable knowledge
   system;
2. use it for discovery, search, filters, imports, and client education;
3. add consented customer signals and advisor intelligence;
4. build wardrobe intelligence and MorningRoutine on the same concepts; and
5. add campaigns, milestones, concierge services, and compliant commerce only
   after their foundations exist.

The complete product and technical specification is
[PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md). Existing
founder-designed surfaces remain authoritative wherever they define the UI.

## As-built baseline

Verified against code and 89 migrations on 2026-07-30:

- Three Next.js applications and shared domain/database/auth/UI/integration
  packages are established.
- Product, variant, collection, storefront, cart/order, appointment,
  clienteling, behavioral-event, AI-generation, loyalty, wedding-party,
  alteration, and Demo Studio foundations exist.
- Product facts are thin: name, description, status, made-to-order/alterable,
  primary image, swatch image, collections; variant carries SKU, size, color,
  price, stock, and lead time.
- Storefront category, color, pattern, and season filters are derived from
  product names, collection names, variant color, and founder image-number
  heuristics.
- `behavioral_events` and `ai_generations` exist, but the new consent,
  evidence, retention, style-profile, and advisor-briefing model does not.
- No metadata concept, knowledge object, catalogue import, style-profile,
  wardrobe, outfit, roadmap, service-plan, or campaign table exists.

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

- [x] **0.1 Documentation consolidation.** Establish this queue,
      `PAON_INTELLIGENCE_PLATFORM.md`, the four programme ADRs, the cross-agent
      loop, the authority map, factual project state, and Resume Protocol. No
      feature implementation.

### Stage 1 — Metadata foundation

- [ ] **1.1 Domain contracts.** Add branded IDs, concept/edge/assignment/
      override types, enums, validation schemas, `ProductFabricProfile`, and pure
      validation tests in `@paon/domain`. Update DOMAIN_MODEL only after code
      lands. Dependency: 0.1. ADR: 059.
- [ ] **1.2 Metadata persistence and RLS.** Add canonical and retailer-owned
      concept rows, edges, entity assignments, retailer overrides, indexes,
      generated database types, and repositories. Verify platform/retailer
      tenancy, nullable canonical ownership, and cross-tenant denial. Dependency:
      1.1. ADR: 059.
- [ ] **1.3 Review workflow.** Add Admin canonical-concept management and
      retailer assignment review/accept/reject flows with provenance, confidence,
      evidence, reviewer, and timestamps. Unknown concepts remain proposals until
      accepted. Dependency: 1.2. ADR: 059.
- [ ] **1.4 Product facts and catalogue assignment UI.** Persist exact fabric
      weight, supplier reference, and composition percentages without duplicating
      concept labels; let retailer staff manage product/variant assignments through
      repositories and Server Actions. Dependency: 1.3.

**Stage 1 non-goals:** no embeddings, vector search, autonomous publishing,
free-form tag bag, global Brand registry, Collection-as-Brand shortcut,
storefront redesign, or customer personalization.

### Stage 2 — Knowledge, discovery, search, and import

- [ ] **2.1 Knowledge contracts and persistence.** Add canonical/retailer
      knowledge objects, concept joins, relations, display types, commercial
      intent, active state, retailer override/pin controls, RLS, repositories, and
      initial reviewed menswear fixtures. Dependency: 1.3. ADR: 060.
- [ ] **2.2 Deterministic discovery engine.** Implement and test ranking from
      accepted metadata, journey relevance, retailer priority/pins, commercial
      intent, novelty, relationship proximity, diversity, and viewed penalties.
      Return three to six explainable cards. Dependency: 2.1. ADR: 060.
- [ ] **2.3 Founder-storefront mounts.** Inject discovery results into the
      existing Archetype, Fabric, and Sizing information areas of
      `paon-template.html` through narrow data hooks. Verify desktop/mobile,
      accessibility, and no unrelated markup/CSS/interaction drift. Dependency:
      2.2. ADRs: 052, 060.
- [ ] **2.4 Structured catalogue query.** Add repository-backed search,
      accepted-metadata facets, numeric weight/price ranges, relevance ordering,
      pagination, and transparent unresolved-query fallback. Replace the current
      keyword/image heuristics only when equivalent storefront behavior is covered
      by tests. Dependency: 1.4.
- [ ] **2.5 Import contracts and preview.** Publish the PAON CSV/XLSX template,
      import job/row/review-task domain and persistence, parser fixtures, duplicate
      checks, asset matching, validation errors, raw supplier preservation, and a
      retailer preview. Dependency: 1.3.
- [ ] **2.6 Transactional reviewed publishing.** Publish product, variants,
      assets, exact facts, and accepted assignments atomically; failed rows remain
      unpublished and resumable. Dependency: 2.5.
- [ ] **2.7 AI-assisted enrichment.** First ship the Admin-maintained external
      ChatGPT enrichment prompt and structured import workflow. Then add a
      provider-neutral job-runner path that returns schema-validated JSON with
      field confidence/evidence and never invents supplier facts. All inference
      remains pending review. Dependencies: 2.5 and 2.6.

**Stage 2 non-goals:** no semantic/vector retrieval before accepted metadata
and search/click evidence exist; no autonomous AI facts; no React rewrite of
the founder storefront; no public API; no supplier-specific dependency; no
unreviewed bulk publish.

### Stage 3 — Customer and advisor intelligence

- [ ] **3.1 Consent and event upgrade.** Define personalization and marketing
      consent separately, add anonymous-session support where lawful, purpose and
      retention metadata, consent withdrawal/deletion behavior, and event types for
      view/search/filter/favorite/cart/knowledge/advisor/swipe/appointment. Preserve
      durable business records as their own sources of truth. Dependency: 2.4.
      ADRs: 021, 061.
- [ ] **3.2 StyleProfile evidence.** Add explicit preferences, inferred
      preferences, per-concept evidence, polarity, confidence, and explainable
      recomputation. Never write inference into explicit preference fields.
      Dependency: 3.1. ADR: 061.
- [ ] **3.3 Advisor briefing.** Add a retailer-scoped repository and client
      workspace view for recent interests, saved products, knowledge consumed,
      declared occasion, evidence, questions, wardrobe gaps when available, and
      appointment preparation. Show only consented information. Dependency: 3.2.
- [ ] **3.4 Grounded TableService and guided preference capture.** Ground AI
      answers in approved knowledge with citations/uncertainty, hand off early to
      an advisor, convert chats/swipes into traceable evidence, a shortlist, or an
      appointment. Dependencies: 2.2 and 3.2.

**Stage 3 non-goals:** no covert tracking, no precise location without
separate opt-in, no unexplained score, no advisor access across tenants, no raw
prompt/PII duplication, no AI answer that outranks approved knowledge, and no
replacement of human advice for uncertain high-value decisions.

### Stage 4 — Wardrobe intelligence and MorningRoutine

- [ ] **4.1 Wardrobe ownership.** Add retailer-purchased and customer-added
      wardrobe items linked to products and the metadata assignment mechanism,
      plus ownership history, condition, fit notes, wear/care state, provenance,
      tenant/customer access, and external-garment review. Dependency: 3.2.
- [ ] **4.2 Wardrobe Roadmap and outfits.** Add advisor-authored goals, ranked
      gaps, complete-look combinations, staged purchase priorities, explanation
      links, and customer-visible approval state. Dependency: 4.1.
- [ ] **4.3 Lifecycle and care intelligence.** Add wear rotation, garment age,
      care, repair, fit-update reminders, and customer-submitted current-wear
      photo/notes tied to a wardrobe item and appointment handoff. Dependency: 4.1.
- [ ] **4.4 MorningRoutine.** Select owned garments and, secondarily, catalogue
      recommendations from wardrobe availability, accepted preferences, occasion,
      weather, and separately consented location. Provide explanations and direct
      save/book/buy actions. Dependency: 4.2.
- [ ] **4.5 MorningRoutine delivery.** Add opt-in in-app and email delivery,
      frequency controls, quiet periods, delivery audit, and unsubscribe. Verify
      that service content is timely rather than generic promotion. Dependency:
      4.4.

**Stage 4 non-goals:** no generic customer manufacturing fit profile (ADRs 016
and 055 remain), no retailer sharing of wardrobe data, no required location,
no native mobile app, no automatic purchase, and no recommendation without an
explanation path.

### Stage 5 — Relationship programmes and concierge services

- [ ] **5.1 Campaigns.** Add premium, consent-aware weekly offers,
      member-only releases, and the seven-day wardrobe challenge with audience
      criteria, scheduling, delivery audit, and suppression controls. Dependency:
      3.2.
- [ ] **5.2 Milestones.** Extend the existing loyalty ledger/events with
      auditable eligibility rules for first commission, repeat orders, new
      categories, premium construction, and advanced fabrics. Dependency: 1.4.
- [ ] **5.3 Concierge service model.** Add Preferred Tailoring and
      HighMaintenance service plans, entitlements/credits, bookings, fulfilment,
      cleaning/repair/care records, collection/delivery, commitments, and advisor
      ownership without overloading orders or alterations. Dependencies: 4.3 and
      existing appointment/alteration foundations.
- [ ] **5.4 Tie-Mate.** Build the dedicated mobile-first tie-fabric discovery
      surface on metadata, discovery, shortlist, order, and advisor-handoff
      foundations. Dependencies: 2.3 and 3.4; requires founder surface or an
      approved design.

**Stage 5 non-goals:** no mass-discount gamification, opaque audiences,
duplicate loyalty ledger, service state hidden in generic order status, or
invented founder-designed surface.

### Stage 6 — Later commerce capabilities

- [ ] **6.1 Payment/compliance design gate.** Before deposits, stored value,
      one-click payment, instalments, service subscriptions, or membership billing,
      record provider capabilities, merchant-of-record, VAT/accounting, refunds,
      custody, SCA, consent, retention, and jurisdictional review. Dependency:
      business/legal decisions and provider configuration. ADRs: 030, 031, 050, 062.
- [ ] **6.2 Approved commerce primitives.** Implement only the capabilities
      authorized by 6.1 using provider-hosted/tokenized payment methods; preserve
      immutable order/payment/ledger history and existing Stripe boundaries.
      Dependency: 6.1.
- [ ] **6.3 Retailer-owner marketplace.** Model the fixture/packaging/display/
      furnishing marketplace as a distinct catalogue and commerce context. It
      must not reuse customer-retail catalogue assumptions or leak tenant data.
      Dependencies: stable intelligence programme and a separate marketplace ADR.

**Stage 6 non-goals:** no PAON-built payment processor, credit underwriting,
custom stored-card vault, silent merchant-of-record change, unapproved stored
value, or marketplace squeezed into the customer catalogue.

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
