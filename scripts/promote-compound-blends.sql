-- Ensure every product with a genuine multi-fibre composition gets the
-- COMPOUND blend concept (the one that explains what the combination
-- means), and suppress the redundant single-fibre cards once the
-- compound match exists — one composition card, not three single-fibre
-- cards saying the same thing separately.

with staff as (
  select id as staff_id, retailer_id from retailer_staff_members
),
compound_concepts as (
  select id, slug,
    array_remove(array(
      select w from unnest(string_to_array(slug, '-')) as w
      where w not in ('blend', 'fresco', 's', 'super')
    ), null) as fibre_words
  from metadata_concepts
  where kind = 'fibre' and slug like '%-%' and slug not like 'knowledge-fixture%'
),
compound_matches as (
  select p.id as product_id, p.retailer_id, cc.id as concept_id
  from products p
  join compound_concepts cc on (
    select bool_and(p.name ilike '%' || fw || '%')
    from unnest(cc.fibre_words) as fw
  )
  where array_length(cc.fibre_words, 1) >= 2
)
insert into entity_metadata_assignments (
  retailer_id, target_type, target_id, concept_id, source,
  review_status, reviewed_by_staff_id, reviewed_at
)
select
  m.retailer_id, 'product'::metadata_target_type, m.product_id, m.concept_id,
  'paon'::metadata_source, 'accepted'::metadata_review_status,
  (select staff_id from staff where retailer_id = m.retailer_id limit 1),
  now()
from compound_matches m
where exists (select 1 from staff s where s.retailer_id = m.retailer_id)
on conflict (retailer_id, target_type, target_id, concept_id)
  where deleted_at is null
  do nothing;

-- Suppress single-fibre cards for products that now have a compound
-- match covering the same fibre (e.g. drop the standalone "Silk" card
-- once "Wool Silk Linen Blend" exists for that product).
with compound_concepts as (
  select id, slug,
    array_remove(array(
      select w from unnest(string_to_array(slug, '-')) as w
      where w not in ('blend', 'fresco', 's', 'super')
    ), null) as fibre_words
  from metadata_concepts
  where kind = 'fibre' and slug like '%-%' and slug not like 'knowledge-fixture%'
    and array_length(
      array_remove(array(
        select w from unnest(string_to_array(slug, '-')) as w
        where w not in ('blend', 'fresco', 's', 'super')
      ), null), 1
    ) >= 2
),
single_concepts as (
  select id, slug from metadata_concepts
  where kind = 'fibre' and slug not like '%-%' and slug not like 'knowledge-fixture%'
),
products_with_compound as (
  select distinct e.target_id, e.retailer_id, cc.fibre_words
  from entity_metadata_assignments e
  join compound_concepts cc on cc.id = e.concept_id
  where e.deleted_at is null
)
update entity_metadata_assignments e
set deleted_at = now()
from products_with_compound pwc
join single_concepts sc on sc.slug = any(pwc.fibre_words)
where e.target_id = pwc.target_id
  and e.retailer_id = pwc.retailer_id
  and e.concept_id = sc.id
  and e.deleted_at is null;

select count(*) as total_active from entity_metadata_assignments where deleted_at is null;
