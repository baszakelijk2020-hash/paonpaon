-- Fixes circular RLS dependency in 20260817000000. The
-- corporate_wearers_manager_select policy inlined a SELECT from
-- corporate_programmes (RLS-protected), and corporate_programmes_manager_select
-- may have been re-triggering policies that look back at corporate_wearers.
-- This creates infinite recursion (Postgres error 42P17) when a manager tries
-- to read wearers.
--
-- Fixed by extracting the cross-table checks into SECURITY DEFINER functions,
-- following the same pattern as 20260725000003 (wedding_party recursion fix)
-- and current_retailer_id() / is_platform_staff().

create or replace function public.is_corporate_manager_with_programme_access(
  p_programme_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.corporate_programmes p
    join public.corporate_managers m on m.account_id = p.account_id
    where p.id = p_programme_id
      and m.id = public.current_corporate_manager_id()
  );
$$;

revoke all on function public.is_corporate_manager_with_programme_access(uuid) from public;
grant execute on function public.is_corporate_manager_with_programme_access(uuid)
  to authenticated, service_role;

-- Drop the recursive policy and replace it with one that calls the helper.
drop policy if exists corporate_wearers_manager_select on public.corporate_wearers;

create policy corporate_wearers_manager_select
  on public.corporate_wearers for select to authenticated using (
    public.is_corporate_manager_with_programme_access(programme_id)
  );
