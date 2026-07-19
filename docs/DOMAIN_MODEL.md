# Domain Model

The canonical domain model lives in code at `packages/domain/src`, as
TypeScript types and value objects. This document explains the shape of
that model, the reasoning behind its boundaries, and must be kept in
sync with the code — if they disagree, the code's exported types are
correct and this document is stale and should be fixed.

## Modeling conventions

- **Branded IDs.** Every entity ID is a nominal type (`CustomerId`,
  `RetailerId`, ...), not a bare `string`. See
  `packages/domain/src/shared/branded-id.ts`. This makes "passed a
  CustomerId where a RetailerId was expected" a compile error instead of
  a cross-tenant data bug discovered in production.
- **Money is never a float.** `Money` is an integer minor-unit amount
  plus an ISO 4217 currency code. See `shared/money.ts`.
- **Timestamps and tenancy are structural, not incidental.** Every
  persisted entity extends `Timestamps` (`createdAt`, `updatedAt`,
  soft-delete `deletedAt`). Every tenant-scoped entity carries a
  `retailerId` directly on the entity, not just in the database row.
- **Entities are read models, not classes.** `@paon/domain` defines
  what an entity looks like and the value objects it's built from. It
  does not contain persistence logic (that's `@paon/database`
  repositories) or framework code. Where an invariant needs enforcing
  (e.g. loyalty point arithmetic, role hierarchy), a pure function lives
  alongside the type it operates on — see `retailerRoleAtLeast` in
  `identity/role.ts` as the pattern to follow.

## Bounded contexts

| Context      | Path            | Owns                                                                                            |
| ------------ | --------------- | ----------------------------------------------------------------------------------------------- |
| Identity     | `identity/`     | `User`, `PlatformStaffMember`, `RetailerStaffMember`, role hierarchies                          |
| Retailer     | `retailer/`     | `Retailer` (the tenant root), `RetailerSubscription`, `SubscriptionPlan`, `FeatureFlagOverride` |
| Customer     | `customer/`     | `Customer`, `CustomerAccountLink`, `CustomerPreferences`, `Wishlist`                            |
| Catalog      | `catalog/`      | `Product`, `ProductVariant`, `Collection`                                                       |
| Commerce     | `commerce/`     | `Order`, `OrderLine`, `Payment`                                                                 |
| Production   | `production/`   | `ProductionOrder`, `Alteration`                                                                 |
| Appointments | `appointments/` | `Appointment`, `AvailabilityWindow`                                                             |
| Loyalty      | `loyalty/`      | `LoyaltyAccount`, `LoyaltyLedgerEntry`, `Reward`, `Referral`                                    |
| Engagement   | `engagement/`   | `Notification`, `Conversation` / `Message`, `RetailerEvent` / `EventRsvp`, `ClientelingNote`    |
| Analytics    | `analytics/`    | `AuditLogEntry`, `BehavioralEvent`                                                              |

## Key relationships

```
Retailer 1───* RetailerStaffMember ──1 User
Retailer 1───* Customer ──0..1 User (via CustomerAccountLink, many-to-one from the User side)
Retailer 1───* Product 1───* ProductVariant
Customer 1───* Order 1───* OrderLine ──1 ProductVariant
OrderLine 0..1─── ProductionOrder
OrderLine 0..1─── Alteration           (Alteration may instead reference a past purchase directly)
Customer 1───1 LoyaltyAccount 1───* LoyaltyLedgerEntry
Customer 1───* Appointment ──0..1 RetailerStaffMember
Customer 1───1 Conversation 1───* Message
```

## Why a Customer is scoped to one Retailer

A `Customer` record — purchase history, loyalty balance, clienteling
notes, size profile — belongs entirely to one retailer relationship. A
shopper who buys from two PAON retailers has two independent `Customer`
rows, each invisible to the other retailer. What is shared is the
**login**: one `User` in the Customer Portal, linked to each per-retailer
`Customer` via `CustomerAccountLink`, so a shopper signs in once and sees
each relationship separately. This mirrors how the business actually
works (retailers do not share client books) and makes tenant isolation
in [DATABASE.md](./DATABASE.md) simple to reason about: nearly every
table's RLS policy is "rows where `retailer_id` matches the caller's
retailer," full stop.

## Why Order, ProductionOrder and Alteration are separate aggregates

Collapsing manufacturing and alteration status onto the `Order` would
force every order to model a superset of every possible workflow,
and would make it impossible to alter a purchase made months earlier
(there is no live order to attach it to). Keeping them separate
aggregates, linked by `orderLineId`, keeps each aggregate's invariants
simple and lets an alteration exist entirely independently of a current
order. See [PRODUCT.md](./PRODUCT.md) "Order vs. Production vs.
Alteration".

## Extending the model

When a new entity is needed:

1. Decide which bounded context it belongs to (add a new one only if it
   genuinely doesn't fit an existing context).
2. Define it in `packages/domain/src/<context>/`, following the
   conventions above (branded ID, `Timestamps`, `retailerId` if
   tenant-scoped).
3. Export it from `packages/domain/src/index.ts`.
4. Add the corresponding table and RLS policy — see
   [DATABASE.md](./DATABASE.md).
5. Update the relationship diagram and table above in this document.

Never define a shape that duplicates an existing entity's purpose with
minor field differences — extend the existing entity or compose a new
value object instead.
