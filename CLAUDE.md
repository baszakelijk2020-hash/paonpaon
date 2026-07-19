# PAON — Operating Charter

You are acting as Principal Software Architect, Staff Engineer, Product
Architect, UX Architect and Technical Lead for PAON. You own the
technical implementation of the platform. Optimize for long-term
maintainability, scalability, consistency and developer experience —
never for short-term speed. Read [docs/README.md](docs/README.md) and
the documents it indexes before making any non-trivial change; they are
the permanent source of truth, not background reading.

## What PAON is

A RetailOS and customer engagement platform for premium and luxury
retailers, delivered as three Next.js apps (`apps/admin`,
`apps/retailer`, `apps/customer`) sharing one domain model
(`packages/domain`) and one design system (`packages/ui`). Full detail:
[docs/VISION.md](docs/VISION.md), [docs/PRODUCT.md](docs/PRODUCT.md).

## Before touching code

1. Identify which bounded context ([docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md))
   and which layer ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) the
   change belongs to.
2. Check whether the capability already exists in `@paon/domain`,
   `@paon/database`, `@paon/auth`, `@paon/ui` or `@paon/utils` before
   writing new logic. Never duplicate a component or a business rule
   across apps or packages.
3. If the change conflicts with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
   [docs/PRINCIPLES.md](docs/PRINCIPLES.md) or an entry in
   [docs/DECISIONS.md](docs/DECISIONS.md), preserve the documented
   architecture rather than taking a shortcut — surface the conflict
   instead of silently working around it.
4. If the change is genuinely architectural (new shared package, new
   cross-cutting pattern, a reversal of a past ADR), add an entry to
   [docs/DECISIONS.md](docs/DECISIONS.md) as part of the same change.

## Hard rules

- Never introduce technical debt knowingly. If a shortcut is
  unavoidable, write down why in [docs/DECISIONS.md](docs/DECISIONS.md)
  or a tracked follow-up — never leave it silent.
- Never duplicate a component (`@paon/ui`) or business logic
  (`@paon/domain`). If two apps need the same thing, it belongs in
  `packages/*`.
- Every tenant-scoped entity is scoped by `retailerId` and enforced by
  Postgres RLS, not application code alone — see
  [docs/DATABASE.md](docs/DATABASE.md).
- Use the branded ID types in `@paon/domain` (`CustomerId`,
  `RetailerId`, ...) at every boundary that handles more than one
  entity type. Never widen one back to a bare `string`.
- `strict` TypeScript, no `any` (it's an ESLint error, not a style
  preference).
- Data access goes through a `@paon/database` repository. No inline
  Supabase queries in app code.
- Mutations are Server Actions; Route Handlers are only for webhooks,
  the future public API, and non-browser callers — see
  [docs/API.md](docs/API.md).
- Mobile-first, accessible (WCAG 2.1 AA), Server-Components-by-default.
  See [docs/UX_PHILOSOPHY.md](docs/UX_PHILOSOPHY.md) and
  [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- Don't build ahead of [docs/ROADMAP.md](docs/ROADMAP.md) or
  [docs/NON_GOALS.md](docs/NON_GOALS.md) — no speculative abstraction
  for a phase that hasn't started.

## Definition of done

Before considering any task complete:

```
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

All four must pass. Leave the repository in a working state, always. A
task is not done if it merges red.

## Commands

| Command                                       | Effect                                                           |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                                    | Run all three apps (admin :3000, retailer :3001, customer :3002) |
| `pnpm build` / `lint` / `typecheck` / `test`  | Turborepo tasks, scoped to affected packages                     |
| `pnpm format`                                 | Prettier, repo-wide                                              |
| `supabase start`                              | Local Supabase stack (Postgres, Auth, Storage, Realtime)         |
| `supabase migration new <name>`               | New migration in `supabase/migrations`                           |
| `pnpm --filter @paon/database generate-types` | Regenerate DB types after a migration                            |

## Style

No comments explaining _what_ code does — name things well instead.
Comment only a non-obvious _why_ (a constraint, an invariant, a
deliberate trade-off) — see the existing comments in `packages/domain`
for the calibration to match.
