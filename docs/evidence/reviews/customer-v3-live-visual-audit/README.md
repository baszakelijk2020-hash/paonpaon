# Customer environment — live V3 visual audit

Independent authenticated desktop + mobile visual review of the customer
environment against `docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md`
("Customer Environment Rebuild V3 — Locked Founder Contract").

This directory is review evidence only. No application code, tests, PHASE.md,
queue files, or dirty files were changed. Every "next implementation scope"
below is a recommendation for a later, separately-scoped slice.

**Supersedes** the blocked prior attempt recorded in `ed53acf`
(`REPORT.md` + `*-auth-blocked.png`), which could not authenticate and hit
local `.next` manifest failures. Both blockers were resolved for this run
(clean `next build`; local demo sign-in via the repo `seed:demo`), so the
blocked report and its error-page screenshots are removed and replaced by
the authenticated captures here.

## Method

- **Branch / SHA audited:** `release-integration-lane-h` @ `d0a41a0`
  (production build produced during this session; a small number of commits
  may post-date the compiled bundle — the surfaces audited are stable V3
  screens and were not touched by those commits).
- **App:** `apps/customer`, real `next build` + `next start -p 3102`
  (production bundle, not dev).
- **Auth:** magic-link sign-in as the seeded demo customer
  `contact+isabelle@nebelspiegel.com` (retailer `atelier-demo`, "Isabelle
  Laurent").
- **Data:** local Supabase, populated with the repository's own
  `pnpm --filter @paon/database seed:demo`. To let that seeder touch the
  pre-existing local Isabelle auth users it does not "own", their local
  `auth.users.raw_app_meta_data.demo_seed` flag was set to `true` — a
  local-only demo-identity marking, no schema/migration/production change.
  Post-seed Isabelle has: 2 orders, 2 wardrobe items, 3 appointments, 1
  MorningRoutine selection, loyalty account with points/badges.
- **Viewports:** desktop `1512x982`, mobile `390x844` (contract §10.6).
- **Routes captured (14 screenshots):** `/dashboard`, `/wardrobe`,
  `/appointments`, `/orders`, `/loyalty` (nav label "Rewards & Referrals",
  requested as `/rewards`), `/account` (nav label "My Profile"),
  `/digital-fitting-room` — each at both viewports.
- **HTTP status:** all 14 routes returned `200`.
- **Console errors:** `0` on all 14 routes (see `_capture-summary.json`).
- **Capture harness:** scratchpad script (not committed); screenshots are
  full-page.

## Severity scale

- **HIGH** — explicit interpretation-lock / §1 violation, or a broken/fake
  surface.
- **MEDIUM** — a stated §3–§9 layout/behaviour requirement is visibly unmet.
- **LOW** — polish, coherence, or dead-space issue against §3's intent.

## Findings

| #   | Severity   | Route(s)                                                   | Screenshot(s)                                                           |
| --- | ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| F1  | HIGH       | /loyalty (rewards)                                         | `rewards--desktop.png`, `rewards--mobile.png`                           |
| F2  | MEDIUM     | /loyalty, /orders, /appointments, /account                 | `rewards--*`, `orders--*`, `appointments--*`, `account--*`              |
| F3  | MEDIUM     | /dashboard                                                 | `dashboard--desktop.png`, `dashboard--mobile.png`                       |
| F4  | MEDIUM     | /dashboard (mobile)                                        | `dashboard--mobile.png`                                                 |
| F5  | MEDIUM     | /wardrobe                                                  | `wardrobe--desktop.png`, `wardrobe--mobile.png`                         |
| F6  | MEDIUM     | /digital-fitting-room                                      | `digital-fitting-room--desktop.png`, `digital-fitting-room--mobile.png` |
| F7  | MEDIUM     | /appointments                                              | `appointments--desktop.png`, `appointments--mobile.png`                 |
| F8  | LOW        | /orders                                                    | `orders--desktop.png`, `orders--mobile.png`                             |
| F9  | LOW–MEDIUM | /appointments, /account                                    | `appointments--*`, `account--*`                                         |
| F10 | LOW        | /dashboard, /appointments, /account, /digital-fitting-room | `*--desktop.png`                                                        |
| F11 | LOW        | all (persistent sidebar)                                   | `dashboard--desktop.png`, `wardrobe--desktop.png`                       |
| F12 | LOW        | /dashboard                                                 | `dashboard--desktop.png`, `dashboard--mobile.png`                       |

---

### F1 — "house" used as a customer-facing synonym for the retailer

- **Severity:** HIGH
- **Route(s):** `/loyalty` (nav "Rewards & Referrals"), desktop + mobile.
- **Screenshot(s):** `rewards--desktop.png`, `rewards--mobile.png`.
- **Violated requirement:** §1 — "Never use `house` as a customer-facing
  synonym for retailer, store, account, wardrobe, memory, update, or
  service."
- **Observed:** the "Tailoring milestones" entry and the corresponding badge
  both render the title **"Return to the house"** (visible 2–3× per
  viewport, including the badge caption and the milestone card heading).
- **Likely source file:** `packages/domain/src/loyalty/loyalty-milestones.ts`
  (line ~113: `repeat_order: "Return to the house"`); surfaced by the
  customer loyalty page (`apps/customer/app/(dashboard)/loyalty/`).
- **Safe next implementation scope:** rename the `repeat_order` milestone
  label to retailer-neutral copy (e.g. "A returning client") and grep the
  same file + its descriptions for any other `house` strings; update
  `packages/domain/src/loyalty/loyalty-milestones.test.ts` expectations.
  Domain copy + unit-snapshot only — no schema, RLS, or loyalty-engine
  change.

### F2 — Prohibited "outline-card" pattern on several surfaces

- **Severity:** MEDIUM
- **Route(s):** `/loyalty`, `/orders`, `/appointments`, `/account`
  (desktop + mobile).
- **Screenshot(s):** `rewards--desktop.png`, `rewards--mobile.png`,
  `orders--desktop.png`, `orders--mobile.png`, `appointments--desktop.png`,
  `appointments--mobile.png`, `account--desktop.png`, `account--mobile.png`.
- **Violated requirement:** §3 — "Do not build the interface from
  colourless white/transparent rectangles with only a grey border. That
  outline-card pattern is prohibited. Use purposeful tonal fills, imagery,
  gradients, spacing, and hierarchy."
- **Observed:** the loyalty badges grid, the loyalty outer panel, the Orders
  "Keep going" module grid, the Appointments "Next appointment" card and
  "Appointment history" bar, and the entire Account preferences card are
  white/transparent fills bounded only by a hairline grey border/rule, with
  no tonal fill, imagery, or gradient hierarchy. (By contrast the
  Appointments inspiration cards and paid-care cards on the same page use
  the correct tonal/gradient treatment — so the language exists in the
  codebase and is simply not applied here.)
- **Likely source file(s):**
  `apps/customer/app/(dashboard)/loyalty/page.tsx` and its badge/milestone
  card components; `apps/customer/app/(dashboard)/orders/page.tsx` ("Keep
  going" grid); `apps/customer/app/(dashboard)/appointments/page.tsx`
  (next-appointment + history); `apps/customer/app/(dashboard)/account/page.tsx`.
- **Safe next implementation scope:** one surface per slice — replace the
  bare `border` containers with the established tonal panel treatment
  (`.customer-panel` fills / gradient section headers already used by the
  inspiration + paid-care cards). ClassName / CSS only; no data or route
  change.

### F3 — Local-context weather never renders a value

- **Severity:** MEDIUM
- **Route(s):** `/dashboard`, desktop + mobile.
- **Screenshot(s):** `dashboard--desktop.png`, `dashboard--mobile.png`.
- **Violated requirement:** §4 — "Preserve date, local weather, local time,
  work address save, personal distance estimate, and world clocks in the
  strip." Also §3.1 — each context slice must distinguish
  unavailable/loading/ready/stale/error.
- **Observed:** the weather cell shows only a sun glyph and an empty em
  dash ("—") on both viewports; no temperature or condition, and no
  "unavailable / grant location" affordance. (Fixture location consent is
  denied, but a blank dash is not a defined degraded state.)
- **Likely source file:** the dashboard local-context strip component under
  `apps/customer/app/(dashboard)/dashboard/` (the component targeted by
  `apps/customer/e2e/dashboard-v3-daily-return.spec.ts` via
  `getByText("Local context")`).
- **Safe next implementation scope:** give the weather slice an explicit
  empty/denied/loading render (e.g. "Weather unavailable" or a
  location-permission prompt). Presentation + slice-state only.

### F4 — Mobile local-context strip drops world clocks and the daily image

- **Severity:** MEDIUM
- **Route:** `/dashboard`, mobile only.
- **Screenshot:** `dashboard--mobile.png` (compare `dashboard--desktop.png`).
- **Violated requirement:** §4 — "…and world clocks in the strip"; "A real
  daily suit or jacket image appears in the rightmost area of the green
  strip"; "At mobile width, all local-context functions remain reachable
  without forcing five tiny columns."
- **Observed:** the desktop strip shows an "Elsewhere" world-clock block
  (New York / London / Dubai / Hong Kong / Tokyo / Sydney) and a small
  daily jacket thumbnail. The mobile strip omits both entirely — they are
  not relocated elsewhere in the stacked strip.
- **Likely source file:** same local-context strip component; its
  responsive breakpoint hides those two blocks below `sm`.
- **Safe next implementation scope:** at ≤390px keep the world clocks
  (compact two-column or horizontally scrollable) and the daily image
  reachable inside the stacked strip. Responsive CSS only.

### F5 — Owned wardrobe card missing the blurred full-bleed background layer

- **Severity:** MEDIUM
- **Route(s):** `/wardrobe`, desktop + mobile.
- **Screenshot(s):** `wardrobe--desktop.png`, `wardrobe--mobile.png`.
- **Violated requirement:** §5.3 — "Do not leave empty letterbox bands as
  plain white. Behind the contained foreground, render the same image as a
  full-bleed, softly blurred `object-cover` background layer with restrained
  opacity so the full original remains the primary image."
- **Observed:** the two owned "Suits" cards render the `object-contain`
  product image correctly, but the area beside/behind it is the flat dark
  card surface — no softly-blurred `object-cover` duplicate of the product
  image is present. (The bottom progressive-blur title band and "Purchase
  date unavailable" / "Actions +" footer are present and correct.)
- **Likely source file:**
  `apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx` (owned card
  face; card container class defined ~line 100).
- **Safe next implementation scope:** add the blurred `object-cover`
  background image layer behind the contained foreground in the owned-card
  component. Presentation only; reuses the same image URL already bound.

### F6 — Digital Fitting Room first screen omits "view saved drafts/results"

- **Severity:** MEDIUM
- **Route(s):** `/digital-fitting-room`, desktop + mobile.
- **Screenshot(s):** `digital-fitting-room--desktop.png`,
  `digital-fitting-room--mobile.png`.
- **Violated requirement:** §8 — "First screen clearly offers: build/approve
  avatar, add real wardrobe/advisor/catalogue items, create a look, view
  saved drafts/results."
- **Observed:** the first screen offers the three explanatory steps and a
  single "Start creating →" CTA. There is no visible entry to existing
  drafts / jobs / results for a returning user. (The physical-fit
  disclaimer required by §8 and §228 IS present — good.)
- **Likely source file:**
  `apps/customer/app/(dashboard)/digital-fitting-room/page.tsx`.
- **Safe next implementation scope:** add a "Saved looks / drafts" entry on
  the first screen backed by the existing persisted
  outfit/visualization repositories (read-only list, empty state when
  none). No new persistence.

### F7 — "Next appointment" card has no primary action

- **Severity:** MEDIUM
- **Route(s):** `/appointments`, desktop + mobile.
- **Screenshot(s):** `appointments--desktop.png`, `appointments--mobile.png`.
- **Violated requirement:** §6 — "Existing appointment cards are simplified
  to essential date, time, location, purpose, status, and one primary
  action."
- **Observed:** the "Next appointment / Fitting / Confirmed" card shows
  date, time, location, purpose and status, but exposes no primary action
  control (no View / Reschedule / Directions).
- **Likely source file:**
  `apps/customer/app/(dashboard)/appointments/page.tsx` (next-appointment
  card).
- **Safe next implementation scope:** add exactly one primary action wired
  to the existing appointment flow. Component-only.

### F8 — Orders "Keep going" is missing the "seasonal staff favourites" module

- **Severity:** LOW
- **Route(s):** `/orders`, desktop + mobile.
- **Screenshot(s):** `orders--desktop.png`, `orders--mobile.png`.
- **Violated requirement:** §7 — supporting modules must include "advisor
  selections, saved items, Complete the Look, **seasonal staff
  favourites**, Shop, Book in-store appointment, TableService."
- **Observed:** the "Keep going" grid shows Advisor selections, Saved items,
  Complete the Look, Shop, Book in-store appointment, TableService —
  "seasonal staff favourites" is absent.
- **Likely source file:** `apps/customer/app/(dashboard)/orders/page.tsx`.
- **Safe next implementation scope:** add the seasonal staff-favourites tile
  linking to the existing staff-picks data source; if none exists, record a
  data blocker rather than fabricate content (§1, §12). Component-only.

### F9 — No birthday + consent field in the customer environment

- **Severity:** LOW–MEDIUM
- **Route(s):** `/appointments`, `/account`, desktop + mobile.
- **Screenshot(s):** `appointments--desktop.png`, `appointments--mobile.png`,
  `account--desktop.png`, `account--mobile.png`.
- **Violated requirement:** §6 — "Birthday field stores the customer's real
  birthday with consent and creates an invitation to book a birthday
  appointment/special-gift visit; it must not silently create a booking."
- **Observed:** no birthday input or associated consent is visible on the
  Appointments page (its most likely home) or on the Profile page in the
  captured states.
- **Likely source file:**
  `apps/customer/app/(dashboard)/appointments/page.tsx` (intended home) or
  `apps/customer/app/(dashboard)/account/page.tsx`.
- **Safe next implementation scope:** frontier must first confirm whether a
  persisted birthday column/consent already exists (customer profile
  schema) before any migration; then add the field + explicit consent that
  creates a **booking invitation**, not a booking, through the existing
  customer→retailer flow.

### F10 — Large unresolved dead-space below primary content

- **Severity:** LOW
- **Route(s):** `/dashboard`, `/appointments`, `/account`,
  `/digital-fitting-room` (most visible at desktop `1512x982`).
- **Screenshot(s):** `dashboard--desktop.png`, `appointments--desktop.png`,
  `account--desktop.png`, `digital-fitting-room--desktop.png`.
- **Violated requirement:** §3 — "Use purposeful … spacing, and hierarchy"
  (the environment should not read as unfinished). The V3 removals of
  promo/Today's-Edit/Complete-the-Look blocks are correct, but nothing
  deliberate replaces them.
- **Observed:** each page's content stops well short of the viewport with a
  large blank band beneath and no closing/footer treatment.
- **Likely source file:** the per-route page components' outer layout
  containers, `apps/customer/app/(dashboard)/*/page.tsx`, and the dashboard
  shell layout.
- **Safe next implementation scope:** give each route a deliberate bottom
  resolution (spacing scale, quiet footer, or contextual content).
  Layout/CSS only.

### F11 — Sidebar collection labels diverge from the wardrobe taxonomy

- **Severity:** LOW
- **Route(s):** all (persistent left sidebar); clearest on
  `dashboard--desktop.png`, `wardrobe--desktop.png`.
- **Violated requirement:** §1 / §3 — category naming coherence; the
  wardrobe rails are "Trousers" and "Knitwear" (§5.2).
- **Observed:** the left sidebar lists "Suits / Jackets / **Pants** /
  **Knits** / Shoes" while the Wardrobe rails and the rest of the
  environment use "Trousers / Knitwear".
- **Likely source file:** the customer shell sidebar/nav component under the
  `apps/customer/app/(dashboard)` layout (collection links).
- **Safe next implementation scope:** align the sidebar labels to the
  canonical taxonomy (Trousers, Knitwear). Copy-only. Frontier must first
  confirm these labels are not derived from storefront category slugs — if
  they mirror storefront categories, that is storefront-source territory and
  out of scope here.

### F12 — "Your location" label duplicated in the local-context strip

- **Severity:** LOW
- **Route:** `/dashboard`, desktop + mobile.
- **Screenshot(s):** `dashboard--desktop.png`, `dashboard--mobile.png`.
- **Violated requirement:** §3 / §4 — strip clarity and hierarchy.
- **Observed:** "Your location" appears twice — once under the date and once
  under the weather glyph.
- **Likely source file:** the dashboard local-context strip component.
- **Safe next implementation scope:** drop the redundant label.
  Presentation only.

---

## Verified conformant (no defect)

- **Top navigation** (all routes): exactly 7 tabs in the contract order —
  Overview, Wardrobe, My Appointments, Orders, Digital Fitting Room,
  Rewards & Referrals, My Profile; edge-to-edge from the 250px sidebar to
  the right edge; square cells; calm flat active state (not a pill). §3.
- **Mobile navigation:** compact "More" overflow preserves the non-primary
  destinations. §3.
- **CTA squircle system:** OOTD, appointment, loyalty, DFR and profile CTAs
  render the single 15px squircle (phase-20.25). §3.
- **Wardrobe:** exactly eight rails in the contract order (Suits, Jackets,
  Trousers, Shirts, Outerwear, Knitwear, Shoes, Accessories); header counts
  are owned-items-only ("2 pieces" / "0 pieces"); "Purchase date
  unavailable" shown rather than invented; "Actions +" footer control;
  concise style-quiz invitation module; no Virtual Studio / lifecycle /
  roadmap panels; dark left-to-right gradient background. §5.1–§5.3.
- **My Appointments:** title and tab "My Appointments"; four "Suggestions to
  book" inspiration cards in exact contract order and wording (Sept 2026
  Fall/Winter, Feb 2027 Spring/Summer, Apr 2027 Summer Holiday, Nov 2027
  Holiday Season); "START BOOKING" — suggestions, not booked records;
  paid-care entries exactly Dry-cleaning pickup / Shoe repair & maintenance
  / Alteration; appointment history collapsed by default. §6, §6.1.
- **Orders:** Pending Orders section before Order History; per-order actions
  exactly Order again / Complete the look / Ask a question / Request service
  / View order · invoice; Complete-the-Look module shows the source item as
  a centred squircle above the (honestly empty) carousel; no fabricated
  pairings. §7.
- **Rewards & Referrals:** renders the existing `/loyalty` implementation
  (no duplicate rewards engine); real points/tier/badges/rewards/referral.
  §9. (Copy defect F1 notwithstanding.)
- **My Profile:** no House Memory panel and no "House Memory" copy; no
  style-discovery quiz; no Style Portrait / avatar setup — preferences
  only. §9.
- **Digital Fitting Room:** `/digital-fitting-room` resolves (200, no 404
  from the nav link); three short explanatory steps; explicit
  "A visualisation is never a guarantee of physical fit" disclaimer. §8.
- **Stability:** all 14 route loads returned HTTP 200 with zero console
  errors.

## Not assessable from a static visual capture

These need targeted behavioural/E2E proof, not a screenshot audit, and are
called out so they are not mistaken for "passed":

- Exactly ten empty slots per wardrobe rail (rails are horizontally
  scrollable; only ~2–6 slots are in frame). Covered by PHASE 20.26.
- Owned-card progressive "Actions +" deck: upward slide within fixed card
  height, screen-replacement, Back control, per-action follow-ups. §5.4.
- Advisor-selection card treatment and "Advisor selection" pill — the
  fixture customer has no roadmap/selection rows. §5.5.
- Warm customer-to-customer navigation: no shell remount / no full reload,
  and the ≤200ms p95 transition budget. §3.1, §10.
- New-booking and paid-care flows (reason → location → date → time → review
  → confirmed; service → … → confirmation; QR only for store pickup). §6,
  §6.1.
- Font scoping (Aviano only on the `NEBEL & SPIEGEL` logo; GTBold3 on
  sidebar utility labels; Munged titles; TN body) — plausible in the
  captures but not pixel-verified here. §1, §2.
