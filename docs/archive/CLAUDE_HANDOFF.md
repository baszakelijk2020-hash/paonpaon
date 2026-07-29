> **Obsolete / archived.** Not authoritative. See [README.md](./README.md). Live constitution: [../README.md](../README.md).

# Active Engineering Handoff

Updated from the actual repository state on 2026-07-20. This file supersedes every earlier chat handoff. The code, Git history, `CLAUDE.md`, `PROJECT_STATE.md`, `ROADMAP.md`, and ADRs remain the source of truth.

## Operating rule

Only one engineering agent may edit this repository at a time. Continue autonomously, complete and commit verified vertical slices, and do not stop for routine implementation decisions or progress summaries.

Repository: `/Users/nguyen/Projects/PAON`

Branch: `main`

## Latest completed commits

- `6a7d061` Build Resend transactional email via a durable outbox
- `7d91b1a` Build Stripe Billing retailer subscriptions
- `86cf5c7` Build Stripe Connect customer payments
- `622d0a9` Build direct product image upload
- `efe54dc` Build customer preferences persistence
- `197b30d` Build storefront collection browsing
- `9d60a9d` Build customer Wishlist
- `820bca7` Complete referral acquisition journey
- `0dc0da5` Build persisted multi-item cart checkout

The cart, Stripe Connect, Stripe Billing, and Resend slices are complete and committed. Do not rebuild them.

## Active unfinished slice: OpenAI personalisation

The worktree intentionally contains uncommitted AI-personalisation work. Do not discard, revert, or overwrite it.

Changed or new work currently includes:

- `packages/ai/`
- `packages/domain/src/analytics/ai-generation.ts`
- `packages/database/src/repositories/ai-generation-repository.ts`
- `packages/database/src/repositories/ai-generation-repository.test.ts`
- `supabase/migrations/20260720000018_create_ai_generations.sql`
- `apps/retailer/lib/ai.ts`
- `apps/retailer/app/(dashboard)/customers/[id]/ai-insights.tsx`
- Customer-detail actions and UI wiring
- Analytics repository additions
- Generated database types, package exports, dependencies, and lockfile changes

Founder decision: use OpenAI behind a provider-neutral interface. Personalisation must be privacy-conscious, transmit no unnecessary personal information, and never fake provider success when credentials are missing.

## Immediate objective

1. Inspect all current uncommitted changes and established repository patterns.
2. Finish the AI-personalisation vertical slice safely and coherently.
3. Ensure missing OpenAI credentials produce an explicit safe disabled/not-configured state, never fabricated insights.
4. Verify retailer isolation, RLS, authorization, privacy boundaries, auditability, and appropriate AI monitoring in PAON Admin where the existing product specification requires it.
5. Add or finish all applicable domain, repository, migration, UI, validation, error handling, tests, documentation, and ADR work.
6. Run the complete validation suite required by `CLAUDE.md`, including local Supabase reset/lint/type generation where applicable, formatting, lint, typecheck, tests, build, format check, and final diff/whitespace inspection.
7. Update `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md` or an ADR to match reality.
8. Commit only after everything passes, using a clear checkpoint such as `Build provider-neutral AI personalisation`.

## After that

Immediately determine and implement the next highest-value genuinely unblocked slice from the current repository state and roadmap. Do not revisit completed work.

Continue deferring:

- GoCreate and supplier/manufacturing connectors until a real integration exists
- Public API until a real integration partner exists
- SMS/push until providers and credentials exist
- Live Stripe, Resend, or OpenAI activation until credentials are provisioned
- Production deployment or live financial transactions without established authorization

If one item is credential-blocked, document it and continue with another independent unblocked item.

Stop only when a genuine founder-level commercial decision is required, every meaningful independent path is credential-blocked, a destructive/irreversible action is required, or source-of-truth documents materially contradict one another.
