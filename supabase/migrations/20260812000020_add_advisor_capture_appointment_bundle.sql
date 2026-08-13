-- Advisor capture: extend confirmable bundle kinds with "appointment", so
-- a typed/voiced note that clearly implies booking something ("she wants
-- a fitting next Tuesday") can become an AI-proposed, advisor-confirmed
-- appointment through the same evidence-gated review flow as the existing
-- self_portrait_fact/follow_up/task_note kinds, rather than requiring the
-- advisor to re-key it into the separate appointment-booking screen.

alter table public.advisor_capture_bundles
  drop constraint if exists advisor_capture_bundles_kind_check;

alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_kind_check check (
    kind in ('self_portrait_fact', 'follow_up', 'task_note', 'appointment')
  );

alter table public.advisor_capture_bundles
  add column if not exists linked_appointment_id uuid
    references public.appointments (id) on delete set null;
