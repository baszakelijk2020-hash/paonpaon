-- CRITICAL FIX: every "append-only" table in stages 11-16 was fully
-- writable. The guarantee those tables were built to provide did not exist.
--
-- What went wrong
-- ---------------
-- Supabase ships a default-privileges rule:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT ALL ON TABLES TO anon, authenticated, service_role;
--
-- Every migration in this programme wrote:
--   revoke all on table X from public, anon;
--   grant insert on table X to authenticated, service_role;
--
-- `revoke ... from public, anon` does NOT revoke from `authenticated` or
-- `service_role`. Those two roles therefore kept the inherited ALL, and the
-- subsequent narrow `grant insert` added nothing they did not already have.
-- The result, verified against the live database before writing this:
--
--   customer_measurement_versions  authenticated  DELETE,INSERT,...,UPDATE
--   customer_measurement_versions  service_role   DELETE,INSERT,...,UPDATE
--   stock_ledger_entries           authenticated  DELETE,INSERT,...,UPDATE
--   ... and the same for every other append-only table.
--
-- Why it mattered, concretely
-- ---------------------------
-- For `authenticated` the exposure was largely (not entirely) masked by RLS,
-- because no UPDATE policy exists on these tables and RLS denies by default.
-- For `service_role` there is no mask at all: service_role BYPASSES RLS. Any
-- code path holding the admin client — and several repositories do — could
-- silently rewrite an approved measurement, edit a stock ledger entry, or
-- restate a revenue share. Those are precisely the three things the schema
-- was written to make impossible.
--
-- It was found by an integration test that tried the UPDATE and expected it
-- to fail. It could never have been found by the `.sql` text-matching tests,
-- which happily confirmed the migration "said" the right thing.
--
-- The fix
-- -------
-- Explicitly revoke UPDATE, DELETE and TRUNCATE from both session roles on
-- every append-only table. INSERT and SELECT stay exactly as granted.
--
-- Note TRUNCATE is revoked too: it is not covered by RLS at all, so a role
-- holding it can empty an append-only table regardless of any policy.

do $$
declare
  t text;
  -- Every table in stages 11-16 whose contract is "a correction is a new
  -- row, never an edit". Grouped by the stage that introduced it.
  append_only text[] := array[
    -- 11.4  a read receipt is a fact, not a mutable flag
    'staff_announcement_acknowledgements',
    -- 12.1  the whole MeasurementMonitor gate rests on this one
    'customer_measurement_versions',
    -- 12.2  history of what was made and what was amended
    'production_spec_amendments',
    'production_stage_events',
    -- 12.3  custody and invoice lines settle disputes; editable ones cannot
    'service_partner_custody_events',
    'service_partner_invoice_lines',
    -- 12.4  a supplier's assertion is a historical statement
    'supplier_facts',
    -- 13.1/13.2/13.3  the ledger is the balance; payments reconcile
    'stock_ledger_entries',
    'rfid_sweep_observations',
    'pos_payments',
    -- 14.1  entitlement versions and issues pin what was drawn
    'corporate_entitlement_versions',
    'corporate_issue_records',
    -- 15.x  attribution, rewards, ad events, releases and money shares
    'network_attribution_events',
    'network_reward_entries',
    'network_pseudonym_map',
    'advertising_events',
    'governed_releases',
    'revenue_share_entries',
    -- 16.x  observations and grades a trainee must be able to rely on
    'academy_roleplay_grades',
    'store_observations',
    'store_comparison_records'
  ];
begin
  foreach t in array append_only loop
    execute format(
      'revoke update, delete, truncate on table public.%I from authenticated',
      t
    );
    execute format(
      'revoke update, delete, truncate on table public.%I from service_role',
      t
    );
    -- anon was already revoked in the original migrations, but repeat it so
    -- this file alone is sufficient to establish the guarantee.
    execute format('revoke all on table public.%I from anon, public', t);
  end loop;
end $$;

-- Belt and braces for the future: stop the same default-privileges rule from
-- silently re-granting ALL on tables created after this point. This does not
-- retroactively change existing tables (the loop above does that) and does
-- not affect tables created by other roles, but it removes the footgun for
-- everything this programme creates from here on.
alter default privileges in schema public
  revoke update, delete, truncate on tables from authenticated;
alter default privileges in schema public
  revoke update, delete, truncate on tables from service_role;

-- Tables that legitimately need UPDATE keep it: they were granted
-- explicitly in their own migrations and are not in the list above. The
-- default-privileges change means those explicit grants now do real work
-- rather than being decorative.
