-- PHASE 18.1 (BD-101): corporate business-development opportunities and
-- their signals — the pipeline model for the InsiderTailoring build,
-- deliberately without the external-signal-discovery half of it.
--
-- `corporate_opportunity_signals` are manually entered for this slice: the
-- `source` check constraint has no "web_scan" or "public_signal" value,
-- because that data does not exist yet and a schema that accepted it would
-- be a lie the schema tells on an unbuilt feature's behalf.
--
-- `score` is denormalised onto the opportunity row so a pipeline list can
-- sort by it without recomputing on every read, but it is never the
-- source of truth: it is recomputed from `corporate_opportunity_signals`
-- on every write (packages/domain's `scoreOpportunity`, a plain weighted
-- sum with no hidden model call) and the signals remain the inspectable
-- evidence behind it.

create table if not exists public.corporate_opportunities (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  company_name text not null check (char_length(btrim(company_name)) between 2 and 300),
  stage text not null default 'identified' check (
    stage in ('identified', 'qualified', 'tender_sent', 'won', 'lost')
  ),
  score integer not null default 0 check (score between 0 and 100),
  -- Set once won and converted — never a second company record. See
  -- `linkWonOpportunityToAccount` in the repository.
  linked_account_id uuid references public.corporate_accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint corporate_opportunities_won_has_account check (
    stage <> 'won' or linked_account_id is not null
  )
);

create index if not exists corporate_opportunities_retailer_stage_idx
  on public.corporate_opportunities (retailer_id, stage)
  where deleted_at is null;

create table if not exists public.corporate_opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  opportunity_id uuid not null
    references public.corporate_opportunities (id) on delete cascade,
  source text not null check (
    source in (
      'referral', 'inbound_enquiry', 'event', 'existing_customer_link',
      'staff_observation', 'other'
    )
  ),
  detail text not null check (char_length(btrim(detail)) between 3 and 2000),
  observed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists corporate_opportunity_signals_opportunity_idx
  on public.corporate_opportunity_signals (opportunity_id, created_at desc);

create trigger set_corporate_opportunities_updated_at
  before update on public.corporate_opportunities
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_opportunities', 'corporate_opportunity_signals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format(
      'grant select on table public.%I to authenticated, service_role', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() is not null)',
      t || '_retailer_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'retailer_id = public.current_retailer_id() '
      || 'and public.current_retailer_role() in '
      || '(''owner'', ''manager'', ''admin'', ''sales_associate''))',
      t || '_staff_insert', t
    );
  end loop;
end $$;

grant insert, update on table public.corporate_opportunities
  to authenticated, service_role;
-- Signals are append-only: a signal that can be edited is a scoring
-- history that can be quietly restated after the fact.
grant insert on table public.corporate_opportunity_signals
  to authenticated, service_role;

create policy corporate_opportunities_staff_update
  on public.corporate_opportunities for update to authenticated using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in
      ('owner', 'manager', 'admin', 'sales_associate')
  ) with check (retailer_id = public.current_retailer_id());

comment on table public.corporate_opportunities is
  'PHASE 18.1 / BD-101. The InsiderTailoring pipeline model without the '
  'external-signal-discovery half: signals are entered manually for this '
  'slice. score is denormalised for sorting but always recomputed from '
  'corporate_opportunity_signals, never hand-edited.';
comment on table public.corporate_opportunity_signals is
  'PHASE 18.1 / BD-101. Append-only. source has no scraped/public-signal '
  'value yet on purpose — that data does not exist until the external '
  'ingestion item (18.10) ships.';
