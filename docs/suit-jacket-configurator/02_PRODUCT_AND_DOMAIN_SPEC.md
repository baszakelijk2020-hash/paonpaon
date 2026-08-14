# Product and domain specification

## Journey

1. Enter the Virtual Wardrobe Studio's Material & Drape Lab from a look/proposal context.
2. Choose a cloth character, construction cue and light context.
3. Compare silhouette, fold character and surface response with short, non-physical explanatory language.
4. Either continue to an advisor discussion/proposal (future) or leave. The lab does not manufacture or sell.

## Jacket taxonomy and compatibility

`JacketConstruction`: single/double breasted; lapel (notch/peak/shawl); shoulder (natural/roped); chest canvas (unstructured/half/full); pockets (patch/flap/jetted); vents (none/side/centre); buttons; lining (unlined/half/full); sleeve finishing; monogram. A production compatibility engine must publish allowed combinations by jacket pattern version; disabled choices need a reason and an accessible explanation.

The lab uses only one fixed single-breasted, notch-lapel, flap-pocket, side-vent neutral test garment. It does not pretend to represent other configurations.

## Future immutable contracts

`SuitJacketSnapshot v1` contains `schemaVersion`, `jacketPatternVersion`, selected option ids, `fabricProfileVersion`, `drapeAssetManifestVersion`, `rendererVersion`, source look/proposal references and captured timestamps. A `DrapeAssetManifest v1` maps a stable option/fabric/state/light tuple to asset hashes, MIME types, byte budgets, rights record, fallback poster and quality status. Retired assets stay resolvable for a saved snapshot or display an explicit recovery state.

`FabricProfile` is a versioned, provenance-labelled material hypothesis. `Product`/`Variant` supplies commercially approved fabric identity and swatch; only a human-approved mapping may link it to a physical profile. `Outfit` may reference a snapshot; Virtual Studio may render it only after consent/entitlement checks. No link is added in this experiment.

## Boundaries

GSM, fibre composition and a product swatch are insufficient to infer drape. Product facts can seed discovery but cannot generate physics parameters. Any later customer, retailer or Studio lookup must use existing tenant boundaries and consent; a public asset must never reveal private product, customer or job data.
