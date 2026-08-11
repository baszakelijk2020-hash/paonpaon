-- FT-05: customer-owned correction loop for canonical House Memory facts.
-- The source fact remains immutable. A customer declaration is an additive
-- counterfact so the House can retain provenance and reconcile it explicitly.

create or replace function public.correct_own_customer_fact(
  p_fact_id uuid,
  p_replacement_value_label text,
  p_replacement_value_text text default null,
  p_reason text default null
) returns public.customer_facts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.customer_facts%rowtype;
  v_customer_id uuid;
  v_replacement_label text := btrim(coalesce(p_replacement_value_label, ''));
  v_replacement_text text := nullif(btrim(coalesce(p_replacement_value_text, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_successor public.customer_facts%rowtype;
begin
  select * into v_source
  from public.customer_facts
  where id = p_fact_id
    and deleted_at is null
    and visibility in ('customer_and_advisor', 'customer_only')
    and sensitivity = 'standard'
    and provenance_class <> 'transactional'
    and exists (
      select 1 from public.customers c
      where c.id = customer_facts.customer_id
        and c.user_id = (select auth.uid())
    )
  for update;

  if not found then
    raise exception 'Fact is not available for customer correction';
  end if;

  v_customer_id := v_source.customer_id;

  if char_length(v_replacement_label) not between 1 and 500 then
    raise exception 'Replacement value is required and must be at most 500 characters';
  end if;

  if v_replacement_text is not null and char_length(v_replacement_text) > 2000 then
    raise exception 'Replacement detail must be at most 2000 characters';
  end if;

  insert into public.customer_fact_corrections (
    retailer_id,
    customer_id,
    fact_id,
    actor_customer_id,
    reason,
    previous_snapshot
  ) values (
    v_source.retailer_id,
    v_source.customer_id,
    v_source.id,
    v_customer_id,
    coalesce(v_reason, 'Customer supplied a replacement value'),
    to_jsonb(v_source)
  );

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
    author_customer_id,
    evidence,
    correction_of_fact_id
  ) values (
    v_source.retailer_id,
    v_source.customer_id,
    v_source.fact_type,
    'customer_declared',
    v_replacement_label,
    v_replacement_text,
    1,
    'standard',
    v_source.visibility,
    now(),
    v_customer_id,
    jsonb_build_array(jsonb_build_object('note', 'customer_fact_correction')),
    v_source.id
  ) returning * into v_successor;

  return v_successor;
end;
$$;

revoke all on function public.correct_own_customer_fact(uuid, text, text, text)
  from public;
grant execute on function public.correct_own_customer_fact(uuid, text, text, text)
  to authenticated, service_role;

comment on function public.correct_own_customer_fact(uuid, text, text, text) is
  'Atomically records a customer correction and append-only customer_declared counterfact. Source facts are never changed.';
