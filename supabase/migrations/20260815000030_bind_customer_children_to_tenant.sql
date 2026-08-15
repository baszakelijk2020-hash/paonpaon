-- Tranche 4b, slice 1: bind every customer-referencing child row to its tenant.
--
-- Tranche 4 (20260815000000/10/20) closed the three holes that had been
-- documented and reproduced. Measuring the result showed the class was far
-- from closed: 238 further edges where a child table carries its own
-- retailer_id, references a tenant-scoped parent, and has a staff INSERT
-- policy that checks only `retailer_id = current_retailer_id()` without ever
-- constraining the referenced parent.
--
-- `customers` is the highest-value parent in that set — 26 edges, spanning
-- appointments, measurements, facts, POS transactions, physical garments and
-- production specs. Every one is the same defect that
-- 20260815000020 fixed for clienteling_notes alone: RLS is satisfied because
-- the row's own retailer_id really is the caller's, and nothing checks whose
-- customer it points at.
--
-- `customers` already carries `customers_id_retailer_id_key` (added
-- incidentally by 20260814000000_add_store_feedback_signals), so this
-- migration adds only the missing composite foreign keys and must not re-add
-- the unique constraint.
--
-- ON DELETE actions each mirror the pre-existing single-column key on the same
-- column, so deletion behaviour is unchanged:
--
--   * 12 CASCADE — the child is owned data that dies with the customer.
--   * 4 RESTRICT — fitting_sessions, physical_garments, production_specs and
--     service_partner_engagements deliberately block deleting a customer who
--     still has garments, fittings, specs or partner work outstanding. That
--     protection is preserved, not widened to CASCADE.
--   * 10 NO ACTION — these columns are ON DELETE SET NULL and nullable. A
--     composite SET NULL is impossible because it would also null the NOT NULL
--     retailer_id. NO ACTION is correct: when a customer is deleted the
--     existing single-column key nulls the reference first, and MATCH SIMPLE
--     then skips the composite check because the referencing column is NULL.
--     Proved behaviourally in the accompanying test, not argued.
--
-- Verified before writing: zero existing rows violate any of the 26.

-- ON DELETE CASCADE (mirrors the existing single-column key)
alter table public.ai_generations
  add constraint ai_generations_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.appointment_closeouts
  add constraint appointment_closeouts_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.appointments
  add constraint appointments_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.customer_fact_corrections
  add constraint customer_fact_corrections_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.customer_facts
  add constraint customer_facts_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.customer_measurement_candidates
  add constraint customer_measurement_candidates_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.customer_measurement_versions
  add constraint customer_measurement_versions_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.customer_moments
  add constraint customer_moments_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.network_reward_entries
  add constraint network_reward_entries_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.outfits
  add constraint outfits_created_by_customer_retailer_fkey
  foreign key (created_by_customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

alter table public.wedding_parties
  add constraint wedding_parties_organizer_customer_retailer_fkey
  foreign key (organizer_customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete cascade;

-- ON DELETE RESTRICT (preserved deliberately — see header)
alter table public.fitting_sessions
  add constraint fitting_sessions_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete restrict;

alter table public.physical_garments
  add constraint physical_garments_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete restrict;

alter table public.production_specs
  add constraint production_specs_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete restrict;

alter table public.service_partner_engagements
  add constraint service_partner_engagements_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id) on delete restrict;

-- NO ACTION (single-column key is SET NULL; composite SET NULL impossible)
alter table public.advisor_capture_sessions
  add constraint advisor_capture_sessions_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.corporate_wearers
  add constraint corporate_wearers_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.customer_fact_corrections
  add constraint customer_fact_corrections_actor_customer_retailer_fkey
  foreign key (actor_customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.customer_facts
  add constraint customer_facts_author_customer_retailer_fkey
  foreign key (author_customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.pos_transactions
  add constraint pos_transactions_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.service_recovery_budget_requests
  add constraint service_recovery_budget_requests_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.staff_recognition_acts
  add constraint staff_recognition_acts_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.store_sessions
  add constraint store_sessions_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.supply_complaint_cases
  add constraint supply_complaint_cases_customer_retailer_fkey
  foreign key (customer_id, retailer_id)
  references public.customers (id, retailer_id);

alter table public.wedding_inspiration_items
  add constraint wedding_inspiration_items_added_by_customer_retailer_fkey
  foreign key (added_by_customer_id, retailer_id)
  references public.customers (id, retailer_id);
