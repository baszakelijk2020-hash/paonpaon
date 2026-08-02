-- FT-13 Moonstruck groom/best-men planner — wiring `wedding_group_fittings`
-- (schema already existed since 20260801000014, unwired: retailer-staff
-- read/insert/update RLS existed but no customer-facing visibility and no
-- repository/UI touched the table). This migration only adds the customer
-- read side; retailer scheduling already works through the existing
-- staff-insert RLS policy and a plain repository insert (no RPC needed —
-- unlike the anonymous/customer write paths elsewhere, retailer staff here
-- already have a real session `current_retailer_id()`/`current_retailer_role()`
-- can trust directly).

create policy "organizer and members read their party's group fittings"
  on public.wedding_group_fittings for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));
