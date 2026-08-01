-- A drift monitor for the one truth.
--
-- Migrations 18 and 19 made the ledger authoritative and routed every writer
-- through it. This counts any variant whose cached `inventory_quantity`
-- disagrees with the ledger anyway. It should be zero forever; a non-zero
-- answer means a new write path has appeared that bypasses the triggers, and
-- that is exactly the silent oversell those migrations removed.
create or replace function public.count_inventory_disagreements()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.product_variants pv
  join lateral public.variant_ledger_balance(pv.id) b on true
  where pv.deleted_at is null
    and exists (
      select 1 from public.stock_ledger_entries e where e.variant_id = pv.id
    )
    and pv.inventory_quantity <> greatest(b.available, 0);
$$;

comment on function public.count_inventory_disagreements() is
  'Number of variants whose cached inventory_quantity disagrees with the ledger. Must be zero; anything else means a write path is bypassing the ledger.';
