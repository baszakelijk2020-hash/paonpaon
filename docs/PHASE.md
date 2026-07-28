# Current Phase

**Read this first, every session. It overrides any older plan.**

Last set: 2026-07-27. If today is far past that date, ask before assuming
this is still current.

## The objective

Three paid pilot commitments from independent menswear retailers who sell
**only their own made-to-measure** — one label, no third-party stock. Money
down, not letters of intent, not enthusiasm.

Multi-brand retailers are the larger market and come second. Targeting
single-label MTM first is a deliberate choice to remove the biggest
prerequisite from the critical path: PAON has no `Brand` entity, and a
single-label retailer does not need one. Multi-brand is a roadmap item shown
to prospects, not infrastructure built before the first sale. See
`COMPETITIVE_GAPS.md`, "Multi-brand, deferred."

Everything else is subordinate to that. PAON already has more capability
than it has evidence anyone will pay for. The constraint is not engineering
capacity — it is proof.

## In scope — only these three

| #   | Workstream                                                       | Why it exists                                                  |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Storefront template — `apps/customer/app/r/[slug]`               | What a prospect actually judges                                |
| 2   | Demo Studio — `apps/admin/app/(dashboard)/prospects/[id]/studio` | The conversion instrument: their store, their name, in an hour |
| 3   | Marketing site — `apps/customer/app/(marketing)`                 | Survives the Google search after a cold email                  |

## Where things stand (2026-07-27)

**Done today.** Repository brought back under control: 21 stranded commits
and 130 uncommitted files pushed; CI switched on for the first time and made
green (stale Node pin, prettier parsing verbatim HTML, e2e gated to manual);
docs tiered so a session reads ~500 lines instead of 6,000; `AGENTS.md`
added so Codex loads the same charter as Claude; a stale handoff file that
told agents "do not stop" archived. Then the build audit (ADR-051) and the
verbatim-porting rule (ADR-052).

**Parked.** Fit tools — the `vox-` slider is ported correctly but the
feature needs an integration with each retailer's supplier ordering system.
See `DESIGN_PORTS.md`.

**Also done.** Design tokens now use `paon.html`'s real warm palette
(`#f4f1ec` / `#cdc9c2` / `#2a2925`) and OptimaKlein as the **body** face at
13px — an earlier version substituted a pure grey ramp and Inter, which is
the single largest reason the portals did not look like the founder's design.
Do not reintroduce that substitution.

**Blocked on founder design.** The alterations vertical. Everything under
`/alterations/*` was invented by an engineering session and carries none of
the founder's cues. The real product there is workshop work-order handling
and owner cost control, not fit correction. Do not build or extend it until
that design exists.

## Live right now

All three apps are deployed and confirmed responding (2026-07-28):

- <https://paonpaon-customer.vercel.app/r/maison-dubois> — founder's
  template, seeded production data.
- <https://paonpaon-admin.vercel.app/login>
- <https://paonpaon-retailer.vercel.app/login>

All connected to the hosted Supabase project, all deploy-on-push to `main`,
all have `NEXT_PUBLIC_DEMO_LOGIN=1` set for one-click persona login. Full
details, IDs and runbook: [DEPLOYMENT.md](./DEPLOYMENT.md), including a
footgun discovered while bringing these up (a stale root-level Vercel link
that redeployed the wrong project) and the stale duplicate `paon-*`
projects the founder has said to leave alone.

Queue item "a retailer logged into Mission Control alongside the
storefront" is done — the prerequisite for item 3 below is now just
populating the demo data, not deploying anything.

## Focus from 2026-07-28: workstreams 2 and 3

Workstream 1 is far enough. Ten demo-path screens carry the design language,
all three apps are live, the storefront works on real data. Almost all effort
so far went to workstream 1; the two that actually convert a prospect have
had none.

### A. Demo Studio — make a demo a real store, not a slideshow

**The defect.** `generateDemoEnvironment` in
`apps/admin/app/(dashboard)/prospects/[id]/studio/actions.ts` writes a
**hardcoded `syntheticData` object** — the same invented names, orders and
metrics for every prospect ("Isabelle Laurent", "PAON-1048", "€3,690").
It never creates a `Retailer`, never seeds a catalog, never touches the
product. Searching that file for `createRetailer`, `seedDemoData` or
`RetailerRepository` returns nothing. A prospect opening a demo link sees a
static mockup carrying a stranger's client names.

**What it should do**, using machinery that already exists and is proven
live: create a **real retailer tenant per prospect** — their name, logo,
colours and product photography via the existing
`RetailerBrandTheme` and `uploadBrandAsset` — seeded through
`seedDemoData`, and hand back two links: their storefront at `/r/{slug}`
and a one-click login to their Retailer Portal. `maison-dubois` is already
exactly this and is live; the Studio's job is to produce one per prospect,
under an access code and expiry.

**Sequence, one increment each:**

1. ~~Replace the `syntheticData` blob with a real seeded retailer tenant~~
   **Done** — real retailer per prospect from Studio config.
2. ~~Brand it: apply the prospect's `RetailerBrandTheme` and uploaded assets~~
   **Done** — theme applied on generate.
3. ~~Rework `/demo/[token]` to gate on access code and expiry, then route
   into the real storefront~~ **Done** — live `/r/{slug}` after access code.
4. ~~Teardown: expiring or unpublishing a demo must remove or disable its
   tenant~~ **Done** — linked retailer is `suspended` on unpublish and on
   expiry (daily via `/api/cron/dispatch-emails` + `open_prospect_demo`
   side-effect; Hobby has no spare cron slot); re-publish reactivates.
   `/r/{slug}` still only checks `status === "active"` — one gate, no
   demo logic on the storefront route.

**Also (workstream 1, founder-requested 2026-07-28).** Storefront chrome
fidelity vs `paon.html`: fabric swatches fill their container (`cover`),
favorites + basket sit in the retracting blur top bar (no floating bottom
basket), and **Book Appointment** slides up the same PDP fitting form
(location / date / time / name / email / message) instead of the old modal.
Dev: `route.ts` re-reads `paon-template.html` each request so template edits
show without restarting the customer app.

**Also (workstream 1, founder-requested 2026-07-28 — chrome UX).**

1. Favorites bookmark → real favorited items list (storefront localStorage
   panel; wander without sign-in).
2. Profile icon → customer portal environment straight away — no login /
   fitting popup. Guests may browse the portal look; sign in when they wish.
3. Basket popup and Ask us anything: same grey-gradient / glass language as
   the rest of the chrome. Ask us anything: `rgba(0,0,0,0.1)` + `blur(20px)`,
   rectangle with the same `6px` corner radius as Book Appointment; basket
   panel matches that radius.
4. Book Appointment: **500px** wide, full height, slides in from the **left**
   (not a full-width bottom sheet).
5. Filters: SuitSupply-style — sort (newest / price low–high / high–low) plus
   color, pattern, price range, season; Apply must actually filter the grid.

**The bar:** the founder can produce a branded, working demo for a named
prospect in under an hour without code changes. That is the original
commercialisation promise in `ROADMAP.md` and it is still unmet.

### B. Marketing site — proof, not a funnel

Correction to an earlier assessment: this is **not** three stub pages. The
homepage is a real commercial site with published pricing (Fused €349,
Half Canvas €749, Full Canvas from €1,750, plus implementation), role
explanations and working inquiry journeys. `consultation`, `pilot` and
`demo-request` are thin wrappers over a shared `commercial-page` and
interest form, not empty.

What it is missing is the thing `COMPETITIVE_GAPS.md` calls the most
convertible asset PAON has: **the founder**. There is no page saying who
built this, that he ran a private-label made-to-measure business inside
this exact segment, and that he spent a career in menswear. For a cold
approach to a 55-year-old owner-operator, that is the page that matters
most, and it does not exist.

1. ~~A founder page — who built PAON and why, in his own voice.~~ **Done** —
   `/founder` with the founder’s verbatim essay; cream / OptimaKlein prose
   column; CTA to demo-request and consultation. No invented social proof.
2. ~~Surface it from the homepage, above the feature sections.~~ **Done** —
   pull-quote strip before the feature grid; Founder in nav and footer.
3. Honest proof only. No invented testimonials, no logo wall, no "trusted
   by" — an empty social-proof section reads as "nobody uses this."
   Still open for any later proof work; the founder page deliberately
   ships without fake trust signals.

## The queue

Founder decision 2026-07-27: finish the build to a demonstrable state.
Ordered by what a prospect sees first. **Continuous mode (ADR-054,
2026-07-28):** build, self-verify, commit, push, and advance this queue
without waiting for founder review between increments. Still one coherent
commit at a time — the batching pause is gone; the small-commit discipline
is not.

1. **Stripe live.** Blocked on the founder provisioning credentials — no
   session can do this. Once `STRIPE_SECRET_KEY` is set, verify a real
   Connect onboarding and a real charge end to end. ADR-030 code is
   complete and has never executed.
2. **Resend live.** Same shape. `RESEND_API_KEY` set, then verify the outbox
   actually delivers.
3. ~~**A demo retailer that looks like a real store.**~~ **Done (local +
   production).** 68-SKU catalog with real photography; client-book history
   (orders/notes/appointments across the book); placeholder Broek/Shoes/Knit
   names replaced with retail copy; `seed-production.sh` re-run 2026-07-28
   so hosted Maison Dubois matches.
4. **Walk the whole flow on a phone and fix what breaks.** Storefront →
   account → appointment → order → loyalty. Fix only real breakage; resist
   redesigning on the way through. **Started 2026-07-28:** mobile storefront
   home / Pants / PDP / Book Appointment sheet load; Isabelle login →
   dashboard + loyalty work. **Fixed:** pants/shoes/knit display names now
   match product photography (earlier retail names were invented and
   mismatched — e.g. “Black Dress Trousers” on khaki). Production re-seeded
   again after the photo match. Still open: deeper cart→checkout path on
   phone.
5. **Demo-path visual and motion pass — UNBLOCKED, founder decision
   2026-07-27.**
   **`paon.html` is the design language for the entire product**, staff app
   included. Not pag1's Mission Control. One language across customer and
   retailer.

   Its actual vocabulary, sampled from
   `apps/customer/app/r/[slug]/paon-template.html` — use these values, do
   not invent adjacent ones:
   - **Surfaces**: `--cream #f4f1ec`, `--warm-mid #e8e4de`, `--mid #cdc9c2`,
     `--panel #0e0e0c`. Already in `packages/ui/src/styles/globals.css` as
     the stone scale.
   - **Ink**: body `--text #2a2925`, headline `--black #111110`, secondary
     `--muted #7a7870`.
   - **Type**: OptimaKlein at 13px base for body and headline. `GTBold3` at
     7px, uppercase, `#666666` for eyebrow/section labels
     (`.cat-section-heading`). No Inter anywhere.
   - **Chrome**: dark rail sidebar,
     `linear-gradient(to right, #333, #1a1a1a)`, 250px wide, 60px header
     row, logo in `Aviano` at 19px (`aside`, `#sidebar-logo`).
   - **Nav items**: `.cat-label` — OptimaKlein 13px, `#a6a6a6`, brightening
     to `#d9d9d9` on hover.
   - **Motion**: `cubic-bezier(.22,.61,.36,1)`, ~220ms.

   **Motion is part of the design, not decoration.** Sampled from the same
   file — use these, do not invent:
   - Easing: `cubic-bezier(.22,.61,.36,1)` (41 occurrences; the house
     curve). GSAP tweens use `expo.out`.
   - Durations: 0.2s for state flips, 0.62–0.72s for panel and view
     transitions, 1.0s for content reveals.
   - Content reveal, verbatim:
     `from { opacity: 0, y: 20, scale: 0.97, filter: 'blur(4px)' }` →
     `to { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }`, staggered
     ~120ms per card, `expo.out`.
   - Images fade from `opacity: 0; transform: scale(1.04)` to `1` on load.
   - Below-fold content is revealed by ScrollTrigger against the scrolling
     container, `start: 'top 95%'`, `once: true`.

   **Scope: the demo path only — these ten screens, in this order.** Founder
   decision 2026-07-27. The product has ~93 routes; a prospect sees about
   ten. Treating all 93 is a month of work, eighty of them for screens
   nobody will open before a paid pilot exists. Everything not on this list
   is explicitly deferred, including all of PAON Admin and the marketing
   site.

   | #   | Screen                | Route                                    |
   | --- | --------------------- | ---------------------------------------- |
   | 1   | Cart                  | `/r/[slug]/cart` (customer)              |
   | 2   | Checkout → confirm    | the flow after cart — no treatment today |
   | 3   | Product detail        | `/r/[slug]/products/[productSlug]`       |
   | 4   | Book appointment      | `/r/[slug]/appointments`                 |
   | 5   | Customer dashboard    | `/(dashboard)/dashboard` (customer)      |
   | 6   | Customer loyalty      | `/(dashboard)/loyalty` (customer)        |
   | 7   | Retailer dashboard    | `/(dashboard)/dashboard` (retailer)      |
   | 8   | Client list           | `/(dashboard)/customers` (retailer)      |
   | 9   | Client record         | `/(dashboard)/customers/[id]` (retailer) |
   | 10  | Retailer appointments | `/(dashboard)/appointments` (retailer)   |

   Cart and checkout come first because they are the weakest link: money
   changing hands is the moment a retailer decides whether this is real, and
   checkout has no design treatment at all today.

   **Primary buttons are `paon.html`'s black, not `--color-ink-*` — founder
   decision 2026-07-28, resolving the open question logged in
   `NIGHT_LOG.md`.** `--color-ink-500/600/700` are `oklch(… 265)` — a
   blue-tinted brand ink that predates the decision that `paon.html` is the
   design language. Every button in the founder's file uses `var(--black)`
   (`#111110`, i.e. `--color-stone-900`): `.drf-btn`,
   `.paon-appt-confirm`. Change `@paon/ui`'s primary Button default to
   `--color-stone-900` with `#f0efec` text, per `.paon-appt-confirm`.
   Retailer theming still layers `RetailerBrandTheme.accentColor` on top
   where a retailer has set one; the _default_ is the founder's black, not
   blue. This is a shared-component change — do it as its own increment and
   verify the cart, checkout and appointment screens after.

   **Date/time selection and forms are already designed — do not invent
   them.** `#paon-mobile-appointment` in the template is the appointment
   booking pattern, and it is what screens 4 and 10 must use. There is no
   calendar grid and no date-picker widget anywhere in this product; a
   horizontally scrolling strip is the design:
   - **Day strip** (`.calendar`): horizontal scroll, `gap: 10px`, scrollbars
     hidden, bleeding to the container edge via `margin: 0 -20px`.
   - **Day cell** (`.day`): 56×54px, `border-radius: 8px`, white,
     `opacity: .55` → `1` when `.selected`, `transition: opacity 200ms ease`.
     Inside: `.weekday` 9px uppercase `--muted` over `.date` 20px `--text`.
   - **Time slots** (`.paon-time-slot`): min-width 76px, height 38px,
     `border-radius: 6px`, white, same `.55 → 1` selection, `.disabled` at
     `.25` with pointer-events off.
   - **Inputs** (`#paon-appt-name`, `#paon-appt-email`): `padding: 12px 14px`,
     white, `1px solid var(--mid)`, `border-radius: 8px`, OptimaKlein 14px,
     placeholder `--muted`.
   - **Primary action** (`.paon-appt-confirm`): full width, 52px,
     `border-radius: 8px`, `background: var(--black)`, text `#f0efec`,
     OptimaKlein 14px uppercase, `letter-spacing: .04em`, disabled at `.55`.
   - **Headings**: `.paon-appt-heading` OptimaKlein 18px `--text`;
     `.paon-appt-sub` 12.5px `--muted`.

   That vocabulary — white cards on cream, 6–8px radii, opacity as the
   selection signal, 200ms ease — is the answer for most "there is no design
   for this" cases. Read the template before concluding something is
   missing; an earlier session wrongly assumed the date picker was absent.
   If something genuinely is not in the file, stop and ask rather than
   invent.

   One screen per increment. Do not restructure layout or change behaviour —
   this is a visual and motion pass, not a rebuild.

   When all ten are done, stop and report. Do not continue into the other
   83 routes without a new founder decision.

6. **AM House Party — customer-owned party planning. Founder spec
   2026-07-28.** Replaces the parked "orbit needs avatar data" question in
   `NIGHT_LOG.md` with the actual feature.

   **The journey.** A customer opens "Wedding parties" in the Customer
   Portal sidebar (already there), creates a party — participant names and
   photos, date, time, store location — then shares a public link. Whoever
   opens that link runs their own onboarding: their details, measurements,
   photo, everything needed to arrive prepared for the fitting party at the
   store. Staff manage the whole party from Mission Control.

   **Already built — do not rebuild:** `WeddingParty` (organizer,
   `eventDate`, `venueName`, status, notes, `inviteToken`),
   `WeddingPartyMember` (real `Customer` per member, role, fitting status),
   the public join route `/r/[slug]/wedding-parties/join/[token]`, the
   customer list and detail pages, the sidebar entry, and the full retailer
   management screens.

   **Genuinely missing:**
   - **The customer cannot create a party.** Only `apps/retailer` has a
     `/wedding-parties/new`. This is the largest gap and the first
     increment.
   - **Photos.** No photo field on member or party. Needed for the orbit
     visualisation and for the organizer's roster.
   - **Time and store location.** `eventDate` is a date with no time, and
     `venueName` is the _wedding_ venue, not which store the fitting happens
     at. Note `Location` is not modelled at all (deferred, ROADMAP Phase 1),
     so "store location" needs a founder decision: a free-text field now, or
     model `Location` properly.
   - **Member onboarding depth.** The join flow captures identity, not the
     preparation detail described above.

   **Architectural conflict to resolve before building the onboarding —
   surface it, do not work around it.** The founder's spec includes weight
   and height. ADR-016 deliberately _removed_ the generic customer
   measurement aggregate (`CustomerFitProfileEntry` is archived) on the
   grounds that fit data belongs to a `PhysicalGarment` via a
   `FittingObservation`, never to a customer record. Capturing weight and
   height on a wedding-party member reintroduces exactly what that ADR
   removed.

   **Resolved 2026-07-28.** Both hold, because they are not the same thing:
   self-reported height and weight given to prepare for a group fitting are
   **party-scoped coordination data**, not a fit profile. They exist so the
   store can pull roughly-right sample garments before six people walk in,
   and the real `FittingObservation` supersedes them the moment anyone is
   measured. So put them on `WeddingPartyMember`, never on `Customer`, and
   read them nowhere outside the party. ADR-016 stays intact — no
   customer-level measurement record is reintroduced. Record this reasoning
   as a short ADR in the same increment.

   **Sequence — decided, one increment each, in this order:**

   1. **Customer-side create.** `/wedding-parties/new` in `apps/customer`:
      name, date, time, store location (free text — `Location` is not
      modelled and this phase will not model it), notes. Mirror the existing
      retailer create action rather than inventing a second shape.
   2. **Share the link.** `inviteToken` already exists — surface a
      copy-to-clipboard share affordance on the organizer's party page. No
      domain work; this is the step that makes the feature spread.
   3. **Mission Control pass.** The retailer screens exist — verify against
      the real flow and apply the `paon.html` visual pass.
   4. **Time and store location.** Add `eventTime` and `fittingLocation` to
      `WeddingParty` (`eventDate` is date-only; `venueName` is the wedding
      venue, not the shop). Migration + domain change.
   5. **Photos.** Add `photoUrl` to `WeddingPartyMember` plus a party cover.
      Reuse the proven upload path — `product-images` bucket and
      `product-image-uploader.tsx` are the pattern; add a `party-photos`
      bucket with the same RLS shape. Do not invent a new upload mechanism.
   6. **Join-flow onboarding depth.** Extend
      `/r/[slug]/wedding-parties/join/[token]` to capture role, contact,
      photo and the party-scoped height/weight, with the ADR above.
   7. **The orbit.** `am-house-hero.tsx` last — it can only be finished once
      member photos exist, which is why it was parked.

   Steps 1–3 need no schema change and make the feature usable end to end;
   land those first. Steps 4–6 each touch the domain — state the plan and
   stop before writing each one.

7. **Re-port the wrong widgets** — silhouette carousel, swipe deck — per
   [DESIGN_PORTS.md](./DESIGN_PORTS.md), and verify the two unverified ones
   (table service, house party orbit).

Not in the queue and not to be started: fit tools (parked), the alterations
vertical (awaiting founder design), and the four presentation modules —
globe, lapel configurator, gift-card booklet, pag2 vouchers.

## Two questions to answer before building

Both come from the build audit in `DECISIONS.md` ADR-051. Neither is
rhetorical; work is gated on them.

**1. Is `paon-template.html` a demo artifact or the product? — ANSWERED
2026-07-27: it is the product.** It is the retailer's digital front door,
the thing PAON sells on subscription, and the artifact that started this
venture. It is therefore maintained as canonical design source, ported
verbatim, and never re-expressed in `@paon/ui` — see
[DESIGN_PORTS.md](./DESIGN_PORTS.md) and ADR-052. The same applies to every
surface designed in `downloaded_pages/pag1–3.html`.

**1b. Which design language does the staff app use? — ANSWERED 2026-07-27:
`paon.html`, for the entire product.** pag1's Mission Control is not the
target. See queue item 5 for the sampled vocabulary.

**2. Which wedge is actually being sold?** A prettier storefront is
aesthetic. Control over third-party alteration cost — the alterations
vertical, already the deepest thing built — is financial. Neither has been
tested with a real retailer. Two phone calls asking which they would pay
for costs nothing and could redirect the whole build.

## Foundation work, in scope by exception

These are not one of the three workstreams but are authorised by ADR-051
because they serve this phase directly:

- **Provision Stripe.** The objective is retailers with money down. PAON
  cannot currently accept money — the payment code (ADR-030) exists but has
  never run, because credentials were never provisioned.
- **Connect Vercel to git.** Deploys are currently manual CLI archive
  uploads with no git integration, so there is no per-change preview URL.
  The conversion instrument is sending a prospect a link; this is the
  infrastructure that makes that routine.

## Out of scope

Everything else — including work that fits the architecture perfectly,
closes a documented gap, or completes a roadmap phase.

`ROADMAP.md` and `COMPETITIVE_GAPS.md` are **not work queues during this
phase.** They are reference. Reading them is not permission to build from
them.

If asked to build outside the three workstreams: say it falls outside the
freeze, and ask. Do not build it quietly because it seemed reasonable.

## The test for any change

> Does this make a retailer more likely to put money down?

If not, it waits. This narrows what gets built. It does not lower the
quality bar for what does — the rules in `CLAUDE.md` and `PRINCIPLES.md`
apply in full.

## Stop and ask (hard stops only)

Founder decision 2026-07-28: continuous mode. Do **not** stop between
increments for review. Build, self-verify, commit, push, advance this
queue. Stop and ask only when:

- The work would touch anything outside the three workstreams.
- Credentials only the founder can provision are required (Stripe, Resend).
- You are about to contradict an ADR in `DECISIONS.md` without recording
  a new ADR.

Autonomy inside the freeze is the goal. Uncommitted finished work is not.

## End every session committable and pushed

No throwaway spec files, no temporary routes, no scratch artifacts. Name
temporary files `_tmp-*` so `.gitignore` catches them. Commit and push what
was worth writing; delete what was scaffolding.

Uncommitted work is unreviewable and unrevertable. At the point this phase
began there were 21 unpushed commits and 130 uncommitted files. Continuous
mode fixes that by shipping smaller commits more often — not by leaving a
pile on the laptop.

## Definition of done, this phase

```
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

All six green — this is exactly what CI runs. Stop `pnpm dev` first;
rebuilding `.next` under a live dev server has corrupted it before.

Then report a **Test it** section per `CLAUDE.md`: exact local URL, port,
prerequisites, auth path, and what was already verified automatically.
