# Customer Environment Rebuild V3 — Locked Founder Contract

Status: active implementation contract  
Checkpoint: `30474bf` / `savegame/customer-overview-v2-20260825`  
Scope: customer environment only, plus the retailer-side endpoints strictly required to complete customer-initiated workflows.

## 1. Interpretation locks

These statements remove ambiguity. They override conflicting older redesign notes.

- Aviano is used only for the `NEBEL & SPIEGEL` brand logo. It is not a page-title, card-title, section-title, navigation, or body font.
- Page, section, product, and card titles use the previous Munged title face.
- Body copy uses `TN_Web_Use_Only_2`.
- Sidebar utility labels such as `Home`, `Collection`, and `How it works` use the real `GTBold3` font.
- No external garments exist in the customer wardrobe UI. Do not show an add-external-garment form, external-garment card, external provenance, or bought-elsewhere workflow.
- The wardrobe shows retailer catalogue/purchase-linked pieces only. Do not label them `Purchased here` and do not distinguish purchase location.
- Never use `house` as a customer-facing synonym for retailer, store, account, wardrobe, memory, update, or service.
- Progressive flows replace the current card face or current step. They do not append long forms below existing content.
- Do not create fake prices, fake products, fake orders, fake service confirmations, fake QR receipts, fake avatar results, fake routes, or dead buttons.
- Do not weaken production authentication, RLS, tenant checks, or staff authorization to make a demo or test pass.
- Do not invent new roles or broaden platform scope.

## 2. Already completed — preserve and verify

The checkpoint already contains:

- actual Aviano font route, scoped to the brand logo only;
- actual GTBold3 font route for sidebar utility labels;
- Munged restored for all ordinary titles;
- body font preserved;
- square, edge-to-edge top navigation cells;
- `Shop`, `Daily edit`, and `Messages` removed from top navigation;
- `Service` renamed `My Appointments`;
- `My Profile`, `Digital Fitting Room`, and `Rewards & Referrals` navigation entries;
- TableService entry in the left sidebar above Book Appointment;
- Book Appointment and TableService using 15px squircle corners;
- generic retailer promotional block, dark duplicate morning block, blue Today’s Edit block, and Overview Complete the Look removed;
- compact green local-context strip and OOTD immediately below it;
- forbidden external-garment form and copy removed from Wardrobe.

Do not redesign these again. Only repair a demonstrated defect against this contract.

## 3. Global customer shell

- Top navigation starts exactly at the right edge of the 250px sidebar and ends at the right viewport edge.
- Top navigation has no left/right outer margin, no gaps, and no rounded tab cells.
- Every visible tab shares the available width. Active state is calm and flat, not a pill.
- Desktop top navigation: Overview, Wardrobe, My Appointments, Orders, Digital Fitting Room, Rewards & Referrals, My Profile.
- Mobile navigation must preserve access to every destination through a compact overflow/menu; hiding a destination without another access path fails.
- CTA controls use one 15px squircle system unless a card-specific instruction below says otherwise.
- Do not build the interface from colourless white/transparent rectangles with only a grey border. That outline-card pattern is prohibited. Use purposeful tonal fills, imagery, gradients, spacing, and hierarchy; borders are separators, not the visual concept.
- The left sidebar retains its left-to-right dark gradient.
- `NEBEL & SPIEGEL` alone uses Aviano.
- Add automated checks for navigation labels, removed labels, font scoping, and route validity.

## 4. Overview

- Desktop local-context strip is no taller than 100px.
- Preserve date, local weather, local time, work address save, personal distance estimate, and world clocks in the strip.
- A real daily suit or jacket image appears in the rightmost area of the green strip. Use the real MorningRoutine selection; do not choose a decorative fallback product.
- OOTD begins immediately below the strip.
- OOTD uses the same real selection and real save/buy/appointment/advisor actions.
- OOTD contains no duplicate morning greeting block, no Today’s Edit explanation, no one-tap setup advertisement, no Complete the Look, and no generic retailer promotional panel.
- Product imagery must be visible, use `object-contain`, and never be clipped.
- Verify at 1512x982 and 390x844. At mobile width, all local-context functions remain reachable without forcing five tiny columns.

## 5. Wardrobe

### 5.1 Page structure

- Keep `Saved` and `Capsule`, but give the heading, description, and links deliberate spacing.
- Remove the standalone Virtual Studio panel; Digital Fitting Room is its own route.
- Remove the standalone lifecycle/fit-freshness/self-scan panel.
- Remove the standalone roadmap panel.
- Add the existing style-discovery quiz to Wardrobe as a concise invitation/module, not a giant inline form.
- The page background to the right of the sidebar continues the sidebar’s right-edge colour into a coherent left-to-right dark gradient.

### 5.2 Exactly eight rails

Render all eight rails in this order, even when empty:

1. Suits
2. Jackets
3. Trousers
4. Shirts
5. Outerwear
6. Knitwear
7. Shoes
8. Accessories

- A rail is a full-width horizontal slice with no rounded outer container.
- Each rail contains real owned cards, advisor-selection cards mapped to that category, then exactly ten empty slots.
- Header count is owned real items only. Advisor selections and empty slots are excluded.
- Cards are horizontally scrollable, responsive, snap cleanly, and use 10px gaps.
- Empty categories still show ten slots.

### 5.3 Owned card face

- 15px card corners.
- The entire original product image must remain visible at its natural aspect ratio. The foreground image uses edge-to-edge `object-contain`, no crop, no padding, and no artificial margin.
- Do not leave empty letterbox bands as plain white. Behind the contained foreground, render the same image as a full-bleed, softly blurred `object-cover` background layer with restrained opacity so the full original remains the primary image.
- The bottom information layer uses a progressive glass blur like an Apple App Store artwork card: no hard rectangular panel edge; blur and darkening rise gradually from transparent at mid-card to readable at the bottom.
- Implement the progressive layer with a masked/backdrop blur plus a transparent-to-approximately-30% dark gradient. Do not use a solid caption rectangle.
- Product title sits inside that progressive blur at the bottom, Munged, approximately 20px.
- Under the title, inside the same progressive blur: `Purchased on <date> · <N> days in your wardrobe` in body font. Use the real acquisition/order date. If unavailable, show `Purchase date unavailable`; do not invent one.
- No `Purchased here`, purchase location, care pills, condition pills, Garment Details, or provenance disclosure on the default card face.
- Footer control is exactly `Actions +`.

### 5.4 Owned-card progressive action deck

- Opening `Actions +` slides upward inside the fixed card height.
- It replaces/hides image title and metadata; it must not increase card or rail height.
- First screen is one vertical list:
  1. Complete the look
  2. Order again
  3. Book a repair
  4. Book an alteration
  5. Book a cleaning
  6. Request a fit-check in store
  7. Do a fit-check in app
  8. Retire
  9. Ask your advisor
- Selecting one item replaces the deck with that follow-up screen and a Back control.
- Complete the Look uses existing real category/item-specific suggestions.
- Order Again second screen is exactly: `The size is perfect`, `Request a fit-check in store`, `Do a fit-check in app`.
- Order Again also shows: `Has this garment been altered by another tailor? We recommend an in-store fit check so your current size can be updated.`
- `The size is perfect` opens the canonical real product/variant repurchase path. If the item lacks a product link, replace this option with `Ask your advisor to reorder`; do not create a broken route.
- In-store fit check opens the real appointment flow with item and reason preselected.
- In-app fit check replaces the deck with photo upload, notes, perceived fit, consent/status, and real submission. Self-scan exists only here.
- Repair, alteration, and cleaning create a real request through the existing tenant-safe customer-to-retailer workflow and expose the created confirmation/conversation.
- Retire requires an explicit confirmation screen before the existing retire action.
- Ask Your Advisor opens TableService with the garment card attached, the assigned advisor in the To field, and starter prompts `Complete the look` and `Request a fit-check`.

### 5.5 Advisor-selection cards

- Approved, unfilled roadmap items live in the correct top rail, never in a separate roadmap block.
- Use the same card proportions, image treatment, title font, and gradient as owned cards.
- Top-right pill reads `Advisor selection`.
- If a roadmap gap has no real product/image link, do not fabricate one; show the real gap title with a deliberate textile-neutral treatment.
- Actions are: Buy, Discuss with advisor, Proceed in store, Explore alternatives, Add to Digital Fitting Room, Remove from wardrobe plan.
- Buy requires a real linked product/variant.
- Discuss opens TableService with the selection attached.
- Proceed opens the appointment calendar with context.
- Alternatives shows real products in the same canonical category.
- Remove updates the real roadmap/selection state and requires confirmation.

## 6. My Appointments

- Page title and top tab are `My Appointments`.
- First show four clean inspiration cards, in chronological date order:
  1. September 2026 — Fall/Winter Wardrobe Appointment
  2. February 2027 — Spring/Summer 2027 Wardrobe Appointment
  3. April 2027 — Summer Holiday 2027 Wardrobe Appointment
  4. November 2027 — Holiday Season Look Appointment
- Cards start a booking flow; they are suggestions, not already-booked records.
- Birthday field stores the customer’s real birthday with consent and creates an invitation to book a birthday appointment/special-gift visit; it must not silently create a booking.
- Existing appointment cards are simplified to essential date, time, location, purpose, status, and one primary action.
- Appointment history is collapsed by default.
- New booking flow replaces one step with the next: reason -> location -> date -> time -> review -> confirmed.
- Reason choices: `In the mood for something fresh`, `A quick glance`, `Service — repair`, `Service — size check`.
- Location/date/time use real retailer branches, opening hours, and availability.

### 6.1 Paid-care services on My Appointments

- Entry cards: Dry-cleaning pickup, Shoe repair & maintenance, Alteration.
- Flow: service -> garment type -> quantity -> operation -> pickup/drop-off -> return method -> time window when applicable -> price review -> payment choice -> confirmation.
- Pickup/drop-off: home pickup, office pickup, store drop-off.
- Return: home delivery, office delivery, store pickup.
- Home/office exposes optional available-hour windows.
- Store exposes today’s opening hours immediately and `See all store hours` folded.
- Every operation shows its real configured price before selection. Reuse the existing alteration catalogue/price-list data. Do not hard-code guessed prices.
- Payment choice: pay now or pay at pickup. Both require explicit price/purchase confirmation.
- Confirmation sends a real email.
- QR receipt is generated only for store pickup. Home/office confirmations contain no QR.
- Retailer Mission Control scans the QR and opens the real service record, line items, handoff method, and payment status.
- Alteration branches: `I know exactly what needs changing`, `Ask advisor with self-scan`, `Assess in store`.
- Assess in store asks for a short service note, requests the customer bring the item, and shows a folded real price list. It does not force a product selection.

## 7. Orders

- Section order: Pending Orders first, then Order History.
- History is a complete purchase record even when products also appear in Wardrobe.
- Each order/item exposes real actions: Order again, Complete the look, Ask a question, Request service, View order/invoice.
- Supporting modules are compact and clearly separated: advisor selections, saved items, Complete the Look, seasonal staff favourites, Shop, Book in-store appointment, TableService.
- Complete the Look module shows the owned source item as a centred 70x70 squircle above a horizontal carousel of real suggestions.
- Do not duplicate the same product in multiple modules on the same viewport when data overlaps.

## 8. Digital Fitting Room

- Route is `/digital-fitting-room`; the top navigation link must never 404.
- This is the only main Virtual Studio surface.
- First screen clearly offers: build/approve avatar, add real wardrobe/advisor/catalogue items, create a look, view saved drafts/results.
- Avatar flow is concise and progressive: explanation -> required photo examples -> upload -> consent -> validation -> approved portrait.
- Explain in three short steps; avoid long walls of text.
- Only real wardrobe items, linked advisor selections, wishlist items, and catalogue products can populate a look.
- Drafts, jobs, statuses, failures, and results use the existing persisted outfit/visualization repositories.
- Never imply generated imagery guarantees physical fit.
- Wardrobe advisor-selection cards can add to this route with the selection preloaded.
- Canonical storefront product-detail third column includes a 15px-squircle module: `Try in Digital Fitting Room`, three short steps, and `Start creating`.
- The product CTA passes a canonical product ID/slug. Never substitute an ID where a slug is required.

## 9. Profile and Rewards

- Remove the entire customer-facing House Memory panel and all `House Memory` copy.
- Remove style-discovery quiz and Style Portrait/avatar setup from Profile.
- Style discovery lives in Wardrobe.
- Avatar/portrait setup lives in Digital Fitting Room.
- `Rewards & Referrals` renders the existing `/loyalty` implementation; do not create a duplicate rewards engine.

## 10. Test and proof gates

For every phase:

1. Keep the worktree clean before starting.
2. Change one bounded vertical flow.
3. Run focused unit/component tests.
4. Run customer typecheck and lint.
5. Seed local demo data if required; do not alter production identities.
6. Browser-test authenticated Isabelle at desktop 1512x982 and mobile 390x844.
7. Exercise every changed control through its real success/failure result.
8. Add E2E assertions for removed copy, route mappings, progressive deck replacement, eight rails, ten empty slots, real counts, and no external-garment entry.
9. Commit only after focused proof is green.

Before final completion run:

- full lint;
- full typecheck;
- all domain tests;
- all database unit tests;
- full local pgTAP;
- customer E2E for Overview, Wardrobe, Appointments, Orders, Digital Fitting Room, Profile, Rewards, TableService, and product-detail handoff;
- authenticated desktop and mobile visual review with screenshots and no console errors.

## 11. Security and migration gate

- Never edit an existing migration.
- Create a new timestamped migration only when persistent behavior cannot use existing tables/RPCs.
- Every new customer row is retailer/customer scoped and protected by RLS.
- Add owner, cross-customer, cross-retailer, anonymous, and wrong-role pgTAP cases.
- Never grant raw table access to bypass a validating RPC.
- Never recreate `20260825190000_fix_wardrobe_tenancy_trigger_security_definer.sql`.
- Do not add `SECURITY DEFINER` merely to make a test pass. If one is genuinely required, set an empty/safe search path, schema-qualify objects, revoke public execution, grant only named roles, and add explicit abuse tests.

## 12. Completion report

Do not say `done` because tests compile. Completion requires a report containing:

- exact commit SHAs per phase;
- exact routes tested;
- exact files changed;
- exact tests and pass counts;
- desktop/mobile screenshots;
- every real customer-to-retailer handoff exercised;
- any unavailable real pricing/data as an explicit blocker, never replaced by invented demo content.
