-- Fix: retailer onboarding fails 100% of the time with
-- "permission denied for table retailer_virtual_try_on_policies".
--
-- Root cause: ensure_default_retailer_virtual_try_on_policy() (added in
-- 20260809170000_add_virtual_try_on_usage_ledger.sql) is an AFTER INSERT
-- trigger on public.retailers that inserts a default row into
-- public.retailer_virtual_try_on_policies. That function has no SECURITY
-- DEFINER, so it runs as the calling role. The same migration grants only
-- select/update on retailer_virtual_try_on_policies to non-service-role
-- sessions (insert is service_role-only), so the trigger's insert is
-- rejected (42501) whenever a retailer is created by anything other than
-- the service-role client -- including the admin app's createRetailer
-- Server Action, which uses the authenticated-session client.
--
-- Fix: mark the trigger function SECURITY DEFINER so it runs with the
-- privileges of its owner (bypassing the grant gap) regardless of caller.
-- search_path is already pinned to '' and all references are
-- fully-qualified, so this is not exposed to search-path hijacking.
-- (Note: the sibling ensure_default_retailer_visual_preset trigger does
-- NOT use SECURITY DEFINER and was not touched here -- if it works today
-- it's relying on default table privileges rather than this pattern; out
-- of scope for this fix, which only addresses the confirmed onboarding
-- blocker.)

create or replace function public.ensure_default_retailer_virtual_try_on_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.retailer_virtual_try_on_policies (retailer_id, currency)
  values (new.id, new.default_currency)
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.ensure_default_retailer_virtual_try_on_policy()
  from public;
