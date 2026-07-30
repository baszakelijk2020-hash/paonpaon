-- Fix 7.3 role gates: PAON has no 'stylist' retailer role.

drop policy if exists customer_facts_retailer_write on public.customer_facts;
create policy customer_facts_retailer_write
  on public.customer_facts for insert to authenticated
  with check (
    retailer_id = public.current_retailer_id()
    and public.current_retailer_role() in (
      'owner', 'manager', 'sales_associate'
    )
  );

drop policy if exists customer_facts_retailer_update on public.customer_facts;
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

drop policy if exists customer_fact_corrections_retailer_insert
  on public.customer_fact_corrections;
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
