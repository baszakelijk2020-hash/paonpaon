-- PHASE 18.9 (BD-109): adds contract value tracking and repair exception kind.
--
-- 1. contract_value fields (nullable, staff-set) on corporate_programmes:
--    follows the same money-field convention as every other amount in PAON
--    (currency text + amount_minor_units integer).
--
-- 2. repair exception kind: new value in the corporate_exceptions.kind enum,
--    allowing repair issues to be tracked separately from damage.

alter table public.corporate_programmes
  add column if not exists contract_value_minor_units integer
    check (contract_value_minor_units is null or contract_value_minor_units >= 0),
  add column if not exists contract_value_currency text;

alter table public.corporate_exceptions
  drop constraint corporate_exceptions_kind_check;
alter table public.corporate_exceptions
  add constraint corporate_exceptions_kind_check check (
    kind in (
      'leaver_return', 'service_required', 'fit_issue', 'entitlement_dispute',
      'damaged', 'missing', 'alteration_request', 'replacement_request', 'repair'
    )
  );
