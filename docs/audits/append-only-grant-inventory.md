# Append-Only Grant Inventory

**Task:** t6a-append-only-inventory  
**Date:** 2026-08-15  
**Branch:** worker/t6a-append-only-inventory  
**Base SHA:** 4fc309e49b9d412ee968fe68fcaf5e76b1c418e9  
**Phase ref:** GROUND_TRUTH.md 11d follow-up; commit 17a9a1d

> **Purpose:** Factual evidence for frontier decision on `service_role`
> UPDATE/DELETE/TRUNCATE grants. This document makes no recommendation.
> Facts only.

---

## Table inventory

### alteration_fulfillment_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None — no `.update(`/`.delete(` references in `packages/` or `apps/`
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260719000101_build_garment_first_alterations.sql` (line 425)

### alteration_pricing_history

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Immutable original quote and every proposed/decided price event."
- **(d) Creating migration:** `20260719000101_build_garment_first_alterations.sql`

### alteration_status_history

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260719000101_build_garment_first_alterations.sql`

### behavioral_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Immutable retailer-scoped interaction signals for analytics and future personalisation; never a replacement for source business records."
- **(d) Creating migration:** `20260720000005_create_behavioral_analytics.sql`

### campaign_delivery_audits

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only campaign delivery/suppression audit (PHASE 5.1)."
- **(d) Creating migration:** `20260730210000_add_campaign_private_offers.sql`

### campaign_library_entries

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "PAON campaign library catalogue (PHASE 10.1 / CMP-101)."
- **(d) Creating migration:** `20260730330000_add_versioned_campaign_library.sql`

### chain_of_custody_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260719000101_build_garment_first_alterations.sql` (line 400)

### customer_alteration_status_history

- **(a) UPDATE/DELETE RLS policies:** N/A — this is a VIEW, not a table
- **(b) Code mutations:** None
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** Created as view in `20260719000103_secure_alterations_and_workflows.sql` (line 1912); re-created as security-barrier view in `20260809200000_add_employee_portal_customer_data_access.sql` (line 130). Underlying base tables (alterations, alteration_status_history) have their own grants.

### customer_consent_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only purpose-specific consent history for personalization, marketing, and location."
- **(d) Creating migration:** `20260730130000_add_consent_and_interaction_events.sql`

### integration_raw_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Immutable raw provider payloads before mapping (PHASE 8.2 / INT-003)."
- **(d) Creating migration:** `20260730300000_add_source_authority_registry.sql`

### legacy_customer_fit_profile_entries

- **(a) UPDATE/DELETE RLS policies:** None — RLS policies were dropped during rename (migration `20260719000101_build_garment_first_alterations.sql` line 14–16)
- **(b) Code mutations:** None
- **(c) Table comment:** "Read-only archive from ADR-015. Not an active PAON domain model: fitting observations must identify a physical garment."
- **(d) Creating migration:** Originally created as `customer_fit_profile_entries` in `20260719000016_create_customer_fit_profile_entries.sql`; renamed to `legacy_customer_fit_profile_entries` in `20260719000101_build_garment_first_alterations.sql` (line 10)

### loyalty_ledger_entries

- **(a) UPDATE/DELETE RLS policies:** One **FOR ALL** policy exists: `"platform manages loyalty ledger"` using `is_platform_staff()`. This grants UPDATE/DELETE to platform staff via RLS. Additionally, `"retailer reads loyalty ledger"` and `"customer reads own loyalty ledger"` are SELECT-only.
- **(b) Code mutations:** None in `packages/` or `apps/`. However, the migration `20260720000001_create_loyalty_rewards_referrals.sql` contains functions that `INSERT` into this table (lines 146, 160).
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260720000001_create_loyalty_rewards_referrals.sql`

### morning_routine_delivery_audits

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only MorningRoutine delivery/suppression audit (PHASE 4.5)."
- **(d) Creating migration:** `20260730200000_add_morning_routine_delivery.sql`

### prospect_demo_engagement_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260724000011_create_isolated_demo_environments.sql`

### retailer_events

- **(a) UPDATE/DELETE RLS policies:** **FOR ALL** policies to platform staff (`"platform manages retailer events"`) and to retailer managers/admin/owner (`"retailer managers manage events"`). Both grant UPDATE/DELETE via RLS.
- **(b) Code mutations:** None found in `packages/` or `apps/` TypeScript code.
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260720000002_create_retailer_events.sql`

### retailer_module_configuration_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260801190000_create_platform_module_kernel.sql`

### service_entitlement_entries

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only non-monetary entitlement grant/consume audit with idempotency (PHASE 5.3)."
- **(d) Creating migration:** `20260730230000_add_concierge_service_plans.sql`

### service_fulfilment_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Collection/delivery/fulfilment commitments for concierge bookings (PHASE 5.3). No automatic routing."
- **(d) Creating migration:** `20260730230000_add_concierge_service_plans.sql`

### service_history_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT and INSERT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only concierge service history audit (PHASE 5.3)."
- **(d) Creating migration:** `20260730230000_add_concierge_service_plans.sql`

### staff_time_entries

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None in `packages/` or `apps/`. The explicit grant in `20260811180000_grant_service_role_staff_time_fixture_access.sql` (line 4: `grant select, insert, update, delete on public.staff_time_entries to service_role`) was added for fixture/seed access.
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260721000006_create_staff_roster.sql`

### stripe_webhook_events

- **(a) UPDATE/DELETE RLS policies:** None (only a SELECT policy exists)
- **(b) Code mutations:** None — the only writes happen in a trigger function within migration `20260720000015_create_stripe_connect_payments.sql` and are performed by the Stripe webhook Route Handler (service_role). No `packages/` or `apps/` TypeScript code references this table.
- **(c) Table comment:** _(none)_
- **(d) Creating migration:** `20260720000015_create_stripe_connect_payments.sql`

### wardrobe_lifecycle_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only wardrobe wear/rest/care/repair/guidance history (PHASE 4.3). Not official fitting observations."
- **(d) Creating migration:** `20260730180000_add_wardrobe_lifecycle_fit_freshness.sql`

### wardrobe_ownership_events

- **(a) UPDATE/DELETE RLS policies:** None (only SELECT policies exist)
- **(b) Code mutations:** None
- **(c) Table comment:** "Append-only wardrobe ownership/provenance history (ADR-063)."
- **(d) Creating migration:** `20260730160000_add_wardrobe_ownership.sql`

---

## Tables with REAL mutation paths (not safe to revoke service_role UPDATE/DELETE)

The following tables have **at least one real mutation path** — either an RLS **FOR ALL** policy or an explicit `grant update/delete` (or `grant all`) to `service_role`, and a legitimate operational need for mutation:

| Table                      | Path                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **loyalty_ledger_entries** | `grant select, insert, update, delete ... to authenticated, service_role` (migration line 174) + FOR ALL RLS policy for platform staff    |
| **retailer_events**        | FOR ALL RLS policies for platform staff and retailer managers + `grant select, insert, update, delete ... to authenticated, service_role` |
| **staff_time_entries**     | `grant select, insert, update, delete on public.staff_time_entries to service_role` (explicit fixture grant)                              |
| **stripe_webhook_events**  | `grant select, insert, update, delete ... to authenticated, service_role` (migration line 131) — service_role inserts via webhook handler |

Additionally, `customer_alteration_status_history` is a **VIEW** and its grants affect the underlying base tables, not a direct table.

---

## service_role UPDATE/DELETE/TRUNCATE grants currently active

Per `information_schema.role_table_grants`, all 23 tables/views have some mutation grant to `service_role`:

| Table                                     | UPDATE | DELETE | TRUNCATE |
| ----------------------------------------- | ------ | ------ | -------- |
| alteration_fulfillment_events             | ✓      | ✓      | ✓        |
| alteration_pricing_history                | ✓      | ✓      | ✓        |
| alteration_status_history                 | ✓      | ✓      | ✓        |
| behavioral_events                         | —      | —      | ✓        |
| campaign_delivery_audits                  | ✓      | ✓      | ✓        |
| campaign_library_entries                  | ✓      | —      | ✓        |
| chain_of_custody_events                   | ✓      | ✓      | ✓        |
| customer_alteration_status_history (VIEW) | —      | —      | ✓        |
| customer_consent_events                   | —      | —      | ✓        |
| integration_raw_events                    | —      | —      | ✓        |
| legacy_customer_fit_profile_entries       | ✓      | ✓      | ✓        |
| loyalty_ledger_entries                    | ✓      | ✓      | ✓        |
| morning_routine_delivery_audits           | ✓      | ✓      | ✓        |
| prospect_demo_engagement_events           | —      | —      | ✓        |
| retailer_events                           | ✓      | ✓      | ✓        |
| retailer_module_configuration_events      | ✓      | ✓      | ✓        |
| service_entitlement_entries               | ✓      | ✓      | ✓        |
| service_fulfilment_events                 | ✓      | ✓      | ✓        |
| service_history_events                    | ✓      | ✓      | ✓        |
| staff_time_entries                        | ✓      | ✓      | ✓        |
| stripe_webhook_events                     | ✓      | ✓      | ✓        |
| wardrobe_lifecycle_events                 | ✓      | ✓      | ✓        |
| wardrobe_ownership_events                 | ✓      | ✓      | ✓        |

**Key observations:**

- 23 tables/views all have at least TRUNCATE to service_role
- 19 have UPDATE, 19 have DELETE
- 23 have TRUNCATE
- Tables explicitly marked append-only in their comments (campaign_delivery_audits, customer_consent_events, integration_raw_events, morning_routine_delivery_audits, service_entitlement_entries, service_history_events, wardrobe_lifecycle_events, wardrobe_ownership_events) still carry mutation grants
- No TypeScript code in `packages/` or `apps/` references any of these 23 tables directly
- The actual mutations happen via database functions (loyalty_ledger_entries INSERTs), trigger functions (stripe_webhook_events), or the Stripe webhook Route Handler

## Evidence sources

- RLS policies: `pg_policies` query against local DB
- Code mutations: `rg` across `packages/` and `apps/` for `.update(`/`.delete(` patterns and table name references
- Table comments: `obj_description('public.<table>'::regclass, 'pg_class')` against local DB
- Creating migration: `rg` for `CREATE TABLE` / `CREATE VIEW` pattern in `supabase/migrations/`, with original source confirmed via migration file content
- Grant state: `information_schema.role_table_grants` for `service_role` + migration scan for `grant` statements
