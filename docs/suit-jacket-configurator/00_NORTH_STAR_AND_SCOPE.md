# PAON Suit-Jacket Configurator: North Star and scope

## Decision

PAON will not reproduce another brand's configurator. The original product is an advisor-led **Material & Drape Lab** inside the future Virtual Wardrobe Studio: a man compares one PAON jacket construction under a small, explained set of cloth characters before a proposal or fitting conversation.

The single job is to make construction and cloth character legible—not to imply a made-to-measure order, price, lead time, fit guarantee, or physical accuracy.

## First experiment boundary

- One neutral, original test jacket silhouette; no customer photo, body scan, measurement, cart, quote, save, share, advisor send or database write.
- Three illustrative fabric profiles, three precomputed drape states each and three local lighting scenes.
- Deterministic browser assets and a static fallback. Repository automation and locally available AI tooling may author original assets, but the shipped experience performs no runtime generation and uses no paid inference, network fabric images or production persistence.
- The lab may read no tenant data. A later Studio integration must make `retailer_id`, consent, entitlements and immutable snapshots authoritative.

Implementation is paused pending PAON ground-zero reconciliation. The unattended pipeline must not require the founder to hire specialists or operate 3D software; when available evidence cannot support a physical claim, the product remains explicitly illustrative instead of shifting calibration work to the founder.

## Reconciliation

FT-07 remains consolidated into Virtual Wardrobe Studio by `docs/FOUNDER_TOOL_BLUEPRINTS.md` and `docs/CAPABILITY_DISPOSITION.md`. This founder-authorized research does not revive a parallel configurator or change the current legacy intent-save route. It specifies a reusable renderer/asset contract only; implementation requires a later explicit Phase 3 authorization.

## Full reference-study boundary

PAON will exhaustively study the observable Suitsupply and Armani journeys and may deliberately reproduce useful capabilities, sequencing, interaction mechanics, option taxonomies, camera behavior, comparison patterns and fallback behavior in a clean-room implementation. Functional parity is a starting benchmark, not a ceiling; PAON then improves clarity, drape understanding, accessibility, determinism and advisor integration.

The clean-room boundary is narrow: do not import or reuse their source code, private APIs, downloaded assets, wording, fonts, imagery, 3D models, textures, HDRIs, proprietary datasets or recognizable brand presentation. PAON may independently implement every publicly observable behavior using original code, content, rules and rights-cleared assets.
