# Fabric physics and calibration

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## The gap this chapter exists to hold open

`OBSERVED-CODE`. The only fabric facts PAON holds today are in
`ProductFabricProfile` at `packages/domain/src/metadata/metadata.ts:133`:

```text
fabricWeightGramsPerSquareMetre?: number
composition: readonly ProductFabricComposition[]
supplierReference?: string
```

`BLOCKED`. That set cannot produce drape. GSM converts only to areal mass
(`gsm / 1000 = kg/m²`). Fibre composition constrains nothing that a solver
consumes: two cloths of identical fibre content and identical grammage differ
in bending rigidity by a large factor according to weave, twist, finish and
setting. Therefore **no physical prediction may be derived from
`ProductFabricProfile`**, and any future physics-bearing profile must be a
separate, separately versioned type (chapter 02).

The properties a solver actually needs, none of which PAON holds:

| Quantity                           | Unit                        | Derivable from GSM + composition? |
| ---------------------------------- | --------------------------- | --------------------------------- |
| Areal mass                         | kg/m²                       | Yes — this is the only one        |
| Thickness                          | m                           | No                                |
| Warp/weft tensile response         | N/m vs strain               | No                                |
| Compression response               | N/m vs strain               | No                                |
| Shear response                     | force vs angle              | No                                |
| Bending rigidity                   | N·m                         | No                                |
| Damping                            | solver-specific, documented | No                                |
| Friction (cloth–cloth, cloth–body) | dimensionless               | No                                |
| Anisotropy / grain direction       | axis + ratio                | No                                |
| Weave, finish, setting             | categorical                 | No                                |
| Optical response                   | BRDF / sheen parameters     | No                                |

Every stored value carries SI units, test conditions, a provenance label of
`measured`, `supplier`, `estimated` or `illustrative`, and a low/medium/high
confidence. A value without provenance is not storable.

## Lab profiles

`INFERRED`, deliberately. The three lab profiles are labelled illustrative, not
calibrated: Airy Twill (low mass visual cue), Resilient Wool (balanced),
Structured Mohair Blend (crisper surface cue). Their values support comparison
language only. They are not textile specifications, they make no composition or
GSM claim, and they are not offered as any real cloth PAON sells.

## What the literature can and cannot do here

`OBSERVED-DOC`. Wang, Ramamoorthi and O'Brien (SIGGRAPH 2011, ACM TOG
30(4):71:1–11) state the problem exactly: cloth "has complicated nonlinear,
anisotropic elastic behavior due to its woven pattern and fiber properties",
while most simulation "simply use[s] linear and isotropic elastic models with
manually selected stiffness parameters", which "cannot model most materials
with fidelity to their real-world counterparts". Their contribution is a
piecewise-linear elastic model plus new measurement apparatus for stretching
and bending, fitted by a well-posed optimization, over a database of **ten**
measured materials. Raw data (~2.5 GB) and estimated parameters are published.

`OBSERVED-DOC`. Bhat, Twigg, Hodgins, Khosla, Popović and Seitz estimate
simulation parameters from **video of real fabric**, using a perceptually
motivated fold-matching metric and simulated annealing, over "simple static and
dynamic calibration experiments that use small swatches of the fabric", for
four fabrics.

The decisive point for PAON: both methods require **physical possession of the
cloth**. Wang et al. measure swatches on an apparatus; Bhat et al. film
swatches. Neither derives parameters from a product description. A published
parameter set describes the ten or four fabrics that were measured — it can
seed an illustrative fabric _class_, and it can never establish behaviour for a
specific PAON cloth.

`SECONDARY`. Textile metrology defines the measurements that would close the
gap. ASTM D1388 measures fabric stiffness by cantilever bending: a strip is
advanced over an edge until it bends under its own mass to a fixed angle
(41.5°), giving bending length and thence flexural rigidity; a heart-loop
option exists for limp fabrics. The Kawabata Evaluation System (KES-FB1
tensile/shear, KES-FB2 bending, KES-FB3 compression, KES-FB4 surface friction
and roughness, conventionally on 20 × 20 cm specimens) measures the low-stress
mechanical set that maps most directly onto solver parameters. Cusick's drape
meter defines a whole-garment drape coefficient. These are tagged `SECONDARY`
because the standards themselves sit behind ASTM/ISO paywalls and were not
retrieved in full; the descriptions come from vendor and review literature.

## Calibration plan

For each evidence-backed fabric, retain the available test conditions and
repeatable targets: mass and thickness, uniaxial warp/weft extension,
bias/shear, cantilever or pure bend, compression, friction, and photographed
drape and collision poses. An unattended inverse-fitting pipeline fits solver
parameters against published benchmark data, supplier measurements **that state
a test method**, or PAON-controlled captures. It holds out poses, logs loss and
visual deltas, and publishes a confidence label with every fit.

Solver parameters are not measurements. `SECONDARY` — see chapter 07 for the
retrieval caveat — Blender's cloth panel exposes Quality Steps, Speed
Multiplier, Vertex Mass, Air Viscosity, Stiffness (Tension, Compression, Shear,
Bending), Damping (Tension, Compression, Shear, Bending), Internal Springs and
Pressure. Those are controls on a solver, in solver units, with a solver's
discretization baked in. A fitted value is meaningful only as a pair of
(parameter, solver version), and it does not transfer to a different solver,
timestep or mesh resolution without refitting. Any manifest that stores a
fitted parameter must store the solver identity and version beside it.

## Falsification and the founder boundary

A profile is promoted from `illustrative` only when: a documented test method
accompanies every input value; the fit reproduces held-out poses within a
published visual threshold; and the solver identity, version and mesh
resolution are pinned in the manifest. Until then the profile stays
`illustrative` and the interface says so, in words, next to the comparison.

`BLOCKED` is the correct outcome of missing evidence. If instrumented evidence
is absent, PAON does not create a founder task to obtain it, does not ask the
founder to buy a Kawabata rig or send swatches to a laboratory, and does not
hire a textile specialist. It withholds the physical claim and keeps the lab
explicitly illustrative. A comparison surface that is honestly labelled
illustrative is a shippable product; an uncalibrated surface that implies
accuracy is not.

## Sources

| Source                                                                   | Author / organization                                         |                Date | URL                                                                                       | Relevance / limitation                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------: | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Data-Driven Elastic Models for Cloth: Modeling and Measurement           | Wang, Ramamoorthi, O'Brien; SIGGRAPH 2011, ACM TOG 30(4):71   |             2011-07 | https://graphics.berkeley.edu/papers/Wang-DDE-2011-08/                                    | Anisotropic nonlinear stretch/bend model plus apparatus; ten measured materials only; canonical URL now redirects to objf.ai. |
| Estimating Cloth Simulation Parameters from Video                        | Bhat, Twigg, Hodgins, Khosla, Popović, Seitz; Carnegie Mellon |                2003 | https://graphics.cs.cmu.edu/projects/clothparameters/                                     | Inverse fitting from video of real swatches; four fabrics; requires physical cloth and a chosen simulator.                    |
| Large Steps in Cloth Simulation                                          | David Baraff, Andrew Witkin                                   |                1998 | https://www.cs.cmu.edu/~baraff/papers/sig98.pdf                                           | Foundational implicit dynamics; not fabric calibration.                                                                       |
| Robust Treatment of Collisions, Contact and Friction for Cloth Animation | Bridson, Fedkiw, Anderson                                     |                2002 | https://graphics.stanford.edu/papers/cloth-sig02/cloth.pdf                                | Collision, contact and friction reference; PDF retrieved 2026-08-15; supplies no textile material parameters.                 |
| Data-Driven Estimation of Cloth Simulation Models                        | Miguel et al.                                                 |                2012 | https://doi.org/10.1111/j.1467-8659.2012.03031.x                                          | Inverse fitting supports the calibration architecture; depends on controlled observations and a chosen solver.                |
| The “Handle” of Cloth as a Measurable Quantity                           | F. T. Peirce                                                  |                1930 | https://doi.org/10.1177/004051753000100503                                                | Foundational bending/handle measurement; historical apparatus limits direct solver mapping.                                   |
| The Measurement of Fabric Drape                                          | G. E. Cusick                                                  |                1968 | https://doi.org/10.1177/004051756803800706                                                | Defines drape measurement; a drape coefficient is not a constitutive model.                                                   |
| D1388 Standard Test Method for Stiffness of Fabrics                      | ASTM International                                            | accessed 2026-08-15 | https://www.astm.org/standards/d1388                                                      | Cantilever bending length and flexural rigidity at 41.5°; standard text is paywalled and was not retrieved in full.           |
| Kawabata Evaluation System (KES-FB1–FB4)                                 | Kawabata; summarized by third parties                         | accessed 2026-08-15 | https://www.sciencedirect.com/topics/engineering/kawabata-evaluation-system               | Names the low-stress tensile/shear/bending/compression/surface set; `SECONDARY` — primary instrument specs not retrieved.     |
| Fabric objective measurements for commercial 3D virtual garment          | Li, Xu, Li et al.                                             |                2021 | https://salford-repository.worktribe.com/OutputFile/1485671                               | Supports the importance of extension/shear/bending inputs; conversion varies by software.                                     |
| Physical Properties (cloth)                                              | Blender Foundation                                            |          see ch. 07 | https://docs.blender.org/manual/en/latest/physics/cloth/settings/physical_properties.html | Names the solver controls; **the page returned HTTP 403 to every retrieval method on 2026-08-15** — see chapter 07.           |
