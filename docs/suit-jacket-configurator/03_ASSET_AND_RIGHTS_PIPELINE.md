# Asset and rights pipeline

## Asset classes

1. Pattern/source scene (`.blend`/CLO project): private production source.
2. Approved browser mesh: glTF 2.0/GLB, separate lining/attachments, stable material slots and UVs.
3. Precomputed drape state: separate static mesh per state, never runtime cloth simulation.
4. PBR maps: base colour, normal, roughness and optional ambient occlusion; KTX2/Basis only with a PNG/JPEG fallback when device support requires it.
5. Lighting: original or licensed HDRI plus a generated static poster per scene.

## Rights and provenance record

Every manifest entry needs asset id, SHA-256, creator/licensor, agreement or licence URI/id, allowed channels, attribution requirement, acquisition date, expiry/revocation review, source project version and approver. No scraped competitor asset is admissible. An HDRI, model or swatch without this record is rejected.

## Geometry delivery rules

Use GLB as the browser package. Keep one material role per garment part; preserve UV continuity and named attachment anchors. Export baked/selected static geometry, not a Blender simulation cache. Morph targets may represent same-topology, semantically comparable precomputed states, but cannot express arbitrary cross-fabric folds, collision or a different pattern topology. Distinct static meshes are the first experiment's chosen representation.

## Sources

| Source                       | Organization       |              Date | URL                                                                                      | Relevance / limitation                                    |
| ---------------------------- | ------------------ | ----------------: | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| glTF 2.0 specification       | Khronos Group      |      current spec | https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html                                | PBR and extension semantics; no garment simulation model. |
| Blender glTF exporter manual | Blender Foundation |    current manual | https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html          | Export controls; validate output in target browser.       |
| KHR_texture_basisu           | Khronos Group      | current extension | https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu | Compression contract; requires loader/device support.     |
