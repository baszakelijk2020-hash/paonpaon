-- Persist the founder outreach pack (includes access code) so Demo Studio
-- can re-copy after a browser refresh. Platform-operator RLS already gates
-- the table; the access code hash remains the public gate.

alter table public.prospect_demo_environments
  add column if not exists founder_outreach_pack text;
