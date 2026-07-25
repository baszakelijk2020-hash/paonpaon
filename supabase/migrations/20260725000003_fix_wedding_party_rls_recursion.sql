-- wedding_parties' "organizer and members read their wedding party" policy
-- inlined a lookup against wedding_party_members, and
-- wedding_party_members' "organizer and members read the roster" policy
-- inlined a lookup against wedding_parties — both tables are RLS-protected,
-- so reading either one re-triggers the other's policy, which re-triggers
-- the first: infinite recursion (Postgres error 42P17), only surfaced now
-- because Phase 4 (AM House Party coordination) is the first code path to
-- actually read wedding_parties as an organizer/member rather than staff.
--
-- Fixed the same way current_retailer_id()/is_platform_staff() avoid this
-- class of bug: move the cross-table check into a stable SECURITY DEFINER
-- function. Owned by the migration role (which owns both tables), its
-- internal lookups run with row security bypassed instead of re-entering
-- the calling policy.
create or replace function public.is_wedding_party_organizer_or_member(
  p_wedding_party_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_parties p
    join public.customers oc on oc.id = p.organizer_customer_id
    where p.id = p_wedding_party_id and oc.user_id = auth.uid()
  )
  or exists (
    select 1 from public.wedding_party_members m
    join public.customers c on c.id = m.customer_id
    where m.wedding_party_id = p_wedding_party_id and c.user_id = auth.uid()
  );
$$;

revoke all on function public.is_wedding_party_organizer_or_member(uuid) from public;
grant execute on function public.is_wedding_party_organizer_or_member(uuid)
  to authenticated, service_role;

drop policy "organizer and members read their wedding party" on public.wedding_parties;
create policy "organizer and members read their wedding party" on public.wedding_parties
  for select using (
    public.is_wedding_party_organizer_or_member(id)
  );

drop policy "organizer and members read the roster" on public.wedding_party_members;
create policy "organizer and members read the roster" on public.wedding_party_members
  for select using (
    public.is_wedding_party_organizer_or_member(wedding_party_id)
  );
