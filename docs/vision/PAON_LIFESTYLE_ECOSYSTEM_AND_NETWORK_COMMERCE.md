# PAON Lifestyle Ecosystem and Network Commerce

**Status:** expansive target design and commercial/technical ceiling. No Stage
15 software is claimed as implemented by this document. Provider-neutral
catalogue, attribution, eligibility, audience, advertising inventory and
accounting contracts may be built before regulated money movement; live
payment, stored value, media rights activation and data commercialization
remain gated by explicit business/provider decisions and by `docs/PHASE.md`.

**Commercial north star:** governed access to highly specific, high-intent
audiences and measurable outcomes — not uncontrolled profile exports.

**Product names in this surface family:** Capolavoro Online / MunroMarché
(customer-facing lifestyle network curated by the retailer). MunroMerchant
remains a separate B2B procurement context.

## The opportunity

Independent premium retailers already create local partnerships with
restaurants, hotels, golf clubs, car dealerships, jewelers, cultural
institutions, publishers and experience operators. PAON turns those
relationships into reusable infrastructure:

- retailer-curated zero-stock lifestyle commerce;
- affiliate, referral, qualified-lead, booking, supplier-fulfilled and
  local-partner models;
- lifestyle concierge;
- network rewards;
- third-party publisher/media cards with rights and attribution;
- MunroMentions;
- multi-portal operations (retailer, partner, publisher, advertiser,
  fulfiller, PAON);
- audience studio, versioned cohorts and forecasting;
- advertising inventory with full order/line-item economics;
- attribution, incrementality, experiments, deduplication and fraud review;
- revenue-sharing ledgers across retailer / publisher / partner / PAON;
- aggregate insights, benchmarking, clean-room matching and contracted
  data exchange under entitlement;
- the compounding flywheel from retailer trust to network intelligence.

The customer should experience one trusted retailer becoming more useful. The
retailer should gain engagement and incremental revenue without holding stock.
The partner, publisher or advertiser should reach a relevant audience and
receive attributable demand under contract. PAON should compound network
intelligence without selling named profiles.

## Product layers

### 1. Curated lifestyle shelf (zero-stock)

Retailer selects from PAON-approved partner listings. Categories include at
minimum:

- books and magazines;
- art and design objects;
- hospitality, restaurants and travel;
- automotive and golf experiences;
- jewelry and watches;
- grooming and fragrance;
- culture, events and experiences;
- services that the retailer does not stock.

A listing commercial type is explicit and never ambiguous:

| Type                                | Customer sees                    | Retailer holds stock | Fulfilment                |
| ----------------------------------- | -------------------------------- | -------------------- | ------------------------- |
| Editorial outbound link             | Disclosed external story/offer   | No                   | Outbound only             |
| Tracked affiliate link              | Disclosed affiliate relationship | No                   | Partner/affiliate network |
| Qualified lead / referral           | Introduction or enquiry form     | No                   | Partner lead intake       |
| Bookable experience                 | Availability/request path        | No                   | Partner booking           |
| Supplier-fulfilled marketplace item | Order status, not store stock    | No                   | Supplier/fulfiller        |
| Local partner offer                 | Local terms and redemption       | No                   | Local partner             |

PAON never makes an affiliate link or supplier-fulfilled item look like stock
fulfilled by the retailer.

### 2. Lifestyle concierge

Customer asks the trusted advisor or concierge layer to arrange:

- restaurant/experience;
- travel/event wardrobe;
- flowers/gift;
- chauffeur;
- repair/care;
- partner introduction;
- multi-step packages (for example Valentine reservation + roses + transport).

Requests carry owner, SLA, availability, quote/approval, exception path and
outcome. Early versions can be human-coordinated tasks. Automation follows only
where partner APIs and contracts exist. Non-money concierge operations must be
buildable independently of stored-value/reward liability design.

### 3. Network rewards

Use an append-only rewards ledger with:

- earning rule and funding party;
- pending / available / reversed / expired states;
- retailer vs PAON vs partner liability;
- redemption catalogue and conversion rate;
- transfer/partner account link only under an explicit contract;
- refund/reversal and breakage treatment;
- accounting export.

American Express demonstrates the customer mental model of linked partner
accounts and explicit transfer ratios, but PAON must not call points cash or
promise cross-partner transferability before the liability/accounting design
is approved. Source:
[American Express Membership Rewards transfer partners](https://global.americanexpress.com/rewards/transfer).

### 4. Lifestyle media and third-party publisher cards

Retailer activates a white-labeled section containing:

- PAON-produced menswear/wardrobe/service thinking;
- licensed partner/editorial feeds;
- third-party publisher/media cards;
- retailer/local stories;
- campaign stories;
- shoppable/affiliate components;
- events and concierge actions.

Every third-party publisher/media card carries as first-class metadata:

- rights grant and territory;
- attribution and byline;
- outbound link target and disclosure class;
- retailer activation eligibility;
- commercial model (sponsorship, CPL, affiliate, editorial);
- expiry / recall / correction path.

Publication rights, source attribution and commercial disclosure are content
metadata, not a manual footnote. Unlicensed content must not be activatable.

### 5. MunroMentions

Customer shares:

- an editorial story;
- product/look;
- partner experience;
- personal retailer introduction.

Tracking records the invitation and downstream consented outcome. The referred
person creates their own identity and permissions. Existing customer data is
not copied into the referral. MunroMentions may earn network rewards only under
explicit funded liability rules.

## Portals and role ownership

| Portal                     | Primary owner                | Core responsibilities                                                       |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Customer lifestyle network | Customer + retailer curation | Browse curated shelf, media, concierge, rewards, MunroMentions              |
| Retailer portal            | Manager/owner                | Curation, placement, audience mapping, activation, economics, exclusions    |
| Partner portal             | Lifestyle partner            | Listings, terms, availability, lead/order confirmation, disputes            |
| Publisher portal           | Media/publisher              | Rights, cards, attribution, territory, recall                               |
| Advertiser portal          | Brand/agency advertiser      | Inventory discovery, orders, creatives, pacing, reporting under entitlement |
| Fulfiller portal           | Supplier-fulfilled operator  | Order receipt, shipment/status, exceptions — minimum identity only          |
| PAON portal                | Platform staff               | Network catalogue approval, contracts, fraud review, ledger ops, policy     |

Partner, publisher, advertiser and fulfiller receive the minimum data required
to fulfill, attribute or measure. They do not receive a raw Self-Portrait or
retailer client list unless a separately recorded, customer-requested named
introduction is authorized.

## Audience studio, cohorts and forecasting

Audience Studio is the governed planning surface for lifestyle and advertising
activation:

- versioned cohorts with cited eligibility rules;
- forecast of reachable size under current policy/consent/entitlement;
- retailer-executed vs PAON-executed audience modes;
- holdout and experiment assignment;
- frequency and contact-pressure caps shared with campaign/clienteling
  rails where applicable;
- no silent mutation of a live flight when the library cohort changes —
  activations pin a cohort version.

Forecasting must show sample size, window, exclusion reasons and policy
denials. A large theoretical segment that policy forbids is reported as
ineligible, not as inventory.

## Advertising inventory and commercial objects

Provider-neutral advertising objects (buildable before live ad serving):

- inventory and placements (surface, format, territory, retailer scope);
- orders and line items;
- flights (schedule, timezone, status);
- creatives (asset, disclosure, rights, review state);
- budgets, pacing and frequency caps;
- economics: CPM, CPC, CPL, CPA, affiliate, sponsorship, booking fee;
- event stream: impression, viewability, click, lead, booking, conversion,
  refund, reversal;
- attribution path, incrementality experiment, deduplication key and fraud
  review state.

Every billable event is append-only, idempotent by provider/event key, and
reversible through a compensating ledger entry — never by silent mutation.

## Attribution, incrementality and integrity

PAON records:

- impression/placement;
- viewability where contractually required;
- click with opaque attribution ID;
- partner handoff;
- lead/booking/order callback;
- transaction value and eligible commission/fee;
- validation/holding period;
- return/cancel/reversal;
- approved payout/invoice;
- experiment/holdout membership;
- fraud-review disposition.

Support link/code attribution first, server-to-server conversion callbacks
second and provider adapters third. Cross-device identity is never claimed
without actual evidence. Incrementality language must distinguish observed
correlation from experimental lift. Deduplication keys prevent double-pay
across channels. Fraud review can hold or reverse payable amounts without
erasing history.

Existing affiliate platforms already validate these mechanics — tracking
links/codes, server events, pending/holding periods, refund reversals,
flexible commission structures and automated payout — so PAON is adopting a
proven settlement model rather than inventing one. Sources:
[Shopify Collabs commissions](https://help.shopify.com/en/manual/promoting-marketing/collabs/creators/payments)
and [Partnerize platform](https://partnerize.com/platform).

## Revenue-sharing ledgers

Canonical append-only ledgers (not feature-local balances) record shares for:

- retailer;
- publisher;
- partner / fulfiller;
- advertiser settlement side;
- PAON platform fee.

Each entry names programme, commercial model, funding party, liability party,
holding state, tax/invoice reference class and reversal link. Accounting export
is a projection over the ledger, not a second truth.

## Insights, benchmarking and data exchange under entitlement

Allowed network intelligence modes, each gated by policy + contract +
entitlement:

| Mode                                  | What leaves PAON                                 | Requires                 |
| ------------------------------------- | ------------------------------------------------ | ------------------------ |
| Aggregate insights                    | Thresholded counts/rates                         | Contract + minimum-n     |
| Retailer benchmarking                 | Peer-anonymous aggregates                        | Contract + cohort rules  |
| PAON-executed audiences               | Partner receives tokens/placements, not profiles | Programme + purpose      |
| Pseudonymous attribution              | Opaque IDs and outcomes                          | Attribution contract     |
| Clean-room matching                   | Matched aggregates only                          | Clean-room contract      |
| Contracted data exchange              | Explicit field set, purpose, retention           | Data-processing terms    |
| Retailer exports                      | Retailer-owned export of own tenant data         | Retailer authority       |
| Customer-requested named introduction | Named handoff to a specific partner              | Customer request + audit |

**Rejected as product default:** sale or export of named customer profiles to
advertisers or partners for uncontrolled reuse.

Building the ability to segment an audience precisely is **not** permission to
sell a named person's profile. The two are separate decisions with separate
records: segmentation is an internal eligibility capability, while any release
of data outside PAON requires a purpose, a contract, an entitlement and — for a
named individual — that individual's own request. A partner receives the
minimum data required to fulfil or attribute, and never a raw Self-Portrait or
retailer client list.

## Provenance, purpose, entitlement, retention and recomputation

Every lifestyle, media, advertising and rewards fact or event carries:

- provenance (actor, source system, raw reference, time);
- purpose (why collected / why processed);
- contract and entitlement reference;
- retention class and deletion/anonymization path;
- correction path that recomputes derived eligibility, cohorts, forecasts and
  payable projections.

Capability is built first; activation is restricted by typed policy so later
founders/legal choices do not force a platform rebuild. This is the same
capability-vs-policy plane used in intelligence (ENG-006), extended to network
commerce.

## Technical ceiling (policy and entitlement)

The platform must be able to represent, even when a tenant disables activation:

1. full event and commercial object model above;
2. all commercial models (affiliate through booking and sponsorship);
3. all portal roles and minimum-data scopes;
4. audience studio versioning and forecasting;
5. revenue-share and rewards liability ledgers;
6. clean-room and contracted exchange envelopes;
7. correction, deletion, retention and recomputation;
8. strict package/table separation from MunroMerchant B2B procurement.

Later restrictions are configuration and contract state — not schema deletion.

## Relationship to MunroMerchant

Do not mix them:

- **Lifestyle network (Capolavoro Online / MunroMarché):** customer-facing
  partner commerce, media, advertising placements and concierge selected by a
  retailer for the customer relationship.
- **MunroMerchant:** B2B procurement where the retailer buys hangers, bags,
  mannequins, fixtures, furniture and operating services.

They may share partner onboarding primitives, attribution interfaces and
context-neutral money objects through interfaces, but **not** catalogue, order,
cart, inventory or customer tables.

## The compounding flywheel

```text
Retailer trust and curation
  → customer evidence (consented, purpose-bound)
    → relevance (Audience Studio + eligibility)
      → engagement (shelf, media, concierge, MunroMentions)
        → partner / publisher / advertiser demand
          → revenue and network rewards (ledgered)
            → network intelligence (aggregates, experiments, clean rooms)
              → better retailer curation and customer usefulness
```

The moat is not "tens of thousands of profiles for sale." It is a distribution
network of trusted retailer relationships, high-quality declared and observed
intent, a standardized campaign/attribution/ad rail, a partner and publisher
catalogue retailers can activate, measurable outcomes, and retailer economics
under governance.

## Customer experience principles

- the retailer's curation is visible;
- sponsored/affiliate/advertising relationship is disclosed;
- external checkout vs retailer checkout is clear;
- recommendations are sparse and useful;
- customer can hide a topic/partner;
- wardrobe/clienteling relationship is not polluted by every ad click;
- concierge has real human escalation;
- no fake scarcity or impossible availability;
- frequency caps and contact pressure are honest.

## Future requirements, ownership, acceptance and tests

These are **future Stage 15 / 16 requirements**. They authorize design clarity
only; implementation remains ordered by `docs/PHASE.md` and must not jump
ahead of Stage 9–14 foundations.

### NET-101 — Partner catalogue and retailer curation

- **Owner:** domain + partner/retailer portals; PAON approval.
- **Acceptance:** retailer activates a disclosed zero-stock listing across
  lifestyle categories; commercial type is explicit; partner has no raw
  Self-Portrait access.
- **Tests:** category fixtures; commercial-type disclosure; RLS; activation
  prerequisites; competitor exclusion.

### NET-102 — Attribution and economics

- **Owner:** attribution/event ledger + reporting projections.
- **Acceptance:** click → lead/booking/order → hold → payout path; refund
  reverses payable share; CPM/CPC/CPL/CPA/affiliate/sponsorship/booking models
  are representable; fraud hold is observable.
- **Tests:** idempotent events; holding/reversal; multi-party revenue share;
  dedupe keys; experiment/holdout membership.

### NET-103 — Media, publisher cards, MunroMentions, concierge ops

- **Owner:** media/publisher portals + customer placement + concierge tasks.
- **Acceptance:** rights/attribution/outbound/retailer-activation metadata on
  every publisher card; MunroMentions track invitation without copying identity;
  concierge request reaches outcome without inventing money movement.
- **Tests:** rights expiry blocks activation; attribution required; referral
  isolation; concierge SLA/exception states.

### NET-104 — Rewards liability

- **Owner:** rewards ledger; gated by ADR-062 / Stage 6 money decisions where
  stored value applies.
- **Acceptance:** funded/pending/available/reversed/expired entries name
  liability party; transfer only under contract.
- **Tests:** ledger immutability; reversal; expiry; no cash claim without
  design gate.

### NET-105 — Audience Studio and advertising inventory

- **Owner:** audience + ad inventory bounded context; advertiser/PAON portals.
- **Acceptance:** versioned cohorts with forecast under policy; order → line
  item → flight → creative → paced delivery events; frequency caps enforced;
  PAON-executed audience never exports named profiles by default.
- **Tests:** cohort pin on activation; policy-denied forecast; pacing;
  frequency cap; cross-tenant denial; creative rights gate.

### NET-106 — Insights, clean-room, entitlement export

- **Owner:** network intelligence + policy/entitlement plane.
- **Acceptance:** aggregate/benchmark/clean-room/contracted exchange modes only;
  customer-requested named introduction is audited; deletion/correction
  recomputes derived objects.
- **Tests:** minimum-n thresholds; entitlement matrix; correction recompute;
  rejection of uncontrolled named export.

## Delivery sequence (when Stage 15 is authorized)

1. partner/listing/programme contracts and external-link attribution;
2. retailer curation shelf and customer placement;
3. conversion confirmation, holding/reversal and multi-party reporting;
4. concierge requests and local partner operations;
5. media library, publisher cards, licensing and MunroMentions;
6. Audience Studio, ad inventory objects and event economics;
7. provider-backed booking/affiliate/ad adapters;
8. rewards liability/transfer after explicit design gate;
9. clean-room, benchmarking and contracted exchange under entitlement;
10. network optimization over ledgered outcomes — never over raw profile sale.

## Explicit non-claims

- This document does **not** implement Stage 15 software.
- Vision completeness does **not** authorize jumping the `PHASE.md` queue.
- Live advertising, payment, stored value and media rights remain
  `blocked_external` until contracts and credentials exist, even after local
  provider-neutral capability ships.
