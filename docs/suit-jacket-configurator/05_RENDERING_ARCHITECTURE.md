# Rendering architecture

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## The benchmark does not settle the medium

`OBSERVED-DOM`. Suitsupply, driven live on 2026-08-15, composes its preview
from separate per-assembly `<img>` layers with discrete `_R00`/`_R01`/`_R02`
rotation frames. Zero `<canvas>`, no WebGL context, `window.THREE` undefined,
and no `.glb`, `.gltf`, `.ktx2`, `.basis` or `.drc` in the network log. Their
medium is **2D layered composition, client-side**. This is settled, not
inferred (chapter 01).

`OBSERVED-DOM`. Armani, running on Tailoor, mounts a canvas with a live WebGL
context and fetches ten `.gltf` files plus `.bin` buffers from a modular
`3DAssets/` tree — a family-root model, independently fetched component slots,
separate button meshes, materials and fabric maps decoupled from geometry, and
a lighting rig delivered as JSON (chapter 01).

The benchmark therefore splits cleanly, and both halves are observed: one
reference composes 2D layers, the other renders modular glTF in WebGL. 3D is a
proven medium for made-to-measure configuration, not a PAON gamble — which
removes the "can it be done" question entirely.

What parity still does not settle is the only question PAON actually cares
about. A 3D renderer here has to be justified by the one thing 2D layer
composition genuinely cannot do: show the same construction under different
**cloth behaviour**, where the difference lives in fold formation and silhouette
break rather than in colour and pattern. Layered rasters can swap a lapel; they
cannot show a soft cloth collapsing differently from a crisp one across the same
shoulder. Note that Tailoor's own fabric assets are appearance maps —
`SPECULAR.jpg` and a `wave.jpg` per fabric — with no per-fabric geometry fetch
observed, which suggests their fabric switching is a material rebind rather than
a drape change. If so, nobody in this benchmark is yet showing what PAON wants
to show.

## Founder decisions: 3D builds it, images ship it

D-12 settled that PAON builds the 3D path rather than deferring the question.
D-15 and D-16 then settled _what ships_, after the reference renders were
measured and viewed:

- **Suitsupply's still-image quality is the minimum bar** (D-15). Tailoor's
  real-time fabric rendering is rejected as a visual target — it is an
  architectural reference only.
- **3D is the production medium; baked imagery is the delivery medium** (D-16).
  Build and simulate the garment in 3D, render offline at full quality, ship
  images. Real-time WebGL is optional and must clear the D-15 bar first.

The reasoning is in the measurements. Suitsupply renders offline with an
unlimited per-image budget and ships 1200 × 1500 AVIF layers of a few kilobytes
each; the result carries real shadows, a visible lapel roll and modelled
buttons. Tailoor renders live on the viewer's GPU and is capped by what a phone
can do — low polygon counts, cheap lighting, fabric as a texture on a smooth
surface. Offline rendering is not the cheap option here. It is the quality
option.

This matters more for PAON than for either of them, because drape is a quality
attribute. A smooth low-poly garment cannot show cloth character at all, so a
real-time-first architecture would destroy the one thing the lab exists to show.

The delivery ladder is three tiers. Tier 1 is now baked imagery, not a live
renderer:

| Tier | Medium                                                                    | Serves                                                   |
| ---- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | **Offline-rendered layer graph** — baked at full quality, shipped as AVIF | Everyone. This is the product.                           |
| 2    | Live WebGL assembly graph — optional, gated on clearing the D-15 bar      | Capable devices, only if it can hold quality             |
| 3    | Semantic DOM/SVG and text                                                 | No JavaScript, assistive technology, total asset failure |

Tier 1 and tier 2 are emitted from the same chapter-09 asset graph under the
same `bake_key`, so tier 2 can be added or dropped without redesigning
anything. Tier 2 ships only if it looks as good as tier 1 — which, on the
evidence from Tailoor, it may never do on a phone.

Tier 2 replaces the single static poster the dossier previously specified. It
is strictly better and it is nearly free, because the 2D layers are rendered
offline **from the same assemblies and the same bakes as tier 1**, addressed by
the same `bake_key`. One generation pipeline, two delivery media. The layer
graph follows chapter 09's contract exactly, which is the shape chapter 01
observed in production at Suitsupply.

Tier 2 is also the falsification instrument. Because both tiers present the
Because both tiers come from the same source assets, the live renderer can be
evaluated against the baked images directly, and dropped without redesign if it
cannot match them.

## Decision

**Ship offline-rendered imagery.** Build and simulate the garment in 3D, render
each assembly offline at full quality, and deliver AVIF layers composited in
the browser, to the chapter-06 bar. No runtime cloth solve, and no dependency
on a live renderer for the product to work.

Three.js r185 remains the pinned renderer **for the optional tier-2 path only**.
It is not required for Phase 1 and its dependency decision can be deferred.
WebGPU is a research path, not a dependency.

`OBSERVED-DOC`. r185 is the current release, created 2026-07-01T14:03:00Z and
published 2026-07-01T23:22:26Z (GitHub release API, verified 2026-08-15); the
preceding releases are r184 (2026-04-16) and r183 (2026-02-20). Release notes
for r185 include `WebGLRenderer: Always bind position to location 0` and fixes
for normal maps with `DoubleSide` + flat shading and with `BackSide` + vertex
tangents, plus `Matrix3` deprecations of `.scale()`, `.rotate()`, `.translate()`
and a deprecated `DRACOLoader.setDecoderConfig`. A migration guide r184 → r185
exists.

`OBSERVED-CODE`, as of commit `71697c2`. Three.js is **not adopted in PAON
today**. No workspace `package.json` declares `three`; `three@0.185.1` exists
only inside the pnpm content-addressed store as a transitive artifact and is not
resolvable from the workspace root; and the repository contains no `.glb` or
`.gltf` file. Declaring the dependency is workstream W1 of chapter 10.

Upgrades change output and therefore require regenerated goldens. Confirm r185
is still current at the moment the dependency is declared, and pin the exact
version in the manifest rather than inheriting a range.

## Scene contract

Fixed neutral background; a colour-managed pipeline with an explicitly recorded
`outputColorSpace`, `toneMapping` and `toneMappingExposure`; one calibrated
camera family; scene-specific light rigs and HDRIs; and the exact manifest
version. `OBSERVED-DOC`: `WebGLRenderer` documents `outputColorSpace`,
`toneMapping`, `toneMappingExposure`, `shadowMap` and `info`, with
`render()`, `setSize()`, `setPixelRatio()`, `setAnimationLoop()`, `compile()`,
`dispose()` and `forceContextLoss()`. Every one of those settings is part of the
golden identity: a change to any of them invalidates the image set.

Lifecycle: load the lowest adequate LOD; abort and cancel in-flight loads on
route change; call `dispose()` on GPU resources; handle `webglcontextlost`; and
fall through to tier 2 on failure.

## Runtime composition

The renderer loads an **assembly set resolved from the graph in chapter 09**,
not a monolithic per-combination GLB. Concretely:

1. Resolve the selection against the compatibility rules. A hard conflict never
   reaches the renderer; it fails closed to tier 2.
2. Fetch only the assemblies whose bake key changed. Substituting a lapel
   re-fetches the lapel assembly, not the garment.
3. Instance rigid shared assemblies — buttons above all — at anchor transforms
   read from the current drape state's table, rather than shipping them baked
   into every state.
4. Bind materials to the family's fixed slot roles. A fabric change is a
   material rebind and must trigger no geometry fetch at all.
5. Dispose the replaced assembly's GPU resources explicitly before attaching
   the new one.

This is what makes the <= 1.5 s state-change budget below reachable: the common
interactions — change fabric, change light — move no geometry, and the
next-commonest — change one construction detail — moves one assembly.

## Budgets

Under D-16, tier 1 — the baked AVIF layer graph — is the product every user
receives, so its budgets are the ones that govern Phase 1. Tier 2, the
optional live-WebGL path, ships only if it clears the D-15 quality bar first
(chapter 06), so its own budgets remain below but are scoped explicitly to
that optional path and must never be conflated with tier 1's.

### Tier 1 — image delivery (the product)

- **Resolution.** 1200 × 1500 standard delivery, 1600 × 2000 at zoom, 4:5
  portrait (chapter 06's measured bar, V3 in chapter 12).
- **Format.** AVIF primary, with JPEG/PNG negotiated via content-type, same
  as the reference (chapter 06, V4).
- **Per-layer weight.** A few KB per assembly layer — base model 11.8 KB,
  lapel 6-8 KB, lining 6.1 KB, stitching 648 B, median around 2 KB (chapter
  06's measured bar, V5).
- **Whole configured state.** Well under 1 MB total across every currently
  visible layer; the reference page this is measured against totalled
  3.27 MB / 305 requests (chapter 12, T6).
- **Request discipline.** An option change re-fetches only the assemblies
  whose `bake_key` changed (chapter 09) — never the whole garment.
- **Responsive delivery.** `srcset`/`sizes` per layer (chapter 12, T5).
- **Regeneration and integrity.** Deterministic from a recorded seed and
  config (chapter 12, T7); a signed manifest, with an unavailable asset
  failing closed rather than silently degrading (chapter 12, T8).

Interaction latency for tier 1 (a layer swap on option change) is not yet
measured — it depends on the delivery pipeline (P1.5/P1.6), which comes
after P1.0-P1.2's geometry work this chapter's budgets otherwise govern.
Left unmeasured rather than guessed; well inside tier 2's 1.5 s ceiling
below is the expectation, not a claim.

### Tier 2 — live WebGL (optional, gated on the D-15 bar)

- Initial route JavaScript for the lab: <= 180 KB gzip before the optional
  renderer chunk.
- Selected state model: <= 6 MB compressed on desktop; <= 3 MB mobile, one LOD.
- Mesh: <= 60k triangles desktop / 30k mobile per visible garment state;
  <= 4 texture maps at 1024² on mobile.
- Interaction: control feedback <= 100 ms; asset state change target <= 1.5 s
  on fast 4G, with an explicit loading state beyond that.
- The idle renderer sleeps when hidden. A static state runs no animation loop.

These are unchanged from this chapter's original draft. They were correct
budgets all along — the defect was that they were the _only_ budgets in this
section, for a path (tier 2) that is optional and ships second, while tier
1, the actual Phase 1 product, had none.

`OBSERVED-DOC`. MDN's WebGL best practices supply the discipline these numbers
implement: budget VRAM per screen pixel rather than absolutely — "cap resources
to `constant × (current window pixels)`" and purge older resources beyond it,
to "avoid out-of-memory errors and associated instability"; do not assume
device limits ("Don't assume you can use thirty texture samplers per shader
just because it works on your machine"); and lose contexts eagerly via
`WEBGL_lose_context` when the canvas result is no longer needed, though _not_
via an unload handler. MDN also notes that "the only errors a well-formed page
generates are `OUT_OF_MEMORY` and `CONTEXT_LOST`" — which is exactly the pair
this design must survive.

## Progressive enhancement

Probe WebGL first, honor `prefers-reduced-motion`, and drop to **tier 2, the 2D
layer graph**, with identical controls, identical labels and identical
explanatory text, for these conditions: WebGL unavailable, context lost, asset
load failed, slow network, reduced motion, and a hard compatibility conflict.

The drop must be non-destructive. Tier 2 renders the same resolved selection
from the same `bake_key`, so a context loss mid-comparison changes the fidelity
of the image and nothing else — not the selection, not the controls, not the
reading. Tier 3 is entered only when JavaScript or the asset set is entirely
unavailable.

`OBSERVED-DOM`, from chapter 01: Suitsupply's served document contains no
`<noscript>` element at all, so without JavaScript it presents nothing; Armani
degrades only to `You need to enable JavaScript to run this app.` PAON's
comparison must remain fully readable with no JavaScript and no WebGL. The
canvas is never the only source of meaning — it is an enhancement over a
semantic document that already says what differs between the three cloths.

`OBSERVED-DOC`. WebGPU remains "Not Baseline" on MDN as of August 2026 and
requires a secure context. It is therefore a research path only; nothing in the
lab may depend on it.

## Sources

| Source                  | Organization  |                Date | URL                                                                             | Relevance / limitation                                                               |
| ----------------------- | ------------- | ------------------: | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Three.js r185 release   | Three.js      |          2026-07-01 | https://github.com/mrdoob/three.js/releases/tag/r185                            | Pins the experiment baseline; verified via the GitHub release API; upstream moves.   |
| WebGLRenderer           | Three.js      | accessed 2026-08-15 | https://threejs.org/docs/#api/en/renderers/WebGLRenderer                        | Authoritative renderer lifecycle and configuration surface; not a garment engine.    |
| WebGL best practices    | MDN           | accessed 2026-08-15 | https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices | Per-pixel VRAM budgeting, device-limit caution, eager context loss; guidance only.   |
| WebGL specification 1.0 | Khronos Group | accessed 2026-08-15 | https://registry.khronos.org/webgl/specs/latest/1.0/                            | `webglcontextlost` / `webglcontextrestored` contract; device testing still required. |
| WebGPU API              | MDN           | accessed 2026-08-15 | https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API                     | Not Baseline; secure-context requirement; availability uneven.                       |
| prefers-reduced-motion  | MDN           | accessed 2026-08-15 | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion  | Accessible motion preference.                                                        |
