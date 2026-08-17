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

**Phase: P1.1/P1.2 seam-contract repair complete; garment-stability tuning is
still the active blocker. A prior session's commit (`678f6d2`) claimed this
fixed — it did not. This session's ramped-sewing-force attempt slowed the
fall materially but also did not fix it; see below for the root cause this
session demonstrated and the untried pinning approach it points to.**

| Item                      | State                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dossier chapters 00–10    | Written, self-consistent, reviewed                                                                                              |
| Reference bar             | Measured from the live competitor (ch. 06)                                                                                      |
| Asset contract            | Normative (ch. 09)                                                                                                              |
| Render stage              | Specified (ch. 07)                                                                                                              |
| Build plan W0–W6          | Specified (ch. 10)                                                                                                              |
| Blender pin               | 5.2 LTS, confirmed from blender.org                                                                                             |
| **Executable code**       | P1.0 render harness and P1.1/P1.2 prototype                                                                                     |
| **P1.1/P1.2 seam repair** | Ordered named seams verified; 46 springs                                                                                        |
| **P1.2 visual gate**      | Still failing. Two real bugs found and fixed along the way (see below); neither was the actual cause. Root cause still unknown. |

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

**Next candidate, not yet tried**: pin the shoulder/neckline boundary
vertices (`forepart().shoulder`, `back_panel().shoulder_L/R` — already a
named seam in `BODY_SEAMS`) via `ClothSettings.vertex_group_mass` +
`pin_stiffness`, so the top of the garment can't free-fall at all and
gravity instead drapes the rest of the cloth down and around the form from
a fixed anchor — the same reason a real jacket does not need friction alone
to stay on a mannequin. This is an architecture change (a new vertex group,
threaded from `panels.py`'s seam dict through to `sew.setup_cloth()`), not
another force/friction/gravity tuning pass — three of those have now been
tried and none held the garment up.

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

| #   | Work                                                            | Blocked by | Notes                                                                                         |
| --- | --------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| 1   | **P1.2** — hold the sewn body on the dress form                 | P1.1 seams | Tune initial panel placement and collision; no solver tuning until the initial pose is valid. |
| 2   | P1.1 — panelled jacket geometry, deterministic from seed        | 1          | Add sleeves only with the explicit armscye contract.                                          |
| 3   | **P1.0** — one Cycles render beside a reference shot            | 2          | Gates the programme (R-17). Days, not weeks.                                                  |
| 5   | P1.3 — per-assembly layers with shadow catchers                 | 4          | Shadow-swap test decides if the modular approach lives                                        |
| 6   | P1.4 — full option set as graph assemblies + compatibility data | 5          |                                                                                               |
| 7   | P1.5 — AVIF layered delivery, srcset, zoom, rotation frames     | 6          |                                                                                               |
| 8   | P1.6 — the configurator surface                                 | 7          | Thumbnails are crops of real renders, not icons                                               |
| 9   | P1.7 — parity panel, then shoulder legibility                   | 8          | Pre-register thresholds before collecting anything                                            |

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
