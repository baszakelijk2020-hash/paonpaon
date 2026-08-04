-- PHASE 18.8 (BD-108): the corporate service desk. Extends
-- `corporate_exceptions` (14.1) rather than forking a second ticketing
-- table for the same shape of problem — new columns are all nullable/
-- defaulted so every existing leaver/service/fit/dispute row keeps
-- working unchanged. The one genuinely new object is
-- `corporate_exception_events`, an append-only audit trail: "every
-- state change is audited" is this item's own acceptance line, and a
-- log that could be edited after the fact would not satisfy it.

alter table public.corporate_exceptions
  drop constraint corporate_exceptions_kind_check;
alter table public.corporate_exceptions
  add constraint corporate_exceptions_kind_check check (
    kind in (
      'leaver_return', 'service_required', 'fit_issue', 'entitlement_dispute',
      'damaged', 'missing', 'alteration_request', 'replacement_request'
    )
  );

alter table public.corporate_exceptions
  add column if not exists priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  add column if not exists due_at timestamptz,
  add column if not exists assigned_staff_id uuid
    references public.retailer_staff_members (id) on delete set null;

create index if not exists corporate_exceptions_overdue_idx
  on public.corporate_exceptions (retailer_id, due_at)
  where resolved_at is null and due_at is not null;

create table if not exists public.corporate_exception_events (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  exception_id uuid not null
    references public.corporate_exceptions (id) on delete cascade,
  event_type text not null check (
    event_type in ('created', 'assigned', 'priority_changed', 'resolved')
  ),
  detail text check (detail is null or char_length(btrim(detail)) <= 2000),
  actor_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists corporate_exception_events_exception_idx
  on public.corporate_exception_events (exception_id, created_at);

alter table public.corporate_exception_events enable row level security;
revoke all on table public.corporate_exception_events from public, anon;
grant select, insert on table public.corporate_exception_events
  to authenticated, service_role;

create policy corporate_exception_events_retailer_select
  on public.corporate_exception_events for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy corporate_exception_events_staff_insert
  on public.corporate_exception_events for insert to authenticated with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );

-- A wearer may raise their own exception (damaged/missing/fit issue/
-- alteration/replacement) directly from the Employee Portal (18.5) —
-- additional, narrower policies OR'd with the existing staff-only ones,
-- never replacing them. Scoped to their own wearer_id/programme only.
create policy corporate_exceptions_wearer_insert
  on public.corporate_exceptions for insert to authenticated with check (
    wearer_id = public.current_wearer_id()
    and programme_id in (
      select programme_id from public.corporate_wearers
      where id = public.current_wearer_id()
    )
  );

create policy corporate_exceptions_wearer_select
  on public.corporate_exceptions for select to authenticated using (
    wearer_id = public.current_wearer_id()
  );

comment on table public.corporate_exception_events is
  'PHASE 18.8 / BD-108. Append-only audit trail for corporate_exceptions '
  '— insert-only grant, no update/delete exists on this table at all.';
