-- PAON Intelligence Platform Stage 3.2.
-- StyleProfile evidence, declared vs inferred preferences, deterministic
-- recomputation persistence, and customer inspect/remove without erasing
-- lawful business history (CUST-002 / ADR-061).

-- ---------------------------------------------------------------------------
-- customer_style_profiles — one row per retailer-customer relationship
-- ---------------------------------------------------------------------------

create table if not exists public.customer_style_profiles (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  explicit_preferences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(explicit_preferences) = 'array'),
  inferred_preferences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(inferred_preferences) = 'array'),
  confidence jsonb not null default jsonb_build_object(
    'overall', 0,
    'inferredCount', 0,
    'explicitCount', 0,
    'activeEvidenceCount', 0
  )
    check (jsonb_typeof(confidence) = 'object'),
  recomputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_style_profiles_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint customer_style_profiles_retailer_customer_uidx
    unique (retailer_id, customer_id)
);

create index if not exists customer_style_profiles_customer_idx
  on public.customer_style_profiles (customer_id);

comment on table public.customer_style_profiles is
  'Declared and inferred StyleProfile preferences (ADR-061). Columns stay structurally separate.';

create trigger set_customer_style_profiles_updated_at
  before update on public.customer_style_profiles
  for each row execute function public.set_updated_at();

alter table public.customer_style_profiles enable row level security;

revoke all on table public.customer_style_profiles from anon;

create policy "customers read own style profiles"
  on public.customer_style_profiles for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_style_profiles.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant style profiles"
  on public.customer_style_profiles for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read style profiles"
  on public.customer_style_profiles for select to authenticated
  using ((select public.is_platform_staff()));

-- No direct authenticated writes — repository/RPC owns mutations.
grant select on table public.customer_style_profiles
  to authenticated, service_role;
grant all on table public.customer_style_profiles to service_role;

-- ---------------------------------------------------------------------------
-- customer_style_preference_evidence — concept evidence with soft suppression
-- ---------------------------------------------------------------------------

create table if not exists public.customer_style_preference_evidence (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  concept_id uuid not null references public.metadata_concepts (id) on delete restrict,
  source_event_id uuid references public.behavioral_events (id) on delete set null,
  source text not null check (
    source in (
      'declared',
      'product_viewed',
      'product_favorited',
      'product_skipped',
      'search_performed',
      'filter_applied',
      'cart_updated',
      'knowledge_opened',
      'advisor_question',
      'appointment_intent',
      'conversion_recorded'
    )
  ),
  polarity text not null check (
    polarity in ('positive', 'negative', 'neutral')
  ),
  confidence numeric(4, 3) not null check (
    confidence >= 0 and confidence <= 1
  ),
  created_at timestamptz not null default now(),
  suppressed_at timestamptz,
  suppressed_by text check (
    suppressed_by is null
    or suppressed_by in ('customer', 'system', 'withdrawal')
  ),
  suppression_reason text check (
    suppression_reason is null
    or length(btrim(suppression_reason)) between 1 and 500
  ),
  constraint customer_style_preference_evidence_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate,
  constraint customer_style_preference_evidence_suppression_pair check (
    (suppressed_at is null and suppressed_by is null)
    or (suppressed_at is not null and suppressed_by is not null)
  )
);

create index if not exists customer_style_preference_evidence_customer_concept_idx
  on public.customer_style_preference_evidence (
    customer_id,
    concept_id,
    created_at desc
  );

create index if not exists customer_style_preference_evidence_retailer_created_idx
  on public.customer_style_preference_evidence (retailer_id, created_at desc);

create index if not exists customer_style_preference_evidence_active_idx
  on public.customer_style_preference_evidence (customer_id, concept_id)
  where suppressed_at is null;

comment on table public.customer_style_preference_evidence is
  'StyleProfile concept evidence. Soft suppression removes inference without deleting history.';

alter table public.customer_style_preference_evidence enable row level security;

revoke all on table public.customer_style_preference_evidence from anon;

create policy "customers read own style evidence"
  on public.customer_style_preference_evidence for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_style_preference_evidence.customer_id
        and c.user_id = (select auth.uid())
        and c.deleted_at is null
    )
  );

create policy "retailer staff read tenant style evidence"
  on public.customer_style_preference_evidence for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
  );

create policy "platform staff read style evidence"
  on public.customer_style_preference_evidence for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.customer_style_preference_evidence
  to authenticated, service_role;
grant all on table public.customer_style_preference_evidence to service_role;

-- ---------------------------------------------------------------------------
-- Ensure profile row exists
-- ---------------------------------------------------------------------------

create or replace function public.ensure_customer_style_profile(
  p_customer_id uuid
)
returns public.customer_style_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_profile public.customer_style_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  if v_customer.user_id is distinct from v_uid
    and not public.is_platform_staff()
    and (
      public.current_retailer_id() is distinct from v_customer.retailer_id
      or public.current_retailer_role() is null
      or public.current_retailer_role() not in (
        'sales_associate', 'manager', 'admin', 'owner'
      )
    )
  then
    raise exception 'Not authorized for this customer';
  end if;

  insert into public.customer_style_profiles (
    retailer_id,
    customer_id
  )
  values (
    v_customer.retailer_id,
    v_customer.id
  )
  on conflict (retailer_id, customer_id) do update
    set updated_at = public.customer_style_profiles.updated_at
  returning * into v_profile;

  if v_profile.id is null then
    select * into v_profile
    from public.customer_style_profiles
    where retailer_id = v_customer.retailer_id
      and customer_id = v_customer.id;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.ensure_customer_style_profile(uuid) from public;
grant execute on function public.ensure_customer_style_profile(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Upsert declared preference (never touches inferred jsonb directly)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_declared_style_preference(
  p_customer_id uuid,
  p_concept_id uuid,
  p_polarity text,
  p_note text default null
)
returns public.customer_style_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_profile public.customer_style_profiles%rowtype;
  v_explicit jsonb;
  v_filtered jsonb;
  v_entry jsonb;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_polarity not in ('positive', 'negative', 'neutral') then
    raise exception 'Invalid polarity';
  end if;

  if p_note is not null and length(btrim(p_note)) = 0 then
    p_note := null;
  end if;

  if p_note is not null and length(p_note) > 500 then
    raise exception 'Note too long';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = v_uid
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found or not owned by caller';
  end if;

  if not exists (
    select 1 from public.metadata_concepts mc
    where mc.id = p_concept_id
      and mc.active = true
      and mc.deleted_at is null
      and (
        mc.retailer_id is null
        or mc.retailer_id = v_customer.retailer_id
      )
  ) then
    raise exception 'Concept not found or not visible for retailer';
  end if;

  v_profile := public.ensure_customer_style_profile(p_customer_id);

  v_filtered := coalesce((
    select jsonb_agg(elem)
    from jsonb_array_elements(v_profile.explicit_preferences) as elem
    where elem->>'conceptId' is distinct from p_concept_id::text
  ), '[]'::jsonb);

  v_entry := jsonb_build_object(
    'conceptId', p_concept_id,
    'polarity', p_polarity,
    'updatedAt', trim(both '"' from to_jsonb(v_now)::text)
  );
  if p_note is not null then
    v_entry := v_entry || jsonb_build_object('note', p_note);
  end if;

  v_explicit := v_filtered || jsonb_build_array(v_entry);

  insert into public.customer_style_preference_evidence (
    retailer_id,
    customer_id,
    concept_id,
    source,
    polarity,
    confidence,
    created_at
  ) values (
    v_customer.retailer_id,
    v_customer.id,
    p_concept_id,
    'declared',
    p_polarity,
    1,
    v_now
  );

  update public.customer_style_profiles
  set
    explicit_preferences = v_explicit,
    confidence = jsonb_set(
      confidence,
      '{explicitCount}',
      to_jsonb(jsonb_array_length(v_explicit))
    ),
    updated_at = v_now
  where id = v_profile.id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.upsert_declared_style_preference(uuid, uuid, text, text)
  from public;
grant execute on function public.upsert_declared_style_preference(uuid, uuid, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Soft-remove inferred preference for a concept (retain evidence history)
-- ---------------------------------------------------------------------------

create or replace function public.remove_inferred_style_preference(
  p_customer_id uuid,
  p_concept_id uuid,
  p_reason text default null
)
returns public.customer_style_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_profile public.customer_style_profiles%rowtype;
  v_now timestamptz := now();
  v_inferred jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is not null and length(btrim(p_reason)) = 0 then
    p_reason := null;
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'Reason too long';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = v_uid
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found or not owned by caller';
  end if;

  v_profile := public.ensure_customer_style_profile(p_customer_id);

  update public.customer_style_preference_evidence
  set
    suppressed_at = v_now,
    suppressed_by = 'customer',
    suppression_reason = p_reason
  where customer_id = v_customer.id
    and retailer_id = v_customer.retailer_id
    and concept_id = p_concept_id
    and source <> 'declared'
    and suppressed_at is null;

  v_inferred := coalesce((
    select jsonb_agg(elem)
    from jsonb_array_elements(v_profile.inferred_preferences) as elem
    where elem->>'conceptId' is distinct from p_concept_id::text
  ), '[]'::jsonb);

  update public.customer_style_profiles
  set
    inferred_preferences = v_inferred,
    confidence = jsonb_set(
      jsonb_set(
        confidence,
        '{inferredCount}',
        to_jsonb(jsonb_array_length(v_inferred))
      ),
      '{overall}',
      to_jsonb(
        case
          when jsonb_array_length(v_inferred) = 0 then 0::numeric
          else coalesce((
            select avg((elem->>'confidence')::numeric)
            from jsonb_array_elements(v_inferred) as elem
          ), 0)
        end
      )
    ),
    updated_at = v_now
  where id = v_profile.id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.remove_inferred_style_preference(uuid, uuid, text)
  from public;
grant execute on function public.remove_inferred_style_preference(uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record evidence (customer for declared path already covered; staff/service
-- for consented interaction-derived evidence)
-- ---------------------------------------------------------------------------

create or replace function public.record_style_preference_evidence(
  p_customer_id uuid,
  p_concept_id uuid,
  p_source text,
  p_polarity text,
  p_confidence numeric,
  p_source_event_id uuid default null
)
returns public.customer_style_preference_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_row public.customer_style_preference_evidence%rowtype;
  v_prefs public.customer_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_source not in (
    'declared',
    'product_viewed',
    'product_favorited',
    'product_skipped',
    'search_performed',
    'filter_applied',
    'cart_updated',
    'knowledge_opened',
    'advisor_question',
    'appointment_intent',
    'conversion_recorded'
  ) then
    raise exception 'Invalid evidence source';
  end if;

  if p_polarity not in ('positive', 'negative', 'neutral') then
    raise exception 'Invalid polarity';
  end if;

  if p_confidence < 0 or p_confidence > 1 then
    raise exception 'Invalid confidence';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  -- Customer may record for self; retailer staff for same tenant; platform.
  if v_customer.user_id is distinct from v_uid
    and not public.is_platform_staff()
    and (
      public.current_retailer_id() is distinct from v_customer.retailer_id
      or public.current_retailer_role() is null
      or public.current_retailer_role() not in (
        'sales_associate', 'manager', 'admin', 'owner'
      )
    )
  then
    raise exception 'Not authorized for this customer';
  end if;

  select * into v_prefs
  from public.customer_preferences
  where customer_id = v_customer.id;

  if p_source <> 'declared'
    and coalesce(v_prefs.personalization_opt_in, false) is not true
  then
    raise exception 'Personalization consent required for inferred evidence';
  end if;

  if not exists (
    select 1 from public.metadata_concepts mc
    where mc.id = p_concept_id
      and mc.active = true
      and mc.deleted_at is null
      and (
        mc.retailer_id is null
        or mc.retailer_id = v_customer.retailer_id
      )
  ) then
    raise exception 'Concept not found or not visible for retailer';
  end if;

  perform public.ensure_customer_style_profile(p_customer_id);

  insert into public.customer_style_preference_evidence (
    retailer_id,
    customer_id,
    concept_id,
    source_event_id,
    source,
    polarity,
    confidence
  ) values (
    v_customer.retailer_id,
    v_customer.id,
    p_concept_id,
    p_source_event_id,
    p_source,
    p_polarity,
    p_confidence
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_style_preference_evidence(
  uuid, uuid, text, text, numeric, uuid
) from public;
grant execute on function public.record_style_preference_evidence(
  uuid, uuid, text, text, numeric, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Persist recomputed inferred preferences (domain computes; RPC stores)
-- ---------------------------------------------------------------------------

create or replace function public.persist_style_profile_recompute(
  p_customer_id uuid,
  p_inferred_preferences jsonb,
  p_confidence jsonb,
  p_recomputed_at timestamptz default now()
)
returns public.customer_style_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_profile public.customer_style_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(p_inferred_preferences) is distinct from 'array' then
    raise exception 'inferred_preferences must be a JSON array';
  end if;

  if jsonb_typeof(p_confidence) is distinct from 'object' then
    raise exception 'confidence must be a JSON object';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  if v_customer.user_id is distinct from v_uid
    and not public.is_platform_staff()
    and (
      public.current_retailer_id() is distinct from v_customer.retailer_id
      or public.current_retailer_role() is null
      or public.current_retailer_role() not in (
        'sales_associate', 'manager', 'admin', 'owner'
      )
    )
  then
    raise exception 'Not authorized for this customer';
  end if;

  v_profile := public.ensure_customer_style_profile(p_customer_id);

  -- Never overwrite explicit_preferences from this path.
  update public.customer_style_profiles
  set
    inferred_preferences = p_inferred_preferences,
    confidence = p_confidence,
    recomputed_at = p_recomputed_at,
    updated_at = now()
  where id = v_profile.id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.persist_style_profile_recompute(
  uuid, jsonb, jsonb, timestamptz
) from public;
grant execute on function public.persist_style_profile_recompute(
  uuid, jsonb, jsonb, timestamptz
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- On personalization withdrawal: suppress inferred evidence (keep history)
-- ---------------------------------------------------------------------------

create or replace function public.suppress_style_evidence_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := new.customer_id;
  v_retailer_id uuid;
begin
  if new.purpose = 'personalization' and new.status = 'withdrawn' then
    select retailer_id into v_retailer_id
    from public.customers
    where id = v_customer_id;

    update public.customer_style_preference_evidence
    set
      suppressed_at = coalesce(suppressed_at, now()),
      suppressed_by = coalesce(suppressed_by, 'withdrawal'),
      suppression_reason = coalesce(
        suppression_reason,
        'Personalization consent withdrawn'
      )
    where customer_id = v_customer_id
      and retailer_id = v_retailer_id
      and source <> 'declared'
      and suppressed_at is null;

    update public.customer_style_profiles
    set
      inferred_preferences = '[]'::jsonb,
      confidence = jsonb_build_object(
        'overall', 0,
        'inferredCount', 0,
        'explicitCount', jsonb_array_length(explicit_preferences),
        'activeEvidenceCount', 0
      ),
      recomputed_at = now(),
      updated_at = now()
    where customer_id = v_customer_id
      and retailer_id = v_retailer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists style_evidence_on_consent_withdrawal
  on public.customer_consent_events;

create trigger style_evidence_on_consent_withdrawal
  after insert on public.customer_consent_events
  for each row
  execute function public.suppress_style_evidence_on_withdrawal();
