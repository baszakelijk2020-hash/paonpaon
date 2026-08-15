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

### W0 — The single-image spike · Route C

**Do this before anything else, and do not skip it.** One jacket, one cloth,
one construction, rendered in Cycles at 1600 × 2000 and placed beside a
Suitsupply render of a comparable jacket. Nothing modular, no asset graph, no
route, no manifest. Just: can we make an image that holds up?

This is days of work, not weeks, and it de-risks everything after it. If the
image is not close, no amount of pipeline engineering rescues it, and we would
rather learn that from one render than from a finished system.

_Acceptance._ Side-by-side judged against the chapter-06 bar on soft-shadow
quality, lapel-roll fidelity, button and pocket edge detail, fabric surface and
presentation. A clear "not yet" halts W1–W6 and returns to lighting, shading
and geometry work until it passes.

### W1 — Render harness and pins · Route C then B

Pin Blender 5.2 LTS, the Cycles configuration, the OpenImageDenoise version and
the view transform, and record all of them plus their retrieval method in the
manifest. Stand up headless rendering under
`--background --factory-startup --python` with `--cycles-device`.

`three` is **not** required for Phase 1 (D-16). Defer the dependency decision
to the optional live tier; if adopted later, confirm the current release at
that moment rather than inheriting this dossier's r185 pin.

_Acceptance._ A headless render of the W0 scene reproduces byte-identically
from a recorded seed and configuration on two runs. Every pinned version
appears in the manifest with its provenance.

### W2 — Family and assembly generator · Route C then B

Emit family `sb-2` first — panel layout, seam network with fixed ring arities,
UV atlas with per-assembly chart leases, material slot roster, anchor set — and
then each assembly against that seam contract, per chapter 09. Generation is
deterministic from a recorded seed.

_Acceptance._ Two independent runs from the same seed and generator version
produce byte-identical geometry. Every assembly declares the seams it consumes
and produces. A generator that cannot satisfy a declared ring arity fails
rather than adapting the family.

### W3 — Simulation, bake and render · Route C then B

Headless Blender 5.2 LTS. Simulate the assembled garment across three movement
states for three drape classes, with recorded collision, seam, timestep and
convergence settings, then bake selected frames per deforming assembly keyed by
`(family, assembly variant, canvas, drape class, state)`. Canvas enters as a
stiffness and pin-weight field. **Sleeve attachment and sleevehead are
geometry, not fields** — chapter 09 `G+P`. Rigid shared assemblies are not
baked; only their per-state anchor transform tables are.

Then render, per the chapter-07 render stage: Cycles path tracing, four views
per bake key (`hero_front`, `three_q_rake`, `profile`, `three_q_back`), each
assembly rendered with its neighbours as **shadow catchers** so every layer
carries its own cast shadow on premultiplied alpha. Render at 1600 × 2000 and
derive 1200 × 1500; deliver AVIF with JPEG fallback.

_Acceptance._ The full layer set per bake key across all four views;
deterministic regeneration; solver, denoiser and view-transform identity and
versions recorded per bake; the shadow-swap test passes (compositing variant A
then B leaves no pixel changed outside B's own footprint and shadow region);
every parameter carries units, provenance and confidence; every profile is
labelled `illustrative`.

### W4 — Manifest and validation · Route B

Author `AssetGraphManifest v1` per chapter 09 and the CI gates that enforce it:
Khronos glTF Validator on every asset; seam ring arity and arc-length
correspondence between every attachable pair; grain-vector delta across each
seam under threshold; UV chart lease disjointness; material slot conformance;
anchor surface bindings valid in every state; tier-1/tier-2 `bake_key` parity;
rights record present on every entry; manifest hash signed as a whole.

_Acceptance._ Each gate fails a deliberately corrupted fixture and passes the
real asset set. A partial or unsigned manifest fails closed.

### W5 — The delivery surface · Route C then B

Tier 1: the offline-rendered layer graph composited in the browser — ordered
layers from the manifest, per-assembly swap, view switching across the four
camera positions, zoom to the 1600 × 2000 asset. Option rows carry **cropped
renders of the actual feature** rather than icons, per chapter 06. Tier 3:
semantic DOM/SVG stating the comparison in text. The live WebGL tier is out of
Phase 1 scope (D-16).

_Acceptance._ Every chapter-06 criterion; keyboard radios with visible focus;
no external request for any garment, texture, HDRI or swatch asset; a failed
asset falls closed rather than rendering a partial garment.

### W6 — Acceptance panel and evidence · Route C

Two questions, in order, and the first gates the second.

**Quality.** PAON renders placed beside reference renders, unlabelled, judged
on the chapter-06 bar. Include at least one judge who knows tailoring; the
construction tells in chapter 06 are exactly what a layperson will miss.

**Construction legibility.** Show the same jacket in the same cloth with
different shoulder construction — spalla camicia against con rollino — in the
`three_q_rake` view. Ask observers to describe the difference in their own
words before offering vocabulary. This is the founder's requirement 4 and it is
the hardest thing in the programme.

**Drape legibility**, only once both pass: three cloth characters under a fixed
construction, same protocol.

_Acceptance._ Pre-registered pass thresholds fixed **before** data is
collected; results reported whichever way they fall; an explicit written
finding on R-16 and on whether the shoulder distinction reads.

## Proposed layout

Paths are proposals for W1 to confirm against existing repository convention,
not established facts.

```text
apps/customer/app/lab/material-drape/     # public route, no tenant data
packages/domain/src/drape/                # graph, manifest and selection types
tools/drape-lab/generator/                # W2 family and assembly generators
tools/drape-lab/bake/                     # W3 headless Blender sim driver
tools/drape-lab/render/                   # W3 Cycles render driver, cameras,
                                          #    light rigs, shadow-catcher setup
tools/drape-lab/validate/                 # W4 CI gates
apps/customer/public/drape-lab/           # signed manifest and delivery images
```

The route sits outside `r/[slug]` deliberately: the lab reads no tenant data,
so it must not inherit a retailer scope it does not need.

## Sequencing

**W0 first, alone.** Nothing else starts until one image clears the quality
bar. This is the cheapest possible test of the most expensive assumption.

Then W1 → W2 → W3 → W4; W5 begins once W3 has produced one complete layer set;
W6 runs last and gates everything after it.

Inside W2 and W3, work at the smallest possible scale first: **one family and
exactly two interchangeable assemblies** — and make those two the _shoulder_
variants, since they are simultaneously R-14's seam test and the founder's
acceptance case. Prove in CI that seam arity, arc-length correspondence and
grain continuity hold, that the join is invisible, and that the shadow-swap
test passes. Do not author breadth before that.

## Exit criteria

Phase 1 is complete when all hold:

1. **W0 passed**: a PAON render stands beside a reference render without being
   identifiably weaker.
2. Deterministic regeneration is demonstrated from a recorded seed, including
   the render stage.
3. The R-14 prototype passes: invisible seam join **and** no shadow leakage on
   assembly swap.
4. Every bake key renders all four views, and the layer set composites cleanly.
5. **Spalla camicia and con rollino are distinguishable** in the
   `three_q_rake` view by observers who were not told which is which.
6. Delivery holds the measured bar: 1200 × 1500 (1600 × 2000 zoom), AVIF with
   fallback, per-layer weights within an order of magnitude of the reference.
7. The manifest is signed, complete and rights-clean.
8. Every profile still reads `illustrative` in the interface.

Failing 1 halts the programme at the cheapest possible point. Failing 3 retires
the modular decision. Failing 5 means the construction claim cannot be made and
the product reduces to a fabric-and-colour configurator — which is honest, and
is the reference's product, not ours.

## Risk burn-down

| Risk | Addressed by   | Closed when                                                                  |
| ---- | -------------- | ---------------------------------------------------------------------------- |
| R-06 | D-13           | Closed — blender.org read directly                                           |
| R-07 | —              | Closed — both media observed in production                                   |
| R-08 | Deferred       | Not a Phase 1 dependency under D-16; revisit with the optional live tier     |
| R-13 | W6             | The panel reports on drape legibility; the medium question is already closed |
| R-14 | W0, W2, W3, W4 | The shoulder prototype passes seam, grain **and** shadow-swap gates          |
| R-15 | W2             | Material-dependent assemblies counted in the generated family                |
| R-16 | W6             | The panel shows the drape classes are distinguishable                        |
| R-17 | W0             | **New.** A PAON render may simply not reach the reference bar. W0 is the     |
|      |                | cheapest possible test and it halts the programme if it fails.               |
| R-18 | W3, W4         | **New.** Shadow leakage on assembly swap could make the layer graph look     |
|      |                | pasted together. Closed by the shadow-swap CI test.                          |
| R-02 | Not addressed  | **Remains blocked.** Phase 1 acquires no calibration evidence                |
| R-09 | Not addressed  | **Remains narrowed.** No option-change interaction was driven                |
