-- Real gap found while proving PHASE 18.8's employee-facing half in a
-- real browser (docs/PROJECT_STATE.md 2026-08-05): `corporate_exceptions`
-- got a wearer-scoped INSERT policy (`corporate_exceptions_wearer_insert`,
-- 20260804190000) so a wearer can raise their own service-desk ticket
-- directly from the Employee Portal, but `CorporateRepository
-- .createException` always writes both the exception row and its
-- `created` audit event in the same call — never one without the other
-- — and `corporate_exception_events` only ever got a staff-scoped INSERT
-- policy. A wearer's own ticket-creation call correctly inserted the
-- exception row, then failed on the audit event with a plain RLS
-- permission-denied, leaving no ticket behind at all (the whole
-- Server Action call throws, and this codebase never writes half of a
-- create-plus-audit pair — see the migration's own header comment for
-- why that pairing exists).
create policy corporate_exception_events_wearer_insert
  on public.corporate_exception_events for insert to authenticated with check (
    exception_id in (
      select id from public.corporate_exceptions
      where wearer_id = public.current_wearer_id()
    )
  );
