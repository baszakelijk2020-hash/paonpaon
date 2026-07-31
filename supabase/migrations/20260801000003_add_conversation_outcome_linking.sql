-- PHASE 10.3 (CLI-004 / CMP-103): "advisor prepares, sends an approved
-- look, receives reply, books appointment/creates cart and links sale" needs
-- a real outcome link on the conversation, not just a text history. Mirrors
-- clienteling_opportunities' own outcome_appointment_id/outcome_order_id
-- pattern (PHASE 7.4) exactly, rather than inventing a second outcome shape.

alter table public.conversations
  add column if not exists outcome_appointment_id uuid
    references public.appointments (id) on delete set null,
  add column if not exists outcome_order_id uuid
    references public.orders (id) on delete set null,
  add column if not exists outcome_recorded_at timestamptz;
