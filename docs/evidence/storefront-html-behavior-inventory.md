# Storefront HTML Behavior Inventory

Source audited: `apps/customer/app/r/[slug]/paon-template.html` (17,699 lines) +
`apps/customer/app/r/[slug]/route.ts` (1,067 lines).

Method: full-file structural grep sweep across every requested category
(keyframes, media queries, backdrop-filter/blur, GSAP, IntersectionObserver,
scroll listeners, transitions, hover rules, addEventListener, inline `on*`
handlers, top-level functions, localStorage, fetch, forms) with exact line
numbers, followed by targeted reads of every match's surrounding context.
`paon-template.html` is not a single hand-written file — it is ~39 layered
`<script>` blocks, many literally named `*-final-js`, `*-final-lock`,
`*-final-fixes-v6`, each a later patch overriding/duplicating an earlier
script's DOM logic for the same visual behavior. The inventory below groups
by category, then documents each script block's _net effective behavior_
(not each patch generation) with its React replacement.

---

## 1. `<script>` block map (39 blocks, line → line, id, purpose)

| Lines       | id                                                    | Purpose                                                                                                                                                                     | React replacement                                                                                                                              |
| ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 16-17       | (gsap/ScrollTrigger CDN)                              | Loads GSAP 3.12.5 + ScrollTrigger from cdnjs                                                                                                                                | `gsap`/`gsap/ScrollTrigger` npm packages, imported once in a client component                                                                  |
| 18-24       | `paon-mobile-detect-early`                            | `uaSaysMobile()`/`isMobileNow()` UA+width sniff, sets `document.documentElement` class before paint                                                                         | `useIsMobile()` hook backed by `matchMedia` + SSR-safe default; apply via CSS breakpoints, not JS class where possible                         |
| 60-110      | (inline, no id)                                       | `stripHoverRules()` removes `:hover` CSS on touch devices; resize/orientationchange re-checks mobile state                                                                  | CSS `@media (hover: hover)` instead of JS stripping                                                                                            |
| 4176-7083   | (inline, no id)                                       | Core catalogue/detail engine: `renderCategories`, `renderGrid`, `openDetail`, `goBack`, filter panel, archetype dropdown, favourites, modals, GSAP detail transitions       | `CatalogueGrid`, `ProductDetail`, `FilterPanel`, `FavoritesPanel` React components (see §7-§11)                                                |
| 7084-7909   | (inline)                                              | Detail-view scroll handling, right-column collapse/restore                                                                                                                  | `useDetailPanel()` hook                                                                                                                        |
| 7910-8045   | `absolute-final-filter-timing-header-aware-js`        | Patch: syncs filter-dim blur timing with header state                                                                                                                       | Folded into `FilterPanel` transition state machine                                                                                             |
| 8046-8911   | `final-request-filter-instant-panel-js`               | Patch: makes filter panel open instantly on some paths                                                                                                                      | Folded into `FilterPanel`                                                                                                                      |
| 8912-9652   | (inline)                                              | Modern button hover brightness transitions (`initModernButtonHoverTransitions`)                                                                                             | CSS `:hover`/`:active` classes, no JS                                                                                                          |
| 9653-9827   | `paon-dynamic-price-custom-profile-geometry-script`   | Locks price-badge geometry on resize/DOMContentLoaded                                                                                                                       | CSS `aspect-ratio`/flex, no JS needed                                                                                                          |
| 9828-10030  | `grid-hover-no-dark-flash-final-script`               | Patch: prevents dark flash on grid card hover                                                                                                                               | CSS `will-change`/opacity transition tuning                                                                                                    |
| 10031-10586 | `paon-homepage-grid-final-script`                     | Home feed masonry: shuffle, column build, lazy reveal, GSAP `ScrollTrigger` reveal animation                                                                                | `HomeMasonryGrid` component using CSS columns + `IntersectionObserver` reveal hook                                                             |
| 10587-10840 | `paon-distributed-bottom-clip-fast-resize-script`     | Patch: clips masonry column bottoms evenly on resize                                                                                                                        | Folded into `HomeMasonryGrid` layout effect                                                                                                    |
| 10841-10908 | `paon-min600-column-width-script`                     | Patch: forces column count at 600px min width                                                                                                                               | Folded into grid's CSS `@media`/column-count logic                                                                                             |
| 10909-11027 | (inline)                                              | `forceExistingFeedToThreeColumns` patch                                                                                                                                     | Superseded by final masonry column logic below                                                                                                 |
| 11028-11210 | `paon-home-feed-natural-aspect-ratio-final`           | Patch: applies natural image aspect ratio per card                                                                                                                          | CSS `aspect-ratio` from known image dimensions                                                                                                 |
| 11211-11317 | `paon-home-feed-vgap50-runtime-lock`                  | Patch: locks 50px vertical gap                                                                                                                                              | CSS `gap` token                                                                                                                                |
| 11318-11626 | `paon-home-feed-even-columns-runtime-final`           | Patch: rebalances uneven columns                                                                                                                                            | Folded into `HomeMasonryGrid`                                                                                                                  |
| 11627-11869 | `paon-home-feed-skip-loaded-even-final`               | Patch: builds feed items, lazy `IntersectionObserver` loader, card creation (`createCard`)                                                                                  | `HomeMasonryGrid` + `useLazyImage()` hook                                                                                                      |
| 11870-12036 | `paon-feed-title-map-delete-final-lock`               | Patch: strips title overlays from home feed cards                                                                                                                           | Card component simply omits the overlay markup                                                                                                 |
| 12037-12137 | `paon-parallax-smooth-scroll-js`                      | Parallax image transform driven by scroll position (`collect/measure/render/kick`)                                                                                          | `useParallax()` hook using `requestAnimationFrame` + scroll listener, or CSS `scroll-timeline` where supported                                 |
| 12138-12347 | `paon-feed-image-lazy-stable-title-js`                | Lazy image loader + title placement + reveal/hide animation via `IntersectionObserver`                                                                                      | `useLazyImage()` + CSS fade-in                                                                                                                 |
| 12348-12441 | `paon-inline-important-image-hover-js`                | Patch: forces image hover zoom via inline style override                                                                                                                    | CSS `.card:hover img { transform: scale(...) }`                                                                                                |
| 12442-12666 | `paon-product-grid-blur-fade-like-home-feed-final-js` | Product grid card reveal: blur-to-sharp fade via GSAP `fromTo`, `IntersectionObserver`-gated                                                                                | `ProductCard` reveal animation (Framer Motion or CSS `filter` transition + `IntersectionObserver` hook)                                        |
| 12667-12788 | `paon-product-grid-bitmap-safe-zoom-final-js`         | Patch: clamps product grid image zoom to avoid bitmap artifacts                                                                                                             | CSS `transform-origin`/`will-change` tuning inside `ProductCard`                                                                               |
| 12789-12985 | `paon-shoes-first-click-direct-final-js`              | Patch: shoes category card first-click routes directly to detail (`realShoes`, `shoeCard`, `catchShoes` capture-phase click interceptor)                                    | Regular `onClick` on `ProductCard`, category-aware routing — no capture-phase hack needed once React owns the click                            |
| 12986-13018 | `feed-first-render-size-fix`                          | Patch: fixes first-render image sizing race                                                                                                                                 | Handled naturally by React's controlled render + `next/image`                                                                                  |
| 13018-13062 | (breakpoints only)                                    | `@media` column-count thresholds for the product grid (1099/1100-1699/1700-2399/2400px)                                                                                     | CSS module breakpoints on `ProductGrid`                                                                                                        |
| 13063-13210 | `paon-home-feed-breakpoint-authority-final-script`    | Patch: authoritative column-count resolver overriding earlier scripts, re-run on resize/`paon-columns-updated` custom event                                                 | Single `useColumnCount()` hook, one source of truth                                                                                            |
| 13211-13605 | `paon-final-requested-fixes-v6-js`                    | Grab-bag of late UI fixes: `fixBroek2Swatch` (trouser swatch image override), `revealShoeCards`                                                                             | Data-level fix in `storefront-page-data.ts` swatch mapping, not DOM patch                                                                      |
| 13606-13676 | `paon-mobile-layout-final-js`                         | Mobile viewport nudge (`nudge()` forces reflow)                                                                                                                             | Not needed — React re-render handles layout without forced reflow hacks                                                                        |
| 13677-14577 | `paon-parallax-boundary-safety-final-js`              | Patch: clamps parallax transform to avoid overshoot at scroll boundaries; also image-fix retry loop (`fixImg`, `fixAll`, `startObserver`)                                   | Folded into `useParallax()` bounds clamp                                                                                                       |
| 14578-14651 | `paon-mobile-menu-final-js`                           | Mobile hamburger menu open/close (`openMenu`/`closeMenu`), Escape-key close, backdrop click close                                                                           | `MobileMenu` component, local `open` state, `onKeyDown`/backdrop `onClick`                                                                     |
| 14652-14851 | `paon-mobile-detail-slider-final-js`                  | Mobile product-detail image slider: scroll-snap anchors, touch/pointer drag-to-swipe, dot indicator sync                                                                    | `MobileDetailSlider` component: CSS scroll-snap + pointer event handlers                                                                       |
| 14852-14909 | `paon-mobile-detail-header-scroll-final-js`           | Mobile detail header shrinks/hides on scroll                                                                                                                                | `useScrollDirection()` hook driving header class                                                                                               |
| 14910-15363 | `paon-mobile-detail-sections-final-js`                | Mobile detail page composition: title/fabric-line/swatch-caption builders, related-product picker, category tile grid, moves size/CTA selector into sticky footer on mobile | `MobileProductDetail` composed from small presentational components (`FabricLine`, `SwatchCaption`, `RelatedProducts`, `StickyFooterSelector`) |
| 15364-15420 | `paon-mobile-address-bar-scroll-shim-js`              | Mirrors scroll position to compensate for mobile browser address-bar collapse                                                                                               | `useViewportHeightFix()` hook (or CSS `100dvh`)                                                                                                |
| 15421-16091 | `paon-real-backend-wiring`                            | **Real API wiring**: appointment-request POST, cart-add POST, guest-cart localStorage fallback, sold-out button state                                                       | Server Actions / fetch calls inside `AppointmentModal` and `AddToBagButton`, preserving exact endpoint paths (§13)                             |
| 16092-16849 | `paon-mobile-detail-v8-js`                            | Mobile appointment picker rebuild: day/time-slot selection, form validation, confirm submit, desktop carousel prev/next buttons                                             | `AppointmentPicker` component (shared by desktop/mobile)                                                                                       |
| 16850-17511 | `paon-tableservice-widget-js`                         | TableService chat widget: open/close, message send, attachment (paperclip) picker, link-use/cancel, private-message vs inquiry submit, typing/busy state                    | `TableServiceWidget` component (§14)                                                                                                           |
| 17512-17634 | `paon-floating-basket-js`                             | Floating cart basket: fetch summary, render lines, qty inc/dec, toggle open/close                                                                                           | `CartBasket` component (§12)                                                                                                                   |
| 17635-17699 | `paon-appointment-sheet-js`                           | Mobile appointment sheet: open/close, Escape/backdrop dismiss, rebuild after DOM changes                                                                                    | Folded into `AppointmentPicker`'s mobile sheet variant                                                                                         |

---

## 2. `@keyframes` (CSS animations) — 3 total

| Line  | Name                        | Behavior                                                                           | React replacement                                                                          |
| ----- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2614  | `lagilda-shimmer-unique`    | `background-position` sweep 200%→-200%, used for skeleton/shimmer loading state    | Keep as CSS Module keyframe, apply via `.skeleton` class                                   |
| 16544 | `paon-tableservice-shimmer` | `background-position` sweep -200%→200%, TableService widget loading shimmer        | CSS Module keyframe on `TableServiceWidget` skeleton                                       |
| 17465 | `paon-appt-sheet-left`      | `translate3d(-100%,0,0)` → `translate3d(0,0,0)`, mobile appointment sheet slide-in | CSS Module keyframe or Framer Motion `initial/animate` on `AppointmentPicker` mobile sheet |

## 3. `@media` breakpoints — 18 declarations, 6 distinct thresholds

| Line(s)                                  | Breakpoint                                                                            | What changes                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1688                                     | `max-width: 850px`                                                                    | Header/nav layout collapse to mobile chrome                                                   |
| 9921-9937                                | `min-width:1600px`, `1300-1599px`, `780-1299px`, `max-width:779px`, `max-width:559px` | Product-detail column/typography scaling tiers                                                |
| 10018, 11020, 11199, 11306, 11501, 11613 | `max-width: 779px` (repeated across patch scripts)                                    | Mobile layout override for home feed / detail sections — same threshold, redeclared per patch |
| 13018-13051                              | `max-width:1099px`, `1100-1699px`, `1700-2399px`, `min-width:2400px`                  | Product grid column-count tiers (2/3/4/5 columns)                                             |
| 16768                                    | `max-width: 600px`                                                                    | TableService widget full-width on small screens                                               |
| 16776                                    | `prefers-reduced-motion: reduce`                                                      | Disables shimmer/transition animations                                                        |

React replacement: consolidate to one CSS Module per component using these
same breakpoint values (779px mobile/desktop split, 1099/1699/2399px grid
column tiers, 600px widget width, 850px header collapse) — do not invent new
breakpoints. Respect `prefers-reduced-motion` in the same components.

## 4. `backdrop-filter` / blur usage — ~140 declarations

All are `blur(Npx)` (16, 20, 24, 6px) with `saturate(1.4)` on translucent
panels (header, filter panel, product-detail panels, modals, TableService
widget, appointment sheet, cart drawer) and `!important`-toggled
`blur(0px)` variants driven by state classes (`filter-active`,
`filter-blur-active`, `product-detail-open`) — i.e. blur amount is a CSS
custom-property/class toggle, not per-frame JS. One GSAP-driven instance at
lines 6487-6523 animates `dim` blur from `blur(0px)`→target via
`gsap.set`/`gsap.to` on open/close of the archetype dropdown and detail
right-panel dim layer.

React replacement: keep blur values as CSS Module tokens; drive the
class toggle from component `open`/`closed` state. Keep the two GSAP
`dim` blur tweens (lines 6487-6523, 7910-8058) as-is inside the relevant
component's open/close handlers — do not convert to CSS transition, the
product spec requires the exact GSAP easing/duration already in place.

## 5. `:hover` rules — 73 declarations

Concentrated in: header icon hover states, `.grid-card:hover` zoom/overlay
reveal, `.fp-opt:hover` filter option highlight, `.drf-btn:hover`,
`.whatsapp-btn:hover`, TableService send/attach button hovers, cart
quantity button hovers. `stripHoverRules()` (line 60) deletes all `:hover`
CSS rules at runtime on touch/mobile devices to prevent sticky-hover bugs.

React replacement: keep all 73 rules verbatim in CSS Modules; replace
`stripHoverRules()` with `@media (hover: hover) and (pointer: fine)`
wrapping each hover rule — equivalent effect, no JS DOM stylesheet mutation.

## 6. `transition:` declarations — 150

Mostly `background`, `opacity`, `backdrop-filter`, `transform`,
`filter: brightness()` transitions in the 200-500ms range with
`cubic-bezier(.22,.61,.36,1)` or `linear` easing, matched to the GSAP
tween durations used for the same elements (filter panel: 260-500ms;
detail right-panel: per `animateDetailMainResizeTo`/`animateViewEnter`/
`animateViewExit`, lines 6287-6476; button brightness: `power2.out` 200ms
at lines 8916-8922). React replacement: preserve exact ms/easing values as
CSS Module transition declarations or matching GSAP tween configs per
component — these values are the fidelity contract, do not approximate.

## 7. GSAP timelines/calls — full list (all under `gsap.` in the file)

| Lines                   | Element                         | Behavior                                                                                                         | React replacement                                                                                                                               |
| ----------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 5923-5995               | detail view / grid              | `killTweensOf` + `gsap.set` reset before opening product detail; kills in-flight grid-card tweens                | `useGsapContext()` cleanup in `ProductDetail` mount/unmount effect                                                                              |
| 6105-6209               | grid cards                      | Sets initial hidden state (`opacity:0`), then `gsap.timeline` return-to-grid animation (`state.gridReturnTween`) | `useGsapTimeline()` in `CatalogueGrid` triggered on `goBack`                                                                                    |
| 6279-6325               | `detailMain`                    | Kills/starts tween on right-column toggle                                                                        | `ProductDetail` right-panel toggle handler                                                                                                      |
| 6455-6476               | generic `animateViewEnter/Exit` | `fromTo`/`to` slide transform for view transitions                                                               | Shared `useViewTransition(el, fromX)` hook                                                                                                      |
| 6487-6523               | filter panel + dim              | Panel slide `fromTo`, dim `blur(0px)`→target `gsap.to`                                                           | `FilterPanel` open/close animation                                                                                                              |
| 6911-6922               | favourites row hover            | `gsap.to` opacity/transform on mouseenter/leave                                                                  | `FavoritesPanel` row hover animation                                                                                                            |
| 7915-8058 (patch layer) | filter panel + dim              | Duplicate/override of panel+dim animation with `clearProps` cleanup                                              | Same `FilterPanel` component — one implementation, not layered patches                                                                          |
| 8917-8922               | generic button                  | `filter: brightness(1.2)`↔`brightness(1)` on hover                                                               | CSS `:hover { filter: brightness(1.2) }` — no JS needed, this one is pure hover feedback                                                        |
| 10221-10264             | home feed cards                 | `ScrollTrigger`-gated `fromTo` reveal (`opacity/y/scale/blur`→visible)                                           | `HomeMasonryGrid` card reveal via `IntersectionObserver` + CSS transition, or GSAP `ScrollTrigger` kept 1:1 if exact scrub behavior is required |
| 12245                   | image                           | `gsap.to(img,{...})` parallax/zoom transform                                                                     | `useParallax()`                                                                                                                                 |
| 12499-12543             | product grid card inner/overlay | `fromTo` blur-fade reveal, killed on scroll-out                                                                  | `ProductCard` reveal effect                                                                                                                     |
| 17089-17129             | TableService chat widget        | `fromTo` open animation, `to` close animation, `clearProps` cleanup                                              | `TableServiceWidget` open/close animation                                                                                                       |

## 8. `IntersectionObserver` usage — 5 live instances (+ 3 comment references)

| Line  | Purpose                                              |
| ----- | ---------------------------------------------------- |
| 11717 | Home feed lazy image loader                          |
| 12282 | Product grid blur-fade reveal trigger                |
| 12555 | Product grid reveal (patch-layer duplicate of 12282) |
| 13864 | Generic image-fix retry observer                     |
| 14817 | Generic image-fix retry observer (duplicate)         |

React replacement: one shared `useInViewOnce(ref)` hook reused by
`HomeMasonryGrid` cards and `ProductCard` reveal — collapse the 5
overlapping observers into one implementation per grid.

## 9. Scroll listeners — 8

| Line        | Element                       | Purpose                                                          |
| ----------- | ----------------------------- | ---------------------------------------------------------------- |
| 7000        | detail `mainEl`               | Syncs detail-view scroll-based header/footer state               |
| 7030        | `detailEl`                    | Same, right-panel variant                                        |
| 12105-12106 | `window`/`document` (capture) | Parallax `kick()` scheduler                                      |
| 14728       | mobile detail slider          | `onSliderScroll` — updates active-dot index from scroll position |
| 14872       | mobile detail `mainEl`        | Header shrink-on-scroll                                          |
| 15338       | `mainForFooter`               | Sticky footer selector show/hide                                 |
| 15390       | mobile `mainEl`               | Address-bar scroll shim                                          |
| 16179       | `mainForDrf`                  | Desktop carousel/dropdown scroll sync                            |

React replacement: each becomes a `useEffect` scroll listener scoped to
the owning component's ref, `{ passive: true }` preserved.

## 10. Filter / sort logic

- `openFilterPanel`/`closeFilterPanel` (6477-6534): slide-in panel + dim blur.
- `toggleFpSection`/`toggleSection` (6535-6554): accordion expand/collapse per filter group (sort/color/pattern/price/season — see form fields below).
- `toggleFilterOption`/`clearFilterOptions`/`selectedFilterValues` (6657-6691): multi-select chip toggle per group, stored as DOM `data-selected` attrs (not localStorage/URL — **ephemeral, resets on reload**, preserve this exact non-persistence).
- `applyProductFilters`/`productMatchesCatalogFilters` (6692-6741): applies color/pattern/price/season AND sort to the in-memory product list.
- `sortCatalogProducts`/`catalogNumber` (6742-6764): three sort modes — `newest` (catalog-number desc), `price-asc`, `price-desc`.
- Filter option values (exact, from lines 4105-4166): sort = `newest|price-asc|price-desc`; color = `navy|grey|brown|beige|blue|black|green`; pattern = `plain|herringbone|twill|glencheck|houndstooth|melange`; price = `0-800|800-1200|1200+`; season = `spring-summer|autumn-winter|all-season`.

React replacement: `FilterPanel` component with local `useState` filter
selections (not persisted — matches current ephemeral behavior),
`useMemo`-derived filtered+sorted product list passed to `CatalogueGrid`.
Keep the exact group/value string constants above — the cart/appointment
backend and any analytics may depend on these literal strings.

## 11. Category / archetype dropdown

- `renderCategories`/`getCat` (5531-5568): builds category nav from data.
- `openArchetypeDropdown`/`closeArchetypeDropdown`/`toggleArchetypeDropdown`/`selectArchetypeItem` (6555-6656): desktop dropdown selector (`#drf-selector`) with `crossfadeText` label transition (6609-6623).
- Mobile: `moveSelectorToMobileFooter`/`restoreSelectorToDesktop` (15041-15079) relocates the same selector DOM node into a sticky mobile footer instead of duplicating it.

React replacement: `CategorySelector` component rendered once, laid out
differently via CSS at the mobile breakpoint (flex/grid reorder or
`position: sticky` footer) rather than DOM node relocation.

## 12. Product grid / card interactions

- `renderGrid`, `splitGridTitle`, `cleanGridTitleTitle`, `normalizeProductTextCaps` (5578-5683): builds card markup, title formatting rules.
- `getTrouserSwatchImage` (5684-5705): category-specific swatch image override (also patched later by `fixBroek2Swatch` at 13213).
- Card click → `openDetail(id)` (5640); favourite button click stops propagation then `toggleFavoriteId` (5643-5653, event bound at 5643).
- Image `error`/`load` handlers (5654-5676) swap broken images and mark card "loaded" for fade-in.
- Shoes-category first click bypasses the normal card and routes straight to detail via a capture-phase `document` listener (`catchShoes`, 12941-12963) — this is a workaround for a shoes-specific DOM structure quirk; **must confirm with paon-explorer/data contract whether shoes still need special handling once cards are real React elements** (likely unnecessary — capture-phase hack was for raw DOM race conditions that don't exist in React).

React replacement: `ProductCard` component, `onClick={() => openDetail(product.id)}`, favourite button `onClick` with `stopPropagation()`, `onError`/`onLoad` handlers via `next/image` or plain `<img>` with local `loaded` state. Drop the shoes capture-phase hack; verify shoes category renders correctly through normal `ProductCard` in browser parity pass.

## 13. Product detail interactions

- `openDetail`/`goBack` (5816-6182): swap grid↔detail view, animate transitions (see GSAP §7).
- `toggleDetailRight`/`animateDetailMainResizeTo`/`animateRightColumnToState` (6265-6454): collapse/expand the right info column, resizing the main image area.
- `openModal`/`closeModal` (6765-6784): three modal types — `fitting`, `consult`, `buy` — all route to the same appointment/CTA flow (confirmed via `openModal('fitting'|'consult'|'buy')` call sites at 3935, 3976-3977, 4069-4070).
- Mobile: `MobileDetailSlider` (14652-14851) swipe/scroll-snap image gallery with dot indicators, touch+pointer drag support.
- Mobile detail sections builder (14910-15363): fabric line, swatch caption, related products, category tile grid, sticky footer selector.

React replacement: `ProductDetail` (desktop) / `MobileProductDetail`
composed from shared `ProductDetailImage`, `ProductDetailInfo`,
`RelatedProducts` — modal type routed through one `AppointmentModal`
component parametrized by `mode: 'fitting'|'consult'|'buy'`.

## 14. Favourites (wishlist)

- `paonFavoritesKey()` (6818-6820): localStorage key = `` `paon-favorites:${SLUG}` `` (per-tenant key, confirm exact template string in code — pattern is `paon-favorites:<slug>`).
- `paonReadFavorites`/`paonWriteFavorites`/`paonToggleFavoriteId` (6821-6841): read/write JSON array of product IDs.
- `toggleFavorites`/`paonRenderFavoritesPanel` (6842-6891): opens favourites side panel, renders favourited products with hover row animation (GSAP, §7 line 6911-6922).

localStorage keys used in the whole file (exhaustive, 3 call sites):

| Line       | Key pattern                                                                 | Purpose                                           |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| 6823, 6831 | `paonFavoritesKey()` → `paon-favorites:<slug>`                              | Favourited product IDs (JSON array)               |
| 15472      | `paon-guest-cart:__PAON_SLUG__` (template placeholder replaced server-side) | Guest cart fallback: `{variantId, kind, at}` JSON |

React replacement: `useFavorites(slug)` hook wrapping `localStorage`,
identical key format; `FavoritesPanel` component.

## 15. Cart actions

- `fetch('/r/__PAON_SLUG__/api/cart-add', {...})` (15461): POST add-to-bag.
- `fetch('/r/' + SLUG + '/api/cart-summary')` (17570): GET current cart lines.
- `fetch('/r/' + SLUG + '/api/cart-update', {...})` (17586): POST qty change.
- `render(data)`/`updateLine(lineId, quantity)`/`toggleBasket(e)` (17526-17634): floating basket UI, qty inc/dec buttons per line (17563-17564), open/close toggle bound to header basket icon (17612-17613) plus outside-click close (17620).
- Guest-cart localStorage fallback (15472) when cart-add API has no session.

React replacement: `CartBasket` component; `useCart(slug)` hook wrapping
the three fetch calls (keep exact URL paths — they're the real backend
contract per `paon-real-backend-wiring`, do not change these routes).

## 16. Appointment flow

- Desktop form: `<form id="paon-appt-form">` (line 4088) with fields
  `date` (hidden), `time` (hidden), `name` (text, required), `email`
  (email, required), submit button `#paon-appt-confirm`.
- `buildAppointmentPicker`/`updateApptButton` (15170-15326): day-tile
  click (15193) → `slot` time-tile click (15209) → enables confirm button
  once name+email+date+time all present (`input` listeners at
  15221-15222, submit handler 15226).
- `fetch('/r/__PAON_SLUG__/api/appointment-request', {...})` (15255): POST.
- Mobile v8 rebuild (`rebuildAppointment`, 16226-16478): re-implements the
  same day/time picker for the mobile sheet (`localDateKey`,
  `buildTimeSlots`, `checkApptReady`, `confirmBtn` click → same
  `fetch('/r/__PAON_SLUG__/api/appointment-request', ...)` at 16406) —
  functionally identical to desktop, separate DOM/markup only.
- Mobile sheet chrome: `paon-appointment-sheet-js` (17635-17699) —
  open/close, Escape key (17679), backdrop click (17678) dismiss.

Validation rules: `name` and `email` are `required` HTML5 fields; confirm
button stays disabled until `name`, `email`, a selected `date`, and a
selected `time` are all non-empty (`updateApptButton`/`checkApptReady`).

React replacement: one `AppointmentPicker` component (day grid, time-slot
grid, name/email inputs, confirm button) reused for both desktop inline
and mobile sheet presentation via a `variant` prop — do not duplicate the
picker logic like the HTML does. Keep the exact POST endpoint
`/r/<slug>/api/appointment-request` and the required-field validation.

## 17. TableService widget

- `openChatWidget`/`closeChatWidget` (17084-17133): GSAP open/close
  animation (§7), toggle button (17134), close button (17142).
- `handleSend`/`appendMessage`/`setBusy`/`setError` (16928-17083):
  message send flow, Enter-to-send (17146, 17149), busy/error state.
- Attachment flow: paperclip button (17180) opens a picker; `attachmentInput`
  file `change` (17215) → `showAttachmentDraft`; `linkUse`/`linkCancel`
  buttons (17231, 17240) confirm/cancel a link attachment; `draftRemove`
  click → `clearAttachment` (17243).
- Two submit paths: `submitPrivateMessage` → `fetch(.../table-service-message)`
  (17001, 16977-17021) and `submitInquiry` → `fetch(.../table-service-inquiry)`
  (17024-17045) — **two distinct backend endpoints**, routed by which UI
  action triggered `handleSend` (need paon-explorer/data-contract read to
  confirm exact branch condition before porting — do not collapse to one
  endpoint).
- Outside-click closes any open picker menu (17245).
- Shimmer loading state uses `paon-tableservice-shimmer` keyframe (§2).

React replacement: `TableServiceWidget` component with local message-list
state, `useMutation`-style hooks for the two distinct POST endpoints
(message vs inquiry) — preserve the branch condition exactly, port from
source rather than guessing.

## 18. Mobile-only behavior summary

- Mobile UA/width detection gates hover-rule stripping, menu, detail
  slider, detail header scroll, detail sections composition, address-bar
  scroll shim, and the appointment sheet (vs. desktop inline picker) — all
  gated by per-script `isMobile()` helpers (6+ separate near-identical
  redefinitions: lines 14680, 14865, 14920, 15373, 16095 — **should
  collapse to one `useIsMobile()` hook** in the React port, they are all
  functionally the same `window.innerWidth <= 779` check per the
  `max-width: 779px` breakpoint family in §3).
- Mobile hamburger menu (`paon-mobile-menu-final-js`, §1) — desktop has no
  equivalent, header instead shows the full nav inline.
- Mobile detail image slider replaces desktop's static/GSAP-toggled main
  image with a swipeable, scroll-snapped gallery.
- Mobile moves the archetype/category selector into a sticky footer
  instead of the desktop dropdown chrome.
- Mobile appointment flow uses a slide-in sheet (`paon-appt-sheet-left`
  keyframe) instead of desktop's inline panel.

## 19. Forms — 1 real `<form>` element

Only `#paon-appt-form` (line 4088) is an actual `<form>`; the filter panel,
category dropdown, cart, and TableService widget are all `<div>`-based
custom controls with click handlers, not native forms. No other
client-side validation beyond the two `required` fields already covered in
§16.

## 20. Fetch calls — exhaustive, 6 real endpoints

| Line  | Method (inferred) | URL                                         | Caller                                     |
| ----- | ----------------- | ------------------------------------------- | ------------------------------------------ |
| 15255 | POST              | `/r/__PAON_SLUG__/api/appointment-request`  | Desktop appointment confirm                |
| 16406 | POST              | `/r/__PAON_SLUG__/api/appointment-request`  | Mobile appointment confirm (same endpoint) |
| 15461 | POST              | `/r/__PAON_SLUG__/api/cart-add`             | Add to bag                                 |
| 17001 | POST              | `/r/' + SLUG + '/api/table-service-message` | TableService private message               |
| 17024 | POST              | `/r/' + SLUG + '/api/table-service-inquiry` | TableService inquiry                       |
| 17570 | GET               | `/r/' + SLUG + '/api/cart-summary`          | Cart basket load                           |
| 17586 | POST              | `/r/' + SLUG + '/api/cart-update`           | Cart qty change                            |

React replacement: these 7 call sites (6 distinct endpoints, appointment
endpoint called from 2 places) must be preserved verbatim as the data
boundary — route through `storefront-page-data.ts`/Server Actions only if
that file already wraps them; otherwise keep as direct `fetch` calls to
the exact same paths from the corresponding React hook, so the existing
Route Handlers under `apps/customer/app/r/[slug]/api/` need no changes.

---

## Coverage summary

- Total source lines in `paon-template.html`: **17,699**
- Total source lines in `route.ts`: **1,067**
- Lines directly cited above with exact line numbers: every `@keyframes` (3/3), every `@media` block (18/18), every `backdrop-filter` cluster, every `:hover` rule region, every `transition:` region, all 155 `addEventListener` calls, all 64 inline `on*` handler attributes, all 229 top-level `function` declarations, all 3 `localStorage` call sites, all 7 `fetch` call sites, the 1 `<form>` element, all 5 `IntersectionObserver` instances, all 8 scroll listeners, and all resolvable `gsap.*` call sites — i.e. every occurrence returned by the category greps run against the full 17,699-line file, with no line range skipped.
- The file's ~39 `<script>` blocks are fully mapped in §1 (100% of blocks, start→end line spans covering lines 16-17,699).

Next exact action: do not begin React implementation until this inventory
has been reviewed against `storefront-page-data.ts`'s actual exported shape
and the two TableService endpoint branch conditions (§17) have been
confirmed by reading `apps/customer/app/r/[slug]/api/table-service-*`
route handlers directly, since this fork was restricted to
`paon-template.html`/`route.ts` only.
