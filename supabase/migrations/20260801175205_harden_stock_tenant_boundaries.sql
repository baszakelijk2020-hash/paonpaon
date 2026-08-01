-- R0.1: stock/POS tenant boundaries are relationships, not a retailer_id
-- label that callers may contradict.
--
-- Stage 13 protected rows with RLS on their own retailer_id, but several
-- foreign keys referenced only a globally unique id. A caller could insert a
-- retailer-A ledger row that cited retailer-B's location or variant. RLS then
-- presented the poisoned row as retailer A's stock movement. Composite
-- foreign keys make every directly tenant-owned relationship agree in the
-- database. Product variants inherit tenancy through products, so the three
-- variant edges use one constraint trigger instead of denormalising another
-- retailer_id column.

-- Referenced composite keys. The leading retailer_id also gives the new
-- foreign keys a useful lookup order.
create unique index if not exists retailer_branches_retailer_id_id_uidx
  on public.retailer_branches (retailer_id, id);
create unique index if not exists retailer_staff_members_retailer_id_id_uidx
  on public.retailer_staff_members (retailer_id, id);
create unique index if not exists customers_retailer_id_id_uidx
  on public.customers (retailer_id, id);
create unique index if not exists alteration_work_orders_retailer_id_id_uidx
  on public.alteration_work_orders (retailer_id, id);
create unique index if not exists production_specs_retailer_id_id_uidx
  on public.production_specs (retailer_id, id);
create unique index if not exists stock_locations_retailer_id_id_uidx
  on public.stock_locations (retailer_id, id);
create unique index if not exists stock_count_sessions_retailer_id_id_uidx
  on public.stock_count_sessions (retailer_id, id);
create unique index if not exists stock_ledger_entries_retailer_id_id_uidx
  on public.stock_ledger_entries (retailer_id, id);
create unique index if not exists pos_transactions_retailer_id_id_uidx
  on public.pos_transactions (retailer_id, id);

-- Child-side indexes: Postgres does not create these for foreign keys.
create index if not exists stock_locations_retailer_branch_idx
  on public.stock_locations (retailer_id, branch_id)
  where branch_id is not null;
create index if not exists stock_count_sessions_retailer_location_idx
  on public.stock_count_sessions (retailer_id, location_id);
create index if not exists stock_count_sessions_retailer_staff_idx
  on public.stock_count_sessions (retailer_id, opened_by_staff_id);
create index if not exists stock_count_lines_retailer_session_idx
  on public.stock_count_lines (retailer_id, session_id);
create index if not exists stock_count_lines_retailer_staff_idx
  on public.stock_count_lines (retailer_id, counted_by_staff_id)
  where counted_by_staff_id is not null;
create index if not exists stock_ledger_entries_retailer_location_idx
  on public.stock_ledger_entries (retailer_id, location_id);
create index if not exists stock_ledger_entries_retailer_reversal_idx
  on public.stock_ledger_entries (retailer_id, reverses_entry_id)
  where reverses_entry_id is not null;
create index if not exists stock_ledger_entries_retailer_count_session_idx
  on public.stock_ledger_entries (retailer_id, count_session_id)
  where count_session_id is not null;
create index if not exists stock_ledger_entries_retailer_staff_idx
  on public.stock_ledger_entries (retailer_id, recorded_by_staff_id)
  where recorded_by_staff_id is not null;
create index if not exists stock_risk_flags_retailer_location_idx
  on public.stock_risk_flags (retailer_id, location_id);
create index if not exists stock_risk_flags_retailer_ledger_idx
  on public.stock_risk_flags (retailer_id, ledger_entry_id)
  where ledger_entry_id is not null;
create index if not exists stock_risk_flags_retailer_requester_idx
  on public.stock_risk_flags (retailer_id, requested_by_staff_id);
create index if not exists stock_risk_flags_retailer_approver_idx
  on public.stock_risk_flags (retailer_id, approved_by_staff_id)
  where approved_by_staff_id is not null;
create index if not exists rfid_observations_retailer_location_idx
  on public.rfid_sweep_observations (retailer_id, location_id);
create index if not exists pos_transactions_retailer_location_idx
  on public.pos_transactions (retailer_id, location_id);
create index if not exists pos_transactions_retailer_customer_idx
  on public.pos_transactions (retailer_id, customer_id)
  where customer_id is not null;
create index if not exists pos_transactions_retailer_staff_idx
  on public.pos_transactions (retailer_id, staff_id)
  where staff_id is not null;
create index if not exists pos_transactions_retailer_return_idx
  on public.pos_transactions (retailer_id, returns_transaction_id)
  where returns_transaction_id is not null;
create index if not exists pos_lines_retailer_transaction_idx
  on public.pos_transaction_lines (retailer_id, transaction_id);
create index if not exists pos_lines_retailer_alteration_idx
  on public.pos_transaction_lines (retailer_id, alteration_id)
  where alteration_id is not null;
create index if not exists pos_lines_retailer_production_idx
  on public.pos_transaction_lines (retailer_id, production_spec_id)
  where production_spec_id is not null;
create index if not exists pos_lines_retailer_reservation_idx
  on public.pos_transaction_lines (retailer_id, reservation_entry_id)
  where reservation_entry_id is not null;
create index if not exists pos_payments_retailer_transaction_idx
  on public.pos_payments (retailer_id, transaction_id);

-- NOT VALID keeps the initial lock short. Validation below still refuses an
-- upgrade if historical rows already cross a tenant boundary; the operator
-- must investigate rather than silently rewrite audit/stock history.
alter table public.stock_locations
  add constraint stock_locations_branch_same_retailer_fk
  foreign key (retailer_id, branch_id)
  references public.retailer_branches (retailer_id, id)
  on delete set null (branch_id) not valid;

alter table public.stock_count_sessions
  add constraint stock_count_sessions_location_same_retailer_fk
  foreign key (retailer_id, location_id)
  references public.stock_locations (retailer_id, id)
  on delete cascade not valid,
  add constraint stock_count_sessions_staff_same_retailer_fk
  foreign key (retailer_id, opened_by_staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete restrict not valid;

alter table public.stock_count_lines
  add constraint stock_count_lines_session_same_retailer_fk
  foreign key (retailer_id, session_id)
  references public.stock_count_sessions (retailer_id, id)
  on delete cascade not valid,
  add constraint stock_count_lines_staff_same_retailer_fk
  foreign key (retailer_id, counted_by_staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete set null (counted_by_staff_id) not valid;

alter table public.stock_ledger_entries
  add constraint stock_ledger_location_same_retailer_fk
  foreign key (retailer_id, location_id)
  references public.stock_locations (retailer_id, id)
  on delete restrict not valid,
  add constraint stock_ledger_reversal_same_retailer_fk
  foreign key (retailer_id, reverses_entry_id)
  references public.stock_ledger_entries (retailer_id, id)
  on delete restrict not valid,
  add constraint stock_ledger_count_session_same_retailer_fk
  foreign key (retailer_id, count_session_id)
  references public.stock_count_sessions (retailer_id, id)
  on delete set null (count_session_id) not valid,
  add constraint stock_ledger_staff_same_retailer_fk
  foreign key (retailer_id, recorded_by_staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete set null (recorded_by_staff_id) not valid;

alter table public.stock_risk_flags
  add constraint stock_risk_location_same_retailer_fk
  foreign key (retailer_id, location_id)
  references public.stock_locations (retailer_id, id)
  on delete cascade not valid,
  add constraint stock_risk_ledger_same_retailer_fk
  foreign key (retailer_id, ledger_entry_id)
  references public.stock_ledger_entries (retailer_id, id)
  on delete cascade not valid,
  add constraint stock_risk_requester_same_retailer_fk
  foreign key (retailer_id, requested_by_staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete restrict not valid,
  add constraint stock_risk_approver_same_retailer_fk
  foreign key (retailer_id, approved_by_staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete set null (approved_by_staff_id) not valid;

alter table public.rfid_sweep_observations
  add constraint rfid_observations_location_same_retailer_fk
  foreign key (retailer_id, location_id)
  references public.stock_locations (retailer_id, id)
  on delete cascade not valid;

alter table public.pos_transactions
  add constraint pos_transactions_location_same_retailer_fk
  foreign key (retailer_id, location_id)
  references public.stock_locations (retailer_id, id)
  on delete restrict not valid,
  add constraint pos_transactions_customer_same_retailer_fk
  foreign key (retailer_id, customer_id)
  references public.customers (retailer_id, id)
  on delete set null (customer_id) not valid,
  add constraint pos_transactions_staff_same_retailer_fk
  foreign key (retailer_id, staff_id)
  references public.retailer_staff_members (retailer_id, id)
  on delete set null (staff_id) not valid,
  add constraint pos_transactions_return_same_retailer_fk
  foreign key (retailer_id, returns_transaction_id)
  references public.pos_transactions (retailer_id, id)
  on delete restrict not valid;

alter table public.pos_transaction_lines
  add constraint pos_lines_transaction_same_retailer_fk
  foreign key (retailer_id, transaction_id)
  references public.pos_transactions (retailer_id, id)
  on delete cascade not valid,
  add constraint pos_lines_alteration_same_retailer_fk
  foreign key (retailer_id, alteration_id)
  references public.alteration_work_orders (retailer_id, id)
  on delete set null (alteration_id) not valid,
  add constraint pos_lines_production_same_retailer_fk
  foreign key (retailer_id, production_spec_id)
  references public.production_specs (retailer_id, id)
  on delete set null (production_spec_id) not valid,
  add constraint pos_lines_reservation_same_retailer_fk
  foreign key (retailer_id, reservation_entry_id)
  references public.stock_ledger_entries (retailer_id, id)
  on delete set null (reservation_entry_id) not valid;

alter table public.pos_payments
  add constraint pos_payments_transaction_same_retailer_fk
  foreign key (retailer_id, transaction_id)
  references public.pos_transactions (retailer_id, id)
  on delete cascade not valid;

-- Product variants do not duplicate retailer_id. Resolve the authoritative
-- tenant through product_variants.product_id -> products.retailer_id.
create or replace function public.enforce_stock_variant_retailer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_variant_retailer_id uuid;
begin
  if new.variant_id is null then
    return new;
  end if;

  select p.retailer_id into v_variant_retailer_id
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = new.variant_id;

  if v_variant_retailer_id is null
    or v_variant_retailer_id <> new.retailer_id then
    raise foreign_key_violation using
      message = 'variant_id must belong to the row retailer_id',
      table = tg_table_name,
      constraint = tg_name;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_stock_variant_retailer()
  from public, anon, authenticated, service_role;

create constraint trigger stock_count_lines_variant_same_retailer
  after insert or update of retailer_id, variant_id on public.stock_count_lines
  deferrable initially immediate
  for each row execute function public.enforce_stock_variant_retailer();

create constraint trigger stock_ledger_variant_same_retailer
  after insert or update of retailer_id, variant_id on public.stock_ledger_entries
  deferrable initially immediate
  for each row execute function public.enforce_stock_variant_retailer();

create constraint trigger pos_lines_variant_same_retailer
  after insert or update of retailer_id, variant_id on public.pos_transaction_lines
  deferrable initially immediate
  for each row execute function public.enforce_stock_variant_retailer();

-- Validate every historical edge. Any failure is an upgrade blocker and must
-- be inspected on a restored copy; stock history is never auto-reassigned.
alter table public.stock_locations
  validate constraint stock_locations_branch_same_retailer_fk;
alter table public.stock_count_sessions
  validate constraint stock_count_sessions_location_same_retailer_fk,
  validate constraint stock_count_sessions_staff_same_retailer_fk;
alter table public.stock_count_lines
  validate constraint stock_count_lines_session_same_retailer_fk,
  validate constraint stock_count_lines_staff_same_retailer_fk;
alter table public.stock_ledger_entries
  validate constraint stock_ledger_location_same_retailer_fk,
  validate constraint stock_ledger_reversal_same_retailer_fk,
  validate constraint stock_ledger_count_session_same_retailer_fk,
  validate constraint stock_ledger_staff_same_retailer_fk;
alter table public.stock_risk_flags
  validate constraint stock_risk_location_same_retailer_fk,
  validate constraint stock_risk_ledger_same_retailer_fk,
  validate constraint stock_risk_requester_same_retailer_fk,
  validate constraint stock_risk_approver_same_retailer_fk;
alter table public.rfid_sweep_observations
  validate constraint rfid_observations_location_same_retailer_fk;
alter table public.pos_transactions
  validate constraint pos_transactions_location_same_retailer_fk,
  validate constraint pos_transactions_customer_same_retailer_fk,
  validate constraint pos_transactions_staff_same_retailer_fk,
  validate constraint pos_transactions_return_same_retailer_fk;
alter table public.pos_transaction_lines
  validate constraint pos_lines_transaction_same_retailer_fk,
  validate constraint pos_lines_alteration_same_retailer_fk,
  validate constraint pos_lines_production_same_retailer_fk,
  validate constraint pos_lines_reservation_same_retailer_fk;
alter table public.pos_payments
  validate constraint pos_payments_transaction_same_retailer_fk;

-- These inventory helpers were created as SECURITY DEFINER in public without
-- explicit ACLs, so Postgres granted EXECUTE to PUBLIC. They are internal
-- trigger/maintenance functions, not Data API endpoints.
revoke all on function public.retailer_online_location(uuid)
  from public, anon, authenticated;
grant execute on function public.retailer_online_location(uuid)
  to service_role;

revoke all on function public.variant_ledger_balance(uuid)
  from public, anon, authenticated;
grant execute on function public.variant_ledger_balance(uuid)
  to service_role;

revoke all on function public.count_inventory_disagreements()
  from public, anon, authenticated;
grant execute on function public.count_inventory_disagreements()
  to service_role;

revoke all on function public.record_direct_inventory_write()
  from public, anon, authenticated, service_role;
revoke all on function public.record_new_variant_opening_stock()
  from public, anon, authenticated, service_role;
revoke all on function public.sync_variant_inventory_from_ledger()
  from public, anon, authenticated, service_role;

-- Full SECURITY DEFINER audit: trigger functions are never RPC endpoints.
-- Postgres grants new functions to PUBLIC by default, so remove execution
-- even when an earlier migration omitted an ACL. Triggers continue to execute
-- as their owner; callers cannot invoke the privileged body directly.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_function
    );
  end loop;
end $$;

-- These helpers support authenticated RLS/storage policies and internal
-- service work. Anonymous callers have no legitimate direct use.
revoke all on function public.current_staff_id()
  from public, anon;
grant execute on function public.current_staff_id()
  to authenticated, service_role;
revoke all on function public.current_workshop_id()
  from public, anon;
grant execute on function public.current_workshop_id()
  to authenticated, service_role;
revoke all on function public.can_access_alteration_storage_object(text)
  from public, anon;
grant execute on function public.can_access_alteration_storage_object(text)
  to authenticated, service_role;
revoke all on function public.can_access_alteration_work_order(uuid)
  from public, anon;
grant execute on function public.can_access_alteration_work_order(uuid)
  to authenticated, service_role;
revoke all on function public.can_access_conversation_storage_object(text)
  from public, anon;
grant execute on function public.can_access_conversation_storage_object(text)
  to authenticated, service_role;
revoke all on function public.can_access_physical_garment(uuid)
  from public, anon;
grant execute on function public.can_access_physical_garment(uuid)
  to authenticated, service_role;

-- This legacy RPC creates a live retailer and changes a prospect stage but
-- performs no caller authorization. It is unused by the apps and must remain
-- an internal service operation until it is redesigned as an atomic,
-- platform-staff-authorized onboarding transition.
revoke all on function public.convert_pilot_to_live_retailer(uuid)
  from public, anon, authenticated;
grant execute on function public.convert_pilot_to_live_retailer(uuid)
  to service_role;

comment on function public.retailer_online_location(uuid) is
  'Internal stock helper. Creates only the location for the retailer derived by trusted stock triggers; direct Data API execution is revoked.';

comment on function public.convert_pilot_to_live_retailer(uuid) is
  'Legacy internal pilot conversion. Direct anon/authenticated execution is revoked because the function has no caller authorization; redesign before exposing it.';

-- A caller-mutable search_path lets an attacker place lookalike relations or
-- functions ahead of public. Pin every existing public routine to the only
-- application schema it needs, while retaining pg_temp at the end for
-- routines that legitimately use temporary objects. This also covers older
-- SECURITY INVOKER helpers flagged by the Supabase security advisor.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=public, pg_temp']
  loop
    execute format(
      'alter function %s set search_path = public, pg_temp',
      v_function
    );
  end loop;
end $$;
