"""
Cycles scene setup for the Drape Lab — the parts chapter 07 says are part of
the golden identity, in one place so a render can never silently drift.

Everything here is pinned deliberately. Changing any of it invalidates every
golden image, so change it in one commit with regenerated goldens, never
casually.
"""

import bpy

# Chapter 06's measured bar. Render at the zoom tier, derive delivery from it,
# so the zoom asset is never an upscale.
RENDER_W, RENDER_H = 1600, 2000
DELIVERY_W, DELIVERY_H = 1200, 1500

# Chapter 07: one pinned view transform, recorded per bake.
VIEW_TRANSFORM = "AgX"
LOOK = "None"
EXPOSURE = 0.0

# Adaptive sampling to a noise threshold rather than a fixed sample count.
NOISE_THRESHOLD = 0.005
MAX_SAMPLES = 2048
MIN_SAMPLES = 64


def configure_render(scene: bpy.types.Scene, *, transparent_film: bool) -> None:
    """Path-traced Cycles only. Eevee is a smoke-test convenience and its
    output may never be published (chapter 06, requirement 3)."""
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"

    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = backend
            break
        except TypeError:
            continue
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True

    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = NOISE_THRESHOLD
    scene.cycles.samples = MAX_SAMPLES
    scene.cycles.adaptive_min_samples = MIN_SAMPLES

    # Cloth needs enough bounces to keep folds from going black, but caustics
    # off — a wool jacket has none, and they only add fireflies.
    scene.cycles.max_bounces = 12
    scene.cycles.diffuse_bounces = 8
    scene.cycles.glossy_bounces = 6
    scene.cycles.transmission_bounces = 4
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False

    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.denoising_use_gpu = True
    except TypeError:
        pass

    scene.render.resolution_x = RENDER_W
    scene.render.resolution_y = RENDER_H
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent_film else "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = transparent_film

    scene.view_settings.view_transform = VIEW_TRANSFORM
    scene.view_settings.look = LOOK
    scene.view_settings.exposure = EXPOSURE


def add_studio_light(scene: bpy.types.Scene, *, raking: bool) -> None:
    """Two rigs, and the difference is an acceptance criterion rather than
    styling (chapter 06).

    `raking=False` is the reference-parity hero light: soft, even, frontal —
    what the competitor uses, and what makes a clean product shot.

    `raking=True` is the acceptance light: a key roughly 45 degrees and high to
    one side, which is what makes a sleevehead roll cast its own shadow and
    grinze read as ripples. Flat frontal light hides both, so a build that only
    produces the hero shot has not met requirement 4.
    """
    key = bpy.data.lights.new("key", type="AREA")
    key.shape = "RECTANGLE"
    key.size, key.size_y = 3.0, 4.5
    key_obj = bpy.data.objects.new("key", key)
    scene.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("fill", type="AREA")
    fill.shape = "RECTANGLE"
    fill.size, fill.size_y = 4.0, 4.0
    fill_obj = bpy.data.objects.new("fill", fill)
    scene.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("rim", type="AREA")
    rim.shape = "RECTANGLE"
    rim.size, rim.size_y = 1.2, 3.0
    rim_obj = bpy.data.objects.new("rim", rim)
    scene.collection.objects.link(rim_obj)

    if raking:
        key.energy = 900
        key_obj.location = (2.9, -1.7, 2.9)
        key_obj.rotation_euler = (0.95, 0.0, 1.05)
        # A low fill ratio is what preserves the shadow the roll casts. Lifting
        # it to flatter values is exactly what would erase the thing we are
        # trying to show.
        fill.energy = 90
        fill_obj.location = (-3.2, -2.2, 1.4)
        fill_obj.rotation_euler = (1.35, 0.0, -0.95)
    else:
        key.energy = 700
        key_obj.location = (1.6, -3.4, 2.6)
        key_obj.rotation_euler = (1.15, 0.0, 0.42)
        fill.energy = 320
        fill_obj.location = (-2.4, -3.0, 1.6)
        fill_obj.rotation_euler = (1.30, 0.0, -0.62)

    rim.energy = 260
    rim_obj.location = (-1.4, 2.9, 2.6)
    rim_obj.rotation_euler = (1.25, 0.0, 3.55)


def add_backdrop(scene: bpy.types.Scene) -> None:
    """Flat neutral grey, matching the reference presentation (chapter 06 V2).
    A curved sweep, not a flat plane, so the ground has no visible horizon."""
    # Floor plus a vertical wall behind, so the frame is filled with grey at
    # every camera angle rather than falling off into world background.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0.0, 0.0, 0.0))
    floor = bpy.context.object
    floor.name = "backdrop_floor"

    bpy.ops.mesh.primitive_plane_add(size=40, location=(0.0, 6.0, 0.0))
    wall = bpy.context.object
    wall.name = "backdrop_wall"
    wall.rotation_euler = (1.5708, 0.0, 0.0)

    mat = bpy.data.materials.new("backdrop")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.58, 0.58, 0.585, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Metallic"].default_value = 0.0
    for obj in (floor, wall):
        obj.data.materials.append(mat)

    # NOT a shadow catcher. An earlier revision set `is_shadow_catcher` here,
    # which makes the surface invisible except where shadow falls — so the
    # whole frame rendered black and the garment floated in a void. Shadow
    # catchers belong to chapter 07's per-assembly layer pass, where the
    # neighbours must contribute occlusion without being drawn. For a hero
    # plate the ground is the subject's ground and must actually be visible.


def add_camera(scene: bpy.types.Scene, *, view: str) -> bpy.types.Object:
    """Chapter 07's camera set. `hero_front` is the parity shot; `three_q_rake`
    is the acceptance view where shoulder construction is judged."""
    cam_data = bpy.data.cameras.new("camera")
    # A longer lens keeps tailoring proportions honest; a wide lens would
    # barrel the shoulder line and flatter the silhouette dishonestly.
    cam_data.lens = 85
    cam_obj = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # The garment spans roughly z=0.30 to z=1.40, so aim at its middle and
    # stand far enough back that an 85 mm lens frames the whole of it. An
    # earlier revision aimed at z=1.32 — the collar — and cropped the body.
    target_z = 0.85
    dist = 3.15

    if view == "three_q_rake":
        cam_obj.location = (dist * 0.60, -dist * 0.80, target_z + 0.28)
        cam_obj.rotation_euler = (1.4835, 0.0, 0.6435)
    elif view == "profile":
        cam_obj.location = (dist, 0.0, target_z + 0.20)
        cam_obj.rotation_euler = (1.5010, 0.0, 1.5708)
    else:  # hero_front
        cam_obj.location = (0.0, -dist, target_z + 0.14)
        cam_obj.rotation_euler = (1.5359, 0.0, 0.0)
    return cam_obj


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
