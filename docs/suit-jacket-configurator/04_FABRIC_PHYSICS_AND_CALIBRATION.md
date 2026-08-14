# Fabric physics and calibration

## Parameters

Store SI values and provenance: areal mass (kg/m²), thickness (m), warp/weft tensile curves (N/m versus strain), warp/weft compression response, shear force versus angle, bending rigidity (N·m), damping (dimensionless or solver-specific documented unit), friction coefficients, Poisson response, grain direction, weave, finish, opacity/transmission, base-colour/normal/roughness maps and test conditions. Each value carries `measured`, `supplier`, `estimated` or `illustrative` provenance and low/medium/high confidence.

GSM converts only to areal mass: `gsm / 1000 = kg/m²`. Composition and GSM alone do **not** yield stretch, bending, shear, damping, friction, thickness, weave, finish or optical response; no physical prediction may be claimed from them.

## Lab profiles

The lab profiles are labelled illustrative, not calibrated: Airy Twill (low mass visual cue), Resilient Wool (balanced), Structured Mohair Blend (crisper surface cue). Values support comparison language only; they are not textile specifications and no composition/GSM claim is made.

## Calibration plan

For each evidence-backed fabric, retain the available test conditions and repeatable targets: mass/thickness, uniaxial warp/weft extension, bias/shear, cantilever/pure bend, compression, friction and photographed drape/collision poses. An unattended inverse-fitting pipeline fits solver parameters against published benchmark data, supplier measurements that include a test method, or PAON-controlled captures; it holds out poses, logs loss and visual deltas, and publishes confidence. Public literature may seed an illustrative class but never a product-specific physical claim. If instrumented evidence is absent, the profile stays `illustrative` and the interface says so; no manual founder task or specialist hire is required to use the lab.

## Sources

| Source                                                                   | Author / organization        |        Date | URL                                                                                       | Relevance / limitation                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------- | ----------: | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Large Steps in Cloth Simulation                                          | David Baraff, Andrew Witkin  |        1998 | https://www.cs.cmu.edu/~baraff/papers/sig98.pdf                                           | Foundational implicit dynamics; not fabric calibration.                                                        |
| The “Handle” of Cloth as a Measurable Quantity                           | F. T. Peirce                 |        1930 | https://doi.org/10.1177/004051753000100503                                                | Foundational bending/handle measurements; historical apparatus and assumptions limit solver mapping.           |
| The Measurement of Fabric Drape                                          | G. E. Cusick                 |        1968 | https://doi.org/10.1177/004051756803800706                                                | Defines drape measurement concepts; a drape coefficient is not a complete constitutive model.                  |
| Estimating Cloth Simulation Parameters from Video                        | Bhat et al., Carnegie Mellon |        2003 | https://graphics.cs.cmu.edu/projects/clothparameters/                                     | Uses controlled static/dynamic experiments; requires real fabric capture.                                      |
| Data-Driven Elastic Models for Cloth: Modeling and Measurement           | Wang, Ramamoorthi, O'Brien   |        2011 | https://graphics.berkeley.edu/papers/Wang-DDE-2011-08/                                    | Captures anisotropic nonlinear response; measurement and model assumptions do not transfer automatically.      |
| Data-Driven Estimation of Cloth Simulation Models                        | Miguel et al.                |        2012 | https://doi.org/10.1111/j.1467-8659.2012.03031.x                                          | Inverse fitting supports calibration architecture; depends on controlled observations and chosen solver.       |
| Robust Treatment of Collisions, Contact and Friction for Cloth Animation | Bridson, Fedkiw, Anderson    |        2002 | https://graphics.stanford.edu/papers/cloth-sig02/cloth.pdf                                | Collision/contact reference; not a source of textile material parameters.                                      |
| Physical Properties                                                      | Blender Foundation           | 2026 manual | https://docs.blender.org/manual/en/latest/physics/cloth/settings/physical_properties.html | Documents mass, tension, compression, shear, bending and damping controls; solver values are not measurements. |
| Fabric objective measurements for commercial 3D virtual garment          | Li, Xu, Li et al.            |        2021 | https://salford-repository.worktribe.com/OutputFile/1485671                               | Supports importance of extension/shear/bending; conversion varies by software.                                 |
