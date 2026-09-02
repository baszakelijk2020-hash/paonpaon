# Atelier Demo Parity Test Plan

**Status:** active — governs any storefront port under Stage 20 /
`CUSTOMER_ENVIRONMENT_REBUILD_V3.md` §3.2.

The current raw Atelier Demo storefront (`/r/[slug]` route handler serving the
founder `paon-template.html`) is the **immutable** visual, motion, interaction
and perceived-speed specification. A shared-shell replacement must match it at
every checkpoint below or it is a failed port. This plan defines what "match"
means and how it is checked.

## 1. Frozen baseline (v1, 2026-08-26)

- Git SHA at capture: recorded in `../evidence/atelier-demo-baseline/README.md`.
- Screenshots: `../evidence/atelier-demo-baseline/v1-2026-08-26/screenshots/`
  (7 surfaces × desktop 1440×900 @2 DPR + mobile 390×844 @3 DPR).
- Capture metadata: `../evidence/atelier-demo-baseline/v1-2026-08-26/capture.json`.
- Data wiring / placeholders / route map: `../evidence/atelier-demo-baseline/v1-2026-08-26/data-wiring-inventory.md`.
- Interaction surface: `../evidence/atelier-demo-baseline/v1-2026-08-26/interaction-checklist.md`.
- Parity invariants P1–P9: `../evidence/atelier-demo-baseline/v1-2026-08-26/parity-checkpoints.md`.
- Capture spec (re-runnable): `apps/customer/e2e/atelier-demo-baseline.spec.ts`.

The baseline is append-only. A new capture goes in a new `vN-YYYY-MM-DD/`
directory; a published version is never edited.

## 2. Checkpoints the port must pass

### C1 — Static visual parity (per surface, per viewport)

- Full-page screenshot of the port vs the frozen baseline file.
- Pass: no difference in layout box model, spacing, grid columns, type
  (family, size, weight, tracking, line-height), colour tokens, image
  treatment (object-fit, aspect ratio, crop), border radius, or z-order.
- Fail triggers: clipping, crop/cover change, layout shift, hydration flash,
  scrollbar-driven reflow, missing/added element.
- Method: pixel diff with a small anti-alias tolerance; every mismatch region
  is triaged, none waived.

### C2 — Interaction parity

Exercise each item in `interaction-checklist.md` on the port and the raw route:

- category filter chips; product open/close; every drawer/modal; filters/sort;
  archetype/price selection; cart entry; account entry; TableService widget.
- Pass: same resulting DOM state, same URL, same focus behaviour, same
  scroll position handling.

### C3 — Motion parity

- Animation duration, easing curve, sequencing, and end state match the
  baseline. No added, removed, restarted, or re-timed animation.
- GSAP + ScrollTrigger scroll-driven reveals fire at the same scroll offsets.

### C4 — Navigation & history parity

- Back/Forward restore the same valid state (category, filter, sort, product,
  drawer, scroll) with no full reload and no wrong-tenant data.
- Deep links (`?category=`, product URL) land identically.

### C5 — Perceived-speed parity

- Click-to-visible timing for each interaction is ≤ the baseline value
  (record p50/p95, sample count, browser, viewport, network profile).
- First paint and category/product interaction not regressed vs baseline.
- Storefront-to-dashboard is explicitly **out of scope** for the ≤200ms
  customer-shell budget (PHASE.md 20.2 / plan §13).

### C6 — Console & network cleanliness

- No new console errors, no new 4xx/5xx responses during any checkpoint flow.

### C7 — Source-of-truth parity

- Port reads/mutates the same authenticated PAON repositories/RPCs for
  identity, retailer scope, catalogue, cart, saved products (no duplicate
  client-only business state).

## 3. Promotion rule

The raw `/r/[slug]` route stays the production fallback until **C1–C7 all pass**
on desktop and mobile, verified independently. Only then may the shared-shell
storefront replace it. Never inject the template via `dangerouslySetInnerHTML`;
never paper over the raw route with parallel/intercepting routes.

## 4. Re-baseline procedure

When the founder deliberately changes the Atelier Demo storefront:

1. Run `apps/customer/e2e/atelier-demo-baseline.spec.ts` pointed at a new
   `vN+1-YYYY-MM-DD/` output dir.
2. Record the new git SHA, diff the capture.json, note what changed and why.
3. Update this plan's §1 to point at the new version.
4. Re-run C1–C7 for any in-flight port against the new baseline.
