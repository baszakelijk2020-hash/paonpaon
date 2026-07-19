-- Separate migration because PostgreSQL enum values cannot be referenced by
-- another statement until the ALTER TYPE transaction has committed.
alter type public.retailer_role add value if not exists 'workshop_manager';
alter type public.retailer_role add value if not exists 'worker';
