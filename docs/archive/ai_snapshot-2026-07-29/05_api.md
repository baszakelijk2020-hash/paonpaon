# 05 — API

**Snapshot date: 2026-07-29.**

PAON does **not** expose a versioned public REST API (`/api/v1` — documented
as not started in [API.md](../API.md)). The “API surface” is:

1. **Server Actions** (~61 `"use server"` files across three apps)
2. **Route Handlers** for webhooks, crons, auth confirm, fonts, and storefront HTML/JSON helpers

## Cross-cutting

| Concern    | Pattern                                                               |
| ---------- | --------------------------------------------------------------------- |
| Auth       | `@paon/auth` guards / per-app `getSession` / middleware `accountType` |
| Validation | zod schemas from `@paon/domain`                                       |
| Data       | `@paon/database` repositories only                                    |
| Errors     | Typed application errors (Unauthorized/Forbidden, domain failures)    |

---

## By domain (representative)

Exact action names live in colocated `actions.ts` / `*-actions.ts`. This
snapshot groups by area rather than listing every exported function
(counts drift).

### Identity

- Login / sign-out / accept-invite Server Actions (all apps)
- `GET .../auth/confirm` OTP verification Route Handlers

### Retailer admin (platform)

- Retailer onboarding, staff invites, prospect/Demo Studio mutations
- Billing portal / subscription sync via Stripe webhook `POST /api/webhooks/stripe` (admin)
- Crons: `dispatch-emails`, `dispatch-sms`, `dispatch-newsletter`, `expire-demo-environments` (Bearer `CRON_SECRET`)

### Catalog / commerce (customer + retailer)

- Product/collection CRUD (retailer Server Actions)
- Cart/checkout Server Actions; draft Order pattern (ADR-024)
- Storefront: `POST/GET` under `apps/customer/app/r/[slug]/api/{cart-add,cart-update,cart-summary,appointment-request,table-service-inquiry}`
- `GET/POST` equivalent HTML shell: `apps/customer/app/r/[slug]/route.ts` (ADR-046)

### Payments

- Connect onboarding + checkout session creation (Server Actions + `@paon/payments`)
- `POST` customer Connect webhook `/api/webhooks/stripe`

### Alterations / appointments / loyalty / messaging / events / wedding

- Retailer and customer dashboard Server Actions per route tree
- Print routes are pages, not JSON APIs

### AI

- Retailer customer detail: next-best-action generation action
- Customer dashboard: Today’s Pick / product recommendation action
- Persistence via `AIGenerationRepository`

### Preferences / wishlist / newsletter / commercial marketing

- Customer account preferences, wishlist RPCs (ADR-026/028)
- Marketing commercial inquiry / demo-request / newsletter actions

---

## Authentication summary

| Caller                 | Mechanism                                                                 |
| ---------------------- | ------------------------------------------------------------------------- |
| Browser staff/customer | Cookie session (Supabase SSR)                                             |
| Cron                   | `Authorization: Bearer CRON_SECRET`                                       |
| Stripe                 | Signature verification (`@paon/payments`)                                 |
| Public storefront HTML | Anonymous + retailer slug; cart/wishlist may use RPCs/cookies per feature |

## Request / response models

- Server Actions: FormData or typed objects validated by domain zod schemas;
  return typed result objects / redirect / revalidate patterns (Next.js)
- Storefront JSON routes: ad hoc JSON bodies — **no shared OpenAPI schema**
- Webhooks: Stripe event payloads parsed by `@paon/payments`

## Dependencies

Domain → database → auth → payments/email/sms/ai as needed per action.

## Scalability / design concerns (observed)

- No public API versioning surface yet
- Large Server Action surface area (~61 files) — discoverability is route-local
- Storefront dual path (Server Actions vs `r/[slug]/api/*`) for HTML template
- Newsletter cron not registered in `vercel.json` (ops gap)
- Provider rate limits / outbox drain are single-region cron based
