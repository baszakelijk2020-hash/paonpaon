# Atelier Demo Storefront — Timings (v1, 2026-08-26)

## Status

**NOT MEASURED in v1.** Measuring requires the customer app running on `:3002`
against a Supabase project seeded with the `atelier-demo` retailer. Standing
that environment up is outside this read-only baseline lane
(`phase-20.3` / `claude-storefront-baseline`). Fields and procedure are fixed
here so a later run records comparable numbers under a new baseline version.

## Fields to record

Per URL, median of 5 warm requests (server already compiled, template cached),
plus 1 cold number where noted.

| Field                   | Definition                            | Source of the cost                                        |
| ----------------------- | ------------------------------------- | --------------------------------------------------------- |
| `ttfb_ms`               | Request start → first byte            | Route Handler total server time                           |
| `server_render_ms`      | Time inside `GET(...)`                | template load + all repo queries + serialize              |
| `db_round_trips`        | Count of Supabase queries per request | see breakdown below                                       |
| `html_bytes`            | Response body size                    | substituted template                                      |
| `dom_content_loaded_ms` | Navigation start → `DOMContentLoaded` | browser                                                   |
| `load_ms`               | Navigation start → `load`             | browser incl. GSAP from cdnjs                             |
| `lcp_ms`                | Largest Contentful Paint              | browser, grid/hero image                                  |
| `cls`                   | Cumulative Layout Shift               | browser; mobile path must be ~0 (pre-paint `paon-mobile`) |

## Per-request DB round-trip breakdown (`/r/atelier-demo`, from `route.ts`)

Anonymous visitor:

1. `supabase.auth.getUser()`
2. `RetailerRepository.findBySlug(slug)` (request-cached)
3. `ProductRepository.findByRetailer` + `CollectionRepository.findByRetailer` (parallel)
4. `ProductVariantRepository.findByProducts`
5. Knowledge: `MetadataRepository.findAssignmentsForReview` + `KnowledgeRepository.projectDiscoveryCandidates` (candidates only if concept ids present)
6. Catalogue: `MetadataRepository.findAssignmentsForReview` + `findVisibleConcepts` + `CatalogueQueryRepository.projectCandidates` (parallel)
7. `prospect_demo_environments` → `prospect_demo_configurations` (2, sequential)
8. `appointmentStoresFor` — for `atelier-demo` returns the hardcoded maison list (no extra query)

Signed-in customer adds: `CustomerRepository.findByUserId`, then
`WeddingPartyRepository.findByCustomer` + `WardrobeRepository.findByCustomer`
(parallel).

Note `MetadataRepository.findAssignmentsForReview(retailerId, "accepted")` is
called **twice** per request (once in each serializer) — a known duplicate
worth recording as a timing line but out of scope to change here.

## Capture procedure (for a later run)

1. Bring up Supabase with the demo seed (`packages/database/scripts/seed-demo.ts`)
   so retailer `atelier-demo` exists and is `active`.
2. `pnpm --filter @paon/customer dev` (or `pnpm dev` in `apps/customer`) → `:3002`.
3. Warm once: `curl -s -o /dev/null -w '%{time_starttransfer} %{size_download}\n' http://localhost:3002/r/atelier-demo`.
4. Record `ttfb_ms` / `html_bytes` as median of 5 warm `curl` runs; 1 cold run
   (right after `dev` start) for the cold column.
5. Browser metrics via Playwright / Chrome: navigate, read
   `performance.getEntriesByType('navigation')[0]` and PerformanceObserver LCP/CLS.
6. Repeat for: `/r/atelier-demo?category=Suits`,
   `/r/atelier-demo/products/<seeded-slug>` (e.g.
   `midnight-blue-s130-natural-bi-stretch-wool-solaro-herringbone-6088`),
   `/r/atelier-demo/cart`, `/r/atelier-demo/appointments`.
7. Write results into the new baseline's `timings.md` as a filled table, keeping
   these field names.

## Results table (empty — v1)

| URL                               | cold ttfb_ms | warm ttfb_ms (median/5) | server_render_ms | db_round_trips | html_bytes | dcl_ms | load_ms | lcp_ms | cls |
| --------------------------------- | ------------ | ----------------------- | ---------------- | -------------- | ---------- | ------ | ------- | ------ | --- |
| `/r/atelier-demo`                 | —            | —                       | —                | ~13            | —          | —      | —       | —      | —   |
| `/r/atelier-demo?category=Suits`  | —            | —                       | —                | ~13            | —          | —      | —       | —      | —   |
| `/r/atelier-demo/products/<slug>` | —            | —                       | —                | —              | —          | —      | —       | —      | —   |
| `/r/atelier-demo/cart`            | —            | —                       | —                | —              | —          | —      | —       | —      | —   |
| `/r/atelier-demo/appointments`    | —            | —                       | —                | —              | —          | —      | —       | —      | —   |
