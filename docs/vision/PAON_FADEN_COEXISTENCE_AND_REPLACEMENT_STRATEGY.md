# PAON, Faden, and factory-ordering coexistence

**Status:** target architecture and product strategy. As-built claims remain in
`docs/PROJECT_STATE.md`; implementation authority remains in `docs/PHASE.md`.

## The blunt answer

Faden is not merely software between a store and an atelier. Its published
product covers a guided made-to-measure configurator, quotes and pricing,
versioned measurements, production board, workroom portal, tech packs, BOMs,
inventory, CRM, messaging, payments, reporting, a branded client portal and
multi-location operations.

That makes Faden a direct competitor to parts of PAON. It does **not** make
Faden the inevitable system for every menswear retailer:

- many retailers already submit orders through a factory-owned system such as
  GoCreate or a supplier portal;
- those systems are usually the production authority for that supplier;
- replacing them creates double entry without creating value;
- Faden's breadth overlaps PAON, but PAON's intended differentiation is the
  retailer-owned relationship layer: Self-Portrait, wardrobe intelligence,
  clienteling discipline, campaign infrastructure, workforce operations,
  service network, corporate-fashion portal and network commerce.

PAON must support replacement without requiring replacement.

## What Faden publicly offers

As of 2026-07-30, Faden's public product material states:

- guided garment configuration with live pricing;
- configurable cut/make/trim/QC/fitting stages;
- generated tech packs, cut sheets and BOMs;
- an outworker/factory portal with minimized client identity;
- tailoring CRM, pipeline, communications and follow-ups;
- two-way SMS, email threading and calling;
- versioned measurements, deltas and pre-cut alerts;
- deposits/balances and payment-provider support;
- Shopify order/report synchronization;
- inventory, fabric and trim tracking;
- a scoped, **read-only REST API** and outbound webhooks from the Atelier plan;
- CSV export and retailer ownership of its data.

Sources: [Faden product](https://www.faden.tech/features),
[Faden overview](https://www.faden.tech/), and
[Faden company principles](https://www.faden.tech/about).

A read-only API and webhooks are useful for ingestion and status mirroring.
They do not establish that PAON can create or mutate orders in Faden. A working
write-back must not be advertised until Faden documents a write API or a
partner agreement supplies one.

## The three operating modes

Every tenant chooses a mode per domain, not one irreversible setting for the
whole retailer.

### 1. Experience Overlay

Best for a retailer satisfied with Shopify, Faden, a factory portal or another
existing operational system.

PAON owns:

- customer login and retailer-branded experience;
- Self-Portrait, wardrobe, For You and MorningRoutine;
- advisor prompts, appointments, campaigns and relationship outcomes;
- knowledge, training and workforce routines;
- intelligence projections and owner dashboards.

The external system owns:

- product/stock and order authority where configured;
- payment settlement;
- production truth;
- accounting/payroll truth.

PAON ingests events and exposes one Mission Control. When an action cannot be
written through an approved API, PAON creates a resolved task with a deep link
to the source record and confirms completion from a subsequent webhook.

### 2. Co-managed

Best when PAON should own clients and selling but an atelier or commerce system
must continue downstream.

PAON owns the customer, discovery, approved garment specification, appointment
and clienteling state. An adapter exports or submits the approved specification
to the factory system. The external manufacturing reference and subsequent
status are mirrored back into PAON.

There is one explicit handoff transition:

`draft → approved in PAON → submitted externally → acknowledged → in production`

After acknowledgement, production fields owned by the external system cannot
be casually edited in PAON. Changes create a versioned change request with
impact and acknowledgement state.

### 3. Full PAON

Best for retailers actively replacing disconnected spreadsheets, CRM,
production boards, inventory and workforce tools.

PAON owns all configured operational domains while payment, accounting,
payroll/tax filing and delivery remain provider-backed. This mode is an
earned migration outcome, not an onboarding prerequisite.

## Source authority registry

Every synchronized aggregate or material field records:

- retailer and connection;
- domain (`catalogue`, `inventory`, `customer`, `order`, `payment`,
  `production`, `appointment`, `message`, `payroll`);
- configured authority (`paon`, `external`, `co-managed`);
- external object type and ID;
- external version/timestamp and cursor;
- immutable raw event/snapshot reference and hash;
- mapping version and canonical ID;
- last reconciliation state;
- allowed directions (`ingest`, `export`, `write_api`);
- operator-visible conflict and resolution.

There is no generic "two-way sync" switch. Authority is selected by domain and
field group, with transitions tested before cutover.

## Faden connector contract

### Inbound

Use Faden's scoped read-only API for a bounded backfill and reconciliation.
Use signed webhooks for order, payment and status changes. The connector:

1. verifies signature and timestamp;
2. stores the raw payload before mapping;
3. rejects replay through provider event ID and payload hash;
4. maps using a versioned transform;
5. upserts through external ID and idempotency key;
6. records unmapped states in a dead-letter queue;
7. recomputes PAON clienteling/appointment implications;
8. exposes connector health and lag without pretending a stale state is live.

### Outbound

Until a writable contract exists:

- export an approved specification as a deterministic file where supported;
- deep-link to the Faden client/order;
- create a PAON handoff task;
- confirm completion only after a webhook/API reconciliation;
- never browser-automate hidden order entry as production architecture.

### Imports and cutover

Faden advertises CSV exports. Migration Cockpit must profile the actual export
before committing to coverage. Clients, orders, measurements, fabrics,
communications and production history are separate dependency classes.
Missing IDs or ambiguous measurement versions require human mapping.

## How PAON avoids becoming another tool

The employee interacts with one PAON Mission Control:

- a role-specific Today queue;
- customer card and appointment workspace;
- universal search;
- inline source status and deep links;
- actions shown only when PAON can perform them;
- exception tasks when an external action is required;
- source-specific terminology presets without separate code forks.

The interface should say "Send to atelier", not "Open connector record".
Managers see the source, delay and reconciliation details; advisors see the
next correct action.

## Replacement criteria

Recommend Full PAON for a domain only when:

- the imported historical counts reconcile;
- employees have completed a realistic parallel-run workflow;
- permission and branch coverage are configured;
- provider integrations are live and monitored;
- rollback references and export exist;
- the external workflow causes more friction than the migration removes.

Recommend coexistence when the factory mandates its portal, the write API is
absent, or replacement would make staff type the same order twice.

## PAON's defensible advantage

PAON will not win by copying Faden's production board one screen at a time. It
can win by connecting production and commerce state to actions Faden does not
make the retailer's central operating model:

- a customer-owned-looking digital wardrobe operated by the trusted advisor;
- evidence-cited reasons to contact a client today;
- campaigns delivered as complete operational playbooks;
- enforced capture and post-appointment quality;
- workforce missions and visible extra-mile recognition;
- corporate-fashion delivery portals;
- preferred-tailoring and aftercare networks;
- retailer-to-lifestyle network commerce.

The product promise is not "one database replaces everything." It is "one
operating experience knows which system is authoritative and makes the next
action unmissable."
