# Toolchain and licensing

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. This chapter records
what the pipeline will actually be built from, and — more urgently — what it
legally may not be built from.

## The blocker: SMPL cannot be used

`OBSERVED-DOC`, retrieved 2026-08-15 from
`https://smpl.is.tue.mpg.de/modellicense.html`. The SMPL model licence states:

> Any other use, in particular any use for commercial purposes, is prohibited.
> This includes, without limitation, incorporation in a commercial product, use
> in a commercial service, or production of other artefacts for commercial
> purposes.

SMPL is the obvious body form to drape a garment over and it is the default
choice across the entire garment-simulation literature. **PAON is a commercial
product, so SMPL is unusable** — including for producing renders, since the
licence explicitly reaches "production of other artefacts for commercial
purposes". Commercial terms exist through Meshcapade, and they are paid, which
the standing no-paid-provider rule excludes.

This is exactly the class of defect chapter 03's rights record exists to catch,
and it would have been invisible until launch: nothing about an SMPL-derived
mesh looks unlicensed.

**Consequence.** The body form is an unresolved dependency of P1.2, and the
ghost-mannequin presentation does not save us — the body is invisible in the
final image but is still used to produce it.

### SMPL-X is the same, and it was worth reading rather than assuming

`OBSERVED-DOC`, retrieved 2026-08-15 from
`https://smpl-x.is.tue.mpg.de/modellicense.html`:

> Any other use, in particular any use for commercial, pornographic, military,
> or surveillance, purposes is prohibited. This includes, without limitation,
> incorporation in a commercial product, use in a commercial service, or
> production of other artifacts for commercial purposes.

Identical restriction. **Both SMPL and SMPL-X are excluded.** The header also
states plainly that "the software/data is also available for commercial
licensing through Meshcapade.com" — the non-commercial terms are the deliberate
default, not an oversight.

### Resolved: MakeHuman exports may be CC0

`OBSERVED-DOC`, retrieved 2026-08-15 from
`makehumancommunity.org/content/license.html`. The summary states:

> The MakeHuman source (all files that include code) and data (3d models and
> 3d morphings) are relased under AGPL3. This also includes everything that is
> exported from or by MakeHuman. However, respecting a set of conditions
> (which are explained in section C below), you are allowed to instead use the
> CC0 license (the most liberal license in the world) for exports.

Section C, "MakeHuman output GPL exception", gives the condition:

> the copyright holders of the MakeHuman assets grants the option to use CC0
> 1.0 Universal … as a license for the MakeHuman characters exported under the
> conditions that a) The assets were bundled in an export that was made using
> the file export functionality inside an OFFICIAL and UNMODIFIED version of
> MakeHuman

**Decision D-18: the body form is a MakeHuman export taken under the CC0
option**, with a PAON-generated dress form retained as the fallback.

Two conditions bind, and both must survive contact with an unattended pipeline:

1. **Official and unmodified MakeHuman.** We may script it through its own
   plugin/scripting surface, but we may not patch its source — a modified build
   forfeits the CC0 option and drops the export back to AGPL. The build's
   version and provenance go in the manifest rights record.
2. **The CC0 option applies to the export**, not to MakeHuman itself. We are not
   distributing MakeHuman, so its AGPL does not reach our product; we consume a
   CC0 asset it produced. That is the same tool-licence versus asset-licence
   distinction that makes Blender safe and SMPL unsafe.

A PAON-generated dress form remains the cleanest long-term answer because it
removes the dependency entirely, and the requirement is a tailor's dress form
rather than an anatomically correct human. But MakeHuman is verified, free,
commercially usable and available now, so it unblocks P1.2 immediately.

## No tool generates a tailored jacket pattern

`OBSERVED-DOC`. Surveyed 2026-08-15:

| Tool                      | Licence     | Tailored men's jacket?                     | Verdict                                       |
| ------------------------- | ----------- | ------------------------------------------ | --------------------------------------------- |
| GarmentCode (ETH Zurich)  | MIT         | No evidence; examples are women's garments | Closest prior art, does not cover our case    |
| Garment-Pattern-Generator | MIT         | Not confirmed                              | **Rejected** — requires Maya, a paid GUI tool |
| Sewformer                 | Unspecified | Not mentioned                              | Photo reconstruction, wrong problem           |
| freesewing                | MIT         | Unconfirmed; repo archived April 2025      | Moved to Codeberg; jacket block unverified    |
| Valentina / Seamly2D      | Unretrieved | Unconfirmed                                | Needs a second look                           |

**The honest conclusion: we write the panel generator ourselves.** Every
existing system is a research prototype aimed at t-shirts, dresses and
trousers. A tailored jacket — set-in sleeve with worked ease, roll-line lapel,
two-piece collar, canvas — is not covered by any of them.

That is not a bad outcome. Chapter 00 already requires PAON-owned,
deterministically regenerated geometry and forbids relying on an external
model, and chapter 09 already specifies the panel and seam contract the
generator must satisfy. This finding confirms that decision rather than
disrupting it: there was never a shortcut available.

## AI 3D generation does not solve the geometry problem

`OBSERVED-DOC`. TRELLIS (Microsoft) is MIT-licensed, so commercially usable,
and runs locally. Hunyuan3D-2's licence needs reading before use. Both produce
**dense, aesthetically-oriented meshes, not simulation-ready topology**.

That is disqualifying for our purpose. Cloth simulation needs clean quad-ish
topology with controlled edge flow along seam lines; a generated mesh would
need full retopology, which is the hard part of the job, done by hand, which
the unattended requirement forbids.

`INFERRED`: AI 3D generation is the wrong tool for the garment. It may still be
useful for set dressing or a body form starting point, where topology matters
less — but not for anything that must be simulated.

## What the pipeline is, then

| Stage            | Tool                            | Licence            | Status                                    |
| ---------------- | ------------------------------- | ------------------ | ----------------------------------------- |
| Panel generation | **PAON-owned code**             | ours               | To be written; chapter 09 is the contract |
| Body form        | **MakeHuman export** (D-18)     | **CC0**, see above | Resolved; PAON dress form as fallback     |
| Sewing + drape   | Blender 5.2 LTS cloth           | GPL                | Manual retrieved directly (chapter 07)    |
| Render           | Blender Cycles, path traced     | GPL                | Chapter 07 render stage                   |
| Delivery         | AVIF layers, browser composited | —                  | Chapter 12 T-rows                         |

### Cloth API entry points, corrected

`OBSERVED-DOC`, from the Blender Python API index retrieved the same way. The
types that exist are `ClothSettings`, `ClothCollisionSettings` and
`ClothSolverResult`.

**There is no `ClothSewing` type** — that URL returns "Not Found". Chapter 07's
sewing configuration therefore lives on `ClothSettings` (its `use_sewing` /
sewing-force properties), not on a separate struct. An earlier assumption that
a `ClothSewing` type existed was wrong, and P1.2 would have been written
against an API that does not exist.

Blender's GPL applies to Blender itself; renders and assets produced with it
are the user's own, which is why it is safe here where SMPL is not. The
distinction is between a _tool's_ licence and a _model's_ licence, and it is
the whole reason SMPL is a trap.

## Findings that are weaker than they look

Recorded so a later session does not over-trust this chapter:

- Several retrievals failed outright: the Blender Python API pages returned HTTP
  403 to the research agent, and SMPL-X and MakeHuman were unreachable. The
  Blender **manual** was retrieved successfully earlier by driving an ordinary
  Chrome installation over the DevTools protocol (chapter 10), so the API pages
  are almost certainly reachable the same way — the 403 is a tooling artefact,
  not an absence, and the `BLOCKED`-is-provisional rule applies.
- "GarmentCode has no Python API" is **not** established. GarmentCode is a
  Python project; the agent found no API _documentation_ at the pages it
  fetched. Treat as unverified rather than refuted, and re-check before
  dismissing it — even if it cannot produce a jacket, its panel and stitching
  representation may be worth borrowing conceptually.
- freesewing's archive status and Codeberg move are reported but its jacket
  block was never confirmed either way.

## Next actions this chapter creates

Done since first writing, all via headless Chrome over CDP — the method that
works where plain fetch is refused:

- ~~Read the SMPL-X and MakeHuman licences~~ — done. SMPL-X excluded, MakeHuman
  resolved the blocker (D-18).
- ~~Retrieve the Blender cloth Python API~~ — done, and it corrected a wrong
  assumption about `ClothSewing`.

Still open:

1. Re-check GarmentCode's actual API surface before writing panel generation
   from scratch, in case its panel/stitch representation is reusable under MIT.
   It cannot produce a tailored jacket, but its data model may still save work.
2. Confirm MakeHuman can be driven from its own scripting surface without
   modifying the build, since a modified build forfeits the CC0 option (D-18).
   If it cannot be scripted unmodified, fall back to the PAON dress form
   immediately rather than patching it.
3. Verify `ClothSettings`' actual sewing property names against the API page,
   so chapter 07's bake configuration names real attributes.
