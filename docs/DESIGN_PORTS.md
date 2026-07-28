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

| #   | Surface                    | Source id                           | Implementation                                                            | Status                                                                                                                                                                            |
| --- | -------------------------- | ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fit sliders (voice + drag) | `vox-widget-root`                   | `apps/retailer/components/fit-tools/vox-fit-slider.tsx` + `vox-source.ts` | **Ported, then PARKED** 2026-07-27 — see "Parked: fit tools" below                                                                                                                |
| 2   | Silhouette carousel        | `nbs-silhouette-…`                  | `apps/retailer/components/fit-tools/silhouette-carousel.tsx`              | **Wrong** — 186 lines Tailwind, and its only render site is `/alterations/*` — see open question in `NIGHT_LOG.md` 2026-07-28                                                     |
| 3   | Swipe deck                 | `swipe-app-placeholder` (pag1.html) | `apps/customer/app/r/[slug]/swipe/swipe-deck.tsx`                         | **Ported** 2026-07-28 — verbatim CSS/dimensions from pag1's `munro-swipe-card` widget, real product data through the existing `SwipeCard[]` prop                                  |
| 4   | Table service chat         | `gilda-chat-widget`                 | `apps/customer/app/r/[slug]/table-service-widget.tsx`                     | **Verified** 2026-07-28 — spot-checked `.gcw-chat-wrapper/-history/-pics/-panel-wrapper/-message/-field/-send-button` against pag1.html, all byte-for-byte; ADR-048's claim holds |
| 5   | AM House Party orbit       | `#ow`                               | `apps/customer/app/(dashboard)/wedding-parties/[id]/am-house-hero.tsx`    | **Incomplete** 2026-07-28 — see note below; the orbit itself was never built                                                                                                      |
| 6   | Location globe (Cesium)    | `am-globe-widget`                   | not built                                                                 | Not started                                                                                                                                                                       |
| 7   | Lapel configurator         | `nbs-lapel-…-v4`                    | not built                                                                 | Not started                                                                                                                                                                       |
| 8   | Gift card 3D booklet       | `amibx-root-…`                      | not built                                                                 | Not started                                                                                                                                                                       |
| 9   | Monthly photo grid         | bottom of pag1                      | not built                                                                 | Not started                                                                                                                                                                       |
| 10  | Gift/voucher SaaS module   | pag2                                | not built                                                                 | Not started                                                                                                                                                                       |

## AM House Party orbit is not actually built (found 2026-07-28)

`am-house-hero.tsx`'s own header comment documents a careful, correct port
of pag1.html's `wed2027.mp4` video-hero mockup (id neighborhood
`u569387`–`u569408`) — the video, the notification card, the bottom nav.
That work is accurate and stays as-is.

But `#ow` — the actual "AM House Party" orbit (a center avatar with five
others slowly orbiting it, `orbitR: 130`, sine-wave drift, `344×380px`) —
sits in the same mockup, literally labelled `<p>AM House Party</p>`
(`u569402`) immediately before it, and was never built at all. The row's
own name and source id are about this orbit specifically, not the video
shell around it. Real data for it exists (`WeddingPartyRepository`'s
`members`, already rendered as a plain list below the hero on
`wedding-parties/[id]/page.tsx`) but there's no per-member photo to use as
the source's `avaN.png` avatars — a real design decision (initials circles?
uploaded photos, a feature that doesn't exist yet?), not a quick addition.
Logged rather than built on the spot; see `NIGHT_LOG.md` 2026-07-28.

## Parked: fit tools (founder decision, 2026-07-27)

The `vox-` slider is ported correctly and verbatim, and the component stays
in the repository. **The feature is parked.** Applying fit corrections is
only useful if the values reach the supplier that actually makes the
garment, which means an integration with each retailer's own supplier
ordering system. That dependency is not in reach, so no further work on fit
tools until it is.

## `/alterations/*` is not a founder-designed surface

Everything under `apps/retailer/app/(dashboard)/alterations/` — including
`/alterations/new` and the "Fit tools" panel on the detail page — was
invented by an engineering session. It matches nothing in `pag1.html` and
carries none of the founder's cues. **Do not treat any of it as canonical
design, and do not extend it.**

This is the trap that cost a full increment: a verbatim widget port was
placed inside an invented screen, so a correct port still produced something
the founder did not recognise. Before porting any widget, confirm the
surface it lands on is founder-designed. If it is not, stop and ask.

**What the real tool is.** The valuable alterations product is not fit
correction. It is work-order handling for the third-party alteration
workshop, and cost management for the store owner — the money question, not
the measurement question. The founder will design it. Until that design
exists, nothing in the alterations vertical should be built or extended.

## How to extract a widget from the source

Do not retype it. Transcribing 1,000 lines by hand introduces errors that
are invisible until the founder looks at the screen. Extract it
mechanically, the way surface 1 was done:

```
python3 - <<'PY'
import json
src = open('downloaded_pages/pag1.html', encoding='utf-8', errors='replace').read()
i = src.find('.SELECTOR-widget-root')                      # a class unique to the widget
s = src.find('>', src.rfind('<style', 0, i)) + 1
css = src[s:src.find('</style>', i)]
j = src.find('SOME_UNIQUE_FUNCTION_NAME')                  # a symbol unique to its script
js = src.find('>', src.rfind('<script', 0, j)) + 1
script = src[js:src.find('</script>', j)]
open('path/to/widget-source.ts','w').write(
  'export const CSS = ' + json.dumps(css) + ';\n'
  'export const SCRIPT = ' + json.dumps(script) + ';\n')
PY
```

`json.dumps` is doing real work here: the founder's scripts are full of
regexes, and pasting them into a TypeScript template literal would turn
`\b` into a backspace character and silently corrupt every word boundary.
Add the generated file to `.prettierignore`.

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
