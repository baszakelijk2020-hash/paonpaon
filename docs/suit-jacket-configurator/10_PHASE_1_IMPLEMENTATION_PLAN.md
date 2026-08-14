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
- **Lab Phase 1** — this chapter. Prove that cloth character reads.
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
| Rendering medium (R-13)            | Unsettled; 3D unjustified by benchmark | **Settled by decision D-12**: 3D primary, 2D layer graph as tier 2. Settled by authorization, not evidence                                                                                        |
| Blender version (R-06)             | "5.2 LTS", unverified and wrong        | **Repinned to 4.5 LTS** on mirror evidence; see below                                                                                                                                             |
| Three.js adoption (R-08)           | Not declared anywhere in the workspace | Scheduled as W1; still absent as of `71697c2`                                                                                                                                                     |
| Asset contract                     | Absent                                 | Chapter 09, normative                                                                                                                                                                             |
| Physical-accuracy claims (R-02)    | Blocked                                | **Still blocked.** Authorization moves the build, not the claim                                                                                                                                   |
| Competitor behaviour (R-09)        | `GATED`                                | **Still gated.** The direct Armani configurator URL was reached and returned an application error state; no interaction was driven and nothing new is claimed about behaviour or rendering medium |
| Calibration evidence               | Absent                                 | **Still absent.** Every profile remains `illustrative`                                                                                                                                            |

Two of these deserve emphasis, because releasing a gate tends to blur them. The
physical-accuracy block and the competitor-observation gap are **unchanged**.
Phase 1 builds a comparison surface; it does not acquire a single new fact
about how any real cloth behaves.

## R-06 resolved: Blender 4.5 LTS

`OBSERVED-DOC`, 2026-08-15. `blender.org`, `docs.blender.org`,
`download.blender.org` and `projects.blender.org` all return HTTP 403 or a
Cloudflare interstitial to plain `curl`, to WebFetch, and to headless Chromium
with a persistent profile — the challenge is solved but the origin never
responds. Two independent official release mirrors are reachable and were used
instead:

- `https://ftp.nluug.nl/pub/graphics/blender/release/`
- `https://mirror.clarkson.edu/blender/release/`

Both list series `Blender3.4` through `Blender5.2`. Dated patch cadence, with
the two mirrors agreeing on every date checked:

| Series | First release | Latest patch | Latest patch date | Maintenance span        |
| ------ | ------------- | ------------ | ----------------- | ----------------------- |
| 4.2    | 2024-07-16    | `4.2.23`     | 2026-07-21        | **2 years, still live** |
| 4.5    | 2025-07-15    | `4.5.12`     | 2026-07-21        | **1 year, still live**  |
| 5.0    | 2025-11-18    | `5.0.1`      | 2025-12-16        | 4 weeks, then abandoned |
| 5.1    | 2026-03-17    | `5.1.2`      | 2026-05-19        | 9 weeks, then abandoned |
| 5.2    | 2026-07-14    | `5.2.0`      | 2026-07-14        | none yet                |

`INFERRED`, and labelled as such, but the signal is strong: 4.2 and 4.5 both
received a patch **on the same day, 2026-07-21**, two years and one year after
their respective releases, while 5.0 and 5.1 stopped within weeks of being
superseded. Two long-lived series maintained in parallel alongside a
fast-moving 5.x line is the signature of an LTS programme, and it matches
Blender's published convention of designating the final release of a series as
LTS (2.83, 2.93, 3.3, 3.6, 4.2, 4.5).

**The latest verifiable LTS is 4.5**, released 2025-07-15 and still maintained
as of 2026-07-21. 5.2 is the latest stable release and is **not** LTS. The
dossier's previous "Blender 5.2 LTS" was a `SECONDARY` claim and it was wrong.

One conflicting source, recorded rather than hidden: Homebrew's `blender@lts`
cask is pinned to `5.2.0`. Its own comment disclaims the pin — it states that
the upstream LTS page cannot be fetched due to Cloudflare protections and that
LTS status cannot be determined from a version number. A pin its maintainers
say they cannot verify does not outweigh two years of dated maintenance
evidence, so this dossier follows the cadence.

Searching both mirrors for the literal string "LTS" returns nothing: the
release trees carry dated artifacts and two GPL licence files, no designation
metadata. The inference above is therefore the best available evidence, not a
substitute for the unreachable official page.

**Decision D-13: pin Blender 4.5 LTS.** It satisfies the founder's instruction
to target the latest LTS that can be verified, and it is the conservative
choice regardless — an LTS series is what an unattended pipeline should sit on.

Residual honesty: the LTS _designation_ is inferred from cadence, not read off
blender.org. The exact end-of-support date is `BLOCKED`. W1 re-checks this the
moment blender.org is reachable, and the pin is recorded in the manifest so a
correction is a one-line change rather than an archaeology exercise.

Per the founder's instruction, glTF export behaviour is taken as **standard
Blender glTF 2.0 exporter capability** rather than a version-specific claim.
Chapter 03's constraints come from the Khronos specification, which was
retrieved directly and does not depend on Blender at all. That is the load-
bearing half, and it is verified.

## The single question Phase 1 answers

> Shown the same jacket construction under three cloth characters, can an
> observer correctly describe how the cloths differ — and does 3D do that
> better than pre-composited 2D?

Everything below exists to answer that and nothing else. If the answer is no,
Phase 1 has succeeded: it has cheaply falsified the lab before breadth was
built. If 3D and 2D score the same, tier 2 becomes primary and the renderer is
retired (R-07, R-13, R-16).

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

Headless Blender 4.5 LTS under `--background --factory-startup --python`.
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
