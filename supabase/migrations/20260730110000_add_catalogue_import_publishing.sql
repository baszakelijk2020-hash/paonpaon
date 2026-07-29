-- PAON Intelligence Platform Stage 2.6.
-- Transactional reviewed import publishing: atomically create/update products,
-- variants, assets, exact facts, and accepted metadata assignments from
-- reviewed import rows. Failures roll back fully; published rows are idempotent.

alter table public.catalogue_import_rows
  add column published_product_id uuid
    references public.products (id) on delete set null,
  add column published_variant_id uuid
    references public.product_variants (id) on delete set null,
  add column publish_error text check (
    publish_error is null
    or length(btrim(publish_error)) between 1 and 2000
  ),
  add column published_at timestamptz,
  add column published_by_staff_id uuid
    references public.retailer_staff_members (id) on delete set null;

create index catalogue_import_rows_published_product_idx
  on public.catalogue_import_rows (retailer_id, published_product_id)
  where published_product_id is not null;

comment on column public.catalogue_import_rows.published_product_id is
  'Catalogue product created or updated when this row was published.';
comment on column public.catalogue_import_rows.published_variant_id is
  'Primary variant created or updated when this row was published.';
comment on column public.catalogue_import_rows.publish_error is
  'Last publish attempt error retained for retry; cleared on success.';

create or replace function public.review_catalogue_import_metadata_task(
  p_task_id uuid,
  p_status public.metadata_review_task_status,
  p_proposed_concept_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.metadata_review_tasks%rowtype;
  v_staff_id uuid;
  v_import_row public.catalogue_import_rows%rowtype;
  v_field text;
  v_proposed jsonb;
  v_mappings jsonb;
  v_concept_slug text;
  v_updated_mappings jsonb := '[]'::jsonb;
  v_mapping jsonb;
  v_i integer;
begin
  if p_status not in ('accepted', 'rejected', 'dismissed') then
    raise exception 'Review decision must be accepted, rejected, or dismissed';
  end if;

  if public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to review import metadata tasks';
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

  if v_task.status = p_status then
    return v_task.id;
  end if;

  if p_status = 'accepted' and p_proposed_concept_id is null then
    raise exception 'Accepted import review tasks require a concept mapping';
  end if;

  if p_proposed_concept_id is not null then
    if not exists (
      select 1
      from public.metadata_concepts as concept
      where concept.id = p_proposed_concept_id
        and concept.deleted_at is null
        and (
          concept.retailer_id is null
          or concept.retailer_id = v_task.retailer_id
        )
    ) then
      raise exception 'Proposed concept is unavailable';
    end if;
  end if;

  update public.metadata_review_tasks
  set
    status = p_status,
    proposed_concept_id = coalesce(p_proposed_concept_id, proposed_concept_id),
    reviewed_by_staff_id = v_staff_id,
    reviewed_at = clock_timestamp()
  where id = v_task.id;

  if p_status = 'accepted'
    and p_proposed_concept_id is not null
    and v_task.import_row_id is not null then
    select import_row.* into v_import_row
    from public.catalogue_import_rows as import_row
    where import_row.id = v_task.import_row_id
    for update;

    if found and v_import_row.proposed_product is not null then
      v_field := split_part(v_task.proposed_value, ':', 1);
      v_proposed := v_import_row.proposed_product;
      v_mappings := coalesce(v_proposed -> 'categoryMappings', '[]'::jsonb);

      select concept.slug into v_concept_slug
      from public.metadata_concepts as concept
      where concept.id = p_proposed_concept_id;

      for v_i in 0 .. jsonb_array_length(v_mappings) - 1 loop
        v_mapping := v_mappings -> v_i;
        if v_mapping ->> 'rawValue' = trim(substring(v_task.proposed_value from position(':' in v_task.proposed_value) + 1)) then
          v_updated_mappings := v_updated_mappings || jsonb_build_array(
            v_mapping
              || jsonb_build_object(
                'status', 'mapped',
                'mappedConceptId', p_proposed_concept_id::text,
                'mappedConceptSlug', v_concept_slug,
                'explanation', format(
                  'Staff accepted supplier value as accepted concept "%s" during import review.',
                  v_concept_slug
                )
              )
          );
        else
          v_updated_mappings := v_updated_mappings || jsonb_build_array(v_mapping);
        end if;
      end loop;

      update public.catalogue_import_rows
      set proposed_product = jsonb_set(
        v_proposed,
        '{categoryMappings}',
        v_updated_mappings,
        true
      )
      where id = v_import_row.id;
    end if;
  end if;

  return v_task.id;
end;
$$;

revoke all on function public.review_catalogue_import_metadata_task(
  uuid,
  public.metadata_review_task_status,
  uuid
) from public;
grant execute on function public.review_catalogue_import_metadata_task(
  uuid,
  public.metadata_review_task_status,
  uuid
) to authenticated, service_role;

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
  v_proposed jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_existing_variant_id uuid;
  v_slug text;
  v_name text;
  v_description text;
  v_sku text;
  v_price integer;
  v_currency text;
  v_primary_image text;
  v_swatch_image text;
  v_weight numeric;
  v_supplier_ref text;
  v_pending_tasks integer;
  v_error_count integer;
  v_mapping jsonb;
  v_concept_id uuid;
  v_assignment_id uuid;
  v_supplier_value text;
  v_unpublished integer;
  v_published integer;
begin
  if public.current_retailer_role() not in ('manager', 'admin', 'owner') then
    raise exception 'Not authorized to publish catalogue imports';
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'An accepted retailer staff identity is required';
  end if;

  select import_row.* into v_row
  from public.catalogue_import_rows as import_row
  where import_row.id = p_import_row_id
  for update;

  if not found
    or v_row.retailer_id <> public.current_retailer_id() then
    raise exception 'Catalogue import row is unavailable';
  end if;

  if v_row.status = 'published' then
    return jsonb_build_object(
      'productId', v_row.published_product_id,
      'variantId', v_row.published_variant_id,
      'idempotent', true
    );
  end if;

  if v_row.status <> 'valid' then
    raise exception 'Only valid import rows can be published';
  end if;

  select count(*) into v_error_count
  from jsonb_array_elements(v_row.validation_errors) as issue
  where issue ->> 'severity' = 'error';

  if v_error_count > 0 then
    raise exception 'Import row has blocking validation errors';
  end if;

  select count(*) into v_pending_tasks
  from public.metadata_review_tasks as task
  where task.import_row_id = v_row.id
    and task.status = 'pending';

  if v_pending_tasks > 0 then
    raise exception 'All metadata review tasks must be resolved before publish';
  end if;

  v_proposed := v_row.proposed_product;
  if v_proposed is null then
    raise exception 'Import row has no proposed product payload';
  end if;

  v_sku := nullif(btrim(v_proposed ->> 'externalSku'), '');
  v_name := nullif(btrim(v_proposed ->> 'name'), '');
  if v_sku is null or v_name is null then
    raise exception 'Import row requires external SKU and product name';
  end if;

  for v_mapping in
    select value
    from jsonb_array_elements(coalesce(v_proposed -> 'categoryMappings', '[]'::jsonb))
  loop
    if coalesce(v_mapping ->> 'status', '') <> 'mapped'
      or nullif(v_mapping ->> 'mappedConceptId', '') is null then
      raise exception 'All category mappings must be accepted before publish';
    end if;
  end loop;

  v_description := coalesce(v_proposed ->> 'description', '');
  v_slug := nullif(btrim(v_proposed ->> 'proposedSlug'), '');
  if v_slug is null then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    v_slug := left(v_slug, 100);
  end if;

  v_price := (v_proposed ->> 'priceAmountMinorUnits')::integer;
  v_currency := coalesce(nullif(v_proposed ->> 'currency', ''), 'GBP');
  v_primary_image := nullif(btrim(v_proposed ->> 'primaryImageUrl'), '');
  v_swatch_image := nullif(btrim(v_proposed ->> 'swatchImageUrl'), '');
  v_weight := (v_proposed ->> 'weightGsm')::numeric;
  v_supplier_ref := nullif(btrim(v_proposed ->> 'supplierReference'), '');

  select variant.id, variant.product_id
  into v_existing_variant_id, v_product_id
  from public.product_variants as variant
  join public.products as product on product.id = variant.product_id
  where variant.sku = v_sku
    and product.retailer_id = v_row.retailer_id
    and variant.deleted_at is null
    and product.deleted_at is null
  limit 1;

  if v_product_id is null then
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
      v_row.retailer_id,
      v_name,
      v_slug,
      v_description,
      'draft',
      false,
      true,
      v_primary_image,
      v_swatch_image
    )
    returning id into v_product_id;

    insert into public.product_variants (
      product_id,
      sku,
      price_amount_minor_units,
      price_currency,
      inventory_quantity
    ) values (
      v_product_id,
      v_sku,
      coalesce(v_price, 0),
      v_currency,
      0
    )
    returning id into v_variant_id;
  else
    update public.products
    set
      name = v_name,
      description = v_description,
      primary_image_url = coalesce(v_primary_image, primary_image_url),
      swatch_image_url = coalesce(v_swatch_image, swatch_image_url)
    where id = v_product_id;

    if v_existing_variant_id is not null then
      update public.product_variants
      set
        price_amount_minor_units = coalesce(v_price, price_amount_minor_units),
        price_currency = coalesce(v_currency, price_currency)
      where id = v_existing_variant_id;
      v_variant_id := v_existing_variant_id;
    else
      insert into public.product_variants (
        product_id,
        sku,
        price_amount_minor_units,
        price_currency,
        inventory_quantity
      ) values (
        v_product_id,
        v_sku,
        coalesce(v_price, 0),
        v_currency,
        0
      )
      returning id into v_variant_id;
    end if;
  end if;

  if v_weight is not null or v_supplier_ref is not null then
    perform public.set_product_fabric_profile(
      v_product_id,
      null,
      v_weight,
      v_supplier_ref,
      '[]'::jsonb
    );
  end if;

  for v_mapping in
    select value
    from jsonb_array_elements(coalesce(v_proposed -> 'categoryMappings', '[]'::jsonb))
  loop
    v_concept_id := (v_mapping ->> 'mappedConceptId')::uuid;
    v_supplier_value := v_mapping ->> 'rawValue';

    select assignment.id into v_assignment_id
    from public.entity_metadata_assignments as assignment
    where assignment.retailer_id = v_row.retailer_id
      and assignment.target_type = 'product'
      and assignment.target_id = v_product_id
      and assignment.concept_id = v_concept_id
      and assignment.deleted_at is null
    limit 1;

    if v_assignment_id is null then
      insert into public.entity_metadata_assignments (
        retailer_id,
        target_type,
        target_id,
        concept_id,
        source,
        supplier_value,
        review_status,
        reviewed_by_staff_id,
        reviewed_at
      ) values (
        v_row.retailer_id,
        'product',
        v_product_id,
        v_concept_id,
        'supplier',
        v_supplier_value,
        'accepted',
        v_staff_id,
        clock_timestamp()
      );
    elsif exists (
      select 1
      from public.entity_metadata_assignments as assignment
      where assignment.id = v_assignment_id
        and assignment.review_status = 'pending'
    ) then
      update public.entity_metadata_assignments
      set
        review_status = 'accepted',
        reviewed_by_staff_id = v_staff_id,
        reviewed_at = clock_timestamp(),
        supplier_value = coalesce(v_supplier_value, supplier_value)
      where id = v_assignment_id;
    end if;
  end loop;

  update public.catalogue_import_rows
  set
    status = 'published',
    published_product_id = v_product_id,
    published_variant_id = v_variant_id,
    published_at = clock_timestamp(),
    published_by_staff_id = v_staff_id,
    publish_error = null
  where id = v_row.id;

  select import_job.* into v_import
  from public.catalogue_imports as import_job
  where import_job.id = v_row.import_id
  for update;

  select count(*) into v_unpublished
  from public.catalogue_import_rows as import_row
  where import_row.import_id = v_row.import_id
    and import_row.status not in ('published', 'rejected');

  select count(*) into v_published
  from public.catalogue_import_rows as import_row
  where import_row.import_id = v_row.import_id
    and import_row.status = 'published';

  update public.catalogue_imports
  set
    status = case
      when v_unpublished = 0 then 'completed'
      when v_published > 0 then 'publishing'
      else status
    end,
    completed_at = case
      when v_unpublished = 0 then clock_timestamp()
      else completed_at
    end
  where id = v_row.import_id;

  return jsonb_build_object(
    'productId', v_product_id,
    'variantId', v_variant_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.publish_catalogue_import_row(uuid) from public;
grant execute on function public.publish_catalogue_import_row(uuid)
  to authenticated, service_role;

comment on function public.publish_catalogue_import_row(uuid) is
  'Atomically publishes one reviewed import row into catalogue products, variants, exact facts, and accepted metadata assignments. Idempotent when the row is already published.';
