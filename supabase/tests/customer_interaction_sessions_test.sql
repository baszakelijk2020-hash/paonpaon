-- Customer interaction sessions (PHASE 7.2).

begin;
select plan(6);

select has_table('public', 'customer_interaction_sessions',
  'interaction session table exists');

select has_column('public', 'behavioral_events', 'session_id',
  'behavioral events link to interaction sessions');

select has_column('public', 'behavioral_events', 'idempotency_key',
  'behavioral events support idempotency keys');

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'start_customer_interaction_session'
  ),
  'start_customer_interaction_session RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'heartbeat_customer_interaction_session'
  ),
  'heartbeat_customer_interaction_session RPC exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'end_customer_interaction_session'
  ),
  'end_customer_interaction_session RPC exists'
);

select * from finish();
rollback;
