# Phase 1 — the Suitsupply parity roadmap

Founder direction, 2026-08-15: **drop the Tailoor route.** No live 3D model in
Phase 1. Phase 1 is Suitsupply parity, 1:1, and parity is a milestone rather
than the ambition — everything sophisticated comes after it.

This chapter is the roadmap. Chapter 06 holds the measured bar, chapter 09 the
asset contract, chapter 07 the render stage. This says what to build, in order,
and how each step is judged done.

## What 1:1 means

Parity is judged on three surfaces, each measurable. A milestone is not done
because it looks finished; it is done when its row passes.

Everything in the parity checklist below was measured or observed live on
2026-08-15 (`OBSERVED-DOM`, chapters 01 and 06). None of it is aspirational.

### Visual parity

| #   | Requirement                                                        | Judged by                          |
| --- | ------------------------------------------------------------------ | ---------------------------------- |
| V1  | Ghost mannequin — jacket only, no body, no head                    | Inspection                         |
| V2  | Flat neutral-grey ground, soft even studio light                   | Inspection                         |
| V3  | 1200 × 1500 delivery, 1600 × 2000 zoom, 4:5 portrait               | Asset dimensions                   |
| V4  | AVIF primary with JPEG/PNG negotiation                             | Response content-type              |
| V5  | Per-assembly transparent layers, a few KB each                     | Per-file byte size                 |
| V6  | Ray-traced (Cycles). Never rasterized                              | Pipeline config, recorded per bake |
| V7  | Lapel roll curves and catches light, with shading beneath its edge | Panel review against reference     |
| V8  | Buttons modelled — four holes, horn material character             | Panel review                       |
| V9  | Welt chest pocket and flap hip pockets read clearly                | Panel review                       |
| V10 | Lining visible in the front opening                                | Panel review                       |
| V11 | Three discrete rotation frames                                     | Asset set                          |
| V12 | Unmistakably better than the rejected set (ch. 06 floor)           | Panel review, both ends            |

### Functional parity

| #   | Requirement                                                                              | Source                                        |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------- |
| F1  | Garment tabs across the top, with a Finish action                                        | `Fabric/Jacket/Trousers/Waistcoat` + `Finish` |
| F2  | Running total and lead-time estimate shown over the preview                              | `Total $923`, `2-3 weeks delivery`            |
| F3  | A named style preset with an edit affordance                                             | `Your Style: Milano`                          |
| F4  | Option rows: thumbnail + label + current value + chevron                                 | Observed row structure                        |
| F5  | **Option thumbnails are cropped renders of that feature on the real garment**            | Observed; not icons                           |
| F6  | Jacket option groups: closure, button, lining, lapel, pockets, vents, shoulder, monogram | Observed + payload                            |
| F7  | Advanced options separated from the common set                                           | `Advanced options`, `isAdvanced`              |
| F8  | Search within large option sets                                                          | `hasSearch`                                   |
| F9  | Zoom and reset controls                                                                  | Three `Zoom`/`Reset` pairs                    |
| F10 | Incompatible selections produce an explicit message, not a silent disable                | `Please update your options.`                 |
| F11 | Session resume and start-fresh                                                           | `Resume`, `Start fresh`                       |
| F12 | Monogram panel with a none/cancel path                                                   | `monogramPanel`                               |

F2 is **parity-only and must not ship as a commercial claim** without the
proposal/MTM contracts (R-03). Build the surface; leave the numbers
unpopulated or explicitly illustrative until those contracts exist.

### Technical parity

| #   | Requirement                                                                               |
| --- | ----------------------------------------------------------------------------------------- |
| T1  | Ordered layer graph; composition order is data, not code                                  |
| T2  | Asset paths keyed by resolved option ids — no per-combination bundles                     |
| T3  | Material-dependent layers separated from shared layers                                    |
| T4  | Per-configuration-type fallback image with the same shape as a real layer                 |
| T5  | Responsive delivery — `srcset`/`sizes` per layer                                          |
| T6  | Whole configured garment well under 1 MB; reference page total was 3.27 MB / 305 requests |
| T7  | Deterministic regeneration of every asset from a recorded seed and config                 |
| T8  | Signed manifest; unavailable asset fails closed                                           |

## Milestones

Sequential. Each has one acceptance gate. Do not start the next until the
current one passes, and record the pass in `11_EXECUTION_STATE.md`.

### P1.0 — One image that holds up

One jacket, one cloth, one construction, Cycles, 1600 × 2000, placed beside a
reference render. No graph, no layers, no route, no manifest.

_Gate._ A panel cannot identify the PAON render as the weaker image on
V7–V10. Failing this halts the programme at its cheapest point (R-17).

#### P1.0 result, 2026-08-15: **NOT PASSED**, and the reason is precise

Built and run: `tools/drape-lab/` — headless Blender 5.2 LTS, Cycles on Metal
GPU, AgX pinned, 1600 × 2000, adaptive sampling to a 0.005 noise threshold,
three-light studio rig with a raking variant, procedural wool shader with a
sheen layer and a micro weave, horn-button material, and a grey sweep backdrop.
Roughly two minutes per frame. **The rendering harness works.**

**The geometry does not.** The spike lofted a jacket _surface_ from profile
curves rather than cutting panels and sewing them, on the reasoning that P1.0
isolates the rendering question. The render is clean — real contact shadow,
visible weave at native resolution, buttons that read — and it is still
unmistakably not a jacket: no shoulder, no armhole, lapels standing off as two
separate tongues, sleeves reading as detached blobs.

Two of the first attempt's faults were my own bugs rather than quality limits,
and were fixed before judging: the backdrop had `is_shadow_catcher` set, which
renders a surface invisible except where shadow falls, so the whole frame came
back black; and the camera was aimed at the collar rather than the garment's
centre, cropping the body. Shadow catchers belong to the per-assembly layer
pass in chapter 07, never to a hero plate.

**The finding that matters, and it corrects this chapter.** P1.0 was specified
as "one jacket… no graph, no layers" on the assumption that rendering could be
proven before geometry. That assumption is wrong. A jacket does not read
without a shoulder line, an armscye and a rolled lapel, and none of those
survive being lofted — they are products of panels joined along seams. So P1.0
cannot pass independently of P1.1 and P1.2; the milestone boundary was drawn in
the wrong place.

Revised: **P1.0's gate moves to the end of P1.2** and is judged on a garment
that has been panelled and draped. What P1.0 delivered instead is the harness
those milestones needed anyway, now proven end to end.

This is the cheap failure the milestone existed to produce. It cost one
afternoon and it tells us exactly where the difficulty lives: not in Cycles,
not in shading, not in lighting — in geometry.

### P1.1 — The jacket exists as geometry

Original panelled jacket geometry with seam definitions: forepart, side body,
back, under- and top-collar, lapel facing, upper and under sleeve, pocket welts
and flaps, lining. Generated from repository code, deterministic from a seed.

_Gate._ Two runs from the same seed produce byte-identical geometry. Every
panel declares the seams it joins. No purchased or scraped model anywhere.

### P1.2 — It drapes

Headless Blender cloth simulation over a ghost-mannequin body form, with sewing
springs joining the panels, settling to a rest pose.

_Gate._ The garment closes correctly at every seam, hangs without
interpenetration, and the silhouette reads as a jacket rather than a bag.

### P1.3 — It renders as layers that composite

The render stage from chapter 07: per-assembly layers, each carrying its own
cast shadow via shadow catchers, on premultiplied alpha.

_Gate._ The shadow-swap test — composite variant A, then B, and no pixel
outside B's own footprint and shadow region differs (R-18). This is the gate
that decides whether the modular approach survives.

### P1.4 — The option set

Every F6 group implemented as assemblies in the chapter-09 graph, with
compatibility rules as data and a published reason on every refusal.

_Gate._ Every reachable selection resolves or fails closed with a reason. F10
passes.

### P1.5 — Delivery

AVIF encoding with alpha, `srcset` per layer, browser composition, zoom to the
1600 × 2000 tier, three rotation frames.

_Gate._ T3, T5, T6 measured and passing. Per-layer weights within an order of
magnitude of the reference.

### P1.6 — The surface

The configurator UI: tabs, option rows with cropped-render thumbnails, advanced
split, search, zoom/reset, resume, monogram panel, incompatibility messaging.

_Gate._ Every F row passes. Keyboard operable with visible focus. Full
comparison readable with no JavaScript.

### P1.7 — Parity panel

Unlabelled side-by-side against the accepted reference and against the rejected
set, judged on the full V checklist, with at least one judge who knows
tailoring.

_Gate._ Not identifiably weaker than the reference; unmistakably better than
the rejected set. Then — and only then — the shoulder-construction legibility
test from chapter 06, which is where Phase 1 stops being parity and starts
being ours.

## What we deliberately do not copy

- Their option vocabulary, option codes, descriptions, path conventions or
  taxonomy. Observed strings in chapter 01 are evidence, never source material
  (D-07).
- Their imagery, textures, models or fonts. Nothing of theirs enters PAON.
- Resolved commercial pricing and lead times as real claims (R-03).
- A live 3D renderer. Dropped from Phase 1 entirely by founder direction, and
  the rejected-set evidence in chapter 06 says the industry's real-time
  configurators cluster below the acceptable line.

## Where we exceed parity, later

Recorded so parity is not mistaken for the goal. None of this is Phase 1.

1. **Shoulder construction legibility** — spalla camicia against con rollino,
   under raking light in a three-quarter view. The reference does not attempt
   this. It is the first thing that makes the product ours.
2. **Cloth character** — the same construction under different drape classes.
   Nothing in the surveyed market shows how the cloth behaves.
3. **Movement** — the garment in more than one posture.
4. **Advisor integration** through Virtual Wardrobe Studio.

Parity buys the right to be believed. These are what the belief is for.
