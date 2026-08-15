-- Tranche 4b, slice 3: bind staff attribution to its tenant. Final slice.
--
-- Slices 1 and 2 closed 159 edges of data ownership. This closes the last 67,
-- all under `retailer_staff_members`, and they are a different kind of claim:
-- not "this row belongs to that customer" but "this action was taken by that
-- staff member". Until now a row created in one house could name a staff
-- member of another house as its author, actor, approver, assignee or
-- reviewer — the child's own retailer_id satisfied RLS, and nothing checked
-- whose employee was being named.
--
-- That matters most where the staff reference is the accountability record:
-- who approved a payroll run, who authorised an exception, who signed off an
-- alteration, who graded a roleplay. An attribution that can point across a
-- tenant boundary is not an audit trail.
--
-- `retailer_staff_members.retailer_id` is NOT NULL, so it is a tenant-owned
-- parent under the discriminator established in 20260815000040 — not shared
-- vocabulary, and safe to bind.
--
-- Generated from the live catalogue, mirroring each single-column key's
-- ON DELETE action, exactly as in slice 2.
--
-- Verified before writing: zero existing rows violate any of the 67.

alter table public.retailer_staff_members
  add constraint retailer_staff_members_id_retailer_id_key unique (id, retailer_id);

alter table public.academy_roleplay_grades
  add constraint academy_roleplay_grades_graded_by_staff_ret_fkey
  foreign key (graded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.academy_roleplay_grades
  add constraint academy_roleplay_grades_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.advertising_creatives
  add constraint advertising_creatives_reviewed_by_staff_ret_fkey
  foreign key (reviewed_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_confirmed_by_staff_ret_fkey
  foreign key (confirmed_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.alteration_attachments
  add constraint alteration_attachments_uploaded_by_staff_ret_fkey
  foreign key (uploaded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.alteration_fulfillment_events
  add constraint alteration_fulfillment_events_actor_staff_ret_fkey
  foreign key (actor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.appointment_closeouts
  add constraint appointment_closeouts_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.appointments
  add constraint appointments_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.campaigns
  add constraint campaigns_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.catalogue_import_rows
  add constraint catalogue_import_rows_published_by_staff_ret_fkey
  foreign key (published_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.catalogue_imports
  add constraint catalogue_imports_uploaded_by_staff_ret_fkey
  foreign key (uploaded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
alter table public.chain_of_custody_events
  add constraint chain_of_custody_events_actor_staff_ret_fkey
  foreign key (actor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_assigned_staff_ret_fkey
  foreign key (assigned_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.concept_scan_codes
  add constraint concept_scan_codes_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.corporate_announcements
  add constraint corporate_announcements_authored_by_staff_ret_fkey
  foreign key (authored_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.corporate_concept_assets
  add constraint corporate_concept_assets_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.corporate_exception_events
  add constraint corporate_exception_events_actor_staff_ret_fkey
  foreign key (actor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.corporate_exceptions
  add constraint corporate_exceptions_assigned_staff_ret_fkey
  foreign key (assigned_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.corporate_project_events
  add constraint corporate_project_events_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.corporate_tender_approvals
  add constraint corporate_tender_approvals_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
alter table public.corporate_tender_versions
  add constraint corporate_tender_versions_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.coverage_plans
  add constraint coverage_plans_published_by_staff_ret_fkey
  foreign key (published_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.customer_fact_corrections
  add constraint customer_fact_corrections_actor_staff_ret_fkey
  foreign key (actor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.customer_facts
  add constraint customer_facts_author_staff_ret_fkey
  foreign key (author_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.customer_measurement_candidates
  add constraint customer_measurement_candidates_resolved_by_staff_ret_fkey
  foreign key (resolved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.customers
  add constraint customers_assigned_staff_ret_fkey
  foreign key (assigned_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.fitting_observations
  add constraint fitting_observations_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.fitting_sessions
  add constraint fitting_sessions_fitted_by_staff_ret_fkey
  foreign key (fitted_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.gift_experiences
  add constraint gift_experiences_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.knowledge_articles
  add constraint knowledge_articles_author_staff_ret_fkey
  foreign key (author_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.knowledge_articles
  add constraint knowledge_articles_reviewed_by_staff_ret_fkey
  foreign key (reviewed_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.merchant_purchase_orders
  add constraint merchant_purchase_orders_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.merchant_purchase_orders
  add constraint merchant_purchase_orders_raised_by_staff_ret_fkey
  foreign key (raised_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.metadata_review_tasks
  add constraint metadata_review_tasks_reviewed_by_staff_ret_fkey
  foreign key (reviewed_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.morning_routine_eligible_products
  add constraint morning_routine_eligible_products_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.pos_transactions
  add constraint pos_transactions_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.production_pieces
  add constraint production_pieces_maker_staff_ret_fkey
  foreign key (maker_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.production_spec_amendments
  add constraint production_spec_amendments_amended_by_staff_ret_fkey
  foreign key (amended_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
alter table public.production_stage_events
  add constraint production_stage_events_inspector_staff_ret_fkey
  foreign key (inspector_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.production_stage_events
  add constraint production_stage_events_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.retailer_alteration_category_settings
  add constraint retailer_alteration_category_settings_updated_by_staff_ret_fkey
  foreign key (updated_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.retailer_alteration_operation_settings
  add constraint retailer_alteration_operation_settings_updated_by_staff_ret_fke
  foreign key (updated_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_bookings
  add constraint service_bookings_advisor_staff_ret_fkey
  foreign key (advisor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_care_records
  add constraint service_care_records_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_cost_records
  add constraint service_cost_records_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_fulfilment_events
  add constraint service_fulfilment_events_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_memberships
  add constraint service_memberships_advisor_staff_ret_fkey
  foreign key (advisor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_partner_custody_events
  add constraint service_partner_custody_events_actor_staff_ret_fkey
  foreign key (actor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_partner_invoices
  add constraint service_partner_invoices_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_partner_invoices
  add constraint service_partner_invoices_submitted_by_staff_ret_fkey
  foreign key (submitted_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_plans
  add constraint service_plans_created_by_staff_ret_fkey
  foreign key (created_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.service_recovery_budget_requests
  add constraint service_recovery_budget_requests_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.staff_announcements
  add constraint staff_announcements_authored_by_staff_ret_fkey
  foreign key (authored_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.staff_coaching_observations
  add constraint staff_coaching_observations_observed_staff_ret_fkey
  foreign key (observed_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.staff_learning_contributions
  add constraint staff_learning_contributions_moderated_by_staff_ret_fkey
  foreign key (moderated_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.staff_recognition_acts
  add constraint staff_recognition_acts_reviewed_by_staff_ret_fkey
  foreign key (reviewed_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.staff_shift_swap_requests
  add constraint staff_shift_swap_requests_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.staff_shift_swap_requests
  add constraint staff_shift_swap_requests_peer_staff_ret_fkey
  foreign key (peer_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.staff_shifts
  add constraint staff_shifts_staff_ret_fkey
  foreign key (staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete cascade;
alter table public.stock_count_lines
  add constraint stock_count_lines_counted_by_staff_ret_fkey
  foreign key (counted_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.stock_count_sessions
  add constraint stock_count_sessions_opened_by_staff_ret_fkey
  foreign key (opened_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
alter table public.stock_ledger_entries
  add constraint stock_ledger_entries_recorded_by_staff_ret_fkey
  foreign key (recorded_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.stock_risk_flags
  add constraint stock_risk_flags_approved_by_staff_ret_fkey
  foreign key (approved_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.stock_risk_flags
  add constraint stock_risk_flags_requested_by_staff_ret_fkey
  foreign key (requested_by_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
alter table public.store_sessions
  add constraint store_sessions_advisor_staff_ret_fkey
  foreign key (advisor_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.supply_complaint_cases
  add constraint supply_complaint_cases_owner_staff_ret_fkey
  foreign key (owner_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id);
alter table public.supply_exceptions
  add constraint supply_exceptions_owner_staff_ret_fkey
  foreign key (owner_staff_id, retailer_id)
  references public.retailer_staff_members (id, retailer_id) on delete restrict;
