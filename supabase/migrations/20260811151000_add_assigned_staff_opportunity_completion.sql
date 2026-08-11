-- PHASE 11.2 / WFM-103: assigned clienteling work belongs to the assignee.
-- Keep the existing retailer-wide SELECT policy: staff need the customer context
-- to do their work. Writes, however, are limited to management or the actual
-- assigned sales associate.

drop policy if exists clienteling_opportunities_retailer_update
  on public.clienteling_opportunities;

create policy clienteling_opportunities_management_update
  on public.clienteling_opportunities for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'manager', 'admin')
  );

create policy clienteling_opportunities_assignee_complete
  on public.clienteling_opportunities for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) = 'sales_associate'
    and assigned_staff_id = (select public.current_staff_id())
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) = 'sales_associate'
    and assigned_staff_id = (select public.current_staff_id())
  );
