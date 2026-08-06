-- Real cross-tenant integrity gap found writing pgTAP coverage for
-- wedding_guest_vouchers (had none since it was wired in 20260802000013,
-- despite holding real monetary value): the bulk RLS-granting loop in
-- 20260801000014 gives staff insert on wedding_inspiration_items,
-- wedding_design_choices, wedding_group_fittings, wedding_guest_vouchers
-- and wedding_aftercare_plans checking only
-- `retailer_id = current_retailer_id()` — it never verifies the
-- `wedding_party_id` being written actually belongs to that same
-- retailer. Any authenticated staff member of ANY retailer could attach a
-- row (a monetary voucher, an aftercare instruction, a fitting) to a
-- DIFFERENT retailer's wedding party by supplying their own retailer_id
-- alongside someone else's wedding_party_id — and that other retailer's
-- organizer/members would then read it via
-- is_wedding_party_organizer_or_member(wedding_party_id), which never
-- checks retailer_id either. Reproduced directly: inserting a
-- wedding_guest_vouchers row with retailer_id = House B and
-- wedding_party_id = House A's party succeeded, and House A's organizer
-- could read it.
--
-- Fixed the same way service_memberships ties itself to service_plans
-- (20260730230000: `references public.service_plans (id, retailer_id)`):
-- a composite foreign key on (wedding_party_id, retailer_id) makes a
-- cross-tenant reference impossible at the database level, not just
-- inconvenient through the app. wedding_parties needs a supporting
-- unique constraint on (id, retailer_id) — id alone is already the
-- primary key, so this adds no new uniqueness semantics.

alter table public.wedding_parties
  add constraint wedding_parties_id_retailer_id_key unique (id, retailer_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_inspiration_items', 'wedding_design_choices',
    'wedding_group_fittings', 'wedding_guest_vouchers',
    'wedding_aftercare_plans'
  ] loop
    execute format(
      'alter table public.%I add constraint %I '
      || 'foreign key (wedding_party_id, retailer_id) '
      || 'references public.wedding_parties (id, retailer_id)',
      t, t || '_party_retailer_fkey'
    );
  end loop;
end $$;
