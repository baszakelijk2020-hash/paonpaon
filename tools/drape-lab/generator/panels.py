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

    Returns `(obj, boundaries)` like `_grid` -- `boundaries["v0"]` is the
    top-edge (outline) row, in `outline_pts` order, for callers that need to
    slice it into named seams (e.g. `sleeve_cap()`'s front/back armscye).
    """
    top = outline_pts[:-2]
    bl, br = outline_pts[-2], outline_pts[-1]
    nu = len(top) - 1

    def fn(u, v):
        iu = min(int(round(u * nu)), nu)
        tx, tz = top[iu]
        bx = bl[0] + (br[0] - bl[0]) * u
        bz = bl[1] + (br[1] - bl[1]) * u
        x = tx + (bx - tx) * v
        z = tz + (bz - tz) * v
        return Vector((x, y, z))

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


def forepart(side: int):
    """Front panel. side=-1 wearer's right, +1 wearer's left.

    u: 0 at centre front -> 1 at the side seam.
    v: 0 at the hem -> 1 at the shoulder.
    """
    def fn(u, v):
        wf = _waist_factor(v)
        x_cf = side * FRONT_OVERLAP * 0.5
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
    side = b["u1"]
    return obj, {
        "cf": b["u0"],        # centre front, hem -> shoulder
        # side seam, hem -> underarm only; armscye takes over above that.
        "side": side[: UNDERARM_INDEX + 1],
        "armscye": side[UNDERARM_INDEX:],  # underarm -> shoulder, shares the underarm point with "side"
        "hem": b["v0"],
        "shoulder": b["v1"],  # neck -> armhole, ordered cf -> side
    }


def back_panel():
    """u: 0 at wearer's right -> 1 at wearer's left. v: hem -> shoulder."""
    def fn(u, v):
        wf = _waist_factor(v)
        x = (-HEM_HALF * wf * 0.96) + (2 * HEM_HALF * wf * 0.96) * u
        z = Z_HEM + (Z_SHOULDER - Z_HEM) * v
        y = START_GAP + 0.10 * math.sin(u * math.pi)
        return Vector((x, y, z))

    obj, b = _grid("back", fn, nu=16, nv=ARITY_VERTICAL - 1)
    nu = 16
    v1 = b["v1"]
    # Split the top edge into two shoulder seams, each ordered from the armhole
    # inward to the neck so both match their forepart counterpart's direction.
    right_shoulder = list(reversed(v1[: ARITY_SHOULDER]))
    left_shoulder = v1[nu - ARITY_SHOULDER + 1 :]
    side_R, side_L = b["u0"], b["u1"]
    return obj, {
        "side_R": side_R[: UNDERARM_INDEX + 1],
        "side_L": side_L[: UNDERARM_INDEX + 1],
        "armscye_R": side_R[UNDERARM_INDEX:],  # underarm -> shoulder
        "armscye_L": side_L[UNDERARM_INDEX:],
        "hem": b["v0"],
        "shoulder_R": right_shoulder,
        "shoulder_L": left_shoulder,
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

    obj, b = _grid_from_outline(f"sleeve_{'L' if side > 0 else 'R'}",
                                 [(x + x_off, z) for (x, z) in pts], y=0.0)
    sleevehead = b["v0"]
    return obj, {
        # Both ordered underarm-equivalent -> shoulder (ascending height),
        # matching forepart().armscye / back_panel().armscye_L/R's direction.
        "front": sleevehead[: center + 1],
        "back": list(reversed(sleevehead[center:])),
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
BODY_SEAMS = [
    ("forepart_R", "side", "back", "side_R"),
    ("forepart_L", "side", "back", "side_L"),
    ("forepart_R", "shoulder", "back", "shoulder_R"),
    ("forepart_L", "shoulder", "back", "shoulder_L"),
]

# The armscye seam (chapter 14: "seam.armscye -- upper + under sleeve ->
# forepart, back, side body"). This prototype has no side body yet, so each
# sleeve's cap sews directly to forepart's and back's armscye boundaries --
# two seam pairs per arm, one for the front quarter and one for the back
# quarter, meeting at the shoulder point the way a real armscye does.
SLEEVE_SEAMS = [
    ("forepart_R", "armscye", "sleeve_R", "front"),
    ("back", "armscye_R", "sleeve_R", "back"),
    ("forepart_L", "armscye", "sleeve_L", "front"),
    ("back", "armscye_L", "sleeve_L", "back"),
]
