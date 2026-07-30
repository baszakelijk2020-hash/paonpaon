# Cursor Continuous Prompt — PAON Expanded Relationship and Operations OS

Copy everything below the line into Cursor Agent when the current Cursor run is
ready to receive the expanded programme. This is one continuous instruction,
not a sequence of prompts.

---

You are continuing work in the PAON repository after the completed Stage 7
evidence-cited intelligence programme and the founder's 2026-07-30 expansion
authorization. Work autonomously and continuously toward the complete target.
Do not stop after one tranche merely to ask whether you should continue.
Complete one bounded vertical slice at a time, verify it, commit it
intentionally, push it, update factual authority, and immediately take the next
independent buildable slice.

You are not being asked to rediscover or rewrite the product strategy. The
research and architecture are already recorded. Spend model usage on the first
unchecked dependency-complete item in `docs/PHASE.md`, not on another broad
competitor audit or a parallel roadmap.

## Founder authority for this programme

The founder explicitly authorizes PAON's expansion into a unified retail
operating system. Ignore earlier exploratory pricing structures; do not encode
them into the product architecture or use them to narrow the platform.

The destination includes:

- website, ecommerce, POS, inventory, customer accounts, profiles,
  segmentation, analytics, loyalty, and reporting;
- Endear/Tulip/Salesforce/NewStore-grade clienteling, messaging, appointments,
  remote proposals/carts, notetaking, customer books, opportunities, and
  outcomes;
- Shopify/Lightspeed/Square/WooCommerce and other source imports/sync;
- made-to-measure configuration, versioned measurements, fittings,
  alterations, production, garment-piece tracking, workroom/outworkers,
  material inventory, BOMs, tech packs, QC, capacity, and aftercare;
- executable selling ceremony, onboarding, coaching, data-quality discipline,
  and owner/manager accountability;
- evidence-cited customer, advisor, operational, and temporal intelligence;
- role-specific live/recent presence and activity dashboards;
- a separate MunroMerchant-style B2B marketplace for hangers, packaging,
  mannequins, fixtures, furniture, services, and other retailer supplies;
- a reusable core that can later support bridal, jewelry, premium womenswear,
  optical, luxury furniture, and hospitality through vertical packs.
- three coexistence modes by domain — Experience Overlay, Co-managed and Full
  PAON — so Shopify, Faden, factory ordering, accounting and payroll can remain
  authoritative where appropriate without giving employees another
  disconnected daily interface;
- Workforce Mission Control with time exceptions/approvals, payroll handoff,
  scheduling, tasks/promises, daily briefing/closeout, I AM, extra-mile
  recognition, ceremony and coaching;
- a customer wardrobe of six permanent visual rails — Suits, Jackets, Shirts,
  Knitwear, Shoes and Accessories — connected to outfits, roadmap, fit,
  Preferred Tailoring and service partners;
- PAON Métier corporate-fashion programmes from tender and wearer onboarding
  through allocation, fitting, order, issue, service and leaver return;
- a versioned strategy/campaign library including Seven-Day Wardrobe,
  Honeymoon Phase, Valentine/overcoat, milestone, annual-event and referral
  packages;
- optional RFID over the same stock/custody ledger as barcode/QR;
- MeasurementMonitor as a reviewable fit-drift/reorder gate, never a silent
  single-photo replacement for approved tailoring measurements;
- a lifestyle partner/media/concierge/attribution layer distinct from the
  MunroMerchant B2B procurement context.

Do not push back by reducing this to an MVP feature checklist. Sequence it
correctly and build the durable foundations. Push back only on a concrete
failure mode such as data loss, fake verification, insecure tenancy, invalid
financial handling, impossible data extraction, or a literal UI clone that
would create separate brittle product forks.

## Read before acting

Read completely:

1. every applicable `AGENTS.md`;
2. `docs/PHASE.md`;
3. the Resume Protocol in `docs/PAON_INTELLIGENCE_PLATFORM.md`;
4. `docs/PROJECT_STATE.md`;
5. `docs/DECISIONS.md`, especially the latest relevant ADRs;
6. `docs/vision/PAON_COMPETITIVE_CAPABILITY_AND_PORTABILITY_LEDGER.md`;
7. `docs/vision/PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md`;
8. `docs/vision/PAON_EXPANDED_PROGRAMME_EXECUTION.md`;
9. the specific expanded product document linked by the active PHASE item
   (do not load every vision document for every tranche);
10. repository package/app scripts and the implementation files relevant to the
    next slice.

Inspect `git status`, recent commits, and remote divergence before editing.
The worktree may contain founder or concurrent-agent changes. Preserve and do
not stage, rewrite, delete, or absorb unrelated changes.

## Immediate sequencing

1. Inspect `git status`, recent commits, `docs/PHASE.md` and
   `docs/PROJECT_STATE.md`.
2. Take the first unchecked item in Stages 8–16 whose dependencies are
   complete. At this prompt's authoring point Stage 8.0/8.1 may already be in a
   pending or completed change; verify code and docs rather than assuming or
   rebuilding them.
3. Implement that item as the smallest complete vertical behavior. Do not dump
   a stage-wide speculative schema.
4. Run its focused checks and the repository definition of done; perform
   browser/a11y/RLS/live proof required by its acceptance criteria, recording
   hosted/provider gaps honestly.
5. Update `PHASE.md` and `PROJECT_STATE.md`, commit only the tranche, push it,
   and immediately repeat from step 1.

The canonical high-level order is already encoded:

- Stage 8: authority, six-section wardrobe, source-authority/workflow control;
- Stage 9: Migration Cockpit and demand-led connectors;
- Stage 10: campaigns, Seven-Day/Honeymoon and remote selling;
- Stage 11: workforce Mission Control and coaching;
- Stage 12: MeasurementMonitor, MTM/production and service partners;
- Stage 13: stock ledger, barcode/RFID, loss prevention and POS;
- Stage 14: PAON Métier and advanced cited intelligence;
- Stage 15: lifestyle network, rewards/concierge and MunroMerchant;
- Stage 16: consultancy/training/media and a demand-proven vertical pack.

Do not reorder a dependent stage merely because it is visually exciting.
Independent slices may continue around a real provider/hardware/payment
blocker. Record a material boundary change in a new append-only ADR and the
canonical queue rather than silently drifting.

## Core architecture rules

### Canonical model, familiar presets

Do not create pixel-for-pixel code forks of Shopify, Endear, Tulip,
Salesforce, NewStore, Stitchli, Atelierware, or Faden.

Implement one canonical data, permission, workflow, event, and API model with
source-specific familiarity presets:

- terminology aliases;
- navigation grouping;
- default landing pages;
- status display names/order;
- table columns/sorts;
- form field grouping/order;
- quick actions;
- report/KPI vocabulary;
- workflow defaults.

A detected import source may recommend its preset. Tenants can later switch to
PAON-recommended workflows. Presets never fork tenant isolation or business
semantics.

### Source authority

Every synchronized entity or field requiring co-system behavior has an
explicit authority. Do not implement naïve bidirectional sync.

Persist:

- source connection/system;
- external ID;
- source timestamps/cursors;
- raw record hash and immutable raw snapshot reference;
- mapping/transformation version;
- canonical ID;
- import batch;
- idempotency key;
- conflict/reconciliation state.

### Migration

Use owner-authorized API/export/database access as the preferred source. A
public website crawl is a catalog/media fallback only and cannot recover
private customers, orders, consent, messages, measurements, passwords, or
reliable inventory.

Migration flow:

connect/upload/crawl -> source inventory -> immutable raw ingest -> profile ->
map -> human approval for ambiguity -> stage -> validate/dedupe -> dry run ->
dependency-ordered import -> reconcile -> delta sync -> cutover -> final
report/rollback references.

AI may propose mappings, taxonomy, metadata, translations, duplicates, and
description cleanup. It may not silently merge identities, invent composition
or measurements, change money, invent consent, or publish unsupported facts.

### Workflow engine

Forms, states, transitions, required fields, permissions, SLAs, side effects,
and automations are versioned definitions. Existing instances remain bound to
their version unless an explicit migration is tested.

Enforce important outcomes at meaningful transitions while supporting
interrupted/exception reasons. Prefer five-second capture and a 60-second
closeout over giant forms.

### Evidence and AI

Retain the architecture:

capture -> raw evidence -> policy eligibility -> deterministic projector ->
sparse opportunity/recommendation -> human action -> outcome -> correction.

AI may summarize, rank, draft, and extract candidates from eligible evidence.
It may not become the untraceable authority for customer facts, money,
identity, measurement, inventory, or production commitments.

Every recommendation exposes evidence, reason codes, confidence, window,
version, eligibility/suppression, and customer/advisor feedback where
applicable.

### Tailoring

Treat measurements, fitting, garment specification, production, and materials
as first-class domains:

- measurement versions/deltas, never silent overwrite;
- garment references the approved measurement version;
- explicit post-approval/post-cut change decision;
- configurable stages;
- separately tracked garment pieces;
- barcode/QR first, optional RFID later;
- generated work tickets/tech packs/cut sheets/BOM;
- planned and actual material consumption;
- QC/rework/photos;
- workroom/outworker view with minimized customer identity;
- promised-date risk and service recovery;
- alteration outcomes update future fit intelligence.

### Commerce and inventory

Inventory is an auditable ledger. POS must eventually support RTW, service,
alteration, made-to-measure, deposits/balances through providers, quotes,
remote carts, suspended sales, returns/exchanges, and location/staff/customer
attribution.

Never store raw payment credentials or implement custom lending/payment
processing. Build provider-neutral domain capability and tested adapters;
record unavailable live credentials as a live-verification gap and continue
local/provider-contract work.

### Marketplace

The marketplace is a separate B2B bounded context with suppliers, listings,
MOQ, tiers, samples, customization/proofs, RFQ/quote, retailer approvals,
orders/PO references, shipments, issues, performance, and group buying.

Do not expose retailer consumer data to suppliers. Do not reuse the consumer
product catalog/order tables merely to move faster. Context-neutral primitives
may be shared.

### Training and management discipline

Translate selling training into actual software:

- versioned ceremonies;
- context-specific discovery prompts;
- objection/outcome taxonomy;
- roleplay/rubric;
- learning paths/certification;
- manager floor observations;
- coaching plans/actions;
- daily Clienteling Club;
- contactability, closeout, promise, and data-quality routines;
- outcome-based evaluation.

Do not optimize employee keystrokes, screenshots, raw clicks, or note volume.
Measure completion quality, customer response, appointments, sales, service,
repeat behavior, data correctness, and coaching outcomes.

### Workforce, wardrobe, campaigns, and specialist operations

- PAON may own schedules, worked-time exceptions, approvals and immutable
  pay-period exports while payroll/accounting remains external authority. Do
  not implement tax filing or salary payout by summing time entries.
- The customer wardrobe always distinguishes owned items, advisor suggestions
  and roadmap targets. `PhysicalGarment` remains official fit/service truth.
- MeasurementMonitor produces quality-scored fit-drift candidates and a
  reorder decision gate. It never silently overwrites approved measurement
  versions.
- A campaign is a versioned executable package: eligibility, exclusions,
  prerequisites, staff missions, customer placements, approved channel copy,
  operational capacity and outcomes. Do not reduce it to email templates.
- Corporate-fashion accounts/programmes/wearers are a retailer-owned B2B
  context with corporate roles. They are not ordinary consumer customers and
  cannot see the retailer's client book.
- Barcode/QR and RFID resolve to one serialized-asset/custody/stock ledger.
  Reader observations and counts reconcile; they do not directly set balance.
- Lifestyle partner commerce and MunroMerchant procurement remain separate
  contexts. Neither exposes raw customer profiles to partners/suppliers.

## Connector order

Build a generic staged-file adapter and Shopify first because they establish
the reusable pipeline and cover many prospects. Then prioritize by actual
prospect demand, with likely next adapters:

- Lightspeed X;
- Square;
- WooCommerce;
- Endear;
- Tulip;
- Salesforce;
- NewStore;
- tailoring CSV/vendor APIs.

Before implementing a connector, verify current official API/export
documentation and actual sample payloads/scopes if credentials are available.
Do not repeat broad competitor browsing already captured in the research
ledger.

## Working method

For each tranche:

1. establish the factual starting point from code, migrations, tests, and
   current authority;
2. choose one dependency-complete vertical slice that produces a usable
   behavior, not horizontal scaffolding;
3. model invariants in the domain package;
4. add forward-only schema changes and regenerate database types;
5. implement repository/service boundaries;
6. add the smallest complete role surface;
7. test domain, repository, RLS/tenant denial, integration/idempotency, and
   browser behavior in proportion to the slice;
8. run focused checks, then the repository-wide definition of done;
9. inspect the final diff for unrelated files, generated drift, secrets, fake
   data paths, and overclaims;
10. update canonical queue/programme/ADR/factual state honestly;
11. commit only the tranche, push, and immediately continue.

Do not produce a huge unverified schema dump. Do not add dead abstractions for
future stages. A foundation tranche must be exercised by at least one real
vertical flow.

Use migrations and types as the schema source of truth. Use the existing
domain/database package conventions. Do not bypass RLS with service-role code
in user-facing flows. Do not represent provider mocks as live provider proof.

## Usage discipline

Use the founder's model usage efficiently:

- do not repeatedly re-audit unchanged areas;
- do not rerun the entire suite after each tiny edit when focused tests can
  guide development;
- do run full required checks before declaring a slice complete;
- reuse the research/specification already written;
- inspect only the files and references needed for the current slice;
- do not create duplicate roadmaps or status documents;
- do not pause for routine confirmation;
- do not spend time polishing speculative UI before domain behavior works;
- do not leave a long-running command without a concise progress update.

## Real blockers

Stop only the affected operation for:

- a destructive or irreversible production-data action without an approved
  runbook;
- missing authority for an external state change;
- a genuine contradiction with an append-only ADR that cannot be resolved by
  a new explicit ADR;
- an unavoidable overlapping dirty-file conflict;
- required live credentials for live proof.

When live credentials are missing, build and test the local/provider-neutral
contract, record the exact live verification gap, and continue to another
independent item. Payment/legal/accounting uncertainty blocks activation of
that regulated behavior, not provider-neutral data models, catalog, RFQ,
workflow, tests, or unrelated stages.

Routine uncertainty, completion of one tranche, optional design preferences,
and the size of the overall programme are not blockers.

## Completion standard

The overall programme is not complete until the target capabilities in
`docs/vision/PAON_UNIFIED_RETAIL_OS_TARGET_ARCHITECTURE.md` are either:

- implemented and verified against the repository definition of done; or
- explicitly rejected/deferred by a later founder decision recorded in the
  canonical authority.

Never convert target wording into as-built wording early. Keep working
continuously through the queue.
