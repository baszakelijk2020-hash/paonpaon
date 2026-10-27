# Asset and rights pipeline

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. `OBSERVED-CODE`:
the repository contains no `.glb` or `.gltf` file and declares no 3D
dependency today. Everything below specifies a pipeline that does not yet exist.

## Asset classes

1. Pattern/source scene (`.blend`): private production source, never shipped.
2. Approved browser mesh: glTF 2.0 / GLB, separate lining and attachments,
   stable material slots and UVs.
3. Precomputed drape state: a separate static mesh per state. Never a runtime
   cloth simulation.
4. PBR maps: base colour, normal, roughness, optional ambient occlusion; KTX2 /
   Basis Universal only with a PNG/JPEG fallback where device support requires
   it.
5. Lighting: original or licensed HDRI plus a generated static poster per scene.

## What glTF 2.0 actually constrains

`OBSERVED-DOC`, retrieved 2026-08-15. The specification identifies itself as
`version 2.0.1`, `Copyright 2013-2021 The Khronos Group Inc.` The constraints
that bind this pipeline:

| Constraint              | Specification text                                                                                                                                    | Consequence for PAON                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Morph target attributes | "Client implementations SHOULD support at least three attributes — POSITION, NORMAL, and TANGENT — for morphing."                                     | Morphs can move vertices and normals. They cannot change topology, seams or UV layout. |
| Mesh indices            | `componentType` 5121 / 5123 / 5125 (UNSIGNED_BYTE / SHORT / INT), `type` SCALAR (§5.19.1)                                                             | A 16-bit index budget caps a primitive at 65,536 vertices; plan LODs against that.     |
| Image media types       | `"image/jpeg"` and `"image/png"` are the defined values (§5.18.2)                                                                                     | Any KTX2 delivery is an extension path, never the baseline.                            |
| Material model          | `pbrMetallicRoughness` with `baseColorFactor`, `baseColorTexture`, `metallicFactor`, `roughnessFactor`, `metallicRoughnessTexture` (§5.19.4)          | The base model has no cloth term at all.                                               |
| Physics                 | The specification defines **no** physics, cloth or simulation model. "Physically Based Rendering" refers to material and lighting math, not dynamics. | glTF transports the _result_ of a simulation. It never transports the simulation.      |

`OBSERVED-DOC`. Three ratified extensions matter:

- **KHR_materials_sheen** — "Complete, Ratified by the Khronos Group". Its
  stated purpose is directly ours: "A sheen layer is a common technique used in
  Physically-Based Rendering to represent cloth and fabric materials, for
  example." Parameters: `sheenColorFactor`, `sheenColorTexture`,
  `sheenRoughnessFactor`, `sheenRoughnessTexture`. This is the correct place to
  express a cloth's optical character, and it is an _appearance_ parameter set —
  it encodes no mechanical property and proves nothing about drape.
- **KHR_texture_basisu** — "Complete, Ratified by the Khronos Group". Requires
  BasisLZ (`supercompressionScheme = 1`) or UASTC (0 or 2, optional Zstandard),
  and constrains dimensions: "pixelWidth and pixelHeight MUST be multiples of
  4." Requires loader and device transcode support, hence the mandatory
  PNG/JPEG fallback above. `OBSERVED-DOC`: Blender's exporter does **not** emit
  it — its image options are PNG, JPEG, WebP or none — so KTX2 is a separate
  post-export step in the asset tooling, never an export flag.
- **KHR_draco_mesh_compression** — "Complete, Ratified by the Khronos Group".
  It "allows glTF to support streaming compressed geometry data instead of the
  raw data." Note that Three.js r185 deprecates `DRACOLoader.setDecoderConfig`;
  pin the decoder configuration explicitly if Draco is adopted.

## Geometry delivery rules

**One GLB per assembly, never one GLB per combination.** Chapter 09 is the
normative contract for families, assemblies, seams, anchors, UV leases,
versioning, compatibility rules and the manifest; this section states only what
glTF itself imposes on it.

Use GLB as the browser package. Bind to the family's fixed material slot roles;
an assembly may not introduce a slot. Preserve UV chart leases so a substituted
assembly never reflows a neighbour's UVs and never invalidates its baked
textures. Export named attachment anchors as nodes so surface bindings survive
the export. Export baked, selected static geometry — never a simulation cache.

Morph targets may represent same-topology, semantically comparable precomputed
states **within a single assembly**. Because the specification admits only
POSITION, NORMAL and TANGENT deltas, a morph cannot re-chart UVs, cannot change
a seam ring's vertex count and cannot express a different pattern topology —
which is precisely why cross-assembly substitution must be separate meshes
rather than morphs. Distinct static meshes per assembly variant are the first
experiment's chosen representation; morphs are admitted only where automated
correspondence checks pass.

Index-width discipline follows from the same table: a 16-bit index budget caps
a primitive at 65,536 vertices. Because assemblies are authored and budgeted
independently, this is a per-assembly ceiling rather than a whole-garment one —
one more reason the graph is cheaper than a monolith.

## Rights and provenance record

Every manifest entry needs: asset id, SHA-256, creator or licensor, generation
recipe or licence URI/id, allowed channels, attribution requirement,
acquisition date, expiry or revocation review date, source project version, and
the automated acceptance record. An HDRI, model or swatch without this record
is rejected at CI, not at review.

No scraped competitor asset is admissible under any circumstance. Prefer
PAON-generated assets; a third-party input must carry an explicit commercial-use
licence compatible with redistribution in the shipped form.

`OBSERVED-DOC`. Two CC0 sources are usable inputs: Poly Haven publishes its
assets CC0 — usable for any purpose including commercial work, with no
attribution required (appreciation requested) — and ambientCG publishes under
CC0 1.0, permitting copy, modification and commercial distribution without
asking. CC0 removes the licensing obstacle; it removes none of the provenance
obligation. The manifest must still pin which asset, which version and which
retrieval date, because a CC0 grant does not make an unpinned asset
reproducible.

## Validation

`OBSERVED-DOC`. The Khronos glTF Validator (Apache-2.0; latest release
`2.0.0-dev.3.10`, published 2024-10-22; npm `gltf-validator`; web front end at
`github.khronos.org/glTF-Validator`) checks JSON syntax, GLB v2 container
correctness, asset description, binary buffers, images and extension usage,
emitting errors and warnings.

Its limit is the point: the Validator proves a file is a well-formed glTF asset.
It cannot assess tailoring fidelity, drape plausibility, whether a lapel reads
as a lapel, or whether a fabric profile is calibrated. A green Validator run is
a precondition for acceptance in chapter 06 and never a substitute for it.

## Sources

| Source                                | Organization       |                Date | URL                                                                                              | Relevance / limitation                                                                        |
| ------------------------------------- | ------------------ | ------------------: | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| glTF 2.0 specification, version 2.0.1 | Khronos Group      |                2021 | https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html                                        | Transport, PBR and extension semantics; defines no simulation model.                          |
| KHR_materials_sheen                   | Khronos Group      | accessed 2026-08-15 | https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen        | Ratified cloth/fabric appearance layer; appearance only, no mechanical meaning.               |
| KHR_texture_basisu                    | Khronos Group      | accessed 2026-08-15 | https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu         | Ratified compression contract; requires loader/device support and 4-pixel multiples.          |
| KHR_draco_mesh_compression            | Khronos Group      | accessed 2026-08-15 | https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression | Ratified geometry compression; decoder configuration must be pinned.                          |
| glTF Validator                        | Khronos Group      |  release 2024-10-22 | https://github.com/KhronosGroup/glTF-Validator                                                   | Apache-2.0 machine validation; cannot assess tailoring fidelity.                              |
| Blender glTF 2.0 exporter manual      | Blender Foundation | accessed 2026-08-15 | https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html                                | Export controls, retrieved directly; emits PNG/JPEG/WebP only, so KTX2 needs a separate step. |
| Poly Haven licence                    | Poly Haven         | accessed 2026-08-15 | https://polyhaven.com/license                                                                    | CC0 HDRI/material option; provenance must still be pinned.                                    |
| ambientCG licence                     | ambientCG          | accessed 2026-08-15 | https://docs.ambientcg.com/license/                                                              | CC0 1.0 material option; does not prove textile calibration.                                  |
