# 03 — Domain map

**Snapshot date: 2026-07-29.** Domains below are **implemented** (types and/or
tables and/or UI). Overlaps are called out.

There is **no separate application service layer** in `packages/database`;
“services” means Server Actions + package helpers (Stripe/OpenAI/etc.).

---

## Identity & access

**Purpose.** Platform staff, retailer staff, customer auth linking.

**Entities.** `User` (conceptual), `PlatformStaffMember`, `RetailerStaffMember`,
`StaffShift`, `StaffTimeEntry`; session types in `@paon/auth`.

**Repositories.** `platform-staff-repository`, `retailer-staff-repository`,
`staff-roster-repository`.

**Tables.** `platform_staff_members`, `retailer_staff_members`, `staff_shifts`,
`staff_time_entries` (+ Supabase `auth.users` outside public schema).

**UI.** Admin/retailer/customer login, accept-invite, staff roster (retailer).

**API.** Server Actions for invite/login; `auth/confirm` Route Handlers;
middleware session checks.

**Dependencies.** Supabase Auth; JWT `app_metadata` for platform/retailer roles;
customer identity via `auth.uid()` RLS (ADR-013).

**Extension.** Multi-store locations not modeled as first-class entities yet
(settings address only — PROJECT_STATE / ROADMAP notes).

---

## Retailer & commercial platform

**Purpose.** Tenants, brand themes, subscriptions, prospects, Demo Studio.

**Entities.** `Retailer`, `RetailerBrandTheme` (+ versions), `SubscriptionPlan`,
`RetailerSubscription`, commercial inquiry/prospect/demo configuration types,
entitlements.

**Repositories.** `retailer-repository`, `subscription-plan-repository`,
`retailer-subscription-repository`, `entitlement-repository`,
`commercial-inquiry-repository`, `commercial-prospect-repository`.

**Tables.** `retailers`, `retailer_brand_theme_versions`, `subscription_plans`,
`subscription_plan_entitlements`, `retailer_subscriptions`,
`retailer_entitlement_overrides`, `commercial_inquiries`, `commercial_prospects`,
`prospect_demo_*`, `synthetic_demo_generations`, `commercial_features`,
`managed_service_offerings`.

**UI.** Admin retailers, prospects/studio, billing, inquiries; retailer settings
(theme).

**API.** Server Actions; Stripe platform webhook (admin); demo expiry cron.

**Dependencies.** `@paon/payments` Billing; Stripe credentials for live billing.

**Overlap.** Commercial demo environments vs live retailer tenants — separate
tables; Demo Studio targets conversion (PHASE workstream 2).

---

## Customer CRM

**Purpose.** Per-retailer customer records and portal linking.

**Entities.** `Customer`, `CustomerAccountLink`, `CustomerPreferences`,
`Wishlist`, `WishlistItem`.

**Repositories.** `customer-repository`, `customer-preferences-repository`,
`wishlist-repository`.

**Tables.** `customers`, `customer_account_links`, `customer_preferences`,
`wishlists`, `wishlist_items`.

**UI.** Retailer `/customers`; customer `/account`, `/wishlist`.

**Dependencies.** Auth linking RPC `link_my_customer_accounts` (documented ADR-013).

**Overlap.** Clienteling notes / messaging also hang off Customer.

---

## Catalog

**Purpose.** Sellable products, variants, collections.

**Entities.** `Product`, `ProductVariant`, `Collection`.

**Repositories.** `product-repository`, `product-variant-repository`,
`collection-repository`.

**Tables.** `products`, `product_variants`, `collections`, `product_collections`.

**UI.** Retailer products/collections; customer storefront + `/products` routes.

**API.** Storefront HTML injection (`r/[slug]/route.ts`); cart APIs under
`r/[slug]/api/*`.

**Limitations.** No Brand entity; no metadata graph; variant has size/color
strings; `swatch_image_url` on products (ADR-049). Category filters are
heuristic (see [07_metadata.md](./07_metadata.md), [09_search.md](./09_search.md)).

---

## Commerce & payments

**Purpose.** Cart-as-draft-order, checkout, Connect payments.

**Entities.** `Order`, `OrderLine`, `Payment`, `RetailerStripeAccount`.

**Repositories.** `order-repository`, `payment-repository`,
`retailer-stripe-account-repository`.

**Tables.** `orders`, `order_lines`, `payments`, `retailer_stripe_accounts`,
`stripe_webhook_events`.

**UI.** Customer cart/checkout; retailer orders (+ print); admin billing
(subscriptions, separate).

**API.** Server Actions; customer Stripe Connect webhook; storefront cart Route
Handlers.

**Dependencies.** `@paon/payments`; ADR-024 cart = draft Order.

**Gap.** `ProductionOrder` domain type exists; **no** `production_orders` table
or repository found — manufacturing connectors not started (PROJECT_STATE).

---

## Alterations & physical garments

**Purpose.** Garment-first fitting and work orders (not factory MTM).

**Entities.** `PhysicalGarment`, fittings, observations, alteration work orders,
tasks, custody, workshops, price lists, attachments, etc.

**Repositories.** Multiple `alteration-*`, `physical-garment-repository`,
`workshop-repository`, `customer-alteration-repository`.

**Tables.** `physical_garments`, `fitting_*`, `alteration_work_orders`,
`alteration_tasks`, catalogues/price lists, custody, attachments, legacy
`legacy_alterations`, `legacy_customer_fit_profile_entries`.

**UI.** Retailer `/alterations/*` (PHASE: founder design still gates deep UX);
customer alteration tracking; print routes.

**Overlap.** Garment lifecycle vision ([vision/12](../vision/12_garment_lifecycle.md))
is not a separate domain yet — alterations seed it.

---

## Appointments

**Purpose.** Booking and availability.

**Entities.** `Appointment`, `AvailabilityWindow`.

**Repositories.** `appointment-repository`, `availability-window-repository`.

**Tables.** `appointments`, `availability_windows`.

**UI.** Retailer + customer appointments; storefront appointment-request API;
print route.

---

## Loyalty, rewards, referrals

**Purpose.** Retailer loyalty programme and referrals.

**Entities.** Programme, account, ledger, rewards, redemptions, referral.

**Repository.** `loyalty-repository` (covers related tables).

**Tables.** `loyalty_programs`, `loyalty_accounts`, `loyalty_ledger_entries`,
`rewards`, `reward_redemptions`, `referrals`.

**UI.** Retailer loyalty; customer loyalty/referrals.

---

## Engagement (messaging, notifications, events, newsletter, wedding)

**Purpose.** Conversations, notifications, retailer events/RSVP, newsletter,
wedding parties, clienteling notes.

**Entities.** Messaging, `Notification`, `RetailerEvent`, `EventRsvp`,
`ClientelingNote`, `WeddingParty` (+ members), outbox entries,
`NewsletterSubscriber`.

**Repositories.** `messaging-repository`, `notification-repository`,
`event-repository`, `clienteling-repository`, `wedding-party-repository`,
`email-outbox-repository`, `sms-outbox-repository`, `newsletter-repository`.

**Tables.** Matching public tables including `conversations`, `messages`,
`notifications`, `retailer_events`, `event_rsvps`, `clienteling_notes`,
`wedding_parties`, `wedding_party_members`, `email_outbox`, `sms_outbox`,
`newsletter_subscribers`.

**UI.** Messages/notifications/events in retailer + customer; wedding party
flows; marketing newsletter actions.

**API.** Admin cron dispatch-emails/sms/newsletter.

**Overlap.** Clienteling notes vs AI memory vision — notes are retailer-private
(ADR-019); structured AI memory not built.

---

## Analytics & AI audit

**Purpose.** Behavioral signals, AI generation audit, platform analytics reads.

**Entities.** `BehavioralEvent`, `AIGeneration`, `AuditLogEntry`.

**Repositories.** `analytics-repository`, `ai-generation-repository`.

**Tables.** `behavioral_events`, `ai_generations`, `audit_log_entries`.

**UI.** Retailer/admin analytics; admin AI monitoring; customer Today’s Pick /
retailer AI insights (generation calls).

**AI runtime.** `@paon/ai` — see [08_ai.md](./08_ai.md).

---

## Why domains overlap

Luxury retail is relationship-shaped: Customer is the hub for commerce,
alterations, appointments, loyalty, messaging, and notes. Catalog is thin and
reused by storefront, recommendations, and newsletter. Commercial/Demo Studio
mirrors retailer shapes without always creating a live tenant. This is
intentional coupling, not accidental duplication of packages.
