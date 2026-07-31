# Project State

**Factual snapshot only — not an authority, specification, queue, or resume
protocol.** Verify every claim against code, migrations, git, and deployment
runbooks. Current work and resume state live in `PHASE.md` and the Resume
Protocol in `PAON_INTELLIGENCE_PLATFORM.md`.

Snapshot: 2026-07-30 (save-game seal).

## Repository

- Branch: `main`; remote: `origin` (`baszakelijk2020-hash/paonpaon`).
- Schema source: forward Supabase migrations plus generated TypeScript
  database types.

## Implemented baseline relevant to the programme

- Stages 0–5 complete. Stage 6 blocked.
- Stage 7 and Stage 8.0–8.3 complete under ADR-066/067.
- Stage 8.4 is `verified_local` (completion harness + `runs/8.4.json`).
- Stage 9.1 is `verified_local` (migration write-through + `runs/9.1.json`).
- Stage 9.2 is `implemented_unverified` (takeover branch only — not on `main`):
  the Faden webhook half of the connector lifecycle is now real and
  browser-proven against a dedicated non-production Supabase project — real
  HMAC signature verification (`verifyFadenWebhookSignature`, constant-time,
  replay-windowed), connection pause/resume/disconnect with a
  retailer-facing UI, sync cursors, run history, dead letters and
  reconciliation-report schema, and a route handler
  (`apps/retailer/app/api/webhooks/faden/[connectionId]/route.ts`) that
  refuses to invent a canonical mapping for an unseen external order. A
  genuine e2e run (`integration-connection-lifecycle.spec.ts`) found and
  fixed a real defect along the way: the retailer's pause/resume action was
  silently failing because `integration_connections` never granted
  `authenticated` write access at all (fixed in
  `20260731000001_grant_connection_lifecycle_transitions.sql`, a
  column-scoped grant covering only the four lifecycle columns). Shopify's
  delta sync is now executable, not just a fixture object:
  `orchestrateShopifyDeltaSync` drives the current documented delta through
  9.1's real staged-file pipeline (dry-run → publish → canonical tables via
  `MigrationJobRepository.createJobFromRows`, factored out of
  `createFixtureJob` so both paths share one truth), checks
  `connectionAcceptsIngestNow` first, records a sync run and advances a
  cursor, and dead-letters on failure — triggerable from the retailer's own
  "Run Shopify sync" button. The delta content itself is documented fixture
  data, not a live Shopify Admin API call (live credentials would replace
  only the fetch step). Still missing before the whole item can be claimed:
  the reconciliation-report aggregate has no writer yet, and only the owner
  role has been exercised in a browser proof. Live provider proof is
  additionally blocked on credentials.
- Stage 9.3 is demand-led and blocked on prospect evidence.
- Stage 10.1 is `implemented_unverified` (takeover branch only — not on
  `main`): versioned library, pinned retailer copies, and the retailer
  mapping wizard (audience rules + target products) exist. Since: rehearsal
  (`rehearseCampaignActivation`) and activation into shared staff missions
  (`activateCampaignToStaffMissions`) are real, reusing `clienteling_opportunities`
  (PHASE 7.4) for missions via a new `campaign_id` column rather than a
  second staff-task table — outcome linking is inherited from that reuse.
  Customer placement already worked via the existing private-offers page
  once a campaign is active; no new write was needed there. Still missing:
  automated order-to-mission outcome linking, a correction path for
  post-activation mapping changes, and multi-role browser proof.
- Stage 10.2 is `implemented_unverified` (takeover branch only — not on
  `main`): the honeymoon order-to-delivery tracker is real — order-linked,
  idempotent, recomputed from live order status and variant inventory/lead
  time on every read, rendered on the customer's own order page. The
  owned-first seven-day domain logic (`composeSevenDayOwnedFirstPlan`) is
  real and tested but has no customer UI yet, since the existing
  `upsert_campaign_challenge_look` RPC still only accepts catalogue products
  — wiring it to owned wardrobe items is separate follow-up. The original
  `wip/stage-10-2-honeymoon` branch remains preserved and untouched at
  `ec58c8e00ec1d719c0cfbc2dbbc0d18730648cb5`; this work is a fresh port
  informed by reading it, not a merge of it.
- Stage 10.3 is `implemented_unverified` (takeover branch only — not on
  `main`): channel abstraction/threading already existed
  (`conversations`/`messages`, `MessagingRepository`, a real 3-pane retailer
  inbox, TableService guest channel) and was previously uncredited. Since:
  `MessagingRepository.linkOutcome` records a real appointment/order a
  conversation led to, mirroring `clienteling_opportunities`'s outcome
  fields. Missing: lookbook/proposal/quote attachments, confirmed note
  extraction, opt-out/failure suppression, multi-role browser proof.

## Stage 10.2 WIP salvage audit (2026-07-31)

Audited read-only at `ec58c8e`; the branch was neither merged nor modified.
Contents: migration `20260730340000_add_seven_day_and_honeymoon_packages.sql`,
pure domain `packages/domain/src/campaign/seven-day-honeymoon.ts` (+ tests),
`packages/database/src/repositories/honeymoon-programme-repository.ts` (+ unit
and security tests). The domain layer is pure with no `any`; the migration
carries `retailer_id` on both new tables, enables RLS, revokes from
`public`/`anon`, and hard-constrains `requires_payment_approval = false`.

The work is sound but **does not compile as-is**. It must not be merged until
repaired:

1. `packages/database/src/generated/database.types.ts` is unchanged, so
   `Database["public"]["Tables"]["honeymoon_programmes"]` and
   `…["honeymoon_programme_actions"]` do not exist and the repository fails
   typecheck. Regeneration needs `supabase gen types typescript --local`, which
   requires a running local Supabase (Docker) — `blocked_external` in any
   environment without it.
2. `packages/domain/src/index.ts` does not export `seven-day-honeymoon`, so
   `deriveHoneymoonActions` / `HoneymoonAction` / `HoneymoonLineTruth` are
   unreachable from `@paon/domain`.
3. `packages/database/src/index.ts` does not export
   `honeymoon-programme-repository`.
4. `CAMPAIGN_LIBRARY_KEYS` in `packages/domain/src/campaign/campaign-library.ts`
   still lists only `private_offer_member_fabric`, while the migration's CHECK
   constraint adds `seven_day_wardrobe` and `honeymoon_phase`.
5. `honeymoon_programme_actions` has no index on `(programme_id, retailer_id)`,
   so scoped action lookups sequential-scan.

Absent layers beyond the above: service/application layer, retailer UI,
customer UI, events/outbox, audit writes, and any browser proof. Stage 10.2
therefore remains **not started on `main`** and is not claimable at any
`verified_*` status. Its dependency Stage 10.1 is still
`implemented_unverified`, though the honeymoon tracker hangs off `orders` and
`customers` with a nullable `library_version_id`, so a repaired 10.2 could be
exercised without a pinned library version if its scope is limited to programme
tracking.

## Current handoff

Next queue item on `main`: **Stage 9.2**. Stage 6 and 9.3 remain blocked;
skip them. See Resume Protocol.
