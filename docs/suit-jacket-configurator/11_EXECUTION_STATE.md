# Execution state

This file is the resume point. It is not a handoff letter to a particular model
and it is not a second charter — it is the live ledger of what has been done,
what is running, and what is next, so any session can pick up the work from the
repository alone (`AGENTS.md` ch.2).

**Update this file in the same commit as the work it describes.** A stale
execution state is worse than none, because the next session will trust it.

---

## Standing order

Founder direction, 2026-08-15, in force until explicitly revoked:

> Operate as orchestrator. Work continuously and autonomously. Deploy subagents
> aggressively as a collaborating team. Zero founder involvement is required to
> proceed. Idling is forbidden. Commit continuously so another session can pick
> up immediately.

Consequences that bind every session:

1. **Do not stop to ask** what to do next. This file says what is next. If it
   does not, the next action is to find out and then write it here.
2. **Do not idle.** If something is blocked, take the next unblocked item.
3. **Commit early and often.** Every meaningful increment gets a commit with
   this file updated. Work that exists only in a session's context is lost work.
4. **Never open a browser window on the founder's screen.** Research uses
   WebSearch/WebFetch. If a page needs a real browser, drive an ordinary Chrome
   installation over the DevTools protocol on a throwaway profile, headless,
   and kill it afterwards. See `01_REFERENCE_CAPABILITY_MATRIX.md` "Pass B".
5. **No paid inference, no paid generation providers.**
6. **Build the whole pipeline broad-first, then deepen.** Founder direction,
   2026-08-18: get every stage minimally end-to-end before polishing any one
   stage's quality. P1.2's stability debugging (this file's history below)
   is the cautionary example — a single narrow problem (does the garment stay
   on the form) consumed most of a session across five real attempts before
   it was actually fixed. P1.1's sleeve _drape quality_ must not repeat that:
   the armscye seam contract existing and running without crashing is enough
   to call P1.1 "built" and move to P1.0 (one Cycles render beside a
   reference shot — the roadmap's own gate on the whole programme). Sleeve
   crumpling/visual quality is real, known, unfixed debt — record it, don't
   chase it, come back once every stage has a rough pass.

## The goal, restated so it cannot drift

Reach the Suitsupply configurator's visual, functional and technical result —
**1:1** — and then go far beyond it. Parity is a milestone, not the ambition.

The binding requirements are in `06_VISUAL_QUALITY_AND_ACCEPTANCE.md` under
"Minimum passable requirements". The short form:

- ray-traced (Cycles) offline renders, never rasterized
- 1200 × 1500 delivery / 1600 × 2000 zoom, AVIF, layered, a few KB per layer
- fabric and shadow fidelity at least matching the reference
- **shoulder construction legible**: spalla camicia vs con rollino
- fully unattended; no human ever operates 3D software

## Where things stand

**Phase: P1.1/P1.2 seam-contract repair complete; P1.2's stability gate now
passes (no-sleeve body holds on the form across all 90 settle frames,
verified by trace and render from the production script). Visual quality is
not yet a pass — a small shoulder seam-closure artifact remains, and the
drape won't read as a jacket until P1.1's sleeve/armscye contract exists.
See the debugging history below for the full chain, including one subagent
report that was independently caught fabricating a visual result.**

| Item                      | State                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Dossier chapters 00–10    | Written, self-consistent, reviewed                                                                                |
| Reference bar             | Measured from the live competitor (ch. 06)                                                                        |
| Asset contract            | Normative (ch. 09)                                                                                                |
| Render stage              | Specified (ch. 07)                                                                                                |
| Build plan W0–W6          | Specified (ch. 10)                                                                                                |
| Blender pin               | 5.2 LTS, confirmed from blender.org                                                                               |
| **Executable code**       | P1.0 render harness and P1.1/P1.2 prototype                                                                       |
| **P1.1/P1.2 seam repair** | Ordered named seams verified; 46 springs                                                                          |
| **P1.2 stability gate**   | Passing. Shoulder-seam pinned at its worn (not cut) position; holds across 90 frames. Small shoulder gap remains. |

### P1.2 debugging history — read before touching sew.py or panels.py's collider geometry

Three independent attempts, each verified against an actual rendered image or
a frame-by-frame Z-position trace, not narration. **All three still show the
garment in roughly the same catastrophic free-fall (~15m drop by frame 90,
from the pre-fix baseline through every attempt below)** — that consistency
is itself a clue: whatever the '''real''' cause is, none of these changes have
touched it.

1. **Mass/friction hack (`678f6d2`, REJECTED).** Diagnosed zero collision
   friction/damping, then "fixed" it mainly by cutting cloth mass 96%
   (0.32 -> 0.01 kg/m^2) to make gravity negligible — not a real fix, and its
   own before/after table still showed 912mm of drift it called "stable".
   The actual rendered image is a crumpled illegible spike, not a jacket on a
   form. Reverted; mass restored to 0.32 with its original sourcing comment.
   Moderate (non-maxed) friction/damping values kept since they're not wrong,
   just insufficient alone.
2. **Interpenetration fix (this session, real bug, did not fix the fall).**
   `forepart()`/`back_panel()` start their panels only `START_GAP=0.055m`
   from the form's surface, but `dress_form()`'s own cross-sections have half
   -depth up to 0.130m at chest — panels were created already inside the
   collider along almost their whole centre-front/side edge. Raised
   `START_GAP` to 0.20 (clears the deepest section with margin). Real
   defect, correctly fixed, but the fall trace afterward was unchanged.
3. **Inverted normals fix (prior session, real bug, did not fix the fall).**
   `forepart(side=-1)`'s x-mapping mirrors relative to `side=+1` (x
   decreases with u instead of increasing); the shared `_grid()` builder
   doesn't compensate, so one whole forepart panel (exactly 96 of the
   garment's 448 faces) had inverted face winding relative to the rest.
   Fixed via `bmesh.ops.reverse_faces` in a new `_flip_faces()` helper called
   from `forepart()` for `side<0`. Verified the normal-consistency count
   changed as expected. Fall trace afterward: still unchanged.
4. **Sewing-force ramp (this session, real defect found and fixed along the
   way, slowed but did not stop the fall).** Picked up the prior session's
   recorded lead. First attempt wrote `st.sewing_force_max` directly inside
   the per-frame `frame_set()` loop, ramping the raw Python value — this
   **froze the whole simulation solid after frame 2** (bit-identical vertex
   positions through frame 90, confirmed by a frame-by-frame Z trace):
   writing a cloth setting from Python appears to invalidate the point cache
   on every write, so the solver never gets a continuous history to
   integrate. Fixed by keyframing `sewing_force_max` as a real F-Curve
   before the loop instead (`bake()`'s new `sewing_ramp_frames`/
   `sewing_ramp_start`), so the depsgraph reads it the same way `frame_set`
   already reads everything else. Hit a second, unrelated defect getting
   there: Blender 5.2's layered-action system has no `Action.fcurves` —
   fcurves live under `layers[].strips[].channelbags[].fcurves`, and the
   supported way to reach one is `Action.fcurve_ensure_for_datablock()`, not
   documented in chapter 13 because nobody had animated a property from
   Python here before. Both are real, verified fixes and are kept.
   Also reduced `panels.py`'s `START_GAP` 0.20 -> 0.16 (still >0.03 above the
   form's deepest cross-section, 0.130) to shrink the side-seam closing
   distance the ramp has to cover.
   **Result, verified against both a frame-by-frame Z trace and an actual
   rendered PNG (not narration):** the fall is real but slower — z_min at
   frame 90 improved from -15.9m (full force, frame 1) to -12.8m (ramped,
   `START_GAP=0.16`) — and the render is still an empty frame; the garment
   is still off-camera by frame 90. Not fixed.

**Root cause, now demonstrated rather than guessed**: the panels never
geometrically overlap the collider at all while falling. Both `forepart()`
and `back_panel()` hold `|y| >= START_GAP` everywhere on the sheet, and
`START_GAP` must stay above the form's deepest half-depth (0.130) to avoid
the original interpenetration bug — so the closest any panel vertex starts
to the form's surface is ~0.03-0.13m of clear air, and gravity acts on
`y` not at all (it's a purely vertical translation while air borne). The
sewing springs are the _only_ force pulling `y` toward the collider, and
they lose the race: diagnostic-only runs (not committed — see below) show
`y` converging nicely to inside the form's depth (±0.10-0.15m) by frame
20-30, but by then the garment has already fallen straight through the
form's z-range (0.29-1.36) and out the bottom, because nothing has been
opposing gravity in `z` this whole time. Collision genuinely cannot engage
before that happens.

Diagnostic-only (**not committed, do not read this as a recommendation to
reduce gravity** — it is the exact same category of hack as the rejected
mass-reduction fix in `678f6d2`, which made gravity numerically negligible
instead of fixing the actual problem): temporarily setting
`mod.settings.effector_weights.gravity` to 0.25, then 0.12, both slowed the
fall dramatically and let the side seams close inside the form's depth, but
neither reached equilibrium in 90 frames — once the springs relax after the
seam closes, nothing else opposes gravity, so it still slides through, just
more slowly. This confirms the root-cause diagnosis above rather than
fixing it: **something has to physically support the garment against
gravity before or during the fall, not just eventually pull it sideways.**

5. **Shoulder pin, naive (this session, real progress, real new defect).**
   Added `sew.pin_vertex_group()` + `setup_cloth(pin_group=..., pin_stiffness=...)`
   and pinned the full shoulder-seam vertex group (both `forepart().shoulder`
   and `back_panel().shoulder_L/R`, 7 vertices per side, weight 1.0). **This
   genuinely stops the free-fall** — z stayed stable across all 90 frames,
   confirmed by trace and render, first real stability in this whole
   debugging history. Committed as `3e2f48d` (WIP) once verified, since it's
   a real fix even though the shape wasn't right yet: the render showed sharp
   pointed "wings" at both shoulders and a twisted, crumpled drape below —
   worse-looking than free-fall, just stable.

   Fanned out 4 parallel Haiku agents to tune it (sparse endpoint-only
   pinning, `pin_stiffness=0.3`, a slower 80-frame sewing-force ramp, softer
   collision `friction=5.0`/`damping=0.5`). All 4 came back with green
   Z-tables. **One of them (`friction=5.0`/`damping=0.5`) reported a clean,
   composed, non-winged render — independently re-run to verify per AGENTS.md
   ch.20 ("worker narration is never evidence"), and the re-render showed the
   exact same winged/crumpled shape as the naive baseline.** The agent's
   visual description was simply wrong. All 4 variants' actual renders (the
   3 that were spot-checked, and the re-run of the 4th) show the same
   winged/crumpled shape regardless of pin stiffness, collision softness, or
   ramp speed — none of those parameters were the cause.

6. **Diagnosed and fixed: pin _position_, not pin _strength_ (this session,
   the actual fix).** A Blender pin holds a vertex at wherever its mesh
   coordinate already is. Item 5 pinned the shoulder seam at its _flat-cut_
   position — `forepart_L`/`forepart_R`'s shoulder edges sit at
   `y ≈ -0.16` to `-0.26`, `back_panel`'s at `y ≈ +0.16` to `+0.25` (see
   `START_GAP` in item 2) — roughly 0.3-0.5m apart. Since a pin overrides the
   sewing spring for that vertex entirely, front and back were frozen apart
   forever: the seam could never close, and the neighbouring free vertices
   contorted trying to reconcile "two fixed points 0.3m apart" with "this
   edge wants to be short" — that contortion _is_ the winged crumpling, and
   it is independent of stiffness/friction/ramp speed, exactly as the item-5
   fan-out found.

   Fixed by adding `snap_y` to `pin_vertex_group()`: after building the
   group, overwrite the pinned vertices' `y` coordinate only (x and z keep
   the panel's real shoulder-slope/chest-circumference shape) to `0.0` —
   the form's shoulder ridge — before the sim starts, so the pin now holds
   the seam where it actually sits once worn, not where the pattern piece
   sat on the cutting table. Wired into `p1_1_drape.py`'s call site.

   **Verified against the actual production entry point**
   (`p1_1_drape.py`, not just a diagnostic script) **and an actual rendered
   PNG**: no free-fall (z holds at the pin, 1.300, hem settles ~0.21-0.26m),
   side-seam `y` closes from the initial ~±0.26 to inside the form's depth
   (±0.10) by frame 10 and stays there, and the render shows a closed,
   flat-topped silhouette with no wings and no free-fall — a real, large
   improvement over every prior attempt. **Not yet clean**: there is a small
   residual gap/hole near one shoulder in the render (a minor remaining
   seam-closure artifact, not investigated further this session), and the
   overall silhouette reads as a draped, twisted length of cloth rather than
   a jacket — expected, since sleeves are not sewn in yet (`BODY_SEAMS` has
   no armscye contract, per `sleeve_cap()`'s own docstring) and P1.2's gate
   is holding the sewn body on the form, not final visual fidelity (that's
   P1.7's gate, after P1.1's sleeves and P1.0's render pass).

**P1.2 stability gate: now passing** on the 3-panel (no-sleeve) body — holds
across all 90 settle frames, verified by trace and by an actual rendered
image from the production script. **Not yet a visual-fidelity pass** — the
small shoulder gap and the twisted/non-jacket-like drape remain, and neither
has been root-caused.

### P1.1 — armscye/sleeve contract (this session)

Per the broad-first steering above, this was built to "runs without crashing
and is structurally real," not tuned for visual quality — that tuning is
deliberately deferred.

- `panels.py`: `ARMSCYE_ARITY = 8` (labelled ours — chapter 14 sources the
  armscye seam's existence and its 8-10% ease ratio but explicitly blocks a
  sourced depth/quadrant boundary, same gap as the canvas-boundary parameter
  it already flags as PAON's own). Splits each panel's existing
  `ARITY_VERTICAL`-point side column into a lower `side` seam (hem ->
  underarm) and an upper `armscye` seam (underarm -> shoulder), sharing the
  underarm point. Applied to both `forepart()` and `back_panel()`.
- `sleeve_cap()` now returns named `front`/`back` boundaries on its
  sleevehead arc (arc resized to `2*ARMSCYE_ARITY-1` points, split at the
  centre/top point into two `ARMSCYE_ARITY`-point halves), ordered to match
  the body armscye seams' direction. `_grid_from_outline()` now returns
  `(obj, boundaries)` like `_grid()` so this could be built at all.
- `SLEEVE_SEAMS`: 4 seam pairs (front/back x left/right) joining each
  sleeve's cap directly to forepart's and back's armscye boundaries — this
  prototype has no side body panel yet, so the sleeve attaches straight to
  the two panels that exist, per chapter 14's `seam.armscye` row.
- `arm_form()`: added after the first sleeve render showed the sleeve
  collapsing into a crumpled mass at the shoulder — `dress_form()` has no
  arm, so gravity had no arm-shaped volume to drape the sleeve over. A
  simple tapered-cylinder collider, generated and never rendered like
  `dress_form()` itself, sized to `sleeve_cap()`'s own footprint.
- `sew.make_collider()` factored out of `setup_cloth()` so both the form and
  each arm can carry a COLLISION modifier without duplicating that block.

**Verified**: the full 5-panel pipeline (2 forepart + back + 2 sleeves, 587
verts, 66 sewing springs) runs end-to-end through the production script with
no crash, no arity errors, no exploded/degenerate geometry. **Not verified,
and known bad**: the actual render still shows the sleeves as a crumpled
mass rather than a recognisable sleeve shape, with or without the arm
collider — this is real, unresolved visual debt, deliberately left for a
later pass rather than chased now. `docs/suit-jacket-configurator/13_*.md`
was not amended with a materials/render source citation for the arm/sleeve
geometry since none of it is sourced (all labelled "ours" above).

P1.0's full-quality render result is recorded in
`12_PHASE_1_SUITSUPPLY_PARITY_ROADMAP.md` directly (2026-08-18 entry) rather
than duplicated here — harness/materials solid, geometry still doesn't read
as a jacket, not chased further per the broad-first standing order.

### P1.1 continued — side_body() (this session, broad-first)

Chapter 14's panel set also names "side body x2 -- waist shaping; bridges
forepart to back," previously skipped (forepart and back joined directly at
`side`). Added `side_body()`: a minimal 2-column strip (no interior detail,
no Vincent-derived shaping — chapter 14 itself calls the exact shape
unsourced) routed into the existing `side` seam pair instead of the direct
join. **Verified structurally safe**: re-ran the Z-stability check with
side_body added — still holds, `z` stays in `0.34-1.36` across all 90
frames, no regression to P1.2's gate (7 panels, 627 verts, 86 springs).
**Visually rougher, as expected**: the render now shows an additional flat,
undraped flap near the shoulder from the new unconnected/undertuned panel —
worse-looking than without it, not better. Consistent with this session's
broad-first direction: breadth was the goal, not this panel's drape quality.
Left as-is rather than tuned.

Still entirely unbuilt from chapter 14's panel set: under-collar, top-collar,
lapel facing (plus its roll line, which chapter 14 flags as a crease/fold
requiring bend-stiffness along a curve, not a sewing spring — a genuinely
different technique nothing in this codebase has attempted yet), pocket
welts/flaps, canvas/chest-piece stiffness field, lining. Collar/lapel is the
highest-value remaining gap (chapter 06's acceptance bar: "shoulder
construction legible, spalla camicia vs con rollino" — actually a
sleeve/shoulder-junction distinction, which is exactly the area still
crumpling) but also the highest-complexity and highest-risk-to-existing-
stability of what remains, since it requires reshaping forepart's/back's
existing neckline rather than only adding a new panel. Not attempted this
session.

Per the standing order (do not stop to ask, never idle), the next session
continues the broad-first pass rather than waiting for review: pockets and
lining are lower-risk additive breadth (same pattern as side_body — new
panels into or alongside the existing contract, no reshaping of proven
geometry); collar/lapel is higher-value but requires reshaping forepart's
and back's existing neckline plus a new roll-line/crease technique, so it
should wait until the lower-risk breadth is done, to keep isolating risk to
one new thing at a time the way side_body's verification just did.

### Commits so far, newest first

| Commit    | What it settled                                                     |
| --------- | ------------------------------------------------------------------- |
| `92d27f8` | Render stage in ch. 07; W0 spike; plan rebuilt around quality-first |
| `89b9f61` | Top-tier minimum requirements; two-axis shoulder correction         |
| `584c5ef` | D-15 Suitsupply is the bar; D-16 3D builds it, images ship it       |
| `c616197` | Rendering medium settled by live observation of both competitors    |
| `8c57d04` | Blender pin corrected to 5.2 LTS from the primary source            |
| `63f05ba` | Gate released; ground-zero reconciliation; Lab Phase 1 plan         |
| `71697c2` | Modular asset graph (ch. 09); evidence tiers                        |

## In flight

Two research agents, launched 2026-08-15 after the quota reset, deliberately
narrow per the capacity rule below:

| Slice                | Question it must answer                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jacket-pattern`     | The real panel set, the seam network, and sleevehead ease — with sourced numbers and the copyright status of every drafting source we might derive geometry from                 |
| `garment-parametric` | Whether any existing tool generates a **tailored jacket** pattern, what body form we may legally use commercially, and whether any AI 3D tool produces simulation-ready topology |

Both are read-only and text-source only. Neither may open a browser window.

When they land: write chapter 13 with the chosen toolchain and the answers,
then start P1.0. If they returned nothing, re-run them one at a time.

The earlier 10-domain sweep was launched and **died**; see below.

## Capacity: the binding constraint

**A 13-agent parallel workflow exhausted the account session limit in 83
seconds, burned ~203k subagent tokens, and returned zero results.** Every agent
failed with "session limit". This is an account quota, not a bug, and no
engineering works around it.

**A second, separate cap exists and it is easy to miss: WebSearch is limited
per session** (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`, observed exhausting
at 200). A research agent burned the remaining budget on searches and returned
nothing usable. The workaround is to **hand agents explicit URLs to WebFetch
rather than letting them search** — searching is the expensive verb here, and
for known projects the URL is usually already known. Reserve WebSearch for
genuinely unknown territory.

Operating rules that follow, and they are not optional:

1. **Cap concurrency at 2–3 agents.** Wide fan-out is a false economy here: it
   fails fast and returns nothing. Narrow and sequential completes.
2. **Land each agent's output before starting the next.** A finding that is not
   committed did not happen.
3. **Prefer doing cheap work directly** over delegating it. Delegation costs a
   whole agent context; a grep costs almost nothing.
4. **Expect to be interrupted mid-task.** Write the state file before the work,
   not after.

The sweep script is preserved and can be resumed with cached results for any
agent that completed — none did here, so it will re-run from scratch. Re-run it
**in slices of two or three domains**, not all ten. Domain list and prompts are
in the script under the session's `workflows/scripts/` directory; the domains
are: garment-parametric, cloth-sim-sota, fabric-shading, render-technique,
layer-compositing, blender-automation, ai-3d-generation, jacket-pattern,
delivery-pipeline, automated-visual-qa.

Highest value first, if a session must choose: **jacket-pattern** and
**garment-parametric** (nothing can be built without geometry), then
**layer-compositing** (it decides whether the modular approach works at all),
then **fabric-shading** and **render-technique** (they decide whether it looks
good).

## Work queue

Ordered. Take the top unblocked item. Do not reorder without recording why.

**The roadmap is `12_PHASE_1_SUITSUPPLY_PARITY_ROADMAP.md`.** Milestones P1.0
through P1.7, each with one acceptance gate. That chapter supersedes chapter
10's W0–W6 framing where the two differ: the live 3D tier is dropped from Phase
1 entirely by founder direction, and Phase 1 is Suitsupply parity 1:1.

| #   | Work                                                            | Blocked by | Notes                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~P1.2~~ — hold the sewn body on the dress form                 | —          | **Done, this session.** No-sleeve body holds across 90 frames; shoulder pinned at its worn position, not its cut position. Small shoulder seam-closure gap left unresolved — pick up if it blocks P1.1's armscye join.     |
| 2   | ~~P1.1~~ — panelled jacket geometry, deterministic from seed    | —          | **Built (broad-first), this session.** Armscye contract wired, sleeves + arm colliders in place, runs end-to-end with no crash. Sleeve drape _quality_ is real known debt, deliberately deferred — see P1.1 section above. |
| 3   | **P1.0** — one Cycles render beside a reference shot            | 2          | Now unblocked. Gates the programme (R-17). Days, not weeks.                                                                                                                                                                |
| 5   | P1.3 — per-assembly layers with shadow catchers                 | 4          | Shadow-swap test decides if the modular approach lives                                                                                                                                                                     |
| 6   | P1.4 — full option set as graph assemblies + compatibility data | 5          |                                                                                                                                                                                                                            |
| 7   | P1.5 — AVIF layered delivery, srcset, zoom, rotation frames     | 6          |                                                                                                                                                                                                                            |
| 8   | P1.6 — the configurator surface                                 | 7          | Thumbnails are crops of real renders, not icons                                                                                                                                                                            |
| 9   | P1.7 — parity panel, then shoulder legibility                   | 8          | Pre-register thresholds before collecting anything                                                                                                                                                                         |

Parallel and unblocked at any time — take one of these when the queue head is
blocked, rather than idling:

- **Measure the rejected configurators** (ch. 06 "The floor, set from below").
  Six URLs, founder-rejected on quality, with no technical measurement yet.
  For each: rendering medium (canvas/WebGL vs images), delivered resolution,
  engine if detectable, and per-asset weight. Use the Pass-B method — ordinary
  Chrome over CDP, headless, killed afterwards. Cheap and it converts six
  judgments into six measurements.
- Chapter 05's budgets are still written as live-WebGL client budgets. Under
  D-16 they should be image-delivery budgets. Small, self-contained.
- The competitor interaction gap (R-09): no option-change interaction was ever
  driven in either configurator, so incompatibility enforcement, save/share and
  gesture behaviour remain unobserved.

## Hard constraints that must never be violated

These have caused real errors already. Read them before writing anything.

1. **Writable paths.** `docs/suit-jacket-configurator/*.md` for documentation.
   Code, when W0 starts, goes under `tools/drape-lab/` — see ch. 10's proposed
   layout, and confirm against repo convention before creating directories.
   **`docs/PHASE.md` is not writable** without separate authorization.
2. **No competitor assets.** Ever. URLs and measurements are observations;
   downloading their imagery into PAON is not. Quoted strings in ch. 01 are
   evidence of observation, not source material.
3. **No physical-accuracy claim.** Fabric profiles stay `illustrative` until
   calibration evidence exists. Missing evidence **blocks the claim**; it never
   becomes a task for the founder to buy equipment or hire a specialist.
4. **Evidence tiers.** Every factual claim carries one (ch. 00). Untiered means
   proposal.
5. **`BLOCKED` is provisional on exhausting realistic access.** "The automation
   binary was refused" is not "the source cannot be read". This exact mistake
   produced a wrong Blender pin; see ch. 10.

## Lessons already paid for

Recorded so they are not repeated:

- **A negative from a time series needs an age check.** "No patches yet" and
  "no patches ever" are different claims. Reading the first as the second
  produced a wrong LTS pin.
- **Tooling failure looks exactly like unavailability.** Sites that refused
  curl, WebFetch and the Playwright browser build opened immediately in an
  ordinary Chrome driven over CDP. Two major conclusions were wrong until that
  was tried.
- **Corrections should move to whichever tier the evidence supports**, not
  reflexively to the stricter one. A correct observation was demoted to
  `PAYLOAD` on the strength of a broken capture.
- **Check domain terminology before modelling it.** Spalla camicia and con
  rollino were modelled as one option list; they are two independent axes. A
  tailoring audience would have seen it immediately.
