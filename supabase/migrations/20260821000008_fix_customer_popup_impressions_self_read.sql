-- getProactiveNudge (apps/customer/app/r/[slug]/proactive-nudge-actions.ts)
-- checks customer_popup_impressions for the 24h frequency cap using the
-- RLS-scoped, customer-authenticated client -- but this table only ever
-- had SELECT policies for platform staff and retailer managers. Every
-- real customer's first read hit "permission denied for table
-- customer_popup_impressions", silently swallowed by the action's
-- best-effort catch, so the nudge always returned null regardless of
-- how much real signal existed. Confirmed via full internal trace
-- logging against a real logged-in customer session.
--
-- Same established pattern as "customers read own consent events" in
-- 20260730130000_add_consent_and_interaction_events.sql.
--
-- The original create-table migration never granted SELECT to
-- `authenticated` at all (only to service_role implicitly via
-- superuser) -- RLS policies are moot without the underlying table
-- grant, so this was blocking every reader, not just customers.

grant select on public.customer_popup_impressions to authenticated;

create policy "customers read own popup impressions"
  on public.customer_popup_impressions for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_popup_impressions.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );
