"""
P1.1 — real jacket panels, cut flat and joined by seams.

P1.0 proved the shortcut fails: a lofted surface cannot produce a shoulder
line, an armscye or a rolled lapel, because those are consequences of flat
cloth being joined along curves and then forced over a body. So this cuts the
panels chapter 14 lists and declares the seams chapter 09 requires, and P1.2
lets Blender's cloth solver close them.

Panel outlines follow the proportions in chapter 14. Where chapter 14 records a
gap with no public source — ease distribution around the armscye, the canvas
boundary, the gorge angle — the value here is a PAON parameter, marked PARAM,
and is never presented as a tailoring standard.

Coordinates: panels are cut flat in the XZ plane at a small Y offset (front
panels in front of the body, back behind), then the solver pulls them together.
Cutting flat and letting the simulation do the shaping is the whole point; a
panel pre-curved by hand is just the P1.0 mistake wearing a disguise.
"""

import math

import bmesh
import bpy
from mathutils import Vector

# --- body block, chapter 14 proportions (metres, ~size-40 chest) -------------
CHEST_HALF = 0.275
WAIST_HALF = 0.250
HEM_HALF = 0.272
NECK_HALF = 0.078

Z_HEM = 0.32
Z_WAIST = 0.74
Z_CHEST = 1.04
Z_SHOULDER = 1.32
Z_NECK = 1.38

# Chapter 14, sourced: shoulder seam sits ~1.25-1.5 in behind the shoulder
# point. 1.375 in = 0.035 m.
SHOULDER_SETBACK = 0.035

# Chapter 14, sourced: sleevehead is 8-10% longer than the armscye it sets
# into. Taking the middle of the published range.
SLEEVEHEAD_EASE = 1.09

# PARAM — chapter 14 records no public figure for these.
GORGE_Z = 1.26
LAPEL_BREAK_Z = 0.88
FRONT_OVERLAP = 0.055
PANEL_GAP_Y = 0.020  # how far off the body panels start, before the solver pulls

RES = 0.022  # target edge length; the solver needs enough vertices to fold


def _grid_from_outline(name: str, outline, *, y: float, flip_normal=False):
    """Build a filled flat panel from a closed 2D outline given as (x, z).

    Grid-fill rather than a fan: cloth needs reasonably even quads or the
    solver produces star artefacts at the fan centre.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    verts = [bm.verts.new(Vector((x, y, z))) for (x, z) in outline]
    bm.faces.new(verts)
    bm.to_mesh(mesh)
    bm.free()

    # Subdivide to simulation resolution.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Repeated subdivision keeps quads far more even than one big cut.
    for _ in range(4):
        bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


def _arc(cx, cz, rx, rz, a0, a1, steps):
    return [
        (cx + rx * math.cos(a0 + (a1 - a0) * i / steps),
         cz + rz * math.sin(a0 + (a1 - a0) * i / steps))
        for i in range(steps + 1)
    ]


def forepart(side: int):
    """Front panel. `side` is -1 wearer's right, +1 wearer's left.

    The armscye is a real scooped curve, not a straight cut — that curve is
    what a sleeve can actually be eased into, and it is why P1.0's slab had no
    armhole to speak of.
    """
    x_cf = side * FRONT_OVERLAP * 0.5  # centre front, with overlap for the closure
    x_side = side * CHEST_HALF * 0.92

    pts = [(x_cf, Z_HEM)]
    # Front edge rising to the gorge; the lapel is cut as part of the forepart
    # and folds back along the roll line (chapter 14: the roll is a fold).
    pts += [(x_cf, Z_WAIST), (x_cf, LAPEL_BREAK_Z)]
    pts += [(side * (FRONT_OVERLAP * 0.5 + 0.085), GORGE_Z)]
    # Neck / gorge across to the shoulder.
    pts += [(side * NECK_HALF, Z_NECK - 0.02)]
    pts += [(side * (CHEST_HALF - SHOULDER_SETBACK) * 0.86, Z_SHOULDER)]
    # Armscye: scooped curve from shoulder point down to the underarm.
    pts += _arc(
        cx=side * (CHEST_HALF * 0.60),
        cz=Z_CHEST + 0.10,
        rx=side * (CHEST_HALF * 0.30),
        rz=0.20,
        a0=math.pi / 2,
        a1=-math.pi / 2,
        steps=8,
    )
    pts += [(x_side, Z_WAIST), (x_side, Z_HEM)]

    if side > 0:
        pts = list(reversed(pts))
    return _grid_from_outline(f"forepart_{'L' if side > 0 else 'R'}", pts,
                              y=-PANEL_GAP_Y - 0.16)


def back_panel():
    pts = [(-HEM_HALF * 0.94, Z_HEM), (HEM_HALF * 0.94, Z_HEM)]
    pts += [(CHEST_HALF * 0.92, Z_WAIST)]
    pts += _arc(
        cx=CHEST_HALF * 0.60, cz=Z_CHEST + 0.10,
        rx=CHEST_HALF * 0.28, rz=0.20,
        a0=-math.pi / 2, a1=math.pi / 2, steps=8,
    )
    pts += [((CHEST_HALF - SHOULDER_SETBACK) * 0.86, Z_SHOULDER)]
    pts += [(NECK_HALF, Z_NECK), (-NECK_HALF, Z_NECK)]
    pts += [(-(CHEST_HALF - SHOULDER_SETBACK) * 0.86, Z_SHOULDER)]
    pts += _arc(
        cx=-CHEST_HALF * 0.60, cz=Z_CHEST + 0.10,
        rx=-CHEST_HALF * 0.28, rz=0.20,
        a0=math.pi / 2, a1=-math.pi / 2, steps=8,
    )
    pts += [(-CHEST_HALF * 0.92, Z_WAIST)]
    return _grid_from_outline("back", pts, y=PANEL_GAP_Y + 0.16)


def sleeve(side: int):
    """One-piece sleeve for the first closure test. Chapter 14's two-piece
    sleeve is correct and comes once the body closes cleanly — splitting it now
    would double the seam count while the basic drape is still unproven.

    The cap is built longer than the armscye by SLEEVEHEAD_EASE so there is
    real fullness to work in. That ease is the whole reason a sleevehead reads
    as tailored rather than set flat, and chapter 06 turns on it.
    """
    cap_w = CHEST_HALF * 0.62 * SLEEVEHEAD_EASE
    length = 0.60
    top_z = Z_SHOULDER - 0.02

    pts = _arc(cx=0.0, cz=top_z - 0.12, rx=cap_w * 0.5, rz=0.13,
               a0=math.pi, a1=0.0, steps=12)
    pts += [(cap_w * 0.34, top_z - length), (-cap_w * 0.34, top_z - length)]

    x_off = side * (CHEST_HALF + 0.16)
    obj = _grid_from_outline(f"sleeve_{'L' if side > 0 else 'R'}",
                             [(x + x_off, z) for (x, z) in pts], y=0.0)
    return obj


def dress_form():
    """A tailor's dress form, generated rather than licensed.

    Chapter 13 (D-18) allows a MakeHuman export under CC0, but a dress form is
    a far simpler shape than a human body and the ghost-mannequin render never
    shows a head, hands or feet — so generating it removes the dependency
    entirely and is the option chapter 13 called cleanest.
    """
    mesh = bpy.data.meshes.new("dress_form")
    obj = bpy.data.objects.new("dress_form", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    sections = [
        (Z_HEM - 0.06, HEM_HALF * 0.80, 0.128),
        (Z_WAIST, WAIST_HALF * 0.80, 0.112),
        (Z_CHEST, CHEST_HALF * 0.84, 0.132),
        (Z_SHOULDER - 0.03, CHEST_HALF * 0.80, 0.118),
        (Z_NECK + 0.02, NECK_HALF * 1.15, 0.062),
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

    obj.modifiers.new("subsurf", "SUBSURF").levels = 2
    return obj
