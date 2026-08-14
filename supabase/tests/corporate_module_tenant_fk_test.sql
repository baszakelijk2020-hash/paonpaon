-- Proof for 20260815000010: the corporate/BD chain can no longer be
-- attached across tenants, and the two non-CASCADE delete actions this
-- migration had to reason about actually behave as designed.
--
-- The negative case runs as a fully authenticated House B manager writing a
-- row that satisfies the corporate_wearers_staff_insert policy completely —
-- the row's own retailer_id is House B's and the caller's role is allowed.
-- Only the composite foreign key stops it, so 23503 is the expected error;
-- a 42501 would mean RLS blocked it first and proved nothing.
--
-- The deletion cases matter because this migration deliberately does NOT
-- use CASCADE everywhere. corporate_opportunities.linked_account_id is
-- ON DELETE SET NULL on its single-column key, and a composite SET NULL is
-- impossible there (it would also null retailer_id, which is NOT NULL).
-- The composite is therefore NO ACTION, and this test proves the resulting
-- interaction is safe rather than merely arguing it: deleting an account
-- must null the link and leave the opportunity intact, not raise.

begin;
select plan(7);

insert into public.retailers (id, legal_name, display_name, slug, status)
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'Corp House A Ltd', 'Corp House A', 'corp-house-a', 'active'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Corp House B Ltd', 'Corp House B', 'corp-house-b', 'active'
  );

insert into public.corporate_accounts (
  id, retailer_id, legal_name, account_reference
) values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001', 'House A Client Co', 'ACC-A-1'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002', 'House B Client Co', 'ACC-B-1'
  );

insert into public.corporate_programmes (id, retailer_id, account_id, name)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001', 'House A Uniform Programme'
  ),
  (
    'b3000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002', 'House B Uniform Programme'
  );

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  'b4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'corp.houseb@example.test', '{}', '{}', now(), now()
);

insert into public.retailer_staff_members (
  id, retailer_id, user_id, full_name, email, role, accepted_at
) values (
  'b5000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000002',
  'b4000000-0000-0000-0000-000000000002',
  'House B Manager', 'corp.houseb@example.test', 'manager', now()
);

select is(
  (
    select count(*)::int
    from pg_constraint
    where contype = 'f'
      and conname in (
        'corporate_programmes_account_retailer_fkey',
        'corporate_wearers_programme_retailer_fkey',
        'corporate_entitlement_versions_programme_retailer_fkey',
        'corporate_issue_records_wearer_retailer_fkey',
        'corporate_issue_records_entitlement_retailer_fkey',
        'corporate_exceptions_programme_retailer_fkey',
        'corporate_exceptions_wearer_retailer_fkey',
        'corporate_rollout_days_programme_retailer_fkey',
        'corporate_opportunities_linked_account_retailer_fkey',
        'corporate_tenders_opportunity_retailer_fkey',
        'corporate_opportunity_signals_opportunity_retailer_fkey',
        'corporate_tender_versions_tender_retailer_fkey',
        'corporate_tender_approvals_version_retailer_fkey',
        'advisor_capture_bundles_session_retailer_fkey'
      )
  ),
  14,
  'the whole corporate/BD chain carries composite tenant foreign keys'
);

-- The audit trail of what was issued must not vanish with an entitlement
-- version: RESTRICT is preserved, not silently widened to CASCADE.
select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'corporate_issue_records_entitlement_retailer_fkey'
  ),
  'r',
  'the issue-record composite key preserves ON DELETE RESTRICT'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'corporate_opportunities_linked_account_retailer_fkey'
  ),
  'a',
  'the linked-account composite key is NO ACTION, leaving SET NULL to the single-column key'
);

set local role authenticated;
set local request.jwt.claims = '{
  "sub": "b4000000-0000-0000-0000-000000000002",
  "role": "authenticated",
  "app_metadata": {
    "retailer_id": "b1000000-0000-0000-0000-000000000002",
    "retailer_role": "manager"
  }
}';

select throws_ok(
  $$
    insert into public.corporate_wearers (
      retailer_id, programme_id, employee_reference, display_name,
      role_key, joined_on
    ) values (
      'b1000000-0000-0000-0000-000000000002',
      'b3000000-0000-0000-0000-000000000001',
      'EMP-INJECT-1', 'Injected Wearer', 'field_staff', current_date
    )
  $$,
  '23503',
  null,
  'an authenticated House B manager cannot add a wearer to House A''s programme'
);

select lives_ok(
  $$
    insert into public.corporate_wearers (
      retailer_id, programme_id, employee_reference, display_name,
      role_key, joined_on
    ) values (
      'b1000000-0000-0000-0000-000000000002',
      'b3000000-0000-0000-0000-000000000002',
      'EMP-B-1', 'Legitimate Wearer', 'field_staff', current_date
    )
  $$,
  'the same manager can still add a wearer to their own programme'
);

reset request.jwt.claims;
set local role none;

-- Behavioural proof of the SET NULL / NO ACTION interaction.
insert into public.corporate_opportunities (
  id, retailer_id, company_name, linked_account_id
) values (
  'b6000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000002',
  'House B Prospect Co',
  'b2000000-0000-0000-0000-000000000002'
);

select lives_ok(
  $$
    delete from public.corporate_accounts
    where id = 'b2000000-0000-0000-0000-000000000002'
  $$,
  'deleting an account does not raise despite the composite NO ACTION key'
);

select is(
  (
    select linked_account_id
    from public.corporate_opportunities
    where id = 'b6000000-0000-0000-0000-000000000002'
  ),
  null,
  'the opportunity survives with its account link nulled, exactly as before'
);

select * from finish();
rollback;
