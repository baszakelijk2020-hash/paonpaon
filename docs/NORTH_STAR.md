# North Star

## The mission

**PAON is the system of record and the system of engagement for the
lifetime relationship between an independent menswear retailer and their
clients.**

Long-term category ownership is **personal wardrobe intelligence** delivered
through that RetailOS — not another POS or e-commerce stack with AI bolted on.
The active architecture and product programme is
[PAON_INTELLIGENCE_PLATFORM.md](./PAON_INTELLIGENCE_PLATFORM.md); what is built
next is ordered only by [PHASE.md](./PHASE.md).

## Who it is for

An independent multi-brand menswear retailer, usually owner-operated, who
carries private-label made-to-measure alongside several other houses. They
compete on personal service and garment quality, and they lose credibility
online because their digital presence is a decade behind what their clients
now expect.

They are not a chain, not a marketplace seller, and not a high-volume
retailer. Every product decision in this repository assumes low volume, high
touch, long production and alteration cycles, and staff who are expected to
remember a client without being told twice.

## PAON is independent

There is no brand partnership, channel agreement or endorsement behind PAON.
The founder's credibility with this segment comes from having run a
private-label made-to-measure business inside it, and from a career in
menswear.

Two consequences bind both product and go-to-market:

- No marketing surface may imply affiliation with any brand.
- No part of the architecture may assume a brand supplies data, assets or
  introductions. Where the product ingests supplier collection assets, that
  is the retailer uploading material they already hold and control.

## What we are not trying to be

Not a vertically integrated chain's website. Suitsupply set the expectation
these retailers are judged against, and matching its conversion funnel would
mean competing on its ground with its strengths, while abandoning the one
advantage an independent has: the returning client who values being known.

The goal is not to make these retailers look like a chain. It is to make
them look like themselves, executed properly.

## What success looks like

- A retailer's staff never re-key the same client fact into two tools.
- A client can see the truth about their order, their alteration and their
  standing without calling the store.
- A retailer who grows from one door to several never has to migrate off
  PAON.
- A small platform team operates many retailer tenants without linear
  headcount growth.
- An engineer opening this repository can predict where a piece of logic
  lives before searching for it.

## What we optimize for, in order

Correct → Reliable → Scalable → Consistent → Fast to build.

Built for years, not for a demo. See [PRINCIPLES.md](./PRINCIPLES.md) for
how that is applied day to day, and [NON_GOALS.md](./NON_GOALS.md) for what
is deliberately deferred.

## The current objective

The Intelligence Platform programme now turns this mission into an ordered
implementation path: catalogue intelligence first, then advisor intelligence,
wardrobe/MorningRoutine, relationship programmes, concierge, and compliant
commerce. `PHASE.md` remains the sole queue; this mission does not reorder it.

## Capolavoro Online / MunroMarché ecosystem north star

Long-term, the same retailer–client relationship compounds into a **governed
lifestyle network** the retailer curates without holding stock:

- zero-stock lifestyle commerce across books, art, design, hospitality,
  restaurants, travel, automotive, golf, jewelry, grooming, culture and
  experiences;
- affiliate, referral, qualified-lead, booking, supplier-fulfilled and
  local-partner commercial models with explicit disclosure;
- lifestyle concierge and network rewards on append-only liability ledgers;
- third-party publisher/media cards with rights, attribution, outbound links
  and retailer activation;
- MunroMentions without copying the referrer’s identity into the invitee;
- distinct portals for retailer, partner, publisher, advertiser, fulfiller and
  PAON;
- Audience Studio with versioned cohorts and policy-aware forecasting;
- advertising inventory (placements, orders, line items, flights, creatives,
  budgets, pacing, frequency caps) and CPM/CPC/CPL/CPA/affiliate/sponsorship/
  booking economics;
- impression, viewability, click, lead, booking, conversion, refund and
  reversal events with attribution, incrementality, deduplication and fraud
  review;
- multi-party revenue-sharing ledgers;
- aggregate insights, retailer benchmarking, PAON-executed audiences,
  pseudonymous attribution, clean-room matching, contracted data exchange,
  retailer exports and customer-requested named introductions only;
- provenance, purpose, contract, entitlement, retention, correction, deletion
  and recomputation on every network fact and event.

**Commercial north star:** governed access to highly specific, high-intent
audiences and measurable outcomes — **not** uncontrolled named-profile
exports.

**Technical ceiling:** build the full capability model behind policy and
entitlement controls so later activation restrictions are configuration, not a
platform rebuild. Strictly separate the customer-facing lifestyle network from
retailer-facing **MunroMerchant** B2B procurement.

Canonical design:
[vision/PAON_LIFESTYLE_ECOSYSTEM_AND_NETWORK_COMMERCE.md](./vision/PAON_LIFESTYLE_ECOSYSTEM_AND_NETWORK_COMMERCE.md).
Implementation remains Stage 15+ in [PHASE.md](./PHASE.md) only — this section
does not authorize early software.
