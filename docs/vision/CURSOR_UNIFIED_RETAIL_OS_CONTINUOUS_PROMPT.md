# Cursor Continuous Prompt — PAON Unified Retail OS

Copy everything below the line into Cursor Agent when the current Cursor run is
ready to receive the expanded programme. This is one continuous instruction,
not a sequence of prompts.

---

You are continuing work in the PAON repository. Work autonomously and
continuously toward the complete target. Do not stop after one tranche merely
to ask whether you should continue. Complete one bounded vertical slice at a
time, verify it, commit it intentionally, push it, update factual authority,
and immediately take the next independent buildable slice.

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
8. repository package/app scripts and the implementation files relevant to the
   next slice.

Inspect `git status`, recent commits, and remote divergence before editing.
The worktree may contain founder or concurrent-agent changes. Preserve and do
not stage, rewrite, delete, or absorb unrelated changes.

## Immediate sequencing

1. Resume the exact active item in `docs/PHASE.md`. At the time this prompt was
   authored, Stage 7.5 had landed and 7.6 was in progress, but verify current
   code and authority instead of assuming this is still true.
2. Complete the remaining buildable Stage 7 items with their existing
   acceptance criteria and verification. Do not reopen completed items without
   evidence of a defect.
3. After Stage 7 is green, add one append-only ADR that authorizes the Unified
   Retail OS successor programme described by the two vision documents.
4. In the same documentation-only authority tranche:
   - integrate a concise successor queue into the canonical programme and
     `PHASE.md`;
   - give every tranche stable requirement IDs, dependencies, owner boundary,
     acceptance, tests, non-goals, and real blockers;
   - preserve factual as-built versus target language;
   - state that the earlier prices were exploration, not architecture;
   - separate provider-neutral marketplace/catalog/RFQ/PO work from activation
     of money movement;
   - preserve the evidence, provenance, correction, policy, tenancy, and
     human-approval rules already landed.
5. Then execute the successor queue continuously, beginning with the smallest
   dependency-complete vertical slice. The target sequence is:
   - canonical interoperability/configuration kernel;
   - Migration Cockpit and first adapters;
   - clienteling/remote-selling parity;
   - selling ceremony/onboarding/coaching;
   - made-to-measure/workshop OS;
   - POS/inventory/omnichannel commerce;
   - advanced intelligence and role dashboards;
   - MunroMerchant marketplace;
   - vertical-pack framework and an evidence-selected second-vertical pilot.

You may refine tranche boundaries based on actual repository dependencies.
Record material changes in the append-only ADR/queue rather than silently
drifting.

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
