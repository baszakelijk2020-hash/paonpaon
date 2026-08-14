# Fabric physics and calibration

## Parameters

Store SI values and provenance: areal mass (kg/m²), thickness (m), warp/weft tensile curves (N/m versus strain), warp/weft compression response, shear force versus angle, bending rigidity (N·m), damping (dimensionless or solver-specific documented unit), friction coefficients, Poisson response, grain direction, weave, finish, opacity/transmission, base-colour/normal/roughness maps and test conditions. Each value carries `measured`, `supplier`, `estimated` or `illustrative` provenance and low/medium/high confidence.

GSM converts only to areal mass: `gsm / 1000 = kg/m²`. Composition and GSM alone do **not** yield stretch, bending, shear, damping, friction, thickness, weave, finish or optical response; no physical prediction may be claimed from them.

## Lab profiles

The lab profiles are labelled illustrative, not calibrated: Airy Twill (low mass visual cue), Resilient Wool (balanced), Structured Mohair Blend (crisper surface cue). Values support comparison language only; they are not textile specifications and no composition/GSM claim is made.

## Calibration plan

For each approved fabric, retain conditioned swatches, grain labels and repeat tests: mass/thickness, uniaxial warp/weft extension, bias/shear, cantilever/pure bend, compression, friction and photographed drape/collision poses. Fit solver parameters against static/dynamic swatch captures and garment-on-form scans, hold out poses, log loss/visual review and publish confidence. Human textile/3D specialists sign off both mapping and claim language.

## Sources

| Source                                                          | Author / organization        |        Date | URL                                                                                       | Relevance / limitation                                                                                         |
| --------------------------------------------------------------- | ---------------------------- | ----------: | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Large Steps in Cloth Simulation                                 | David Baraff, Andrew Witkin  |        1998 | https://www.cs.cmu.edu/~baraff/papers/sig98.pdf                                           | Foundational implicit dynamics; not fabric calibration.                                                        |
| Estimating Cloth Simulation Parameters from Video               | Bhat et al., Carnegie Mellon |        2003 | https://graphics.cs.cmu.edu/projects/clothparameters/                                     | Uses controlled static/dynamic experiments; requires real fabric capture.                                      |
| Physical Properties                                             | Blender Foundation           | 2026 manual | https://docs.blender.org/manual/en/latest/physics/cloth/settings/physical_properties.html | Documents mass, tension, compression, shear, bending and damping controls; solver values are not measurements. |
| Fabric objective measurements for commercial 3D virtual garment | Li, Xu, Li et al.            |        2021 | https://salford-repository.worktribe.com/OutputFile/1485671                               | Supports importance of extension/shear/bending; conversion varies by software.                                 |
