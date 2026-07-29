-- PAON Intelligence Platform Stage 2.6.
-- Transactional reviewed import publishing: one RPC publishes a single
-- reviewed valid row atomically (product, variant, assets, exact facts,
-- accepted assignments). Failures roll catalogue writes back while retaining
-- source rows and publish_error for resumable retries.

alter table public.catalogue_import_rows
  add column published_product_id uuid
    references public.products (id) on delete set null,
  add column published_variant_id uuid
    references public.product_variants (id) on delete set null,
  add column published_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null,
  add column published_at timestamptz,
  add column last_publish_attempt_at timestamptz,
  add column publish_error text
    check (
      publish_error is null
      or length(btrim(publish_error)) between 1 and 1000
    );

create index catalogue_import_rows_published_product_idx
  on public.catalogue_import_rows (retailer_id, published_product_id)
  where published_product_id is not null;

comment on column public.catalogue_import_rows.published_product_id is
  'Product created or updated by a successful publish; retained for idempotent retries.';
comment on column public.catalogue_import_rows.publish_error is
  'Last publish failure message after catalogue writes were rolled back; cleared on success.';

create or replace function public.review_catalogue_import_task(
  p_task_id uuid,
  p_status public.metadata_review_task_status
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.metadata_review_tasks%rowtype;
  v_staff_id uuid;
begin
  if p_status not in ('accepted', 'rejected', 'dismissed') then
    raise exception 'Review decision must be accepted, rejected, or dismissed';
  end if;

  if public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to review catalogue import tasks';
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'An accepted retailer staff identity is required';
  end if;

  select task.* into v_task
  from public.metadata_review_tasks as task
  where task.id = p_task_id
  for update;

  if not found
    or v_task.retailer_id <> public.current_retailer_id() then
    raise exception 'Metadata review task is unavailable';
  end if;

  if v_task.status = p_status
    and v_task.reviewed_by_staff_id is not null then
    return v_task.id;
  end if;

  update public.metadata_review_tasks
  set
    status = p_status,
    reviewed_by_staff_id = v_staff_id,
    reviewed_at = clock_timestamp()
  where id = v_task.id;

  return v_task.id;
end;
$$;

revoke all on function public.review_catalogue_import_task(
  uuid,
  public.metadata_review_task_status
) from public;
grant execute on function public.review_catalogue_import_task(
  uuid,
  public.metadata_review_task_status
) to authenticated;

comment on function public.review_catalogue_import_task(
  uuid,
  public.metadata_review_task_status
) is
  'Records a manager review decision on an import metadata task with actor attribution.';

create or replace function public.publish_catalogue_import_row(
  p_import_row_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.catalogue_import_rows%rowtype;
  v_import public.catalogue_imports%rowtype;
  v_staff_id uuid;
  v_retailer_id uuid;
  v_proposed jsonb;
  v_external_sku text;
  v_name text;
  v_description text;
  v_slug text;
  v_currency text;
  v_price integer;
  v_colour text;
  v_primary_image text;
  v_swatch_image text;
  v_weight numeric;
  v_supplier_reference text;
  v_product_id uuid;
  v_variant_id uuid;
  v_outcome text;
  v_mapping jsonb;
  v_concept_id uuid;
  v_supplier_value text;
  v_existing_assignment_id uuid;
  v_pending_task_count integer;
  v_error text;
  v_slug_base text;
  v_slug_attempt text;
  v_slug_suffix integer;
  v_profile_id uuid;
begin
  if public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to publish catalogue import rows';
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'An accepted retailer staff identity is required';
  end if;

  v_retailer_id := public.current_retailer_id();
  if v_retailer_id is null then
    raise exception 'Retailer context is required';
  end if;

  select import_row.* into v_row
  from public.catalogue_import_rows as import_row
  where import_row.id = p_import_row_id
  for update;

  if not found or v_row.retailer_id <> v_retailer_id then
    raise exception 'Catalogue import row is unavailable';
  end if;

  select catalogue_import.* into v_import
  from public.catalogue_imports as catalogue_import
  where catalogue_import.id = v_row.import_id
    and catalogue_import.deleted_at is null
  for update;

  if not found or v_import.retailer_id <> v_retailer_id then
    raise exception 'Catalogue import is unavailable';
  end if;

  if v_row.status = 'published'
    and v_row.published_product_id is not null then
    return jsonb_build_object(
      'ok', true,
      'productId', v_row.published_product_id,
      'variantId', v_row.published_variant_id,
      'outcome', 'already_published'
    );
  end if;

  if v_row.status <> 'valid' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_row',
      'error', 'Only valid import rows can be published'
    );
  end if;

  if v_row.proposed_product is null
    or jsonb_typeof(v_row.proposed_product) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_row',
      'error', 'Import row is missing a proposed product payload'
    );
  end if;

  select count(*)::integer into v_pending_task_count
  from public.metadata_review_tasks as task
  where task.import_row_id = v_row.id
    and task.status = 'pending';

  if v_pending_task_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_reviewed',
      'error', format(
        'Resolve %s pending review task(s) before publishing',
        v_pending_task_count
      )
    );
  end if;

  v_proposed := v_row.proposed_product;
  v_external_sku := nullif(btrim(coalesce(v_proposed ->> 'externalSku', v_row.external_sku, '')), '');
  v_name := nullif(btrim(coalesce(v_proposed ->> 'name', '')), '');
  v_description := coalesce(v_proposed ->> 'description', '');
  v_slug_base := nullif(btrim(coalesce(v_proposed ->> 'proposedSlug', '')), '');
  v_currency := upper(nullif(btrim(coalesce(v_proposed ->> 'currency', '')), ''));
  v_colour := nullif(btrim(coalesce(v_proposed ->> 'colour', '')), '');
  v_primary_image := nullif(btrim(coalesce(v_proposed ->> 'primaryImageUrl', '')), '');
  v_swatch_image := nullif(btrim(coalesce(v_proposed ->> 'swatchImageUrl', '')), '');
  v_supplier_reference := nullif(
    btrim(coalesce(v_proposed ->> 'supplierReference', '')),
    ''
  );

  if v_proposed ? 'priceAmountMinorUnits'
    and jsonb_typeof(v_proposed -> 'priceAmountMinorUnits') = 'number' then
    v_price := (v_proposed ->> 'priceAmountMinorUnits')::integer;
  end if;

  if v_proposed ? 'weightGsm'
    and jsonb_typeof(v_proposed -> 'weightGsm') = 'number' then
    v_weight := (v_proposed ->> 'weightGsm')::numeric;
  end if;

  if v_external_sku is null or v_name is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_row',
      'error', 'Published rows require externalSku and name'
    );
  end if;

  if v_price is null or v_currency is null or length(v_currency) <> 3 then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_row',
      'error', 'Published rows require price and a 3-letter currency'
    );
  end if;

  if v_slug_base is null then
    v_slug_base := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(both '-' from v_slug_base);
  end if;
  if v_slug_base is null or length(v_slug_base) < 2 then
    v_slug_base := lower(regexp_replace(v_external_sku, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(both '-' from v_slug_base);
  end if;
  if v_slug_base is null or length(v_slug_base) < 2 then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_row',
      'error', 'Could not derive a publishable product slug'
    );
  end if;
  v_slug_base := left(v_slug_base, 100);

  update public.catalogue_imports
  set status = 'publishing'
  where id = v_import.id
    and status in ('uploaded', 'previewing', 'ready', 'failed');

  update public.catalogue_import_rows
  set last_publish_attempt_at = clock_timestamp()
  where id = v_row.id;

  begin
    select variant.id, product.id
    into v_variant_id, v_product_id
    from public.product_variants as variant
    inner join public.products as product
      on product.id = variant.product_id
    where product.retailer_id = v_retailer_id
      and product.deleted_at is null
      and variant.deleted_at is null
      and variant.sku = v_external_sku
    for update of product, variant;

    if v_product_id is not null then
      v_outcome := 'updated';
      update public.products
      set
        name = v_name,
        description = v_description,
        primary_image_url = coalesce(v_primary_image, primary_image_url),
        swatch_image_url = coalesce(v_swatch_image, swatch_image_url)
      where id = v_product_id;

      update public.product_variants
      set
        color = coalesce(v_colour, color),
        price_amount_minor_units = v_price,
        price_currency = v_currency
      where id = v_variant_id;
    else
      v_outcome := 'created';
      v_slug := v_slug_base;
      v_slug_suffix := 0;
      loop
        v_slug_attempt := case
          when v_slug_suffix = 0 then v_slug
          else left(v_slug_base, greatest(1, 100 - length(v_slug_suffix::text) - 1))
            || '-' || v_slug_suffix::text
        end;
        exit when not exists (
          select 1
          from public.products as product
          where product.retailer_id = v_retailer_id
            and product.slug = v_slug_attempt
            and product.deleted_at is null
        );
        v_slug_suffix := v_slug_suffix + 1;
        if v_slug_suffix > 100 then
          raise exception 'Could not allocate a unique product slug';
        end if;
      end loop;
      v_slug := v_slug_attempt;

      insert into public.products (
        retailer_id,
        name,
        slug,
        description,
        status,
        is_made_to_order,
        is_alterable,
        primary_image_url,
        swatch_image_url
      ) values (
        v_retailer_id,
        v_name,
        v_slug,
        v_description,
        'draft',
        false,
        false,
        v_primary_image,
        v_swatch_image
      )
      returning id into v_product_id;

      insert into public.product_variants (
        product_id,
        sku,
        color,
        price_amount_minor_units,
        price_currency,
        inventory_quantity
      ) values (
        v_product_id,
        v_external_sku,
        v_colour,
        v_price,
        v_currency,
        0
      )
      returning id into v_variant_id;
    end if;

    -- Exact facts: weight and supplier reference only. Composition remains
    -- concept-linked via product management / later enrichment; never wipe it.
    if v_weight is not null or v_supplier_reference is not null then
      select profile.id into v_profile_id
      from public.product_fabric_profiles as profile
      where profile.product_id = v_product_id
        and profile.product_variant_id is null
        and profile.deleted_at is null
      for update;

      if v_profile_id is null then
        insert into public.product_fabric_profiles (
          retailer_id,
          product_id,
          product_variant_id,
          fabric_weight_grams_per_square_metre,
          supplier_reference
        ) values (
          v_retailer_id,
          v_product_id,
          null,
          v_weight,
          v_supplier_reference
        );
      else
        update public.product_fabric_profiles
        set
          fabric_weight_grams_per_square_metre = coalesce(
            v_weight,
            fabric_weight_grams_per_square_metre
          ),
          supplier_reference = coalesce(
            v_supplier_reference,
            supplier_reference
          )
        where id = v_profile_id;
      end if;
    end if;

    for v_mapping in
      select value
      from jsonb_array_elements(
        coalesce(v_proposed -> 'categoryMappings', '[]'::jsonb)
      ) as value
    loop
      if coalesce(v_mapping ->> 'status', '') <> 'mapped' then
        continue;
      end if;

      v_concept_id := nullif(v_mapping ->> 'mappedConceptId', '')::uuid;
      v_supplier_value := nullif(btrim(coalesce(v_mapping ->> 'rawValue', '')), '');
      if v_concept_id is null or v_supplier_value is null then
        continue;
      end if;

      if not exists (
        select 1
        from public.metadata_concepts as concept
        where concept.id = v_concept_id
          and concept.deleted_at is null
          and (
            concept.retailer_id is null
            or concept.retailer_id = v_retailer_id
          )
      ) then
        raise exception 'Mapped concept is unavailable for publishing';
      end if;

      select assignment.id into v_existing_assignment_id
      from public.entity_metadata_assignments as assignment
      where assignment.retailer_id = v_retailer_id
        and assignment.target_type = 'product'
        and assignment.target_id = v_product_id
        and assignment.concept_id = v_concept_id
        and assignment.deleted_at is null
      for update;

      if v_existing_assignment_id is null then
        insert into public.entity_metadata_assignments (
          retailer_id,
          target_type,
          target_id,
          concept_id,
          source,
          review_status,
          supplier_value,
          reviewed_by_staff_id,
          reviewed_at
        ) values (
          v_retailer_id,
          'product',
          v_product_id,
          v_concept_id,
          'supplier',
          'accepted',
          v_supplier_value,
          v_staff_id,
          clock_timestamp()
        );
      elsif exists (
        select 1
        from public.entity_metadata_assignments as assignment
        where assignment.id = v_existing_assignment_id
          and assignment.review_status <> 'accepted'
      ) then
        update public.entity_metadata_assignments
        set
          review_status = 'accepted',
          supplier_value = coalesce(supplier_value, v_supplier_value),
          reviewed_by_staff_id = v_staff_id,
          reviewed_at = clock_timestamp()
        where id = v_existing_assignment_id;
      end if;
    end loop;

    update public.catalogue_import_rows
    set
      status = 'published',
      published_product_id = v_product_id,
      published_variant_id = v_variant_id,
      published_by_staff_id = v_staff_id,
      published_at = clock_timestamp(),
      publish_error = null,
      last_publish_attempt_at = clock_timestamp()
    where id = v_row.id;

    if not exists (
      select 1
      from public.catalogue_import_rows as remaining
      where remaining.import_id = v_import.id
        and remaining.status = 'valid'
    ) then
      update public.catalogue_imports
      set
        status = 'completed',
        completed_at = clock_timestamp()
      where id = v_import.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'productId', v_product_id,
      'variantId', v_variant_id,
      'outcome', v_outcome
    );
  exception
    when others then
      v_error := left(SQLERRM, 1000);
      update public.catalogue_import_rows
      set
        publish_error = v_error,
        last_publish_attempt_at = clock_timestamp()
      where id = v_row.id;

      update public.catalogue_imports
      set status = 'failed'
      where id = v_import.id
        and status in ('publishing', 'ready', 'previewing');

      return jsonb_build_object(
        'ok', false,
        'code', 'publish_failed',
        'error', v_error
      );
  end;
end;
$$;

revoke all on function public.publish_catalogue_import_row(uuid) from public;
grant execute on function public.publish_catalogue_import_row(uuid)
  to authenticated;

comment on function public.publish_catalogue_import_row(uuid) is
  'Atomically publishes one reviewed valid import row into product/variant/assets/exact facts/accepted assignments; rolls catalogue writes back on failure while retaining publish_error for retry.';
