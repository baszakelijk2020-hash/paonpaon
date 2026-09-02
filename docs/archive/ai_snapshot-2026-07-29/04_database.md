# 04 — Database

**Snapshot date: 2026-07-29.**

## Engine

**Supabase-hosted PostgreSQL** — single project for all apps and tenants
([DATABASE.md](../DATABASE.md), ADR-003).

Local: `supabase start`. Hosted project ID/URL: [DEPLOYMENT.md](../DEPLOYMENT.md).

## ORM / access

- **No Prisma in the live stack.** `prisma/schema.prisma` is an unused orphan.
- Access via **Supabase JS client** inside `@paon/database` repositories.
- Types: generated `packages/database/src/generated/database.types.ts`.
- Domain entities are separate; repositories map rows ↔ domain.

## Schema source of truth

`supabase/migrations/` — **89** migration files observed on snapshot date.
Apply order is timestamp filename order.

## Tables (public)

**82 tables** present in generated types inventory (explore 2026-07-29),
including commercial/demo, loyalty, alterations, messaging, etc. Full list
was enumerated in exploration; notable groups:

- Tenancy / staff: `retailers`, `platform_staff_members`, `retailer_staff_members`, …
- Catalog: `products`, `product_variants`, `collections`, `product_collections`
- Commerce: `orders`, `order_lines`, `payments`, `retailer_stripe_accounts`, `stripe_webhook_events`
- Garments / alterations: `physical_garments`, fitting tables, `alteration_work_orders`, tasks, custody, workshops, price lists, `legacy_*`
- CRM / prefs: `customers`, `customer_account_links`, `customer_preferences`, wishlists
- Engagement: conversations/messages, notifications, events, wedding parties, outboxes, newsletter
- Commercial: inquiries, prospects, prospect_demo_*, entitlements, plans
- Analytics: `behavioral_events`, `ai_generations`, `audit_log_entries`

**Views (5):** customer/worker alteration projection views.

## Relationships (pattern)

- Almost all tenant business rows carry `retailer_id` FK to `retailers`
- Customers scoped per retailer; portal users link via `customer_account_links`
- Orders → order_lines → products/variants
- Alteration work orders hang off physical garments / workflow tables
- Collections ↔ products via `product_collections` M2M

Exact FK names: see migrations / generated types — not restated exhaustively here.

## Indexes / constraints

Present in SQL migrations (primary keys, FKs, unique constraints such as
slugs per retailer, RLS policies). **No exhaustive index inventory was
regenerated for this snapshot** — treat migrations as authoritative.
**Unknown without re-reading each migration:** full list of partial indexes
and performance indexes added after initial create.

## Row Level Security

Documented rule: RLS enabled on tenant tables from creating migration;
policies use JWT claims / `auth.uid()` helpers; service role limited to
webhooks/cron/authorized admin paths ([DATABASE.md](../DATABASE.md)).
Historical recursion incident and fix: ADR-045. Incident recovery: ADR-044.

## Migrations workflow

1. `supabase migration new <name>`
2. Write SQL
3. Apply locally / push hosted
4. Regenerate types

## Known issues / risks

| Issue                     | Evidence                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| Legacy tables retained    | `legacy_alterations`, `legacy_customer_fit_profile_entries`, …   |
| Thin catalog              | No attribute/metadata tables                                     |
| ProductionOrder gap       | Domain type without table                                        |
| ADR-050 pricing tables    | No `price_adjustment` / `promotion_rule` symbols found in SQL/TS |
| Migration count growth    | 89 files — bookkeeping risk (ADR-044 patterns)                   |
| Credential-gated features | Payment/email/SMS/AI rows may exist without live provider proof  |

## Future risks (factual)

- Heuristic storefront facets will diverge from any future metadata graph
  until heuristics are displaced (ADR-056 intent; not implemented).
- Expanding alterations without founder design increases invented-UI debt
  (PHASE).
