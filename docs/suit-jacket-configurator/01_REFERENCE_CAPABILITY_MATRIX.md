# Reference capability matrix

Research passes: 2026-08-14 (prior pass) and 2026-08-15 (this pass). This is a
clean-room behavioral benchmark. Observable capability and interaction
mechanics may become explicit PAON requirements; implementation inputs remain
original or rights-cleared. Evidence tiers are defined in
`00_NORTH_STAR_AND_SCOPE.md`.

## Method for the 2026-08-15 pass

Two techniques were used, and the difference between them is itself a finding.

**Pass A — static DOM dump.** Playwright's `chromium-1228` build in
`--headless=new --dump-dom` mode with a 20 s virtual-time budget, desktop and
iOS user agents. This produced unhydrated shells and misleading negatives.

**Pass B — driven live browser.** An ordinary Google Chrome installation
(151.0.7922.138) launched with `--remote-debugging-port` on a throwaway profile
and driven over the DevTools protocol, with a full page lifecycle, consent
handling, settle time, in-page probes and a network response log.

Pass B changed the conclusions materially. Sites that appeared to be empty
shells or Cloudflare walls under Pass A loaded normally under Pass B — the
automation browser build was being fingerprinted, not the requests. **Any
`BLOCKED` or "nothing rendered" finding in this dossier that rests on Pass A
alone should be treated as provisional until re-tested under Pass B.**

The rendered DOM and network logs were parsed directly by the author of this
document rather than summarized by an assistant.

| Capture                   | URL                                                          | HTTP |   Bytes | SHA-256 (prefix)          |
| ------------------------- | ------------------------------------------------------------ | ---: | ------: | ------------------------- |
| Suitsupply, desktop       | `https://custommade.suitsupply.com/configurator`             |  200 | 503,465 | `d328507ff7d2a1dc`        |
| Suitsupply, mobile        | `https://custommade.suitsupply.com/configurator`             |  200 | 503,096 | `709baa7e6b8d5e0d`        |
| Armani, desktop           | `https://mtmconfigurator.armani.com`                         |  200 | 577,961 | `dd37fbb325a1acaf`        |
| Armani, `/it/`            | `https://mtmconfigurator.armani.com/it/`                     |  200 | 673,482 | retained locally          |
| Armani, customize         | `https://mtmconfigurator.armani.com/us/en/customize/jackets` |  200 | 568,776 | retained locally          |
| Suitsupply, live (Pass B) | `https://custommade.suitsupply.com/configurator`             |  200 |       — | screenshots + network log |
| Armani, live (Pass B)     | `…/en-us/customize/Formal%20jacket?step=1`                   |  200 |       — | screenshots + network log |

Captures are session-local evidence held outside the repository. No competitor
asset, image, font or code was downloaded into PAON, and no capture is
committed.

## Correction to the prior pass

The 2026-08-14 entry recorded Armani as loading "with no interactive elements"
and therefore inaccessible. That is **superseded**: the Armani host returns a
fully hydrated document, and under Pass B its configurator mounts a WebGL scene.

The prior pass also attributed a visible fabric list, price and delivery
messaging to Suitsupply's rendered page. Pass A appeared to refute that — the
static dump renders nothing. Pass B **vindicates the original entry**: driven
live, the page shows 48 controls and resolves `Total €723` and
`2-3 weeks delivery`.

The lesson is recorded rather than smoothed over. An intermediate version of
this chapter downgraded a correct observation to `PAYLOAD` on the strength of a
tooling artefact. Corrections should move claims to whichever tier the best
available evidence supports — not reflexively to the stricter one.

## Suitsupply — what is literally in the served document

`OBSERVED-DOM`. The desktop and mobile captures are structurally identical. The
rendered document contains only these element types: `html`, `head`, `title`,
`meta`, `link`, `style`, `script`, `body`, `div`, `img`,
`next-route-announcer`. Measured directly on the capture:

| Signal                          | Count |
| ------------------------------- | ----: |
| `<canvas>` elements             |     0 |
| `<button>` elements             |     0 |
| `role=` attributes              |     0 |
| `aria-label` attributes         |     0 |
| `tabindex` attributes           |     0 |
| `<noscript>` elements           |     0 |
| `<img>` with an `alt` attribute |     1 |

The single image is a Cloudinary-style transform URL under
`cdn.suitsupply.com/image/upload/c_fit,f_auto,h_1125,q_auto:good,w_900/custommade/assets/default-images/Jacket`
and carries `alt=""`. The document title is `Suitsupply - Custom made`.

`OBSERVED-DOM`: the document is served by Next.js (a `next-route-announcer`
element is present).

The payload's asset model is examined in full below, and it is the single most
useful thing this pass recovered. Chapter 09 builds the PAON asset contract on
it.

## Suitsupply — what is in the payload but was never rendered

`PAYLOAD`. The Next.js data payload embeds an internationalization dictionary
and an option catalogue. The following literal fragments were extracted from
the capture and are reproduced only as proof of observation. Per chapter 00,
none of this vocabulary may be copied into PAON.

- Flow strings: `"startDesigning":"Start designing"`, `"previous":"Previous"`,
  `"next":"Next"`, `"finish":"Finish"`.
- Commercial strings: `"total":"Total"` and
  `"deliveryWeeks":"{min}-{max} weeks delivery"` — a template, not a resolved
  lead time. No resolved price or week count was observed.
- Compatibility strings: a `missingOptionsToast` key and the message
  `"Please update your options."`
- Taxonomy shape: entries typed `"OPTION_GROUP"` and `"OPTION"`, each carrying
  `optionId` / `code` / `name` / `description` / `imageName` /
  `imageUrlTemplate`, e.g. group `{"type":"OPTION_GROUP","id":10024,"name":"Lapel"}`
  and options coded `LN1`, `STNL2`, `SPPA5`, `SPRP7`, `BPFWB3`, `CPWBF02`.
- A `monogramPanel` object with `title` / `none` / `cancel` keys.

What this establishes is narrow: the product **has** grouped options, per-option
descriptions, a monogram panel, a delivery-weeks template, a running total and
an incompatibility message. It does not establish how any of those behave, what
they cost, which combinations are refused, or how the interface presents them.

Observed `OPTION_GROUP` names in the capture: `Pocket`, `Waistband`, `Button`,
`Lining`, `Lapel`. A representative `OPTION` object carries
`{id, type, code, name, imageName, imageUrlTemplate, appendCode,
showDescription, hasSearch, isAdvanced, zoomPosition, rotationPosition,
optionValues[]}`. `hasSearch` and `isAdvanced` are notable: the product
distinguishes searchable option sets from small ones, and basic from advanced
configuration.

## Suitsupply — the asset graph in the payload

`PAYLOAD`, and the most transferable finding of this pass. The payload declares
an ordered, option-keyed layer graph per configuration type:

```text
layerDefinitions.configurationTypes["3"] = {
  fallbackUrl: "custommade/assets/default-images/Waistcoat",
  sequenceNo:  3,
  layerDefinitions: [
    { imageTemplate: "suitconfig/{fabricId}/Waistcoat/lapel/{3}_{104}_CNP1" },
    { imageTemplate: "suitconfig/{fabricId}/Waistcoat/pocket/{3}_{120}" },
    { imageTemplate: "suitconfig/shared/lining/{3}_{104}_{2}_{113}" },
    { imageTemplate: "suitconfig/shared/buttons/{3}_{104}_{125}" },
  ]}
```

A resolved layer carries `src`, `srcSheet` (pointing at a `…/rotation/…_sheet`
sprite sheet), `srcRotation` (a `…_{rotation}` template) and `srcset`. Observed
`rotationPosition` values are `{0,1,2}` and `zoomPosition` values `{0,2,3,4,5,8}`.
Layer counts in the payload: `imageName` 765, `layerImageName` 708,
`imageUrlTemplate` 372; `layerImageName` values are fabric SKU codes such as
`S599.101-855`. Each configuration type declares a `fallbackImage` with the
same `src`/`srcSheet`/`srcRotation`/`srcset` shape as a real layer. A
server-side composite service is referenced
(`CreateConfiguredProductImage` under `apim.suitsupply.com`), alongside a
`previewModeToggle` whose accessible label is `Toggle model view`.

Five properties follow directly and are analysed as PAON's precedent in
chapter 09: ordered composition; option-id-keyed asset addressing;
material-dependent (`{fabricId}`) versus shared (`shared/`) assemblies;
per-layer discrete view variants; and fallback as a first-class graph node.

## Suitsupply — driven live, and the medium is settled

`OBSERVED-DOM`, 2026-08-15. The static dumps above were a tooling artefact: the
page hydrates fully when driven in an ordinary Chrome installation over the
DevTools protocol, with a real page lifecycle and time to settle. Driven that
way it reports:

| Probe                        | Value                                                    |
| ---------------------------- | -------------------------------------------------------- |
| `<canvas>` elements          | **0**                                                    |
| WebGL context                | **none** — no canvas to hold one                         |
| `window.THREE`               | **undefined**                                            |
| `<button>` elements          | 48                                                       |
| `<img>` elements             | 431                                                      |
| 3D assets in the network log | **none** — no `.glb`, `.gltf`, `.ktx2`, `.basis`, `.drc` |

Live control labels: `Start designing`, `info`, `Zoom`, `Reset` (three
Zoom/Reset pairs), `Finish`, `Resume`, `Start fresh`.

**Price and lead time now resolve, and are observed rather than templated:**
the info panel reads `Total €723` and `2-3 weeks delivery`, alongside a
checkmark and an "All options are…" completeness message. Chapter 01's earlier
`PAYLOAD` entry for `{min}-{max} weeks delivery` is superseded by the rendered
value.

**The preview is a stack of separate `<img>` layers, one per assembly.**
Observed live, each its own element and its own request:

```text
…/v4/suitconfig/S599.101-855/Jacket/ai-generated/ai-model
…/suitconfig/S599.101-855/Jacket/model/MBN2
…/suitconfig/S599.101-855/Jacket/shoulder/MBN2_SS3
…/suitconfig/S599.101-855/Jacket/lapel/MBN2_LN1_NLWS2
…/suitconfig/S599.101-855/Jacket/chest-pocket/MBN2_CPBS1
…/suitconfig/S599.101-855/Jacket/pocket/MBN2_SPF5.5_TPN2
…/suitconfig/S599.101-855/Jacket/stitching/MBN2_LN1_NLWS2_HAMF2mm2
…/suitconfig/S599.101-855/Jacket/stitching/MBN2_LN1_NLWS2_BHFUNC1
…/suitconfig/shared/lining/MBN2_LFL1_1098
…/suitconfig/shared/buttons/MBN2_G8
…/suitconfig/S599.101-855/Trousers/construction/PLNO1_R00 … _R01 … _R02
```

Four facts follow, all now `OBSERVED-DOM` rather than inferred:

1. **The medium is 2D layered composition, composed client-side.** Separate
   `<img>` elements per layer, no canvas, no WebGL, no 3D asset of any kind.
2. **The material-dependent versus shared split is real.** Layers under
   `{fabricId}` (`S599.101-855`) versus `shared/lining` and `shared/buttons`,
   exactly as chapter 09 predicted from the payload.
3. **Rotation is discrete pre-rendered frames**, suffixed `_R00`, `_R01`,
   `_R02` — three of them, matching the payload's `rotationPosition` values
   `{0,1,2}`. There is no camera.
4. **Assembly granularity is finer than this dossier proposed.** `stitching` is
   its own layer, and is addressed by the assemblies it depends on
   (`MBN2_LN1_NLWS2_HAMF2mm2` for a hem finish, `…_BHFUNC1` for buttonholes).
   Chapter 09 treats stitching as part of an assembly; the reference treats it
   as a dependent layer of its own.

One further observation worth flagging for PAON's own roadmap: the top layer is
`Jacket/ai-generated/ai-model`, served under a `v4` path with a crop transform.
The reference product is compositing **AI-generated model imagery** beneath its
configured garment layers.

**What is settled and what is not.** Suitsupply composes 2D image layers
client-side: settled, observed, no longer an inference. That any reference swaps
**meshes** remains `INFERRED` and **unverified** — and for Suitsupply it is now
positively refuted.

## Armani — what is literally in the served document

`OBSERVED-DOM`. The host is reachable and its shell renders.

| Signal                  | Count | Notes                                                                               |
| ----------------------- | ----: | ----------------------------------------------------------------------------------- |
| `<button>` elements     |    29 | Site chrome and consent, not configurator controls                                  |
| `aria-label` attributes |    75 | Includes a literal `open configurator tutorial`                                     |
| `role=` attributes      |    20 | Values: `dialog`, `img`, `navigation`, `presentation`, `region`, `status`, `switch` |
| `tabindex` attributes   |    11 |                                                                                     |
| `<noscript>` elements   |     3 | Two tag-manager iframes; one `You need to enable JavaScript to run this app.`       |
| `<img>` with `alt`      |    11 | Category names plus `Company Logo`, `Powered by Onetrust`                           |
| `<canvas>` elements     |     0 | No WebGL, `three` or `gltf` reference anywhere in the capture                       |

Observed entry surface: a heading set of `daywear`, `evening`,
`Madison Avenue Collection`, then category headings `JACKETS`, `TROUSERS`,
`SHIRTS`, `LEATHER`, `OVERCOATS`, `SUITS`, `WAISTCOATS`, `KNITWEAR`, `DENIM`,
each paired with a `Customize` call to action. Visible chrome includes
`Customize by category`, `Appointments`, `Your selection`, a locale control
labelled `United States (USD) | English - Select Your Country / Region`,
`My Account`, `Cart`, `Contact us` and the promotional line
`Log in to your account to get free shipping on orders over $150`. The consent
layer is OneTrust (`Accept Cookies`, `Allow All`,
`Do not sell or share my personal information`).

`INFERRED`: Armani's entry is category-first — the customer picks a garment
category before any configuration — and the product couples configuration to an
`Appointments` concept and a persistent `Your selection`. The literal
`open configurator tutorial` label indicates an onboarding affordance exists.

## Armani is a Tailoor deployment

`OBSERVED-DOM`. The Armani captures identify their platform vendor directly.
The document head declares `<link rel="dns-prefetch" href="https://storage.tailoor.com/">`
plus `preconnect` hints to `storage.tailoor.com` and
`storage-staging.tailoor.com`, and retains a commented-out
`<!-- <title>Tailoor</title> -->`. Editorial imagery is served from
`storage-prod.tailoor.com`, path-structured as
`/static/armani/editorial/mtm/day/{jacket|trouser|shirt|leather|overcoat}.jpg`.
Third-party scripts loaded are `cdn.cookielaw.org`, `js.stripe.com`,
`stapecdn.com` and `googletagmanager.com`. A `DEPRECATED_ENDPOINT Tailoor`
token appears adjacent to the JavaScript notice.

`SECONDARY`, from vendor marketing at `tailoor.com`: Tailoor (Milan) describes
itself as "the first 3D AI white label digital commerce platform" for
made-to-measure and customized clothing, claims that "3D visualization of the
product will be visible in real-time" and advertises "Photorealistic rendering
of surfaces, textures, volumes, and proportions", virtual avatar try-on and
digital twins. Tailoor publishes no API documentation, no GitHub organization,
no customer roster and no technical description of its engine or asset formats.

Two further captures of deeper Armani paths (`/it/` at 673,482 bytes and
`/us/en/customize/jackets` at 568,776 bytes) again contain **zero** `<canvas>`,
WebGL, `gltf`, `glb`, `model-viewer`, Babylon, PlayCanvas or Unity signals.
Both remain category and marketing surfaces.

## Armani — the configurator itself returns an error state

`OBSERVED-DOM`, 2026-08-15, from the direct configurator URL
`https://mtmconfigurator.armani.com/en-us/customize/Formal%20jacket?step=1`
(743,711 bytes, HTTP 200, no Cloudflare interstitial).

The Tailoor application **boots** — its notification regions are present
(`Notifications-top`, `-top-left`, `-top-right`, `-bottom-left`, `-bottom`,
`-bottom-right`), and it loads the white-label brand mark from
`storage-prod.tailoor.com/customers/logo/armani.png`. The multi-tenant path
segment `customers/logo/{brand}.png` corroborates the white-label positioning.

It then renders a failure state. The document's only substantive heading is
`The site is momentarily unavailable.`, paired with a `Try again` button.
Everything else in the DOM is the OneTrust consent layer. Element counts: 14
`<button>`, 8 `<input>`, 3 `<img>`, 17 `role=`, 2 `tabindex`.

**That capture was uninformative about rendering medium**, because the
application errored before mounting any configurator view. It is retained as a
record of the failure mode, not as evidence about the medium. A later attempt
succeeded.

## Armani/Tailoor — the configurator mounted, and it is WebGL and glTF

`OBSERVED-DOM`, 2026-08-15, same URL, driven in an ordinary Chrome installation
over the DevTools protocol with a full page lifecycle. This time the
configurator mounted.

| Probe               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| `<canvas>` elements | **1**                                                          |
| WebGL context       | **true** — a live context on that canvas                       |
| `window.THREE`      | undefined — so not three.js on the global, engine unidentified |
| `<button>` elements | 31                                                             |
| `<img>` elements    | 22                                                             |

Visible headings include `Monochromatic Prince Of Wales` and
`THE MADE-TO-MEASURE SERVICE`; controls include `NEXT STEP` and `Filter by`;
and a `gestures_qmark.svg` icon is loaded, implying a gesture help affordance
consistent with an orbitable scene.

**The network log settles the medium.** Ten `.gltf` files and two `.bin`
buffers were fetched, alongside 22 `.jpg`, 5 `.png`, 3 `.json` and 10 `.js`.
Observed asset paths, all under `storage-prod.tailoor.com`:

```text
configurator/3DAssets/1100/3DModels/10000/10000.gltf
configurator/3DAssets/1100/3DModels/10000/2500/0EGA10.gltf  (+ .bin)
configurator/3DAssets/1100/3DModels/10000/2600/001.gltf
configurator/3DAssets/1100/3DModels/10000/2800/000.gltf      (+ .bin)
configurator/3DAssets/1100/buttons/B08/B08-30.gltf
configurator/3DAssets/1100/buttons/B08/B08-15.gltf
configurator/3DAssets/1100/materials/asola.png
configurator/3DAssets/1100/materials/fodere/FS6/FODERA_COLOR.png
images/fabrics/51/<fabricId>/wave.jpg
images/fabrics/51/<fabricId>/maps/SPECULAR.jpg
config/configurator/config-json
config/configurator/lights-json
```

Supporting infrastructure observed: a micro-frontend shell
(`mfe/armani/home/remoteEntry.js`, i.e. Module Federation) and a multi-tenant
resolution endpoint keyed on hostname
(`apim-fe-prod.tailoor.com/api/v1/customers/url/mtmconfigurator.armani.com`).

**Tailoor's real-time 3D claim is therefore no longer marketing — it is
observed.** A live WebGL context, glTF geometry with external binary buffers,
and a lighting rig delivered as configuration.

## What the Tailoor asset layout confirms

`INFERRED` from the path structure, but the structure is unusually legible:

1. **A base model plus numbered component slots.** `3DModels/10000/10000.gltf`
   is the root; `2500/`, `2600/` and `2800/` are separate directories beneath
   it, each holding its own `.gltf`. That is a family root with independently
   fetched assemblies — not one model per combination.
2. **Buttons are separate meshes**, under `buttons/B08/` as `B08-30.gltf` and
   `B08-15.gltf` — plausibly two sizes of one button design. Rigid shared
   components shipped independently of the garment, exactly as chapter 09
   specifies.
3. **Materials are separate from geometry.** `materials/asola.png`
   (Italian for buttonhole) and `materials/fodere/FS6/FODERA_COLOR.png`
   (lining) are texture assets, not meshes.
4. **Fabric is a material binding, not geometry.** Each fabric id carries
   `wave.jpg` and a `maps/SPECULAR.jpg` — appearance maps, fetched per fabric,
   with no corresponding geometry fetch.
5. **Lighting is data.** A dedicated `lights-json` endpoint delivers the scene
   rig, separately from the model.

Points 1–5 are, in a shipping product, chapter 09's three-mechanism model:
geometry substitution for assemblies, material binding for fabric and lining,
and shared rigid instances for buttons. PAON's asset graph now has a working
precedent in the medium it targets.

What it _does_ establish, and what PAON should take from it: the reference
product's failure mode is a **full-page dead end**. It does not degrade to a
reduced-fidelity view, a cached previous selection, or a readable description
of the garment. It offers a retry and nothing else. PAON's three-tier ladder in
chapter 05 is a deliberate improvement on exactly this behaviour.

Whether the error is transient, geographic, bot-related or a genuine outage is
`GATED`; the capture cannot distinguish them.

## Capability matrix

| Capability                    | Suitsupply                                                                                            | Armani                                                                                           | PAON interpretation                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Entry and base model          | `OBSERVED-DOM` a live `Start designing` control leading to `?section=fabric&level=group`              | `OBSERVED-DOM` category-first entry, then a stepped flow with `NEXT STEP` over a WebGL scene     | Lab starts with one jacket only; no category chooser                      |
| Fabric discovery/filter/sort  | `GATED`. Prior pass reported a rendered fabric list; this pass cannot confirm it                      | `GATED`                                                                                          | Small explained cloth-character set, not catalogue browsing               |
| Construction / canvas         | `PAYLOAD` option groups exist                                                                         | `GATED`                                                                                          | Original option taxonomy and compatibility contract                       |
| Lapels                        | `PAYLOAD` group `Lapel` with coded options                                                            | `GATED`                                                                                          | One fixed notch lapel in the lab                                          |
| Pockets                       | `PAYLOAD` patch/flap options with descriptions                                                        | `GATED`                                                                                          | One fixed flap pocket in the lab                                          |
| Buttons                       | `PAYLOAD` referenced in option codes                                                                  | `GATED`                                                                                          | Out of scope for the lab                                                  |
| Vents                         | `GATED`. Not distinguishable from substring noise in either capture                                   | `GATED`                                                                                          | One fixed side vent in the lab                                            |
| Lining                        | `PAYLOAD` token present; behaviour unobserved                                                         | `GATED`                                                                                          | Out of scope for the lab                                                  |
| Personalization               | `PAYLOAD` `monogramPanel` with `none` / `cancel`                                                      | `GATED`                                                                                          | Out of scope for the lab                                                  |
| Sizing and fit                | `GATED`                                                                                               | `GATED`                                                                                          | Explicitly absent: no fit or measurement claim                            |
| Price and lead time           | `OBSERVED-DOM` resolved live: `Total €723` and `2-3 weeks delivery`, with a completeness checkmark    | `OBSERVED-DOM` only a shipping-threshold promotion                                               | Explicitly absent: no price or lead-time claim                            |
| Incompatible combinations     | `PAYLOAD` a `missingOptionsToast` and `Please update your options.`                                   | `GATED`                                                                                          | Compatibility must publish a reason, not just disable a control           |
| Save / share / advisor / cart | `GATED`                                                                                               | `OBSERVED-DOM` `Your selection`, `Cart`, `Appointments`, `My Account` exist                      | Out of scope for the lab; advisor continuation is a later Studio contract |
| Camera, zoom, gestures        | `OBSERVED-DOM` three `Zoom`/`Reset` pairs; rotation is discrete `_R00/_R01/_R02` frames, not a camera | `OBSERVED-DOM` a `gestures_qmark.svg` help icon over a live WebGL canvas; gestures not exercised | Fixed comparison camera; optional orbit only after performance proof      |
| Mobile behavior               | `OBSERVED-DOM` mobile UA returns a structurally identical unhydrated document                         | `GATED`                                                                                          | Mobile is a first-class target, not an emulation afterthought             |
| Keyboard and accessibility    | `OBSERVED-DOM` zero `role`, `aria-label`, `tabindex` or `button` in the served document               | `OBSERVED-DOM` rich ARIA in chrome; configurator controls unobserved                             | Keyboard radios, semantic headings, no-WebGL poster required              |
| Loading / failure / no-JS     | `OBSERVED-DOM` no `<noscript>` at all: without JavaScript the page has no content                     | `OBSERVED-DOM` `You need to enable JavaScript to run this app.`                                  | A no-JavaScript and no-WebGL reader must still get the full comparison    |
| Login / session / geo gating  | `GATED`                                                                                               | `OBSERVED-DOM` account, cart and a country/region selector exist; gating unexercised             | The lab is public, reads no tenant data and has no session                |

## What PAON takes and what it refuses

Taken as capability requirements, implemented originally: grouped options with
per-option explanatory text; an explicit incompatibility message rather than a
silently disabled control; a persistent running selection; an onboarding
affordance; a category or context entry that establishes what is being
configured; genuine mobile parity.

Taken as an **architecture** requirement, and specified in chapter 09: a
modular, ordered, option-keyed asset graph with material-dependent and shared
assemblies and first-class fallbacks — never a complete pre-built model per
combination.

Refused: resolved price and lead-time promises in a comparison surface;
catalogue-scale fabric browsing; any option vocabulary, code, description or
path convention copied from either reference; and — see chapter 05 — the
assumption that a 3D renderer is the right answer merely because PAON can build
one. One reference is payload-verified to compose 2D layers; the other's vendor
markets real-time 3D but exposed no 3D signal in any capture. The benchmark
therefore does not settle the medium. PAON must win that argument on drape
legibility rather than inherit it.

## What remains unobserved

Neither pass drove a single interaction. For both targets the following are
`GATED` and must not be inferred: option selection and its visual response,
price computation, lead-time resolution, which combinations are refused and
how, save, share, cart, advisor handoff, camera and gesture behaviour, live
keyboard order and focus management, error and failure states, login,
session persistence and geography-dependent behaviour. Closing these requires
driving the applications interactively, which this pass deliberately did not do.

## Sources

| Source                   | Organization | Date accessed | URL                                            | Relevance / limitation                                                                        |
| ------------------------ | ------------ | ------------: | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Custom Made configurator | Suitsupply   |    2026-08-15 | https://custommade.suitsupply.com/configurator | Primary live capture; served document is unhydrated, so all option facts are payload-tier.    |
| Made-to-measure overview | Suitsupply   |    2026-08-14 | https://suitsupply.com/en-us/men/custom-made   | Primary public context from the prior pass; availability and claims can change.               |
| MTM configurator         | Armani       |    2026-08-15 | https://mtmconfigurator.armani.com             | Primary live capture; shell and entry surface observable, configurator itself gated.          |
| Tailoor platform site    | Tailoor      |    2026-08-15 | https://tailoor.com/                           | Vendor marketing only; 3D and photorealism claims are unverified by any capture in this pass. |
