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
    cut = [
        panels.forepart(-1),
        panels.forepart(1),
        panels.back_panel(),
        panels.sleeve(-1),
        panels.sleeve(1),
    ]
    print(f"[p1.1] cut {len(cut)} panels, {sum(len(o.data.vertices) for o in cut)} verts")

    garment = sew.join_panels(cut)
    seams = sew.add_sewing_springs(garment)
    print(f"[p1.1] sewing springs: {seams}")
    if seams == 0:
        print("[p1.1] FAIL: no sewing springs created — panels cannot close")
        return

    sew.setup_cloth(garment, form)
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
