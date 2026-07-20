-- Separate migration because PostgreSQL enum values cannot be referenced by
-- another statement until the ALTER TYPE transaction has committed (see
-- 20260719000100_add_workshop_roles.sql for the same constraint).
alter type public.message_sender_type add value if not exists 'guest';
