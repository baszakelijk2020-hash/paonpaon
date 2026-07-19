# Product

PAON consists of three applications sharing one domain model
([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)) and one design system
([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)). No feature is implemented
twice — if two apps need the same capability, it is built once in a
shared package (`packages/*`) and consumed by both.

## The three applications

### 1. PAON Admin — `apps/admin`

Used by PAON's own staff to operate the platform itself.

| Area                    | Responsibility                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| Retailer onboarding     | Create tenants, configure initial settings, provision staff      |
| Subscription management | Plans, billing status, upgrades/downgrades                       |
| Platform analytics      | Cross-tenant usage, health, adoption metrics                     |
| Feature management      | Per-plan and per-retailer feature flags                          |
| Support                 | Tenant impersonation (audited), ticket context                   |
| Billing                 | Invoices, payment status, dunning                                |
| Integrations            | Manage platform-level third-party integrations                   |
| Platform settings       | Global configuration, plan catalog                               |
| User administration     | Platform staff accounts and roles                                |
| Audit logs              | Immutable record of privileged actions across the platform       |
| AI monitoring           | Usage, cost and quality oversight of AI personalisation features |

### 2. Retailer Portal — `apps/retailer`

Used by a retailer's own staff to run the business day to day.

| Area                          | Responsibility                                             |
| ----------------------------- | ---------------------------------------------------------- |
| Dashboard                     | Operational overview: orders, production, appointments due |
| Customers / CRM               | Customer records, clienteling notes, lifecycle stage       |
| Products                      | Catalog authoring: products, variants, collections         |
| Orders                        | Order lifecycle from placement to fulfillment              |
| Production                    | Connector-facing supplier/manufacturing status             |
| Alterations                   | Garment intake, fitting, work orders and handoffs          |
| Loyalty / Rewards / Referrals | Configure programs, view customer balances                 |
| Appointments                  | Booking, staff availability, calendar                      |
| Inventory                     | Stock levels per variant                                   |
| Communications                | Messaging threads, notification templates                  |
| Analytics                     | Retailer-scoped performance metrics                        |
| Staff                         | Staff accounts, roles, availability                        |
| Settings                      | Brand theme, locations, business configuration             |

### 3. Customer Portal — `apps/customer`

Used by a retailer's customers.

| Area                | Responsibility                                  |
| ------------------- | ----------------------------------------------- |
| Login               | Passwordless / OAuth authentication             |
| Profile             | Personal details and relationship preferences   |
| Orders              | Purchase history and current orders             |
| Production tracking | Approved supplier/manufacturing status          |
| Alteration tracking | Approved status and pickup/delivery information |
| Loyalty / Rewards   | Points balance, tier, redeemable rewards        |
| Referrals           | Invite friends, track referral status           |
| Wishlist            | Saved products                                  |
| Appointments        | Book and manage appointments with the retailer  |
| Notifications       | Cross-channel notification inbox                |
| Messaging           | Direct conversation with retailer staff         |
| Preferences         | Communication and privacy preferences           |

A customer with relationships at multiple PAON retailers signs into one
Customer Portal account and sees each retailer relationship separately
— see `CustomerAccountLink` in [DOMAIN_MODEL.md](./DOMAIN_MODEL.md).

## Order vs. Production vs. Alteration

This distinction is load-bearing throughout the product and is modeled
explicitly rather than inferred:

- An **Order** is the commercial record — what was bought, for how
  much, its fulfillment status.
- A **ProductionOrder** tracks manufacturing of one made-to-order line
  within an order. Not every order line has one.
- An **Alteration** tracks a fit change, which may be tied to a
  fulfilled order line or requested independently, on a past purchase.

An order can be "delivered" while an alteration on one of its lines is
still "in progress" — the UI must always be able to show these as
related but independently-progressing timelines, never collapse them
into a single status.

## Alterations ownership boundary

PAON does not replace GoCreate, a supplier manufacturing platform,
factory ERP, MTM measurement/fit profiles, garment specifications,
production ordering or construction systems. Those systems remain
authoritative for manufacturing and PAON may connect to them later.

PAON is authoritative for the in-store garment journey: identifying a
specific physical garment; fitting sessions and observations; proposed
operations classified as `work_now` or `future_order_note`; work orders,
quotes, approvals and effective price lists; retailer/workshop assignment;
evidence and chain of custody; completion review; customer-approved status;
pickup/delivery; cancellation; and immutable audit history. A
`future_order_note` is retained for manual staff entry into a future GoCreate
order. PAON does not turn it into a manufacturing specification or production
order.

## Phasing

See [ROADMAP.md](./ROADMAP.md) for the order these are built in. This
document describes the full intended product surface; it is not a
statement that all of it exists yet.
