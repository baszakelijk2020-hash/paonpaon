# Material & Drape Lab plan

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. Ground-zero
reconciliation is complete and Lab Phase 1 is authorized; chapter 10 holds the
workstreams, sequencing and exit criteria. This document specifies the
unattended pipeline those workstreams implement. It does not claim that the
production-grade garment or calibrated fabric profiles exist — neither does.

## Representation decision

The garment is a **modular asset graph**, specified normatively in chapter 09:
compatible base families with independently versioned, independently baked
assemblies attached along declared seams — never a complete model per
combination.

The first experiment exercises exactly one path through that graph: one family
(`sb-2`), one fixed assembly set (notch lapel, standard collar, flap pockets,
side vents, two-piece sleeve, half canvas, full lining), three illustrative
fabric profiles and three precomputed movement states, producing nine
deterministic GLB bakes of the deforming assembly set — plus, from the same
pass and the same `bake_key`, the tier-2 2D layer set. A semantic DOM/SVG
jacket remains tier 3, for no JavaScript and total asset failure (chapter 05).

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

## Blender: what is verified

**Version pin: Blender 5.2 LTS** (decision D-13, corrected). `OBSERVED-DOC`:
blender.org's LTS page lists it under "LTS Releases Currently Maintained" as
"Released July 14, 2026, supported until July 2028", alongside 4.5 LTS. The
manual self-identifies as the "Blender 5.2 LTS Manual". Chapter 10 records how
an intermediate 4.5 pin was reached and why it was wrong.

Retrieval note: blender.org and docs.blender.org refuse curl, WebFetch and
automation browser builds, but open normally in an ordinary Chrome installation
driven over the DevTools protocol. Everything below is quoted from pages
retrieved that way on 2026-08-15.

`OBSERVED-DOC` — **Physics ‣ Cloth ‣ Physical Properties**. The solver controls
the pipeline drives:

- `Vertex Mass` — "The mass of the cloth material."
- `Air Viscosity` — "Air has some thickness which slows falling things down."
- `Bending Model` — `Linear` ("Cloth model with linear bending springs (old)")
  or `Angular` ("Cloth model with angular bending springs"). This selector was
  missing from the earlier second-hand list and it is consequential: it changes
  which stiffness terms exist.
- `Stiffness`: `Tension` ("How much the material resists stretching"),
  `Compression`, `Structural` ("Overall stiffness of the cloth (only in linear
  bending model)"), `Shear` ("How much the material resists shearing"),
  `Bending` ("Wrinkle coefficient. Higher creates more large folds.").
- `Damping`: `Tension`, `Compression`, `Structural` (again linear-model only),
  `Shear`, `Bending`.
- `Internal Springs`, with `Max Spring Creation Length`, `Max Creation
Diversion` and `Check Surface Normals`. Intended to make a mesh "behave
  similarly to a Soft Body" — not wanted for tailored cloth.
- `Pressure`, with `Pressure` and `Pressure Scale`, for "soft-shelled objects
  such as balloons". Not applicable here.

Two corrections to the earlier second-hand list: `Quality Steps` and `Speed
Multiplier` are **not** on this page. Do not cite them as physical properties.

`OBSERVED-DOC` — **Physics ‣ Cloth ‣ Shape**. This is where garment
construction actually lives:

- `Pin Group` — "Vertex group to use for pinning."
- `Sewing` — sewing springs "pull vertices in one part of a cloth mesh toward
  vertices in another part", and are "created by adding extra edges to a cloth
  mesh that are not included in any faces". This is the mechanism that turns
  flat panels into a sewn garment, and it is why the generator must emit panels
  plus explicit seam edges rather than a closed mesh.
- `Max Sewing Force` — "Zero means unbounded, but it is not recommended to
  leave the field at zero in most cases, as it can cause instability due to
  extreme forces in the initial frames." Set it explicitly in the bake config.
- `Shrinking Factor`, `Dynamic Mesh`, and `Rest Shape Key`.

`Rest Shape Key` deserves emphasis — it is directly useful to the drape-state
bake. It "allows starting the cloth simulation using a specific Shape Key as
the rest state", and can "start the simulation with the cloth in a pre-draped
state without applying that shape as a plastic deformation that relaxes all
springs as a side effect." That is exactly how a movement state should begin
from a settled rest drape without corrupting the spring network.

`OBSERVED-DOC` — **Physics ‣ Cloth ‣ Collisions**. `Quality`, `Distance`,
`Impulse Clamping` ("Prevents explosions in tight and complicated collision
situations"), `Collision Collection` (objects "must also have Collision physics
enabled"), and under self-collision a `Friction` coefficient "for how slippery
the cloth is when it collides with itself. For example, silk has a lower
coefficient of friction than cotton." Note that this friction is a _solver_
coefficient, not a measured textile value — chapter 04's rule still applies.

Command-line flags confirmed present in the 5.2 manual include
`--factory-startup`, `--python-expr`, `--python-text`, `--python-console`,
`--python-exit-code`, `--python-use-system-env` and `--cycles-device`.

`OBSERVED-DOC` — **glTF 2.0 exporter**, at
`docs.blender.org/manual/en/latest/addons/scene_gltf2.html` (the path moved; it
is no longer under `import_export/`). Export formats, all three still present in
5.2:

- `glTF Binary (.glb)` — "a single .glb file with all mesh data, image textures,
  and related information packed into a single binary file." This is PAON's
  package.
- `glTF Separate (.gltf + .bin + textures)`.
- `glTF Embedded (.gltf)` — base64 inside the JSON. **A correction: the earlier
  second-hand note that Embedded was removed in 4.0+ is wrong; it is documented
  in 5.2.** PAON still does not use it.

Relevant options: `Apply Modifiers` — "Export objects using the evaluated mesh,
meaning the resulting mesh after all Modifiers have been calculated" — plus
`Shape Key Normals` and `Shape Key Tangents`, which "Export vertex normals /
tangents with shape keys (morph targets)". Export-side extensions documented
include `KHR_draco_mesh_compression`, `EXT_meshopt_compression`,
`KHR_meshopt_compression` and `KHR_lights_punctual`.

Two consequences for the pipeline:

1. **`KHR_texture_basisu` is not an exporter option.** Texture output is PNG,
   JPEG or WebP — and on WebP the manual warns "all textures will be saved as
   WebP, without any png/jpg fallback". KTX2/Basis therefore requires a separate
   post-export step in W4, not an export flag. Chapter 03's mandatory PNG/JPEG
   fallback stands.
2. Morph-target export is available and normals/tangents can ride with it, which
   keeps chapter 09's within-assembly morph option open. It changes nothing
   about cross-assembly substitution, which remains separate meshes.

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
