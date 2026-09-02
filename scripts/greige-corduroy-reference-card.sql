-- Reference implementation of the new consolidated card format:
-- ONE card per product — title = mill, summary = short fabric-fact
-- sentence, body = mill paragraph + garment-styling paragraph (from
-- real photo analysis). Replaces the two separate Pontoglio/Corduroy
-- cards previously assigned to this product.

-- Product-specific synthetic concept so this card attaches to exactly
-- one product without affecting any other Pontoglio/corduroy item.
insert into metadata_concepts (id, slug, kind, canonical_name)
values (
  'd5000000-0000-4000-8000-000000009090',
  'greige-cotton-corduroy-9090-card',
  'construction',
  'Greige Cotton Corduroy — Product Card'
)
on conflict (id) do nothing;

insert into knowledge_objects (id, topic, title, slug, summary, body, display_types, commercial_intent, priority, active)
values (
  'e6000000-0000-4000-8000-000000009090',
  'construction',
  'Pontoglio',
  'greige-cotton-corduroy-9090-card-object',
  'Greige cotton corduroy in a fine wale, brushed to a soft, slightly chalky hand — a medium-weight cloth with visible texture and a relaxed, structured drape.',
  E'Woven by Pontoglio, an Italian mill from the Biella textile district that specialises in weight-forward, texture-driven cloths — corduroy, moleskin, brushed cotton — rather than the fine worsted suitings the region is best known for. The mill''s cloths are built to develop character with wear, not stay pristine.\n\nIn this piece the jacket is cut as a collarless, button-through overshirt — a stand collar with no lapel, four visible buttons, and two patch pockets at the hip — worn fully fastened over a navy turtleneck with matching cuffed corduroy trousers. It is styled as a complete tonal set rather than a traditional blazer-and-trouser pairing, reading closer to considered off-duty tailoring than formal wear.',
  array['information_card']::knowledge_display_type[],
  'educate',
  10,
  true
)
on conflict (id) do nothing;

insert into knowledge_object_concepts (knowledge_object_id, concept_id)
select 'e6000000-0000-4000-8000-000000009090'::uuid, 'd5000000-0000-4000-8000-000000009090'::uuid
where not exists (
  select 1 from knowledge_object_concepts
  where knowledge_object_id = 'e6000000-0000-4000-8000-000000009090'
    and concept_id = 'd5000000-0000-4000-8000-000000009090'
    and deleted_at is null
);

-- Retire the two separate cards for this one product, replace with the
-- single consolidated one.
update entity_metadata_assignments e
set deleted_at = now()
from products p
where e.target_id = p.id
  and p.slug ilike '%greige-cotton-corduroy%'
  and e.concept_id in (
    'd5000000-0000-4000-8000-000000000210', -- pontoglio
    'd5000000-0000-4000-8000-000000000213'  -- corduroy
  )
  and e.deleted_at is null;

insert into entity_metadata_assignments (
  retailer_id, target_type, target_id, concept_id, source,
  review_status, reviewed_by_staff_id, reviewed_at
)
select
  p.retailer_id, 'product'::metadata_target_type, p.id,
  'd5000000-0000-4000-8000-000000009090'::uuid,
  'paon'::metadata_source, 'accepted'::metadata_review_status,
  (select id from retailer_staff_members where retailer_id = p.retailer_id limit 1),
  now()
from products p
where p.slug ilike '%greige-cotton-corduroy%'
on conflict (retailer_id, target_type, target_id, concept_id)
  where deleted_at is null
  do nothing;
