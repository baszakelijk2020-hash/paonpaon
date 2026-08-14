# Asset and rights pipeline

## Asset classes

1. Pattern/source scene (`.blend`/CLO project): private production source.
2. Approved browser mesh: glTF 2.0/GLB, separate lining/attachments, stable material slots and UVs.
3. Precomputed drape state: separate static mesh per state, never runtime cloth simulation.
4. PBR maps: base colour, normal, roughness and optional ambient occlusion; KTX2/Basis only with a PNG/JPEG fallback when device support requires it.
5. Lighting: original or licensed HDRI plus a generated static poster per scene.

## Rights and provenance record

Every manifest entry needs asset id, SHA-256, creator/licensor, generation recipe or licence URI/id, allowed channels, attribution requirement, acquisition date, expiry/revocation review, source project version and automated acceptance record. No scraped competitor asset is admissible. An HDRI, model or swatch without this record is rejected. Prefer PAON-generated assets; a third-party input must have an explicit commercial-use licence compatible with redistribution in the shipped form.

## Geometry delivery rules

Use GLB as the browser package. Keep one material role per garment part; preserve UV continuity and named attachment anchors. Export baked/selected static geometry, not a Blender simulation cache. Morph targets may represent same-topology, semantically comparable precomputed states, but cannot express arbitrary cross-fabric folds, collision or a different pattern topology. Distinct static meshes are the first experiment's chosen representation.

## Sources

| Source                               | Organization       |                Date | URL                                                                                      | Relevance / limitation                                     |
| ------------------------------------ | ------------------ | ------------------: | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| glTF 2.0.1 specification             | Khronos Group      |          2021-10-11 | https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html                                | PBR and extension semantics; no garment simulation model.  |
| Blender 5.2 LTS glTF exporter manual | Blender Foundation |          2026-07-14 | https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html          | Export controls; validate output in target browser.        |
| KHR_texture_basisu                   | Khronos Group      | accessed 2026-08-14 | https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu | Compression contract; requires loader/device support.      |
| glTF Validator                       | Khronos Group      | accessed 2026-08-14 | https://github.com/KhronosGroup/glTF-Validator                                           | Machine validation; cannot assess tailoring fidelity.      |
| Poly Haven licence                   | Poly Haven         | accessed 2026-08-14 | https://polyhaven.com/license                                                            | CC0 HDRI/material option; provenance still must be pinned. |
| ambientCG licence                    | ambientCG          | accessed 2026-08-14 | https://docs.ambientcg.com/license/                                                      | CC0 material option; does not prove textile calibration.   |
