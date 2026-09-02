You are working in the PAON repository:

/Users/nguyen/Projects/PAON

THIS IS A DOCUMENTATION / PRODUCT-TRUTH CORRECTION TASK.

Do NOT start implementing product features.
Do NOT write production code.
Do NOT reinterpret founder decisions.
Do NOT preserve stale roadmap statements merely because they already exist.
Do NOT mark something complete simply because infrastructure, schemas, tests, or partial UI exist.
Do NOT ask me questions unless there is a genuinely irreconcilable contradiction that cannot be resolved from the repository plus the founder truth below.

Your job NOW is to make the canonical PAON Markdown documentation accurately reflect the founder's actual product direction below.

============================================================ 0. OPERATING PROCEDURE
============================================================

First inspect:

- AGENTS.md
- docs/PHASE.md
- docs/ROADMAP.md
- docs/PRODUCT.md
- docs/CAPABILITY_DISPOSITION.md
- docs/FOUNDER_TOOL_BLUEPRINTS.md
- docs/DESIGN_PORTS.md
- docs/PAON_INTELLIGENCE_PLATFORM.md
- docs/NORTH_STAR.md
- docs/AGENT_ROUTING.md
- any other canonical MD files referenced by those documents
- pag1.html
- pag2.html
- pag3.html
- any HTML/design prototypes referenced by those files
- existing implementation/tests only where needed to determine what actually exists

Also search the repository for every existing implementation, roadmap item, specification, schema, test, component, migration, route, feature flag, or design reference corresponding to the features below.

Then ALTER THE MARKDOWN FILES.

The final MD set must become internally consistent.

There must be ONE coherent product truth rather than several overlapping roadmaps describing the same feature differently.

Where multiple MDs contain overlapping ideas:

- consolidate the actual product definition in the appropriate canonical document;
- make other documents point to that canonical definition instead of creating contradictory copies;
- preserve useful implementation evidence;
- remove stale assertions;
- distinguish clearly between:
  1. built and proven,
  2. partially built,
  3. specified but not built,
  4. parked,
  5. deleted,
  6. future/conditional.

Do NOT inflate completion percentages.

A backend primitive is not the same thing as the founder experience being complete.

If the repository proves something is more or less complete than the percentages below, preserve the evidence but describe the distinction explicitly:
"foundation exists" versus "founder experience complete."

Do not silently erase useful completed infrastructure merely because its broader initiative is parked. Mark it as existing but stop further build.

============================================================

1. GLOBAL PRODUCT PRIORITY
   \============================================================

PAON is a RetailOS specifically designed around premium menswear, tailoring, made-to-measure, advisor-led selling, customer relationships, wardrobe management and corporate clothing.

The product must understand these retailers better than generic commerce/CRM systems.

The central advantage is NOT simply having more software features.

PAON should make sophisticated retail practices usable by retailers whose employees may have almost no technical expertise.

A 3-person tailoring retailer should not suddenly need a system administrator.

Therefore:

- automation;
- guided workflows;
- intelligent defaults;
- AI-assisted data cleanup;
- low-friction migration;
- explainable customer intelligence;
- advisor-centric interfaces;
- strong product/tailoring knowledge;
- relationship selling;
- wardrobe continuity

are core design principles.

The primary customer-facing and staff-facing experiences should feel premium, immediate, human and highly visual.

Do not build generic SaaS-looking workflows where the domain deserves a specialist interface.

============================================================ 2. FOUNDER TOOL DISPOSITION
============================================================

There are 14 founder tools.

Correct their status and definitions as follows.

---

FT-01 — Voice + drag fit slider
------------------------------------------------------------

STATUS: ON HOLD / PARK.

Some fit-observation and task-linking infrastructure exists.

Do not continue building the broader voice/trust/recovery experience now.

Do not delete existing useful infrastructure.

---

FT-02 — Silhouette Analysis
------------------------------------------------------------

STATUS: ON HOLD AS A STANDALONE TOOL.

Its useful concept belongs inside the Alteration / First-Fitting tool.

Purpose:

Help employees choose appropriate FitTools based on a customer's body/silhouette.

A FitTool is a tailoring correction such as:

- stoop -1;
- erect;
- shoulder corrections;
- posture corrections;
- balance corrections;
- etc.

The founder will later provide the definitive mapping between silhouettes and FitTools.

For now documentation may define a provisional knowledge-assisted recommendation system based on established tailoring knowledge, but it MUST NOT pretend this is validated customer prediction.

The employee remains responsible for the decision.

---

FT-03 — QR try-on / fabric batch
------------------------------------------------------------

STATUS: DELETE.

Remove it from active roadmap/product commitments.

Do not continue building it.

If technical remnants exist, document them only if necessary for cleanup/history.

---

FT-04 — First-Fitting / Alteration Automation
------------------------------------------------------------

STATUS: ACTIVE AND IMPORTANT.

This must become a founder-level product specification.

The visual reference is:

www.nebelspiegel.com/images/alteration.png

The interface should preserve the familiar alteration-grid mental model because experienced salespeople know this kind of interface by muscle memory.

The alteration interface should reproduce the reference concept faithfully.

CORE UI:

Two-column alteration grid.

Each alteration control uses 0.5 increments.

LEFT / PLUS side:
0
+0.5
+1.0
+1.5
+2.0
...
through +5.0

RIGHT / MINUS side:
0
-0.5
-1.0
-1.5
-2.0
...
through -5.0

Use the alteration terminology/text from the reference/prototype and existing tailoring terminology in the repository.

ALTERATION SNAPSHOT:

Provide "Save Alterations".

Saving creates an immutable/frozen alteration snapshot containing at minimum:

- customer
- order
- garment
- date
- time
- logged-in employee/user
- alteration values
- comments
- attached photos where applicable
- source fitting / fitting stage
- version

The saved snapshot appears as a dated/versioned record.

Selecting it opens the SAME alteration-grid interface, not a generic textual recap.

It is initially locked.

Provide explicit Lock / Unlock behavior.

Unlocking allows further changes but MUST preserve the prior snapshot as history and create a new version rather than silently overwriting historical fitting truth.

ALTERATION SHOP WORK ORDER:

Next to a saved alteration snapshot provide a concise action such as:

"Create Alteration Work Order"

When activated:

- darken/de-emphasize the surrounding interface;
- keep non-zero alteration values visually prominent;
- allow the employee to select which non-zero alterations should actually be included in the alteration-shop work order;
- selected alterations enter a distinct active state.

Work order includes:

- retailer
- store
- customer
- order number
- garment
- selected alterations
- comments
- photos
- individual alteration prices
- total alteration amount
- employee
- timestamps
- status
- alteration-shop destination
- relevant deadlines / pickup date

Each alteration can have a retailer-configurable fixed price.

The system calculates the work-order total.

WORKFLOW:

1. fitting values recorded;
2. alteration snapshot saved;
3. employee selects relevant non-zero alterations;
4. work order generated;
5. work order appears in Alteration Shop pending work;
6. alteration shop processes it;
7. relevant status/proof returns to PAON;
8. employee Mission Control receives a task to review/update the customer's FitProfile;
9. employee opens the SAME familiar alteration-grid interface with locked historical values;
10. approved learning can be incorporated into FitProfile / future production guidance with appropriate review.

Do not replace this with generic summaries throughout the system.

The familiar alteration screen itself is the operational artifact.

Integrate the useful portion of Silhouette Analysis here as decision support for selecting FitTools.

Find and reconcile existing alteration pricing, work-order, production, FitProfile, fitting and FitTool logic already documented in the repository.

---

FT-05 — Mission Control / Self-Portrait
------------------------------------------------------------

STATUS: CRUCIAL / ACTIVE.

Existing dashboard, customer brief and correctable profile data are only part of the intended cockpit.

Use pag1.html and existing PAON design cues as important design/product references.

Mission Control is the employee operating environment.

Self-Portrait is the customer intelligence/profile concept.

Do not incorrectly collapse those names into one feature if the repository currently does so.

Mission Control should surface the employee's actual work, opportunities, customer context, appointments, communication, alteration follow-ups, relationship opportunities, product feedback, and relevant intelligence.

Physical-store selling intelligence also belongs here:

Employees should be able to select a collection/product item and quickly record comments repeatedly heard from customers.

Leadership/sales/buying/product teams should be able to see aggregated qualitative feedback and recurring patterns.

Design an excellent desktop experience as well as the existing mobile direction.

---

FT-06 — MorningRoutine
------------------------------------------------------------

STATUS: CRUCIAL / ACTIVE.

MorningRoutine lives at the top of the customer environment.

It is the daily/personalized OOTD and relationship-intelligence surface.

It includes:

- personalized greeting;
- current weather for customer's relevant location;
- complete-look recommendation;
- wardrobe-aware outfit suggestions;
- save;
- dismiss;
- review;
- book;
- COMPLETE THE LOOK;
- ONE-CLICK BUY;
- relevant service actions;
- upcoming events;
- relationship reminders;
- intelligent time-windowed messages.

ONE-CLICK BUYING is an explicit product objective and should appear as an achievement/milestone in the roadmap.

MorningRoutine must NOT assume customers log in every day.

Messages/events need display windows.

Example:

If Self-Portrait says the customer attends Watches & Wonders each year in May, PAON may begin surfacing preparation in February.

If the customer does not log in on the first eligible day, the message must not disappear forever.

Model reminders as:

- eligibility window;
- urgency;
- expiry;
- shown/unshown state;
- acknowledgement/dismissal;
- suppression/relevance;
- event timing;
- last customer visit;
- whether the information is still useful.

The system should select the most relevant current items whenever the customer actually returns.

MorningRoutine should use Self-Portrait, wardrobe, purchases, favorites, events, weather, browsing/engagement evidence and advisor input, subject to consent.

---

FT-07 — Suit Configurator
------------------------------------------------------------

Do NOT treat this as a conventional standalone exhaustive suit configurator.

It belongs primarily inside the VISUAL WARDROBE STUDIO.

Purpose:

Help advisors help customers make more confident decisions.

Use the existing Virtual Wardrobe Studio blueprint and structured configuration foundation.

The customer/advisor may explore relevant design choices such as lapels, pockets, shoulders and other approved options, but the product should guide decisions rather than dump every possible MTM option onto the customer.

Rules, validation, versioning, proposals and production linkage remain incomplete where repository evidence says so.

---

FT-08 — Swipe Deck
------------------------------------------------------------

STATUS: KEEP.

Current core blueprint is considered built/proven if repository evidence still supports it.

But explicitly verify/document the downstream behavior.

A saved/right-swiped look or product should create reusable preference evidence.

Saved looks/products should:

- enter Favorites where appropriate;
- contribute structured evidence to Self-Portrait / StyleProfile;
- contribute to For You recommendations;
- use the item's structured metadata/meta tags;
- preserve explicit preference separately from inferred preference;
- never silently convert one swipe into an unjustified permanent customer fact.

---

FT-09 — TableService / Communication Hub
------------------------------------------------------------

STATUS: ABSOLUTELY CRUCIAL.

Consolidate the multiple communication/chat/messenger/remote-selling initiatives in the MDs into one coherent TableService / Communication Hub architecture.

REAL-WORLD CONTEXT:

Established advisor/customer relationships often already communicate through:

- WhatsApp;
- iMessage;
- Zalo;
- phone;
- email;
- other local channels.

PAON should not pretend those relationships will automatically move into a proprietary chat.

TableService's most important acquisition use case is the website visitor/customer who DOES NOT yet have an advisor relationship.

It is THE conversion tool from anonymous website visitor to human relationship and appointment.

The retailer must feel less anonymous.

Do not present the visitor with a wall of choices.

Present a shopping personal assistant.

UI PRINCIPLE:

Do NOT tuck it away as a tiny generic bottom-right chatbot.

Desktop and mobile should have a substantial, premium interface.

Use an interaction model closer to the visual immediacy of iOS Shortcuts:

common needs/questions represented as beautiful tappable starter actions.

Examples:

- I'm getting married
- I'm a wedding guest
- I need new shirts
- Help me find my style
- I need a suit
- Complete an outfit
- Book an appointment
- Ask about fit
- Ask about fabric
- Show me options for an occasion

The exact starter actions can be retailer configurable.

The experience must feel:

- high-end;
- alive;
- immediate;
- current;
- personal;
- energetic;
- low friction;
- unintimidating;
- human.

It must NOT feel like a generic chatbot.

AI + HUMAN:

AI chat and voice can provide frontline immediacy.

But the system is aggressively designed around rapid transition to a real human advisor.

No fake "typing..." theatre designed to pretend an AI is human.

Clearly distinguish AI from human.

Human contact is a feature, not a fallback embarrassment.

OPERATIONS:

Define:

- visitor/session;
- known/unknown customer;
- inquiry;
- conversation;
- AI participant;
- advisor participant;
- chat-duty roster;
- queue;
- assignment;
- ownership;
- handoff;
- SLA/response expectation;
- store/location;
- expertise;
- language;
- availability;
- escalation;
- appointment conversion;
- proposal;
- order/conversion outcome;
- unresolved follow-up;
- communication history.

Retailers need a roster of employees with chat duty.

Incoming conversations must be intelligently distributed.

Handoff must preserve full context.

All PAON-native communication should be saved in customer history.

External-channel communication should be integrated only where technically/legal/consent-wise appropriate; do not make unsupported claims that PAON can ingest channels that do not permit it.

Supported content should include existing repository capabilities such as:

- text
- photos
- PDFs
- links/Pinterest references
- wedding context
- fabric references
- voice where supported

Finish/document missing operational requirements such as:

- malware scanning
- upload progress
- consent
- citations/provenance where AI uses knowledge
- conversation outcome
- appointment conversion
- proposal conversion
- ownership
- handoff
- response tracking

UNIFIED REMOTE PROPOSALS:

This means an advisor should be able to turn the remote consultation into a concrete customer decision artifact rather than merely chat.

A proposal may contain:

- selected products/looks;
- fabrics;
- configuration intentions;
- advisor explanation;
- price;
- alternatives;
- appointment option;
- save/favorite;
- accept/decline;
- buy/pay where enabled;
- expiration/versioning;
- customer responses.

Do not build it now, but specify it coherently if it is not already properly specified.

---

FT-10 — Inspiration Box / Gift Booklet
------------------------------------------------------------

STATUS: ACTIVE TOOL.

This is a gifting/voucher product accompanied optionally by printed inspiration cards.

Customer chooses:

1. DIGITAL VOUCHER
2. PHYSICAL VOUCHER

Collect logical fields according to delivery mode:

- giver name
- recipient name
- message
- email
- physical address where relevant
- delivery date
- voucher value
- retailer/store
- personalization

INSPIRATION CARDS:

Customer may select up to 20 cards.

Selection modes:

- individually select products;
- select a theme and let PAON generate an appropriate product selection from metadata.

Example themes:

- wedding;
- summer chic;
- business;
- black tie;
- travel;
- seasonal;
- other retailer-defined themes.

Do not hardcode only these themes.

Use structured catalogue metadata.

CARD FRONT:

Suit/jacket/product image.

CARD BACK:

Swatch image.

Bottom 50% receives a dark gradient overlay:
top of gradient approximately 0 opacity,
bottom approximately 50% dark opacity.

Left-aligned information:

- product title
- description
- composition
- price
- small QR code

QR opens the exact product on the retailer website.

Document the production/fulfillment states needed to make physical cards and vouchers reliable, including preview, personalization, payment status, generation, print readiness, redemption, expiry, cancellation/revoke and refund rules where appropriate.

Do not over-engineer fulfillment beyond what is necessary for the product specification.

---

FT-11 — Location Globe AND Monthly Grid
------------------------------------------------------------

These are TWO SEPARATE THINGS.

Never describe them as one feature.

A. LOCATION FINDER / GLOBE

This is a premium location finder.

It can render:

- interactive 3D globe for global retailers;
  OR
- branded 2D map for retailers where that makes more sense.

Retailer configuration should allow at minimum:

- locations CRUD/import;
- coordinates/address;
- location type/category;
- opening hours;
- timezone;
- phone;
- images;
- appointment/chat actions;
- retailer-defined categories;
- custom colors/theme;
- 2D or 3D mode;
- default camera/region;
- location filters;
- store details;
- open/closed status where data permits.

The existing Atelier Munro globe prototype supplied by the founder is a DESIGN/BEHAVIOR REFERENCE, not a hardcoded Atelier Munro product.

Generalize the specification so PAON retailers can upload/update their own locations and branding.

Do not hardcode:

- Atelier Munro;
- AM House;
- AM Boutique;
- AM Studio;
- AM House Call.

These become configurable retailer categories.

B. MONTHLY GRID / PREFERRED TAILORING SURFACE

Visual reference:

www.nebelspiegel.com/images/monthlygrid.png

On mobile it should be page-filling to the right of the PAON navigation/left sidebar as appropriate.

It displays the current month.

Individual days may contain images of suits/jackets/products.

Not every day is filled.

Images fade into their day cell with approximately a 4-second fade and intentionally varied start timing.

This is a visual expression of PREFERRED TAILORING.

Preferred Tailoring derives conceptually from "Preferred Banking":

the retailer manages the customer's wardrobe end-to-end so the customer has less to think about.

This connects to:

- personal advisor;
- wardrobe planning;
- maintenance;
- dry cleaning;
- shoe repair;
- third-party care services;
- store drop-off;
- booking;
- custody;
- billing;
- service status;
- wardrobe reminders;
- customer touchpoints;
- additional sales opportunities.

Read pag3.html carefully and consolidate its intended behavior into the canonical Preferred Tailoring specification.

---

FT-12 — Six-Rail Wardrobe / Virtual Wardrobe
------------------------------------------------------------

STATUS: CRUCIAL.

This is the customer's VIRTUAL WARDROBE.

The Virtual Wardrobe Studio is PART of this broader system.

The wardrobe contains owned items and aspirational items.

Core rails/categories currently include concepts such as:

- suits
- jackets
- shirts
- knitwear
- shoes
- accessories

but the data model should not be unnecessarily constrained if the repository already supports broader garment categories.

OWNED ITEMS:

Customers manage items they already own.

For each item PAON can surface actions such as:

- Complete the Look
- maintenance/care
- HighMaintenance service
- fit freshness
- relevant replacement/repair
- related looks
- outfit history
- advisor suggestions

ASPIRATIONAL ROADMAP:

Advisors add aspirational products into relevant wardrobe carousels/rails.

This gives the customer a visual roadmap toward an ideal wardrobe.

ONE-CLICK BUY:

Aspirational pieces should support low-friction purchase/order where commerce capability allows it.

VISUAL WARDROBE STUDIO:

Advisor/customer can construct looks using:

- owned pieces;
- aspirational catalogue pieces;
- fabrics/configurations where relevant;
- wardrobe gaps;
- occasion context.

Advisor-created looks become part of the customer's wardrobe roadmap.

CUSTOMER VISUALIZATION INPUT:

Customer may upload the number of reference images required by the selected visualization pipeline, potentially including:

- face/head;
- full body;
- additional angles;
- other useful identity/body references.

Do NOT hardcode "exactly four" if the actual image pipeline needs another number.

The purpose is to provide customer-approved references to the image-generation/visualization system alongside intended looks.

Clearly label generated imagery as AI-generated.

Do not promise identity/fit accuracy that the underlying model cannot reliably provide.

QR WARDROBE CARD:

This is ACTIVE and should be specified.

Retailer can print a QR insert/card to place with a purchased suit/jacket/garment.

Retailer may keep attractive generic folded cards and insert a customer/item-specific printed QR.

Scanning the QR should deep-link the authenticated customer to the exact garment record in Virtual Wardrobe.

That item view should prominently expose:

- Complete the Look;
- care/HighMaintenance;
- relevant styling;
- wardrobe context;
- advisor actions;
- purchase opportunities.

Purpose:

Months after purchase, physically reconnect the customer with PAON's digital wardrobe and retailer relationship.

Security:

Do not expose private wardrobe/customer data merely because someone possesses the QR.

Use an appropriate authenticated/deep-link/claim mechanism.

---

FT-13 — Moonstruck Wedding Planner
------------------------------------------------------------

STATUS: ACTIVE.

This is the playful wedding-party experience represented by the floating/orb concept near the bottom of pag1.html and expanded elsewhere in the MDs.

Goal:

Increase wedding/occasion revenue and remove coordination pain.

Groom creates/manages a party.

Invite:

- best men;
- groomsmen;
- other wedding participants.

Each participant appears in the playful visual party/orb interface.

Provide party communication involving:

- participants;
- groom;
- managing advisor.

Track at minimum:

- wedding date;
- location;
- participants;
- invitations;
- RSVP/status;
- date voting where relevant;
- appointments/fittings;
- measurement status;
- suit/product status;
- inspiration;
- payment/downpayment;
- vouchers where relevant;
- production/readiness;
- ready for pickup;
- delivery/pickup;
- outstanding actions.

The groom should be able to understand the whole party without manually coordinating everyone.

The advisor should manage the apparel project operationally.

The system should automate reminders/status as much as appropriate.

Existing group-fitting capacity projection remains useful.

"Full Moonstruck vertical pack" is PARKED if that means a much larger reusable vertical/product-pack framework.

Finish/specify the actual Moonstruck wedding planner; do not expand into an unrelated vertical-pack programme.

---

FT-14 — Preferred Tailoring / HighMaintenance
------------------------------------------------------------

STATUS: ACTIVE.

See Monthly Grid and pag3.html.

Preferred Tailoring is the broader relationship/service promise.

HighMaintenance is the wardrobe-care operational component.

It should support:

- service plans/memberships where configured;
- customer bookings;
- store drop-off;
- custody;
- care history;
- dry cleaning;
- shoe repair;
- other retailer-approved care partners;
- partner handoff;
- status;
- billing;
- completion;
- pickup/delivery;
- proof;
- exceptions;
- disputes/recovery where required.

Third-party service partners should be manageable operationally without pretending they are PAON employees.

The strategic purpose is not only service revenue.

It increases customer touchpoints and makes the retailer responsible for the wardrobe relationship.

============================================================ 3. DIGITAL WARDROBE FOUNDATION
============================================================

Keep existing proven capabilities if repository evidence supports them:

- wardrobe ownership/sharing;
- outfit/wardrobe roadmap;
- garment lifecycle;
- fit freshness;
- Visual Wardrobe Studio structured foundation;
- Style Portrait;
- single-look Studio;
- advisor visual roadmap;
- multi-look queue.

But ensure the documentation describes how they connect to the founder experiences above instead of presenting them as isolated technical achievements.

============================================================ 4. SELF-PORTRAIT / STYLEPROFILE / FOR YOU
============================================================

Customer profile intelligence is called SELF-PORTRAIT at the experience level.

StyleProfile is structured style/preference data within it.

Keep explicit and inferred preferences separate.

Every inference must remain explainable.

FOR YOU should use structured product metadata.

Catalogue metadata should include reliable structured facts from retailer/catalogue data such as:

- category;
- garment type;
- composition;
- color;
- pattern;
- weight;
- season;
- construction;
- supplier;
- price;
- occasion;
- fit;
- style attributes;
- compatibility;
- theme;
- other approved product properties.

AI may derive/suggest non-protected semantic tags where appropriate, but must not invent protected product facts.

Human review/governance should apply according to existing catalogue rules.

INTEREST / OPPORTUNITY SIGNALS:

Expand these substantially.

Potential evidence includes:

- favorite/save;
- swipe;
- product views;
- repeated product views;
- category browsing;
- search behavior;
- time spent where legally/reliably measurable;
- Virtual Wardrobe activity;
- Complete-the-Look activity;
- MorningRoutine interaction;
- proposal activity;
- appointment activity;
- TableService conversation;
- cart/order intent;
- recent purchase;
- garment lifecycle;
- upcoming occasion;
- recurring annual event;
- wishlist;
- wardrobe gap;
- aspirational advisor recommendation;
- care event;
- fit freshness;
- login/return after inactivity;
- campaign interaction;
- explicit customer request;
- advisor-entered intelligence.

Do not turn weak behavioral evidence into certainty.

Model signal:

- source;
- timestamp;
- strength/confidence;
- recency;
- explanation;
- consent/legal eligibility;
- decay/expiry;
- actionability.

Mission Control should tell the advisor WHY PAON believes contact may be useful.

============================================================ 5. LOYALTY, STORE CREDIT, TIERS AND BADGES
============================================================

Keep loyalty/rewards active.

Retailers must be able to configure their own programmes rather than PAON forcing one universal scheme.

Retailer-configurable areas can include:

- earning percentage/rate;
- store-credit rules;
- qualifying sales;
- exclusions;
- expiration;
- campaigns;
- bonuses;
- milestone thresholds;
- reward values;
- tiers;
- badge rules.

Founder tier naming direction:

- Metre
- Milli
- Micron

Do not assume the exact economic thresholds yet unless repository evidence/founder definition exists.

Document them as configurable.

BADGES:

Create a customer achievement/badge system.

Purpose is discovery and engagement, not childish gamification.

Examples:

- logged into customer environment 30 days;
- explored full-canvas tailoring;
- completed a wardrobe review;
- tried a new construction;
- completed a care cycle;
- created/saved looks;
- explored a category outside normal purchasing behavior;
- wedding/occasion milestones;
- other retailer-defined achievements.

Badges should help customers understand that there is more to discover than their habitual purchases.

Research/reference concepts such as Kith and MR PORTER only if needed to understand loyalty/tier mechanics, but do not blindly copy them and do not make unsupported claims.

Document retailer-configurable governance.

============================================================ 6. HONEYMOON PHASE
============================================================

HONEYMOON PHASE is UTMOST IMPORTANT.

ACTIVE.

Seven-Day Wardrobe: PARK.

Honeymoon Phase = period between:

1. first meaningful visit/order commitment;
2. order pending/production;
3. final pickup/delivery.

Typically approximately 3–6 weeks depending on product.

This period has unusually high customer attention, trust, anticipation and potential conversion.

Read ALL existing repository founder notes/cues about Honeymoon Phase and consolidate them.

The system should intelligently use this period for relevant relationship-building and appropriate upsell/cross-sell without becoming spammy.

Potential touchpoints:

- order/production updates;
- tailoring education;
- advisor messages;
- wardrobe preparation;
- Complete the Look;
- shirts/shoes/ties/accessories;
- care education;
- Self-Portrait enrichment;
- Virtual Wardrobe onboarding;
- fitting preparation;
- pickup anticipation;
- appointment preparation;
- relevant inspiration;
- service introduction;
- referral/gifting only where appropriate.

It should be event-driven and customer-aware, not a fixed generic drip campaign.

============================================================ 7. TIE-MATE
============================================================

Correct any wrong existing definition.

Tie-Mate is NOT merely a generic tie relationship programme.

It is a visual tie-selling tool.

Purpose:

Increase tie sales by letting a customer visualize tie fabrics approximately at real-world size on his phone.

Customer holds phone against/in front of torso/chest area to get an intuitive sense of the tie/fabric.

Tie fabrics/options are swipeable.

Specify:

- real-size/calibrated display concept;
- device-size limitations;
- swipe between tie fabrics;
- save/favorite;
- product info;
- buy/add-to-look;
- advisor-selected tie set;
- connection to wardrobe/Complete the Look.

Do not claim physical color or scale accuracy beyond what a phone display can reliably provide.

============================================================ 8. CATALOGUE + DATA MIGRATION
============================================================

Keep structured catalogue, review workflow, storefront filtering/search, approved product knowledge, import preview, reviewed publishing and governed AI import assistance where proven.

SUPPLIER/LEGACY CRM IMPORT:

ACTIVE.

The retailer owns its own customer data.

PAON must make migration extremely easy.

Retailer should be able to export whatever customer data it legitimately owns from existing systems and import it into PAON.

Supported migration concept should handle heterogeneous sources such as:

- CSV;
- Excel;
- JSON;
- CRM exports;
- contact exports;
- customer notes;
- structured/unstructured notes;
- other supported files.

AI can assist with:

- field mapping;
- normalization;
- deduplication;
- entity resolution;
- categorization;
- extracting structured customer facts from retailer-owned notes;
- detecting conflicts;
- proposing merges;
- highlighting uncertain data.

Critical rule:

AI does NOT silently publish uncertain customer facts.

Use review/confidence/provenance.

Preserve source/provenance where useful.

DATA INGESTION / "DUMP YOUR DATA" EXPERIENCE:

This should be a major onboarding advantage.

Retailers with poor technical knowledge should be guided through:

"What customer information do you already have?"

Then PAON helps import and clean it.

Goal:

Turn fragmented legitimate retailer-owned data into a structured CRM without requiring the retailer to become a data engineer.

LOCAL COMPUTER INGESTION IDEA:

Document as a SECURITY-SENSITIVE FUTURE/EXPERIMENTAL onboarding capability, not something casually promised as already built.

Possible concept:

A local/on-device PAON migration agent can identify likely customer-related files/data on the retailer's own computer.

Privacy requirements:

- local-first scanning;
- clear user initiation;
- narrow file scopes;
- preview before upload;
- no hidden surveillance;
- no indiscriminate ingestion;
- exclude sensitive/non-customer material;
- customer-data relevance filtering;
- user approval;
- show exactly what leaves the device;
- PAON cannot remotely browse unrelated computer contents;
- allow retailer to edit/remove candidate data before import;
- provenance and deletion controls.

Do not claim "PAON can never read it" if data is subsequently uploaded to PAON. Be technically precise.

============================================================ 9. SHOPIFY / EXISTING SYSTEM POSITIONING
============================================================

ACTIVE architectural/product requirement.

PAON should support retailers who:

A. replace generic commerce/CRM tools with PAON;
OR
B. initially run PAON alongside systems such as Shopify.

Do not force migration before PAON can safely replace the relevant function.

Define clear system-of-record boundaries and sync ownership.

Long-term aspiration:

PAON becomes the preferable RetailOS because it understands premium menswear/MTM/relationship retail better than generic commerce software.

Near-term:

interoperate cleanly.

Do not create duplicate customer/order/product truth without explicit ownership/sync rules.

Existing "Faden connector" references should remain only if Faden is an actual intended integration in existing founder/repository context. Verify before preserving it as a named commitment.

============================================================ 10. MISSION CONTROL / STAFF
============================================================

Keep daily workflow, scheduling, demand, coaching and internal support where proven.

Payroll/time approval:

Current founder direction = FINISH the existing programme, but documentation must accurately reflect actual completion.

Do not call it 100% if formal completion is still outstanding.

MISSION CONTROL should become the operating cockpit tying together:

- Today;
- customers;
- appointments;
- tasks;
- TableService;
- alteration follow-up;
- Honeymoon Phase;
- customer opportunities;
- wardrobe opportunities;
- corporate opportunities where relevant;
- product feedback;
- learning/Academy;
- operational alerts;
- recognition;
- schedule;
- relevant intelligence.

Avoid making it a giant unprioritized dashboard.

Use role/context/relevance to surface what matters now.

============================================================ 11. PRODUCTION / STOCK / SUPPLIER OPERATIONS
============================================================

PARK THE ENTIRE ACTIVE BUILD PROGRAMME FOR NOW.

Reason:

At first, retailers can continue using supplier CRM/order systems for supplier ordering/production where necessary.

Do NOT delete useful already-built capabilities such as:

- MeasurementMonitor;
- serialized garment production;
- supplier/atelier intelligence;
- stock ledger;
- reservations;
- barcode receiving;
- RFID/loss-prevention experiments.

Mark them as existing foundations but do not prioritize further work now unless required by an active founder tool such as alterations.

Also park:

- omnichannel POS/returns;
- per-customer MTM price lists;

unless another active workflow strictly requires a narrow primitive.

============================================================ 12. CORPORATE / PAON MÉTIER
============================================================

This requires a coherent product specification.

The core pain:

Corporate uniform/clothing projects are often managed by internal managers who are not fashion experts and for whom wardrobe/uniform management is only a side responsibility.

PAON should make this extremely low friction.

This capability can become a moat for retailer customers competing for tenders.

CORPORATE PROJECT SETUP:

Guide manager through:

1. company/account;
2. locations;
3. departments;
4. roles;
5. employees/headcount;
6. hours/work patterns where relevant;
7. garment requirements per role;
8. jackets/trousers/shirts/etc per role;
9. replacement allowance;
10. permanent vs temporary employment distinctions;
11. personalized/MTM vs stock-size garment strategy;
12. alteration requirements;
13. measurement/fitting rollout;
14. delivery;
15. care/replacement;
16. service support.

Example:

Permanent staff may receive more individualized garments.

Temporary staff may receive standardized sizes that can later require alteration.

Do not hardcode this as universal policy; make it configurable.

EMPLOYEE PORTAL:

Each participating employee can receive a secure email invitation/login.

Employee environment should provide relevant clothing information such as:

- assigned garments;
- sizes/measurements where appropriate;
- care instructions;
- fitting/measurement appointments;
- delivery/pickup;
- replacement eligibility;
- report a problem;
- service request;
- status.

Keep it simple.

TENDER / PITCH BUILDER:

Preserve if proven.

CORPORATE OPPORTUNITY PIPELINE:

Document exactly what exists.

Do not claim it is AI-driven unless repository evidence proves it.

RELATIONSHIP-BASED CORPORATE OPPORTUNITY SCORING:

Expand toward a useful dashboard.

Using consented/legitimate CRM employment data, PAON can identify companies represented among existing customers.

Potential dashboard:

- employer/company;
- number of existing customers associated;
- branch/location where known;
- estimated relevant employee population where a legitimate external source exists;
- retailer penetration;
- relationship strength;
- relevant introductions;
- existing contacts;
- corporate opportunity status.

Do NOT fabricate workforce estimates.

Show source/confidence.

CORPORATE OFFICE VISIT / CAMPAIGN PAGES:

ACTIVE.

Retailers visiting a company for one or more days should be able to generate a beautiful branded campaign/offer landing page.

Employees can:

- understand the offer;
- see products/service;
- book;
- register;
- provide required details;
- prepare for fitting/measurement;
- contact advisor.

Also support premium campaign emails/materials tied to the visit.

Goal: exceptional first impression and higher internal company conversion.

CORPORATE PROJECT / ROLLOUT MANAGEMENT:

If existing primitives already cover this, consolidate them rather than creating a duplicate product.

It should cover project phases, departments, people, measurement, fitting, production/order status where relevant, alterations, delivery, exceptions and service.

CORPORATE ANALYTICS / RENEWAL:

Do not build a vague generic analytics engine.

Instead specify useful intelligence.

FIELD INTELLIGENCE:

Advisors can record visits to hotels, companies and other uniform prospects.

Capture:

- company/location;
- date;
- people spoken with;
- role/contact;
- existing supplier where known;
- pain points;
- garment observations;
- design cues;
- quality;
- replacement cycle;
- contract/tender timing;
- estimated opportunity;
- follow-up;
- evidence/source;
- confidence.

PAON can generate long-horizon alerts when replacement/tender timing approaches.

EXTERNAL CORPORATE SIGNALS:

ACTIVE concept.

Examples:

- hotel sold/acquired;
- hotel rebrand;
- operator change;
- opening/renovation;
- new location;
- major corporate move;
- hospitality ownership change;
- procurement/tender publication;
- other events plausibly associated with uniform replacement.

Example founder intuition:

Conservatorium Hotel being taken over/rebranded by Mandarin Oriental could indicate a future uniform opportunity.

PAON may surface the signal but must NOT claim a uniform change is certain.

Represent:

signal -> evidence -> hypothesis -> confidence -> suggested human follow-up.

PUBLIC TENDER PAGE:

Do not interpret this as merely a generic public web page.

Tie it to the broader tender/business-development flow where appropriate.

AI moodboards/concept imagery:

SKIP / REMOVE FROM ACTIVE SCOPE.

============================================================ 13. COMMERCE / MARKETPLACE / LIFESTYLE
============================================================

PARK:

- marketplace;
- payment/compliance expansion beyond what active features need;
- retailer-owner marketplace;
- ambient/frictionless checkout as a broad platform initiative;
- lifestyle partner catalogue;
- broad concierge/rewards ecosystem;
- MunroMerchant B2B procurement;
- Audience Studio;
- advertising inventory;
- clean-room insight exchange.

IMPORTANT:

This does NOT mean active founder experiences such as One-Click Buy, voucher payment, normal retailer checkout, remote proposal acceptance or alteration billing should be removed.

Those are narrow commerce capabilities required by active products.

============================================================ 14. ACADEMY / CONSULTANCY / EDUCATION
============================================================

ACTIVE.

This is important strategic differentiation.

Read pag1.html and existing education/product-knowledge material.

Create one coherent PAON Academy concept.

Academy lives in Mission Control for staff.

It should consist of modular learning units.

Examples:

- fabric fundamentals;
- Super 100s / 120s / 150s etc;
- what Super numbers mean and do NOT mean;
- fused construction;
- half canvas;
- full canvas;
- garment construction;
- fit;
- silhouette;
- tailoring;
- product knowledge;
- occasion dressing;
- wardrobe building;
- care;
- retailer-specific products;
- retailer-specific service;
- advisor delivery/storytelling.

Retailer should be able to configure/assign relevant modules.

Employees can progress through modules.

Where useful, modules can include short knowledge checks.

Do not turn it into bureaucratic enterprise LMS software.

Goal:

Increase the knowledge level and selling confidence of retail teams.

Founder example:

For a retailer such as Adam Store, improving the knowledge of ~200 employees even slightly can materially improve customer experience and sales.

CUSTOMER EDUCATION:

Approved parts of the same knowledge library can surface on the customer website as small expandable educational rectangles/cards.

Purpose:

- answer questions;
- create authority;
- explain value;
- make tailoring understandable;
- support advisor selling.

Customer-facing education and internal Academy may share governed content primitives but have different presentation/audience permissions.

PARK:

- media/future-product incubation.

SKIP:

- vague "vertical-pack framework" as an active initiative unless repository architecture needs a neutral reusable primitive.

============================================================ 15. PHYSICAL STORE INTELLIGENCE
============================================================

Do not keep "Instrumented physical-store experience" as a vague standalone future programme.

Integrate the practical first version into Mission Control.

Employees should be able to quickly record recurring customer feedback against:

- product;
- collection;
- fit;
- fabric;
- price;
- color;
- styling;
- availability;
- objections;
- requests.

Leadership should be able to identify patterns.

Do not overclaim automated surveillance or sensor-based store instrumentation.

============================================================ 16. LOCATION DISCOVERY
============================================================

Correct the roadmap:

"Location globe" and "monthly grid" are not one feature.

Location Finder:

general-purpose configurable branded location map/globe.

Monthly Grid:

Preferred Tailoring relationship/calendar experience.

The founder supplied an Atelier Munro Cesium globe prototype.

The important reusable behavior from that prototype includes:

- lazy-loading map/globe;
- 3D interactive exploration;
- auto-rotation when inactive;
- activate/deactivate interaction;
- location markers;
- open/closed state;
- location information card;
- image;
- address;
- opening hours;
- call;
- chat;
- configurable category/filter cards;
- camera movement;
- store categories;
- mobile-friendly premium visual treatment.

Generalize it for any PAON retailer.

Retailer configuration should determine:

- 2D vs 3D;
- brand colors;
- imagery;
- map/globe style;
- location categories;
- locations;
- coordinates;
- opening hours;
- timezone;
- phone/contact;
- CTA behavior;
- filters.

============================================================ 17. CURRENT FEATURE DISPOSITION SUMMARY
============================================================

Make the canonical roadmap/disposition reflect approximately this founder truth:

FIT / MTM

- Voice + drag fit tool: PARK
- Silhouette standalone: PARK; useful recommendation concept folds into Alteration
- First-fitting / Alteration Automation: ACTIVE
- Suit Configurator: ACTIVE INSIDE Visual Wardrobe Studio
- Swipe Deck: KEEP
- QR try-on / fabric batch: DELETE

DIGITAL WARDROBE

- Six-Rail / Virtual Wardrobe: CRUCIAL ACTIVE
- Wardrobe ownership/sharing: KEEP proven foundation
- Outfit/wardrobe roadmap: KEEP
- Garment lifecycle/fit freshness: KEEP
- Visual Wardrobe Studio foundation: KEEP
- Style Portrait/single-look: KEEP
- Advisor roadmap/multi-look: KEEP
- QR Wardrobe Card: BUILD / ACTIVE

MORNINGROUTINE

- Complete-look experience: CRUCIAL ACTIVE
- One-click buy: ACTIVE milestone
- Complete-the-Look intelligence: part of Virtual Wardrobe Studio / MorningRoutine, not an unrelated standalone programme
- advanced AI visualization only to the extent technically reliable

SELF-PORTRAIT

- StyleProfile: KEEP
- consent controls: KEEP
- For You: KEEP and connect to metadata
- segmentation: KEEP
- opportunity signals: KEEP AND EXPAND

TABLESERVICE

- consultation chat: CRUCIAL ACTIVE
- advisor prep: KEEP
- appointment dashboard: KEEP
- communication hub: KEEP/consolidate
- unified remote proposals: SPECIFY/BUILD as part of remote conversion architecture

LOYALTY/GIFTS

- private offers/campaigns: KEEP
- milestones/rewards: KEEP + retailer configuration
- badges: ADD
- store credit: KEEP/specify
- Metre/Milli/Micron tiers: ADD/configurable
- Inspiration Box: ACTIVE
- Honeymoon Phase: CRUCIAL ACTIVE
- Seven-Day Wardrobe: PARK

PREFERRED TAILORING

- Preferred Tailoring/HighMaintenance: ACTIVE
- service plans/care ops: KEEP
- partner network/workflow: continue only as needed by Preferred Tailoring
- Tie-Mate: CORRECT DEFINITION and ACTIVE

WEDDING

- Moonstruck planner: ACTIVE / finish founder experience
- fitting capacity: KEEP
- giant "vertical pack" programme: PARK

CATALOGUE

- existing structured catalogue/review/search/knowledge: KEEP
- import pipeline: KEEP
- AI mapping with human review: KEEP
- legacy/supplier CRM/customer data import: ACTIVE
- Shopify interoperability: ACTIVE
- migration/onboarding intelligence: IMPORTANT

MISSION CONTROL

- cockpit: CRUCIAL ACTIVE
- daily staff workflow: KEEP
- scheduling/demand/coaching: KEEP
- internal staff support: KEEP
- payroll/time approval: FINISH existing programme

PRODUCTION/STOCK

- PARK further active build
- preserve existing foundations

CORPORATE / MÉTIER

- ACTIVE coherent product direction
- pipeline: KEEP if proven
- Tender/Pitch Builder: KEEP if proven
- employee portal: KEEP
- measurement/fitting rollout: KEEP
- service desk: KEEP
- relationship-based opportunity intelligence: EXPAND
- corporate pilot: BUILD toward coherent pilot
- campaign/office visit pages: ACTIVE
- rollout/project management: consolidate/build where gaps exist
- vague analytics engine: do not create
- field intelligence + renewal/tender signals: ACTIVE
- AI moodboards: SKIP
- external signals: ACTIVE

MARKETPLACE/LIFESTYLE

- PARK

ACADEMY

- ACTIVE

PHYSICAL STORE FEEDBACK

- integrate into Mission Control

LOCATION

- general-purpose branded Location Finder: ACTIVE
- Monthly Grid belongs to Preferred Tailoring

============================================================ 18. DOCUMENT STRUCTURE / ANTI-DUPLICATION
============================================================

After understanding the current docs, decide which existing MD should be canonical for each concept.

Prefer editing existing canonical files rather than proliferating new files.

At minimum ensure:

NORTH_STAR.md
= durable product thesis and strategic principles.

PRODUCT.md
= coherent description of the actual PAON product.

FOUNDER_TOOL_BLUEPRINTS.md
= founder experience truth for FT-01 through FT-14.

CAPABILITY_DISPOSITION.md
= KEEP / ACTIVE / HOLD / PARK / DELETE / COMPLETE disposition.

ROADMAP.md
= prioritized product sequence and gates.

PHASE.md
= actual current implementation status and immediate build state, based on repository evidence.

DESIGN_PORTS.md
= founder HTML/image/prototype references and what behavior/design is intended to transfer.

PAON_INTELLIGENCE_PLATFORM.md
= intelligence/provenance/signals/recommendation/data-assistance architecture, not an excuse to invent unsupported AI.

AGENT_ROUTING.md
= implementation-agent/model routing only; do not let it become a second product roadmap.

If the repository's actual canonical structure differs, respect AGENTS.md, but achieve the same separation of concerns.

============================================================ 19. COMPLETION LANGUAGE
============================================================

Be rigorous.

Use language such as:

- BUILT / PROVEN
- PARTIAL
- FOUNDATION EXISTS
- SPECIFIED
- ACTIVE BUILD
- PARKED
- DELETED

Do not write "100%" merely because one implementation primitive exists.

For each founder tool, distinguish:

A. infrastructure/capabilities already present;
B. founder experience completion;
C. remaining gaps;
D. disposition.

If a current MD says something is complete but founder truth above clearly says the founder experience is incomplete, correct it.

============================================================ 20. ROADMAP PRIORITY
============================================================

The roadmap must stop treating all possible PAON ideas as equally active.

Highest product emphasis should clearly include the active founder experiences:

- Mission Control
- Self-Portrait intelligence
- Virtual Wardrobe / Six-Rail Wardrobe
- Visual Wardrobe Studio
- MorningRoutine
- TableService
- Alteration / First-Fitting workflow
- Honeymoon Phase
- Preferred Tailoring / HighMaintenance
- Moonstruck
- customer/data migration
- catalogue intelligence
- loyalty/badges/store credit
- Academy
- corporate/Métier pilot
- Location Finder where appropriate

Do not allow parked platform businesses to distract from proving these.

Preserve the existing roadmap rule that real retailer/customer use should gate expansion if that rule exists and is still canonical.

Do not falsely mark a phase validated merely because tests pass.

Technical completion != market validation.

============================================================ 21. WHAT TO DO NOW
============================================================

Perform the work.

1. Read AGENTS.md and the canonical docs.
2. Read pag1.html, pag2.html and pag3.html.
3. Search repository for all concepts above.
4. Compare implementation evidence against documentation.
5. Edit the canonical MDs.
6. Consolidate duplicates.
7. Correct statuses.
8. Add the founder specifications above at the correct level of detail.
9. Preserve useful repository evidence/commit references where accurate.
10. Ensure active/park/delete decisions propagate consistently everywhere.
11. Run documentation/reference checks available in the repo.
12. Search the finished repository for stale contradictory statements.
13. Fix those contradictions.
14. Do NOT implement the actual features in this task.
15. Do NOT alter application code merely to make documentation claims true.
16. Do NOT commit unrelated changes.

============================================================ 22. REQUIRED FINAL VERIFICATION
============================================================

Before stopping, explicitly verify all of these:

[ ] FT-01 is parked.
[ ] FT-02 standalone is parked and useful silhouette logic belongs to Alteration.
[ ] FT-03 is deleted.
[ ] FT-04 contains the detailed alteration snapshot/work-order workflow.
[ ] FT-05 Mission Control is crucial.
[ ] FT-06 MorningRoutine is crucial and includes one-click buying.
[ ] FT-07 configurator is positioned inside Visual Wardrobe Studio.
[ ] FT-08 saved/swiped evidence feeds Favorites/Self-Portrait appropriately.
[ ] FT-09 TableService is a major human-first website conversion/communication system.
[ ] FT-10 Inspiration Box includes digital/physical voucher + up-to-20 inspiration cards.
[ ] FT-11 Location Finder and Monthly Grid are separated.
[ ] FT-12 Virtual Wardrobe includes aspirational rails, Complete the Look, care, visualization and QR Wardrobe Card.
[ ] FT-13 Moonstruck matches the groom/party/advisor coordination concept.
[ ] FT-14 Preferred Tailoring/HighMaintenance matches end-to-end wardrobe care.
[ ] MorningRoutine supports intelligent message windows.
[ ] Honeymoon Phase is active and important.
[ ] Seven-Day Wardrobe is parked.
[ ] Tie-Mate has the corrected real-size phone visualization definition.
[ ] loyalty supports retailer configuration, store credit, tiers and badges.
[ ] customer opportunity signals are expanded and explainable.
[ ] catalogue metadata drives relevant recommendations without fabricated product facts.
[ ] customer-data migration is treated as a major onboarding advantage.
[ ] local-computer ingestion is privacy-safe and not falsely claimed as built.
[ ] Shopify coexistence/replacement positioning is coherent.
[ ] production/stock expansion is parked while existing work is preserved.
[ ] Corporate/Métier reflects the detailed corporate wardrobe/tender/employee/field-intelligence direction.
[ ] Academy is active.
[ ] physical-store product feedback belongs to Mission Control.
[ ] marketplace/lifestyle platform businesses are parked.
[ ] AI moodboards are skipped.
[ ] Location Finder is retailer-configurable for locations, colors and 2D/3D.
[ ] no document still incorrectly combines Location Globe with Monthly Grid.
[ ] no stale MD contradicts active/park/delete decisions.
[ ] no partial technical primitive is misrepresented as a complete founder experience.

============================================================ 23. FINAL RESPONSE FORMAT
============================================================

After editing, return ONLY:

1. FILES CHANGED
   - each MD changed
   - one sentence describing its new canonical responsibility

2. FOUNDER DECISIONS APPLIED
   - concise list of the major ACTIVE / PARK / DELETE corrections

3. CONTRADICTIONS REMOVED
   - identify stale/duplicate roadmap statements you corrected

4. IMPLEMENTATION TRUTH CORRECTIONS
   - features previously overstated or understated compared with actual repo evidence

5. UNRESOLVED
   - only genuine contradictions that could not be resolved from founder truth + repo
   - if none, write "None."

6. VERIFICATION
   - documentation/reference checks run and results
   - git diff --check result
   - git status --short
   - explicitly confirm that NO product/application implementation was performed

DO THE DOCUMENT EDITS NOW.
Do not merely give me an audit or proposed rewrite.

```V

```
