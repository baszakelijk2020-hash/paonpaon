# Visual quality and acceptance

## Goldens

Capture deterministic desktop (1440×900) and mobile (390×844) images for all 27 tuples: 3 cloth profiles × 3 static states × 3 lights. Goldens use seeded camera/light/renderer version and named asset manifest. A perceptual image diff (masking only loading indicator/time-independent antialiasing) must flag >0.5% changed pixels or a maximum channel delta >24 for human review. These are review gates, not guarantees of visual correctness.

## Acceptance

- keyboard radios identify profile/state/light; visible focus; controls have descriptions;
- labels explain relative character without accuracy claim;
- desktop/mobile, reduced-motion, no-WebGL and failed-load states work;
- no external requests for garment, texture, HDRI or swatch assets;
- manifest hash matches rendered variant; unavailable asset fails closed to poster;
- no material change to legacy FT-07 save flow, pricing, customer data or jobs.

## Device matrix

Chromium desktop and mobile emulation are required for the lab. Before a product claim: current Safari/iOS, Chrome Android and Firefox desktop on physical GPU classes, including low-memory mobile. Visual comparison requires colour-managed reference displays and human apparel-art direction review.
