-- PAON Intelligence Platform Stage 4.4.
-- MorningRoutine selection projections with consent/weather/calendar
-- provenance and explainable recommendations (MR-001, MR-002, ENG-002;
-- ADR-061, ADR-063). Delivery/outbox remains Stage 4.5.

-- ---------------------------------------------------------------------------
-- morning_routine_selections — one daily selection projection per relationship
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_selections (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  for_date date not null,
  summary text not null check (length(btrim(summary)) between 1 and 2000),
  personalization_consent text not null check (
    personalization_consent in ('granted', 'denied', 'withdrawn')
  ),
  location_consent text not null check (
    location_consent in ('granted', 'denied', 'withdrawn')
  ),
  personalization_status text not null check (
    personalization_status in (
      'used',
      'skipped_no_consent',
      'skipped_unavailable',
      'skipped_failed',
      'skipped_absent'
    )
  ),
  location_status text not null check (
    location_status in (
      'used',
      'skipped_no_consent',
      'skipped_unavailable',
      'skipped_failed',
      'skipped_absent'
    )
  ),
  location_kind text not null check (
    location_kind in ('none', 'store_city', 'consented_label')
  ),
  location_label text check (
    location_label is null or length(btrim(location_label)) between 1 and 200
  ),
  weather_status text not null check (
    weather_status in (
      'used',
      'skipped_no_consent',
      'skipped_unavailable',
      'skipped_failed',
      'skipped_absent'
    )
  ),
  weather_summary text check (
    weather_summary is null or length(btrim(weather_summary)) between 1 and 200
  ),
  calendar_status text not null check (
    calendar_status in (
      'used',
      'skipped_no_consent',
      'skipped_unavailable',
      'skipped_failed',
      'skipped_absent'
    )
  ),
  occasion_labels jsonb not null default '[]'::jsonb,
  review_status text not null default 'none' check (
    review_status in ('none', 'saved', 'reviewed')
  ),
  created_at timestamptz not null default now(),
  constraint morning_routine_selections_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint morning_routine_selections_occasion_labels_array_chk check (
    jsonb_typeof(occasion_labels) = 'array'
  )
);

create index if not exists morning_routine_selections_customer_day_idx
  on public.morning_routine_selections (customer_id, for_date desc, created_at desc);

create index if not exists morning_routine_selections_retailer_day_idx
  on public.morning_routine_selections (retailer_id, for_date desc);

comment on table public.morning_routine_selections is
  'Persisted MorningRoutine selection projections with input provenance (PHASE 4.4). Delivery is Stage 4.5.';

alter table public.morning_routine_selections enable row level security;

revoke all on table public.morning_routine_selections from anon;

create policy "customers read own morning routine selections"
  on public.morning_routine_selections for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_selections.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant morning routine selections"
  on public.morning_routine_selections for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read morning routine selections"
  on public.morning_routine_selections for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_selections
  to authenticated, service_role;
grant all on table public.morning_routine_selections to service_role;

-- ---------------------------------------------------------------------------
-- morning_routine_recommendations — ranked explainable picks
-- ---------------------------------------------------------------------------

create table if not exists public.morning_routine_recommendations (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.morning_routine_selections (id) on delete cascade,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  rank integer not null check (rank >= 1 and rank <= 50),
  source text not null check (source in ('owned', 'catalogue')),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  category_code text,
  score numeric not null,
  wardrobe_item_id uuid references public.wardrobe_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  product_variant_id uuid references public.product_variants (id) on delete set null,
  product_slug text,
  primary_image_url text,
  explanation jsonb not null default '[]'::jsonb,
  factors jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint morning_routine_recommendations_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint morning_routine_recommendations_owned_chk check (
    (
      source = 'owned'
      and wardrobe_item_id is not null
    )
    or (
      source = 'catalogue'
      and product_id is not null
    )
  ),
  constraint morning_routine_recommendations_explanation_array_chk check (
    jsonb_typeof(explanation) = 'array'
  ),
  constraint morning_routine_recommendations_factors_array_chk check (
    jsonb_typeof(factors) = 'array'
  ),
  constraint morning_routine_recommendations_actions_array_chk check (
    jsonb_typeof(actions) = 'array'
  ),
  unique (selection_id, rank)
);

create index if not exists morning_routine_recommendations_selection_idx
  on public.morning_routine_recommendations (selection_id, rank);

create index if not exists morning_routine_recommendations_customer_idx
  on public.morning_routine_recommendations (customer_id, created_at desc);

comment on table public.morning_routine_recommendations is
  'Explainable MorningRoutine recommendation rows with save/review/book/buy action payloads (PHASE 4.4).';

alter table public.morning_routine_recommendations enable row level security;

revoke all on table public.morning_routine_recommendations from anon;

create policy "customers read own morning routine recommendations"
  on public.morning_routine_recommendations for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = morning_routine_recommendations.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant morning routine recommendations"
  on public.morning_routine_recommendations for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read morning routine recommendations"
  on public.morning_routine_recommendations for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.morning_routine_recommendations
  to authenticated, service_role;
grant all on table public.morning_routine_recommendations to service_role;

-- ---------------------------------------------------------------------------
-- RPC: persist_morning_routine_selection
-- ---------------------------------------------------------------------------

create or replace function public.persist_morning_routine_selection(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_for_date date,
  p_summary text,
  p_provenance jsonb,
  p_recommendations jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_selection_id uuid;
  v_rec jsonb;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
    and retailer_id = p_retailer_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found for retailer';
  end if;

  if v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to persist morning routine selection';
  end if;

  if jsonb_typeof(p_provenance) <> 'object' then
    raise exception 'Provenance must be a JSON object';
  end if;
  if jsonb_typeof(p_recommendations) <> 'array' then
    raise exception 'Recommendations must be a JSON array';
  end if;

  insert into public.morning_routine_selections (
    retailer_id,
    customer_id,
    for_date,
    summary,
    personalization_consent,
    location_consent,
    personalization_status,
    location_status,
    location_kind,
    location_label,
    weather_status,
    weather_summary,
    calendar_status,
    occasion_labels
  ) values (
    p_retailer_id,
    p_customer_id,
    p_for_date,
    btrim(p_summary),
    p_provenance->>'personalizationConsent',
    p_provenance->>'locationConsent',
    p_provenance->>'personalizationStatus',
    p_provenance->>'locationStatus',
    p_provenance->>'locationKind',
    nullif(btrim(coalesce(p_provenance->>'locationLabel', '')), ''),
    p_provenance->>'weatherStatus',
    nullif(btrim(coalesce(p_provenance->>'weatherSummary', '')), ''),
    p_provenance->>'calendarStatus',
    coalesce(p_provenance->'occasionLabels', '[]'::jsonb)
  )
  returning id into v_selection_id;

  for v_rec in
    select value from jsonb_array_elements(p_recommendations)
  loop
    insert into public.morning_routine_recommendations (
      selection_id,
      retailer_id,
      customer_id,
      rank,
      source,
      display_name,
      category_code,
      score,
      wardrobe_item_id,
      product_id,
      product_variant_id,
      product_slug,
      primary_image_url,
      explanation,
      factors,
      actions
    ) values (
      v_selection_id,
      p_retailer_id,
      p_customer_id,
      (v_rec->>'rank')::integer,
      v_rec->>'source',
      btrim(v_rec->>'displayName'),
      nullif(btrim(coalesce(v_rec->>'categoryCode', '')), ''),
      (v_rec->>'score')::numeric,
      nullif(v_rec->>'wardrobeItemId', '')::uuid,
      nullif(v_rec->>'productId', '')::uuid,
      nullif(v_rec->>'productVariantId', '')::uuid,
      nullif(btrim(coalesce(v_rec->>'productSlug', '')), ''),
      nullif(btrim(coalesce(v_rec->>'primaryImageUrl', '')), ''),
      coalesce(v_rec->'explanation', '[]'::jsonb),
      coalesce(v_rec->'factors', '[]'::jsonb),
      coalesce(v_rec->'actions', '[]'::jsonb)
    );
  end loop;

  return v_selection_id;
end;
$$;

revoke all on function public.persist_morning_routine_selection(
  uuid, uuid, date, text, jsonb, jsonb
) from public;
grant execute on function public.persist_morning_routine_selection(
  uuid, uuid, date, text, jsonb, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: mark_morning_routine_review
-- ---------------------------------------------------------------------------

create or replace function public.mark_morning_routine_review(
  p_selection_id uuid,
  p_review_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.morning_routine_selections%rowtype;
  v_customer public.customers%rowtype;
begin
  if p_review_status not in ('saved', 'reviewed') then
    raise exception 'Invalid review status';
  end if;

  select * into v_selection
  from public.morning_routine_selections
  where id = p_selection_id;
  if not found then
    raise exception 'Morning routine selection not found';
  end if;

  select * into v_customer
  from public.customers
  where id = v_selection.customer_id
    and deleted_at is null;
  if v_customer.user_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized to update morning routine selection';
  end if;

  update public.morning_routine_selections
  set review_status = p_review_status
  where id = p_selection_id;

  return p_selection_id;
end;
$$;

revoke all on function public.mark_morning_routine_review(uuid, text) from public;
grant execute on function public.mark_morning_routine_review(uuid, text)
  to authenticated, service_role;
