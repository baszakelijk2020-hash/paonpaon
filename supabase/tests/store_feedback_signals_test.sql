begin;
select plan(14);

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

select * from finish();
rollback;
