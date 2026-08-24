# 13 — Dependency graph

**Snapshot date: 2026-07-29.** From `package.json` workspace dependencies.

## Package edges (runtime `@paon/*`)

```text
@paon/domain          (leaf — no workspace deps)
@paon/ui              (leaf)
@paon/ai              (leaf; openai)
@paon/email           (leaf; resend)
@paon/sms             (leaf; twilio)

@paon/database   → @paon/domain
@paon/utils      → @paon/domain
@paon/payments   → @paon/domain
@paon/auth       → @paon/database, @paon/domain

apps/admin       → auth, database, domain, email, payments, sms, ui, utils
apps/retailer    → ai, auth, database, domain, payments, ui, utils
apps/customer    → ai, auth, database, domain, payments, ui, utils
```

Config edges (dev): most packages → `@paon/eslint-config`, `@paon/typescript-config`.

## Shared abstractions

- Domain entities + zod
- Repository classes
- `resolveAppSession` / role guards
- UI primitives + tokens
- Stripe/Resend/Twilio/OpenAI thin clients

## Tight coupling (observed)

| Coupling                                      | Why it matters                          |
| --------------------------------------------- | --------------------------------------- |
| Apps ↔ `@paon/database` repositories          | Schema changes ripple to all apps       |
| Storefront Route Handler ↔ huge HTML template | Design locked to founder file (ADR-052) |
| Auth JWT claims ↔ RLS policies                | Must stay in sync                       |
| Commercial demo tables ↔ retailer concepts    | Parallel models                         |

## High-risk external dependencies

| Dependency                         | Risk                                         |
| ---------------------------------- | -------------------------------------------- |
| Supabase                           | Single backend SPOF                          |
| Stripe                             | Payments/billing; historically unproven live |
| OpenAI                             | AI features; cost/availability               |
| Resend / Twilio                    | Messaging delivery                           |
| Vercel                             | Three-app deploy                             |
| Fonts CDN proxy (nebelspiegel.com) | Font Route Handlers depend on upstream       |

## Cyclic dependencies

**None observed** among `@paon/*` package.json edges. Domain remains a DAG root.

App-to-app imports are forbidden by architecture; not exhaustively proven by
static analysis in this snapshot (**Unknown** if any illegal relative imports
exist — none found in structured package graph).

## Recommendations (graph hygiene)

1. Keep AI/email/sms as leaf packages (no domain dependency today — fine; pass
   primitives in).
2. Avoid introducing app→app imports.
3. If Metadata Graph lands later, prefer `@paon/domain` concepts + database
   repositories — not a fourth app.
4. Quarantine orphan `prisma/` so tools don’t invent a second data graph.
