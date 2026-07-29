# Deployment

**Tier 1 — read before deploying anything.** Written so any session can
take a PAON app live without asking the founder for values.

## What exists

| Thing            | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Git remote       | `github.com/baszakelijk2020-hash/paonpaon`, production branch `main`            |
| Vercel team      | `baszakelijk2020-hashs-projects` (`team_fDLh0iXJ8upTJTwbAktVdtGc`)              |
| Supabase org     | `nguyen` (`hvmmhiaggimktxucryek`)                                               |
| Supabase project | `PAON` — `https://hngxrczavwywsnfceppb.supabase.co`                             |
| Deployed         | `paonpaon-customer`, `paonpaon-admin`, `paonpaon-retailer` — **all three live** |

**Live and confirmed working 2026-07-28** (HTTP status checked directly against
each deployment, not inferred from "the deploy succeeded"):

| App      | URL                                                    | Verified                                        |
| -------- | ------------------------------------------------------ | ----------------------------------------------- |
| Customer | <https://paonpaon-customer.vercel.app/r/maison-dubois> | 200, founder's template, seeded production data |
| Admin    | <https://paonpaon-admin.vercel.app/login>              | 200 (root `/` correctly 307s to `/login`)       |
| Retailer | <https://paonpaon-retailer.vercel.app/login>           | 200 (root `/` correctly 307s to `/login`)       |

All three have `NEXT_PUBLIC_DEMO_LOGIN=1` set, so `/login` shows one-click
persona buttons (confirmed present in the rendered HTML on all three).
**Remove that variable on every project before any real retailer data
exists** — it signs anyone straight in.

## How production actually updates (2026-07-29)

**Canonical path:** GitHub Actions `CI` → job `Deploy production` after
`verify` is green on `main`. That job calls the Vercel Deployments API with
an explicit `gitSource` (`github` + repo id + `ref: main`) for each
`paonpaon-*` project, then blocks until the deployment reaches `READY` and
verifies the deployment URL returns a healthy HTTP status. Secrets:
`VERCEL_TOKEN`, `VERCEL_TEAM_ID`.

**Why not rely on dashboard “deploy on push” or Deploy Hooks alone:**

| Mechanism                                    | Observed behaviour (Hobby, 2026-07-29)                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git push → Vercel                            | Intermittent. Customer/admin often show `link.sourceless: true`. Recent `main` commits sometimes never create a deployment. GitHub repo webhooks list can be empty even while the project “looks” linked.                   |
| Deploy Hooks (`/v1/integrations/deploy/...`) | Accept the request (`job.state: PENDING`) and **never create a deployment** — same class of failure reported widely on Hobby. Hooks still exist on all three projects (`main-production`); treat them as non-authoritative. |
| CLI `vercel --prod` from repo root           | Works when the daily quota allows. Burns the same Hobby pool (`api-deployments-free-per-day`, ~100).                                                                                                                        |
| Deployments API + `gitSource`                | Creates a real deployment when quota remains. This is what CI uses.                                                                                                                                                         |

**Hobby deploy cap.** When the account hits `api-deployments-free-per-day`,
API/CLI/hooks all refuse new production deploys until reset (~24h). CI
treats that specific error as a **warning**, not a red `main` — verify
already passed. Do not spam CLI deploys to “catch up”; wait for reset, then
one push (or one API call per app) is enough.

**Manual emergency deploy** (quota permitting), from the **repository
root** after linking the intended project:

```
vercel link --yes --scope baszakelijk2020-hashs-projects --project paonpaon-<customer|retailer|admin>
vercel --prod --yes --scope baszakelijk2020-hashs-projects
rm -rf .vercel   # leave the root clean so the next session cannot miss-target
```

Never deploy from `apps/<app>` (double-applies `rootDirectory`). Never
deploy to the stale `paon-*` (single `paon`) projects.

### Stale duplicate projects — leave alone

`paon-admin`, `paon-retailer`, `paon-customer` (single `paon-`, no double)
also exist in this Vercel team, are still responding, and are **not** the
projects above. They predate the `paonpaon-*` naming and nothing has been
done to retire them. Founder decision 2026-07-28: leave them alone — do not
deploy to them, do not delete them, don't assume they're dead.

**Footgun this caused once already:** the repo-root `.vercel/project.json`
had been silently pointing at the old `paon-retailer` project. Running
`vercel --prod` from the repo root (the correct way to deploy — see below)
deploys to whatever project that file currently names, not necessarily the
one you mean to touch, and this bit a session on 2026-07-28 (an unwanted
rebuild of the stale project — no data loss, but not what was intended).
The repo root's `.vercel` directory has been deleted so a bare `vercel
--prod` at the root now fails closed instead of silently targeting the
wrong project. Before any root-level deploy: `vercel link --yes --scope
baszakelijk2020-hashs-projects --project <paonpaon-admin|paonpaon-retailer|paonpaon-customer>`
first, confirm with `cat .vercel/project.json`, then deploy.

## Deploying an app that is not yet live

This is the procedure actually used to bring `paonpaon-admin` and
`paonpaon-retailer` live on 2026-07-28 — CLI/API end to end, no dashboard
clicks required, keys never printed to the terminal.

1. **Create the project.**
   `vercel project add <name> --scope baszakelijk2020-hashs-projects`
2. **Set the root directory and framework** (the dashboard "Import" flow
   does this for you; creating via CLI does not):
   ```
   curl -X PATCH "https://api.vercel.com/v9/projects/<projectId>?teamId=team_fDLh0iXJ8upTJTwbAktVdtGc" \
     -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
     -d '{"rootDirectory":"apps/<name>","framework":"nextjs"}'
   ```
3. **Connect the Git repo** (enables deploy-on-push):
   ```
   curl -X POST "https://api.vercel.com/v9/projects/<projectId>/link?teamId=team_fDLh0iXJ8upTJTwbAktVdtGc" \
     -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
     -d '{"type":"github","repo":"baszakelijk2020-hash/paonpaon"}'
   ```
   `$VERCEL_TOKEN` comes from the repo-root `.env.local`, exactly like
   `$SUPABASE_ACCESS_TOKEN` — sourced into the shell, never typed or echoed.
4. **Set env vars via the Vercel CLI**, piping values in so nothing prints:
   ```
   printf '%s' "$VALUE" | vercel env add <NAME> production --scope baszakelijk2020-hashs-projects
   ```
   Needed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (fetch both keys the same way
   `scripts/seed-production.sh` does — `supabase projects api-keys
--project-ref hngxrczavwywsnfceppb --output json` — never hand-copied),
   the app's own `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_ADMIN_APP_URL` /
   `NEXT_PUBLIC_RETAILER_APP_URL` as applicable, and `NEXT_PUBLIC_DEMO_LOGIN=1`
   for a prospect-facing demo.
5. **Link the local directory** so future CLI deploys target the right
   project: `vercel link --yes --scope baszakelijk2020-hashs-projects
--project <name>` run from inside `apps/<name>` (this only rewrites the
   gitignored `.vercel/project.json`, nothing shared).
6. **Deploy from the repo root**, not from inside the app directory —
   `vercel --prod --yes --scope baszakelijk2020-hashs-projects` run from
   inside the app subdirectory double-applies the root directory setting
   and fails with a "path does not exist" error. The Root Directory setting
   from step 2 selects the right app from the full monorepo upload, which
   is also what makes shared packages (`@paon/ui`, `@paon/domain`, ...)
   resolve.
7. **Verify with an actual request** — `curl -s -o /dev/null -w
"%{http_code}"` against the deployed URL. A successful build is not
   evidence the app works; `paonpaon-admin` built clean and still 500'd on
   every request (`MIDDLEWARE_INVOCATION_FAILED`) until its env vars were
   complete, because middleware reads `env.supabaseAnonKey` before any
   public-path check runs.

## Variable names: why there are two spellings

All three apps' `lib/env.ts` accept both the names this codebase was
written against and the names the Vercel↔Supabase integration injects
(`firstEnv(...)`). That is deliberate — without it, an integration-configured
deploy boots and immediately throws.

`appUrl` falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` and
ignores any `localhost` value, because importing a developer's `.env.local`
otherwise leaves production generating links that point at a laptop.

## Cron jobs (Vercel Hobby — hard cap)

`paonpaon-admin` is on **Vercel Hobby**. That plan allows **at most two
cron jobs**, and **daily frequency only** — hourly (`0 * * * *`) is
rejected at deploy with "Hobby accounts are limited to daily cron jobs".
`docs/ROADMAP.md` already notes this; it is why
`/api/cron/dispatch-newsletter` was never scheduled.

The only entries in [`apps/admin/vercel.json`](../apps/admin/vercel.json)
must stay:

| Path                        | Schedule    | Job                                     |
| --------------------------- | ----------- | --------------------------------------- |
| `/api/cron/dispatch-emails` | `0 6 * * *` | Email outbox + Demo Studio expiry sweep |
| `/api/cron/dispatch-sms`    | `0 7 * * *` | SMS outbox                              |

Do **not** add a third cron. Fold new daily work into one of these two
handlers (as Demo Studio teardown does via `dispatch-emails`), keep a
manual-only route if needed, use an external ping, or upgrade the plan.
A deploy that adds a third entry or an hourly schedule will fail before
the build finishes.

## What a session may and may not do

**May, standing approval granted 2026-07-28, scoped to the `paonpaon-*`
projects:** create a `paonpaon-*` project, set its root directory, connect
the Git repo, fetch Supabase keys via the Supabase CLI and write them into
Vercel env vars via the Vercel CLI (never printed to stdout, never typed
into a web form), trigger redeploys, read build and runtime logs, relink
local `.vercel/project.json` files. This supersedes the older "may not type
service-role keys" line below for these three specific projects — ask
before assuming it extends to infrastructure beyond them.

**May not, without asking first:** grant OAuth/SSO consent (the founder's
to click), delete or redeploy the stale `paon-*` projects, or touch anything
outside the three in-scope workstreams per `PHASE.md`.

## Seeding the production database

`scripts/seed-production.sh` does it end to end. It fetches the project's API
keys via the Supabase CLI using the `SUPABASE_ACCESS_TOKEN` in the repo-root
`.env.local`, so no key is ever typed, pasted or echoed:

```
./scripts/seed-production.sh
```

Idempotent — safe to re-run. Takes a few minutes and prints nothing until it
finishes, then lists every demo login. All use password `Demo-PAON-2026!`.

An empty production database presents as a page that renders the shell and
says **"Not found"** — distinct from a white screen, which is a runtime
throw. Not-found means the app reached Supabase successfully and the row
simply is not there.

## Still owed by the founder

- `STRIPE_SECRET_KEY` / `RESEND_API_KEY` — blocked on the new business
  entity, see `PHASE.md`. (`SUPABASE_SERVICE_ROLE_KEY` is now set on all
  three `paonpaon-*` projects, as of 2026-07-28.)

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
