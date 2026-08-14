# Modular asset graph

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. This chapter is the
normative asset contract. Chapters 02, 03 and 07 defer to it.

## The decision it replaces

The jacket is **not** a complete model per combination. It is a graph of
versioned, independently authored assemblies that attach to a small number of
compatible base families along declared seams.

Illustrative arithmetic, with the assumptions stated. Take lapel 3 × collar 2 ×
canvas 3 × shoulder 2 × sleeve 2 × vents 3 × pockets 3 × lining 3 = 1,944
construction combinations. Baked monolithically across 3 drape classes and 3
movement states that is **17,496 GLB files**, every one of which must be
regenerated when the base pattern changes by a millimetre.

Under the graph, deforming assemblies are baked **independently and summed
rather than multiplied**: lapel 3 + collar 2 + sleeve 2 + vents 3 + pockets 3 +
lining 3 = 16 assembly variants. The two parameter-mechanism selections still
multiply, because they change the simulation input and therefore the bake:
canvas 3 × shoulder 2 = 6. Across 3 drape classes and 3 movement states that is
16 × 6 × 9 = **864 bakes**, a **20.25× reduction**, plus rigid shared parts
that are never baked at all.

That figure is deliberately conservative: it assumes every parameter
combination re-bakes every assembly, when in practice canvas structure barely
reaches the sleeve or the vents. The honest claim is the lower bound. The ratio
is the point, and it widens with every option added, because the numerator
multiplies and the denominator adds.

The first experiment still ships exactly one construction. The graph is the
contract that experiment must not violate, not a licence to build 864 assets.

## Precedent, and its exact evidentiary limit

`PAYLOAD`, from the 2026-08-15 Suitsupply capture. The configurator's data
payload contains a literal, ordered asset graph. Its shape:

```text
layerDefinitions.configurationTypes["3"] = {
  fallbackUrl:  "custommade/assets/default-images/Waistcoat",
  sequenceNo:   3,
  layerDefinitions: [
    { imageTemplate: "suitconfig/{fabricId}/Waistcoat/lapel/{3}_{104}_CNP1" },
    { imageTemplate: "suitconfig/{fabricId}/Waistcoat/pocket/{3}_{120}" },
    { imageTemplate: "suitconfig/shared/lining/{3}_{104}_{2}_{113}" },
    { imageTemplate: "suitconfig/shared/buttons/{3}_{104}_{125}" },
    { imageTemplate: "suitconfig/shared/buttons/{3}_{104}_{39}" },
  ]}
```

Five properties are directly readable from that, and every one of them
transfers to PAON:

1. **Ordered composition.** An explicit `sequenceNo` and an ordered layer array.
   Assembly order is data, not code.
2. **Option-keyed asset addressing.** Layer paths are templates whose
   placeholders are option identifiers (`{3}`, `{104}`, `{120}`, `{113}`). The
   asset key _is_ the resolved selection. There is no combination-specific
   bundle; there is a deterministic path built from the selection.
3. **Material-dependent versus shared assemblies.** `suitconfig/{fabricId}/…`
   for lapel and pocket; `suitconfig/shared/…` for lining and buttons. Some
   assemblies vary with the cloth and some do not, and the graph records which.
4. **Per-layer view variants.** Each resolved layer carries `src`, `srcSheet`
   (a `…/rotation/…_sheet` sprite sheet), `srcRotation` (a `…_{rotation}`
   template) and `srcset`. Views are discrete pre-rendered variants of each
   layer, with observed `rotationPosition` values `{0,1,2}` and `zoomPosition`
   values `{0,2,3,4,5,8}`.
5. **Fallback is a graph node.** Every configuration type declares a
   `fallbackUrl` and a `fallbackImage` with the same `src`/`srcSheet`/
   `srcRotation`/`srcset` shape as a real layer. Degradation is designed in at
   the asset level, not bolted on at the view level.

Also `PAYLOAD`: a server-side composite service exists
(`CreateConfiguredProductImage` under `apim.suitsupply.com`, with a
`configurationImagesBasePath` of `…/image/upload/configurationimages`), and a
`previewModeToggle` with the accessible label `Toggle model view`.

**The evidentiary limit, stated precisely as required.** What is verified is
that Suitsupply's payload describes an ordered graph of _image layers_. No
`<canvas>`, WebGL, `three`, `glb`, `gltf`, `obj`, `fbx` or mesh signal appears
anywhere in either capture; the only 3D-adjacent token is `rotation`, and it
resolves to pre-rendered sprite sheets. Therefore:

- That any reference configurator **swaps meshes** is `INFERRED` and
  **unverified**. Nothing observed supports it, and for Suitsupply the evidence
  points the other way.
- That Suitsupply composites **2D layers** is `PAYLOAD`-supported by the layer
  templates and Cloudinary transforms; whether composition happens client-side,
  server-side, or both is `INFERRED`.
- PAON's 3D assembly graph below is a **translation of an observed 2D pattern
  into a medium where the pattern has not been observed**. The structural
  argument carries over; the rendering evidence does not.

Under decision D-12 the 3D path is primary and the 2D layer graph is tier 2 of
the delivery ladder (chapter 05) rather than a rival. Both tiers are emitted
from this one graph and keyed by the same `bake_key`, so the medium question
stays empirically open — chapter 10's observer study can compare them directly
— without either answer requiring a redesign.

Armani's configurator surface remains `GATED`. `OBSERVED-DOM`: it is a Tailoor
deployment (`storage.tailoor.com` preconnect hints, `storage-prod.tailoor.com`
assets). `SECONDARY`: Tailoor's own marketing claims real-time, photorealistic
3D. But three separate captures of Armani surfaces produced zero `<canvas>`,
WebGL, `gltf`, `glb`, `model-viewer`, Babylon, PlayCanvas or Unity signals, and
the configurator application was never reached. A vendor's claim that a 3D
pipeline exists is not evidence that meshes are swapped, that assemblies are
modular, or that anything in this chapter has a working precedent in 3D.
Nothing here is attributed to Armani or Tailoor.

## Base families

A **base family** is a topology contract: a fixed panel layout, a fixed seam
network, a fixed UV atlas and a fixed material-slot roster. Assemblies attach
within a family. Crossing families is not a swap — it is a different garment.

| Family id | Scope                                   | Why it is its own family                                                                |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `sb-2`    | Single-breasted body, two-button stance | Baseline front panel pair, single overlap, one button stance geometry                   |
| `sb-1`    | Single-breasted body, one-button stance | Different stance and lapel roll length change the front seam network                    |
| `db-6`    | Double-breasted body, six-button        | Wider front overlap, different panel count and closure geometry — incompatible topology |

The first experiment uses `sb-2` only. `sb-1` and `db-6` are declared so the
contract is not silently single-family; neither is authored in this tranche.

## Assemblies and the three substitution mechanisms

The central correction: **not every option is a mesh swap.** Three mechanisms
exist and must never be conflated, because they have different cost, different
bake behaviour and different failure modes.

| Mechanism                      | What changes                                     | Baked per drape state?    | Examples                                      |
| ------------------------------ | ------------------------------------------------ | ------------------------- | --------------------------------------------- |
| **G — geometry substitution**  | A different mesh occupies the same seam boundary | Yes, if it deforms        | lapel, collar, vents, pockets, sleeve, lining |
| **P — parameter modification** | The simulation input field, not the mesh         | Yes — it changes the bake | canvas structure, shoulder roping             |
| **M — material assignment**    | A material slot binding only                     | No — runtime              | shell fabric, lining colour, button material  |

Canvas is the clearest case and the one most often modelled wrongly. Half
versus full canvas is not a visible mesh: it is a stiffness and pin-weight
field over the front and chest that produces a different rest shape and a
different fold character from identical topology. It belongs to `P`. Treating
it as `G` would multiply the mesh count for no geometric reason; treating it as
`M` would make it invisible.

| Assembly id  | Mech. | Attach seam / anchor                      | Variants (illustrative)  | Material-dependent |
| ------------ | ----- | ----------------------------------------- | ------------------------ | ------------------ |
| `front`      | G     | family root                               | per family               | yes                |
| `lapel`      | G     | `seam.lapel_roll`, `seam.gorge`           | notch, peak, shawl       | yes                |
| `collar`     | G     | `seam.neckline`, `seam.gorge`             | standard, one-piece      | yes                |
| `canvas`     | P     | field over `front`, `chest`               | unstructured, half, full | n/a                |
| `shoulder`   | P     | field over `seam.shoulder`                | natural, roped           | n/a                |
| `sleeve`     | G     | `seam.armscye`                            | one-piece, two-piece     | yes                |
| `back_vents` | G     | `seam.back_yoke`, `seam.side`             | none, side, centre       | yes                |
| `pockets`    | G     | `anchor.pocket_l/r`, `anchor.chest`       | patch, flap, jetted      | yes                |
| `buttons`    | G     | `anchor.stance_n`, `anchor.cuff_n`        | horn, corozo, covered    | no — shared        |
| `lining`     | G     | `seam.lining_edge`, `seam.armscye_lining` | unlined, half, full      | no — shared        |
| `materials`  | M     | material slots                            | per fabric profile       | is the material    |

The material-dependent column follows Suitsupply's observed split directly:
assemblies whose surface shows the cloth are authored per material; buttons and
lining are shared. A shared assembly is authored once and reused across every
fabric, which is where most of the ~20× saving actually comes from.

## Attachment seams

A **seam** is the compatibility primitive. An assembly declares the boundary
loops it consumes and produces:

```text
seam:
  id:                  seam.armscye
  schema_version:      2
  ring_arity:          96          # vertex count, fixed by the family
  parameterization:    arc_length_normalized
  frame:               right_handed, +Z outward normal at ring centroid
  grain_vector_uv:     [u, v]      # cloth grain direction at the ring
  tolerance_mm:        0.25
```

Two assemblies attach if and only if they agree on `id`, `schema_version`,
`ring_arity` and `parameterization`. This is checked in CI, not at runtime.
Arc-length parameterization — rather than raw vertex index — is what allows an
assembly to be re-authored at a different internal resolution while remaining
attachable.

A seam is a contract about the _boundary_, never about the interior. An
assembly may change its interior topology freely at a MINOR version; changing
`ring_arity` or `parameterization` is a MAJOR change that invalidates every
counterpart assembly.

## Anchors

An **anchor** is a named frame for point attachment — buttons, monogram, pocket
placement, advisor annotation. Anchors must survive deformation, so an anchor
is bound to the surface rather than to world space:

```text
anchor:
  id:               anchor.stance_1
  binding:          { triangle_index, barycentric: [a, b, c] }
  frame:            { normal, tangent }   # derived from the bound triangle
  offset_mm:        [x, y, z]
```

Surface binding is what makes the button-as-shared-asset economy work: one
rigid button mesh is instanced at anchors whose transforms are recomputed per
drape state from the deformed surface. The button is never re-baked; only its
small per-state transform table is.

## UV and material continuity

The family owns the UV atlas. Each assembly is granted a **disjoint UV chart
lease** within it, so substituting one assembly can never reflow another's UVs
and can never invalidate another's baked textures.

Material slots are **roles fixed at family level** — `shell`, `lining`,
`undercollar`, `button`, `topstitch`, `felt`. An assembly binds to a role. An
assembly may never introduce a new slot; that is a family-level change.

Grain continuity is a hard check and a real failure mode. Each assembly records
its grain vector in UV space at every seam ring. CI computes the angular delta
across the seam and rejects the pair beyond a published threshold. Without it, a
twill line or a stripe breaks visibly at the shoulder or lapel join, which is
precisely the defect a tailoring audience notices first and a pixel-diff gate
does not.

`OBSERVED-DOC`, from chapter 03: glTF morph targets carry POSITION, NORMAL and
TANGENT only. A morph therefore cannot re-chart UVs, cannot change `ring_arity`
and cannot express a seam schema change. Morphs are admissible **within** an
assembly variant across drape states of identical topology, and nowhere else.

## Drape-state variants and the bake set

```text
bake_key = (family, deforming_assembly_variant, canvas, drape_class, state)
```

Deliberately absent from the key: fabric, lighting, buttons, and every `M`
assembly. Those resolve at runtime.

`drape_class`, not `fabric`, is the bake axis, and this is an honesty
requirement rather than an optimization. Chapter 04 establishes that PAON
cannot distinguish specific cloths physically from the data it holds. Baking
per fabric would encode a distinction the evidence does not support. Baking per
drape class — a small, explicitly illustrative set — encodes exactly the
distinction PAON can defend. Many fabrics map to one class; the mapping is
versioned, provenance-labelled, and marked `illustrative` until calibrated.

## Versioning

| Change                                                                 | Bump  | Consequence                                     |
| ---------------------------------------------------------------------- | ----- | ----------------------------------------------- |
| Family panel layout, seam network, `ring_arity`, UV atlas, slot roster | MAJOR | Every assembly in the family is invalidated     |
| Assembly interior geometry, within an unchanged seam contract          | MINOR | That assembly re-bakes; counterparts unaffected |
| Material binding, texture, colour                                      | PATCH | No re-bake                                      |

Each assembly declares `requires_family: { id, version_range }` and the
`seam_schema_version` it was authored against. A resolver that cannot satisfy
both fails closed to the poster rather than composing a mismatched garment.

Retired versions stay resolvable for any saved snapshot, per chapter 02.

## Compatibility rules

Rules are data, evaluated by a resolver, never conditionals scattered through
UI code:

```text
rule:
  id:        rule.shawl-excludes-notch-gorge
  when:      { lapel: shawl }
  forbid:    { collar: standard }
  reason_key: reason.shawl_collar_is_continuous
  severity:  hard          # hard | advisory
```

Every rule publishes a `reason_key`. A disabled control that does not say why
is a defect, not a design choice — and chapter 01 records that even the
reference product ships an explicit incompatibility message rather than a
silent disable.

Resolution order: apply family constraints, then hard rules, then advisory
rules. A hard conflict fails closed. An advisory conflict renders with a
visible note.

## Manifest contracts

`AssetGraphManifest v1` is the signed, machine-readable root:

```text
AssetGraphManifest v1
  schemaVersion
  familyId, familyVersion
  seamSchemaVersions:  { seam.id -> version }
  materialSlots:       [ role ]
  assemblies: [
    { id, mechanism: G|P|M, variant, version,
      requiresFamily: { id, versionRange },
      consumesSeams: [ { id, schemaVersion, ringArity } ],
      producesSeams: [ … ],
      anchors:       [ anchor.id ],
      uvChartLease:  [ rect ],
      materialBindings: { slotRole -> materialId },
      materialDependent: bool }
  ]
  bakes: [
    { bakeKey: { family, assemblyVariant, canvas, drapeClass, state },
      uri, sha256, mimeType, byteBudget, triangleCount,
      lod, validatorReport, generatorVersion, solverIdentity, solverVersion,
      seed, confidence, provenance } ]
  rules:     [ … ]
  layers2d: [
    { bakeKey, sequenceNo, assemblyId, materialDependent,
      src, srcset, uri, sha256 } ]        # tier 2, same bakeKey as the mesh
  fallbacks: { perFamily: posterUri, perAssembly: posterUri }
  rights:    { assetId -> rightsRecord }        # per chapter 03
```

Non-negotiable manifest invariants:

- Every `bakes[]` entry carries `sha256`, `generatorVersion`, `solverIdentity`,
  `solverVersion` and `seed`. Determinism is unverifiable without all five.
- Every entry carries a rights record (chapter 03). No record, no ship.
- Every entry carries `confidence` and `provenance`. An `illustrative` bake
  must be labelled `illustrative` all the way to the interface.
- A `fallbacks` entry exists at both family and assembly granularity, following
  the observed precedent that fallback is a first-class graph node.
- Every mesh bake has a corresponding `layers2d` entry under the **same**
  `bakeKey`. Tier 2 is generated in the same pass as tier 1, from the same
  assembly, and CI rejects a manifest where the two sets disagree. This is what
  keeps the fallback honest: it cannot drift from the primary, because it is
  not authored separately.
- The manifest is hash-signed as a whole; a partial or unsigned manifest fails
  closed.

## Falsification

This chapter is wrong, and should be retired rather than repaired, if any of
these hold: seam rings cannot hold arc-length correspondence across
independently authored assemblies; grain continuity cannot be maintained across
substituted assemblies at a tailoring-credible threshold; the per-assembly bake
set does not actually shrink because too many assemblies prove
material-dependent; or the drape-class collapse turns out to erase the very
difference the lab exists to show.
