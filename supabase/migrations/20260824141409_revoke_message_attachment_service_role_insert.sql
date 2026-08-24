-- The unsafe 20260819120000 grant may already have been applied in an
-- environment. Removing that migration from source did not remove its ACL.
-- Attachment metadata must be written through the authorization-enforcing RPC.
revoke insert on table public.message_attachments from service_role;
