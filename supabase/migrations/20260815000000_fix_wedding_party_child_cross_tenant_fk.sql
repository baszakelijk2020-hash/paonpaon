-- Cross-tenant integrity gap in the wedding-party child tables.
--
-- The bulk RLS-granting loop in 20260801000014 gives staff insert on
-- wedding_inspiration_items, wedding_design_choices, wedding_group_fittings,
-- wedding_guest_vouchers and wedding_aftercare_plans checking only
-- `retailer_id = current_retailer_id()`. It never verifies that the
-- `wedding_party_id` being written actually belongs to that same retailer.
--
-- So an authenticated staff member of ANY retailer could attach a row to a
-- DIFFERENT retailer's wedding party by supplying their own retailer_id
-- alongside someone else's wedding_party_id. RLS is satisfied — the row's
-- own retailer_id really is theirs — and the write lands. The other
-- retailer's organizer and members then read it, because
-- is_wedding_party_organizer_or_member(wedding_party_id) does not check
-- retailer_id either.
--
-- wedding_guest_vouchers makes this a money problem, not only a privacy
-- one: it carries value_minor_units and a funding_source.
--
-- Fixed the way service_memberships already ties itself to service_plans
-- (20260730230000): a composite foreign key on (wedding_party_id,
-- retailer_id) makes a cross-tenant reference impossible in the database,
-- rather than merely discouraged in the application. wedding_parties needs
-- a supporting unique constraint on (id, retailer_id); `id` alone is
-- already the primary key, so this adds no new uniqueness semantics and no
-- new failure mode for legitimate writes.
--
-- All five child tables have wedding_party_id and retailer_id NOT NULL, so
-- the default MATCH SIMPLE semantics enforce on every row; there is no
-- NULL-skips-the-check path here.
--
-- ON DELETE CASCADE is stated explicitly and deliberately: every existing
-- single-column wedding_party_id foreign key on these five tables is
-- already ON DELETE CASCADE. Leaving the composite at the default NO ACTION
-- would make deleting a wedding party depend on two foreign keys with
-- different actions resolving in a particular order. Matching the existing
-- action keeps deletion behaviour exactly as it is today and removes that
-- ambiguity entirely.
--
-- Verified before writing: zero existing rows violate any of these
-- constraints, so this migration cannot fail on legitimate data. If it ever
-- does fail, that failure is the finding.
--
-- SCOPE, STATED HONESTLY: this covers the five child tables named above.
-- `wedding_date_candidates.wedding_party_id` also references
-- wedding_parties and gets no composite key here. It has no client INSERT
-- policy — writes appear to go through a SECURITY DEFINER function, which
-- bypasses RLS by design — so it needs its own review of whether that
-- function re-checks tenancy internally, rather than a foreign key bolted
-- on without understanding the write path. Left to the follow-up tranche.

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
      || 'references public.wedding_parties (id, retailer_id) '
      || 'on delete cascade',
      t, t || '_party_retailer_fkey'
    );
  end loop;
end $$;

comment on constraint wedding_parties_id_retailer_id_key on public.wedding_parties is
  'Supports the composite (wedding_party_id, retailer_id) foreign keys on the wedding-party child tables, which make a cross-tenant attachment impossible at the database level.';
