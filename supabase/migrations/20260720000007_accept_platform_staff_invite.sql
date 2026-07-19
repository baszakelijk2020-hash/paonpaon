alter table public.platform_staff_members
  add column invited_at timestamptz not null default now(),
  add column accepted_at timestamptz;

-- Existing platform operators predate the acceptance flow and are already active.
update public.platform_staff_members set accepted_at = created_at;

create or replace function public.accept_platform_staff_invite(p_staff_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted_at timestamptz;
begin
  update public.platform_staff_members
  set accepted_at = coalesce(accepted_at, now())
  where id = p_staff_id
    and user_id = auth.uid()
    and deleted_at is null
  returning accepted_at into v_accepted_at;

  if v_accepted_at is null then
    raise exception 'No pending platform staff invitation found';
  end if;
  return v_accepted_at;
end;
$$;

revoke all on function public.accept_platform_staff_invite(uuid) from public;
grant execute on function public.accept_platform_staff_invite(uuid) to authenticated;
