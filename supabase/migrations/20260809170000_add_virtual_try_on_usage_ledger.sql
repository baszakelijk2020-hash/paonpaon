-- Virtual try-on transactional budget ledger (PHASE 17.10 / ADV-110).
-- Composes the fail-closed authorization contract already built in
-- packages/domain/src/analytics/virtual-try-on-usage.ts
-- (evaluateVirtualTryOnAuthorization) with real persisted reservation and
-- settlement, same "reserve on authorize, settle on terminal result"
-- transactional shape R0.2 already established for POS/stock and VWS-001
-- already established for wardrobe_visualization_jobs.
--
-- Per the vision doc §9 ("Monetisation") and §8 ("AI usage ledger"), the
-- actual credit/billing model is an explicit founder/commercial decision
-- not yet made (PHASE 17.10's own "Hard blockers" line) — same posture
-- ADR-072 already established for POS cash. This migration therefore
-- seeds every retailer with a policy row that is fail-closed
-- (`enabled = false`, every budget/quota at zero) rather than inventing a
-- default allowance; a retailer settings surface to configure real
-- numbers is a separate, later slice, not fabricated here.
--
-- Reuses the existing `style_portrait_consents` row as the source for both
-- `imageProcessingConsent` and `portraitStorageConsent` in the domain
-- contract: it is the one already-disclosed, already-persisted photo
-- consent in this codebase (ADR-074), and its existing customer-facing
-- copy already bundles processing and storage disclosure together. Adding
-- a second, narrower consent purpose is a real product/legal decision for
-- whoever ships the first feature that actually needs the split, not
-- assumed here.

-- ---------------------------------------------------------------------------
-- retailer_virtual_try_on_policies — one configurable row per retailer
-- ---------------------------------------------------------------------------

create table public.retailer_virtual_try_on_policies (
  retailer_id uuid primary key references public.retailers (id) on delete cascade,
  enabled boolean not null default false,
  currency text not null default 'USD',
  monthly_budget_minor_units integer not null default 0,
  per_customer_monthly_budget_minor_units integer not null default 0,
  max_customer_generations_per_day integer not null default 0,
  max_customer_generations_per_week integer not null default 0,
  max_customer_generations_per_month integer not null default 0,
  allow_image boolean not null default true,
  allow_video boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retailer_virtual_try_on_policies_nonneg_chk check (
    monthly_budget_minor_units >= 0
    and per_customer_monthly_budget_minor_units >= 0
    and max_customer_generations_per_day >= 0
    and max_customer_generations_per_week >= 0
    and max_customer_generations_per_month >= 0
  )
);

comment on table public.retailer_virtual_try_on_policies is
  'ADV-110: per-retailer AI try-on budget/quota policy. Seeded disabled '
  '(enabled = false, every budget/quota at zero) for every retailer — no '
  'credit/billing default is fabricated here; a retailer must explicitly '
  'opt in once a founder-approved billing model exists.';

create trigger set_retailer_virtual_try_on_policies_updated_at
  before update on public.retailer_virtual_try_on_policies
  for each row execute function public.set_updated_at();

alter table public.retailer_virtual_try_on_policies enable row level security;

revoke all on table public.retailer_virtual_try_on_policies from anon;

create policy "platform staff can manage all virtual try-on policies"
  on public.retailer_virtual_try_on_policies for all
  using ((select public.is_platform_staff()))
  with check ((select public.is_platform_staff()));

create policy "retailer staff read their own virtual try-on policy"
  on public.retailer_virtual_try_on_policies for select to authenticated
  using (retailer_id = (select public.current_retailer_id()));

create policy "retailer managers write their own virtual try-on policy"
  on public.retailer_virtual_try_on_policies for update to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'admin')
  )
  with check (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in ('owner', 'admin')
  );

grant select, update on table public.retailer_virtual_try_on_policies
  to authenticated;
grant all on table public.retailer_virtual_try_on_policies to service_role;

create or replace function public.ensure_default_retailer_virtual_try_on_policy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.retailer_virtual_try_on_policies (retailer_id, currency)
  values (new.id, new.default_currency)
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.ensure_default_retailer_virtual_try_on_policy()
  from public;

create trigger ensure_default_retailer_virtual_try_on_policy_on_insert
  after insert on public.retailers
  for each row execute function public.ensure_default_retailer_virtual_try_on_policy();

-- Backfill retailers already present before this migration runs (a live/
-- demo database, unlike a fresh local reset where `retailers` is empty at
-- migration time).
insert into public.retailer_virtual_try_on_policies (retailer_id, currency)
select r.id, r.default_currency
from public.retailers r
where not exists (
  select 1 from public.retailer_virtual_try_on_policies p
  where p.retailer_id = r.id
);

-- ---------------------------------------------------------------------------
-- virtual_try_on_usage_ledger — append-mostly reservation/settlement ledger
-- ---------------------------------------------------------------------------

create table public.virtual_try_on_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  store_id uuid references public.retailer_branches (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  requested_by_staff_id uuid references public.retailer_staff_members (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  provider text not null,
  model text not null,
  endpoint text not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  quality text not null check (quality in ('preview', 'premium', 'video')),
  trigger text not null check (
    trigger in (
      'customer_try_on', 'morning_routine', 'advisor_selection',
      'appointment_preparation', 'saved_look', 'shared_look',
      'animation_request'
    )
  ),
  input_asset_ids text[] not null default '{}',
  output_asset_id text,
  credits_reserved integer check (credits_reserved is null or credits_reserved >= 0),
  credits_consumed integer check (credits_consumed is null or credits_consumed >= 0),
  estimated_cost_minor_units integer not null check (estimated_cost_minor_units >= 0),
  estimated_cost_currency text not null,
  actual_cost_minor_units integer check (actual_cost_minor_units is null or actual_cost_minor_units >= 0),
  actual_cost_currency text,
  internal_cost_minor_units integer check (internal_cost_minor_units is null or internal_cost_minor_units >= 0),
  internal_cost_currency text,
  conversion_event text,
  attributed_revenue_minor_units integer check (attributed_revenue_minor_units is null or attributed_revenue_minor_units >= 0),
  attributed_revenue_currency text,
  cache_hit boolean not null default false,
  status text not null check (
    status in ('denied', 'authorized', 'cache_hit', 'succeeded', 'failed', 'cancelled')
  ),
  denial_reason text,
  failure_code text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint virtual_try_on_usage_ledger_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  -- cache_hit is terminal at insert time — it reuses an already-resolved
  -- result, so it settles immediately, never through settle_virtual_try_on_
  -- generation. authorized is the only status that starts unsettled and
  -- waits for a later settle call.
  constraint virtual_try_on_usage_ledger_settled_chk check (
    (status in ('succeeded', 'failed', 'cancelled', 'cache_hit')) = (settled_at is not null)
  ),
  constraint virtual_try_on_usage_ledger_denied_chk check (
    status <> 'denied' or denial_reason is not null
  ),
  constraint virtual_try_on_usage_ledger_failed_chk check (
    status <> 'failed' or failure_code is not null
  )
);

create index virtual_try_on_usage_ledger_customer_idx
  on public.virtual_try_on_usage_ledger (customer_id, created_at desc);
create index virtual_try_on_usage_ledger_retailer_month_idx
  on public.virtual_try_on_usage_ledger (retailer_id, created_at);
create index virtual_try_on_usage_ledger_campaign_idx
  on public.virtual_try_on_usage_ledger (campaign_id, created_at)
  where campaign_id is not null;
create index virtual_try_on_usage_ledger_store_idx
  on public.virtual_try_on_usage_ledger (store_id)
  where store_id is not null;
create index virtual_try_on_usage_ledger_staff_idx
  on public.virtual_try_on_usage_ledger (requested_by_staff_id)
  where requested_by_staff_id is not null;

comment on table public.virtual_try_on_usage_ledger is
  'ADV-110: one row per authorization attempt (allowed or denied). Writes '
  'only through the RPCs below — reserve on authorize/cache-hit, settle '
  'exactly once on succeeded/failed/cancelled. No image/video is ever '
  'user-visible outside this ledger''s own output_asset_id reference.';

alter table public.virtual_try_on_usage_ledger enable row level security;

revoke all on table public.virtual_try_on_usage_ledger from anon;

create policy "customers read own virtual try-on usage"
  on public.virtual_try_on_usage_ledger for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = virtual_try_on_usage_ledger.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant virtual try-on usage"
  on public.virtual_try_on_usage_ledger for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read virtual try-on usage"
  on public.virtual_try_on_usage_ledger for select to authenticated
  using ((select public.is_platform_staff()));

-- Writes only through the RPCs below (reservation/settlement need
-- security-definer transition control, same shape as
-- wardrobe_visualization_jobs).
grant select on table public.virtual_try_on_usage_ledger
  to authenticated, service_role;
grant all on table public.virtual_try_on_usage_ledger to service_role;

-- Reservation: re-derives the caller (owning customer or a staff member of
-- the same retailer), the retailer's wardrobe_styling module state, the
-- retailer's own configured policy and live usage window, and the
-- customer's own consent — the exact same rule
-- evaluateVirtualTryOnAuthorization already encodes in TypeScript, written
-- independently in SQL so a client cannot bypass it by skipping the
-- server action (same defense-in-depth precedent as
-- enqueue_wardrobe_visualization_job / enqueue_style_portrait_preview_job).
-- Always inserts one row — a denial is itself a real, queryable ledger
-- entry, never silently dropped.
create or replace function public.reserve_virtual_try_on_generation(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_store_id uuid,
  p_campaign_id uuid,
  p_provider text,
  p_model text,
  p_endpoint text,
  p_media_kind text,
  p_quality text,
  p_trigger text,
  p_input_asset_ids text[],
  p_persist_portrait boolean,
  p_provider_estimate_minor_units integer,
  p_provider_estimate_currency text,
  p_cache_hit boolean,
  p_commercially_justified boolean
)
returns public.virtual_try_on_usage_ledger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module_state text;
  v_policy public.retailer_virtual_try_on_policies%rowtype;
  v_consent_status text;
  v_consent_ack boolean;
  v_requested_by_staff_id uuid;
  v_today_count integer;
  v_week_count integer;
  v_month_count integer;
  v_customer_spend integer;
  v_retailer_spend integer;
  v_status text;
  v_denial text;
  v_reserve integer := 0;
  v_row public.virtual_try_on_usage_ledger%rowtype;
begin
  if p_media_kind not in ('image', 'video') then
    raise exception 'Invalid media kind';
  end if;
  if p_quality not in ('preview', 'premium', 'video') then
    raise exception 'Invalid quality level';
  end if;
  if p_trigger not in (
    'customer_try_on', 'morning_routine', 'advisor_selection',
    'appointment_preparation', 'saved_look', 'shared_look', 'animation_request'
  ) then
    raise exception 'Invalid trigger';
  end if;
  if p_provider_estimate_minor_units is null or p_provider_estimate_minor_units < 0 then
    raise exception 'Invalid provider estimate';
  end if;

  -- Caller must be the owning customer themselves, or a staff member of
  -- the same retailer acting on the customer's behalf (advisor-triggered
  -- generation, e.g. a private selection).
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select rs.id into v_requested_by_staff_id
  from public.retailer_staff_members rs
  where rs.user_id = auth.uid()
    and rs.retailer_id = p_retailer_id
    and rs.deleted_at is null;

  if v_requested_by_staff_id is null and not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.retailer_id = p_retailer_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  ) then
    raise exception 'Not authorized to request generation for this customer';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.retailer_id = p_retailer_id and c.deleted_at is null
  ) then
    raise exception 'Customer relationship not found';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.retailer_branches b
    where b.id = p_store_id and b.retailer_id = p_retailer_id
  ) then
    raise exception 'Store does not belong to this retailer';
  end if;

  v_module_state := public.retailer_module_access_state(p_retailer_id, 'wardrobe_styling');

  select * into v_policy
  from public.retailer_virtual_try_on_policies
  where retailer_id = p_retailer_id;

  select status, disclosures_acknowledged into v_consent_status, v_consent_ack
  from public.style_portrait_consents
  where customer_id = p_customer_id and retailer_id = p_retailer_id;

  select count(*) filter (where created_at >= date_trunc('day', now())),
         count(*) filter (where created_at >= date_trunc('week', now())),
         count(*) filter (where created_at >= date_trunc('month', now())),
         coalesce(sum(coalesce(actual_cost_minor_units, estimated_cost_minor_units))
           filter (where created_at >= date_trunc('month', now())
             and status in ('authorized', 'cache_hit', 'succeeded')), 0)
    into v_today_count, v_week_count, v_month_count, v_customer_spend
  from public.virtual_try_on_usage_ledger
  where customer_id = p_customer_id
    and status in ('authorized', 'cache_hit', 'succeeded');

  select coalesce(sum(coalesce(actual_cost_minor_units, estimated_cost_minor_units)), 0)
    into v_retailer_spend
  from public.virtual_try_on_usage_ledger
  where retailer_id = p_retailer_id
    and created_at >= date_trunc('month', now())
    and status in ('authorized', 'cache_hit', 'succeeded');

  -- Same decision order as evaluateVirtualTryOnAuthorization. Per-campaign
  -- budgets are not modeled here: `campaigns` has no budget column today,
  -- and adding one is a separate, larger decision belonging to whichever
  -- slice first needs campaign-attributed AI spend caps. A supplied
  -- campaign_id is validated for tenancy and recorded for attribution/
  -- reporting only; it does not yet gate authorization on its own budget.
  if v_module_state is distinct from 'active' then
    v_status := 'denied'; v_denial := 'module_not_active';
  elsif v_policy.retailer_id is null or not v_policy.enabled then
    v_status := 'denied'; v_denial := 'retailer_disabled';
  elsif (p_media_kind = 'image' and not v_policy.allow_image)
     or (p_media_kind = 'video' and not v_policy.allow_video) then
    v_status := 'denied'; v_denial := 'media_not_allowed';
  elsif v_consent_status is distinct from 'granted' or coalesce(v_consent_ack, false) is not true then
    -- style_portrait_consents is the single already-disclosed source for
    -- both imageProcessingConsent and portraitStorageConsent (see header
    -- comment); persist_portrait does not change this decision because
    -- there is no narrower consent to check yet.
    v_status := 'denied'; v_denial := 'image_processing_consent_missing';
  elsif p_provider_estimate_currency <> v_policy.currency then
    v_status := 'denied'; v_denial := 'invalid_provider_estimate';
  elsif p_cache_hit then
    v_status := 'cache_hit'; v_denial := null; v_reserve := 0;
  elsif v_today_count >= v_policy.max_customer_generations_per_day then
    v_status := 'denied'; v_denial := 'daily_quota_exhausted';
  elsif v_week_count >= v_policy.max_customer_generations_per_week then
    v_status := 'denied'; v_denial := 'weekly_quota_exhausted';
  elsif v_month_count >= v_policy.max_customer_generations_per_month then
    v_status := 'denied'; v_denial := 'monthly_quota_exhausted';
  elsif v_customer_spend + p_provider_estimate_minor_units > v_policy.per_customer_monthly_budget_minor_units then
    v_status := 'denied'; v_denial := 'customer_budget_exhausted';
  elsif v_retailer_spend + p_provider_estimate_minor_units > v_policy.monthly_budget_minor_units then
    v_status := 'denied'; v_denial := 'retailer_budget_exhausted';
  elsif p_campaign_id is not null and not exists (
    select 1 from public.campaigns where id = p_campaign_id and retailer_id = p_retailer_id
  ) then
    v_status := 'denied'; v_denial := 'campaign_budget_unavailable';
  elsif not p_commercially_justified then
    v_status := 'denied'; v_denial := 'commercial_justification_missing';
  else
    v_status := 'authorized'; v_denial := null; v_reserve := p_provider_estimate_minor_units;
  end if;

  insert into public.virtual_try_on_usage_ledger (
    retailer_id, store_id, customer_id, requested_by_staff_id, campaign_id,
    provider, model, endpoint, media_kind, quality, trigger,
    input_asset_ids, credits_reserved, estimated_cost_minor_units,
    estimated_cost_currency, cache_hit, status, denial_reason, settled_at
  ) values (
    p_retailer_id, p_store_id, p_customer_id, v_requested_by_staff_id, p_campaign_id,
    p_provider, p_model, p_endpoint, p_media_kind, p_quality, p_trigger,
    coalesce(p_input_asset_ids, '{}'), null, v_reserve,
    coalesce(p_provider_estimate_currency, v_policy.currency), p_cache_hit, v_status, v_denial,
    case when v_status = 'cache_hit' then now() else null end
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.reserve_virtual_try_on_generation(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text[],
  boolean, integer, text, boolean, boolean
) from public;
grant execute on function public.reserve_virtual_try_on_generation(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text[],
  boolean, integer, text, boolean, boolean
) to authenticated, service_role;

comment on function public.reserve_virtual_try_on_generation(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text[],
  boolean, integer, text, boolean, boolean
) is
  'ADV-110: fail-closed reservation matching evaluateVirtualTryOnAuthorization''s '
  'decision order server-side. Always inserts one ledger row, including denials.';

-- Settlement: service_role only, matches complete_wardrobe_visualization_job.
-- Exactly one settlement per row (authorized -> a terminal status).
-- cache_hit is never settled here — it is already terminal at insert time
-- (see the ledger table's own comment) — enforced by this WHERE clause
-- only allowing an `authorized` row through.
create or replace function public.settle_virtual_try_on_generation(
  p_ledger_id uuid,
  p_status text,
  p_output_asset_id text default null,
  p_credits_consumed integer default null,
  p_actual_cost_minor_units integer default null,
  p_actual_cost_currency text default null,
  p_internal_cost_minor_units integer default null,
  p_internal_cost_currency text default null,
  p_conversion_event text default null,
  p_attributed_revenue_minor_units integer default null,
  p_attributed_revenue_currency text default null,
  p_failure_code text default null
)
returns public.virtual_try_on_usage_ledger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.virtual_try_on_usage_ledger%rowtype;
begin
  if p_status not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'Invalid settlement status';
  end if;
  if p_status = 'failed' and p_failure_code is null then
    raise exception 'failure_code is required when settling as failed';
  end if;

  update public.virtual_try_on_usage_ledger
  set status = p_status,
      output_asset_id = p_output_asset_id,
      credits_consumed = p_credits_consumed,
      actual_cost_minor_units = p_actual_cost_minor_units,
      actual_cost_currency = coalesce(p_actual_cost_currency, estimated_cost_currency),
      internal_cost_minor_units = p_internal_cost_minor_units,
      internal_cost_currency = p_internal_cost_currency,
      conversion_event = p_conversion_event,
      attributed_revenue_minor_units = p_attributed_revenue_minor_units,
      attributed_revenue_currency = p_attributed_revenue_currency,
      failure_code = p_failure_code,
      settled_at = now()
  where id = p_ledger_id and status = 'authorized'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Ledger row not found or already settled';
  end if;

  return v_row;
end;
$$;

revoke all on function public.settle_virtual_try_on_generation(
  uuid, text, text, integer, integer, text, integer, text, text, integer,
  text, text
) from public;
grant execute on function public.settle_virtual_try_on_generation(
  uuid, text, text, integer, integer, text, integer, text, text, integer,
  text, text
) to service_role;

comment on function public.settle_virtual_try_on_generation(
  uuid, text, text, integer, integer, text, integer, text, text, integer,
  text, text
) is
  'ADV-110: service_role-only terminal settlement of exactly one reserved '
  'or cache-hit ledger row.';
