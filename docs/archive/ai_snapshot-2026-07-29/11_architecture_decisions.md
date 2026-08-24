# 11 — Architecture decisions (ADR summary)

**Snapshot date: 2026-07-29.** Source: [DECISIONS.md](../DECISIONS.md) (ADR-001–056).  
**Code reflection** is a best-effort check against the tree; where uncertain,
marked **Unknown**.

| ADR | Summary                                              | Reflected in code?      | Notes                                             |
| --- | ---------------------------------------------------- | ----------------------- | ------------------------------------------------- |
| 001 | pnpm + Turborepo monorepo                            | Yes                     |                                                   |
| 002 | Next.js App Router, RSC default                      | Yes                     |                                                   |
| 003 | Supabase + RLS tenancy                               | Yes                     |                                                   |
| 004 | Branded ID types                                     | Yes                     | `@paon/domain`                                    |
| 005 | Tailwind v4 `@theme` tokens                          | Yes                     | `@paon/ui`                                        |
| 006 | Vitest + Playwright                                  | Yes                     |                                                   |
| 007 | Repository-only data access                          | Yes (convention)        | Spot-check; violations unknown without full audit |
| 008 | zod in domain                                        | Yes                     |                                                   |
| 009 | Invite provisions auth user first                    | Yes (pattern)           |                                                   |
| 010 | `PaonSupabaseClient` alias                           | Yes                     |                                                   |
| 011 | `stripUndefined` at actions                          | Yes                     | `@paon/utils`                                     |
| 012 | Invite accept via security definer RPC               | Yes                     |                                                   |
| 013 | Customer identity via auth.uid + link RPC            | Yes                     |                                                   |
| 014 | Path-based storefront; orders before payment         | Yes                     | `/r/[slug]`                                       |
| 015 | Phase 3 appointments + fit + alterations foundations | Partial                 | Fit profile later superseded                      |
| 016 | Garment-first alterations; no factory MTM ownership  | Yes                     | Legacy fit tables renamed                         |
| 017 | Loyalty append-only ledger                           | Yes                     |                                                   |
| 018 | Event RSVP eligibility in transaction                | Assumed Yes             | Verify RPC if changing                            |
| 019 | Clienteling notes private                            | Yes                     |                                                   |
| 020 | One conversation per relationship                    | Yes                     |                                                   |
| 021 | Analytics from sources + behavioral events           | Yes                     |                                                   |
| 022 | Platform invites need acceptance                     | Yes                     |                                                   |
| 023 | Collections/products atomic merchandising            | Yes                     |                                                   |
| 024 | Cart = draft Order                                   | Yes                     |                                                   |
| 025 | Referral conversion triggers                         | Yes (pattern)           |                                                   |
| 026 | Wishlist RPC + staff read                            | Yes                     |                                                   |
| 027 | Collections public-read like products                | Yes                     |                                                   |
| 028 | CustomerPreferences direct RLS                       | Yes                     |                                                   |
| 029 | Public product image bucket                          | Yes                     |                                                   |
| 030 | Stripe Connect Express                               | Code Yes / Live Unknown | ADR-051 never-executed class                      |
| 031 | Stripe Billing platform                              | Code Yes / Live Unknown | Same                                              |
| 032 | Resend + email outbox                                | Code Yes / Live Unknown | Same                                              |
| 033 | OpenAI behind AIProvider                             | Code Yes / Live Unknown | Same                                              |
| 034 | Nebel & Spiegel mapping                              | Process                 | Partially overridden by 035                       |
| 035 | Wedding Party + Today’s Pick override                | Yes                     | Features exist                                    |
| 036 | Second wave (SMS, roster, newsletter, …)             | Partial                 | Code present; Twilio live Unknown                 |
| 037 | UX audit + Tailwind `@source` fix                    | Yes                     |                                                   |
| 038 | Alteration readiness notification                    | Yes (claimed)           | Verify if changing                                |
| 039 | Alteration attribution DB-derived                    | Yes (claimed)           |                                                   |
| 040 | Commercial entitlements normalized                   | Yes                     | Tables exist                                      |
| 041 | Commercial inquiry without tenant                    | Yes                     |                                                   |
| 042 | Brand theme versioned tokens                         | Yes                     |                                                   |
| 043 | Demo Studio config versioned first                   | Yes                     | Synthetic env generation may still be thin        |
| 044 | Production incident recovery patterns                | Process                 | Historical                                        |
| 045 | RLS recursion fix                                    | Yes (migrations)        |                                                   |
| 046 | paon.html via Route Handler exception                | Yes                     |                                                   |
| 047 | Template layout fix + `/login` lander                | Yes                     |                                                   |
| 048 | Full template re-sync + TableService widget          | Yes                     |                                                   |
| 049 | `swatch_image_url`                                   | Yes                     | Column present                                    |
| 050 | PriceAdjustment / PromotionRule / stored value       | **Not found**           | No matching TS/SQL symbols on snapshot            |
| 051 | Build audit; breadth liability; PHASE supremacy      | Process                 | Still governing                                   |
| 052 | Founder surfaces ported verbatim                     | Yes                     | Rule active                                       |
| 053 | Customer writes need actor + tenant proof            | Yes (pattern)           |                                                   |
| 054 | Continuous agent mode                                | Process                 | WORKING_AGREEMENT                                 |
| 055 | Party height/weight on WeddingPartyMember            | Yes                     |                                                   |
| 056 | Vision docs = destination; PHASE authorizes          | Docs Yes                | No vision code                                    |

## ADRs that appear outdated or incomplete vs code

| ADR                                                 | Issue                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **050**                                             | Decision text describes pricing primitives; **no implementation symbols found** — either never landed or renamed without ADR follow-up |
| **015**                                             | Fit-profile portion superseded by **016** / **055**                                                                                    |
| **034**                                             | Explicitly overridden in part by **035**                                                                                               |
| Older PROJECT_STATE claims tied to **030–033, 036** | “Complete” without live credentials — outdated confidence language                                                                     |

ADR-051’s claim of “no GitHub remote / no CI” in older docs was itself corrected; CI and remote exist today.
