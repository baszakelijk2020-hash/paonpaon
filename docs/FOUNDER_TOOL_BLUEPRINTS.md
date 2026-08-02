# Founder Tool Build Blueprints

**Status:** authoritative R0.3 implementation contracts for the fourteen
founder-designated tools. This is product specification, not a claim that the
tools are shipped and not an alternative work queue. `PHASE.md` remains the
only queue; code, migrations and tests remain the truth for what exists.

## How to use this document

Each `FT-*` contract fixes four things that must not drift between agents:

1. the experience that must be ported from the committed founder source;
2. the job that experience performs inside PAON;
3. the state, permissions and technical boundaries behind it; and
4. the evidence required before anyone calls it built.

For the designated interaction itself, `downloaded_pages/pag1.html`,
`pag2.html` and `pag3.html` are the visual and behavioural authority under
ADR-052/071. Preserve their composition, markup, CSS, motion and interaction
through a narrow typed adapter. Atelier Munro names, products, commercial
claims and surrounding pitch pages are not PAON requirements. Replace those
with tenant-owned PAON data without redesigning the tool.

The exact-source contract does not excuse unsafe behaviour. Accessibility
repairs and removal of embedded credentials are permitted when they remain
visually faithful. Unsupported measurement, supplier, payment, availability
or partner claims must be shown as unavailable or awaiting review, never
simulated.

### Founder control and change protocol

This file is the guardrail against a long build quietly becoming a different
product. Future agents may improve implementation, reliability and the
surrounding PAON system, but they may not silently narrow, genericise or
reinterpret an `FT-*` contract.

- **Fixed without a founder decision:** the designated source interaction,
  PAON job, connected ecosystem role and required completion proof. A cheaper
  generic UI, static demo or disconnected schema cannot satisfy the contract.
- **Engineering-owned within the contract:** internal decomposition,
  repository/RPC shape, performance, accessibility-preserving adaptations,
  safe fallback and the order of coherent implementation slices.
- **Must be explicit:** an unsupported external integration, legal/commercial
  policy, unvalidated measurement claim or missing source state is recorded as
  a named boundary. It is never silently mocked and never used to park the
  independent local workflow.
- **Change control:** altering a fixed element requires a dated ADR naming the
  exact old contract, proposed replacement, reason, affected tools/data and
  migration/recovery plan, plus an explicit founder decision. An agent's
  preference or implementation convenience is not a decision.
- **Status control:** `Current` describes only connected code proven at the
  browser/database boundary. Domain types, migrations, generic pages and
  confident prose are foundations—not completed tools. Failed or missing
  proof leaves the gap named here and in `PHASE.md`.
- **Scope control:** implement one active `FT-*` against this contract and its
  committed source fragment. Do not reopen the entire founder brief in routine
  turns, and do not infer that a later tool is cancelled because it is not the
  current slice.

### Product control plane

This section separates ambition, interpretation, implementation and proof so
that no handoff can silently turn one into another.

| Layer               | Authority                                             | What it may decide                                                                                     | What it may not do                                                                                           |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Founder destination | `NORTH_STAR.md` plus these `FT-*` contracts           | PAON's promise, platform breadth, designated tools, intended experience and connected outcome          | Claim that a current implementation already satisfies the destination                                        |
| Preserved source    | founder brief, linked instructions and committed HTML | Supply complete intent, exact designated interactions and traceability evidence                        | Act as a second queue, reinstate Atelier Munro's business model, or override later PAON curation by accident |
| Delivery control    | `PHASE.md` plus accepted ADRs                         | Sequence dependencies, define the active acceptance contract, gate risk and authorize a coherent slice | Delete destination scope because it is not next, or call a foundation the finished tool                      |
| Factual state       | code, migrations and executable proof                 | Establish what currently exists and works                                                              | Redefine founder intent merely because the current code chose a different abstraction                        |
| Handoff memory      | Resume Protocol and `PROJECT_STATE.md`                | State the exact restart point and verified facts compactly                                             | Introduce another roadmap, silently revise status, or become product authority                               |

If these layers disagree, continue safe independent work but freeze the
affected claim. Record the conflict in the active `FT-*` Current paragraph and
`PHASE.md`; resolve product meaning through an explicit founder decision and
ADR. Never resolve it by quietly editing the source contract, deleting scope,
or implementing the cheapest interpretation.

#### Decision rights

| Decision                                                                                                                                   | Owner                                                   | Required record                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Remove, materially narrow or replace a promised module, founder tool, interaction, actor journey or ecosystem outcome                      | Founder                                                 | Explicit decision plus dated ADR, affected `FT-*` contracts and migration/recovery impact           |
| Depart materially from a designated source's composition, motion, pacing or behaviour                                                      | Founder, informed by engineering/accessibility evidence | Before/after evidence and ADR; accessibility or security repairs must still preserve the experience |
| Activate cash, stored value, external payments, customer-data use, advertising, automated high-value advice or other legal/commercial risk | Founder after named operational/legal inputs            | Accepted policy ADR and activation checklist; local implementation alone cannot activate it         |
| Change module packaging, bundle names, tier pricing or a capability's eligible add-on model                                                | Founder/commercial owner                                | Versioned catalogue decision; no code fork                                                          |
| Choose schemas, RPC/repository boundaries, job technology, cache, internal API shape and safe decomposition                                | Engineering                                             | Relevant ADR only when load-bearing; tests and migration proof otherwise                            |
| Choose the order of coherent slices inside the active PHASE item                                                                           | Engineering                                             | Current acceptance/gaps updated after every committed slice                                         |
| Validate desirability or workflow fit                                                                                                      | Founder and named design partners                       | Observed evidence; feedback informs a decision but does not silently rewrite the contract           |

Questions that are merely implementation choices must not interrupt the build.
Questions whose answers would change a founder-owned row are real blockers for
that choice; the agent records them and continues another independent slice.

#### Mandatory slice contract

Before changing a founder tool, the active implementation context must be able
to answer all of the following from existing authorities. If one is absent,
add it to this blueprint or `PHASE.md` before writing product code:

1. **Identity:** one `FT-*` id and the exact source selector, region or
   interaction being implemented.
2. **Founder effect:** what the client or retailer should feel and accomplish;
   this prevents a technically equivalent but experientially wrong rewrite.
3. **PAON job:** why the tool exists in this platform rather than as a copied
   microsite.
4. **Entry and continuation:** originating role/surface and the receiving
   customer, advisor, operator or partner surface.
5. **Canonical objects:** which existing customer, garment, look, appointment,
   proposal, order, service or outcome records it reads and changes.
6. **Module contract:** owning module, dependencies, lifecycle behaviour and
   current commercial bundle/add-on eligibility.
7. **Authority and trust:** tenant, role, consent, provenance, retention,
   correction, external-system authority and human-review boundaries.
8. **State machine:** loading, empty, draft, success, denied, stale, conflict,
   failure, retry, correction/withdrawal and terminal outcome where applicable.
9. **Exactness boundary:** source details that are fixed, tenant data/copy that
   is substituted, and surrounding PAON-native surfaces that engineering may
   design.
10. **Proof:** originating action, authoritative write, receiving-role read,
    denied/cross-tenant path, recovery path, source-parity evidence and final
    outcome returned to House Memory.

The slice must name what it deliberately does **not** complete. Missing
provider access can block a provider claim; it cannot erase a buildable local
workflow. Conversely, a mocked provider response cannot satisfy live proof.

#### Completion dimensions

Every `FT-*` Current paragraph and `DESIGN_PORTS.md` status is judged across
the same seven dimensions. A tool is Verified only when all applicable rows
are proven together.

| Dimension            | Required evidence                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Experience           | Desktop and mobile source parity for composition, interaction, motion and reduced-motion/keyboard behaviour                                   |
| Function             | Every visible control performs its stated job; no decorative buttons, dead links or demo-only state                                           |
| Canonical continuity | The originating action writes canonical objects and the next role/stage consumes them without duplicate shadow records                        |
| Trust                | Module/role/RLS, consent, provenance, retention, correction and authority boundaries fail closed                                              |
| Recovery             | Empty, stale, conflict, partial failure, idempotent retry, cancellation/withdrawal and unavailable integration states are usable and truthful |
| Outcome              | A real appointment, proposal/order, fitting/service or other contract-specific result is linked and returned to House Memory                  |
| Operability          | Entitlements, jobs, audit/observability, support path, data migration/export and safe activation/deactivation exist at the required maturity  |

Allowed status words remain `Missing`, `Wrong`, `Shell`, `Functional
foundation`, `Faithful foundation`, `Connected first slice` and `Verified`.
Terms such as “done”, “complete” or “production-ready” are forbidden for a
tool unless the seven-dimension contract passes or an inapplicable dimension
is explicitly justified.

#### Anti-drift tripwires

The following observations automatically invalidate a completion claim and
must be repaired or recorded as a named gap:

- a visible founder control is inert, simulated, hard-coded or connected only
  on a different route than the user actually sees;
- a generic card/table/form replaces a designated source interaction;
- a second customer, garment, appointment, proposal, order or outcome model is
  created for convenience instead of extending the canonical aggregate;
- the originating role can submit but the receiving role cannot continue, or
  the result never returns to House Memory;
- a schema, repository, AI prompt, screenshot or happy-path test is used as
  proof of the complete tool;
- a missing credential, provider or commercial decision is used to suppress
  unrelated local functionality, or a fixture is presented as real provider
  support;
- the active queue becomes narrower by silently deleting later ambition, or
  broader by adding an uncontracted feature that bypasses dependency order;
- a status line omits a known gap, proof is pinned to an old SHA, or a handoff
  depends on chat memory rather than the authorities above.

At each `FT-*` transition and chapter boundary, compare the exact source,
`DESIGN_PORTS.md`, this blueprint, the implementation and its proof in that
order. This is a targeted control check, not permission to reread the entire
repository on every turn.

### Shared product and technical spine

Every retained tool attaches to the same connected graph rather than creating
its own customer, garment or order universe:

```text
retailer House + module entitlement
  -> customer relationship + consent + Self-Portrait evidence
  -> catalogue/product knowledge + owned/proposed wardrobe
  -> consultation/look/configuration/fit evidence
  -> appointment/proposal/order/physical garment
  -> production/fitting/custody/service/care outcome
  -> corrected evidence returned to House Memory and Advisor Today
```

- **Module lifecycle:** `preview` permits faithful read-only demonstration;
  only `active` permits writes and jobs. `off` and `suspended` reject direct
  reads and writes. Dependencies are enforced by the module kernel.
- **Commercial bundles:** Fused contains Platform Core + Relationship;
  Half Canvas adds Wardrobe + Commerce; Full Canvas adds Garment Service,
  Retail Operations, Enterprise and Network. A tool may also be sold as an
  auditable add-on. These are current bundles, not immutable pricing policy.
- **Mutations:** customer and staff browser writes use Server Actions backed by
  repositories/RPCs. Route Handlers are limited to scans, external callbacks,
  scheduled work and the existing founder-HTML bridge.
- **Evidence envelope:** interaction events carry retailer, customer/session,
  tool/version, subject, action, source, purpose, consent snapshot,
  occurred-at and idempotency key. A preference is evidence, not an eternal
  personality fact. Derived facts retain sources and can be corrected,
  withdrawn, expired and recomputed.
- **Tenancy:** every tenant object carries `retailer_id`; compound references
  and RLS prevent cross-House joins. Participant, recipient and partner views
  expose the minimum fields needed for their role.
- **Authority:** PAON state distinguishes `paon`, `external` and `co_managed`
  authority. An integration may prepare a handoff without pretending the
  external system accepted it.
- **Proof ladder:** source parity at mobile and desktop; keyboard/reduced-motion
  behaviour; module preview/off/suspended boundaries; role and RLS isolation;
  idempotent state transitions; failure/retry; and one connected customer +
  advisor + operational outcome in the canonical proof House.

## FT-01 — Voice + drag fit slider

**Source and experience.** `pag1.html`'s `vox-widget-root` is the authority:
voice overlay, microphone pulse, listening/transcript states, highlighted fit
rows, draggable numeric chips and spotlight progression. The later fitting
section is the surrounding narrative. Preserve direct drag and tap controls;
voice is an additional input, never the only accessible path. States are
`idle -> listening -> transcript review -> values changed -> submitted`, with
permission-denied, no-speech, low-confidence and manual-fallback states.

**PAON job.** Turn a fitting conversation into reviewable evidence quickly,
without turning speech or a slider into an approved measurement. It connects
a customer and physical garment/fitting session to a proposed FitProfile
candidate and, when needed, an alteration work order. The advisor can compare
the proposal with the previous approved fit and explain each change.

**Actors, module and tier.** Customer may supply observations in an invited
session; sales/production staff capture and review; workshop staff see only
approved work instructions; manager audits overrides. Requires Wardrobe &
Styling plus Garment & Service Operations—normally Full Canvas or an explicit
add-on—and Relationship for the customer context.

**State and wiring.** Reuse `fitting_sessions`, `fitting_observations`, physical
garments, measurement/FitProfile candidate versions, alteration cases/work
orders and custody history. The adapter emits per-field original value,
proposed value, capture mode, transcript span/confidence and recorder. A
Server Action validates module/role/session and records evidence atomically;
separate approval creates the candidate/work. Supplier write-back is an
outbox handoff only when a configured authority supports it.

**Trust, recovery and proof.** Microphone permission and transcript retention
are explicit; raw audio is not retained by default. Corrections append rather
than erase. Network loss preserves an encrypted local draft and idempotency
key; duplicate submit cannot duplicate observations/work. Prove exact pointer,
touch, keyboard and voice-fallback behaviour, candidate-not-approval semantics,
staff/customer isolation and an approved alteration outcome returning to House
Memory. **Current:** faithful widget foundation; connected journey incomplete.

## FT-02 — Silhouette analysis

**Source and experience.** Port the `nbs-silhouette-widget-a91k` Level 1
scroll/snap carousel from `pag1.html`: video/image cards, centred active-card
scale, adjacent context and progressive explanation. Remove the current
invented Tailwind silhouettes. The source's progression is Level 1 visual
classification, then individual analysis and prediction; PAON must label the
first two latter steps as unavailable until validated rather than fabricate
precision. Provide manual selection and reduced-motion alternatives.

**PAON job.** Give an advisor and customer a shared visual vocabulary for how
a garment may balance on a body and which fitting areas deserve inspection.
It narrows a consultation; it does not diagnose a body, derive exact
measurements or automatically alter a production specification.

**Actors, module and tier.** Customer participates and can reject/delete the
capture; trained advisor reviews; production staff receive only approved fit
consequences. Wardrobe & Styling is the host; Garment Service is required if a
candidate continues to fitting work. Half Canvas can provide consultation;
operational continuation requires Full Canvas/add-on.

**State and wiring.** Planned analysis session states are `consented,
capturing, candidate, advisor_reviewed, customer_confirmed, rejected,
expired`. Store the private media asset separately from the structured
candidate, model/rule version, confidence/limitations and human decision.
Connect confirmed evidence to `customer_style_profiles` and fitting candidate
records, never directly to approved measurements. Capture/upload is a Server
Action through a private bucket; any future processor is an asynchronous,
versioned adapter with deletion propagation.

**Trust, recovery and proof.** No covert camera start, face identity inference,
sensitive attribute inference or indefinite raw-image retention. A processing
failure falls back to the faithful manual carousel. Prove consent withdrawal,
asset isolation, expiry/deletion, human rejection, no approved-fit mutation
and source-parity motion on narrow/wide layouts. **Current:** first
connected slice (2026-08-02), replacing the wrong generic carousel.
`pag1.html`'s `#nbs-silhouette-widget-a91k` was checked directly and
confirmed present: five video-backed silhouette panels (S1–S5) in an
auto-advancing (dwell-timer), touch/mouse-pausable snap carousel, plus two
"anticipated FitTools" rule columns whose glow-toggle squares highlight a
different subset per active panel. CSS, markup, video sources, panel
codes/titles and the rule-highlight mapping are byte-for-byte from source;
`apps/retailer/components/fit-tools/silhouette-widget.tsx` replaces the
invented Dutch-language SVG carousel. A PAON-added "Select" button — the
source has none — records the active panel as a fit-tool observation
through the existing `recordFitToolObservation` path, unchanged from the
prior implementation's contract. This is Level 1 visual classification
only; individual analysis and prediction (Level 2/3) remain unbuilt and are
not claimed. No consent/capture/session state machine exists yet — this
tool has no camera capture at all, only the visual carousel — so the
`consented/capturing/candidate/...` states, private-media-asset isolation,
advisor review and connected-journey proof described above all remain
outstanding.

## FT-03 — QR try-on and fabric-batch concept order

**Source and experience.** Reproduce `pag1.html`'s QR attached to each Try-On
and its concept/fabric-batch continuation: visible scan target, successful
resolution, batch review and explicit continuation. Required states are
camera permission/help, scanning, resolving, expired/unknown/wrong-House,
resolved batch, advisor review, proposal intent and completion. Manual code
entry is mandatory; scanning never silently purchases.

**PAON job.** Bridge a physical rail, swatch book or fitting-room set to a
tenant-safe digital group of fabrics/configurations. It removes re-searching
while preserving the human decision between inspiration, feasible offering,
proposal and order.

**Actors, module and tier.** Customer or advisor scans; advisor edits and
quotes; manager publishes/recalls batches; inventory/production authority
validates availability. Requires Wardrobe & Styling + Commerce, with Retail
Operations or an external catalogue authority for sellable truth. Half Canvas
can resolve/save; ordering needs the appropriate Commerce/Operations add-on.

**State and wiring.** Add versioned concept batches/items and opaque,
rotatable, expiring scan tokens scoped to retailer/location/campaign. Items
reference canonical product/fabric/configuration facts rather than copied
descriptions. A public Route Handler resolves only the minimum presentation;
authenticated Server Actions save, request advice or create a proposal/cart.
Events distinguish scan, view, save, review and conversion. Price, lead time
and availability are read at decision time from their declared authority.

**Trust, recovery and proof.** Tokens reveal no customer identity and cannot
cross Houses. Recall and expiry produce a designed recovery route to the
retailer, not a dead screen. Prove tampered/expired/cross-tenant tokens,
concurrent batch republish, camera/manual paths, recalled products and one
scan-to-reviewed-proposal journey. **Current:** missing.

## FT-04 — First-fitting automation

**Source and experience.** Preserve the fitting narrative and automation
sequence in `pag1.html`: inspect imperfections, compare suggested FitTools and
values, let a human accept/edit/reject, and show the reduction in switching
without hiding the decision. It composes FT-01 and FT-02 evidence; it is not a
generic alteration detail form.

**PAON job.** Convert first-fitting observations into a controlled learning
loop: solve the current garment, improve the customer's future fit candidate
and give production/service teams unambiguous work. “Automation” means
prepared evidence and work, not autonomous approval.

**Actors, module and tier.** Advisor records and decides; production specialist
reviews fit consequences; workshop accepts work/custody; customer confirms
outcome; manager audits costs/rework. Garment & Service Operations is primary,
with Relationship and optional Wardrobe context; Full Canvas/add-on.

**State and wiring.** `scheduled -> observed -> proposal_ready -> reviewed ->
work_authorized -> in_service -> qc -> customer_outcome -> closed`, with
rejected/cancelled/rework branches. Reuse fittings, observations, immutable
fit/measurement versions, alteration cases/items, workshop assignment,
physical-garment custody, cost and outcome. One transactional review command
pins the input evidence/version and creates work; later outcomes may propose a
new fit candidate but never rewrite the fitted order.

**Trust, recovery and proof.** Show uncertainty, source and decision-maker.
Reopen/rework appends transitions; partial work creation rolls back. Prove
role transitions, stale-version conflict, retry/idempotency, custody and cost,
customer acceptance and future-candidate learning without historical mutation.
**Current:** strong observations/alteration primitives (now including
FT-01's voice/drag slider and FT-02's silhouette widget, both connected and
recording to `fitting_observations`); connected source host and automation
absent. The post-intake task-creation gap identified on 2026-08-02 is closed:
`add_alteration_task` (advisor-only, `is_alterations_advisor()`) lets staff
turn a later observation into a reviewable task on an existing alteration.
It does not touch the ledger — every new task inserts with a zero original
quote and `proposed` status, so `agreed_total_amount_minor_units` is
untouched until the task is priced through the existing, unmodified
`proposePriceChange`/`decidePriceChange` dual-control flow. This reuses the
approval governance rather than inventing a parallel one; it stays inside
R0.2's boundary the same way `wedding_guest_vouchers` does — no new
money-movement path, only a fact (a task exists) recorded ahead of its own
priced approval. The full first-fitting-to-work automation sequencing
(scheduled → observed → proposal_ready → …) is still not built; this closes
one identified structural gap in it.

## FT-05 — Mission Control and Self-Portrait

**Source and experience.** `pag1.html`'s Mission Control/Self-Portrait cockpit
is the choreography authority: a focused client command surface that combines
identity, RTW/MTM interest, evidence, next action and later “For You” use. It
must feel like one composed operational view, not dashboard cards linked to
five modules. Preserve staged reveals and visual hierarchy while replacing
source-specific content with live House state.

**PAON job.** This is the staff expression of House Memory and Advisor Today:
answer who needs attention, why now, what is known versus inferred, what was
promised, what the wardrobe/garment state is, and what action can be completed
now. Outcomes immediately improve the next preparation.

**Actors, module and tier.** Advisor sees assigned/permitted clients; manager
sees team/House exceptions; production sees only relevant garment promises;
customer can view/correct appropriate Self-Portrait facts. Relationship is the
primary module in every current plan; composed Wardrobe/Commerce/Service
panels appear only when entitled.

**State and wiring.** This is a projection, not a new shadow customer table.
Compose customers, style facts/evidence, consent, presence, appointments,
messages/promises, wardrobe, opportunities, orders, fittings and service.
Quick actions use their owning module Server Action and record outcome/source.
Rankings pin rule version, evidence window and reason codes. Cross-module
panels degrade independently; a missing integration displays authority and
freshness.

**Trust, recovery and proof.** Sensitive facts require purpose and visibility;
inferences stay labelled and correctable. No off-site presence claim or black
box “churn score.” Prove advisor/manager/customer visibility, stale/empty/error
states, corrections changing recommendations, disabled modules disappearing
without broken actions and one completed action altering the next Today view.
**Current:** more built than previously documented, checked directly
(2026-08-02) rather than left at a stale summary. No interactive
"MissionControl"/"Self-Portrait" fragment exists in `pag1.html` — only
narrative text plus one small, unrelated decorative logo-carousel — so
there is no staged-reveal choreography to port; this tool was always going
to be built from the job/state description, not a pixel port. Three of the
described actor surfaces already exist with real composed data: the
retailer `/dashboard` Brief (role-scoped attention/appointments/pace,
761 lines), the per-customer composited view
(`/customers/[id]` + `advisor-preparation-brief.tsx`, 1132 lines), and the
customer-facing declared/inferred Self-Portrait facts panel with
correction (`style-profile-panel.tsx`, 272 lines) — all real, not stubs.
The customer-facing panel had zero e2e proof despite being fully wired;
`style-profile-account.spec.ts` is a new first browser journey (view an
inferred preference with confidence/evidence, remove it, DB asserts the
profile no longer carries it). Not proven this round: the advisor-facing
Today dashboard and composited customer view (real but unverified by this
session), ranking-rule/evidence-window versioning, cross-module
degrade-independently behavior, and one completed action altering the next
Today view.

## FT-06 — MorningRoutine complete-look canvas

**Source and experience.** Replace the generic ranked list with
`pag1.html`'s complete-look canvas: a composed outfit, weather/calendar/live
context, complementary wardrobe pieces, missing/purchasable piece and clear
delivery timing, with the source transitions between looks and detail. Retain
save, dismiss/correct, review, appointment and buy/request actions. Empty and
partial wardrobes must still produce a beautiful honest composition.

**PAON job.** Create a useful daily-return habit by reducing the morning
decision and continuously connecting owned garments, context, service needs
and carefully bounded commerce. It is not a notification campaign wearing a
wardrobe label.

**Actors, module and tier.** Customer controls subscription/context; advisor
may prepare/review a look with attribution; manager configures eligibility and
delivery, not personal outfit choices. Wardrobe & Styling primary, Relationship
dependency, Commerce only for offers/orders; Half/Full Canvas.

**State and wiring.** Reuse wardrobe items/outfits/slots, roadmaps, sartorial
rules, MorningRoutine selections/recommendations/subscriptions/delivery audits,
catalogue, availability and provider-neutral weather/calendar ports. A
versioned deterministic composer runs owned-first, records reasons and gaps,
then a delivery job creates a notification to the addressable canvas. Server
Actions save/dismiss/correct/book/request/buy; order creation remains the
Commerce boundary.

**Trust, recovery and proof.** Context permissions are separable; absence of
weather/calendar cannot block wardrobe value. Never invent availability or
delivery. Frequency, quiet hours and unsubscribe are enforced at dispatch.
Prove complete/sparse/no-context states, deterministic rerun, correction and
suppression, module job-off behaviour and save-to-wardrobe plus appointment or
order continuation. **Current:** first connected slice (2026-08-02).
`pag1.html` was checked directly for a composed-look widget and has none —
only marketing narrative plus a decorative live-weather-camera overlay
requiring its own API key — so this is built with PAON primitives against
the blueprint's physical description, not a source port. The top-ranked
recommendation is now a large featured "Today's look" card (image,
owned/catalogue provenance label); the remaining recommendations form a
horizontal "Complete the look" strip, with non-owned catalogue pieces
marked "Add to complete." Every existing Server Action and data field is
unchanged — a pure recomposition of the prior plain ranked list, not new
backend logic — except one real gap surfaced and fixed:
`MorningRoutineRecommendation.primaryImageUrl` already existed on the
domain type but was silently dropped in the page-to-panel view mapping, so
no image ever had anywhere to render. "Buy" still only links to the
existing product page; order creation remains the Commerce boundary.
MorningRoutine had zero e2e coverage before this slice despite being a
real, data-backed feature; a first browser journey now exists. Empty/
missing-image states render an honest placeholder rather than hiding the
card, per the blueprint's "empty and partial wardrobes must still produce
a beautiful honest composition." Not built: live weather/calendar context
wiring, delivery-job-driven notification, and the source's decorative
elements (this tool has no interactive source fragment to preserve).

## FT-07 — Lapel, pocket and shoulder configurator

**Source and experience.** Port `pag1.html`'s three synchronized carousels and
snap/crossfade behaviour. The source choices include Notch/Peak/Shawl lapels;
Flap/Jetted/Patched pockets; Classic/Natural/Roped/Spalla Camicia shoulders.
Predefined coherent combinations remain the default; progressive disclosure
avoids a wall of options. Preserve active indicators, comparison motion and
touch/keyboard navigation.

**PAON job.** Teach visual differences and capture design intent in a way an
advisor can validate against the retailer's real offering. It supports guided
packages and proposal creation; it does not promise that every Cartesian
combination is manufacturable.

**Actors, module and tier.** Customer explores/saves; advisor explains and
submits; manager/product specialist publishes valid rules; production consumes
only accepted specs. Wardrobe & Styling + Commerce; Garment Service when an
accepted configuration becomes MTM production. Half Canvas explores/proposes;
Full Canvas/add-on continues operationally.

**State and wiring.** Version configuration vocabularies, option assets,
coherent packages, compatibility/availability rules and saved configuration
intent. The UI adapter receives the valid subset but keeps source composition.
Server Actions save intent and create/update a proposal; a separate authority
validation pins offering/rule version before quote/order. Behavioural events
may inform explainable preferences only with consent.

**Trust, recovery and proof.** Invalidated/retired choices remain readable on
history and offer a replacement path. Failed save retains a local draft.
Prove faithful synchronization, prohibited combinations, version pinning,
cross-House assets/rules, retired option recovery and configuration-to-proposal
without unsupported production write-back. **Current:** first connected slice
(2026-08-02). `pag1.html`'s `#suit-configurator-widget` was checked directly
and confirmed present — this is a genuine designated-source port, not a
built-from-description substitute: CSS, markup, class names, image URLs and
the three predefined model combinations (Henk/Willem/Karel) are byte-for-byte
from the source. The source drives scroll-to-panel and opacity crossfade with
GSAP; this codebase has no GSAP dependency, so scroll easing is a hand-rolled
requestAnimationFrame tween using GSAP's own power2.inOut formula (same
precedent as `am-house-orbit.tsx` reimplementing source animation math
directly rather than adding a library) and the opacity crossfade is a plain
CSS transition — visually equivalent, no callback timing to replicate.
Migration `20260802000008` adds `suit_configuration_intents` (append-only,
one row per save) and `save_suit_configuration_intent`, a narrow RPC that
re-derives the caller's Customer row and self-creates it on a first
interaction (same shape as `save_wishlist_item`). A customer explores the
widget at `/r/[slug]/configurator`, gated by `wardrobe_styling`, and makes an
explicit "Save this configuration" decision separate from browsing — matching
the swipe deck/wardrobe rail precedent of an explicit persisted choice rather
than saving on every scroll settle. Proof: one browser journey covering
initial predefined-model state, clicking a different model to resync all
three sub-carousels together, save, and a database assertion of the saved
row. Not built yet: prohibited combinations, version pinning, retired-option
recovery, cross-House asset/rule isolation, advisor-side visibility UI and
configuration-to-proposal/MTM production continuation.

## FT-08 — Swipe deck

**Source and experience.** Preserve `pag1.html`'s stacked draggable cards,
rotation/progress, left skip, right save, like/dislike controls, liked carousel
and final card. Pointer, touch and keyboard must express the same actions;
reduced motion keeps state legible. The existing port is the starting point,
not permission to restyle it.

**PAON job.** Collect low-friction taste evidence and immediately make it
useful in For You, consultation and Advisor Today. A swipe is a contextual
signal about one item at one moment—not a permanent customer label.

**Actors, module and tier.** Customer swipes; advisor can see an evidence-aware
summary when purpose permits; manager sees aggregate product outcomes, not
private individual taste by default. Wardrobe & Styling + Relationship;
available from Half Canvas/add-on.

**State and wiring.** Deck version pins product/media/rule set. Actions emit
consented idempotent behavioural events and may create a favourite/save.
StyleProfile recomputation consumes evidence with weight, decay, negative
signal semantics and explanation. Completion routes to liked items,
TableService or wardrobe rather than a dead end.

**Trust, recovery and proof.** Resume position is device/session safe;
duplicate gestures do not duplicate events. Consent withdrawal removes the
signal from recomputation while preserving the minimum audit record. Prove
source parity at responsive breakpoints, keyboard/touch, reload/resume,
withdrawal/recompute and visible downstream reason change. **Current:**
faithful connected implementation with source spacing, keyboard and real
mobile touch controls, reduced-motion behavior, idempotent save semantics and
visible failed-save recovery. A deterministic version pins selection rule,
occasion, product, variant and media; consented decisions resume across reload
through the interaction-event spine. Browser proof covers Server Action,
database, reload/resume, wishlist and withdrawal (signals anonymize and a
skipped item becomes eligible again while the durable wishlist survives).
Accepted active product/variant concepts are now derived server-side, stamped
onto the source event and recorded as replay-safe StyleProfile evidence with
the event as provenance. Positive and negative evidence recomputes the profile;
For You joins that profile back to reviewed catalogue concepts and displays a
real related-product reason. The browser proof follows favorite -> evidence ->
positive inferred preference -> visible related recommendation, then verifies
withdrawal anonymizes events, suppresses evidence, clears inference and hides
the recommendation while the wishlist remains. Migration `20260802000002`
also rejects cross-subject/source event provenance and makes event+concept
evidence idempotent. Exact founder icon bytes are embedded locally rather than
loaded from an external host. Cross-platform desktop and 390px mobile visual
snapshots now pin the source card, controls and liked rail. **Current:
connected and proven against this FT-08 contract.**

## FT-09 — TableService / messenger consultation

**Source and experience.** Preserve `pag1.html`'s low-threshold conversation
and attachment choreography—text, photo, PDF, Pinterest/link and wedding-fabric
inputs—plus occasion guidance and the transition to human help. Every visible
control must perform its stated job. Upload progress, preview, remove, failed
scan/link and advisor handoff states belong inside the source interaction.

**PAON job.** Combine in-store service quality with online immediacy: turn an
unstructured need into grounded guidance, a shared look, appointment,
proposal/cart or wedding context while keeping a continuous conversation.

**Actors, module and tier.** Customer starts and controls submitted material;
advisor receives/responds; invited wedding participant sees only party-scoped
content; manager audits service outcomes. Relationship primary, Wardrobe for
looks, Commerce for proposal/order, Enterprise for wedding scope. Core
conversation is Fused; richer continuations follow entitled modules.

**State and wiring.** Reuse message threads, consent, grounded-answer records,
attachments/private storage, product knowledge, wardrobe and appointment
actions. Add typed attachment purpose, rights/source, scan status and optional
party/garment links. Server Actions upload/finalize and ask; AI retrieval is
versioned and cites House-approved knowledge. Async media scanning/link
metadata jobs quarantine unsafe content. Human handoff preserves the entire
grounded context.

**Trust, recovery and proof.** Never train/reuse private media beyond stated
purpose; enforce MIME/size/malware/SSRF controls and signed access. Failure
keeps the draft and permits retry/removal. Prove each attachment type, unsafe
file/link, RLS, citation/no-answer behaviour, consent withdrawal and a real
conversation-to-look-to-appointment/proposal outcome. **Current:** the exact
raw founder storefront and the React child-route port now share the canonical
private conversation. All four visible attachment choices work: photo, PDF,
Pinterest and wedding-fabric material retain typed purpose, source and rights;
uploads use private signed storage; links are HTTPS/host constrained; previews,
remove, retained-failure drafts and basic magic-byte/MIME/size validation are
browser-proven. The customer message view and retailer inbox read the same
attachments, and the database re-derives the caller/tenant before accepting
metadata. This is a connected first slice, not FT-09 completion.
Wedding-party linking on `wedding_fabric` attachments is now closed: an
optional `wedding_party_id` column plus a `record_consultation_attachment`
signature change (old 8-arg overload explicitly dropped, not just
shadowed) lets a signed-in customer tag a fabric upload to their own
wedding party (`is_wedding_party_organizer_or_member` enforced
server-side); the retailer inbox resolves and shows the party's name next
to the attachment rather than recording the link silently. Built twice,
not once: the exact raw founder landing page (`route.ts` +
`paon-template.html`, a hand-templated string substitution, not React)
and the React child-route port (`table-service-widget.tsx`, used on
`/products`, `/cart` etc. via `layout.tsx`) are two independent widget
implementations that happen to call the same Server Action — a real
architectural fact worth knowing before assuming an edit to one reaches
both (this cost real debugging time: the root `/r/[slug]` path has no
`page.tsx`, only a `route.ts` Route Handler, which Next.js never wraps in
`layout.tsx`, so the React widget's props/state never apply there).
Garment links remain unattempted. Still owed: an actual async
malware/quarantine service (the current state is honestly
`basic_validated`), attachment progress, consent withdrawal/retention
proof, attachment-grounded citation/no-answer proof and the full
conversation -> shared look -> appointment/proposal outcome journey.

## FT-10 — Inspiration Box and gift booklet

**Source status (reconfirmed 2026-08-02):** `downloaded_pages/pag1.html` has
no interactive Inspiration Box/gift-booklet fragment — the only occurrence
(near `id="u569109"`) is a single static marketing sentence next to a price
under the Atelier Munro brand block, not a component with markup/CSS/motion
to port. `DESIGN_PORTS.md`'s "none found" is accurate. Per `AGENTS.md`'s "for
non-designated source material, curate the underlying job and interaction
grammar into PAON" — this tool is not fidelity-constrained to an exact
source; build it with PAON's own primitives against the PAON-job/state
description below, and do not later claim source-port fidelity that ADR-071
never actually established for this tool.

**Source and experience.** Port `pag1.html`'s Inspiration Box reveal and gift
booklet composition exactly: a considered opening, curated choices and a
recipient-facing continuation rather than a generic voucher form. Preserve
the source pacing/motion and provide reduced-motion and print/share-safe
variants. Empty, expired, redeemed and unavailable-item states are designed.

**PAON job.** Make gifting feel personal while creating a lawful bridge from
giver intent to recipient discovery, appointment, service or purchase. The
retailer can curate real products/services; the recipient chooses what to
reveal and whether to become a customer.

**Actors, module and tier.** Giver composes/pays or requests; retailer advisor
curates; recipient receives/redeems; manager controls catalogue/expiry/refund.
Commerce & Growth primary, Relationship only after recipient consent, optional
Wardrobe for accepted preferences. Half/Full Canvas or Commerce add-on.

**State and wiring.** Planned objects: gift experience/version, curated items,
message/media, recipient invitation token, commercial gift instrument or
proposal reference, delivery attempts and redemption outcomes. Do not invent
a stored-value liability: until a provider/ledger policy exists, operate as a
proposal or product/service order. Opaque expiring links reveal minimum data;
Server Actions compose, approve, send, accept and redeem. Catalogue/price and
availability are live-authority reads.

**Trust, recovery and proof.** Recipient data is invitation-purpose only and
must not silently create marketing consent. Giver cannot see recipient
browsing/preferences. Recall/refund/item-unavailable paths preserve the gift's
value and intent. Prove token isolation/expiry, recipient consent boundary,
price changes, resend/idempotency and a full curate-open-select-redeem outcome.
**Current:** first connected slice (2026-08-02). Migration `20260802000006`
adds `gift_experiences`/`gift_curated_items`/`gift_invitations` plus two
anonymous-safe SECURITY DEFINER RPCs (`resolve_gift_invitation`,
`redeem_gift_invitation`) mirroring the ADR-034 narrow-RPC pattern. A
retailer manager curates 1–12 real catalogue pieces into an experience
(`/gifts`) and sends an opaque-token invitation; the recipient opens it
anonymously, sees only their own reveal (live price/name/image, never
another recipient's activity), and redeems one piece by name/email — which
never grants marketing consent. Redemption deliberately does not create an
Order or touch stock (see the migration header): R0.2 already owns the
atomic money/stock write surface, so this records a selection outcome for
the retailer's advisor to convert manually, rather than adding an
uncoordinated write path. Price is always the live catalogue price at
redemption, never a curation-time snapshot. Proof: 6 pgTAP assertions
(token isolation, unknown-token rejection, item-must-belong-to-experience,
no-double-redeem), a retailer browser journey (curate → invite → see a
real redemption reflected) and a customer browser journey (anonymous
open → redeem → second-redemption blocked). Not yet built: expiry/revoke
UI polish beyond the raw fields, resend, giver payment/request flow, and
recall/refund handling — the blueprint's fuller giver-side and commercial-
instrument scope remains open.

## FT-11 — Location globe and monthly visual grid

**Source and experience.** Preserve `pag1.html`'s Cesium globe activation,
retailer pins, filters, open/closed/hours/address panels, call/chat transition,
image panels and attachment menu; the monthly grid must preserve the founder's
calendar-to-context visual rhythm. Remove the embedded Cesium credential and
lazy-load the heavy experience. Provide a fast accessible list/map fallback,
reduced motion and explicit activation/deactivation.

**PAON job.** Only activate when a real multi-location or partner journey
needs spatial/time discovery—for example choosing a House, fitting location,
care partner or event. It is not decorative proof that PAON has a “network.”

**Actors, module and tier.** Customer searches and contacts; retailer/location
manager maintains public facts; contracted partner maintains entitled facts;
PAON operator handles network moderation. Enterprise for retailer locations;
Network for partners, normally Full Canvas or explicit add-on. It remains
quarantined until a named launch journey exists.

**State and wiring.** Canonical location/branch/partner capability, territory,
hours/exception, public contact, imagery rights, appointment availability and
event/calendar records feed a small projection API. Geocoding and Cesium are
replaceable adapters; client gets no secret or private customer data. Chat and
booking create normal Relationship/Appointment objects. Cache by public
projection version with bounded staleness and recall.

**Trust, recovery and proof.** Location publishing is opt-in and data-minimal;
no background customer location tracking. Define bundle, memory, interaction
latency and tile-cost budgets before activation. Prove no client credential,
list-only/no-WebGL fallback, keyboard/screen-reader use, stale-hours exception,
unpublished partner isolation and contact/booking outcome. **Current:** missing
and intentionally quarantined, not cancelled.

## FT-12 — Six-rail wardrobe

**Source and experience.** Replace the six generic card sections with the
founder-designated tactile stacked rails: suits, jackets, shirts, knitwear,
shoes and accessories. Preserve opening/closing, layered depth, horizontal
movement, composed-look transition and live contextual detail observed in the
source pages. Maintain the exact motion once mechanically extracted; do not
guess missing pixels from this prose. Provide keyboard rail/item navigation,
reduced motion and useful sparse/empty states.

**PAON job.** Make the customer's real wardrobe the visual centre of the
relationship. Owned, self-added, proposed, planned and service-away garments
remain visibly distinct but can combine into looks, gaps, MorningRoutine,
TableService, care and order continuations.

**Actors, module and tier.** Customer owns/corrects visibility and additions;
advisor proposes with provenance; service staff see only linked garments;
manager never edits personal ownership casually. Wardrobe & Styling primary,
Relationship dependency; Half/Full Canvas.

**State and wiring.** Reuse `wardrobe_items`, ownership/lifecycle events,
attachments, physical garments, order lines, outfits/slots, roadmaps/gaps,
service bookings and product metadata. A server projection groups categories
without copying state. Server Actions add/correct/archive, accept/reject a
proposal, compose/save a look, record wear and request service. Items maintain
source (`order`, customer, advisor proposal), confidence/status and history.

**Trust, recovery and proof.** Private garment photos use signed access;
advisor proposals never become ownership without acceptance/fulfilment.
Unavailable imagery falls back without breaking rail geometry. Prove exact
responsive motion, all provenance states, concurrent correction, order-fed
ownership, service-away return, cross-House isolation and a rail-to-look-to-
MorningRoutine/service continuation. **Current:** first connected slice
(2026-08-02). No interactive source fragment exists for the stacked-rail
interaction (checked directly against `pag1.html`: the only category-named
element is a decorative, differently-labelled homepage image carousel, not
a personal-wardrobe rail), so per AGENTS.md's non-designated-source path
this replaces the six generic card sections with `WardrobeRail`
(`apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx`) built against
the blueprint's own physical description rather than guessed pixels: each
category defaults to a closed "spine" with a layered peek-stack preview of
its first pieces, opens/closes on click with a `grid-template-rows`
height transition, and supports arrow-key roving focus between rail
headers. `prefers-reduced-motion` disables the transform/transition.
Existing add/retire actions and provenance labelling are unchanged. Proof:
one browser journey — default-open state, close/reopen collapse, keyboard
navigation between rails, and the pre-existing add/retire flow still
working through the new UI. Not built: composed-look transition, concurrent-
correction proof, order-fed ownership proof, service-away return, cross-
House isolation proof, and the rail-to-look-to-MorningRoutine/service
continuation — the blueprint's fuller interaction and proof scope remains
open.

## FT-13 — Moonstruck groom and best-men planner

**Source and experience.** Preserve `pag2.html`'s designated apparel journey:
inspiration, invitation, personal profile, orbit/group presence, group-date
agreement, fitting, delivery and pickup readiness. Keep the faithful member
orbit and recreate the planner's visual sequencing and group messages; do not
collapse it into a generic roster. Wedding planning outside apparel—venue,
RSVP/dietary/song, escrow and vendor marketplace—is a separate future vertical.

**PAON job.** Let a groom, participants and retailer coordinate a coherent
wedding wardrobe without spreadsheets or privacy leaks. Each person can
contribute inspiration/options and complete personal fit steps while the groom
and retailer see truthful group readiness.

**Actors, module and tier.** Organizer controls party/invites and shared style;
participant controls personal profile/media/availability; advisor coordinates;
production sees assigned garment milestones; partner sees scoped custody;
manager sees exceptions. Enterprise & Vertical primary, requiring Relationship
and Garment Service; Commerce/Operations only for orders/stock. Full Canvas or
Moonstruck add-on.

**State and wiring.** Extend—not fork—`wedding_parties`, members, invitation
tokens/photos, date candidates/votes, appointments, member style choices,
orders/physical garments, fitting status, delivery/pickup and aftercare plans.
Shared readiness is a projection over per-member milestones. Server Actions
invite/join, propose/vote/finalize date, update own profile, approve shared
look and request appointments; order/production events advance readiness.
Reminder/readiness jobs require the module active and respect suppression.

**Trust, recovery and proof.** Roster membership does not expose another
member's measurements, contact data or private availability detail. Revoked or
expired invites fail safely; removal preserves audit/order obligations while
revoking future access. Prove organizer/member/advisor/production RLS, date
conflict resolution, retry/idempotency, partial party, late change and full
invite-to-group-fitting-to-delivery/pickup journey. **Current:** useful party
model, faithful orbit, and a proven delivery/pickup readiness slice —
`wedding_aftercare_plans` (party-wide or member-scoped instructions with a due
date) plus `complete_wedding_aftercare_plan` (SECURITY DEFINER RPC re-deriving
organizer-or-assigned-member authorization server-side, ADR-034 pattern),
retailer authoring UI and customer completion UI, proven end-to-end
(retailer creates → customer completes → DB asserts), plus a connected
`wedding_group_fittings` slice (schema was already real since
`20260801000014`; migration `20260802000009` added the missing
customer-facing SELECT RLS mirroring the aftercare-plan pattern) — a
retailer schedules a date/time + capacity fitting from the party page, the
organizer and every member see it listed (read-only; the schema has no
per-member RSVP column yet), plus a connected `wedding_inspiration_items`
slice (also schema-real since `20260801000014`; unlike group fittings this
is customer-writable via `added_by_customer_id`, so migration
`20260802000010` adds `add_wedding_inspiration_item`, a SECURITY DEFINER RPC
re-deriving organizer/member authorization and the caller's own customer id,
plus a `wedding_inspiration_item_has_content` check constraint the original
schema lacked) — the organizer and every member pin an image link and/or
note, `internal_only` defaults true, plus a connected `wedding_design_choices`
slice (also schema-real since `20260801000014`) — a member records their own
outfit choice per slot (free text; no vocabulary is specified in the source)
or the organizer sets one party-wide "coordinated" choice, via migration
`20260802000011`'s `set_wedding_design_choice` SECURITY DEFINER RPC, which
upserts on (party, member-or-null, slot) rather than accumulating duplicate
rows, plus a connected "group-date agreement" slice — the one FT-13 surface
with no schema at all until migration `20260802000012` added
`wedding_date_candidates`/`wedding_date_votes`. The organizer or any member
proposes a candidate date (`propose_wedding_date_candidate`, idempotent);
every member votes at most once per candidate
(`toggle_wedding_date_vote`, resolving the caller's own member row
server-side); the organizer finalizes by reusing the existing organizer-RLS
`updateSchedule` path to set `wedding_parties.event_date`, not a new RPC.
`wedding_guest_vouchers` is now connected too: it holds real monetary
value but wiring it never required a payment/redemption mechanism, only
recording two facts the retailer already knows externally (issued,
funded outside PAON; later redeemed) — neither write creates an order,
moves stock, or captures a payment, so it stays inside R0.2's boundary
rather than crossing it. Migration `20260802000013` adds the
customer-facing SELECT policy; retailer issue/mark-redeemed use plain
insert/update through the already-granted staff RLS, no RPC. FT-13 is now
fully wired across every table the schema already had — planner
workflow/experience otherwise partial.

## FT-14 — Preferred Tailoring and HighMaintenance

**Source and experience.** Port `pag3.html`'s weekly calendar-led wardrobe
orchestration and HighMaintenance care choreography. Preferred Tailoring
prepares the days ahead from calendar/agenda/travel and wardrobe; care shows
selection, collection/pickup, custody, cleaning/repair, quality and return.
Preserve the founder's calendar, garment transitions and service pacing rather
than presenting generic booking/admin tables. `pag2`'s wedding pickup and
anniversary preservation may reuse the same service experience.

**PAON job.** Turn wardrobe care and weekly preparation into a recurring
premium service with operational truth. Customers see what to wear and where
each garment is; retailers coordinate advisors and partners; every service
outcome improves garment history and future recommendations.

**Actors, module and tier.** Customer authorizes context/service and sees
status/cost; advisor proposes week and manages exceptions; pickup/partner staff
see minimum work/custody; manager owns plan, entitlement, SLA and reconciliation.
Garment & Service primary; Wardrobe and Relationship compose the customer
experience; Enterprise hosts premium/multi-partner programs. Full Canvas or a
Preferred Tailoring add-on.

**State and wiring.** Reuse service plans/memberships/entitlements/bookings,
appointments, fulfilment/care/cost/history, wardrobe/physical garments and
provider-neutral calendar/weather. Add explicit serialized custody handoffs,
partner capability/SLA/territory and weekly plan/version if absent. Weekly
composition is a versioned job; customer/advisor Server Actions accept/edit,
book and authorize spend. Partner mutations use a scoped portal/API and
idempotent transitions; costs reconcile before charge/entitlement posting.

**Trust, recovery and proof.** Calendar access is minimum-scope and revocable;
partner never sees the full client profile. Lost/damaged/delayed/disputed and
failed-handoff paths remain visible and create recovery work. Prove entitlement
exhaustion, customer authorization, custody chain, partner RLS, cost variance,
offline/retry handoff, care outcome and returned garment re-entering the weekly
wardrobe. **Current:** strong operational primitives; faithful customer,
advisor and partner journey absent.

## Broader founder-intent crosswalk

The fourteen tools are not the whole platform. The long founder brief and
phone-page audit also require the following connected capability families.
They use the tool contracts above but remain governed by the detailed stable
IDs in the omission ledger and programme traceability.

| Founder intent                                                    | Primary contracts and platform continuation                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intelligent catalogue, fabric/product knowledge and ingestion     | FT-03/07/09 plus Retail Operations metadata, reviewed imports, provenance and source authority                                                                                           |
| Complete-look recommendations, For You, wardrobe gaps and roadmap | FT-05/06/08/12 plus deterministic sartorial rules, outfits and explainable ranking                                                                                                       |
| TableService, StyleProfile and appointment conversion             | FT-05/08/09 plus consented facts, grounded knowledge, messages and appointments                                                                                                          |
| Fit/self-scan, fitting learning and repeat safety                 | FT-01/02/04 plus private evidence, immutable fit versions and validated reorder eligibility                                                                                              |
| Garment longevity, rotation and care                              | FT-06/12/14 plus lifecycle/wear evidence, custody and service outcomes                                                                                                                   |
| Campaigns, private offers and Seven-Day Wardrobe                  | FT-06/10/12 plus versioned assets/audiences, suppression, attribution and honest availability                                                                                            |
| Milestones, education and memberships                             | FT-10/14 plus ledgered rewards/entitlements and Academy content; no fake scarcity or unapproved liability                                                                                |
| One-click buying, delivery payment and provider eligibility       | FT-03/06/07/09/10 through canonical proposal/cart/order/payment boundaries; blocked where provider/commercial policy is absent                                                           |
| Tie-Mate                                                          | A separate faithful guided-matching tool over real wardrobe/catalogue metadata; its current domain/repository/UI foundation remains subject to the same source-fidelity and proof ladder |
| Retailer-owner marketplace, partners and network                  | FT-11/14 plus separate lifestyle/B2B bounded contexts, opaque attribution and multi-party ledgers; no named-profile sale                                                                 |
| Advisor Today, Self-Portrait and evidence-cited clienteling       | FT-05 as the shared relationship spine; every downstream tool returns corrections, promises and outcomes                                                                                 |
| Moonstruck and occasionwear                                       | FT-13 for apparel coordination; unrelated full wedding-planner concepts remain explicitly deferred rather than silently promised                                                         |

## Completion rule

A tool moves from Missing/Wrong/Foundation/Shell to Verified only when its
source adapter, canonical state, permissions, module lifecycle, failure paths
and connected proof all pass together. Screenshots alone, schema alone and a
happy-path demo alone cannot satisfy this contract.
