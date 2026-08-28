-- Repairs the customer-side wardrobe roadmap approval path.
--
-- Defect (found by release-integration-lane-h @ ee33970, C2 candidate):
-- `public.enforce_wardrobe_roadmap_tenancy()` — a BEFORE INSERT OR UPDATE
-- trigger on public.wardrobe_roadmaps — re-ran its author-belongs-to-
-- retailer lookup against `public.retailer_staff_members` on every UPDATE,
-- not only on INSERT. That function is (and remains) `security invoker`,
-- and a customer session cannot read `retailer_staff_members` under RLS, so
-- the lookup always returned no row and the trigger raised 'Roadmap author
-- does not belong to the retailer' — every legitimate customer approve /
-- reject UPDATE on their own pending roadmap failed with
-- "Could not update roadmap."
--
-- Fix: the author/retailer-membership check is a creation-time invariant.
-- `retailer_id`, `customer_id`, and `authored_by_staff_id` are already
-- immutable after creation — enforced by the separate, untouched
-- `protect_wardrobe_roadmap_identity_on_update` trigger (BEFORE UPDATE,
-- also security invoker), which unconditionally rejects any UPDATE that
-- changes any of those three columns. Because that immutability is
-- guaranteed independently, an UPDATE can never actually change who the
-- roadmap's author is or which retailer it belongs to, so there is nothing
-- left for `enforce_wardrobe_roadmap_tenancy()` to re-verify on UPDATE —
-- the row already passed this exact check the moment it was inserted.
-- The function's staff lookup now runs only on INSERT (`tg_op = 'insert'`);
-- an UPDATE returns `new` immediately without touching
-- `retailer_staff_members` at all.
--
-- This preserves every existing guarantee:
--   - `enforce_wardrobe_roadmap_tenancy()` stays explicit `security invoker`
--     (no elevated privilege is introduced — see AGENTS.md §11 and
--     docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md §11: never add
--     `security definer` to make a test pass; never recreate
--     20260825190000_fix_wardrobe_tenancy_trigger_security_definer.sql,
--     which is exactly that shortcut, rejected once already);
--   - `set search_path = ''` and `revoke all ... from public` are unchanged;
--   - INSERT still resolves `authored_by_staff_id` through the active
--     (`deleted_at is null`) `retailer_staff_members` row and still
--     requires that staff member's `retailer_id` to equal
--     `new.retailer_id`;
--   - `protect_wardrobe_roadmap_identity_on_update` is not touched;
--   - the "customers update pending wardrobe roadmaps" RLS policy's
--     `using`/`with check` ownership and status conditions are not touched;
--   - no grant is added on `retailer_staff_members`, to `authenticated` or
--     anyone else;
--   - staff/tenant/customer/status authorization is unchanged everywhere
--     else in the schema.
--
-- `create or replace function` re-binds the existing
-- `enforce_wardrobe_roadmap_tenancy_on_write` trigger by name; no trigger,
-- policy, or table is dropped or recreated, and the original migration
-- (20260730170000_add_wardrobe_roadmap_outfits_sartorial.sql) is untouched.

create or replace function public.enforce_wardrobe_roadmap_tenancy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_staff_retailer_id uuid;
begin
  -- The author/retailer link is validated once, at creation. On UPDATE,
  -- protect_wardrobe_roadmap_identity_on_update independently guarantees
  -- authored_by_staff_id and retailer_id cannot change, so there is nothing
  -- to re-check here and no reason for an UPDATE (which may run under a
  -- customer session that cannot read retailer_staff_members) to touch that
  -- table at all.
  if tg_op = 'INSERT' then
    select staff.retailer_id into v_staff_retailer_id
    from public.retailer_staff_members as staff
    where staff.id = new.authored_by_staff_id
      and staff.deleted_at is null;
    if v_staff_retailer_id is null
      or v_staff_retailer_id <> new.retailer_id then
      raise exception 'Roadmap author does not belong to the retailer';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_wardrobe_roadmap_tenancy() from public;

comment on function public.enforce_wardrobe_roadmap_tenancy() is
  'BEFORE INSERT OR UPDATE on wardrobe_roadmaps, security invoker. On '
  'INSERT, validates authored_by_staff_id belongs to an active staff '
  'member of retailer_id. On UPDATE the check is skipped: '
  'authored_by_staff_id and retailer_id are immutable once set '
  '(protect_wardrobe_roadmap_identity_on_update), so a customer '
  'approve/reject UPDATE never needs to read retailer_staff_members, which '
  'their RLS session cannot see. See '
  '20260828155029_fix_wardrobe_roadmap_tenancy_update_author_recheck.sql.';
