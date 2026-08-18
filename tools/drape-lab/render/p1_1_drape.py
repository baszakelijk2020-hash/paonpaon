"""
P1.1 + P1.2 — cut panels, sew them, drape them, render.

    /Applications/Blender.app/Contents/MacOS/Blender \
        --background --factory-startup \
        --python tools/drape-lab/render/p1_1_drape.py -- \
        --out /tmp/drape-p1.1 --view hero_front

Chapter 12's P1.0 result moved the visual gate to the end of P1.2, because a
jacket cannot be judged before it has a shoulder line and an armscye, and those
only exist once flat panels have been joined and forced over a body. So this is
the script the gate actually applies to.
"""

import argparse
import os
import sys
import time

import bpy

_HERE = os.path.dirname(os.path.realpath(__file__))
_TOOLS = os.path.dirname(_HERE)
for path in (_HERE, os.path.join(_TOOLS, "generator")):
    if path not in sys.path:
        sys.path.insert(0, path)

import materials  # noqa: E402
import panels  # noqa: E402
import scene as scenelib  # noqa: E402
import sew  # noqa: E402


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="/tmp/drape-p1.1")
    p.add_argument("--view", default="hero_front",
                   choices=["hero_front", "three_q_rake", "profile"])
    p.add_argument("--samples", type=int, default=200)
    p.add_argument("--frames", type=int, default=sew.SETTLE_FRAMES)
    p.add_argument("--dump-blend", default="")
    return p.parse_args(argv)


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)

    scenelib.clear_scene()
    sc = bpy.context.scene

    form = panels.dress_form()
    arms = [panels.arm_form(-1), panels.arm_form(1)]
    for arm in arms:
        sew.make_collider(arm)
        arm.hide_render = True
    cut = [
        panels.forepart(-1),
        panels.forepart(1),
        panels.back_panel(),
        panels.side_body(-1),
        panels.side_body(1),
        panels.sleeve_cap(-1),
        panels.sleeve_cap(1),
        panels.collar_stub(-1),
        panels.collar_stub(1),
        panels.collar_back_stub(),
        panels.pocket_welt(-1),
        panels.pocket_welt(1),
    ]
    print(f"[p1.1] cut {len(cut)} panels, {sum(len(obj.data.vertices) for obj, _ in cut)} verts")

    garment, declared_seams = sew.join_panels(cut)
    seam_contract = panels.BODY_SEAMS + panels.SLEEVE_SEAMS + panels.COLLAR_SEAMS + panels.POCKET_SEAMS
    seams = sew.add_sewing_springs(garment, declared_seams, seam_contract)
    print(f"[p1.1] sewing springs: {seams}")
    if seams == 0:
        print("[p1.1] FAIL: no sewing springs created — panels cannot close")
        return

    # Full-weight (1.0) pinning for points that anatomically stay fixed near
    # a known reference (shoulder on top of the shoulder, collar at the
    # neckline). Verified 2026-08-18: pinning the collar's own neck edge
    # (not just relying on its sewing spring to pull it in from the
    # flat-cut position) stops it stretching upward past the shoulder line
    # -- z_max was 1.49 vs the pin's 1.30 unpinned, exactly 1.30 pinned.
    pin = sew.pin_vertex_group(garment, declared_seams, [
        ("forepart_L", "shoulder"), ("forepart_R", "shoulder"),
        ("back", "shoulder_L"), ("back", "shoulder_R"),
        ("collar_L", "neck"), ("collar_R", "neck"),
        ("collar_back", "neck"),
    ], snap_y=0.0)

    # Partial-weight (0.5) "soft leash" for the hem. Chapter 12's completion
    # plan (11_EXECUTION_STATE.md) identified the root cause of the general
    # torso crumple: flat panels anchored only at the top have to swing
    # through a large, single-anchor arc to wrap the form, and that swing
    # lands in a stable-but-wrong self-overlapped shape rather than a smooth
    # wrap. Verified 2026-08-18 by direct comparison of three variants: no
    # hem anchor at all (unbounded, swings into a chaotic narrow column);
    # a full weight-1.0 hem pin (bounded top and bottom, but an unnaturally
    # straight/rigid hem edge); and this weight-0.5 version, which keeps the
    # bounded envelope while leaving a natural wavy hem line instead of a
    # frozen one. The torso's interior still crumples -- this fixes the
    # envelope, not the fold detail -- but it is the first real improvement
    # after several ruled-out attempts (sleeve-tip pinning x2, canvas
    # stiffness, more settle time). Same target position (snap to y=0) as
    # the rigid pins above, for the same reason: it's the seam's worn
    # position, not its flat-cut one.
    hem_indices = sorted(set(
        declared_seams["forepart_L"]["hem"]
        + declared_seams["forepart_R"]["hem"]
        + declared_seams["back"]["hem"]
    ))
    mesh = garment.data
    for i in hem_indices:
        co = mesh.vertices[i].co
        mesh.vertices[i].co = (co.x, 0.0, co.z)
    mesh.update()
    pin.add(hem_indices, 0.5, "REPLACE")
    mod = sew.setup_cloth(garment, form, pin_group=pin.name)

    # Chapter 09 models canvas as a cloth stiffness field, not geometry.
    # Verified 2026-08-18 by direct A/B (identical setup, canvas on vs off):
    # the drape measurably differs, so the mechanism is real and correctly
    # wired -- not yet demonstrated as a visual improvement (the canvas-on
    # result is a differently-shaped crumple, not a clearly better one).
    # Deepening/tuning this is deferred, same as the rest of the drape.
    canvas_indices = sorted(set(
        declared_seams["forepart_L"]["canvas"] + declared_seams["forepart_R"]["canvas"]
    ))
    canvas_group = garment.vertex_groups.new(name="canvas")
    canvas_group.add(canvas_indices, 1.0, "REPLACE")
    mod.settings.vertex_group_bending = "canvas"
    mod.settings.bending_stiffness_max = 30.0

    started = time.time()
    sew.bake(sc, garment, frames=args.frames)
    print(f"[p1.1] settled {args.frames} frames in {time.time() - started:.1f}s")
    sew.apply_result(garment)

    wool = materials.wool_suiting()
    materials.assign(garment, wool)
    for poly in garment.data.polygons:
        poly.use_smooth = True

    # Ghost mannequin: the form shapes the cloth and is never seen (ch.12 V1).
    form.hide_render = True

    scenelib.add_backdrop(sc)
    scenelib.add_studio_light(sc, raking=(args.view != "hero_front"))
    scenelib.add_camera(sc, view=args.view)
    scenelib.configure_render(sc, transparent_film=False)
    sc.cycles.samples = args.samples

    if args.dump_blend:
        bpy.ops.wm.save_as_mainfile(filepath=args.dump_blend)

    out_png = os.path.join(args.out, f"p1_1_{args.view}.png")
    sc.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    print(f"[p1.1] wrote {out_png}")
    print("[p1.1] OK")


if __name__ == "__main__":
    main()
