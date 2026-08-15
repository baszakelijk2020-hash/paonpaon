-- Proof for 20260815000070: the audit ledger is append-only at the GRANT
-- layer, not merely behind RLS.
--
-- The distinction is the whole point. RLS masked the exposure for
-- `authenticated` (the table has only SELECT policies, so writes were denied
-- by default) but masked nothing for `service_role`, which bypasses RLS
-- outright — and masked nothing at all for TRUNCATE, which RLS does not
-- govern for any role. A privilege check is therefore the only honest test
-- here; a behavioural INSERT/UPDATE attempt under RLS would have passed
-- while the hole was wide open.

begin;
select plan(6);

select is(
  has_table_privilege('service_role', 'public.audit_log_entries', 'UPDATE'),
  false,
  'service_role cannot UPDATE the audit ledger — it bypasses RLS, so only the grant stops it'
);

select is(
  has_table_privilege('service_role', 'public.audit_log_entries', 'DELETE'),
  false,
  'service_role cannot DELETE audit rows'
);

select is(
  has_table_privilege('service_role', 'public.audit_log_entries', 'TRUNCATE'),
  false,
  'service_role cannot TRUNCATE the audit ledger'
);

select is(
  has_table_privilege('authenticated', 'public.audit_log_entries', 'TRUNCATE'),
  false,
  'authenticated cannot TRUNCATE the audit ledger — RLS never governed TRUNCATE'
);

select is(
  has_table_privilege('anon', 'public.audit_log_entries', 'SELECT'),
  false,
  'anon holds no privilege on the audit ledger at all'
);

-- The guarantee must not be bought by breaking the writers. Inserting is how
-- the ledger is populated, by SECURITY DEFINER functions and the service
-- role, and that must still work.
select is(
  has_table_privilege('service_role', 'public.audit_log_entries', 'INSERT'),
  true,
  'service_role can still INSERT — the ledger is append-only, not read-only'
);

select * from finish();
rollback;
