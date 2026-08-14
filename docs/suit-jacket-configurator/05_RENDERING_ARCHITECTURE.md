# Rendering architecture

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## The benchmark does not settle the medium

`OBSERVED-DOM`. None of the six reference captures taken on 2026-08-15 — two
Suitsupply, four Armani — contained a `<canvas>` element or any reference to
WebGL, `gltf`, `glb`, `model-viewer`, Babylon, PlayCanvas or Unity.

`PAYLOAD`. Suitsupply's configuration model is an ordered graph of **image
layers** with discrete `rotationPosition` and `zoomPosition` variants and
sprite-sheet rotation (chapter 01). Whether composition runs client-side,
server-side or both is `INFERRED`.

`SECONDARY`. Armani runs on Tailoor, whose marketing claims real-time
photorealistic 3D. The direct configurator URL was reached, but the Tailoor
application rendered `The site is momentarily unavailable.` and mounted no
configurator view — so the absence of 3D signals in that capture means nothing,
and no rendering strategy is attributed to Armani.

The benchmark therefore splits: one reference is verifiably layer-composited,
the other's vendor advertises 3D that this dossier could not observe. Parity
justifies nothing here. A 3D renderer has to be justified by the one thing 2D
layer composition genuinely cannot do: show the same construction under
different cloth behaviour, where the difference lives in fold formation and
silhouette break rather than in colour and pattern. Layered rasters can swap a
lapel; they cannot show a soft cloth collapsing differently from a crisp one
across the same shoulder.

## Founder decision: 3D is primary, 2D is the fallback

Recorded 2026-08-15 as decision D-12. The founder has resolved R-13 in favour
of building the 3D path and testing drape legibility empirically rather than
deferring the question. The medium is therefore settled by authorization, not
by evidence, and this chapter states that distinction plainly.

The delivery ladder is now three tiers, and the middle one is new:

| Tier | Medium                                           | Serves                                                           |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 1    | WebGL 3D assembly graph (primary)                | Capable devices with a live context                              |
| 2    | **2D layer graph** — pre-composited image layers | No WebGL, context lost, low memory, slow network, reduced motion |
| 3    | Semantic DOM/SVG and text                        | No JavaScript, assistive technology, total asset failure         |

Tier 2 replaces the single static poster the dossier previously specified. It
is strictly better and it is nearly free, because the 2D layers are rendered
offline **from the same assemblies and the same bakes as tier 1**, addressed by
the same `bake_key`. One generation pipeline, two delivery media. The layer
graph follows chapter 09's contract exactly, which is the shape chapter 01
observed in production at Suitsupply.

Tier 2 is also the falsification instrument. Because both tiers present the
same comparison from the same source assets, the observer study in chapter 10
can show tier 1 to one group and tier 2 to another. If drape legibility does
not differ, the 3D renderer has not earned its cost and tier 2 becomes primary
— an outcome this architecture can absorb without redesign, since chapter 09's
graph is a composition contract that is indifferent to whether a node resolves
to a mesh or an image.

## Decision

Use Three.js r185 as the pinned WebGL renderer with static GLB state meshes,
backed by the tier-2 2D layer graph and a tier-3 semantic fallback. No runtime
cloth solve in the browser. WebGPU is an enhancement research path, not a
dependency.

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

- Initial route JavaScript for the lab: <= 180 KB gzip before the optional
  renderer chunk.
- Selected state model: <= 6 MB compressed on desktop; <= 3 MB mobile, one LOD.
- Mesh: <= 60k triangles desktop / 30k mobile per visible garment state;
  <= 4 texture maps at 1024² on mobile.
- Interaction: control feedback <= 100 ms; asset state change target <= 1.5 s
  on fast 4G, with an explicit loading state beyond that.
- The idle renderer sleeps when hidden. A static state runs no animation loop.

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
