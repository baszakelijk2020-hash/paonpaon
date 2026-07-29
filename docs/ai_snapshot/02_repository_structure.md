# 02 — Repository structure

**Snapshot date: 2026-07-29.**

## Top-level layout

```
paon/
├── apps/                 Deployable Next.js applications
├── packages/             Shared libraries
├── supabase/             Migrations, config, seeds (live schema)
├── docs/                 Constitution + vision + this snapshot
├── downloaded_pages/     Founder design HTML sources
├── scripts/              Ops shell scripts
├── prisma/               ORPHAN — unused schema.prisma (dead)
├── plans/                Local plan artifacts (not product docs)
├── .github/workflows/    CI
├── package.json          Workspace scripts
├── pnpm-workspace.yaml   apps/* + packages/*
├── turbo.json            Pipeline
├── CLAUDE.md / AGENTS.md Agent charters
├── README.md             Human entry
├── combined_schema.sql   Generated/combined SQL dump artifact
├── CURRENT_STATE.md      ORPHAN Made-to-Munro tracker (stale)
├── ROADMAP.md            ORPHAN Made-to-Munro plan (stale; use docs/ROADMAP.md)
└── AUDIT_LOG.md          Small orphan audit stub
```

## Purpose of each top-level folder

| Path                | Purpose                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `apps/admin`        | Platform Admin app (port 3000 in `pnpm dev`)                                             |
| `apps/retailer`     | Retailer Portal (3001)                                                                   |
| `apps/customer`     | Customer Portal + marketing + storefront (3002)                                          |
| `packages/*`        | Shared domain, data, auth, UI, integrations                                              |
| `supabase/`         | Authoritative schema migrations                                                          |
| `docs/`             | Engineering constitution; `docs/vision/` destination; `docs/ai_snapshot/` this inventory |
| `downloaded_pages/` | Canonical founder HTML (`pag1–3`, plans)                                                 |
| `scripts/`          | `bootstrap-platform-admin.sh`, `seed-production.sh`                                      |
| `prisma/`           | **Unused** leftover Prisma models (NextAuth-era names) — not in any package.json         |

## Important conventions

- Business logic needed by two apps → `packages/*`, never copy across apps
- Data access only via repositories in `@paon/database`
- Domain validation via zod next to entities in `@paon/domain`
- Branded IDs at multi-entity boundaries
- Server Actions for mutations; no inline Supabase in UI
- Founder surfaces: port verbatim ([DESIGN_PORTS.md](../DESIGN_PORTS.md))
- Docs: tiered reading ([docs/README.md](../README.md)); PHASE wins

## Generated code

| Artifact                                            | Source                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/database/src/generated/database.types.ts` | `supabase gen types` / `pnpm --filter @paon/database generate-types` |
| App `.next/`                                        | Next build (local; not committed)                                    |

## Shared / reusable packages

See [01_project_overview.md](./01_project_overview.md). Config packages:
`@paon/eslint-config`, `@paon/typescript-config`.

## Scripts and tooling

**Root scripts:** `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`,
`format`, `format:check`, `clean`.

**Tooling docs:** [TOOLING.md](../TOOLING.md) (CLIs, env, MCP).  
**Husky + lint-staged:** prettier on staged `*.{ts,tsx,js,jsx,json,md,mdx,css}`.  
**Pre-commit (observed):** prettier + `pnpm lint` + `pnpm typecheck` on commit.

**Dev ports (charter):** admin `:3000`, retailer `:3001`, customer `:3002`.
