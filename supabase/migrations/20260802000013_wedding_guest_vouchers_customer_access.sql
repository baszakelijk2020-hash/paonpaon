-- FT-13 Moonstruck groom/best-men planner — wiring `wedding_guest_vouchers`,
-- the last unwired FT-13 table (schema real since `20260801000014`). This
-- records a fact (a retailer issued a guest a voucher, funded externally by
-- the couple/retailer; it was later marked redeemed), never moves money
-- itself: no order, no stock, no payment capture. Retailer staff already
-- have plain insert/update RLS from the base migration (real session,
-- current_retailer_role() trusted directly, same as group_fittings), so
-- this only adds the customer-facing read side.

create policy "organizer and members read their party's guest vouchers"
  on public.wedding_guest_vouchers for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));
