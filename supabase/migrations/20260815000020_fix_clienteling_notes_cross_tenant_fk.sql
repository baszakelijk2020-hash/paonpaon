-- The same class of cross-tenant gap fixed in 20260815000000 (wedding-party
-- child tables) and 20260815000010 (corporate module), found by a third
-- audit pass over tables that carry both their own retailer_id and a
-- foreign key to another tenant-scoped parent.
--
-- `clienteling_notes` has its own `retailer_id` plus a foreign key to
-- `customers`, which also carries its own `retailer_id`. Two things were
-- true at once:
--
--   * createClientelingNote
--     (apps/retailer/app/(dashboard)/customers/[id]/actions.ts) trusts a
--     raw, client-supplied `customerId` from form data with no check that
--     the customer belongs to the caller's own retailer. The picker the
--     real UI renders only ever lists the caller's own customers, so the
--     UI never produces a bad value — but a crafted POST straight to the
--     Server Action is not the UI.
--   * The insert RLS policy only ever checked the note's own `retailer_id`
--     against `current_retailer_id()`, never that the referenced
--     `customer_id` belonged to that same retailer.
--
-- Together those let a staff member attach a clienteling note, under their
-- own retailer_id, to a different retailer's real customer row.
--
-- Deliberately narrower than the two earlier fixes: `customers` ALREADY has
-- the required unique constraint on (id, retailer_id). It is created by
-- 20260814000000_add_store_feedback_signals.sql, which needed it for its
-- own composite foreign key. That is incidental — main acquired the
-- harmless half of this fix as a side effect of an unrelated feature, while
-- the half that actually closes the hole was never added. This migration
-- adds only the missing composite foreign key and must NOT re-add the
-- unique constraint, which would fail as a duplicate.
--
-- ON DELETE CASCADE mirrors the existing single-column
-- clienteling_notes.customer_id foreign key, so deleting a customer still
-- removes their notes exactly as it does today, and deletion behaviour does
-- not depend on two foreign keys with different actions resolving in a
-- particular order.
--
-- Verified before writing: zero existing rows violate this constraint.

alter table public.clienteling_notes
  add constraint clienteling_notes_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id)
  on delete cascade;
