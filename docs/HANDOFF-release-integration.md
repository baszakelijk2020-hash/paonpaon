# Release Integration Handoff — 2026-08-23

## Where things stand

`origin/main` is at `af50abe` (pushed this session). It includes:

- `b8a2aa3`→`fa4087e` Security hardening / production integrity gates
- `ccf872e`→`95e7e0f` .vercelignore P0 deploy landmine fix, cron RLS-bypass defense-in-depth, demo-login gate string fix, `VERCEL_ENV` turbo cache key
- `1f834c4`→`a4554e2` customer cart-add/update silent-failure fix
- `5ac9061`→`c769ed1` retailer production actions: throw → form-state error handling
- `4221d6d`→`80e6fda` unused import lint fix
- `5e38338`→`daf037a` XSS: escape API error text before innerHTML banner render
- `7c5977e` fix(domain): revert an incorrect `discover` panel test expectation that had no matching source (blocked `pnpm test`)
- `75efea6` fix(fleet): stop-hook infinite-loop fix (`stop_hook_active` check)
- `16d778d` fix(evidence): re-stamp `docs/evidence/runs/17.9.json` gitSha (test genuinely re-run and passed)
- `af50abe` fix(mission-control): Mission Control appointment grid extended from 8–19 to 8–21 hours (evening appointments were silently invisible), plus de-flaked `mission-control.spec.ts` to use a fixed 14:00 booking time instead of relative "next hour"

**Excluded from this release (deliberately):** `2749a99` (admin retailer suspend/activate confirm dialogs) — depends on an undeclared prerequisite commit `fe7e527` (not on main, ~7,500 lines, unrelated observability system + DB migrations). Needs a scope decision before it can ship; do not cherry-pick `2749a99` alone, it produces a silent broken build (`status-form.tsx` expects a `useActionState`-shaped `setRetailerStatus` that main's `actions.ts` doesn't have).

## STILL UNRESOLVED — the actual launch blocker

**Sign-out is broken in all three apps (retailer/admin/customer).** Clicking "Sign out" registers in the DOM but zero POST request reaches the server — confirmed via dev-server access logs, every other server action on the same pages works fine. This is why CI's `verify` job has been failing since Aug 19 (blocks `deploy`), independent of anything in this session's fixes.

Documented in `docs/PHASE.md` — search for `REAL BUG FOUND, NOT FIXED`. Pre-existing since commit `d3bbc0db` (2026-07-24), when `packages/ui/src/components/AppShell.tsx` was refactored to route sign-out through a `signOutControl` ReactNode prop instead of rendering it directly.

**Two prior fix attempts already failed** (documented in PHASE.md, don't blindly repeat):

1. Left `<form action={signOut}>` as-is — untested theory, moved on.
2. Replaced with a `SignOutButton` client component using `onClick`+`useTransition` instead of a form — **still zero POST reached the server**, identical symptom. This rules out "form-through-a-prop" as the sole cause since a raw `onClick` handler failed the same way.

**A third attempt started this session and did NOT finish** (agent hit its session limit mid-fix). Its working theory, close to landing:

> `signOutControl` is the _same_ React element reference rendered in **two DOM locations** simultaneously — the always-present desktop `<aside>` (~line 135 of `AppShell.tsx`) and the conditionally-rendered mobile drawer (~line 270). The theory is this dual-mount of one element (especially a `<form>`) confuses Next's form-action wrapper or React's reconciliation, and the fix is to render **two separate form/button instances** (one per breakpoint) instead of one shared ReactNode.

**Uncommitted, unverified partial work exists** in a leftover worktree:

```
/Users/nguyen/Projects/PAON/.claude/worktrees/agent-abda9cf79f4d87272
```

touching `apps/retailer/app/(dashboard)/layout.tsx` and `packages/ui/src/components/AppShell.tsx`. **Do not assume this fix is correct or complete** — it was never verified live (no local Supabase/Docker available in that session either), and the agent only started on the retailer app before running out of budget. A fresh session should:

1. Read that worktree's diff to see what was attempted.
2. Independently verify the "duplicate ReactNode" theory before trusting it (e.g. temporarily render `signOutControl` in only ONE location and see if sign-out starts working — cheapest possible test).
3. If confirmed, apply the fix consistently across all three apps (`admin`, `customer`, `retailer` all share `AppShell`).
4. Actually verify live — needs Docker running for local Supabase (`supabase start`), which was not available in this sandbox. A fresh environment may have Docker.
5. Only then re-push to `main` and re-run CI — this is what's actually blocking the `deploy` job from ever running.

## Demo/persona credentials (dev/local only — see gating below)

Source: `packages/database/src/demo-seed.ts`. **These are gated by `isRealProduction` checks in each app's login page/action and must never work against a real production deployment** — the whole point of the Aug 22 incident-driven hardening this session did (`ccf872e`) was making sure of that. Safe to use only against a local dev/staging build.

- Shared demo password (all personas): `Demo-PAON-2026!`
- Admin platform admin: `contact@nebelspiegel.com`
- Retailer app, per retailer+role: `contact+<retailer-slug>-<role-label>@nebelspiegel.com`
  (role labels: `owner`, `manager`, `sales`, `operations`, `workshop`, `alteration-worker`)
- Customer app: seeded customer accounts per retailer, see `DEMO_PERSONA_LOGINS` in `demo-seed.ts` for exact emails — the list is generated at runtime from `RETAILERS`, so read the source rather than trusting a stale hardcoded copy here.

A local demo-login launcher page was requested but not yet built this session — see the follow-up task.

## Immediate next steps for a fresh session

1. Read this file, then `git log --oneline -15` and `git status` to reconfirm state hasn't drifted.
2. Fix and verify the sign-out bug (the actual blocker) — see above.
3. Re-push to `main`, watch CI (`gh run watch`), confirm `verify` → `deploy` → `production-gate` all go green.
4. Decide on `2749a99` (ship the observability dependency too, port just the state-object change, or drop the confirm-dialog feature this round).
5. Run the exhaustive Playwright E2E acceptance sweep across all three live apps per the founder's launch-readiness brief (nav, forms, modals, auth, purchase journey, mobile/desktop) — this was queued but not started before this session ended.
6. Verify actual live production URLs after deploy.
