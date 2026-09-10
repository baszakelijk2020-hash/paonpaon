# Storefront filter drawer — work log

**File under change:** `apps/customer/app/(shell)/r/[slug]/paon-template.html`
**Block:** `<script id="paon-filter-topbar-drawer-final">` (~line 19560 onward) and the
`<style>` string it injects into `<head>` at parse time.
**Branch:** `platform-integrated-20260903`
**Last updated:** 2026-09-08

Served fresh on reload — `template-payload/route.ts` reads the HTML from disk per request,
so no rebuild is needed for changes to this file.

Verified against the running dev server on `:3002` at
`http://localhost:3002/r/atelier-demo?category=Pants` (viewport 1203x870).

---

## THE ONE TRAP THAT KEEPS KILLING THIS FILE

The injected CSS lives inside a **JavaScript template literal**
(`style.textContent = ` + backtick). **A backtick anywhere inside that string — including
inside a CSS comment — terminates the literal and kills the entire IIFE with a
SyntaxError.** When that happens the whole drawer script never runs: the filter button is
never moved into `#paon-search-dock`, so it disappears from the top bar and the old
in-grid filter button reappears.

This has already broken the page twice. **Never put a backtick in a comment in that block.**

Check after every edit:

```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('apps/customer/app/(shell)/r/[slug]/paon-template.html','utf8');
const m=h.match(/<script id=\"paon-filter-topbar-drawer-final\">([\s\S]*?)<\/script>/);
fs.writeFileSync('/tmp/_fp.js', m[1]);
console.log('backticks:', (m[1].match(/\`/g)||[]).length, '(must be exactly 2)');
"
node --check /tmp/_fp.js && echo "IIFE SYNTAX OK"
```

---

## Fixes landed, and why

### 1. Drawer snapped open instead of growing — CASCADE LOSS

GSAP was correctly tweening the `--paon-drawer-h` custom property the whole time, but
**nothing read it**, because the rule that maps it to `height` lost the cascade:

| Line  | Selector                                                                                             | Sets                                               | Specificity |
| ----- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| ~7899 | `body:not(.grid-header-hidden):not(.header-is-hidden):not(.detail-header-hidden) #filter-panel`      | `height: calc(100vh - var(--header-h)) !important` | **(1,3,1)** |
| ~7715 | `body.filter-active[.grid-header-hidden\|.header-is-hidden]:not(.product-detail-open) #filter-panel` | `height: 100vh !important`                         | **(1,3,1)** |

Those `:not()` chains each add a class-level. The drawer rule was only `(1,2,1)`, so
`#filter-panel` stayed pinned to viewport height and only `visibility`/`opacity` flipped.

**Fix:** the drawer selector repeats the id and the class —
`body .paon-template-root #filter-panel#filter-panel.paon-filter-top-drawer.paon-filter-top-drawer`
= **(2,3,1)**, which beats both. Do not "simplify" this selector back.

Also: `finalHeight` was being read with `drawer.scrollHeight` while height was still pinned
to `100vh`, so the target was the whole viewport. It now takes a one-frame synchronous
`height:auto` measurement (inline values saved and restored in the same frame) clamped to
`min(580, 100vh - 22)`.

### 2. Two panels animating instead of one

The drawer carried its own `background: rgba(18,18,18,…)`, `backdrop-filter: blur(24px)`
and a `box-shadow`, so opening animated a **second** surface on top of the header.
The panel is now `background: transparent`, `backdrop-filter: none`, `box-shadow: none` —
purely a transparent clipping box. Only the existing blurred top bar (the header, via
`--paon-filter-expanded-height` + `--paon-filter-header-shade`) grows and shrinks.
The `--paon-drawer-dark` tweens were removed from both timelines.

**Consequence:** the drawer content now sits on the LIGHT header, so all its ink is dark
grey (`--paon-fp-ink: #3a3a38`), dividers `rgba(0,0,0,.15)`, buttons dark-bordered on a
translucent white fill, grid selector track `rgba(0,0,0,.07)` with a white thumb.

### 3. Close "vanished" instead of shrinking

The collapse used `ease: 'power3.in'` starting at `t=.4s`, so the bar sat still while the
shade faded and then lost nearly all its height in the last ~150ms.
Now: content fades `0→.16s`, then shade **and** height both run from `t=.16s` for
`.5s`/`.55s` on `power2.inOut`, decelerating into the original header height.

### 4. Drawer sometimes never closed

`gsap.killTweensOf()` does **not** fire `onComplete`, so a rapid re-click that killed the
close timeline left `finish()` unrun and the drawer stuck open permanently.
A `deferFallback(finish, 1100)` safety net now runs it either way (`finish()` is idempotent).

### 5. Outside click opened a product instead of just closing — STACKING TRAP

Two independent causes:

- `#filter-panel` lives inside `#main`, and `body.filter-active #main { z-index: 200 }`
  (added long ago so `#main` would outrank the OLD dim at z-index 90) painted the product
  grid **over** the new dim (41) and panel (43).
- `#filter-dim` computed to `visibility: hidden` even while open, and a `visibility:hidden`
  element receives no pointer events at all.

**Fix:**

- The script now lifts **both** `#filter-dim` and `#filter-panel` out to
  `.paon-template-root` so they are siblings of `#main` and their z-index ranks directly.
- `body.filter-active .paon-template-root #main { z-index: auto !important }` neutralises
  the legacy override.
- The dim rule repeats id + class → `#filter-dim#filter-dim.paon-filter-top-dim.paon-filter-top-dim`
  = **(2,2,0)**, beating ~15 competing `!important` rules (several at `(1,3,1)`) left over
  from the old right-hand drawer that had pinned it to a 453px strip at `top: var(--header-h)`.
- Capture-phase `pointerdown/mousedown/mouseup/click` listeners on the dim call
  `preventDefault` + `stopPropagation` + `stopImmediatePropagation`, so an outside click
  can only ever close the drawer.

**Verified:** with the drawer open, `elementFromPoint` at four points below the panel all
return `#filter-dim`, never a product card.

### 6. The five top-bar icons did not match

**The visible search icon is NOT `#paon-header-search`** — that element is `display: none`.
It is `.paon-search-toggle > .paon-search-icon`, a mask-span that sat at `color:#9a9a94`,
`opacity:1`, with **no** `filter-active` rule at all, so it never reacted to the drawer.

The three right-hand buttons (`.header-icon` = avatar, favourites, bag) are the reference
contract and were not changed: **the button carries `color` + `opacity`; the glyph inside
paints from that.** Search and filter now use the identical structure.

|                  | at rest           | drawer open      |
| ---------------- | ----------------- | ---------------- |
| all five buttons | `#808080` @ `.75` | `#ffffff` @ `.5` |

- currentColor glyphs (avatar svg, favourites mask, search mask) need nothing further.
- raster glyphs (bag png, filter png) cannot take currentColor, so they are held at
  `opacity: 1` and tinted with an equivalent `filter()`; the button supplies the opacity.
- `filter1002.png` is a **pure white** glyph (measured: rgb 255,255,255 over 57k opaque
  pixels) — so it needs `brightness(.5)` at rest and `filter: none` when open. It is _not_
  pre-tinted to `#808080`.
- Selectors double the ids/classes (`#paon-search-dock#paon-search-dock
.paon-search-toggle.paon-search-toggle`) because a `(1,2,0)` `!important` rule was
  holding the search toggle at `opacity: 1`.
- `transition: none` on all five so they flip together at the same instant.

**Verified:** all five report `rgb(255, 255, 255) @ 0.5` open and `rgb(128, 128, 128) @ 0.75`
closed.

### 7. Filter button geometry

Docked trigger and its `.filters-btn` are `22px` wide x `24px` tall; the img is `18x18`.
(Net of: "2px smaller", then "2px higher", then "2px bigger".)

---

## Known residual

`filter1002.png` is drawn with noticeably thinner strokes than the avatar/hanger/bag
glyphs. Colour and opacity are byte-identical across all five, but less ink on the glyph
still reads slightly paler. Not fixable in CSS — it needs a heavier-stroke filter asset.

## How to re-verify quickly

Open `http://localhost:3002/r/atelier-demo?category=Pants`, then in the console:

```js
const dock = document.querySelector(
  "#paon-search-dock .filters-bar.paon-filter-dock-trigger",
);
const els = {
  filter: dock.querySelector(".filters-btn"),
  search: document.querySelector(".paon-search-toggle"),
  avatar: document.getElementById("paon-header-profile"),
  favorites: document.getElementById("paon-header-favorites"),
  bag: document.getElementById("paon-header-basket"),
};
const dump = () =>
  Object.fromEntries(
    Object.entries(els).map(([k, e]) => {
      const c = getComputedStyle(e);
      return [k, c.color + " @ " + c.opacity];
    }),
  );
console.table(dump()); // closed  -> all rgb(128,128,128) @ 0.75
dock.querySelector(".filters-btn").click();
setTimeout(() => console.table(dump()), 1500); // open -> all rgb(255,255,255) @ 0.5
```

Outside-click check, with the drawer open:

```js
const dim = document.getElementById("filter-dim");
const h = document
  .getElementById("filter-panel")
  .getBoundingClientRect().height;
[
  [600, h + 80],
  [950, 750],
  [300, 810],
].forEach(([x, y]) =>
  console.log(
    x,
    y,
    document.elementFromPoint(x, y) === dim ? "DIM ok" : "LEAKS THROUGH",
  ),
);
```

---

## Round 2 — inverted glass shared with the home grid

### The home-grid recipe (this is the thing that kept getting forgotten)

Three rules, all scoped to `.paon-template-root.home-view-active`, on `#header`,
`#gilda-chat-widget` and `#gilda-chat-widget-toggle`:

```css
background: rgba(120, 120, 120, 0.04);
backdrop-filter: blur(22px) invert(1) contrast(1.28) brightness(0.82);
```

The `invert(1)` acts on the **backdrop**, not on the content drawn on top — which is why
icons and text sitting on the bar keep their own colour and must be set explicitly.

**Now applied to the product grid too**, by re-scoping to
`.paon-template-root:not(.product-detail-open)` for all three elements. So the product-grid
top bar, the product-grid TableService, and the filter drawer (which rides on the header)
are the identical surface to the home grid.

### Consequences

- The header no longer darkens when the drawer opens. `--paon-filter-header-shade` stays at
  `.03` and both shade tweens were removed from the open and close timelines — the bar is
  the same inverted glass in and out. Only its **height** animates.
- Drawer ink went back to white: `--paon-fp-ink: #ffffff`, all outlines `rgba(255,255,255,.15)`.
- The five top icons are `#ffffff @ .75`, **identical whether the drawer is in or out**.
  The bag glyph is `brightness(0) invert(1)`; `filter1002.png` is already pure white so it
  now takes `filter: none`.
- Grid selector reverted to its dark-surface values (track `rgba(0,0,0,.35)`, thumb
  `rgba(255,255,255,.09)`, `#8a8a87` → `#e4e4e1` selected).

### Typography contract

CLEAR ALL, APPLY and every filter option follow the sidebar Sign in / Visit in-store button:
`OptimaKlein, serif · 14px · 400 · letter-spacing .14px · text-transform none`.

|                    | fill                                                       | outline                     | text      |
| ------------------ | ---------------------------------------------------------- | --------------------------- | --------- |
| CLEAR ALL          | transparent                                                | `1px rgba(255,255,255,.15)` | `#fff`    |
| APPLY              | `linear-gradient(135deg, rgba(0,0,0,.5), rgba(0,0,0,.75))` | none                        | `#f2f1ee` |
| Option, unselected | transparent                                                | `1px rgba(255,255,255,.15)` | `#fff`    |
| Option, selected   | same black gradient                                        | transparent                 | `#f2f1ee` |

The selected option class is **`.sel`** (`.selected` is also covered defensively).

### Verified in-browser this round

- `#header`, `#gilda-chat-widget`, `#gilda-chat-widget-toggle` on the product grid all report
  `rgba(120, 120, 120, 0.04)` + the exact home `backdrop-filter` string.
- Five icons `rgb(255,255,255) @ 0.75`, byte-identical open vs closed.
- Drawer label / `+` / close all `rgb(255,255,255)`; dividers `rgba(255,255,255,0.15)`.
- Header keeps the inverted backdrop _while the drawer is open_, shade still `0.03`.
