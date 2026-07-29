-- PHASE 2.3 / EDU-003: anonymous storefront visitors must be able to read
-- the approved knowledge subset used by founder PDP mounts. Same ADR-014
-- "anyone can read the publicly showable subset" shape as products and
-- collections. Writes remain staff-only; inactive knowledge and pending /
-- rejected assignments stay invisible.

grant select on table public.knowledge_objects to anon;
grant select on table public.knowledge_object_concepts to anon;
grant select on table public.retailer_knowledge_overrides to anon;
grant select on table public.entity_metadata_assignments to anon;

create policy "anyone can read active storefront knowledge objects"
  on public.knowledge_objects for select
  using (
    active = true
    and deleted_at is null
    and (
      retailer_id is null
      or exists (
        select 1
        from public.retailers as retailer
        where retailer.id = knowledge_objects.retailer_id
          and retailer.status = 'active'
      )
    )
  );

create policy "anyone can read concepts for active storefront knowledge"
  on public.knowledge_object_concepts for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.knowledge_objects as knowledge_object
      where knowledge_object.id = knowledge_object_concepts.knowledge_object_id
        and knowledge_object.active = true
        and knowledge_object.deleted_at is null
        and (
          knowledge_object.retailer_id is null
          or exists (
            select 1
            from public.retailers as retailer
            where retailer.id = knowledge_object.retailer_id
              and retailer.status = 'active'
          )
        )
    )
  );

create policy "anyone can read knowledge overrides for active retailers"
  on public.retailer_knowledge_overrides for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.retailers as retailer
      where retailer.id = retailer_knowledge_overrides.retailer_id
        and retailer.status = 'active'
    )
  );

create policy "anyone can read accepted assignments for active catalogue"
  on public.entity_metadata_assignments for select
  using (
    review_status = 'accepted'
    and deleted_at is null
    and target_type in ('product', 'product_variant')
    and exists (
      select 1
      from public.retailers as retailer
      where retailer.id = entity_metadata_assignments.retailer_id
        and retailer.status = 'active'
    )
    and (
      (
        target_type = 'product'
        and exists (
          select 1
          from public.products as product
          where product.id = entity_metadata_assignments.target_id
            and product.retailer_id = entity_metadata_assignments.retailer_id
            and product.status = 'active'
            and product.deleted_at is null
        )
      )
      or (
        target_type = 'product_variant'
        and exists (
          select 1
          from public.product_variants as variant
          join public.products as product
            on product.id = variant.product_id
          where variant.id = entity_metadata_assignments.target_id
            and product.retailer_id = entity_metadata_assignments.retailer_id
            and product.status = 'active'
            and product.deleted_at is null
            and variant.deleted_at is null
        )
      )
    )
  );
