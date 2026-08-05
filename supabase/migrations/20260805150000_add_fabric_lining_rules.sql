-- PHASE 17.4 (ADV-104): fabric-lining pairing, the sibling of Stage
-- 12.4's `fabric_button_rules` — same shape, same "a missing row means
-- undecided, not permissive" discipline, extended with the
-- standard-vs-upsell split this item's own owner boundary names.
--
-- `standard_lining_keys` must be non-empty (a rule with zero standard
-- options is not a real decision); `upsell_lining_keys` may be empty —
-- not every fabric has a genuine upgrade to offer.

create table if not exists public.fabric_lining_rules (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  fabric_key text not null check (char_length(fabric_key) between 1 and 120),
  standard_lining_keys text[] not null,
  upsell_lining_keys text[] not null default '{}',
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fabric_lining_rules_unique unique (retailer_id, fabric_key),
  constraint fabric_lining_rules_standard_non_empty check (
    array_length(standard_lining_keys, 1) is not null
  )
);

create trigger set_fabric_lining_rules_updated_at
  before update on public.fabric_lining_rules
  for each row execute function public.set_updated_at();

alter table public.fabric_lining_rules enable row level security;
revoke all on table public.fabric_lining_rules from public, anon;
grant select, insert, update on table public.fabric_lining_rules
  to authenticated, service_role;

create policy fabric_lining_rules_retailer_select
  on public.fabric_lining_rules for select to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy fabric_lining_rules_staff_write
  on public.fabric_lining_rules for insert to authenticated with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  );

create policy fabric_lining_rules_staff_update
  on public.fabric_lining_rules for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.fabric_lining_rules is
  'PHASE 17.4 / ADV-104. Fabric-lining pairing, standard vs upsell. '
  'Absence of a row means undecided, not permitted — mirrors '
  'fabric_button_rules (12.4) exactly.';
