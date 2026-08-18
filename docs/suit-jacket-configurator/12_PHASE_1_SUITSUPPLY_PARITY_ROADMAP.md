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

#### P1.1/P1.2 first run, 2026-08-15: **FAILED**, and it indicts a shortcut

The pipeline completed — 5 panels cut, 1440 vertices, **518 sewing springs
created**, 60 frames settled in 126 s, rendered without error. Mechanically it
works end to end.

The output is not a garment. The cloth tore itself into ragged spikes and
shredded sheets hanging off a column: no shoulder, no armhole, no closure, no
silhouette. Visually it is further from a jacket than P1.0's slab was.

**Cause, and it is my own shortcut.** `sew.py` paired boundary vertices by
nearest neighbour instead of by named seam, with a comment openly admitting it
was "cruder than chapter 09's seam contract and deliberately so". That was
wrong. Nearest-neighbour pairing across every boundary loop simultaneously
joins vertices that share no seam at all — front hem to sleeve cuff, armscye to
side seam — so the solver is asked to satisfy hundreds of mutually
contradictory constraints and tears the cloth apart satisfying none of them.

Chapter 09 specifies `seam.shoulder`, `seam.side`, `seam.armscye`,
`seam.neckline`, `seam.gorge`, each with a declared `ring_arity` and
arc-length parameterisation, precisely so that a sewing spring joins the two
edges that a tailor would actually stitch. **That contract is not
bureaucracy — it is the thing that makes the simulation solvable.** Skipping it
did not save time; it produced 518 springs pulling in arbitrary directions.

Three further contributors, in descending order of confidence:

1. **Seam pairing is unordered.** Even correctly-identified seam edges must be
   matched along the seam, not by proximity — arc-length correspondence is
   chapter 09's requirement and it exists for exactly this.
2. **Panels start 0.16 m apart with `sewing_force_max` 12.** A large gap plus a
   strong spring is a slingshot on frame 1. Either close the gap or ramp the
   force.
3. **Topology.** Panels are built as one n-gon then subdivided, which fans
   badly at the centre. Cloth needs even quads; a grid fill or a proper
   remesh is required.

**What this does not indict.** The render harness, again: Cycles, lighting,
materials and the ghost-mannequin setup all behaved. Both failures so far have
been geometry and simulation, never rendering.

Next attempt must implement chapter 09's seam contract properly — named seams,
declared arity, ordered arc-length pairing — before touching solver tuning.
Tuning a solver fed contradictory constraints is wasted effort.

#### P1.0/P1.1/P1.2 result, 2026-08-18: **NOT PASSED**, harness and geometry both real now, drape quality is the remaining gap

The seam contract above was implemented properly this session (named,
ordered, declared arity — `11_EXECUTION_STATE.md` has the full chain) and
the panels genuinely hold on the dress form now: P1.2's stability gate
passes, verified by a 90-frame Z-trace and an actual render, not narration.
The armscye/sleeve contract chapter 09/14 call for is wired and runs
end-to-end (5 panels, 587 verts, 66 sewing springs, no crash, no arity
errors) with an arm collider so the sleeve has something to drape over.

Full-quality renders (both `hero_front` and `three_q_rake`, real sample
counts, not diagnostic previews) confirm the harness and materials are
still solid — the raking view shows real woven-wool texture on every visible
fold — but the garment itself still does not read as a jacket: the shoulder
seam closes but pinches into two rigid points instead of a smooth line, and
the panels below twist and cross over each other rather than hanging as a
front/back/sleeve silhouette. This is a straight continuation of the same
class of defect the 2026-08-15 loft attempt hit (no shoulder line, no
armhole, sleeves reading as detached blobs) — the geometry pipeline is
structurally correct (real seams, real ease, real collision) but not yet
tuned to actually settle into worn shapes rather than crumpled ones.

Per this session's founder direction (`11_EXECUTION_STATE.md`'s Standing
order, item 6: build the whole pipeline broad-first, then deepen), this was
not chased further — P1.0's actual panel-judgment gate ("cannot be
identified as the weaker image") requires a human/founder comparison against
a reference shot and is not something a session can self-certify regardless
of render quality. What this session adds: the full pipeline, geometry
through render, now exists and runs, so that judgment and further tuning
have a real end-to-end artifact to work from instead of a known-broken loft
or an un-sewn prototype.

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
