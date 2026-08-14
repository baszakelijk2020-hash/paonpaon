# Decisions and open risks

| ID   | Decision / risk                                                                                             | Status              | Owner / next proof                       |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------- |
| D-01 | Do not extend legacy FT-07; integrate future capability through Studio.                                     | Accepted            | Architecture owner                       |
| D-02 | Static precomputed state meshes, not morph targets alone or live cloth, are the first production candidate. | Accepted            | Need artist export spike                 |
| D-03 | WebGL-first with semantic poster fallback; WebGPU optional.                                                 | Accepted            | Browser matrix                           |
| R-01 | No licensed/original jacket geometry is available in this repository.                                       | Open blocker for 3D | Human 3D asset owner                     |
| R-02 | Illustrative profiles are not calibrated fabric claims.                                                     | Open                | Textile specialist + swatch measurements |
| R-03 | Exact construction compatibility and commercial pricing need product rules, not visual assets.              | Deferred            | Proposal/MTM contract                    |
| R-04 | HDRI, swatch and PBR asset rights can silently invalidate a build.                                          | Open                | Asset provenance audit                   |
| R-05 | CI/headless GPU rendering can differ materially from physical devices.                                      | Open                | Goldens + physical-device review         |

## Roadmap

1. Approve human asset/licensing and calibration brief.
2. Replace harness visual with licensed/original static GLB assets and a validated manifest.
3. Add isolated Studio-side read-only composition using existing consent/entitlement gates.
4. Only after proposal/MTM contracts are accepted, design snapshots, compatibility, price and advisor continuation; never infer them from this lab.
