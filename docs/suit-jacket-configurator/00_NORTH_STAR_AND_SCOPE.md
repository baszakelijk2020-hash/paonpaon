# PAON Suit-Jacket Configurator: North Star and scope

## Decision

PAON will not reproduce another brand's configurator. The original product is
an advisor-led **Material & Drape Lab** inside the future Virtual Wardrobe
Studio: a man compares one PAON jacket construction under a small, explained
set of cloth characters before a proposal or fitting conversation.

The single job is to make construction and cloth character legible—not to imply
a made-to-measure order, price, lead time, fit guarantee, or physical accuracy.

## Dossier map

| Chapter | Contents                                                            |
| ------- | ------------------------------------------------------------------- |
| 00      | North star, scope, evidence tiers, clean-room boundary (this file)  |
| 01      | Reference capability matrix and the 2026-08-15 observation record   |
| 02      | Product journey, domain contracts and what exists in the repository |
| 03      | Asset classes, glTF constraints, rights and provenance, validation  |
| 04      | Fabric physics, what cannot be inferred, and the calibration plan   |
| 05      | Rendering architecture, budgets and progressive enhancement         |
| 06      | Visual quality, golden regression and acceptance criteria           |
| 07      | Material & Drape Lab plan and the unattended generation pipeline    |
| 08      | Decisions, open risks and the roadmap                               |
| 09      | **Modular asset graph — normative asset contract**                  |

## Evidence tiers

Every factual claim in this dossier carries one of these tiers. A claim without
a tier is a proposal, not a finding. Chapters 01, 03, 04, 05, 06, 07 and 09
apply the vocabulary literally. Chapter 02 uses the equivalent stricter
convention for repository facts: a `path:line` anchor, which is `OBSERVED-CODE`
by construction, and no anchor means no claim.

| Tier            | Meaning                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `OBSERVED-DOM`  | Literally present in a rendered-DOM capture this dossier took and retained, quotable byte-for-byte.  |
| `OBSERVED-CODE` | Literally present in the PAON working tree at a stated `path:line`.                                  |
| `OBSERVED-DOC`  | Literally present in a primary specification, manual or repository this dossier retrieved directly.  |
| `PAYLOAD`       | Present in a page's served JavaScript/JSON payload but **not** rendered and **not** exercised.       |
| `SECONDARY`     | Reported by search summaries or third-party writing; the primary source was not retrievable.         |
| `GATED`         | Behind login, geography, JavaScript execution or interaction this dossier did not drive.             |
| `INFERRED`      | A reasoned conclusion. Never a substitute for the tiers above.                                       |
| `BLOCKED`       | Evidence is unavailable, so the claim is withheld rather than converted into a task for the founder. |

`BLOCKED` is the load-bearing tier. When drape, fit or physical accuracy cannot
be evidenced, the correct outcome is to withhold the claim and label the
interface illustrative. It is never to invent a manual measurement, tooling or
hiring task for the founder.

## First experiment boundary

- One neutral, original test jacket silhouette — assembled from one path
  through the chapter 09 asset graph, not authored as a monolith; no customer
  photo, body scan, measurement, cart, quote, save, share, advisor send or
  database write.
- Three illustrative fabric profiles, three precomputed drape states each and
  three local lighting scenes.
- Deterministic browser assets and a static fallback. Repository automation and
  locally available AI tooling may author original assets, but the shipped
  experience performs no runtime generation and uses no paid inference, network
  fabric images or production persistence.
- The lab may read no tenant data. A later Studio integration must make
  `retailer_id`, consent, entitlements and immutable snapshots authoritative.

Implementation is paused pending PAON ground-zero reconciliation. The
unattended pipeline must not require the founder to hire specialists or operate
3D software; when available evidence cannot support a physical claim, the
product remains explicitly illustrative instead of shifting calibration work to
the founder.

## Reconciliation

FT-07 remains consolidated into Virtual Wardrobe Studio by
`docs/FOUNDER_TOOL_BLUEPRINTS.md` and `docs/CAPABILITY_DISPOSITION.md`. This
founder-authorized research does not revive a parallel configurator or change
the current legacy intent-save route. It specifies a reusable renderer/asset
contract only; implementation requires a later explicit Phase 3 authorization.

Note on naming: "Phase 3" is the founder-level authorization gate used
throughout this dossier. `docs/PHASE.md` does not contain a section literally
numbered "Phase 3"; it uses a Stage 0–16 inheritance map with chapters numbered
4.x, and places Virtual Wardrobe Studio at items 4.6–4.10. This dossier does not
modify `docs/PHASE.md`; chapter 08 records the naming mismatch as an open item.

## Full reference-study boundary

PAON will exhaustively study the observable Suitsupply and Armani journeys and
may deliberately reproduce useful capabilities, sequencing, interaction
mechanics, option taxonomies, camera behavior, comparison patterns and fallback
behavior in a clean-room implementation. Functional parity is a starting
benchmark, not a ceiling; PAON then improves clarity, drape understanding,
accessibility, determinism and advisor integration.

The clean-room boundary is narrow: do not import or reuse their source code,
private APIs, downloaded assets, wording, fonts, imagery, 3D models, textures,
HDRIs, proprietary datasets or recognizable brand presentation. PAON may
independently implement every publicly observable behavior using original code,
content, rules and rights-cleared assets.

Chapter 01 quotes a small number of literal competitor strings. Those quotes
exist solely to prove that an observation was made, in the same way a citation
proves a reading. They are evidence, not source material: no competitor label,
option name, option code, description, price rule or taxonomy may be copied
into PAON product code, content or data.
