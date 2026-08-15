"""
P1.2 — sewing and drape.

Chapter 07, quoting the Blender manual directly: sewing springs are "created by
adding extra edges to a cloth mesh that are not included in any faces". That
single sentence dictates the whole approach — panels must be joined into ONE
mesh, and the seams are loose edges across the gap between their boundaries.

Chapter 13's correction applies here: there is no `bpy.types.ClothSewing`. The
sewing controls live on `ClothSettings` (`use_sewing_springs`,
`sewing_force_max`). Chapter 07 also records the manual's warning that leaving
the maximum sewing force at zero "can cause instability due to extreme forces
in the initial frames", so it is set explicitly.
"""

import bmesh
import bpy
from mathutils import Vector

# PARAM. High enough to close a seam within the settle frames, low enough that
# panels do not slingshot through each other on frame 1.
SEWING_FORCE_MAX = 12.0
SETTLE_FRAMES = 90


def join_panels(objs, name="jacket_sewn"):
    """Sewing springs only work within a single mesh, so every panel is joined
    first. They keep their own vertices; nothing is merged."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined


def _boundary_loops(bm):
    """Every boundary edge, grouped into connected loops."""
    bm.edges.ensure_lookup_table()
    boundary = {e for e in bm.edges if e.is_boundary}
    loops, seen = [], set()
    for edge in boundary:
        if edge in seen:
            continue
        loop, stack = [], [edge]
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            loop.append(cur)
            for vert in cur.verts:
                for other in vert.link_edges:
                    if other in boundary and other not in seen:
                        stack.append(other)
        loops.append(loop)
    return loops


def add_sewing_springs(obj, *, max_distance=0.34):
    """Join facing boundary vertices with loose edges.

    Pairs nearest-neighbour across panels rather than trying to identify named
    seams. That is cruder than chapter 09's seam contract and deliberately so:
    P1.2 asks only whether panels close into a garment at all. Named seam ids
    with fixed ring arity come once that is answered — building the contract
    before knowing the solver can close anything would be the P1.0 mistake in a
    new place.
    """
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()

    loops = _boundary_loops(bm)
    boundary_verts = []
    for loop in loops:
        verts = set()
        for edge in loop:
            verts.update(edge.verts)
        boundary_verts.append(list(verts))

    created = 0
    used = set()
    for i, group_a in enumerate(boundary_verts):
        for j, group_b in enumerate(boundary_verts):
            if j <= i:
                continue
            for va in group_a:
                if va.index in used:
                    continue
                best, best_d = None, max_distance
                for vb in group_b:
                    if vb.index in used:
                        continue
                    d = (va.co - vb.co).length
                    if d < best_d:
                        best, best_d = vb, d
                if best is not None:
                    try:
                        bm.edges.new((va, best))
                        used.add(va.index)
                        used.add(best.index)
                        created += 1
                    except ValueError:
                        pass  # edge already exists

    bm.to_mesh(mesh)
    bm.free()
    return created


def setup_cloth(obj, collider, *, quality=8):
    """Chapter 07's solver configuration, using the property names verified
    against the 5.2 manual rather than assumed."""
    mod = obj.modifiers.new("cloth", "CLOTH")
    st = mod.settings
    cl = mod.collision_settings

    st.quality = quality
    st.mass = 0.32  # kg/m^2 — worsted suiting is heavier than shirting
    st.air_damping = 1.0

    st.tension_stiffness = 18.0
    st.compression_stiffness = 18.0
    st.shear_stiffness = 6.0
    st.bending_stiffness = 1.2  # the manual calls this the wrinkle coefficient

    st.tension_damping = 6.0
    st.compression_damping = 6.0
    st.shear_damping = 6.0
    st.bending_damping = 0.6

    # Sewing. Named per chapter 13's correction: no ClothSewing type exists.
    for attr, value in (
        ("use_sewing_springs", True),
        ("sewing_force_max", SEWING_FORCE_MAX),
    ):
        if hasattr(st, attr):
            setattr(st, attr, value)

    cl.use_collision = True
    cl.distance_min = 0.004
    cl.collision_quality = 4
    cl.use_self_collision = True
    if hasattr(cl, "self_distance_min"):
        cl.self_distance_min = 0.003

    coll = collider.modifiers.new("collision", "COLLISION")
    if hasattr(coll, "settings"):
        coll.settings.thickness_outer = 0.005

    return mod


def bake(scene, obj, frames=SETTLE_FRAMES):
    """Step the solver frame by frame. `frame_set` drives the depsgraph, which
    is what actually advances a cloth sim in background mode — calling a bake
    operator headlessly is far more fragile."""
    scene.frame_start = 1
    scene.frame_end = frames
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
    return frames


def apply_result(obj):
    """Freeze the settled cloth into real geometry so the render stage sees a
    static mesh, exactly as chapter 07 requires — a simulation cache is never
    the shipped artefact."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    baked = bpy.data.meshes.new_from_object(evaluated)
    obj.modifiers.clear()
    obj.data = baked
    return obj
