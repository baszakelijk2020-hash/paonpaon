-- The same class of cross-tenant gap fixed in 20260815000000 for the
-- wedding-party child tables, found systemically across the corporate/BD
-- module by a targeted audit.
--
-- Every child table below carries its own `retailer_id` AND a foreign key
-- to a parent that also carries its own `retailer_id`, but the staff-insert
-- RLS policy (bulk-generated or hand-written) only ever checked the CHILD
-- row's `retailer_id` against `current_retailer_id()` — never that the
-- referenced parent actually belonged to that same retailer.
--
-- An authenticated staff member could therefore attach a tender approval,
-- an entitlement issue record, an exception, a rollout day, an opportunity
-- signal or an advisor-capture bundle to a DIFFERENT retailer's account,
-- programme, wearer, opportunity or tender, simply by supplying their own
-- retailer_id on the child while pointing the parent foreign key at the
-- other retailer's row. RLS is satisfied in every case.
--
-- Fixed the same way: a unique (id, retailer_id) constraint on every parent
-- used below, then a composite foreign key (parent_fk_column, retailer_id)
-- on every child, covering these fourteen edges:
--
--   corporate_accounts -> corporate_programmes -> corporate_wearers
--                                              -> corporate_entitlement_versions
--                                              -> corporate_exceptions
--                                              -> corporate_rollout_days
--   corporate_wearers / corporate_entitlement_versions -> corporate_issue_records
--   corporate_accounts -> corporate_opportunities -> corporate_tenders
--                                                 -> corporate_opportunity_signals
--   corporate_tenders -> corporate_tender_versions -> corporate_tender_approvals
--   advisor_capture_sessions -> advisor_capture_bundles
--
-- SCOPE, STATED HONESTLY: this closes the fourteen edges above, which are
-- the ones the original reproduced report covered. It does NOT close the
-- corporate module as a whole. Independent review of the live schema found
-- these sibling tables carrying the identical pattern — their own
-- retailer_id, a foreign key to a tenant-scoped parent, and a staff INSERT
-- policy that checks only `retailer_id = current_retailer_id()` — still
-- without a composite key:
--
--   corporate_projects.account_id            -> corporate_accounts
--   corporate_project_events.project_id      -> corporate_projects
--   corporate_announcements.programme_id     -> corporate_programmes
--   corporate_office_visit_requests.programme_id -> corporate_programmes
--   corporate_renewal_tasks.programme_id     -> corporate_programmes
--   corporate_rollout_slots.rollout_day_id   -> corporate_rollout_days
--   corporate_rollout_slots.wearer_id        -> corporate_wearers
--   corporate_exception_events.exception_id  -> corporate_exceptions
--   corporate_concept_assets.tender_version_id -> corporate_tender_versions
--   corporate_issue_records.order_id         -> orders
--
-- Those are real, currently exploitable by the same method, and are
-- deliberately left to a dedicated follow-up tranche rather than widened
-- into this one: each needs its own ON DELETE analysis and its own negative
-- proof, and a silent scope expansion here would ship unproven constraints.
-- Do not cite this migration as evidence that the corporate module is
-- tenant-safe. See docs/GROUND_TRUTH.md for the full residue count.
--
-- ON DELETE actions are stated explicitly and each one mirrors the existing
-- single-column foreign key it parallels, so deletion behaviour is exactly
-- what it is today. Two are deliberately not CASCADE:
--
--   * corporate_issue_records.entitlement_version_id is RESTRICT today and
--     stays RESTRICT — issue records are the audit trail of what was handed
--     out and must not disappear with an entitlement version.
--
--   * corporate_opportunities.linked_account_id is SET NULL today. A
--     composite SET NULL is impossible here because it would also null
--     retailer_id, which is NOT NULL on every table below. The composite is
--     therefore left at NO ACTION: when an account is deleted, the existing
--     single-column key nulls linked_account_id first, and MATCH SIMPLE
--     then skips the composite check because the referencing column is
--     NULL. That interaction is not left to argument — it is proved by an
--     explicit deletion case in
--     supabase/tests/corporate_module_tenant_fk_test.sql.
--
-- Nullability, deliberate: corporate_opportunities.linked_account_id and
-- corporate_exceptions.wearer_id are nullable and stay nullable. MATCH
-- SIMPLE skipping NULL references is exactly right — an opportunity with no
-- linked account and an exception not tied to a wearer are both legitimate.
-- MATCH FULL would break those valid rows without closing any hole, since
-- retailer_id is NOT NULL everywhere here.
--
-- Verified before writing: zero existing rows violate any of these
-- constraints.

alter table public.corporate_accounts
  add constraint corporate_accounts_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_programmes
  add constraint corporate_programmes_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_wearers
  add constraint corporate_wearers_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_entitlement_versions
  add constraint corporate_entitlement_versions_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_opportunities
  add constraint corporate_opportunities_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_tenders
  add constraint corporate_tenders_id_retailer_id_key unique (id, retailer_id);
alter table public.corporate_tender_versions
  add constraint corporate_tender_versions_id_retailer_id_key unique (id, retailer_id);
alter table public.advisor_capture_sessions
  add constraint advisor_capture_sessions_id_retailer_id_key unique (id, retailer_id);

alter table public.corporate_programmes
  add constraint corporate_programmes_account_retailer_fkey
  foreign key (account_id, retailer_id)
  references public.corporate_accounts (id, retailer_id)
  on delete cascade;

alter table public.corporate_wearers
  add constraint corporate_wearers_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id)
  on delete cascade;

alter table public.corporate_entitlement_versions
  add constraint corporate_entitlement_versions_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id)
  on delete cascade;

alter table public.corporate_issue_records
  add constraint corporate_issue_records_wearer_retailer_fkey
  foreign key (wearer_id, retailer_id)
  references public.corporate_wearers (id, retailer_id)
  on delete cascade;
alter table public.corporate_issue_records
  add constraint corporate_issue_records_entitlement_retailer_fkey
  foreign key (entitlement_version_id, retailer_id)
  references public.corporate_entitlement_versions (id, retailer_id)
  on delete restrict;

alter table public.corporate_exceptions
  add constraint corporate_exceptions_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id)
  on delete cascade;
alter table public.corporate_exceptions
  add constraint corporate_exceptions_wearer_retailer_fkey
  foreign key (wearer_id, retailer_id)
  references public.corporate_wearers (id, retailer_id)
  on delete cascade;

alter table public.corporate_rollout_days
  add constraint corporate_rollout_days_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id)
  on delete cascade;

-- NO ACTION here is intentional; see the header note on SET NULL.
alter table public.corporate_opportunities
  add constraint corporate_opportunities_linked_account_retailer_fkey
  foreign key (linked_account_id, retailer_id)
  references public.corporate_accounts (id, retailer_id);

alter table public.corporate_tenders
  add constraint corporate_tenders_opportunity_retailer_fkey
  foreign key (opportunity_id, retailer_id)
  references public.corporate_opportunities (id, retailer_id)
  on delete cascade;

alter table public.corporate_opportunity_signals
  add constraint corporate_opportunity_signals_opportunity_retailer_fkey
  foreign key (opportunity_id, retailer_id)
  references public.corporate_opportunities (id, retailer_id)
  on delete cascade;

alter table public.corporate_tender_versions
  add constraint corporate_tender_versions_tender_retailer_fkey
  foreign key (tender_id, retailer_id)
  references public.corporate_tenders (id, retailer_id)
  on delete cascade;

alter table public.corporate_tender_approvals
  add constraint corporate_tender_approvals_version_retailer_fkey
  foreign key (tender_version_id, retailer_id)
  references public.corporate_tender_versions (id, retailer_id)
  on delete cascade;

alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_session_retailer_fkey
  foreign key (capture_session_id, retailer_id)
  references public.advisor_capture_sessions (id, retailer_id)
  on delete cascade;
