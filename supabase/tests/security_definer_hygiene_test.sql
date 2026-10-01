begin;
select plan(7);

-- Every elevated function pins its search path.
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) c
        where c like 'search_path=%'
      )
  ),
  0::bigint,
  'every SECURITY DEFINER function in public pins search_path'
);

-- A path that names public searches temporary tables last.
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and exists (
        select 1 from unnest(p.proconfig) c
        where c like 'search_path=%'
          and c not in ('search_path=""', 'search_path=')
          and c !~ 'pg_temp'
      )
  ),
  0::bigint,
  'every SECURITY DEFINER search_path naming public puts pg_temp last'
);

-- Nothing elevated is executable by PUBLIC.
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('public', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'no SECURITY DEFINER function in public is executable by PUBLIC'
);

-- Closure notes are staff-only.
select ok(
  not has_table_privilege('anon', 'public.appointment_closures', 'SELECT'),
  'anon cannot read appointment closures'
);

-- Server-only jobs are not callable by signed-in users.
select ok(
  not has_function_privilege('authenticated', 'public.claim_pending_emails(integer)', 'EXECUTE'),
  'a signed-in user cannot claim the outgoing email queue'
);
select ok(
  not has_function_privilege('authenticated', 'public.recognize_customer_login_email(text,text,text,text)', 'EXECUTE'),
  'a signed-in user cannot probe which emails have accounts'
);
select ok(
  not has_function_privilege('anon', 'public.cancel_my_appointment(uuid,text)', 'EXECUTE'),
  'a logged-out caller cannot reach customer-only commands'
);

select * from finish();
rollback;
