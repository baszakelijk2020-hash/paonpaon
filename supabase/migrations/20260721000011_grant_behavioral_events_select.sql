-- `behavioral_events` (20260720000005) was created after the blanket
-- PostgREST grant (20260720000000) and never got its own — the same class
-- of gap `customer_preferences`/`wishlists` hit before: RLS is satisfied but
-- the direct table read still 403s with "permission denied for table
-- behavioral_events" because SQL-level grants are enforced independently.
-- Writes stay RPC-only (`capture_behavioral_event`, security definer) — this
-- grants only `select`, matching the table's own read-only RLS policies.
grant select on public.behavioral_events to authenticated, service_role;
