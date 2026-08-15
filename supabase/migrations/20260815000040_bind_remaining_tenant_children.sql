-- Tranche 4b, slice 2: close the remaining cross-tenant edges, except the
-- staff-attribution class.
--
-- Slice 1 (20260815000030) closed the 26 edges under `customers`. This closes
-- 133 more across 62 parents: every remaining pair where a child carries its
-- own retailer_id, references a tenant-owned parent, and has a staff INSERT
-- policy that checks only `retailer_id = current_retailer_id()` without ever
-- constraining the parent. RLS passes on all of them today, because the row's
-- own retailer_id really is the caller's.
--
-- SHARED-REFERENCE PARENTS ARE EXCLUDED, and this is the important part.
-- A first cut of this migration bound every parent that merely HAS a
-- retailer_id column, and it broke four test suites. The rule
-- "both tables have retailer_id, therefore they must match" is false: some
-- parents are platform-global vocabulary that tenants reference across the
-- boundary BY DESIGN. `metadata_concepts` and `knowledge_objects` both have a
-- NULLABLE retailer_id, where NULL means platform-owned, and their own RLS
-- policies special-case `retailer_id IS NULL`. A retailer's
-- entity_metadata_assignment pointing at a global concept, or a
-- retailer_knowledge_override overriding a global object, is correct
-- behaviour — and a composite key can never match a NULL parent retailer_id,
-- so binding them destroys the feature.
--
-- The discriminator used here is therefore: a parent is tenant-owned, and
-- eligible for binding, only if its retailer_id is NOT NULL. Nullable
-- retailer_id means shared, and shared is excluded.
--
-- Also excluded, and left to slice 3: the 68 edges whose parent is
-- `retailer_staff_members`. Those are attribution rather than data ownership
-- and need their own analysis of the staff lifecycle.
--
-- The DDL was GENERATED from the live catalogue rather than transcribed, so
-- 195 statements could not drift from what the schema actually contains. Each
-- foreign key mirrors the ON DELETE action of the single-column key it
-- parallels, so deletion behaviour is unchanged: `on delete cascade` where
-- the existing key cascades, `on delete restrict` where it restricts, and no
-- action stated where it is SET NULL — a composite SET NULL is impossible
-- against the NOT NULL retailer_id, and MATCH SIMPLE skips the composite
-- check once the single-column key has nulled the reference.
--
-- The 62 unique (id, retailer_id) constraints add no new uniqueness
-- semantics — `id` is already the single-column primary key on each — and are
-- emitted strictly before any foreign key that depends on them.
--
-- Verified before writing: zero existing rows violate any of the 133.

alter table public.academy_roleplay_sessions
  add constraint academy_roleplay_sessions_id_retailer_id_key unique (id, retailer_id);
alter table public.advertising_events
  add constraint advertising_events_id_retailer_id_key unique (id, retailer_id);
alter table public.advertising_orders
  add constraint advertising_orders_id_retailer_id_key unique (id, retailer_id);
alter table public.ai_generations
  add constraint ai_generations_id_retailer_id_key unique (id, retailer_id);
alter table public.alteration_tasks
  add constraint alteration_tasks_id_retailer_id_key unique (id, retailer_id);
alter table public.alteration_work_orders
  add constraint alteration_work_orders_id_retailer_id_key unique (id, retailer_id);
alter table public.appointments
  add constraint appointments_id_retailer_id_key unique (id, retailer_id);
alter table public.audience_cohort_versions
  add constraint audience_cohort_versions_id_retailer_id_key unique (id, retailer_id);
alter table public.catalogue_import_rows
  add constraint catalogue_import_rows_id_retailer_id_key unique (id, retailer_id);
alter table public.catalogue_imports
  add constraint catalogue_imports_id_retailer_id_key unique (id, retailer_id);
alter table public.clienteling_notes
  add constraint clienteling_notes_id_retailer_id_key unique (id, retailer_id);
alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_id_retailer_id_key unique (id, retailer_id);
alter table public.consultancy_projects
  add constraint consultancy_projects_id_retailer_id_key unique (id, retailer_id);
alter table public.conversations
  add constraint conversations_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_exceptions
  add constraint corporate_exceptions_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_projects
  add constraint corporate_projects_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_rollout_days
  add constraint corporate_rollout_days_id_retailer_id_key unique (id, retailer_id);
alter table public.coverage_plans
  add constraint coverage_plans_id_retailer_id_key unique (id, retailer_id);
alter table public.customer_facts
  add constraint customer_facts_id_retailer_id_key unique (id, retailer_id);
alter table public.customer_measurement_candidates
  add constraint customer_measurement_candidates_id_retailer_id_key unique (id, retailer_id);
alter table public.customer_measurement_versions
  add constraint customer_measurement_versions_id_retailer_id_key unique (id, retailer_id);
alter table public.entity_metadata_assignments
  add constraint entity_metadata_assignments_id_retailer_id_key unique (id, retailer_id);
alter table public.fitting_observations
  add constraint fitting_observations_id_retailer_id_key unique (id, retailer_id);
alter table public.fitting_sessions
  add constraint fitting_sessions_id_retailer_id_key unique (id, retailer_id);
alter table public.merchant_listings
  add constraint merchant_listings_id_retailer_id_key unique (id, retailer_id);
alter table public.merchant_purchase_orders
  add constraint merchant_purchase_orders_id_retailer_id_key unique (id, retailer_id);
alter table public.merchant_rfqs
  add constraint merchant_rfqs_id_retailer_id_key unique (id, retailer_id);
alter table public.merchant_shipments
  add constraint merchant_shipments_id_retailer_id_key unique (id, retailer_id);
alter table public.merchant_suppliers
  add constraint merchant_suppliers_id_retailer_id_key unique (id, retailer_id);
alter table public.message_attachments
  add constraint message_attachments_id_retailer_id_key unique (id, retailer_id);
alter table public.network_attribution_events
  add constraint network_attribution_events_id_retailer_id_key unique (id, retailer_id);
alter table public.network_listings
  add constraint network_listings_id_retailer_id_key unique (id, retailer_id);
alter table public.network_partners
  add constraint network_partners_id_retailer_id_key unique (id, retailer_id);
alter table public.orders
  add constraint orders_id_retailer_id_key unique (id, retailer_id);
alter table public.outfits
  add constraint outfits_id_retailer_id_key unique (id, retailer_id);
alter table public.physical_garments
  add constraint physical_garments_id_retailer_id_key unique (id, retailer_id);
alter table public.pos_transactions
  add constraint pos_transactions_id_retailer_id_key unique (id, retailer_id);
alter table public.price_change_proposals
  add constraint price_change_proposals_id_retailer_id_key unique (id, retailer_id);
alter table public.production_pieces
  add constraint production_pieces_id_retailer_id_key unique (id, retailer_id);
alter table public.production_specs
  add constraint production_specs_id_retailer_id_key unique (id, retailer_id);
alter table public.products
  add constraint products_id_retailer_id_key unique (id, retailer_id);
alter table public.retailer_branches
  add constraint retailer_branches_id_retailer_id_key unique (id, retailer_id);
alter table public.service_ceremony_versions
  add constraint service_ceremony_versions_id_retailer_id_key unique (id, retailer_id);
alter table public.service_cost_records
  add constraint service_cost_records_id_retailer_id_key unique (id, retailer_id);
alter table public.service_entitlement_entries
  add constraint service_entitlement_entries_id_retailer_id_key unique (id, retailer_id);
alter table public.service_partner_engagements
  add constraint service_partner_engagements_id_retailer_id_key unique (id, retailer_id);
alter table public.service_partner_invoices
  add constraint service_partner_invoices_id_retailer_id_key unique (id, retailer_id);
alter table public.service_partners
  add constraint service_partners_id_retailer_id_key unique (id, retailer_id);
alter table public.staff_announcements
  add constraint staff_announcements_id_retailer_id_key unique (id, retailer_id);
alter table public.staff_learning_contributions
  add constraint staff_learning_contributions_id_retailer_id_key unique (id, retailer_id);
alter table public.staff_recognition_acts
  add constraint staff_recognition_acts_id_retailer_id_key unique (id, retailer_id);
alter table public.staff_shifts
  add constraint staff_shifts_id_retailer_id_key unique (id, retailer_id);
alter table public.stock_count_sessions
  add constraint stock_count_sessions_id_retailer_id_key unique (id, retailer_id);
alter table public.stock_ledger_entries
  add constraint stock_ledger_entries_id_retailer_id_key unique (id, retailer_id);
alter table public.stock_locations
  add constraint stock_locations_id_retailer_id_key unique (id, retailer_id);
alter table public.store_sessions
  add constraint store_sessions_id_retailer_id_key unique (id, retailer_id);
alter table public.store_zones
  add constraint store_zones_id_retailer_id_key unique (id, retailer_id);
alter table public.wardrobe_items
  add constraint wardrobe_items_id_retailer_id_key unique (id, retailer_id);
alter table public.wardrobe_roadmap_gaps
  add constraint wardrobe_roadmap_gaps_id_retailer_id_key unique (id, retailer_id);
alter table public.wardrobe_roadmaps
  add constraint wardrobe_roadmaps_id_retailer_id_key unique (id, retailer_id);
alter table public.wardrobe_self_scans
  add constraint wardrobe_self_scans_id_retailer_id_key unique (id, retailer_id);
alter table public.workshops
  add constraint workshops_id_retailer_id_key unique (id, retailer_id);

alter table public.academy_roleplay_grades
  add constraint academy_roleplay_grades_roleplay_session_ret_fkey
  foreign key (roleplay_session_id, retailer_id)
  references public.academy_roleplay_sessions (id, retailer_id);
alter table public.advertising_creatives
  add constraint advertising_creatives_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.advertising_orders (id, retailer_id) on delete cascade;
alter table public.advertising_events
  add constraint advertising_events_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.advertising_orders (id, retailer_id) on delete cascade;
alter table public.advertising_orders
  add constraint advertising_orders_cohort_version_ret_fkey
  foreign key (cohort_version_id, retailer_id)
  references public.audience_cohort_versions (id, retailer_id) on delete restrict;
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_linked_appointment_ret_fkey
  foreign key (linked_appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_linked_fact_ret_fkey
  foreign key (linked_fact_id, retailer_id)
  references public.customer_facts (id, retailer_id);
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_linked_note_ret_fkey
  foreign key (linked_note_id, retailer_id)
  references public.clienteling_notes (id, retailer_id);
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_linked_opportunity_ret_fkey
  foreign key (linked_opportunity_id, retailer_id)
  references public.clienteling_opportunities (id, retailer_id);
alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_linked_service_booking_ret_fkey
  foreign key (linked_service_booking_id, retailer_id)
  references public.service_bookings (id, retailer_id);
alter table public.alteration_attachments
  add constraint alteration_attachments_observation_ret_fkey
  foreign key (observation_id, retailer_id)
  references public.fitting_observations (id, retailer_id) on delete restrict;
alter table public.alteration_attachments
  add constraint alteration_attachments_proposal_ret_fkey
  foreign key (proposal_id, retailer_id)
  references public.price_change_proposals (id, retailer_id) on delete restrict;
alter table public.alteration_attachments
  add constraint alteration_attachments_task_ret_fkey
  foreign key (task_id, retailer_id)
  references public.alteration_tasks (id, retailer_id) on delete restrict;
alter table public.alteration_fulfillment_events
  add constraint alteration_fulfillment_events_alteration_ret_fkey
  foreign key (alteration_id, retailer_id)
  references public.alteration_work_orders (id, retailer_id) on delete restrict;
alter table public.appointment_closeouts
  add constraint appointment_closeouts_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id) on delete cascade;
alter table public.appointments
  add constraint appointments_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.appointments
  add constraint appointments_origin_message_attachment_ret_fkey
  foreign key (origin_message_attachment_id, retailer_id)
  references public.message_attachments (id, retailer_id);
alter table public.appointments
  add constraint appointments_origin_message_thread_ret_fkey
  foreign key (origin_message_thread_id, retailer_id)
  references public.conversations (id, retailer_id);
alter table public.audience_forecasts
  add constraint audience_forecasts_cohort_version_ret_fkey
  foreign key (cohort_version_id, retailer_id)
  references public.audience_cohort_versions (id, retailer_id) on delete restrict;
alter table public.campaign_audience_rules
  add constraint campaign_audience_rules_product_ret_fkey
  foreign key (product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.campaign_target_products
  add constraint campaign_target_products_product_ret_fkey
  foreign key (product_id, retailer_id)
  references public.products (id, retailer_id) on delete cascade;
alter table public.catalogue_import_rows
  add constraint catalogue_import_rows_import_ret_fkey
  foreign key (import_id, retailer_id)
  references public.catalogue_imports (id, retailer_id) on delete cascade;
alter table public.catalogue_import_rows
  add constraint catalogue_import_rows_published_product_ret_fkey
  foreign key (published_product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.clienteling_opportunities
  add constraint clienteling_opportunities_campaign_ret_fkey
  foreign key (campaign_id, retailer_id)
  references public.campaigns (id, retailer_id);
alter table public.consultancy_deliverables
  add constraint consultancy_deliverables_project_ret_fkey
  foreign key (project_id, retailer_id)
  references public.consultancy_projects (id, retailer_id) on delete cascade;
alter table public.corporate_announcements
  add constraint corporate_announcements_programme_ret_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id) on delete cascade;
alter table public.corporate_concept_assets
  add constraint corporate_concept_assets_ai_generation_ret_fkey
  foreign key (ai_generation_id, retailer_id)
  references public.ai_generations (id, retailer_id) on delete restrict;
alter table public.corporate_concept_assets
  add constraint corporate_concept_assets_tender_version_ret_fkey
  foreign key (tender_version_id, retailer_id)
  references public.corporate_tender_versions (id, retailer_id) on delete cascade;
alter table public.corporate_exception_events
  add constraint corporate_exception_events_exception_ret_fkey
  foreign key (exception_id, retailer_id)
  references public.corporate_exceptions (id, retailer_id) on delete cascade;
alter table public.corporate_issue_records
  add constraint corporate_issue_records_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id);
alter table public.corporate_project_events
  add constraint corporate_project_events_project_ret_fkey
  foreign key (project_id, retailer_id)
  references public.corporate_projects (id, retailer_id) on delete cascade;
alter table public.corporate_projects
  add constraint corporate_projects_account_ret_fkey
  foreign key (account_id, retailer_id)
  references public.corporate_accounts (id, retailer_id);
alter table public.corporate_projects
  add constraint corporate_projects_opportunity_ret_fkey
  foreign key (opportunity_id, retailer_id)
  references public.corporate_opportunities (id, retailer_id) on delete cascade;
alter table public.corporate_renewal_tasks
  add constraint corporate_renewal_tasks_programme_ret_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id) on delete cascade;
alter table public.corporate_rollout_slots
  add constraint corporate_rollout_slots_rollout_day_ret_fkey
  foreign key (rollout_day_id, retailer_id)
  references public.corporate_rollout_days (id, retailer_id) on delete cascade;
alter table public.corporate_rollout_slots
  add constraint corporate_rollout_slots_wearer_ret_fkey
  foreign key (wearer_id, retailer_id)
  references public.corporate_wearers (id, retailer_id) on delete cascade;
alter table public.coverage_plan_intervals
  add constraint coverage_plan_intervals_plan_ret_fkey
  foreign key (plan_id, retailer_id)
  references public.coverage_plans (id, retailer_id) on delete cascade;
alter table public.coverage_plans
  add constraint coverage_plans_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id) on delete cascade;
alter table public.customer_fact_corrections
  add constraint customer_fact_corrections_fact_ret_fkey
  foreign key (fact_id, retailer_id)
  references public.customer_facts (id, retailer_id) on delete cascade;
alter table public.customer_measurement_candidates
  add constraint customer_measurement_candidates_compared_to_version_ret_fkey
  foreign key (compared_to_version_id, retailer_id)
  references public.customer_measurement_versions (id, retailer_id);
alter table public.customer_measurement_candidates
  add constraint customer_measurement_candidates_self_scan_ret_fkey
  foreign key (self_scan_id, retailer_id)
  references public.wardrobe_self_scans (id, retailer_id) on delete cascade;
alter table public.customer_measurement_versions
  add constraint customer_measurement_versions_reviewed_candidate_ret_fkey
  foreign key (reviewed_candidate_id, retailer_id)
  references public.customer_measurement_candidates (id, retailer_id);
alter table public.customer_moments
  add constraint customer_moments_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.customer_moments
  add constraint customer_moments_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.fitting_observations
  add constraint fitting_observations_fitting_session_ret_fkey
  foreign key (fitting_session_id, retailer_id)
  references public.fitting_sessions (id, retailer_id) on delete restrict;
alter table public.fitting_observations
  add constraint fitting_observations_physical_garment_ret_fkey
  foreign key (physical_garment_id, retailer_id)
  references public.physical_garments (id, retailer_id) on delete restrict;
alter table public.fitting_sessions
  add constraint fitting_sessions_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.merchant_group_buys
  add constraint merchant_group_buys_listing_ret_fkey
  foreign key (listing_id, retailer_id)
  references public.merchant_listings (id, retailer_id) on delete cascade;
alter table public.merchant_listings
  add constraint merchant_listings_supplier_ret_fkey
  foreign key (supplier_id, retailer_id)
  references public.merchant_suppliers (id, retailer_id) on delete cascade;
alter table public.merchant_purchase_orders
  add constraint merchant_purchase_orders_rfq_ret_fkey
  foreign key (rfq_id, retailer_id)
  references public.merchant_rfqs (id, retailer_id);
alter table public.merchant_purchase_orders
  add constraint merchant_purchase_orders_supplier_ret_fkey
  foreign key (supplier_id, retailer_id)
  references public.merchant_suppliers (id, retailer_id) on delete restrict;
alter table public.merchant_rfqs
  add constraint merchant_rfqs_listing_ret_fkey
  foreign key (listing_id, retailer_id)
  references public.merchant_listings (id, retailer_id) on delete cascade;
alter table public.merchant_shipment_issues
  add constraint merchant_shipment_issues_shipment_ret_fkey
  foreign key (shipment_id, retailer_id)
  references public.merchant_shipments (id, retailer_id) on delete cascade;
alter table public.merchant_shipments
  add constraint merchant_shipments_purchase_order_ret_fkey
  foreign key (purchase_order_id, retailer_id)
  references public.merchant_purchase_orders (id, retailer_id) on delete cascade;
alter table public.metadata_review_tasks
  add constraint metadata_review_tasks_assignment_ret_fkey
  foreign key (assignment_id, retailer_id)
  references public.entity_metadata_assignments (id, retailer_id);
alter table public.metadata_review_tasks
  add constraint metadata_review_tasks_import_row_ret_fkey
  foreign key (import_row_id, retailer_id)
  references public.catalogue_import_rows (id, retailer_id) on delete cascade;
alter table public.morning_routine_eligible_products
  add constraint morning_routine_eligible_products_product_ret_fkey
  foreign key (product_id, retailer_id)
  references public.products (id, retailer_id) on delete cascade;
alter table public.network_attribution_events
  add constraint network_attribution_events_listing_ret_fkey
  foreign key (listing_id, retailer_id)
  references public.network_listings (id, retailer_id) on delete cascade;
alter table public.network_listings
  add constraint network_listings_partner_ret_fkey
  foreign key (partner_id, retailer_id)
  references public.network_partners (id, retailer_id) on delete cascade;
alter table public.network_reward_entries
  add constraint network_reward_entries_attribution_event_ret_fkey
  foreign key (attribution_event_id, retailer_id)
  references public.network_attribution_events (id, retailer_id);
alter table public.outfit_slots
  add constraint outfit_slots_outfit_ret_fkey
  foreign key (outfit_id, retailer_id)
  references public.outfits (id, retailer_id) on delete cascade;
alter table public.outfit_slots
  add constraint outfit_slots_product_ret_fkey
  foreign key (product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.outfit_slots
  add constraint outfit_slots_wardrobe_item_ret_fkey
  foreign key (wardrobe_item_id, retailer_id)
  references public.wardrobe_items (id, retailer_id);
alter table public.outfits
  add constraint outfits_roadmap_ret_fkey
  foreign key (roadmap_id, retailer_id)
  references public.wardrobe_roadmaps (id, retailer_id);
alter table public.pos_payments
  add constraint pos_payments_transaction_ret_fkey
  foreign key (transaction_id, retailer_id)
  references public.pos_transactions (id, retailer_id) on delete cascade;
alter table public.pos_transaction_lines
  add constraint pos_transaction_lines_alteration_ret_fkey
  foreign key (alteration_id, retailer_id)
  references public.alteration_work_orders (id, retailer_id);
alter table public.pos_transaction_lines
  add constraint pos_transaction_lines_production_spec_ret_fkey
  foreign key (production_spec_id, retailer_id)
  references public.production_specs (id, retailer_id);
alter table public.pos_transaction_lines
  add constraint pos_transaction_lines_reservation_entry_ret_fkey
  foreign key (reservation_entry_id, retailer_id)
  references public.stock_ledger_entries (id, retailer_id);
alter table public.pos_transaction_lines
  add constraint pos_transaction_lines_transaction_ret_fkey
  foreign key (transaction_id, retailer_id)
  references public.pos_transactions (id, retailer_id) on delete cascade;
alter table public.pos_transactions
  add constraint pos_transactions_location_ret_fkey
  foreign key (location_id, retailer_id)
  references public.stock_locations (id, retailer_id) on delete restrict;
alter table public.production_material_lines
  add constraint production_material_lines_piece_ret_fkey
  foreign key (piece_id, retailer_id)
  references public.production_pieces (id, retailer_id) on delete cascade;
alter table public.production_material_lines
  add constraint production_material_lines_spec_ret_fkey
  foreign key (spec_id, retailer_id)
  references public.production_specs (id, retailer_id) on delete cascade;
alter table public.production_pieces
  add constraint production_pieces_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id) on delete cascade;
alter table public.production_pieces
  add constraint production_pieces_spec_ret_fkey
  foreign key (spec_id, retailer_id)
  references public.production_specs (id, retailer_id) on delete cascade;
alter table public.production_spec_amendments
  add constraint production_spec_amendments_spec_ret_fkey
  foreign key (spec_id, retailer_id)
  references public.production_specs (id, retailer_id) on delete cascade;
alter table public.production_specs
  add constraint production_specs_measurement_version_ret_fkey
  foreign key (measurement_version_id, retailer_id)
  references public.customer_measurement_versions (id, retailer_id) on delete restrict;
alter table public.production_specs
  add constraint production_specs_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id) on delete cascade;
alter table public.production_stage_events
  add constraint production_stage_events_piece_ret_fkey
  foreign key (piece_id, retailer_id)
  references public.production_pieces (id, retailer_id) on delete cascade;
alter table public.production_work_tickets
  add constraint production_work_tickets_piece_ret_fkey
  foreign key (piece_id, retailer_id)
  references public.production_pieces (id, retailer_id) on delete cascade;
alter table public.retailer_staff_members
  add constraint retailer_staff_members_workshop_ret_fkey
  foreign key (workshop_id, retailer_id)
  references public.workshops (id, retailer_id);
alter table public.revenue_share_entries
  add constraint revenue_share_entries_source_event_ret_fkey
  foreign key (source_event_id, retailer_id)
  references public.advertising_events (id, retailer_id);
alter table public.rfid_sweep_observations
  add constraint rfid_sweep_observations_location_ret_fkey
  foreign key (location_id, retailer_id)
  references public.stock_locations (id, retailer_id) on delete cascade;
alter table public.service_bookings
  add constraint service_bookings_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.service_bookings
  add constraint service_bookings_entitlement_entry_ret_fkey
  foreign key (entitlement_entry_id, retailer_id)
  references public.service_entitlement_entries (id, retailer_id);
alter table public.service_care_records
  add constraint service_care_records_alteration_ret_fkey
  foreign key (alteration_id, retailer_id)
  references public.alteration_work_orders (id, retailer_id);
alter table public.service_care_records
  add constraint service_care_records_physical_garment_ret_fkey
  foreign key (physical_garment_id, retailer_id)
  references public.physical_garments (id, retailer_id);
alter table public.service_care_records
  add constraint service_care_records_wardrobe_item_ret_fkey
  foreign key (wardrobe_item_id, retailer_id)
  references public.wardrobe_items (id, retailer_id);
alter table public.service_partner_custody_events
  add constraint service_partner_custody_events_engagement_ret_fkey
  foreign key (engagement_id, retailer_id)
  references public.service_partner_engagements (id, retailer_id) on delete cascade;
alter table public.service_partner_engagements
  add constraint service_partner_engagements_alteration_ret_fkey
  foreign key (alteration_id, retailer_id)
  references public.alteration_work_orders (id, retailer_id);
alter table public.service_partner_engagements
  add constraint service_partner_engagements_booking_ret_fkey
  foreign key (booking_id, retailer_id)
  references public.service_bookings (id, retailer_id);
alter table public.service_partner_engagements
  add constraint service_partner_engagements_partner_ret_fkey
  foreign key (partner_id, retailer_id)
  references public.service_partners (id, retailer_id) on delete restrict;
alter table public.service_partner_engagements
  add constraint service_partner_engagements_physical_garment_ret_fkey
  foreign key (physical_garment_id, retailer_id)
  references public.physical_garments (id, retailer_id);
alter table public.service_partner_engagements
  add constraint service_partner_engagements_wardrobe_item_ret_fkey
  foreign key (wardrobe_item_id, retailer_id)
  references public.wardrobe_items (id, retailer_id);
alter table public.service_partner_invoice_lines
  add constraint service_partner_invoice_lines_invoice_ret_fkey
  foreign key (invoice_id, retailer_id)
  references public.service_partner_invoices (id, retailer_id) on delete cascade;
alter table public.service_partner_invoice_lines
  add constraint service_partner_invoice_lines_matched_cost_record_ret_fkey
  foreign key (matched_cost_record_id, retailer_id)
  references public.service_cost_records (id, retailer_id);
alter table public.service_partner_invoices
  add constraint service_partner_invoices_partner_ret_fkey
  foreign key (partner_id, retailer_id)
  references public.service_partners (id, retailer_id) on delete restrict;
alter table public.service_partner_quality_reviews
  add constraint service_partner_quality_reviews_engagement_ret_fkey
  foreign key (engagement_id, retailer_id)
  references public.service_partner_engagements (id, retailer_id) on delete cascade;
alter table public.service_partner_quality_reviews
  add constraint service_partner_quality_reviews_partner_ret_fkey
  foreign key (partner_id, retailer_id)
  references public.service_partners (id, retailer_id) on delete cascade;
alter table public.service_partners
  add constraint service_partners_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.service_recovery_budget_requests
  add constraint service_recovery_budget_requests_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id);
alter table public.staff_announcement_acknowledgements
  add constraint staff_announcement_acknowledgements_announcement_ret_fkey
  foreign key (announcement_id, retailer_id)
  references public.staff_announcements (id, retailer_id) on delete cascade;
alter table public.staff_announcements
  add constraint staff_announcements_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id) on delete cascade;
alter table public.staff_coaching_observations
  add constraint staff_coaching_observations_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.staff_coaching_observations
  add constraint staff_coaching_observations_ceremony_version_ret_fkey
  foreign key (ceremony_version_id, retailer_id)
  references public.service_ceremony_versions (id, retailer_id);
alter table public.staff_learning_sessions
  add constraint staff_learning_sessions_contribution_ret_fkey
  foreign key (contribution_id, retailer_id)
  references public.staff_learning_contributions (id, retailer_id);
alter table public.staff_learning_sessions
  add constraint staff_learning_sessions_host_branch_ret_fkey
  foreign key (host_branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.staff_recognition_acts
  add constraint staff_recognition_acts_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.staff_recognition_acts
  add constraint staff_recognition_acts_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id);
alter table public.staff_shift_closeouts
  add constraint staff_shift_closeouts_extra_mile_act_ret_fkey
  foreign key (extra_mile_act_id, retailer_id)
  references public.staff_recognition_acts (id, retailer_id);
alter table public.staff_shift_swap_requests
  add constraint staff_shift_swap_requests_shift_ret_fkey
  foreign key (shift_id, retailer_id)
  references public.staff_shifts (id, retailer_id) on delete cascade;
alter table public.stock_count_lines
  add constraint stock_count_lines_session_ret_fkey
  foreign key (session_id, retailer_id)
  references public.stock_count_sessions (id, retailer_id) on delete cascade;
alter table public.stock_count_sessions
  add constraint stock_count_sessions_location_ret_fkey
  foreign key (location_id, retailer_id)
  references public.stock_locations (id, retailer_id) on delete cascade;
alter table public.stock_ledger_entries
  add constraint stock_ledger_entries_count_session_ret_fkey
  foreign key (count_session_id, retailer_id)
  references public.stock_count_sessions (id, retailer_id);
alter table public.stock_ledger_entries
  add constraint stock_ledger_entries_location_ret_fkey
  foreign key (location_id, retailer_id)
  references public.stock_locations (id, retailer_id) on delete restrict;
alter table public.stock_locations
  add constraint stock_locations_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.stock_risk_flags
  add constraint stock_risk_flags_ledger_entry_ret_fkey
  foreign key (ledger_entry_id, retailer_id)
  references public.stock_ledger_entries (id, retailer_id) on delete cascade;
alter table public.stock_risk_flags
  add constraint stock_risk_flags_location_ret_fkey
  foreign key (location_id, retailer_id)
  references public.stock_locations (id, retailer_id) on delete cascade;
alter table public.store_comparison_records
  add constraint store_comparison_records_session_ret_fkey
  foreign key (session_id, retailer_id)
  references public.store_sessions (id, retailer_id) on delete cascade;
alter table public.store_observations
  add constraint store_observations_zone_ret_fkey
  foreign key (zone_id, retailer_id)
  references public.store_zones (id, retailer_id) on delete cascade;
alter table public.store_sessions
  add constraint store_sessions_appointment_ret_fkey
  foreign key (appointment_id, retailer_id)
  references public.appointments (id, retailer_id);
alter table public.store_sessions
  add constraint store_sessions_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id);
alter table public.store_zones
  add constraint store_zones_branch_ret_fkey
  foreign key (branch_id, retailer_id)
  references public.retailer_branches (id, retailer_id) on delete cascade;
alter table public.supply_complaint_cases
  add constraint supply_complaint_cases_order_ret_fkey
  foreign key (order_id, retailer_id)
  references public.orders (id, retailer_id);
alter table public.supply_complaint_cases
  add constraint supply_complaint_cases_piece_ret_fkey
  foreign key (piece_id, retailer_id)
  references public.production_pieces (id, retailer_id);
alter table public.wardrobe_items
  add constraint wardrobe_items_physical_garment_ret_fkey
  foreign key (physical_garment_id, retailer_id)
  references public.physical_garments (id, retailer_id);
alter table public.wardrobe_items
  add constraint wardrobe_items_product_ret_fkey
  foreign key (product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.wardrobe_roadmap_gaps
  add constraint wardrobe_roadmap_gaps_filled_by_product_ret_fkey
  foreign key (filled_by_product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.wardrobe_roadmap_gaps
  add constraint wardrobe_roadmap_gaps_filled_by_wardrobe_item_ret_fkey
  foreign key (filled_by_wardrobe_item_id, retailer_id)
  references public.wardrobe_items (id, retailer_id);
alter table public.wardrobe_roadmap_gaps
  add constraint wardrobe_roadmap_gaps_roadmap_ret_fkey
  foreign key (roadmap_id, retailer_id)
  references public.wardrobe_roadmaps (id, retailer_id) on delete cascade;
alter table public.wardrobe_roadmap_goals
  add constraint wardrobe_roadmap_goals_roadmap_ret_fkey
  foreign key (roadmap_id, retailer_id)
  references public.wardrobe_roadmaps (id, retailer_id) on delete cascade;
alter table public.wardrobe_roadmap_stages
  add constraint wardrobe_roadmap_stages_gap_ret_fkey
  foreign key (gap_id, retailer_id)
  references public.wardrobe_roadmap_gaps (id, retailer_id);
alter table public.wardrobe_roadmap_stages
  add constraint wardrobe_roadmap_stages_roadmap_ret_fkey
  foreign key (roadmap_id, retailer_id)
  references public.wardrobe_roadmaps (id, retailer_id) on delete cascade;
alter table public.wardrobe_roadmap_stages
  add constraint wardrobe_roadmap_stages_suggested_product_ret_fkey
  foreign key (suggested_product_id, retailer_id)
  references public.products (id, retailer_id);
alter table public.wardrobe_roadmap_stages
  add constraint wardrobe_roadmap_stages_suggested_wardrobe_item_ret_fkey
  foreign key (suggested_wardrobe_item_id, retailer_id)
  references public.wardrobe_items (id, retailer_id);
