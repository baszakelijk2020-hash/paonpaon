-- Lets a corporate client plan and organize their own office-visit
-- programme from their own customer environment, instead of only
-- through retailer staff. A "corporate contact" is modeled as an
-- ordinary `customers` row with `corporate_account_id` set — it reuses
-- the existing customer auth/session machinery rather than inventing a
-- second identity system, the same way `corporate_wearers` reuses its
-- own separate portal for a different persona (garment recipients, not
-- account administrators).
alter table public.customers
  add column corporate_account_id uuid references public.corporate_accounts(id);

create index customers_corporate_account_idx
  on public.customers (corporate_account_id)
  where corporate_account_id is not null;

comment on column public.customers.corporate_account_id is
  'Set when this customer is the corporate contact managing a
   corporate_accounts row — grants self-service RLS access to that
   account''s programmes, office-visit slots and requests. NULL for an
   ordinary retail customer.';

-- A corporate contact can read their own account's programmes (mirrors
-- corporate_programmes_wearer_select, added for the wearer portal).
create policy corporate_programmes_contact_select
  on public.corporate_programmes for select to authenticated using (
    account_id in (
      select corporate_account_id from public.customers
      where user_id = auth.uid() and corporate_account_id is not null
    )
  );

-- A corporate contact can read their own account row (for display —
-- e.g. "Acme Corp" as a page heading).
create policy corporate_accounts_contact_select
  on public.corporate_accounts for select to authenticated using (
    id in (
      select corporate_account_id from public.customers
      where user_id = auth.uid() and corporate_account_id is not null
    )
  );

-- A corporate contact can create, read and cancel (via update) visit
-- slots for any programme under their own account. Additive alongside
-- the existing staff-only policies — RLS policies for the same command
-- are OR'd, so this never widens staff access.
create policy corporate_visit_slots_contact_select
  on public.corporate_visit_slots for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.customers c on c.corporate_account_id = p.account_id
      where c.user_id = auth.uid() and c.corporate_account_id is not null
    )
  );

create policy corporate_visit_slots_contact_insert
  on public.corporate_visit_slots for insert to authenticated with check (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.customers c on c.corporate_account_id = p.account_id
      where c.user_id = auth.uid() and c.corporate_account_id is not null
    )
  );

create policy corporate_visit_slots_contact_update
  on public.corporate_visit_slots for update to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.customers c on c.corporate_account_id = p.account_id
      where c.user_id = auth.uid() and c.corporate_account_id is not null
    )
  ) with check (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.customers c on c.corporate_account_id = p.account_id
      where c.user_id = auth.uid() and c.corporate_account_id is not null
    )
  );

-- Read-only visibility into incoming requests for the contact's own
-- programmes — resolving/scheduling a request stays a staff action.
create policy corporate_office_visit_requests_contact_select
  on public.corporate_office_visit_requests for select to authenticated using (
    programme_id in (
      select p.id from public.corporate_programmes p
      join public.customers c on c.corporate_account_id = p.account_id
      where c.user_id = auth.uid() and c.corporate_account_id is not null
    )
  );

grant select, insert, update on public.corporate_visit_slots to authenticated;
grant select on public.corporate_programmes to authenticated;
grant select on public.corporate_accounts to authenticated;
grant select on public.corporate_office_visit_requests to authenticated;
