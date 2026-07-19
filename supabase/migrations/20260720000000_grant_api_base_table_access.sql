-- PostgREST requires SQL privileges in addition to RLS policies. The local
-- stack's default privileges intentionally do not grant DML on newly created
-- tables, so grant it explicitly for base tables. RLS remains the authority
-- for anon/authenticated access; service_role bypasses RLS for trusted server
-- and test-fixture operations.
--
-- Views are deliberately excluded. Sensitive worker/customer projections in
-- 20260719000103 grant SELECT individually and must never inherit write access.
do $$
declare
  relation record;
begin
  for relation in
    select namespace.nspname as schema_name, class.relname as relation_name
    from pg_class as class
    join pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind in ('r', 'p')
  loop
    execute format(
      'grant select, insert, update, delete on table %I.%I to anon, authenticated, service_role',
      relation.schema_name,
      relation.relation_name
    );
  end loop;
end
$$;

