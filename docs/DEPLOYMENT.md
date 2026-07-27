# Deployment

**Tier 1 — read before deploying anything.** Written so any session can
take a PAON app live without asking the founder for values.

## What exists

| Thing            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Git remote       | `github.com/baszakelijk2020-hash/paonpaon`, production branch `main` |
| Vercel team      | `baszakelijk2020-hashs-projects` (`team_fDLh0iXJ8upTJTwbAktVdtGc`)   |
| Supabase org     | `nguyen` (`hvmmhiaggimktxucryek`)                                    |
| Supabase project | `PAON` — `https://hngxrczavwywsnfceppb.supabase.co`                  |
| Deployed         | `paonpaon-customer` (root `apps/customer`)                           |
| Not deployed     | the Retailer Portal and PAON Admin                                   |

`PROJECT_STATE.md` claims three `paon-*.vercel.app` projects exist. They do
not; the Vercel API returned an empty project list on 2026-07-27. Trust this
file over that one.

## Deploying an app that is not yet live

Retailer and Admin still need this. Use the Vercel MCP (`list_projects`,
`get_project`, `list_deployments`, `get_runtime_errors`,
`get_deployment_build_logs`) for inspection, and Claude-in-Chrome for the
dashboard steps.

1. **Import the repo.** `vercel.com/new` → import `paonpaon` → set **Root
   Directory** to `apps/retailer` or `apps/admin` → name it
   `paonpaon-retailer` / `paonpaon-admin`. Framework auto-detects as
   Next.js. Connecting the repo also enables deploy-on-push.
2. **Link Supabase.** Supabase dashboard → org `nguyen` → Integrations →
   Vercel → **Add new project connection** → project `PAON` → the new Vercel
   project. This injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SECRET` and the
   `POSTGRES_*` set automatically. **Do not hand-copy keys.**
3. **Add the one variable the integration does not provide:**
   `NEXT_PUBLIC_SUPABASE_URL` = `https://hngxrczavwywsnfceppb.supabase.co`.
   It is a URL, not a secret, so a session may set it directly.
4. **Redeploy** and check.

## Variable names: why there are two spellings

`apps/customer/lib/env.ts` accepts both the names this codebase was written
against and the names the Vercel↔Supabase integration injects
(`firstEnv(...)`). That is deliberate — without it, an integration-configured
deploy boots and immediately throws. **Apply the same pattern to
`apps/retailer/lib/env.ts` and `apps/admin/lib/env.ts` before deploying
them**, or they will fail the same way.

`appUrl` falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` and
ignores any `localhost` value, because importing a developer's `.env.local`
otherwise leaves production generating links that point at a laptop.

## What a session may and may not do

**May:** create projects, set root directories, connect the Git repo, link
the Supabase integration, set non-secret values (URLs, app URLs, feature
flags), trigger redeploys, read build and runtime logs.

**May not:** type API keys, tokens, passwords or service-role keys into any
form, or grant OAuth/SSO consent. Those are the founder's to click. Use the
Supabase integration precisely so this almost never comes up.

## Still owed by the founder

- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) on each project.
  The integration does not inject it. Required by the Stripe webhook handler
  and `lib/supabase-admin.ts`.
- `STRIPE_SECRET_KEY` / `RESEND_API_KEY` — blocked on the new business
  entity, see `PHASE.md`.

## Debugging a white screen

A blank page with "a server-side exception has occurred" is a runtime throw,
not a build failure. Do not guess:

```
get_runtime_errors { projectId, teamId, since: "1h" }
get_runtime_logs   { projectId, teamId, level: ["error"], since: "1h" }
```

`ECONNREFUSED 127.0.0.1:54321` means the app is pointed at **local**
Supabase — someone imported a developer `.env.local`. That was the first
production failure this project ever had.
