# Competitive Gaps

**What this document is.** A prioritized analysis of what the initial
target retailer needs from PAON before they can adopt it, and of where
PAON currently cannot serve them. It is a _sales-blocker inventory_, not a
feature wish list and not a roadmap.

**What this document is not.** It does not reorder
[ROADMAP.md](./ROADMAP.md). The Experience Rebuild remains the immediate
priority. Nothing here is a licence to start building — each Tier 1 item
that gets picked up needs its own founder decision and, where it touches
the domain model, its own entry in [DECISIONS.md](./DECISIONS.md).

**The buyer.** An independent multi-brand menswear retailer — typically an
owner-operator — carrying private-label made-to-measure alongside several
other labels. They pay PAON directly. Nothing here requires a
brand-over-retailer hierarchy in the tenancy model. Conclusions are
specific to this segment and should not be generalized to broader retail —
see [NON_GOALS.md](./NON_GOALS.md), "Explicitly out of scope."

**PAON is independent of Atelier Munro.** There is no partnership, no
channel agreement and no endorsement. The founder's credibility with this
segment comes from having been a private-label B2B client within it and
from a career in menswear — from having stood on the retailer's side of the
counter, not from a supplier relationship. Two consequences bind the
product and the go-to-market: no marketing surface may imply a Munro
affiliation, and no part of the architecture may assume a brand will supply
data, assets or introductions. Where this document refers to
brand-supplied collection assets (see "The content system"), that is a
description of material the retailer already receives from their own
suppliers and controls themselves — not an integration with any brand.

---

## The framing

Two corrections to the obvious framing, both of which change the priority
order.

**The incumbent is not a commerce platform.** It is an agency-built
WordPress or Wix site, several years old, using free fonts, with the
brand's campaign photography pasted in beside phone snapshots. There is
very little structured data in it. This makes migration nearly free and
makes "platform feature parity" the wrong axis to compete on entirely.

**Suitsupply is the benchmark, not the rival.** It matters not because
these retailers lose customers to it — clients demonstrably migrate the
other way, toward personal service and perceived higher quality — but
because it reset what a menswear retailer's digital presence is expected to
look like. Against that expectation, a 2010-era site does not merely fail
to generate demand; it actively creates doubt about a retailer whose real
proposition is quality and care. The job is removing doubt, not
manufacturing demand.

That distinction sets the product direction. Suitsupply's site is
optimized for a stranger buying a first suit, and it is very good at it.
These retailers' asset is the returning client who values being known.
Imitating Suitsupply's funnel means competing on their ground, against
their resources, with their strengths — and abandoning the one advantage
the retailer actually has. The correct goal is not to make these retailers
look like Suitsupply. It is to make them look like themselves, executed
properly.

This is why PAON's engagement surfaces — clienteling, referrals, loyalty,
wedding parties, morningroutine — are strategy rather than features. They
are the digital expression of the thing a vertically integrated chain
structurally cannot do. A prettier catalog alone is a losing position.

---

## Tier 1 — hard blockers

A retailer in this segment cannot adopt PAON while any of these is missing.

### 1.1 Brand as a first-class catalog concept

**Current state.** It does not exist. `Product`
(`packages/domain/src/catalog/product.ts`) carries `retailerId`, `name`,
`slug`, `description`, status flags, `collectionIds` and two image URLs —
and no notion whatsoever of which house made the garment. Nothing in
`packages/domain/src` or `supabase/migrations` models a brand, a supplier
or a manufacturer.

**Why it blocks.** On a multi-brand menswear site, brand is the primary
navigation facet — it is how customers browse, how staff search, and how
the retailer thinks about their own stock. A store carrying a private
label plus five other houses cannot have its storefront rendered correctly
by PAON today. This is not a missing convenience; the site is not
buildable.

**The workaround, and why it isn't one.** A retailer could create a
`Collection` named after each label they carry. A collection is a merchandising
grouping with a season — overloading it as brand loses supplier
attribution, per-brand margin reporting, per-brand asset provenance (1.2)
and the ability for a product to belong to both a brand and a seasonal
collection at once. It would be a shortcut of exactly the kind
[PRINCIPLES.md](./PRINCIPLES.md) forbids taking silently.

**Shape of the work.** A `Brand` entity in the Catalog context, referenced
by `Product`, retailer-scoped like everything else (each retailer curates
their own brand list — there is no shared global brand registry, and
introducing one would create the cross-tenant coupling
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md) deliberately avoids). Storefront
filtering and a brand landing page follow from it.

### 1.2 The content system

This is the largest item here and the clearest statement of what PAON is
actually selling to this segment.

**The real problem.** These retailers are not short of marketing material.
Their private-label supplier ships professional collection assets every
year, and some of the other houses they carry supply partial material. But
a significant share of what appears on the site — stock they carry,
in-store atmosphere, their own product shots — they photograph themselves,
and that is where quality collapses.

Independent retail sites do not look dated because the CMS is bad. They
look dated because the content pipeline has no discipline: mixed aspect
ratios, inconsistent backgrounds, professional campaign imagery sitting
directly beside an underlit phone photo, and type applied by whoever built
the site. A vertically integrated chain looks immaculate because one team
shoots everything to one specification. The independent retailer has no
such team and never will.

**Current state.** `Product` has exactly two image fields,
`primaryImageUrl` and `swatchImageUrl` (ADR-049). There is no media
library, no asset model, no crop or aspect-ratio handling, no distinction
between a campaign image and a product cutout, and no concept of where an
asset came from. `RetailerBrandTheme` already constrains typography,
colour and corner style to a small set of curated options rather than
offering a free-form editor — that instinct is correct and is the model
the asset system should follow.

**Why it blocks.** This is the promise. A retailer adopting PAON to "catch
up digitally" and then uploading their own inconsistent photography into it
has bought a new site that looks like their old one. The gap does not
close, and the reference sale to the next partner does not happen.

**Shape of the work.** Not better templates — a system that makes
heterogeneous inputs look coherent:

- A real media model: multiple assets per product, typed by role (campaign,
  product cutout, fabric detail, in-store), with provenance recorded so
  brand-supplied and self-shot material can be handled differently.
- Enforced aspect ratios and crops at upload, with automatic normalization,
  so an out-of-spec photo becomes in-spec rather than being rejected or
  published badly.
- Bulk ingestion of supplier-issued collection assets, so the professional
  material the retailer already receives each season lands correctly with no
  design work from them. This is the retailer uploading material they hold
  and control — not an integration with, or a dependency on, any brand.
- Shot-list guidance telling the retailer exactly what they must photograph
  themselves and to what specification — the cheapest possible intervention
  on the weakest input, and something no competitor offers because no
  competitor knows what the shot list should be.

The constraint philosophy matters more than any individual feature: the
retailer should not be _able_ to produce an incoherent page. This deserves
its own ADR before implementation.

**Commercial note.** Because each retailer pays directly and carries
multiple labels, this system must serve every label they stock. Whichever
supplier ships them the best material gets the most out of the bulk-ingest
path simply because that material exists and is good — not because the
system privileges a named brand. Both the retailer's value and PAON's
independence from any one brand relationship depend on it working equally
well for self-shot stock.

### 1.3 Custom domain resolution

**Current state.** `Retailer.primaryDomain` exists as a persisted,
retailer-editable field (`packages/domain/src/retailer/retailer.ts`,
`/settings`) but nothing reads it for routing. Storefronts resolve
path-based only — `/r/[slug]` — per ADR-014, and
`apps/customer/middleware.ts` performs no host-based tenant resolution.
The field is recorded intent, not a mechanism, in the same way
`customers.preferred_carrier` is (ROADMAP Phase 7).

**Why it blocks.** These retailers have traded under their own name for
decades, often generations. A third-party URL is a brand-sovereignty
objection that surfaces in the first meeting, and it undercuts the exact
credibility problem PAON is being sold to fix.

**Shape of the work.** Host-based tenant resolution in the Customer Portal
middleware, a domain-verification flow, and TLS provisioning. Bounded
context: Retailer. This interacts with ADR-014 — that ADR chose path-based
routing deliberately, so this is a documented extension of it, not a silent
reversal.

**Cost to close.** Lowest of any Tier 1 item, by a wide margin.

### 1.4 Discount, promotion and stored-value primitives

**Current state.** None exist anywhere in the domain. `Order` carries only
`subtotal` and `total`; `OrderLine` carries only `unitPrice`; there is no
`Discount`, `PromotionRule`, `Coupon` or gift-card entity in
`packages/domain/src`, and no migration creates one. ROADMAP Phase 7
already names this as the largest open item.

**Why it blocks.** Every retailer in this segment runs seasonal offers,
trunk-show pricing, friends-and-family and gift cards — and gift cards
matter disproportionately for menswear, where a large share of purchases
are gifts. There is no manual workaround that doesn't corrupt the order
record.

**Shape of the work.** See **ADR-050** in [DECISIONS.md](./DECISIONS.md),
which designs this. It is the deepest of the Tier 1 items and the one that
most needs to be got right the first time, because it changes how every
order total is computed.

### 1.5 Tax, VAT and multi-currency correctness

**Current state.** No tax concept exists anywhere — searching for tax or
VAT across `packages/domain/src` and `supabase/migrations` returns nothing.
`Order` has `currency`, `subtotal` and `total` with no tax component.
`CurrencyCode` is a closed union of eight currencies
(`packages/domain/src/shared/money.ts`). Neither `Retailer` nor `Customer`
carries a VAT identification number.

**Why it blocks.** European retail is VAT-inclusive pricing by default, and
a displayed price that doesn't reconcile to the invoice is an accounting
problem with the retailer's own tax authority, not a bug they can absorb.

**Also verify:** that iDEAL and Bancontact are enabled on the Stripe
Connect accounts. A Dutch or Belgian checkout without iDEAL is not a real
checkout, however good the rest of it is.

---

## Tier 2 — retention gaps

Not adoption blockers. These are what makes a retailer who adopted PAON
regret it in month six.

| Gap                           | Current state                                                                                                                               | Why it matters here                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS and stock integration     | None. `OrderChannel` models `in_store` and `clienteling`, and Stripe Connect direct charges are in place (ADR-030), but nothing reads a POS | See "POS, reconsidered" below. Read-only stock and sales sync from their existing system, not replacement                                                                                                |
| Locations as an entity        | Explicitly not modeled — ROADMAP Phase 1 deferred multi-store until a slice needed it                                                       | Some partners run more than one door. Less urgent than it looked when the network itself was assumed to be the tenant                                                                                    |
| Automation triggers           | Delivery rails are built and proven — email outbox (ADR-032), `@paon/sms` (ADR-036), notifications. The trigger/condition engine is not     | Dormant-client reactivation is the highest-value automation for this segment, and most of the hard part is already done                                                                                  |
| Shipping and carrier          | `preferred_carrier` records staff intent only; no carrier integration (ROADMAP Phase 7, open)                                               | Garments move to the alteration workshop and back constantly                                                                                                                                             |
| Exportable reporting          | Retailer analytics dashboards shipped (Phase 6); accountant-grade export not verified                                                       | Whatever the bookkeeper cannot export, the retailer keeps a second system for                                                                                                                            |
| Inventory across locations    | Stock is per-variant                                                                                                                        | Depends on both locations and POS integration landing first                                                                                                                                              |
| Deposit and balance schedules | `Payment`'s own documentation fixes the constraint: "One Payment per Order (MVP scope)". `OrderStatus` has no partially-paid state          | An MTM commission is half at measurement, half at delivery. Tier 2 only because year one takes that deposit in the retailer's existing POS — it returns to Tier 1 the moment PAON handles in-store money |

### POS, reconsidered

An earlier draft of this document ranked card-present payment as the second
hardest blocker, on the reasoning that whichever system takes the money in
the room becomes the system of record. That reasoning is sound in general
and wrong for the _first_ sale in this segment.

A multi-brand store already runs a retail POS to manage stock across every
label it carries. Asking them to replace it converts a manageable "make my
digital presence credible" purchase into an alarming "replace my
operations" one, and it contradicts the and/and proposition the product is
being sold on. Year one integrates: read stock levels and completed sales
from their existing system so the customer record is enriched without staff
re-keying. Card-present and system-of-record displacement are a year-two
expansion, earned after the storefront has proven itself — and they should
not be attempted before 1.1 and 1.2, since a PAON that cannot even model
their multi-brand stock cannot manage it.

The cost of deferring is real and should be stated rather than glossed:
until the integration exists, in-store transactions are invisible to PAON,
which partially weakens [NORTH_STAR.md](./NORTH_STAR.md)'s promise that
staff never re-key the same fact twice.

### Migration, reconsidered

Also demoted. Against a Shopify incumbent, importing a decade of client and
order history is a hard blocker. Against an agency-built brochure site
there is usually little more than a contact list and a product catalogue to
bring across, and the customer history that matters most lives in the POS
(above) or in a spreadsheet. A modest CSV importer in PAON Admin is
sufficient; the staff-assisted onboarding model
([NON_GOALS.md](./NON_GOALS.md)) absorbs the rest.

---

## The honest metric

A €4,000 commission does not sell online to a stranger, and promising
"passive online sales" to this segment sets a number that will not move.
Realistic online revenue here is accessories and ready-to-wear reorders
from existing clients, gift cards, and reactivated dormant clients.

The metric worth putting in front of a retailer instead is **appointments
booked online**. It is the conversion event that actually feeds the in-store
sale where the margin is, it moves within weeks rather than quarters, and it
is honest. `Appointment` booking already exists end to end (ROADMAP Phase 3),
which makes this the rare case where the right thing to promise is also the
thing that is already built.

---

## Deliberately not cloned

Recorded so the decision is visible rather than an oversight, consistent
with [NON_GOALS.md](./NON_GOALS.md):

- **Theme marketplace and third-party app ecosystem.** Also
  counter-productive here: an open theme system is precisely how these
  retailers' current sites got into their present state. Constraint is the
  product (1.2).
- **Headless / storefront API.** Deferred with the public API.
- **Subscriptions, fulfillment network, marketplace sales channels.** Wrong
  shape for low-volume high-touch commerce.
- **Imitating Suitsupply's conversion funnel.** See "The framing" — this is
  a deliberate strategic exclusion, not an unbuilt feature.

---

## Maintenance

Every "PAON does not have X" claim in this document was verified against
`packages/domain/src`, `packages/database/src` and `supabase/migrations` on
2026-07-27. It goes stale by construction as gaps close — when one does,
update the entry rather than leaving a solved problem described as open.
Where a judgement here has been revised, the revision is recorded in place
("POS, reconsidered", "Migration, reconsidered") rather than by quietly
deleting the earlier position.
