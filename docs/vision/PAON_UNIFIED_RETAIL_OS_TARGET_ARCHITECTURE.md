# PAON Unified Retail OS — Target Architecture and Execution

Status: target architecture and proposed successor programme. It is not an
as-built claim and does not alter the active queue in `docs/PHASE.md`.

Research snapshot: 2026-07-30.

Companion research:
`docs/vision/PAON_COMPETITIVE_CAPABILITY_AND_PORTABILITY_LEDGER.md`.

## 1. Product definition

PAON is a multi-tenant Retail Relationship Operating System for independent
premium retailers and multi-location retail groups.

It joins:

- branded website and customer environment;
- ecommerce, POS, orders, returns, inventory, and customer accounts;
- profiles, relationship graphs, segmentation, loyalty, and analytics;
- clienteling, messaging, remote selling, appointments, and opportunities;
- made-to-measure configuration, measurements, fittings, production,
  alterations, delivery, and aftercare;
- selling ceremony, onboarding, coaching, and management accountability;
- evidence-cited AI intelligence and agents;
- migration and ongoing synchronization with existing systems; and
- a separate retailer-supplier procurement marketplace.

Menswear and made-to-measure remain the first complete vertical. The core data
model must support later vertical packs without diluting the first segment:
bridal, jewelry, premium womenswear, optical, luxury furniture, and high-touch
hospitality.

The customer-facing website is not discarded. It becomes one surface of a much
deeper system whose central object is the long-term retailer-customer
relationship.

## 2. Product principles

### 2.1 One relationship, many evidence streams

Declared preferences, browsing, favorites, swipe activity, conversations,
appointments, purchases, returns, fittings, measurements, garments, service,
advisor observations, important dates, and corrections must enrich the same
relationship without being flattened into unauditable prose.

### 2.2 Intelligence must create useful work

A dashboard number is only valuable when it produces one of:

- a decision;
- a preparation action;
- a customer contact;
- a service intervention;
- a stock/production action;
- a coaching action; or
- a verified learning that changes future behavior.

### 2.3 Strict outcomes, fast capture

PAON should enforce retailer-defined standards, but the interface must make
good behavior faster than avoidance:

- five-second quick capture during a conversation;
- voice/photo/document input converted to candidate facts;
- a 60-second appointment/order closeout;
- required information at meaningful transitions, not arbitrary page loads;
- progressive completion rather than a giant intake form;
- manager review of quality and exceptions, not surveillance theater.

### 2.4 The customer belongs to the retailer

Individual advisors may own relationships operationally, but the retailer must
retain:

- customer history;
- facts and evidence;
- communication continuity;
- upcoming obligations;
- measurement and service history;
- outcome attribution; and
- branch coverage when the normal advisor is absent or leaves.

The system should recognize primary and supporting advisors without making
customer knowledge private personal property.

### 2.5 Capability and policy are separate

The event, fact, workflow, and analytics models should be broadly capable.
Typed configuration determines:

- which events are collected;
- the purpose and retention class;
- who can see a fact or event;
- which data can influence recommendations;
- which channels and automations may activate;
- which fields can be exported; and
- which rules apply to a tenant or operating region.

This preserves the technical ceiling while avoiding a future rewrite when the
founder chooses different operating policies.

### 2.6 Open by design

Every tenant-facing domain requires:

- stable external IDs;
- bulk import;
- documented export;
- idempotent APIs;
- signed webhooks or an outbox;
- a reconciliation report; and
- source/provenance fields.

PAON should win because retailers prefer it, not because their data cannot
leave.

## 3. Operating modes

Retailers should not be forced through the riskiest possible onboarding.

### 3.1 Overlay

Another platform remains authoritative for ecommerce, POS, or payments. PAON
owns customer experience, clienteling, intelligence, appointments, training,
tailoring, and selected customer facts.

Best first fit:

- Shopify, Lightspeed, Square, or WooCommerce retailer;
- wants value quickly;
- does not want a checkout/POS cutover.

### 3.2 Co-system

Authority is assigned per entity and sometimes per field:

- Shopify owns online orders and payments.
- Lightspeed owns POS transactions and current stock.
- PAON owns clienteling, measurements, tailoring production, appointments,
  wardrobe, and opportunities.
- Shared customer/contact fields have an explicit conflict policy.

### 3.3 Full PAON

PAON owns storefront, accounts, products, POS, inventory, orders, clienteling,
tailoring, customer experience, and operations. External providers still
handle regulated payment processing, email/SMS/WhatsApp delivery, tax,
accounting, or shipping where appropriate.

This is the destination, not a mandatory first-day cutover.

## 4. User and role surfaces

### 4.1 Retail owner / general manager

Primary questions:

- Who is active or recently active and what meaningful intent is emerging?
- Which opportunities should the organization act on today?
- Are advisors doing the relationship work well?
- Is customer knowledge becoming cleaner and more institutional?
- Which branches, products, services, and workflows create repeat sales?
- Where are stock, production, service, and follow-up failures?
- What should be bought, changed, coached, or escalated?

Required surfaces:

- Today command center;
- live/recent customer presence with honest TTL;
- time/day/week/month/year demand heatmaps;
- opportunity and outreach funnel;
- appointment and branch load;
- data-quality and contactability coverage;
- customer ownership/coverage risk;
- revenue, margin, repeat, cohort, RFM, and influenced-sale analysis;
- production and service exceptions;
- coaching adoption and outcome trends;
- procurement recommendations and approvals.

### 4.2 Branch / store manager

Required surfaces:

- branch calendar and staffing/coverage;
- today's appointments with customer-card preparation;
- Clienteling Club agenda;
- overdue and high-value opportunities;
- outreach quality and contact pressure;
- appointment/order closeout completeness;
- data-quality conflicts and duplicates;
- floor observations and coaching queue;
- branch inventory/transfer needs;
- fitting, alteration, and delayed-order exceptions.

### 4.3 Advisor / salesperson

Required surfaces:

- today's customer queue;
- customer Self-Portrait and timeline;
- appointment preparation;
- quick note/notetaker;
- guided discovery and selling ceremony;
- product/wardrobe/fit recommendations;
- remote look, story, quote, and cart creation;
- customer contact and reply thread;
- closeout and promised-action capture;
- personal coaching and progress;
- clear handoff/coverage workflow.

### 4.4 Workshop, tailor, alteration worker, or outworker

Required surfaces:

- work queue by promised date, priority, stage, and skill;
- scan-to-open garment piece/job;
- specification, tech pack, cut sheet, and approved measurements;
- material issue/consumption;
- stage start/complete, photos, quality checks, and blockers;
- trial/fitting outcome and required rework;
- customer identity minimized where not operationally needed;
- piece-rate or time record where configured;
- capacity and reassignment.

### 4.5 Inventory and operations

Required surfaces:

- inventory ledger by location and state;
- receiving, transfer, reserve, allocation, sale, return, damage, and
  adjustment;
- fabric roll/lot and trim inventory;
- purchase orders and suppliers;
- material demand from open garment jobs;
- low stock, aged stock, and transfer recommendations;
- barcode/QR/RFID mapping;
- fulfillment, pickup, delivery, and service logistics.

### 4.6 Customer

Required surfaces:

- branded discovery and For You;
- wishlist, wardrobe/closet, saved looks, and purchases;
- product and made-to-measure configuration;
- appointments and wedding/group journeys;
- secure advisor messaging and remote proposals;
- carts, quotes, orders, payments through provider, and returns;
- measurement/fit visibility appropriate to the retailer;
- production/alteration/service status;
- loyalty, offers, events, and care;
- fact/preference review and correction where customer-visible.

### 4.7 PAON platform administrator

Required surfaces:

- tenant health and integration status;
- import/sync failures and reconciliation;
- schema/event version health;
- AI generation performance, cost, and groundedness;
- job queues, outboxes, and provider errors;
- tenant-isolation evidence and audit;
- no unrestricted browsing of retailer customer content.

### 4.8 Marketplace supplier

Required surfaces:

- organization and users;
- products, variants, customization, media, and documents;
- regional price lists, tiers, MOQ, samples, and lead times;
- quote/RFQ response;
- availability and production status;
- order, shipment, invoice reference, and returns;
- performance and buyer feedback;
- no access to retailer consumer/customer data.

## 5. Canonical domains

### 5.1 Tenant, organization, and access

Core entities:

- `tenants`
- `retailer_organizations`
- `retailer_branches`
- `staff_members`
- `staff_branch_assignments`
- `roles`
- `permissions`
- `role_permission_sets`
- `devices`
- `authenticated_sessions`
- `audit_events`

Requirements:

- row-level tenant isolation;
- branch-scoped permissions;
- configurable roles;
- manager coverage across branches;
- platform support access as explicit, time-bounded, audited impersonation if
  ever introduced;
- MFA/SSO capability in the architecture.

### 5.2 Party, identity, and relationships

Core entities:

- `parties` for people and organizations;
- `party_identities` for email, phone, account, loyalty, and source IDs;
- `retailer_customers` for the tenant-specific customer relationship;
- `households`;
- `party_relationships` for partner, spouse, parent, child, assistant,
  colleague, wedding-party member, and gift recipient;
- `customer_advisor_assignments`;
- `contact_points`;
- `contact_preferences`;
- `consent_records`;
- `important_moments`;
- `customer_facts`;
- `customer_fact_evidence`;
- `customer_fact_corrections`;

Identity rules:

- never merge on name alone;
- deterministic exact matches precede probabilistic suggestions;
- all merges are reversible and audited;
- preserve every source identifier;
- retain household and recipient relationships rather than overwriting a
  single profile.

### 5.3 Product, content, and knowledge

Core entities:

- `brands`
- `suppliers`
- `collections`
- `products`
- `product_variants`
- `product_options`
- `product_media`
- `price_lists`
- `prices`
- `tax_categories`
- `catalogue_concepts`
- `product_concept_assignments`
- `knowledge_articles`
- `content_assets`
- `content_usage_rights`

Metadata must support:

- garment/category;
- color and color family;
- material/fiber/composition;
- weave, texture, and pattern;
- construction and silhouette;
- fit and size;
- season and climate;
- occasion and formality;
- care;
- style compatibility;
- evidence, confidence, source, review, and acceptance.

### 5.4 Commerce, POS, and inventory

Core entities:

- `carts`
- `cart_lines`
- `quotes`
- `remote_proposals`
- `orders`
- `order_lines`
- `payments` as provider references/status, never raw credentials;
- `refunds`
- `returns`
- `exchanges`
- `fulfillments`
- `shipments`
- `receipts`
- `promotions`
- `gift_cards_or_stored_value` only after a separately authorized provider and
  accounting design;
- `inventory_locations`
- `inventory_items`
- `inventory_ledger_entries`
- `inventory_reservations`
- `stock_counts`
- `stock_transfers`
- `purchase_orders`
- `purchase_order_lines`
- `goods_receipts`

Inventory is a ledger, not a mutable integer without history.

POS requirements:

- product/variant/barcode search and scan;
- named or anonymous customer;
- readymade, service, alteration, deposit, and made-to-measure lines;
- discounts with permission/reason;
- split payment via provider;
- suspend/recall cart;
- quote and remote payment handoff;
- returns/exchanges;
- receipt;
- offline-tolerant queue only when conflict and payment semantics are designed;
- staff, location, and customer attribution.

### 5.5 Interaction, behavior, and communication

Core entities:

- `interaction_sessions`
- `interaction_events`
- `event_schema_versions`
- `messages`
- `message_threads`
- `message_attachments`
- `communication_deliveries`
- `communication_replies`
- `campaigns`
- `campaign_members`
- `contact_pressure_snapshots`
- `notes`
- `note_extraction_candidates`
- `tasks`
- `opportunities`
- `opportunity_outcomes`

Event envelope:

```text
event_id
tenant_id
source_system
source_record_id
idempotency_key
actor_type / actor_id
customer_id
session_id
correlation_id
causation_id
event_type
schema_version
occurred_at
received_at
timezone / local date parts
branch_id
channel
page / route / component
entity references
payload
purpose
policy_snapshot
retention_class
```

Never place passwords, payment credentials, arbitrary form contents, or
unbounded screen/mouse firehoses in the event payload.

### 5.6 Appointments, moments, and service

Core entities:

- `appointment_services`
- `appointments`
- `appointment_participants`
- `appointment_resources`
- `appointment_assignments`
- `appointment_status_history`
- `appointment_closeouts`
- `promised_actions`
- `recurring_moments`
- `service_cases`
- `service_recovery_plans`

An appointment participant is a customer relationship/card, not a static name
string. Guests can begin as provisional parties and be resolved later.

Closeout should capture:

- outcome and next step;
- products/categories considered;
- fit and preference observations;
- objections;
- occasion/date/budget changes;
- people/relationships mentioned with visibility;
- promised actions and owner;
- follow-up date;
- sale/quote/order reference;
- customer experience and service issue;
- extraction candidates requiring confirmation.

### 5.7 Wardrobe, wishlist, and recommendations

Core entities:

- `wishlists`
- `wishlist_items`
- `wardrobe_items`
- `wardrobe_item_sources`
- `outfits`
- `outfit_items`
- `style_profiles`
- `style_profile_evidence`
- `preference_facets`
- `recommendation_runs`
- `recommendation_candidates`
- `recommendation_impressions`
- `recommendation_feedback`

Candidate sources:

- declared quiz/preference facets;
- favorites and saved looks;
- swipe/Tie-Mate positive and negative signals;
- purchases and returns;
- wardrobe gaps;
- measurements and fit constraints;
- advisor-confirmed facts;
- important moments and appointments;
- recent behavior;
- weather/location where operationally appropriate;
- available inventory, lead time, and margin;
- diversity and novelty rules.

Every recommendation displayed to a customer or advisor needs:

- one or more reason codes;
- supporting evidence references;
- confidence;
- eligibility and suppression reasons;
- inventory/lead-time state;
- feedback capture.

### 5.8 Made-to-measure, fitting, and workshop

Core entities:

- `measurement_templates`
- `measurement_definitions`
- `measurement_sets`
- `measurement_values`
- `measurement_deltas`
- `fit_profiles`
- `posture_observations`
- `garment_designs`
- `garment_design_options`
- `configuration_price_rules`
- `custom_garments`
- `garment_specifications`
- `fittings`
- `fitting_observations`
- `alterations`
- `production_jobs`
- `production_pieces`
- `workflow_stages`
- `production_stage_events`
- `work_tickets`
- `tech_packs`
- `bills_of_materials`
- `material_lots`
- `material_reservations`
- `material_consumption`
- `quality_checks`
- `production_photos`
- `outworker_assignments`
- `worker_compensation_entries`

Non-negotiable rules:

- measurements are immutable versions, never a silently overwritten latest
  row;
- order/garment records reference the approved measurement version;
- changes after cut approval produce an alert and an explicit decision;
- stage transitions are audited and configurable;
- a garment order can contain several separately tracked pieces;
- customer identity is hidden from outworkers unless needed;
- every production promise has a branch timezone and owner;
- rework and failed quality checks remain visible;
- material consumption can be planned and actual;
- alteration outcomes feed the fit profile and future design.

### 5.9 Training, ceremony, and coaching

Core entities:

- `selling_ceremony_definitions`
- `ceremony_versions`
- `ceremony_stages`
- `ceremony_prompts`
- `discovery_question_sets`
- `objection_types`
- `approved_response_patterns`
- `roleplay_scenarios`
- `roleplay_attempts`
- `assessment_rubrics`
- `learning_paths`
- `learning_modules`
- `certifications`
- `floor_observations`
- `coaching_plans`
- `coaching_actions`
- `manager_checkins`
- `behavior_metrics`

The ceremony engine should be contextual:

- browse/walk-in;
- first wardrobe consultation;
- wedding organizer or guest;
- made-to-measure;
- fitting;
- collection/pickup;
- service recovery;
- remote selling;
- returning customer;
- high-value/VIC appointment.

It should not force identical language. Retailers configure brand voice,
required outcomes, optional prompts, and manager sampling.

### 5.10 Workflow and configuration engine

Core entities:

- `workflow_definitions`
- `workflow_versions`
- `workflow_states`
- `workflow_transitions`
- `workflow_transition_rules`
- `workflow_required_fields`
- `workflow_slas`
- `workflow_instances`
- `workflow_events`
- `automation_definitions`
- `automation_runs`
- `forms`
- `form_versions`
- `form_fields`
- `view_presets`
- `terminology_presets`

Illustrative definition:

```json
{
  "key": "mtm_order",
  "version": 3,
  "states": [
    "draft",
    "measured",
    "approved",
    "cutting",
    "making",
    "fitting",
    "qc",
    "ready",
    "delivered"
  ],
  "transitions": [
    {
      "from": "measured",
      "to": "approved",
      "requires": [
        "measurement_set_id",
        "garment_specification_id",
        "promised_at"
      ],
      "permissions": ["advisor", "manager"],
      "sideEffects": [
        "reserve_material",
        "generate_tech_pack",
        "notify_workshop"
      ]
    }
  ]
}
```

Definitions are versioned. Existing instances continue on their bound version
unless an explicit migration is tested.

### 5.11 Migration and synchronization

Core entities:

- `source_connections`
- `source_connection_scopes`
- `source_entity_authorities`
- `source_records`
- `source_cursors`
- `import_jobs`
- `import_files`
- `import_batches`
- `import_rows`
- `field_mappings`
- `transformation_rules`
- `identity_candidates`
- `deduplication_decisions`
- `reconciliation_runs`
- `sync_conflicts`
- `dead_letter_records`
- `cutover_runs`

Every imported entity retains:

- source system;
- external ID;
- source updated time;
- first/last seen;
- import batch;
- raw-record hash;
- transformation version;
- canonical record ID;
- confidence/review state where AI-assisted;
- source authority.

### 5.12 Retailer-supplier marketplace

This is a separate B2B commerce context, not a reuse of the consumer product
catalog with renamed labels.

The founder's
[MunroMerchants concept](https://nebelspiegel.com/phone/amam1.html) identifies
the underlying network problem correctly: hundreds of retailers independently
source packaging, hangers, mannequins, furniture, printing, websites, logistics,
and operational services, producing duplicated work, weak buying power, and
inconsistent execution. PAON turns that strategic idea into a neutral,
multi-supplier product rather than assuming Atelier Munro is the platform
operator.

Core entities:

- `marketplace_suppliers`
- `supplier_users`
- `marketplace_categories`
- `marketplace_listings`
- `marketplace_variants`
- `marketplace_customizations`
- `marketplace_price_lists`
- `marketplace_price_tiers`
- `marketplace_samples`
- `marketplace_availability`
- `requests_for_quote`
- `supplier_quotes`
- `marketplace_carts`
- `marketplace_orders`
- `marketplace_order_lines`
- `marketplace_shipments`
- `marketplace_returns`
- `group_buy_campaigns`
- `procurement_recommendations`
- `supplier_performance`

Initial categories derived from the founder's MunroMerchants concept:

- custom hangers and garment racks;
- garment bags and covers;
- paper bags, boxes, tissue, ribbon, labels, and shipping materials;
- mannequins;
- mirrors, lighting, store fixtures, and furniture;
- signage, cards, receipts, brochures, and seasonal POS materials;
- beverage/hospitality supplies;
- cameras, loss prevention, and operational equipment;
- cleaning and maintenance;
- design, photography, content, printing, logistics, and other services.

Required B2B mechanics:

- MOQ and pack size;
- sample request;
- tiered and retailer-specific pricing;
- customization fields and artwork/proof approval;
- lead time and production state;
- freight terms and regional availability;
- quote/RFQ for non-standard work;
- repeat/reorder;
- branch allocation;
- purchase approval and PO reference;
- supplier reliability and issue handling;
- group buying when several retailers can combine demand.

Intelligent procurement examples:

- "Your garment-cover usage implies 18 days remaining; supplier lead time is
  14 days."
- "Three wedding events and 42 expected fittings next month make a beverage
  and packaging replenishment sensible."
- "This branch's new seasonal window kit is unacknowledged."
- "Four stores need 80 hangers each; combining the order crosses the next
  price tier."

Consumer customer data never becomes marketplace supplier data.

## 6. Familiarity presets, not cloned products

The founder's onboarding objective is valid: switching should not require
employees to relearn every daily movement.

PAON implements:

- `shopify_commerce`;
- `lightspeed_pos`;
- `endear_clienteling`;
- `tulip_enterprise_clienteling`;
- `newstore_mobile_selling`;
- `atelier_tailoring`;
- `paon_recommended`;
- tenant-custom presets.

A preset controls:

- navigation grouping;
- terminology aliases;
- default landing page by role;
- table columns and sort;
- field grouping and order;
- statuses and their display names;
- quick actions;
- form density;
- notification defaults;
- ceremony/workflow defaults;
- reports and KPI vocabulary.

A preset does not fork the database schema, RLS model, business logic, or API.
Imported source detection can recommend a preset automatically. A tenant can
change presets or migrate gradually to PAON-recommended workflows.

## 7. Migration cockpit

### 7.1 End-to-end flow

```text
Connect source / upload files / authorize crawl
  -> inventory source entities, counts, fields, and date ranges
  -> ingest immutable raw snapshots
  -> profile data quality and relationships
  -> suggest mappings and transformations
  -> human approve source authority and ambiguous fields
  -> stage canonical records
  -> deterministic validate, deduplicate, and reconcile
  -> dry-run report
  -> import in dependency order
  -> compare counts, money, stock, links, and samples
  -> run delta sync
  -> cut over selected authorities
  -> retain rollback references and final source archive
```

### 7.2 Dependency order

1. tenant, branches, staff, roles;
2. customers, identities, relationships, consent, source IDs;
3. brands, suppliers, tax/categories, metadata;
4. products, variants, media, price lists;
5. inventory locations and opening ledger balances;
6. orders, lines, payments as references, refunds, returns;
7. appointments, messages, notes, tasks, facts;
8. measurements, designs, garments, fittings, alterations, production;
9. loyalty, wishlist, carts, campaigns, behavior;
10. derived segments, RFM, recommendations, and opportunities recomputed in
    PAON rather than blindly imported as truth.

### 7.3 AI's permitted role

AI may propose:

- field mappings;
- taxonomy/category mapping;
- title/description cleanup;
- translation;
- product metadata candidates;
- image classification;
- duplicate candidates;
- customer/company/household relationship candidates;
- note extraction candidates;
- anomaly explanations.

AI may not silently:

- merge customers;
- invent product composition or care claims;
- change financial totals;
- create consent;
- invent measurements;
- overwrite source records;
- publish unreviewed low-confidence catalog facts;
- convert an inference into a customer fact.

### 7.4 Reconciliation

Every migration report must cover:

- entity counts by status and date range;
- order and refund gross/net totals by currency;
- line-item linkage;
- customer-order linkage coverage;
- product/variant/media counts;
- stock totals by item/location/state;
- missing and duplicate external IDs;
- orphan records;
- unmapped enums/fields;
- attachment/media failures;
- consent/contactability counts;
- sample record comparisons;
- accepted, rejected, warning, and dead-letter rows.

Cutover is not complete because an import job says `success`.

### 7.5 Source of truth

Authority is explicit by entity and, where unavoidable, by field:

```text
customer.email -> Shopify until cutover
customer.style_facts -> PAON
inventory.available -> Lightspeed
appointment -> PAON
order.payment_status -> Shopify/provider
garment.production_status -> PAON
```

Avoid naïve bidirectional sync. It creates loops, stale overwrites, and
unexplainable conflicts.

## 8. Data-quality and workflow enforcement

### 8.1 Profile quality

Measure:

- identity confidence;
- at least one usable contact channel;
- contact preference/consent state;
- advisor coverage;
- recent verified preference evidence;
- important-date completeness where relevant;
- fit/measurement freshness;
- unresolved contradictions;
- duplicate risk;
- promised-action completeness;
- stale inferred facts;
- customer corrections awaiting resolution.

Show missing data only when there is a legitimate interaction in which it can
be collected naturally.

### 8.2 Transition gates

Examples:

- An appointment cannot be marked fully closed without outcome, next step, and
  promised-action ownership; it can be saved as interrupted with a reason.
- A made-to-measure order cannot move to approved without a bound measurement
  version, garment specification, price, promised date, and material decision.
- A job cannot move past QC without configured checks or an authorized waiver.
- An advisor cannot mass-contact customers over pressure thresholds without
  manager override and a reason.
- A merge cannot execute without a deterministic match or approved review.

### 8.3 Manager routines

- daily 30-minute Clienteling Club;
- opening briefing;
- appointment preparation exceptions;
- end-of-day promise and closeout review;
- weekly data-quality sample;
- weekly opportunity outcome review;
- monthly ceremony/coaching baseline and action plan;
- seasonal customer, stock, and event planning.

### 8.4 What not to measure

Do not optimize for:

- raw click count by employee;
- constant screenshot recording;
- keystrokes;
- time-on-screen without task context;
- artificially high notes/tasks;
- outreach volume without quality, reply, or outcome.

These measures create gaming and mistrust rather than institutional customer
knowledge.

## 9. Intelligence products

### 9.1 Evidence-cited affinity

Example:

> Across 10 distinct suit views in 4 sessions over 21 days, 8 were brown.
> Brown suits are a strong recent interest. Most recent evidence: yesterday.

Required data:

- numerator and denominator;
- distinct product and session counts;
- time window;
- accepted product metadata;
- polarity;
- confidence;
- evidence links;
- low-sample suppression.

### 9.2 Interest progression

Detect movement:

```text
category impression
  -> repeated product views
  -> filter/color/material concentration
  -> favorite/save/swipe
  -> appointment/message
  -> quote/cart
  -> purchase
```

An advisor message such as "started looking at shoes" should only appear after
a configured threshold and should say what evidence caused it.

### 9.3 Moments and hooks

Examples:

- one month after purchase;
- first fit check after delivery;
- wedding date and annual anniversary;
- birthday;
- seasonal wardrobe transition;
- garment-care interval;
- replacement cycle based on actual purchase/condition;
- delayed order/service recovery;
- new collection matching a confirmed preference;
- customer recently active after a long lapse;
- wishlist item now available;
- wardrobe gap before a known event;
- finance bonus month explicitly recorded by an advisor/customer;
- job change, move, travel, or event explicitly recorded with review/visibility.

Sensitive or unusual facts require clear provenance and must never be inferred
from stereotypes.

### 9.4 Daily opportunity queue

Each opportunity contains:

- customer and branch;
- why now;
- evidence;
- suggested action;
- suggested channel and time;
- product/look/service candidates;
- inventory and lead-time state;
- contact pressure;
- priority and confidence;
- assignee and due/expiry;
- accept, snooze, dismiss, incorrect;
- task/message/appointment/order outcome.

The queue is sparse by design. A smaller list that gets completed is superior
to hundreds of generic "reach out" tasks.

### 9.5 Temporal intelligence

Produce owner, manager, and advisor messages from:

- sign-in and meaningful activity hotspots by local hour;
- weekday and month seasonality;
- payday/bonus periods only where explicitly configured or recorded;
- campaign/event response;
- weather and season where relevant;
- appointment lead time;
- reply/conversion time by channel;
- branch staffing/capacity;
- customer-specific response history.

Examples:

- "Signed-in customers are 2.1x more active Thursday 19:00–21:00 than the
  weekly hourly average; schedule the new-arrival story at 18:45."
- "Wedding inquiry activity peaks 9–12 weeks before local ceremony months;
  open preparation outreach next week."
- "This customer usually replies to advisor WhatsApp between 17:30 and 19:00;
  no contact has occurred in 18 days."

The message must expose comparison window, sample size, and timezone.

### 9.6 Feedback intelligence

Aggregate:

- appointment closeout;
- messages;
- returns and exchange reasons;
- alterations/rework;
- reviews;
- customer corrections;
- service cases;
- product engagement;
- campaign replies.

Separate:

- product issue;
- fit issue;
- service issue;
- content confusion;
- stock/lead-time issue;
- advisor/process issue;
- isolated anecdote vs emerging pattern.

### 9.7 Complete-look intelligence

Generate looks from:

- live catalog and inventory;
- customer wardrobe;
- measurements and fit constraints;
- occasion and climate;
- style evidence;
- retailer styling rules;
- outfit compatibility graph;
- price/budget band;
- novelty/diversity;
- advisor overrides.

Never recommend nonexistent stock as immediately available. Remote proposals
can distinguish in-stock, transfer, supplier order, and made-to-order.

### 9.8 Operational agents

Agents can prepare and propose:

- migration mappings;
- customer/appointment briefs;
- message drafts;
- remote looks/carts;
- data-quality fixes;
- production-delay summaries;
- stock transfer suggestions;
- reorder/RFQ drafts;
- coaching summaries;
- campaign audiences;
- customer-service recovery plans.

High-impact actions remain approval-gated:

- sending customer communications;
- merging/deleting identities;
- changing price;
- placing supplier orders;
- refunding/capturing money;
- committing production dates;
- changing durable customer facts;
- publishing AI-enriched product claims.

## 10. Live presence and activity dashboard

### 10.1 Honest states

Use heartbeats and visibility:

- `active`: recent meaningful activity and heartbeat inside the active TTL;
- `idle`: heartbeat present but no meaningful activity inside idle threshold;
- `recent`: last seen within configured recent window;
- `offline`: heartbeat expired;
- `unknown`: session ended or network state prevents certainty.

Never show "online" indefinitely after a tab sleeps or closes.

### 10.2 Customer list

For identified, signed-in customers within the retailer's environment:

- customer;
- sign-in/session start time;
- active/recent state;
- branch/storefront context;
- current PAON route family or journey;
- last meaningful action;
- high-level products/categories involved;
- session duration;
- assigned advisor;
- actionable opportunity, if any;
- contact-pressure state.

Anonymous visitors should be aggregated until legitimately resolved to a
customer identity.

### 10.3 Depth

PAON can technically retain detailed semantic activity inside PAON:

- routes and content;
- product/card/image/variant impressions;
- dwell and scroll thresholds;
- search/filter/sort/compare;
- favorites, negative swipes, cart, checkout, appointment, and message events;
- recommendation impressions and corrections;
- active/idle/visibility and session continuity;
- device class, viewport, locale, source/UTM, and local time.

The event schema should capture semantic decisions, not every mouse movement.
The value comes from conclusions and actions, not a voyeuristic replay feed.

## 11. Vertical packs

### 11.1 Premium menswear and tailoring — first

Adds:

- garment/style metadata;
- measurements and posture;
- made-to-measure configurator;
- fittings and alterations;
- wedding/group;
- wardrobe and outfit;
- materials, workshop, and aftercare;
- menswear ceremony and objections.

### 11.2 Bridal

Adds:

- party/relationship graph;
- ceremony and event dates;
- bridal-party roles;
- appointments/fittings by participant;
- deposits and staged obligations via provider;
- alteration deadlines;
- size/measurement change alerts;
- accessories, gifts, referrals, and anniversary moments.

### 11.3 Jewelry

Adds:

- recipient and occasion graph;
- ring/wrist/necklace sizing;
- metal, stone, style, and sensitivity preferences;
- provenance/certificate and serial references;
- personalization/engraving;
- repair, cleaning, inspection, insurance valuation, and warranty;
- private viewing and approval workflows.

### 11.4 Optical

Adds:

- exam/appointment;
- prescription versions and expiry;
- frame/lens compatibility;
- facial/fit measurements;
- lab job and status;
- insurance/provider references;
- remake/adjustment/repair;
- replacement and eye-exam reminders.

Medical/health fields require a more restrictive data class and role model
than ordinary style preferences.

### 11.5 Premium furniture/interiors

Adds:

- household/project/room graph;
- measurements and floor plans;
- samples and material boards;
- quote/revision/approval;
- made-to-order lead time;
- delivery/install;
- designer/trade relationships;
- care/service and future-room opportunities.

### 11.6 Hospitality

Adds:

- guest/stay/reservation;
- companions/household;
- service and room preferences;
- itinerary/occasion;
- pre-arrival preparation;
- requests and fulfillment;
- service recovery;
- property consistency and next-stay prediction.

These packs reuse identity, relationship, event, workflow, appointment,
communication, opportunity, catalog, commerce, and marketplace primitives.
They do not force all vertical fields into every retailer's UI.

## 12. As-built PAON foundation

Repository evidence as of this document:

Already present or materially started:

- multi-tenant retailers, staff, roles, and customer links;
- products, variants, collections, storefront, carts, and orders;
- appointments and availability;
- customer fit-profile entries;
- alterations and alteration workflows;
- loyalty, referrals, events, messages, notifications, wishlist, and
  preferences;
- behavioral analytics and interaction sessions;
- wedding parties;
- customer and retailer portals plus PAON admin;
- catalogue metadata, knowledge, bulk import, and AI enrichment;
- wardrobe, outfits, MorningRoutine, campaigns, private offers, and concierge
  services;
- provenance-aware customer facts;
- evidence-cited interest projection;
- sparse clienteling opportunities and contact pressure;
- active Stage 7.5 work for branches, calendar, and appointment closeout.

Not yet credible as complete:

- complete POS and inventory ledger;
- refunds/returns/exchanges and full omnichannel order management;
- production-grade source connectors and migration cockpit;
- Endear/Tulip-level messaging and remote-selling suite;
- Faden/Atelierware-level made-to-measure production operations;
- versioned measurement deltas and cut locks;
- tech packs/BOM/material consumption;
- garment-piece barcode/QR workflow;
- workroom/outworker portal and capacity;
- worker compensation;
- executable selling ceremony and continuous coaching;
- supplier marketplace;
- vertical packs beyond menswear;
- production deployment and external-provider proof for every surface.

No roadmap may present target items as landed until code, migration, tests,
browser evidence, tenant isolation, and deployment evidence meet the active
definition of done.

## 13. Proposed execution programme

### Programme gate

Finish or safely hand off the active Stage 7 slice before editing its files.
Then record a new append-only architecture decision that:

- accepts this broader Retail OS target;
- preserves the evidence/provenance rules already landed;
- replaces obsolete pricing assumptions with configuration-neutral language;
- separates provider-neutral marketplace/RFQ/PO capability from regulated
  payment activation;
- authorizes a successor queue without falsely marking target capability
  complete.

### Stage 8 — Canonical interoperability and configuration kernel

Deliver:

- external source IDs and authority registry;
- source-record provenance;
- versioned workflow engine;
- versioned forms and field requirements;
- terminology/navigation/view presets;
- audit/outbox/idempotency conventions;
- role/branch permission review.

Acceptance:

- one sample appointment and one sample garment workflow run through versioned
  definitions;
- changing a definition does not mutate existing instances;
- source authority conflicts fail visibly;
- presets change presentation, not tenant data semantics;
- RLS and cross-tenant denial tests.

### Stage 9 — Migration Cockpit and first adapters

Deliver:

- source connection and file-upload surfaces;
- immutable raw staging;
- field mapper and transformation registry;
- dedupe/identity review;
- dry run, reconciliation, dead letter, resume, and rollback references;
- generic CSV/XLSX/JSON adapter;
- Shopify adapter;
- public catalog crawler as fallback;
- Lightspeed X, Square, and WooCommerce adapters next.

Acceptance:

- migrate a realistic fixture tenant with customer, product/media, order/line,
  stock, consent, and external IDs;
- rerun is idempotent;
- one changed source record produces one reconciled delta;
- no password/payment credential import;
- count and financial reconciliation;
- media copying and failure report;
- browser-tested operator flow.

### Stage 10 — Clienteling and remote-selling parity

Deliver:

- unified customer timeline;
- richer advisor book and coverage;
- multimodal notetaker candidate extraction;
- messaging channels/provider abstraction and reply threading;
- appointments and preparation;
- Stories/lookbooks;
- remote proposals, quotes, and carts;
- opportunity outcomes;
- configurable RFM/segments;
- manager assignment and contact-pressure rules.

Acceptance:

- voice/text/photo note fixture proposes facts/tasks/message and requires
  confirmation;
- advisor can prepare, send an approved remote look, receive a reply, create
  appointment/cart, and link sale outcome;
- manager can assign/cover customer without losing history;
- opt-out/channel failure suppresses activation;
- no invented facts in generated copy.

### Stage 11 — Selling ceremony, onboarding, and coaching

Deliver:

- ceremony designer and versions;
- contextual discovery prompts;
- closeout integration;
- objection/outcome taxonomy;
- roleplay and rubric;
- learning paths and floor certification;
- manager observation;
- coaching plans;
- daily Clienteling Club;
- behavior-to-KPI outcome analysis.

Acceptance:

- a retailer configures first-visit and MTM ceremonies;
- advisor sees only context-relevant prompts;
- manager observation creates a coaching action;
- seven-day review compares baseline and adoption;
- completion quality cannot be gamed by empty checkboxes.

### Stage 12 — Made-to-measure and workshop operating system

Deliver:

- measurement templates and immutable versions/deltas;
- design/configurator and pricing rules;
- custom garment/spec;
- fitting cycles and fit learning;
- configurable production board;
- pieces, barcodes/QR, work tickets;
- generated tech pack/cut sheet/BOM;
- fabric/trim lots, reservations, planned/actual consumption;
- QC, photos, rework, promised-date risk;
- workroom/outworker portal;
- capacity and configured compensation.

Acceptance:

- complete suit flow from consultation to delivery;
- trouser/jacket pieces scan independently;
- approved measurement version is locked to garment;
- post-cut change produces explicit risk/decision;
- material reservations and actual consumption reconcile;
- outworker cannot see unnecessary customer identity;
- alteration outcome creates fit delta for next garment;
- delayed job creates service-recovery/clienteling action.

### Stage 13 — POS, inventory, and omnichannel commerce

Deliver:

- inventory ledger/reservations/transfers/counts;
- POS for RTW, services, alteration, deposit, and MTM;
- quotes, remote carts, suspended sales;
- returns/exchanges/refunds via provider references;
- fulfillment/pickup/delivery;
- purchase order and receiving;
- commerce source-authority modes.

Acceptance:

- online, remote, and store sale update the same canonical inventory or
  configured source sync;
- mixed RTW + MTM + alteration transaction;
- return and exchange preserve financial and stock history;
- no oversell under tested concurrent reservation;
- provider failure is retryable/idempotent;
- closing totals reconcile.

### Stage 14 — Advanced intelligence and role dashboards

Deliver:

- temporal hotspots and cohort messages;
- interest progression;
- complete-look stylist;
- visual search;
- feedback intelligence;
- customer/branch/store opportunity ranking;
- fit and production risk;
- inventory/transfer/reorder recommendation;
- role-specific live/recent presence;
- AI evaluation and cost/groundedness monitoring.

Acceptance:

- every action recommendation cites source records/events and version;
- correction/deletion recomputes conclusions;
- sample-size/timezone/window visible;
- inventory and lead-time honest;
- role permissions proven;
- false-positive/incorrect feedback affects evaluation;
- live presence expires honestly.

### Stage 15 — Lifestyle network and MunroMerchant

Stage 15 ships two deliberately separate bounded contexts. The customer-facing
lifestyle network (Capolavoro Online / MunroMarché) and retailer-facing
MunroMerchant B2B procurement share no catalogue, cart, order or customer
table. Canonical design for the network half is
`PAON_LIFESTYLE_ECOSYSTEM_AND_NETWORK_COMMERCE.md`; nothing below is claimed as
implemented software.

#### Stage 15 (network) — Capolavoro Online / MunroMarché

Deliver:

- partner/publisher/programme/listing records with explicit commercial type
  (editorial outbound, affiliate, qualified lead, booking, supplier-fulfilled,
  local partner) and mandatory disclosure class;
- retailer curation, placement mapping, competitor/category exclusion and
  activation over a contracted programme;
- zero-stock lifestyle categories: books, art and design, hospitality,
  restaurants, travel, automotive, golf, jewelry and watches, grooming,
  culture, events and experiences;
- lifestyle concierge requests with owner, SLA, options, quote/approval,
  exception and outcome;
- network rewards on an append-only funded/pending/available/reversed/expired
  liability ledger;
- third-party publisher/media cards carrying rights, territory, expiry,
  attribution, outbound link and retailer activation eligibility;
- MunroMentions invitations that never copy the referrer's identity into the
  invitee record;
- distinct retailer, partner, publisher, advertiser, fulfiller and PAON portals
  with minimum-data scopes per role;
- Audience Studio: cited eligibility rules, versioned cohorts, policy-aware
  reachable-size forecasting and holdout membership;
- advertising inventory: placements, orders, line items, flights, creatives,
  budgets, pacing and frequency caps;
- economics: CPM, CPC, CPL, CPA, affiliate, sponsorship and booking fee;
- append-only idempotent billable/outcome event stream: impression,
  viewability, click, lead, booking, conversion, refund, reversal;
- attribution with opaque IDs, incrementality experiments, deduplication keys
  and fraud-review disposition;
- canonical multi-party revenue-sharing ledgers for retailer, publisher,
  partner/fulfiller, advertiser settlement and PAON platform fee;
- governed insight modes: aggregate insights, retailer benchmarking,
  PAON-executed audiences, pseudonymous attribution, clean-room matching,
  contracted data exchange, retailer exports and customer-requested named
  introductions;
- provenance, purpose, contract, entitlement, retention, correction, deletion
  and recomputation fields on every network fact and event.

Acceptance:

- a retailer activates a disclosed partner listing and a customer reaches the
  partner through a placement that never resembles retailer-held stock;
- an attributed conversion holds, then reverses on refund, without erasing
  history, and the reversal propagates to every affected ledger share;
- a partner, publisher or advertiser receives tokens, placements and outcomes —
  never a raw Self-Portrait or retailer client list;
- billable events replay idempotently under duplicate provider callbacks;
- a cohort is version-pinned so a later rule edit cannot silently restate a
  past forecast or a past payable;
- correction or deletion of a customer fact recomputes derived eligibility,
  cohorts, forecasts and payable projections;
- every commercial model, portal role and event type is representable while
  activation is disabled by policy, so a later legal or founder restriction is
  configuration rather than schema deletion;
- no lifestyle network table is reachable from MunroMerchant procurement, and
  no consumer customer row is exposed to a supplier;
- live advertising, payment, stored value and licensed media remain gated on
  contracts and credentials.

#### Stage 15 (procurement) — MunroMerchant marketplace

Deliver:

- supplier portal;
- B2B listings and categories;
- tier/MOQ/sample/customization;
- RFQ/quote;
- retailer cart/order/PO;
- proofs, lead time, shipment, and issue;
- approval policies;
- group buying;
- procurement recommendation from operational demand;
- provider-neutral payment boundary.

Acceptance:

- custom paper-bag flow from sample/RFQ through proof approval and delivery;
- standard hanger reorder;
- furniture quote;
- multi-retailer group buy;
- no consumer customer data exposed to supplier;
- marketplace order is distinct from retailer consumer order;
- activation of money movement remains provider- and decision-gated.

### Stage 16 — Vertical-pack framework and second-vertical pilot

Deliver:

- extension schema/configuration convention;
- vertical-specific terminology, forms, workflow, facts, and dashboards;
- choose one second vertical using evidence from actual prospects;
- migration fixture and complete customer journey.

Acceptance:

- core upgrades do not fork;
- menswear UI remains focused;
- second vertical completes a full relationship/service/commerce loop;
- any sensitive domain fields have appropriate role/data classification.

## 14. Per-slice definition of done

A slice is complete only when:

- domain model and invariants exist;
- forward migration and generated types are current;
- repository and service boundaries are used;
- RLS/cross-tenant denial is proven;
- import/sync is idempotent where relevant;
- focused tests and full repository checks pass;
- relevant desktop/mobile browser journeys pass;
- accessibility is checked;
- empty/error/retry states are real;
- observability and audit are included;
- target/as-built documentation is updated honestly;
- one intentional commit is pushed;
- the next independent slice begins automatically.

## 15. What would be stupid or infeasible

The following should be rejected even inside an ambitious build:

- claiming a public website crawl can recover private operational data;
- importing or storing raw card data;
- treating passwords as portable customer profile data;
- copying competitors pixel for pixel and maintaining separate code forks;
- building naïve bidirectional sync without entity authority;
- overwriting measurements instead of versioning;
- letting AI merge identities, invent product facts, or send mass outreach
  without the configured approval path;
- using mutable inventory counts without a ledger;
- mixing marketplace supplier access with retailer consumer records;
- claiming all target capabilities are implemented because screens or schema
  stubs exist;
- attempting every vertical before one complete vertical has real users.

These are not reductions in ambition. They are failure modes that would make
the larger product less capable.
