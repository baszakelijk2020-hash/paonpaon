-- Advisor capture: optional link from a capture session to the
-- appointment it was taken during/after. Distinct from the existing
-- "appointment" bundle kind (which proposes CREATING a new appointment)
-- -- this lets a note taken during an appointment be traced back to that
-- appointment without implying a new one should be booked. A session may
-- also remain appointment-less (walk-up note, no specific appointment).

alter table public.advisor_capture_sessions
  add column if not exists appointment_id uuid
    references public.appointments (id) on delete set null;

create index if not exists advisor_capture_sessions_appointment_idx
  on public.advisor_capture_sessions (appointment_id)
  where appointment_id is not null;

comment on column public.advisor_capture_sessions.appointment_id is
  'Optional: which appointment this capture was taken during/after. Distinct from the "appointment" bundle kind, which proposes creating a new appointment.';
