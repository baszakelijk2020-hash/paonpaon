# PAON Expanded Product Programme and Execution

**Status:** canonical target decomposition for the founder's 2026-07-30
expansion brief. `docs/PHASE.md` alone authorizes implementation order and
`docs/PROJECT_STATE.md` alone records what is shipped.

## Product thesis

PAON is a relationship-and-operations layer for premium independent retail.
It can coexist with a retailer's commerce, factory, accounting and payroll
systems while progressively replacing modules whose friction exceeds their
value.

The connected loop is:

```mermaid
flowchart LR
  evidence["Customer, advisor, commerce and service evidence"]
  portrait["Self-Portrait and wardrobe"]
  intel["Cited conclusions and moments"]
  mission["Customer, advisor and manager missions"]
  action["Appointment, campaign, proposal, order or service"]
  operations["Inventory, workforce, production and partner operations"]
  outcome["Outcome, correction and learning"]

  evidence --> portrait --> intel --> mission --> action --> operations --> outcome
  outcome --> evidence
```

Customers should experience relevance, confidence and care. Advisors should
experience a clear next action. Managers should experience operating control.
Owners should experience adoption and outcomes rather than software shelfware.

## Product surfaces

### Customer

- retailer-branded storefront/account;
- For You and MorningRoutine;
- Self-Portrait and preferences;
- six-section wardrobe, outfits and roadmap;
- appointment/event calendar;
- order/Honeymoon tracker;
- concierge/Preferred Tailoring;
- campaigns, rewards, referrals and lifestyle.

### Employee/advisor

- Mission Control Today;
- customer book/Self-Portrait;
- appointment preparation/closeout;
- remote looks/proposals/messages;
- tasks/promises/opportunities;
- scan/stock/service actions;
- learning, I AM and extra-mile recognition.

### Manager/owner

- branch mission control;
- calendar, coverage and workforce approvals;
- clienteling/contact/data-quality;
- sales/inventory/service/production;
- campaigns and campaign library;
- corporate programme;
- partner/service network;
- connector/migration health;
- strategy/consultancy library.

### Corporate wearer/client

- employee profile/fitting/order/service portal;
- manager readiness/allocation/exception dashboard;
- procurement/PO/reporting view.

### Partners

- workshop/outworker;
- alterations/cleaning/logistics;
- lifestyle/affiliate;
- MunroMerchant supplier.

### PAON

- taxonomy/knowledge/campaign/vertical-pack administration;
- connector/projection/AI/operational health;
- partner/programme administration;
- no unrestricted retailer customer-content browsing.

## Bounded contexts

| Context               | Authority and responsibility                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| Identity/Tenancy      | users, retailer roles, branches, corporate and partner memberships           |
| Interoperability      | connections, authority registry, raw ingest, mappings, reconciliation        |
| Customer Relationship | retailer-customer identity, timeline, facts, consent, contactability         |
| Catalogue/Knowledge   | products, accepted metadata, educational and editorial objects               |
| Wardrobe/Fit          | owned items, outfits, roadmap, official garment fit and self-scan candidates |
| Clienteling/Campaigns | opportunities, tasks, messages, appointments, campaign instances/outcomes    |
| Workforce             | schedules, time, approvals, missions, coaching and recognition               |
| MTM/Production        | spec, measurement versions, pieces, work, materials, QC and factory handoff  |
| Inventory             | ledger, reservations, serialized assets, counts, transfers and custody       |
| Services              | plans, bookings, work orders, partners, custody and cost                     |
| Corporate Fashion     | programmes, roles, wearers, allocations, rollout and exceptions              |
| Lifestyle Network     | partner programmes, listings, attribution, concierge and rewards             |
| B2B Marketplace       | retailer procurement, suppliers, RFQ, proof, PO and fulfillment              |

Boundaries compose through stable IDs/events. They do not copy a customer,
product, order or balance into every module.

## Cross-product invariants

1. One source authority per material field group.
2. Immutable raw input before transformation.
3. Posted money, stock, time and measurement history is reversed/versioned,
   not overwritten.
4. Declared, advisor-observed, transactional and inferred facts remain
   distinguishable.
5. Recommendations cite evidence, model/projector version and confidence.
6. AI drafts/extracts/ranks; it does not invent authoritative facts.
7. Human decisions exist at ambiguity, fit, financial and customer-contact
   gates.
8. Provider activation and technical capability are separate planes.
9. All user-facing data is tenant/relationship scoped and RLS protected.
10. Workflow definitions are versioned; active instances do not drift.

## Requirements

### Interoperability

- `INT-001` source authority and external identity registry.
- `INT-002` signed webhook/raw event/idempotency pipeline.
- `INT-003` versioned mapping, reconciliation and connector health.
- `INT-004` overlay/co-managed/full-PAON operating modes.
- `INT-005` source-familiar terminology/navigation presets.

### Wardrobe and fit

- `WRD-101` six permanent wardrobe sections.
- `WRD-102` low-friction image/order/advisor ingestion.
- `WRD-103` owned/suggested/roadmap separation.
- `WRD-104` wear/outfit/calendar/coverage intelligence.
- `FIT-101` self-scan evidence and review.
- `FIT-102` baseline drift and reorder decision gate.
- `FIT-103` fit learning from delivered garment and alteration outcome.

### Workforce

- `WFM-101` schedule, clock, break, exception and approval.
- `WFM-102` immutable payroll/accountant package.
- `WFM-103` unified missions/tasks/promises/briefing.
- `WFM-104` closeout and I AM/extra-mile recognition.
- `WFM-105` explainable demand/coverage recommendation.
- `WFM-106` selling ceremony, learning and coaching.

### Inventory

- `INV-101` auditable stock ledger and reservations.
- `INV-102` barcode receiving/transfers/counts.
- `INV-103` serialized garment/piece/service custody.
- `INV-104` loss-prevention exceptions and approvals.
- `INV-105` optional RFID/EPC observations over the same ledger.

### Corporate fashion

- `CORP-101` corporate account/programme/role/wearer model.
- `CORP-102` versioned role catalogue and entitlement engine.
- `CORP-103` employee onboarding/fitting/order portal.
- `CORP-104` rollout/exception/readiness operations.
- `CORP-105` care/replacement/leaver/asset lifecycle.
- `CORP-106` tender workspace and demonstrable solution.

### Campaigns

- `CMP-101` versioned PAON campaign library and tenant copies.
- `CMP-102` deployment/prerequisite/preview workflow.
- `CMP-103` staff mission + customer in-app + channel orchestration.
- `CMP-104` outcome, pressure, experiment and correction.
- `CMP-105` Seven-Day Wardrobe.
- `CMP-106` Honeymoon Phase.
- `CMP-107` relationship calendar packages including Valentine/overcoat,
  milestone, family, annual-event and referral.

### Services and ecosystem

- `SRV-101` location partner directory/capability/SLA.
- `SRV-102` wardrobe service intake and serialized custody.
- `SRV-103` quote, cost, partner invoice and reconciliation.
- `NET-101` partner/listing/programme and retailer curation.
- `NET-102` attribution, holding, reversal and reporting.
- `NET-103` lifestyle concierge and media.
- `NET-104` explicit rewards liability/transfer architecture.

### Knowledge and productization

- `KNW-101` customer/staff/owner/media library separation.
- `KNW-102` guided MTM tier and design packages.
- `KNW-103` contextual DailyBriefing.
- `KNW-104` MunroMentor roleplay/rubric/coaching.
- `KNW-105` future proprietary-product incubation register.

## Dependency order

### Horizon A — Control plane

`INT-001`–`INT-005`, versioned workflow, branch/role review and product event
contracts. This lets every later module coexist with existing tools.

### Horizon B — Daily operating value

`WRD-101`, `WFM-101`–`WFM-104`, `CMP-101`–`CMP-103` and `INV-101`–`INV-102`.
These create visible customer and manager value without waiting for full POS,
factory replacement or network commerce.

### Horizon C — Service and specialized operations

`FIT-*`, `SRV-*`, `INV-103`–`INV-105`, `CORP-*`, production/workshop and
clienteling parity.

### Horizon D — Network effects

`NET-*`, MunroMerchant and vertical packs after real retailers use the core
loops.

This sequence does not shrink the vision. It prevents later modules from
creating conflicting customer, stock, time, money and source truths.

## Continuous tranche rule

One tranche is one complete, user-visible vertical behavior. It includes:

- domain rules;
- forward migration/types if needed;
- repository/service;
- smallest relevant surface;
- tenant/RLS/idempotency tests;
- browser/a11y verification;
- factual docs;
- one intentional commit and push.

Cursor continues to the next dependency-complete tranche without asking for a
new prompt. It stops only the affected operation for a real blocker and then
continues independent work.

## First authorized tranche sequence

1. `WRD-101` six-section wardrobe over the shipped wardrobe foundation.
2. `INT-001` authority registry exercised by a Faden/staged-file fixture.
3. `WFM-101` time exception/approval/pay-period foundation over existing roster.
4. `CMP-101` versioned library + one tenant copy and in-app preview.
5. `INV-101` ledger exercised by barcode receiving/count.
6. `CORP-101`–`CORP-103` thin corporate employee pilot.
7. `SRV-101`–`SRV-102` partner directory and wardrobe service custody.
8. Continue target Stages 9–16 as dependencies become complete.

## What is implemented now

At authoring time, PAON already has material foundations for catalogue,
customers, appointments, orders, loyalty, wardrobe, MorningRoutine,
clienteling intelligence, branches, campaigns, concierge and roster/time
entries. The six-section wardrobe is the first implementation in this expanded
programme.

Everything else in this document is a target until `PROJECT_STATE.md` records
verified code, migration and test evidence.

## Explicit non-claims

- A Faden read-only API is not a writable order integration.
- A payroll export is not salary/tax administration.
- A self-scan drift candidate is not an approved measurement.
- RFID observations are not stock truth until reconciled to the ledger.
- A tracked click is not proof of incremental sale.
- A technical reward ledger is not approved stored value.
- A partner listing is not an executed commercial partnership.
- A target screen described here is not shipped software.
