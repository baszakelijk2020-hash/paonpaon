"""
P1.0 — the single-image spike.

Run headless:

    /Applications/Blender.app/Contents/MacOS/Blender \
        --background --factory-startup \
        --python tools/drape-lab/render/p1_0_spike.py -- \
        --out /tmp/drape-p1.0 --view hero_front

This exists to answer exactly one question, from chapter 12: can PAON render a
jacket that stands beside the reference without being identifiably weaker? It
deliberately builds nothing else — no asset graph, no manifest, no route.

If the answer is no, chapter 12 says the programme halts here, which is the
cheapest possible place to learn it.
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

import jacket  # noqa: E402
import materials  # noqa: E402
import scene as scenelib  # noqa: E402


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="/tmp/drape-p1.0")
    p.add_argument(
        "--view",
        default="hero_front",
        choices=["hero_front", "three_q_rake", "profile"],
    )
    p.add_argument("--samples", type=int, default=0, help="override max samples")
    p.add_argument("--transparent", action="store_true")
    return p.parse_args(argv)


def build():
    body = jacket.build_body()
    sleeves = [jacket.build_sleeve(-1), jacket.build_sleeve(1)]
    lapels = [jacket.build_lapel(-1), jacket.build_lapel(1)]
    collar = jacket.build_collar()
    buttons = jacket.build_buttons()

    wool = materials.wool_suiting()
    horn = materials.horn_button()

    for obj in [body, collar, *sleeves, *lapels]:
        materials.assign(obj, wool)
    for btn in buttons:
        materials.assign(btn, horn)

    # `use_auto_smooth` was removed in Blender 4.1+; per-polygon smoothing is
    # the version-stable way to do this and is all we need, since the subsurf
    # modifier is what actually carries the curvature.
    for obj in [body, collar, *sleeves, *lapels]:
        for poly in obj.data.polygons:
            poly.use_smooth = True

    return {"body": body, "sleeves": sleeves, "lapels": lapels, "collar": collar}


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)

    scenelib.clear_scene()
    sc = bpy.context.scene

    build()
    scenelib.add_backdrop(sc)
    scenelib.add_studio_light(sc, raking=(args.view != "hero_front"))
    scenelib.add_camera(sc, view=args.view)
    scenelib.configure_render(sc, transparent_film=args.transparent)

    if args.samples:
        sc.cycles.samples = args.samples

    out_png = os.path.join(args.out, f"p1_0_{args.view}.png")
    sc.render.filepath = out_png

    print(f"[p1.0] engine={sc.render.engine} device={sc.cycles.device}")
    print(f"[p1.0] view_transform={sc.view_settings.view_transform}")
    print(f"[p1.0] resolution={sc.render.resolution_x}x{sc.render.resolution_y}")
    print(f"[p1.0] adaptive_threshold={sc.cycles.adaptive_threshold} max={sc.cycles.samples}")

    started = time.time()
    bpy.ops.render.render(write_still=True)
    elapsed = time.time() - started

    print(f"[p1.0] wrote {out_png} in {elapsed:.1f}s")
    print("[p1.0] OK")


if __name__ == "__main__":
    main()
