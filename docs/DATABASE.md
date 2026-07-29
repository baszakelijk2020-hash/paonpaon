# Database

Single Supabase project (single Postgres database) shared by all three
applications. There is no per-retailer database and no per-app
database — tenant isolation is a data-model and RLS concern, not an
infrastructure one. See [DECISIONS.md](./DECISIONS.md) for why.

## Directory layout

```
supabase/
├── config.toml          — local dev stack configuration
├── migrations/           — timestamped, sequential SQL migrations (source of truth for schema)
├── seed.sql              — local/dev seed data, never run against production
└── templates/            — auth email templates referenced from config.toml (e.g. templates/invite.html)
```

## Migrations

- Every schema change is a new file in `supabase/migrations/`, generated
  via `supabase migration new <name>` and applied with
  `supabase db push` / the Supabase CI integration. Migrations are never
  edited after being merged to `main` — a mistake is fixed by a new
  forward migration.
- Every table migration includes its RLS policies in the same file. A
  table is never merged without RLS enabled; see below.
- Naming: `<timestamp>_<verb>_<subject>.sql`, e.g.
  `20260101000000_create_retailers.sql`.

## Type generation

`pnpm --filter @paon/database generate-types` runs
`supabase gen types typescript --local` and writes
`packages/database/src/generated/database.types.ts`. This file is
generated, not hand-written — regenerate it after every migration and
commit the result so `@paon/database` and application code stay in sync
with the actual schema without every developer needing a running
Supabase instance to typecheck.

## Row Level Security

RLS is enabled on every table from the migration that creates it. The
default posture for a tenant-scoped table:

```sql
alter table public.customers enable row level security;

create policy "retailer staff can read their retailer's customers"
  on public.customers for select
  using (retailer_id = (select public.current_retailer_id()));
```

Conventions:

- The caller's `retailer_id` (for retailer staff) or `customer_id` (for
  customer-portal callers) is carried in Supabase auth JWT
  `app_metadata`, set when the staff/customer record is created — never
  trusted from a client-supplied value.
- Platform staff (PAON Admin) read across tenants through a separate
  policy gated on an `app_metadata` platform-role claim, not by using
  the service-role key from application code.
- The service-role (admin) client from `@paon/database` bypasses RLS
  entirely and is restricted to: webhooks, scheduled jobs, and
  explicitly admin-authorized Server Actions that have already checked
  the caller's platform role in application code. It must never be
  reachable from a code path a browser can trigger without that check.
- Write policies mirror read policies plus a role check
  (`retailerRoleAtLeast` in `@paon/domain`) implemented as a SQL
  condition against the JWT role claim — the application-layer guard in
  `@paon/auth` and the database policy must enforce the same rule.
- A narrow state transition a tenant is allowed to trigger once (accept
  an invite, activate a tenant) is a `security definer` RPC that
  re-derives its own authority from `auth.uid()`/the row it's called
  against — never a broadened `update` policy or column grant that
  would let the client assert the transition directly. See
  `accept_retailer_staff_invite` and docs/DECISIONS.md ADR-012.
- An identity that can hold **many** simultaneous tenant relationships
  (a Customer Portal login, linked to one `Customer` row per retailer —
  see `docs/DOMAIN_MODEL.md` "Why a Customer is scoped to one
  Retailer") cannot key its own-row RLS off a single mirrored JWT claim
  the way retailer/platform staff do (`current_retailer_id()` assumes
  exactly one tenant per session). Its own-row policies compare
  `auth.uid()` directly against the row's `user_id` column instead —
  see `customers`' "a customer can read their own linked record" policy
  and docs/DECISIONS.md ADR-013.
- When a permissive policy grants more than one field/role/value should
  be able to reach through a single write (e.g. "manage staff" also
  technically allowing a role-grant it shouldn't), narrow it with an
  additional `as restrictive` policy scoped to the specific command
  rather than rewriting the permissive one — see the
  `retailer_staff_members` "may not grant owner role" policy. `WITH
CHECK` never sees the pre-update row, so a column that must not
  _change_ (as opposed to a value that must never be _written_) needs a
  `before update` trigger instead — see
  `enforce_retailer_staff_editable_columns` on `retailers`.
- Workshop identities use the same single-retailer session machinery but are
  outside the retailer role hierarchy. Additive restrictive policies remove
  inherited CRM, commerce, appointment and product access. A workshop manager
  sees only orders assigned to their workshop; a worker sees only a directly
  assigned order/task through projections that omit customer and pricing
  columns. Alteration helper functions resolve only accepted, non-deleted staff
  memberships, so an invitation's mirrored JWT claims do not grant pre-
  acceptance access. Private evidence objects use the same assignment check;
  registered attachment metadata makes their paths immutable. See
  `20260719000103_secure_alterations_and_workflows.sql`.
- Customer alteration access is column-minimized, not only row-minimized.
  Customers have no base-table policy on work orders, tasks, pricing, evidence
  or custody. Security-barrier views expose only approved work-order
  status/agreed totals, customer-visible history, and pickup/delivery fields.

### Metadata foundation

`20260729174939_create_metadata_foundation.sql` persists the Stage 1 metadata
contracts in:

- `metadata_concepts` and `metadata_concept_edges`;
- `entity_metadata_assignments` and append-only
  `metadata_assignment_reviews`;
- `retailer_concept_overrides`; and
- `product_fabric_profiles` with exact `product_fabric_composition`.

Canonical concepts/edges have `retailer_id = null` and are platform-managed.
Retailer staff may read canonical plus same-tenant concepts; managers and above
may mutate only same-tenant concepts, edges, assignments, and overrides.
Workshop, customer, and anonymous identities receive no metadata access.
Cross-tenant target/concept references are rejected by database triggers in
addition to RLS.

Authenticated clients cannot write fabric profile tables directly.
`set_product_fabric_profile` re-derives the product tenant and JWT authority,
validates the optional variant, fibre concepts, precision, uniqueness, and an
exact 100% non-empty composition, then replaces the profile atomically.
Terminal assignment writes append reviewer/source/evidence snapshots through a
non-callable audit trigger. The live contract is exercised by
`supabase/tests/metadata_foundation_rls_test.sql`.

`20260729181443_add_metadata_review_workflow.sql` narrows assignment mutation:
authenticated managers may insert pending proposals but cannot update or delete
assignments directly. `review_metadata_assignment` accepts only `accepted` or
`rejected`, re-derives the accepted staff identity and tenant from the session,
locks the assignment, and records actor/time through the existing append-only
trigger. Repeating the same decision is idempotent; changing a decision appends
another event with its previous state. The live authorization and transition
matrix is exercised by `supabase/tests/metadata_review_workflow_test.sql`.

## Audit logging

Privileged mutations (anything a `AuditLogEntry` — see
[DOMAIN_MODEL.md](./DOMAIN_MODEL.md) — should exist for: role changes,
subscription changes, impersonation, deletions) are written by a
Postgres trigger or a transactional insert alongside the mutation, not
solely by application code, so a bypass of the application layer cannot
also bypass the audit trail. Audit log rows are insert-only — no update
or delete policy exists for them.

The alterations slice implements this with `audit_log_entries` triggers on
staff/workshop scope, catalogue settings, workshop assignments, work orders,
tasks/task notes, attachment metadata, pricing proposals, custody, completion
reviews and fulfillment. Price-list writes and alteration status/agreed-price
changes go through audited, validated `security definer` functions.
`alteration_status_history`, `alteration_pricing_history` and
`chain_of_custody_events` are append-only. Direct-RLS operational inserts
(`alteration_attachments`, `chain_of_custody_events`,
`alteration_fulfillment_events`) derive their employee-attribution columns from
`current_staff_id()` in `before insert` triggers; a browser cannot claim another
staff member's identity even when it otherwise has permission to create the
record.

## Soft delete

Entities with business history (`orders`, `alteration_work_orders`,
`loyalty_ledger_entries`, ...) are never hard-deleted.
They carry `deleted_at` and are filtered out of default queries by the
repository layer. Entities without retained history value (e.g. a draft
wishlist item) may hard-delete.

**Note:** a future `production_orders` table is **not** in the schema yet
(domain-only `ProductionOrder`). Do not document it as a live soft-delete
target until a migration lands.

## Realtime

Supabase Realtime is used for: order/production/alteration status
changes reflected live in the Customer Portal, and new messages in
`Conversation`/`Message`. Realtime subscriptions still go through RLS —
a client only receives change events for rows it could already `select`.

## JWT claim sync

RLS policies read the caller's role from `auth.jwt() -> 'app_metadata'`
via the helper functions in `20260719000001_create_auth_helpers.sql`
(`current_platform_role()`, `is_platform_staff()`,
`current_retailer_id()`, `current_retailer_role()`) — never inline the
raw JWT path expression in a new policy. Those claims are not set by
application code directly; they're mirrored from a staff table by a
`security definer` trigger (`sync_platform_role_claim`,
`sync_retailer_staff_claim`) whenever a `platform_staff_members` /
`retailer_staff_members` row is written or its `user_id` is unlinked.
Any future staff-like table follows the same trigger shape.

## Local development

`supabase start` runs the full local stack (Postgres, Auth, Storage,
Realtime, Studio) via Docker. `supabase/seed.sql` provides a sample
retailer to develop against without a remote project; it cannot seed
`auth.users` (Supabase Auth users aren't created by plain SQL inserts
against `public` tables) — use
`pnpm --filter @paon/database bootstrap:platform-admin` to create the
first PAON Admin login, and PAON Admin's onboarding flow to create
everything after that. CI runs migrations against a fresh local stack
before running any test that touches the database.
