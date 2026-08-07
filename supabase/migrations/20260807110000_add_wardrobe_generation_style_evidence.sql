-- Virtual Wardrobe Studio personalization loop (VWS-001 / PHASE 4.10 /
-- blueprint §7). Positive/negative look feedback feeds
-- customer_style_preference_evidence exactly like a product view or
-- favorite does today, through two new evidence sources scoped to this
-- feature — no second preference-evidence table, no direct image-model
-- retraining. Also fixes claim_pending_wardrobe_visualization_jobs's
-- ordering, which had no tiebreaker for timestamp ties under concurrency.

alter table public.customer_style_preference_evidence
  drop constraint if exists customer_style_preference_evidence_source_check;

alter table public.customer_style_preference_evidence
  add constraint customer_style_preference_evidence_source_check check (
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
      'conversion_recorded',
      'generation_loved',
      'generation_rejected'
    )
  );

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
    'conversion_recorded',
    'generation_loved',
    'generation_rejected'
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

-- Deterministic queue claim: `created_at` alone is not a total order under
-- concurrent inserts sharing a timestamp — add `id` as a tiebreaker.
create or replace function public.claim_pending_wardrobe_visualization_jobs(
  p_limit integer default 5
)
returns setof public.wardrobe_visualization_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.wardrobe_visualization_jobs
    set status = 'generating', attempt = attempt + 1
    where id in (
      select id from public.wardrobe_visualization_jobs
      where status = 'queued'
      order by created_at, id
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

revoke all on function public.claim_pending_wardrobe_visualization_jobs(integer)
  from public;
grant execute on function public.claim_pending_wardrobe_visualization_jobs(integer)
  to service_role;
