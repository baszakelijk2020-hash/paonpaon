-- PHASE 12.1 test cleanup support.
--
-- customer_measurement_candidates are derivative data (scan outputs), not
-- approved measurements of record. While the table is append-only for the
-- customer-facing use case, test cleanup requires the ability to delete
-- stale candidates from previous test runs (since tests share a seed
-- customer and must be able to reset state).
--
-- service_role is an admin/backend role and DELETE by service_role (via
-- migrations or admin scripts) is distinct from customer-initiated DELETE.
-- This grant allows test setup to clean up without breaking the
-- append-only guarantee for customer_measurement_versions.

grant delete on table public.customer_measurement_candidates to service_role;
