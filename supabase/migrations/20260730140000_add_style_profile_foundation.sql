-- PAON Intelligence Platform Stage 3.2.
-- StyleProfile evidence, explicit/inferred preference separation, and
-- deterministic recomputation (CUST-002, ADR-061).

-- ---------------------------------------------------------------------------
-- Style profiles (one row per retailer-customer relationship)
-- ---------------------------------------------------------------------------

create table public.customer_style_profiles (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  explicit_preferences jsonb not null default '[]'::jsonb check (
    jsonb_typeof(explicit_preferences) = 'array'
  ),
  inferred_preferences jsonb not null default '[]'::jsonb check (
    jsonb_typeof(inferred_preferences) = 'array'
  ),
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

create trigger set_customer_style_profiles_updated_at
  before update on public.customer_style_profiles
  for each row execute function public.set_updated_at();

create index customer_style_profiles_customer_idx
  on public.customer_style_profiles (customer_id);

-- ---------------------------------------------------------------------------
-- Append-only style evidence (customer removal is a soft mark, not delete)
-- ---------------------------------------------------------------------------

create table public.customer_style_preference_evidence (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  concept_id uuid not null references public.metadata_concepts (id),
  source text not null check (
    source in ('customer_declared', 'interaction_event', 'advisor_recorded')
  ),
  source_event_id uuid references public.behavioral_events (id) on delete set null,
  polarity text not null check (
    polarity in ('positive', 'negative', 'neutral')
  ),
  confidence numeric(4, 3) not null check (
    confidence >= 0 and confidence <= 1
  ),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint customer_style_preference_evidence_customer_retailer_fk
    foreign key (customer_id, retailer_id)
    references public.customers (id, retailer_id)
    deferrable initially immediate
);

create index customer_style_preference_evidence_customer_active_idx
  on public.customer_style_preference_evidence (customer_id, created_at desc)
  where removed_at is null;

create index customer_style_preference_evidence_retailer_customer_idx
  on public.customer_style_preference_evidence (retailer_id, customer_id);

create unique index customer_style_preference_evidence_event_concept_uidx
  on public.customer_style_preference_evidence (source_event_id, concept_id)
  where source_event_id is not null and removed_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.customer_style_profiles enable row level security;
alter table public.customer_style_preference_evidence enable row level security;

revoke all on table public.customer_style_profiles from anon;
revoke all on table public.customer_style_preference_evidence from anon;

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

create policy "retailer staff read tenant style profiles with consent"
  on public.customer_style_profiles for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and exists (
      select 1
      from public.customer_preferences cp
      where cp.customer_id = customer_style_profiles.customer_id
        and cp.personalization_opt_in = true
        and cp.personalization_withdrawn_at is null
    )
  );

create policy "platform staff read style profiles"
  on public.customer_style_profiles for select to authenticated
  using ((select public.is_platform_staff()));

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

create policy "retailer staff read tenant style evidence with consent"
  on public.customer_style_preference_evidence for select to authenticated
  using (
    retailer_id = (select public.current_retailer_id())
    and (select public.current_retailer_role()) in (
      'sales_associate', 'manager', 'admin', 'owner'
    )
    and removed_at is null
    and exists (
      select 1
      from public.customer_preferences cp
      where cp.customer_id = customer_style_preference_evidence.customer_id
        and cp.personalization_opt_in = true
        and cp.personalization_withdrawn_at is null
    )
  );

create policy "platform staff read style evidence"
  on public.customer_style_preference_evidence for select to authenticated
  using ((select public.is_platform_staff()));

grant select on table public.customer_style_profiles
  to authenticated, service_role;
grant select on table public.customer_style_preference_evidence
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Recompute (service role / RPC — not direct table writes for customers)
-- ---------------------------------------------------------------------------

create or replace function public.recompute_customer_style_profile(
  p_customer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_profile_id uuid;
  v_explicit jsonb := '[]'::jsonb;
  v_inferred jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  if auth.uid() is not null then
    if not (
      v_customer.user_id = auth.uid()
      or public.is_platform_staff()
      or (
        v_customer.retailer_id = public.current_retailer_id()
        and public.current_retailer_role() in (
          'sales_associate', 'manager', 'admin', 'owner'
        )
      )
    ) then
      raise exception 'Not authorized to recompute style profile';
    end if;
  end if;

  insert into public.customer_style_profiles (
    retailer_id,
    customer_id
  )
  values (v_customer.retailer_id, v_customer.id)
  on conflict (retailer_id, customer_id) do nothing;

  select id, explicit_preferences
  into v_profile_id, v_explicit
  from public.customer_style_profiles
  where retailer_id = v_customer.retailer_id
    and customer_id = v_customer.id;

  -- Deterministic SQL mirror of @paon/domain recomputeStyleProfile.
  with active_evidence as (
    select
      e.id,
      e.concept_id,
      e.polarity,
      e.confidence,
      e.created_at
    from public.customer_style_preference_evidence e
    where e.customer_id = p_customer_id
      and e.retailer_id = v_customer.retailer_id
      and e.removed_at is null
      and not exists (
        select 1
        from jsonb_array_elements(v_explicit) explicit_pref
        where (explicit_pref ->> 'conceptId')::uuid = e.concept_id
      )
  ),
  scored as (
    select
      concept_id,
      sum(
        case ae.polarity
          when 'positive' then 1.0
          when 'negative' then -1.0
          else 0.2
        end
        * ae.confidence
        * exp(
          -greatest(
            0,
            extract(epoch from (v_now - ae.created_at)) / 86400.0
          ) / 90.0
        )
      ) as score,
      avg(ae.confidence) as confidence,
      count(*) as evidence_count,
      max(ae.created_at) as last_evidence_at,
      jsonb_agg(
        jsonb_build_object(
          'code', 'evidence_contribution',
          'delta',
            case ae.polarity
              when 'positive' then 1.0
              when 'negative' then -1.0
              else 0.2
            end
            * ae.confidence
            * exp(
              -greatest(
                0,
                extract(epoch from (v_now - ae.created_at)) / 86400.0
              ) / 90.0
            ),
          'detail',
            ae.polarity || ' evidence (' || ae.confidence::text || ' confidence)',
          'evidenceId', ae.id
        )
        order by ae.created_at
      ) as factors
    from active_evidence ae
    group by concept_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'conceptId', s.concept_id,
        'score', s.score,
        'confidence', least(greatest(s.confidence, 0), 1),
        'polarity',
          case
            when s.score > 0.05 then 'positive'
            when s.score < -0.05 then 'negative'
            else 'neutral'
          end,
        'evidenceCount', s.evidence_count,
        'lastEvidenceAt', s.last_evidence_at,
        'factors', s.factors
      )
      order by abs(s.score) desc, s.concept_id::text asc
    ),
    '[]'::jsonb
  )
  into v_inferred
  from scored s
  where abs(s.score) >= 0.15;

  update public.customer_style_profiles
  set
    inferred_preferences = v_inferred,
    recomputed_at = v_now,
    updated_at = v_now
  where id = v_profile_id;

  return v_profile_id;
end;
$$;

create or replace function public.set_explicit_style_preference(
  p_customer_id uuid,
  p_concept_id uuid,
  p_polarity text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_profile_id uuid;
  v_explicit jsonb;
  v_now timestamptz := now();
begin
  if p_polarity not in ('positive', 'negative', 'neutral') then
    raise exception 'Invalid polarity';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  if v_customer.user_id is distinct from auth.uid() then
    raise exception 'Only the customer may declare explicit preferences';
  end if;

  if not exists (
    select 1
    from public.customer_preferences cp
    where cp.customer_id = p_customer_id
      and cp.personalization_opt_in = true
      and cp.personalization_withdrawn_at is null
  ) then
    raise exception 'Personalization consent required';
  end if;

  insert into public.customer_style_profiles (
    retailer_id,
    customer_id
  )
  values (v_customer.retailer_id, v_customer.id)
  on conflict (retailer_id, customer_id) do nothing;

  select id, explicit_preferences
  into v_profile_id, v_explicit
  from public.customer_style_profiles
  where retailer_id = v_customer.retailer_id
    and customer_id = v_customer.id;

  v_explicit := (
    select coalesce(jsonb_agg(entry), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'conceptId', p_concept_id,
        'polarity', p_polarity,
        'declaredAt', v_now
      ) as entry
      union all
      select elem
      from jsonb_array_elements(v_explicit) elem
      where (elem ->> 'conceptId')::uuid <> p_concept_id
    ) merged
  );

  update public.customer_style_profiles
  set
    explicit_preferences = v_explicit,
    updated_at = v_now
  where id = v_profile_id;

  insert into public.customer_style_preference_evidence (
    retailer_id,
    customer_id,
    concept_id,
    source,
    polarity,
    confidence
  )
  values (
    v_customer.retailer_id,
    v_customer.id,
    p_concept_id,
    'customer_declared',
    p_polarity,
    1.0
  );

  return public.recompute_customer_style_profile(p_customer_id);
end;
$$;

create or replace function public.remove_style_preference_evidence(
  p_evidence_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.customer_style_preference_evidence%rowtype;
  v_customer public.customers%rowtype;
begin
  select * into v_evidence
  from public.customer_style_preference_evidence e
  where e.id = p_evidence_id;

  if not found then
    raise exception 'Evidence not found';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = v_evidence.customer_id
    and c.deleted_at is null;

  if v_customer.user_id is distinct from auth.uid() then
    raise exception 'Only the customer may remove inference evidence';
  end if;

  if v_evidence.removed_at is not null then
    return public.recompute_customer_style_profile(v_evidence.customer_id);
  end if;

  update public.customer_style_preference_evidence
  set removed_at = now()
  where id = p_evidence_id;

  return public.recompute_customer_style_profile(v_evidence.customer_id);
end;
$$;

create or replace function public.record_style_evidence_from_interaction(
  p_customer_id uuid,
  p_source_event_id uuid,
  p_concept_id uuid,
  p_polarity text,
  p_confidence numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_event public.behavioral_events%rowtype;
  v_evidence_id uuid;
begin
  if p_polarity not in ('positive', 'negative', 'neutral') then
    raise exception 'Invalid polarity';
  end if;

  if p_confidence < 0 or p_confidence > 1 then
    raise exception 'Confidence must be between 0 and 1';
  end if;

  select * into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.deleted_at is null;

  if not found then
    raise exception 'Customer not found';
  end if;

  select * into v_event
  from public.behavioral_events be
  where be.id = p_source_event_id
    and be.customer_id = p_customer_id
    and be.retailer_id = v_customer.retailer_id;

  if not found then
    raise exception 'Interaction event not found for customer';
  end if;

  insert into public.customer_style_preference_evidence (
    retailer_id,
    customer_id,
    concept_id,
    source,
    source_event_id,
    polarity,
    confidence
  )
  values (
    v_customer.retailer_id,
    v_customer.id,
    p_concept_id,
    'interaction_event',
    p_source_event_id,
    p_polarity,
    p_confidence
  )
  on conflict (source_event_id, concept_id)
    where source_event_id is not null and removed_at is null
  do nothing
  returning id into v_evidence_id;

  if v_evidence_id is null then
    select e.id into v_evidence_id
    from public.customer_style_preference_evidence e
    where e.source_event_id = p_source_event_id
      and e.concept_id = p_concept_id
      and e.removed_at is null;
  end if;

  perform public.recompute_customer_style_profile(p_customer_id);

  return v_evidence_id;
end;
$$;

revoke all on function public.recompute_customer_style_profile(uuid) from public;
revoke all on function public.set_explicit_style_preference(uuid, uuid, text) from public;
revoke all on function public.remove_style_preference_evidence(uuid) from public;
revoke all on function public.record_style_evidence_from_interaction(uuid, uuid, uuid, text, numeric) from public;

grant execute on function public.recompute_customer_style_profile(uuid)
  to authenticated, service_role;
grant execute on function public.set_explicit_style_preference(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.remove_style_preference_evidence(uuid)
  to authenticated, service_role;
grant execute on function public.record_style_evidence_from_interaction(uuid, uuid, uuid, text, numeric)
  to authenticated, service_role;
