begin;
select plan(26);

select has_table('public', 'store_feedback_signals', 'feedback signals are persisted separately from anonymous observations');
select col_is_null('public', 'store_feedback_signals', 'customer_id', 'garment-only feedback is allowed');
select col_not_null('public', 'store_feedback_signals', 'retailer_id', 'feedback belongs to a tenant');
select col_not_null('public', 'store_feedback_signals', 'idempotency_key', 'capture is idempotent');
select col_is_null('public', 'store_feedback_signals', 'corrects_signal_id', 'a replacement may link its corrected predecessor');
select col_is_null('public', 'store_feedback_signals', 'acknowledged_at', 'new feedback remains open until leadership follows up');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'store_feedback_signals' and column_name = 'staff_id'), 'no employee identity is persisted');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'store_feedback_signals' and column_name = 'created_by_user_id'), 'no auth user identity is persisted');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'store_feedback_signals' and column_name = 'biometric_template'), 'no biometric field is persisted');
select ok(not has_table_privilege('authenticated', 'public.store_feedback_signals', 'INSERT'), 'sales staff cannot bypass the capture RPC');
select ok(position('personalization_opt_in' in pg_get_functiondef('public.capture_store_feedback_signal(uuid,text,text,text,text)'::regprocedure)) > 0, 'named feedback requires recorded personalization consent');
select ok(position('idempotency_key' in pg_get_functiondef('public.capture_store_feedback_signal(uuid,text,text,text,text)'::regprocedure)) > 0, 'same idempotency request returns the stored signal');
select ok(position('corrects_signal_id' in pg_get_functiondef('public.correct_store_feedback_signal(uuid,uuid,text,text,text,text)'::regprocedure)) > 0, 'correction creates traceable lineage');
select ok(position('current_retailer_role' in pg_get_functiondef('public.acknowledge_store_feedback_signal(uuid,text)'::regprocedure)) > 0, 'acknowledgement is leadership-gated');

insert into public.retailers (id, legal_name, display_name, slug, status)
values (
  'fb000000-0000-0000-0000-000000000001', 'Feedback Test A Ltd',
  'Feedback Test A', 'feedback-test-a', 'active'
), (
  'fb000000-0000-0000-0000-000000000002', 'Feedback Test B Ltd',
  'Feedback Test B', 'feedback-test-b', 'active'
);

insert into public.customers (id, retailer_id, full_name, email)
values (
  'fb000000-0000-0000-0000-000000000003', 'fb000000-0000-0000-0000-000000000001',
  'Consented Feedback Client', 'consented-feedback@example.test'
), (
  'fb000000-0000-0000-0000-000000000004', 'fb000000-0000-0000-0000-000000000002',
  'Foreign Feedback Client', 'foreign-feedback@example.test'
), (
  'fb000000-0000-0000-0000-000000000007', 'fb000000-0000-0000-0000-000000000001',
  'Unconsented Feedback Client', 'unconsented-feedback@example.test'
);

insert into public.customer_preferences (customer_id, personalization_opt_in)
values ('fb000000-0000-0000-0000-000000000003', true);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fb000000-0000-0000-0000-000000000005",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fb000000-0000-0000-0000-000000000001",
    "retailer_role": "sales_associate"
  }
}';

select isnt(
  (select (public.capture_store_feedback_signal(
    'fb000000-0000-0000-0000-000000000003', null, 'buying',
    'Several clients asked for lighter canvassing.', 'feedback-capture-1'
  )).id),
  null,
  'sales associate can capture consented customer feedback'
);

select is(
  (select (public.capture_store_feedback_signal(
    'fb000000-0000-0000-0000-000000000003', null, 'buying',
    'Several clients asked for lighter canvassing.', 'feedback-capture-1'
  )).id),
  (select (public.capture_store_feedback_signal(
    'fb000000-0000-0000-0000-000000000003', null, 'buying',
    'Several clients asked for lighter canvassing.', 'feedback-capture-1'
  )).id),
  'capture retry returns the original signal'
);

select is(
  (select count(*)::int from public.store_feedback_signals), 0,
  'sales associate cannot read the leadership queue'
);

select throws_ok(
  $$
    select public.capture_store_feedback_signal(
      'fb000000-0000-0000-0000-000000000007', null, 'buying',
      'Named context without consent must not persist.', 'feedback-unconsented-1'
    )
  $$,
  'P0001',
  'Customer personalization consent is required',
  'named feedback is denied without active personalization consent'
);

select throws_ok(
  $$
    select public.capture_store_feedback_signal(
      'fb000000-0000-0000-0000-000000000004', null, 'buying',
      'Foreign customer context must not persist.', 'feedback-foreign-1'
    )
  $$,
  'P0001',
  'Customer unavailable',
  'sales associate cannot capture feedback for another tenant customer'
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fb000000-0000-0000-0000-000000000006",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fb000000-0000-0000-0000-000000000001",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.store_feedback_signals where idempotency_key = 'feedback-capture-1'), 1,
  'manager can read their tenant leadership queue'
);

select throws_ok(
  $$
    select public.correct_store_feedback_signal(
      (select id from public.store_feedback_signals where idempotency_key = 'feedback-capture-1'),
      'fb000000-0000-0000-0000-000000000003', null, 'buying',
      'Corrected feedback still asks for lighter canvassing.', 'feedback-capture-1'
    )
  $$,
  'P0001',
  'Idempotency key was already used for another feedback signal',
  'correction rejects an idempotency key already bound to a signal'
);

select isnt(
  (select (public.correct_store_feedback_signal(
    (select id from public.store_feedback_signals where idempotency_key = 'feedback-capture-1'),
    'fb000000-0000-0000-0000-000000000003', null, 'buying',
    'Corrected feedback still asks for lighter canvassing.', 'feedback-correction-1'
  )).id),
  (select id from public.store_feedback_signals where idempotency_key = 'feedback-capture-1'),
  'correction creates a distinct replacement signal'
);

select is(
  (select status from public.store_feedback_signals where idempotency_key = 'feedback-capture-1'), 'corrected',
  'correction preserves the original signal as corrected'
);

select isnt(
  (select (public.acknowledge_store_feedback_signal(
    (select id from public.store_feedback_signals where idempotency_key = 'feedback-correction-1'),
    'Buying will review the lighter construction request.'
  )).acknowledged_at),
  null,
  'manager can acknowledge their tenant feedback with a follow-up note'
);

select set_config(
  'test.store_feedback_signal_id',
  (select id::text from public.store_feedback_signals where idempotency_key = 'feedback-correction-1'),
  true
);

set local role none;
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "fb000000-0000-0000-0000-000000000008",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "fb000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select is(
  (select count(*)::int from public.store_feedback_signals), 0,
  'another tenant manager cannot read the feedback queue'
);

select throws_ok(
  $$
    select public.acknowledge_store_feedback_signal(
      current_setting('test.store_feedback_signal_id')::uuid, 'Foreign acknowledgement attempt.'
    )
  $$,
  'P0001',
  'Feedback signal unavailable',
  'another tenant manager cannot acknowledge a feedback signal'
);

select * from finish();
rollback;
