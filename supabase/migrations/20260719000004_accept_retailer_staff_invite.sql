-- The retailer-side half of onboarding (docs/PRODUCT.md "PAON Admin"
-- creates the tenant and invites the owner; docs/DECISIONS.md ADR-009
-- covers why the auth user is provisioned before the staff row). This
-- function runs once, right after an invited retailer staff member
-- sets their password, for any role — not just the owner — because
-- the same accept-invite step is reused by in-portal staff invites
-- (RetailerStaffRepository.create called from the Retailer Portal
-- itself, not just PAON Admin). A narrow security definer function,
-- not a broadened RLS policy on `retailer_staff_members`/`retailers`,
-- because "a staff member may accept their own invite, once" is a much
-- smaller grant of trust than "a staff member may update their own
-- staff row" or "a retailer owner may update their own retailer row"
-- — see docs/DECISIONS.md ADR-012.

create or replace function public.accept_retailer_staff_invite(
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.retailer_staff_members;
begin
  select * into v_staff
  from public.retailer_staff_members
  where id = p_staff_id
    and deleted_at is null;

  if not found then
    raise exception 'Staff record % not found', p_staff_id;
  end if;

  if v_staff.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to accept invite for staff record %', p_staff_id;
  end if;

  update public.retailer_staff_members
    set accepted_at = coalesce(accepted_at, now())
    where id = p_staff_id;

  -- Only the first accepted owner activates a still-pending tenant —
  -- a later staff member accepting an invite never regresses or
  -- re-triggers this transition.
  if v_staff.role = 'owner' then
    update public.retailers
      set status = 'active'
      where id = v_staff.retailer_id
        and status = 'pending_onboarding';
  end if;
end;
$$;

revoke all on function public.accept_retailer_staff_invite(uuid) from public;
grant execute on function public.accept_retailer_staff_invite(uuid) to authenticated;

comment on function public.accept_retailer_staff_invite(uuid) is
  'Called once by an invited retailer staff member right after they set their password. Marks their staff record accepted; if they are the retailer owner and the retailer is still pending onboarding, activates the retailer.';
