# PAON Virtual Try-On, Daily OOTD and Ambient Checkout — Target Architecture

Founder specification, recorded 2026-08-04. This is the source brief for a
build item, not yet implemented — see PHASE.md for the queue item this
expands into. Preserved close to verbatim so nothing in the economics
reasoning is lost to summarization.

## 0. Governing principle

**Generate on demand, precompute only when justified.** Do not generate a
virtual try-on image per customer per day. Recommend the outfit cheaply
every day; generate the expensive visual asset only after the customer
demonstrates attention (taps "see it on me") or the advisor demonstrates
intent (sends a private selection, prepares for an appointment).

At FASHN's entry-level rate (~$0.075/image), unconditional daily
generation for 2,000 customers costs ~$54,750/year. A 10% tap-through rate
on a cheap daily notification costs ~$5,475/year for the same base; at 3%
it is ~$1,642.50/year. The entire architecture below exists to protect
that ratio.

## 1. Two-stage OOTD system

1. **Suggestion first, free.** Every morning, compute a personalized
   outfit recommendation from: location, local weather, calendar/stated
   occasion, customer preferences, existing wardrobe, retailer inventory,
   recently viewed items, underused purchases, preferred dress code,
   retailer merchandising priorities. Deliver as a lightweight
   notification/card with no image: _"28°C, rain after 16:00. Suggested:
   lightweight navy overshirt, white polo, stone trousers. Tap to see
   yourself wearing it."_
2. **Image only after engagement.** The try-on API call happens only when
   the customer taps "See it on me." This changes the unit economics from
   one generation per customer per day to one generation per _interested_
   customer action.

## 2. Customer-led curiosity loop (first use)

1. Customer selects one product or curated outfit.
2. Customer uploads a full-body image.
3. PAON generates one complimentary try-on.
4. Customer can save the portrait as a reusable visual profile.
5. PAON offers a small generation allowance (practical default: 3
   complimentary generations in the first session, 2/week thereafter;
   daily OOTD image only on tap; video capped at ~1/month or tied to
   save/shortlist; additional attempts unlockable by appointment,
   purchase, event invitation or advisor grant).
6. Further usage is governed entirely by the retailer's configured policy
   (below) — never unlimited by default.

## 3. Retailer-level controls — "AI Styling Configuration"

**Commercial controls:** feature on/off; eligible segments; eligible
individual customers; monthly retailer budget; per-customer monthly
budget; max generations per day/week/month; image vs. video permission;
standard vs. premium render quality; auto-disable at budget threshold;
cost-centre/store attribution; retailer-funded vs. customer-funded
credits.

**Customer eligibility** (retailer-configurable, never hardcoded to "VIC
only" — a lower-spending but highly engaged customer can produce better
incremental revenue than a dormant high spender): all authenticated
customers; loyalty members; VIC clients; customers over a spend
threshold; customers with an active appointment; campaign invitees;
manually selected customers; customers with high engagement or churn
risk.

## 4. Per-customer `ootd_profile`

Enabled/disabled; delivery days/time; home location; temporary travel
location; weather sensitivity; workday/weekend preference; formality
range; preferred brands/categories; avoided colours/materials; existing-
wardrobe inclusion; new-product inclusion; sale-product inclusion; max
suggested item price; advisor-approval-required flag; daily generation
permission; monthly generation allowance; preferred portrait; preferred
visual environment; contact channel; quiet hours. Plus a settable daily
objective: wear existing wardrobe / complete an outfit with one new item
/ promote new arrivals / prepare for an occasion / re-engage the customer
/ drive an appointment / introduce a new category / replace an ageing
wardrobe item.

## 5. Branded scene environments

Retailers define multiple approved scene templates (flagship store,
private salon, fitting room, neutral studio, office, hotel lobby, evening
venue, resort, city street, seasonal campaign), each storing: reference
image, prompt template, camera angle, crop, lighting direction, brand
tone, floor/wall materials, allowed poses, output aspect ratio, seasonal
availability, store/market applicability. The customer can see the same
outfit rendered as "Morning at the office," "Evening at the retailer's
private salon," "Weekend in Singapore."

FASHN's API supports virtual try-on, identity-preserving model workflows,
background guidance, editing and image-to-video generation; Try-On Max
covers clothing/shoes/hats/jewellery/bags; Product-to-Model accepts
background and face-reference inputs.

## 6. Never a fit guarantee

Every generated image is labelled: **"AI visualisation — colour, drape and
fit may differ from the physical product."** It shows styling potential,
not physical fit. PAON must keep four concepts distinct and never let the
image imply the third or fourth:

- **Visual try-on** — generative image.
- **Recommended size** — size/measurement engine.
- **Expected fit** — rule-based or predictive fit logic.
- **Actual fit** — the real fitting/alteration process.

## 7. Cost-control hierarchy (apply in order)

- **Level 0 — no image.** Outfit composition, weather rationale, product
  cards, existing-wardrobe matches, text notification only. Cost is the
  recommendation-model call plus weather data.
- **Level 1 — cached composite.** Reuse an existing generated image
  whenever customer portrait, garments, environment, pose class, crop and
  model version all match. Never regenerate an identical look.
- **Level 2 — fast preview.** The lower-cost/faster VTON endpoint for
  exploration, colour attempts, initial OOTD preview, product browsing.
- **Level 3 — premium image.** Try-On Max only when the customer saves
  the look, the advisor sends a private selection, the customer requests
  high quality, the image will be shared, or the customer enters an
  appointment/purchase flow.
- **Level 4 — video.** Only after a high-intent event: save, wishlist,
  reserve, appointment request, add to basket, advisor approval, or an
  explicit "Animate this look" action.

## 8. AI usage ledger

A real budget engine, not API calls embedded in the frontend. Record per
generation: retailer, store, customer, advisor, campaign, provider,
model, endpoint, input assets, output asset, credits consumed, actual
cost, internal marked-up cost, trigger, conversion event, revenue
attribution, cache hit/miss, failure status, timestamp.

Before every generation, evaluate in order: retailer enabled? customer
eligible? customer consent valid? customer quota remaining? retailer
monthly budget remaining? campaign budget remaining? cached result
available? generation commercially justified? Only then create the job.

## 9. Monetisation

Metered, not absorbed into a flat subscription: retailer buys an AI usage
balance; PAON deducts per successful generation; failed provider-side
predictions are not charged where the provider itself does not consume
credits (FASHN's own policy); PAON adds a platform margin; retailer sees
consumption by client/store/campaign. Candidate billing units: preview
image 1 credit; premium image 3 credits; edit/regeneration 1–3 credits;
short video 10–20 credits. PAON sells credits above provider cost while
keeping the upstream model fully replaceable.

## 10. Provider abstraction (mandatory)

Do not model the PAON domain around FASHN-specific fields. Provider-
neutral interface, same shape as the existing `@paon/ai` `AIProvider`
convention (ADR-033):

```ts
interface VirtualTryOnProvider {
  createTryOn(input: TryOnInput): Promise<GenerationJob>;
  createAvatar(input: AvatarInput): Promise<GenerationJob>;
  editImage(input: EditInput): Promise<GenerationJob>;
  createVideo(input: VideoInput): Promise<GenerationJob>;
  getStatus(jobId: string): Promise<GenerationStatus>;
  cancel?(jobId: string): Promise<void>;
  estimateCost(input: GenerationRequest): Promise<Money>;
}
```

Adapters: `FashnProvider`, `GoogleProvider`, `OpenAIProvider`,
`KlingProvider`, future providers. Route by capability: fashion try-on →
specialist VTON provider; background editing → specialist or general
image model; video → image-to-video provider; styling rationale →
low-cost language model; weather → weather service; location → maps/geo
service. Swapping a provider must never require rewriting customer,
retailer or billing logic.

## 11. Privacy and consent

Self-portraits are sensitive even without biometric identification use.
Required: explicit image-processing consent; separate consent for
persistent portrait storage; separate consent for daily personalised
suggestions; delete-portrait; delete-generated-images; disable-AI-styling;
retention period; region-specific storage controls; signed access URLs;
strict retailer tenancy isolation; role-based employee access; audit
trail; no model-training use without separate explicit opt-in; minor-
account restrictions; anti-impersonation controls. FASHN's own terms:
users retain ownership of uploaded content under a limited processing
licence; general service policy retains images until deletion, though the
API documents privacy-enhanced options for sensitive use — PAON should
use the strongest available privacy parameters and delete provider-side
assets after ingestion wherever the provider supports it.

## 12. Daily OOTD decision logic

```text
1. Resolve customer's active location
2. Fetch weather for relevant hours
3. Read known calendar context
4. Read dress-code and preference profile
5. Load owned wardrobe
6. Load retailer inventory and availability
7. Exclude unavailable sizes and restricted products
8. Construct candidate outfits
9. Score suitability
10. Select the highest-ranked recommendation
11. Send text/product preview
12. Generate visual only when customer requests it
```

Example scoring weights: weather suitability 25%, customer taste 20%,
wardrobe compatibility 15%, occasion suitability 15%, inventory
availability 10%, novelty 5%, commercial priority 5%, margin 3%, delivery
feasibility 2%. Commercial weighting must never dominate suitability — a
visibly unsuitable recommendation destroys trust in the whole feature.

## 13. Location handling

No continuous tracking. Use: customer-selected default city;
"use my current location today"; manually entered travel itinerary;
calendar-derived destination with consent; temporary location expiring
automatically. The daily notification may simply ask "Are you still in
[city] today?" — enough context without persistent surveillance.

## 14. MorningRoutine expansion — not only daily, also _ahead of time_

MorningRoutine must not be only a same-day inspiration tool. Self-Portrait
already carries recurring dated facts (anniversaries, recurring annual
purchases, and similarly loggable moments like Valentine's Day, a
Christmas or New Year event the customer is known to attend). The daily
login sequence should be:

1. **Today's OOTD** (weather/occasion-driven, as above).
2. **Coming up** — a _separate card_, not a replacement of today's OOTD:
   "You also have [X] coming up — here's our suggestion for that,"
   surfaced from Self-Portrait's dated/recurring facts far enough ahead
   to act on (book an appointment, order in time for alterations).
3. **Complete the look** — wardrobe-planning suggestions that complement
   what the customer already owns, each with its own "want to see the
   look on you" try-on entry point (Section 1's tap-to-generate flow, not
   an automatic render).

This turns MorningRoutine into three coordinated cards per visit — today,
ahead-of-time, and completion — sharing one generation-on-demand
mechanism rather than three separate build efforts.

## 15. Four related customer-facing features

- **Try Me** — customer-controlled virtual try-on, capped allowance.
- **My Visual Profile** — reusable approved portraits, preferred
  environments, privacy controls.
- **Daily OOTD** — weather/location/wardrobe/inventory-aware suggestions,
  visual rendered only after engagement.
- **Private Client Studio** — advisor-led high-quality looks, branded
  scenes, video, direct conversion into reservation/appointment/order.

## 16. Ambient / frictionless checkout — "no cash wrap"

Companion specification, same session, same principle (remove the
transactional cliff — the moment styling/discovery/connection grinds to a
halt because everyone has to walk to a register). Environments and
mechanisms to support, each mapped to a real PAON surface:

- **Showrooms/appointment-only spaces:** a secure SMS/WhatsApp
  "soft-close" — advisor triggers a micro-checkout link sent to the
  client's phone; client authenticates with their own device (FaceID/
  Apple Pay) and pays without a terminal appearing. Ambient tablet
  hand-off: the advisor's tablet shows only the final look summary and an
  "Approve & Pay" affordance, never a formal register screen.
- **On-location visits (client homes/offices/hotels):** tokenized
  card-on-file with post-visit approval — the stylist packs up and sends
  a text asking to charge the card on file; a reply/tap approval logs the
  transaction. Pocket tap-on-glass (phone-based Tap-to-Pay) when
  in-the-moment payment is required, styled as continuing the same
  digital lookbook interaction, never a card-machine moment.
- **Traditional storefronts:** fitting-room hand-off — mobile POS
  follows the customer into the fitting suite so nobody carries garments
  to a front desk to pay. Digital-to-physical cart persistence — a
  customer's existing online/app wishlist or cart is pulled up by the
  associate on the floor and converted into an active checkout with one
  confirmation tap, no re-scanning.

The common thread: checkout is a **gesture inside the existing
conversation**, never a separate "official" event with its own screen,
terminal or queue. One-tap/one-approval payment is treated as a
conversion-critical requirement, not a convenience.

## 17. QR wardrobe card — physical-to-digital wardrobe bridge

A physical card (attachable to a hanger or garment) that, scanned, opens
the exact wardrobe item's page in the customer's digital wardrobe —
**frictionless even when the scanner is not logged in or the item is not
yet attached to a customer profile**: the page must still show full item
information (fabric, chosen design options, everything about the
garment) so the purchase is appreciated and cognitive dissonance about
the spend is mitigated, whether or not an account is linked yet.

Once genuinely part of a customer's digital wardrobe, each item carries
its own action buttons:

- **Book an alteration** for this specific item.
- **Book a cleaning.**
- **Upload a photo periodically** — part of continuous "behind the front
  door" service. An advisor reviewing the photo (or the customer raising
  a ticket) can conclude the item no longer fits properly, which updates
  the customer's current sizes in their Self-Portrait. This is what makes
  autonomous online (re-)ordering feel safe to the customer — they trust
  the system already knows their current fit.
- **Retire** the item from the digital wardrobe.
- **Re-order** when they want another one.
- **Ask a question** — routes to their advisor.
- **Complete the look** — item-specific suggestions (distinct from the
  wardrobe-level complete-the-look surface: this one is scoped to what
  pairs with _this_ item specifically).

Every action here is simultaneously a customer touchpoint and a
data-sanitisation opportunity (fit drift caught before it causes a bad
online order, wardrobe kept current as items are retired).
