# Visual quality and acceptance

Evidence tiers are defined in `00_NORTH_STAR_AND_SCOPE.md`.

## Goldens

Capture deterministic desktop (1440×900) and mobile (390×844) images for all 27
tuples: 3 cloth profiles × 3 static states × 3 lights. A golden's identity is
the full tuple **plus** the renderer version, `outputColorSpace`, `toneMapping`,
`toneMappingExposure`, camera seed, light rig and named asset manifest version.
Changing any of those invalidates the set; there is no partial re-baseline.

A perceptual image diff — masking only the loading indicator and
time-independent antialiasing — blocks a build at >0.5% changed pixels or a
maximum channel delta >24, and routes the result through an automated
multimodal tailoring checklist.

These thresholds are review gates. They detect _change_. They do not establish
that an image is correct, that a jacket reads as a jacket, or that a drape is
physically plausible. A build that passes every threshold can still be wrong in
every way that matters to a tailor.

## Regression tooling

`OBSERVED-DOC`, retrieved 2026-08-15. Playwright's visual comparison compares a
screenshot against a committed golden via `toHaveScreenshot()`, and the
documentation states that Playwright Test uses the **pixelmatch** library, with
options passed through to it — `maxDiffPixels` is documented, settable per
assertion or globally under `expect.toHaveScreenshot` in `playwright.config.ts`.
Snapshots are stored beside the test in a `<file>.spec.ts-snapshots` directory
that the documentation says should be committed to version control and reviewed
on change.

Two honest limits:

- The documented option surface on that page is `maxDiffPixels` and
  `stylePath`. Default values for `threshold` and `maxDiffPixelRatio` are **not
  stated there**, so PAON must set its thresholds explicitly rather than rely on
  an assumed default. The 0.5% / delta-24 numbers above are PAON policy, not
  inherited defaults.
- Playwright documents that browser rendering varies with host operating
  system, version, settings, hardware, power source and headless mode. A golden
  is therefore valid only for the exact environment that produced it. Goldens
  must be generated in a pinned container, and a developer machine disagreeing
  with CI is expected behaviour, not a defect.

## Acceptance criteria

- Keyboard radios identify profile, state and light; focus is visible; every
  control has an accessible description.
- Labels explain relative character without an accuracy claim, and the
  `illustrative` provenance of every profile is visible in the interface, not
  buried in a tooltip.
- Desktop, mobile, reduced-motion, no-JavaScript, no-WebGL and failed-load
  states all present the full comparison in text.
- No external network request is made for any garment, texture, HDRI or swatch
  asset.
- The manifest hash matches the rendered variant; an unavailable asset fails
  closed to the poster rather than rendering a stale or partial scene.
- The glTF Validator passes on every shipped asset (chapter 03) — necessary,
  never sufficient.
- Chapter 09's graph checks pass: seam ring arity and arc-length correspondence
  hold between every attachable assembly pair; grain-vector delta across each
  seam is under the published threshold; UV chart leases are disjoint; anchors
  resolve to valid surface bindings in every drape state; and every reachable
  selection either resolves or fails closed with a published reason.
- A substituted assembly produces **no visible join**. This needs its own
  review: a seam artefact is a small, localized, high-salience defect that a
  whole-image pixel budget of 0.5% will not catch. Assembly-substitution
  goldens are therefore diffed against a seam-region mask at a stricter
  threshold than the full frame.
- No material change to the legacy FT-07 save flow, pricing, customer data or
  jobs.

## Device matrix

Chromium desktop and mobile emulation are required for the lab. Emulation is
where the matrix starts, not where it ends: before any product claim, verify on
current Safari/iOS, Chrome Android and Firefox desktop across representative
physical GPU classes, including a low-memory mobile device.

`OBSERVED-DOC`, from chapter 05: MDN's guidance that the only errors a
well-formed WebGL page generates are `OUT_OF_MEMORY` and `CONTEXT_LOST` makes
the low-memory device the load-bearing test case, not an edge case. CI headless
GPU rendering can differ materially from physical devices, so a green CI matrix
is not device evidence.

## When evidence is insufficient

A product claim stays blocked. It is not downgraded to a caveat, and it is not
converted into a task for the founder to buy devices, hire a QA specialist or
operate 3D software. The lab ships with the claims its evidence supports and
says plainly which ones it does not make.

## Sources

| Source               | Organization           | Date accessed | URL                                                                             | Relevance / limitation                                                                                   |
| -------------------- | ---------------------- | ------------: | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Visual comparisons   | Microsoft / Playwright |    2026-08-15 | https://playwright.dev/docs/test-snapshots                                      | Deterministic screenshot regression via pixelmatch; defaults for `threshold` are not stated on the page. |
| WebGL best practices | MDN                    |    2026-08-15 | https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices | Establishes low-memory failure as the primary device risk; guidance, not a device matrix.                |
