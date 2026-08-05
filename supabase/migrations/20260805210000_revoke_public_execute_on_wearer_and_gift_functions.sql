-- Real gap found while investigating a pgTAP failure (this project's own
-- ongoing invariant check: "no public SECURITY DEFINER function is
-- executable by PUBLIC"). Postgres grants EXECUTE to PUBLIC by default on
-- function creation; this codebase's own convention everywhere else is to
-- explicitly `revoke all ... from public` before granting to specific
-- roles. Three SECURITY DEFINER functions missed that step:
--
-- - `current_wearer_id()` (20260804160000): low practical exposure (it
--   only ever returns the caller's own wearer id via auth.uid(), null for
--   anon), but it is an internal helper meant to be called the same way
--   current_retailer_id() is, not a public API surface.
-- - `sync_corporate_wearer_claim()` (20260804160000): a trigger function.
--   Trigger firing does not require the triggering role to hold EXECUTE
--   on the function, so revoking PUBLIC here does not affect the trigger
--   itself, only direct SQL calls.
-- - `enqueue_gift_invitation_email(uuid, text)` (20260802000016): already
--   internally re-derives retailer-manager authorization and re-checks
--   the caller server-side, so this was not a real privilege-escalation
--   path in practice, but the explicit revoke/grant pattern is the
--   project's own stated defense-in-depth convention and was simply
--   missed in that migration.
revoke all on function public.current_wearer_id() from public;
grant execute on function public.current_wearer_id() to authenticated;

revoke all on function public.sync_corporate_wearer_claim() from public;

revoke all on function public.enqueue_gift_invitation_email(uuid, text) from public;
grant execute on function public.enqueue_gift_invitation_email(uuid, text)
  to authenticated;
