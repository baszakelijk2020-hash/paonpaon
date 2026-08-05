-- PHASE 18.4 (BD-104): closes this item's own named gap — "booking an
-- appointment or starting measurement capture directly from this page"
-- did not exist; a submitted request only ever became a staff-reviewed
-- lead. This wires "Scheduled" to a real customer + a real appointment
-- when staff provide a real time and the requester left a real contact
-- email, rather than inventing a shadow customer for every request
-- (18.6's own rejected pattern) — a scheduled office visit is a real
-- person choosing to engage the retailer directly, which is exactly
-- what `customers` already models, not a bulk employee census.

alter table public.corporate_office_visit_requests
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

comment on column public.corporate_office_visit_requests.customer_id is
  'PHASE 18.4. Set only when staff schedule a real appointment for this '
  'request — never eagerly created for every open request.';
comment on column public.corporate_office_visit_requests.appointment_id is
  'PHASE 18.4. The real appointments row this request became, when staff '
  'scheduled one with a real time and the requester left a contact email.';
