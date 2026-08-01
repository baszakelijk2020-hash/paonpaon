# PAON Founder Intelligence Brief

**Status: authoritative founder product intent, not an implementation queue.**
`PAON_INTELLIGENCE_PLATFORM.md` traces every requirement here into technical
acceptance, and `PHASE.md` alone orders implementation. Code and migrations
remain authoritative for what already exists.

## Founder-source fidelity contract

When this brief explicitly asks PAON to build a linked founder tool, the tool
is not loose inspiration. Pag1's specified tools, pag2's groom and best-men
fitting-planning workflow, pag3's Preferred Tailoring/HighMaintenance
workflow, and the visually referenced tools in the founder instructions must
preserve how the source looks, moves and behaves while operating on real PAON
data. The surrounding Atelier Munro brand, literal product catalogue and
commercial universe are adapted to PAON. See ADR-052/071 and
`docs/DESIGN_PORTS.md`.

## Starting point

PAON already has a premium storefront template, a Customer Environment, an
alterations tool, and customer management including appointments. These are
the foundation. The next build must turn PAON into an intelligent,
relationship-led premium-retail platform rather than stopping at a catalogue
or conventional ecommerce experience.

## 1. Intelligent product catalogue and retail knowledge

Every product in the storefront must have more than its main image, swatch,
mill, composition, colour, price, favourite button, and buy button. Products
need structured, reusable metadata: mill, fabric collection, fibre
composition and percentages, weight, weave, pattern, season, construction,
garment type, fit, formality, occasions, climate suitability, breathability,
wrinkle resistance, care, styling compatibility, and relevant product
options.

The catalogue must be searchable and filterable through that data. A client
should be able to find products through needs such as summer, travel, humid
weather, low wrinkles, formal use, wedding dressing, soft construction, or a
specific mill, fibre, weave, weight, pattern, and colour.

Create a library of small, high-quality commercial education snippets. They
must be automatically selected from product metadata and appear in the
existing storefront information areas, including desktop and mobile views.
Cards use a square image on the left, a title, and short useful copy. They
explain, for example:

- Loro Piana, Drago, Zegna, Thomas Mason, and other mills;
- cashmere, wool, cotton, silk, linen, wool-silk-linen blends, Egyptian
  cotton, and why each matters;
- Hopsack, tropical weave, herringbone, Prince of Wales, stripe, check, and
  other weaves/patterns;
- shirt options such as a one-piece Shiller collar;
- construction, fabric performance, styling, and use cases.

The information must answer why an option exists, who it suits, the tradeoffs,
and how it affects value. It must educate clients while naturally advancing
premium choices, cross-selling, and appointments.

## 2. Supplier catalogue ingestion and enrichment

New supplier collections commonly arrive as product-photo URLs plus Excel,
CSV, PDF, or other supplier documents containing product numbers, descriptions,
mill, composition, weight, season, colour, garment type, and prices.

PAON must support a bulk workflow that:

- matches main photographs and swatch photographs to supplier identifiers;
- imports products directly into correct catalogue categories;
- preserves supplier product references and raw values;
- accepts structured supplier facts;
- uses a PAON-defined ChatGPT/LLM CSV or JSON enrichment contract to extract
  facts and propose high-confidence metadata from descriptions such as
  "Loro Piana Summertime Rust Pink Melange Wool, Silk & Linen Tropical Weave";
- identifies likely weave, pattern, fabric type, garment suitability,
  seasonality, performance, and styling possibilities without inventing facts;
- flags uncertainty, shows evidence/confidence/source, detects duplicates, and
  requires review before inferred metadata becomes live;
- lets retailer users review and publish imports at scale.

The system must become more useful as the catalogue grows. It must not rely on
manual, flat product-page copy.

## 3. Sartorial intelligence and complete-look recommendations

PAON must eventually encode the founder's and advisors' sartorial judgement:
fabric compatibility, trousers with jackets, appropriate shoes, shirts,
accessories, colours, occasions, formality, climate, and complete outfits.

The first implementation must establish the data model for explainable
recommendations. A later knowledge-authoring process will capture the
founder's specific rules. PAON may use broad menswear knowledge as a proposal
source, but recommendations must remain explainable, retailer-controlled, and
grounded in approved product/knowledge data.

## 4. TableService, StyleProfile, and appointment conversion

TableService should initially prioritise an advisor handoff, while growing into
a grounded AI assistant that answers from approved PAON knowledge.

Example: a client says they are attending a summer-chic wedding in May 2027.
PAON should welcome them professionally, offer a preliminary shortlist,
explain that in-store fabric books and advisor expertise refine the choice,
and present an elegant Tinder-like swipe experience for suitable options.

Views, searches, favourites, saved products, chat questions, swipe choices,
cart activity, and declared occasion must enrich a customer Self Portrait /
StyleProfile. Before an appointment, the retailer/advisor receives a useful,
consented briefing: likely need, product interest, preferences, questions,
shortlist, and preparation suggestions. The advisor continues the conversation
online and in-store instead of starting from zero.

## 5. Wardrobe Management and Wardrobe Roadmap

Create a visual wardrobe-management tool. A customer can add purchases from
the retailer and garments bought elsewhere. The customer and advisor can record
garment details, ownership, condition, fit, care, age, rotation, and styling
relationships.

The advisor should build an ideal, personalised wardrobe roadmap: a deliberate
whole wardrobe rather than isolated product purchases. It can contain, for
example, a navy cashmere overcoat, camel jacket, dark grey separate trousers,
dark brown penny loafers, denim Albiati shirt, and the correct pocket square.

Each proposed purchase must fit a coherent wardrobe puzzle, show the gap it
fills, explain compatibility with owned garments, and guide the client through
staged priorities. This keeps future purchasing within a trusted wardrobe plan
and makes the retailer the ongoing wardrobe partner rather than one store among
many.

## 6. MorningRoutine and hyperlocal service

Use accepted catalogue metadata, wardrobe data, StyleProfile, client location
consent, weather, temperature, calendar/occasion context, and preferences to
select daily clothing recommendations.

MorningRoutine should be available in-app and as an explicit opt-in email
subscription. Example: a client in Blaricum receives an appropriate rainy-day
recommendation for an all-weather coat, with a meaningful one-tap review or
purchase path. Messages must be timely service, not generic advertising.

Retailers need controls for campaigns and products promoted through these
messages. Location, marketing, and personalisation consent must be explicit,
separate, visible, and revocable.

## 7. Fit relationship and self-scan

Each purchased item in a customer's order history should support a self-scan:
the customer can periodically upload a photo wearing the garment and add notes
or report potential size changes. This should invite an alteration or free fit
update appointment, preserve the customer relationship, and give advisors
context for a service-led sales conversation.

The Customer Environment needs a visible fit freshness indicator: last
measured date, progressively more urgent status after extended time, and a
clear appointment action. This must respect PAON's existing rule that formal
fitting observations belong to physical garments; self-reported information is
not silently treated as a manufacturing measurement profile.

## 8. Garment longevity / planned rotation

Create a respectful garment-rotation and longevity tool. Show garment age and
time since wear, encourage suitable rotation of suits, shirts, and shoes, and
frame rest, cleaning, repair, and care as sustainable wardrobe stewardship.
The purpose is continued client service and longer garment life, not coercive
obsolescence.

## 9. Milestones and premium rewards

Create MunroMilestones-style recognition for meaningful stages in a tailoring
relationship: first commission, repeat orders, a new product category,
full-canvas upgrade, advanced fabrics, and comparable milestones.

Badges and rewards must feel premium and restrained, never like gambling,
discount retail, or a low-end loyalty app. They should strengthen loyalty,
encourage considered progression, increase order frequency, and support higher
value choices.

## 10. Membership, Preferred Tailoring, and HighMaintenance

Create membership/service capabilities for an intensive wardrobe relationship.
Preferred Tailoring means an advisor/Executive Style Director prepares a
client's wardrobe around agenda, dress codes, travel, and upcoming needs.

HighMaintenance means ongoing shirt pressing, pleat maintenance, button
checks, size checks, repairs, cleaning, collection/delivery, and return at the
right time. PAON must support service plans, bookings, fulfilment, costs,
credits, subscriptions or billing where legally/provider-approved, and advisor
operations. The retailer becomes the client's end-to-end wardrobe partner.

## 11. Campaigns, private offers, and seven-day wardrobe

Add refined in-app Customer Environment campaigns:

- a guided seven-day retailer wardrobe, where clients compose ideal looks for
  each day using the catalogue;
- elegant rewards such as a personalised tie, shirt, or short-lived carefully
  controlled offer after completion;
- members-only weekly or daily offers, retailer-controlled by fabric,
  category, product, audience, and schedule;
- a dedicated private offers area visible to authenticated customers.

This must remain high-end and relationship-led, never resemble Groupon,
Shopee, gambling, or indiscriminate discounting.

## 12. Payment eligibility, one-click purchasing, and MunroMonnaie

Add a Customer Environment payment-eligibility journey and visible status.
Eligible clients can enable an approved one-click purchase experience using
stored provider-authorised payment data and existing account information.

The intended MunroMonnaie concept is not PAON-issued credit: it is a trusted,
provider/legal-approved order-commitment and deposit experience that reduces
online hesitation while preserving premium positioning. Any deposits,
instalments, direct debit, stored value, subscription, or balance collection
must use a separate payment/compliance ADR and approved provider capability;
never invent custom credit, lending, or unsafe billing logic.

## 13. Tie-Mate

Create a mobile-first Tie-Mate experience. Clients see available tie fabrics
at true-feeling phone-screen scale, swipe through them while holding the phone
in front of themselves, then save, order, or begin an advisor conversation.
It should celebrate ties as a serious style component and connect directly to
the retailer's stock/catalogue.

## 14. Retailer-owner marketplace

Create a separate marketplace for retailer owners, visually familiar to the
PAON catalogue but modelled as distinct business commerce. Retailers can buy
mannequins, paper bags, shoe displays, custom furniture, fixtures, and other
retail supplies. The founder will populate products later.

## 15. Self-Portrait, evidence-cited clienteling, and For You

Turn every meaningful customer touchpoint inside PAON and retailer PAON
storefronts/apps into an evidence-cited, timely, assignable clienteling
opportunity and a better customer For You experience. This is first-party
activity only. Do not design around unrelated-site browsing or browser history.

### Product north star

The system must derive conclusions such as:

- "Viewed 10 suits in 30 days; 8 were brown"
- "Usually active Sunday mornings and weekday evenings"
- "Started exploring shoes after a suit purchase"
- "Saved two linen checks in Tie-Mate"
- "Wedding anniversary is in 30 days"
- "One month since purchase: ask about fit and care"

Every conclusion must show why, source window, numerator/denominator where
relevant, confidence, freshness, and the raw/durable evidence references needed
to verify or correct it. AI may summarize or rank eligible facts; it may not
invent them.

### Market lesson

Deep evidence must become sparse action, not raw surveillance dashboards.
Competitor patterns already prove the shape without copying vendors: Shopify
semantic commerce events and segments, Salesforce/Tulip/NewStore clienteling
tasks and follow-ups, and SevenRooms/OPERA preference/occasion profiles all
convert signals into assignable work and better service. PAON must do the same
with accepted menswear metadata, consent, and explainability.

### Who sees what

1. **Customer environment** — transparent My Style/Self-Portrait, declared
   preferences, inferred preferences with explanations, favourites, Tie-Mate
   results, appointments, corrections, and one obvious For You page populated
   from quiz rectangles, accepted product metadata, favourites, purchases,
   wardrobe gaps, advisor observations, occasions, and recent behaviour.
2. **Individual salesperson** — Today/opportunity inbox, assigned and recent
   customers, why-now hooks, recommended action/channel/time, contact-pressure
   warning, appointment prep and post-appointment closeout, and the full
   customer relationship workspace.
3. **Branch manager** — branch-shared appointment calendar, recurring events,
   coverage/assignment, named authenticated active/recent customers where
   available, aggregate anonymous demand, hourly/day/week/month/year hotspot
   heatmaps, unattended opportunities, advisor follow-through, and outcome
   funnel.
4. **Retail owner** — enterprise and branch rollups, demand/category/concept
   trends, customer cohorts, clienteling touchpoints and outcomes,
   opportunity-to-appointment/order attribution, contact fatigue, For You
   performance, data quality, and adoption. Never reduce this to vanity event
   counts.
5. **PAON admin/operations** — ingestion lag/failures, event-schema registry,
   tenant isolation evidence, data quality, projection versions, policy
   configuration, model/version audit, correction rates, and explainability
   health — not unrestricted browsing of retailer customer content.

### Capability first, policy second

Build the deepest useful first-party PAON technical capability. Do not hard-code
California, another US state, or EU limitations into the core event, projection,
profile, ranking, or UI architecture. Put collection/retention/visibility/
consent rules behind a configurable policy/eligibility layer so capability can
later be narrowed per tenant and jurisdiction without redesign. Security,
tenant isolation, authentication, provenance, auditability, correction,
deletion hooks, field masking, and secrets/payment/password exclusion are
engineering invariants, not optional policy. This is a local build programme;
do not deploy or enable an unlawful production configuration.

Payment/compliance Stage 6 gates remain unresolved and must not be pretended
resolved by this stage.

## Product and engineering requirements

- PAON owns the canonical menswear taxonomy and knowledge library.
- Retailers operate their own tenant catalogue, can import products, review
  data, and apply retailer-specific presentation/recommendation overrides.
- Customer data, behavioural signals, and location require strict tenant
  isolation, explicit consent, explainability, retention control, and
  advisor-safe views.
- All recommendations and AI answers are grounded in accepted metadata and
  approved knowledge; recommendations explain why.
- The founder storefront HTML and existing founder surfaces remain visually
  canonical. New data must use narrow hooks instead of redesigning them.
- Use PAON's existing domain, repository, Server Action, branded-ID, RLS,
  migration, and testing architecture. Extend existing abstractions rather
  than creating a parallel product.
- Build continuously: inspect, implement, test, repair, update authoritative
  status, commit, push, and immediately continue to the next buildable item.
