# Atelier Demo Storefront — Screenshots (v1, 2026-08-26)

## Status

**CAPTURED.** 14 PNGs — 7 surfaces × desktop + mobile — produced by
`apps/customer/e2e/atelier-demo-baseline.spec.ts` against the production build
(`pnpm start`, port 3002) with Supabase seeded via `seedDemoData`. Re-running
the spec overwrites these deterministically. Capture metadata (viewport, DPR,
browser, URL per shot) is in `../capture.json`.

| Surface                                  | URL                                | Files                                                   |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Home (curated gate — `landOnGrid=false`) | `/r/atelier-demo`                  | `01-home-gate--desktop.png`, `01-home-gate--mobile.png` |
| Category grid — Suits                    | `/r/atelier-demo?category=Suits`   | `02-home-grid-suits--{desktop,mobile}.png`              |
| Category grid — Jackets                  | `/r/atelier-demo?category=Jackets` | `03-home-grid-jackets--{desktop,mobile}.png`            |
| Appointments                             | `/r/atelier-demo/appointments`     | `04-appointments--{desktop,mobile}.png`                 |
| Locations                                | `/r/atelier-demo/locations`        | `05-locations--{desktop,mobile}.png`                    |
| Swipe                                    | `/r/atelier-demo/swipe`            | `06-swipe--{desktop,mobile}.png`                        |
| Configurator                             | `/r/atelier-demo/configurator`     | `07-configurator--{desktop,mobile}.png`                 |

## Capture parameters (frozen)

|                    | Desktop                                                   | Mobile                 |
| ------------------ | --------------------------------------------------------- | ---------------------- |
| Viewport           | 1440 × 900                                                | 390 × 844              |
| Device pixel ratio | 2                                                         | 3                      |
| Emulation          | —                                                         | `isMobile`, `hasTouch` |
| Browser            | Chromium (Playwright bundled)                             | same                   |
| Server             | Next.js production build, `pnpm start` :3002              | same                   |
| Data               | `seedDemoData` — retailer `atelier-demo`, status `active` | same                   |
| Screenshot         | `fullPage: true`, 600ms settle after `networkidle`        | same                   |

Mobile width 390 < the template's `MOBILE_MAX_W = 850`, so the pre-paint
`paon-mobile` class path is exercised (no desktop flash).

## Re-capture

```
cd apps/customer && set -a && source .env.local && set +a \
  && pnpm exec playwright test e2e/atelier-demo-baseline.spec.ts
```

## Parity use

Any shared-shell storefront port is compared against these exact files at each
checkpoint in `../../../../plans/ATELIER_DEMO_PARITY_TEST_PLAN.md`. A visible
difference in layout, crop/cover, type, motion end-state, or navigation
behaviour is a failed port (CUSTOMER_ENVIRONMENT_REBUILD_V3.md §3.2), not an
acceptable approximation.
