-- PHASE 7.3 / CLI-003: provenance-aware Self-Portrait facts + corrections.

create table if not exists public.customer_facts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  fact_type text not null check (
    fact_type in (
      'preference_concept',
      'occasion',
      'employer',
      'industry',
      'bonus_month',
      'anniversary',
      'wedding_date',
      'travel_window',
      'fit_note',
      'fabric_interest',
      'colour_interest',
      'pattern_interest',
      'rejected_concept',
      'other'
    )
  ),
  provenance_class text not null check (
    provenance_class in (
      'customer_declared',
      'advisor_observed',
      'transactional',
      'behaviour_inferred'
    )
  ),
  value_label text not null check (char_length(btrim(value_label)) between 1 and 500),
  value_concept_id uuid references public.metadata_concepts (id) on delete set null,
  value_text text check (
    value_text is null or char_length(value_text) between 1 and 2000
  ),
  confidence numeric(4, 3) not null default 1
    check (confidence >= 0 and confidence <= 1),
  sensitivity text not null default 'standard'
    check (sensitivity in ('standard', 'sensitive', 'restricted')),
  visibility text not null default 'customer_and_advisor'
    check (
      visibility in (
        'customer_and_advisor',
        'advisor_only',
        'customer_only'
      )
    ),
  observed_at timestamptz not null,
  valid_from timestamptz,
  valid_until timestamptz,
  review_by timestamptz,
  expires_at timestamptz,
  author_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  author_customer_id uuid references public.customers (id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  superseded_by_fact_id uuid references public.customer_facts (id)
    on delete set null,
  correction_of_fact_id uuid references public.customer_facts (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customer_facts_declared_only_chk check (
    not (
      fact_type in ('employer', 'industry', 'bonus_month')
      and provenance_class = 'behaviour_inferred'
    )
  )
);

create index if not exists customer_facts_retailer_customer_idx
  on public.customer_facts (retailer_id, customer_id, observed_at desc)
  where deleted_at is null and superseded_by_fact_id is null;

create table if not exists public.customer_fact_corrections (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  fact_id uuid not null references public.customer_facts (id) on delete cascade,
  actor_staff_id uuid references public.retailer_staff_members (id)
    on delete set null,
  actor_customer_id uuid references public.customers (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  previous_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_fact_corrections_fact_idx
  on public.customer_fact_corrections (fact_id, created_at desc);

alter table public.customer_facts enable row level security;
alter table public.customer_fact_corrections enable row level security;

revoke all on table public.customer_facts from public, anon;
revoke all on table public.customer_fact_corrections from public, anon;
grant select, insert, update on table public.customer_facts
  to authenticated, service_role;
grant select, insert on table public.customer_fact_corrections
  to authenticated, service_role;

create policy customer_facts_retailer_select
  on public.customer_facts for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy customer_facts_retailer_write
  on public.customer_facts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

create policy customer_facts_retailer_update
  on public.customer_facts for update to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  )
  with check (
    retailer_id = public.current_retailer_id()
  );

create policy customer_facts_customer_select
  on public.customer_facts for select to authenticated
  using (
    visibility in ('customer_and_advisor', 'customer_only')
    and exists (
      select 1 from public.customers c
      where c.id = customer_facts.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy customer_fact_corrections_retailer_select
  on public.customer_fact_corrections for select to authenticated
  using (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() is not null
  );

create policy customer_fact_corrections_retailer_insert
  on public.customer_fact_corrections for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

create or replace function public.record_advisor_rectangle_facts(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_staff_id uuid,
  p_observed_at timestamptz,
  p_selections jsonb,
  p_freeform_note text default null
) returns setof public.customer_facts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection jsonb;
  v_kind text;
  v_polarity text;
  v_fact_type text;
  v_label text;
  v_concept_id uuid;
  v_note text := nullif(btrim(coalesce(p_freeform_note, '')), '');
begin
  if p_retailer_id <> public.current_retailer_id()
    or public.current_retailer_role() not in (
      'owner', 'manager', 'sales_associate'
    )
  then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.retailer_id = p_retailer_id
  ) then
    raise exception 'Customer does not belong to retailer';
  end if;

  if jsonb_typeof(coalesce(p_selections, '[]'::jsonb)) <> 'array' then
    raise exception 'Selections must be an array';
  end if;

  for v_selection in
    select value from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  loop
    v_kind := v_selection ->> 'kind';
    v_polarity := coalesce(v_selection ->> 'polarity', 'positive');
    v_label := btrim(coalesce(v_selection ->> 'label', ''));
    v_concept_id := nullif(v_selection ->> 'conceptId', '')::uuid;

    if v_label = '' or v_concept_id is null then
      raise exception 'Each selection needs conceptId and label';
    end if;

    v_fact_type := case
      when v_polarity = 'negative' then 'rejected_concept'
      when v_kind = 'colour' then 'colour_interest'
      when v_kind = 'pattern' then 'pattern_interest'
      when v_kind in ('fibre', 'weave') then 'fabric_interest'
      when v_kind = 'occasion' then 'occasion'
      else 'preference_concept'
    end;

    return query
    insert into public.customer_facts (
      retailer_id,
      customer_id,
      fact_type,
      provenance_class,
      value_label,
      value_concept_id,
      confidence,
      sensitivity,
      visibility,
      observed_at,
      author_staff_id,
      evidence
    ) values (
      p_retailer_id,
      p_customer_id,
      v_fact_type,
      'advisor_observed',
      v_label,
      v_concept_id,
      0.900,
      'standard',
      'customer_and_advisor',
      p_observed_at,
      p_staff_id,
      jsonb_build_array(
        jsonb_build_object('conceptId', v_concept_id, 'note', 'advisor_rectangle')
      )
    )
    returning *;
  end loop;

  if v_note is not null then
    return query
    insert into public.customer_facts (
      retailer_id,
      customer_id,
      fact_type,
      provenance_class,
      value_label,
      value_text,
      confidence,
      sensitivity,
      visibility,
      observed_at,
      author_staff_id,
      evidence
    ) values (
      p_retailer_id,
      p_customer_id,
      'other',
      'advisor_observed',
      left(v_note, 500),
      left(v_note, 2000),
      0.700,
      'standard',
      'advisor_only',
      p_observed_at,
      p_staff_id,
      '[]'::jsonb
    )
    returning *;
  end if;
end;
$$;

revoke all on function public.record_advisor_rectangle_facts(
  uuid, uuid, uuid, timestamptz, jsonb, text
) from public;
grant execute on function public.record_advisor_rectangle_facts(
  uuid, uuid, uuid, timestamptz, jsonb, text
) to authenticated, service_role;

comment on table public.customer_facts is
  'Provenance-aware Self-Portrait facts (PHASE 7.3). Inferences never become declared facts.';
comment on table public.customer_fact_corrections is
  'Append-only correction history for customer_facts.';
