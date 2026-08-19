"""
P1.1 — jacket panels as parametric grids with NAMED, ORDERED seam edges.

The first attempt cut panels as n-gons, subdivided them with an operator, then
paired boundary vertices by nearest neighbour. It tore the cloth to shreds,
because nearest-neighbour pairing joins vertices that share no seam — front hem
to sleeve cuff, armscye to side seam — and the solver cannot satisfy hundreds
of contradictory constraints at once.

Chapter 09 already said what to do instead: every seam has an id, a fixed
`ring_arity`, and arc-length parameterisation, so a spring joins the two edges a
tailor would actually stitch. This file implements that, and the enabling trick
is to build each panel as a parametric (u, v) grid rather than an outline:

  * boundaries are exactly the u=0, u=1, v=0 and v=1 rows,
  * they come out already ordered along the seam,
  * and two seams that must join can be given identical arity by construction.

Every panel therefore returns its object plus a dict of named seams, each an
ordered list of vertex indices running in a documented direction.
"""

import math

import bmesh
import bpy
from mathutils import Vector

# --- body block, chapter 14 proportions (metres, ~size-40 chest) -------------
CHEST_HALF = 0.275
WAIST_HALF = 0.252
HEM_HALF = 0.270
NECK_HALF = 0.080

Z_HEM = 0.34
Z_CHEST = 1.04
Z_SHOULDER = 1.30

# Chapter 14, sourced: shoulder seam sits ~1.25-1.5 in behind the shoulder
# point. 1.375 in = 0.035 m.
SHOULDER_SETBACK = 0.035
# Chapter 14, sourced: sleevehead runs 8-10% longer than its armscye.
SLEEVEHEAD_EASE = 1.09

# Seam arity. Chapter 09 requires two seams to agree on vertex count before
# they may be joined; fixing it here makes that true by construction rather
# than by a runtime check that can only ever fail late.
ARITY_VERTICAL = 17  # hem -> shoulder seams (side seams)
ARITY_SHOULDER = 7  # neck -> armhole (shoulder seams)
# Chapter 14 sources the armscye seam's existence and its ease ratio, but
# explicitly BLOCKS a sourced armscye depth/quadrant boundary ("no public
# source gives percentages per armhole quadrant... treat distribution as a
# calibration parameter of our own"). This is that same kind of gap: how far
# up the existing side-seam column the armscye starts. Ours, labelled as
# ours. Splits ARITY_VERTICAL's 17-point side column into a lower 10-point
# side seam (hem -> underarm) and an upper 8-point armscye (underarm ->
# shoulder), sharing the underarm point.
ARMSCYE_ARITY = 8
UNDERARM_INDEX = ARITY_VERTICAL - ARMSCYE_ARITY
# Same class of gap as ARMSCYE_ARITY above: chapter 14 sources the neckline
# seam's existence (seam.neckline: under-collar -> back neckline) but not
# where along the existing centre-front column the neck curve should start
# opening away from FRONT_OVERLAP's straight edge. Ours, labelled as ours.
NECK_V_START = 0.85
NECK_INDEX = round(NECK_V_START * (ARITY_VERTICAL - 1))
# Chapter 09 models canvas as a cloth stiffness field, not geometry; chapter
# 14 explicitly blocks a sourced canvas boundary ("no public source gives
# the boundary as a coordinate... initialised at the pocket line and
# tuned"). Ours, labelled as ours -- roughly shoulder-to-chest, a stand-in
# for "half canvas" until a real pocket-line coordinate exists.
CANVAS_V_START = 0.5
# Chapter 14: "Pocket welts, flaps -- Applied to the forepart." No sourced
# location exists (unlike the seam contract, pocket placement isn't part of
# chapter 09's graph at all yet) -- ours, unsourced, a plausible breast-
# pocket-ish spot: upper chest (below the neckline curve, which starts at
# NECK_V_START), roughly mid-panel width. Given as a grid (iu, iv) pair
# directly, the same indexing forepart()'s own "canvas" area already uses.
POCKET_IV = 13  # v = 13/16 = 0.8125
POCKET_IU = (3, 4)
# Back's half of seam.neckline. back_panel()'s shoulder row (v=1) already
# reserves 3 unclaimed centre points between shoulder_R and shoulder_L
# (indices ARITY_SHOULDER..nu-ARITY_SHOULDER when nu=16, ARITY_SHOULDER=7 ->
# 7,8,9) -- this dips those points down to make an actual back-neck curve
# instead of a flat shoulder line straight across. Depth is ours, unsourced,
# same class of gap as NECK_V_START/ARMSCYE_ARITY.
BACK_NECK_DEPTH = 0.045
BACK_NECK_U0 = ARITY_SHOULDER / 16
BACK_NECK_U1 = (16 - ARITY_SHOULDER) / 16


def _back_neck_dz(u, v):
    """z offset (downward) for back_panel()'s neck dip -- zero everywhere
    except the shoulder row's reserved centre points."""
    if v < 0.999 or u <= BACK_NECK_U0 or u >= BACK_NECK_U1:
        return 0.0
    mid = (BACK_NECK_U0 + BACK_NECK_U1) / 2
    half = (BACK_NECK_U1 - BACK_NECK_U0) / 2
    return BACK_NECK_DEPTH * (1.0 - abs(u - mid) / half)

# PARAM — chapter 14 records no public figure. Ours, and labelled as ours.
FRONT_OVERLAP = 0.050
# Must clear dress_form()'s deepest cross-section (chest, d=0.130) or panels
# start already inside the collider -- verified empirically 2026-08-17: at the
# old 0.055 value the whole centre-front/side edge started inside the form,
# and the solver resolved that interpenetration by exploding rather than
# settling (16.5m freefall by frame 90). 0.20 cleared it but, combined with the
# forepart 0.10m outward bulge (see forepart()'s `y`), left side seams to close
# a ~0.5m gap at full sewing force -- the actual cause of the continued
# freefall (see sew.bake()'s ramp). 0.16 keeps ~0.03m margin over the deepest
# section (enough given the solver's own distance_min=0.010) while cutting
# that closing distance to ~0.42m.
START_GAP = 0.16


def _waist_factor(v: float) -> float:
    """Waist suppression: panels are narrower at the waist than at chest or
    hem. A jacket without it reads as a sack, which is what the P1.0 slab was.
    `v` is 0 at the hem, 1 at the shoulder."""
    waist_v = 0.42
    if v < waist_v:
        t = v / waist_v
        return 1.0 + (WAIST_HALF / HEM_HALF - 1.0) * t
    t = (v - waist_v) / (1.0 - waist_v)
    return (WAIST_HALF / HEM_HALF) + (CHEST_HALF / HEM_HALF - WAIST_HALF / HEM_HALF) * t


def _arc(cx, cz, rx, rz, a0, a1, steps):
    """Points along an elliptical arc in the (x, z) plane: `steps` even
    divisions from angle a0 to a1 inclusive (steps + 1 points)."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = a0 + (a1 - a0) * t
        pts.append((cx + rx * math.cos(a), cz + rz * math.sin(a)))
    return pts


def _grid_from_outline(name, outline_pts, y):
    """Build a flat panel from an explicit outline rather than a
    parametric (u, v) function — for a shape like the sleeve cap, whose
    top edge (an arc) and bottom edge (two corner points) don't share a
    point count. `outline_pts` is the top edge plus the two bottom
    corners appended last; the bottom edge is the straight line between
    those two corners, sampled at the same u resolution as the top edge
    so both rows stay the same length, keeping this the same even-quads
    topology every other panel in this file uses (see _grid's own
    docstring for why that matters to the cloth solver).

    `y` is either a constant (the old flat-panel behaviour) or a callable
    `y(u)` for a panel pre-curved across its width -- see `sleeve_cap()`'s
    use of this for why: the armscye/sleeve soft-pin was fully ruled out
    (11_EXECUTION_STATE.md) because it fights the adjacent rigid shoulder
    pin regardless of weight, so the fix has to be starting the sleeve
    closer to its worn (wrapped-around-the-arm) shape instead of asking
    any pin to pull it there.

    Returns `(obj, boundaries)` like `_grid` -- `boundaries["v0"]` is the
    top-edge (outline) row, in `outline_pts` order, for callers that need to
    slice it into named seams (e.g. `sleeve_cap()`'s front/back armscye).
    """
    top = outline_pts[:-2]
    bl, br = outline_pts[-2], outline_pts[-1]
    nu = len(top) - 1
    y_fn = y if callable(y) else (lambda u: y)

    def fn(u, v):
        iu = min(int(round(u * nu)), nu)
        tx, tz = top[iu]
        bx = bl[0] + (br[0] - bl[0]) * u
        bz = bl[1] + (br[1] - bl[1]) * u
        x = tx + (bx - tx) * v
        z = tz + (bz - tz) * v
        return Vector((x, y_fn(u), z))

    return _grid(name, fn, nu=nu, nv=1)


def _grid(name: str, fn, nu: int, nv: int):
    """Build a quad grid from a position function fn(u, v) -> Vector.

    Returns (object, boundary dict). Even quads are what the cloth solver
    wants; the n-gon-plus-subdivide approach fans badly at the centre.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    grid = []
    for iv in range(nv + 1):
        row = []
        for iu in range(nu + 1):
            row.append(bm.verts.new(fn(iu / nu, iv / nv)))
        grid.append(row)
    for iv in range(nv):
        for iu in range(nu):
            bm.faces.new((grid[iv][iu], grid[iv][iu + 1],
                          grid[iv + 1][iu + 1], grid[iv + 1][iu]))
    bm.verts.index_update()
    boundaries = {
        "u0": [grid[iv][0].index for iv in range(nv + 1)],
        "u1": [grid[iv][nu].index for iv in range(nv + 1)],
        "v0": [grid[0][iu].index for iu in range(nu + 1)],
        "v1": [grid[nv][iu].index for iu in range(nu + 1)],
    }
    bm.to_mesh(mesh)
    bm.free()
    return obj, boundaries


def _flip_faces(obj):
    """Reverse face winding without touching vertex indices or order, so
    named seam boundaries (which are vertex-index lists) stay valid."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _front_neck_x(side, v):
    """Centre-front x at height `v`: flat at `FRONT_OVERLAP` below
    `NECK_V_START`, opening outward to `NECK_HALF` at the shoulder -- the
    V-notch that makes a neckline instead of a shoulder seam running flush
    to centre front. A straight two-segment curve, not a tailored one;
    broad-first coverage, not a tuned shape."""
    base = side * FRONT_OVERLAP * 0.5
    if v <= NECK_V_START:
        return base
    t = (v - NECK_V_START) / (1.0 - NECK_V_START)
    return base + (side * NECK_HALF - base) * t


def forepart(side: int):
    """Front panel. side=-1 wearer's right, +1 wearer's left.

    u: 0 at centre front -> 1 at the side seam.
    v: 0 at the hem -> 1 at the shoulder.
    """
    def fn(u, v):
        wf = _waist_factor(v)
        x_cf = _front_neck_x(side, v)
        x_side = side * HEM_HALF * wf * 0.96
        x = x_cf + (x_side - x_cf) * u
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * v
        # Front panels start slightly forward of the form so the solver pulls
        # them back onto it rather than resolving an initial interpenetration.
        y = -START_GAP - 0.10 * math.sin(u * math.pi * 0.5)
        return Vector((x, y, z))

    obj, b = _grid(f"forepart_{'L' if side > 0 else 'R'}", fn,
                   nu=ARITY_SHOULDER - 1, nv=ARITY_VERTICAL - 1)
    if side < 0:
        # side=-1's x mapping mirrors relative to side=+1 (x decreases with u
        # instead of increasing), which inverts this panel's face winding
        # relative to its mirror twin even though _grid()'s own index order
        # never changes. Verified empirically 2026-08-17: the joined garment
        # had exactly one panel's worth of faces (96 of 448) wound opposite
        # the rest, and cloth collision needs consistent normals to resolve
        # penetration -- this was the real cause of the free-fall, not mass
        # or friction.
        _flip_faces(obj)
    cf, side_edge = b["u0"], b["u1"]
    nu_local, nv_local = ARITY_SHOULDER - 1, ARITY_VERTICAL - 1
    canvas_iv0 = round(CANVAS_V_START * nv_local)
    # Not a seam -- an area, for setup_cloth()'s vertex_group_bending. _grid()
    # adds verts in strict iv-major, iu-minor order (see its own loop), so
    # index = iv*(nu+1)+iu is exact, not approximate.
    canvas = [iv * (nu_local + 1) + iu
              for iv in range(canvas_iv0, nv_local + 1)
              for iu in range(nu_local + 1)]
    pocket = [POCKET_IV * (nu_local + 1) + iu for iu in POCKET_IU]
    return obj, {
        # centre front, hem -> neck start only; neckline takes over above that.
        "cf": cf[: NECK_INDEX + 1],
        "neckline": cf[NECK_INDEX:],  # neck start -> shoulder/neck corner
        # side seam, hem -> underarm only; armscye takes over above that.
        "side": side_edge[: UNDERARM_INDEX + 1],
        "armscye": side_edge[UNDERARM_INDEX:],  # underarm -> shoulder, shares the underarm point with "side"
        "hem": b["v0"],
        "shoulder": b["v1"],  # neck -> armhole, ordered cf -> side
        "canvas": canvas,  # area, not a seam -- upper chest, for canvas stiffness
        "pocket": pocket,  # 2-point anchor for pocket_welt()'s pin
    }


def back_panel():
    """u: 0 at wearer's right -> 1 at wearer's left. v: hem -> shoulder."""
    def fn(u, v):
        wf = _waist_factor(v)
        x = (-HEM_HALF * wf * 0.96) + (2 * HEM_HALF * wf * 0.96) * u
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * v - _back_neck_dz(u, v)
        y = START_GAP + 0.10 * math.sin(u * math.pi)
        return Vector((x, y, z))

    obj, b = _grid("back", fn, nu=16, nv=ARITY_VERTICAL - 1)
    nu = 16
    v1 = b["v1"]
    # Split the top edge into two shoulder seams, each ordered from the armhole
    # inward to the neck so both match their forepart counterpart's direction,
    # and a neckline_back seam from the centre points the dip above pulled down.
    right_shoulder = list(reversed(v1[: ARITY_SHOULDER]))
    left_shoulder = v1[nu - ARITY_SHOULDER + 1 :]
    neckline_back = v1[ARITY_SHOULDER : nu - ARITY_SHOULDER + 1]
    side_R, side_L = b["u0"], b["u1"]
    return obj, {
        "side_R": side_R[: UNDERARM_INDEX + 1],
        "side_L": side_L[: UNDERARM_INDEX + 1],
        "armscye_R": side_R[UNDERARM_INDEX:],  # underarm -> shoulder
        "armscye_L": side_L[UNDERARM_INDEX:],
        "hem": b["v0"],
        "shoulder_R": right_shoulder,
        "shoulder_L": left_shoulder,
        "neckline": neckline_back,  # the 3 centre points, dipped by _back_neck_dz
    }


def side_body(side: int):
    """Side body panel. side=-1 wearer's right, +1 wearer's left.

    Chapter 14's panel set: "Side body x2 -- waist shaping; bridges forepart
    to back." Chapter 14 also flags its exact shape/placement as unsourced
    ("varies by system, take Vincent's, since we derive from it") -- this is
    a minimal 2-column strip (front edge, back edge; no interior detail),
    broad structural coverage rather than a tuned Vincent-derived shape,
    per this session's build-broad-first-then-deepen direction.

    u: 0 at the front edge (joins forepart's `side`) -> 1 at the back edge
    (joins back's `side_R`/`side_L`). v: hem -> underarm, matching the same
    `UNDERARM_INDEX`-point range forepart's/back's own lower side seam uses,
    since this panel now sits between them instead of them joining directly.
    """
    def fn(u, v):
        v_scaled = v * (UNDERARM_INDEX / (ARITY_VERTICAL - 1))
        wf = _waist_factor(v_scaled)
        x = side * HEM_HALF * wf * 0.96
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * v_scaled
        # Endpoints match forepart().side's and back_panel().side_R/L's own y
        # formulas at u=1 and u=0 respectively, so the seam this replaces
        # starts about as far apart as the direct join it replaces did.
        y_front = -(START_GAP + 0.10)
        y_back = START_GAP
        y = y_front + (y_back - y_front) * u
        return Vector((x, y, z))

    obj, b = _grid(f"side_body_{'L' if side > 0 else 'R'}", fn, nu=1, nv=UNDERARM_INDEX)
    return obj, {
        "front": b["u0"],  # hem -> underarm, joins forepart().side
        "back": b["u1"],   # hem -> underarm, joins back_panel().side_R/L
    }


def pocket_welt(side: int):
    """Minimal welt-pocket stand-in, side=-1 wearer's right, +1 left.

    Chapter 14: "Pocket welts, flaps -- Applied to the forepart." No sourced
    location or shape exists for this (POCKET_IV/POCKET_IU above are ours).
    A small flat strip whose top edge is pinned flat against forepart's own
    surface at the chosen anchor points -- same technique as collar_stub()'s
    neck edge: reproduce forepart()'s exact position formula rather than an
    independently-computed one, so the pin target and the seam it's sewn to
    coincide exactly (the lesson from the sleeve-tip pin failures in
    11_EXECUTION_STATE.md). Hangs free below -- a welt, not a full pocket
    with a bag and opening.
    """
    width_span = 0.03  # how far it stands off the body, ours, unsourced

    nu_local, nv_local = ARITY_SHOULDER - 1, ARITY_VERTICAL - 1
    u0, u1 = POCKET_IU[0] / nu_local, POCKET_IU[1] / nu_local
    v0 = POCKET_IV / nv_local

    def body_pos(u):
        wf = _waist_factor(v0)
        x_cf = _front_neck_x(side, v0)
        x_side = side * HEM_HALF * wf * 0.96
        x = x_cf + (x_side - x_cf) * u
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * v0
        y = -START_GAP - 0.10 * math.sin(u * math.pi * 0.5)
        return x, y, z

    def fn(u, v):
        uu = u0 + (u1 - u0) * u
        x, y, z = body_pos(uu)
        return Vector((x, y - width_span * v, z))  # v=0 at the body, v=1 standing off

    obj, b = _grid(f"pocket_{'L' if side > 0 else 'R'}", fn, nu=1, nv=1)
    return obj, {"anchor": b["v0"]}  # body-adjacent edge, pinned to forepart().pocket


def collar_stub(side: int):
    """Minimal under-collar stand-in, side=-1 wearer's right, +1 left.

    Chapter 14: "seam.neckline -- under-collar -> back neckline." A real
    collar wraps continuously from one front neck edge, around the back
    neckline, to the other. This is the front half -- a small flat strip
    sewn to one forepart's `neckline` edge on its inner (`u0`) edge, free
    (unsewn) on its outer (`u1`) edge, and sewn end-to-end at its shoulder
    end (`v1`, the far end from centre front, both the inner and outer
    corner) to `collar_back_stub()`'s matching end -- see that function's
    docstring for the other two pieces and how the three now close into
    one continuous wrap.
    """
    width = 0.045  # collar stand width, ours, unsourced
    nv = ARITY_VERTICAL - 1 - NECK_INDEX  # matches forepart().neckline's arity

    def fn(u, v):
        index = NECK_INDEX + v * nv
        vv = index / (ARITY_VERTICAL - 1)  # forepart()'s own v-sampling, exactly
        base_x = _front_neck_x(side, vv)
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * vv
        x = base_x + side * width * u
        y = -START_GAP - 0.02  # just outside where the neckline starts
        return Vector((x, y, z))

    obj, b = _grid(f"collar_{'L' if side > 0 else 'R'}", fn, nu=1, nv=nv)
    return obj, {
        "neck": b["u0"],   # matches forepart().neckline's point count and v-order
        "end": b["v1"],    # shoulder end (2 pts: inner u=0, outer u=1) -> collar_back
    }


def collar_back_stub():
    """Minimal under-collar back-neck stand-in -- see `collar_stub()`'s
    docstring. Sewn to `back_panel()`'s `neckline` boundary (the 3 centre
    points its own neck dip pulled down) on its inner (`u0`) edge.

    Chapter 09's arc-length-parameterized, fixed-arity seam contract makes
    the three collar pieces close into one continuous wrap cheaply: this
    panel's `v0` end sits at `BACK_NECK_U0` (the x-negative side, wearer's
    right) and its `v1` end at `BACK_NECK_U1` (x-positive, wearer's left) --
    both, like `collar_stub().end`, are 2-point edges in the same
    [inner (u=0), outer (u=1)] order, so `v0`/`v1` pair directly against
    `collar_R`/`collar_L`'s `end` with no resampling needed.
    """
    width = 0.045

    def fn(u, v):
        u_back = BACK_NECK_U0 + v * (BACK_NECK_U1 - BACK_NECK_U0)
        wf = _waist_factor(1.0)
        x = (-HEM_HALF * wf * 0.96) + (2 * HEM_HALF * wf * 0.96) * u_back
        z = Z_HEM + (Z_SHOULDER - Z_HEM) - _back_neck_dz(u_back, 1.0)
        y = START_GAP + 0.10 * math.sin(u_back * math.pi) + width * u + 0.02
        return Vector((x, y, z))

    obj, b = _grid("collar_back", fn, nu=1, nv=2)
    return obj, {
        "neck": b["u0"],   # matches back_panel().neckline's point count and u-order
        "end_R": b["v0"],  # x-negative end (wearer's right) -> collar_R.end
        "end_L": b["v1"],  # x-positive end (wearer's left) -> collar_L.end
    }


def sleeve_cap(side: int):
    """Sleeve cap panel. side=-1 wearer's right, +1 wearer's left.

    Built as a flat panel like the body panels, not a pre-formed tube --
    the cloth solver drapes it into shape once sewn, same as forepart and
    back. Its top edge is the sleevehead arc (chapter 14: 8-10% longer
    than its armscye, via SLEEVEHEAD_EASE); its bottom edge tapers to a
    single pair of cuff corners rather than a full hem width.

    Returns named `front`/`back` boundaries on the sleevehead arc, each
    `ARMSCYE_ARITY` points sharing the arc's centre (top) point, so they
    join 1:1 to `forepart().armscye` and `back_panel().armscye_L/R` --
    equal point count on both sides of each seam, but the sleeve's total
    arc length is `SLEEVEHEAD_EASE` (chapter 14: 8-10%) longer than the
    armscye it closes onto. That length mismatch, not any special spring
    math, is where the ease comes from: pulling matched vertex pairs
    together forces the sleeve's extra length to gather between them.
    """
    cap_w = (CHEST_HALF - WAIST_HALF) * 2.0 + 0.16  # armscye-scaled cap width, ours
    top_z = Z_SHOULDER - SHOULDER_SETBACK
    length = 0.58  # elbow-length cap panel; cuff finishing is a later pass
    x_off = side * (HEM_HALF * 0.96 + 0.02)

    # 2*(ARMSCYE_ARITY-1) steps -> 2*ARMSCYE_ARITY-1 points, split evenly
    # into a front half and a back half that share the centre (top) point --
    # matching forepart's and back's ARMSCYE_ARITY-point armscye boundaries.
    arc_steps = 2 * (ARMSCYE_ARITY - 1)
    center = ARMSCYE_ARITY - 1
    pts = _arc(cx=0.0, cz=top_z - 0.12, rx=cap_w * 0.5 * SLEEVEHEAD_EASE,
               rz=0.13, a0=math.pi, a1=0.0, steps=arc_steps)
    pts.append((cap_w * 0.34, top_z - length))
    pts.append((-cap_w * 0.34, top_z - length))

    # Pre-curved cross-section (a shallow half-tube, not flat), so the
    # sleeve starts closer to wrapping the arm instead of relying on a pin
    # or a spring to bend it there from flat. Chosen because the armscye/
    # sleeve soft-pin approach was fully ruled out at every weight tested,
    # 0.15-0.5 (11_EXECUTION_STATE.md) -- it fights the adjacent rigid
    # shoulder pin regardless of strength, so the fix has to be geometric,
    # not another force. "front" (u=0) curves to negative y, matching
    # forepart's negative-y convention; "back" (u=1) curves to positive y,
    # matching back_panel()'s -- the same sign convention those panels
    # already use, not a new one. Depth is ours, unsourced, sized against
    # arm_form()'s own bicep radius (0.075) with margin.
    CURVE_DEPTH = 0.06

    def sleeve_y(u):
        return -CURVE_DEPTH * math.cos(u * math.pi)

    obj, b = _grid_from_outline(f"sleeve_{'L' if side > 0 else 'R'}",
                                 [(x + x_off, z) for (x, z) in pts], y=sleeve_y)
    sleevehead = b["v0"]
    return obj, {
        # Both ordered underarm-equivalent -> shoulder (ascending height),
        # matching forepart().armscye / back_panel().armscye_L/R's direction.
        "front": sleevehead[: center + 1],
        "back": list(reversed(sleevehead[center:])),
        "tip": [sleevehead[center]],  # the shared shoulder point of both halves
    }


def dress_form():
    """A tailor's dress form, generated rather than licensed.

    D-18 permits a MakeHuman export under CC0, but a form is a far simpler
    shape than a body and the ghost-mannequin render never shows a head or
    hands — so generating it removes the dependency entirely, which chapter 13
    called the cleanest answer.
    """
    mesh = bpy.data.meshes.new("dress_form")
    obj = bpy.data.objects.new("dress_form", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    sections = [
        (Z_HEM - 0.05, HEM_HALF * 0.78, 0.126),
        (Z_HEM + (Z_CHEST - Z_HEM) * 0.42, WAIST_HALF * 0.78, 0.110),
        (Z_CHEST, CHEST_HALF * 0.82, 0.130),
        (Z_SHOULDER - 0.02, CHEST_HALF * 0.78, 0.116),
        (Z_SHOULDER + 0.06, NECK_HALF * 1.10, 0.060),
    ]
    prev = None
    for (z, hw, d) in sections:
        ring = []
        for i in range(24):
            a = (i / 24) * 2 * math.pi
            ring.append(bm.verts.new(Vector((hw * math.sin(a), d * math.cos(a), z))))
        if prev:
            for i in range(24):
                j = (i + 1) % 24
                bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
        prev = ring
    bm.to_mesh(mesh)
    bm.free()
    obj.modifiers.new("subsurf", "SUBSURF").levels = 1
    return obj


def arm_form(side: int):
    """A simple tapered arm collider, generated like `dress_form()` and
    never rendered for the same reason (ch.12 V1: no head or hands shown).

    Without this, the sleeve has nothing to drape over: gravity and the
    armscye seam pull it toward the shoulder with no arm-shaped volume
    underneath to fill, so it collapses into a crumpled mass at the
    attachment line instead of hanging as a sleeve -- verified empirically
    2026-08-18 (first sleeve render, no arm collider present). Bicep/wrist
    taper and placement are sized to fill `sleeve_cap()`'s own footprint
    (same `x_off`, same `length`), not sourced from any body-measurement
    reference -- ours, labelled as ours, same as the rest of this file's
    unsourced parameters.
    """
    x_off = side * (HEM_HALF * 0.96 + 0.02)  # sleeve_cap()'s own x_off
    top_z = Z_SHOULDER - SHOULDER_SETBACK
    length = 0.58  # sleeve_cap()'s own cap length

    mesh = bpy.data.meshes.new(f"arm_{'L' if side > 0 else 'R'}")
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    sections = [
        (top_z - 0.05, 0.075),
        (top_z - length * 0.5, 0.060),
        (top_z - length, 0.045),
    ]
    prev = None
    for (z, r) in sections:
        ring = []
        for i in range(16):
            a = (i / 16) * 2 * math.pi
            ring.append(bm.verts.new(Vector((x_off + r * math.sin(a), r * math.cos(a), z))))
        if prev:
            for i in range(16):
                j = (i + 1) % 16
                bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
        prev = ring
    bm.to_mesh(mesh)
    bm.free()
    obj.modifiers.new("subsurf", "SUBSURF").levels = 1
    return obj


# Chapter 09's seam contract, declared rather than discovered. Each entry names
# two seams that a tailor actually stitches, and both sides must already agree
# on arity — which the grid construction guarantees.
#
# The side seam routes through side_body() rather than joining forepart to
# back directly, per chapter 14's panel set ("side body x2 -- ... bridges
# forepart to back").
BODY_SEAMS = [
    ("forepart_R", "side", "side_body_R", "front"),
    ("side_body_R", "back", "back", "side_R"),
    ("forepart_L", "side", "side_body_L", "front"),
    ("side_body_L", "back", "back", "side_L"),
    ("forepart_R", "shoulder", "back", "shoulder_R"),
    ("forepart_L", "shoulder", "back", "shoulder_L"),
]

# The armscye seam (chapter 14: "seam.armscye -- upper + under sleeve ->
# forepart, back, side body"). Side body's own armscye contribution is not
# modelled in this prototype (broad-first: it declares only the `side` seam
# above) -- each sleeve's cap sews directly to forepart's and back's armscye
# boundaries, two seam pairs per arm, one for the front quarter and one for
# the back quarter, meeting at the shoulder point the way a real armscye does.
SLEEVE_SEAMS = [
    ("forepart_R", "armscye", "sleeve_R", "front"),
    ("back", "armscye_R", "sleeve_R", "back"),
    ("forepart_L", "armscye", "sleeve_L", "front"),
    ("back", "armscye_L", "sleeve_L", "back"),
]

# seam.neckline (chapter 14): under-collar -> back neckline, plus the two
# shoulder-end seams that close collar_R/collar_L/collar_back into one
# continuous wrap -- see collar_stub()'s and collar_back_stub()'s
# docstrings.
COLLAR_SEAMS = [
    ("forepart_R", "neckline", "collar_R", "neck"),
    ("forepart_L", "neckline", "collar_L", "neck"),
    ("back", "neckline", "collar_back", "neck"),
    ("collar_R", "end", "collar_back", "end_R"),
    ("collar_L", "end", "collar_back", "end_L"),
]

# Pocket welts (chapter 14: "Applied to the forepart"). Each welt's anchor
# edge is pinned, not just sewn -- see pocket_welt()'s docstring.
POCKET_SEAMS = [
    ("forepart_R", "pocket", "pocket_R", "anchor"),
    ("forepart_L", "pocket", "pocket_L", "anchor"),
]
