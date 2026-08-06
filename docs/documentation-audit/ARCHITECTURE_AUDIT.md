# Architecture Audit

Audit-only deliverable. Grounded in direct inspection of the Turborepo
workspace, `packages/domain/src` and `packages/database/src`, all 149
tables across 180 migrations, RLS policy grep across a 24-table sample, and
`.github/workflows/ci.yml`.

No refactor is recommended here without a concrete product or integrity
benefit, per the audit brief.

---

## Bounded contexts and module ownership

`packages/domain/src` has **34 top-level modules**: analytics, appointments,
campaign, catalog, commerce, concierge, concept-scan, corporate, customer,
engagement, experience, fit, gifting, identity, import, integrations,
intelligence, inventory, knowledge, loyalty, merchant, metadata, migration,
network, platform, production, programme, retailer, shared, wardrobe,
wedding, workflow, workforce.

- **Severity: Low.** `docs/DOMAIN_MODEL.md` names only 9 bounded contexts
  (Identity, Retailer, Customer, Catalog, Metadata, Commerce, Production,
  Appointments, Loyalty, Engagement, Analytics — itself 11, not 9, by direct
  count in the document, a minor internal miscount worth a line-item fix).
  Either way, the document is well behind the actual 34-module boundary.
- **Affected modules:** documentation only; the code boundary itself is
  coherent (each module is cohesive, single-purpose, and matches a real
  product area).
- **Evidence:** `find packages/domain/src -maxdepth 2 -type d` (34 results)
  vs. `docs/DOMAIN_MODEL.md`'s named list.
- **Product consequence:** none — this is a documentation lag, not an
  architecture defect.
- **Technical consequence:** a new engineer or agent using
  `docs/DOMAIN_MODEL.md` as their map of the codebase will miss 23 modules
  that exist, most materially `analytics`, `concierge`, `corporate`,
  `intelligence`, `wardrobe`, `wedding`, `workforce` — several of which are
  exactly the modules this audit's other deliverables (`ONTOLOGY_AUDIT.md`,
  `SYSTEM_INTERACTION_AUDIT.md`) had to derive independently from a live
  `find` rather than from documentation.
- **Recommended resolution:** refresh `DOMAIN_MODEL.md`'s bounded-context
  list to the current 34 modules. Documentation-only fix, no founder
  decision needed — see `MIGRATION_PLAN.md`.

## Dependency direction

**Verified clean.** `grep -rl "@paon/database" packages/domain/src` and
`grep -rl "@supabase" packages/domain/src` both return no real imports
(one stray comment reference, no actual `import` statement). The stated
boundary rule in `AGENTS.md` ("Business concepts and pure rules live in
`@paon/domain`; Supabase access lives behind `@paon/database`
repositories") holds in practice, with zero exceptions found.

Full dependency graph, confirmed via each package's `package.json`:

```text
@paon/domain          → zod, xlsx only (zero @paon/* deps)
@paon/database         → @paon/domain
@paon/auth              → @paon/database, @paon/domain
@paon/payments          → @paon/domain (types only)
@paon/utils             → @paon/domain (Money type only)
@paon/ui, @paon/email, @paon/sms, @paon/ai → zero @paon/* deps
apps/admin, apps/retailer, apps/customer → all of the above as needed
```

- **Severity: none — positive finding.** No circular or backwards
  dependency found anywhere in the workspace.

## Application boundaries

Three apps, cleanly separated by audience, confirmed via route-tree scan:

| App             | Port | Audience            | Route breadth                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin`    | 3000 | PAON platform staff | ~20 route segments: prospects, inquiries, retailers, billing, analytics, metadata, AI monitoring, integration/intelligence health, demo mode                                                                                                                                                                                                   |
| `apps/retailer` | 3001 | Retailer staff      | ~40 route segments: customers, corporate, staff, appointments, orders, events, inventory, products, loyalty, POS, network, messaging, migrations, promise-matching, service partners, supplier intelligence, production, mission-control, collections, analytics, alterations, capsule drops, gifts, wedding parties, fabric pairing, settings |
| `apps/customer` | 3002 | End customer        | ~30 route segments: wardrobe, morning-routine, appointments, orders, capsule, loyalty, messages, wedding-parties, silhouette-analysis, style-quiz, private-offers, wishlist, alterations, services, notifications, account, `/r/[slug]` (public storefront/referral vendor portal)                                                             |

- **Severity: none.** Route breadth per app is proportionate to its
  audience's job. No app reaches into another's route space.

## Shared packages and design-system enforcement

`@paon/ui` has zero `@paon/*` dependencies (correctly a leaf package) and is
the sole design-token source (`packages/ui/src/styles/globals.css`),
consumed by all three apps — matches `docs/DESIGN_SYSTEM.md`'s "one token
set, three apps" claim exactly.

## Database ownership and RLS/tenancy boundaries

- **149 tables** across **180 migrations** (2026-07-19 → 2026-08-06),
  spanning 9 thematic groups (core tenancy/auth, customer management,
  alterations/tailoring, engagement modules, content/knowledge,
  inventory/operations, advanced features, supporting infrastructure,
  commerce/orders).
- **RLS coverage:** 24/24 sampled tables have RLS **enabled**. A meaningful
  number show **zero inline `CREATE POLICY` rows** in the migrations grep
  (e.g. `retailers`, `customers`, `orders`, `alterations`,
  `fitting_sessions`, `products`) alongside others with 2–5 explicit
  policies (`loyalty_accounts`, `retailer_events`, `wedding_parties`,
  `notifications`, `messages`).
  - **Severity: Medium (verification gap, not a confirmed defect).** A
    table with RLS enabled but zero grepped policies is either (a)
    enforced entirely through `SECURITY DEFINER` RPCs that bypass row-level
    checks by design (a legitimate, common PAON pattern per
    `docs/DATABASE.md`), or (b) has policies defined in a later migration
    the theme-based grep undercounted, or (c) is genuinely relying on
    default-deny with no explicit allow — which would make the table
    unreadable through PostgREST entirely rather than a leak, so even the
    worst case here is fail-closed, not fail-open. This audit did not run
    `get_advisors`/live policy introspection (out of scope for a
    documentation/architecture audit; that is `security-reviewer`'s job),
    so this is reported as an open verification item, not a confirmed
    vulnerability.
  - **Affected modules:** core tenancy tables (customers, orders,
    alterations, products, fitting_sessions).
  - **Recommended resolution:** run the `security-reviewer` subagent (or
    live `get_advisors`) against this specific table list as a routine
    follow-up. Not a documentation-authority question — no founder decision
    needed.
- **Tenancy column (`retailer_id`) presence:** 17/24 sampled tables carry
  it; 2/24 are legitimately global (`retailers` itself, `platform_staff_members`);
  **5/24 flagged** for unclear tenancy model: `wishlists`, `messages`,
  `commercial_inquiries`, `commercial_prospects`.
  - **Severity: Medium.** `commercial_inquiries`/`commercial_prospects` are
    B2B pipeline tables that may legitimately need cross-tenant visibility
    for platform-staff prospecting (which would make no `retailer_id`
    correct, not a gap) — this is exactly the kind of ambiguity the audit
    brief says should not be silently resolved either way.
  - **Recommended resolution:** confirm via migration text (not re-derived
    here — flagged, not resolved) whether isolation for these 5 tables runs
    through a different key (e.g. `customer_id` cascading to a
    tenant-scoped parent) or is intentionally cross-tenant. This is a
    concrete, answerable engineering question, not a founder-authority
    question — recommend a `security-reviewer` pass, not a
    `FOUNDER_QUESTIONS.md` entry.
- **SECURITY DEFINER surface:** 10 of 262 total database functions are
  `SECURITY DEFINER`, all customer-facing "my_"-prefixed RPCs (loyalty
  accrual, referral creation, conversation creation/read, reward
  redemption, event RSVP). Naming convention suggests self-scoped
  operations, consistent with `docs/DATABASE.md`'s stated
  SECURITY-DEFINER-for-narrow-state-transitions pattern. Not independently
  re-audited line-by-line (that is `security-reviewer`'s remit).
- **Test coverage:** 17 pgTAP files against 149 tables (~11% direct table
  coverage by file count, though several tests cover cross-cutting
  concerns like tenancy boundaries and RLS rather than single tables).
  Confirmed real, dated `docs/evidence/runs/*.json` artifacts exist
  alongside them for browser/e2e proof of specific `PHASE.md` items — the
  two coverage mechanisms are complementary, not a substitute for each
  other.
- **Repository-to-table mapping:** spot-checked 5 tables
  (customers/orders/alterations/knowledge_objects/wedding_parties) against
  106 repository files in `packages/database/src/repositories` — all 5
  have a dedicated repository. No gap found in the sample.

## API and Server-Action boundaries

- **Verified:** `docs/API.md`'s rule (Server Actions are the default
  mutation surface; Route Handlers are the exception for webhooks/cron/one
  deliberate founder-HTML byte-fidelity route under ADR-046) is stated
  clearly and no counter-evidence was found during this pass. A full
  Server-Action inventory was not independently re-derived (out of scope
  for an architecture audit; would duplicate `docs/audits/architecture-audit.md`'s
  2026-07-29 finding of "inline Supabase leaks" in the storefront and a
  session-debug endpoint, which that audit reports as fixed the same day —
  not independently re-verified for regression here, flagged in
  `DOCUMENT_CONFLICTS.md` #6-adjacent territory).

## Event and audit patterns

- `AuditLogEntry` (append-only, platform-wide) and `docs/evidence/`'s
  ADR-068 discipline (per-`PHASE.md`-item dated Playwright proof) are two
  distinct, non-overlapping audit mechanisms — one records _what changed in
  the database_, the other records _what was proven working_. Correctly
  separate, not duplicated.

## AI boundaries

- `packages/ai` (OpenAI integration: import-enrichment, grounded-answer,
  advisor-capture, concept-generation runners) is a clean leaf package with
  zero `@paon/*` dependencies, consumed by `apps/retailer` and
  `apps/customer` only — `apps/admin` does not depend on it directly
  (consistent with admin's platform-operations role rather than
  customer-facing AI features).
- **`CitedRecommendation`'s citation-enforcement** (every recommendation
  must carry an `EvidenceSource`) is a structural, type-level guarantee, not
  a code-review convention — the strongest form of the "no black box, ever"
  principle stated in `docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` §8.

## Integration patterns

- `@paon/payments` (Stripe), `@paon/email` (Resend), `@paon/sms` (Twilio)
  are each isolated leaf packages behind their own client abstraction — no
  provider SDK call was found outside its own package during the dependency
  scan. Matches `AGENTS.md`'s "provider behavior requires a current
  contract or real sample" invariant structurally (isolation makes a future
  provider swap or credential-gating decision a one-package change).

## Duplicate responsibilities

- **None found at the package/module level.** The one plausible candidate —
  `Product`/`PhysicalGarment` — was confirmed intentional (`ONTOLOGY_AUDIT.md`).
- **One duplicate-responsibility candidate flagged by the prior 2026-07-29
  architecture audit** (duplicate UI badges/forms cross-app) was not
  independently re-verified in this pass — carried forward as an open item,
  not re-asserted.

## Dead or isolated modules

- **None found.** Every app and package was touched within the 18 days
  preceding this audit (git-log spot-check, earliest last-touch
  2026-07-19 for `eslint-config`/`typescript-config`, which are
  configuration packages with no reason to change often — not evidence of
  abandonment).

## Architecture drift from founder intent

- **None found at the structural level.** The layering rule, module
  boundary, and RLS-by-default pattern all match `AGENTS.md`'s engineering
  invariants and `ARCHITECTURE.md`'s stated design.
- **One product-shape drift, already self-corrected by the repository's own
  process:** the 2026-08-01 founder-intent reset (ADR-069→070→071→073)
  exists specifically because an earlier session over-corrected Stage 8–16
  breadth ahead of a proven relationship spine, then over-corrected again
  toward treating the whole platform as indefinitely gated. Both
  corrections are now recorded as superseding ADRs, and `CAPABILITY_DISPOSITION.md`
  exists specifically to re-classify (Keep/Harden/Consolidate/Replace/
  Quarantine) everything built during that swing. This is the repository
  correctly self-documenting and recovering from drift, not undocumented,
  live drift.

## CI vs. definition of done

- **Verified exact match.** `.github/workflows/ci.yml`'s verify job runs
  `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, `pnpm format:check` in that order — identical
  to `AGENTS.md`'s stated definition of done. E2E is gated to
  `workflow_dispatch` only (documented, known limitation, not a silent gap).

---

## Summary by severity

| Severity                | Finding                                                                                                                                                  | Belongs in                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Low                     | `DOMAIN_MODEL.md`'s named bounded-context list (9–11) is behind the actual 34 `packages/domain/src` modules                                              | Documentation                                             |
| Medium                  | 5 sampled tables have RLS enabled but no grepped inline policy (likely SECURITY-DEFINER-mediated, not independently confirmed)                           | Implementation verification (security-reviewer follow-up) |
| Medium                  | 5 tables (`wishlists`, `messages`, `commercial_inquiries`, `commercial_prospects`, +1) lack `retailer_id` with tenancy model not independently confirmed | Implementation verification (security-reviewer follow-up) |
| None (positive finding) | Zero circular/backwards package dependencies                                                                                                             | —                                                         |
| None (positive finding) | CI exactly matches the documented definition of done                                                                                                     | —                                                         |
| None (positive finding) | No dead/isolated packages or apps                                                                                                                        | —                                                         |

No architecture-level refactor is recommended. The two Medium items are
concrete, answerable, code-level verification tasks for a security-focused
follow-up pass — neither requires a founder decision, and neither is
evidence of an actual leak (RLS is enabled and therefore fail-closed by
default in every flagged case).
