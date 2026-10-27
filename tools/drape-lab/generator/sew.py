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


def pin_vertex_group(obj, seams, panel_seam_pairs, name="pin_shoulder", *, snap_y=None):
    """Build a weight-1.0 vertex group over the given named seams, for
    `setup_cloth(pin_group=...)`.

    11_EXECUTION_STATE.md's P1.2 debugging history (item 4) demonstrates why
    this exists: flat cut panels never geometrically overlap the collider
    while airborne (both panels hold |y| >= START_GAP everywhere, which has
    to clear the form's deepest cross-section), so nothing opposes gravity
    in z until the sewing springs have already lost the race and the whole
    assembly has fallen through the form's z-range. A real jacket does not
    stay up on a mannequin by outrunning gravity with friction alone — it is
    supported at the shoulders. Pinning the shoulder/neckline seam is the
    same fix: the top can't free-fall, so gravity drapes the rest of the
    cloth down and around the form from a fixed anchor instead.

    A pin holds a vertex at wherever it starts. Item 5 (below) found that
    pinning it at the flat-cut's raw position — 0.16-0.26m off the form,
    where `START_GAP` put it so the panel would clear the collider before
    sewing — produces two frozen edges a real seam can never close, because a
    pin overrides the sewing spring for that vertex entirely. `snap_y`, if
    given, overwrites the pinned vertices' y coordinate (only y — x and z
    still carry the panel's real shoulder-slope/chest-circumference shape)
    to put the pin where the seam actually sits once worn, not where the
    pattern piece sat on the cutting table.
    """
    group = obj.vertex_groups.new(name=name)
    indices = sorted({
        index
        for panel_name, seam_name in panel_seam_pairs
        for index in seams[panel_name][seam_name]
    })
    group.add(indices, 1.0, "REPLACE")
    if snap_y is not None:
        mesh = obj.data
        for i in indices:
            co = mesh.vertices[i].co
            mesh.vertices[i].co = (co.x, snap_y, co.z)
        mesh.update()
    return group


def make_collider(obj, *, thickness_outer=0.005):
    """Add a COLLISION modifier so cloth anywhere in the scene treats `obj`
    as a collider. Blender's cloth solver collides against every object
    that carries one automatically -- it is not wired into ClothSettings
    itself, which is why `setup_cloth()` only takes a single `collider` to
    set up initially but any number of objects (the dress form, each arm)
    can carry this modifier independently."""
    mod = obj.modifiers.new("collision", "COLLISION")
    if hasattr(mod, "settings"):
        mod.settings.thickness_outer = thickness_outer
    return mod


def setup_cloth(obj, collider, *, quality=8, pin_group=None, pin_stiffness=1.0):
    """Chapter 07's solver configuration, using the property names verified
    against the 5.2 manual rather than assumed."""
    mod = obj.modifiers.new("cloth", "CLOTH")
    st = mod.settings
    cl = mod.collision_settings

    if pin_group is not None:
        st.vertex_group_mass = pin_group
        st.pin_stiffness = pin_stiffness

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

    # Collider friction. Blender 5.2 defaults both of these to 0, which gives
    # the form no grip at all; a real garment does not slide freely over a
    # mannequin. Moderate, not maxed -- 2026-08-17 diagnosis found the real
    # instability cause was START_GAP being smaller than the form's own
    # cross-section depth (panels started inside the collider); friction only
    # needed to stop residual slide once that interpenetration is fixed, not
    # to fight gravity on its own.
    st.collider_friction = 1.0

    # Sewing. Named per chapter 13's correction: no ClothSewing type exists.
    for attr, value in (
        ("use_sewing_springs", True),
        ("sewing_force_max", SEWING_FORCE_MAX),
    ):
        if hasattr(st, attr):
            setattr(st, attr, value)

    cl.use_collision = True
    cl.distance_min = 0.010
    cl.collision_quality = 8
    cl.use_self_collision = True
    if hasattr(cl, "self_distance_min"):
        cl.self_distance_min = 0.008
    if hasattr(cl, "friction"):
        cl.friction = 20.0
    if hasattr(cl, "damping"):
        cl.damping = 2.0

    make_collider(collider)

    return mod


def bake(scene, obj, frames=SETTLE_FRAMES, *,
         sewing_ramp_frames=30, sewing_ramp_start=0.5, on_frame=None):
    """Step the solver frame by frame. `frame_set` drives the depsgraph, which
    is what actually advances a cloth sim in background mode — calling a bake
    operator headlessly is far more fragile.

    Sewing force ramps linearly from `sewing_ramp_start` up to whatever
    `setup_cloth()` configured as `sewing_force_max`, over the first
    `sewing_ramp_frames` frames, instead of applying full force from frame 1.
    The manual's own warning — that leaving sewing force at zero "can cause
    instability due to extreme forces in the initial frames" — implies the
    same failure at the other extreme: applying it at full strength across a
    real initial gap (side seams start ~0.4m apart, see panels.py's
    START_GAP) imparts one large sudden impulse. Verified empirically
    2026-08-17: at full force from frame 1, the garment left the collider
    entirely within ~20 frames and free-fell the rest of the settle window
    (z -15.9m by frame 90) — a launch, not a drape.

    The ramp is a real F-Curve on `sewing_force_max`, inserted once before the
    loop, NOT a per-frame Python property write inside it. Verified
    empirically 2026-08-17 that the obvious version — set the property, then
    `frame_set(frame)`, every iteration — freezes the whole sim solid after
    frame 2 (identical vertex positions through frame 90): writing a cloth
    setting from Python appears to invalidate/reset the point cache on every
    write, so the solver never gets a continuous history to integrate over.
    An animated property is read by the depsgraph during its own evaluation,
    the same mechanism `frame_set` already relies on, so the cache stays
    continuous.

    `on_frame(frame)`, if given, is called after each `frame_set` — verification
    callers use it to sample state without duplicating this loop.
    """
    scene.frame_start = 1
    scene.frame_end = frames
    settings = obj.modifiers["cloth"].settings
    target_force = settings.sewing_force_max

    if sewing_ramp_frames > 0:
        hold_frame = max(sewing_ramp_frames, 2)
        settings.sewing_force_max = sewing_ramp_start
        settings.keyframe_insert(data_path="sewing_force_max", frame=1)
        settings.sewing_force_max = target_force
        settings.keyframe_insert(data_path="sewing_force_max", frame=hold_frame)
        settings.keyframe_insert(data_path="sewing_force_max", frame=frames)
        # Blender 5.2's layered-action API: there is no `Action.fcurves`
        # (verified empirically 2026-08-17 — that raises AttributeError).
        # F-Curves live under a layer/strip/channelbag; `fcurve_ensure_for_datablock`
        # is the documented way to fetch one without walking that structure by hand.
        action = obj.animation_data.action
        fcurve = action.fcurve_ensure_for_datablock(
            obj, 'modifiers["cloth"].settings.sewing_force_max')
        for kp in fcurve.keyframe_points:
            kp.interpolation = "LINEAR"
        fcurve.extrapolation = "CONSTANT"

    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        if on_frame is not None:
            on_frame(frame)

    if sewing_ramp_frames > 0:
        settings.sewing_force_max = target_force
        obj.animation_data_clear()
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
