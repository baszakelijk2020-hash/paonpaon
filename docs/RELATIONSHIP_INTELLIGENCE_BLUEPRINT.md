# Relationship Intelligence Blueprint

**Status:** authoritative founder-level product specification, extending
[NORTH_STAR.md](./NORTH_STAR.md), [VISION.md](./VISION.md),
[PRODUCT.md](./PRODUCT.md) and [DOMAIN_MODEL.md](./DOMAIN_MODEL.md). This
document deepens Module 2 (Client and Relationship Intelligence) and its
load-bearing connections into Modules 3, 5, 6 and 7. It is a specification to
be implemented feature by feature under `PHASE.md`'s authorized queue — it is
not itself a queue, and nothing here is built until `PHASE.md` sequences it.
Where this document names a new entity, table shape or domain concept, it is a
target contract for a future PHASE item, not a claim that it exists in code
today.

This document does not repeat what those four documents already establish; it
assumes them. Where a new idea would duplicate or compete with an existing
mechanism — StyleProfile, cited recommendations, consent purposes, the module
kernel, Academy, corporate business-development — this document extends that
mechanism by name and explains the extension, rather than inventing a second
system that does the same job differently. Every new concept below states
which existing module it belongs to and what it depends on, in the same
vocabulary `PLATFORM_MODULES` already uses.

---

## 1. Relationship Intelligence Philosophy

### Why relationship intelligence outranks CRM

A CRM records that a transaction happened and who it happened with. It is a
ledger of contacts and deals — built for a sales funnel, not a relationship
that is supposed to last a decade. It answers "when did we last speak" and
"what did they buy," never "what does this person's life look like now, and
what does that mean for how we serve them next."

Relationship intelligence is the discipline of turning what an advisor
already notices — a promotion, a new city, a wedding, a shift in taste — into
structured, evidenced, correctable memory that compounds. The difference is
not more data. It is that the data has _shape_: every fact has a type, a
source, a time, and (where AI touched it) a citation back to the evidence
that produced it. A CRM free-text note that says "John got promoted, seemed
stressed, mentioned needs suits for new role" is unusable six months later by
a different advisor. A structured `customer_facts` row of type `career_event`
with subtype `promotion`, linked to the appointment it was captured in, is
immediately actionable, immediately searchable, and immediately composable
into a brief, a KPI, or a relationship-graph edge.

### Why structured beats free text

Free text is where good observation goes to die. It cannot be aggregated
("how many clients had a career event in Q2"), cannot be surfaced reliably at
the right moment (a keyword search is not a briefing), cannot be corrected
without rewriting a paragraph, and carries no provenance — six months later
nobody can tell whether "seemed stressed" was the advisor's read or something
the client said outright. PAON's existing `EntityMetadataAssignment` pattern
already proves the alternative works: every assignment carries `source`,
`reviewStatus`, `confidence`/`evidence`, and a reviewer/timestamp on any
terminal decision. This blueprint applies that exact discipline to
relationship facts, not just product metadata. Free text is not eliminated —
an advisor's own words remain the qualitative texture behind a fact — but it
is always attached _to_ a structured type, never a substitute for one.

### How luxury retail differs from transactional retail

Transactional retail optimizes conversion on a single visit. Luxury retail's
economics run on wardrobe share and relationship duration — a handful of
clients who return for a decade are worth more than a wide funnel of
one-time buyers. That changes what's worth capturing: not "what converts
this session" but "what makes the next five years of this relationship
better." It also changes cadence — a menswear client might have four to six
meaningful touchpoints a year, not forty. Every one of those touchpoints has
to earn its keep, which is why House Memory exists: nothing captured in one
conversation should ever have to be re-asked in the next.

### Why advisors remain central

PAON does not sell a relationship — an advisor does. The product's job is to
make an ordinary advisor perform like the house's best advisor, by handing
them the context, the history and the next action a great advisor would have
held in their head. AI in this system ranks, composes, explains and drafts;
it never decides, never measures, never invents a fact about a client it
cannot cite. `VISION.md` already states this as law: _"AI can rank, compose,
explain and summarize inside this loop. It is never the authority for a
measurement, consent, payment, inventory count, production status or
unsupported personal claim."_ Every feature in this document is designed so
an advisor can see exactly why PAON suggested something, correct it in one
action, and know that the correction is what future suggestions will be
built from.

### How structured information compounds over years

A garment graph gets more useful every time a piece is altered, worn, or
replaced. A StyleProfile gets more useful every time a preference is
confirmed or corrected. A relationship graph gets more useful every time a
company fact is added or an introduction happens. None of this compounds if
it lives in an advisor's head or a departing employee's notebook — it
compounds only because it is written down once, in a shape the system can
reuse forever, attributed to whoever captured it, and survivable across staff
turnover. That is the entire commercial thesis of House Memory: _"portable
institutional memory when staff are absent or leave. This is continuity
insurance, not merely CRM."_

---

## 2. Post-Appointment Intelligence

### Design principle

Replace the free-text "appointment notes" habit with a **structured
appointment debrief**: a short, card-driven capture flow an advisor completes
in under two minutes right after (or during) a client conversation. Every
field is optional — nothing is forced, and an advisor who only has thirty
seconds can capture one card and move on. The debrief writes into existing
PAON primitives wherever one already exists (StyleProfile evidence,
`customer_facts`, wardrobe roadmap gaps) rather than creating a parallel
"notes" object that duplicates them.

### The debrief object

A new `AppointmentDebrief` attaches to an existing `Appointment` (one debrief
per appointment, append-only correction history matching the
`fitting_observations`/`AlterationUpdate` precedent — a correction is a new
row referencing the one it supersedes, never an in-place edit). It is
composed entirely of **structured fact cards**, each with:

- a fixed **category** (below),
- a fixed **subtype** within that category (a closed vocabulary per
  category — never a free-text taxonomy an advisor invents on the spot),
- an optional **structured value** (a date, a company name, a scale, a
  yes/no),
- an optional **short note** (plain text, capped, for the one sentence of
  color a category can't structure),
- **source** (`advisor_observed` or `client_stated` — this single field is
  the difference between "the advisor noticed" and "the client told us,"
  and it matters for both trust and consent basis),
- the standard provenance fields every PAON fact already carries: recorded
  by staff id, appointment id, created at.

### Categories (extending `customer_facts`, not replacing it)

`customer_facts` already has an `employer` fact type (used today by BD-112's
cross-referencing). This blueprint extends the fact-type vocabulary rather
than building a second table:

| Category                     | Subtypes (closed vocabulary)                                                                                  | Notes                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Career & company**         | promotion, new_role, new_employer, company_change (merger/acquisition/funding), board_appointment, retirement | Directly feeds the Relationship Graph (§12) and BD signal matching.                                                                                                                                                         |
| **Life event**               | marriage, engagement, child_born, relocation, new_home, bereavement                                           | `bereavement` is advisor-observed only, note-only, and deliberately has no further structured subtype — dignity over data.                                                                                                  |
| **Wardrobe context**         | upcoming_occasion, new_role_dress_code, travel_pattern_change, seasonal_shift                                 | Feeds the wardrobe roadmap gap engine (already built, Stage 4.2) directly — an occasion or dress-code change should be able to generate a roadmap gap, not just sit in a debrief.                                           |
| **Preference signal**        | fit_feedback, fabric_reaction, style_direction, budget_signal                                                 | These write as StyleProfile evidence (`source: "advisor_observed"` or `"declared"`) exactly like a product view or favorite does today — a structured preference confirmed in conversation is evidence, same as a click.    |
| **Fit-relevant change**      | garment_now_loose, garment_now_tight, posture_or_mobility_note                                                | Free-text note field only, no further structured subtype, advisor-observed only. See §15 — this category deliberately excludes any medical/health taxonomy.                                                                 |
| **Hospitality & taste**      | beverage, cuisine, sport, art/culture, other_luxury_category                                                  | A short fixed picklist per subtype (e.g. beverage: coffee/tea/wine/whisky/none-noted), not free text, so it becomes a genuine "conversation starter" query later, not a pile of unstructured trivia.                        |
| **Communication preference** | preferred_channel, preferred_cadence, do_not_contact_topic                                                    | Feeds directly into campaign suppression and Mission Control targeting — this is operational, not merely color.                                                                                                             |
| **Business opportunity**     | referral_offered, warm_introduction, company_expansion_mentioned, hiring_mentioned                            | Writing one of these can, with an explicit advisor action (never automatic), create a `corporate_opportunity_signals` row via the _exact same_ `addSignal` path BD-101 already built — no second signal-ingestion pipeline. |

### The capture UX

Not a form. A short deck of cards presented in the appointment's own context
(bound to the appointment, reachable from the appointment detail page and
from the post-appointment "closeout" step that already exists per
`CAPABILITY_DISPOSITION.md`'s 11.2 Today/closeout item). Each card shows a
category, its closed subtype picklist as tap targets (not a dropdown — this
is a two-minute mobile-first flow, matching `UX_PHILOSOPHY.md`'s mobile-first
rule), and one optional short-note field. An advisor swipes past categories
that don't apply. Completed cards summarize inline (matching the established
card grammar's "status + evidence, no external badge layer" pattern);
untouched categories stay collapsed. There is no save button per card — each
tap is its own atomic write, matching the "no lost work on a dropped
connection" discipline already used elsewhere (idempotent save, retained
draft on failure).

### What this deliberately does not do

It does not replace pinned conversation notes for genuinely unstructured
context — those remain free text by design, for the minority of things that
truly resist structure. It does not auto-generate a "customer summary"
paragraph from the cards; a browsable list of dated, sourced facts is more
trustworthy and more useful than prose a human didn't write, and matches
`VISION.md`'s "AI is never the authority for an unsupported personal claim."

---

## 3. Built-in SOP Engine

### Design principle

PAON already has a **versioned workflow and familiarity presets** primitive
(Stage 8.3, disposition: Consolidate — "surface them contextually inside
service, campaign and operations journeys rather than as an abstract
workflow product"). The SOP Engine is that consolidation for appointments
specifically: pre-appointment, during-appointment and post-appointment
standard operating procedure, expressed as the same card grammar as
everything else in this document, not a separate checklist product.

### Structure

An `SOPDefinition` is retailer-owned, versioned (immutable once published —
matching `corporate_entitlement_versions`' and `corporate_tender_versions`'
insert-only pattern), and scoped to one of three moments: `pre_appointment`,
`during_appointment`, `post_appointment`. It is composed of an ordered list
of **SOP cards**, each one of a fixed card kind:

- **checklist item** — a single yes/no or done/not-done action;
- **prompt card** — a question the advisor should ask or consider (renders
  as a plain card, never a form field, since it's guidance not data entry);
- **data-capture card** — a pointer into an existing structured capture (an
  Appointment Debrief category from §2, a StyleProfile confirmation, a
  wardrobe roadmap review) — the SOP Engine composes existing capture
  surfaces, it does not duplicate them with its own competing fields;
- **knowledge card** — a pointer into a Retail Academy card (§5) relevant to
  this appointment (a new fabric, a styling technique) surfaced at exactly
  the moment it's useful, not buried in a separate learning module.

PAON ships a starter library of best-practice SOPs (pre-appointment: review
last visit's promises and open wardrobe gaps; during: confirm any StyleProfile
inference that's gone stale per its existing 180-day staleness threshold;
post: complete the Appointment Debrief). Retailers may add their own SOP
cards on top — additive, never a fork of the shipped baseline, matching the
module system's own "retailers configure through modules, not product
forks" principle.

### Flows

- **Advisor**: sees the relevant SOP surfaced automatically at each moment —
  pre-appointment SOP appears on the appointment brief the moment it's
  opened (composing directly into Advisor Today, §4); during-appointment SOP
  is a lightweight always-visible strip during a live/table-service session;
  post-appointment SOP gates into the closeout flow and is satisfied the
  moment its underlying data-capture cards are satisfied (completing an
  Appointment Debrief category checks off the matching SOP item
  automatically — no double data entry).
- **Manager**: sees SOP completion rate as one of the KPIs in §7 ("follow-up
  completion"), can author new SOP cards for their store, cannot silently
  edit a published version — a correction is a new version, exactly like
  `corporate_tender_versions`.
- **Owner**: authors the house's default SOP library once; it becomes the
  baseline every advisor inherits, revisable without breaking in-flight
  appointments that were already pinned to the version active when they
  started (the same "old in-flight work retains its pinned contract"
  guarantee the disposition registry already requires of 8.3).

---

## 4. Advisor Dashboard

### Design principle

PAON's retailer dashboard already has the right shape — a role-scoped
"Brief" with a prioritized `#attention` feed composed of typed cards (price
approval, appointment, unread message, low stock, draft opportunity), each
rendered with the established left-border-accent-for-priority grammar. This
section is not a redesign; it is the card-type vocabulary that feed should
grow into, using the exact same `Card` primitive, `--color-stone-*` tokens,
and hover-lift/staggered-entrance interaction language already established.

### New card types (additive to the existing five)

| Card                                    | Trigger                                                                                                    | Composes from                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Relationship change**                 | A new Appointment Debrief category-2 fact was captured for one of this advisor's clients                   | `customer_facts` (career/life-event categories)                                                                                                            |
| **Wardrobe gap**                        | An approved roadmap gap exists with no linked proposal                                                     | Existing Stage 4.2 roadmap (already a field on `AdvisorPreparationBrief`, just not yet promoted to the dashboard feed)                                     |
| **Opportunity**                         | An open `corporate_opportunity` or clienteling opportunity needs the next stage action                     | Existing business-development pipeline (18.1)                                                                                                              |
| **Conversation starter**                | A Hospitality & Taste fact exists and an appointment is upcoming for that client                           | §2's structured picklist facts, never free text                                                                                                            |
| **Personal preference confirmed/stale** | A StyleProfile inferred preference just crossed its staleness threshold                                    | Existing `AdvisorBriefEvidenceItem.stale` flag                                                                                                             |
| **Recently viewed online / wishlist**   | A consented interest event landed for a client with an upcoming or recent appointment                      | Existing `AdvisorPreparationBrief.interests`/`.shortlist`                                                                                                  |
| **Open alteration**                     | A physical garment's alteration crosses a status the advisor should know about (ready for pickup, delayed) | Existing garment/service operations status history                                                                                                         |
| **Upcoming event**                      | A client-relevant upcoming occasion or a house event they're invited to                                    | §2's `upcoming_occasion` subtype + existing event/RSVP objects                                                                                             |
| **Previous objection**                  | A declined proposal or a recorded "not this time" from a past appointment                                  | New: `checkRecommendationHonesty`-style — record decline reasons, not just accept/decline, the same way buying intelligence (§9) records lost-sale reasons |
| **Recent measurement/fit note**         | A new fitting observation or Appointment Debrief fit-relevant change                                       | Existing `fitting_observations`                                                                                                                            |
| **Cross-sell opportunity**              | A cited "complete_look" recommendation exists for this client                                              | Existing `cited_recommendations` (kind: `complete_look`)                                                                                                   |

### UX discipline

Every card follows the established grammar exactly: header + one-line
description, early-exit (render nothing rather than a fabricated empty
state), evidence/timestamp inline, progressive disclosure of any action into
a Server Action form only once the card's state warrants it. Cards do not
require clicking through tabs — the dashboard remains one prioritized feed,
sorted by a fixed, inspectable priority rule (never a hidden relevance
score — matching the "no black box" non-goal), with an explicit "why this is
here" line on every card (source + occurred-at, exactly like the existing
five card types already do). A card expands, on click, into the relevant
customer/appointment detail page — it never becomes its own silo.

---

## 5. Product Knowledge / Retail Academy

### Extends, does not replace

PAON already has an Academy domain
(`packages/domain/src/knowledge/academy-consultancy.ts`) with roleplay
personas, rubric-graded evidence, and a publication gate requiring human
approval for any AI-generated content. This section is the **knowledge-card
architecture** that Academy's training content and Mission Control's
announcements (§10) should both be built from, replacing the implicit
"long article" assumption with something reusable.

### The knowledge card object

A `KnowledgeCard` is small, single-concept, and reusable:

- **kind**: `fabric`, `technique`, `product_family`, `styling_idea`,
  `selling_technique`, `brand_or_supplier_fact`, `campaign_brief`.
- **title + one-paragraph summary** (the card's collapsed state — matches
  the established card grammar exactly).
- **structured attributes** where the kind supports them (a fabric card has
  composition, weight, season, care instructions as structured fields, not
  prose).
- **links**, typed, not a wall of "related articles": to products, to
  lookbook assets, to video, to relevant SOP cards (§3), to the Academy
  roleplay persona it's most relevant for, and — critically — to other
  knowledge cards (a `#suit-configurator-widget` fabric might link to a
  lapel-style technique card and a related product family card). This is
  the knowledge-graph structure the user asked for: cards linking to cards,
  not a flat CMS.
- **review state**: reuses `EntityMetadataAssignment`'s exact
  `pending`/`accepted`/`rejected` review discipline and reviewer/evidence
  requirement — a knowledge card authored or drafted by AI is never
  published without a named human reviewer, matching Academy's existing
  `checkPublication()` gate precisely.

### Where cards surface (the actual product value)

A card is worthless in a library nobody opens. Cards surface _at the moment
they're useful_, pushed by Mission Control (§10) or pulled by context:

- pre-appointment SOP (§3), when the appointment's likely need matches a
  card's linked product family;
- inside the product page itself (the same card, same component, reused —
  not a separate "product education" system);
- inside the Appointment Debrief (§2), when a captured preference matches a
  card;
- inside Academy's roleplay grading, as the "what you should have known"
  reference attached to a rubric criterion;
- customer-facing (§13), the identical card component with an
  advisor-controlled visibility flag, never a second content system.

### Flows

- **Manager/Mission Control**: authors or licenses a card, submits for
  review — the same review gate metadata assignments already use.
- **Advisor**: consumes cards contextually; can bookmark a card to their own
  "recently learned" list, which itself becomes a `knowledgeConsumed` entry
  on their own advisor record — the same shape `AdvisorBriefKnowledgeItem`
  already tracks for _clients_, applied symmetrically to staff.
- **Owner**: sees Academy completion and roleplay grade trends as part of
  the KPI platform (§7).

---

## 6. Product Visibility Profile

### Design principle

A narrow, inspectable configuration object per advisor (or per client
relationship, where a specific client relationship overrides the advisor
default) that shapes which products a recommendation surface (Advisor Today,
complete-the-look, MorningRoutine) is willing to show — never a filter that
silently deletes manual search results, and never something that downgrades
without an explicit human decision.

### Fields

- `priceFloorMinorUnits` (optional) — hide below this price in _ranked
  recommendation surfaces only_.
- `priorityMode`: `standard`, `prioritize_mtm`, `prioritize_luxury_tier`,
  `prioritize_premium_tier` — a ranking weight applied on top of existing
  recommendation scoring, not a hard filter.
- `autoExpandUpward: boolean` (default true) — when a client's own
  StyleProfile/purchase history suggests a higher tier than the current
  floor, the system may surface it; it must never do the reverse.
- Scope: `retailer_default`, `advisor_override`, `relationship_override` —
  three layers, most specific wins, matching the existing "highest wins,
  only one wins" precedent already used for `AccountType` resolution
  priority.

### The one hard rule

**Never automatically downgrade.** If a client's own evidence points toward
a lower tier than the configured floor, the system shows the evidence (as an
Advisor Today card, not a silent re-ranking) and lets the advisor decide.
Manual search always bypasses the visibility profile entirely — this is a
ranking preference for _recommendation surfaces_, never a hidden product
catalogue restriction, which would contradict the existing catalogue
authority boundary (Shopify/commerce platform owns catalogue truth; PAON
owns ranking on top of it).

---

## 7. Retail KPI Platform

### Design principle

Every KPI in this platform must satisfy `cited_recommendations`' existing
discipline: a plain, inspectable computation with a stated evidence window
and sample size, never a hidden model score. A KPI is not a chart; it is a
`cited_recommendation` of kind `operational` (or a new sibling kind) with an
explicit formula, rendered as a number with its own citation, exactly like
the renewal-risk score (18.9) already does for corporate programmes.

### Scope and roll-up

KPIs compute at the advisor level and roll up unweighted to store, region
and owner — the same number means the same thing at every level, so a
manager comparing two advisors is comparing like with like, not a
re-normalized composite.

### The KPI set (each with its own "why it matters" and formula, kept

inspectable — no metric ships without both)

| KPI                                                                          | Why it matters                                                                                                                            | Formula sketch                                                                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Conversion rate**                                                          | Appointments that produce an order                                                                                                        | orders / appointments in window                                                                                                      |
| **Appointment volume & fill rate**                                           | Is the book being worked                                                                                                                  | booked appointments / available advisor capacity                                                                                     |
| **Client retention**                                                         | The core luxury economics — repeat relationships, not one-time sales                                                                      | clients with 2+ orders across a rolling window / total clients with 1+ order                                                         |
| **Average wardrobe value**                                                   | Depth of relationship, not just transaction size                                                                                          | sum of a client's lifetime order value / active client count                                                                         |
| **Units per transaction**                                                    | Cross-sell health at the transaction level                                                                                                | line items / order                                                                                                                   |
| **Category penetration** (accessories, shoes-per-tailoring, shirts-per-suit) | Are natural pairings actually happening                                                                                                   | category-B units / category-A units, per named pairing, not a generic "attach rate"                                                  |
| **Repeat purchase interval**                                                 | Time between commissions — the "service interval" NORTH_STAR.md already names as a supporting measure                                     | median days between a client's orders                                                                                                |
| **Client lifetime value**                                                    | Long-horizon relationship value, computed transparently from real order history, never modeled/predicted without a stated confidence band | sum of realized order value to date (a _forecast_ CLV, if ever added, must carry a confidence band per §8 — never presented as fact) |
| **Follow-up / SOP completion rate**                                          | Is the house's standard of care actually being executed                                                                                   | completed SOP items / assigned SOP items                                                                                             |
| **Referral rate**                                                            | Real warm-introduction activity from §2's business-opportunity facts                                                                      | referral-sourced new clients / total new clients                                                                                     |
| **MTM ratio**                                                                | Mix signal relevant to service model and margin                                                                                           | MTM units / total units                                                                                                              |
| **Lost-sale rate & reason mix**                                              | Direct feed from Buying Intelligence (§9) — the metric buyers actually need                                                               | lost-sale events / (lost-sale events + completed sales), broken down by reason                                                       |

### What's deliberately excluded from the headline set

**NPS is not a headline KPI here.** In a low-volume, high-touch relationship
business, NPS suffers from tiny response counts and social-desirability bias
(a client who just spent five figures with an advisor they like rarely
scores honestly low), so it is demoted to an optional supplementary signal
at most, never presented with the same visual weight as retention or wardrobe
value. See §15 for the full cut rationale.

### AI's role

AI may explain a KPI's movement ("conversion dipped because three
appointments with high wardrobe-gap scores didn't convert this month — see
the underlying appointments") but the explanation itself must cite the exact
records behind it, matching §8's rule exactly. It never generates the KPI
number itself by inference.

---

## 8. AI Business Analysis

### Design principle — no black box, ever

Every AI-touched number in this system already has a home:
`cited_recommendations`, with its `EvidenceSource` (sourceRef,
projectorVersion, observedRows) and its three-band confidence system
(`insufficient_sample` <10 rows, `indicative` 10–49, `supported` 50+ — never
a percentage implying false precision). This section names the specific
business-analysis recommendation kinds worth adding to that existing system.
It does **not** propose a separate "AI insights" product, matching Stage
14.2's explicit disposition: _"Do not ship a separate 'AI intelligence'
destination or hidden personality score."_

### New recommendation kinds (siblings of the existing `operational`/`risk`/`corporate` kinds)

- **Budget forecasting** — a store or advisor's near-term revenue trajectory,
  computed from open pipeline (booked appointments, open opportunities,
  wardrobe-gap-driven proposals) weighted by historical conversion, with the
  confidence band scaling down as the sample of comparable historical
  periods shrinks. Never presented as a single number without its band.
- **Revenue composition** — the plain breakdown of realized revenue by
  category/advisor/client-tier over a window; this is arithmetic, not
  inference, and should be presented as such (no confidence band needed —
  it's a sum, not a model).
- **Outlier detection** — a single order or client materially larger than
  the trailing distribution, flagged with the statement "this order is N
  standard deviations above the trailing 90-day median" rather than a vague
  "unusual activity" claim.
- **Seasonality** — a cited comparison of the current period against the
  same period in prior years, only computed once at least one full prior
  comparable window exists (otherwise `insufficient_sample`, stated
  honestly rather than guessed).
- **Customer concentration risk** — the share of revenue attributable to
  the top N clients; useful and honest, computed directly from order data.
- **Advisor dependency** — the share of revenue or relationships
  concentrated on one advisor; this is the single most important
  "continuity insurance" metric NORTH_STAR.md already names as a strategic
  asset, and should be framed to owners exactly that way (succession risk,
  not a performance ranking).
- **Category dependency** — analogous concentration check by product
  category or supplier.
- **One-off project / major-customer influence** — explicitly separates a
  single large corporate programme or wedding-party order (Enterprise
  module) from organic run-rate revenue, so a big one-time win never
  quietly inflates the trend line.
- **Expected revenue gap** — the delta between the budget forecast above and
  what current pipeline actually supports, stated as a gap with its own
  contributing factors listed (not just a number).
- **Pipeline quality** — a cited breakdown of the existing `corporate`
  opportunity pipeline (18.1) by stage age and score distribution — reusing
  BD-101's fixed-weight scoring, never a second competing score.
- **Forecast confidence** — not a separate metric; every forecast above
  _carries_ its own confidence band as a first-class field, matching the
  existing pattern exactly.

### The one rule that governs this entire section

Every recommendation must be **explainable and correctable** the way
`checkRecommendationHonesty` already enforces for stock/lead-time/staffing
claims: it must not overclaim available stock, must not understate real
lead times, and must not cite an advisor who isn't actually rostered. Any
new business-analysis kind added under this section inherits that same
honesty check, extended to its own domain (a revenue forecast must not
imply certainty the sample doesn't support; a concentration-risk flag must
not name a client the viewing role isn't entitled to see).

---

## 9. Buying Intelligence

### Design principle

The genuinely valuable half of buying intelligence is **offline, not
online** — a client who tried something and didn't buy it is worth more
signal than a hundred anonymous page views, but only if the _reason_ is
captured structurally instead of living in an advisor's memory.

### Online signals (already substantially built — extend, don't rebuild)

Views, searches, wishlist saves, cart abandonment, color/size/margin —
these already flow through the existing consented `behavioral_events` /
StyleProfile evidence pipeline (`product_viewed`, `product_favorited`,
`search_performed`, `filter_applied`, `cart_updated`). This section adds
one new evidence source, `cart_abandoned_recovered` vs.
`cart_abandoned_lost`, so recovery rate becomes a real, citable metric
rather than an inferred guess.

### Offline signals — the new, load-bearing object

A `LostSaleEvent`, captured by the advisor at the point it happens (a card in
the till/POS flow and, more importantly, a quick-capture card reachable from
the same "closeout" moment the Appointment Debrief lives in), with a
**closed reason vocabulary** — never free text as the primary field, exactly
matching this document's §2 discipline:

- `color_unavailable`
- `size_unavailable`
- `store_does_not_carry_item` (with a pointer to what they actually wanted,
  if known — a competitor mention, a specific fabric)
- `requested_different_colour` / `requested_different_fabric` /
  `requested_different_fit` / `requested_different_category`
- `price_objection`
- `deferred_decision` (the "I'll think about it" case — genuinely different
  from a hard no, and should be tracked as a follow-up trigger for §4's
  dashboard, not just a loss)
- `other` (free-text note allowed only here, capped, and never the primary
  aggregation key)

Each event links to the specific product/variant it concerned (when known),
the advisor, the store, the supplier (derived from the product, not
re-entered), and the season. This is exactly the fact-with-provenance shape
already established, applied to a "no" instead of a "yes."

### The dashboards this actually enables

Because every field is structured and closed-vocabulary, a buyer gets real
answers with zero manual aggregation: lost sales by colour, by size, by
category, by supplier, by season, by store, by advisor — each one a
straightforward `group by` over `LostSaleEvent`, each one inspectable back
to the individual events behind it (matching §8's "explainable, not a
score" rule). This is the single highest-leverage idea in the whole
blueprint for a buying team, because it replaces "the reps say size 52 keeps
selling out" with an actual count.

### What this deliberately excludes

No inferred lost sales from browsing abandonment alone — an anonymous
bounce is not a lost sale, it's a browsing signal already covered above. A
`LostSaleEvent` requires a real advisor-observed interaction; inventing one
from web analytics would be exactly the "unsupported personal claim"
VISION.md prohibits, applied to inventory instead of a person.

---

## 10. Mission Control

### Design principle

Mission Control already exists as a concept in `PRODUCT.md`'s vocabulary
and as a partial build (Stage 17.2, Mission Control unified brief). This
section is its publishing half: the mechanism by which leadership pushes
collection priorities, campaigns, selling focus and knowledge cards (§5) so
they surface _inside_ an advisor's existing workflow rather than as a
separate announcement feed nobody reads.

### What Mission Control publishes

Reuses the existing versioned campaign library (Stage 10.1) for anything
with a start/end and an audience, and the new `KnowledgeCard` (§5) for
anything that's pure knowledge (a fabric launch, a selling technique). It
does not invent a third content type for "announcements" — a fabric launch
_is_ a knowledge card with a `campaign_brief` link attached when it has a
promotional angle, and a pure selling-focus push _is_ a campaign with no
product attached.

### Where cards surface (reiterating §5's placement list, from the

publisher's side this time)

A Mission Control push is not "sent" in the broadcast sense — it is
_attached_ to the surfaces where it's contextually relevant: a fabric
launch attaches to the product family's knowledge card, which then surfaces
inside pre-appointment SOPs (§3) whose likely-need matches that family,
inside the product page, and inside Academy roleplay prep. A pure
selling-focus initiative (e.g., "prioritize made-to-measure conversions this
quarter") attaches as a `priorityMode` suggestion at the retailer-default
layer of the Product Visibility Profile (§6) — again, reusing an existing
mechanism rather than inventing a parallel "campaign mode" toggle.

### Flows

- **Owner/manager (publisher)**: authors or curates a campaign/knowledge
  card, sets its audience and validity window, submits for the same
  human-review gate as any AI-touched content.
- **Advisor (consumer)**: never sees a separate "Mission Control inbox" —
  sees the content exactly where §4 and §5 already place it, with a small
  "from Mission Control" provenance tag so the source stays legible.

---

## 11. Insider Tailoring

### Design principle — realistic, cited, never creepy

PAON already has the correct shape for this: `corporate_opportunity_signals`
already defines a `public_signal` source with a mandatory citation
requirement (`corporate-public-signal-citation.spec.ts` proves a signal is
refused without one and accepted with a real one). This section is the
enrichment layer that produces well-cited public signals for a _named
individual client_, not just a corporate opportunity — extending the same
mechanism to relationship intelligence rather than building a second,
looser one for people.

### What is in scope

Only realistic, publicly-sourced, professionally-relevant facts, each
required to carry a citation (a URL, a publication name and date, or an
advisor's own direct observation marked as such — never an unattributed
scrape):

- career timeline milestones (new role, promotion, board seat) — sourced
  from a professional network's public profile, a company press release, or
  advisor-observed;
- company intelligence (funding round, acquisition, expansion, leadership
  change) — sourced from business press;
- industry intelligence relevant to the client's sector (useful as a
  conversation-starter context, not a dossier on the person);
- public professional achievements — awards, published articles, conference
  speaking, interviews — sourced from the public record.

### What is explicitly out of scope

No social-media activity monitoring beyond what a person has made
professionally public (no tracking of personal social posts, likes, or
location check-ins). No speculative inference ("seems to be job hunting
based on activity patterns"). No aggregation from data brokers or
people-search services. No purchase-history enrichment from outside PAON's
own retailer network. If a fact cannot be traced to a specific, citable,
public professional source or a direct advisor observation, it does not
enter the system — this is the same discipline `checkOpportunityStageTransition`
already applies to business signals, extended to people.

### Flows

An advisor or a Mission Control researcher adds a signal with its citation
attached; it surfaces on the client's brief (§4, "conversation starter" or
a new dedicated section) exactly like any other cited fact — never as a
score, never as an unexplained "insight," always as "here is the fact and
here is where it came from."

---

## 12. Relationship Graph

### Design principle — this is the flagship feature

The Relationship Graph is the visual and analytical expression of what
Stage 18.1/18.11/18.12 already started: BD-101's opportunity/signal
pipeline, the not-yet-built 18.11 external public-signal discovery, and
18.12's already-shipped cross-referencing (an existing client's employer
fact surfaces as a citable `existing_customer_link` signal, proven never to
leak across a different retailer's tenant). This section is the
_visualization and analytics layer_ over that existing, already-tenant-safe
data model — not a new data model.

### What it visualizes

Nodes: companies, offices/sites, departments (where known), individuals
(existing clients and, distinctly, known contacts who are not yet clients),
referral relationships. Edges: employment (with seniority where known —
CEO, partner, regional director, owner, middle management — a fixed
enumerated scale, not a freeform title string, so "how deeply embedded are
we" queries are computable), referral (who referred whom, sourced from §2's
`referral_offered`/`warm_introduction` facts), and advisor/store coverage
(which advisor or store owns which relationship).

### The analytics that actually matter (and the ones that don't)

Every query below is answerable _because_ the underlying facts are
structured and cited — this section explicitly rejects any metric that
can't be traced back to real, citable rows, per §15's "reject redundant
metrics" instruction.

**Worth building:**

- **Company penetration**: how many of Company X's known employees/contacts
  are existing clients, versus known-but-unconverted contacts — a real,
  countable ratio.
- **Department/office gaps**: which known departments or offices at a
  penetrated company have zero client relationships — directly actionable
  for a targeted introduction ask.
- **Referral chains**: a traceable path (A referred B, B referred C),
  sourced entirely from §2 facts — never inferred from co-occurrence.
- **Introduction candidates**: existing clients whose company/seniority
  profile suggests they _could_ introduce the house into an untouched
  department or company — surfaced as a suggestion with its evidence (this
  client works there, this client has referred before), never as an
  automatic outreach.
- **Relationship cluster strength**: a simple, inspectable count — how many
  cited edges connect a store/advisor to a given company or industry —
  rather than a composite "influence score."
- **Expansion opportunity**: the intersection of "company we're
  under-penetrated in" and "company where we have a citable, high-seniority
  contact" — the single highest-value query in this whole section, and
  entirely a join over existing structured facts.

**Deliberately rejected** (see §15): a generic "relationship strength
score" that blends unrelated signals into one opaque number; automatic
outreach suggestions with no human review step; any cross-tenant view that
would let one retailer see another retailer's relationship graph, even in
aggregate — the tenant boundary 18.12 already proved must hold applies with
zero exception here, including for "anonymized" cross-retailer benchmarking
(that capability, if ever built, is Stage 15.5's own gated, quarantined
scope, not something this feature quietly backdoors).

### Distinguishing organizational influence

Seniority is a fixed, small enum (owner/board, C-suite, partner-equivalent,
senior management, management, individual contributor) attached to the
employment edge, sourced from §2's career facts or §11's cited public
signals — never inferred from a job title string via pattern matching,
which would be exactly the kind of unsupported inference this whole
blueprint is designed to avoid. Organization size is a simple field on the
company node (sourced the same way), used only to weight _how meaningful_
a penetration ratio is (5-person company vs. 5,000-person company), never
to auto-rank companies by "attractiveness."

### Tenant boundary, restated because it matters most here

Every graph query is scoped to `retailer_id = current_retailer_id()`, full
stop. A company node, if it happens to also be a client's employer at a
_different_ retailer, is a _different_ row — there is no shared
cross-tenant company table. This mirrors the fix already applied twice in
this codebase's history (wedding-party child tables, corporate module child
tables) at the schema level: no table in this feature's data model may ever
let one retailer's write reference another retailer's parent row.

---

## 13. Customer Education

### Design principle

The identical `KnowledgeCard` component from §5, rendered customer-facing
with nothing rebuilt — the same collections, wardrobe-building guides,
fabric education, seasonal/occasion dressing and style guides an advisor
already consumes, filtered to only the cards a manager has explicitly
marked customer-visible (a single boolean gate on the same object, not a
parallel content system).

### Where it surfaces

Inside the Customer Portal's existing wardrobe and product surfaces (a
fabric card linked from the product page a client is already looking at),
and inside MorningRoutine/complete-the-look moments where a knowledge card
naturally explains _why_ a recommendation was made — turning "why is PAON
suggesting this" from a black box into a one-tap explanation, which is
itself a trust feature consistent with `NORTH_STAR.md`'s "transparent
recommendations create a client-visible advantage that surveillance
cannot."

---

## 14. UX

### The governing grammar (already established — this section names it as

law for every new surface above)

Every card proposed in this document must render through PAON's existing
`Card` primitive and token set, with no new colors, fonts, radii or motion
values introduced (this blueprint proposes zero new design tokens — every
example above is describable entirely in the existing `--color-stone-*`,
`--color-ink-*`, `--radius-md`, `--shadow-lifted`, `--ease-out-quiet`
vocabulary already defined in `packages/ui/src/styles/globals.css`).

Concretely, every new card type in this document follows the pattern
already proven across a dozen existing `*-card.tsx` components:

1. Header (serif `font-display` title + one-line `stone-500` description).
2. Early-exit to `null` on no data — never a fabricated empty state.
3. A list of items, each a bordered `rounded-md` block with `p-4`.
4. Status/evidence/source shown inline, no separate badge layer, exactly
   matching the "why this is here" requirement stated throughout this
   document.
5. Actions progressively disclosed — a form only appears once the card's
   own state warrants it (e.g., a debrief card's picklist only expands once
   tapped; a KPI's drill-down only appears once expanded).
6. Priority signaled, where relevant, with the existing `border-l-4
border-l-[var(--color-warning-500)]` accent — never a new color for a
   new priority tier.
7. Hover/entrance motion reuses the existing `group-hover:-translate-y-0.5
group-hover:shadow-[var(--shadow-lifted)]` and staggered `paon-reveal`
   patterns exactly.

### Progressive disclosure as the organizing principle

Every card in this document is designed to summarize in its collapsed
state, expand into full detail on demand, link to the object it's about
(customer, product, appointment, company node), relate to other cards
(knowledge cards linking to knowledge cards, facts feeding KPIs feeding
recommendations), and — where it's a knowledge card specifically — teach.
No new surface in this blueprint requires a dedicated full-page view before
an advisor can act on it; the dashboard (§4) remains the single home base,
and everything else is a card away.

---

## 15. Final Critique

A blueprint that only adds is not disciplined. This section removes,
narrows or replaces anything above that fails the stated bar: realistic,
operationally useful, measurable, actionable, naturally fits advisor
workflow, improves decision making, capturable by a real advisor, avoids
surveillance, avoids data advisors can't realistically obtain, and
compounds over years.

### Cut or hard-constrained

- **Medical/health data (§2).** The original brief listed "weight" and
  "medical influences" as post-appointment categories. Both are cut as
  structured fields. Weight and health status are special-category personal
  data in most applicable privacy regimes (GDPR Article 9 and equivalents),
  advisors cannot reliably or appropriately assess them, and a structured
  taxonomy here reads as exactly the kind of surveillance this blueprint is
  supposed to avoid. What survives is the much narrower, legitimately
  useful `fit-relevant change` category — a garment now fits differently —
  captured as an advisor-observed free-text note with no structured medical
  subtype at all. If a client volunteers a medical reason, it belongs in
  the existing unstructured pinned-note surface, not a new structured
  category, and never feeds any scoring or recommendation.

- **NPS as a headline KPI (§7).** Demoted to optional supplementary signal.
  Low-volume, high-touch relationships produce tiny, biased NPS samples;
  presenting it with the same visual weight as retention or wardrobe value
  would be exactly the "vanity metric" this blueprint is supposed to
  reject. Retention, referral rate and repeat-purchase interval are the
  honest proxies for relationship health this business actually has enough
  data to compute reliably.

- **Composite "relationship strength" or "influence" scores (§12).**
  Rejected outright anywhere they appeared as a temptation. Every graph
  metric that survived is a plain, inspectable count or ratio over real
  cited rows (company penetration, department gaps, referral chains) —
  never a blended score that hides which inputs moved it, which would
  violate this entire document's central discipline the moment it shipped.

- **Automatic outreach/introduction execution (§12).** An "introduction
  candidate" is a _suggestion with evidence_, never an automated message.
  The moment this system sends something on a human's behalf without a
  review step, it stops being relationship intelligence and becomes
  exactly the kind of creepy automation the brief explicitly warned
  against.

- **Social/behavioral surveillance in Insider Tailoring (§11).** Anything
  resembling social-media activity monitoring, data-broker aggregation, or
  inferred personal-life signals ("seems to be job hunting") is excluded by
  design, not merely deprioritized. Only citable, professionally-public
  facts and direct advisor observation qualify — a line drawn deliberately
  narrower than what's technically possible, because what's technically
  possible here is exactly the part the brief said to avoid.

- **A parallel "notes" or "insights" system anywhere.** Every section above
  was checked against the existing StyleProfile, `customer_facts`,
  `cited_recommendations`, Academy and corporate-BD mechanisms specifically
  to avoid building a second version of something that already exists.
  Where an earlier draft of this thinking proposed a standalone object, it
  was rewritten to extend the existing one instead — this is the single
  most important critique applied throughout, not just at the end.

### What earns its place

Everything that survived does so because it is a **join over structured,
cited, advisor-capturable facts**, rendered through the existing card
grammar, scoped to the existing module and tenant boundaries, and honest
about its own confidence. Buying Intelligence's lost-sale taxonomy (§9) and
the Relationship Graph's penetration/gap analytics (§12) are the two
highest-leverage ideas in this document — both because they replace a real,
named guess ("size 52 keeps selling out," "we don't know anyone at that
company") with a real, computable answer, sourced from data a real advisor
can and will actually capture in the flow of their existing work.
