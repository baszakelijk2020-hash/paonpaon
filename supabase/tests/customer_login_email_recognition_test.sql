begin;
select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.auth_email_recognition_rate_limits'::regclass),
  'recognition rate limits have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.auth_email_recognition_rate_limits', 'select'), 'anon cannot read recognition limits');
select ok(not has_table_privilege('authenticated', 'public.auth_email_recognition_rate_limits', 'insert'), 'authenticated cannot write recognition limits');
select ok(not has_function_privilege('anon', 'public.recognize_customer_login_email(text,text,text,text)', 'execute'), 'anon cannot call recognition RPC');
select ok(has_function_privilege('service_role', 'public.recognize_customer_login_email(text,text,text,text)', 'execute'), 'service role can call recognition RPC');
select is(
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'auth_email_recognition_rate_limits'),
  'attempts,key_hash,scope,window_started_at',
  'rate limits retain hashes only, never raw email or IP'
);

set local role service_role;
select is(
  (public.recognize_customer_login_email('new@example.test', repeat('a', 64), repeat('b', 64), repeat('c', 64))->>'allowed')::boolean,
  true,
  'the first recognition attempt is allowed'
);
select is(
  (public.recognize_customer_login_email('new@example.test', repeat('a', 64), repeat('b', 64), repeat('c', 64))->>'existing')::boolean,
  false,
  'recognition returns only the existing boolean after an allowed request'
);
do $$
begin
  for i in 1..8 loop
    perform public.recognize_customer_login_email(
      'pair@example.test', repeat('d', 64), repeat('e', 64), repeat('f', 64)
    );
  end loop;
end;
$$;
select is(
  (public.recognize_customer_login_email('pair@example.test', repeat('d', 64), repeat('e', 64), repeat('f', 64))->>'allowed')::boolean,
  false,
  'the ninth request for one IP/email pair is denied'
);

select * from finish();
rollback;

