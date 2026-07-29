# Vision

## The problem

Premium and luxury retailers sell relationships, not transactions. A
client who commissions a bespoke suit, books three fittings, alters two
older pieces and attends a trunk show is having one continuous
relationship with the house — but the software underneath is almost
always fragmented: a POS for transactions, a spreadsheet or generic CRM
for clienteling, email for production status, a separate booking tool
for appointments, and nothing at all connecting loyalty to any of it.
The retailer's staff become the integration layer, manually. That does
not scale past a handful of locations, and it is invisible to the
customer, who experiences it as being forgotten between visits.

Generic e-commerce and CRM platforms don't fill this gap because they
are built for high-volume, low-touch commerce: fast checkout, self-serve
returns, chat-bot support. Luxury retail runs on the opposite pattern —
low volume, high touch, long production and alteration cycles, and staff
who are expected to remember a client's preferences without being told
twice.

## What PAON is

PAON is a **RetailOS** and a lifelong **wardrobe intelligence** system for
independent menswear houses and their clients.

As RetailOS it connects the commercial lifecycle —

Discovery → Purchase → Production → Alteration → Delivery → Loyalty →
Referral → Repeat.

As wardrobe intelligence it owns the **customer-side north loop**: the
digital twin of what a client owns, how it fits and ages, what the wardrobe
needs next, and an explainable advisor that improves over a lifetime —
analogous to how Apple Health owns health data, not “software to sell
clothes.” Commercial consequence (better retail relationships, better
recommendations) follows from wardrobe quality; it is not the sole
objective. The pillar specs live in [vision/](./vision/) — architectural
destination only; [PHASE.md](./PHASE.md) alone authorizes build.

It is delivered as three purpose-built applications
([PRODUCT.md](./PRODUCT.md)) sharing one domain model
([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)), so that a fact recorded once —
a physical garment's fitting observations, an order's production stage, a loyalty
balance — is true everywhere it is shown, instantly, without sync jobs.

## Who it serves

- **PAON** (the company) — operates the platform, onboards retailers,
  and grows revenue through retailer subscriptions.
- **Retailers** — premium and luxury houses, from single-boutique
  ateliers to multi-location maisons, who use PAON to run daily
  operations and deepen customer relationships.
- **Customers** — the retailer's clients, who get one place to track
  everything they have going on with a house they shop with.

## Why now

Luxury retail is under margin pressure to do more with the same
headcount, while customer expectations (set by consumer tech generally)
have risen: real-time status, self-service where appropriate, and
personalization that feels earned rather than automated. A platform that
unifies CRM, commerce, production/alteration tracking and loyalty into
one coherent product — with AI personalisation layered on a single
clean domain model rather than bolted onto fragmented data — is a
genuine step change, not a feature checklist.

## Time horizon

This is a multi-year platform. Every architectural choice in
[ARCHITECTURE.md](./ARCHITECTURE.md) and every decision in
[DECISIONS.md](./DECISIONS.md) is made assuming the codebase will still
be actively developed five years from now, by people who were not in
the room when the decision was made. That assumption is not aspirational
— it is a design constraint.
