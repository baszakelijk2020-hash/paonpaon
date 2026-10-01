-- Tailoring party attendance (founder direction 2026-09-30).
--
-- A guest can say they will not make the group fitting, and that they have
-- booked a fitting of their own instead; the organizer sees it in the
-- party's status column. Guests usually have no account, so the change goes
-- through one narrow security-definer function keyed by the party's invite
-- token plus the guest's own member id (returned to them when they joined),
-- the same boundary as join_wedding_party (ADR-034).
--
-- Re-runnable: it may be applied by hand to a local database first.

alter table public.wedding_party_members
  add column if not exists attendance text not null default 'attending';

alter table public.wedding_party_members
  drop constraint if exists wedding_party_members_attendance_chk;
alter table public.wedding_party_members
  add constraint wedding_party_members_attendance_chk
  check (attendance in ('attending', 'declined', 'rebooked'));

comment on column public.wedding_party_members.attendance is
  'attending (default) | declined (will not make the group fitting) | rebooked (booked a fitting of their own)';

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
  v_party_id uuid;
begin
  if p_attendance is null
    or p_attendance not in ('attending', 'declined', 'rebooked')
  then
    raise exception 'Unknown attendance';
  end if;

  select p.id into v_party_id
  from public.wedding_parties p
  where p.invite_token = p_invite_token
    and p.deleted_at is null
    and p.status <> 'cancelled';
  if v_party_id is null then
    raise exception 'Invite link is no longer valid';
  end if;

  update public.wedding_party_members m
  set attendance = p_attendance,
      updated_at = now()
  where m.id = p_member_id
    and m.wedding_party_id = v_party_id
    and m.deleted_at is null;
  if not found then
    raise exception 'You are not in this party';
  end if;
end;
$$;

revoke all on function public.set_wedding_party_member_attendance(uuid, uuid, text)
  from public;
grant execute on function public.set_wedding_party_member_attendance(uuid, uuid, text)
  to anon, authenticated, service_role;
