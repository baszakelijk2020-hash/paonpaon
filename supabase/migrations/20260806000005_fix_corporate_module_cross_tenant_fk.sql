-- Same class of bug fixed in 20260806000004 for the wedding-party child
-- tables, found systemically across the corporate/BD module by a targeted
-- audit after that fix: every child table below has its own `retailer_id`
-- AND a foreign key to a parent object that also carries its own
-- `retailer_id`, but the staff-insert RLS policy (bulk-generated or
-- hand-written) only ever checked the CHILD row's own `retailer_id`
-- against `current_retailer_id()` — never that the referenced parent row
-- actually belonged to that same retailer. A staff member could attach a
-- row (a tender approval, an entitlement issue, an advisor-capture
-- insight, a business-development signal) to a DIFFERENT retailer's
-- account/programme/wearer/opportunity/tender by supplying their own
-- retailer_id on the child while pointing the parent FK at the other
-- retailer's row.
--
-- Fixed the same way: a unique (id, retailer_id) constraint on every
-- parent table used below, then a composite foreign key
-- (parent_fk_column, retailer_id) references parent (id, retailer_id) on
-- every child. A cross-tenant reference becomes impossible at the
-- database level across the whole corporate/BD chain:
-- corporate_accounts -> corporate_programmes -> corporate_wearers /
-- corporate_entitlement_versions -> corporate_issue_records /
-- corporate_exceptions, and corporate_accounts -> corporate_opportunities
-- -> corporate_tenders -> corporate_tender_versions ->
-- corporate_tender_approvals, plus corporate_opportunity_signals and the
-- unrelated advisor_capture_sessions -> advisor_capture_bundles pair.

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
  references public.corporate_accounts (id, retailer_id);

alter table public.corporate_wearers
  add constraint corporate_wearers_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id);

alter table public.corporate_entitlement_versions
  add constraint corporate_entitlement_versions_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id);

alter table public.corporate_issue_records
  add constraint corporate_issue_records_wearer_retailer_fkey
  foreign key (wearer_id, retailer_id)
  references public.corporate_wearers (id, retailer_id);
alter table public.corporate_issue_records
  add constraint corporate_issue_records_entitlement_retailer_fkey
  foreign key (entitlement_version_id, retailer_id)
  references public.corporate_entitlement_versions (id, retailer_id);

alter table public.corporate_exceptions
  add constraint corporate_exceptions_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id);
alter table public.corporate_exceptions
  add constraint corporate_exceptions_wearer_retailer_fkey
  foreign key (wearer_id, retailer_id)
  references public.corporate_wearers (id, retailer_id);

alter table public.corporate_rollout_days
  add constraint corporate_rollout_days_programme_retailer_fkey
  foreign key (programme_id, retailer_id)
  references public.corporate_programmes (id, retailer_id);

alter table public.corporate_opportunities
  add constraint corporate_opportunities_linked_account_retailer_fkey
  foreign key (linked_account_id, retailer_id)
  references public.corporate_accounts (id, retailer_id);

alter table public.corporate_tenders
  add constraint corporate_tenders_opportunity_retailer_fkey
  foreign key (opportunity_id, retailer_id)
  references public.corporate_opportunities (id, retailer_id);

alter table public.corporate_opportunity_signals
  add constraint corporate_opportunity_signals_opportunity_retailer_fkey
  foreign key (opportunity_id, retailer_id)
  references public.corporate_opportunities (id, retailer_id);

alter table public.corporate_tender_versions
  add constraint corporate_tender_versions_tender_retailer_fkey
  foreign key (tender_id, retailer_id)
  references public.corporate_tenders (id, retailer_id);

alter table public.corporate_tender_approvals
  add constraint corporate_tender_approvals_version_retailer_fkey
  foreign key (tender_version_id, retailer_id)
  references public.corporate_tender_versions (id, retailer_id);

alter table public.advisor_capture_bundles
  add constraint advisor_capture_bundles_session_retailer_fkey
  foreign key (capture_session_id, retailer_id)
  references public.advisor_capture_sessions (id, retailer_id);
