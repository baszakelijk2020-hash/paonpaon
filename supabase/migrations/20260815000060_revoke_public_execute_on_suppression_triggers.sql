-- Restore the "no SECURITY DEFINER function is executable by PUBLIC"
-- invariant, which `supabase/tests/stock_tenant_boundaries_test.sql` asserts
-- and which has been failing on main since
-- 20260814010000_add_messaging_opt_out_and_failure_suppression.sql landed.
--
-- Two functions were created SECURITY DEFINER without the accompanying
-- `revoke execute ... from public` that every other SECURITY DEFINER function
-- in this schema carries:
--
--   suppress_customer_email_on_terminal_failure()
--   suppress_customer_sms_on_terminal_failure()
--
-- Severity, stated honestly rather than inflated: both are trigger functions
-- — no arguments, `returns trigger`, attached to AFTER UPDATE triggers on
-- email_outbox and sms_outbox. PostgreSQL refuses to execute a trigger
-- function called directly ("trigger functions can only be called as
-- triggers"), so a PUBLIC grant here is not a usable escalation path today.
-- It is a broken invariant rather than a live hole.
--
-- It is still worth closing, for two reasons. The invariant is what makes
-- "no SECURITY DEFINER is PUBLIC-executable" checkable at all — one standing
-- exception turns a bright-line test into a judgement call, and the next
-- function added without a revoke would hide behind the same red test. And
-- if either function were ever rewritten to take arguments or return
-- non-trigger, the grant would silently become exploitable with no new
-- review.
--
-- Revoking EXECUTE does not affect trigger firing: triggers run with the
-- privileges of the table owner regardless of who holds EXECUTE on the
-- function. Behaviour is unchanged; only the redundant grant is removed.

revoke execute on function public.suppress_customer_email_on_terminal_failure()
  from public;
revoke execute on function public.suppress_customer_sms_on_terminal_failure()
  from public;
