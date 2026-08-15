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

import bpy

# PARAM. High enough to close a seam within the settle frames, low enough that
# panels do not slingshot through each other on frame 1.
SEWING_FORCE_MAX = 12.0
SETTLE_FRAMES = 90


def join_panels(panel_specs, name="jacket_sewn"):
    """Make one mesh while preserving each declared seam's vertex order.

    `bpy.ops.object.join()` does not expose a stable source-to-result vertex
    map.  Build the combined mesh directly instead: the explicit offsets make
    the seam contract deterministic and keep ordered correspondence intact.
    """
    vertices, faces, seams = [], [], {}
    for obj, declared_seams in panel_specs:
        offset = len(vertices)
        vertices.extend(tuple(obj.matrix_world @ vertex.co) for vertex in obj.data.vertices)
        faces.extend(
            tuple(offset + index for index in polygon.vertices)
            for polygon in obj.data.polygons
        )
        seams[obj.name] = {
            seam_name: [offset + index for index in indices]
            for seam_name, indices in declared_seams.items()
        }
        bpy.data.objects.remove(obj, do_unlink=True)

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    joined = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(joined)
    return joined, seams


def _validate_seam_pair(seams, panel_a, seam_a, panel_b, seam_b):
    try:
        edge_a = seams[panel_a][seam_a]
        edge_b = seams[panel_b][seam_b]
    except KeyError as error:
        raise ValueError(f"undeclared seam endpoint: {error}") from error
    if len(edge_a) != len(edge_b):
        raise ValueError(
            f"seam arity mismatch: {panel_a}.{seam_a} has {len(edge_a)} "
            f"vertices, {panel_b}.{seam_b} has {len(edge_b)}"
        )
    if len(edge_a) < 2:
        raise ValueError(f"seam must contain at least two vertices: {panel_a}.{seam_a}")
    return edge_a, edge_b


def add_sewing_springs(obj, seams, seam_contract):
    """Add loose edges only for declared, ordered seam counterparts.

    The panel generator makes each boundary a fixed-arity sequence ordered by
    normalized arc length.  Pairing the matching positions is therefore an
    arc-length correspondence, never a spatial nearest-neighbour guess.
    """
    mesh = obj.data
    created = 0
    existing_edges = {tuple(sorted(edge.vertices)) for edge in mesh.edges}
    for panel_a, seam_a, panel_b, seam_b in seam_contract:
        edge_a, edge_b = _validate_seam_pair(seams, panel_a, seam_a, panel_b, seam_b)
        for vertex_a, vertex_b in zip(edge_a, edge_b):
            pair = tuple(sorted((vertex_a, vertex_b)))
            if pair in existing_edges:
                continue
            mesh.edges.add(1)
            mesh.edges[-1].vertices = pair
            existing_edges.add(pair)
            created += 1
    mesh.update()
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
