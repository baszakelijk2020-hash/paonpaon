# Virtual Wardrobe Studio Blueprint

**Status:** authoritative founder-level product specification, extending
[NORTH_STAR.md](./NORTH_STAR.md) Module 3 (Wardrobe and Styling
Intelligence), and building directly on the wardrobe/roadmap/sartorial
foundation landed in `PHASE.md` Stage 4.1–4.2. This document is a
specification to be implemented feature by feature under `PHASE.md`'s
authorized queue — it is not itself a queue, and nothing here is built until
`PHASE.md` sequences it. Where this document names a new entity, table shape
or domain concept, it is a target contract for a future PHASE item, not a
claim that it exists in code today, except where a section explicitly says
"landed" and cites a PHASE item.

This document does not repeat what `NORTH_STAR.md`, `DOMAIN_MODEL.md` and the
Stage 4 wardrobe foundation already establish; it assumes them. Where a new
idea would duplicate or compete with an existing mechanism — `Outfit`,
`WardrobeRoadmap`, `SartorialRule`/`evaluateOutfitCompatibility`,
`StyleQuiz`/`customer_style_preference_evidence`, `SilhouetteAnalysisSession`,
purpose-specific consent, `ai_generations` — this document extends that
mechanism by name rather than inventing a second system that does the same
job differently.

---

## 0. What this is, in one sentence

The customer's existing digital wardrobe (owned pieces + wishlist/aspirational
catalogue pieces) gains a **virtual try-on**: generate a photorealistic image
of the customer wearing a chosen combination of those pieces. The same
generation capability, aimed at the advisor side, turns the existing
`WardrobeRoadmap` into a **visual roadmap** — up to twelve generated looks the
advisor proposes as the client's next purchases, instead of the current
citation-only text stages.

This is **not a new destination**. It is new capability inside the wardrobe
surfaces that already exist: the customer `/wardrobe` page and the retailer
client profile's wardrobe/roadmap cards. See §1 for why, and the founder
clarification recorded in the 2026-08-06 session transcript this document was
authored from.

## 1. Where this lives, and why it is not a new nav item

PAON already has the three pieces a "virtual wardrobe" needs, under different
names:

| Spec concept                                          | Real PAON entity                                                                                                               | File                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| "Library of owned + aspirational items"               | `WardrobeItem` (owned) + `Wishlist`/`WishlistItem` (aspirational/catalogue)                                                    | `wardrobe/wardrobe.ts`, `customer/wishlist.ts` |
| "Customer's own virtual creations"                    | `Outfit` — already has `customerId`, an optional `roadmapId`, and slots referencing either a `wardrobeItemId` or a `productId` | `wardrobe/outfit.ts`                           |
| "Advisor's grid of 12, the ultimate wardrobe roadmap" | `WardrobeRoadmap` — advisor-authored, goals/ranked gaps/staged priorities, customer approve/reject                             | `wardrobe/roadmap.ts`                          |
| Outfit-slot validation                                | `SartorialRule` / `evaluateOutfitCompatibility`                                                                                | `wardrobe/sartorial.ts`                        |

The only genuinely missing capability is **turning an `Outfit` (customer- or
advisor-authored) into a generated image of the customer wearing it**, and the
identity/preset/consent/job scaffolding that makes that safe and repeatable.
Everything else — browsing, owning, wishing, composing, roadmapping,
validating — already exists and must not be duplicated. Concretely: no new
"Virtual Studio" top-level nav entry, no new "Look" entity competing with
`Outfit`, no new "roadmap" entity competing with `WardrobeRoadmap`.

`Outfit.createdByStaffId` is currently required, i.e. today only advisors can
author an `Outfit`. That is the one real gap this blueprint closes: customers
need to compose their own try-on outfits too. §4 extends `Outfit` with
optional customer authorship instead of forking a parallel entity.

## 2. Design principle: lead, don't transcribe

The founder's brief for this capability is a wide product spec, not a literal
build order (same posture ADR-056 and ADR-073 already establish for vision
documents and founder briefs generally). Engineering owns the technical
decomposition inside that intent. Two things are non-negotiable per the
founder's own framing of this session:

1. **It must feel like PAON**, not a bolted-on AI feature: quiet, editorial,
   premium, image-led — the same bar `AGENTS.md`'s "Frontend implementation
   rules" already set for every other surface. No prompt-playground controls,
   no visible model/token/provider chrome, no generic SaaS AI-dashboard
   affordances anywhere a customer or advisor can see.
2. **The generation call is provider-swappable from day one.** Whatever image
   model is plugged in today is not assumed to be the final one — a better
   virtual try-on model is expected to replace it later without touching the
   domain, repositories, queue or UI. This mirrors `AIProvider` (ADR-033):
   one interface, replaceable implementation, nothing outside `@paon/ai`
   imports a vendor SDK type directly.

## 3. Identity, fit and style: what is reused, what is new, and why

### 3.1 Identity photos — new: `StylePortrait`

No existing entity stores a customer-approved reference photo for
identity-preserving image generation. `SilhouetteAnalysisSession` (FT-02) is
adjacent — consent + capture + advisor review — but is a body-shape analysis
tool, a different purpose with a different eventual consumer
(`customer_style_profiles`/fit-freshness), not identity photos for rendering.
A new `StylePortrait` (§ see domain module `wardrobe/virtual-studio.ts`)
reuses the _shape_ of that consent/capture/review pattern without reusing the
table, because the two must never be conflated: a silhouette-analysis photo is
never eligible to become a generation reference, and vice versa.

### 3.2 Fit preference — reused: `MetadataConcept` kind `"fit"` + StyleProfile evidence

**This is the one area with a real historical constraint.** ADR-016 archived
`CustomerFitProfileEntry`: PAON is not the manufacturing/measurement source of
truth, and fit data belongs on a `PhysicalGarment` via `FittingObservation`,
never on `Customer`. ADR-055 reaffirmed it for wedding-party height/weight.
Both explicitly warn against reviving a customer-level fit profile "under a
wardrobe-twin name without a new ADR." PHASE.md Stage 4's own non-goals repeat
it: "no generic customer manufacturing fit profile."

The four fit archetypes this spec wants (slim/classic/contemporary/
fashion-wide) are **not measurements and are not manufacturing data** — they
are a stylistic silhouette preference that only ever affects how a generated
image is rendered. `metadata.schema.ts` already has `"fit"` as a first-class
`MetadataConceptKind`. So: seed four canonical, platform-owned
`MetadataConcept` rows of kind `"fit"` (mirroring
`20260803000004_seed_style_quiz_concepts.sql`'s exact pattern for style
archetypes), each carrying its structured tailoring attributes (lapel width,
waist suppression, jacket length, shoulder expression, sleeve width, trouser
rise, thigh ease, leg width, trouser break) in `attributes`. A customer's
choice among them is declared through the _existing_
`upsert_declared_style_preference` RPC and lives in
`customer_style_preference_evidence`/`customer_style_profiles` — exactly like
a style-quiz answer. **No new fit-preference table.** ADR-074 records this
distinction explicitly so a future reader does not read "fit profile" in this
document and conflate it with the banned concept.

### 3.3 Style calibration — reused: `StyleQuiz`

Step 6 in the founder brief ("classic vs fashion-forward", "close vs relaxed
silhouette", etc.) is `buildStyleQuizArchetypes`/`buildStyleQuizTweakQuestions`
verbatim. No new entity.

### 3.4 Outfit validation — reused: `evaluateOutfitCompatibility`

Duplicate-role/impossible-layering checks the brief asks for are
`outfitSlotConsistencyIssues` (already enforced by the `outfits` schema's
unique-slot-kind constraint) plus `evaluateOutfitCompatibility`'s existing
fail-closed compatibility claims. No new validation engine.

## 4. New entities (genuinely required)

Domain module `packages/domain/src/wardrobe/virtual-studio.ts`:

- **`StylePortrait`** — versioned, customer-owned visual reference set
  (face/full-body/side/pose/outfit-reference images), status
  (`draft` → `preview_generated` → `approved` / `rejected` / `superseded`).
  One `approved` portrait active per customer at a time.
- **`RetailerVisualPreset`** — retailer-configured generation defaults
  (background, pose family, camera, crop, aspect ratio, lighting, expression,
  visual treatment, negative constraints). `bodyModificationProhibited` is a
  literal `true` on every preset — not configurable, per the founder brief's
  own "must never slim/age-reduce/reshape/skin-tone-change" boundary.
- **`WardrobeVisualizationJob`** — the generation snapshot/job/result. Points
  at an `Outfit` (existing entity, now customer- or advisor-authored), a
  `StylePortrait`, a `RetailerVisualPreset`; carries an immutable input
  snapshot, a deterministic input hash for idempotency/caching, provider/model,
  status (`queued`/`generating`/`ready`/`failed`/`cancelled`), attempt count,
  output image reference, cost.
- **`WardrobeVisualizationFeedback`** — the explicit signal vocabulary (love
  it / save / not for me / regenerate / fit correction / colour correction /
  "doesn't look like me") that becomes preference evidence, never a silent
  retraining signal.

Extended, not duplicated:

- **`Outfit`** (`wardrobe/outfit.ts`) — `createdByStaffId` becomes optional;
  add `createdByCustomerId`. Exactly one of the two must be set (new pure
  guard `outfitAuthorIssues`). This is the one real authorship gap identified
  in §1.
- **`CONSENT_PURPOSES`** (`intelligence/consent.ts`) — add `"image_generation"`
  as a fourth purpose, reusing the entire existing
  `CustomerConsentState`/`buildConsentSnapshot`/`customer_consent_events`
  machinery. Generation is blocked without explicit grant, exactly like
  personalization capture today.

## 5. Slice plan under PHASE.md Stage 4 (Wardrobe and Styling Intelligence)

- **4.6 — Virtual Wardrobe Studio: shared foundation.** Domain module,
  migrations, RLS, repositories, `AIProvider.generateWardrobeVisualization`,
  queue (mirrors the existing `email_outbox` claim-and-process pattern),
  private storage. No UI. _(this session)_
- **4.7 — Customer Style Portrait onboarding.** Consent step, capture flow,
  fit-archetype selection (via `upsert_declared_style_preference`), one
  neutral preview generation, approval.
- **4.8 — Customer single-look try-on.** Compose an `Outfit` from
  owned/wishlist/catalogue items inside the existing `/wardrobe` page,
  generate one image, feedback actions, send-to-advisor.
- **4.9 — Advisor visual roadmap.** Generation on `WardrobeRoadmapStage`-linked
  outfits inside the existing retailer client profile roadmap card; up to
  twelve looks; sequential generation; customer review one look at a time.
- **4.10 — Multi-look queue and personalization loop.** Batch "create all
  saved looks"/"create all pending looks," cancellation, and feedback→
  `customer_style_preference_evidence` wiring with confidence/evidence-count
  per §7.

Each is one coherent pushed slice per the Ordered build queue rule; later
slices are committed scope, not optional.

## 6. Provider and queue boundary

- `AIProvider.generateWardrobeVisualization(context): Promise<result>` —
  new method alongside `generateConceptImages`, same file
  (`packages/ai/src/provider.ts`), same "never shown on its own authority"
  discipline: a `ready` job's image is not user-visible until copied into
  PAON storage and the job row says `ready`.
- Runner mirrors `concept-generation-runner.ts`: bounded retry, structured
  result, no direct vendor SDK outside `@paon/ai`.
- Queue reuses the `email_outbox`/`claim_pending_emails` shape (`for update
skip locked`, `status`/`attempts`/`last_error`) rather than inventing new
  job infrastructure: `wardrobe_visualization_jobs` gets an equivalent
  `claim_pending_wardrobe_visualization_jobs()` function and a cron
  dispatcher route, processing sequentially per customer/roadmap as the brief
  requires.
- Idempotency: a unique partial index on `(outfit_id, input_hash)` where
  status is `queued` or `generating` blocks duplicate active jobs for the
  same input without a new locking mechanism.

## 7. Personalization loop

Positive/negative signals recorded via `WardrobeVisualizationFeedback` feed
`customer_style_preference_evidence` with `source` values scoped to this
feature (`generation_loved`, `generation_rejected`, etc.), exactly like a
product view or favorite does today — no second preference-evidence table, no
direct image-model retraining. Fit-archetype changes only update the
persistent declared preference on an explicit customer save action, per §3.2;
look-specific overrides never silently promote to persistent.

## 8. Non-goals (this blueprint, all slices)

- No CLO3D-grade measurement-accurate simulation; this is AI visualization,
  always labelled as such, never a guarantee of physical fit.
- No revival of a customer-level manufacturing fit/measurement profile
  (ADR-016/055 stand; see ADR-074 for the boundary this blueprint respects).
- No silent body reshaping, slimming, age reduction or skin-tone change in
  any preset or generation, ever — enforced as a literal non-configurable
  field on `RetailerVisualPreset`, not a prompt instruction alone.
- No new top-level customer/retailer nav destination; this lives inside the
  existing wardrobe surfaces (§1).
- No prompt-engineering UI exposed to ordinary customers or advisors (§2).
