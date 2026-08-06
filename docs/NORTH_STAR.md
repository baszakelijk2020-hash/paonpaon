# North Star

## The company PAON is building

**PAON is the memory and action system for a premium retailer's standard of
care.**

It makes the house remember what a client owns, how each garment fits and
ages, what has been promised, what should happen next, and whether the outcome
was worthy of the relationship. It then turns that memory into prepared human
service: before a conversation, during a commission, throughout production,
and long after delivery.

The initial category is independent premium menswear. The durable category is
**relationship intelligence for high-consideration retail**.

PAON is not primarily a storefront, CRM, POS, configurator, loyalty scheme, or
AI stylist. Those are interfaces and capabilities. The product is continuity:
the relationship becomes more useful with every interaction and does not
disappear into an advisor's memory, a supplier system, or nine spreadsheets.

## The customer promise

For the retailer:

> Every advisor can deliver the house's best standard of care, with the right
> context and next action, without re-keying or replacing the systems that
> already work.

For the client:

> This house knows me, remembers what happened, explains what it recommends,
> and looks after my wardrobe after the sale.

## The shared intelligence spine

Every PAON module connects to the same relationship, garment, commerce and
service memory. The shortest complete expression of that spine is:

```text
Evidence and consent
  -> House Memory (client, wardrobe, fit, promises)
  -> Prepared Conversation (advisor Today / appointment brief)
  -> Composed Proposal (look, roadmap, service, or campaign)
  -> Order or Appointment
  -> Production / fitting / alteration visibility
  -> Delivery and Aftercare
  -> Outcome captured back into House Memory
```

The three moments that must feel magical are:

1. **Before the visit:** the advisor is prepared and the client feels expected.
2. **At the table:** PAON reduces choice and composes a confident next step.
3. **After the sale:** silence becomes anticipation, care, and a useful reason
   to return.

This is the golden relationship journey and the first full-system
demonstrator. It is not PAON's scope boundary. Retail operations, campaigns,
corporate programmes, partner services, marketplace capabilities and future
verticals may enter at different points, but they must exchange authoritative
state and outcomes through the same spine rather than becoming disconnected
products.

## The modular platform

PAON is one platform with independently entitlement-controlled modules. The
destination is deliberately broad; the build order is disciplined so that
breadth becomes a working system rather than a collection of routes and
tables.

### 1. Platform Core

Tenancy, identity, roles, consent, provenance, audit, workflow, integration,
migration, module entitlements, plan/billing metadata, notifications, evidence
and outcome capture. Every other module depends on this foundation.

### 2. Client and Relationship Intelligence

Client memory, advisor preparation and Mission Control, appointments,
conversations, preferences, milestones, promises, messaging, explainable
recommendations, quick capture and outcomes.

### 3. Wardrobe and Styling Intelligence

The garment graph, visual wardrobe, StyleProfile, fit evidence, knowledge and
metadata, wardrobe roadmap, composed looks, guided consultation, Morning
Routine and proposals. The founder-specified tools in pag1, the groom-party
fitting planner in pag2, the Preferred Tailoring/HighMaintenance experience in
pag3, and tools explicitly called out in the founder brief preserve their
source experience under ADR-052/071. Their Atelier Munro business shell is not
PAON's company plan; their specified interaction, motion and workflow are
product requirements. See
[VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md](./VIRTUAL_WARDROBE_STUDIO_BLUEPRINT.md)
for the founder-level specification of virtual try-on/generated visual
roadmap capability inside this module's existing wardrobe, `Outfit` and
`WardrobeRoadmap` primitives — a specification to be implemented feature by
feature under `PHASE.md`, not a claim that it is already built.

### 4. Commerce and Growth

Storefront and assisted selling, cart and orders, remote selling, private
offers, campaigns, loyalty and referral, post-order momentum, customer
journeys, attribution and measurable growth programmes.

### 5. Garment and Service Operations

Source-authorized production visibility, fitting, alterations, delivery,
aftercare, custody, repair, care plans, service memberships, partner
fulfilment and complete garment lifecycle history.

### 6. Retail Operations

Catalogue and product intelligence, inventory and auditable stock movement,
POS and returns, staff work, scheduling, tasks, campaigns, recognition,
locations, operational analytics, migration and provider reconciliation. PAON
supports overlay, co-managed and full-authority modes by domain.

### 7. Enterprise and Vertical Solutions

Corporate wardrobes, wedding-party apparel, multi-location operations,
preferred tailoring, training and consultancy, partner-workshop workflows and
later category or occasion packs. These are real PAON modules with distinct
buyers and onboarding journeys, not accidental additions to a generic core.

### 8. Network and Ecosystem

B2B procurement, partner and publisher participation, curated lifestyle
commerce, referral and revenue-share infrastructure, rewards, events and
other multi-party experiences. The technical capability is part of the
destination; live money movement, advertising, data use and partner activation
remain subject to explicit legal, supply and trust gates.

## Modules and plans

Retailers configure PAON through modules, not product forks. A module has an
explicit state (`off`, `preview`, `active`, or `suspended`), dependencies,
role/navigation grants, data authority mode, limits and audit history. Turning
one off removes its jobs and surfaces without deleting its historical truth.

Commercial tiers are curated module bundles—for example Foundation,
Intelligence, Growth, Operations, and Enterprise & Network—not separate
codebases or ceilings on ambition. Retailers may add eligible modules outside
a bundle. Names, packaging and pricing remain commercially testable; the
module and entitlement architecture does not.

## Strategic advantages

PAON should compound five assets:

1. **House Memory:** portable institutional memory when staff are absent or
   leave. This is continuity insurance, not merely CRM.
2. **Garment Graph:** each physical garment connects purchase, fit, usage,
   care, alteration, combinations, and future intent.
3. **Standard of Care:** the founder's menswear and service intelligence
   becomes an executable house playbook, not generic automation.
4. **Outcome Evidence:** recommendations and staff actions learn from what was
   accepted, bought, delivered, altered, worn, or declined.
5. **Trust:** consent, provenance, correction, restraint, and transparent
   recommendations create a client-visible advantage that surveillance cannot.

## North-star measures

The primary product measure is **Prepared Relationship Moments**: meaningful
client interactions where PAON supplied cited context or a next action, a human
or client completed an outcome, and the result returned to House Memory.

Supporting measures:

- time from signal or promise to completed action;
- repeat commission and service interval;
- wardrobe coverage and aftercare participation;
- advisor preparation and quick-capture completion;
- promises kept on time;
- retailer activation to first real relationship loop;
- retained paying retailers, not routes, tables, or generated recommendations.

## Who the first buyer is

An owner-led independent premium menswear retailer with high-touch client
relationships, made-to-measure or alteration complexity, and fragmented tools.
It wants its house to be remembered for service, not to become a software
operator. PAON must work with its current stack and prove value on a small
number of real relationships quickly.

There is no brand partnership or endorsement behind PAON. No surface may imply
one, and no architecture may assume a brand supplies data or access.

## Product discipline

- Build the full modular destination in coherent chapters, with connected
  vertical slices inside each chapter.
- Use the golden relationship journey as the first system demonstrator and
  regression spine, not as a reason to suppress the rest of the platform.
- Prefer a composed decision to a catalogue of possibilities.
- Preserve designated founder tools exactly under ADR-052/071; use the wider
  source grammar—cinematic context, deliberate reveal, tactile rails, product
  composition and quiet confidence—for new PAON surfaces. Do not copy the
  source brand, literal products, unsupported claims or unrelated commercial
  framing into PAON.
- Integrate commodity systems; own the relationship, garment, evidence, and
  service intelligence that make PAON distinctive. Earn deeper authority in
  operations where it creates material value.
- The roadmap commits to all eight module families. `PHASE.md` controls
  dependency order and proof; it does not reduce the destination to a pilot.
- Real retailer use, deployment, security, and connected browser journeys
  are proof lanes throughout the build, not an excuse for disconnected breadth
  or an indefinite stop on later modules.

See [VISION.md](./VISION.md) for the product thesis, [PRODUCT.md](./PRODUCT.md)
for current surfaces and boundaries, and [PHASE.md](./PHASE.md) for the only
authorized work order.
