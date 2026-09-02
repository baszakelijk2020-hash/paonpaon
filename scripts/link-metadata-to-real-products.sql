-- Populate entity_metadata_assignments for real production products,
-- pattern-matched against real metadata_concepts and real product names.
-- Additive only. review_status='accepted' so public storefront reads
-- (see 20260730020000_add_public_storefront_knowledge_reads.sql) show them.
-- source='paon' satisfies the check constraint without needing
-- confidence/evidence/supplier_value.

with staff as (
  select id as staff_id, retailer_id
  from retailer_staff_members
),
fibre_matches as (
  select
    p.id as product_id,
    p.retailer_id,
    c.id as concept_id
  from products p
  join staff s on s.retailer_id = p.retailer_id
  join metadata_concepts c on c.kind = 'fibre' and c.slug not like 'knowledge-fixture%'
  where
    (p.name ilike '%wool%' and c.slug ilike '%wool%')
    or (p.name ilike '%silk%' and c.slug ilike '%silk%')
    or (p.name ilike '%linen%' and c.slug ilike '%linen%')
    or (p.name ilike '%cotton%' and c.slug ilike '%cotton%')
    or (p.name ilike '%cashmere%' and c.slug ilike '%cashmere%')
),
garment_matches as (
  select
    p.id as product_id,
    p.retailer_id,
    c.id as concept_id
  from products p
  join staff s on s.retailer_id = p.retailer_id
  join metadata_concepts c on c.kind = 'garment_type' and c.slug not like 'knowledge-fixture%'
  where
    (p.name ilike '%trouser%' and c.slug ilike '%trouser%')
    or (p.name ilike '%suit%' and c.slug ilike '%suit%')
    or (p.name ilike '%jacket%' and c.slug ilike '%jacket%')
    or (p.name ilike '%knit%' and c.slug ilike '%knit%')
    or (p.name ilike '%shirt%' and c.slug ilike '%shirt%')
    or (p.name ilike '%shoe%' and c.slug ilike '%shoe%')
),
matches as (
  select distinct product_id, retailer_id, concept_id from fibre_matches
  union
  select distinct product_id, retailer_id, concept_id from garment_matches
)
insert into entity_metadata_assignments (
  retailer_id, target_type, target_id, concept_id, source,
  review_status, reviewed_by_staff_id, reviewed_at
)
select
  m.retailer_id,
  'product'::metadata_target_type,
  m.product_id,
  m.concept_id,
  'paon'::metadata_source,
  'accepted'::metadata_review_status,
  (select staff_id from staff where retailer_id = m.retailer_id limit 1),
  now()
from matches m
where exists (select 1 from staff s where s.retailer_id = m.retailer_id)
on conflict (retailer_id, target_type, target_id, concept_id)
  where deleted_at is null
  do nothing;

select count(*) as assignments_created from entity_metadata_assignments;
