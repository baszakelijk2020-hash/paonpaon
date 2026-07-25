-- The schema wipe that predated this migration chain's rebuild
-- (`DROP SCHEMA public CASCADE`, confirmed via information_schema before
-- this fix) removed the baseline `USAGE ON SCHEMA public` grant Supabase
-- sets up at project creation — something no prior migration here ever
-- needed to touch, since it was already in place. Recreating tables via
-- migrations restores table-level grants (20260720000000's loop) but not
-- this schema-level one, so every anon/authenticated request failed with
-- "permission denied for schema public" even though RLS and table grants
-- were both correct.
grant usage on schema public to anon, authenticated, service_role;
