-- These functions are internal RLS/trigger helpers. PostgreSQL grants
-- EXECUTE to PUBLIC by default, which would expose their SECURITY DEFINER
-- privileges to unauthenticated callers.
revoke all on function public.current_corporate_manager_id() from public;
revoke all on function public.sync_corporate_manager_claim() from public;

-- The RLS policies invoke the current-manager lookup on behalf of an
-- authenticated customer. Grant only that application role, never PUBLIC.
grant execute on function public.current_corporate_manager_id() to authenticated;
