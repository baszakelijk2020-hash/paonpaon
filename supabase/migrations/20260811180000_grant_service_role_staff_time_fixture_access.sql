-- Trusted service-role automation seeds and removes staff time entries for
-- local integration proof. Browser callers remain limited to the clock RPCs
-- and authenticated RLS policies from the original roster migration.
grant select, insert, update, delete on public.staff_time_entries to service_role;
