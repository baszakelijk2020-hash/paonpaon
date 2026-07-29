-- Consent / interaction-event foundation (PHASE 3.1).

begin;
select plan(8);

select has_table('public', 'customer_consent_events',
  'consent history table exists');

select has_column('public', 'customer_preferences', 'personalization_opt_in',
  'personalization consent column exists');

select has_column('public', 'customer_preferences', 'location_opt_in',
  'location consent column exists');

select has_column('public', 'behavioral_events', 'consent_snapshot',
  'behavioral events store consent snapshots');

select has_column('public', 'behavioral_events', 'retention_expires_at',
  'behavioral events store retention expiry');

select has_column('public', 'behavioral_events', 'anonymous_session_id',
  'behavioral events support anonymous session ids');

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'set_customer_consent'
  ),
  'set_customer_consent RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'anonymize_behavioral_events_for_customer'
  ),
  'withdrawal anonymization RPC exists'
);

select * from finish();
rollback;
