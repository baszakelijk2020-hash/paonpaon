# PAON Digital Wardrobe and Preferred Tailoring

**Status:** target product and technical design. The six-section customer
wardrobe visual is implemented as a first tranche; deeper capabilities remain
target until factual authority says otherwise.

## Why this can work when standalone wardrobe apps struggle

Standalone apps ask a customer to perform a large cataloguing chore before
benefit appears. PAON can start with purchase and order data the retailer
already has, then let the advisor and customer complete the picture during a
relationship that already carries trust and meaningful annual spend.

Successful digital wardrobes consistently offer:

- quick image capture/import and background cleanup;
- categorized visual browsing;
- outfit boards and calendar planning;
- usage/cost-per-wear statistics;
- weather/occasion recommendations;
- human stylist collaboration;
- aftercare, alteration and repair.

Examples: [Whering](https://www.whering.co/),
[Indyx](https://play.google.com/store/apps/details?id=com.indyx.android), and
[Save Your Wardrobe](https://www.saveyourwardrobe.com/for-consumers/).

PAON should not copy their social network. It should connect wardrobe
observation to the retailer's catalogue, advisor, service partners,
appointments and clienteling outcomes.

## The six-section closet

The customer wardrobe is always presented top-to-bottom:

1. Suits
2. Jackets
3. Shirts
4. Knitwear
5. Shoes
6. Accessories

Each is a horizontally browsable carousel on phone, tablet and desktop.
Tailoring-adjacent stored categories are grouped without losing their exact
metadata: trousers/waistcoats/formalwear with Suits; outerwear/leather with
Jackets; pocket squares and remaining items with Accessories.

Each card can show:

- identifying photo or linked product image;
- brand/name/category;
- bought-here/external/advisor provenance;
- condition, care, wear and fit perception;
- acquisition and last-worn dates;
- service status;
- outfit and roadmap membership;
- advisor suggestion state;
- history and retire/archive action.

Empty categories are visible. They are useful wardrobe-gap evidence, not a UI
failure.

## Ingestion without pain

Priority order:

1. retailer purchases automatically create relationship-scoped wardrobe items;
2. order import links historical purchases;
3. advisor adds a known external piece during a session;
4. customer imports a retailer/product URL or receipt;
5. customer photographs the piece, with assisted crop/background cleanup;
6. batch "wardrobe appointment" captures many items.

AI proposes image crop, category, color, pattern, material and duplicate match.
The customer/advisor confirms. It never silently invents a brand, composition
or purchase source.

## Three ownership states

- **Owned:** customer confirms possession.
- **Advisor suggestion:** appears in a separate suggested layer, never as
  owned, with reason and expiry.
- **Roadmap target:** a category/outcome the wardrobe needs; may reference
  candidate products but is not a fake garment.

The customer can promote a suggestion to wishlist/cart/appointment or dismiss
it. A completed purchase becomes owned through the order event.

## Wardrobe intelligence

Useful projections include:

- category and occasion coverage;
- repeated colors/fabrics/silhouettes;
- underused and overused items;
- outfit compatibility graph;
- last-worn rotation;
- care/repair due;
- acquisition age and cost-per-wear where price is known;
- fit freshness;
- duplication risk before a purchase;
- highest-leverage addition;
- planned events with missing looks;
- seasonal storage and packing capsules.

Every conclusion cites the underlying items/events and exposes confidence.
"You never wear brown" is invalid without sufficient logged wear. "Four of
your six recorded winter jackets are brown" is precise.

## Outfit planning

The customer or advisor creates:

- named outfit;
- occasion and dress code;
- season/weather range;
- component slots and alternatives;
- planned calendar date;
- wear outcome/photo/feedback.

The system can build a seven-day capsule from owned pieces and identify one
missing high-leverage purchase. Customer autonomy is preserved: suggestions
are editable and can be made entirely from owned items.

## Preferred Tailoring and HighMaintenance

The wardrobe becomes the service intake:

1. choose garment;
2. choose repair/alteration/cleaning/refresh;
3. add issue/photo and preferred pickup;
4. retailer triages and quotes/approves;
5. asset enters serialized custody;
6. partner accepts a minimized work order;
7. pickup/work/quality/return events update;
8. cost, retailer margin/fee and partner invoice reconcile;
9. customer pays through an approved provider or uses an approved entitlement;
10. service history and future care date return to the wardrobe.

## Partner network

Each retailer location can configure several:

- alteration partners;
- dry cleaners;
- shoe/leather repair partners;
- couriers;
- specialist restorers.

Configuration includes service area, capability, SLA, price agreement,
capacity, pickup windows, insurance/custody requirements, invoice method and
visibility to customers.

The partner sees assigned assets/work only. It does not receive the customer's
Self-Portrait or clienteling history.

## Preferred tailoring calendar

The month/year view shows the wardrobe plan:

- expected service/care;
- seasonal rotation;
- event deadlines;
- planned additions and replacement windows;
- fitting/collection dates.

Founder animation references may inspire the visual language, but production
UI uses accessible DOM content, reduced-motion support and real dates. Images
can fade into relevant months; they may not be the only representation of
meaning.

## Advisor value

The advisor sees:

- wardrobe coverage and roadmap;
- recent additions and customer photos;
- items due for care;
- outfits the customer is building;
- an event without a complete look;
- suggestions awaiting response;
- service issues and promises;
- recommendation reason and evidence.

The advisor becomes steward of a wardrobe rather than seller of isolated
transactions.

## Customer engagement loops

- MorningRoutine weather/outfit card;
- weekly outfit plan;
- packing list before a trip;
- pre-event readiness;
- post-purchase outfit suggestions;
- service reminder;
- "wear what you own" challenge;
- advisor capsule;
- new candidate shown against owned wardrobe.

Each loop has frequency/cooldown controls. Engagement is a means to help the
customer, not an excuse for daily product spam.

## Technical boundaries

- `WardrobeItem` remains relationship-scoped under ADR-063.
- `PhysicalGarment` remains official fitting/service truth.
- product/order/garment references are links, not copied facts.
- outfit and roadmap are separate aggregates.
- service custody composes wardrobe, inventory identity and concierge; it does
  not hide inside a generic order status.
- partner settlement remains behind the commerce design gate.

## Delivery

1. Six visual carousels over existing wardrobe items.
2. Image acquisition and purchase auto-linking.
3. outfit calendar, wear log and usage projections.
4. advisor suggestions and roadmap overlays.
5. service-intake-to-partner-custody flow.
6. wardrobe completeness/duplication/outfit recommendations.
7. trip, seven-day and event capsule campaigns.
