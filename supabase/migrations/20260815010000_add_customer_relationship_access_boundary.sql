-- ADR-075 Slice 1 — customer relationship-intelligence access boundary.
-- Orchestration 2.0 tranche 6. Re-authored as a forward patch against current
-- `main` from the unmerged `agent/lane-h-customer-security-boundary` design;
-- the branch itself is not merged (GROUND_TRUTH 10g).
--
-- Two real gaps, both present since the tables were created:
--
-- 1. `clienteling_notes` grants blanket retailer-wide read to every
--    non-workshop role (20260720000003), regardless of who authored a note or
--    which customer it concerns. Advisor notes routinely carry family and
--    personal context, commercial observation and relationship intelligence —
--    exactly the category that should not be silently retailer-wide. A
--    `note_visibility` tier, defaulting narrow for new notes, makes this
--    enforced by RLS rather than advised by the application.
--
-- 2. There is no sensitive-access ledger write path. `audit_log_entries`
--    (20260719000101) already has the right shape and an alterations-only
--    write pattern; `record_customer_access_event` reuses that table for
--    customer-relationship events rather than inventing a parallel log. It
--    writes only actor/action/reason/outcome metadata into `after_state`,
--    never the sensitive payload itself — no note body, no contact value.
--    Duplicating sensitive content into a general log would create a second
--    exposure surface while claiming to protect the first.
--
-- `customers.assigned_staff_id`, already populated by existing CRM assignment
-- flows, is reused as the boundary. No second assignment model.
--
-- BACKFILL DIRECTION IS DELIBERATE AND SAFE. The column defaults new rows to
-- the narrow `assigned_advisor`, while every existing row is explicitly set to
-- `retailer_shared` — preserving exactly the access staff have today. Nothing
-- becomes more exposed than it already is. Retroactively narrowing historical
-- notes would silently lock staff out of records they depend on
-- operationally, and there is no signal in the data distinguishing which of
-- them are actually sensitive.
--
-- KNOWN, ACCEPTED CONSEQUENCE, recorded rather than discovered later:
-- `apps/retailer/app/appointments/[id]/print/page.tsx:51` and the customer
-- Self-Portrait card both surface a pinned note via
-- `notes.find(n => n.pinned)`. Once tiering is live, a staff member who is
-- neither the author, the assigned advisor, nor management will simply not
-- receive that row, and the surface renders as if no pinned note exists —
-- no error, no indication one was withheld. That is the correct data
-- boundary and the wrong user experience. It is a UI slice, not a schema
-- one, and is deliberately not bundled into this migration: adding a
-- "a note is hidden from you" affordance touches app code that this tranche
-- does not own. Tracked in ORCHESTRATION_STATE.md.
--
-- `is_alterations_management()` (20260719000103) is a plain
-- staff-exists-and-role-in(owner, admin, manager) predicate with nothing
-- alterations-specific about it despite the module-era name. Reused here as
-- the management override rather than duplicating the same role list again.

create type public.note_visibility as enum (
  'author_only',
  'assigned_advisor',
  'management',
  'retailer_shared'
);

alter table public.clienteling_notes
  add column visibility public.note_visibility not null
  default 'assigned_advisor';

update public.clienteling_notes set visibility = 'retailer_shared';

drop policy "retailer staff read clienteling notes" on public.clienteling_notes;

create policy "clienteling notes visibility tiers"
  on public.clienteling_notes for select
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() not in ('workshop_manager', 'worker')
    and (
      public.is_alterations_management()
      or exists (
        select 1 from public.retailer_staff_members s
        where s.id = clienteling_notes.author_staff_id
          and s.user_id = auth.uid()
      )
      or (visibility = 'retailer_shared')
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
  'Need-to-know tier (ADR-075). author_only: author + management only. assigned_advisor (default for new notes): author + the customer''s assigned advisor + management. management: owner/admin/manager only. retailer_shared: pre-existing retailer-wide behaviour, an explicit author choice for non-sensitive notes.';

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
    raise exception
      'record_customer_access_event requires an authenticated retailer staff session';
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

revoke all on function
  public.record_customer_access_event(text, text, uuid, text, text)
  from public;
grant execute on function
  public.record_customer_access_event(text, text, uuid, text, text)
  to authenticated;

comment on function public.record_customer_access_event is
  'Sensitive-access ledger write (ADR-075 Slice 1). Self-derives retailer and actor from the session, never from client input; records only action/reason/outcome metadata into audit_log_entries.after_state, never the sensitive payload.';
