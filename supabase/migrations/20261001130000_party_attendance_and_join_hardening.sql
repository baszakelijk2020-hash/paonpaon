-- set_wedding_party_member_attendance() trusted the invite token plus a
-- member id. Member ids are shown on the party roster, so any member could
-- change any other member's attendance. Now:
--   * a signed-in caller may set only their own attendance, or anyone's if
--     they organize the party;
--   * a caller without a session (a guest who just joined from the link)
--     may set only a member that joined in the last day and is not linked
--     to an account — the one the join response handed back.

create or replace function public.set_wedding_party_member_attendance(
  p_invite_token uuid,
  p_member_id uuid,
  p_attendance text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.wedding_parties%rowtype;
  v_member_user uuid;
  v_member_created timestamptz;
  v_caller uuid := auth.uid();
  v_is_organizer boolean;
begin
  if p_attendance is null
    or p_attendance not in ('attending', 'declined', 'rebooked')
  then
    raise exception 'Unknown attendance';
  end if;

  select * into v_party
    from public.wedding_parties p
    where p.invite_token = p_invite_token
      and p.deleted_at is null
      and p.status <> 'cancelled';
  if not found then
    raise exception 'Invite link is no longer valid';
  end if;

  select c.user_id, m.created_at into v_member_user, v_member_created
    from public.wedding_party_members m
    join public.customers c on c.id = m.customer_id
    where m.id = p_member_id
      and m.wedding_party_id = v_party.id
      and m.deleted_at is null;
  if not found then
    raise exception 'You are not in this party';
  end if;

  if v_caller is not null then
    select exists (
      select 1 from public.customers c
        where c.id = v_party.organizer_customer_id
          and c.user_id = v_caller
    ) into v_is_organizer;
    if not v_is_organizer and v_member_user is distinct from v_caller then
      raise exception 'You are not in this party';
    end if;
  elsif v_member_user is not null
    or v_member_created < now() - interval '1 day'
  then
    raise exception 'Sign in to change your attendance';
  end if;

  update public.wedding_party_members
    set attendance = p_attendance,
        updated_at = now()
    where id = p_member_id;
end;
$$;

revoke all on function public.set_wedding_party_member_attendance(uuid, uuid, text)
  from public;
grant execute on function public.set_wedding_party_member_attendance(uuid, uuid, text)
  to anon, authenticated, service_role;
