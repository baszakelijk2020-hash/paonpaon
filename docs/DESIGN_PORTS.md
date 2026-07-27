# Design Ports

Inventory of founder-designed surfaces and their porting status. **Tier 1 —
read this before touching any of them.** The governing rule is ADR-052 and
the porting rule in [../CLAUDE.md](../CLAUDE.md).

## The rule, in one line

Copy the original CSS, markup and JS byte-for-byte. Wire data through the
narrowest hook. Never re-express it in Tailwind or `@paon/ui`.

## Where the sources live

All committed to this repository already — no session needs to ask for
them, and no session has an excuse for approximating them.

| Source                                          | Contains                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/customer/app/r/[slug]/paon-template.html` | The storefront — the retailer's digital front door. **The product.**                          |
| `downloaded_pages/pag1.html`                    | Mission Control, fit tools, table service, globe, lapel, gift card, house party, monthly grid |
| `downloaded_pages/pag2.html`                    | Gift/voucher SaaS presentation module                                                         |
| `downloaded_pages/pag3.html`                    | Remaining recommendation-deck content                                                         |

`pag1`–`pag3` were written as a commercial recommendation to a supplier
that PAON is now independent of (see `NORTH_STAR.md`). They survive purely
as design specification.

## Status

"Wrong" means a component exists at that path but is a Tailwind rewrite
bearing no relationship to the founder's CSS. It must be replaced by a real
port, not patched.

| #   | Surface                    | Source id           | Implementation                                                         | Status                                          |
| --- | -------------------------- | ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Fit sliders (voice + drag) | `vox-widget-root`   | `apps/retailer/components/fit-tools/voice-measurement-slider.tsx`      | **Wrong** — 609 lines Tailwind, 1 ref to `vox-` |
| 2   | Silhouette carousel        | `nbs-silhouette-…`  | `apps/retailer/components/fit-tools/silhouette-carousel.tsx`           | **Wrong** — 186 lines Tailwind                  |
| 3   | Swipe deck                 | —                   | `apps/customer/app/r/[slug]/swipe/swipe-deck.tsx`                      | **Wrong** — 0 refs to founder CSS               |
| 4   | Table service chat         | `gilda-chat-widget` | `apps/customer/app/r/[slug]/table-service-widget.tsx`                  | Claimed byte-for-byte (ADR-048) — **verify**    |
| 5   | AM House Party orbit       | `#ow`               | `apps/customer/app/(dashboard)/wedding-parties/[id]/am-house-hero.tsx` | **Verify**                                      |
| 6   | Location globe (Cesium)    | `am-globe-widget`   | not built                                                              | Not started                                     |
| 7   | Lapel configurator         | `nbs-lapel-…-v4`    | not built                                                              | Not started                                     |
| 8   | Gift card 3D booklet       | `amibx-root-…`      | not built                                                              | Not started                                     |
| 9   | Monthly photo grid         | bottom of pag1      | not built                                                              | Not started                                     |
| 10  | Gift/voucher SaaS module   | pag2                | not built                                                              | Not started                                     |

## What a correct port looks like

The pattern is already proven in this repository — ADR-046/047/048 did it
for `paon-template.html` and the table-service widget.

1. **Copy the source verbatim** into a component file: the founder's `<style>`
   block, markup and script, unchanged. The widgets already self-scope via
   id/class prefixes (`vox-`, `nbs-`, `gcw-`, `amibx-`), so they do not leak.
2. **Add data hooks only.** A JSON injection point, a submit handler, a prop
   for the initial value. Nothing else.
3. **The only permitted deviations**, both of which must be noted in the
   component:
   - Accessibility fixes this repo's lint requires — a `<div onClick>`
     becomes a `<button>`, styled with inline resets so it is visually
     identical.
   - Removing hardcoded credentials. The Cesium globe embeds a live Ion
     access token; that must come from an environment variable.
4. **Do not** reformat it. `paon-template.html` is already exempt from
   prettier for this reason (`.prettierignore`); ported widget files should
   be treated the same way if prettier would rewrite them.

## Why this overrides the design-system rule

`CLAUDE.md` says never duplicate a component and always build from
`@paon/ui`. For everything PAON builds itself, that still holds. For these
surfaces it does not, and the trade is deliberate: the founder's designs are
the product's differentiator, they took months to make, and a session
following the design-system rule will faithfully destroy them. Consistency
with the design system is worth less than the design.

The cost is real and is accepted: these components sit outside the token
system, will not inherit theme changes automatically, and cannot be
restyled centrally. That is the price of keeping them exact.

## Scope warning

This inventory is ten surfaces, two of which (the Cesium globe and the
three.js gift-card booklet) carry heavy third-party dependencies and
ongoing cost. Porting all of them is months of work, and
[PHASE.md](./PHASE.md) sets the objective as three paid pilots.

Items 6, 7, 8 and 10 are **presentation modules for selling PAON**, not
product a retailer uses. They make the pitch prettier; they do not make a
retailer's store work. Items 1–5 and 9 are what a prospect sees when shown
their own store. Sequence accordingly, and do not start any of them without
a founder decision under `PHASE.md`.
