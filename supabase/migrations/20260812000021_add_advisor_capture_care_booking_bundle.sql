-- Advisor capture: extend confirmable bundle kinds with "care_booking", so
-- a typed/voiced note that clearly implies a care/service action (a
-- pressing, cleaning, repair or other HighMaintenance/Preferred Tailoring
-- booking kind) can become an AI-proposed, advisor-confirmed service
-- booking through the same evidence-gated review flow as the existing
-- self_portrait_fact/follow_up/task_note/appointment kinds.
--
-- Deliberately reuses service_bookings (Stage 5.3's concierge service
-- plans) as the write target on confirm rather than inventing a parallel
-- object. A care booking requires an active service_memberships row for
-- the customer; confirmBundle looks this up and fails with a distinct,
-- explained reason when none exists rather than silently doing nothing.

alter table public.advisor_capture_bundles
  drop constraint if exists advisor_capture_bundles_kind_check;

alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_kind_check check (
    kind in (
      'self_portrait_fact', 'follow_up', 'task_note', 'appointment',
      'care_booking'
    )
  );

alter table public.advisor_capture_bundles
  add column if not exists linked_service_booking_id uuid
    references public.service_bookings (id) on delete set null;
