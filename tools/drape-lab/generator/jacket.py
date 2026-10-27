"""
P1.0 jacket geometry.

SCOPE, stated plainly so nobody mistakes this for the real generator: this
lofts a jacket *surface* from profile curves. It does NOT cut flat panels and
sew them with cloth simulation — that is P1.1 and P1.2, and each has its own
acceptance gate.

The reason for the split is that P1.0 asks one question: can PAON produce an
image that stands beside the reference? That is a question about shading,
light, shadow and edge fidelity. Sewing panels answers a different question,
and answering both at once would leave us unable to tell which one failed.

Proportions follow chapter 14's sourced facts where they exist — the shoulder
seam sitting behind the shoulder point, the two-piece sleeve, the roll line
being a fold rather than a seam. Where chapter 14 records a gap (the gorge
angle, the roll curve), the value here is a PAON parameter chosen by eye and
labelled as such, never presented as a tailoring standard.
"""

import bmesh
import bpy
from mathutils import Vector

# --- proportions, in metres on a ~size-40 chest ------------------------------
CHEST_HALF = 0.275
WAIST_HALF = 0.245
HEM_HALF = 0.268
SHOULDER_HALF = 0.225
NECK_HALF = 0.075

Z_HEM = 0.30
Z_WAIST = 0.72
Z_CHEST = 1.02
Z_SHOULDER = 1.30
Z_NECK = 1.36

DEPTH_CHEST = 0.145
DEPTH_WAIST = 0.125
DEPTH_HEM = 0.140
DEPTH_SHOULDER = 0.115

# Chapter 14, sourced: the shoulder seam sits about 1.25-1.5 in behind the
# shoulder point. 1.375 in ~= 0.035 m.
SHOULDER_SEAM_SETBACK = 0.035

# PAON parameters — chapter 14 records these as BLOCKED with no public source,
# so they are ours and are labelled as ours.
LAPEL_BREAK_Z = 0.86  # where the roll line meets the front closure
GORGE_Z = 1.24  # collar/lapel notch height
LAPEL_WIDTH = 0.088


def _ring(z: float, half_w: float, depth: float, front_open: float = 0.0):
    """One horizontal section of the body as a closed-ish loop of points.

    `front_open` splits the centre front so the jacket has a real opening with
    two edges rather than a sealed tube — without it there is nothing for the
    lining to show through and no edge for the lapel to roll from.
    """
    pts = []
    steps = 24
    for i in range(steps + 1):
        t = i / steps
        ang = -3.14159265 + t * 2 * 3.14159265
        x = half_w * __import__("math").sin(ang)
        y = depth * __import__("math").cos(ang)
        if front_open > 0.0 and y < 0 and abs(x) < front_open:
            continue
        pts.append(Vector((x, y, z)))
    return pts


def _loft(bm, rings):
    """Bridge consecutive rings into quads. Rings must share a vertex count."""
    prev_verts = None
    for ring in rings:
        verts = [bm.verts.new(p) for p in ring]
        if prev_verts is not None and len(verts) == len(prev_verts):
            for i in range(len(verts) - 1):
                bm.faces.new((prev_verts[i], prev_verts[i + 1], verts[i + 1], verts[i]))
        prev_verts = verts
    return prev_verts


def build_body() -> bpy.types.Object:
    """The jacket body: hem to shoulder, open at the centre front."""
    mesh = bpy.data.meshes.new("jacket_body")
    obj = bpy.data.objects.new("jacket_body", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    sections = [
        (Z_HEM, HEM_HALF, DEPTH_HEM, 0.030),
        (Z_WAIST, WAIST_HALF, DEPTH_WAIST, 0.026),
        (Z_CHEST, CHEST_HALF, DEPTH_CHEST, 0.020),
        (Z_SHOULDER, SHOULDER_HALF, DEPTH_SHOULDER, 0.014),
    ]
    rings = [_ring(z, w, d, o) for (z, w, d, o) in sections]
    counts = {len(r) for r in rings}
    if len(counts) != 1:
        # Uneven opening widths desynchronise the loft. Rebuild at a constant
        # opening rather than silently producing torn geometry.
        rings = [_ring(z, w, d, 0.022) for (z, w, d, _) in sections]
    _loft(bm, rings)

    bm.to_mesh(mesh)
    bm.free()

    obj.modifiers.new("subsurf", "SUBSURF").levels = 2
    solid = obj.modifiers.new("solidify", "SOLIDIFY")
    # Real suiting with canvas and lining reads around 2 mm at the edge. Zero
    # thickness is the single most common tell that a garment render is CG.
    solid.thickness = 0.0022
    solid.offset = 0.0
    return obj


def build_sleeve(side: int) -> bpy.types.Object:
    """A two-piece sleeve (chapter 14's panel set), lofted as one surface for
    P1.0. `side` is -1 for the wearer's right, +1 for the left."""
    mesh = bpy.data.meshes.new(f"sleeve_{side}")
    obj = bpy.data.objects.new(f"sleeve_{side}", mesh)
    bpy.context.scene.collection.objects.link(obj)

    import math

    bm = bmesh.new()
    shoulder_x = side * (SHOULDER_HALF - SHOULDER_SEAM_SETBACK * 0.5)
    rings = []
    steps = 7
    for i in range(steps + 1):
        t = i / steps
        # Slight outward then inward sweep: a sleeve hangs away from the body
        # at the elbow and returns at the cuff.
        x = shoulder_x + side * (0.052 * math.sin(t * 3.14159) + 0.014 * t)
        z = Z_SHOULDER - 0.055 - t * 0.545
        r = 0.077 - t * 0.026
        depth = 0.070 - t * 0.021
        pts = []
        for j in range(17):
            a = -3.14159265 + (j / 16) * 2 * 3.14159265
            pts.append(Vector((x + r * math.sin(a), depth * math.cos(a) - 0.012, z)))
        rings.append(pts)
    _loft(bm, rings)
    bm.to_mesh(mesh)
    bm.free()

    obj.modifiers.new("subsurf", "SUBSURF").levels = 2
    solid = obj.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = 0.0022
    return obj


def build_lapel(side: int) -> bpy.types.Object:
    """The lapel, as a rolled fold rather than a seam.

    Chapter 14's correction matters here: the roll line is NOT a seam, so it is
    modelled as a curved fold. A lapel that creases along a straight hard line
    reads as cheap immediately, and it is the first thing chapter 06 asks the
    panel to judge.
    """
    import math

    mesh = bpy.data.meshes.new(f"lapel_{side}")
    obj = bpy.data.objects.new(f"lapel_{side}", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    steps = 14
    inner, outer = [], []
    for i in range(steps + 1):
        t = i / steps
        z = LAPEL_BREAK_Z + t * (GORGE_Z - LAPEL_BREAK_Z)
        # The belly: the outer edge bows outward through the middle of the
        # roll rather than running straight. PAON parameter.
        belly = math.sin(t * 3.14159) * 0.020
        x_in = side * 0.021
        x_out = side * (0.021 + LAPEL_WIDTH * (0.35 + 0.65 * t) + belly)
        y_in = -DEPTH_CHEST * 0.94
        # The fold peels away from the chest as it rises to the gorge.
        y_out = -DEPTH_CHEST * (0.94 - 0.30 * t)
        inner.append(bm.verts.new(Vector((x_in, y_in, z))))
        outer.append(bm.verts.new(Vector((x_out, y_out, z))))
    for i in range(steps):
        bm.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
    bm.to_mesh(mesh)
    bm.free()

    obj.modifiers.new("subsurf", "SUBSURF").levels = 2
    solid = obj.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = 0.0026
    return obj


def build_collar() -> bpy.types.Object:
    import math

    mesh = bpy.data.meshes.new("collar")
    obj = bpy.data.objects.new("collar", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    lower, upper = [], []
    steps = 22
    for i in range(steps + 1):
        t = i / steps
        ang = -2.05 + t * 4.10
        x = (NECK_HALF + 0.030) * math.sin(ang)
        y = (DEPTH_SHOULDER * 0.62) * math.cos(ang) + 0.012
        lower.append(bm.verts.new(Vector((x, y, Z_NECK - 0.045))))
        upper.append(bm.verts.new(Vector((x * 1.10, y * 1.14, Z_NECK + 0.019))))
    for i in range(steps):
        bm.faces.new((lower[i], lower[i + 1], upper[i + 1], upper[i]))
    bm.to_mesh(mesh)
    bm.free()

    obj.modifiers.new("subsurf", "SUBSURF").levels = 2
    solid = obj.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = 0.0030
    return obj


def build_buttons() -> list:
    """Two-button stance. Chapter 09 treats buttons as shared rigid parts, and
    they are the cheapest large gain in perceived quality — the reference's
    buttons are visibly four-holed and mottled at native resolution."""
    objs = []
    for z in (LAPEL_BREAK_Z, LAPEL_BREAK_Z - 0.105):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.0105, depth=0.0032, location=(0.0, -DEPTH_CHEST * 0.99, z)
        )
        btn = bpy.context.object
        btn.name = f"button_{z:.3f}"
        btn.rotation_euler = (1.5708, 0.0, 0.0)
        bpy.ops.object.shade_smooth()
        objs.append(btn)
    return objs
