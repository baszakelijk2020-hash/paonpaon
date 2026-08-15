-- `audit_log_entries` describes itself as "Immutable audit history for
-- sensitive alteration pricing, task, handoff, release, completion and
-- cancellation changes." That guarantee did not exist.
--
-- Verified against the live database before writing this:
--
--   audit_log_entries  anon           DELETE,INSERT,...,TRUNCATE,UPDATE
--   audit_log_entries  authenticated  DELETE,INSERT,...,TRUNCATE,UPDATE
--   audit_log_entries  service_role   DELETE,INSERT,...,TRUNCATE,UPDATE
--
-- This is exactly the defect 20260801000016_enforce_append_only_grants.sql
-- was written to fix — Supabase's default privileges grant ALL on new tables
-- to anon, authenticated and service_role, and the usual
-- `revoke all ... from public, anon` does not touch authenticated or
-- service_role. That migration enumerated the append-only tables of stages
-- 11-16 and revoked UPDATE/DELETE/TRUNCATE explicitly. `audit_log_entries`
-- was not in its list.
--
-- Why it matters here specifically:
--
--   * `service_role` BYPASSES RLS entirely. Any code path holding the admin
--     client could rewrite or delete audit rows with nothing in the way.
--   * TRUNCATE is not governed by RLS AT ALL. So even `authenticated` and
--     `anon`, whose reads and writes are otherwise masked by the fact that
--     this table has only SELECT policies, could empty the entire audit
--     ledger in one statement. An audit trail that its own subjects can
--     erase is not an audit trail.
--
-- Confirmed before revoking: the table has no INSERT, UPDATE or DELETE
-- policy (only two SELECT policies, for retailer management and platform
-- staff), and no application code issues an UPDATE, DELETE or TRUNCATE
-- against it. Writes arrive through SECURITY DEFINER functions, which run as
-- the function owner and are unaffected by these grants. Revoking therefore
-- removes only unused, dangerous privilege.
--
-- INSERT and SELECT are deliberately left exactly as they are.

revoke update, delete, truncate on table public.audit_log_entries
  from anon, authenticated, service_role;

-- anon has no legitimate business with the audit ledger at all: both SELECT
-- policies require a retailer-management or platform-staff session.
revoke all on table public.audit_log_entries from anon;
