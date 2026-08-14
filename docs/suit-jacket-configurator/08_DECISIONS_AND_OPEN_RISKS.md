# Decisions and open risks

| ID   | Decision / risk                                                                                             | Status           | Owner / next proof                     |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------- |
| D-01 | Do not extend legacy FT-07; integrate future capability through Studio.                                     | Accepted         | Architecture owner                     |
| D-02 | Static precomputed state meshes, not morph targets alone or live cloth, are the first production candidate. | Accepted         | Headless Blender refinement            |
| D-03 | WebGL-first with semantic poster fallback; WebGPU optional.                                                 | Accepted         | Browser matrix                         |
| D-04 | Require PAON-owned, deterministically regenerated procedural geometry; do not rely on an external model.    | Accepted         | Generator + signed manifest            |
| R-01 | No production-grade original jacket geometry has been accepted in this documentation-only branch.           | Open quality gap | Automated geometry/simulation pipeline |
| R-02 | Illustrative profiles are not calibrated fabric claims.                                                     | Open             | Automated calibration evidence         |
| R-03 | Exact construction compatibility and commercial pricing need product rules, not visual assets.              | Deferred         | Proposal/MTM contract                  |
| R-04 | HDRI, swatch and PBR asset rights can silently invalidate a build.                                          | Open             | Asset provenance audit                 |
| R-05 | CI/headless GPU rendering can differ materially from physical devices.                                      | Open             | Automated device/browser matrix        |

## Roadmap

Implementation is paused pending PAON ground-zero reconciliation. After explicit authorization:

1. Refine the original jacket through an unattended Blender 5.2 LTS panel, sewing and drape pipeline, preserving deterministic regeneration and provenance.
2. Fit illustrative fabric parameters against published benchmark procedures and synthetic PAON-controlled tests; retain low-confidence labels until physical measurements exist.
3. Add isolated Studio-side read-only composition using existing consent/entitlement gates.
4. Only after proposal/MTM contracts are accepted, design snapshots, compatibility, price and advisor continuation; never infer them from this lab.
