# Drape Lab pipeline

Offline render pipeline for the PAON suit-jacket configurator. Specification
lives in `docs/suit-jacket-configurator/` — chapter 12 is the roadmap, chapter
06 the acceptance bar, chapter 07 the render stage, chapter 11 the resume point.

Nothing here ships to a browser. This produces the layered images that do.

## Requirements

- **Blender 5.2 LTS** (D-13). Verified present at
  `/Applications/Blender.app/Contents/MacOS/Blender`, build 2026-07-14.
- No other dependency. No paid API, no network access at render time.

## Run the P1.0 spike

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python tools/drape-lab/render/p1_0_spike.py -- \
  --out /tmp/drape-p1.0 --view hero_front
```

`--view` is one of `hero_front`, `three_q_rake`, `profile`. `--samples N`
overrides the adaptive maximum for a faster preview. `--transparent` renders on
alpha instead of the grey sweep.

Roughly two minutes per 1600 × 2000 frame on an M1 GPU at 200 samples.

## Layout

| Path                   | What it is                                            |
| ---------------------- | ----------------------------------------------------- |
| `render/scene.py`      | Cycles config, lighting rigs, cameras, backdrop       |
| `render/materials.py`  | Wool suiting, lining, horn button — all procedural    |
| `generator/jacket.py`  | P1.0 lofted geometry (**superseded — see below**)     |
| `render/p1_0_spike.py` | The spike entry point                                 |
| `render/materials.py`  | Procedural only: no rights record needed (chapter 03) |

## State: P1.0 did not pass, and that is a result rather than a failure

The harness is proven — headless Cycles on GPU, AgX pinned, adaptive sampling,
studio and raking rigs, contact shadow, visible weave, horn buttons, ~2 min a
frame.

`generator/jacket.py` is **not** the real generator. It lofts a surface from
profile curves, and the render shows plainly that this cannot produce a jacket:
no shoulder line, no armscye, lapels standing off as separate tongues. Those
features are products of panels joined along seams, so they cannot be lofted
into existence.

Keep `scene.py` and `materials.py` — they carry the pinned render identity and
work. Replace `generator/jacket.py` wholesale in P1.1 with a real panel
generator built to chapter 09's seam contract and chapter 14's panel set,
derived only from public-domain drafts (D-17), then drape it in P1.2 over a
CC0 body form (D-18).

## Things that will bite the next person

- `use_auto_smooth` was removed in Blender 4.1+. Set `polygon.use_smooth`
  instead.
- `is_shadow_catcher` makes a surface invisible except where shadow falls. It
  belongs to chapter 07's per-assembly layer pass, never to a hero plate — set
  it on a backdrop and the whole frame renders black.
- There is no `bpy.types.ClothSewing`. Sewing configuration lives on
  `ClothSettings` (chapter 13).
- Principled BSDF socket names moved between Blender versions. `materials.py`
  probes for a socket before setting it rather than pinning to one version's
  exact list.
