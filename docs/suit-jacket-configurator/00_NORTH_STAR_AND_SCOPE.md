# PAON Suit-Jacket Configurator: North Star and scope

## Decision

PAON will not reproduce another brand's configurator. The original product is an advisor-led **Material & Drape Lab** inside the future Virtual Wardrobe Studio: a man compares one PAON jacket construction under a small, explained set of cloth characters before a proposal or fitting conversation.

The single job is to make construction and cloth character legible—not to imply a made-to-measure order, price, lead time, fit guarantee, or physical accuracy.

## First experiment boundary

- One neutral, original test jacket silhouette; no customer photo, body scan, measurement, cart, quote, save, share, advisor send or database write.
- Three illustrative fabric profiles, three precomputed drape states each and three local lighting scenes.
- Deterministic browser assets and a static fallback. No AI generation, network fabric images, paid inference or production persistence.
- The lab may read no tenant data. A later Studio integration must make `retailer_id`, consent, entitlements and immutable snapshots authoritative.

## Reconciliation

FT-07 remains consolidated into Virtual Wardrobe Studio by `docs/FOUNDER_TOOL_BLUEPRINTS.md` and `docs/CAPABILITY_DISPOSITION.md`. This founder-authorized experiment does not revive a parallel configurator or change the current legacy intent-save route. It proves a reusable renderer/asset contract only.

## Anti-copy boundary

Research may identify capabilities but never supplies copied code, copy, assets, styling, fabric catalogues, rules, 3D models, textures, HDRIs or trade dress. All PAON labels, values, geometry, swatches and scene direction are original or explicitly licensed.
