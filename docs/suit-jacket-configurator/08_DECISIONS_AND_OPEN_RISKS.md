# Decisions and open risks

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## Decisions

| ID   | Decision                                                                                                        | Status   | Next proof                             |
| ---- | --------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| D-01 | Do not extend legacy FT-07; integrate future capability through Virtual Wardrobe Studio.                        | Accepted | Architecture owner                     |
| D-02 | Static precomputed state meshes, not morph targets alone or live cloth, are the first production candidate.     | Accepted | Headless simulation refinement         |
| D-03 | WebGL-first with a semantic poster fallback; WebGPU optional and non-blocking.                                  | Accepted | Browser and device matrix              |
| D-04 | Require PAON-owned, deterministically regenerated procedural geometry; do not rely on an external model.        | Accepted | Generator + signed manifest            |
| D-05 | A physics-bearing fabric profile must be a new type, never an extension of `ProductFabricProfile`.              | Accepted | Chapter 02 contract review             |
| D-06 | Every claim in this dossier carries an explicit evidence tier; untiered statements are proposals.               | Accepted | This tranche                           |
| D-07 | Quote competitor strings only as proof of observation; never import their vocabulary, codes, paths or taxonomy. | Accepted | Chapter 01 review                      |
| D-08 | **The jacket is a modular asset graph, not a complete model per combination.** Chapter 09 is normative.         | Accepted | Seam and grain continuity checks in CI |
| D-09 | Three substitution mechanisms are distinguished and never conflated: geometry, simulation parameter, material.  | Accepted | Chapter 09 assembly table              |
| D-10 | `drape_class`, not `fabric`, is the bake axis, because chapter 04 cannot defend a per-fabric distinction.       | Accepted | Calibration evidence                   |
| D-11 | Snapshots record resolved assembly ids and versions, never a combination identifier.                            | Accepted | Chapter 02 contract review             |

## Open risks

| ID   | Risk                                                                                                                                                                                                                                                                                                              | Status                      | Next proof                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| R-01 | No production-grade original jacket geometry has been accepted in this documentation-only branch.                                                                                                                                                                                                                 | Open quality gap            | Automated geometry/simulation pipeline                                                            |
| R-02 | Illustrative profiles are not calibrated fabric claims, and no evidence path to calibration exists without physical swatches.                                                                                                                                                                                     | Open                        | Automated calibration evidence                                                                    |
| R-03 | Exact construction compatibility and commercial pricing need product rules, not visual assets.                                                                                                                                                                                                                    | Deferred                    | Proposal/MTM contract                                                                             |
| R-04 | HDRI, swatch and PBR asset rights can silently invalidate a build.                                                                                                                                                                                                                                                | Open                        | Asset provenance audit in CI                                                                      |
| R-05 | CI/headless GPU rendering can differ materially from physical devices.                                                                                                                                                                                                                                            | Open                        | Automated device/browser matrix                                                                   |
| R-06 | **Blender 5.2 LTS is unverified.** `docs.blender.org` returned HTTP 403 and `blender.org` served a Cloudflare challenge to every method tried on 2026-08-15. The pipeline names a version this dossier could not confirm, and every Blender property, flag and export limit in chapters 04 and 07 is `SECONDARY`. | Open — blocking for Phase 3 | Confirm the LTS version and re-retrieve the manual from a reachable primary source before pinning |
| R-07 | **The benchmark does not settle the rendering medium.** Suitsupply is payload-verified to compose 2D image layers; Armani's vendor Tailoor markets real-time photorealistic 3D, but no `<canvas>`, WebGL, `gltf` or `glb` signal appeared in any of five captures and its configurator was never reached.         | Open — strategic            | Observer study that the cloth difference reads; otherwise retire the renderer per ch. 05/07/09    |
| R-08 | Three.js is not adopted. No workspace package declares `three`; `three@0.185.1` exists only in the pnpm store and is unresolvable; no `.glb`/`.gltf` file exists. Chapter 05's pin describes an intention, not a state.                                                                                           | Open                        | Phase 3 dependency decision and version repin                                                     |
| R-09 | Every substantive competitor behaviour remains `GATED`. No interaction was driven, so option response, pricing, incompatibility enforcement, camera, save/share/advisor, login and geo behaviour are unobserved for both targets.                                                                                 | Open                        | An interactive observation pass, deliberately not run here                                        |
| R-10 | The 2026-08-14 pass recorded rendered Suitsupply behaviour that the 2026-08-15 capture cannot reproduce; the earlier claims are superseded and must not be re-cited from the prior text.                                                                                                                          | Closed by ch. 01            | Chapter 01 correction section                                                                     |
| R-11 | Naming mismatch: this dossier's "Phase 3" gate has no counterpart section in `docs/PHASE.md`, which uses Stage 0–16 and chapters 4.x with Virtual Wardrobe Studio at 4.6–4.10.                                                                                                                                    | Open                        | Reconcile when `docs/PHASE.md` is next authorized for edit — not in this tranche                  |
| R-12 | Playwright golden thresholds are PAON policy, not inherited defaults; the documentation does not state a `threshold` default on the visual-comparison page.                                                                                                                                                       | Open                        | Pin thresholds explicitly in the test config                                                      |
| R-13 | **Mesh-swapping has no verified precedent.** Chapter 09's 3D assembly graph is a translation of an observed 2D layer graph into a medium where the pattern has not been observed in any reference. The structural argument transfers; the rendering evidence does not.                                            | Open — labelled inference   | Prototype one seam substitution and measure whether the join is invisible                         |
| R-14 | Seam and grain continuity across independently authored assemblies is unproven. If arc-length correspondence or grain-angle continuity cannot hold, the graph collapses toward monolithic bakes and its ~20× economy disappears.                                                                                  | Open — blocking for D-08    | CI seam-arity, correspondence and grain-delta checks on a two-assembly prototype                  |
| R-15 | The material-dependent versus shared split is assumed from Suitsupply's observed `{fabricId}` / `shared/` convention. If most PAON assemblies prove material-dependent, the shared-asset saving largely vanishes.                                                                                                 | Open                        | Count material-dependent assemblies in the first generated family                                 |
| R-16 | The `drape_class` collapse may erase the very difference the lab exists to show, since it deliberately groups fabrics that PAON cannot distinguish.                                                                                                                                                               | Open                        | Observer study; if classes are indistinguishable, the lab has no product                          |

## Roadmap

Implementation is paused pending PAON ground-zero reconciliation. After
explicit authorization, in order:

1. Resolve R-06 and R-08 first — confirm the Blender LTS version against a
   reachable primary source and make an explicit dependency decision on
   Three.js — before any asset work begins.
2. Resolve R-07 and R-16 with the cheapest possible test: a precomputed 2D
   layer set, shown to observers. If the cloth difference does not read there,
   it will not read in 3D either, and the renderer is never built. Note that
   the chapter 09 graph is exactly the contract this 2D test already needs, so
   the work is not thrown away either way.
3. Resolve R-14 next, before authoring breadth: generate one family and exactly
   two interchangeable assemblies, and prove in CI that seam arity, arc-length
   correspondence and grain continuity hold and that the join is invisible. The
   modular decision stands or falls here.
4. Generate the first family and its assembly set through the unattended panel,
   sewing and drape pipeline, preserving deterministic regeneration and
   provenance; measure R-15 against it.
5. Fit illustrative fabric parameters against published benchmark procedures
   and synthetic PAON-controlled tests; retain low-confidence labels until
   physical measurements exist.
6. Add isolated Studio-side read-only composition using existing consent and
   entitlement gates.
7. Only after proposal/MTM contracts are accepted, design snapshots,
   compatibility, price and advisor continuation. Never infer them from this
   lab.
