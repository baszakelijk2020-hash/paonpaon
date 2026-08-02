-- FT-13 Moonstruck groom/best-men planner — wiring `wedding_design_choices`
-- (schema already existed since 20260801000014, unwired). A member records
-- their own outfit choice for a slot (e.g. tie color); the organizer can
-- also set a party-wide "coordinated" choice (member id null). No
-- vocabulary for slot_key/value_key is specified anywhere in the founder
-- source or blueprints, so both stay free text at the UI layer rather than
-- inventing an unspecified taxonomy.

-- Defense-in-depth backstop for "at most one choice per slot" — the RPC
-- below already enforces this behaviorally via select-for-update, but a
-- concurrent race could still double-insert without a DB-level constraint
-- (same idiom as one_default_wishlist_per_customer_idx).
create unique index wedding_design_choice_member_slot_idx
  on public.wedding_design_choices (wedding_party_id, wedding_party_member_id, slot_key)
  where wedding_party_member_id is not null;
create unique index wedding_design_choice_party_slot_idx
  on public.wedding_design_choices (wedding_party_id, slot_key)
  where wedding_party_member_id is null;

create policy "organizer and members read their party's design choices"
  on public.wedding_design_choices for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));

create or replace function public.set_wedding_design_choice(
  p_wedding_party_id uuid,
  p_slot_key text,
  p_value_key text,
  p_wedding_party_member_id uuid default null,
  p_coordinated boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer_id uuid;
  v_existing_id uuid;
  v_id uuid;
  v_is_organizer boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_coordinated and p_wedding_party_member_id is not null then
    raise exception 'A coordinated choice must be party-wide';
  end if;

  select exists (
    select 1 from public.wedding_parties p
    join public.customers c on c.id = p.organizer_customer_id
    where p.id = p_wedding_party_id and c.user_id = auth.uid()
  ) into v_is_organizer;

  if p_wedding_party_member_id is not null then
    if not v_is_organizer and not exists (
      select 1 from public.wedding_party_members m
      join public.customers c on c.id = m.customer_id
      where m.id = p_wedding_party_member_id
        and m.wedding_party_id = p_wedding_party_id
        and c.user_id = auth.uid()
    ) then
      raise exception 'Not authorized for this member';
    end if;
  else
    if not v_is_organizer then
      raise exception 'Only the organizer can set a party-wide choice';
    end if;
  end if;

  select retailer_id into v_retailer_id
    from public.wedding_parties where id = p_wedding_party_id;

  select id into v_existing_id from public.wedding_design_choices
    where wedding_party_id = p_wedding_party_id
      and slot_key = p_slot_key
      and wedding_party_member_id is not distinct from p_wedding_party_member_id
    for update;

  if v_existing_id is not null then
    update public.wedding_design_choices
      set value_key = p_value_key, coordinated = p_coordinated, updated_at = now()
      where id = v_existing_id;
    return v_existing_id;
  end if;

  insert into public.wedding_design_choices
    (retailer_id, wedding_party_id, wedding_party_member_id, slot_key, value_key, coordinated)
    values (v_retailer_id, p_wedding_party_id, p_wedding_party_member_id, p_slot_key, p_value_key, p_coordinated)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_wedding_design_choice(uuid, text, text, uuid, boolean) from public;
grant execute on function public.set_wedding_design_choice(uuid, text, text, uuid, boolean)
  to authenticated, service_role;
