-- Conversation Intelligence / Appointment Capture: extends the existing
-- advisor-capture pipeline (20260804120000) rather than inventing a
-- parallel one. Adds an optional appointment linkage on a capture session
-- and two new bundle kinds:
--   - appointment_proposal: confirming writes a real `appointments` row
--     (status `requested`) — the highest-impact kind this pipeline
--     produces, so it gets its own linked-id column like the other kinds.
--   - unresolved: never has a write target; it exists so an extractor that
--     cannot safely resolve something (an ambiguous date, an unmatched
--     reference) surfaces it for a human decision instead of guessing.

alter table public.advisor_capture_sessions
  add column if not exists appointment_id uuid
    references public.appointments (id) on delete set null;

create index if not exists advisor_capture_sessions_appointment_idx
  on public.advisor_capture_sessions (appointment_id)
  where appointment_id is not null;

alter table public.advisor_capture_bundles
  add column if not exists linked_appointment_id uuid
    references public.appointments (id) on delete set null;

alter table public.advisor_capture_bundles
  drop constraint if exists advisor_capture_bundles_kind_check;

alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_kind_check check (
    kind in (
      'self_portrait_fact',
      'follow_up',
      'task_note',
      'appointment_proposal',
      'unresolved'
    )
  );

comment on column public.advisor_capture_sessions.appointment_id is
  'Optional: which appointment this capture was taken during/after. A session may also be customer-only (walk-up note, no specific appointment).';
comment on column public.advisor_capture_bundles.linked_appointment_id is
  'Set only for a confirmed appointment_proposal bundle — the appointments row it created.';
