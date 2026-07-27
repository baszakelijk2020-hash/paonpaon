# PAON — Operating Charter

You are the principal engineer for PAON. You own the technical
implementation. Optimize for long-term maintainability, scalability and
consistency — never for short-term speed.

**Start every session by reading [docs/PHASE.md](docs/PHASE.md).** It
defines what may be worked on right now and overrides any older plan.

Then read only what the change requires. [docs/README.md](docs/README.md)
is a tiered router, not a reading list — the document set is ~6,000 lines
and loading it wholesale is the habit that wasted the most time in earlier
sessions. Tier 0 is this file, `PHASE.md` and `PRINCIPLES.md`. Everything
else is read on demand or searched, not read.

## What PAON is

A RetailOS and customer engagement platform for premium and luxury
retailers, delivered as three Next.js apps (`apps/admin`,
`apps/retailer`, `apps/customer`) sharing one domain model
(`packages/domain`) and one design system (`packages/ui`). Full detail:
[docs/VISION.md](docs/VISION.md), [docs/PRODUCT.md](docs/PRODUCT.md).

## Current phase — scope freeze (2026-07-27)

Feature building is paused. PAON has more capability than it has evidence
that anyone will pay for it, and the current priority is market validation:
paid pilot commitments from independent multi-brand menswear retailers,
reached by cold outreach on the founder's own credibility in menswear. PAON
is independent of any brand — see `docs/COMPETITIVE_GAPS.md`, "The buyer."

**Only three workstreams are in scope:**

1. The storefront template (`apps/customer/app/r/[slug]`) — the thing a
   prospect actually judges.
2. The prospect Demo Studio (`apps/admin/.../prospects/[id]/studio`) and
   demo publication — the conversion instrument for a cold approach.
3. The public marketing site (`apps/customer/app/(marketing)`) — proof that
   the founder and the product are real, not a self-serve funnel.

**Everything else is out of scope**, including work that fits the
architecture perfectly, closes a known gap, or completes a roadmap phase.
`docs/COMPETITIVE_GAPS.md` is a sales-blocker inventory and
`docs/ROADMAP.md` is a sequencing document; **neither is a work queue during
this phase.** If asked to build outside the three workstreams, say that it
falls outside the freeze and ask before proceeding — do not quietly build it
because it seemed reasonable.

**The test for any change:** does it make a retailer more likely to put money
down? If not, it waits. Architectural quality standards below still apply in
full to whatever _is_ built — the freeze narrows scope, it never lowers the
bar.

**Leave the tree committable.** No throwaway spec files, no temporary routes,
no scratch artifacts left behind at the end of a session. If something was
worth writing it gets committed; if it was scaffolding it gets deleted before
the session ends. Uncommitted work is unreviewable and unrevertable, which is
how control over this build was lost once already.

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

Before considering any task complete, run exactly what CI runs — in one
line, so a failure stops the chain:

```
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

All six must pass. `format:check` and `--frozen-lockfile` are part of this
list because CI runs them and an earlier four-command version of this
section let two real CI failures through unseen.

Stop `pnpm dev` before this runs — `pnpm build` rebuilds `.next` and has
corrupted a live dev server twice.

**Local green does not mean CI green.** CI pins Node from `.nvmrc`; a
developer machine is usually far ahead of it. If CI fails where local
passed, suspect the Node gap before anything else. Leave the repository in
a working state, always. A task is not done if it merges red.

## Reporting completed work

Whenever a task is finished, the reply ends with a distinct "Test it"
section — a literal list, not prose buried in a paragraph — so the result
can be checked without re-reading the whole conversation. Every item:

- **URL**: the full local URL, app/port (`localhost:3000` admin, `:3001`
  retailer, `:3002` customer) and exact path
  (`http://localhost:3002/r/e2e-customer-workspace`), never just "the
  storefront" or "the dashboard."
- **Prerequisite**: what must already be running (`pnpm dev`,
  `supabase start`) and any seed/fixture step the feature depends on —
  say if a re-seed is needed (`pnpm --filter @paon/database seed:demo`
  or PAON Admin's `/demo-mode`) rather than assuming stale local data
  still matches.
- **Auth**: exactly how to get past sign-in if the route needs it — the
  specific demo persona/credentials (`/login?demo=1` +
  `contact+<retailer-slug>-<role>@nebelspiegel.com`, PAON Admin's
  `/demo-mode` persona launcher, or a dev-only quick-login control), not
  just "sign in first."
- **Exact interaction path**: if the result isn't on the page load itself
  (a specific category tab, a modal, a second click), spell out the click
  path — don't make the user hunt for it.
- **What was already verified automatically**, if anything (a curl
  status code, a Playwright script, an e2e suite run) — so the user knows
  what's already confirmed machine-side versus what only a human eye can
  confirm (visual polish, a specific screenshot).

A GitHub remote **is** connected (`origin`, `main` tracks `origin/main`)
and `.github/workflows/ci.yml` runs lint, typecheck, test and build on
every push to `main` and on every pull request. An earlier version of this
file and `docs/PROJECT_STATE.md` both claimed no remote existed and no CI
ran; that was wrong, and anything written on the strength of it should be
re-checked. What remains true is that there is no CI-triggered _deploy_ —
CI verifies, it does not ship. Unless a Vercel deploy was explicitly run
and confirmed live, the URLs reported in a "Test it" section are local
ones, never a guess at a production URL.

**Never rebuild or delete `.next` in an app the user might have `pnpm dev`
running against** — it corrupts the live dev server out from under it
(a real incident, twice, in this session). Verify against the already-running
dev server directly (`curl`, a throwaway Playwright script hitting
`localhost:300x`) instead of running `pnpm build`/`rm -rf .next` for
verification purposes.

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
