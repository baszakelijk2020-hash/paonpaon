# PAON Experience Rebuild

This is the governing product-experience document for PAON. The original
`/Users/nguyen/Downloads/paon.html` is the visual source of truth. Existing
domain concepts, repositories, migrations, RLS policies, authorization and
business workflows remain authoritative; this rebuild changes how people
understand and operate them.

## Acceptance status

The product is functionally broad but has not yet passed the experience
acceptance test. A route is not complete because it renders. It is complete
only when its intended persona can enter with seeded data, understand what
matters, complete the primary task, receive excellent feedback, and use it at
desktop and mobile widths in an unmistakably PAON interface.

Legend used below:

- **Baseline** — functional route, experience rebuild not accepted.
- **Foundation** — rebuilt shell/login foundation, route content still pending.
- **Accepted** — visually inspected at desktop and mobile, primary interactions
  exercised with the named persona, and automated coverage passed.
- **Blocked visual verification** — implementation can continue, but acceptance
  cannot be granted until the in-app browser is available for screenshots and
  interaction inspection.

At the start of this phase the in-app browser reported no available browser
backends. The local applications and demo database are running, but no baseline
screen is represented as visually verified. This is an explicit evidence gap,
not a substitute screenshot.

### Checkpoint 1 — demo truth, entry and shells

Committed as `d3bbc0d`:

- rich idempotent showcase data and all required personas, including
  production/operations and an assigned alteration worker;
- deterministic customer demo password entry without changing normal
  passwordless customer authentication;
- PAON Admin's persona launcher with environment health, copyable credentials
  and correct application links;
- image-led editorial login compositions across all applications;
- shared reference-derived desktop rail, mobile drawer, active route and
  customer mobile dock;
- purpose-built navigation for platform, owner, manager, advisor, operations,
  workshop manager, worker and customer contexts;
- role-isolation E2E coverage at desktop and 390×844.

The code checkpoint is functionally verified but remains **Foundation**, not
**Accepted**, until the required browser screenshots and visual interaction pass
can be completed.

### Checkpoint 2 — attention dashboards

Implemented locally:

- PAON Admin `/retailers` is now the platform morning brief: network health,
  authoritative 30-day activity signals, explicit intervention cards and a
  composed retailer network instead of a generic table;
- retailer `/dashboard` now speaks differently to owner, manager, advisor and
  operations personas while retaining one secure data path. It combines a
  role-written priority, live appointments/orders/garments/messages, price
  approvals, a time-ordered day agenda, clear-state guidance and relevant
  primary actions;
- workshop manager and worker `/alterations` entry is now a due-aware visual
  work queue with live workload metrics, progress rails, garment context and
  worker-safe copy/actions;
- customer `/dashboard` is now a private-client home: editorial imagery, a
  single next-moment hero, appointment/garment/conversation signals and rich
  atelier relationship cards.

Role E2E assertions exercise the distinct brief for all six retailer operating
personas plus the platform and customer dashboards. As with Checkpoint 1, these
screens remain **Foundation**, not **Accepted**, until in-app-browser desktop
and mobile screenshots can be inspected.

### Checkpoint 3 — relationship-to-appointment continuity

Implemented locally:

- retailer `/customers/[id]` now opens as a relationship workspace with a
  private-client identity hero, pinned team memory, relationship/lifetime
  value/wardrobe/portal signals, next-best-moment guidance and contextual
  message, garment-intake and wedding-party actions;
- `/appointments/[id]` now behaves as an advisor preparation brief. It carries
  the pinned relationship memory, appointment request, assigned advisor,
  wardrobe/order context, operational status controls and explicit post-visit
  continuity back into the client record;
- the existing authoritative customer, order, appointment, garment,
  clienteling and loyalty repositories remain the source of every signal; this
  checkpoint added no duplicated relationship state.

The retailer E2E journey now asserts the relationship next-action state and the
appointment preparation workspace before exercising the existing mutations.
Visual acceptance remains blocked on the unavailable in-app browser.

## Commercialisation and Retailer Demo System

The rebuild now has a commercial acceptance outcome: the founder can turn a
researched premium retailer into a safe, personalized demonstration, proposal
and paid pilot without editing code or forking PAON. One platform varies
validated branding tokens, content, enabled capabilities, commercial terms and
isolated synthetic data per prospect.

### Commercial packages

| Package          | Recurring software | Implementation | Positioning                                 |
| ---------------- | ------------------ | -------------- | ------------------------------------------- |
| PAON Fused       | €349/month         | €1,500         | A professional digital customer foundation. |
| PAON Half Canvas | €749/month         | €3,500         | Customer growth, service and retention.     |
| PAON Full Canvas | From €1,750/month  | From €7,500    | Complete platform with managed growth.      |

Admin owns package names, positioning, descriptions, recurring prices,
implementation prices, public visibility, seat guidance, Stripe Price bridge
and entitlements. Optional campaign, lead-generation and advisory services are
proposal lines—not subscription features or implementation fees.

### Commercial journey architecture

1. Research target retailer without importing customer data.
2. Create prospect and record company/contact/sales context.
3. Select a recommended package.
4. Apply logo, imagery, curated typography and validated color tokens.
5. Select modules, locations and product mix.
6. Generate isolated synthetic people, products, orders, fittings and activity.
7. Preview every relevant persona at desktop, tablet and mobile.
8. Publish one private, revocable demo/proposal link.
9. Track opens and follow-up due dates.
10. Conduct consultation and issue a paid-pilot proposal.
11. Mark pilot accepted and copy approved configuration—not synthetic records—
    into live onboarding.

### Commercial route inventory

| Surface                         | Intended experience                                               | Status     |
| ------------------------------- | ----------------------------------------------------------------- | ---------- |
| Public PAON landing/platform    | Visual product demonstration with retailer outcomes               | Foundation |
| Public alterations/engagement   | Interactive workflow and relationship previews                    | Foundation |
| Public templates/roles          | Storefront and operating-role product previews                    | Foundation |
| Public pricing                  | Editable Fused/Half Canvas/Full Canvas comparison                 | Foundation |
| Demo request/consultation/pilot | High-trust lead and next-action journey                           | Foundation |
| Admin commercial catalogue      | Edit package copy, fees, entitlements and Stripe bridge           | Foundation |
| Admin sales cockpit             | Attention-ranked pipeline and next three revenue actions          | Planned    |
| Admin prospect record           | Research, contact, package and opportunity context                | Planned    |
| Admin Demo Studio               | Safe branding, modules, content, synthetic data and role previews | Planned    |
| Retailer `/settings/brand`      | Validated tokens, live preview and restorable brand versions      | Foundation |
| Private demo/proposal           | Retailer-specific environment, terms and secure action            | Planned    |
| Pilot-to-live transition        | Copy approved configuration only into onboarding                  | Planned    |

### Commercial checkpoint 1 — plans and entitlements

Implemented locally:

- the old Boutique/House/Maison billing rows are migrated in place to PAON
  Fused, Half Canvas and Full Canvas, preserving any existing Stripe bridge IDs;
- recurring software and one-time implementation money have distinct typed
  fields; managed service offerings live in their own catalogue;
- a normalized commercial feature catalogue and plan-entitlement relation
  provide the source for public comparison and server authorization;
- retailer-specific entitlement overrides are explicit, attributable,
  optionally expiring exceptions—not scattered plan-name checks;
- `retailer_has_entitlement` derives access from the authenticated tenant,
  active/trialing subscription, normalized plan entitlements and current
  override, returning false outside the caller's authority;
- Admin `/billing` is now an editorial commercial catalogue editor with atomic
  plan/entitlement updates and a deliberately separate Stripe Price bridge.

This is a functional foundation. Public marketing, retailer theme
configuration and Demo Studio follow in the stated dependency order.

### Commercial checkpoint 2 — public product story and genuine inquiry

Implemented locally:

- Customer Portal `/` is now PAON's public corporate surface rather than an
  authentication redirect, while `/dashboard` and every private-client route
  remain protected;
- the landing story uses the reference typography, charcoal/warm material
  system, editorial proportions and image-led pacing to connect relationship
  selling, alteration operations and the private-client experience;
- an interactive role preview lets a retailer move between advisor, workshop
  and customer contexts and see different attention, metrics and next action;
- `/discover/[topic]` provides focused, non-generic product narratives for the
  platform, outcomes, alterations, engagement, templates, loyalty,
  weddings/events and role architecture;
- `/pricing` reads the Admin-editable catalogue and entitlement vocabulary
  directly, presents every included capability, and keeps recurring software,
  implementation and optional managed services visibly separate;
- `/demo-request`, `/consultation` and `/pilot` are distinct high-trust entry
  journeys backed by one validated inquiry model and narrow anonymous RPC.
  Success is shown only after persistence; no retailer, demo or production
  tenant is created implicitly;
- public-product and inquiry Playwright coverage exercises the interactive
  preview, the three exact packages and a real persisted-and-cleaned-up demo
  request.

These routes are **Foundation**, not **Accepted**. The required in-app-browser
desktop/mobile inspection and screenshot evidence remains unavailable; no
automated screenshot has been promoted into the baseline register.

### Commercial checkpoint 3 — safe shared retailer themes

Implemented locally:

- one `RetailerBrandTheme` vocabulary now represents HTTPS logo/favicon/hero
  assets, three curated display treatments, two readable body treatments,
  three corner characters and validated accent/surface/ink colors;
- surface/ink combinations must meet WCAG 4.5:1 contrast in both domain
  validation and the database. Unknown keys, arbitrary fonts, HTTP assets,
  scripts, CSS and HTML cannot be represented or persisted;
- the shared `RetailerTheme` component maps only those tokens to CSS variables.
  The same component wraps the Retailer operating shell and public storefront,
  preserving one codebase and one PAON component system;
- retailer owners/admins can configure and preview themes at
  `/settings/brand`. Publishing creates an immutable attributed version and
  atomically activates it; any version can be restored as a new auditable
  version;
- direct retailer-staff mutation of `brand_theme` is rejected. The narrow
  save/restore functions re-derive tenant authority, while PAON platform staff
  and authorized service tooling retain their established scope;
- unit coverage proves unsafe token rejection, fallback normalization and RPC
  boundaries. Retailer E2E coverage publishes a real version, verifies the
  shared shell consumes its CSS variables, and removes its own test state.

This architecture is the theme boundary that Demo Studio must reuse for
prospects. It remains **Foundation** pending the required desktop/tablet/mobile
visual pass in the unavailable in-app browser.

## Experience principles

1. **Attention before administration.** Every dashboard opens with the few
   things that need this person now, then reveals context and deeper tools.
2. **One calm operating picture.** Related information belongs together:
   customer history with next action, alteration evidence with progress,
   appointment context with client preferences.
3. **Editorial, not ornamental.** Richness comes from hierarchy, imagery,
   meaningful status, timelines and contextual action—not extra chrome.
4. **Progress is visible.** Orders, appointments, alterations, onboarding and
   invitations show where they are, what changed and what happens next.
5. **Every state earns its space.** Empty states teach the next useful action;
   loading states preserve layout; success confirms consequence; errors explain
   recovery without losing entered work.
6. **Roles are products, not filters.** Owner, manager, advisor and workshop
   roles share data but receive purpose-built navigation, dashboards and
   language.
7. **Mobile is a working surface.** Touch targets are at least 44px, navigation
   never depends on horizontal scrolling, primary actions remain reachable,
   and dense records become ordered sections rather than compressed desktop.

## Visual system derived from `paon.html`

### Typography

- `OptimaKlein` is the primary editorial/display voice and the navigation
  character. It carries product names, screen titles and high-value numbers.
- `GTBold3` is the micro-label voice: 7–9px uppercase eyebrow text with
  deliberate tracking, never paragraph copy.
- `Aviano` is the original wordmark face. Where it is unavailable, the PAON
  wordmark uses OptimaKlein with expanded tracking rather than a generic bold
  sans.
- Body and form copy remains a highly legible sans at 13–15px; operational
  metadata uses 10–12px; identifiers use the mono face.
- Titles use short lines and generous leading. All-caps is reserved for
  navigation taxonomy, statuses and small labels.

### Color and material

- Warm canvas: `#f4f1ec` / `#f5f3f0`; secondary surfaces `#ededea`,
  `#e8e4de`; borders `#d9d9d9`.
- Ink: `#1a1a1a`, `#111110`, `#333`; secondary copy `#666` / `#808080`.
- The navigation material is the reference charcoal gradient
  `linear-gradient(to right, #333, #1a1a1a)`, with hairline white borders and
  restrained translucency.
- Floating chrome uses `blur(24px) saturate(1.4)` over a translucent warm
  surface.
- Semantic color is rare: green for completed/healthy, amber for attention,
  red for destructive/blocked. It never becomes decorative dashboard confetti.
- Product and garment imagery sits on alternating warm tonal panels and is
  contained rather than aggressively cropped where the full silhouette matters.

### Space, proportion and composition

- Desktop operations use a 256px persistent left navigation rail derived from
  the original 250px sidebar and a 72px glass top context bar.
- Content may use up to 92rem when the information benefits; narrow forms keep
  a deliberate readable measure. The previous universal 3xl/5xl centered
  column is not the default.
- Primary page rhythm is 32–48px. Card interiors use 20–28px. Metadata stacks
  use 4–8px. Dense workspaces divide space with hairlines, not nested boxes.
- Corners range from 4–8px for controls and 12–20px for large editorial
  surfaces. Pills are limited to compact status.
- Cards should form compositions: feature panel + timeline, image + context,
  attention queue + day plan. A page-sized list of identical white cards is
  not an accepted composition.

### Border, shadow and motion

- Borders are 1px warm hairlines; active navigation uses a thin white marker.
- Large elevated moments use `0 20px 60px rgba(0,0,0,.2)`; drawers use the
  original lateral `20px 0 60px rgba(0,0,0,.35)`. Routine containers should
  remain nearly flat.
- Standard UI motion uses `cubic-bezier(.22,.61,.36,1)` over 180–500ms.
  Content entry may use the reference 900–1000ms opacity/10px rise when it
  does not delay work.
- Motion communicates continuity: drawer entry, card selection, progress
  advancement, successful save and contextual panel reveal. Reduced-motion
  preferences remove translation and stagger.
- Hover is enhancement only and is disabled for non-hover pointers. Active,
  focus and selected states remain fully legible without hover.

### Navigation character

- Desktop: dark editorial rail, PAON wordmark, role-specific grouped
  navigation, current-location marker, quiet signed-in identity.
- Mobile: glass top bar + charcoal modal drawer using the same information
  architecture. High-frequency customer destinations may additionally use a
  bottom dock once visually verified.
- Labels describe the user’s work (“Client book”, “Work queue”, “Your
  advisors”), not database nouns where a clearer product phrase exists.

## Demo environment and persona logins

Run local Supabase, then:

```bash
set -a
source apps/admin/.env.local
set +a
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
pnpm --filter @paon/database seed:demo
pnpm dev
```

The seed is idempotent. Every seeded login uses `Demo-PAON-2026!`.
Retailer and platform personas sign in with email/password. Customer demo
personas use `/login?demo=1`; normal customer sign-in remains passwordless.

| Persona                        | Application                   | Maison Dubois login                                        |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| Platform administrator         | Admin `:3000`                 | `contact@nebelspiegel.com`                                 |
| Retailer owner                 | Retailer `:3001`              | `contact+maison-dubois-owner@nebelspiegel.com`             |
| Retailer manager               | Retailer `:3001`              | `contact+maison-dubois-manager@nebelspiegel.com`           |
| Sales advisor                  | Retailer `:3001`              | `contact+maison-dubois-sales@nebelspiegel.com`             |
| Production/operations employee | Retailer `:3001`              | `contact+maison-dubois-operations@nebelspiegel.com`        |
| Alteration-workshop manager    | Retailer `:3001`              | `contact+maison-dubois-workshop@nebelspiegel.com`          |
| Alteration worker              | Retailer `:3001`              | `contact+maison-dubois-alteration-worker@nebelspiegel.com` |
| Customer                       | Customer `:3002/login?demo=1` | `contact+isabelle@nebelspiegel.com`                        |

Casa Marchetti provides the same retailer roles using
`contact+casa-marchetti-{owner|manager|sales|operations|workshop|alteration-worker}@nebelspiegel.com`;
customer logins are `contact+giulia@nebelspiegel.com` and
`contact+luca@nebelspiegel.com`.

The accepted seed must include for each retailer:

- six image-backed active products and a collection;
- VIP, returning and first-purchase/prospect customer relationships;
- delivered purchase history and loyalty balances;
- one fitting today, one requested consultation tomorrow and one completed
  appointment;
- a workshop, workshop manager, alteration worker, assigned garment and
  actionable work-now task;
- a private advisor conversation with an unread customer reply;
- pinned clienteling preferences and an occasion reminder;
- a published trunk show;
- a wedding party with members and fitting status;
- enough status variety to make attention, history and empty-state behavior
  testable without manual database work.

## Role-by-role experience architecture

### 1. PAON platform administrator

**Promise:** know which retailers need intervention and operate the network
without entering tenant-level busywork.

**Navigation:** Retailer network, Commercials, Platform pulse, AI studio, Demo
atelier.

**Daily brief:** onboarding exceptions, inactive/unhealthy retailers, billing
issues, failed provider work, AI failures and adoption movement.

**Core journeys:**

1. Sign in → platform brief → open an at-risk retailer → understand identity,
   owner, subscription, operational activity and required action.
2. Create retailer → invite owner → see onboarding progress and recovery path.
3. Review plan coverage/billing exception → assign or repair plan.
4. Inspect failed AI/provider work → see affected retailer and retry/recovery
   guidance.
5. Seed or reactivate demo → copy persona login → enter the relevant product.

### 2. Retailer owner

**Promise:** understand business health and unblock the team while retaining
control of money, people and partners.

**Navigation:** Daily brief, Appointments, Orders, Conversations, Updates;
Alterations, Service catalogue, Workshop network; Client book, Wedding parties,
Loyalty, Events; Catalogue, Collections, Performance; Team, Settings.

**Daily brief:** pending cost approvals, VIP appointments, overdue garments,
orders at risk, unread customer requests, team coverage and commercial pulse.

**Core journeys:** approve an alteration cost with evidence; inspect a VIP
relationship and delegate follow-up; understand today’s appointments and team;
review order risk; manage staff and workshop access; inspect performance.

### 3. Retailer manager

**Promise:** run today’s floor and service commitments without owner-only
configuration noise.

**Navigation:** Daily brief, Appointments, Orders, Conversations, Updates;
Alterations and service operations; Client book, Wedding parties, Loyalty,
Events; Catalogue, Collections, Performance; team roster where authorized.

**Daily brief:** arrivals, unattended requests, overdue/blocked work, unassigned
appointments and service-capacity conflicts.

**Core journeys:** triage the day; assign an appointment; advance an order;
review alteration progress; coordinate a wedding party; resolve an unread
conversation.

### 4. Sales advisor

**Promise:** recognize the client, prepare the appointment and follow through
without seeing configuration they cannot use.

**Navigation:** Daily brief, Appointments, Orders, Conversations, Updates;
Alterations; Client book and Wedding parties.

**Daily brief:** personal appointments, clients awaiting reply, pickups/fittings
due and next-best relationship actions.

**Core journeys:** open appointment → read preferences/history → check in →
record notes/follow-up; create a walk-in client; start garment intake; message a
client; prepare a wedding-party fitting.

### 5. Production/operations employee

**Promise:** keep commercial promises moving across orders and alterations
without access to clienteling, pricing approval or configuration.

**Navigation:** Daily brief, Orders, Updates and Alterations. Appointments and
conversations remain visible only where the existing authorization grants
them; client book, catalogue, analytics, staff and settings remain absent.

**Daily brief:** orders awaiting the next fulfilment step, overdue garments,
handoffs due today, completion-review returns and pickup/delivery readiness.

**Core journeys:** open order → understand promised next state → advance it;
open alteration → inspect operational history → record approved transition or
handoff; surface a blocker to the manager without gaining pricing or customer
relationship permissions.

### 6. Alteration-workshop manager

**Promise:** see workshop workload, due dates, evidence and cost decisions while
remaining isolated to the assigned workshop.

**Navigation:** Work queue and Workshop pricing only.

**Daily brief:** due/overdue garments, unassigned tasks, review-ready work,
rejected proposals and handoff readiness.

**Core journeys:** open assigned garment → review fitting brief/evidence →
assign worker/date → monitor task → submit evidenced price change → send for
completion review.

### 7. Alteration worker

**Promise:** know exactly what to do next on assigned garments and prove the
work cleanly.

**Navigation:** Work queue only.

**Daily brief:** assigned tasks ordered by target date, recently changed
instructions and review feedback.

**Core journey:** open garment → inspect fitting image/measurement/instruction →
start task → add private note/progress image → mark review-ready → understand
what is next. No unrelated client, price or retailer data is exposed.

### 8. Customer

**Promise:** a luxurious private-client relationship, not a self-service account
portal.

**Navigation:** Your world, Saved pieces, Recognition; Orders, Appointments,
Alterations; Your advisors, Invitations, Wedding parties, Updates; Preferences.
Public retailer storefront navigation remains Shop, appointments, events and
bag.

**Daily brief:** the single most relevant next moment—payment, appointment,
garment readiness, advisor reply or invitation—followed by relationship cards
and a considered product recommendation.

**Core journeys:** browse editorial catalogue → save/choose piece → order/pay →
track; request appointment → receive confirmation → prepare; message advisor;
track alteration to pickup; manage preferences; organize/join wedding party;
RSVP to private event.

## Shared interactive component and tool inventory

| Component/tool         | Purpose                                              | Required states                                          |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Editorial app shell    | Role identity, grouped navigation, mobile drawer     | active, hover, focus, reduced motion, narrow/long labels |
| Attention queue        | Ranked work with consequence and next action         | urgent, due soon, clear, loading, partial error          |
| Metric story           | Number + direction + explanation + destination       | positive, negative, neutral, unavailable                 |
| Timeline               | Immutable history and next milestone                 | current, completed, exception, actor, evidence           |
| Progress rail          | Order/appointment/alteration stage visibility        | current, completed, canceled, blocked                    |
| Relationship hero      | Client identity, lifecycle, preferences, next action | known, sparse, consent-restricted                        |
| Garment workspace      | Imagery, fitting brief, tasks, evidence, handoffs    | intake through pickup, worker-safe projection            |
| Day agenda             | Time-ordered appointments with preparation           | confirmed, requested, conflict, checked-in               |
| Command/search         | Find client, order, garment or route                 | idle, results, none, keyboard                            |
| Context drawer         | Act without losing workspace orientation             | open/close, validation, success, mobile full-screen      |
| Status badge           | Quiet semantic signal                                | neutral, attention, success, danger                      |
| Toast/inline result    | Consequence of mutations                             | pending, success, recoverable error                      |
| Empty-state guide      | Explain value and next permitted action              | first use, filtered empty, permission-limited            |
| Skeleton               | Preserve final geometry while loading                | text, card, image, chart                                 |
| Image gallery/uploader | Product and alteration evidence                      | loading, upload, progress, error, caption                |
| Chart                  | Decision-support trend, not decoration               | data, sparse, no data, accessible summary                |

## Screen inventory and route-by-route checklist

Every route must be checked at 1440×900 and 390×844, with keyboard focus and
primary mutation feedback. Dynamic routes use seeded records.

### PAON Admin

| Route               | Intended experience                                          | Status     |
| ------------------- | ------------------------------------------------------------ | ---------- |
| `/login`            | Editorial platform entry, clear access model and errors      | Foundation |
| `/accept-invite`    | Secure activation with visible progress and trust            | Baseline   |
| `/retailers`        | Network brief with health/attention, not a plain table       | Foundation |
| `/retailers/new`    | Guided retailer + owner onboarding                           | Baseline   |
| `/retailers/[id]`   | Retailer command record: identity, access, billing, activity | Baseline   |
| `/analytics`        | Platform pulse with interpreted trends and drill-through     | Baseline   |
| `/billing`          | Subscription exceptions and plan coverage                    | Baseline   |
| `/ai-monitoring`    | Failure/quality operations with recovery context             | Baseline   |
| `/demo-mode`        | Persona launcher, seed health and copyable credentials       | Baseline   |
| authenticated shell | Dark PAON rail, grouped active navigation, mobile drawer     | Foundation |

### Retailer Portal

| Route                                                                     | Intended experience                                         | Status                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------- |
| `/login`, `/accept-invite`                                                | Editorial entry and guided activation                       | Foundation / Baseline |
| `/dashboard`                                                              | Role-specific daily brief and day plan                      | Foundation            |
| `/customers`, `/customers/new`                                            | Client book and polished client capture                     | Baseline              |
| `/customers/[id]`                                                         | Rich relationship workspace with chronology and next action | Foundation            |
| `/appointments`, `/appointments/new`, `/appointments/[id]`                | Agenda, booking and service workspace                       | Baseline / Foundation |
| `/appointments/availability`                                              | Human-readable weekly capacity editor                       | Baseline              |
| `/orders`, `/orders/[id]`                                                 | Risk-aware fulfilment queue and progress record             | Baseline              |
| `/alterations`, `/alterations/new`                                        | Visual work queue and fitting-led intake                    | Foundation / Baseline |
| `/alterations/[id]`                                                       | Complete fitting-to-workshop garment workspace              | Baseline              |
| `/alterations/catalogue`                                                  | Retailer/workshop service-price workspace                   | Baseline              |
| `/alterations/workshops`                                                  | Workshop network and operational status                     | Baseline              |
| `/messages`, `/messages/[id]`                                             | Shared client inbox and relationship context                | Baseline              |
| `/notifications`                                                          | Actionable activity stream                                  | Baseline              |
| `/products`, `/products/new`, `/products/[id]`                            | Editorial catalogue and visual product editor               | Baseline              |
| `/collections`                                                            | Curated collection stories                                  | Baseline              |
| `/loyalty`                                                                | Program health, rewards and member value                    | Baseline              |
| `/events`, `/events/[id]`                                                 | Event portfolio, readiness and guest response               | Baseline              |
| `/wedding-parties`, `/wedding-parties/new`, `/wedding-parties/[id]`       | Group service command centre                                | Baseline              |
| `/analytics`                                                              | Commercial/service performance with explanation             | Baseline              |
| `/staff`, `/staff/new`, `/staff/roster`                                   | Team access, coverage and time                              | Baseline              |
| `/settings`, `/settings/brand`, `/settings/billing`, `/settings/payments` | Calm profile, validated identity and provider readiness     | Baseline / Foundation |
| authenticated shell                                                       | Role-specific PAON rail and mobile drawer                   | Foundation            |

### Customer Portal and storefront

| Route                                       | Intended experience                                          | Status     |
| ------------------------------------------- | ------------------------------------------------------------ | ---------- |
| `/login`, `/login?demo=1`                   | Private-client passwordless entry + deterministic demo entry | Foundation |
| `/dashboard`                                | Personal next moment and relationship world                  | Foundation |
| `/orders`, `/orders/[id]`                   | Purchase timeline, payment and delivery confidence           | Baseline   |
| `/appointments`, `/appointments/[id]`       | Upcoming experience and preparation                          | Baseline   |
| `/alterations`, `/alterations/[id]`         | Garment progress, imagery and pickup clarity                 | Baseline   |
| `/wishlist`                                 | Editorial saved selection                                    | Baseline   |
| `/loyalty`                                  | Recognition and attainable rewards                           | Baseline   |
| `/events`                                   | Private invitation portfolio and RSVP                        | Baseline   |
| `/wedding-parties`, `/wedding-parties/[id]` | Group plan and fitting readiness                             | Baseline   |
| `/messages`, `/messages/[id]`               | Advisor conversation with relationship context               | Baseline   |
| `/notifications`                            | Useful, deep-linked updates                                  | Baseline   |
| `/account`                                  | Preferences, delivery and privacy with confidence            | Baseline   |
| `/r/[slug]/products`                        | Image-led editorial catalogue                                | Baseline   |
| `/r/[slug]/products/[productSlug]`          | Immersive product detail and considered action               | Baseline   |
| `/r/[slug]/cart`                            | Calm, trustworthy checkout                                   | Baseline   |
| `/r/[slug]/appointments`                    | Appointment discovery and request                            | Baseline   |
| `/r/[slug]/events`                          | Public/private event discovery                               | Baseline   |
| `/r/[slug]/swipe`                           | Touch-first product discovery                                | Baseline   |
| `/r/[slug]/wedding-parties/join/[token]`    | Trustworthy group invitation join                            | Baseline   |
| authenticated shell                         | Private-client PAON rail, drawer and mobile priorities       | Foundation |

## Complete journey acceptance

Each journey is tested with the specified seeded persona and leaves visible
evidence in the next persona’s workspace.

1. **Platform onboarding:** platform admin creates retailer/owner → owner
   accepts → setup completion is visible to both.
2. **Client appointment:** customer requests → manager/advisor confirms and
   prepares → checks in/completes → customer sees history.
3. **Relationship follow-through:** advisor sees unread reply → opens rich
   client record → responds/records note → customer sees advisor response.
4. **Commerce:** customer browses/saves/orders → retailer advances fulfilment →
   customer sees a coherent progress story.
5. **Alteration:** advisor performs visual intake → manager assigns workshop →
   workshop manager assigns worker/date → worker adds progress and review-ready
   evidence → retailer approves/reviews → customer receives pickup readiness.
6. **Wedding party:** advisor creates party → organizer shares invite → member
   joins → staff updates fitting readiness → customer sees group progress.
7. **Event:** manager publishes invitation → customer RSVPs → retailer sees
   guest readiness/capacity.
8. **Exception:** failed payment/provider/price proposal appears in the correct
   attention queue with recovery guidance and no fake success.

## Desktop acceptance criteria

- Persistent role-specific navigation with current route, product/role context
  and no irrelevant destinations.
- Useful hierarchy at first viewport: title/context, attention or primary
  decision, then supporting information.
- Content uses available width intentionally; no universal narrow CRM column.
- High-value records combine imagery, status, history, people and contextual
  action without card nesting.
- Tables are used only when comparison is the job and remain keyboard-readable.
- All mutations have pending, success and recoverable error feedback.
- Focus order matches visual order; focus indicators remain unmistakable.

## Mobile acceptance criteria

- 390×844 is a first-class operating viewport; no horizontal navigation strip.
- Drawer/dock exposes only persona priorities and closes after navigation.
- Primary action remains reachable without obscuring content or safe areas.
- Timelines, forms and dense records become ordered sections with clear
  disclosure; no squeezed multi-column tables.
- Touch targets are at least 44px and do not depend on hover.
- Inputs use appropriate keyboard/autocomplete types and preserve entered data
  on validation error.
- Drawers/dialogs trap or naturally contain focus, close visibly and restore
  orientation.

## Baseline screenshot register

Screenshots must live under `docs/experience-baseline/` and be linked here only
after actual in-app-browser capture. Required first set:

| Persona/screen                            | Desktop | Mobile  | Capture status              |
| ----------------------------------------- | ------- | ------- | --------------------------- |
| Platform admin login + retailer network   | pending | pending | Blocked visual verification |
| Retailer owner login + dashboard          | pending | pending | Blocked visual verification |
| Retailer manager dashboard                | pending | pending | Blocked visual verification |
| Sales advisor dashboard + customer record | pending | pending | Blocked visual verification |
| Workshop manager queue + garment          | pending | pending | Blocked visual verification |
| Alteration worker queue + task            | pending | pending | Blocked visual verification |
| Customer login + dashboard + storefront   | pending | pending | Blocked visual verification |

No generated mock or source-code rendering may be inserted as baseline evidence.

## Implementation order

1. **Demo truth and entry.** Complete persona logins, idempotent rich data,
   persona launcher, editorial login/onboarding and browser baseline.
2. **Shells and role navigation.** Shared PAON rail/drawer, active route,
   role-specific information architecture and responsive content canvas.
3. **Attention dashboards.** Platform health; owner/manager/advisor day plans;
   workshop queue; worker tasks; private-client next moment.
4. **Highest-frequency operations.** Client record + appointment; alteration
   intake through worker review; conversation follow-through; order progress.
5. **Customer luxury journey.** Storefront/PDP/cart, customer dashboard,
   appointments, alterations, advisor messaging and account.
6. **Relationship programs.** Wedding parties, events, loyalty and wishlist.
7. **Configuration and intelligence.** Catalogue authoring, staff/roster,
   retailer settings, billing/payments, analytics and AI monitoring.
8. **Route closure.** Every remaining empty/loading/error/success state,
   desktop/mobile visual acceptance, full persona journey suite and final
   screenshot comparison.

After every coherent checkpoint: inspect desktop/mobile in the browser, run the
applicable persona E2E journeys and full repository verification, update this
document and `PROJECT_STATE.md`, then commit.
