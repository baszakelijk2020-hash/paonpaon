-- Same class of bug fixed in 20260806000004 (wedding-party child tables)
-- and 20260806000005 (corporate module), found by a broader third audit
-- pass: `clienteling_notes` has its own `retailer_id` plus a foreign key
-- to `customers` (which also carries its own `retailer_id`), but
-- `createClientelingNote` (apps/retailer/app/(dashboard)/customers/[id]/
-- actions.ts) trusts a raw, client-supplied `customerId` from form data
-- with no verification that the customer actually belongs to the
-- caller's own retailer, and the insert RLS policy only ever checked the
-- note's own `retailer_id` against `current_retailer_id()` — never that
-- the referenced `customer_id` belonged to that same retailer. A crafted
-- POST directly to the Server Action (bypassing the picker the real UI
-- renders, which only ever lists the caller's own customers) could
-- attach a note under the caller's own retailer_id to a different
-- retailer's real customer row.
--
-- Fixed the same way: a unique (id, retailer_id) constraint on
-- `customers` (customers had no such constraint yet, unlike the parent
-- tables the two prior fixes used, which already had one from their own
-- migrations) plus a composite foreign key on `clienteling_notes`. A
-- cross-tenant reference is now impossible at the database level,
-- regardless of what any current or future caller sends.

alter table public.customers
  add constraint customers_id_retailer_id_key unique (id, retailer_id);

alter table public.clienteling_notes
  add constraint clienteling_notes_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);
