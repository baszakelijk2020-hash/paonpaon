# Jacket pattern and the geometry source

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`. Chapter 13
established that no existing tool generates a tailored jacket pattern, so PAON
writes the generator. This chapter is what it must generate, and — the part
that decides whether we may ship it — where the geometry may legitimately come
from.

## The licensing verdict, first

`OBSERVED-DOC`, 2026-08-15. Drafting systems split cleanly:

| System                                         | Status                             | Usable as a geometry source? |
| ---------------------------------------------- | ---------------------------------- | ---------------------------- |
| Rundschau                                      | **In copyright**, active publisher | No                           |
| Müller & Sohn (System M)                       | **In copyright**, proprietary      | No                           |
| W.D.F. Vincent, _The Cutter's Practical Guide_ | **Public domain** (1890s–1900s)    | **Yes** — Internet Archive   |
| _The Tailor and Cutter_, selected volumes      | **Public domain** (1890s)          | **Yes** — Internet Archive   |
| _The Progressive Tailor_ Vol. 20 (1930)        | **Public domain**                  | **Yes** — Internet Archive   |
| Cabrera, _Classic Tailoring Techniques_ (1984) | In copyright                       | No                           |

**Decision D-17: derive geometry only from public-domain drafts**, principally
Vincent, cross-checked against _The Progressive Tailor_ for a more modern
silhouette. Rundschau and Müller & Sohn are consulted for **facts** only.

That distinction is deliberate and it is the whole legal position. A
measurement is a fact and facts are not copyrightable — recording that tailored
sleevehead ease runs 8–10% is reporting a fact, and citing where it was
published. A drafting system's _expression_ — its specific construction
sequence, its diagrams, its proportional formulae as authored — is protected.
So: numbers may be cited from anywhere reputable; **geometry may be derived
only from the public-domain drafts**, and never traced from a copyrighted one.

The generator must record, per panel, which public-domain source its
construction derives from. That is a rights record in exactly the sense chapter
03 requires, applied to geometry rather than to textures.

## The panel set

`OBSERVED-DOC`. For a single-breasted two-button jacket:

| Panel                | Notes                                      |
| -------------------- | ------------------------------------------ |
| Forepart ×2          | Centre front to armhole, neck to hem       |
| Side body ×2         | Waist shaping; bridges forepart to back    |
| Back                 | Shoulder to shoulder, neck to hem          |
| Upper sleeve ×2      | Carries the cap                            |
| Under sleeve ×2      | Two-piece sleeve                           |
| Under-collar         | Sewn to the neckline                       |
| Top-collar           | The visible collar                         |
| Lapel facing         | Turned facing continuous with the forepart |
| Pocket welts, flaps  | Applied to the forepart                    |
| Canvas / chest piece | Horsehair-and-wool, ~3–4 mm, internal      |
| Haircloth            | Optional additional chest reinforcement    |
| Lining               | Covers all internal layers                 |

This maps directly onto chapter 09's assemblies, which is a good sign that the
asset contract was drawn from the right abstraction: `front`, `sleeve`,
`back_vents`, `collar`, `lapel`, `pockets`, `lining` each correspond to real
pattern pieces rather than to invented render groupings.

## The seam network — the seam contract

`OBSERVED-DOC`. This is the concrete content of chapter 09's `seam.*` ids:

| Seam                | Joins                                            | Note                                               |
| ------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `seam.shoulder`     | Forepart → Back                                  | Sits ~1.25–1.5 in behind the shoulder point        |
| `seam.side`         | Forepart → Back, via side body                   | Armpit to hem, with waist shaping                  |
| `seam.armscye`      | Upper + under sleeve → forepart, back, side body | Where the ease is worked — the acceptance case     |
| `seam.neckline`     | Under-collar → back neckline                     |                                                    |
| `seam.gorge`        | Under-collar → lapel → forepart                  | ~45°–60° from horizontal; defines the notch        |
| `seam.collar_edge`  | Top-collar → under-collar                        | Three sides; needs turn-of-cloth allowance         |
| `seam.lapel_edge`   | Lapel facing → forepart                          | Gorge down to the break point                      |
| Lapel **roll line** | — **not a seam**                                 | A fold, pad-stitched. Must be modelled as a crease |

The roll line is worth flagging: it is the single most visually important line
on the jacket (chapter 06) and it is **not a seam**, so it cannot be expressed
as a sewing-spring join. It is a shaped fold, which in simulation terms means a
bend-stiffness feature along a curve, not a stitch.

## Sleevehead ease — the numbers we have

`OBSERVED-DOC`, and this is the hardest requirement in the programme:

| Quantity                    | Sourced value                                                    | Source                       |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| Total ease, tailored jacket | **4–6 cm**                                                       | The London Pattern Cutter    |
| Total ease, as a proportion | **8–10%** (5–8% industrial)                                      | Müller & Sohn, cited as fact |
| Sleevehead : armscye ratio  | **×1.08–1.10**                                                   | Follows from the above       |
| Sleevehead depth            | ≈ **1/3 of the armscye measurement**                             | Müller & Sohn                |
| Distribution                | Mostly at the cap; some to back armhole, some to mid-front chest | The London Pattern Cutter    |

Two figures agree from independent directions — 4–6 cm on a typical men's
armscye is roughly 8–10% — which is mild corroboration rather than one source
repeated.

**`BLOCKED`: the quadrant distribution.** No public source gives percentages
per armhole quadrant. It is encoded in proprietary drafts. Since ease
distribution is precisely what separates a spalla camicia's grinze from a
smooth set-in sleeve, this is the gap that most directly threatens the
acceptance test.

The honest path is to treat distribution as a **calibration parameter of our
own**, tuned until the render reads correctly against tailoring photographs,
and labelled as PAON's own choice rather than as a sourced tailoring standard.
That keeps the standing rule: where evidence is missing, we do not invent a
citation, we mark the parameter as ours.

## Canvas extent

`OBSERVED-DOC`. Chapter 09 models canvas as a stiffness field, so its extent is
the field's boundary:

- **Full canvas** — shoulder to hem, and through the lapel.
- **Half canvas** — shoulder to roughly the waist/pocket line, including the
  lapel, then fused interlining below. Reported as ~2/3 canvassed in practice
  despite the name.

`BLOCKED`: no public source gives the boundary as a coordinate or a proportion
of jacket length. Like ease distribution, this becomes a PAON parameter,
initialised at the pocket line and tuned.

## What could not be sourced, and what we do about it

Recorded plainly, because each is a place where a plausible-sounding invention
would corrupt the simulation silently:

| Gap                           | Consequence                       | Our response                                    |
| ----------------------------- | --------------------------------- | ----------------------------------------------- |
| Ease distribution by quadrant | Drives grinze vs smooth cap       | PAON parameter, tuned against photographs       |
| Canvas boundary coordinates   | Drives the stiffness field        | PAON parameter, initialised at the pocket line  |
| Gorge line angle formula      | Set by style and eye historically | PAON parameter within the sourced 45°–60° range |
| Lapel roll curve equation     | Empirical in blocking             | PAON parameter; the render is the judge         |
| Side body shape and placement | Varies by system                  | Take Vincent's, since we derive from it         |

Every one of these is a **design parameter we own and must label as ours**, not
a tailoring standard we can cite. Chapter 04's rule — that missing evidence
blocks the claim rather than becoming an invention — applies to geometry
exactly as it applies to cloth physics.

## Sources

| Source                                       | Date accessed | URL                                                                                          | Status / limitation                         |
| -------------------------------------------- | ------------: | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| The London Pattern Cutter — sleeve head ease |    2026-08-15 | https://thelondonpatterncutter.co.uk/sleeve-head-ease/                                       | Practitioner source; gives 4–6 cm           |
| Müller & Sohn — slimline suit                |    2026-08-15 | https://www.muellerundsohn.com/en/pattern-construction/slimline-suit/                        | **In copyright** — cited for facts only     |
| Müller & Sohn — taking measurements          |    2026-08-15 | https://www.muellerundsohn.com/en/allgemein/taking-measurements/                             | **In copyright** — cited for facts only     |
| W.D.F. Vincent, The Cutter's Practical Guide |    2026-08-15 | https://archive.org/details/vincentmakingshirts18xx                                          | **Public domain** — primary geometry source |
| The Progressive Tailor Vol. 20 (1930)        |    2026-08-15 | https://archive.org/details/theprogressivetailorvol.20springandsummer1930no.1                | **Public domain** — modern-silhouette check |
| Proper Cloth — jacket construction           |    2026-08-15 | https://propercloth.com/reference/jacket-construction-and-the-options-we-offer/              | Canvas extent; retailer editorial           |
| Woolrich Bespoke Tailor — canvassing types   |    2026-08-15 | https://woolrichbespoketailor.com/the-3-types-of-suit-canvassing/                            | Canvas extent; practitioner editorial       |
| Pattern Scissors Cloth — collar and lapels   |    2026-08-15 | https://patternscissorscloth.com/2011/04/24/rtw-tailoring-sewalong-11-the-collar-and-lapels/ | Seam network                                |
