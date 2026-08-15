# Ground-zero reconciliation and the Phase 1 implementation plan

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. This chapter
releases the authorization gate the dossier has carried since its first
tranche, and specifies the first implementation slice. It contains no code and
changes no application file; the code lands in the next coding sprint.

## Naming, reconciled

The dossier previously used "Phase 3" for the founder authorization gate, which
collided with `docs/PHASE.md`, where no section is numbered "Phase 3" (R-11).
The vocabulary from here is:

- **The authorization gate** — released 2026-08-15 by founder decision. It is
  not a phase; it is a yes.
- **Lab Phase 1** — this chapter. Reach Suitsupply's render quality, then prove
  that cloth character reads. Quality first; the second question is worthless
  without it.
- **Lab Phase 2** — breadth: more assemblies, more families, Studio-side
  read-only composition behind consent and entitlement gates.
- **Lab Phase 3** — commercial contracts: snapshots, compatibility, price and
  advisor continuation, and only after proposal/MTM contracts are accepted.

`docs/PHASE.md` is untouched by this tranche. Aligning its numbering with this
sequence needs separate authorization.

## Ground-zero reconciliation

Each claim the dossier held open against the gate, and its status now.

| Gate item                          | Prior state                            | Reconciled state                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Founder authorization to implement | Withheld                               | **Granted** 2026-08-15 for Lab Phase 1 only                                                                                                                                                       |
| Rendering medium (R-13)            | Unsettled; 3D unjustified by benchmark | **Settled**: D-12 builds the 3D path; D-16 ships offline-rendered imagery and demotes live WebGL to optional; D-15 sets Suitsupply's still-image quality as the bar                               |
| Blender version (R-06)             | "5.2 LTS", asserted but unverified     | **Confirmed 5.2 LTS** from blender.org itself, supported until July 2028; the manual is now `OBSERVED-DOC`. See below for the intermediate 4.5 pin and why it was wrong.                          |
| Three.js adoption (R-08)           | Not declared anywhere in the workspace | Scheduled as W1; still absent as of `71697c2`                                                                                                                                                     |
| Asset contract                     | Absent                                 | Chapter 09, normative                                                                                                                                                                             |
| Physical-accuracy claims (R-02)    | Blocked                                | **Still blocked.** Authorization moves the build, not the claim                                                                                                                                   |
| Competitor behaviour (R-09)        | `GATED`                                | **Still gated.** The direct Armani configurator URL was reached and returned an application error state; no interaction was driven and nothing new is claimed about behaviour or rendering medium |
| Calibration evidence               | Absent                                 | **Still absent.** Every profile remains `illustrative`                                                                                                                                            |

Two of these deserve emphasis, because releasing a gate tends to blur them. The
physical-accuracy block and the competitor-observation gap are **unchanged**.
Phase 1 builds a comparison surface; it does not acquire a single new fact
about how any real cloth behaves.

## R-06 closed: Blender 5.2 LTS, read from the primary source

`OBSERVED-DOC`, 2026-08-15, retrieved from `https://www.blender.org/download/lts/`.
Under the heading **LTS Releases Currently Maintained**:

> Long-Term Support — **Blender 5.2 LTS** — Released July 14, 2026, supported
> until July 2028
>
> Long-Term Support — **Blender 4.5 LTS** — Last updated to 4.5.12 on July 21,
> 2026

Listed as previous LTS releases: 4.2 (released July 14 2024, last updated
4.2.23 July 2026), 3.6, 3.3, 2.93 and 2.83. The page also states the programme
rule: LTS "will provide critical fixes throughout a 2-year time span" and "will
not have any new features, API changes or improvements."

**Decision D-13, corrected: pin Blender 5.2 LTS.** Two LTS series are currently
maintained; 5.2 is the newer and is supported until July 2028, which satisfies
the founder's instruction to target the latest verifiable LTS.

### How the earlier pin was wrong, and why it matters

An intermediate version of this chapter pinned 4.5 LTS on the strength of patch
cadence read off two release mirrors, after blender.org refused every automated
retrieval method. The reasoning was: 4.2 and 4.5 had long maintenance tails,
5.0 and 5.1 died within weeks, 5.2.0 had no tail, therefore 5.2 was a regular
release.

The flaw is plain in hindsight. **5.2.0 shipped on 2026-07-14, one month before
the observation.** A month-old release cannot have a maintenance tail. Absence
of a tail was read as evidence of non-LTS status when it was only evidence of
recency. The mirror data was accurate; the inference drawn from it was not.

Two process lessons, recorded because they will recur:

1. A negative signal from a time-series needs an age check before it can carry
   weight. "No patches yet" and "no patches ever" are different claims.
2. The retrieval failure was a **tooling** failure, not a genuine unavailability.
   Cloudflare was fingerprinting the automation browser build; the page opened
   immediately through an ordinary Chrome installation driven over the DevTools
   protocol. `BLOCKED` should be provisional on exhausting realistic access
   methods, and "the automation binary is refused" is not the same as "the
   source cannot be read".

Homebrew's `blender@lts` cask, pinned to `5.2.0` with a comment disclaiming its
own accuracy, turns out to have been right. It was discounted in favour of an
inference. The primary source outranks both.

### Manual pages, now retrieved directly

The same method opened the manual, which self-identifies as the **Blender 5.2
LTS Manual** — independent corroboration of the LTS designation. The Blender
facts in chapters 04 and 07 are consequently promoted from `SECONDARY` to
`OBSERVED-DOC`, and two errors in the earlier second-hand list are corrected:
`Quality Steps` and `Speed Multiplier` are **not** on the Physical Properties
page, and a `Bending Model` selector (`Linear` / `Angular`) that the secondary
sources omitted **is**.

The glTF exporter page was also retrieved, after resolving its moved URL
through the manual's own search: it now lives at
`docs.blender.org/manual/en/latest/addons/scene_gltf2.html`, no longer under
`import_export/`. Two further second-hand claims fall as a result — `glTF
Embedded (.gltf)` was **not** removed in 4.0+ and is documented in 5.2, and the
exporter's image options are PNG, JPEG or WebP with **no** `KHR_texture_basisu`
path, so KTX2 is a post-export step in W4 rather than an export flag. Chapters
03 and 07 carry the detail.

Nothing in R-06 remains outstanding.

## The single question Phase 1 answers

> Can PAON render a jacket that stands next to Suitsupply's without looking
> worse?

That is the gate (D-15). Drape legibility is the _second_ question and it is
not worth asking until the first is answered, because a comparison that looks
cheap will not be believed whatever it shows.

Concretely, Phase 1 succeeds when a PAON render placed beside a Suitsupply
render at 1200 × 1500 is not identifiably the weaker image on: soft-shadow
quality, lapel-roll fidelity, button and pocket edge detail, fabric surface,
and overall presentation. Chapter 06 holds the measured bar.

Only once that holds does the drape question follow: shown the same
construction under three cloth characters, can an observer describe how they
differ? If not, the lab has been cheaply falsified before breadth was built
(R-16).

## Scope

**In.** One family `sb-2`; one fixed assembly set (notch lapel, standard
collar, flap pockets, side vents, two-piece sleeve, half canvas, full lining);
three illustrative drape classes; three movement states; three lighting scenes;
tier 1 WebGL, tier 2 2D layer graph, tier 3 semantic; a public route with no
tenant data; an observer study.

**Out.** Every other family and assembly variant; fabric catalogue; price; lead
time; sizing; fit; measurement; cart; save; share; advisor handoff; persistence
of any kind; Studio integration; customer or retailer data; any change to the
legacy FT-07 route or `suit_configuration_intents`; any physical-accuracy
claim; KTX2 and Draco compression; WebGPU; orbit camera.

Compression and orbit are deliberately deferred. Both add device-support
surface and neither affects whether drape reads.

## Workstreams

Route classification per `AGENTS.md`: **C** is frontier judgment, **B** is
settled implementation, **A** is investigation or mechanical work.

### W1 — Dependency, pin and harness · Route C then B

Declare `three` at the exact current release in the workspace package that owns
the lab, with `@types/three` matching. Confirm r185 is still current at that
moment rather than inheriting this dossier's pin. Add `GLTFLoader` only — no
KTX2Loader, no DRACOLoader in Phase 1. Re-check the Blender LTS designation
against blender.org if it has become reachable, and record the pin plus the
retrieval method in the manifest.

_Acceptance._ `three` resolves from the workspace root; the lab route builds
and lazily loads the renderer chunk; the initial route JavaScript stays under
the chapter-05 budget of 180 KB gzip before that chunk; the version pin and its
provenance appear in the manifest.

### W2 — Family and assembly generator · Route C then B

Emit family `sb-2` first — panel layout, seam network with fixed ring arities,
UV atlas with per-assembly chart leases, material slot roster, anchor set — and
then each assembly against that seam contract, per chapter 09. Generation is
deterministic from a recorded seed.

_Acceptance._ Two independent runs from the same seed and generator version
produce byte-identical geometry. Every assembly declares the seams it consumes
and produces. A generator that cannot satisfy a declared ring arity fails
rather than adapting the family.

### W3 — Simulation and bake · Route C then B

Headless Blender 5.2 LTS under `--background --factory-startup --python`.
Simulate the assembled garment across three movement states for three drape
classes, with recorded collision, seam, timestep and convergence settings, then
bake selected frames per deforming assembly, keyed by
`(family, assembly variant, canvas, drape class, state)`. Canvas and shoulder
enter as stiffness and pin-weight fields, never as geometry. Rigid shared
assemblies are not baked; only their per-state anchor transform tables are.

Emit tier 2 in the same pass: render each baked assembly to a 2D layer under
the same `bake_key`, so the fallback cannot drift from the primary.

_Acceptance._ Nine tier-1 mesh bakes and their matching tier-2 layer sets, all
addressed by `bake_key`; deterministic regeneration; solver identity, solver
version and seed recorded per bake; every parameter carries units, provenance
and confidence, and every profile is labelled `illustrative`.

### W4 — Manifest and validation · Route B

Author `AssetGraphManifest v1` per chapter 09 and the CI gates that enforce it:
Khronos glTF Validator on every asset; seam ring arity and arc-length
correspondence between every attachable pair; grain-vector delta across each
seam under threshold; UV chart lease disjointness; material slot conformance;
anchor surface bindings valid in every state; tier-1/tier-2 `bake_key` parity;
rights record present on every entry; manifest hash signed as a whole.

_Acceptance._ Each gate fails a deliberately corrupted fixture and passes the
real asset set. A partial or unsigned manifest fails closed.

### W5 — The three delivery tiers · Route C then B

Tier 1: WebGL scene per chapter 05 — pinned colour management, one calibrated
camera family, per-assembly fetch, explicit `dispose()`, `webglcontextlost`
handling, idle sleep, no animation loop for a static state. Tier 2: the 2D
layer graph, same controls, same labels, same resolved selection. Tier 3:
semantic DOM/SVG that states the comparison in text.

_Acceptance._ Every chapter-06 criterion, including tier parity asserted by
test rather than inspection; keyboard radios with visible focus; a forced
context loss changes fidelity only, never the selection or the controls; no
external request for any garment, texture, HDRI or swatch asset.

### W6 — Observer study and evidence · Route C

The study is the deliverable, not a formality. Recruit observers who have not
seen the dossier. Show three cloth characters under a fixed construction. Ask
them to describe the difference in their own words before offering any
vocabulary. Score whether the intended distinction is recovered. Run tier 1 and
tier 2 as independent arms.

_Acceptance._ A pre-registered pass threshold, fixed **before** data is
collected; the tier-1 versus tier-2 comparison reported whichever way it falls;
and an explicit written finding on R-07, R-13 and R-16.

## Proposed layout

Paths are proposals for W1 to confirm against existing repository convention,
not established facts.

```text
apps/customer/app/lab/material-drape/     # public route, no tenant data
packages/domain/src/drape/                # graph, manifest and selection types
tools/drape-lab/generator/                # W2 family and assembly generators
tools/drape-lab/bake/                     # W3 headless Blender driver
tools/drape-lab/validate/                 # W4 CI gates
apps/customer/public/drape-lab/           # signed manifest and static assets
```

The route sits outside `r/[slug]` deliberately: the lab reads no tenant data,
so it must not inherit a retailer scope it does not need.

## Sequencing

W1 → W2 → W3 → W4 in order; W5 begins once W3 has produced one bake pair; W6
runs last and gates everything after it.

Do W2 and W3 at the smallest possible scale first: **one family and exactly two
interchangeable assemblies**, and prove in CI that seam arity, arc-length
correspondence and grain continuity hold and the join is invisible. That is
R-14, and it decides whether the modular decision in D-08 survives. Do not
author breadth before it passes.

## Exit criteria

Phase 1 is complete when all hold:

1. Deterministic regeneration is demonstrated from a recorded seed.
2. The R-14 seam and grain prototype passes with an invisible join.
3. All three tiers render all 27 tuples and tier parity passes.
4. The chapter-05 performance budgets hold on a low-memory mobile device — a
   physical one, not emulation.
5. The manifest is signed, complete and rights-clean.
6. The observer study has reported against its pre-registered threshold.
7. Every profile still reads `illustrative` in the interface.

Failing 2, 4 or 6 stops expansion. Failing 6 specifically retires either the
renderer or the lab, per chapters 05, 07 and 09 — and that is a successful
outcome for a phase whose purpose is to find out.

## Risk burn-down

| Risk | Addressed by       | Closed when                                                   |
| ---- | ------------------ | ------------------------------------------------------------- |
| R-06 | D-13, W1           | blender.org reachable and the LTS designation read directly   |
| R-07 | W6                 | The observer study reports tier 1 versus tier 2               |
| R-08 | W1                 | `three` is declared and pinned in a workspace package         |
| R-13 | D-12, W5, W6       | Both tiers ship from one graph and the study reports          |
| R-14 | W2, W4, sequencing | The two-assembly prototype passes seam and grain gates        |
| R-15 | W2                 | Material-dependent assemblies counted in the generated family |
| R-16 | W6                 | The study shows the drape classes are distinguishable         |
| R-02 | Not addressed      | **Remains blocked.** Phase 1 acquires no calibration evidence |
| R-09 | Not addressed      | **Remains gated.** Phase 1 drives no competitor interaction   |
