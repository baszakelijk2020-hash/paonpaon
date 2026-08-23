-- FT-09: service_role needs INSERT on message_attachments for test fixture setup.
-- The record_consultation_attachment() RPC requires authentication context which
-- service_role doesn't have. Direct inserts for test setup bypass RLS and satisfy
-- the table's check constraints.

grant insert on table public.message_attachments to service_role;
