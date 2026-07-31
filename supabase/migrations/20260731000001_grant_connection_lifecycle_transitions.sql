-- Fixes a real defect found by this branch's own e2e proof
-- (integration-connection-lifecycle.spec.ts), not a design change: the
-- retailer-facing pause/resume/disconnect Server Action
-- (apps/retailer/app/(dashboard)/settings/integrations/actions.ts) runs
-- under the session-scoped anon-key client, but
-- 20260731000000_add_integration_connection_lifecycle.sql never granted
-- `authenticated` write access to integration_connections at all — only
-- `service_role` could write it, inherited from 20260730300000's original
-- grant. The retailer's own "Pause" button therefore hit a silent
-- permission-denied Postgres error and never actually transitioned the row,
-- while the UI still rendered as if nothing had happened.
--
-- Grants column-scoped UPDATE — the four operational_state* columns plus
-- updated_at (IntegrationLifecycleRepository.transitionConnection touches
-- that bookkeeping column on every write) — so a retailer operator can
-- pause/resume/disconnect their own connection but can never touch
-- health_status, display_name, or anything else on this row through this
-- path. health_status stays writable only by service_role, since it
-- represents observed reality a retailer cannot self-report.
grant update (
  operational_state,
  operational_state_reason,
  operational_state_changed_at,
  operational_state_changed_by,
  updated_at
) on table public.integration_connections to authenticated;

create policy integration_connections_retailer_transition
  on public.integration_connections for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  )
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in ('owner', 'manager', 'admin')
  );
