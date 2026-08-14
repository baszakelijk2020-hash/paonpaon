# Material & Drape Lab plan

## Representation decision

The experiment uses a neutral procedural test garment rendered by DOM/SVG layers, not a fake licensed jacket model. It implements the asset-manifest and deterministic state-selection harness while recording the missing human-made geometry dependency. Static asset variants are the production candidate: one topology/UV-compatible jacket family, separate precomputed state meshes per fabric/pose, with morphs only when topology and art review establish valid correspondence.

The UI comparison is the signature: a vertical “cloth ledger” pairs a large silhouette with three exact state chips—rest, reach, seated—and three light conditions. It is intentionally quiet around that comparison.

## Offline pipeline

1. Pattern maker/3D artist produces or licenses PAON-owned jacket and lining, UVs, rig and anchors.
2. Textile specialist measures approved swatches and maps data to solver-specific parameters.
3. Blender/CLO artist simulates on a versioned form/pose set with collision and seam settings; bakes selected frames to static meshes.
4. Technical artist validates topology/UV/material slots, generates GLB LODs/PBR maps/posters and signs manifest hashes.
5. CI validates manifest/schema/asset hashes and browser visual goldens; human review accepts or rejects.

## Falsification criteria

Stop expansion and keep only a harness if: geometry rights are unclear; state meshes cannot hold stable silhouette/UV correspondence; a textile specialist cannot calibrate profiles; state-change performance misses budget on required mobile; observers cannot correctly describe the intended comparative difference; or visual review finds the comparison misleading.
