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

`BLOCKED` pending verification: SMPL-X and MakeHuman licences could not be
retrieved (DNS failure and connection reset respectively). Both must be read
before either is adopted. Do not assume SMPL-X inherits different terms from
SMPL; read it.

Options to evaluate, none yet verified:

1. A CC0 or otherwise freely-commercial male torso/dress-form mesh.
2. MakeHuman, if its licence permits commercial output — its historical
   position was that generated meshes are unencumbered, but that must be read,
   not assumed.
3. A PAON-generated parametric torso, which fits the "original or rights-cleared
   assets" rule in chapter 00 and removes the dependency entirely. A dress form
   is a simpler shape than a human body, and a ghost-mannequin render never
   shows a head, hands or feet.

Option 3 is the most likely answer precisely because the requirement is a
tailor's dress form, not an anatomically correct human.

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

| Stage            | Tool                            | Licence | Status                                    |
| ---------------- | ------------------------------- | ------- | ----------------------------------------- |
| Panel generation | **PAON-owned code**             | ours    | To be written; chapter 09 is the contract |
| Body form        | **Unresolved**                  | —       | `BLOCKED`; SMPL excluded, options above   |
| Sewing + drape   | Blender 5.2 LTS cloth           | GPL     | Manual retrieved directly (chapter 07)    |
| Render           | Blender Cycles, path traced     | GPL     | Chapter 07 render stage                   |
| Delivery         | AVIF layers, browser composited | —       | Chapter 12 T-rows                         |

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

1. Read the SMPL-X and MakeHuman licences properly, via the Chrome-over-CDP
   method rather than plain fetch.
2. Decide the body form. Prefer a PAON-generated dress form; it removes a
   licensing dependency permanently and suits a ghost-mannequin render.
3. Re-check GarmentCode's actual API surface before writing panel generation
   from scratch, in case its representation is reusable under MIT.
4. Retrieve the Blender cloth Python API pages the same way the manual was
   retrieved, so P1.2 has concrete entry points rather than inferred ones.
