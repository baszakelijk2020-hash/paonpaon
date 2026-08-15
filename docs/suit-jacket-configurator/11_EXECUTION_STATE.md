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

**Phase: documentation and research complete enough to build; W0 not started.**

| Item                      | State                                        |
| ------------------------- | -------------------------------------------- |
| Dossier chapters 00–10    | Written, self-consistent, reviewed           |
| Reference bar             | Measured from the live competitor (ch. 06)   |
| Asset contract            | Normative (ch. 09)                           |
| Render stage              | Specified (ch. 07)                           |
| Build plan W0–W6          | Specified (ch. 10)                           |
| Blender pin               | 5.2 LTS, confirmed from blender.org          |
| **Any executable code**   | **None. Nothing has been built yet.**        |
| **W0 single-image spike** | **Not started. This is the next real work.** |

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

| #   | Work                                                            | Blocked by | Notes                                                      |
| --- | --------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| 1   | Research slices: jacket-pattern, then garment-parametric        | quota      | 2 agents at a time. Nothing can be built without geometry. |
| 2   | **P1.0** — one Cycles render beside a reference shot            | 1          | Gates the programme (R-17). Days, not weeks.               |
| 3   | P1.1 — panelled jacket geometry, deterministic from seed        | 2          |                                                            |
| 4   | P1.2 — cloth simulation, sewing springs, settles to rest pose   | 3          |                                                            |
| 5   | P1.3 — per-assembly layers with shadow catchers                 | 4          | Shadow-swap test decides if the modular approach lives     |
| 6   | P1.4 — full option set as graph assemblies + compatibility data | 5          |                                                            |
| 7   | P1.5 — AVIF layered delivery, srcset, zoom, rotation frames     | 6          |                                                            |
| 8   | P1.6 — the configurator surface                                 | 7          | Thumbnails are crops of real renders, not icons            |
| 9   | P1.7 — parity panel, then shoulder legibility                   | 8          | Pre-register thresholds before collecting anything         |

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
