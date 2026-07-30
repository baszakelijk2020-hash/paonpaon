# PAON Competitive Capability and Portability Ledger

Status: research and product-design input, not an as-built claim or active
implementation queue.

Research snapshot: 2026-07-30.

## 1. Decision

PAON is not entering an empty market. Most individual capabilities already
exist, often in several products:

- Shopify is a broad commerce operating system.
- Endear is a strong, action-oriented clienteling layer.
- Tulip is a deep enterprise clienteling and store-associate platform.
- Salesforce Retail Cloud is a configurable enterprise Customer 360 and
  commerce platform.
- NewStore is a mobile-first omnichannel POS and remote-selling platform.
- Stitchli, Atelierware, Faden, and other tailoring systems cover parts of the
  made-to-measure and workshop operating model.
- BIM Amsterdam and similar training companies improve the human selling
  ceremony, management coaching, and behavioral consistency.

The opportunity is therefore not "invent CRM" or "invent ecommerce." The
opportunity is to make these capabilities behave as one coherent operating
system for independent premium retailers, with:

1. a superior customer and advisor experience;
2. tailoring and aftercare as first-class domains;
3. evidence-cited intelligence that turns signals into useful daily work;
4. enforced but low-friction operating discipline;
5. migration paths from the systems retailers already use;
6. a retailer-supplier marketplace attached to real operational needs; and
7. a configuration system that feels familiar without maintaining literal
   copies of competitors' interfaces.

This is a real product thesis, but it is not defended by a long feature list.
It is defended when PAON produces more completed, well-timed customer actions,
cleaner institutional customer knowledge, faster made-to-measure execution,
and measurably more repeat sales with less administrative work.

## 2. Candid competitive verdict

### What is commodity

The following are expected capabilities, not meaningful differentiation by
themselves:

- product, variant, collection, and media management;
- basic website and ecommerce;
- carts, orders, payments, refunds, and returns;
- customer profiles and purchase history;
- tags, static segments, birthdays, and notes;
- basic POS, inventory counts, and reports;
- email/SMS campaigns and task lists;
- appointments and simple loyalty;
- CSV import/export;
- generic AI-written messages.

PAON must execute these well, but should not describe their mere existence as
innovation.

### What can become defensible

- A Self-Portrait that joins declared preferences, advisor observations,
  transactions, browsing, fittings, measurements, garments, relationship
  moments, and corrections without losing evidence or provenance.
- A daily advisor queue that explains why a customer matters now, recommends a
  commercially sensible next action, respects contact pressure, and learns
  from the result.
- A selling ceremony that is encoded into actual appointments, orders,
  closeouts, coaching, and data-quality routines instead of living in a
  training PDF.
- A continuous thread from discovery through product selection, fitting,
  production, alterations, delivery, wardrobe, care, and the next purchase.
- Import adapters and source-specific familiarity presets that make switching
  feel materially less risky.
- A business-owner layer that shows whether relationship work and data capture
  actually happen across staff and locations.
- A procurement marketplace that uses operating context to make relevant
  suggestions instead of behaving like an unrelated B2B webshop.

### The closest direct warning

[Faden](https://www.faden.tech/features) is the closest public conceptual
competitor found in this research. It presents a made-to-measure operating
system combining a configurator, tailoring CRM, versioned measurements,
production board, workroom/factory portal, material inventory, messages,
payments, accounting connections, customer portal, and Shopify/WooCommerce
integration.

Whether every public claim is production-mature cannot be established from the
website. The important point is that the integrated tailoring-OS thesis is
already legible in the market. PAON cannot assume that customer-facing design
plus clienteling will be enough. It must develop credible workshop operations
and make its customer-intelligence loop substantially better.

## 3. Capability ledger

### 3.1 Shopify and Shopify POS

Company and product:

- Shopify provides hosted storefronts, ecommerce, customer accounts, payments,
  orders, product/catalog management, inventory, analytics, APIs, automation,
  and an application ecosystem.
- Shopify POS extends the commerce model to stores. POS Pro adds richer staff,
  location, inventory, loyalty, and customer-management workflows.

Strong ideas to adopt:

- One product/order/customer model across online and store activity.
- Durable semantic commerce events rather than screenshots or prose logs.
- Extensible metadata and custom data.
- Bulk operations for large catalogs and histories.
- A trigger/condition/action workflow model similar in spirit to Shopify Flow.
- Store/location-aware inventory and staff attribution.

PAON improvement:

- Keep the event model but make clienteling consequences first-class.
- Show an advisor not merely that a product was viewed, but an evidence-cited
  interpretation, available inventory, the customer's wardrobe context, an
  appropriate next action, and contact-pressure context.
- Add made-to-measure, fitting, workshop, wardrobe, aftercare, and sales
  coaching domains that Shopify does not natively model deeply.

Portability:

- Customer CSV export/import is straightforward. Shopify documents customer
  tags and metafields, but passwords do not migrate and imported totals/order
  counts are not substitutes for importing the underlying orders.
- Product CSV export is straightforward. Image binaries are not embedded;
  image URLs must be copied while still reachable.
- Orders and inventory can be exported separately.
- Admin GraphQL bulk operations provide an efficient authenticated path for
  large exports.
- Web Pixels expose semantic events including page, product, collection, cart,
  search, and checkout activity for ongoing synchronization.

Assessment: **easy** for customers, products, variants, orders, and current
inventory when the retailer grants admin/API access. **Medium** for historical
behavior, app-owned custom data, and reconciling third-party app records.

Primary references:

- [Shopify customer CSV import/export](https://help.shopify.com/en/manual/customers/import-export-customers)
- [Shopify product export](https://help.shopify.com/en/manual/products/import-export/export-products)
- [Using Shopify product CSV files](https://help.shopify.com/en/manual/products/import-export/using-csv)
- [Shopify order export](https://help.shopify.com/en/manual/fulfillment/managing-orders/exporting-orders)
- [Shopify inventory CSV](https://help.shopify.com/en/manual/products/inventory/getting-started-with-inventory/inventory-csv)
- [Shopify GraphQL bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries)
- [Shopify Web Pixels standard events](https://shopify.dev/docs/api/web-pixels-api/standard-events)
- [Shopify Flow concepts](https://help.shopify.com/en/manual/shopify-flow/getting-started)

### 3.2 Endear

Company and product:

Endear is a retail CRM and clienteling platform with messaging, customer
profiles, segmentation, appointments, campaigns, shoppable Stories, remote
selling, analytics, and integrations.

Strong ideas to adopt:

- The Opportunity Engine is not a giant CRM search result. It is a ranked
  daily list answering "who, why now, and what should I say?"
- The AI Notetaker turns voice, typed, photo, video, and handwritten input into
  candidate preferences, tasks, and messages.
- Stories turn product selections into trackable, shoppable content.
- Appointments, messaging, customer context, and attribution live in one
  advisor workflow.

PAON improvement:

- Every opportunity should expose its evidence and deterministic eligibility,
  not just AI prose.
- Use wardrobe, fit, alteration, occasion, store visit, and production status
  in addition to ecommerce behavior.
- Let the system propose profile changes from notes, but require a fast human
  confirmation before a candidate becomes a durable fact.
- Measure opportunity acceptance, completion, customer response, appointment,
  sale, gross margin, and whether the recommendation was marked wrong.

Portability:

- Endear documents admin customer CSV exports and report exports.
- Its CSV importer accepts customers, locations, products, variants, staff,
  purchases, line items, and refunds.
- Automated imports can use SFTP, S3, Google Drive, Azure, or Azure SQL.
- Shopify synchronization covers substantial historical and real-time commerce
  data, but Endear documents one-way limitations and notes that Shopify notes
  are not imported.
- A complete self-service export of all message bodies, notes, tasks,
  appointments, attachments, and outcomes was not confirmed in public
  documentation. Treat those objects as API- or vendor-export-dependent.

Assessment: **easy** for customer and report CSVs. **Medium to hard** for a
complete operational history unless tenant API access or a vendor-assisted
export is available.

Primary references:

- [Endear AI Opportunity Engine](https://help.endearhq.com/en/articles/13623191-what-is-ai-opportunity-engine)
- [Endear AI Notetaker](https://endearhq.com/ai-notetaker)
- [Endear platform](https://endearhq.com/platform)
- [Endear appointments](https://endearhq.com/appointments)
- [Endear Stories](https://help.endearhq.com/en/articles/6152880-what-are-stories)
- [Endear Shopify integration](https://help.endearhq.com/en/articles/8136997-how-to-set-up-the-shopify-integration)
- [Endear customer export](https://help.endearhq.com/en/articles/6152930-how-do-i-export-customers)
- [Endear CSV importer](https://help.endearhq.com/en/articles/8234419-how-to-use-the-csv-importer-tool)
- [Endear automated CSV imports](https://help.endearhq.com/en/articles/12295065-overview-of-csv-automation-for-data-import)
- [Endear integration overview](https://help.endearhq.com/en/articles/12461292-overview-of-endear-integrations)

### 3.3 Tulip

Company and product:

Tulip provides enterprise store applications including rich clienteling,
customer profiles, associate workflows, follow-ups, messaging, product and
inventory access, analytics, and integration infrastructure.

Strong ideas to adopt:

- The customer profile joins closet, purchase history, important dates,
  preferences, wishlist, notes, photos, communication/activity, browsing,
  associates, metrics, loyalty, and recommendations.
- Customer Prism uses configurable visual preference facets, including
  image-based likes and dislikes.
- Follow-ups can be created manually, assigned by managers, triggered by order
  state, and organized as today/upcoming/overdue/completed.
- Tulip explicitly models over-contact avoidance and influenced-sales
  attribution.
- Its data ingestion documents dependency groups instead of pretending all
  files can be imported in any order.

PAON improvement:

- Combine preference facets with PAON's accepted product metadata so a
  preference such as "brown linen checks" automatically affects For You,
  appointment preparation, remote selections, and stock-aware opportunities.
- Preserve negative signals and corrections, not only positive preferences.
- Make influenced-sale attribution visible but configurable and honest; never
  present a correlation window as certain causation.
- Use the same customer context in the workshop and aftercare journey.

Portability:

- Tulip exposes REST Core APIs, Bulk APIs, file imports, data extracts, and
  transformation tooling.
- Its file importer supports SFTP CSV feeds, full and partial upserts, external
  IDs, and whitelisted image URLs.
- The documented dependency sequence is useful: stores/employees/customers,
  then catalog/products/variants/prices/inventory, then orders.
- Enterprise API and extract access depends on the retailer's contract and
  tenant configuration.

Assessment: **medium**. Technically capable and well structured, but a complete
migration is an integration project rather than a single download button.

Primary references:

- [Tulip customer profile](https://docs.tulip.com/apps/clienteling/customer-profile/)
- [Tulip Customer Prism](https://docs.tulip.com/apps/clienteling/customer-prism/)
- [Tulip follow-ups](https://docs.tulip.com/apps/clienteling/follow-ups/)
- [Tulip Clienteling Advisor](https://docs.tulip.com/apps/clienteling/clienteling-advisor/)
- [Tulip clienteling analytics](https://docs.tulip.com/apps/clienteling/tulip-analytics-for-clienteling/)
- [Tulip integration overview](https://docs.tulip.com/integrating/overview/)
- [Tulip API](https://docs.tulip.com/integrating/tulip-api/)
- [Tulip file importer](https://docs.tulip.com/integrating/file-importer/overview/)

### 3.4 Salesforce Retail Cloud

Company and product:

Salesforce Retail Cloud combines Salesforce's extensible data platform with
retail POS and customer experience. Customer 360 surfaces can contain quizzes,
preferences, notes, Black Book/client-book membership, wishlist, cart, closet,
orders, saved carts, rewards, and reviews.

Strong ideas to adopt:

- A modular Customer 360 where retailers can configure panels and custom
  objects without breaking the identity model.
- Black Book/client-book ownership and collaboration.
- Saved carts and order-on-behalf flows attached to the customer profile.
- A broad object and automation model for enterprise exceptions.

PAON improvement:

- Give smaller retailers strong defaults instead of requiring a Salesforce
  implementation project.
- Keep the extensibility, but present domain-specific menswear, fitting,
  occasion, wardrobe, and workshop concepts.
- Make opportunity explanations and data capture usable on the shop floor in
  seconds.

Portability:

- Salesforce supports scheduled exports of org data as zipped CSV files and
  can include files/attachments.
- Data Loader and Bulk APIs can process standard and custom objects at scale.
- Retail Cloud exposes customer, order, inventory, webhook, and service
  interfaces.
- The difficulty is semantic rather than extraction alone: custom objects,
  lookups, polymorphic relationships, automations, attachments, and calculated
  fields must be mapped.

Assessment: **medium to hard**. Extraction is mature; faithful relationship and
behavior migration requires a source-specific schema inventory and mapping.

Primary references:

- [Salesforce Retail POS Customer 360](https://help.salesforce.com/s/articleView?id=commerce.rt_pos_reports_customer_360.htm&language=en_US&type=5)
- [Salesforce data export](https://help.salesforce.com/s/articleView?id=sf.admin_exportdata.htm&language=en_US)
- [Salesforce Data Loader](https://developer.salesforce.com/tools/data-loader)
- [Salesforce CLI bulk export](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data_export_bulk.html)
- [Retail Cloud API, SPI, and webhook specifications](https://developer.salesforce.com/docs/commerce/retail-cloud/guide/retail-cloud-api-spi-webhook-specs.html)

### 3.5 NewStore

Company and product:

NewStore is an omnichannel retail platform with mobile POS, endless aisle,
inventory, clienteling, messaging, customer profiles, order management, and
remote selling.

Strong ideas to adopt:

- The associate can continue a customer conversation into a remote cart and
  payment link without losing context.
- Customer profile, order history, messaging, and remote sale are one mobile
  workflow.
- Near-real-time event delivery supports operational integrations.

PAON improvement:

- Make a shared cart into an explained styling proposal with outfit logic,
  fit/wardrobe context, alternatives, and tracked customer response.
- Keep saved carts, quotes, remote carts, and actual orders as distinct states.
- Add made-to-measure configuration, deposit, fitting, production, and
  alteration state rather than treating every sale as a conventional SKU.

Portability:

- Products, categories, prices, and stock can be imported using documented
  jobs; product and pricebook exports are supported.
- Order data has a documented CSV export.
- REST, GraphQL, webhooks, and at-least-once event streams support ongoing
  integrations.
- Complete customer/clienteling history still depends on tenant API scope and
  the retained event history.

Assessment: **medium** with tenant credentials and integration access.

Primary references:

- [NewStore clienteling](https://docs.newstore.com/docs/clienteling-1)
- [NewStore remote cart](https://docs.newstore.com/docs/remote-cart)
- [NewStore data import](https://docs.newstore.com/docs/importing-data)
- [NewStore order export](https://docs.newstore.com/v1/docs/exporting-order-data)
- [NewStore APIs](https://docs.newstore.com/docs/getting-started-with-newstore-apis)
- [NewStore real-time data](https://docs.newstore.com/docs/receiving-real-time-data)

### 3.6 Stitchli

Company and product:

Stitchli markets a 2026-era atelier operating system containing CRM, order and
production stages, measurement templates, appointments, customer status,
WhatsApp/email, staff workload, inventory, purchase orders, reports, and
segmentation.

Strong ideas to adopt:

- A clear garment order lifecycle: new, cutting, stitching, fitting,
  finishing, ready, delivered.
- Customer-facing live order status.
- Measurements automatically available during order creation.
- Material inventory and purchase orders within the same operational tool.
- Explicit data portability in the product promise.

PAON improvement:

- Use versioned, evidence-linked measurements and fit observations rather than
  a flat latest-value form.
- Join workshop state to customer communication, appointment preparation,
  delayed-order service recovery, wardrobe, and next-best action.
- Add barcode/QR piece-level evidence, generated work instructions, material
  consumption, and capacity.
- Offer configurable stages rather than imposing a single global pipeline.

Portability:

- Stitchli publicly claims bulk customer CSV/Excel import and export of the
  entire database at any time.
- The precise export schema and production maturity were not independently
  verified.

Assessment: **potentially easy**, subject to validating an actual tenant
export. Treat current statements as vendor marketing claims until tested.

Primary reference:

- [Stitchli platform and data portability](https://stitchli.com/)

### 3.7 Atelierware

Company and product:

Atelierware markets tailoring ERP/POS software and claims more than 700 shops
and over 25 years of tailoring-domain experience. Its public capability set is
especially strong in operations.

Strong ideas to adopt:

- A barcode for every garment piece through production, trials, and delivery.
- Multi-branch/franchise operations and centralized production.
- Digital worker job cards and piece-rate payment.
- Raw materials, trims, consumption, purchase, and reorder logic.
- Capacity balancing across branches and production units.
- Multiple garment trials and readymade-plus-tailoring POS.
- WhatsApp confirmations and stage notifications.

PAON improvement:

- Combine these operational mechanics with a substantially richer customer
  relationship and wardrobe model.
- Give the owner reliable execution and data-quality views without turning
  employee oversight into keystroke surveillance.
- Let product, fitting, and service outcomes improve future recommendations
  and training.

Portability:

- Atelierware documents an open API that allows existing billing/POS systems
  to create orders.
- A public complete-export mechanism was not confirmed.

Assessment: **medium to hard** until API read scope or a vendor export is
confirmed.

Primary reference:

- [Atelierware](https://www.atelierware.com/)

### 3.8 Faden

Company and product:

Faden markets "one thread from the sale, through the fit, to the factory." Its
public feature set is the most direct reference for PAON's tailoring expansion.

Strong ideas to adopt:

- A customer-driven made-to-measure configurator with live pricing.
- A configurable production Kanban.
- Generated tech packs, cut sheets, and bills of materials.
- Stage photos attached directly to the garment/order.
- A factory/outworker portal that exposes the work ticket without exposing
  customer identity.
- Versioned measurements, deltas, weight trends, and pre-cut alerts.
- Deposits and balances attached to the order.
- A branded client portal.
- Signed outbound webhooks and broad operational integrations.

PAON improvement:

- Make customer intent and clienteling evidence influence designs and outreach.
- Make the full aftercare and wardrobe cycle part of the same system.
- Add manager-enforced discovery, closeout, data-quality, and coaching.
- Build a stronger first-party analytics and recommendation model across
  ecommerce, store, appointment, fitting, and service behavior.
- Preserve strict source provenance in measurements, observations, and AI
  suggestions.

Portability:

- Faden publicly advertises CSV export on reports, audit export, Shopify and
  WooCommerce synchronization, and signed outbound webhooks.
- A complete relational tenant export was not verified.

Assessment: **medium**, likely easier for commerce data than for a complete
workshop/clienteling history.

Primary reference:

- [Faden product](https://www.faden.tech/features)

### 3.9 Other common source systems

#### Lightspeed Retail

- X-Series exposes customer, product, sales-history, inventory, payment, and
  tax exports in CSV/XLSX.
- R-Series and E-Series differ; some history migration paths require extra
  exports or third-party tools.
- APIs are also available for ongoing synchronization.

Assessment: **easy to medium**, depending on series and history.

References:

- [Lightspeed X-Series reporting exports](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534147956123-Exporting-your-reporting-data-from-Retail-POS-X-Series)
- [Lightspeed X-Series CSV templates](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25533797745563-Where-can-I-find-all-Retail-POS-X-Series-CSV-templates)
- [Shopify's documented Lightspeed migration paths](https://help.shopify.com/en/manual/migrating-to-shopify/migrating-from-lightspeed)

#### Square

- Customer Directory supports spreadsheet import/export and custom fields.
- Catalog, Inventory, Customers, Orders, and related APIs support pagination,
  batch operations, and OAuth scopes.
- Order-to-customer linking is not complete in every origin path; Square warns
  that some online orders may not contain `customer_id`.

Assessment: **easy to medium**. Reconciliation must not assume every
transaction has a durable customer link.

References:

- [Square Customer Directory](https://squareup.com/help/us/en/article/5498-manage-your-customer-directory-online)
- [Square Catalog API](https://developer.squareup.com/docs/catalog-api/what-it-does)
- [Square Inventory API](https://developer.squareup.com/docs/inventory-api/what-it-does)
- [Square Orders API](https://developer.squareup.com/reference/square/orders)
- [Square Customers API](https://developer.squareup.com/docs/customers-api/what-it-does)

#### WooCommerce

- With retailer admin/API credentials, REST endpoints expose products,
  customers, orders, line items, refunds, variations, metadata, and webhooks.
- WordPress plugins can add arbitrary metadata, so unknown extension data
  needs discovery and mapping.
- Password hashes should not be treated as a normal portable credential format.

Assessment: **easy** for core WooCommerce, **medium** when the shop depends on
many plugins or custom tables.

Reference:

- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)

## 4. Portability matrix

| Source              | Customers                     | Products/media           | Orders/line items           | Stock                       | Notes/messages/tasks                         | Best PAON path                                        | Difficulty                |
| ------------------- | ----------------------------- | ------------------------ | --------------------------- | --------------------------- | -------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| Shopify             | CSV/API                       | CSV/API; copy image URLs | CSV/API                     | CSV/API                     | Usually app-specific                         | OAuth bulk API + CSV fallback                         | Easy                      |
| Lightspeed X        | CSV/API                       | CSV/API                  | CSV/API                     | CSV/API                     | Product/series dependent                     | Series-specific adapter                               | Easy–medium               |
| Square              | CSV/API                       | CSV/API                  | API/report CSV              | API/CSV                     | Custom fields/API; incomplete links possible | OAuth APIs + reconciliation                           | Easy–medium               |
| WooCommerce         | REST/DB                       | REST/CSV/media library   | REST/DB                     | REST/DB                     | Plugin/custom-table dependent                | REST first; approved DB export for large/custom sites | Easy–medium               |
| Endear              | CSV/API                       | Synced/importable        | Synced/importable           | Source-commerce dependent   | Full export not publicly confirmed           | CSV + API/vendor export                               | Medium                    |
| Tulip               | API/files                     | API/files/image URLs     | API/files                   | API/files                   | API/extract contract dependent               | Enterprise integration project                        | Medium                    |
| Salesforce          | CSV/Bulk API                  | Objects/files            | Objects/Bulk API            | Objects/API                 | Custom objects/files                         | Schema inventory + Bulk API                           | Medium–hard               |
| NewStore            | API                           | Import/export jobs       | CSV/API                     | API/events                  | Tenant scope dependent                       | Tenant APIs + event stream                            | Medium                    |
| Stitchli            | Vendor claims complete export | Unknown schema           | Unknown schema              | Unknown schema              | Unknown schema                               | Validate real export first                            | Unknown; potentially easy |
| Atelierware         | API integration advertised    | Unknown                  | Order-create API advertised | Unknown                     | Unknown                                      | Require read API/vendor export                        | Medium–hard               |
| Faden               | Reports CSV/integrations      | Commerce sync            | Commerce sync/exports       | Reports/integrations        | Webhooks; full export unverified             | API/webhooks + vendor export                          | Medium                    |
| Public website only | Usually none                  | Crawlable public content | None                        | Availability only if public | None                                         | Sitemap/JSON-LD/headless extraction                   | Medium for catalog only   |

## 5. Public-site reconstruction: what is feasible

With the retailer's authorization, PAON can reconstruct a surprisingly useful
public catalog from an existing website:

1. discover sitemap and category/product URLs;
2. parse schema.org Product JSON-LD, microdata, Open Graph, embedded storefront
   state, and visible content;
3. fall back to a headless browser for client-rendered pages;
4. fetch original media, calculate hashes, preserve source URLs and rights
   provenance, and deduplicate;
5. derive candidate color, material, pattern, garment, silhouette, occasion,
   season, and care metadata from text and images;
6. map sizes, variants, prices, availability, categories, and related items
   where publicly exposed;
7. stage everything for human approval before publishing;
8. rerun a delta crawl before cutover.

AI should accelerate normalization, translation, metadata extraction, image
classification, description drafting, and duplicate detection. It must not
silently invent composition, construction, care, stock, or fit claims that the
source does not support.

A public crawl cannot reconstruct private customers, orders, measurements,
consent, messages, staff notes, reliable inventory ledgers, payment details,
or account passwords. Those require owner-authorized exports, APIs, or database
access. "Download the website" is therefore a valuable catalog fallback, not a
complete business migration strategy.

## 6. Luxury retail and service patterns worth digitizing

### 6.1 ZEGNA X

In 2023 Zegna and Microsoft described ZEGNA X, combining Dynamics 365,
segmentation/data infrastructure, remote advisor sharing, a 3D configurator,
and AI-assisted personalization. Microsoft reported Zegna's claim that the
ecosystem accounted for roughly 45% of boutique revenue after a two-year trial.
Zegna also described billions of potential made-to-measure combinations.

What it technically represents:

- a persistent client/advisor commerce environment;
- remote and in-store continuity;
- rich product configuration;
- centralized customer and response data;
- recommendation and channel/content learning.

PAON application:

- Create a persistent "Client Room" attached to the customer and advisor.
- Let customer and advisor co-build looks, garments, wedding capsules, and
  carts over multiple sessions.
- Track which complete looks, individual products, images, and channels
  produce response—not just message opens.
- Attach the approved design/specification directly to quote, order,
  production, fitting, and wardrobe.

Reference:

- [Microsoft on ZEGNA X](https://news.microsoft.com/europe/2023/04/20/working-with-microsoft-zegna-adds-ai-to-digital-toolkit-to-engage-clients/)

### 6.2 Ralph Lauren Ask Ralph and the fitting-room lesson

Ralph Lauren launched Ask Ralph in September 2025 for US app account holders.
It uses Azure OpenAI to interpret open-ended prompts and generate several
visual, shoppable complete outfits from available Polo Ralph Lauren inventory.

PAON application:

- Make complete-look generation inventory-aware and wardrobe-aware.
- Let the customer refine by natural language, then save either the whole look
  or individual pieces.
- Preserve recommendation reasons and customer corrections as structured
  evidence.
- Make the same assistant available to an advisor during appointment prep.

Ralph Lauren's connected fitting-room project was a 2015 RFID/touch-mirror
pilot, not evidence of a new 2026 chain-wide rollout. Its durable ideas remain
useful:

- identify garments entering the room;
- request another size/color or advisor assistance;
- suggest related items;
- capture co-try, request, and conversion patterns.

PAON should first implement a low-cost tablet "Fitting Room Mode" using QR or
barcode scans. RFID and a mirror display can be an optional hardware layer
after the workflow and economics are proven.

References:

- [Ralph Lauren Ask Ralph announcement](https://corporate.ralphlauren.com/on/demandware.static/-/Sites-RalphLauren_Corporate-Library/default/dw2eedc2ed/assets/images/PRESS_RELEASES/AskRalph.pdf)
- [Ask Ralph customer information](https://www.ralphlauren.com/askralphinfo)
- [2015 Ralph Lauren RFID fitting-room pilot](https://www.rfidjournal.com/news/polo-ralph-lauren-store-gets-smart-fitting-rooms/72345/)

### 6.3 LVMH, Dior, Loro Piana, and Louis Vuitton

LVMH's 2024 technology showcase described:

- Dior Astra aggregating reviews, product pages, customer-service
  interactions, satisfaction surveys, and live shopping to identify emerging
  trends and issues;
- visual product search for advisors;
- Loro Piana digital-double/try-on work;
- a Louis Vuitton AI configurator that used a customer photo or prompts to
  help advisors find relevant products.

PAON application:

- Build a feedback intelligence layer across messages, appointments,
  closeouts, returns, alterations, product engagement, and reviews.
- Separate emerging product/service issues from individual customer facts.
- Give advisors photo-based catalog retrieval with confidence and filters.
- Use customer photos only as explicit inputs to a visible styling session;
  do not turn them into hidden biometric identity.

A 2026 Louis Vuitton clienteling role describes operational discipline that is
directly relevant: monitor data quality, capture at least one usable contact
channel, complete outreach, plan appointments, and run a daily 30-minute
Clienteling Club.

PAON application:

- Daily manager-facilitated Clienteling Club view.
- Contactability and profile-quality coverage by advisor/branch.
- Short action plans and actual completion/outcome tracking.
- Birthday, anniversary, collection, service, and VIC preparation queues.

References:

- [LVMH VivaTech 2024](https://www.lvmh.com/en/news-lvmh/lvmh-takes-viva-technology-2024-visitors-into-its-dream-garden)
- [Louis Vuitton in-store clienteling role](https://jobs.louisvuitton.com/en/search-page/job/client-advisor-in-store-clienteling-singapore-singapore-LVM33004)

### 6.4 Gucci and Cartier

Current Gucci client-advisor and global client-development roles emphasize:

- one-to-one client portfolios;
- proactive outreach and appointments;
- meaningful customer information;
- remote selling;
- lifestyle knowledge and local cultural relevance;
- explicit clienteling targets, tool adoption, training, monitoring, and
  corrective action.

Cartier client-advisor expectations and services emphasize discovery beyond a
product transaction: hobbies, family, values, occasions, home visits,
personalization, care/repair, private appointments, and hospitality.

PAON application:

- Relationship/household graph for partner, family, wedding party, assistant,
  and gift recipient, without collapsing them into one customer.
- Occasion and gift ledger with recipient, relationship, budget band, style,
  ring/shoe/clothing size, lead time, and privacy/visibility.
- Lifestyle hooks recorded as explicit advisor observations, with source,
  review date, sensitivity, and customer-visible/internal visibility.
- Care and service moments as selling opportunities: garment refresh,
  alterations, cleaning, repair, engraving, fit review, and wardrobe review.
- Local culture/event briefing for advisors, filtered by customer interests.

References:

- [Gucci Global Client Development role](https://www.kering.com/en/talent/job-offers/europe/gucci-global-client-development-coordinator/)
- [Gucci Client Advisor role](https://www.kering.com/en/talent/job-offers/northern-america/gucci-or-client-advisor-wooster/)
- [Cartier Client Advisor role](https://careers.richemont.com/en/jobs/jr129165/client-advisor/)
- [Cartier Mansion services](https://int.cartier.com/en/find-boutique/mansion-home/services/mansion-services.mobile.mobile.html)

### 6.5 Hospitality and private aviation

The useful lesson from high-end hospitality and aviation is not decorative
luxury. It is operational memory and anticipation.

NetJets publicly describes a dedicated service team that learns travel needs
and preferences, coordinates dining and ground transport, and maintains a
consistent experience across locations. VistaJet similarly emphasizes
detailed preference profiles and a consistent branded fleet.

PAON application:

- "Service preferences" separate from "style preferences": beverage, meeting
  formality, preferred fitting room, mobility/access needs, language,
  communication cadence, privacy, garment delivery/pickup, and whether the
  customer likes exploratory or decisive appointments.
- Pre-arrival brief that turns those facts into preparation tasks.
- Service recovery workflow when an order is late, a fit fails, or an
  appointment disappoints: owner, next action, promised resolution, deadline,
  follow-up, and outcome.
- "Never ask twice" indicators for confirmed durable preferences, while still
  showing date/source and allowing correction.
- Consistency across locations: the customer is known by the retailer, even
  when their normal advisor is absent.

References:

- [NetJets tailored service](https://www.netjets.com/en-gb/private-jet-service?go=dedicated-to-you)
- [VistaJet membership and preferences](https://www.vistajet.com/en-us/memberships/program22/)
- [Four Seasons service culture](https://www.fourseasons.com/about_four_seasons/service_culture/)

## 7. BIM Amsterdam: turning analogue training into software

[BIM Amsterdam](https://www.bimamsterdam.com/en) is led by trainers with
experience at Suitsupply and Atelier Munro. Eddy Beer is described as having
spent 18 years as Head of Global Training at Suitsupply. The site does not
publish proprietary course manuals, so PAON must distinguish observed public
content from extrapolation.

Publicly described practices:

- observe real shop-floor behavior;
- design a retailer-specific selling ceremony;
- train discovery, objection handling, upselling, cross-selling, storytelling,
  and roleplay;
- review shortly after training;
- establish a performance baseline;
- conduct recurring floor observation, individual feedback, management
  coaching, and KPI reviews;
- map onboarding, define a learning path, manager check-ins, brand standards,
  and success criteria;
- create store leadership action plans and accountability.

Digitized PAON equivalents:

| Analogue practice       | PAON implementation                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Floor observation       | Structured manager observation with ceremony stage, evidence, feedback, and follow-up  |
| Selling ceremony        | Versioned workflow/state graph with required outcomes and retailer-specific language   |
| Discovery training      | Contextual question cards selected by appointment/customer/product purpose             |
| Roleplay                | Scenario library, recorded or text roleplay, rubric, manager/AI draft feedback         |
| Objection handling      | Objection taxonomy, approved responses, outcome learning, product/price context        |
| Upsell/cross-sell       | Outfit/wardrobe-gap candidates grounded in inventory and customer evidence             |
| Seven-day review        | Automatic cohort review comparing baseline, behavior adoption, and commercial outcomes |
| Continuous coaching     | Monthly plans decomposed into weekly and daily behaviors                               |
| Manager accountability  | Coach queue, observed/overdue actions, completion quality, and outcome                 |
| Onboarding manual       | Role/location/brand-specific learning path with practical floor certifications         |
| Customer experience map | Instrumented journey with service failures and handoff gaps                            |

Important design rule: do not reduce selling quality to checkbox theater.
Advisors should complete a small number of meaningful outcomes, capture a
60-second closeout, and receive context-specific prompts. Managers should
review quality samples and results, not merely demand more fields.

Primary references:

- [BIM Art of Sales](https://www.bimamsterdam.com/en/services/art-of-sales-training)
- [BIM Continuous Coaching](https://www.bimamsterdam.com/en/services/continuous-coaching)
- [BIM Leadership Training](https://www.bimamsterdam.com/en/services/leadership-training)
- [BIM Co-Creation](https://www.bimamsterdam.com/en/services/co-creation)
- [BIM Onboarding](https://www.bimamsterdam.com/en/services/onboarding)
- [BIM team](https://www.bimamsterdam.com/en/about)

## 8. Consequences for PAON

### Build or integrate

PAON should be capable of becoming the system of record, but the sales and
migration strategy should not require every retailer to replace payments,
ecommerce, and POS on day one.

Offer three operating modes:

1. **Overlay:** PAON reads from Shopify/Lightspeed/Square/WooCommerce and owns
   clienteling, intelligence, training, appointments, tailoring, and customer
   experience.
2. **Co-system:** PAON owns selected canonical entities while another platform
   remains authoritative for payments or commerce.
3. **Full PAON:** PAON owns commerce, POS, inventory, clienteling, tailoring,
   customer environment, and marketplace integration.

This preserves the all-in-one destination while making initial adoption
credible.

### What PAON should not copy

Do not maintain pixel-for-pixel copies of Shopify, Endear, Tulip, or another
vendor. That would:

- bind PAON to competitors' incidental UI changes;
- create user confusion and potential brand/trade-dress problems;
- multiply QA and documentation;
- prevent PAON from improving the workflow.

Instead, build source-specific familiarity presets:

- familiar terminology and menu aliases;
- familiar status names and order;
- familiar default table columns and field sequence;
- familiar queue organization;
- familiar keyboard/scan behavior;
- automatic selection during migration;
- a visible option to graduate to the PAON-recommended workflow.

The data, permissions, automations, and audit model remain canonical.

## 9. Research caveats

- Vendor websites describe marketed capability, not independent proof of
  reliability, adoption, or every feature's production maturity.
- Public docs can omit contract-specific APIs and exports.
- Where a full export was not documented, the ledger says so rather than
  assuming data is trapped or portable.
- Product claims and availability can change. Connector implementation must
  validate actual credentials, scopes, sample payloads, pagination, rate
  limits, and deletion semantics against the retailer's tenant.
- This document does not claim that the described PAON target capabilities are
  implemented.
