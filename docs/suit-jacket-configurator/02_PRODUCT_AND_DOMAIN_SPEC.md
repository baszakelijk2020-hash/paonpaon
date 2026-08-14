# Product and domain specification

Evidence tiers used throughout this dossier are defined in
`00_NORTH_STAR_AND_SCOPE.md`. Repository facts in this file were verified
against the working tree at commit `d39bd1d` and carry a `path:line` anchor.
Anything without an anchor is a proposal, not a description of existing code.

## Journey

1. Enter the Virtual Wardrobe Studio's Material & Drape Lab from a
   look/proposal context.
2. Choose a cloth character, construction cue and light context.
3. Compare silhouette, fold character and surface response with short,
   non-physical explanatory language.
4. Either continue to an advisor discussion/proposal (future) or leave. The lab
   does not manufacture or sell.

## What exists in the repository today

This is the honest baseline the lab would be added to. It is not a description
of the lab.

| Concept                                                          | Status in repository                                                                                       | Anchor                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Product`                                                        | Exists                                                                                                     | `packages/domain/src/catalog/product.ts:18`                         |
| `ProductVariant`                                                 | Exists (the dossier previously called this `Variant`; the real type name is `ProductVariant`)              | `packages/domain/src/catalog/product.ts:35`                         |
| `Outfit`                                                         | Exists                                                                                                     | `packages/domain/src/wardrobe/outfit.ts:36`                         |
| `ProductFabricProfile`                                           | Exists, and carries exactly `fabricWeightGramsPerSquareMetre`, `composition`, `supplierReference`          | `packages/domain/src/metadata/metadata.ts:133`                      |
| `FabricProfile` (physics-bearing)                                | **Does not exist.** No type in the repository carries bending, shear, damping, friction or thickness.      | —                                                                   |
| `SuitJacketSnapshot`, `AssetGraphManifest`, `JacketConstruction` | **Do not exist.** Proposed below and in chapter 09 only.                                                   | —                                                                   |
| Legacy FT-07 configurator route                                  | Exists                                                                                                     | `apps/customer/app/r/[slug]/configurator`                           |
| Legacy FT-07 intent persistence                                  | Exists                                                                                                     | `supabase/migrations/20260802000008_suit_configuration_intents.sql` |
| Fabric/lining compatibility rules                                | Exist as a migration; not a drape or physics contract                                                      | `supabase/migrations/20260805150000_add_fabric_lining_rules.sql`    |
| Product swatch image                                             | Exists                                                                                                     | `supabase/migrations/20260726000002_add_product_swatch_image.sql`   |
| `three`, glTF/GLB assets, Blender pipeline                       | **Absent.** No workspace `package.json` declares `three`; no `.glb`/`.gltf` file exists in the repository. | verified by `grep`/`find`, 2026-08-15                               |

A copy of `three@0.185.1` is present in the pnpm content-addressed store
(`node_modules/.pnpm/three@0.185.1`) as a transitive artifact. It is not
resolvable from the workspace root and no package depends on it. Treat the
renderer as **not yet adopted**.

`ProductFabricProfile` is the sharpest illustration of this dossier's central
constraint: the only fabric facts PAON holds today are grammage, fibre
composition and a supplier reference. Chapter 04 explains why that set cannot
produce drape.

## Jacket taxonomy and compatibility (proposed)

`JacketConstruction`: single/double breasted; lapel (notch/peak/shawl);
shoulder (natural/roped); chest canvas (unstructured/half/full); pockets
(patch/flap/jetted); vents (none/side/centre); buttons; lining (unlined/half/
full); sleeve finishing; monogram.

A production compatibility engine must publish allowed combinations by jacket
pattern version; disabled choices need a reason and an accessible explanation.
The existing `add_fabric_lining_rules` migration is a precedent for
rule-as-data, not a substitute for that engine.

These option groups are **not** a list of pre-built garments. Chapter 09 is
normative: each group maps to an assembly in a modular asset graph, and the
mechanism differs by group — geometry substitution for lapel, collar, pockets,
vents, sleeve and lining; simulation-parameter modification for canvas
structure and shoulder roping; pure material binding for fabric, lining colour
and button material. `JacketConstruction` is therefore a selection over graph
nodes, and its serialized form must record the resolved assembly ids and
versions, never a combination identifier.

The lab uses only one fixed single-breasted, notch-lapel, flap-pocket,
side-vent neutral test garment. It does not pretend to represent other
configurations.

## Future immutable contracts (proposed)

`SuitJacketSnapshot v1` contains `schemaVersion`, `familyId`, `familyVersion`,
the resolved assembly set as `{assemblyId, variant, version}` triples, the
`canvas` and `shoulder` parameter selections, `fabricProfileVersion`,
`drapeClass`, `assetGraphManifestVersion`, `rendererVersion`, source
look/proposal references and captured timestamps. Recording resolved assembly
ids and versions — rather than a combination key — is what lets a snapshot
survive an assembly being re-authored.

`AssetGraphManifest v1`, specified in full in chapter 09, is the authoritative
asset contract: it declares the family, seam schema versions, material slot
roles, per-assembly attachment and UV leases, per-bake hashes and provenance,
compatibility rules and fallbacks. Retired versions stay resolvable for a saved
snapshot or the snapshot displays an explicit recovery state.

A physics-bearing fabric profile is a versioned, provenance-labelled material
hypothesis and must be a **new** type, distinct from `ProductFabricProfile`.
Fusing them would silently promote grammage and composition into a drape claim.
`Product`/`ProductVariant` supplies commercially approved fabric identity and
swatch; only an evidence-backed, versioned mapping that passes the chapter-04
calibration thresholds may link it to a physical profile. `Outfit` may
reference a snapshot; Virtual Studio may render it only after
consent/entitlement checks. No link is added in this experiment.

## Boundaries

GSM, fibre composition and a product swatch are insufficient to infer drape.
Product facts can seed discovery but cannot generate physics parameters. Any
later customer, retailer or Studio lookup must use existing tenant boundaries
and consent; a public asset must never reveal private product, customer or job
data.

## Relationship to the legacy FT-07 route

`apps/customer/app/r/[slug]/configurator` and the `suit_configuration_intents`
table stay exactly as they are. This dossier proposes no schema change, no
route change and no write path. `docs/FOUNDER_TOOL_BLUEPRINTS.md` and
`docs/CAPABILITY_DISPOSITION.md` already record FT-07 as consolidated into
Virtual Wardrobe Studio; nothing here reopens that.
