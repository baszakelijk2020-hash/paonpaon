# Non-Goals

Explicit non-goals prevent scope creep from quietly becoming
architecture. Something listed here is not rejected forever — it is
deliberately deferred, and building toward it prematurely is exactly
the kind of unrequested complexity [PRINCIPLES.md](./PRINCIPLES.md)
warns against.

## Not doing now

- **Native mobile apps.** The Customer and Retailer Portals are
  mobile-first responsive web apps ([UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)),
  not native iOS/Android apps. Revisit only once web usage data shows a
  concrete gap a PWA can't close.
- **Public API.** [API.md](./API.md) defines the shape a future
  versioned public API will take, but it is not being built until at
  least one real integration partner needs it. Building it speculatively
  now means guessing at requirements no partner has stated.
- **Self-serve retailer signup.** Retailer onboarding in PAON Admin
  ([PRODUCT.md](./PRODUCT.md)) is staff-assisted at this stage — luxury
  retailer sales cycles are high-touch by nature. A self-serve signup
  flow is a later product decision, not a technical default to build in
  now.
- **Multi-region / data residency.** One Supabase project, one region.
  Revisit only when a specific retailer's regulatory requirement or a
  measured latency problem demands it — not speculatively.
- **Offline support.** The Retailer Portal is used on the sales floor
  but assumes connectivity. Offline-first is a significant architectural
  commitment (local-first sync, conflict resolution) not justified
  without evidence retailers actually lose connectivity often enough to
  matter.
- **Plugin / app marketplace for retailers.** Integrations
  ([PRODUCT.md](./PRODUCT.md)) are built and operated by PAON, not by
  third-party developers against a plugin SDK, until there's a specific
  integration partner ecosystem to justify one.
- **Per-tenant database or schema isolation.** Tenant isolation is RLS
  within a shared database (ADR-003 in [DECISIONS.md](./DECISIONS.md)).
  Not revisited without a specific compliance requirement that RLS
  cannot satisfy.
- **A generic client-side global state library.** State management
  ([ARCHITECTURE.md](./ARCHITECTURE.md) "State management") stays
  server-first until a concrete cross-cutting client state need proves
  React's built-ins insufficient.
- **Supporting non-Next.js frontends.** `@paon/domain` is framework-
  agnostic by design (so it could be consumed elsewhere in principle),
  but there is no current plan to build a frontend outside the three
  Next.js apps. Don't add abstraction for that hypothetical now.

## Explicitly out of scope for PAON as a product

- Payment processing infrastructure — PAON integrates a payment
  provider, it does not become one.
- Manufacturing execution, MTM measurement/fit profiles, garment
  specifications, production ordering and construction — GoCreate/supplier
  systems remain authoritative. PAON owns in-store garment fitting and
  alteration work, not the factory floor. A future **wardrobe twin**
  ([vision/03_wardrobe_intelligence.md](./vision/03_wardrobe_intelligence.md))
  is not a factory fit profile and must not revive archived
  `CustomerFitProfile` under a new name without a new ADR (ADR-016 /
  ADR-055).
- Being a general-purpose CRM or e-commerce platform for non-luxury,
  high-volume retail — the product decisions throughout this document
  set (clienteling, production/alteration tracking, low-volume
  high-touch UX) are specifically for premium and luxury retail, and
  should not be diluted to serve a broader market.
- **Implementing [vision/](./vision/) pillars during the PHASE freeze.**
  Those docs are destination architecture (ADR-056). Native apps, public
  API, and offline remain deferred as above; wardrobe/metadata/AI pillars
  wait for an explicit PHASE lift after pilot proof — they are not a
  side queue.
