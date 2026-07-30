# PAON Métier — Corporate Fashion Operating System

**Status:** target product and technical design.

## The product

PAON Métier lets an independent menswear retailer win and operate corporate
clothing projects for hotels, airlines, hospitality groups and other
employers. The tender advantage is not a prettier uniform configurator. It is
proof that the retailer can remove the administrative burden after the tender
is won.

Current uniform platforms validate the operational pattern: branded employee
portals, role-specific catalogues, allowances, budgets, approval rules,
employee size rosters, multi-location shipping and consolidated reporting.
UniformMarket publicly describes role-based portals and allowance/rule
configuration at aviation scale; Get WorkGear emphasizes allocations,
approvals and employee self-ordering. Sources:
[UniformMarket](https://www.uniformmarket.com/) and
[Get WorkGear](https://www.getworkgear.com/).

PAON's opportunity is to combine that foundation with a retailer-led fitting,
alteration, care, replacement and relationship experience.

## Parties and roles

### Retailer

- account director owns the corporate relationship and tender;
- project manager configures programme, catalogue, rollout and exceptions;
- fitters run measurement sessions and approve fit profiles;
- branch/warehouse workers pick, personalize and deliver;
- finance views purchase orders, invoices and reconciliation.

### Corporate client

- executive sponsor sees programme health and outcomes;
- procurement owns commercial approval and PO/budget;
- HR/workforce admin maintains eligibility, role and start/end dates;
- location/department manager approves exceptions and local delivery;
- employee/wearer supplies profile data, books fitting, orders allowed items,
  tracks delivery and requests service.

### Partners

- manufacturer/workshop receives minimized production specification;
- alteration/cleaning/logistics partner sees assigned work and custody only.

One person may hold several roles. Permissions are programme and location
scoped.

## Tender Studio

Before an order exists, the retailer creates a tender workspace:

- client brief, brand values and operational constraints;
- workforce model by role, gender/presentation option, FTE fraction, location
  and start wave;
- current pain points and service-level goals;
- garment range, approved colors/materials/logo positions;
- wearer journeys and manager workload simulation;
- sample and approval milestones;
- pricing, replacement and care assumptions;
- implementation calendar, risk register and responsibilities;
- a branded working portal the prospect can actually explore.

The proposal includes an operational demonstration:

> Add a new part-time front-desk employee, assign their entitlement, collect
> sizing, book a measurement slot, route an approved exception and show the
> expected delivery.

This is more credible than a slide promising "full-service uniform management".

## Programme model

Core hierarchy:

`CorporateAccount → Programme → Location → Department → Role → Wearer`

Versioned definitions:

- approved catalogue and garment bundle by role;
- employment fraction and entitlement formula;
- initial issue and recurring replacement allowance;
- optional/required items;
- personal payment/top-up policy;
- logos, embroidery and placement;
- size/fit requirements and exceptions;
- approval chain;
- delivery method;
- budget/PO/cost center;
- care, repair, return and recycling rules;
- effective date and grandfathering behavior.

Changing next year's allocation must not rewrite what an employee was entitled
to last year.

## Workforce onboarding

Bulk import or HR connector creates invited wearer shells with the minimum
known fields:

- employee ID, role, location, department;
- employment fraction and start date;
- programme language;
- manager and cost center;
- email/phone invitation route.

The employee completes:

- contact and delivery preference;
- height, weight and usual size as **preparation clues**, not approved
  measurements;
- fit and mobility preferences;
- presentation/garment options allowed by the programme;
- accessibility/religious/pregnancy/medical accommodation routed with
  restricted visibility;
- fitting appointment;
- acknowledgement of issue/care/return responsibilities.

The fitter sees a prepared session list grouped by probable size and known
exceptions. Only the fitting produces approved measurements.

## Allocation and ordering

Example policy:

- full-time reception: 5 outfits, 4 shirts, 2 knitwear pieces, 2 shoes;
- part-time reception at 0.5 FTE: 3 outfits, 2 shirts, 1 knitwear piece;
- manager-approved exception can substitute skirt/trouser or altered size;
- a replacement becomes eligible by wear age, condition or incident;
- unspent units do not automatically convert to money.

The employee sees only permitted items and remaining entitlement. Requests
outside policy explain why and route to the correct approver. Managers can
place a batch order but do not need to email a spreadsheet.

## Fitting and exception workflow

`invited → profile ready → appointment booked → measured → fit approved →
ordered → produced → received → issued → in service`

Exception branches:

- missing/changed employee;
- no-show fitting;
- unusual size or fit accommodation;
- substitute product;
- delayed/short shipment;
- failed quality;
- alteration required;
- leaver before issue;
- lost/damaged garment;
- role/location transfer.

Every exception has owner, SLA, financial effect and client-visible message.

## Employee portal

The wearer home shows:

- programme identity and how the uniform should look;
- action required and fitting appointments;
- approved wardrobe and allowance;
- orders and realistic arrival range;
- delivery/pickup;
- care and wearing guidance;
- request replacement, repair or alteration;
- report fit/quality issue with photo;
- return/recycling instructions on role exit;
- project notices such as launch day or uniform transition.

Static employee names become living wearer records, but the portal does not
expose retailer clienteling or unrelated personal profile data.

## Corporate dashboards

### Corporate manager

- invited/profile/measurement/order/issue completion;
- readiness by location/role/wave;
- no-shows and unresolved exceptions;
- budget/allowance/PO consumption;
- size curve and predicted shortage;
- delivery SLA and quality/alteration rate;
- leaver returns and unreturned assets;
- employee satisfaction and fit feedback.

### Retailer

- workload and fitter capacity;
- measurements required this week;
- procurement/manufacturing demand;
- stock/size risk;
- exception queue;
- margin/cost leakage;
- invoice and PO reconciliation;
- partner performance.

No dashboard should reduce success to "number of orders". Readiness,
administrative hours removed, first-time fit, on-time issue and exception age
win renewals.

## Inventory and serialized issue

Stock can be programme-reserved by SKU/size/location. High-value or rental
garments can receive serialized barcode/RFID identity. Issue and return events
link garment, wearer, programme and custody while keeping the stock ledger
canonical.

## Integrations

Priorities:

- generic CSV/XLSX workforce and catalogue import;
- HRIS roster delta feed;
- retailer ecommerce/POS and inventory;
- supplier/workshop orders/status;
- shipping;
- accounting/PO/invoice export;
- SSO for corporate staff where required.

HR remains authority for employment status. PAON remains authority for
programme entitlement, fitting and garment lifecycle. Supplier status remains
authority after acknowledged submission unless Full PAON production is used.

## Multi-tenant boundary

A corporate client is not a PAON retailer tenant and not an ordinary consumer
customer. It is a retailer-owned B2B account with its own restricted members
and programmes. A retailer can serve several corporate accounts; a corporate
manager cannot see another client or the retailer's consumer client book.

## Delivery tranches

1. Corporate account/programme/role/wearer and invitations.
2. Role catalogue, allocation engine and employee portal.
3. fitting sessions, approved fit and exception queue.
4. order/status/delivery and client/retailer readiness dashboards.
5. care, replacement, leaver return and serialized custody.
6. tender workspace and reusable operational demonstration.
7. HRIS, accounting and supplier adapters chosen from live prospects.

The first sellable end-to-end pilot is one employer, two locations, three
roles, 50–200 wearers and a real fitting/order/issue cycle.
