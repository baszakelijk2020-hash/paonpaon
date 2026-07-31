-- PHASE 10.1: persists the last rehearsal preview and the last activation's
-- mission count directly on the campaign row, following the same pattern
-- migration_jobs.dry_run_report already uses (9.1) — a projection the
-- retailer settings page re-reads after a Server Action + revalidatePath,
-- not a second live state store.

alter table public.campaigns
  add column if not exists last_rehearsal_report jsonb,
  add column if not exists last_rehearsed_at timestamptz,
  add column if not exists last_activation_missions_created integer,
  add column if not exists last_activated_at timestamptz;
