-- ADR-074 Slice 1 — customer relationship-intelligence access boundary.
--
-- Two real gaps closed here, both present since the tables were created:
--
-- 1. `clienteling_notes` grants blanket retailer-wide read to every
--    non-workshop role (20260720000003), regardless of who authored a
--    note or which customer it concerns. Advisor notes routinely carry
--    family/personal context, commercial observations and relationship
--    intelligence — exactly the category the product asks not to be
--    silently retailer-wide. A `note_visibility` tier, defaulting narrow
--    for new notes, makes this DB-enforced (RLS), not app-layer advisory.
-- 2. There is no sensitive-access ledger write path at all yet —
--    `audit_log_entries` (20260719000101) already has a working generic
--    shape and an alterations-only write pattern
--    (`audit_alteration_sensitive_change()`). `record_customer_access_event`
--    reuses the same table for customer-relationship events (protected
--    profile open, contact reveal) rather than inventing a parallel log.
--    It writes only actor/action/reason/outcome metadata into
--    `after_state`, never the sensitive payload itself (note body,
--    contact value), per the product's own instruction not to duplicate
--    sensitive content into general logs.
--
-- `customers.assigned_staff_id` (already populated by existing CRM
-- assignment flows) is reused as the access boundary — no second
-- assignment model. See ADR-074 for the full decision record, including
-- why contact detail (phone/email) is masked at the repository layer in
-- this slice rather than schema-split into a separate table.

create type public.note_visibility as enum (
  'author_only',
  'assigned_advisor',
  'management',
  'retailer_shared'
);

alter table public.clienteling_notes
  add column visibility public.note_visibility not null default 'assigned_advisor';

-- Backfill existing rows to the pre-existing retailer-wide behavior —
-- there is no signal in the data distinguishing which historical notes
-- are actually sensitive, so retroactively narrowing them would silently
-- lock staff out of notes they already depend on operationally. New rows
-- (the column default above) start narrow.
update public.clienteling_notes set visibility = 'retailer_shared';

drop policy "retailer staff read clienteling notes" on public.clienteling_notes;

-- `is_alterations_management()` (20260719000103) is a plain
-- staff-exists-and-role-in(owner,admin,manager) predicate with nothing
-- alterations-specific about its logic despite its module-era name —
-- reused here as the general "management override" check rather than
-- duplicating the same role list a second time.
create policy "clienteling notes visibility tiers"
  on public.clienteling_notes for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
    and (
      public.is_alterations_management()
      or exists (
        select 1 from public.retailer_staff_members s
        where s.id = clienteling_notes.author_staff_id and s.user_id = auth.uid()
      )
      or (
        visibility = 'retailer_shared'
      )
      or (
        visibility = 'assigned_advisor'
        and exists (
          select 1 from public.customers c
          where c.id = clienteling_notes.customer_id
            and c.assigned_staff_id = public.current_staff_id()
        )
      )
    )
  );

comment on column public.clienteling_notes.visibility is
  'Need-to-know tier (ADR-074). author_only: author + management only. assigned_advisor (default for new notes): author + the customer''s assigned advisor + management. management: owner/admin/manager only. retailer_shared: pre-existing retailer-wide behavior, an explicit author choice for non-sensitive notes.';

create or replace function public.record_customer_access_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text default null,
  p_outcome text default 'granted'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid := public.current_retailer_id();
  v_staff_id uuid := public.current_staff_id();
begin
  if v_retailer_id is null or v_staff_id is null then
    raise exception 'record_customer_access_event requires an authenticated retailer staff session';
  end if;

  if p_action not in (
    'customer_protected_open', 'note_view_protected', 'contact_reveal',
    'access_requested', 'access_approved', 'access_denied', 'break_glass_used',
    'assignment_changed', 'export_requested', 'export_downloaded'
  ) then
    raise exception 'record_customer_access_event: unrecognized action %', p_action;
  end if;

  insert into public.audit_log_entries (
    retailer_id, actor_user_id, actor_staff_id, action, entity_type,
    entity_id, after_state
  ) values (
    v_retailer_id, auth.uid(), v_staff_id, p_action, p_entity_type, p_entity_id,
    jsonb_build_object(
      'reason', p_reason,
      'outcome', p_outcome,
      'actor_role', public.current_retailer_role()
    )
  );
end;
$$;

revoke all on function public.record_customer_access_event(text, text, uuid, text, text)
  from public;
grant execute on function public.record_customer_access_event(text, text, uuid, text, text)
  to authenticated;

comment on function public.record_customer_access_event is
  'Sensitive-access ledger write (ADR-074 Slice 1). Self-derives retailer/actor server-side; records only action/reason/outcome metadata into audit_log_entries.after_state, never the sensitive payload (note body, contact value, etc).';
