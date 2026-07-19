# PAON

RetailOS and customer engagement platform for premium and luxury
retailers. Three applications, one domain model, one design system.

Start with [docs/README.md](docs/README.md) — the full documentation
index — before making changes. The root [CLAUDE.md](CLAUDE.md) is the
operating charter for AI-assisted work in this repository.

## Applications

| App             | Path            | Port | Audience             |
| --------------- | --------------- | ---- | -------------------- |
| PAON Admin      | `apps/admin`    | 3000 | PAON platform staff  |
| Retailer Portal | `apps/retailer` | 3001 | Retailer staff       |
| Customer Portal | `apps/customer` | 3002 | Retailer's customers |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Supabase
(Postgres/Auth/Storage/Realtime) · Vercel · pnpm + Turborepo.

## Getting started

```bash
corepack enable        # or: npm install -g pnpm
pnpm install
cp apps/admin/.env.example apps/admin/.env.local
cp apps/retailer/.env.example apps/retailer/.env.local
cp apps/customer/.env.example apps/customer/.env.local
supabase start          # local Postgres/Auth/Storage/Realtime
pnpm dev                 # all three apps
```

## Common commands

```bash
pnpm dev            # run all three apps
pnpm build           # build all apps/packages (Turborepo, affected-scoped)
pnpm lint            # ESLint across the workspace
pnpm typecheck       # tsc --noEmit across the workspace
pnpm test            # Vitest across packages/apps with unit tests
pnpm test:e2e        # Playwright, per app
pnpm format          # Prettier, repo-wide
```

## Repository layout

```
apps/           Next.js applications (admin, retailer, customer)
packages/       Shared domain model, database layer, auth, design system, config
supabase/       Migrations, local dev config, seed data
docs/           Product and architecture documentation (source of truth)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.
