-- Fix advanced_fabric milestone query: metadata_concept_kind has no 'fabric' value.
-- Use fabric_collection (ADR-059 enum) so demo seed order delivery does not fail.

create or replace function public.sync_loyalty_milestones_for_order(
  p_order_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_awarded integer := 0;
  v_def public.loyalty_milestone_definitions%rowtype;
  v_points integer;
  v_ledger_id uuid;
  v_award_id uuid;
  v_prior_commission boolean;
  v_qualifying_count integer;
  v_concept record;
  v_custom public.loyalty_milestone_definitions%rowtype;
  v_award public.loyalty_milestone_awards%rowtype;
  v_reverse_ledger_id uuid;
  v_peer_concept_id uuid;
  v_peer_concept_name text;
  v_premium_hints text[] := array[
    'full-canvas', 'fullcanvas', 'hand-canvas', 'handcanvas', 'floating-canvas'
  ];
  v_fabric_hints text[] := array[
    'cashmere', 'vicuna', 'guanaco', 'super-150', 'super150',
    'super-180', 'super180', 'lotus', 'qiviuk'
  ];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.deleted_at is not null then
    return 0;
  end if;

  select * into v_program
  from public.loyalty_programs
  where retailer_id = v_order.retailer_id
    and enabled
    and deleted_at is null;
  if not found then
    return 0;
  end if;

  perform public.ensure_loyalty_milestone_definitions(v_order.retailer_id);

  insert into public.loyalty_accounts (retailer_id, customer_id)
  values (v_order.retailer_id, v_order.customer_id)
  on conflict (retailer_id, customer_id) do update
    set updated_at = now()
  returning * into v_account;

  select * into v_account
  from public.loyalty_accounts
  where id = v_account.id
  for update;

  -- Corrections / refunds: reverse awards tied to this order
  if v_order.status in ('canceled', 'refunded') then
    for v_award in
      select *
      from public.loyalty_milestone_awards
      where loyalty_account_id = v_account.id
        and related_order_id = v_order.id
        and status = 'awarded'
      for update
    loop
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id,
        'adjustment_manual',
        -v_award.points,
        v_order.id,
        'Milestone correction: ' || v_award.idempotency_key
      )
      returning id into v_reverse_ledger_id;

      update public.loyalty_accounts
      set
        points_balance = greatest(0, points_balance - v_award.points),
        lifetime_points = greatest(0, lifetime_points - v_award.points)
      where id = v_account.id;

      update public.loyalty_milestone_awards
      set
        status = 'reversed',
        reversed_at = now(),
        reverse_ledger_entry_id = v_reverse_ledger_id
      where id = v_award.id;

      v_awarded := v_awarded + 1;
    end loop;
    return v_awarded;
  end if;

  if v_order.status not in ('delivered', 'completed') then
    return 0;
  end if;

  -- first_commission
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'first_commission'
    and active
  limit 1;

  if found then
    select exists (
      select 1
      from public.orders o
      join public.order_lines ol on ol.order_id = o.id
      where o.customer_id = v_order.customer_id
        and o.retailer_id = v_order.retailer_id
        and o.id <> v_order.id
        and o.deleted_at is null
        and o.status in ('delivered', 'completed')
        and ol.requires_production
    ) into v_prior_commission;

    if not v_prior_commission
      and exists (
        select 1 from public.order_lines ol
        where ol.order_id = v_order.id and ol.requires_production
      )
      and not exists (
        select 1 from public.loyalty_milestone_awards a
        where a.loyalty_account_id = v_account.id
          and a.kind = 'first_commission'
          and a.idempotency_key = 'first_commission'
          and a.status = 'awarded'
      )
    then
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: first_commission'
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'first_commission', 'first_commission', v_order.id, v_points,
        v_ledger_id, v_def.label, v_def.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end if;

  -- repeat_order
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'repeat_order'
    and active
  limit 1;

  if found then
    select count(*) into v_qualifying_count
    from public.orders o
    where o.customer_id = v_order.customer_id
      and o.retailer_id = v_order.retailer_id
      and o.deleted_at is null
      and o.status in ('delivered', 'completed');

    if v_qualifying_count >= 2
      and not exists (
        select 1 from public.loyalty_milestone_awards a
        where a.loyalty_account_id = v_account.id
          and a.kind = 'repeat_order'
          and a.idempotency_key = 'repeat_order'
          and a.status = 'awarded'
      )
    then
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: repeat_order'
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'repeat_order', 'repeat_order', v_order.id, v_points,
        v_ledger_id, v_def.label, v_def.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end if;

  -- new_category
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'new_category'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      join public.metadata_concepts c
        on c.id = ema.concept_id
        and c.kind = 'garment_type'
        and c.deleted_at is null
      where ol.order_id = v_order.id
        and not exists (
          select 1
          from public.orders o2
          join public.order_lines ol2 on ol2.order_id = o2.id
          join public.product_variants pv2 on pv2.id = ol2.product_variant_id
          join public.entity_metadata_assignments ema2
            on ema2.target_type = 'product'
            and ema2.target_id = pv2.product_id
            and ema2.retailer_id = v_order.retailer_id
            and ema2.review_status = 'accepted'
            and ema2.deleted_at is null
            and ema2.concept_id = c.id
          where o2.customer_id = v_order.customer_id
            and o2.retailer_id = v_order.retailer_id
            and o2.id <> v_order.id
            and o2.deleted_at is null
            and o2.status in ('delivered', 'completed')
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'new_category'
            and a.idempotency_key = 'new_category:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: new_category:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'new_category', 'new_category:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- premium_construction
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'premium_construction'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      join public.metadata_concepts c
        on c.id = ema.concept_id
        and c.kind = 'construction'
        and c.deleted_at is null
      where ol.order_id = v_order.id
        and (
          (
            cardinality(v_def.match_concept_ids) > 0
            and c.id = any (v_def.match_concept_ids)
          )
          or (
            cardinality(v_def.match_concept_ids) = 0
            and public.loyalty_milestone_slug_matches(c.slug, v_premium_hints)
          )
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'premium_construction'
            and a.idempotency_key = 'premium_construction:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: premium_construction:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'premium_construction',
        'premium_construction:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- advanced_fabric (assignments + fabric composition fibres)
  select * into v_def
  from public.loyalty_milestone_definitions
  where retailer_id = v_order.retailer_id
    and kind = 'advanced_fabric'
    and active
  limit 1;

  if found then
    for v_concept in
      select distinct c.id as concept_id, c.canonical_name
      from public.order_lines ol
      join public.product_variants pv on pv.id = ol.product_variant_id
      left join public.entity_metadata_assignments ema
        on ema.target_type = 'product'
        and ema.target_id = pv.product_id
        and ema.retailer_id = v_order.retailer_id
        and ema.review_status = 'accepted'
        and ema.deleted_at is null
      left join public.product_fabric_profiles pfp
        on pfp.product_id = pv.product_id
        and pfp.deleted_at is null
        and (
          pfp.product_variant_id is null
          or pfp.product_variant_id = pv.id
        )
      left join public.product_fabric_composition pfc
        on pfc.profile_id = pfp.id
      join public.metadata_concepts c
        on c.deleted_at is null
        and c.kind in ('fibre', 'fabric_collection')
        and (
          c.id = ema.concept_id
          or c.id = pfc.fibre_concept_id
        )
      where ol.order_id = v_order.id
        and (
          (
            cardinality(v_def.match_concept_ids) > 0
            and c.id = any (v_def.match_concept_ids)
          )
          or (
            cardinality(v_def.match_concept_ids) = 0
            and public.loyalty_milestone_slug_matches(c.slug, v_fabric_hints)
          )
        )
        and not exists (
          select 1 from public.loyalty_milestone_awards a
          where a.loyalty_account_id = v_account.id
            and a.kind = 'advanced_fabric'
            and a.idempotency_key = 'advanced_fabric:' || c.id::text
            and a.status = 'awarded'
        )
    loop
      v_points := least(v_def.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: advanced_fabric:' || v_concept.concept_id::text
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_def.id,
        'advanced_fabric',
        'advanced_fabric:' || v_concept.concept_id::text,
        v_order.id, v_concept.concept_id, v_points, v_ledger_id,
        v_def.label,
        v_def.explanation || ' (' || v_concept.canonical_name || ')'
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end loop;
  end if;

  -- configured peers (custom)
  for v_custom in
    select *
    from public.loyalty_milestone_definitions
    where retailer_id = v_order.retailer_id
      and kind = 'custom'
      and active
      and cardinality(match_concept_ids) > 0
  loop
    if exists (
      select 1 from public.loyalty_milestone_awards a
      where a.loyalty_account_id = v_account.id
        and a.kind = 'custom'
        and a.idempotency_key = 'custom:' || v_custom.custom_key
        and a.status = 'awarded'
    ) then
      continue;
    end if;

    v_peer_concept_id := null;
    v_peer_concept_name := null;
    select c.id, c.canonical_name
    into v_peer_concept_id, v_peer_concept_name
    from public.order_lines ol
    join public.product_variants pv on pv.id = ol.product_variant_id
    left join public.entity_metadata_assignments ema
      on ema.target_type = 'product'
      and ema.target_id = pv.product_id
      and ema.retailer_id = v_order.retailer_id
      and ema.review_status = 'accepted'
      and ema.deleted_at is null
    left join public.product_fabric_profiles pfp
      on pfp.product_id = pv.product_id
      and pfp.deleted_at is null
    left join public.product_fabric_composition pfc
      on pfc.profile_id = pfp.id
    join public.metadata_concepts c
      on c.deleted_at is null
      and (
        c.id = ema.concept_id
        or c.id = pfc.fibre_concept_id
      )
      and c.id = any (v_custom.match_concept_ids)
    where ol.order_id = v_order.id
    limit 1;

    if v_peer_concept_id is not null then
      v_points := least(v_custom.points, 1000);
      insert into public.loyalty_ledger_entries (
        loyalty_account_id, type, points, related_order_id, note
      ) values (
        v_account.id, 'earn_bonus', v_points, v_order.id,
        'Milestone: custom:' || v_custom.custom_key
      )
      returning id into v_ledger_id;

      update public.loyalty_accounts
      set points_balance = points_balance + v_points,
          lifetime_points = lifetime_points + v_points
      where id = v_account.id;

      insert into public.loyalty_milestone_awards (
        retailer_id, customer_id, loyalty_account_id, definition_id,
        kind, idempotency_key, related_order_id, related_concept_id, points,
        loyalty_ledger_entry_id, label, explanation
      ) values (
        v_order.retailer_id, v_order.customer_id, v_account.id, v_custom.id,
        'custom', 'custom:' || v_custom.custom_key,
        v_order.id, v_peer_concept_id, v_points, v_ledger_id,
        v_custom.label, v_custom.explanation
      )
      on conflict (loyalty_account_id, kind, idempotency_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return v_awarded;
end;
$$;

revoke all on function public.sync_loyalty_milestones_for_order(uuid) from public;
grant execute on function public.sync_loyalty_milestones_for_order(uuid)
  to authenticated, service_role;
