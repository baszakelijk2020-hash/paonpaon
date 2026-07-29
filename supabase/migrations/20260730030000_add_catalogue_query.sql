-- PHASE 2.4 structured catalogue query: indexed search path and RPC helpers.

create index if not exists products_active_retailer_created_idx
  on public.products (retailer_id, created_at desc)
  where deleted_at is null and status = 'active';

create index if not exists product_variants_active_price_idx
  on public.product_variants (product_id, price_amount_minor_units)
  where deleted_at is null;

create index if not exists product_fabric_profiles_retailer_weight_idx
  on public.product_fabric_profiles (retailer_id, fabric_weight_grams_per_square_metre)
  where deleted_at is null and product_variant_id is null;

create index if not exists metadata_concepts_active_kind_idx
  on public.metadata_concepts (kind, slug)
  where deleted_at is null and active = true;

create or replace function public.search_catalogue_products(
  p_retailer_id uuid,
  p_query text default null,
  p_concept_ids uuid[] default null,
  p_min_weight numeric default null,
  p_max_weight numeric default null,
  p_min_price_minor integer default null,
  p_max_price_minor integer default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 48
)
returns table (
  product_id uuid,
  relevance_score numeric,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with active_products as (
    select
      product.id,
      product.name,
      product.description,
      product.slug,
      product.created_at,
      coalesce(min(variant.price_amount_minor_units), 0) as min_price_minor
    from public.products as product
    left join public.product_variants as variant
      on variant.product_id = product.id
      and variant.deleted_at is null
    where product.retailer_id = p_retailer_id
      and product.deleted_at is null
      and product.status = 'active'
    group by product.id
  ),
  product_concepts as (
    select
      assignment.target_id as product_id,
      array_agg(distinct assignment.concept_id) as concept_ids
    from public.entity_metadata_assignments as assignment
    where assignment.retailer_id = p_retailer_id
      and assignment.review_status = 'accepted'
      and assignment.deleted_at is null
      and assignment.target_type = 'product'
    group by assignment.target_id

    union all

    select
      variant.product_id,
      array_agg(distinct assignment.concept_id) as concept_ids
    from public.entity_metadata_assignments as assignment
    join public.product_variants as variant
      on variant.id = assignment.target_id
      and variant.deleted_at is null
    join public.products as product
      on product.id = variant.product_id
      and product.deleted_at is null
    where assignment.retailer_id = p_retailer_id
      and assignment.review_status = 'accepted'
      and assignment.deleted_at is null
      and assignment.target_type = 'product_variant'
    group by variant.product_id
  ),
  merged_concepts as (
    select
      product_id,
      array_agg(distinct concept_id) as concept_ids
    from (
      select
        product_concepts.product_id,
        unnest(product_concepts.concept_ids) as concept_id
      from product_concepts
    ) as expanded
    group by product_id
  ),
  product_weights as (
    select
      profile.product_id,
      profile.fabric_weight_grams_per_square_metre as fabric_weight
    from public.product_fabric_profiles as profile
    where profile.retailer_id = p_retailer_id
      and profile.deleted_at is null
      and profile.product_variant_id is null
  ),
  filtered as (
    select
      active_products.id as product_id,
      active_products.created_at,
      active_products.min_price_minor,
      case
        when coalesce(btrim(p_query), '') = '' then 0
        else (
          case when active_products.name ilike '%' || p_query || '%' then 4 else 0 end
          + case when active_products.description ilike '%' || p_query || '%' then 2 else 0 end
          + case when active_products.slug ilike '%' || p_query || '%' then 1 else 0 end
        )
      end::numeric as relevance_score
    from active_products
    left join merged_concepts
      on merged_concepts.product_id = active_products.id
    left join product_weights
      on product_weights.product_id = active_products.id
    where (
      p_concept_ids is null
      or cardinality(p_concept_ids) = 0
      or merged_concepts.concept_ids @> p_concept_ids
    )
    and (
      p_min_weight is null
      or (
        product_weights.fabric_weight is not null
        and product_weights.fabric_weight >= p_min_weight
      )
    )
    and (
      p_max_weight is null
      or (
        product_weights.fabric_weight is not null
        and product_weights.fabric_weight <= p_max_weight
      )
    )
    and (
      p_min_price_minor is null
      or active_products.min_price_minor >= p_min_price_minor
    )
    and (
      p_max_price_minor is null
      or active_products.min_price_minor <= p_max_price_minor
    )
    and (
      coalesce(btrim(p_query), '') = ''
      or active_products.name ilike '%' || p_query || '%'
      or active_products.description ilike '%' || p_query || '%'
      or active_products.slug ilike '%' || p_query || '%'
      or (
        p_concept_ids is not null
        and cardinality(p_concept_ids) > 0
        and merged_concepts.concept_ids && p_concept_ids
      )
    )
  ),
  ranked as (
    select
      filtered.product_id,
      filtered.relevance_score,
      count(*) over () as total_count,
      row_number() over (
        order by
          case when p_sort = 'relevance' then filtered.relevance_score end desc,
          case when p_sort = 'price_asc' then filtered.min_price_minor end asc,
          case when p_sort = 'price_desc' then filtered.min_price_minor end desc,
          filtered.created_at desc,
          filtered.product_id asc
      ) as row_num
    from filtered
  )
  select
    ranked.product_id,
    ranked.relevance_score,
    ranked.total_count
  from ranked
  where ranked.row_num > greatest((p_page - 1) * p_page_size, 0)
    and ranked.row_num <= p_page * p_page_size;
$$;

create or replace function public.list_catalogue_facets(
  p_retailer_id uuid
)
returns table (
  concept_id uuid,
  concept_kind text,
  concept_slug text,
  concept_label text,
  product_count bigint
)
language sql
stable
set search_path = ''
as $$
  with active_products as (
    select product.id
    from public.products as product
    where product.retailer_id = p_retailer_id
      and product.deleted_at is null
      and product.status = 'active'
  ),
  accepted_assignments as (
    select
      assignment.target_id as product_id,
      assignment.concept_id
    from public.entity_metadata_assignments as assignment
    join active_products
      on active_products.id = assignment.target_id
    where assignment.retailer_id = p_retailer_id
      and assignment.review_status = 'accepted'
      and assignment.deleted_at is null
      and assignment.target_type = 'product'

    union all

    select
      variant.product_id,
      assignment.concept_id
    from public.entity_metadata_assignments as assignment
    join public.product_variants as variant
      on variant.id = assignment.target_id
      and variant.deleted_at is null
    join active_products
      on active_products.id = variant.product_id
    where assignment.retailer_id = p_retailer_id
      and assignment.review_status = 'accepted'
      and assignment.deleted_at is null
      and assignment.target_type = 'product_variant'
  )
  select
    concept.id as concept_id,
    concept.kind as concept_kind,
    concept.slug as concept_slug,
    concept.canonical_name as concept_label,
    count(distinct accepted_assignments.product_id) as product_count
  from accepted_assignments
  join public.metadata_concepts as concept
    on concept.id = accepted_assignments.concept_id
  where concept.deleted_at is null
    and concept.active = true
    and (concept.retailer_id is null or concept.retailer_id = p_retailer_id)
    and concept.kind in (
      'mill',
      'weave',
      'performance',
      'climate',
      'season',
      'pattern',
      'construction',
      'occasion',
      'formality',
      'colour'
    )
  group by concept.id, concept.kind, concept.slug, concept.canonical_name
  order by concept.kind asc, concept.canonical_name asc;
$$;

revoke all on function public.search_catalogue_products(
  uuid,
  text,
  uuid[],
  numeric,
  numeric,
  integer,
  integer,
  text,
  integer,
  integer
) from public;

revoke all on function public.list_catalogue_facets(uuid) from public;

grant execute on function public.search_catalogue_products(
  uuid,
  text,
  uuid[],
  numeric,
  numeric,
  integer,
  integer,
  text,
  integer,
  integer
) to authenticated, service_role;

grant execute on function public.list_catalogue_facets(uuid)
  to authenticated, service_role;
