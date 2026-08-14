# Material & Drape Lab plan

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. Implementation is
paused until PAON ground-zero reconciliation authorizes Phase 3. This document
specifies an unattended pipeline; it does not claim that the production-grade
garment or calibrated fabric profiles exist.

## Representation decision

The garment is a **modular asset graph**, specified normatively in chapter 09:
compatible base families with independently versioned, independently baked
assemblies attached along declared seams — never a complete model per
combination.

The first experiment exercises exactly one path through that graph: one family
(`sb-2`), one fixed assembly set (notch lapel, standard collar, flap pockets,
side vents, two-piece sleeve, half canvas, full lining), three illustrative
fabric profiles and three precomputed movement states, producing nine
deterministic GLB bakes of the deforming assembly set. A semantic DOM/SVG
jacket remains the non-WebGL, no-JavaScript fallback.

Nine bakes is the experiment. The graph is the contract those nine must not
violate — in particular, they must be generated as per-assembly bakes addressed
by `bake_key`, so that adding a second lapel later costs one assembly rather
than a regeneration of everything.

The geometry must be an original technical test garment — not a production
tailoring pattern and not a body-fit claim. It may implement publicly
observable comparison and camera behaviour from the reference configurators; it
may not reuse their geometry, textures, wording or option vocabulary.

Static asset variants remain the production candidate: one topology- and
UV-compatible jacket family, with separate precomputed state meshes per fabric
and pose, and morph targets admitted only where topology correspondence and
automated visual checks both pass (chapter 03 explains why a morph cannot
express a cross-fabric fold).

The UI comparison is the signature: a vertical "cloth ledger" pairs a large
silhouette with three exact state chips — rest, reach, seated — and three light
conditions. It is intentionally quiet around that comparison.

## Blender: what is actually verified

**Retrieval caveat, and it is material.** On 2026-08-15 `docs.blender.org`
returned HTTP 403 to WebFetch and to `curl` with a browser user agent, for every
manual page this dossier cites, and `blender.org` served a Cloudflare
interactive challenge instead of content. The Blender facts below are therefore
`SECONDARY` — assembled from search-result summaries and third-party
documentation, not retrieved from the primary manual in this pass.

`SECONDARY`, and specifically flagged: **Blender 5.2 LTS is reported as released
2026-07-14 with support to July 2028, and as the current LTS.** This dossier
could not confirm that against blender.org, the LTS page, the release notes or
the official source repository. The entire pipeline below names a version this
pass did not verify. Chapter 08 carries this as an open risk, and the first act
of Phase 3 is to confirm the version before pinning it.

`SECONDARY`. The cloth solver controls the pipeline would drive: Quality Steps,
Speed Multiplier, Vertex Mass, Air Viscosity, Stiffness (Tension, Compression,
Shear, Bending), Damping (Tension, Compression, Shear, Bending), Internal
Springs and Pressure; collision settings for object distance, self-collision,
friction and collision quality; and shape settings for a pin group, Sewing
Springs (with Maximum Length, Angle and a maximum sewing force) and Shrinking.
Sewing Springs are the mechanism that turns flat panels into a sewn garment,
which is why the generator emits panels and seam pairs rather than a closed
mesh. Exact default values were not obtainable and are deliberately not
reproduced here.

`SECONDARY`. Headless operation uses `--background` / `-b` with `--python` or
`--python-expr`, `--factory-startup` to ignore user preferences, and
`--render-frame`; argument order is significant. GPU compute for Cycles is
selectable in background mode without an OpenGL/GUI stack. Export offers glTF
Binary (`.glb`) and glTF Separate; the embedded `.gltf` variant was removed in
Blender 4.0+. Shape keys export as morph targets but conflict with
"Apply Modifiers"; particle systems, hair, and cached simulation vertex
animation do not export — which is precisely why the pipeline bakes selected
frames to static meshes rather than exporting a cloth cache.

## Offline pipeline

1. Repository-owned generators emit the **family** first — panel layout, seam
   network with fixed ring arities, the UV atlas and its per-assembly chart
   leases, the material slot roster and the anchor set — and only then each
   **assembly** against that family's seam contract. Assemblies are generated
   independently and in parallel; a generator that cannot satisfy a declared
   seam arity fails rather than adapting the family. Blender runs headlessly
   under `--background --factory-startup --python`. No manual desktop-tool
   operation is part of the pipeline, and no step requires the founder to open
   Blender, CLO or any 3D application.
2. Automated calibration fits solver parameters to published benchmark
   procedures and PAON-controlled synthetic test captures. Every parameter
   retains units, provenance, the solver identity and version it was fitted
   against, and a confidence label. Values stay `illustrative` until measured
   swatches exist (chapter 04).
3. Headless Blender simulates the assembled garment over a versioned form/pose
   set with recorded collision, seam, timestep and convergence settings, then
   bakes **selected frames per deforming assembly**, keyed by
   `(family, assembly variant, canvas, drape class, state)`. Rigid shared
   assemblies are not baked; only their per-state anchor transform tables are
   emitted. The `canvas` and `shoulder` selections enter as stiffness and
   pin-weight fields, not as geometry.
4. Automated asset tooling validates seam-ring arity and arc-length
   correspondence between every attachable pair, grain-vector continuity across
   seams, UV chart lease disjointness, material slot conformance and anchor
   surface bindings; generates GLB LODs, PBR maps and posters; verifies loader
   compatibility; and signs manifest hashes.
5. CI validates the `AssetGraphManifest` schema, asset hashes, glTF structure
   via the Khronos Validator, compatibility-rule resolvability (every reachable
   selection resolves or fails closed with a published reason), deterministic
   regeneration from a fixed seed, and browser visual goldens. A failed
   threshold rejects the asset set rather than downgrading it.

Determinism is the property that makes this unattended: the same generator
version, seed, solver version and parameter set must reproduce byte-identical
geometry. If it does not, nothing downstream — goldens, hashes, provenance — is
meaningful, and the pipeline is not fit to run without a human.

## Falsification criteria

Stop expansion and keep only a harness if any of these hold:

- geometry provenance is unclear;
- deterministic regeneration cannot be reproduced;
- state meshes cannot hold stable silhouette and UV correspondence;
- calibration evidence cannot bound the illustrative profiles;
- state-change performance misses the chapter-05 budget on required mobile
  hardware;
- observers cannot correctly describe the intended comparative difference;
- visual review finds the comparison misleading;
- seam rings cannot hold arc-length correspondence, or grain continuity cannot
  be maintained, across independently authored assemblies — in which case the
  graph collapses back toward monolithic bakes and its economics disappear
  (chapter 09);
- **the cloth difference does not read at all** — in which case, per chapter 05,
  a precomputed 2D image set replaces the renderer entirely and this plan is
  retired rather than rescued.
