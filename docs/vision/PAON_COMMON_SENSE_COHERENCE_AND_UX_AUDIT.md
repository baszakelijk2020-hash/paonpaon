# PAON Common-Sense System Coherence and UI/UX Audit

**Audit date:** 2026-07-30  
**Verdict:** **AMBER — substantial real foundations, incomplete connected
operating system**  
**Authority:** this document is an audit and completion gate. `docs/PHASE.md`
authorizes work; `docs/PROJECT_STATE.md` records factual shipped state.

## Brutally honest conclusion

PAON is not a static HTML mock-up. It has real domain rules, forward database
migrations, repositories, tenant isolation, role surfaces and tests. The
completed Stage 7 intelligence work, source-authority registry, workflow
versioning and six-rail wardrobe are material software.

PAON is also not yet the complete connected product described by the founder.
Most of the expanded programme remains queued in Stages 10–16. Several current
status claims are too generous:

- Stage 9.1 calls the migration cockpit complete while its own landed note says
  full catalogue/product write-through and the Playwright operator journey are
  follow-ons. A receipt is not a migrated catalogue, stock position or order.
- Stage 9.2 implements valuable Shopify/Faden fixtures and contracts, but a
  fixture verifier is not yet an installed, scheduled, observable connector.
- A module is not complete merely because its table, repository and first
  screen exist. The originating role, receiving role, state transition,
  exception path, persisted outcome and next-module handoff must work.
- Green lint, types, unit tests and build prove code quality, not product
  coherence. Seeded multi-role browser journeys are required.

The correct description is: **real platform foundations plus several working
vertical slices, with the larger operating-system loops still under
construction.**

## Status vocabulary

Every programme item must use one of these states. A checked PHASE box may only
mean `verified`.

| State                    | Meaning                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `target`                 | Specified and queued; no shipped claim                                                          |
| `implemented_unverified` | Material code exists, but a required integration, role journey or proof is missing              |
| `verified_local`         | Complete against deterministic local/provider fixtures and full browser flow                    |
| `verified_live`          | Also proven against the named hosted/provider/hardware environment                              |
| `blocked_external`       | Local implementation complete; named external credential/contract/device blocks only live proof |
| `deferred`               | Deliberately outside the current sequence but retained in the ledger                            |
| `excluded`               | Deliberately not a PAON software responsibility, with a recorded reason                         |

`implemented_unverified` is not failure. Calling it `complete` is the failure.

## What “real and working” means

A feature is `verified_local` only when all applicable rows are evidenced.

| Layer                | Required evidence                                                                       |
| -------------------- | --------------------------------------------------------------------------------------- |
| Domain               | Rules, invariants, states, transitions and failure behavior exist outside the UI        |
| Persistence          | Real canonical records are written/read; posted history is versioned or reversed        |
| Security             | Tenant, branch, relationship and role isolation are tested                              |
| Service              | Repository/API performs the use case idempotently and exposes observable errors         |
| Originating UI       | The initiating role can complete the action without developer tools                     |
| Receiving UI         | The next responsible role sees and can act on the result                                |
| Cross-module handoff | Stable IDs/events connect the next module; no copy/paste or dead-end receipt            |
| Exceptions           | Empty, loading, stale, permission, conflict, failure, retry and correction states exist |
| Outcome              | Success produces a persisted, attributable outcome rather than only a toast             |
| Browser proof        | A deterministic seeded multi-role journey proves the real UI and database state         |
| Operations           | Audit trail, health/reconciliation and support path exist                               |
| Documentation        | PHASE and PROJECT_STATE describe exactly what is and is not proven                      |

A screenshot, a fixture returned directly to a component, a receipt without
canonical write-through, or a single-role happy path is not enough.

## Verification without token waste

The audit is a guardrail, not a demand for perfection before movement.

- Use focused domain/repository/RLS tests while building; run the full
  repository DoD once before the tranche commit.
- Reuse one deterministic linked retailer seed and extend it minimally. Do not
  build a new demo world for each module.
- Require a multi-role browser path when the feature actually crosses roles or
  authorities. Pure domain/infrastructure changes may cite focused tests and a
  later consuming journey.
- Prove the primary operating device in the tranche. Run a consolidated phone/
  tablet/desktop and accessibility sweep at the end of the stage.
- Do not create bespoke tests for impossible or unaffected states. `n_a` needs
  a one-line rationale, not an essay.
- Store evidence as terse file/test references. Do not spend a model turn
  writing celebratory verification prose.
- Keep minor copy, spacing, secondary-device and rare recovery defects in a
  small stage-end repair ledger. Fix them together.
- Never defer data loss, wrong authority, tenant/RLS leakage, invalid money/
  stock/time/measurement history, migration failure, broken build or a dead
  end in the primary workflow.

This deliberately accepts some repairable defects. The objective is roughly
10–20% verification overhead for materially steadier delivery, not doubling
usage in pursuit of theoretical completeness.

## Source-of-truth sanity

PAON must have one named authority for each material truth.

| Truth                 | Authority                                                           | Never allow                                         |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Customer identity     | retailer-customer identity plus external-identity registry          | silent AI merges                                    |
| Declared preference   | customer declaration or confirmed advisor observation               | inference silently promoted to fact                 |
| Product/catalogue     | configured PAON or external source by domain                        | two writable masters                                |
| Stock                 | append-only inventory ledger                                        | mutable quantity field as final truth               |
| Order lifecycle       | configured order authority plus immutable mapped events             | UI-only status changes                              |
| Money                 | posted transaction/reward/commission ledger and provider references | calculated balance without postings/reversals       |
| Official measurements | approved measurement/spec version                                   | photo inference overwriting measurements            |
| Fit learning          | candidate evidence plus advisor decision                            | automatic approval from one image                   |
| Working time          | punches, corrections, approvals and pay-period versions             | manager spreadsheet becoming invisible truth        |
| Customer contact      | channel thread/message/outcome and consent state                    | free-text “contacted” with no event                 |
| Partner custody       | serialized garment handoff events                                   | garment disappearing into a partner status          |
| Corporate entitlement | versioned programme/role allocation                                 | ad hoc quantities edited per wearer with no version |

## Logical dependency corrections

### 1. Migration must create the records later modules consume

The correct flow is:

`raw source -> mapping -> approved staged rows -> canonical customer/product/
stock/order writes -> reconciliation -> authority/delta sync -> downstream use`

Campaigns, inventory, wardrobe and order tracking must not consume import
receipts as substitutes for products, balances or orders. Stage 9.1 therefore
needs real catalogue/product, stock and order write-through plus a seeded
operator journey before it is complete.

### 2. A connector is a running system, not only a mapping fixture

A usable connector needs connection configuration, secrets handled outside the
database payload, cursor/checkpoint state, scheduled or webhook execution,
signature/replay controls, raw-event retention, dead letters, reconciliation,
health, pause/resume and a tested disconnect. Live credentials can block
`verified_live`; they do not excuse missing local execution infrastructure.

### 3. Campaigns are orchestration over shared objects

The campaign library must not become a parallel CRM. One activation must
produce the existing/shared:

- eligibility snapshot and cited audience;
- staff mission or customer placement;
- message/proposal/appointment/cart/order handoff;
- contact-pressure and suppression event;
- customer/advisor/manager-visible outcome;
- experiment and correction trail.

The campaign is the programme definition and instance. It does not duplicate
customers, products, tasks, messages, orders or outcomes.

### 4. Honeymoon Phase belongs to the order lifecycle

Honeymoon is not merely marketing copy. It begins with an actual order and
uses authoritative milestones, lead time, stock and appointment data. It must
join:

`order -> production/delivery milestone -> customer tracker -> advisor action
-> preparation/add-on proposal -> collection appointment -> payment decision
-> wardrobe -> fit/aftercare -> measured outcome`

If the order never advances, the campaign must visibly pause or create an
exception; it must not send fictional celebratory messages.

### 5. Seven-Day Wardrobe belongs to wardrobe truth

The seven-day plan must distinguish owned garments, advisor suggestions and
purchase gaps. A gap can create a proposal or appointment, but never silently
become an owned item. A purchase becomes wardrobe truth only through order
fulfilment or a confirmed manual import.

### 6. Workforce Today is the single employee work queue

Appointments, campaign missions, customer promises, inventory exceptions,
service work, data-quality prompts and learning assignments should feed one
prioritized Today surface. Separate module-specific task lists create the
exact operational fragmentation PAON claims to solve.

### 7. Employee recognition must close a management loop

“Extra mile” is not a social feed alone. It needs employee evidence, linked
customer/operation where appropriate, manager acknowledgement/coaching, and a
non-gameable history. Volume leaderboards would reward logging, not service.

### 8. Corporate wearers are not ordinary retail customers

PAON Métier needs corporate account, programme, location, role, wearer,
entitlement and employer permissions. A wearer may also be a personal retail
customer, but the identities and access grants must be linked, not collapsed.
The employer must not automatically see the employee’s private retail profile.

### 9. Service partners need custody and cost truth before convenience UI

A wardrobe “book cleaning” button is incomplete without quote/authorization,
pickup/handoff, serialized custody, SLA exception, QC, return, partner invoice,
customer charge/store-credit decision and reconciliation.

### 10. RFID is an observation layer, not stock truth

Barcode/QR and RFID resolve to the same serialized asset and ledger. RFID reads
are noisy observations that are deduplicated and reconciled; they never edit
stock directly.

### 11. Lifestyle commerce and MunroMerchant are separate

They may share partner identity, contracts, media and attribution primitives,
but:

- Lifestyle network is retailer-to-customer curation, concierge and referral.
- MunroMerchant is supplier-to-retailer procurement, proofs, RFQs, POs and
  fulfilment.

Consumer customer data must not leak into supplier procurement.

### 12. MeasurementMonitor augments approved fit

Private capture produces quality evidence and a candidate decision. An advisor
accepts no-action, review or remeasure. It cannot present Face-ID-like certainty
or silently rewrite official measurements.

## Complete connected journeys

These journeys are the minimum common-sense browser proof. Each one changes
real persisted state and is continued by another role.

### Journey A — Honeymoon Phase

1. Advisor creates or imports a real order.
2. The authoritative order event starts the pinned Honeymoon programme.
3. Customer sees honest status, expected range and next action.
4. A milestone creates a prioritized advisor mission.
5. Advisor prepares collection, proposes only available/lead-time-valid items
   and books the appointment.
6. Customer saves, declines or accepts the proposal.
7. Any pay-at-collection action uses an explicit provider/eligibility decision.
8. Fulfilment adds confirmed garments to the wardrobe.
9. Fit/aftercare follow-up records an outcome and corrects future actions.
10. Manager sees contact, conversion, pressure and service exceptions.

### Journey B — Seven-Day Wardrobe

1. Customer/advisor builds seven editable day contexts.
2. System composes owned-first outfits with reason codes.
3. Missing categories become cited gaps, not fake owned products.
4. Advisor reviews a gap and creates a proposal or appointment.
5. Customer saves/rejects/accepts it.
6. Order/fulfilment updates the wardrobe and coverage score.
7. Campaign outcome attributes the result without claiming causality it cannot
   prove.

### Journey C — Clienteling campaign

1. PAON publishes a versioned library campaign.
2. Retailer clones a pinned version, maps products/content/locations and
   previews customer plus employee views.
3. A rehearsal proves prerequisites, exclusions and pressure limits.
4. Activation creates shared missions/placements/messages.
5. Customer response becomes an appointment, proposal, cart or decline.
6. The result updates the relationship timeline and campaign outcome.
7. A correction or opt-out suppresses future actions.

### Journey D — Workforce and appointment

1. Manager publishes branch schedule and responsibilities.
2. Employee Today combines appointment prep, customer promises and exceptions.
3. Customer card opens the same Self-Portrait, wardrobe, facts and history
   used by clienteling.
4. Appointment closeout confirms structured facts and follow-ups.
5. Employee logs an extra-mile act with evidence.
6. Manager acknowledges or coaches it.
7. Approved time produces a versioned accountant/payroll package without
   customer data.

### Journey E — Preferred Tailoring

1. Customer or advisor selects a real wardrobe garment.
2. Location capability/SLA selects an eligible partner.
3. Quote and authorization create a service order.
4. Pickup scans custody to courier/partner.
5. Partner performs work with minimum customer data and records QC.
6. Return scan restores custody; customer accepts the result.
7. Partner cost and customer charge/store credit reconcile.
8. Garment history and future fit recommendation update.

### Journey F — Corporate fashion

1. Retailer creates a corporate programme and versioned role entitlements.
2. Employer imports/invites wearers by location and role.
3. Wearer completes private contact/fit/onboarding details.
4. Retailer schedules fit, approves exception and places order.
5. Production/inventory issues serialized garments against entitlement.
6. Wearer tracks arrival, care, replacement and service.
7. Transfer/leaver flow recovers or writes off assets with approval.
8. Employer and retailer see separately scoped readiness and exceptions.

### Journey G — Lifestyle partner

1. Approved partner publishes a contracted listing/programme.
2. Retailer curates and activates it for an eligible audience.
3. Customer sees why it is relevant and the commercial disclosure.
4. Click/lead/booking uses an opaque attribution token, not a raw profile.
5. Partner confirms or rejects the outcome.
6. Refund/cancellation reverses commission/reward.
7. Retailer, partner and PAON see their permitted reconciliation views.

### Journey H — Migration and coexistence

1. Operator connects or uploads a realistic source package.
2. PAON preserves raw input and profiles every entity.
3. Operator resolves mappings and ambiguous identities.
4. Dry run reports actual dependencies, counts, units and money.
5. Publish writes canonical customers, products, stock and orders.
6. Reconciliation proves source-to-target totals and dead letters.
7. Authority registry governs subsequent deltas/conflicts.
8. Operator can resume, correct and identify rollback references.
9. Downstream wardrobe/campaign/order screens consume the imported records.

## UI/UX information architecture

The expanded vision contains dozens of capabilities. Exposing each as a
top-level menu item would recreate the fragmentation PAON is meant to remove.
The UI should be organized around role jobs and shared objects.

### Customer

Primary navigation:

- Home;
- Wardrobe;
- Appointments;
- Orders;
- Messages/Services;
- More.

For You, MorningRoutine, campaigns, lifestyle, rewards, Honeymoon actions and
anniversary prompts are contextual cards or sections, not twelve separate
apps. Every recommendation states why it appears and offers dismiss/correct.

### Advisor/employee

Primary navigation:

- Today;
- Clients;
- Calendar;
- Sell;
- Messages;
- Operations;
- Learn.

Today is the default. A client record is the shared launch point for
Self-Portrait, wardrobe, appointment, proposal, order, fit and service work.

### Manager/owner

Primary navigation:

- Mission Control;
- Team;
- Clients;
- Campaigns;
- Inventory/Operations;
- Analytics;
- Settings.

Mission Control prioritizes exceptions and required decisions. It must not be a
wall of vanity charts.

### Corporate wearer

Primary navigation:

- My clothing;
- Fit/appointments;
- Orders;
- Care/service;
- Help.

### Corporate manager/procurement

Primary navigation:

- Programme;
- People/readiness;
- Orders/allocations;
- Exceptions;
- Reports.

### Service/workshop partner

Primary navigation:

- Jobs;
- Pickup/return;
- Exceptions;
- Invoices.

Partners see only the operational data needed for the job.

### PAON administrator

Primary navigation:

- Platform health;
- Libraries;
- Integrations;
- Partner/programme operations;
- Tenant support with explicit audited access.

Admin convenience is not authority to browse retailer customer content.

## Actual navigation audit at 2026-07-30

This is not only a future recommendation. The current route shells show the
problem already:

- The authenticated customer shell exposes **15 sidebar destinations**. Eight
  sit inside “For you”: Home, For You, Saved, Wardrobe, MorningRoutine, Private
  offers, Loyalty and Services. Several compete to answer the same customer
  question: “what should I care about now?”
- A fully privileged non-workshop retailer user can see up to **23 sidebar
  destinations** across Today, Fitting room, Relationships, Merchandise and
  Atelier. `Today` still links to five separate route inboxes rather than
  absorbing their actionable work.
- The PAON admin shell exposes **11 destinations**. Integration, intelligence,
  AI and enrichment health are usefully distinct operational domains, but they
  need one exception summary and consistent drill-down rather than four
  independent monitoring habits.
- The mobile docks are materially better: four prioritized destinations for
  customer and employee roles. That priority discipline should govern desktop
  information architecture too.
- The retailer shell already adapts navigation for workshop roles and
  permissioned capabilities. That is a real strength to preserve when
  consolidating navigation.

The correction is not deleting capability. It is:

1. one customer Home that composes For You, MorningRoutine, offers, loyalty and
   service moments;
2. one employee Today queue that composes appointments, promises, messages,
   campaign missions and exceptions;
3. shared customer/order/garment pages as the place to continue work;
4. manager Mission Control as an exception and decision surface;
5. secondary library/configuration routes available through contextual entry
   points and search rather than permanent primary navigation.

The repository also already contains real wedding-party foundations:
`wedding_parties`/members, RLS, invite/join RPCs, party/member photos,
height/weight preparation, fitting status and customer/retailer pages. The
Moonstruck target therefore extends this functioning group-fitting base; it
must not create a second wedding-party aggregate.

## UI/UX acceptance matrix

Every new user-facing slice must evidence:

| Concern        | Required behavior                                                                 |
| -------------- | --------------------------------------------------------------------------------- |
| Orientation    | Page title, role context, current object and next action are obvious              |
| Continuity     | Back/forward, deep links and post-action destination preserve the task            |
| Responsive use | Phone, tablet and desktop layouts serve the actual role context                   |
| Loading        | Skeleton/progress describes what is happening; no indefinite spinner              |
| Empty          | Explains why empty and gives the permitted next action                            |
| Error          | Human explanation, retry/recovery and support reference                           |
| Permission     | No data flash; safe explanation without disclosing existence                      |
| Stale/conflict | Shows whose truth is newer and offers reconcile/refresh                           |
| Success        | Shows resulting state and the next responsible role/action                        |
| Accessibility  | Keyboard, focus, labels, contrast, target sizes and reduced motion                |
| Performance    | Lists paginate/virtualize; images resize; expensive intelligence is async         |
| Trust          | Reason, source/provenance, confidence and correction are available where relevant |
| Density        | Summary first; details on demand; no mobile desktop-table squeeze                 |
| Terminology    | Familiar preset may rename/group, but the same object semantics remain            |

## Current UX risks

| Risk                     | Consequence                         | Required correction                                              |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| Module proliferation     | Employees learn many mini-apps      | Role homes, shared object pages and contextual actions           |
| Dashboard inflation      | Owners see charts without decisions | Exception-first cards with owner, cause and action               |
| Duplicate tasks          | Staff miss promises across modules  | One task/mission contract and Today queue                        |
| Static campaign previews | Retailer cannot trust real outcome  | Preview with seeded real mappings and customer/staff views       |
| Fake “live” language     | Damages trust                       | TTL/source timestamp and recent-vs-live vocabulary               |
| Mobile tables            | Store-floor use becomes painful     | Scan/task card flows and progressive disclosure                  |
| AI prose walls           | No one acts                         | Structured conclusion, evidence, suggested action and correction |
| Hidden permissions       | Confusing empty pages               | Explicit role-aware empty/denied states                          |
| Dead-end success toast   | No operational continuation         | Navigate/show the created object and receiving role status       |
| Demo-only sample data    | Browser verification says little    | Deterministic multi-role seed with realistic linked lifecycle    |

## Enforceable audit gate before programme expansion

Before Stage 10 continues beyond its first library foundation:

1. Reclassify Stage 9.1 and 9.2 using the status vocabulary.
2. Finish canonical product/stock/order migration write-through.
3. Implement local connector execution infrastructure beyond mapping fixtures.
4. Add a deterministic seeded retailer with customer, advisor, manager,
   corporate and partner identities as needed by each journey.
5. Add a browser test that proves migration records appear in downstream
   customer/order/catalogue surfaces.
6. Add machine-readable per-tranche evidence with:
   `domain`, `migration`, `repository`, `origin_ui`, `receiver_ui`, `rls`,
   `exceptions`, `browser`, `operations`, `live_gap`.
7. Reject PHASE completion when an applicable field is absent, a referenced
   repository artifact/browser spec does not exist or `n_a` lacks an explicit
   rationale. A non-empty string is not proof.
8. Run the validator in the root/CI definition of done so it cannot be skipped
   by an agent that merely checks the PHASE box.
9. Make the browser proof mutate state through the originating role UI, show
   it to the receiving role, assert the canonical database result and exercise
   direct authorization denial. Reading seeded objects and checking that a
   forbidden navigation link is hidden is not the connected journey.
10. Preserve external live proof as a named `blocked_external` gap rather than
    blocking independent programme work.

## Final audit judgment

The product map can work logically, but only if PAON keeps one set of shared
truths and closes the journeys above. The founder’s ideas are strongest when
they become orchestrated moments over wardrobe, order, fit, relationship and
operational evidence. They become weak when implemented as isolated cards,
static microsites or disconnected dashboards.

The next correct action is therefore not to stop the vision. It is to make
Cursor prove each part as a connected, multi-role, persisted journey and to
stop using “complete” for fixture-only or receipt-only implementations.
