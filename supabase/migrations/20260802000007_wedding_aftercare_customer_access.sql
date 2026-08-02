-- FT-13 Moonstruck: "delivery and pickup readiness" / aftercare is real
-- schema (wedding_aftercare_plans, from an earlier stage) with only a
-- retailer-staff write policy — no organizer/member could ever read or
-- complete a plan, so the customer-facing half of the journey never
-- existed. Adds read access for the party's own people and a narrow
-- completion RPC (mirrors join_wedding_party/redeem_gift_invitation:
-- re-derive the caller's membership server-side, never trust a client-
-- supplied customer/member id for authorization).

create policy "organizer and members read their party's aftercare plans"
  on public.wedding_aftercare_plans for select
  using (public.is_wedding_party_organizer_or_member(wedding_party_id));

create or replace function public.complete_wedding_aftercare_plan(
  p_plan_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.wedding_aftercare_plans%rowtype;
  v_caller_customer_id uuid;
begin
  select * into v_plan
    from public.wedding_aftercare_plans
    where id = p_plan_id
    for update;
  if not found then
    raise exception 'Aftercare plan not found';
  end if;

  if not public.is_wedding_party_organizer_or_member(v_plan.wedding_party_id) then
    raise exception 'Not authorized for this wedding party';
  end if;

  -- A member-scoped plan can only be completed by that member (or the
  -- organizer, who already coordinates the party); a party-wide plan
  -- (wedding_party_member_id is null) can be completed by any member.
  if v_plan.wedding_party_member_id is not null then
    select customer_id into v_caller_customer_id
      from public.wedding_party_members
      where id = v_plan.wedding_party_member_id;
    if v_caller_customer_id is null or not exists (
      select 1 from public.customers c
      where c.id = v_caller_customer_id and c.user_id = auth.uid()
    ) then
      if not exists (
        select 1 from public.wedding_parties p
        join public.customers c on c.id = p.organizer_customer_id
        where p.id = v_plan.wedding_party_id and c.user_id = auth.uid()
      ) then
        raise exception 'Only the assigned member or the organizer can complete this';
      end if;
    end if;
  end if;

  if v_plan.completed_at is null then
    update public.wedding_aftercare_plans
      set completed_at = now()
      where id = p_plan_id;
  end if;
end;
$$;

revoke all on function public.complete_wedding_aftercare_plan(uuid) from public;
grant execute on function public.complete_wedding_aftercare_plan(uuid)
  to authenticated, service_role;

-- No UPDATE grant here: completion goes only through the RPC above
-- (SECURITY DEFINER, owner-privileged), which re-derives and checks the
-- caller's membership. Granting raw UPDATE without a matching RLS policy
-- would be inert today but is a foot-gun for a future migration that
-- widens RLS without noticing this grant already exists.
grant select on public.wedding_aftercare_plans to authenticated;
