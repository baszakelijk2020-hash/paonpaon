"""
Wool suiting shader.

Chapter 06 requires the cloth to "read as cloth — weave visible at native
resolution, correct sheen behaviour for the fibre, no plastic or flat-shaded
appearance". Three things do most of that work, and all three are cheap:

1. **Sheen.** Wool is not a dielectric like plastic; light scatters off fibre
   ends at grazing angles, which is what gives suiting its soft edge glow. The
   Principled BSDF's sheen layer is the correct expression of this, and its
   absence is the single loudest tell that a garment render is CG.
2. **Weave at the micro scale.** At 1600x2000 a jacket occupies enough pixels
   that a perfectly smooth surface reads as vinyl. A procedural weave in the
   normal and roughness channels costs nothing to author and does not need a
   scanned texture.
3. **Roughness variation.** Uniform roughness is never real. Breaking it up
   slightly is what stops the highlight rolling across the shoulder like glass.

Everything here is procedural, so it is deterministic, has no rights record to
maintain (chapter 03), and regenerates identically from the same seed.
"""

import bpy


def _weave_nodes(mat, bsdf, *, scale: float, bump_strength: float):
    """A twill-ish micro weave driven into normal and roughness."""
    nt = mat.node_tree
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])

    # Two offset wave textures crossing at an angle read as warp and weft; a
    # single one reads as corduroy.
    warp = nt.nodes.new("ShaderNodeTexWave")
    warp.wave_type = "BANDS"
    warp.bands_direction = "X"
    warp.inputs["Scale"].default_value = 1.0
    warp.inputs["Distortion"].default_value = 1.6
    warp.inputs["Detail"].default_value = 2.0
    nt.links.new(mapping.outputs["Vector"], warp.inputs["Vector"])

    weft = nt.nodes.new("ShaderNodeTexWave")
    weft.wave_type = "BANDS"
    weft.bands_direction = "Y"
    weft.inputs["Scale"].default_value = 1.0
    weft.inputs["Distortion"].default_value = 1.6
    weft.inputs["Detail"].default_value = 2.0
    nt.links.new(mapping.outputs["Vector"], weft.inputs["Vector"])

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "OVERLAY"
    mix.inputs["Fac"].default_value = 0.5
    nt.links.new(warp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(weft.outputs["Color"], mix.inputs["Color2"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.0008
    nt.links.new(mix.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    rough_mix = nt.nodes.new("ShaderNodeMapRange")
    rough_mix.inputs["From Min"].default_value = 0.0
    rough_mix.inputs["From Max"].default_value = 1.0
    rough_mix.inputs["To Min"].default_value = 0.62
    rough_mix.inputs["To Max"].default_value = 0.78
    nt.links.new(mix.outputs["Color"], rough_mix.inputs["Value"])
    nt.links.new(rough_mix.outputs["Result"], bsdf.inputs["Roughness"])


def _set_if_present(bsdf, name, value):
    """Principled BSDF socket names moved between Blender versions. Setting
    what exists and skipping what does not is better than pinning to one
    version's exact socket list and breaking on upgrade."""
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value
        return True
    return False


def wool_suiting(name: str = "wool_charcoal", base=(0.055, 0.058, 0.065, 1.0)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]

    _set_if_present(bsdf, "Base Color", base)
    _set_if_present(bsdf, "Metallic", 0.0)
    _set_if_present(bsdf, "Roughness", 0.70)
    _set_if_present(bsdf, "IOR", 1.45)
    _set_if_present(bsdf, "Specular IOR Level", 0.28)

    # The sheen layer. Warm-tinted and weak: strong sheen reads as velvet, and
    # absent sheen reads as plastic. Worsted suiting sits near the low end.
    if not _set_if_present(bsdf, "Sheen Weight", 0.34):
        _set_if_present(bsdf, "Sheen", 0.34)
    _set_if_present(bsdf, "Sheen Roughness", 0.32)
    _set_if_present(bsdf, "Sheen Tint", (0.55, 0.52, 0.50, 1.0))

    _weave_nodes(mat, bsdf, scale=340.0, bump_strength=0.32)
    return mat


def lining(name: str = "lining_bemberg"):
    """Cupro/Bemberg lining: smoother, glossier and lighter than the shell.
    Chapter 06 V10 requires it to be visible in the front opening, and the
    contrast against the shell is what makes the opening read as depth."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    _set_if_present(bsdf, "Base Color", (0.075, 0.085, 0.105, 1.0))
    _set_if_present(bsdf, "Roughness", 0.24)
    _set_if_present(bsdf, "Metallic", 0.0)
    if not _set_if_present(bsdf, "Sheen Weight", 0.12):
        _set_if_present(bsdf, "Sheen", 0.12)
    return mat


def horn_button(name: str = "button_horn"):
    """Real horn is translucent, mottled and slightly uneven. Flat black
    cylinders are a giveaway at the zoom tier."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 26.0
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.052, 0.032, 0.018, 1.0)
    ramp.color_ramp.elements[1].color = (0.155, 0.105, 0.062, 1.0)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    _set_if_present(bsdf, "Roughness", 0.26)
    _set_if_present(bsdf, "IOR", 1.55)
    # A little transmission is what makes horn look like horn rather than
    # painted plastic.
    _set_if_present(bsdf, "Transmission Weight", 0.10)
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
