# PAON Nebelspiegel Feature Traceability and Omission Ledger

**Ledger date:** 2026-07-30  
**Purpose:** account for the founder’s Nebelspiegel pages, supplied concept
files and follow-up instructions without silently dropping ideas or confusing a
target with shipped software.

## Sources covered

This ledger covers the concepts extracted from:

- `analytica8297948274.html`;
- `internal189273897.html`;
- `metier1.html`;
- `wardrobe1.html`;
- `campaigns1.html`;
- `matrix1.html`;
- `quantum.html`;
- `brand1038374.html`;
- `munroverse1.html`;
- `amam1.html`;
- `choreographedlayers1.html`;
- `expansion1.html`;
- `amhousemkii1.html`;
- `pag3.html`;
- `mtm837833.html`;
- the Capo “van Maas naar Museumplein” PDF;
- the supplied Moonstruck/wedding, Made-to-Munro and Munro Mark II concept
  files;
- the founder’s detailed 2026-07-30 instructions in this programme.

This is product traceability, not a claim that every sentence, name or visual
from the source is implemented.

## Legend

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `V`  | verified material software exists now                                      |
| `P`  | partial or implemented but not fully connected/verified                    |
| `Q`  | explicitly queued in PHASE Stages 10–16                                    |
| `A`  | added by this audit because the earlier canonical queue was too vague      |
| `B`  | local capability can be built, but live activation has an external blocker |
| `D`  | deliberately deferred to a later vertical/R&D programme                    |
| `X`  | deliberately excluded from PAON product software                           |

## 0. Core retailer platform and competitor-parity baseline

| ID      | Capability requested across the wider brief | Real connected implementation                                                   | Roles/surfaces              | Placement           | State |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ------------------- | ----- |
| CORE-01 | Branded website/storefront                  | tenant-branded responsive catalogue, content, discovery and account environment | public, customer, retailer  | existing foundation | `P`   |
| CORE-02 | Customer accounts                           | authenticated retailer relationship, scoped profile, consent and history        | customer, advisor           | existing foundation | `V`   |
| CORE-03 | Ecommerce catalogue/search/cart/order       | canonical products, availability, cart/order lifecycle and fulfilment           | customer, employee          | existing/13.1/13.3  | `P`   |
| CORE-04 | Multi-mode POS                              | RTW, MTM and services with returns, exchanges and provider references           | employee, manager           | 13.3                | `Q`   |
| CORE-05 | Purchase/order history                      | real orders and lines joined to customer, wardrobe, fit and campaigns           | customer, advisor           | existing/10.2/13.3  | `P`   |
| CORE-06 | Profiles/preferences/sizes/birthdays        | typed facts with provenance, correction, visibility and recurrence              | customer, advisor           | Stage 7/10.4/14.2   | `P`   |
| CORE-07 | Segmentation/RFM                            | versioned cited audience rules and customer-level reason                        | manager, advisor            | existing/10.1/14.2  | `P`   |
| CORE-08 | Loyalty/store credit                        | posted milestone/reward entries, liability and reversal boundaries              | customer, manager           | existing/15.2       | `P`   |
| CORE-09 | Appointments and branch calendar            | linked customer cards, resources, preparation and closeout                      | customer, employee, manager | existing/11.2       | `P`   |
| CORE-10 | Multi-location roles and tenancy            | retailer/branch/role permissions and tested RLS                                 | all                         | existing/8.0        | `V`   |
| CORE-11 | Analytics and owner reporting               | source/window/sample-aware operational and customer outcomes                    | manager, owner              | Stage 7/14.2        | `P`   |
| CORE-12 | Remote selling and shareable carts          | messages, looks, proposal, quote/cart and outcome                               | customer, advisor           | 10.3/13.3           | `Q`   |
| CORE-13 | Data portability/import/export              | immutable staged ingest, mapping, canonical write-through and reconciliation    | operator, manager           | reopened 9.1/9.2    | `P`   |
| CORE-14 | Configurable familiar workflows             | one canonical model with source-familiar labels/groupings/defaults              | employee, manager           | 8.3                 | `V`   |

## 1. Customer relationship, Self-Portrait and intelligence

| ID     | Capability from the sources                           | Real connected implementation                                                                  | Roles/surfaces                | Placement                   | State |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------- | ----- |
| REL-01 | Customer 360/Self-Portrait                            | canonical relationship, fact provenance, timeline, correction and source authority             | customer, advisor, manager    | shipped foundations/Stage 7 | `V`   |
| REL-02 | First-party browsing and engagement                   | PAON page/product/search/favourite/tool events with session/time/device context                | customer, advisor analytics   | Stage 7/14.2                | `P`   |
| REL-03 | Advisor proactive fact tagging                        | structured proposed facts, source, confidence, confirmation and correction                     | advisor, customer             | Stage 7/11.2                | `P`   |
| REL-04 | Starter data-tagging rectangles                       | versioned question sets, image/choice answers and fact candidates                              | customer, advisor             | 8.3/14.2                    | `Q`   |
| REL-05 | Deep product metadata conclusions                     | accepted product tags joined to observed interactions with evidence counts                     | advisor, For You              | Stage 7/14.2                | `P`   |
| REL-06 | “Opened ten suits; eight brown”                       | windowed event aggregation with sample, denominator and reason code                            | advisor, customer explanation | 14.2                        | `Q`   |
| REL-07 | Profession, lifestyle and annual-event facts          | declared/confirmed dated facts, provenance, retention and correction                           | customer, advisor             | Stage 7/14.2                | `P`   |
| REL-08 | Bonus/promotion/purchase-cycle hooks                  | explicit or confirmed event facts produce eligible moments; inference remains labelled         | advisor Today                 | 14.2                        | `Q`   |
| REL-09 | Wedding/anniversary/birthday dates                    | relationship moment with recurrence, visibility and suppression                                | customer, advisor             | 10.1/10.2                   | `Q`   |
| REL-10 | Login hotspot by hour/day/week/month/year             | timezone-aware aggregated activity with sample and source window                               | manager, advisor              | Stage 7/14.2                | `P`   |
| REL-11 | Interest progression                                  | cited transition from browsing to favourite to appointment/order                               | advisor, manager              | 14.2                        | `Q`   |
| REL-12 | Complete-look/wardrobe-gap hook                       | wardrobe/catalogue joins, availability and reason codes                                        | customer, advisor             | 10.2/14.2                   | `Q`   |
| REL-13 | Churn, burnout and store risk                         | explainable projector over real evidence, not a black-box score                                | manager/owner                 | 14.2                        | `Q`   |
| REL-14 | Product/store conversion and demand forecast          | cited operational analytics with inventory/lead-time truth                                     | manager/owner                 | 14.2                        | `Q`   |
| REL-15 | “Who should I contact, why now, what say?”            | ranked opportunity, draft, pressure/suppression and outcome                                    | advisor Today                 | Stage 7                     | `V`   |
| REL-16 | Voice/photo/video notes to preferences/tasks/messages | media asset, transcription/extraction candidates, human confirmation and task/message creation | advisor                       | 10.3                        | `Q`   |
| REL-17 | Honest live/recent presence                           | heartbeat/TTL, last activity, current PAON surface and no off-site claims                      | manager/advisor               | Stage 7                     | `V`   |
| REL-18 | Customer data quality discipline                      | missing/conflicting/stale fact prompts, owner metrics and confirmed closeout                   | advisor, manager              | 11.2/14.2                   | `Q`   |
| REL-19 | Weather/context prompts                               | customer location/timezone permission plus weather event and wardrobe join                     | customer, advisor             | 10.2/14.2                   | `Q`   |
| REL-20 | Customer feedback/voice of client                     | structured request, satisfaction/fit/service outcome and recovery task                         | customer, advisor, manager    | 12.3/14.2                   | `A`   |

## 2. Digital wardrobe, For You and guided commerce

| ID     | Capability from the sources                                                 | Real connected implementation                                                             | Roles/surfaces    | Placement               | State |
| ------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- | ----------------------- | ----- |
| WRD-01 | Six stacked carousels: suits, jackets, shirts, knitwear, shoes, accessories | real wardrobe records rendered as six permanent visual rails                              | customer          | 8.1                     | `V`   |
| WRD-02 | Customer-added garment                                                      | image/manual intake creates pending garment with provenance                               | customer          | 8.1/12.3                | `P`   |
| WRD-03 | Advisor suggestion                                                          | suggestion remains separate until accepted/purchased                                      | customer, advisor | 10.2                    | `Q`   |
| WRD-04 | Order-fed wardrobe                                                          | fulfilled order creates confirmed owned garment and links order line                      | customer, advisor | 10.2/13.3               | `Q`   |
| WRD-05 | Current vs ideal wardrobe roadmap                                           | category/occasion coverage, owned/suggested/planned separation                            | customer, advisor | 10.2                    | `Q`   |
| WRD-06 | Seven-Day Wardrobe                                                          | seven editable contexts, owned-first outfits, cited purchase/service gaps                 | customer, advisor | 10.2                    | `Q`   |
| WRD-07 | Outfit intelligence/Matchmaker                                              | deterministic compatible outfits with reason codes and feedback                           | customer, advisor | wardrobe programme/14.2 | `P`   |
| WRD-08 | Tie-Mate                                                                    | tie/shirt/jacket matching over metadata and real wardrobe/catalogue                       | customer, advisor | 10.2                    | `Q`   |
| WRD-09 | TableService/contextual one-tap looks                                       | occasion/weather/calendar-aware look card with stock and lead-time truth                  | customer          | 10.2/14.2               | `Q`   |
| WRD-10 | Wear/rotation/age intelligence                                              | wear log, last worn, service condition and rotation evidence                              | customer, advisor | 10.2/12.3               | `Q`   |
| WRD-11 | Favourite/Tinder-tool input                                                 | behavioural events affect explainable For You ranking                                     | customer          | Stage 7/10.2            | `P`   |
| WRD-12 | For You populated by preferences, advisor, metadata and favourites          | versioned ranker and reason codes; correction/feedback captured                           | customer          | Stage 7/10.2            | `P`   |
| WRD-13 | Guided design packages                                                      | versioned Essentialist/Specialist/Perfectionist/Creator option bundles map to valid specs | customer, advisor | 16.1                    | `Q`   |
| WRD-14 | Prevent configurator overload                                               | progressive choices, coherent defaults and advisor escalation                             | customer, advisor | 16.1                    | `Q`   |
| WRD-15 | Autonomous repeat reorder                                                   | eligibility gate over fit, measurement version, stock/lead time and payment capability    | customer          | 12.1/13.3               | `B`   |
| WRD-16 | Weekly micro-capsules/unlockables                                           | truthful limited assortment campaign tied to catalogue availability                       | customer          | 10.1/10.2               | `Q`   |
| WRD-17 | Milestone/education badges                                                  | badges teach product/service concepts; no fake achievement or manipulative scarcity       | customer          | 10.2/16.1               | `Q`   |
| WRD-18 | Digital avatars/advanced virtual try-on                                     | garment/body representation, rendering validation and explicit uncertainty                | customer/advisor  | later R&D               | `D`   |
| WRD-19 | Calendar animation with garments fading into months                         | responsive wardrobe-roadmap visualization over real planned/owned events                  | customer, advisor | 10.2                    | `A`   |

## 3. Campaign, relationship calendar and remote selling

| ID     | Capability from the sources            | Real connected implementation                                                          | Roles/surfaces                    | Placement                | State |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- | ------------------------ | ----- |
| CMP-01 | Versioned PAON marketing asset library | immutable published version, retailer clone, mappings, preview, activation and outcome | PAON, retailer, advisor, customer | 10.1                     | `Q`   |
| CMP-02 | Retailer one-toggle deployment         | prerequisite check, rehearsal, audience snapshot, schedule and explicit activation     | manager                           | 10.1                     | `Q`   |
| CMP-03 | Staff missions plus customer cards     | campaign creates shared Today mission and customer placement                           | advisor, customer                 | 10.1                     | `Q`   |
| CMP-04 | Seven-Day Wardrobe campaign            | executable version of WRD-06                                                           | customer, advisor                 | 10.2                     | `Q`   |
| CMP-05 | Honeymoon Phase                        | order-lifecycle programme, not a static campaign page                                  | customer, advisor, manager        | 10.2                     | `Q`   |
| CMP-06 | Valentine reservation rescue           | October planning and timed advisor/customer prompts; optional contracted concierge     | customer, advisor                 | 10.1/10.2/15.2           | `Q`   |
| CMP-07 | Romantic overcoat story                | approved asset package plus product/wardrobe mapping and outcome                       | customer, advisor                 | 10.1                     | `Q`   |
| CMP-08 | Mother’s/Father’s Day                  | family-date eligibility and gift/appointment campaign                                  | customer, advisor                 | 10.1                     | `Q`   |
| CMP-09 | Coming-of-age/Patek-inspired suit      | milestone campaign with education and appointment/proposal handoff                     | customer, advisor                 | 10.1                     | `Q`   |
| CMP-10 | Race Sunday                            | occasion/event package mapped to relevant products and local calendar                  | customer, advisor                 | 10.1                     | `Q`   |
| CMP-11 | Annual-event reminders                 | recurring event facts such as Amsterdam Dinner/Monaco show create timed actions        | customer, advisor                 | 10.1/14.2                | `Q`   |
| CMP-12 | Dating/single-again/post-break-up      | sensitive confirmed context, careful eligibility and human review                      | customer, advisor                 | 10.1                     | `Q`   |
| CMP-13 | Referral campaign                      | attributable invitation, suppression, outcome and reward rules                         | customer, advisor, manager        | 10.1/15.2                | `Q`   |
| CMP-14 | Client events                          | guest list, invitations, RSVP, appointments and attributed outcomes                    | customer, advisor, manager        | 10.1                     | `Q`   |
| CMP-15 | MorningRoutine                         | weather/calendar/relationship/product cards with reason and dismiss/correct            | customer                          | existing foundation/10.2 | `P`   |
| CMP-16 | Remote looks/proposals/shareable carts | versioned look, quote/cart handoff, messaging and response/outcome                     | customer, advisor                 | 10.3/13.3                | `Q`   |
| CMP-17 | One-click buy/pay at delivery          | cart/provider/eligibility/collection state; no custom credit fiction                   | customer, advisor                 | 13.3                     | `B`   |
| CMP-18 | Channel messaging                      | consent-aware threads, delivery/retry/opt-out and linked outcome                       | customer, advisor                 | 10.3                     | `Q`   |
| CMP-19 | Experiment and pressure control        | holdouts where appropriate, frequency caps, suppression and correction                 | manager                           | 10.1                     | `Q`   |
| CMP-20 | Campaign performance                   | exposure/action/appointment/order attribution with honest causal language              | manager/owner                     | 10.1/14.2                | `Q`   |

## 4. Honeymoon Phase detail

| ID     | Capability from the source            | Required implementation                                           | Placement | State |
| ------ | ------------------------------------- | ----------------------------------------------------------------- | --------- | ----- |
| HNY-01 | Use 3–4 week order-to-delivery period | pinned programme starts from authoritative order event            | 10.2      | `Q`   |
| HNY-02 | Order/production tracker              | honest milestone range, source timestamp and exception            | 10.2/12.2 | `Q`   |
| HNY-03 | Collection appointment                | branch calendar slot, attendee and preparation tasks              | 10.2      | `Q`   |
| HNY-04 | Pre-appointment preparation           | Today mission, wardrobe/fit/product context and checklist         | 10.2/11.2 | `Q`   |
| HNY-05 | Social/ceremonial pickup              | configurable event/service package, guest/refreshment notes       | 10.2      | `Q`   |
| HNY-06 | “Uber Eats” add-ons                   | available, compatible product/service offers with accept/decline  | 10.2/13.3 | `Q`   |
| HNY-07 | Buy now/pay on collection             | explicit checkout/payment eligibility and provider reference      | 13.3      | `B`   |
| HNY-08 | Weekly capsules/unlocks               | versioned placements tied to real catalogue/stock                 | 10.1/10.2 | `Q`   |
| HNY-09 | Badges/education                      | truthful milestone/product knowledge badges                       | 10.2/16.1 | `Q`   |
| HNY-10 | Delivery to wardrobe                  | fulfilled lines create owned items                                | 10.2/13.3 | `Q`   |
| HNY-11 | Fit and aftercare                     | customer outcome, advisor review, service action and fit learning | 12.1/12.3 | `Q`   |
| HNY-12 | Manager results                       | exceptions, contact pressure, conversion and service outcomes     | 10.2/14.2 | `Q`   |

## 5. Workforce Mission Control, training and culture

| ID     | Capability from the sources                        | Real connected implementation                                                            | Roles/surfaces             | Placement           | State |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------- | ----- |
| WFM-01 | Shared appointments calendar by branch             | real appointments, resources, timezone and role views                                    | customer, advisor, manager | existing/11.2       | `P`   |
| WFM-02 | Appointments are customer cards                    | appointment links canonical customer, Self-Portrait, wardrobe, prep and outcomes         | advisor                    | 11.2                | `Q`   |
| WFM-03 | Recurring events/follow-ups                        | rule/series with exceptions and customer moments                                         | advisor                    | 10.1/11.2           | `Q`   |
| WFM-04 | Employee Today                                     | one prioritized queue across customer, campaign, stock, service and learning work        | employee                   | 11.2                | `Q`   |
| WFM-05 | Daily briefing/missions                            | branch/context evidence, manager priorities and completion outcomes                      | employee, manager          | 11.2/16.1           | `Q`   |
| WFM-06 | Ten-minute closeout                                | appointment/day rectangles propose facts, follow-ups and issues                          | employee                   | 11.2                | `Q`   |
| WFM-07 | Extra-mile boasting/recognition                    | evidence-linked act, manager acknowledgment/coaching and profile history                 | employee, manager          | 11.2                | `Q`   |
| WFM-08 | I AM employee profile                              | skills, contribution, recognition, goals and approved evidence                           | employee, manager          | 11.2                | `Q`   |
| WFM-09 | Time, breaks, exceptions and approvals             | immutable entries/corrections/pay-period versions                                        | employee, manager          | 11.1                | `Q`   |
| WFM-10 | Accountant/payroll export                          | checksummed generic earning-code package, not payroll calculation                        | manager/accountant         | 11.1                | `Q`   |
| WFM-11 | Availability, swaps and coverage                   | branch skill/coverage rules and explainable recommendations                              | employee, manager          | 11.3                | `Q`   |
| WFM-12 | Selling ceremony and objection/cross-sell coaching | versioned ceremony, observation, rubric, plan and outcome                                | employee, manager          | 11.3/16.1           | `Q`   |
| WFM-13 | MunroMentor AI roleplay                            | grounded scenario, rubric, cited feedback and manager view                               | employee, manager          | 16.1                | `Q`   |
| WFM-14 | Made-to-Munro/Mastery academy                      | tracks, lessons, certification, contextual microlearning and expiry/version              | employee, manager          | 16.1                | `Q`   |
| WFM-15 | Employee-generated training contributions          | moderated submission, rights, review and publishing workflow                             | employee, PAON             | 16.1                | `A`   |
| WFM-16 | Cross-location video learning                      | scheduled session/resource/link and attendance evidence, not custom video infrastructure | employee, manager          | 16.1                | `A`   |
| WFM-17 | Discretionary service budget                       | manager policy, employee request/use, approval and ledgered expense outcome              | employee, manager          | 11.2/13.3           | `A`   |
| WFM-18 | Internal/HQ social communication                   | announcements, branch discussions, onboarding and searchable knowledge                   | employee, manager          | 11.4 audit addition | `A`   |
| WFM-19 | Wellbeing/support links                            | permissioned resource directory and confidential external handoff; no diagnosis          | employee                   | 11.4 audit addition | `A`   |
| WFM-20 | No invasive worker surveillance                    | outcome/task/time evidence only; no keystroke/screenshot accusation system               | all workforce              | invariant           | `X`   |

## 6. MTM, fit, atelier and supplier operations

| ID     | Capability from the sources                           | Real connected implementation                                                                                     | Roles/surfaces             | Placement           | State |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------- | ----- |
| MTM-01 | Versioned measurements/specs                          | immutable approved versions and explicit post-cut changes                                                         | advisor, workroom          | 12.2                | `Q`   |
| MTM-02 | MeasurementMonitor                                    | private capture, quality evidence, candidate and advisor decision gate                                            | customer, advisor          | 12.1                | `Q`   |
| MTM-03 | FitProfile learning                                   | delivered garment, alteration and satisfaction outcomes propose future candidate                                  | customer, advisor          | 12.1                | `Q`   |
| MTM-04 | Work tickets/tech packs/BOM                           | versioned production instructions tied to order/spec/pieces                                                       | advisor, workroom          | 12.2                | `Q`   |
| MTM-05 | Jacket/trouser/piece serialization                    | barcode/QR identity and independent stages/custody                                                                | workroom, advisor          | 12.2                | `Q`   |
| MTM-06 | Production stages/delays/rework                       | enforced transitions, SLA exception and service recovery                                                          | workroom, advisor, manager | 12.2                | `Q`   |
| MTM-07 | Materials/trims                                       | material lots, allocations, consumption, shortage and reconciliation                                              | workroom, manager          | 12.2                | `Q`   |
| MTM-08 | Outworkers/worker payouts                             | work assignment, piece/hour evidence, approval and accounting export                                              | workroom, manager          | 12.2/11.1           | `Q`   |
| MTM-09 | Factory system coexistence                            | external authority, read-only ingest, deep link and no fake write-back                                            | advisor, manager           | 8.2/9.2/12.2        | `P`   |
| MTM-10 | Supplier/PDM/PLM data                                 | versioned supplier catalogue/spec/availability mappings and authority                                             | workroom, purchasing       | 12.4 audit addition | `A`   |
| MTM-11 | Outstanding-order proactive issues (“MinorityReport”) | deterministic exception rules first, cited forecast later                                                         | manager, advisor           | 12.4/14.2           | `A`   |
| MTM-12 | Fabricopedia                                          | approved fabric metadata, history, care and teaching content                                                      | customer, employee         | 16.1                | `Q`   |
| MTM-13 | Fabric/button/trim pairings                           | accepted compatibility rules and top suggestions, not invented combinations                                       | customer, advisor          | 16.1/12.2           | `A`   |
| MTM-14 | Scan every order element/bulk verification            | barcode/QR piece/material/order reconciliation and batch exception report                                         | workroom                   | 12.2/13.1           | `Q`   |
| MTM-15 | Complaint/support resolution                          | case, evidence, supplier/workroom/customer actions and outcome                                                    | advisor, manager, partner  | 12.2/12.4           | `A`   |
| MTM-16 | Exact photo/structured-light body measurement         | separate validated capture R&D; never implied accurate before validation                                          | customer, advisor          | later R&D           | `D`   |
| MTM-17 | Ex Machina/MunroMegatron operations agents            | workflow-triggered drafts, cited exception ranking and proposed actions with approval at customer/fit/money gates | employee, manager          | 12.4/14.2           | `A`   |

## 7. Inventory, barcode, RFID, POS and loss prevention

| ID     | Capability from the sources        | Real connected implementation                                          | Roles/surfaces    | Placement | State |
| ------ | ---------------------------------- | ---------------------------------------------------------------------- | ----------------- | --------- | ----- |
| INV-01 | One stock truth                    | append-only movement/reservation ledger and derived balances           | manager, employee | 13.1      | `Q`   |
| INV-02 | Barcode receiving/transfers/counts | scan mode, expected vs observed, reconcile and reversal                | employee, manager | 13.1      | `Q`   |
| INV-03 | Serialized garment custody         | asset/piece identity across store, customer and service partner        | employee, partner | 12.2/12.3 | `Q`   |
| INV-04 | Blind counts and approvals         | separation of duties, variance reason and recount                      | employee, manager | 13.1/13.2 | `Q`   |
| INV-05 | Fraud/loss prevention              | explainable exceptions and independent approvals, not accusation score | manager/owner     | 13.2      | `Q`   |
| INV-06 | RFID/EPC                           | deduplicated reader observations reconciled to ledger                  | employee, manager | 13.2      | `B`   |
| INV-07 | Mixed RTW/MTM/service cart         | one quote/cart with correct fulfilment and accounting boundaries       | advisor, customer | 13.3      | `Q`   |
| INV-08 | Returns/exchanges                  | stock and financial reversals with preserved history                   | advisor, manager  | 13.3      | `Q`   |
| INV-09 | Fraud-safe discounts/adjustments   | permission thresholds, reason and approval trail                       | employee, manager | 13.2/13.3 | `Q`   |

## 8. Preferred Tailoring, HighMaintenance and service partners

| ID     | Capability from the sources                        | Real connected implementation                                          | Roles/surfaces             | Placement | State |
| ------ | -------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- | --------- | ----- |
| SRV-01 | Multiple cleaners/alteration partners per location | partner directory, capabilities, SLA, territory and commercial terms   | manager                    | 12.3      | `Q`   |
| SRV-02 | Customer booking from wardrobe                     | selected garment, issue, quote/authorization and slot/pickup           | customer, advisor          | 12.3      | `Q`   |
| SRV-03 | Pickup/return planning                             | route/slot plus serialized custody handoffs                            | customer, partner, advisor | 12.3      | `Q`   |
| SRV-04 | Partner work portal                                | minimum identity, work instruction, state, exception and QC            | partner                    | 12.3      | `Q`   |
| SRV-05 | Cost/invoice/customer charge                       | partner invoice, retailer cost, tax/account mapping and reconciliation | manager                    | 12.3      | `Q`   |
| SRV-06 | Store credit deduction                             | posted reward/credit ledger only after explicit liability design       | customer, manager          | 15.2      | `B`   |
| SRV-07 | Service plans/membership                           | versioned entitlement, usage, renewal and exception                    | customer, manager          | 12.3/15.2 | `A`   |
| SRV-08 | Preferred Tailoring calendar visualization         | month/season garment-service plan over real bookings                   | customer, advisor          | 12.3      | `A`   |

## 9. Corporate fashion/PAON Métier

| ID     | Capability from the sources                              | Real connected implementation                                                         | Roles/surfaces             | Placement | State |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------- | --------- | ----- |
| COR-01 | Tender workspace/demo advantage                          | requirement matrix, proposed programme, evidence and demo fixture                     | retailer, prospect         | 14.1      | `Q`   |
| COR-02 | Corporate account/programme                              | employer, contracts, locations, contacts and scoped access                            | retailer, employer         | 14.1      | `Q`   |
| COR-03 | Role catalogue and entitlements                          | versioned FTE/part-time/role garment quantities and rules                             | employer, retailer         | 14.1      | `Q`   |
| COR-04 | Individual exceptions                                    | approved size, preference, accommodation and allocation exception                     | wearer, manager            | 14.1      | `Q`   |
| COR-05 | Bulk employee onboarding                                 | import/invite, progress and reminders                                                 | employer, retailer         | 14.1      | `Q`   |
| COR-06 | Employee self-service data                               | contact, usual size and appointment information with scoped privacy                   | wearer                     | 14.1      | `Q`   |
| COR-07 | Measurement/fitting schedule                             | branch/team session capacity and wearer appointments                                  | wearer, advisor, employer  | 14.1      | `Q`   |
| COR-08 | Virtual Design Room/project presentation                 | approved uniform looks, role variants and rollout information                         | wearer, employer           | 14.1      | `Q`   |
| COR-09 | Order/delivery tracker                                   | wearer and programme-level honest status/exceptions                                   | wearer, employer, retailer | 14.1      | `Q`   |
| COR-10 | Care/replacement/repair                                  | entitlement, reason, approval, service and issue lifecycle                            | wearer, employer           | 14.1      | `Q`   |
| COR-11 | Leaver/transfer                                          | recover/reallocate/write-off serialized assets and change role allocation             | employer, retailer         | 14.1      | `Q`   |
| COR-12 | Readiness dashboard                                      | complete/missing/late/exception by location/role without exposing private retail data | employer, retailer         | 14.1      | `Q`   |
| COR-13 | PO/invoice/reporting                                     | customer PO references, allocations, batch billing and reconciliation                 | employer, retailer         | 14.1      | `Q`   |
| COR-14 | Wear/recycling lifecycle                                 | service/replacement/end-of-life and sustainability evidence                           | wearer, employer           | 14.1      | `Q`   |
| COR-15 | Corporate manager replacing employee’s broader HR system | not needed; integrate/import only required roster/role state                          | employer                   | non-goal  | `X`   |

## 10. Lifestyle network, MunroMarché, rewards and media

Canonical design authority for this family:
`docs/vision/PAON_LIFESTYLE_ECOSYSTEM_AND_NETWORK_COMMERCE.md`. Rows below are
**queued target design** (`Q`/`B`/`X`); none claim Stage 15 software is shipped.

| ID     | Capability from the sources                                                                               | Real connected implementation                                                                                   | Roles/surfaces                                 | Placement   | State |
| ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------- | ----- |
| NET-01 | Capolavoro Online/MunroMarché                                                                             | approved lifestyle partner listings curated by retailer                                                         | customer, manager, partner                     | 15.1        | `Q`   |
| NET-02 | Zero-stock books/art/design/hospitality/restaurants/travel/auto/golf/jewelry/grooming/culture/experiences | external fulfilment/referral/booking with disclosure, attribution and status                                    | customer, retailer, partner, fulfiller         | 15.1        | `Q`   |
| NET-03 | Retailer one-toggle curation                                                                              | retailer maps placement/audience and activates contracted programme                                             | manager                                        | 15.1        | `Q`   |
| NET-04 | Fine-grained audience relevance                                                                           | eligibility executed inside PAON; partner receives token, not raw profile                                       | customer, partner                              | 15.1        | `Q`   |
| NET-05 | Affiliate/referral/lead/booking/supplier-fulfilled economics                                              | attribution, confirmation, hold, reversal and multi-party reporting                                             | retailer, partner, PAON, fulfiller             | 15.1        | `Q`   |
| NET-06 | Local retailer partnerships                                                                               | partner programme for golf, hotel, car, jewelry, restaurant and events                                          | manager, customer                              | 15.1        | `Q`   |
| NET-07 | Lifestyle concierge                                                                                       | request, supplier options, booking state, exception and outcome                                                 | customer, advisor, partner                     | 15.2        | `Q`   |
| NET-08 | Valentine reservation/roses/chauffeur                                                                     | a configured concierge package over NET-07                                                                      | customer, advisor                              | 15.2        | `Q`   |
| NET-09 | MunroMiles/MunroMiglia rewards                                                                            | explicit funded/pending/available/reversed liability ledger                                                     | customer, manager                              | 15.2        | `B`   |
| NET-10 | Cross-partner earning/redemption                                                                          | commercial, accounting and provider design before activation                                                    | customer, partner                              | 15.2        | `B`   |
| NET-11 | Media/lifestyle feed                                                                                      | rights-aware approved feed/article, territory and expiry                                                        | customer, manager, publisher                   | 16.2        | `Q`   |
| NET-12 | MunroMentions                                                                                             | invitation + shoppable editorial mention; invitee creates own identity; product/partner attribution             | customer                                       | 15.1/16.2   | `Q`   |
| NET-13 | Retailer daily-return habit                                                                               | MorningRoutine/media/service/campaign relevance, measured honestly                                              | customer, manager                              | 10.2/16.2   | `Q`   |
| NET-14 | Shared ad/network revenue                                                                                 | contracted placement and ledgered multi-party attribution, no fabricated reach                                  | retailer, PAON, partner, publisher, advertiser | 15.1/16.2   | `B`   |
| NET-15 | Sell/export named customer profiles                                                                       | deliberately rejected; monetization uses audience execution/opaque attribution                                  | none                                           | non-goal    | `X`   |
| NET-16 | Third-party publisher/media cards                                                                         | rights, attribution, outbound links, disclosure class, retailer activation eligibility, recall                  | publisher, PAON, manager, customer             | 15.1/16.2   | `A`   |
| NET-17 | Multi-portal network operations                                                                           | distinct retailer/partner/publisher/advertiser/fulfiller/PAON portals with minimum-data scopes                  | all network roles                              | 15.1–15.3   | `A`   |
| NET-18 | Audience Studio, versioned cohorts, forecasting                                                           | cited eligibility, cohort version pin, policy-aware reachable-size forecast, holdouts                           | manager, PAON, advertiser (entitled)           | 15.1        | `A`   |
| NET-19 | Advertising inventory objects                                                                             | placements, orders, line items, flights, creatives, budgets, pacing, frequency caps                             | advertiser, PAON, retailer                     | 15.1        | `A`   |
| NET-20 | Ad/network commercial models                                                                              | CPM, CPC, CPL, CPA, affiliate, sponsorship, booking fee as first-class programme economics                      | advertiser, partner, retailer, PAON            | 15.1        | `A`   |
| NET-21 | Billable and outcome event stream                                                                         | impression, viewability, click, lead, booking, conversion, refund, reversal — append-only and idempotent        | system, partner, advertiser, PAON              | 15.1        | `A`   |
| NET-22 | Attribution, incrementality, dedupe, fraud review                                                         | opaque attribution IDs, experiment/holdout, dedupe keys, hold/reverse payable without erasing history           | PAON, advertiser, partner                      | 15.1        | `A`   |
| NET-23 | Multi-party revenue-sharing ledgers                                                                       | retailer/publisher/partner/PAON shares as canonical ledger entries, not feature-local balances                  | retailer, publisher, partner, PAON             | 15.1/15.2   | `A`   |
| NET-24 | Aggregate insights and retailer benchmarking                                                              | thresholded, peer-anonymous aggregates under contract                                                           | manager, PAON                                  | 15.1/14.2   | `A`   |
| NET-25 | PAON-executed audiences and pseudonymous attribution                                                      | partner receives tokens/placements/outcomes, not raw profiles                                                   | partner, advertiser, PAON                      | 15.1        | `A`   |
| NET-26 | Clean-room matching and contracted data exchange                                                          | matched aggregates or explicit field sets with purpose, retention and entitlement                               | PAON, contracted counterparty                  | 15.1        | `A`   |
| NET-27 | Retailer exports and customer-requested named introductions                                               | retailer-owned export of own data; named handoff only on customer request with audit                            | retailer, customer, partner                    | 15.1        | `A`   |
| NET-28 | Provenance/purpose/entitlement/retention/correction/deletion/recompute                                    | every network fact/event carries governance fields; correction recomputes derived objects                       | all network roles                              | 15.1–15.2   | `A`   |
| NET-29 | Compounding network flywheel                                                                              | retailer → evidence → relevance → engagement → partner demand → revenue/rewards → network intelligence loop     | product architecture                           | 15.x design | `A`   |
| NET-30 | Strict lifestyle vs MunroMerchant separation                                                              | no shared catalogue/order/cart/customer tables between Capolavoro Online and B2B procurement                    | all                                            | invariant   | `Q`   |
| NET-31 | Policy/entitlement technical ceiling                                                                      | full commercial/event model representable; activation restricted by policy so later limits need no rebuild      | PAON platform                                  | 15.x design | `A`   |
| NET-32 | Commercial north star = governed high-intent access + measurable outcomes                                 | product and legal language forbid uncontrolled profile sale; measurable ledgered outcomes are the sellable unit | PAON, retailer, advertiser                     | invariant   | `A`   |

## 11. MunroMerchant and retailer operating services

| ID     | Capability from the sources                     | Real connected implementation                                                               | Roles/surfaces     | Placement      | State |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------ | -------------- | ----- |
| MKT-01 | Hangers, bags, packaging and mannequins         | supplier listings, tiers/MOQ, samples, custom proof and reorder                             | retailer, supplier | 15.3           | `Q`   |
| MKT-02 | Furniture, fixtures and cameras                 | RFQ, quote comparison, proof/spec and delivery project                                      | retailer, supplier | 15.3           | `Q`   |
| MKT-03 | Cleaning/accounting/payroll/service procurement | service RFQ/contract directory; operational integrations stay separate                      | retailer, supplier | 15.3           | `Q`   |
| MKT-04 | Group buying                                    | demand window, committed quantities, quote and allocation                                   | retailer, supplier | 15.3           | `Q`   |
| MKT-05 | Samples/customization/proofs                    | versioned artwork/spec approval and audit trail                                             | retailer, supplier | 15.3           | `Q`   |
| MKT-06 | PO/shipment/issues                              | retailer procurement order, supplier fulfilment and exception                               | retailer, supplier | 15.3           | `Q`   |
| MKT-07 | Consumer and B2B catalogue separation           | distinct bounded contexts and roles, with no customer/order contamination                   | all                | invariant/15.3 | `Q`   |
| MKT-08 | AMAM agency services                            | consultancy request, scope, project/milestones and deliverables; not a hidden manual module | retailer, PAON     | 16.1           | `A`   |

## 12. Consultancy, knowledge, media and physical retail experience

| ID     | Capability from the sources        | Real connected implementation                                                          | Roles/surfaces           | Placement                  | State |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------ | -------------------------- | ----- |
| KNW-01 | Consultancy article library        | approved/versioned owner articles that launch audits/templates/actions                 | manager/owner            | 16.1                       | `Q`   |
| KNW-02 | Fused/half/full/handmade education | customer content plus employee product knowledge and valid package mapping             | customer, employee       | 16.1                       | `Q`   |
| KNW-03 | Choreographed retail layers/zones  | store playbook, audit/checklist and improvement project                                | owner, manager           | 16.1                       | `Q`   |
| KNW-04 | Month-calendar animation           | reusable responsive component over roadmap/events, not a static animation              | customer, owner          | 10.2/16.1                  | `A`   |
| KNW-05 | Print/digital publication strategy | rights, edition/article workflow and measurable retailer activation                    | PAON, retailer, customer | 16.2                       | `Q`   |
| KNW-06 | Contributor network                | contracts/rights/review/approval and attribution                                       | PAON, contributor        | 16.2                       | `A`   |
| KNW-07 | Magazine cover/gala/events         | event/campaign package and media operations, not required for core SaaS                | PAON, customer           | later commercial programme | `D`   |
| KNW-08 | Instrumented selling zones         | zone definitions, appointment/sales events and privacy-safe observation adapters       | manager/owner            | 16.4 audit addition        | `A`   |
| KNW-09 | Smart mirrors/display experiences  | device session links customer/garment/looks with advisor handoff and no fake fit claim | customer, advisor        | 16.4 audit addition        | `A`   |
| KNW-10 | Physical product comparison        | guided half/full/handmade comparison session, learning and preference outcome          | customer, advisor        | 16.4 audit addition        | `A`   |
| KNW-11 | MunroMunchies/local hospitality    | optional store experience package, supplier/stock/task integration                     | customer, employee       | 16.4 audit addition        | `A`   |
| KNW-12 | Members club/private rooms/events  | membership/event/booking capability can reuse campaign/appointment primitives          | customer, manager        | later vertical/programme   | `D`   |

## 13. Wedding and occasionwear concepts

The earlier Stages 8–16 plan captured anniversaries and wedding campaigns, but
did **not** honestly capture the full Moonstruck wedding-platform concept.
This table makes that omission explicit.

| ID     | Capability from Moonstruck                     | Decision and technical shape                                                                                   | Placement                | State |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ | ----- |
| WED-01 | Wedding date and anniversary                   | confirmed relationship event, recurrence, visibility and campaign actions                                      | 10.1/14.2                | `Q`   |
| WED-02 | Wedding party/customer group                   | extend the existing party/member/RLS/invite aggregate with occasion relationships and garment responsibilities | existing/16.5            | `P`   |
| WED-03 | Group fitting scheduling                       | extend existing party date/location and fitting status with branch capacity, appointments and reminders        | existing/16.5            | `P`   |
| WED-04 | Best-men profiles/options                      | extend existing invited member, photo, height/weight and fitting state with approved style choices             | existing/16.5            | `P`   |
| WED-05 | Suit/fitting/delivery/pickup tracking          | join existing group readiness to real order/production/collection milestones                                   | existing/16.5            | `P`   |
| WED-06 | Dress/fabric/shade matching                    | image/reference asset, controlled-light caveat and advisor-confirmed compatibility                             | 16.5                     | `A`   |
| WED-07 | Inspiration/Pinterest/screenshot hub           | rights-aware uploads/links, boards and advisor comments                                                        | 16.5                     | `A`   |
| WED-08 | Guest dress-code board/vouchers                | approved looks, guest link, proposal/cart and outcome                                                          | 16.5                     | `A`   |
| WED-09 | Invitation/RSVP/dietary/song/video platform    | useful but a separate wedding-planning product, not needed for apparel clienteling                             | future wedding vertical  | `D`   |
| WED-10 | Venue/accommodation/weather/date selection     | external planning/partner integrations, not core retail OS                                                     | future wedding vertical  | `D`   |
| WED-11 | Vendor marketplace and service agreements/QHSE | separate two-sided marketplace and vendor governance programme                                                 | future wedding vertical  | `D`   |
| WED-12 | Insured milestone/escrow payments              | regulated provider product; PAON must not hold funds itself                                                    | future vertical/provider | `B`   |
| WED-13 | Invitation print/sample/mail fulfilment        | partner commerce/fulfilment if the wedding vertical is selected                                                | future wedding vertical  | `D`   |
| WED-14 | After-party/lost-and-found                     | operationally feasible but unrelated to PAON’s retail wedge                                                    | not current product      | `X`   |
| WED-15 | Wedding garment HighMaintenance                | service booking, custody, cleaning/preservation and anniversary return                                         | 12.3/16.5                | `A`   |
| WED-16 | Romantic anniversary concierge                 | recurring campaign plus contracted concierge                                                                   | 10.1/15.2                | `Q`   |
| WED-17 | Global wedding lead-generation platform        | a later business/vertical decision, not an implicit Stage 16 deliverable                                       | future vertical          | `D`   |

## 14. Future proprietary products and verticals

| ID     | Capability                                                    | Decision                                                                           | Placement | State |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | ----- |
| FUT-01 | White-label garment/messenger bags                            | demand/margin/supplier/quality hypothesis register before stock                    | 16.2      | `Q`   |
| FUT-02 | Personal-care products                                        | same gated incubation process                                                      | 16.2      | `Q`   |
| FUT-03 | Eyewear/accessories                                           | same gated incubation process                                                      | 16.2      | `Q`   |
| FUT-04 | Remnant/upcycled collection drops                             | material provenance, limited catalogue and campaign only after supply proof        | 16.2      | `A`   |
| FUT-05 | Munro Home/interiors                                          | potential future vertical/product line, not current SaaS core                      | future    | `D`   |
| FUT-06 | Womenswear/bridal/optical/jewelry/furniture/hospitality packs | canonical extension framework; one evidence-selected pilot only                    | 16.3      | `Q`   |
| FUT-07 | Atelier Munro-specific branding/IP replication                | PAON uses generic configurable concepts and lawful content; no brand impersonation | invariant | `X`   |

## 15. Explicitly not included and why

Nothing in this section is silently forgotten.

| Capability not included in the current build                                     | Decision | Reason                                                                                                                       |
| -------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Browsing history, tabs or activity outside PAON                                  | `X`      | An ordinary web app cannot access it; it is not needed for the stated PAON engagement loop                                   |
| Password import or payment credentials                                           | `X`      | Existing hashes/credentials are non-portable and importing them would be unsafe                                              |
| Silent AI customer identity merges                                               | `X`      | A wrong merge corrupts the retailer’s customer truth                                                                         |
| Sale/export of named customer profiles to advertisers                            | `X`      | It destroys the retailer trust proposition and is unnecessary for targeted placement/attribution                             |
| Keystroke, screenshot or accusatory employee surveillance                        | `X`      | It does not measure clienteling quality and creates perverse incentives                                                      |
| PAON calculating tax, filing payroll or paying salary itself                     | `X`      | PAON supplies approved time/accounting packages; specialist payroll remains authoritative                                    |
| PAON lending or holding wedding/reward/customer funds itself                     | `X`      | Requires regulated providers, explicit liability and accounting architecture                                                 |
| Full wedding RSVP/invitations/venue/lost-and-found platform in Stages 8–16       | `D/X`    | The apparel coordination subset strengthens PAON; the full planner is a separate vertical and would dilute current execution |
| Full HR system for corporate clients                                             | `X`      | PAON needs only scoped roster/role/entitlement state                                                                         |
| AMMA acquisitions, tax structuring and €1B corporate strategy as product modules | `X`      | These are founder/business strategy or professional services, not retailer software capabilities                             |
| Face-ID-equivalent measurement claim from a casual photo                         | `X`      | Technically unproven; the build is a reviewable decision gate                                                                |
| Direct RFID writes to stock quantity                                             | `X`      | Radio reads are observations and must reconcile to the ledger                                                                |
| Undocumented factory/Faden write-back                                            | `X`      | Creates corruption and false claims; use supported APIs, files or deep-link handoff                                          |
| Pixel-perfect clones/data-model forks of competitor UIs                          | `X`      | Familiar presets preserve onboarding familiarity without creating brittle separate products                                  |
| Publisher content copied without rights                                          | `X`      | Build the activation/rights infrastructure; content still needs permission                                                   |
| Speculative simultaneous launch into every luxury vertical                       | `D`      | The extension framework is included; one demand-proven vertical is selected first                                            |

## 16. What the earlier plan missed or described too vaguely

The following items were not sufficiently explicit before this audit and must
be added to PHASE rather than treated as implied:

1. customer feedback/service-recovery loop (`REL-20`);
2. real responsive wardrobe calendar visualization (`WRD-19`, `KNW-04`);
3. employee training contributions and cross-location learning (`WFM-15`,
   `WFM-16`);
4. discretionary service-budget workflow (`WFM-17`);
5. internal/HQ communication, onboarding and wellbeing resource handoff
   (`WFM-18`, `WFM-19`);
6. supplier/PDM/PLM mappings, proactive order exceptions and formal complaint
   resolution (`MTM-10`, `MTM-11`, `MTM-15`);
7. service-plan membership and customer voice (`SRV-07`);
8. contributor/media rights operations (`KNW-06`);
9. instrumented selling zones, smart displays, physical comparison and local
   hospitality packages (`KNW-08`–`KNW-11`);
10. the wedding-party apparel coordination vertical (`WED-02`–`WED-08`,
    `WED-15`);
11. remnant/upcycled product-drop incubation (`FUT-04`);
12. an AMAM consultancy project/deliverable workflow (`MKT-08`);
13. Capolavoro Online / MunroMarché full commercial and technical ceiling
    (`NET-16`–`NET-32`): publisher cards, multi-portal roles, Audience Studio,
    advertising inventory/economics/events, attribution integrity,
    multi-party revenue ledgers, clean-room/entitlement exchange, provenance
    plane, flywheel, lifestyle↔MunroMerchant separation, and the governed
    high-intent audience commercial north star — design captured in
    `PAON_LIFESTYLE_ECOSYSTEM_AND_NETWORK_COMMERCE.md` and PHASE Stage 15
    acceptance; **software not claimed implemented**.

The complete wedding-planning platform, M&A/corporate-finance strategy,
unrestricted ad-data sale and technically false measurement claims are
deliberately not smuggled into the core roadmap. Their decisions are recorded
above.

## 17. Traceability rule going forward

Every PHASE item must list the ledger IDs it implements. Every ledger row in
`Q` or `A` must resolve to a PHASE item or an explicit future gate. Every
completed PHASE item must point to:

- domain and persistence evidence;
- originating and receiving role surfaces;
- end-to-end browser journey;
- RLS/permission proof;
- exception/correction behavior;
- downstream handoff;
- external live gap, if any.

This ledger is what prevents a persuasive static rendering from being mistaken
for the operating capability the founder asked to build.
