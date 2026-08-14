# Rendering architecture

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## The benchmark does not settle the medium

`OBSERVED-DOM`. None of the five reference captures taken on 2026-08-15 — two
Suitsupply, three Armani — contained a `<canvas>` element or any reference to
WebGL, `gltf`, `glb`, `model-viewer`, Babylon, PlayCanvas or Unity.

`PAYLOAD`. Suitsupply's configuration model is an ordered graph of **image
layers** with discrete `rotationPosition` and `zoomPosition` variants and
sprite-sheet rotation (chapter 01). Whether composition runs client-side,
server-side or both is `INFERRED`.

`SECONDARY`. Armani runs on Tailoor, whose marketing claims real-time
photorealistic 3D. No capture in this pass reached the configurator itself, so
that claim is unverified and no rendering strategy is attributed to Armani.

The benchmark therefore splits: one reference is verifiably layer-composited,
the other's vendor advertises 3D that this dossier could not observe. Parity
justifies nothing here. A 3D renderer has to be justified by the one thing 2D
layer composition genuinely cannot do: show the same construction under
different cloth behaviour, where the difference lives in fold formation and
silhouette break rather than in colour and pattern. Layered rasters can swap a
lapel; they cannot show a soft cloth collapsing differently from a crisp one
across the same shoulder.

If that difference does not read to observers — see the falsification criteria
in chapters 07 and 09 — then the correct answer is a precomputed 2D layer set
and no renderer at all, and this chapter should be deleted rather than
defended. Chapter 09's asset graph survives that outcome intact: it is a
composition contract, and it degrades from meshes to image layers without being
redesigned.

## Decision

Use Three.js r185 as the pinned first-experiment WebGL renderer with static GLB
state meshes and a semantic HTML/poster fallback. No runtime cloth solve in the
browser. WebGPU is an enhancement research path, not a dependency.

`OBSERVED-DOC`. r185 is the current release, created 2026-07-01T14:03:00Z and
published 2026-07-01T23:22:26Z (GitHub release API, verified 2026-08-15); the
preceding releases are r184 (2026-04-16) and r183 (2026-02-20). Release notes
for r185 include `WebGLRenderer: Always bind position to location 0` and fixes
for normal maps with `DoubleSide` + flat shading and with `BackSide` + vertex
tangents, plus `Matrix3` deprecations of `.scale()`, `.rotate()`, `.translate()`
and a deprecated `DRACOLoader.setDecoderConfig`. A migration guide r184 → r185
exists.

`OBSERVED-CODE`. Three.js is **not adopted in PAON today**. No workspace
`package.json` declares `three`; `three@0.185.1` exists only inside the pnpm
content-addressed store as a transitive artifact and is not resolvable from the
workspace root; and the repository contains no `.glb` or `.gltf` file. Adopting
the renderer is a Phase 3 act, not a description of the present.

Upgrades change output and therefore require regenerated goldens. Repin the
exact version when Phase 3 is authorized rather than inheriting r185 by default.

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
fall through to poster mode on failure.

## Runtime composition

The renderer loads an **assembly set resolved from the graph in chapter 09**,
not a monolithic per-combination GLB. Concretely:

1. Resolve the selection against the compatibility rules. A hard conflict never
   reaches the renderer; it fails closed to the poster.
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

Probe WebGL first, honor `prefers-reduced-motion`, and show a labelled static
poster with identical controls and identical text for these conditions: WebGL
unavailable, context lost, asset load failed, slow network, and reduced motion.

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
