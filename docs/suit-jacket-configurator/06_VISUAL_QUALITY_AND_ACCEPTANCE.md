# Visual quality and acceptance

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## The target, and it is Suitsupply

Decision D-15. **Suitsupply's still-image quality is the minimum bar PAON must
reach.** Tailoor/Armani is a useful architectural reference — modular glTF,
component slots, shared button meshes, lighting as data — and explicitly **not
a visual reference**. Its real-time fabric rendering is rejected as a quality
target.

Below the bar, nothing else in this dossier matters. A drape comparison that
looks worse than a competitor's static render will not be believed, whatever it
is showing.

### The floor, set from below

Founder judgment, 2026-08-15. These configurators were reviewed and **rejected
as unacceptable quality**. They define the floor: shipping anything that looks
like one of these is a failure, regardless of what else it does.

| Configurator     | URL                                                           | Founder verdict                                |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| 3D Suit Designer | `https://www.3dsuitdesigner.com/customize`                    | "utter shit"                                   |
| Enzo Custom      | `https://enzocustom.com/customize/suit-2p`                    | "looks like a cartoon and the shading is shit" |
| Sartoro          | `https://sartoro.co/products/astor-suit-in-sand-linen`        | "terrible"                                     |
| Bold Italia      | `https://bolditaliasuit.com/products/design-3-piece-suit-men` | "shit"                                         |
| Suitablee        | `https://suitablee.com/en/suit`                               | "shit"                                         |
| Lanieri          | `https://lanieri.com/en/pages/configurator`                   | Reviewed; believed to be Tailoor-based         |

`INFERRED`, and it is the important part: the rejected set is dominated by
**real-time browser 3D**, and the specific complaint — "looks like a cartoon
and the shading is shit" — is the exact failure mode of rasterized real-time
rendering with cheap lighting on low-polygon geometry. It is the same verdict
already reached on Tailoor/Armani.

This is independent confirmation of D-15 and D-16. The industry's real-time 3D
configurators cluster at a quality level the founder rejects; the one
configurator judged acceptable renders **offline and ships images**. The
architecture follows the quality, not the fashion.

Two things this changes:

1. **Real-time 3D is now guilty until proven innocent.** The optional live tier
   must clear the D-15 bar before it ships, and the prior on it clearing is now
   low. It is not a Phase 1 concern.
2. **Cartoonishness is a named, testable defect.** Flat shading, plastic sheen,
   absent contact shadow, over-smooth silhouette and low-frequency geometry are
   the tells. The acceptance panel (ch. 10 W6) tests against both ends: at least
   as good as the accepted reference, and unmistakably better than the rejected
   set.

### Measured, 2026-08-19 -- Pass-B, headless Chrome over CDP

Measured via `tools/pass-b/measure.py` (new this session; rerun with
`python3 tools/pass-b/measure.py`, see the script's own docstring for
setup). It drives headless Chrome
(`--headless=new --remote-allow-origins=* --user-data-dir=<throwaway>`),
connecting over the DevTools Protocol, navigating to each URL, waiting for
the page to settle (~8s), running a best-effort generic cookie-consent
dismissal, waiting again (~20s), then querying `document.querySelectorAll
('canvas')` and each canvas's `getContext('webgl'/'webgl2')` result, plus
Chrome's own Network domain events for per-asset transferred bytes. Chrome
was killed after each site; no visible browser window was ever opened, per
the standing order. Full JSON: `/tmp/pass-b-results.json`; a screenshot per
site: `/tmp/pass-b-<name>.png` (session-local paths, not committed —
screenshots are evidence for this write-up, not a durable artifact).

**This measurement has real limits, stated plainly so the numbers aren't
over-read:**

- The ~28s total settle window may not catch content that mounts even
  later, or only after actual user interaction beyond a single generic
  consent-dismiss click (selecting a fabric, clicking through a step,
  etc). A "no canvas detected" result means _not detected under this
  passive measurement_, not proof the site never uses WebGL anywhere in
  its flow.
- For at least one site (Sartoro) the URL in the table above lands on a
  photographed-model **product page**, not the configurator UI itself — a
  "Customize" button leads elsewhere, not followed this pass. That
  result describes the product page, not necessarily what the founder
  judged.
- Bot detection, certificate issues, and geo-blocking are real
  confounders under headless automation and are called out per-site
  below rather than silently absorbed into a "static" or "3D" verdict.

| Configurator     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3D Suit Designer | **Unmeasurable.** `NET::ERR_CERT_DATE_INVALID` — the site's own TLS certificate is invalid/expired as observed. Not a Chrome or measurement-harness fault.                                                                                                                                                                                                                                                                                                                                                               |
| Enzo Custom      | **Static/composited imagery, not real-time 3D**, as actually rendered on load. `canvasCount: 0`, `webglContextCount: 0` on the garment view (confirmed after a "Loading 3D … 11%" progress indicator finished and the garment fully rendered) — the visible jacket is a flat-shaded raster image with no fabric-weave texture, not a live WebGL scene, despite the page's own title calling itself a "3D Suit Configurator." Total transferred ≈12.9 MB after settle, dominated by Image (≈7.7 MB) and Script (≈2.0 MB). |
| Sartoro          | **Not measured** — the given URL is a photographed-model product page (real photography, `Customize` button unfollowed), not the configurator surface itself. `canvasCount: 0` on this page is expected and uninformative about the actual configurator.                                                                                                                                                                                                                                                                 |
| Bold Italia      | **Inconclusive.** Page stuck on a "Please wait a few seconds while we load the 3D configurator" spinner through the full ~28s settle window; `canvasCount: 0`, `scriptCount: 45`. Genuinely slow load, or incompatible with/blocked under headless automation — not distinguishable from this measurement alone.                                                                                                                                                                                                         |
| Suitablee        | **Confirmed real-time WebGL 3D.** `canvasCount: 3`, `webglContextCount: 3` — three live WebGL contexts, matching the visibly rendered garment (a jacket with a plausible shaded highlight/shadow gradient along the sleeve). No specific engine detected by script-name heuristic (likely a minified/bundled build). Total transferred ≈3.4 MB, dominated by Script (≈1.5 MB) and Stylesheet (≈0.4 MB).                                                                                                                  |
| Lanieri          | **Unmeasurable.** "Access Denied — Sorry this site may not be available in your region." Geo-blocked from this measurement's network origin, not a technical property of the configurator itself.                                                                                                                                                                                                                                                                                                                        |

**What this actually establishes**: the rejected set is not uniformly
real-time 3D as the earlier `INFERRED` note assumed — it's a mix. At
least one rejected configurator (Enzo) achieves its "cartoon" verdict
with **static/composited images**, not WebGL, which means D-15/D-16's
framing ("real-time 3D is the failure mode") is not the whole story:
flat shading and low-frequency geometry are the actual named defects
(as chapter already states), and they can come from either medium. At
least one (Suitablee) is confirmed real-time 3D and still earned a
"shit" verdict — real-time rendering isn't disqualifying by itself, poor
execution of it is. The founder's verdicts remain authoritative for
acceptance regardless of medium; this section only adds the technical
detail behind them, and only for the sites this pass could actually
reach.

**Not yet done**: delivered resolution (would need reading actual image
dimensions server-side, not just transferred bytes) and a definitive
engine identification for Suitablee's WebGL (would need inspecting the
minified bundle, not just its filename). Both are cheap follow-ups if
ever needed, not blocking anything currently in flight.

### Measured bar

`OBSERVED-DOM`, 2026-08-15, from
`suitsupply.com/en-us/custom-made?client=onLine&product=Suit&section=jacket&level=subgroup`.

| Property           | Measured value                                                       |
| ------------------ | -------------------------------------------------------------------- |
| Preview resolution | **1200 × 1500** standard; **1600 × 2000** at zoom; 4:5 portrait      |
| Swatch thumbnails  | 450 × 450                                                            |
| Delivered format   | **AVIF** dominant (130 of 305 responses), JPEG/PNG via `f_auto`      |
| Quality/fit params | `q_auto:good`, `c_fit`                                               |
| Per-layer weight   | base model 11.8 KB; lapel 6–8 KB; lining 6.1 KB; stitching **648 B** |
| Whole page         | 3.27 MB over 305 requests; median asset 2 KB                         |
| Rotation           | 3 discrete frames (`_R00`, `_R01`, `_R02`)                           |

The composite garment is assembled from layers of a few kilobytes each. This is
two orders of magnitude lighter than the 6 MB GLB budget in chapter 05, and it
is the strongest argument for baked imagery as the delivery medium.

### What the render actually looks like

A **ghost mannequin** — no body, no head — on a flat neutral-grey ground. Soft,
even studio lighting. Observed detail at native resolution: the lapel roll
curves and catches light with shading beneath its edge; horn buttons are
modelled with visible four-hole detail and brown mottling; welt chest pocket
and flap hip pockets read clearly; white lining shows in the front opening; the
hem flares slightly. It reads as an offline render or a photograph, not a
real-time frame.

PAON must match: resolution, format efficiency, soft-shadow quality, edge
fidelity on lapel and pocket details, and the flat neutral presentation.

### Functional bar observed alongside it

Over the preview: `Total $923` and `2-3 weeks delivery`. Navigation tabs
`Fabric` / `Jacket` / `Trousers` / `Waistcoat` plus `Finish`. A style preset
row (`Your Style: Milano`) with an edit affordance. Option rows rendered as
thumbnail + label + current value + chevron: `Closure — 2 Button`,
`Button — Dark & Light Brown`, `Lining — Full Lined`, `Lapel — Notch`,
`Monogram — None`. An `Advanced options` control separates the common set from
the long tail.

One pattern PAON should copy outright: **each option thumbnail is a cropped
render of that feature on the actual garment**, not a generic icon. The lapel
row shows a lapel close-up; the lining row shows the jacket falling open. For
PAON this is nearly free — the same bakes, cropped to different regions.

## Minimum passable requirements

Founder direction, 2026-08-15, recorded verbatim in intent: top-tier route, no
shortcuts. These are floors, not targets. Missing any one of them means Phase 1
has not shipped.

### Phase 1 — the still image

1. **Fabric depiction at least as accurate as Suitsupply.** The cloth must read
   as cloth — weave visible at native resolution, correct sheen behaviour for
   the fibre, no plastic or flat-shaded appearance.
2. **Shadows at least as accurate as Suitsupply.** Soft studio shadowing with
   correct contact shadow where the garment self-occludes: under the lapel edge,
   inside the front opening, beneath the pocket flaps, along the sleeve
   underside.
3. **Ray-traced light transport — absolute minimum, non-negotiable.** Rendering
   is path-traced (Blender Cycles), not rasterized and not Eevee. Rasterized
   preview output is a development convenience and must never be shipped. This
   is what produces the shadow and sheen quality the bar demands, and it is only
   affordable because delivery is offline-baked (D-16).
4. **Construction options legible.** A viewer must be able to tell the
   construction options apart _in the render_, without reading the label. The
   acceptance case is the hardest one in tailoring: **spalla camicia versus a
   roped shoulder**, rendered on the same jacket in the same cloth, must be
   distinguishable. See the shoulder criteria below.
5. **Option set at least as rich as the reference** for the jacket: closure,
   button, lining, lapel, pockets, vents, shoulder, monogram.

### Phase 2 — the spinnable model

6. A 3D model the customer can rotate freely — continuous orbit, not the
   reference's three discrete frames. This is where the live renderer earns its
   place, and it ships only if it holds the Phase 1 quality bar (D-15/D-16).

### Phase 3 — cloth in motion

7. The garment moves with the model, and the fabric responds somewhat
   realistically. This is the drape thesis fully realised, and it stays
   `illustrative` until calibration evidence exists (chapter 04, R-02).

Phase numbering here is PAON's own ladder of ambition and is indicative; the
requirements within each rung are not.

### Shoulder construction — the acceptance case

Shoulder is the test because it is the hardest visual distinction in a jacket,
it is what a tailoring audience checks first, and it cannot be faked. Chapter 09
classifies it `G+P`: the sleevehead geometry differs _and_ the ease behaves
differently, so it needs both a distinct mesh and a distinct simulation.

**Correction, and it matters.** Spalla camicia and con rollino are **not two
values of one option**. They are two independent axes, and conflating them
would be a visible category error to the audience this product is for:

| Axis                     | Values                                                       | What it controls                           |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------ |
| Sleeve attachment method | standard set-in · **spalla camicia** (shirt-style, gathered) | _How_ the sleeve joins the armscye         |
| Sleevehead treatment     | none/soft · **con rollino** (roped) · padded (English)       | _What is done_ with the resulting fullness |

A jacket may be spalla camicia with no rollino, spalla camicia with con rollino,
or a standard set-in sleeve with either treatment. Chapter 09's assembly table
must model two axes, not one list.

**Visual signatures the render must produce** — sourced, not invented:

- **Spalla camicia** produces _grinze_: puckered rippling where a larger
  sleevehead is eased into a smaller scye. The Rake describes it as "a puckered
  rippling, which the tailoring dilettante may view as imperfection, but the
  aficionado appreciates for its magnificent craftsmanship." Critically, the
  ripples concentrate **along the sleevehead seam toward the back**; the front
  reads comparatively clean. The shoulder line itself sits natural and soft with
  no ridge.
- **Con rollino** compresses that fullness into a **raised roll** at the
  sleevehead — Styleforum describes the sleevehead puffing "out a bit because of
  the closed seams which are forced outward," giving "the very light ridge you
  see on that coat." It reads as a rounded elevation that **casts its own
  shadow** under directional light, with the shoulder line slightly extended.
  Roll height is `BLOCKED` — no sourced dimension was found; it must be derived
  from the pattern, not guessed.

**Lighting and camera are part of the acceptance criteria, not styling.** This
is the sharpest finding, and it puts us in direct conflict with the reference:

> Flat frontal light **hides** these distinctions. Raking light — directional,
> roughly 45° and high to one side — is what makes a sleevehead roll cast a
> shadow and makes grinze read as ripples rather than noise.

Suitsupply's presentation is a flat-front ghost mannequin under even studio
light. That is optimal for clean product display and **actively wrong for
construction legibility**. Matching their lighting exactly would satisfy
requirement 2 and fail requirement 4.

PAON therefore needs both, and the asset graph already supports it as a light
scene axis:

| View                     | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Flat front, soft studio  | The reference-parity hero image (D-15)                                  |
| **Three-quarter, raked** | **Required.** Shoulder roll, lapel curve, shoulder-to-sleeve transition |
| Side profile             | Shoulder line slope and sleevehead roll in silhouette                   |
| Three-quarter back       | Grinze distribution — where spalla camicia is most legible              |

The three-quarter raked view is the acceptance view. A build that only produces
the flat hero shot has not met requirement 4, however good that shot looks.

### Other construction tells the render must not get wrong

These are what a tailoring audience reads as quality, and each is a concrete
geometry or shading requirement:

- **Lapel belly and roll.** Hand-padding stops short of the break line so the
  lapel rolls softly. The render must show a curved, three-dimensional lapel
  edge, not a pressed flat line.
- **Pick stitching.** Hand-picked edges show a slightly irregular line; machine
  AMF is uniform and more prominent. Whichever PAON depicts, it must be
  deliberate and consistent with the construction claimed.
- **Buttonholes (asola).** Full edge coverage, slight irregularity where hand-
  sewn.
- **Collar fit.** Sits clean on the neck without pulling away or wrinkling
  beneath.
- **Armhole height and sleeve pitch.** A high armhole with correct pitch shows
  no drag wrinkles. Wrong pitch reads instantly as cheap.
- **Quarters.** Open versus closed front cut is an intentional, visible design
  decision.
- **Three-dimensional chest.** Canvas carried to the side seam gives a subtle
  convexity that a flat-shaded render will not have.

### Sources for the shoulder criteria

| Source                                             | Organization    | Accessed   | URL                                                                                            | Limitation                                              |
| -------------------------------------------------- | --------------- | ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| The History and Anatomy of Neapolitan Tailoring    | The Rake        | 2026-08-15 | https://therake.com/stories/craft/the-history-and-anatomy-of-neapolitan-tailoring/             | Editorial, not a pattern-drafting specification.        |
| What "spalla camicia" really means                 | Permanent Style | 2026-08-15 | https://www.permanentstyle.com/2019/12/video-what-spalla-camicia-really-means.html             | Authoritative on terminology; no dimensions.            |
| Hand padding a bespoke jacket                      | Permanent Style | 2026-08-15 | https://www.permanentstyle.com/2022/07/hand-padding-a-bespoke-jacket-how-its-done-and-why.html | Explains lapel roll; describes craft, not geometry.     |
| Collar and armhole: how bespoke craft enhances fit | Permanent Style | 2026-08-15 | https://www.permanentstyle.com/2020/10/collar-and-armhole-how-bespoke-craft-enhances-fit.html  | Collar and armhole tells.                               |
| Con rollino vs. spalla camicia                     | Styleforum      | 2026-08-15 | https://www.styleforum.net/threads/con-rollino-vs-spalla-camicia.22768/                        | Forum discussion; establishes the two-axis distinction. |
| Rope shoulder construction                         | Styleforum      | 2026-08-15 | https://www.styleforum.net/threads/rope-shoulder-construction.265443/                          | Forum; no sourced roll dimension.                       |

### What the bar does not include

That jacket is a single static pose. No body, no posture, no movement, no drape
variation. It renders **construction** superbly and says nothing about how the
cloth behaves. That absence is the entire PAON opportunity, and it is only
worth pursuing from a starting point that already matches the bar above.

## Goldens

Capture deterministic desktop (1440×900) and mobile (390×844) images for all 27
tuples: 3 cloth profiles × 3 static states × 3 lights. A golden's identity is
the full tuple **plus** the renderer version, `outputColorSpace`, `toneMapping`,
`toneMappingExposure`, camera seed, light rig and named asset manifest version.
Changing any of those invalidates the set; there is no partial re-baseline.

A perceptual image diff — masking only the loading indicator and
time-independent antialiasing — blocks a build at >0.5% changed pixels or a
maximum channel delta >24, and routes the result through an automated
multimodal tailoring checklist.

These thresholds are review gates. They detect _change_. They do not establish
that an image is correct, that a jacket reads as a jacket, or that a drape is
physically plausible. A build that passes every threshold can still be wrong in
every way that matters to a tailor.

## Regression tooling

`OBSERVED-DOC`, retrieved 2026-08-15. Playwright's visual comparison compares a
screenshot against a committed golden via `toHaveScreenshot()`, and the
documentation states that Playwright Test uses the **pixelmatch** library, with
options passed through to it — `maxDiffPixels` is documented, settable per
assertion or globally under `expect.toHaveScreenshot` in `playwright.config.ts`.
Snapshots are stored beside the test in a `<file>.spec.ts-snapshots` directory
that the documentation says should be committed to version control and reviewed
on change.

Two honest limits:

- The documented option surface on that page is `maxDiffPixels` and
  `stylePath`. Default values for `threshold` and `maxDiffPixelRatio` are **not
  stated there**, so PAON must set its thresholds explicitly rather than rely on
  an assumed default. The 0.5% / delta-24 numbers above are PAON policy, not
  inherited defaults.
- Playwright documents that browser rendering varies with host operating
  system, version, settings, hardware, power source and headless mode. A golden
  is therefore valid only for the exact environment that produced it. Goldens
  must be generated in a pinned container, and a developer machine disagreeing
  with CI is expected behaviour, not a defect.

## Acceptance criteria

- Keyboard radios identify profile, state and light; focus is visible; every
  control has an accessible description.
- Labels explain relative character without an accuracy claim, and the
  `illustrative` provenance of every profile is visible in the interface, not
  buried in a tooltip.
- Desktop, mobile, reduced-motion, no-JavaScript, no-WebGL and failed-load
  states all present the full comparison in text.
- **The D-15 bar is met.** Every shipped tuple renders at 1200 × 1500 (1600 ×
  2000 zoom), delivered as AVIF with JPEG/PNG negotiation, and is judged
  side-by-side against a reference render on soft-shadow quality, lapel-roll
  fidelity, button and pocket edge detail, fabric surface and presentation.
  This is a human review gate, and it blocks release.
- **Tier parity**, if and only if the optional live tier-2 renderer ships: it
  presents the same selection, controls, labels and explanatory text as tier 1
  from the same `bake_key`, asserted by test rather than inspection. Tier 2 does
  not ship unless it also meets the D-15 bar.
- No external network request is made for any garment, texture, HDRI or swatch
  asset.
- The manifest hash matches the rendered variant; an unavailable asset fails
  closed to the poster rather than rendering a stale or partial scene.
- The glTF Validator passes on every shipped asset (chapter 03) — necessary,
  never sufficient.
- Chapter 09's graph checks pass: seam ring arity and arc-length correspondence
  hold between every attachable assembly pair; grain-vector delta across each
  seam is under the published threshold; UV chart leases are disjoint; anchors
  resolve to valid surface bindings in every drape state; and every reachable
  selection either resolves or fails closed with a published reason.
- A substituted assembly produces **no visible join**. This needs its own
  review: a seam artefact is a small, localized, high-salience defect that a
  whole-image pixel budget of 0.5% will not catch. Assembly-substitution
  goldens are therefore diffed against a seam-region mask at a stricter
  threshold than the full frame.
- No material change to the legacy FT-07 save flow, pricing, customer data or
  jobs.

## Device matrix

Chromium desktop and mobile emulation are required for the lab. Emulation is
where the matrix starts, not where it ends: before any product claim, verify on
current Safari/iOS, Chrome Android and Firefox desktop across representative
physical GPU classes, including a low-memory mobile device.

`OBSERVED-DOC`, from chapter 05: MDN's guidance that the only errors a
well-formed WebGL page generates are `OUT_OF_MEMORY` and `CONTEXT_LOST` makes
the low-memory device the load-bearing test case, not an edge case. CI headless
GPU rendering can differ materially from physical devices, so a green CI matrix
is not device evidence.

## When evidence is insufficient

A product claim stays blocked. It is not downgraded to a caveat, and it is not
converted into a task for the founder to buy devices, hire a QA specialist or
operate 3D software. The lab ships with the claims its evidence supports and
says plainly which ones it does not make.

## Sources

| Source               | Organization           | Date accessed | URL                                                                             | Relevance / limitation                                                                                   |
| -------------------- | ---------------------- | ------------: | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Visual comparisons   | Microsoft / Playwright |    2026-08-15 | https://playwright.dev/docs/test-snapshots                                      | Deterministic screenshot regression via pixelmatch; defaults for `threshold` are not stated on the page. |
| WebGL best practices | MDN                    |    2026-08-15 | https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices | Establishes low-memory failure as the primary device risk; guidance, not a device matrix.                |
