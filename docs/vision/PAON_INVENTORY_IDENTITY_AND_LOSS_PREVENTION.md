# PAON Inventory Identity and Loss Prevention

**Status:** target product and technical design.

## Outcome

Every sellable unit, made-to-measure garment, component, transfer and service
handoff has a verifiable identity and an append-only chain of custody. Barcode
is the minimum viable physical interface. RFID is an optional acceleration
layer over the same ledger.

## One truth does not mean one database

The source-authority registry defines whether Shopify, another POS or PAON owns
the available-to-sell quantity. PAON still retains immutable observations,
reservations and reconciliations. It never overwrites an external stock number
without an event explaining the change.

The canonical inventory model separates:

- **Product/variant identity:** what the SKU is;
- **Serialized asset identity:** which individual unit or garment this is;
- **Stock ledger:** quantity deltas and reason codes;
- **Custody:** who/location/partner currently possesses a serialized asset;
- **Reservation:** temporary claim for cart, client hold, transfer or order;
- **Count observation:** what an employee or RFID reader observed;
- **Reconciliation:** approved difference between expected and observed.

## Barcode and QR

Support existing GTIN/EAN/UPC plus PAON-generated internal identifiers. A scan
resolves to a narrow action based on context:

- checkout: add variant or serialized unit;
- receiving: accept/reject against purchase order or transfer;
- transfer: pick, pack, dispatch and receive;
- stocktake: increment an observed-count session, never mutate stock directly;
- MTM: identify garment and individual jacket/trouser/waistcoat pieces;
- service: accept into alteration/dry-cleaning custody;
- delivery: verify release to customer or authorized collector.

Phone cameras work for low-volume stores. HID scanners work without a device
specific SDK. Printed labels include human-readable fallback.

Shopify itself now supports barcode-assisted transfers and receiving, which
validates that PAON should interoperate with that workflow rather than invent a
different physical ritual. Source:
[Shopify inventory transfers](https://help.shopify.com/en/manual/products/inventory/inventory-transfers/barcode-scanner).

## RFID

RFID is not "a better barcode" switch. It adds serialized, non-line-of-sight,
bulk observations. GS1 EPC/RFID identifies individual articles with SGTIN and
records movement through EPCIS-style events. Retail uses include receiving,
cycle counts, shelf availability, POS/EAS and returns. Source:
[GS1 system architecture](https://www.gs1.org/standards/gs1-system-architecture-document/current-standard).

PAON supports:

- EPC/S-GTIN attached to the same serialized asset;
- handheld sweep count sessions;
- reader zone and antenna metadata;
- confidence and duplicate-read collapse;
- `observed`, `entered_zone`, `left_zone` events;
- reconciliation rather than direct balance mutation;
- optional exit-reader anomaly when no sale/transfer/service event exists.

Start RFID only where unit volume or loss justifies tags, readers, site
calibration and operational training. Barcode remains a full first-class path.

## Ledger events

Minimum event types:

- `opening_balance`
- `purchase_order_received`
- `sale_committed`
- `sale_voided`
- `return_received`
- `reservation_created|expired|released|converted`
- `transfer_dispatched|received|short|over`
- `count_observed`
- `reconciliation_gain|loss`
- `service_custody_out|in`
- `supplier_return`
- `damage|sample|staff_use|gift|write_off`

Each event contains retailer, location, actor/device, source, external ID,
reason, quantity or serialized IDs, occurred/recorded timestamps, idempotency
key and reversal link. Posted events are reversed, never edited.

## Fraud and error prevention

Fraud prevention is evidence and exception design, not employee surveillance.

- require dual approval above configurable reconciliation thresholds;
- separate who counts from who approves when feasible;
- flag repeated void-after-scan, manual discounts, no-receipt returns,
  negative-stock sales and after-hours adjustments;
- compare dispatched serialized units with received units;
- alert on custody exit without sale/transfer/service authorization;
- require reason and optional evidence for damage/write-off;
- retain device/session and source timestamps;
- prevent an employee from approving their own high-risk adjustment;
- measure false-positive outcomes and remove noisy rules.

Manager view shows money-at-risk, items, source events and next resolution.
Employee view asks for a concrete exception resolution, not an accusation.

## Counts

A count is a session:

1. scope is frozen by location/zone/category;
2. expected balance is snapshotted but optionally hidden from counters;
3. observations arrive by barcode, RFID or manual exception;
4. duplicates and impossible identifiers are quarantined;
5. recount is assigned for material variance;
6. manager approves reconciliation;
7. ledger posts gain/loss with links to both counts.

Blind counts and rotating high-risk cycle counts reduce confirmation bias.

## MTM and service custody

A made-to-measure order has one garment identity plus optional piece
identities. A suit can therefore show that the jacket reached alterations
while trousers are still at the workshop. Work orders, partner pickups,
photos and return receipts reference the asset identity.

This same capability powers Preferred Tailoring: customer hands over a garment,
the retailer scans custody in, a partner scans pickup, work and price are
approved, and the customer receives the exact same serialized item back.

## Required surfaces

- mobile Scan console with explicit mode;
- Receiving and transfer queues;
- Count session and reconciliation review;
- serialized item chain-of-custody timeline;
- manager loss-prevention exceptions;
- source-authority and connector health;
- PAON Admin aggregate health without retailer customer-content browsing.

## Delivery order

1. stock ledger, reservations and location balances;
2. barcode receiving/transfers/counts;
3. serialized MTM/service custody;
4. loss-prevention rules and approvals;
5. one RFID reader adapter and count-session pilot;
6. EPCIS-compatible event import/export where customer demand justifies it.

RFID must not precede a correct ledger; otherwise PAON measures physical chaos
faster.
