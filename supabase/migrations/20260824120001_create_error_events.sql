-- Production error observability (ship-readiness Blocker 2).
-- Append-only capture of client/server errors from admin, retailer and
-- customer apps. Inserted exclusively via the service-role reporter
-- (packages/database/src/error-reporting.ts) so RLS grants no anon/
-- authenticated insert. Reads are restricted to platform staff.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('admin', 'retailer', 'customer')),
  environment text not null,
  level text not null default 'error' check (level in ('error', 'warning')),
  route text,
  message text not null,
  stack text,
  request_id text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists error_events_created_at_idx
  on public.error_events (created_at desc);

create index if not exists error_events_app_created_at_idx
  on public.error_events (app, created_at desc);

alter table public.error_events enable row level security;

-- This project revokes default table privileges, so service_role needs an
-- explicit grant even though it bypasses RLS (see e.g. migration
-- 20260814030000_grant_service_role_conversation_proposals_write.sql).
grant select, insert on table public.error_events to service_role;

-- No insert/update/delete policy for anon or authenticated: rows are
-- written only by the service-role reporter, which bypasses RLS.
grant select on table public.error_events to authenticated;

create policy "platform staff can read error events"
  on public.error_events
  for select
  to authenticated
  using (public.is_platform_staff());
