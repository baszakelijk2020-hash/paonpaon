# Access Model

Who can see and change what, across all three apps. This is a reference
doc, not a mechanics doc — for _how_ RLS is implemented (JWT claims,
`security definer` helpers, the audit-log/append-only conventions), see
[DATABASE.md](./DATABASE.md). For the role types themselves, the source
of truth is code: `packages/domain/src/identity/role.ts`.

## The three account types

Every `User` authenticates into exactly one app, carrying one
`AccountType` (`packages/domain/src/identity/role.ts`):

| `AccountType`    | App             | Identity                                               |
| ---------------- | --------------- | ------------------------------------------------------ |
| `platform`       | `apps/admin`    | `PlatformStaffMember` — not tied to any retailer       |
| `retailer_staff` | `apps/retailer` | `RetailerStaffMember` — scoped to exactly one retailer |
| `customer`       | `apps/customer` | `Customer` — one row per retailer relationship         |

A single email can be a `Customer` at several retailers (one `Customer`
row each, linked to the same `auth.users` row via `user_id`) — see
"Why a Customer is scoped to one Retailer" in
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md). It can never simultaneously be
retailer staff and platform staff, or staff at two retailers with one
login — those are deliberately separate accounts.

## Retailer roles — the hierarchy

```
read_only → production_staff / sales_associate → manager → admin → owner
```

`retailerRoleAtLeast(role, minimum)` walks this list. Two roles sit
**outside** the hierarchy entirely — they are not "below production_staff",
they are a different axis:

- `workshop_manager` — scoped to whichever workshop(s) they're assigned,
  not the whole retailer's alterations queue
- `worker` — scoped to their own assigned tasks only

A `workshop_manager` only satisfies `retailerRoleAtLeast(role, "workshop_manager")`
— it can never be substituted for or by a hierarchy role, even `owner`.
Trying to gate a feature on "manager or above" will silently exclude
workshop managers and workers; if a feature needs to include them, check
for those roles explicitly (see `retailerRoleHasAlterationsPermission`
below) rather than reaching for `retailerRoleAtLeast`.

**Alterations permissions** (`ALTERATIONS_PERMISSIONS` in `role.ts`) are
the one place with a real per-role permission matrix rather than a
simple hierarchy cutoff, because the alterations workflow has genuinely
distinct actors:

| Role                          | Can                                                   |
| ----------------------------- | ----------------------------------------------------- |
| `owner` / `admin` / `manager` | `configure`, `approve_pricing`, `intake`, `oversight` |
| `sales_associate`             | `intake` only                                         |
| `production_staff`            | `oversight` only                                      |
| `workshop_manager`            | `manage_assigned_workshop` only                       |
| `worker`                      | `work_assigned_tasks` only                            |
| `read_only`                   | nothing                                               |

Every other retailer-scoped feature (loyalty programme rules, product
catalogue writes, staff invitations) uses the plain hierarchy cutoff —
almost always `manager` or `sales_associate` as the floor. Grep the
relevant migration's `create policy` block or the `require*Permission`
call in the Server Action for the exact floor on any given feature;
don't assume it matches alterations' matrix.

## Platform roles

`platform_owner`, `platform_admin`, `support_agent`, `platform_analyst`
— flat, not hierarchical today. `is_platform_staff()` (the RLS helper)
currently treats all four as "can read/manage everything," which is
coarser than the four names imply. If a feature needs
`support_agent` to see something `platform_analyst` shouldn't (or
vice versa), that's new work, not something already enforced —
check `packages/auth/src/guards.ts` and the specific table's policy
before assuming platform-role granularity exists.

## The four visibility tiers

Every table's RLS policies resolve to one (sometimes several) of these
four tiers. This is the pattern to match when adding a new table —
copy the shape of the nearest existing table in the same tier rather
than inventing a new one.

**1. Public — no session at all.** Only the storefront's _read_ surface:
active products/variants/collections from active retailers
(`apps/customer/app/r/[slug]/...`), gated on `status = 'active'` at
both the product and retailer level. Nothing here should ever accept a
customer identity from the client — see `docs/DECISIONS.md` ADR-014.

**2. Customer-login-only — the caller's own rows.** Orders, cart,
wishlist, loyalty account/ledger/redemptions, referrals, wedding-party
membership, messages. The policy shape is always
`exists (select 1 from customers c where c.id = <fk> and c.user_id = auth.uid())`
— never a bare `customer_id = <literal>` (that would trust a
client-supplied ID). A customer never gets a table-wide `select`; only
row-scoped access to what's theirs, re-derived server-side every time.

**3. Retailer staff — role-scoped within one tenant.** Everything in
`apps/retailer`. Two sub-shapes:

- Whole-tenant read + role-gated write: `retailer_id = current_retailer_id()`
  for `select`, plus a role check (`current_retailer_role() in (...)`)
  for `insert`/`update`/`delete`.
- Narrower-than-tenant read: `worker`s and `workshop_manager`s get
  their _own_ projections (`worker_alteration_work_orders` view,
  `findByIdForWorker`) with customer PII and pricing fields stripped
  out entirely at the query level, not just hidden in the UI — see
  "customer security surface" in DOMAIN_MODEL.md.

**4. Platform staff — cross-tenant.** `is_platform_staff()` via the
`platform_role` JWT claim. Platform staff can read/manage every
retailer's data; the admin app's own UI, not RLS, is what limits which
of that platform staff actually touch day to day (RLS is not currently
split further per platform role — see above).

A fifth pattern worth naming because it's easy to miss: **narrow
security-definer RPCs that broaden a write past what direct-table RLS
would allow**, always to do exactly one controlled thing — a customer
can't `insert` directly into `loyalty_ledger_entries` or `referrals`,
but `create_my_referral`/`redeem_my_reward`/`ensure_my_loyalty_account`
(all `security definer`, all re-deriving the caller's `customer_id`
from `auth.uid()` inside the function body, never trusting a parameter)
let them trigger exactly one validated transition. This is the same
shape as `add_fitting_observation`, `record_message_attachment`, and
`update_wedding_party_member_status` — grep `security definer` in
`supabase/migrations/` for the full list before adding a new one; it's
almost always cheaper to reuse the pattern than invent a bespoke one.

## Spot-checked for drift (2026-07-26)

Confirmed the same tier-2/tier-3/tier-4 policy shape, near-verbatim, on
`products`, `orders`, `customers`, `loyalty_programs`/`loyalty_accounts`/
`loyalty_ledger_entries`/`rewards`/`reward_redemptions`/`referrals`, and
`wedding_parties`/`wedding_party_members` (the last pair needed a fix,
not for tier drift but for a genuine RLS infinite-recursion bug — see
ADR-045 in [DECISIONS.md](./DECISIONS.md)). No other tables were
re-audited tonight; this note exists so the _next_ audit knows where
the last one stopped rather than re-deriving it from zero.
