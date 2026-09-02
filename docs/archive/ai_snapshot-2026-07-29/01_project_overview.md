# 01 — Project overview

**Snapshot date: 2026-07-29. Factual for that date and superseded for current
phase/queue claims by `PHASE.md` on 2026-07-30.**

## Overall purpose

PAON is a RetailOS and customer-engagement platform for premium /
independent menswear retailers. It is delivered as three Next.js apps
sharing one domain model and one Postgres schema, spanning retailer
operations (CRM, catalog, orders, alterations, appointments, loyalty,
messaging) and a customer storefront/portal.

Documented product framing: [docs/VISION.md](../VISION.md),
[docs/NORTH_STAR.md](../NORTH_STAR.md), [docs/PRODUCT.md](../PRODUCT.md).

## Current maturity

| Signal                 | Fact                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineering foundation | Monorepo, CI, three apps, shared packages — present and used                                                                                                                                                                                        |
| Domain breadth         | Large: catalog, commerce, alterations, loyalty, messaging, commercial/Demo Studio, wedding parties, etc.                                                                                                                                            |
| Paying pilots          | Documented objective is three paid commitments ([PHASE.md](../PHASE.md)); repository does not prove live paid pilots                                                                                                                                |
| Provider execution     | ADR-051 records five subsystems never executed against real credentials at audit time: Stripe payments, Stripe billing, Resend, Twilio, OpenAI — code exists; live verification depends on env provisioning (see [DEPLOYMENT.md](../DEPLOYMENT.md)) |
| Active phase           | Snapshot recorded the former pilot freeze; current phase is the Intelligence Platform programme in [PHASE.md](../PHASE.md)                                                                                                                          |
| Doc trust              | [PROJECT_STATE.md](../PROJECT_STATE.md) self-disclaims unverified “shipped” language; prefer code + migrations                                                                                                                                      |

Maturity is **broad and uneven**: many surfaces exist in UI/domain/DB;
several commercial and messaging integrations are wired in code but
historically credential-blocked. Exact production credential state on a
given day is **unknown from source alone** — check hosted env / DEPLOYMENT.

## Architectural style

- **Monorepo** (pnpm workspaces + Turborepo)
- **Modular packages** with one-way dependency: apps → auth/ui/utils → database → domain
- **Server Components first**; mutations via **Server Actions**
- **Repository pattern** for all data access (`@paon/database`)
- **Multi-tenant Postgres RLS** on `retailer_id` / auth helpers
- **No public REST API** yet; Route Handlers for webhooks, crons, and storefront HTML exceptions
- Founder HTML storefront served **byte-for-byte** (ADR-046 / ADR-052)

## Technology stack

| Layer        | Technology                                                 |
| ------------ | ---------------------------------------------------------- |
| Runtime      | Node ≥22 (`.nvmrc` 22.20.0), pnpm 9.15                     |
| Apps         | Next.js 15 App Router (three apps)                         |
| Language     | TypeScript strict                                          |
| UI           | React, Tailwind CSS v4, `@paon/ui` tokens                  |
| Backend data | Supabase (Postgres + Auth + Storage + Realtime capability) |
| Payments     | Stripe Connect + Stripe Billing (`@paon/payments`)         |
| Email        | Resend (`@paon/email`) + durable `email_outbox`            |
| SMS          | Twilio (`@paon/sms`) + durable `sms_outbox`                |
| AI           | OpenAI via `@paon/ai` (`gpt-4o-mini` default in provider)  |
| Tests        | Vitest (packages), Playwright e2e (apps)                   |
| CI           | GitHub Actions `.github/workflows/ci.yml`                  |

## Deployment model

Three Vercel projects, root directories under `apps/*`, deploy on push to
`main` (documented in [DEPLOYMENT.md](../DEPLOYMENT.md)):

- `paonpaon-admin` → admin
- `paonpaon-retailer` → retailer
- `paonpaon-customer` → customer

Shared hosted Supabase project (URL documented in DEPLOYMENT). Admin
`vercel.json` schedules email/SMS cron Route Handlers. CI verifies; it does
not deploy.

## Major applications

| App             | Package         | Role                                                                                     |
| --------------- | --------------- | ---------------------------------------------------------------------------------------- |
| PAON Admin      | `apps/admin`    | Platform staff: retailers, prospects/Demo Studio, billing, inquiries, AI monitoring      |
| Retailer Portal | `apps/retailer` | Tenant ops: CRM, catalog, orders, alterations, appointments, loyalty, messages, settings |
| Customer Portal | `apps/customer` | Client login portal + public marketing + path-based storefront `/r/[slug]`               |

## Major services (packages)

| Package          | Role                                            |
| ---------------- | ----------------------------------------------- |
| `@paon/domain`   | Entities, zod schemas, branded IDs              |
| `@paon/database` | Supabase clients, repositories, generated types |
| `@paon/auth`     | Session resolution, role guards                 |
| `@paon/ui`       | Design tokens + shared components               |
| `@paon/utils`    | Shared helpers (e.g. `stripUndefined`)          |
| `@paon/payments` | Stripe Connect + Billing helpers                |
| `@paon/email`    | Resend send wrapper                             |
| `@paon/sms`      | Twilio SMS/WhatsApp send wrapper                |
| `@paon/ai`       | OpenAI provider (2 generation methods)          |

There is **no separate microservice** process in this repo.

## Current strengths

- Clear layering and branded IDs reducing cross-entity mixups
- RLS-first tenancy documented and present in migrations
- Single domain model shared by three apps
- Extensive alteration / garment workflow model in domain + DB
- Verbatim founder storefront as intentional design-control mechanism
- CI gate: install, lint, typecheck, test, build, format:check

## Current weaknesses

- Feature breadth vs conversion focus (ADR-051)
- Thin catalog semantics (name/description/collections; no attribute graph)
- Storefront category/colour/season via **keyword heuristics**, not persisted metadata
- Several integrations historically never live-exercised (ADR-051)
- Dual UX languages: `@paon/ui` portals vs large HTML template storefront
- `PROJECT_STATE.md` partially unreliable without re-verification
- Root orphans: `prisma/`, root `ROADMAP.md` / `CURRENT_STATE.md` (Made to Munro scaffold) contradict live docs

## Known architectural debt

- Credential-dependent subsystems treated as “complete” in older prose
- `ProductionOrder` exists in domain types; **no** matching table/repository found in generated schema inventory
- ADR-050 pricing primitives (`PriceAdjustment` / `PromotionRule`) — **no** matching code/table symbols found in TS/SQL grep on 2026-07-29 (decision recorded; implementation status: **not present or renamed elsewhere — unknown if partially planned only**)
- Legacy alteration / fit-profile tables renamed to `legacy_*` (ADR-016)
- Newsletter cron Route Handler exists but is not in `vercel.json` crons (documented in ROADMAP)
- App-local session/middleware wrappers alongside `@paon/auth` (noted in PROJECT_STATE)

## Important assumptions

1. One Supabase project serves all tenants and all three apps.
2. Tenant security is RLS, not app code alone.
3. Mutations are Server Actions unless webhook/cron/storefront HTML needs a Route Handler.
4. Founder-designed HTML surfaces must not be rewritten in Tailwind (ADR-052).
5. [PHASE.md](../PHASE.md) overrides ROADMAP / vision / competitive gaps as a build queue.
6. Independent retailer is the buyer; no Brand entity exists yet (COMPETITIVE_GAPS / PHASE).
