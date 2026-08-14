# Material & Drape Lab plan

## Representation decision

The planned experiment will use PAON-owned procedural jacket geometry generated from repository code into nine deterministic GLB files: three illustrative fabric profiles by three precomputed movement states. A semantic DOM/SVG jacket will remain the non-WebGL fallback. The geometry must be an original technical test garment, not a production tailoring pattern or body-fit claim. It may implement publicly observable comparison and camera behavior from the reference configurators, but it may not reuse their geometry or other assets. Static asset variants remain the production candidate: one topology/UV-compatible jacket family, separate precomputed state meshes per fabric/pose, with morphs only when topology and automated visual checks establish valid correspondence.

Implementation is paused until PAON ground-zero reconciliation authorizes Phase 3. This document specifies the unattended pipeline; it does not claim that the production-grade garment or calibrated fabric profiles exist.

The UI comparison is the signature: a vertical “cloth ledger” pairs a large silhouette with three exact state chips—rest, reach, seated—and three light conditions. It is intentionally quiet around that comparison.

## Offline pipeline

1. Repository-owned generators produce original jacket panels, lining, UVs, rig/attachment anchors and a machine-readable manifest. Blender 5.2 LTS runs headlessly; no manual desktop-tool operation is part of the pipeline.
2. Automated calibration fits solver parameters to published benchmark procedures and PAON-controlled synthetic test captures. Every parameter retains units, provenance, solver mapping and confidence; values remain illustrative until measured swatches exist.
3. Headless Blender simulates a versioned form/pose set with recorded collision, seam, timestep and convergence settings, then bakes selected frames to static meshes.
4. Automated asset tooling validates topology/UV/material slots, generates GLB LODs/PBR maps/posters, verifies browser-loader compatibility and signs manifest hashes.
5. CI validates the manifest schema, asset hashes, glTF structure, deterministic regeneration and browser visual goldens. Failed thresholds reject the asset set.

## Falsification criteria

Stop expansion and keep only a harness if: geometry provenance is unclear; deterministic generation cannot be reproduced; state meshes cannot hold stable silhouette/UV correspondence; calibration evidence cannot bound the illustrative profiles; state-change performance misses budget on required mobile; observers cannot correctly describe the intended comparative difference; or visual review finds the comparison misleading.
