# Claude Code Handoff

## Purpose

Claude Code is now the sole active engineering agent for PAON. Codex has stopped because its usage allowance is nearly exhausted. Do not run Claude and Codex concurrently on this repository.

Read the root `CLAUDE.md` and all source-of-truth documents it references before changing anything. Preserve every established ADR, architectural pattern, and product boundary.

## Current repository state

- Repository: `/Users/nguyen/Projects/PAON`
- Branch: `main`
- Latest clean commit: `6b00f8a Complete catalogue editing and merchandising`
- The worktree intentionally contains unfinished, uncommitted cart work. Do not discard, revert, or overwrite it.

Recent completed commits include:

- PAON Admin invite acceptance
- Platform analytics
- Behavioral analytics
- Messaging and in-app notifications
- Clienteling notes and customer timeline
- Catalogue editing and merchandising

## Active vertical slice

Finish the persisted multi-item customer cart and checkout slice already present in the worktree.

The unfinished work currently includes:

- Draft orders used as persisted carts
- `add_to_cart`, `update_cart_line`, and `checkout_cart` database functions
- Stock, price, product, currency, and retailer validation at checkout
- Shipping-address capture
- Customer storefront cart pages under `/r/[slug]/cart`
- Add-to-cart behavior replacing immediate buy-now behavior
- Magic-link redirect preservation
- Domain, repository, generated database type, and test changes
- Migration `20260720000009_create_persisted_cart_checkout.sql`

Audit the implementation carefully, complete anything missing, and keep existing PAON conventions.

## Required completion checks

Before committing this slice:

1. Format changed files.
2. Reset the local Supabase database and apply all migrations.
3. Regenerate database types if required.
4. Run Supabase database linting.
5. Run the full repository lint, typecheck, tests, build, and formatting check.
6. Run a final whitespace/diff check.
7. Update `PROJECT_STATE.md`, relevant product/domain documentation, and `DECISIONS.md` or an ADR when appropriate.
8. Commit only when everything is green, using a clear checkpoint message such as `Build persisted multi-item cart checkout`.

## Autonomous continuation

After the cart slice is verified and committed, determine the next highest-value unblocked vertical slice from the project constitution, roadmap, current state, and backlog. Continue implementing complete production-ready slices without waiting for routine approval.

Each completed slice must include all applicable domain, database, migration, RLS, repository, validation, permissions, UI, tests, documentation, verification, and a clean commit.

Do not redesign PAON. Do not build supplier replacements, GoCreate replacements, manufacturing ERP, or MTM manufacturing fit-profile ownership. Defer features requiring undecided payment providers, supplier connectors, external email/SMS/push providers, AI providers, or unavailable credentials unless an established local abstraction permits useful provider-independent progress.

Stop only for a genuine founder-level product decision, unavailable external credentials, a destructive/irreversible action, or a material contradiction in the source-of-truth documents. Do not ask routine implementation questions.
